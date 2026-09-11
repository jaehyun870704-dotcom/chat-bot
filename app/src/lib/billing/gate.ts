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
