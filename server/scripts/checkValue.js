import fs from 'node:fs';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster } from '../engine/master.js';
import { prepareLines } from '../engine/prepare.js';
import { clubLines } from '../engine/club.js';
import { valueRequirement } from '../engine/valuation.js';

const d = '../data/';
const pdfOnly = JSON.parse(fs.readFileSync(d + 'contracts_pdf_only.json', 'utf8'));
const master = buildMaster({
  items: readCsv(d + 'item_master.csv'),
  suppliers: readCsv(d + 'supplier_master.csv'),
  plants: readCsv(d + 'plants.csv'),
  poHistory: readCsv(d + 'po_history.csv'),
  contracts: joinContracts(readCsv(d + 'contract_register.csv'), readCsv(d + 'contract_lines.csv'), pdfOnly),
});

const params = { club_days: 14, club_needby_days: 7, history_days: 365, allowed_supplier_status: ['Active'] };
const { valid } = prepareLines(readCsv(d + 'sample_pr_batch.csv'), master);
const reqs = clubLines(valid, () => params);

const consumed = new Map(master.contracts.map((c) => [c.contract_id, Number(c.consumed_value || 0)]));
const ordered = [...reqs].sort((a, b) => a.reqDate.localeCompare(b.reqDate) || a.firstMinute - b.firstMinute);

for (const r of ordered) {
  r.val = valueRequirement(r, master, consumed, params);
  const chosen = r.val.contracts.chosen;
  if (chosen && r.item.item_type !== 'Capex') consumed.set(chosen.contract.contract_id, chosen.used + chosen.value);
}

const want = [
  ['PR-26-00019', 'Ex 1 contract', 137531],
  ['PR-26-00045', 'Ex 2 PDF-only contract', 26829],
  ['PR-26-00004', 'Ex 3 ceiling khatam', 220256],
  ['PR-26-00034', 'Ex 4 do contracts', 32547],
  ['PR-26-00031', 'Ex 14 doosri requirement', 23227],
  ['PR-26-00146', 'Ex 5 clubbed oil', 126472],
  ['PR-26-00106', 'Ex 6 VCI bag', 156170],
  ['PR-26-00088', 'Ex 7 hyd hose', 97955],
  ['PR-26-00059', 'Ex 8 emergency', 253184],
  ['PR-26-00089', 'Ex 9 CMM service', 336562],
  ['PR-26-00050', 'Ex 10 aluminium', 80300],
  ['PR-26-00100', 'Ex 11 encoder', 2070780],
  ['PR-26-00047', 'Ex 12 crane', 6036704],
  ['PR-26-00170', 'Ex 13 new item', 141100],
];

for (const [pr, label, expected] of want) {
  const r = reqs.find((x) => x.lines.some((l) => l.pr_no === pr));
  const got = Math.round(r.val.value);
  console.log(label.padEnd(26), String(got).padStart(8), got === expected ? 'OK ' : 'XX ', r.val.unitSource);
}