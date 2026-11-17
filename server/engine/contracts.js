import { dayNum } from './util.js';

export function evaluateContracts(itemCode, reqDate, qty, master, consumed, allowedStatus) {
  const d = dayNum(reqDate);

  const applicable = (master.contractsByItem.get(itemCode) || [])
    .filter((c) => {
      const supplier = master.supMap.get(c.supplier_id);
      return dayNum(c.start_date) <= d && d <= dayNum(c.end_date) && supplier && allowedStatus.has(supplier.status);
    })
    .map((c) => {
      const rate = c.lines.find((l) => l.item_code === itemCode).rate;
      const used = consumed.get(c.contract_id) ?? 0;
      const value = qty * rate;
      return { contract: c, rate, used, value, hasCeiling: used + value <= c.value_cap };
    });

  const usable = applicable
    .filter((a) => a.hasCeiling)
    .sort((a, b) => a.rate - b.rate || a.contract.contract_id.localeCompare(b.contract.contract_id));

  const lowestAny = [...applicable].sort((a, b) => a.rate - b.rate)[0] || null;

  return { applicable, chosen: usable[0] || null, lowestAny };
}

export function parseContractText(text) {
  const t = text.replace(/\r/g, '');
  const id = t.match(/Contract No\.\s*(RC-\d{4}-\d+)/i)?.[1];
  const supplier = t.match(/Supplier ID\s+(S\d+)/i)?.[1];
  const term = t.match(/valid from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
  const cap = t.match(/exceed\s+INR\s+([\d,]+)/i)?.[1];
  const lines = [...t.matchAll(/^\s*\d+\s*(ITM-\d{4})\s*(.+?)\s*([A-Z]{2,5})\s*([\d,]+\.\d{2})\s*$/gm)].map((m) => ({
    item_code: m[1],
    rate: Number(m[4].replace(/,/g, '')),
  }));

  const missing = [
    !id && 'contract number',
    !supplier && 'supplier id',
    !term && 'validity dates',
    !cap && 'value ceiling',
    !lines.length && 'rate lines',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Could not read the contract PDF: missing ${missing.join(', ')}`);

  return {
    contract_id: id,
    supplier_id: supplier,
    start_date: term[1],
    end_date: term[2],
    value_cap: Number(cap.replace(/,/g, '')),
    consumed_value: 0,
    source: 'pdf',
    lines,
  };
}