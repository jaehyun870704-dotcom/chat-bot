const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, 'data', 'progress.json');
const logPath = path.join(__dirname, 'csv-run.log');
const jsonlPath = path.join(__dirname, 'data', 'vectors.jsonl');

if (fs.existsSync(progressPath)) {
  const p = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  console.log('processed URIs (rows/files done):', p.doneUris.length);
}
if (fs.existsSync(jsonlPath)) {
  const stat = fs.statSync(jsonlPath);
  console.log('vectors.jsonl size:', (stat.size / 1e6).toFixed(1), 'MB');
}
if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  console.log('\n--- last 15 log lines ---');
  console.log(lines.slice(-15).join('\n'));
}
