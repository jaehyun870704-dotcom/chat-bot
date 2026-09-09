const fs = require('fs');
const path = require('path');

function openJsonlWriter(fileName = 'vectors.jsonl') {
  const filePath = path.join(__dirname, '..', 'data', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  return {
    filePath,
    writeChunk(chunk) {
      stream.write(JSON.stringify(chunk) + '\n');
    },
    close() {
      return new Promise((resolve) => stream.end(resolve));
    },
  };
}

module.exports = { openJsonlWriter };
