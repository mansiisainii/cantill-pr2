import fs from 'node:fs';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster } from '../engine/master.js';
import { prepareLines } from '../engine/prepare.js';
import { clubLines } from '../engine/club.js';
import { valueRequirement } from '../engine/valuation.js';
import { evaluateRules, describeRule } from '../engine/rules.js';

const d = '../data/';
const policy = JSON.parse(fs.readFileSync('policy/policy_v5.json', 'utf8'));
const params = policy.params;

const master = buildMaster({
  items: readCsv(d + 'item_master.csv'),
  suppliers: readCsv(d + 'supplier_master.csv'),
  plants: readCsv(d + 'plants.csv'),
  poHistory: readCsv(d + 'po_history.csv'),
  contracts: joinContracts(
    readCsv(d + 'contract_register.csv'),
    readCsv(d + 'contract_lines.csv'),
    JSON.parse(fs.readFileSync(d + 'contracts_pdf_only.json', 'utf8'))
  ),
});

const { valid } = prepareLines(readCsv(d + 'sample_pr_batch.csv'), master);
const reqs = clubLines(valid, () => params);
const consumed = new Map(master.contracts.map((c) => [c.contract_id, Number(c.consumed_value || 0)]));
const ordered = [...reqs].sort((a, b) => a.reqDate.localeCompare(b.reqDate) || a.firstMinute - b.firstMinute);

const buildCtx = (r, val) => ({
  is_new_item: !r.item,
  item_code: r.item?.item_code || 'NEW',
  item_type: r.item?.item_type || 'New',
  category: r.item?.category || '',
  plant: r.plant,
  value: val.value,
  urgency: r.emergency ? 'Emergency' : 'Normal',
  contract_usable: !!val.contracts.chosen,
  bought_recently: val.bought,
  uom: r.item?.uom || r.first.uom,
});

for (const r of ordered) {
  r.val = valueRequirement(r, master, consumed, params);
  r.ctx = buildCtx(r, r.val);
  const { rule, outcome } = evaluateRules(policy, r.ctx);
  r.rule = rule;
  r.route = outcome.route;
  if (outcome.route === 'CONTRACT_PO') {
    const c = r.val.contracts.chosen;
    consumed.set(c.contract.contract_id, c.used + c.value);
  }
}

const want = [
  ['PR-26-00019', 'Ex 1', 'CONTRACT_PO'],
  ['PR-26-00045', 'Ex 2', 'CONTRACT_PO'],
  ['PR-26-00004', 'Ex 3', 'RFQ'],
  ['PR-26-00034', 'Ex 4', 'CONTRACT_PO'],
  ['PR-26-00146', 'Ex 5', 'SPOT_PO'],
  ['PR-26-00106', 'Ex 6', 'SPOT_PO'],
  ['PR-26-00088', 'Ex 7', 'SPOT_PO'],
  ['PR-26-00059', 'Ex 8', 'EMERGENCY_PO'],
  ['PR-26-00089', 'Ex 9', 'RFQ'],
  ['PR-26-00050', 'Ex 10', 'RFQ'],
  ['PR-26-00100', 'Ex 11', 'RFP'],
  ['PR-26-00047', 'Ex 12', 'CAPEX_SOURCING'],
  ['PR-26-00170', 'Ex 13', 'NEW_ITEM_SOURCING'],
  ['PR-26-00031', 'Ex 14', 'CONTRACT_PO'],
];

for (const [pr, label, expected] of want) {
  const r = reqs.find((x) => x.lines.some((l) => l.pr_no === pr));
  console.log(label.padEnd(6), r.route.padEnd(18), r.route === expected ? 'OK' : 'XX (expected ' + expected + ')', ' rule', r.rule.id);
}

const counts = {};
for (const r of reqs) counts[r.route] = (counts[r.route] || 0) + 1;
console.log('\nRoute counts:', counts);

console.log('\nAmendment demo (code ko haath lagaye bina):');
const p2 = JSON.parse(JSON.stringify(policy));
p2.rules.find((r) => r.id === '5.4').when[0].value = 300000;
p2.rules.splice(3, 0, {
  id: 'X.1',
  text: 'Chakan electrical spares always RFQ',
  when: [
    { field: 'plant', op: 'eq', value: 'CHK1' },
    { field: 'category', op: 'eq', value: 'Electrical Spares' },
  ],
  then: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
});
console.log(describeRule(p2.rules[3]));
const ctx = { is_new_item: false, item_type: 'Material', category: 'Electrical Spares', plant: 'CHK1', value: 50000, urgency: 'Normal', contract_usable: false, bought_recently: true };
console.log('v5.0  CHK1 electrical 50,000  ->', evaluateRules(policy, ctx).outcome.route);
console.log('amended CHK1 electrical 50,000 ->', evaluateRules(p2, ctx).outcome.route);
console.log('v5.0  PUN1 2,50,000           ->', evaluateRules(policy, { ...ctx, plant: 'PUN1', value: 250000 }).outcome.route);
console.log('amended PUN1 2,50,000          ->', evaluateRules(p2, { ...ctx, plant: 'PUN1', value: 250000 }).outcome.route);