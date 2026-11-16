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