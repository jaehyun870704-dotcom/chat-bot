// vectors.jsonl -> Supabase(labor_chunks) 마이그레이션 스크립트
// 실행: 이 저장소 루트에서 `node src/migrate-to-supabase.js`
// 필요: .env 파일에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
//
// 주의: 반드시 이 컴퓨터의 "일반 터미널"에서 직접 실행하세요.
// (Claude 세션의 device_bash 안에서 실행하면 조직 egress 정책으로 supabase.co가 막혀 있어 연결이 실패합니다.)

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env 에 없습니다. .env.example 참고.');
  process.exit(1);
}

const REST_URL = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/labor_chunks?on_conflict=uri,chunk_index`;
const BATCH_SIZE = 300;
const MAX_RETRIES = 5;

const JSONL_PATH = path.join(__dirname, '..', 'data', 'vectors.jsonl');
const PROGRESS_PATH = path.join(__dirname, '..', 'data', 'supabase-migrate-progress.json');

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    } catch (e) {
      return { linesDone: 0 };
    }
  }
  return { linesDone: 0 };
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(p));
}

// Postgres text columns reject the NUL byte outright (error 22P05); some
// scraped source rows carry stray control bytes from upstream encoding
// issues. Strip C0 controls (keep newline/tab) before sending, rather than
// retrying, since retries never succeed against a deterministic content error.
const PG_UNSAFE_CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(8) +
  String.fromCharCode(11) + String.fromCharCode(12) +
  String.fromCharCode(14) + '-' + String.fromCharCode(31) +
  String.fromCharCode(127) + ']',
  'g'
);
// Some rows also carry an unpaired UTF-16 surrogate (from an upstream
// encoding bug during CSV scraping) which has no valid UTF-8 encoding --
// JSON.stringify() happily produces it, but encoding the request body to
// bytes then mangles it, and PostgREST reports the whole batch as
// "Empty or invalid json" with no indication of which row caused it.
function stripLoneSurrogates(s) {
  return s
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function cleanForPg(s) {
  if (s == null) return s;
  return stripLoneSurrogates(String(s).replace(PG_UNSAFE_CONTROL_CHARS, ''));
}

function toRow(obj) {
  const md = obj.metadata || {};
  const vec = obj.vector || md.vector;
  if (!vec || !Array.isArray(vec)) return null;
  const text = obj.text ?? md.text;
  if (!text) return null;
  return {
    uri: cleanForPg(obj.uri || md.uri),
    chunk_index: obj.chunkIndex ?? md.chunkIndex ?? 0,
    doc_type: cleanForPg(md.docType) || null,
    source: cleanForPg(md.source) || null,
    category: cleanForPg(md.category) || null,
    title: cleanForPg(md.title) || null,
    case_link: cleanForPg(md.caseLink) || null,
    content: cleanForPg(text),
    embedding: '[' + vec.join(',') + ']',
  };
}

async function upsertBatch(rows, attempt = 1) {
  try {
    const res = await fetch(REST_URL, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 500)}`);
    }
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const wait = Math.min(30000, 1000 * 2 ** attempt);
    console.warn(`  batch failed (attempt ${attempt}): ${err.message} — retry in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    return upsertBatch(rows, attempt + 1);
  }
}

async function main() {
  const progress = loadProgress();
  const startAt = progress.linesDone || 0;
  console.log(`시작: 이미 처리된 줄 수 = ${startAt}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  let batch = [];
  let sentTotal = 0;
  const startedAt = Date.now();

  async function flush() {
    if (batch.length === 0) return;
    await upsertBatch(batch);
    sentTotal += batch.length;
    batch = [];
    saveProgress({ linesDone: lineNo });
    if (sentTotal % (BATCH_SIZE * 10) === 0 || sentTotal < BATCH_SIZE * 2) {
      const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
      console.log(`  진행: sent=${sentTotal} line=${lineNo} elapsed=${elapsedMin}min`);
    }
  }

  for await (const line of rl) {
    lineNo++;
    if (lineNo <= startAt) continue;
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      console.warn(`  줄 ${lineNo} JSON 파싱 실패, 스킵`);
      continue;
    }
    const row = toRow(obj);
    if (!row || !row.uri) {
      console.warn(`  줄 ${lineNo} 필수 필드 누락, 스킵`);
      continue;
    }
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  console.log(`\n완료. 총 전송 행: ${sentTotal}, 총 처리 줄: ${lineNo}`);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
