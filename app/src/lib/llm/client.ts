import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

// PRD §3.3 모델 배정: 범위 판정·질의 재작성·제목 생성은 Haiku 4.5(저비용),
// 답변 생성은 Sonnet 5. 구독가 9,900원에서 원가를 방어하려면 이 분리가 필요하다.
export const MODEL_CHEAP = 'claude-haiku-4-5';
export const MODEL_ANSWER = 'claude-sonnet-5';

let cached: Anthropic | null = null;

/** 키가 없으면 null 을 돌려준다. 호출부가 그에 맞게 성능 저하 모드로 동작한다. */
export function getAnthropic(): Anthropic | null {
  if (!isConfigured()) return null;
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  }
  return cached;
}

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY 가 설정되지 않았습니다.');
    this.name = 'LlmNotConfiguredError';
  }
}

export function requireAnthropic(): Anthropic {
  const client = getAnthropic();
  if (!client) throw new LlmNotConfiguredError();
  return client;
}

export type Usage = { inputTokens: number; outputTokens: number };

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

/** 응답 content 에서 텍스트 블록만 이어 붙인다. SDK 타입을 그대로 쓴다. */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export function readUsage(usage: { input_tokens?: number; output_tokens?: number } | undefined): Usage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}
