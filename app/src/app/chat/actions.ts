'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// 채팅방 CRUD. 모든 쿼리는 사용자 세션 클라이언트로 수행하므로 RLS 가 소유권을 강제한다.
// 여기서 service_role 을 쓰지 않는 것이 중요하다 — 우회하면 RLS 보호가 사라진다.

const MAX_TITLE_LENGTH = 60;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function createConversation() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('대화를 만들지 못했습니다.');
  }

  revalidatePath('/chat', 'layout');
  redirect(`/chat/${data.id}`);
}

export async function renameConversation(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim().slice(0, MAX_TITLE_LENGTH);
  if (!id || !title) return;

  // RLS 가 남의 대화를 걸러낸다. 소유권을 여기서 다시 확인할 필요가 없다.
  await supabase.from('conversations').update({ title }).eq('id', id);

  revalidatePath('/chat', 'layout');
}

export async function deleteConversation(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  // PRD F-02: 소프트 삭제 후 30일 뒤 하드 삭제.
  await supabase
    .from('conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/chat', 'layout');
  redirect('/chat');
}
