-- PRD F-05 사용량 반영. 읽고-더해서-쓰면 동시 요청에서 증가분이 유실되므로
-- DB 안에서 원자적으로 올린다. service_role 만 실행할 수 있다.

create or replace function public.increment_free_questions(p_user_id uuid)
returns int
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set free_questions_used = free_questions_used + 1
   where id = p_user_id
  returning free_questions_used;
$$;

create or replace function public.add_used_tokens(p_user_id uuid, p_tokens bigint)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.token_balances
     set used_tokens = used_tokens + greatest(coalesce(p_tokens, 0), 0)
   where user_id = p_user_id
  returning used_tokens;
$$;

-- 사용자에게는 노출하지 않는다. 서버(service_role)만 호출한다.
revoke execute on function public.increment_free_questions(uuid) from public, anon, authenticated;
revoke execute on function public.add_used_tokens(uuid, bigint) from public, anon, authenticated;
grant execute on function public.increment_free_questions(uuid) to service_role;
grant execute on function public.add_used_tokens(uuid, bigint) to service_role;
