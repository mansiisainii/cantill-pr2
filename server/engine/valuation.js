import { evaluateContracts } from './contracts.js';
import { posInWindow, boughtFromAllowed } from './history.js';
import { round2 } from './util.js';

export function valueRequirement(req, master, consumed, params) {
  const allowed = new Set(params.allowed_supplier_status);
  const item = req.item;

  if (!item) {
    const est = req.lines.map((l) => l.est).find((v) => v != null);
    const unit = est ?? 0;
    return {
      contracts: { applicable: [], chosen: null, lowestAny: null },
      recentPo: null,
      bought: false,
      unit,
      unitSource: est != null ? 'requester estimate' : 'no estimate given (value 0)',
      value: round2(req.qty * unit),
    };
  }

  const contracts = evaluateContracts(item.item_code, req.reqDate, req.qty, master, consumed, allowed);
  const pos = posInWindow(master, item.item_code, req.reqDate, params.history_days);
  const recentPo = pos[0] || null;
  const bought = boughtFromAllowed(pos, master, allowed);

  let unit;
  let unitSource;
  if (contracts.chosen) {
    unit = contracts.chosen.rate;
    unitSource = `contract ${contracts.chosen.contract.contract_id}`;
  } else if (contracts.lowestAny) {
    unit = contracts.lowestAny.rate;
    unitSource = `lowest contract rate (${contracts.lowestAny.contract.contract_id}, ceiling exhausted)`;
  } else if (recentPo) {
    unit = recentPo.unit_price;
    unitSource = `latest PO ${recentPo.po_number}`;
  } else {
    unit = Number(item.standard_price);
    unitSource = 'item master standard price';
  }

  return { contracts, recentPo, bought, unit, unitSource, value: round2(req.qty * unit) };
}