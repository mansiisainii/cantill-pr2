import { dayNum } from './util.js';

export function preferredList(itemCode, asOf, master, params) {
  const W = params.ranking;
  const allowed = new Set(params.allowed_supplier_status);
  const asOfN = dayNum(asOf);

  const pos = (master.poByItem.get(itemCode) || []).filter((p) => {
    const d = dayNum(p.po_date);
    return d <= asOfN && d >= asOfN - params.preferred_days;
  });

  const posBySupplier = new Map();
  for (const p of pos) {
    if (!posBySupplier.has(p.supplier_id)) posBySupplier.set(p.supplier_id, []);
    posBySupplier.get(p.supplier_id).push(p);
  }

  const contracts = (master.contractsByItem.get(itemCode) || []).filter((c) => dayNum(c.start_date) <= asOfN);
  const ids = new Set([...posBySupplier.keys(), ...contracts.map((c) => c.supplier_id)]);

  const rows = [];
  for (const id of ids) {
    const s = master.supMap.get(id);
    if (!s || !allowed.has(s.status)) continue;

    const sp = (posBySupplier.get(id) || []).sort((a, b) => (a.po_date < b.po_date ? 1 : -1));
    const myContracts = contracts
      .filter((c) => c.supplier_id === id)
      .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));

    const n = sp.length;
    const lastPo = sp[0]?.po_date || null;
    const age = lastPo ? asOfN - dayNum(lastPo) : Infinity;
    const recency = age <= W.recent_days ? 1 : age <= W.mid_days ? 0.5 : 0;

    const components = {
      freq: Math.min(n, W.freq_cap) / W.freq_cap,
      recency,
      contract: myContracts.length ? 1 : 0,
      ontime: Number(s.on_time_pct || 0) / 100,
      quality: Number(s.quality_rating || 0) / 5,
    };

    const score =
      W.freq * components.freq +
      W.recency * components.recency +
      W.contract * components.contract +
      W.ontime * components.ontime +
      W.quality * components.quality;

    let referencePrice = null;
    let referenceSource = null;
    if (sp.length) {
      referencePrice = sp[0].unit_price;
      referenceSource = `PO ${sp[0].po_number} (${sp[0].po_date})`;
    } else if (myContracts.length) {
      referencePrice = myContracts[0].lines.find((l) => l.item_code === itemCode)?.rate ?? null;
      referenceSource = `contract ${myContracts[0].contract_id}`;
    }

    rows.push({
      supplier_id: id,
      name: s.name,
      score: Number(score.toFixed(3)),
      components,
      po_count: n,
      last_po_date: lastPo,
      has_contract: myContracts.length > 0,
      on_time_pct: s.on_time_pct,
      quality_rating: s.quality_rating,
      reference_price: referencePrice,
      reference_source: referenceSource,
    });
  }

  rows.sort(
    (a, b) =>
      b.score - a.score ||
      (b.last_po_date || '').localeCompare(a.last_po_date || '') ||
      b.po_count - a.po_count ||
      a.supplier_id.localeCompare(b.supplier_id)
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function suggestSuppliers(item, asOf, n, master, params) {
  if (!n || !item) return [];
  const allowed = new Set(params.allowed_supplier_status);
  const out = preferredList(item.item_code, asOf, master, params).map((r) => r.supplier_id);

  if (out.length < n) {
    const extra = master.suppliers
      .filter(
        (s) =>
          allowed.has(s.status) &&
          !out.includes(s.supplier_id) &&
          String(s.categories || '').split(';').map((x) => x.trim()).includes(item.category)
      )
      .sort(
        (a, b) =>
          Number(b.on_time_pct) / 100 + Number(b.quality_rating) / 5 - (Number(a.on_time_pct) / 100 + Number(a.quality_rating) / 5) ||
          a.supplier_id.localeCompare(b.supplier_id)
      );
    for (const s of extra) {
      if (out.length >= n) break;
      out.push(s.supplier_id);
    }
  }
  return out.slice(0, n);
}