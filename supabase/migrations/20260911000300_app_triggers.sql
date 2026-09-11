-- PRD F-01: 가입 시 profiles·token_balances 행을 트리거로 자동 생성한다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  -- 구독 전에는 부여 토큰이 없다. period_end 는 구독 시작 시 갱신된다.
  insert into public.token_balances (user_id, period_end)
  values (new.id, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- conversations.updated_at 자동 갱신 (목록을 최근 수정순으로 정렬하기 위함)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();
