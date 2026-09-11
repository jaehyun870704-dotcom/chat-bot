import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// PRD F-05 사용량·과금 게이트.
//
// 질문 전송 시점에 순서대로 검사한다:
//   1. 구독 없음 & free_questions_used < 3 → 허용, 카운트 +1
//   2. 구독 없음 & 3회 소진        → 구독 유도
//   3. 구독 있음 & 잔여 토큰 > 0    → 허용
//   4. 구독 있음 & 토큰 소진        → 충전 유도
//
// 중요: 무료 카운트는 답변이 끝난 뒤에 올린다. 부분 실패 시 과금하지 않기 위해서다.

export const FREE_QUESTION_LIMIT = 3;

/**
 * 과금 기능 on/off.
 *
 * 지금은 꺼져 있다. Claude API 를 붙이기 전까지는 답변에 LLM 비용이 들지 않으므로
 * 무료 3회 제한을 걸 이유가 없고, 걸어두면 4번째 질문부터 결제 경로도 없이 막힌다.
 * PG 사업자(D-01)를 확정하고 Phase 4 를 붙일 때 BILLING_ENABLED=true 로 켠다.
 *
 * 끈 동안에도 profiles.free_questions_used 와 token_balances.used_tokens 는
 * 계속 기록한다. 나중에 가격을 정할 때(D-03/D-05) 쓸 실사용 데이터다.
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED?.trim().toLowerCase() === 'true';
}

export type GateDecision =
  | { allowed: true; mode: 'free'; freeUsed: number }
  | { allowed: true; mode: 'subscription'; remainingTokens: number }
  | { allowed: false; reason: 'need_subscription' | 'need_topup' | 'no_profile' };

export async function checkGate(userId: string): Promise<GateDecision> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('free_questions_used')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { allowed: false, reason: 'no_profile' };

  // 과금이 꺼져 있으면 한도를 적용하지 않는다. 사용량 기록은 계속한다.
  if (!isBillingEnabled()) {
    return { allowed: true, mode: 'free', freeUsed: profile.free_questions_used };
  }

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id, status, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle();

  if (!subscription) {
    if (profile.free_questions_used < FREE_QUESTION_LIMIT) {
      return { allowed: true, mode: 'free', freeUsed: profile.free_questions_used };
    }
    return { allowed: false, reason: 'need_subscription' };
  }

  const { data: balance } = await admin
    .from('token_balances')
    .select('granted_tokens, topup_tokens, used_tokens')
    .eq('user_id', userId)
    .maybeSingle();

  const remaining =
    Number(balance?.granted_tokens ?? 0) +
    Number(balance?.topup_tokens ?? 0) -
    Number(balance?.used_tokens ?? 0);

  if (remaining > 0) return { allowed: true, mode: 'subscription', remainingTokens: remaining };
  return { allowed: false, reason: 'need_topup' };
}

/**
 * 답변이 성공적으로 끝난 뒤에만 호출한다.
 *
 * 무료 카운트 증가는 원자적이어야 한다. 읽고-더해서-쓰면 동시 요청에서 유실되므로
 * DB 함수로 처리한다(increment_free_questions).
 */
export async function commitUsage({
  userId,
  mode,
  inputTokens,
  outputTokens,
}: {
  userId: string;
  mode: 'free' | 'subscription';
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const admin = createAdminClient();

  if (mode === 'free') {
    await admin.rpc('increment_free_questions', { p_user_id: userId });
  }

  await admin.rpc('add_used_tokens', {
    p_user_id: userId,
    p_tokens: inputTokens + outputTokens,
  });
}
