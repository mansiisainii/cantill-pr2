import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

export const readCsv = (file) =>
  parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });

export const parseCsvText = (text) =>
  parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });

export function joinContracts(register, lines, extra = []) {
  const byId = new Map();
  for (const r of register) {
    byId.set(r.contract_id, {
      contract_id: r.contract_id,
      supplier_id: r.supplier_id,
      start_date: r.start_date,
      end_date: r.end_date,
      value_cap: Number(r.value_cap),
      consumed_value: Number(r.consumed_value || 0),
      source: 'register',
      lines: [],
    });
  }
  for (const l of lines) {
    if (!byId.has(l.contract_id)) continue;
    byId.get(l.contract_id).lines.push({ item_code: l.item_code, rate: Number(l.rate), uom: l.uom });
  }
  for (const c of extra) byId.set(c.contract_id, c);
  return [...byId.values()];
}