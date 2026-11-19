import fs from 'fs';
import path from 'path';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster, processBatch, toCsv } from '../engine/index.js';
import { preferredExport } from '../engine/preferredExport.js';

const CANDIDATE_NAME = 'mansisaini';
const dir = 'data';
const pdfOnly = JSON.parse(fs.readFileSync(path.join(dir, 'contracts_pdf_only.json'), 'utf8'));

const master = buildMaster({
  items: readCsv(path.join(dir, 'item_master.csv')),
  suppliers: readCsv(path.join(dir, 'supplier_master.csv')),
  plants: readCsv(path.join(dir, 'plants.csv')),
  poHistory: readCsv(path.join(dir, 'po_history.csv')),
  contracts: joinContracts(
    readCsv(path.join(dir, 'contract_register.csv')),
    readCsv(path.join(dir, 'contract_lines.csv')),
    pdfOnly
  ),
});

const policyV5 = JSON.parse(fs.readFileSync('server/policy/policy_v5.json', 'utf8'));

// Amendment No. 1 v5.1
const policyV51 = {
  version: '5.1',
  title: 'Corvo Procurement Policy v5.1 (Amendment No. 1)',
  effective_from: '2026-12-01',
  approved_by: 'CFO',
  approved_at: '2026-11-20T00:00:00.000Z',
  params: { ...policyV5.params },
  rules: [
    policyV5.rules.find((r) => r.id === '1.2'),
    policyV5.rules.find((r) => r.id === '5.1'),
    policyV5.rules.find((r) => r.id === '5.2'),
    // A3: New rule 5.2A applied immediately after rule 5.2
    {
      id: '5.2A.1',
      text: 'Chakan electrical safety (RFP): Electrical Spares at CHK1 >= 8,00,000 must be sourced',
      when: [
        { field: 'plant', op: 'eq', value: 'CHK1' },
        { field: 'category', op: 'eq', value: 'Electrical Spares' },
        { field: 'value', op: 'gte', value: 800000 },
      ],
      then: { decision: 'SOURCING_REQUEST', route: 'RFP', suggest: 5 },
    },
    {
      id: '5.2A',
      text: 'Chakan electrical safety (RFQ): Electrical Spares at CHK1 worth 50,000 or more must be sourced',
      when: [
        { field: 'plant', op: 'eq', value: 'CHK1' },
        { field: 'category', op: 'eq', value: 'Electrical Spares' },
        { field: 'value', op: 'gte', value: 50000 },
      ],
      then: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
    },
    // 5.3 Emergency PO
    policyV5.rules.find((r) => r.id === '5.3'),
    // A1: Packaging spot limit
    {
      id: '5.4a',
      text: 'Packaging spot PO: value below 1,00,000 and bought from Active supplier in last 365 days',
      when: [
        { field: 'category', op: 'eq', value: 'Packaging' },
        { field: 'value', op: 'lt', value: 100000 },
        { field: 'bought_recently', op: 'eq', value: true },
      ],
      then: { decision: 'PO', route: 'SPOT_PO', supplier: 'preferred_1' },
    },
    {
      id: '5.4b',
      text: 'Non-packaging spot PO: value below 2,00,000 and bought from Active supplier in last 365 days',
      when: [
        { field: 'category', op: 'ne', value: 'Packaging' },
        { field: 'value', op: 'lt', value: 200000 },
        { field: 'bought_recently', op: 'eq', value: true },
      ],
      then: { decision: 'PO', route: 'SPOT_PO', supplier: 'preferred_1' },
    },
    // A2: RFP threshold
    {
      id: '5.5',
      text: 'Value below 8,00,000: RFQ with 3 suggested suppliers',
      when: [{ field: 'value', op: 'lt', value: 800000 }],
      then: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
    },
    {
      id: '5.6',
      text: 'Value 8,00,000 or more: RFP with 5 suggested suppliers',
      when: [{ field: 'value', op: 'gte', value: 800000 }],
      then: { decision: 'SOURCING_REQUEST', route: 'RFP', suggest: 5 },
    },
  ],
  default: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
};

const hiddenPrs = readCsv('data/hidden_pr_batch.csv');
console.log(`Processing ${hiddenPrs.length} PR lines for submission...\n`);

// 1. RUN 1: Policy v5.0 Baseline
const outRun1 = processBatch(hiddenPrs, master, [policyV5]);
const run1Csv = toCsv(outRun1.rows);
const run1Path = path.join('submission', `${CANDIDATE_NAME}__run1.csv`);
fs.writeFileSync(run1Path, run1Csv);
console.log(`[SAVED] ${run1Path} (${outRun1.rows.length} decision rows)`);

// 2. RUN 2: Policy v5.1 Amendment
// Requirements with reqDate >= 2026-12-01 use Policy v5.1!
const outRun2 = processBatch(hiddenPrs, master, [policyV51, policyV5]);
const run2Csv = toCsv(outRun2.rows);
const run2Path = path.join('submission', `${CANDIDATE_NAME}__run2.csv`);
fs.writeFileSync(run2Path, run2Csv);
console.log(`[SAVED] ${run2Path} (${outRun2.rows.length} decision rows)`);

// 3. PREFERRED SUPPLIERS as of 2026-12-01
const prefRows = preferredExport(master, '2026-12-01', policyV51.params);
const prefCsv = toCsv(prefRows, ['item_code', 'rank', 'supplier_id', 'reference_price']);
const prefPath = path.join('submission', `${CANDIDATE_NAME}__preferred.csv`);
fs.writeFileSync(prefPath, prefCsv);
console.log(`[SAVED] ${prefPath} (${prefRows.length} ranked items rows)`);

console.log('\n--- VERIFICATION STATS ---');
console.log('Run 1 routes count:');
const c1 = {};
for (const r of outRun1.rows) c1[r.route] = (c1[r.route] || 0) + 1;
console.log(c1);

console.log('\nRun 2 routes count:');
const c2 = {};
for (const r of outRun2.rows) c2[r.route] = (c2[r.route] || 0) + 1;
console.log(c2);

let changed = 0;
for (let i = 0; i < outRun1.rows.length; i++) {
  if (outRun1.rows[i].route !== outRun2.rows[i].route || outRun1.rows[i].supplier_id !== outRun2.rows[i].supplier_id) {
    changed++;
  }
}
console.log(`\nLines affected by Amendment No. 1: ${changed} lines`);
