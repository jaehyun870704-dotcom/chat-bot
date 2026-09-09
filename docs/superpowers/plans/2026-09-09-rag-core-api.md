# RAG 핵심 API 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 질문을 받아 Supabase pgvector에서 노동법 근거를 검색하고, Claude가 채운 슬롯을 코드가 고정 템플릿으로 조립해 반환하는 HTTP API를 만든다.

**Architecture:** RAG 코어를 순수 라이브러리 모듈(`src/`)로 두고 그 위에 얇은 express 서버를 얹는다. 이후 단계(UI/인증/결제)에서 프론트엔드가 HTTP로 호출하든 라이브러리를 직접 import하든 선택할 수 있게 결합도를 낮춘다. 답변 형식은 프롬프트로 "유도"하지 않고, Claude는 구조화 출력(structured outputs)으로 슬롯 값만 반환하며 최종 문자열은 `template.js`가 조립한다. 관련판례의 제목·링크는 AI 출력이 아니라 검색된 행에서 코드가 가져오므로 링크 환각이 원천 차단된다.

**Tech Stack:** Node.js v22 (CommonJS), express, `@anthropic-ai/sdk` (`messages.parse` + `zodOutputFormat`), zod, vectra(TransformersEmbeddings), Supabase PostgREST RPC, `node:test` 내장 러너

**Spec:** `vector-pipeline/PRD_노동법_HR_챗봇.md` (4.4 질문/답변, 4.5 대화 방식, 7 기술 아키텍처)

## Global Constraints

프로젝트 전역 제약. 모든 Task의 요구사항에 암묵적으로 포함된다.

- **작업 디렉터리**: `D:\강재현\1. 좋은인재연구소\11. 챗봇\api\` (신규). `vector-pipeline/`은 읽기 참조만 하고 수정하지 않는다.
- **모듈 시스템**: CommonJS (`require`). 기존 코드베이스와 동일.
- **임베딩 모델**: `Xenova/multilingual-e5-small`, 384차원, `dtype: 'q8'`, `device: 'cpu'`. 적재 시 `'passage: '` 프리픽스를 썼으므로 **질의는 반드시 `'query: '` 프리픽스**. vectra의 `TransformersEmbeddings`를 그대로 써서 적재 때와 동일한 풀링/정규화 경로를 보장한다 (다른 라이브러리로 바꾸면 유사도가 깨진다).
- **검색 함수**: `public.match_labor_chunks(query_embedding vector, match_count integer DEFAULT 8, filter_category text DEFAULT NULL)` → `TABLE(id bigint, uri text, chunk_index integer, doc_type text, source text, category text, title text, case_link text, content text, similarity double precision)`
- **카테고리 값 6종**: `판례`(236,454) / `행정해석`(40,946) / `행정심판`(10,558) / `산재심사재결례`(7,116) / `reference`(2,455) / `지침`(1,421)
- **DB는 쓰기 금지**: 무료 티어 스토리지 한도 초과로 read-only일 수 있다. 벡터 인덱스(HNSW/IVFFlat)가 없어 브루트포스 검색이며 질의당 수 초가 걸릴 수 있다. 이 계획에서 인덱스 생성이나 DDL을 시도하지 않는다.
- **고정 템플릿 슬롯 5개(문구 그대로)**: `[핵심 답변]` `[근거 자료 상세]` `[실무적 적용]` `[연관내용]` `[관련판례]`
- **면책조항(문구 그대로, 코드가 상단·하단에 항상 삽입, AI 출력에 포함 금지)**:
  ```
  ------------------------------------------------------------
  본 답변은 업로드된 자료를 바탕으로 작성되었으며, 실제 사건 적용 시에는
  반드시 전문가의 검토가 필요합니다. 구체적인 도움이 필요하시면
  좋은인재연구소(goodhr.kr)로 문의주세요.
  ------------------------------------------------------------
  ```
- **Claude 모델**: 기본 `claude-opus-5`. `ANTHROPIC_MODEL` 환경변수로 교체 가능(PRD Open Item #4는 Task 9의 실측으로 닫는다). 모델 ID에 날짜 접미사를 붙이지 않는다.
- **네트워크 제약(중요)**: 이 컴퓨터의 조직 egress 정책상 `supabase.co`와 `api.anthropic.com`은 **Claude Code 세션의 셸에서 차단**된다 (`vector-pipeline/src/migrate-to-supabase.js` 상단 주석에 기록된 실제 사례). 따라서:
  - `test/` 아래 테스트는 **전부 네트워크 없이** 돌아야 한다 (fetch/SDK 클라이언트를 주입해 스텁으로 대체).
  - 실제 Supabase·Claude 호출이 필요한 검증은 `scripts/` 아래 스크립트로 두고 **사용자가 자기 일반 터미널에서 직접 실행**한다. 각 Task에 "사용자 실행" 표시가 있는 단계가 그것이다.
- **비밀정보**: `.env`는 절대 커밋하지 않는다. `.env.example`에는 값이 아니라 키 이름만 둔다.

---

### Task 1: 프로젝트 스캐폴딩과 설정 로더

**Files:**
- Create: `api/.gitignore`
- Create: `api/package.json`
- Create: `api/.env.example`
- Create: `api/src/config.js`
- Test: `api/test/config.test.js`

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces: `loadConfig(env) -> { supabaseUrl, supabaseKey, anthropicApiKey, model, rewriteModel, matchCount, port }`, 상수 `DEFAULT_MODEL`(문자열), `CATEGORIES`(문자열 배열 6종). 이후 모든 Task가 이 config 객체를 인자로 받는다.

- [ ] **Step 1: 디렉터리 생성과 git 초기화**

`11. 챗봇` 루트에는 3GB짜리 데이터 파일과 원본 자료 폴더들이 있으므로 루트가 아니라 `api/`만 저장소로 만든다.

```bash
cd "D:/강재현/1. 좋은인재연구소/11. 챗봇"
mkdir -p api/src api/test api/scripts
cd api
git init
```

- [ ] **Step 2: `.gitignore` 작성**

```
node_modules/
.env
*.log
```

- [ ] **Step 3: 의존성 설치**

```bash
cd "D:/강재현/1. 좋은인재연구소/11. 챗봇/api"
npm init -y
npm install @anthropic-ai/sdk zod express dotenv vectra
```

버전은 npm이 해석한 최신을 그대로 쓴다. `@anthropic-ai/sdk`는 `messages.parse`와 `helpers/zod`의 `zodOutputFormat`이 있어야 하므로, 설치 후 다음이 에러 없이 출력되는지 확인한다.

```bash
node -e "const {zodOutputFormat}=require('@anthropic-ai/sdk/helpers/zod'); console.log(typeof zodOutputFormat)"
```
Expected: `function`

- [ ] **Step 4: `package.json`의 scripts 수정**

`api/package.json`의 `"scripts"`를 아래로 교체한다.

```json
  "scripts": {
    "test": "node --test test/",
    "start": "node src/server.js"
  },
```

- [ ] **Step 5: `.env.example` 작성**

```
SUPABASE_URL=https://rvbzpimzgpdkcsopfuca.supabase.co
SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_secret_key
ANTHROPIC_API_KEY=여기에_Anthropic_API_key
ANTHROPIC_MODEL=claude-opus-5
MATCH_COUNT=8
PORT=3001
```

- [ ] **Step 6: 실패하는 테스트 작성 — `api/test/config.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { loadConfig, DEFAULT_MODEL, CATEGORIES } = require('../src/config');

const validEnv = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
};

test('필수 환경변수가 없으면 어떤 키가 빠졌는지 알려주며 throw', () => {
  assert.throws(
    () => loadConfig({ SUPABASE_URL: 'https://example.supabase.co' }),
    /SUPABASE_SERVICE_ROLE_KEY.*ANTHROPIC_API_KEY|ANTHROPIC_API_KEY/
  );
});

test('SUPABASE_URL 끝의 슬래시를 제거한다', () => {
  assert.strictEqual(loadConfig(validEnv).supabaseUrl, 'https://example.supabase.co');
});

test('모델 기본값은 claude-opus-5', () => {
  const cfg = loadConfig(validEnv);
  assert.strictEqual(cfg.model, DEFAULT_MODEL);
  assert.strictEqual(DEFAULT_MODEL, 'claude-opus-5');
});

test('ANTHROPIC_MODEL을 주면 rewriteModel도 따라간다', () => {
  const cfg = loadConfig({ ...validEnv, ANTHROPIC_MODEL: 'claude-sonnet-5' });
  assert.strictEqual(cfg.model, 'claude-sonnet-5');
  assert.strictEqual(cfg.rewriteModel, 'claude-sonnet-5');
});

test('ANTHROPIC_REWRITE_MODEL은 rewriteModel만 따로 덮어쓴다', () => {
  const cfg = loadConfig({ ...validEnv, ANTHROPIC_MODEL: 'claude-opus-5', ANTHROPIC_REWRITE_MODEL: 'claude-haiku-4-5' });
  assert.strictEqual(cfg.model, 'claude-opus-5');
  assert.strictEqual(cfg.rewriteModel, 'claude-haiku-4-5');
});

test('matchCount와 port는 숫자로 파싱되고 기본값이 있다', () => {
  const cfg = loadConfig(validEnv);
  assert.strictEqual(cfg.matchCount, 8);
  assert.strictEqual(cfg.port, 3001);
  assert.strictEqual(loadConfig({ ...validEnv, MATCH_COUNT: '12' }).matchCount, 12);
});

test('CATEGORIES는 실제 DB의 6개 카테고리', () => {
  assert.deepStrictEqual(
    [...CATEGORIES].sort(),
    ['reference', '지침', '판례', '행정심판', '행정해석', '산재심사재결례'].sort()
  );
});
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/config'`

- [ ] **Step 8: `api/src/config.js` 구현**

```javascript
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_MODEL = 'claude-opus-5';
const REQUIRED_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY'];
const CATEGORIES = ['판례', '행정해석', '행정심판', '산재심사재결례', 'reference', '지침'];

function loadConfig(env = process.env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`필수 환경변수가 없습니다: ${missing.join(', ')} (.env.example 참고)`);
  }
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  return {
    supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ''),
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    model,
    rewriteModel: env.ANTHROPIC_REWRITE_MODEL || model,
    matchCount: parseInt(env.MATCH_COUNT || '8', 10),
    port: parseInt(env.PORT || '3001', 10),
  };
}

module.exports = { loadConfig, DEFAULT_MODEL, CATEGORIES };
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (7 tests)

- [ ] **Step 10: 커밋**

```bash
git add .gitignore package.json package-lock.json .env.example src/config.js test/config.test.js
git commit -m "feat: RAG API 스캐폴딩과 환경설정 로더 추가"
```

---

### Task 2: 임베딩 모듈 (적재 경로와 동일성 보장)

**Files:**
- Create: `api/src/embedding.js`
- Create: `api/scripts/check-embedding.js`
- Test: `api/test/embedding.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `embedQuery(text) -> Promise<number[]>` (384개 float), `warmup() -> Promise<void>`, 상수 `MODEL`. Task 3·7이 사용한다.

**왜 이 Task가 따로 있나:** 질의 임베딩이 적재 때와 조금이라도 다른 경로(다른 라이브러리, 다른 dtype, 프리픽스 누락)로 만들어지면 검색이 조용히 망가진다. 에러는 안 나고 결과만 엉뚱해지므로 반드시 실측으로 확인한다.

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/embedding.test.js`**

모델 로드는 네트워크/디스크가 필요하므로 여기서는 계약만 검증한다. 실측은 Step 5에서 한다.

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { MODEL, embedQuery, warmup } = require('../src/embedding');

test('적재 때 쓴 모델 ID와 동일해야 한다', () => {
  assert.strictEqual(MODEL, 'Xenova/multilingual-e5-small');
});

test('embedQuery와 warmup을 함수로 노출한다', () => {
  assert.strictEqual(typeof embedQuery, 'function');
  assert.strictEqual(typeof warmup, 'function');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/embedding'`

- [ ] **Step 3: `api/src/embedding.js` 구현**

`vector-pipeline/src/embeddingClient.js`의 질의 경로와 옵션을 그대로 맞춘다.

```javascript
const { TransformersEmbeddings } = require('vectra');

const MODEL = 'Xenova/multilingual-e5-small';

let basePromise = null;

function getBase() {
  if (!basePromise) {
    basePromise = TransformersEmbeddings.create({
      model: MODEL,
      dtype: 'q8',
      device: 'cpu',
    });
  }
  return basePromise;
}

// 적재 시 'passage: ' 프리픽스를 붙였으므로 질의는 'query: ' 를 붙여야
// e5 계열의 비대칭 검색이 정상 동작한다.
async function embedQuery(text) {
  const base = await getBase();
  const res = await base.createEmbeddings(['query: ' + text]);
  if (res.status !== 'success') {
    throw new Error('임베딩 실패: ' + res.message);
  }
  return res.output[0];
}

async function warmup() {
  await getBase();
}

module.exports = { MODEL, embedQuery, warmup };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (9 tests)

- [ ] **Step 5: 실측 검증 스크립트 작성 — `api/scripts/check-embedding.js`**

```javascript
// 사용자 터미널에서 실행: node scripts/check-embedding.js
const { embedQuery, MODEL } = require('../src/embedding');

async function main() {
  console.log(`모델 로딩 중: ${MODEL} (최초 1회는 다운로드로 수 분 걸릴 수 있음)`);
  const startedAt = Date.now();
  const vector = await embedQuery('부당해고 구제신청 기간은 얼마인가요?');
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`차원 수: ${vector.length}`);
  console.log(`소요: ${elapsed}초`);
  console.log(`앞 5개 값: ${vector.slice(0, 5).map((v) => v.toFixed(4)).join(', ')}`);

  const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0));
  console.log(`L2 norm: ${norm.toFixed(4)}`);

  if (vector.length !== 384) {
    console.error('실패: 384차원이 아닙니다. 적재된 벡터와 호환되지 않습니다.');
    process.exit(1);
  }
  console.log('통과: 384차원 질의 벡터 생성 확인');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: 실측 확인 (사용자 터미널에서 실행)**

Run: `node scripts/check-embedding.js`
Expected: `차원 수: 384` 와 `통과: ...` 출력. 384가 아니면 이후 Task를 진행하지 말고 원인을 먼저 잡는다.

- [ ] **Step 7: 커밋**

```bash
git add src/embedding.js test/embedding.test.js scripts/check-embedding.js
git commit -m "feat: 적재 경로와 동일한 질의 임베딩 모듈 추가"
```

---

### Task 3: Supabase 벡터 검색 (retriever)

**Files:**
- Create: `api/src/retriever.js`
- Create: `api/scripts/check-supabase.js`
- Test: `api/test/retriever.test.js`

**Interfaces:**
- Consumes: Task 1의 `loadConfig` 결과 객체
- Produces:
  - `toVectorLiteral(vector) -> string` (`'[0.1,0.2,...]'` 형태)
  - `searchChunks(vector, { config, matchCount, category, fetchImpl }) -> Promise<Chunk[]>`
  - `Chunk` = `{ id, uri, chunk_index, doc_type, source, category, title, case_link, content, similarity }` (DB 함수 반환 컬럼 그대로, snake_case). Task 4·5·7이 이 형태를 그대로 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/retriever.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { searchChunks, toVectorLiteral } = require('../src/retriever');

const config = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseKey: 'service-key',
  matchCount: 8,
};

function stubFetch(response) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  return { fetchImpl, calls };
}

function okResponse(rows) {
  return { ok: true, status: 200, json: async () => rows };
}

test('벡터를 pgvector 리터럴 문자열로 바꾼다', () => {
  assert.strictEqual(toVectorLiteral([0.1, -0.2, 0.3]), '[0.1,-0.2,0.3]');
});

test('match_labor_chunks RPC를 올바른 URL과 헤더로 호출한다', async () => {
  const { fetchImpl, calls } = stubFetch(okResponse([]));
  await searchChunks([0.1, 0.2], { config, fetchImpl });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/match_labor_chunks');
  assert.strictEqual(calls[0].options.method, 'POST');
  assert.strictEqual(calls[0].options.headers.apikey, 'service-key');
  assert.strictEqual(calls[0].options.headers.Authorization, 'Bearer service-key');
});

test('query_embedding은 문자열 리터럴로, 기본 match_count는 config 값으로 보낸다', async () => {
  const { fetchImpl, calls } = stubFetch(okResponse([]));
  await searchChunks([0.1, 0.2], { config, fetchImpl });

  const body = JSON.parse(calls[0].options.body);
  assert.strictEqual(body.query_embedding, '[0.1,0.2]');
  assert.strictEqual(body.match_count, 8);
  assert.strictEqual(body.filter_category, null);
});

test('category를 주면 filter_category로 전달한다', async () => {
  const { fetchImpl, calls } = stubFetch(okResponse([]));
  await searchChunks([0.1], { config, category: '판례', matchCount: 3, fetchImpl });

  const body = JSON.parse(calls[0].options.body);
  assert.strictEqual(body.filter_category, '판례');
  assert.strictEqual(body.match_count, 3);
});

test('DB가 돌려준 행을 그대로 반환한다', async () => {
  const rows = [{ id: 1, title: '대법원 2020다1234', similarity: 0.87, content: '본문' }];
  const { fetchImpl } = stubFetch(okResponse(rows));
  const result = await searchChunks([0.1], { config, fetchImpl });
  assert.deepStrictEqual(result, rows);
});

test('HTTP 에러면 상태코드와 본문 일부를 담아 throw', async () => {
  const { fetchImpl } = stubFetch({
    ok: false,
    status: 503,
    text: async () => 'service unavailable',
  });
  await assert.rejects(
    () => searchChunks([0.1], { config, fetchImpl }),
    /503.*service unavailable/s
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/retriever'`

- [ ] **Step 3: `api/src/retriever.js` 구현**

```javascript
// pgvector는 PostgREST를 통과할 때 배열이 아니라 '[a,b,c]' 리터럴 문자열로
// 보내야 안전하게 캐스팅된다 (적재 스크립트에서 검증된 형태).
function toVectorLiteral(vector) {
  return '[' + vector.join(',') + ']';
}

async function searchChunks(vector, { config, matchCount, category = null, fetchImpl = fetch }) {
  const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/match_labor_chunks`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: toVectorLiteral(vector),
      match_count: matchCount ?? config.matchCount,
      filter_category: category,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase 검색 실패 (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

module.exports = { searchChunks, toVectorLiteral };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (15 tests)

- [ ] **Step 5: 실측 검증 스크립트 작성 — `api/scripts/check-supabase.js`**

```javascript
// 사용자 터미널에서 실행: node scripts/check-supabase.js "질문"
const { loadConfig } = require('../src/config');
const { embedQuery } = require('../src/embedding');
const { searchChunks } = require('../src/retriever');

async function main() {
  const question = process.argv[2] || '부당해고 구제신청 기간은 얼마인가요?';
  const config = loadConfig();

  console.log(`질문: ${question}`);
  const vector = await embedQuery(question);

  const startedAt = Date.now();
  const chunks = await searchChunks(vector, { config });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`검색 소요: ${elapsed}초 (인덱스 없는 브루트포스라 느릴 수 있음), 결과 ${chunks.length}건\n`);
  chunks.forEach((c, i) => {
    console.log(`[${i}] similarity=${Number(c.similarity).toFixed(4)} category=${c.category} source=${c.source}`);
    console.log(`    제목: ${c.title || '(없음)'}`);
    console.log(`    링크: ${c.case_link || '(없음)'}`);
    console.log(`    본문: ${String(c.content || '').slice(0, 120).replace(/\s+/g, ' ')}...\n`);
  });

  if (chunks.length === 0) {
    console.error('실패: 검색 결과가 0건입니다.');
    process.exit(1);
  }
  if (Number(chunks[0].similarity) < 0.7) {
    console.warn('경고: 1위 유사도가 0.7 미만입니다. 질의 임베딩 경로가 적재와 다를 수 있습니다.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: 실측 확인 (사용자 터미널에서 실행)**

먼저 `.env.example`을 복사해 `.env`를 만들고 실제 키를 채운다 (`SUPABASE_SERVICE_ROLE_KEY`는 `vector-pipeline/.env`에 이미 있는 값과 같다).

Run: `node scripts/check-supabase.js "부당해고 구제신청 기간"`
Expected: 8건이 유사도 내림차순으로 출력되고, 1위가 질문과 주제적으로 맞는 노동법 자료여야 한다. 유사도가 전반적으로 0.7 미만이거나 결과가 무관하면 **Task 2의 임베딩 경로 문제**이므로 여기서 멈추고 원인을 잡는다.

- [ ] **Step 7: 커밋**

```bash
git add src/retriever.js test/retriever.test.js scripts/check-supabase.js
git commit -m "feat: Supabase match_labor_chunks 벡터 검색 모듈 추가"
```

---

### Task 4: 고정 템플릿 조립기 (코드 레벨 강제)

**Files:**
- Create: `api/src/template.js`
- Test: `api/test/template.test.js`

**Interfaces:**
- Consumes: Task 3의 `Chunk[]`
- Produces:
  - 상수 `DISCLAIMER`(문자열), `SLOT_HEADERS`(객체)
  - `assembleAnswer(parsed, chunks) -> string`
  - `parsed` = `{ out_of_scope: boolean, core_answer: string, evidence_detail: string, practical_application: string, related_concepts: string, related_cases: Array<{ source_index: number, note: string }> }` — Task 5의 zod 스키마가 이 형태를 만든다.

**왜 이 Task가 핵심인가:** PRD 4.4의 "템플릿 강제 규칙"은 프롬프트가 아니라 코드가 지켜야 한다. 관련판례의 제목·링크도 AI가 만든 문자열이 아니라 `chunks[source_index]`에서 코드가 가져오므로, 존재하지 않는 판례 링크가 나올 수 없다.

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/template.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { assembleAnswer, DISCLAIMER } = require('../src/template');

const chunks = [
  { title: '대법원 2020다1234', case_link: 'https://example.com/a', category: '판례', similarity: 0.91 },
  { title: '근로기준과-5678', case_link: null, category: '행정해석', similarity: 0.85 },
];

const parsed = {
  out_of_scope: false,
  core_answer: '구제신청은 해고일부터 3개월 이내에 해야 합니다.',
  evidence_detail: '근로기준법 제28조 제2항에 따라...',
  practical_application: '해고통지서 수령일을 기산일로 관리하세요.',
  related_concepts: '제척기간: 권리를 행사할 수 있는 법정 기간.',
  related_cases: [{ source_index: 0, note: '기산일 판단 기준을 제시' }],
};

test('5개 슬롯 헤더가 정해진 순서대로 들어간다', () => {
  const out = assembleAnswer(parsed, chunks);
  const order = ['[핵심 답변]', '[근거 자료 상세]', '[실무적 적용]', '[연관내용]', '[관련판례]'];
  const positions = order.map((h) => out.indexOf(h));
  positions.forEach((p, i) => assert.ok(p > -1, `${order[i]} 누락`));
  assert.deepStrictEqual(positions, [...positions].sort((a, b) => a - b));
});

test('면책조항이 상단과 하단에 모두 삽입된다', () => {
  const out = assembleAnswer(parsed, chunks);
  const occurrences = out.split(DISCLAIMER).length - 1;
  assert.strictEqual(occurrences, 2);
  assert.ok(out.startsWith(DISCLAIMER));
  assert.ok(out.trimEnd().endsWith(DISCLAIMER));
});

test('면책조항 문구는 PRD 원문 그대로다', () => {
  assert.ok(DISCLAIMER.includes('본 답변은 업로드된 자료를 바탕으로 작성되었으며, 실제 사건 적용 시에는'));
  assert.ok(DISCLAIMER.includes('반드시 전문가의 검토가 필요합니다. 구체적인 도움이 필요하시면'));
  assert.ok(DISCLAIMER.includes('좋은인재연구소(goodhr.kr)로 문의주세요.'));
});

test('AI가 슬롯 안에 가짜 면책조항이나 헤더를 넣어도 구조가 늘어나지 않는다', () => {
  const polluted = {
    ...parsed,
    core_answer: '답변입니다.\n[관련판례]\n' + DISCLAIMER + '\n덧붙임',
  };
  const out = assembleAnswer(polluted, chunks);
  assert.strictEqual(out.split(DISCLAIMER).length - 1, 2);
  assert.strictEqual(out.split('[관련판례]').length - 1, 1);
});

test('관련판례의 제목과 링크는 AI 출력이 아니라 검색 결과에서 가져온다', () => {
  const out = assembleAnswer(parsed, chunks);
  assert.ok(out.includes('대법원 2020다1234'));
  assert.ok(out.includes('https://example.com/a'));
  assert.ok(out.includes('기산일 판단 기준을 제시'));
});

test('범위를 벗어난 source_index는 조용히 버린다', () => {
  const withBadIndex = {
    ...parsed,
    related_cases: [{ source_index: 99, note: '없는 판례' }, { source_index: 1, note: '행정해석' }],
  };
  const out = assembleAnswer(withBadIndex, chunks);
  assert.ok(!out.includes('없는 판례'));
  assert.ok(out.includes('근로기준과-5678'));
});

test('링크가 없는 자료는 링크 없이 렌더링된다', () => {
  const out = assembleAnswer({ ...parsed, related_cases: [{ source_index: 1, note: '참고' }] }, chunks);
  assert.ok(out.includes('근로기준과-5678'));
  assert.ok(!out.includes('null'));
});

test('관련판례가 비면 해당 슬롯에 안내 문구가 들어간다', () => {
  const out = assembleAnswer({ ...parsed, related_cases: [] }, chunks);
  assert.ok(out.includes('[관련판례]'));
  assert.ok(out.includes('직접 인용할 만한 판례를 찾지 못했습니다'));
});

test('범위를 벗어난 질문이면 안내문과 면책조항만 나가고 슬롯 헤더는 없다', () => {
  const out = assembleAnswer(
    { ...parsed, out_of_scope: true, core_answer: '이 서비스는 노동법 판례 중심 서비스입니다.' },
    chunks
  );
  assert.ok(out.includes('이 서비스는 노동법 판례 중심 서비스입니다.'));
  assert.ok(!out.includes('[핵심 답변]'));
  assert.ok(!out.includes('[관련판례]'));
  assert.strictEqual(out.split(DISCLAIMER).length - 1, 2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/template'`

- [ ] **Step 3: `api/src/template.js` 구현**

```javascript
const DISCLAIMER = [
  '------------------------------------------------------------',
  '본 답변은 업로드된 자료를 바탕으로 작성되었으며, 실제 사건 적용 시에는',
  '반드시 전문가의 검토가 필요합니다. 구체적인 도움이 필요하시면',
  '좋은인재연구소(goodhr.kr)로 문의주세요.',
  '------------------------------------------------------------',
].join('\n');

const SLOT_HEADERS = {
  core_answer: '[핵심 답변]',
  evidence_detail: '[근거 자료 상세]',
  practical_application: '[실무적 적용]',
  related_concepts: '[연관내용]',
  related_cases: '[관련판례]',
};

const SLOT_ORDER = ['core_answer', 'evidence_detail', 'practical_application', 'related_concepts'];

const NO_CASES_MESSAGE = '검색된 자료 중 직접 인용할 만한 판례를 찾지 못했습니다.';

function renderRelatedCases(relatedCases, chunks) {
  const lines = [];
  for (const item of relatedCases || []) {
    const chunk = chunks[item.source_index];
    if (!chunk) continue;
    const title = chunk.title || chunk.uri || '(제목 없음)';
    const parts = [`${lines.length + 1}. ${title}`];
    if (chunk.case_link) parts.push(`   링크: ${chunk.case_link}`);
    if (item.note) parts.push(`   ${item.note}`);
    lines.push(parts.join('\n'));
  }
  return lines.length > 0 ? lines.join('\n') : NO_CASES_MESSAGE;
}

// AI는 슬롯 본문만 생성한다. 헤더·구분선·면책조항은 여기서만 만들어지므로
// 모델이 슬롯 안에 무엇을 넣든 최종 문서의 구조는 바뀌지 않는다.
function assembleAnswer(parsed, chunks = []) {
  if (parsed.out_of_scope) {
    return [DISCLAIMER, String(parsed.core_answer || '').trim(), DISCLAIMER].join('\n\n');
  }

  const sections = SLOT_ORDER.map(
    (slot) => `${SLOT_HEADERS[slot]}\n${String(parsed[slot] || '').trim()}`
  );
  sections.push(`${SLOT_HEADERS.related_cases}\n${renderRelatedCases(parsed.related_cases, chunks)}`);

  return [DISCLAIMER, ...sections, DISCLAIMER].join('\n\n');
}

module.exports = { assembleAnswer, DISCLAIMER, SLOT_HEADERS, NO_CASES_MESSAGE };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (24 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/template.js test/template.test.js
git commit -m "feat: 면책조항과 슬롯 구조를 코드가 강제하는 템플릿 조립기 추가"
```

---

### Task 5: 프롬프트와 출력 스키마

**Files:**
- Create: `api/src/answerSchema.js`
- Create: `api/src/prompt.js`
- Test: `api/test/prompt.test.js`

**Interfaces:**
- Consumes: Task 3의 `Chunk[]`
- Produces:
  - `AnswerSchema` (zod 객체) — Task 4의 `parsed` 형태와 정확히 일치
  - `buildSystemPrompt() -> string`
  - `buildUserContent(question, chunks) -> string`

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/prompt.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { AnswerSchema } = require('../src/answerSchema');
const { buildSystemPrompt, buildUserContent } = require('../src/prompt');

const chunks = [
  { title: '대법원 2020다1234', category: '판례', source: '판례4', content: '판시사항 본문', case_link: 'https://example.com/a' },
  { title: null, category: '지침', source: '고용노동부', content: '지침 본문', case_link: null },
];

test('스키마는 템플릿이 요구하는 슬롯을 모두 갖는다', () => {
  const parsed = AnswerSchema.parse({
    out_of_scope: false,
    core_answer: 'a',
    evidence_detail: 'b',
    practical_application: 'c',
    related_concepts: 'd',
    related_cases: [{ source_index: 0, note: 'e' }],
  });
  assert.strictEqual(parsed.core_answer, 'a');
  assert.strictEqual(parsed.related_cases[0].source_index, 0);
});

test('슬롯이 빠지면 스키마가 거부한다', () => {
  assert.throws(() => AnswerSchema.parse({ out_of_scope: false, core_answer: 'a' }));
});

test('시스템 프롬프트가 템플릿 문구 생성을 금지한다', () => {
  const system = buildSystemPrompt();
  assert.ok(system.includes('면책조항'));
  assert.ok(system.includes('source_index'));
  assert.ok(system.includes('노동법'));
});

test('참고자료에 인덱스가 붙어 source_index와 대응된다', () => {
  const content = buildUserContent('부당해고 기간은?', chunks);
  assert.ok(content.includes('[0]'));
  assert.ok(content.includes('[1]'));
  assert.ok(content.includes('대법원 2020다1234'));
  assert.ok(content.includes('판시사항 본문'));
  assert.ok(content.includes('부당해고 기간은?'));
});

test('제목이 없는 자료도 인덱스는 유지된다', () => {
  const content = buildUserContent('질문', chunks);
  const firstIndex = content.indexOf('[1]');
  assert.ok(firstIndex > -1);
  assert.ok(content.includes('지침 본문'));
});

test('검색 결과가 없으면 근거 없음을 명시한다', () => {
  const content = buildUserContent('질문', []);
  assert.ok(content.includes('검색된 자료가 없습니다'));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/answerSchema'`

- [ ] **Step 3: `api/src/answerSchema.js` 구현**

```javascript
const { z } = require('zod');

const AnswerSchema = z.object({
  out_of_scope: z
    .boolean()
    .describe('질문이 노동법·인사 영역과 명백히 무관하면 true, 그 외에는 false'),
  core_answer: z
    .string()
    .describe('질문에 대한 결론. out_of_scope가 true면 서비스 범위를 안내하고 재질문을 유도하는 문장'),
  evidence_detail: z
    .string()
    .describe('참고 자료에 근거한 상세 설명. 인용한 자료의 제목을 본문에 언급한다'),
  practical_application: z.string().describe('인사 실무자가 바로 적용할 수 있는 조치'),
  related_concepts: z.string().describe('답변에 등장한 용어나 개념 설명'),
  related_cases: z
    .array(
      z.object({
        source_index: z.number().int().describe('참고 자료 목록의 [n] 번호'),
        note: z.string().describe('그 자료가 이 질문에 왜 관련되는지 한 문장'),
      })
    )
    .describe('근거로 삼은 참고 자료들. 목록에 없는 자료는 절대 넣지 않는다'),
});

module.exports = { AnswerSchema };
```

- [ ] **Step 4: `api/src/prompt.js` 구현**

```javascript
function buildSystemPrompt() {
  return [
    '당신은 대한민국 노동법 판례·행정해석에 근거해 답하는 HR 실무 지원 도우미입니다.',
    '사용자는 기업의 인사담당자이며, 변호사·노무사에게 묻기 전에 참고할 실무적 답변을 원합니다.',
    '',
    '규칙:',
    '- 반드시 제공된 참고 자료에 근거해 답한다. 자료에 없는 법리나 판례를 지어내지 않는다.',
    '- 참고 자료가 질문을 뒷받침하지 못하면 그 사실을 솔직히 밝히고, 확인 가능한 범위까지만 답한다.',
    '- related_cases에는 참고 자료 목록의 source_index만 넣는다. 목록에 없는 판례번호나 링크를 만들지 않는다.',
    '- 판례 제목과 링크는 시스템이 직접 붙이므로 당신이 URL을 쓸 필요가 없다.',
    '- 노동법·인사와 명백히 무관한 질문(일반 잡담, 세무·지식재산 등 타 법률 분야)이면 out_of_scope를 true로 하고,',
    '  core_answer에 "이 서비스는 범용 AI가 아니라 노동법 판례 중심 서비스"임을 안내하며 노동법 관련 질문으로 다시 물어보도록 유도한다.',
    '  무리하게 답변을 시도하지 않는다. 이때 나머지 슬롯은 빈 문자열로 둔다.',
    '- 노동법·인사 관련 질문이면 다소 폭넓더라도 유연하게 답한다.',
    '- 각 슬롯에는 본문 내용만 쓴다. 대괄호 제목([핵심 답변] 등), 구분선, 면책조항은 시스템이 붙이므로 절대 쓰지 않는다.',
    '- 존댓말로, 인사 실무자가 바로 이해할 수 있는 표현을 쓴다.',
  ].join('\n');
}

function buildUserContent(question, chunks) {
  const sources =
    chunks.length > 0
      ? chunks
          .map((chunk, index) =>
            [
              `[${index}] 분류: ${chunk.category || '(없음)'} / 출처: ${chunk.source || '(없음)'}`,
              `제목: ${chunk.title || '(제목 없음)'}`,
              `내용: ${chunk.content || ''}`,
            ].join('\n')
          )
          .join('\n\n---\n\n')
      : '검색된 자료가 없습니다.';

  return [`참고 자료:`, '', sources, '', '---', '', `질문: ${question}`].join('\n');
}

module.exports = { buildSystemPrompt, buildUserContent };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (30 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/answerSchema.js src/prompt.js test/prompt.test.js
git commit -m "feat: 슬롯 출력 스키마와 근거 기반 프롬프트 빌더 추가"
```

---

### Task 6: Claude 답변 생성기

**Files:**
- Create: `api/src/generator.js`
- Test: `api/test/generator.test.js`

**Interfaces:**
- Consumes: Task 1 config, Task 3 `Chunk[]`, Task 5 `AnswerSchema`/프롬프트
- Produces: `generateAnswer({ client, config, question, chunks, history }) -> Promise<{ parsed, usage, model }>`
  - `client`는 `Anthropic` 인스턴스(테스트에서는 스텁). `parsed`는 Task 4의 `assembleAnswer`가 받는 형태.
  - `createClient(config) -> Anthropic`

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/generator.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { generateAnswer } = require('../src/generator');

const config = { model: 'claude-opus-5', anthropicApiKey: 'sk-ant-test' };
const chunks = [{ title: '대법원 2020다1234', category: '판례', source: '판례4', content: '본문' }];

const validParsed = {
  out_of_scope: false,
  core_answer: '3개월 이내입니다.',
  evidence_detail: '근거',
  practical_application: '실무',
  related_concepts: '용어',
  related_cases: [{ source_index: 0, note: '관련' }],
};

function stubClient(response) {
  const calls = [];
  return {
    calls,
    messages: {
      parse: async (params) => {
        calls.push(params);
        return response;
      },
    },
  };
}

const okResponse = {
  parsed_output: validParsed,
  stop_reason: 'end_turn',
  model: 'claude-opus-5',
  usage: { input_tokens: 1200, output_tokens: 300 },
};

test('config의 모델과 구조화 출력 포맷으로 호출한다', async () => {
  const client = stubClient(okResponse);
  await generateAnswer({ client, config, question: '질문', chunks });

  const params = client.calls[0];
  assert.strictEqual(params.model, 'claude-opus-5');
  assert.ok(params.max_tokens >= 16000);
  assert.ok(params.output_config.format, 'output_config.format이 있어야 한다');
  assert.ok(typeof params.system === 'string' && params.system.length > 0);
});

test('참고 자료와 질문이 마지막 user 메시지에 담긴다', async () => {
  const client = stubClient(okResponse);
  await generateAnswer({ client, config, question: '부당해고 기간은?', chunks });

  const messages = client.calls[0].messages;
  const last = messages[messages.length - 1];
  assert.strictEqual(last.role, 'user');
  assert.ok(last.content.includes('부당해고 기간은?'));
  assert.ok(last.content.includes('[0]'));
});

test('이전 대화가 있으면 질문 앞에 붙는다', async () => {
  const client = stubClient(okResponse);
  const history = [
    { role: 'user', content: '해고가 뭔가요?' },
    { role: 'assistant', content: '근로관계의 일방적 종료입니다.' },
  ];
  await generateAnswer({ client, config, question: '그럼 기간은?', chunks, history });

  const messages = client.calls[0].messages;
  assert.strictEqual(messages.length, 3);
  assert.strictEqual(messages[0].content, '해고가 뭔가요?');
});

test('parsed와 usage, 실제 응답 모델을 돌려준다', async () => {
  const client = stubClient(okResponse);
  const result = await generateAnswer({ client, config, question: '질문', chunks });
  assert.deepStrictEqual(result.parsed, validParsed);
  assert.strictEqual(result.usage.input_tokens, 1200);
  assert.strictEqual(result.model, 'claude-opus-5');
});

test('parsed_output이 null이면 명확한 에러를 낸다', async () => {
  const client = stubClient({ ...okResponse, parsed_output: null });
  await assert.rejects(
    () => generateAnswer({ client, config, question: '질문', chunks }),
    /구조화 출력/
  );
});

test('안전상 거부(refusal)면 그 사실을 알리는 에러를 낸다', async () => {
  const client = stubClient({
    ...okResponse,
    parsed_output: null,
    stop_reason: 'refusal',
    stop_details: { type: 'refusal', category: 'other', explanation: '거부 사유' },
  });
  await assert.rejects(
    () => generateAnswer({ client, config, question: '질문', chunks }),
    /거부/
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/generator'`

- [ ] **Step 3: `api/src/generator.js` 구현**

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
const { AnswerSchema } = require('./answerSchema');
const { buildSystemPrompt, buildUserContent } = require('./prompt');

function createClient(config) {
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

async function generateAnswer({ client, config, question, chunks, history = [] }) {
  const response = await client.messages.parse({
    model: config.model,
    max_tokens: 16000,
    // 시스템 프롬프트는 요청마다 동일하므로 캐시 대상이 된다.
    // 자료·질문은 뒤쪽 user 메시지에 두어 캐시 프리픽스를 깨지 않는다.
    cache_control: { type: 'ephemeral' },
    system: buildSystemPrompt(),
    messages: [...history, { role: 'user', content: buildUserContent(question, chunks) }],
    output_config: {
      effort: 'high',
      format: zodOutputFormat(AnswerSchema),
    },
  });

  if (response.stop_reason === 'refusal') {
    const reason = response.stop_details?.explanation || '사유 미상';
    throw new Error(`모델이 답변을 거부했습니다: ${reason}`);
  }
  if (!response.parsed_output) {
    throw new Error(`구조화 출력을 얻지 못했습니다 (stop_reason: ${response.stop_reason})`);
  }

  return {
    parsed: response.parsed_output,
    usage: response.usage,
    model: response.model,
  };
}

module.exports = { generateAnswer, createClient };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (36 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/generator.js test/generator.test.js
git commit -m "feat: 구조화 출력 기반 Claude 답변 생성기 추가"
```

---

### Task 7: 멀티턴 질의 재작성

**Files:**
- Create: `api/src/rewriteQuery.js`
- Test: `api/test/rewriteQuery.test.js`

**Interfaces:**
- Consumes: Task 1 config, Task 6과 같은 `client`
- Produces: `rewriteQuery({ client, config, question, history }) -> Promise<string>`

**왜 필요한가:** PRD 4.5의 후속 질문("그럼 이 경우는?")은 그 문장만 임베딩하면 검색이 무의미해진다. 이전 대화를 반영해 독립적으로 검색 가능한 질의로 바꾼 뒤 임베딩한다.

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/rewriteQuery.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { rewriteQuery } = require('../src/rewriteQuery');

const config = { rewriteModel: 'claude-opus-5' };

function stubClient(response) {
  const calls = [];
  return {
    calls,
    messages: {
      parse: async (params) => {
        calls.push(params);
        return response;
      },
    },
  };
}

test('이전 대화가 없으면 API를 호출하지 않고 질문을 그대로 쓴다', async () => {
  const client = stubClient({ parsed_output: { standalone_query: '무시됨' } });
  const result = await rewriteQuery({ client, config, question: '부당해고 기간은?', history: [] });
  assert.strictEqual(result, '부당해고 기간은?');
  assert.strictEqual(client.calls.length, 0);
});

test('이전 대화가 있으면 독립 질의로 다시 쓴다', async () => {
  const client = stubClient({
    parsed_output: { standalone_query: '영업양도 시 근로관계 승계 판단 기준' },
    stop_reason: 'end_turn',
  });
  const history = [
    { role: 'user', content: '영업양도가 뭔가요?' },
    { role: 'assistant', content: '사업의 동일성을 유지하며 이전하는 것입니다.' },
  ];
  const result = await rewriteQuery({ client, config, question: '그럼 근로자는 어떻게 되나요?', history });

  assert.strictEqual(result, '영업양도 시 근로관계 승계 판단 기준');
  assert.strictEqual(client.calls[0].model, 'claude-opus-5');
  assert.ok(client.calls[0].max_tokens >= 4096, '적응형 사고가 max_tokens를 쓰므로 여유가 필요');
});

test('재작성이 비어 있으면 원 질문으로 되돌린다', async () => {
  const client = stubClient({ parsed_output: { standalone_query: '   ' }, stop_reason: 'end_turn' });
  const history = [{ role: 'user', content: '이전' }];
  const result = await rewriteQuery({ client, config, question: '원 질문', history });
  assert.strictEqual(result, '원 질문');
});

test('재작성 호출이 실패해도 원 질문으로 진행한다', async () => {
  const client = {
    messages: {
      parse: async () => {
        throw new Error('rate limited');
      },
    },
  };
  const history = [{ role: 'user', content: '이전' }];
  const result = await rewriteQuery({ client, config, question: '원 질문', history });
  assert.strictEqual(result, '원 질문');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/rewriteQuery'`

- [ ] **Step 3: `api/src/rewriteQuery.js` 구현**

```javascript
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const StandaloneQuerySchema = z.object({
  standalone_query: z
    .string()
    .describe('이전 대화 맥락을 반영해 그 문장만으로 검색 가능한 한국어 질의'),
});

const SYSTEM = [
  '당신은 검색 질의 재작성기입니다.',
  '이전 대화를 참고해, 마지막 사용자 질문을 그 문장만으로도 이해되는 독립적인 한국어 검색 질의로 바꾸세요.',
  '노동법 문서 검색에 쓰이므로 지시대명사("그럼", "이 경우")를 구체적인 용어로 풀어씁니다.',
  '답변하지 말고 질의만 만드세요.',
].join('\n');

// 재작성은 검색 품질을 위한 보조 단계다. 여기서 실패했다고 답변 자체가
// 막히면 안 되므로, 어떤 오류든 원 질문으로 조용히 되돌린다.
async function rewriteQuery({ client, config, question, history = [] }) {
  if (history.length === 0) return question;

  try {
    const response = await client.messages.parse({
      model: config.rewriteModel,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [...history, { role: 'user', content: question }],
      output_config: {
        effort: 'low',
        format: zodOutputFormat(StandaloneQuerySchema),
      },
    });
    const rewritten = response.parsed_output?.standalone_query?.trim();
    return rewritten || question;
  } catch (err) {
    return question;
  }
}

module.exports = { rewriteQuery, StandaloneQuerySchema };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (40 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/rewriteQuery.js test/rewriteQuery.test.js
git commit -m "feat: 후속 질문을 독립 검색 질의로 바꾸는 재작성 단계 추가"
```

---

### Task 8: 답변 서비스 오케스트레이션

**Files:**
- Create: `api/src/answerService.js`
- Test: `api/test/answerService.test.js`

**Interfaces:**
- Consumes: Task 2 `embedQuery`, Task 3 `searchChunks`, Task 4 `assembleAnswer`, Task 6 `generateAnswer`, Task 7 `rewriteQuery`
- Produces: `answerQuestion({ question, history, category, config, client, deps }) -> Promise<{ answer, sources, usage, standaloneQuery }>`
  - `sources` = `[{ title, category, source, case_link, similarity }]` (본문 제외)
  - `deps`는 테스트용 주입구: `{ embedQuery, searchChunks, generateAnswer, rewriteQuery }`. 생략하면 실제 모듈을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/answerService.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { answerQuestion } = require('../src/answerService');
const { DISCLAIMER } = require('../src/template');

const config = { model: 'claude-opus-5', matchCount: 8 };

const chunks = [
  {
    title: '대법원 2020다1234',
    category: '판례',
    source: '판례4',
    case_link: 'https://example.com/a',
    similarity: 0.9,
    content: '아주 긴 본문'.repeat(50),
  },
];

const parsed = {
  out_of_scope: false,
  core_answer: '3개월 이내입니다.',
  evidence_detail: '근거',
  practical_application: '실무',
  related_concepts: '용어',
  related_cases: [{ source_index: 0, note: '관련' }],
};

function makeDeps(overrides = {}) {
  const seen = {};
  return {
    seen,
    deps: {
      rewriteQuery: async ({ question }) => {
        seen.rewriteQuestion = question;
        return overrides.rewritten || question;
      },
      embedQuery: async (text) => {
        seen.embedded = text;
        return [0.1, 0.2];
      },
      searchChunks: async (vector, options) => {
        seen.searchOptions = options;
        return overrides.chunks || chunks;
      },
      generateAnswer: async (args) => {
        seen.generateArgs = args;
        return { parsed: overrides.parsed || parsed, usage: { input_tokens: 10, output_tokens: 5 }, model: 'claude-opus-5' };
      },
    },
  };
}

test('재작성된 질의로 임베딩하고 검색한다', async () => {
  const { seen, deps } = makeDeps({ rewritten: '영업양도 근로관계 승계' });
  await answerQuestion({
    question: '그럼 근로자는요?',
    history: [{ role: 'user', content: '영업양도가 뭔가요?' }],
    config,
    client: {},
    deps,
  });
  assert.strictEqual(seen.embedded, '영업양도 근로관계 승계');
});

test('생성 단계에는 원래 질문을 넘긴다', async () => {
  const { seen, deps } = makeDeps({ rewritten: '재작성된 질의' });
  await answerQuestion({ question: '원래 질문', history: [], config, client: {}, deps });
  assert.strictEqual(seen.generateArgs.question, '원래 질문');
});

test('카테고리 필터가 검색으로 전달된다', async () => {
  const { seen, deps } = makeDeps();
  await answerQuestion({ question: '질문', category: '판례', config, client: {}, deps });
  assert.strictEqual(seen.searchOptions.category, '판례');
});

test('조립된 답변에 면책조항이 상하단에 들어간다', async () => {
  const { deps } = makeDeps();
  const result = await answerQuestion({ question: '질문', config, client: {}, deps });
  assert.strictEqual(result.answer.split(DISCLAIMER).length - 1, 2);
  assert.ok(result.answer.includes('3개월 이내입니다.'));
});

test('sources에는 본문을 빼고 메타데이터만 담는다', async () => {
  const { deps } = makeDeps();
  const result = await answerQuestion({ question: '질문', config, client: {}, deps });
  assert.strictEqual(result.sources.length, 1);
  assert.strictEqual(result.sources[0].title, '대법원 2020다1234');
  assert.strictEqual(result.sources[0].content, undefined);
});

test('usage와 재작성 질의를 함께 돌려준다', async () => {
  const { deps } = makeDeps({ rewritten: '재작성' });
  const result = await answerQuestion({
    question: '질문',
    history: [{ role: 'user', content: '이전' }],
    config,
    client: {},
    deps,
  });
  assert.strictEqual(result.usage.input_tokens, 10);
  assert.strictEqual(result.standaloneQuery, '재작성');
});

test('검색 결과가 0건이어도 생성 단계를 건너뛰지 않는다', async () => {
  const { seen, deps } = makeDeps({ chunks: [] });
  const result = await answerQuestion({ question: '질문', config, client: {}, deps });
  assert.deepStrictEqual(seen.generateArgs.chunks, []);
  assert.strictEqual(result.sources.length, 0);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/answerService'`

- [ ] **Step 3: `api/src/answerService.js` 구현**

```javascript
const { embedQuery } = require('./embedding');
const { searchChunks } = require('./retriever');
const { generateAnswer } = require('./generator');
const { rewriteQuery } = require('./rewriteQuery');
const { assembleAnswer } = require('./template');

function toSource(chunk) {
  return {
    title: chunk.title,
    category: chunk.category,
    source: chunk.source,
    case_link: chunk.case_link,
    similarity: chunk.similarity,
  };
}

async function answerQuestion({
  question,
  history = [],
  category = null,
  config,
  client,
  deps = {},
}) {
  const {
    rewriteQuery: rewrite = rewriteQuery,
    embedQuery: embed = embedQuery,
    searchChunks: search = searchChunks,
    generateAnswer: generate = generateAnswer,
  } = deps;

  // 검색에는 맥락이 반영된 독립 질의를, 생성에는 사용자가 실제로 던진
  // 문장을 넘긴다. 생성 쪽은 history를 함께 받으므로 맥락이 유지된다.
  const standaloneQuery = await rewrite({ client, config, question, history });
  const vector = await embed(standaloneQuery);
  const chunks = await search(vector, { config, category });

  const { parsed, usage, model } = await generate({ client, config, question, chunks, history });

  return {
    answer: assembleAnswer(parsed, chunks),
    sources: chunks.map(toSource),
    usage,
    model,
    standaloneQuery,
  };
}

module.exports = { answerQuestion };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (47 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/answerService.js test/answerService.test.js
git commit -m "feat: 검색-생성-조립을 잇는 답변 서비스 오케스트레이션 추가"
```

---

### Task 9: HTTP 서버와 실환경 검증

**Files:**
- Create: `api/src/server.js`
- Create: `api/scripts/ask.js`
- Test: `api/test/server.test.js`

**Interfaces:**
- Consumes: Task 1 config, Task 2 `warmup`, Task 8 `answerQuestion`
- Produces: `createServer({ config, client, answerFn }) -> express.Application`
  - `POST /api/chat` body `{ question, history?, category? }` → `200 { answer, sources, usage, model, standaloneQuery }`
  - `GET /health` → `200 { status, model, modelReady }`

- [ ] **Step 1: 실패하는 테스트 작성 — `api/test/server.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');

const config = { model: 'claude-opus-5', matchCount: 8, port: 0 };

function startServer(answerFn) {
  const app = createServer({ config, client: {}, answerFn });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function withServer(answerFn, fn) {
  const { server, baseUrl } = await startServer(answerFn);
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const okAnswer = async () => ({
  answer: '조립된 답변',
  sources: [{ title: '대법원 2020다1234' }],
  usage: { input_tokens: 10, output_tokens: 5 },
  model: 'claude-opus-5',
  standaloneQuery: '질의',
});

test('GET /health가 모델 정보를 돌려준다', async () => {
  await withServer(okAnswer, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.model, 'claude-opus-5');
  });
});

test('POST /api/chat이 답변과 출처를 돌려준다', async () => {
  await withServer(okAnswer, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '부당해고 기간은?' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.answer, '조립된 답변');
    assert.strictEqual(body.sources.length, 1);
  });
});

test('question이 없으면 400', async () => {
  await withServer(okAnswer, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('question'));
  });
});

test('허용되지 않은 category면 400', async () => {
  await withServer(okAnswer, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '질문', category: '세법' }),
    });
    assert.strictEqual(res.status, 400);
  });
});

test('내부 오류는 500과 메시지로 돌려주고 서버는 살아 있다', async () => {
  const failing = async () => {
    throw new Error('Supabase 검색 실패 (HTTP 503)');
  };
  await withServer(failing, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '질문' }),
    });
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error.includes('Supabase'));

    const health = await fetch(`${baseUrl}/health`);
    assert.strictEqual(health.status, 200);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/server'`

- [ ] **Step 3: `api/src/server.js` 구현**

```javascript
const express = require('express');
const { loadConfig, CATEGORIES } = require('./config');
const { warmup } = require('./embedding');
const { createClient } = require('./generator');
const { answerQuestion } = require('./answerService');

function createServer({ config, client, answerFn = answerQuestion }) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.locals.modelReady = false;

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', model: config.model, modelReady: req.app.locals.modelReady });
  });

  app.post('/api/chat', async (req, res) => {
    const { question, history = [], category = null } = req.body || {};

    if (typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'question은 비어 있지 않은 문자열이어야 합니다.' });
    }
    if (category !== null && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category는 다음 중 하나여야 합니다: ${CATEGORIES.join(', ')}` });
    }
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history는 배열이어야 합니다.' });
    }

    try {
      const result = await answerFn({ question: question.trim(), history, category, config, client });
      res.json(result);
    } catch (err) {
      console.error('[/api/chat]', err);
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

async function main() {
  const config = loadConfig();
  const client = createClient(config);
  const app = createServer({ config, client });

  app.listen(config.port, () => {
    console.log(`API 서버 시작: http://localhost:${config.port} (모델: ${config.model})`);
    console.log('임베딩 모델 로딩 중...');
  });

  // 첫 요청이 모델 로딩까지 떠안지 않도록 부팅 직후 예열한다.
  await warmup();
  app.locals.modelReady = true;
  console.log('임베딩 모델 준비 완료');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('서버 시작 실패:', err);
    process.exit(1);
  });
}

module.exports = { createServer };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (52 tests)

- [ ] **Step 5: 실측 스크립트 작성 — `api/scripts/ask.js`**

PRD Open Item #4(모델 선택)를 실측으로 닫기 위해, 답변과 함께 지연시간·토큰·추정 원가를 출력한다.

```javascript
// 사용자 터미널에서 실행: node scripts/ask.js "질문"
// 모델 비교: ANTHROPIC_MODEL=claude-sonnet-5 node scripts/ask.js "질문"
const { loadConfig } = require('../src/config');
const { createClient } = require('../src/generator');
const { answerQuestion } = require('../src/answerService');

// $/1M tokens (입력, 출력)
const PRICING = {
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
};

function estimateCost(model, usage) {
  const price = PRICING[model];
  if (!price) return null;
  const cost = (usage.input_tokens / 1e6) * price[0] + (usage.output_tokens / 1e6) * price[1];
  return cost;
}

async function main() {
  const question = process.argv[2];
  if (!question) {
    console.error('usage: node scripts/ask.js "질문"');
    process.exit(1);
  }

  const config = loadConfig();
  const client = createClient(config);

  const startedAt = Date.now();
  const result = await answerQuestion({ question, config, client });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(result.answer);
  console.log('\n' + '='.repeat(60));
  console.log(`모델: ${result.model} | 소요: ${elapsed}초`);
  console.log(`토큰: 입력 ${result.usage.input_tokens} / 출력 ${result.usage.output_tokens}`);
  if (result.usage.cache_read_input_tokens !== undefined) {
    console.log(`캐시 읽기: ${result.usage.cache_read_input_tokens}`);
  }
  const cost = estimateCost(result.model, result.usage);
  if (cost !== null) {
    console.log(`추정 원가: $${cost.toFixed(5)} (약 ${Math.round(cost * 1400)}원)`);
  }
  console.log(`검색 출처 ${result.sources.length}건, 1위 유사도 ${Number(result.sources[0]?.similarity || 0).toFixed(4)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: 실환경 검증 (사용자 터미널에서 실행)**

세 가지를 확인한다.

```bash
cd "D:/강재현/1. 좋은인재연구소/11. 챗봇/api"
node scripts/ask.js "영업양도가 있을 때 근로관계는 승계되나요?"
node scripts/ask.js "오늘 점심 뭐 먹을까?"
```

Expected:
1. 첫 질문 — 면책조항이 상·하단에 있고, 5개 슬롯이 모두 채워지며, `[관련판례]`의 링크가 검색 결과에 실제로 있던 링크와 일치한다.
2. 둘째 질문 — `out_of_scope` 경로를 타서 슬롯 헤더 없이 "노동법 판례 중심 서비스" 안내만 나온다.
3. 출력 하단의 토큰·원가로 PRD Open Item #3(사용량 한도 단가), #4(모델 선택) 판단 근거를 확보한다. `ANTHROPIC_MODEL`을 바꿔가며 같은 질문을 돌려 답변 품질과 원가를 비교한다.

- [ ] **Step 7: 서버 기동 확인 (사용자 터미널에서 실행)**

```bash
npm start
```
다른 터미널에서:
```bash
curl -s http://localhost:3001/health
curl -s -X POST http://localhost:3001/api/chat -H "Content-Type: application/json" -d "{\"question\":\"부당해고 구제신청 기간은?\"}"
```
Expected: `/health`는 즉시 응답하고 모델 예열 후 `modelReady: true`. `/api/chat`은 `answer`, `sources`, `usage`를 담은 JSON을 돌려준다.

- [ ] **Step 8: 커밋**

```bash
git add src/server.js test/server.test.js scripts/ask.js
git commit -m "feat: RAG 챗봇 HTTP API 서버와 실측 검증 스크립트 추가"
```

---

## 이 계획이 다루지 않는 것

- 회원가입/로그인, 무료 3회 체험, 사용량 한도·토큰 차감, PG 결제 (다음 단계)
- 채팅방(스레드) 다중 관리, 대화 기록 저장·삭제 — 이번 API는 무상태다. `history`를 요청 본문으로 받고 저장은 하지 않는다.
- 스트리밍 응답 (UI 붙일 때 필요하면 `client.messages.stream`으로 전환)
- Supabase 스토리지 한도·벡터 인덱스 문제 — 보류 결정. 브루트포스 검색 지연이 실측에서 문제가 되면 그때 Pro 업그레이드 또는 중복 데이터 정리를 재검토한다.

## 실행 중 확인이 필요한 항목

- **면책조항 위치**: PRD는 템플릿 예시에는 하단에만 그렸지만, 바로 아래 주석에 "답변 상단·하단에 코드 레벨에서 항상 고정 삽입"이라고 적혀 있어 계획은 상·하단 2회로 구현했다. 실물을 보고 상단이 거슬리면 `template.js`의 `assembleAnswer` 한 줄만 고치면 된다.
- **모델 기본값**: `claude-opus-5`로 두었다. Task 9 Step 6의 실측 원가를 보고 구독가(월 9,900~19,900원) 대비 감당 가능한지 판단해 `.env`의 `ANTHROPIC_MODEL`로 바꾼다.
