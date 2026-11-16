import { buildIndex } from './matchItem.js';

export function buildMaster(raw) {
  const m = { ...raw };
  m.itemMap = new Map(raw.items.map((i) => [i.item_code, i]));
  m.supMap = new Map(raw.suppliers.map((s) => [s.supplier_id, s]));
  m.plantSet = new Set(raw.plants.map((p) => p.plant));
  m.itemIndex = buildIndex(raw.items);

  m.poByItem = new Map();
  const sortedPos = [...raw.poHistory].sort((a, b) => (a.po_date < b.po_date ? 1 : -1));
  for (const p of sortedPos) {
    if (!m.poByItem.has(p.item_code)) m.poByItem.set(p.item_code, []);
    m.poByItem.get(p.item_code).push({ ...p, quantity: Number(p.quantity), unit_price: Number(p.unit_price) });
  }

  m.contractsByItem = new Map();
  for (const c of raw.contracts) {
    for (const l of c.lines) {
      if (!m.contractsByItem.has(l.item_code)) m.contractsByItem.set(l.item_code, []);
      m.contractsByItem.get(l.item_code).push(c);
    }
  }
  return m;
}