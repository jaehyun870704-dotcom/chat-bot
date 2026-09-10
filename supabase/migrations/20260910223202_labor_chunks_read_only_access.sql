-- 벡터 코퍼스(labor_chunks)를 애플리케이션 롤에 대해 읽기 전용으로 고정한다.
-- 쓰기는 service_role(서버 전용)과 postgres 만 가능하다.
-- PRD §5: "벡터 테이블은 인증된 사용자에게 SELECT만 허용한다."

revoke insert, update, delete, truncate, references, trigger
  on public.labor_chunks from anon, authenticated;

grant select on public.labor_chunks to anon, authenticated;

revoke usage, update, select on sequence public.labor_chunks_id_seq
  from anon, authenticated;

drop policy if exists labor_chunks_public_read on public.labor_chunks;

create policy labor_chunks_authenticated_read
  on public.labor_chunks
  for select
  to authenticated
  using (true);
