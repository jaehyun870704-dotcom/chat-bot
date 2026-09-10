-- 벡터 유사도 검색 RPC. labor_chunks 를 읽기만 한다.
-- 벡터 인덱스가 없어 전수 스캔(실측 약 20초)이므로 함수 단위로 statement_timeout 을 올린다.
-- 인덱스(HNSW) 도입 후에는 이 SET 을 제거해야 한다.
create or replace function public.match_labor_chunks(
  query_embedding extensions.vector(384),
  match_count int default 20
)
returns table (
  id bigint,
  uri text,
  chunk_index int,
  doc_type text,
  source text,
  category text,
  title text,
  case_link text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
set statement_timeout = '120s'
as $$
  select
    c.id, c.uri, c.chunk_index, c.doc_type, c.source, c.category,
    c.title, c.case_link, c.content,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity
  from public.labor_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 20), 1), 100);
$$;

revoke all on function public.match_labor_chunks(extensions.vector, int) from public;
revoke all on function public.match_labor_chunks(extensions.vector, int) from anon;
grant execute on function public.match_labor_chunks(extensions.vector, int) to authenticated, service_role;
