const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'csv-run.log');
const JSONL_PATH = path.join(__dirname, 'data', 'vectors.jsonl');
const PORT = 4321;

// Known row counts per CSV file (fixed, independent of chunking variance),
// in the same processing order as src/csvSources.js.
const FILES = [
  { label: '판례1', rows: 5025 },
  { label: '판례2', rows: 4231 },
  { label: '판례3', rows: 10286 },
  { label: '판례5', rows: 11072 },
  { label: '지침', rows: 109 },
  { label: '산재심사재결례', rows: 824 },
  { label: '행정심판', rows: 418 },
  { label: '행정해석', rows: 14444 },
  { label: '판례4(원본)', rows: 10175 },
  { label: '판례RawData(원본)', rows: 40721 },
  { label: '대법원등판정례(원본)', rows: 17777 },
];
const TOTAL_ROWS = FILES.reduce((s, f) => s + f.rows, 0);

function parseLog() {
  if (!fs.existsSync(LOG_PATH)) return { doneFiles: [], current: null, lastFlush: null, allDone: false, errored: false, errorLine: '' };
  const text = fs.readFileSync(LOG_PATH, 'utf8');
  const lines = text.split('\n');

  const doneFiles = [];
  let current = null;
  let lastFlush = null;
  let allDone = false;
  let errored = false;
  let errorLine = '';
  let finalSummary = null;

  for (const line of lines) {
    let m = line.match(/^=== (.+?) ===$/);
    if (m) current = m[1];

    m = line.match(/^(.+?) done\. rowsSeen=(\d+) rowsEmbedded\(this run\)=(\d+) totalChunksSoFar=(\d+)/);
    if (m) doneFiles.push(m[1]);

    m = line.match(/\[flush\] totalChunks=(\d+) rowsEmbedded=(\d+) rowsSkippedDup=(\d+) elapsed=([\d.]+)min/);
    if (m) lastFlush = { totalChunks: +m[1], rowsEmbedded: +m[2], rowsSkippedDup: +m[3], elapsedMin: +m[4] };

    if (line.includes('ALL DONE')) allDone = true;

    m = line.match(/^rows seen: (\d+), rows embedded: (\d+), rows skipped\(dup\/resume\): (\d+)/);
    if (m) finalSummary = { rowsSeen: +m[1], rowsEmbedded: +m[2], rowsSkipped: +m[3] };
    m = line.match(/^total chunks: (\d+)/);
    if (m && finalSummary) finalSummary.totalChunks = +m[1];
    m = line.match(/^elapsed: ([\d.]+) min/);
    if (m && finalSummary) finalSummary.elapsedMin = +m[1];

    if (/RangeError|TypeError|Unhandled|FATAL/.test(line)) {
      errored = true;
      errorLine = line;
    }
  }

  if (finalSummary) {
    lastFlush = {
      totalChunks: finalSummary.totalChunks,
      rowsEmbedded: finalSummary.rowsSeen, // 100% of rows accounted for when done
      rowsSkippedDup: 0,
      elapsedMin: finalSummary.elapsedMin,
    };
  }

  return { doneFiles, current, lastFlush, allDone, errored, errorLine };
}

function render() {
  const { doneFiles, current, lastFlush, allDone, errored, errorLine } = parseLog();
  const jsonlSize = fs.existsSync(JSONL_PATH) ? fs.statSync(JSONL_PATH).size : 0;
  const jsonlMB = (jsonlSize / 1e6).toFixed(1);

  const rowsHandled = lastFlush ? lastFlush.rowsEmbedded + lastFlush.rowsSkippedDup : 0;
  const pct = Math.min(100, (rowsHandled / TOTAL_ROWS) * 100).toFixed(2);

  const statusText = allDone
    ? '완료됨 ✅'
    : errored
    ? '오류 발생 ❌'
    : '진행 중 🟢';

  const fileRows = FILES.map((f) => {
    const isDone = doneFiles.includes(f.label);
    const isCurrent = f.label === current && !isDone;
    const mark = isDone ? '✅' : isCurrent ? '🟡' : '⬜';
    const style = isCurrent ? 'font-weight:bold;color:#0a7d0a;' : isDone ? 'color:#888;' : 'color:#333;';
    return `<div style="${style}">${mark} ${f.label} (${f.rows.toLocaleString()}행)${isCurrent ? ' ← 진행 중' : ''}</div>`;
  }).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3">
<title>벡터화 진행상황</title>
<style>
body{font-family:'Malgun Gothic',sans-serif;max-width:640px;margin:40px auto;padding:0 20px;background:#fafafa;}
.bar-bg{background:#e0e0e0;border-radius:8px;height:28px;overflow:hidden;margin:10px 0;}
.bar-fill{background:linear-gradient(90deg,#4caf50,#8bc34a);height:100%;transition:width 1s;}
.stat{font-size:14px;color:#555;margin:4px 0;}
.big{font-size:32px;font-weight:bold;}
h1{font-size:20px;}
</style>
</head>
<body>
<h1>CSV 벡터화 진행 상황 <small>(3초마다 자동 새로고침)</small></h1>
<div class="big">${statusText}</div>
<div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
<div class="stat">전체 행 기준 진행률: <b>${pct}%</b> (${rowsHandled.toLocaleString()} / ${TOTAL_ROWS.toLocaleString()}행)</div>
<div class="stat">누적 청크 수: ${lastFlush ? lastFlush.totalChunks.toLocaleString() : 0}</div>
<div class="stat">경과 시간: ${lastFlush ? lastFlush.elapsedMin.toFixed(1) : 0}분</div>
<div class="stat">결과 파일 크기: ${jsonlMB} MB</div>
${errored ? `<div class="stat" style="color:red">에러: ${errorLine}</div>` : ''}
<h2 style="font-size:16px;margin-top:24px;">파일별 상태</h2>
${fileRows}
<p style="color:#999;font-size:12px;margin-top:30px;">마지막 갱신: ${new Date().toLocaleTimeString('ko-KR')}</p>
</body></html>`;
}

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(render());
}).listen(PORT, () => {
  console.log(`dashboard running at http://localhost:${PORT}`);
});
