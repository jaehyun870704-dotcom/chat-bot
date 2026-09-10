# search-lab — Phase 1 검색 파이프라인 단독 검증

PRD Phase 1: Next.js 없이 스크립트만으로 `질문 → 임베딩 → pgvector 검색 → 상위 8개`를
확인한다. 검색 품질이 확보되기 전에는 UI를 만들지 않는다.

## 준비

```
cd search-lab
npm install
```

자격 증명은 `search-lab/.env` 또는 `vector-pipeline/.env` 에서 읽는다(둘 다 있으면 앞의 값이 우선).
필요한 값은 `.env.example` 참고. `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용이며 클라이언트에 노출하지 않는다.

임베딩 모델(`Xenova/multilingual-e5-small`)은 `vector-pipeline` 이 이미 받아둔 캐시를
재사용한다. 다른 위치를 쓰려면 `MODEL_CACHE_DIR` 을 지정한다.

## 실행

```
npm run benchmark    # 노무 질문 10개 검색 품질·소요시간 측정 → docs/phase1/search-benchmark.json
```

## 구현상 중요한 사실

- **e5 프리픽스**: 문서는 `passage: ` 로 임베딩되어 있다
  (`vector-pipeline/src/embeddingClient.js:26`, `labor_chunks.embedding` 컬럼 코멘트).
  따라서 질의는 **반드시 `query: `** 를 붙인다. `src/embedding.js` 참조.
- **임베딩 설정 일치**: 모델 `Xenova/multilingual-e5-small`, dtype `q8`, mean pooling,
  normalize=true, 384차원. 문서 적재와 동일한 vectra `TransformersEmbeddings` 경로를 그대로 쓴다.
- **벡터 인덱스 없음**: `labor_chunks` 에 HNSW/IVFFlat 인덱스가 없어 매 검색이 298,950행
  전수 스캔이다. 실측 약 19~22초로, PRD 목표(300ms)를 크게 초과한 미해결 상태다.
  이 때문에 RPC `match_labor_chunks` 는 함수 단위로 `statement_timeout = 120s` 를 설정해 두었다.
  인덱스 도입 시 이 설정을 제거해야 한다.
- **코퍼스 인코딩 손상**: 판례1~4 소스에서 일부 기호가 `?` 로 치환되어 있다
  (129,067/298,950 청크 = 43.2%, 평균 608자 중 20.7자). 한글 본문은 보존된다.
  `src/sanitize.js` 가 프롬프트·인용에 들어가기 전에 제거한다. 임베딩 자체는 보정 불가.
