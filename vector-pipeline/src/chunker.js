// Custom chunker. vectra's built-in TextSplitter treats any chunk containing
// no a-z/A-Z/0-9 as "punctuation-only" and refuses to merge it with
// neighbors -- which misfires on plain Hangul text (Korean has no Latin
// letters), so it never combines lines into proper-sized chunks. This is a
// simple paragraph/line-aware greedy packer instead.

// A split "worked" only if it actually produced more than one piece. A
// zero-width lookbehind match sitting exactly at the end of the string (e.g.
// text ending in ". ") makes String.split() return the original string
// unchanged as a single-element array despite a match existing -- treating
// that as progress caused infinite recursion, so we verify explicitly and
// fall through to the next (eventually terminating) strategy instead.
function breakUnit(t, targetChars) {
  if (t.length <= targetChars) return [t];

  const byPara = t.split(/\n\n+/);
  if (byPara.length > 1) return byPara.flatMap((p) => breakUnit(p, targetChars));

  const byLine = t.split('\n');
  if (byLine.length > 1) return byLine.flatMap((p) => breakUnit(p, targetChars));

  const bySentence = t.split(/(?<=[.!?]\s)/);
  if (bySentence.length > 1) return bySentence.flatMap((p) => breakUnit(p, targetChars));

  const out = [];
  for (let i = 0; i < t.length; i += targetChars) out.push(t.slice(i, i + targetChars));
  return out;
}

function createChunker({ tokenizer, targetChars = 1000, overlapChars = 100, maxTokens = 480 } = {}) {
  function split(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];

    const pieces = breakUnit(trimmed, targetChars)
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks = [];
    let buf = '';
    for (const p of pieces) {
      if (buf && buf.length + 1 + p.length > targetChars) {
        chunks.push(buf);
        const overlap = overlapChars > 0 ? buf.slice(-overlapChars) : '';
        buf = overlap ? overlap + '\n' + p : p;
      } else {
        buf = buf ? buf + '\n' + p : p;
      }
    }
    if (buf) chunks.push(buf);

    if (!tokenizer) return chunks.map((text) => ({ text }));

    const final = [];
    for (const c of chunks) {
      const toks = tokenizer.encode(c);
      if (toks.length <= maxTokens) {
        final.push({ text: c });
        continue;
      }
      for (let i = 0; i < toks.length; i += maxTokens) {
        final.push({ text: tokenizer.decode(toks.slice(i, i + maxTokens)) });
      }
    }
    return final;
  }

  return { split };
}

module.exports = { createChunker };
