// '다시 생성' 검증.
//
//  1) 같은 질문을 재실행하면 사용자 메시지는 늘지 않고 답변만 새로 생긴다
//  2) 남의 답변 id 를 보내도 지워지지 않는다 (RLS)
//
// 실행: npx tsx --conditions react-server scripts/verify-regenerate.mts

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

const { runPipeline } = await import('../src/lib/answer/pipeline');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const created: string[] = [];

try {
  // 사용자 A, B 를 만든다
  const users: { label: string; id: string; email: string; client?: ReturnType<typeof createClient> }[] = [];
  for (const label of ['A', 'B']) {
    const email = `regen-test-${label.toLowerCase()}-${stamp}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'Test-Password-123!',
      email_confirm: true,
    });
    if (error) throw new Error(`${label} 생성 실패: ${error.message}`);
    created.push(data.user.id);
    users.push({ label, id: data.user.id, email });
  }

  for (const u of users) {
    const client = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({
      email: u.email,
      password: 'Test-Password-123!',
    });
    if (error) throw new Error(`${u.label} 로그인 실패: ${error.message}`);
    u.client = client;
  }

  const [a, b] = users;

  const { data: conv } = await admin
    .from('conversations')
    .insert({ user_id: a.id, title: '새 대화' })
    .select('id')
    .single();

  const question = '해고를 서면으로 통지하지 않으면 어떤 효력이 생기나요?';

  // 첫 답변
  for await (const _ of runPipeline({ userId: a.id, conversationId: conv!.id, question })) {
    void _;
  }

  const first = await admin
    .from('messages')
    .select('id, role')
    .eq('conversation_id', conv!.id)
    .order('created_at', { ascending: true });

  const firstUsers = (first.data ?? []).filter((m) => m.role === 'user').length;
  const firstAssistant = (first.data ?? []).find((m) => m.role === 'assistant');

  check('[사전] 첫 질문이 사용자 1 + 답변 1 로 저장된다', firstUsers === 1 && !!firstAssistant,
    `사용자 ${firstUsers}건`);

  // B 가 A 의 답변을 지우려 시도 → 막혀야 한다
  const { data: hijack } = await b.client!
    .from('messages')
    .delete()
    .eq('id', firstAssistant!.id)
    .select('id');
  check('[RLS] 남의 답변은 다시 생성으로 지울 수 없다', (hijack ?? []).length === 0);

  // A 가 자기 답변을 지우고 재실행 (라우트가 하는 일과 동일)
  const { data: removed } = await a.client!
    .from('messages')
    .delete()
    .eq('id', firstAssistant!.id)
    .eq('conversation_id', conv!.id)
    .eq('role', 'assistant')
    .select('id');
  check('[다시 생성] 본인 답변은 지울 수 있다', (removed ?? []).length === 1);

  for await (const _ of runPipeline({
    userId: a.id,
    conversationId: conv!.id,
    question,
    skipUserMessage: true,
  })) {
    void _;
  }

  const second = await admin
    .from('messages')
    .select('id, role')
    .eq('conversation_id', conv!.id)
    .order('created_at', { ascending: true });

  const secondUsers = (second.data ?? []).filter((m) => m.role === 'user').length;
  const secondAssistants = (second.data ?? []).filter((m) => m.role === 'assistant').length;
  const newAssistant = (second.data ?? []).find((m) => m.role === 'assistant');

  check(
    '[다시 생성] 사용자 메시지가 중복되지 않는다',
    secondUsers === 1,
    `사용자 ${secondUsers}건 (1이어야 함)`
  );
  check(
    '[다시 생성] 답변이 하나로 교체된다',
    secondAssistants === 1 && newAssistant!.id !== firstAssistant!.id,
    `답변 ${secondAssistants}건, id 변경 ${newAssistant!.id !== firstAssistant!.id}`
  );
} catch (err) {
  check('예외 없이 완료', false, (err as Error).message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log('\n정리: 테스트 사용자 삭제');
}

const failed = results.filter((r) => !r.passed);
console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`);
process.exit(failed.length === 0 ? 0 : 1);
