-- 이전 챗봇이 만든 3-인자 오버로드를 제거한다.
-- 2-인자 버전과 오버로드 충돌을 일으켜 PostgREST 가 함수를 고르지 못한다.
-- 또한 statement_timeout 설정이 없어 인덱스 없는 현재 상태(약 20초)에서는 항상 타임아웃된다.
--
-- 원복이 필요하면 아래 정의로 재생성할 수 있다:
--   CREATE FUNCTION public.match_labor_chunks(
--     query_embedding vector, match_count integer DEFAULT 8, filter_category text DEFAULT NULL)
--   RETURNS TABLE(id bigint, uri text, chunk_index integer, doc_type text, source text,
--                 category text, title text, case_link text, content text, similarity double precision)
--   LANGUAGE sql STABLE SET search_path TO 'public','extensions' AS $$
--     select id, uri, chunk_index, doc_type, source, category, title, case_link, content,
--            1 - (embedding <=> query_embedding) as similarity
--     from public.labor_chunks
--     where filter_category is null or category = filter_category
--     order by embedding <=> query_embedding limit match_count; $$;

drop function if exists public.match_labor_chunks(extensions.vector, integer, text);
