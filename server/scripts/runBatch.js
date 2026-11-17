import fs from 'node:fs';
import path from 'node:path';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster, processBatch, toCsv } from '../engine/index.js';

const dir = process.argv[2] || '../data';
const prFile = process.argv[3] || path.join(dir, 'sample_pr_batch.csv');
const policyFiles = process.argv.slice(4);
if (!policyFiles.length) policyFiles.push('policy/policy_v5.json');

const pdfOnlyPath = path.join(dir, 'contracts_pdf_only.json');
const pdfOnly = fs.existsSync(pdfOnlyPath) ? JSON.parse(fs.readFileSync(pdfOnlyPath, 'utf8')) : [];

const master = buildMaster({
  items: readCsv(path.join(dir, 'item_master.csv')),
  suppliers: readCsv(path.join(dir, 'supplier_master.csv')),
  plants: readCsv(path.join(dir, 'plants.csv')),
  poHistory: readCsv(path.join(dir, 'po_history.csv')),
  contracts: joinContracts(readCsv(path.join(dir, 'contract_register.csv')), readCsv(path.join(dir, 'contract_lines.csv')), pdfOnly),
});

const policies = policyFiles.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const out = processBatch(readCsv(prFile), master, policies);

fs.writeFileSync('out_decisions.csv', toCsv(out.rows));
console.log('rows', out.rows.length, '| requirements', out.requirements.length, '| POs', out.pos.length);

const counts = {};
for (const r of out.rows) counts[r.route] = (counts[r.route] || 0) + 1;
console.log('lines per route:', counts);

const spot = ['PR-26-00019', 'PR-26-00146', 'PR-26-00059', 'PR-26-00034', 'PR-26-00031', 'PR-26-00100', 'PR-26-00170', 'PR-26-00172'];
console.log('\npr_no         group     po_id    route              supplier  price    value');
for (const pr of spot) {
  const r = out.rows.find((x) => x.pr_no === pr);
  console.log(
    r.pr_no.padEnd(13),
    String(r.group_id).padEnd(9),
    String(r.po_id).padEnd(8),
    r.route.padEnd(18),
    String(r.supplier_id).padEnd(9),
    String(r.unit_price).padEnd(8),
    r.group_value_inr
  );
}