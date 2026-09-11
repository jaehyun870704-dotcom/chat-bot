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
import { buildRetrievalOnlyBody } from './retrievalOnly';
import { looksLaborRelated } from './keywords';
import { checkGate, commitUsage, isBillingEnabled, type GateDecision } from '@/lib/billing/gate';

// PRD §3.3 검색 파이프라인.
//   [1] 범위 판정 → [2] 질의 재작성 → [3] 임베딩 → [4] 검색 → [5] 리랭킹
//   → [6] 생성 → [7] 면책 조립(렌더링 시) → [8] 토큰 기록·한도 차감
//
// 두 가지 모드로 동작한다.
//
//   생성 모드 (ANTHROPIC_API_KEY 있음)
//     위 8단계를 그대로 수행한다.
//
//   검색 전용 모드 (키 없음) — 지금 기본값
//     [1] 은 키워드+유사도 휴리스틱, [2] 는 생략(원문으로 검색),
//     [6] 은 검색된 자료를 §7.1 템플릿에 그대로 채워 넣는다. 요약·결론을 만들지 않는다.
//     LLM 호출이 없으므로 토큰 비용이 0이다.
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
  category: string | null;
  caseLink: string | null;
  similarity: number;
  excerpt: string;
};

const EXCERPT_LENGTH = 200;

function toCitations(chunks: Chunk[]): Citation[] {
  return chunks.map((c) => ({
    id: c.id,
    source: c.source,
    title: c.title,
    category: c.category,
    caseLink: c.case_link,
    similarity: c.similarity,
    excerpt:
      c.content.length > EXCERPT_LENGTH ? `${c.content.slice(0, EXCERPT_LENGTH)}…` : c.content,
  }));
}

export async function* runPipeline({
  userId,
  conversationId,
  question,
  // 다시 생성: 같은 질문을 재실행한다. 사용자 메시지는 이미 대화에 있으므로 또 넣지 않는다.
  skipUserMessage = false,
}: {
  userId: string;
  conversationId: string;
  question: string;
  skipUserMessage?: boolean;
}): AsyncGenerator<PipelineEvent> {
  const admin = createAdminClient();
  const llmMode = isConfigured();

  // [0] 과금 게이트. 과금을 끈 동안(BILLING_ENABLED 미설정)에는 통과시킨다.
  const gate: GateDecision = await checkGate(userId);
  if (!gate.allowed) {
    yield { type: 'blocked', reason: gate.reason };
    return;
  }

  let usage: Usage = ZERO_USAGE;
  const history = llmMode ? await loadHistory(conversationId) : [];

  try {
    // [1] 범위 판정
    yield { type: 'status', stage: 'scope' };

    if (llmMode) {
      const scope = await judgeScope(question);
      usage = addUsage(usage, scope.usage);
      if (!scope.inScope) {
        yield* reject();
        return;
      }
    }

    // [2] 질의 재작성 — 생성 모드에서만. 키가 없으면 원문으로 검색한다.
    let searchQuery = question;
    if (llmMode && history.length > 0) {
      yield { type: 'status', stage: 'rewrite' };
      const rewrite = await rewriteQuery(question, history);
      usage = addUsage(usage, rewrite.usage);
      searchQuery = rewrite.query;
    }

    // [3][4][5] 임베딩 → 검색 → 리랭킹
    yield {
      type: 'status',
      stage: 'search',
      detail: searchQuery === question ? undefined : searchQuery,
    };
    const retrieval = await retrieve(searchQuery);

    // 검색 전용 모드의 범위 가드:
    // 컷오프를 넘는 자료가 하나도 없고 질문에 노동·인사 용어도 없으면 무관한 질문으로 본다.
    // 노동 용어가 있으면 자료를 못 찾은 것이지 무관한 것이 아니므로 거절하지 않는다.
    if (!llmMode && retrieval.chunks.length === 0 && !looksLaborRelated(question)) {
      yield* reject();
      return;
    }

    // [6] 답변 생성
    yield { type: 'status', stage: 'generate' };

    let body: string;
    if (llmMode) {
      body = '';
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
      body = sanitizeBody(body);
    } else {
      // 검색된 자료를 템플릿에 그대로 채운다. 요약·결론을 만들지 않는다.
      // 코드가 만든 본문이므로 sanitizeBody 를 거치지 않는다(LLM 출력 후처리 전용).
      body = buildRetrievalOnlyBody(question, retrieval.chunks);
      yield { type: 'text', text: body };
    }

    const citations = toCitations(retrieval.chunks);
    yield { type: 'citations', citations };

    // [7] 저장. 면책 문구는 저장하지 않는다 — 렌더링 시 코드가 붙인다(§5, §7.2).
    const messageId = await persist({ conversationId, question, body, citations, usage });

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
      message:
        '답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요. 이 요청은 과금되지 않았습니다.',
    };
  }

  // 범위 밖 처리: 고정 문구를 돌려준다. 생성 모델을 부르지 않는다(F-04).
  async function* reject(): AsyncGenerator<PipelineEvent> {
    await persist({ conversationId, question, body: null, citations: null, usage });
    await commitUsage({
      userId,
      mode: gate.allowed ? gate.mode : 'free',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    yield { type: 'rejected', message: OUT_OF_SCOPE_MESSAGE };
    yield { type: 'done', messageId: null };
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
    if (!skipUserMessage) {
      await admin.from('messages').insert({ conversation_id: id, role: 'user', content: q });
    }

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

    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);

    return data?.id ?? null;
  }

  async function maybeSetTitle(id: string, q: string) {
    const { data } = await admin.from('conversations').select('title').eq('id', id).maybeSingle();
    if (data?.title !== '새 대화') return;

    // 키가 없으면 Haiku 를 부르지 않고 질문 앞부분을 쓴다.
    const title = llmMode
      ? (await generateTitle(q)).title
      : q.replace(/\s+/g, ' ').trim().slice(0, 30);

    await admin.from('conversations').update({ title }).eq('id', id);
  }
}

export { isBillingEnabled };
