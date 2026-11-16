import { minuteNum } from './util.js';
import { matchItem } from './matchItem.js';

function rejectReason(l, master) {
  if (!master.plantSet.has(l.plant)) return `Plant "${l.plant}" is not in the plant master`;
  if (!(l.quantity > 0)) return `Quantity is ${l.quantity}: nothing to buy`;
  if (!l.description && !l.item_code) return 'No item code or description';
  if (!/^\d{4}-\d{2}-\d{2}/.test(l.created_at)) return 'Invalid creation time';
  return null;
}

export function prepareLines(prLines, master) {
  const lines = prLines.map((r, idx) => ({
    idx,
    pr_no: String(r.pr_no).trim(),
    pr_line: Number(r.pr_line),
    created_at: String(r.created_at).trim(),
    plant: String(r.plant || '').trim(),
    item_code: r.item_code ? String(r.item_code).trim() : '',
    description: String(r.description || '').trim(),
    quantity: Number(r.quantity),
    uom: r.uom,
    est: r.estimated_unit_price === '' || r.estimated_unit_price == null ? null : Number(r.estimated_unit_price),
    need_by: r.need_by_date ? String(r.need_by_date).trim() : '',
    urgency: String(r.urgency || 'Normal').trim(),
  }));

  lines.sort(
    (a, b) =>
      minuteNum(a.created_at) - minuteNum(b.created_at) ||
      a.pr_no.localeCompare(b.pr_no) ||
      a.pr_line - b.pr_line
  );

  const valid = [];
  const rejected = [];
  for (const l of lines) {
    const reason = rejectReason(l, master);
    if (reason) rejected.push({ line: l, reason });
    else valid.push(l);
  }

  for (const l of valid) {
    const byCode = l.item_code && master.itemMap.get(l.item_code);
    if (byCode) {
      l.item = byCode;
      l.match = { status: 'CODE', note: 'item code given' };
      continue;
    }
    const m = matchItem(l.description, master.itemIndex);
    if (m.status === 'NONE') {
      l.item = null;
      l.match = { status: 'NEW', note: `no confident match for "${l.description}"` };
    } else {
      l.item = m.item;
      l.match = { status: m.status, score: Number(m.score.toFixed(2)), note: `"${l.description}" matched to ${m.item.description}` };
    }
  }
  return { valid, rejected };
}