const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join(__dirname, '..', 'data', 'progress.json');

function load() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return { doneUris: [] };
  }
  const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  return { doneUris: raw.doneUris || [] };
}

function makeTracker() {
  const state = load();
  const doneSet = new Set(state.doneUris);
  let dirty = false;

  return {
    isDone(uri) {
      return doneSet.has(uri);
    },
    markDone(uri) {
      doneSet.add(uri);
      dirty = true;
    },
    save() {
      if (!dirty) return;
      fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ doneUris: Array.from(doneSet) }));
      dirty = false;
    },
    size() {
      return doneSet.size;
    },
  };
}

module.exports = { PROGRESS_FILE, makeTracker };
