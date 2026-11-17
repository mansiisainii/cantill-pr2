import { dateOf, round2 } from './util.js';
import { prepareLines } from './prepare.js';
import { clubLines } from './club.js';
import { valueRequirement } from './valuation.js';
import { evaluateRules } from './rules.js';
import { preferredList, suggestSuppliers } from './suppliers.js';
import { consolidate } from './consolidate.js';
import { buildRows } from './output.js';

export { buildMaster } from './master.js';
export { toCsv, OUTPUT_COLUMNS } from './output.js';

const inr = (n) => '₹' + Number(round2(n)).toLocaleString('en-IN');

function decide(r, policy, master, consumed) {
  const params = policy.params;
  const allowed = new Set(params.allowed_supplier_status);
  const item = r.item;
  const val = valueRequirement(r, master, consumed, params);

  const ctx = {
    is_new_item: !item,
    item_code: item?.item_code || 'NEW',
    item_type: item?.item_type || 'New',
    category: item?.category || '',
    plant: r.plant,
    value: val.value,
    urgency: r.emergency ? 'Emergency' : 'Normal',
    contract_usable: !!val.contracts.chosen,
    bought_recently: val.bought,
    uom: item?.uom || r.first.uom,
  };

  const { rule, outcome } = evaluateRules(policy, ctx);
  Object.assign(r, { policy, val, ctx, rule, outcome, decision: outcome.decision, route: outcome.route, value: val.value });

  if (outcome.decision === 'PO') {
    let supplier;
    let price;
    let relied;

    if (outcome.supplier === 'contract' && val.contracts.chosen) {
      const c = val.contracts.chosen;
      supplier = c.contract.supplier_id;
      price = c.rate;
      relied = `contract ${c.contract.contract_id}`;
      consumed.set(c.contract.contract_id, c.used + c.value);
    } else if (outcome.supplier === 'preferred_1') {
      const list = preferredList(item.item_code, r.reqDate, master, params);
      r.preferred = list;
      if (list.length) {
        supplier = list[0].supplier_id;
        price = list[0].reference_price;
        relied = `${list[0].reference_source}; preferred rank 1 (score ${list[0].score})`;
      }
    }

    if (supplier && allowed.has(master.supMap.get(supplier)?.status)) {
      r.supplier = supplier;
      r.price = price;
      r.relied = relied;
    } else {
      r.decision = policy.default.decision;
      r.route = policy.default.route;
      r.outcome = policy.default;
      r.fallback = 'No eligible Active supplier for a PO';
    }
  }

  if (r.decision === 'SOURCING_REQUEST') {
    r.suggested = suggestSuppliers(item, r.reqDate, r.outcome.suggest, master, params);
    r.relied = item ? 'preferred list + category top-up' : 'new item: buyer finds suppliers';
  }

  r.reason =
    `${rule.id} (policy v${policy.version}): ${rule.text}.` +
    (r.supplier ? ` Relied on ${r.relied}.` : r.suggested?.length ? ` Suggested: ${r.suggested.join(', ')}.` : '') +
    ` Value ${inr(r.value)} = ${r.qty} x ${val.unit} (${val.unitSource}).` +
    (r.lines.length > 1 ? ` ${r.lines.length} PR lines clubbed (2.2).` : '') +
    (r.fallback ? ` ${r.fallback}.` : '');
}

function summarize(r) {
  return {
    group_id: r.id,
    item_code: r.item?.item_code || 'NEW',
    item_description: r.item?.description || r.first.description,
    plant: r.plant,
    requirement_date: r.reqDate,
    quantity: r.qty,
    uom: r.item?.uom || r.first.uom,
    urgency: r.ctx.urgency,
    value: r.value,
    valuation: `${r.qty} x ${r.val.unit} (${r.val.unitSource})`,
    decision: r.decision,
    route: r.route,
    supplier_id: r.supplier || '',
    price: r.price ?? '',
    po_id: r.po_id || '',
    suggested_supplier_ids: r.suggested || [],
    rule_id: r.rule.id,
    rule_text: r.rule.text,
    policy_version: r.policy.version,
    relied_on: r.relied || '',
    reason: r.reason,
    contracts_checked: r.val.contracts.applicable.map(
      (a) => `${a.contract.contract_id} @${a.rate}: used ${inr(a.used)} + ${inr(a.value)} vs cap ${inr(a.contract.value_cap)} -> ${a.hasCeiling ? 'room' : 'NO ceiling'}`
    ),
    preferred: r.preferred || null,
    lines: r.lines.map((l) => ({
      pr_no: l.pr_no,
      pr_line: l.pr_line,
      created_at: l.created_at,
      need_by: l.need_by,
      quantity: l.quantity,
      description: l.description,
      urgency: l.urgency,
      match: l.match,
    })),
  };
}

export function processBatch(prLines, master, policies, opts = {}) {
  const sorted = [...policies].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const policyFor = (date) => {
    if (opts.policyMode === 'latest') return sorted[sorted.length - 1];
    let p = sorted[0];
    for (const x of sorted) if (x.effective_from <= date) p = x;
    return p;
  };

  const { valid, rejected } = prepareLines(prLines, master);
  const reqs = clubLines(valid, (l) => policyFor(dateOf(l.created_at)).params);

  const consumed = new Map(master.contracts.map((c) => [c.contract_id, Number(c.consumed_value || 0)]));
  const ordered = [...reqs].sort((a, b) => a.reqDate.localeCompare(b.reqDate) || a.firstMinute - b.firstMinute);
  for (const r of ordered) decide(r, policyFor(r.reqDate), master, consumed);

  const pos = consolidate(reqs);
  const { rows } = buildRows(prLines, reqs, rejected);

  return {
    rows,
    requirements: reqs.map(summarize),
    pos: pos.map((p) => ({
      po_id: p.id,
      supplier_id: p.supplier,
      plant: p.plant,
      route: p.route,
      requirements: p.reqs.map((x) => x.id),
    })),
    contractConsumption: Object.fromEntries(consumed),
  };
}