import fs from 'node:fs';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster } from '../engine/master.js';
import { prepareLines } from '../engine/prepare.js';
import { clubLines } from '../engine/club.js';
import { preferredList, suggestSuppliers } from '../engine/suppliers.js';

const d = '../data/';
const pdfOnly = JSON.parse(fs.readFileSync(d + 'contracts_pdf_only.json', 'utf8'));
const master = buildMaster({
  items: readCsv(d + 'item_master.csv'),
  suppliers: readCsv(d + 'supplier_master.csv'),
  plants: readCsv(d + 'plants.csv'),
  poHistory: readCsv(d + 'po_history.csv'),
  contracts: joinContracts(readCsv(d + 'contract_register.csv'), readCsv(d + 'contract_lines.csv'), pdfOnly),
});

const params = {
  club_days: 14,
  club_needby_days: 7,
  history_days: 365,
  preferred_days: 548,
  allowed_supplier_status: ['Active'],
  ranking: { freq: 0.35, recency: 0.25, contract: 0.1, ontime: 0.15, quality: 0.15, freq_cap: 10, recent_days: 90, mid_days: 365 },
};

for (const code of ['ITM-1048', 'ITM-1036', 'ITM-1016']) {
  console.log(code, master.itemMap.get(code).description, '(as of 2026-11-01)');
  for (const r of preferredList(code, '2026-11-01', master, params)) {
    console.log(' ', r.rank, r.supplier_id, 'score', r.score, '| POs', r.po_count, '| last', r.last_po_date, '| contract', r.has_contract ? 'yes' : 'no');
  }
}

const { valid } = prepareLines(readCsv(d + 'sample_pr_batch.csv'), master);
const reqs = clubLines(valid, () => params);

const checks = [
  ['PR-26-00004', 3, 'S014;S013;S016', 'Ex 3'],
  ['PR-26-00089', 3, 'S043;S044;S042', 'Ex 9'],
  ['PR-26-00050', 3, 'S003;S002;S005', 'Ex 10'],
  ['PR-26-00100', 5, 'S020;S017;S019;S018', 'Ex 11'],
  ['PR-26-00047', 5, 'S045;S047;S020;S048;S046', 'Ex 12'],
];

console.log('\nSuggestions:');
for (const [pr, n, expected, label] of checks) {
  const r = reqs.find((x) => x.lines.some((l) => l.pr_no === pr));
  const got = suggestSuppliers(r.item, r.reqDate, n, master, params).join(';');
  console.log(label.padEnd(6), got.padEnd(28), got === expected ? 'OK' : 'XX (expected ' + expected + ')');
}