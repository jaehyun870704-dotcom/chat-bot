// Phase 3 검증 — ANTHROPIC_API_KEY 없이 확인할 수 있는 것들.
//
//  1) 검색 단계가 앱 코드 경로로 실제 동작하고 인코딩 손상이 제거되는가
//  2) 면책 문구가 조립 단계에서 항상 붙는가
//  3) **생성이 실패해도 과금되지 않는가** (PRD §9.3 / F-05)
//
// 실행: npx tsx scripts/verify-pipeline.ts

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const file of ['.env.local', '.env', '../vector-pipeline/.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // 없으면 넘어간다
  }
}

const results: { name: string; passed: boolean; detail: string }[] = [];
function check(name: string, passed: boolean, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const { retrieve, MIN_SIMILARITY, KEEP } = await import('../src/lib/rag/retriever');
const { assemble, verifyAssembled } = await import('../src/lib/answer/assemble');
const { isConfigured } = await import('../src/lib/llm/client');
const { runPipeline } = await import('../src/lib/answer/pipeline');

console.log(`ANTHROPIC_API_KEY 설정됨: ${isConfigured()}\n`);

// --- 1) 검색 ---
const question = '취업규칙을 근로자에게 불리하게 변경하려면 어떤 동의가 필요한가요?';
const t0 = Date.now();
const retrieval = await retrieve(question);
const elapsed = Date.now() - t0;

check(
  '[검색] 앱 코드 경로로 근거 청크를 회수한다',
  retrieval.chunks.length > 0,
  `회수 ${retrieval.retrieved} → 채택 ${retrieval.chunks.length} / 임베딩 ${retrieval.embedMs}ms / 검색 ${retrieval.searchMs}ms`
);
check(
  '[검색] 채택 건수가 상한을 넘지 않는다',
  retrieval.chunks.length <= KEEP,
  `${retrieval.chunks.length} <= ${KEEP}`
);
check(
  '[검색] 컷오프 미만 청크가 섞이지 않는다',
  retrieval.chunks.every((c) => c.similarity >= MIN_SIMILARITY),
  `최저 ${Math.min(...retrieval.chunks.map((c) => c.similarity)).toFixed(4)} >= ${MIN_SIMILARITY}`
);
const mojibakeLeft = retrieval.chunks.filter((c) => /\?{2,}/.test(c.content));
check(
  '[검색] 인코딩 손상(???)이 프롬프트용 본문에서 제거된다',
  mojibakeLeft.length === 0,
  `손상 원문을 가진 청크 ${retrieval.chunks.filter((c) => c.sanitized).length}건 중 잔존 ${mojibakeLeft.length}건`
);
console.log(`      (전체 ${elapsed}ms — 벡터 인덱스 없음, PRD 목표 300ms 미달 상태)\n`);

// --- 2) 면책 조립 ---
const assembled = assemble('## 핵심 답변\n내용입니다.');
check('[§7] 조립 결과가 면책 검증을 통과한다', verifyAssembled(assembled).ok);

// --- 3) 실패 시 과금하지 않는가 ---
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const email = `pipeline-test-${Date.now()}@example.com`;
let userId: string | null = null;

try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  userId = data.user.id;

  const { data: conv } = await admin
    .from('conversations')
    .insert({ user_id: userId, title: '새 대화' })
    .select('id')
    .single();

  const before = await admin
    .from('profiles')
    .select('free_questions_used')
    .eq('id', userId)
    .single();

  const events: string[] = [];
  for await (const event of runPipeline({
    userId,
    conversationId: conv!.id,
    question: '연차휴가는 어떻게 산정하나요?',
  })) {
    events.push(event.type);
  }

  const after = await admin
    .from('profiles')
    .select('free_questions_used')
    .eq('id', userId)
    .single();

  const balance = await admin
    .from('token_balances')
    .select('used_tokens')
    .eq('user_id', userId)
    .single();

  if (isConfigured()) {
    check(
      '[F-05] 답변 성공 시 무료 카운트가 1 올라간다',
      after.data!.free_questions_used === before.data!.free_questions_used + 1,
      `${before.data!.free_questions_used} → ${after.data!.free_questions_used}`
    );
    check(
      '[F-05] 사용 토큰이 기록된다',
      Number(balance.data!.used_tokens) > 0,
      `used_tokens=${balance.data!.used_tokens}`
    );
  } else {
    check(
      '[§9.3] 키가 없어 생성이 실패하면 과금하지 않는다',
      after.data!.free_questions_used === before.data!.free_questions_used &&
        Number(balance.data!.used_tokens) === 0,
      `free_questions_used ${before.data!.free_questions_used} → ${after.data!.free_questions_used}, used_tokens=${balance.data!.used_tokens}`
    );
    check(
      '[§9.3] 실패가 error 이벤트로 전달된다',
      events.includes('error'),
      `이벤트: ${events.join(' → ')}`
    );
  }

  // 무료 3회 소진 후 차단되는지
  await admin.from('profiles').update({ free_questions_used: 3 }).eq('id', userId);
  const blockedEvents: string[] = [];
  for await (const event of runPipeline({
    userId,
    conversationId: conv!.id,
    question: '퇴직금은 어떻게 계산하나요?',
  })) {
    blockedEvents.push(event.type === 'blocked' ? `blocked:${event.reason}` : event.type);
  }
  check(
    '[F-05] 무료 3회 소진 후 4번째 질문이 차단된다',
    blockedEvents.includes('blocked:need_subscription'),
    `이벤트: ${blockedEvents.join(' → ')}`
  );
} catch (err) {
  check('예외 없이 완료', false, (err as Error).message);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  console.log(`\n정리: 테스트 사용자 삭제`);
}

const failed = results.filter((r) => !r.passed);
console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`);
process.exit(failed.length === 0 ? 0 : 1);
