// PRD §10 검증: 다른 사용자의 대화가 조회되지 않는가 (RLS), 그리고
// 사용자가 free_questions_used 를 직접 되돌릴 수 없는가 (F-05 게이트).
//
// 테스트 사용자 2명을 만들고, 각자의 JWT 로 anon 키를 써서 교차 접근을 시도한 뒤
// 반드시 사용자를 삭제한다. 실행: node scripts/verify-rls.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// service_role 키는 vector-pipeline/.env 에 이미 있으므로 거기서도 읽는다.
for (const file of ['.env.local', '.env', '../vector-pipeline/.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // 파일이 없으면 넘어간다
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const users = [
  { label: 'A', email: `rls-test-a-${stamp}@example.com`, password: 'Test-Password-123!' },
  { label: 'B', email: `rls-test-b-${stamp}@example.com`, password: 'Test-Password-123!' },
];

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const created = [];

try {
  // 1) 사용자 생성 (email_confirm 로 인증 절차를 건너뛴다)
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`사용자 ${u.label} 생성 실패: ${error.message}`);
    u.id = data.user.id;
    created.push(data.user.id);
  }

  // 2) 가입 트리거가 profiles / token_balances 를 만들었는지 (F-01)
  for (const u of users) {
    const { data: p } = await admin.from('profiles').select('id, email, free_questions_used').eq('id', u.id).maybeSingle();
    const { data: b } = await admin.from('token_balances').select('user_id').eq('user_id', u.id).maybeSingle();
    check(`[F-01] 사용자 ${u.label}: profiles 행 자동 생성`, !!p, p ? `free_questions_used=${p.free_questions_used}` : '행 없음');
    check(`[F-01] 사용자 ${u.label}: token_balances 행 자동 생성`, !!b);
  }

  // 3) 각 사용자 세션 만들기
  for (const u of users) {
    const client = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: u.email, password: u.password });
    if (error) throw new Error(`사용자 ${u.label} 로그인 실패: ${error.message}`);
    u.client = client;
  }

  // 4) A 가 대화를 만든다
  const { data: convA, error: convErr } = await users[0].client
    .from('conversations')
    .insert({ user_id: users[0].id, title: 'A의 비밀 대화' })
    .select('id')
    .single();
  check('[F-02] 본인 대화 생성', !convErr && !!convA, convErr?.message ?? '');
  if (!convA) throw new Error('대화 생성 실패로 이후 검증 중단');

  await admin.from('messages').insert({
    conversation_id: convA.id,
    role: 'user',
    content: 'A 의 비밀 질문입니다',
  });

  // 5) B 가 A 의 대화를 조회할 수 있는가 → 안 되어야 한다
  const { data: bSeesConv } = await users[1].client.from('conversations').select('id, title');
  check(
    '[RLS] B 는 A 의 대화를 조회할 수 없다',
    (bSeesConv ?? []).every((c) => c.id !== convA.id),
    `B 가 본 대화 수: ${(bSeesConv ?? []).length}`
  );

  const { data: bSeesConvDirect } = await users[1].client
    .from('conversations')
    .select('id')
    .eq('id', convA.id);
  check('[RLS] B 는 A 의 대화를 id 로 지목해도 조회할 수 없다', (bSeesConvDirect ?? []).length === 0);

  // 6) B 가 A 의 메시지를 조회할 수 있는가 → 안 되어야 한다
  const { data: bSeesMsgs } = await users[1].client
    .from('messages')
    .select('id, content')
    .eq('conversation_id', convA.id);
  check('[RLS] B 는 A 의 메시지를 조회할 수 없다', (bSeesMsgs ?? []).length === 0);

  // 7) B 가 A 의 대화를 수정/삭제할 수 있는가 → 안 되어야 한다
  const { data: bUpdate } = await users[1].client
    .from('conversations')
    .update({ title: '탈취됨' })
    .eq('id', convA.id)
    .select('id');
  check('[RLS] B 는 A 의 대화 제목을 바꿀 수 없다', (bUpdate ?? []).length === 0);

  const { data: bDelete } = await users[1].client
    .from('conversations')
    .delete()
    .eq('id', convA.id)
    .select('id');
  check('[RLS] B 는 A 의 대화를 삭제할 수 없다', (bDelete ?? []).length === 0);

  // 8) A 가 남의 소유로 대화를 만들 수 있는가 → 안 되어야 한다
  const { error: spoofErr } = await users[0].client
    .from('conversations')
    .insert({ user_id: users[1].id, title: 'B 사칭' })
    .select('id');
  check('[RLS] A 는 B 소유로 대화를 만들 수 없다', !!spoofErr, spoofErr?.message ?? '차단되지 않음');

  // 9) F-05 게이트: 사용자가 무료 질문 카운터를 되돌릴 수 있는가 → 안 되어야 한다
  await admin.from('profiles').update({ free_questions_used: 3 }).eq('id', users[0].id);
  await users[0].client.from('profiles').update({ free_questions_used: 0 }).eq('id', users[0].id);
  const { data: afterReset } = await admin
    .from('profiles')
    .select('free_questions_used')
    .eq('id', users[0].id)
    .maybeSingle();
  check(
    '[F-05] 사용자는 free_questions_used 를 되돌릴 수 없다',
    afterReset?.free_questions_used === 3,
    `현재 값: ${afterReset?.free_questions_used}`
  );

  // 10) 벡터 코퍼스는 인증 사용자에게 읽기만 허용
  const { data: chunkRead, error: chunkReadErr } = await users[0].client
    .from('labor_chunks')
    .select('id')
    .limit(1);
  check('[§5] 인증 사용자는 labor_chunks 를 읽을 수 있다', !chunkReadErr && (chunkRead ?? []).length === 1, chunkReadErr?.message ?? '');

  const { error: chunkWriteErr } = await users[0].client
    .from('labor_chunks')
    .delete()
    .eq('id', 1)
    .select('id');
  check('[§5] 인증 사용자는 labor_chunks 를 삭제할 수 없다', !!chunkWriteErr, chunkWriteErr?.message ?? '차단되지 않음');

  // 11) 비로그인(anon)은 앱 테이블에 접근할 수 없다
  const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: anonConvs } = await anonClient.from('conversations').select('id');
  check('[RLS] 비로그인 사용자는 대화를 조회할 수 없다', (anonConvs ?? []).length === 0);
} catch (err) {
  check('예외 없이 완료', false, err.message);
} finally {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(`\n정리: 테스트 사용자 ${created.length}명 삭제`);
}

const failed = results.filter((r) => !r.passed);
console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`);
process.exit(failed.length === 0 ? 0 : 1);
