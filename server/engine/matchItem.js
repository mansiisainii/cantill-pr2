
const STOP = new Set([
  'for', 'maintenance', 'urgent', 'as', 'per', 'sample', 'the', 'a', 'of', 'and',
  'required', 'need', 'pls', 'please', 'new', 'spare', 'type', 'with', 'to', 'in',
]);

const tokenize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/["']/g, ' inch ') 
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));

const hasDigit = (t) => /\d/.test(t);

const isSubseq = (a, b) => {
  let i = 0;
  for (const c of b) if (c === a[i]) i++;
  return i === a.length;
};

function tokenMatch(q, w) {
  if (q === w) return 1;
  if (hasDigit(q) || hasDigit(w)) return 0; 
  if (q.length >= 3 && w.startsWith(q)) return 0.9;
  if (q.length >= 3 && q[0] === w[0] && q.length < w.length && isSubseq(q, w)) return 0.8; 
  return 0;
}


export function scoreItem(queryTokens, itemTokens) {
  if (!queryTokens.length) return 0;
  let got = 0;
  const used = new Set();
  for (const q of queryTokens) {
    let best = 0;
    let bi = -1;
    itemTokens.forEach((w, i) => {
      if (used.has(i)) return;
      const m = tokenMatch(q, w);
      if (m > best) { best = m; bi = i; }
    });
    if (bi >= 0) used.add(bi);
    got += best;
  }
  const qCov = got / queryTokens.length; 
  const iCov = used.size / itemTokens.length;
  const numMiss = queryTokens.filter((q) => hasDigit(q) && !itemTokens.includes(q)).length;
  return Math.max(0, 0.7 * qCov + 0.3 * iCov - 0.4 * numMiss);
}


export function buildIndex(items) {
  return items.map((it) => ({ item: it, tokens: tokenize(it.description) }));
}


export function matchItem(description, index, { threshold = 0.62, margin = 0.05 } = {}) {
  const q = tokenize(description);
  const scored = index
    .map((x) => ({ item: x.item, score: scoreItem(q, x.tokens) }))
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3).filter((s) => s.score > 0.3);

  if (!scored.length || scored[0].score < threshold) {
    return { item: null, score: scored[0]?.score || 0, candidates: top, status: 'NONE' };
  }
  
  if (scored[1] && scored[0].score - scored[1].score < margin && scored[1].score >= threshold) {
    return { item: scored[0].item, score: scored[0].score, candidates: top, status: 'AMBIGUOUS' };
  }
  return { item: scored[0].item, score: scored[0].score, candidates: top, status: 'MATCHED' };
}