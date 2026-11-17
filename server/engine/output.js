export const OUTPUT_COLUMNS = [
  'pr_no',
  'pr_line',
  'resolved_item_code',
  'group_id',
  'po_id',
  'decision',
  'route',
  'supplier_id',
  'unit_price',
  'group_value_inr',
  'suggested_supplier_ids',
  'policy_version',
  'reason',
];

export function buildRows(prLines, reqs, rejected) {
  const byIdx = new Map();

  for (const { line, reason } of rejected) {
    byIdx.set(line.idx, {
      pr_no: line.pr_no,
      pr_line: line.pr_line,
      resolved_item_code: '',
      group_id: '',
      po_id: '',
      decision: 'NOT_PROCESSED',
      route: 'NOT_PROCESSED',
      supplier_id: '',
      unit_price: '',
      group_value_inr: '',
      suggested_supplier_ids: '',
      policy_version: '',
      reason: reason + ' (see DECISIONS.md)',
    });
  }

  for (const r of reqs) {
    for (const l of r.lines) {
      byIdx.set(l.idx, {
        pr_no: l.pr_no,
        pr_line: l.pr_line,
        resolved_item_code: r.item?.item_code || 'NEW',
        group_id: r.id,
        po_id: r.po_id || '',
        decision: r.decision,
        route: r.route,
        supplier_id: r.supplier || '',
        unit_price: r.supplier ? r.price : '',
        group_value_inr: r.value,
        suggested_supplier_ids: (r.suggested || []).join(';'),
        policy_version: r.policy.version,
        reason: r.reason,
      });
    }
  }
  return { rows: prLines.map((_, i) => byIdx.get(i)) };
}

export function toCsv(rows, cols = OUTPUT_COLUMNS) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}