# 배포 메모 (Vercel)

## 저장소 구조

레포 루트에 여러 패키지가 있고 웹앱은 `app/` 이다.

```
app/             Next.js 웹앱 ← Vercel 이 빌드할 대상
search-lab/      Phase 1 검색 검증 도구 (배포 대상 아님)
vector-pipeline/ 벡터 적재 파이프라인 (배포 대상 아님)
supabase/        마이그레이션 SQL
docs/            실측 보고서
```

**Vercel 프로젝트 설정 → General → Root Directory 를 `app` 으로 지정한다.**

레포 루트에 `vercel.json` 을 두지 않는다. Root Directory 를 `app` 으로 잡으면 빌드가
이미 `app/` 안에서 돌기 때문에, `vercel.json` 에 `cd app && ...` 같은 명령을 넣으면
`cd: app: No such file or directory` 로 실패한다. 둘 중 하나만 써야 한다.
Root Directory 만 지정하면 Next.js 가 자동 감지되어 별도 설정이 필요 없다.

## 환경변수

Vercel 프로젝트 → Settings → Environment Variables 에 등록한다.

| 이름 | 값 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rvbzpimzgpdkcsopfuca.supabase.co` | 클라이언트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key | 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret | **서버 전용** |
| `NEXT_PUBLIC_SITE_URL` | 운영 도메인 (예: `https://chat-bot.vercel.app`) | 클라이언트 |
| `ANTHROPIC_API_KEY` | (나중에) Claude API 키 | **서버 전용** |
| `BILLING_ENABLED` | (나중에) 과금을 켤 때 `true` | 서버 |

`ANTHROPIC_API_KEY` 가 없으면 검색 전용 모드로 동작한다. 키를 넣으면 생성 모드로 바뀐다.
`BILLING_ENABLED` 를 비워두면 무료 무제한이다.

`NEXT_PUBLIC_SITE_URL` 을 비워두면 Vercel 이 주는 배포 URL 을 쓴다. 다만 프리뷰 배포마다
주소가 달라지므로, 운영 도메인이 정해지면 반드시 명시한다 — 이메일 인증 링크가 이 주소로 돌아온다.

환경변수가 없어도 빌드는 통과한다(값은 실제로 쓰일 때 검증한다). 대신 값이 빠진 채 배포하면
해당 기능이 요청 시점에 실패하므로, 첫 배포 전에 위 4개는 채워 두는 것이 좋다.

## Supabase Auth 설정

이메일 인증 링크가 배포 도메인으로 돌아와야 한다.
Supabase → Authentication → URL Configuration 에서:

- Site URL: 배포 도메인
- Redirect URLs: `https://<도메인>/auth/callback` 추가

## 배포 전에 알아야 할 제약

### 1. 검색이 느리다 (미해결)

`labor_chunks` 에 벡터 인덱스가 없어 매 검색이 298,950행 전수 스캔이다.
실측 평균 **17.7초**. PRD 목표는 300ms.

`/api/ask` 에 `maxDuration = 120` 을 설정해 두었는데, **Vercel Hobby 플랜의 함수 실행
한도는 60초**다. Hobby 에서는 이 값이 60초로 깎이므로 검색이 길어지면 요청이 끊길 수 있다.

해결 경로는 하나뿐이다: Supabase Pro 로 올리고 HNSW 인덱스를 만드는 것.
인덱스를 만든 뒤에는 `supabase/migrations/20260910223901_...sql` 의
함수 단위 `statement_timeout = 120s` 도 제거해야 한다.

### 2. 임베딩 모델을 콜드스타트마다 내려받는다

질의 임베딩은 `Xenova/multilingual-e5-small`(q8, 약 120MB)을 서버에서 직접 돌린다.
서버리스에서는 `/tmp/model-cache` 에 받아 두고 컨테이너가 살아 있는 동안 재사용한다.
즉 **첫 요청은 모델 다운로드 시간이 추가로 붙는다.**

이 모델은 문서 적재에 쓴 것과 동일해야 한다(PRD C-02). 다른 모델로 바꾸면 질의와 문서가
다른 벡터 공간에 놓여 검색 품질이 조용히 무너진다.
`search-lab/scripts/verify-embedding-parity.mjs` 가 그 동일성을 검증한다.

### 3. Edge 런타임 불가

`@huggingface/transformers` 는 Node 런타임에서만 동작한다.
`/api/ask` 는 `runtime = 'nodejs'` 로 고정되어 있다. Edge 로 바꾸면 안 된다.

## 배포 후 확인

- [ ] 가입 → 인증 메일 → 로그인이 실제로 동작한다
- [ ] 질문 하나가 끝까지 답변된다 (검색에 20초 이상 걸릴 수 있음)
- [ ] 답변 상·하단에 면책 문구가 붙는다
- [ ] 무관한 질문이 고정 거절 문구로 처리된다
- [ ] 다른 계정의 대화가 보이지 않는다
