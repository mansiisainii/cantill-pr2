import { preferredList } from './suppliers.js';

export function preferredExport(master, asOf, params, top = 3) {
  const out = [];
  const items = [...master.items].sort((a, b) => a.item_code.localeCompare(b.item_code));
  for (const it of items) {
    preferredList(it.item_code, asOf, master, params)
      .slice(0, top)
      .forEach((r) => out.push({ item_code: it.item_code, rank: r.rank, supplier_id: r.supplier_id, reference_price: r.reference_price }));
  }
  return out;
}