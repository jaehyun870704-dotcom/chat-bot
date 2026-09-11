-- Supabase 기본 권한은 신규 public 테이블에 anon·authenticated 전체 권한을 부여한다.
-- RLS 가 행 단위로 막아주지만, 정책이 열려 있는 조합에서는 권한이 그대로 통과한다.
-- 권한을 정책이 허용하는 만큼으로 좁힌다.

revoke all on public.profiles       from anon, authenticated;
revoke all on public.subscriptions  from anon, authenticated;
revoke all on public.token_balances from anon, authenticated;
revoke all on public.conversations  from anon, authenticated;
revoke all on public.messages       from anon, authenticated;
revoke all on public.payments       from anon, authenticated;

-- anon 에게는 아무것도 부여하지 않는다.
grant select on public.profiles       to authenticated;
grant select on public.subscriptions  to authenticated;
grant select on public.token_balances to authenticated;
grant select on public.payments       to authenticated;

-- 채팅방: 생성·조회·삭제. 수정은 이름 변경과 소프트 삭제에만 한정한다
-- (created_at·user_id 변조 방지). PRD F-02.
grant select, insert, delete on public.conversations to authenticated;
grant update (title, deleted_at) on public.conversations to authenticated;

-- 메시지: 조회와 삭제만. 답변 본문·토큰 기록은 서버(service_role)가 쓴다.
grant select, delete on public.messages to authenticated;
