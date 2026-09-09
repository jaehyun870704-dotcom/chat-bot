const iconv = require('iconv-lite');

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ *\n */g, '\n')
    .trim();
}

// Detects whether a buffer is valid UTF-8 text or Korean CP949/EUC-KR, and
// returns the decoded string. Some source CSVs in this project were saved
// as CP949 without a BOM (mixed in with mostly UTF-8-with-BOM files).
function decodeBuffer(buf) {
  const sample = buf.slice(0, 65536).toString('utf8');
  const hasReplacementChar = sample.includes('�');
  if (!hasReplacementChar) {
    return buf.toString('utf8');
  }
  return iconv.decode(buf, 'cp949');
}

module.exports = { cleanText, decodeBuffer };
