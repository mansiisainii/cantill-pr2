export function consolidate(reqs) {
  const pos = [];
  const poReqs = reqs.filter((r) => r.decision === 'PO').sort((a, b) => a.firstMinute - b.firstMinute);

  for (const r of poReqs) {
    const hours = r.policy.params.consolidation_hours;
    let po = pos.find(
      (p) =>
        p.supplier === r.supplier &&
        p.plant === r.plant &&
        p.route === r.route &&
        r.firstMinute - p.firstMinute <= hours * 60
    );
    if (!po) {
      po = {
        id: `PO-${String(pos.length + 1).padStart(4, '0')}`,
        supplier: r.supplier,
        plant: r.plant,
        route: r.route,
        firstMinute: r.firstMinute,
        reqs: [],
      };
      pos.push(po);
    }
    po.reqs.push(r);
    r.po_id = po.id;
  }
  return pos;
}