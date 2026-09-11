import 'server-only';

import { MODEL_ANSWER, readUsage, requireAnthropic, type Usage } from './client';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt';
import type { Chunk } from '@/lib/rag/retriever';
import type { Turn } from './rewriteQuery';

// PRD §3.3 [6]: 답변 생성(Sonnet 5). 근거 청크만 근거로 사용한다.
// 스트리밍으로 받아 첫 토큰을 빨리 내보낸다(§9.1).

const MAX_TOKENS = 4000;

export type GenerateChunkEvent = { type: 'text'; text: string };
export type GenerateDoneEvent = { type: 'done'; body: string; usage: Usage };
export type GenerateEvent = GenerateChunkEvent | GenerateDoneEvent;

/**
 * 답변 본문을 스트리밍으로 생성한다.
 *
 * 여기서 나오는 문자열에는 면책 문구가 없다. 붙이는 것은 호출부의 책임이며,
 * assemble() 을 거치지 않고 사용자에게 내보내면 안 된다(PRD §7.2).
 */
export async function* generateAnswer({
  question,
  chunks,
  history,
}: {
  question: string;
  chunks: Chunk[];
  history: Turn[];
}): AsyncGenerator<GenerateEvent> {
  const client = requireAnthropic();

  const stream = client.messages.stream({
    model: MODEL_ANSWER,
    max_tokens: MAX_TOKENS,
    // 고정 시스템 프롬프트를 캐시 접두사로 둔다. 자료·질문은 매 요청 달라지므로
    // 뒤쪽에 둬야 캐시가 깨지지 않는다.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage({ question, chunks, history }) }],
  });

  let body = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      body += event.delta.text;
      yield { type: 'text', text: event.delta.text };
    }
  }

  const final = await stream.finalMessage();

  // 안전 장치: 거절로 끝났으면 본문을 비워 호출부가 근거 없음으로 처리하게 한다.
  if (final.stop_reason === 'refusal') {
    yield { type: 'done', body: '', usage: readUsage(final.usage) };
    return;
  }

  yield { type: 'done', body, usage: readUsage(final.usage) };
}
