import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { retrieve, type Chunk } from '@/lib/rag/retriever';
import { judgeScope } from '@/lib/llm/scopeGuard';
import { rewriteQuery, type Turn } from '@/lib/llm/rewriteQuery';
import { generateAnswer } from '@/lib/llm/generate';
import { generateTitle } from '@/lib/llm/title';
import { HISTORY_TURNS } from '@/lib/llm/prompt';
import { addUsage, isConfigured, ZERO_USAGE, type Usage } from '@/lib/llm/client';
import { OUT_OF_SCOPE_MESSAGE } from './disclaimer';
import { sanitizeBody } from './sanitize';
import { checkGate, commitUsage, type GateDecision } from '@/lib/billing/gate';

// PRD §3.3 검색 파이프라인 전체를 잇는다.
//   [1] 범위 판정 → [2] 질의 재작성 → [3] 임베딩 → [4] 검색 → [5] 리랭킹
//   → [6] 생성 → [7] 면책 조립(렌더링 시) → [8] 토큰 기록·한도 차감
//
// §9.3: 실패 시 과금하지 않는다. commitUsage 는 답변이 끝난 뒤에만 부른다.

export type PipelineEvent =
  | { type: 'status'; stage: 'scope' | 'rewrite' | 'search' | 'generate'; detail?: string }
  | { type: 'rejected'; message: string }
  | { type: 'blocked'; reason: 'need_subscription' | 'need_topup' | 'no_profile' }
  | { type: 'text'; text: string }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'done'; messageId: string | null }
  | { type: 'error'; message: string };

export type Citation = {
  id: number;
  source: string | null;
  title: string | null;
  similarity: number;
  excerpt: string;
};

const EXCERPT_LENGTH = 200;

function toCitations(chunks: Chunk[]): Citation[] {
  return chunks.map((c) => ({
    id: c.id,
    source: c.source,
    title: c.title,
    similarity: c.similarity,
    excerpt:
      c.content.length > EXCERPT_LENGTH ? `${c.content.slice(0, EXCERPT_LENGTH)}…` : c.content,
  }));
}

export async function* runPipeline({
  userId,
  conversationId,
  question,
}: {
  userId: string;
  conversationId: string;
  question: string;
}): AsyncGenerator<PipelineEvent> {
  const admin = createAdminClient();

  // [0] 과금 게이트. 통과하지 못하면 LLM 을 아예 부르지 않는다.
  const gate: GateDecision = await checkGate(userId);
  if (!gate.allowed) {
    yield { type: 'blocked', reason: gate.reason };
    return;
  }

  if (!isConfigured()) {
    yield {
      type: 'error',
      message: 'ANTHROPIC_API_KEY 가 설정되지 않아 답변을 생성할 수 없습니다.',
    };
    return;
  }

  let usage: Usage = ZERO_USAGE;

  // 직전 6턴을 맥락으로 쓴다(F-03).
  const history = await loadHistory(conversationId);

  try {
    // [1] 범위 판정 (Haiku)
    yield { type: 'status', stage: 'scope' };
    const scope = await judgeScope(question);
    usage = addUsage(usage, scope.usage);

    if (!scope.inScope) {
      // 거절은 고정 문구다. 생성 모델을 부르지 않는다(F-04).
      await persist({ conversationId, question, body: null, citations: null, usage });
      await commitUsage({
        userId,
        mode: gate.mode,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      yield { type: 'rejected', message: OUT_OF_SCOPE_MESSAGE };
      yield { type: 'done', messageId: null };
      return;
    }

    // [2] 질의 재작성 (Haiku) — 멀티턴 맥락을 독립 검색어로
    yield { type: 'status', stage: 'rewrite' };
    const rewrite = await rewriteQuery(question, history);
    usage = addUsage(usage, rewrite.usage);

    // [3][4][5] 임베딩 → 검색 → 리랭킹
    yield {
      type: 'status',
      stage: 'search',
      detail: rewrite.rewritten ? rewrite.query : undefined,
    };
    const retrieval = await retrieve(rewrite.query);

    // [6] 생성 (Sonnet 5, 스트리밍)
    yield { type: 'status', stage: 'generate' };

    let body = '';
    for await (const event of generateAnswer({
      question,
      chunks: retrieval.chunks,
      history,
    })) {
      if (event.type === 'text') {
        body += event.text;
        yield { type: 'text', text: event.text };
      } else {
        usage = addUsage(usage, event.usage);
        body = event.body;
      }
    }

    const citations = toCitations(retrieval.chunks);
    yield { type: 'citations', citations };

    // [7] 저장. 면책 문구는 저장하지 않는다 — 렌더링 시 코드가 붙인다(§5, §7.2).
    const messageId = await persist({
      conversationId,
      question,
      body: sanitizeBody(body),
      citations,
      usage,
    });

    // [8] 여기까지 와야 과금한다.
    await commitUsage({
      userId,
      mode: gate.mode,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    await maybeSetTitle(conversationId, question);

    yield { type: 'done', messageId };
  } catch (err) {
    // §9.3: 실패하면 과금하지 않는다. commitUsage 를 부르지 않고 빠져나간다.
    console.error('[pipeline]', err);
    yield {
      type: 'error',
      message: '답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요. 이 요청은 과금되지 않았습니다.',
    };
  }

  async function loadHistory(id: string): Promise<Turn[]> {
    const { data } = await admin
      .from('messages')
      .select('role, content')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_TURNS);

    const rows = (data ?? []).reverse() as { role: 'user' | 'assistant'; content: string }[];

    // 맥락이 assistant 로 시작하면 짝이 맞지 않는다. 앞을 잘라 user 로 시작하게 한다.
    const firstUser = rows.findIndex((r) => r.role === 'user');
    return firstUser <= 0 ? rows : rows.slice(firstUser);
  }

  async function persist({
    conversationId: id,
    question: q,
    body,
    citations,
    usage: u,
  }: {
    conversationId: string;
    question: string;
    body: string | null;
    citations: Citation[] | null;
    usage: Usage;
  }): Promise<string | null> {
    await admin.from('messages').insert({
      conversation_id: id,
      role: 'user',
      content: q,
    });

    // 거절된 질문에는 assistant 행을 남기지 않는다. 고정 문구는 저장할 내용이 아니다.
    if (body === null) return null;

    const { data } = await admin
      .from('messages')
      .insert({
        conversation_id: id,
        role: 'assistant',
        content: body,
        citations,
        input_tokens: u.inputTokens,
        output_tokens: u.outputTokens,
      })
      .select('id')
      .single();

    await admin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    return data?.id ?? null;
  }

  async function maybeSetTitle(id: string, q: string) {
    const { data } = await admin
      .from('conversations')
      .select('title')
      .eq('id', id)
      .maybeSingle();

    if (data?.title !== '새 대화') return;

    const { title } = await generateTitle(q);
    await admin.from('conversations').update({ title }).eq('id', id);
  }
}
