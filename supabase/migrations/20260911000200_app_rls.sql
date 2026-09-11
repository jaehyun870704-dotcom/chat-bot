-- PRD §5 RLS. 신규 테이블 전부 RLS 를 켜고 auth.uid() 기준으로 소유자만 접근한다.
-- messages 는 소유 conversation 을 경유해 검사한다.
-- service_role 은 RLS 를 우회하므로 서버 전용 작업(과금 반영 등)은 그대로 동작한다.

alter table public.profiles       enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.token_balances enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.payments       enable row level security;

-- profiles: 본인 행만. 생성은 트리거(SECURITY DEFINER)가 담당하므로 INSERT 정책은 두지 않는다.
-- profiles 는 읽기 전용이다. UPDATE 를 열면 사용자가 free_questions_used 를 0 으로
-- 되돌려 무료 3회 게이트(F-05)를 무력화할 수 있다.
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- subscriptions / token_balances / payments: 읽기 전용.
-- 쓰기는 결제 웹훅·미터링 등 서버(service_role)만 수행한다.
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy token_balances_select_own on public.token_balances
  for select to authenticated using ((select auth.uid()) = user_id);

create policy payments_select_own on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);

-- conversations: 본인 채팅방 전부 CRUD (삭제는 앱에서 소프트 삭제로 처리)
create policy conversations_select_own on public.conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy conversations_insert_own on public.conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy conversations_update_own on public.conversations
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy conversations_delete_own on public.conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- messages: 소유 conversation 경유 검사.
-- 답변 본문·토큰 기록은 서버가 쓰므로 사용자에게는 INSERT 를 열지 않는다.
create policy messages_select_own on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy messages_delete_own on public.messages
  for delete to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = (select auth.uid())
    )
  );
