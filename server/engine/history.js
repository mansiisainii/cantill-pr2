import { dayNum } from './util.js';

export function posInWindow(master, itemCode, asOf, days) {
  const d = dayNum(asOf);
  return (master.poByItem.get(itemCode) || []).filter((p) => {
    const x = dayNum(p.po_date);
    return x <= d && x >= d - days;
  });
}

export function boughtFromAllowed(pos, master, allowedStatus) {
  return pos.some((p) => allowedStatus.has(master.supMap.get(p.supplier_id)?.status));
}