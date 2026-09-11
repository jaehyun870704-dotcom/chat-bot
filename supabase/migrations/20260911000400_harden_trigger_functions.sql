-- 트리거 함수는 트리거로만 실행되면 된다. PostgREST 가 /rest/v1/rpc/ 로 노출하지 않도록
-- anon·authenticated·public 의 EXECUTE 권한을 회수한다.
-- 트리거 실행 시점에는 함수 EXECUTE 권한을 검사하지 않으므로(생성 시점에만 검사) 동작에 영향이 없다.
-- Supabase security advisor: 0028 / 0029.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
