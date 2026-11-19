import fs from 'fs';
import path from 'path';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster, processBatch, toCsv } from '../engine/index.js';
import { preferredExport } from '../engine/preferredExport.js';

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

// Build Policy v5.1 exactly according to Amendment No. 1
const policyV51 = {
  version: '5.1',
  title: 'Corvo Procurement Policy v5.1 (Amendment 1)',
  effective_from: '2026-12-01',
  approved_by: 'CFO',
  approved_at: '2026-11-20T00:00:00.000Z',
  params: { ...policyV5.params },
  rules: [
    // 1.2
    policyV5.rules.find((r) => r.id === '1.2'),
    // 5.1
    policyV5.rules.find((r) => r.id === '5.1'),
    // 5.2 Contract PO
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
    // A1: Packaging spot limit 1,00,000 & Non-packaging spot limit 2,00,000
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
    // A2: RFP threshold reduced from 10,00,000 to 8,00,000
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

fs.writeFileSync('server/policy/amendment_v5_1.json', JSON.stringify(policyV51, null, 2));

const hiddenPrs = readCsv('data/hidden_pr_batch.csv');
console.log('Total PR lines in hidden_pr_batch.csv:', hiddenPrs.length);

// RUN 1: Process under policy v5.0
const outRun1 = processBatch(hiddenPrs, master, [policyV5]);
console.log('\n--- RUN 1 (Policy v5.0) ---');
console.log('Rows:', outRun1.rows.length, '| Reqs:', outRun1.requirements.length, '| POs:', outRun1.pos.length);
const counts1 = {};
for (const r of outRun1.rows) counts1[r.route] = (counts1[r.route] || 0) + 1;
console.log('Route distribution:', counts1);

// RUN 2: Process under policy v5.1
const outRun2 = processBatch(hiddenPrs, master, [policyV51, policyV5]);
console.log('\n--- RUN 2 (Policy v5.1 Amendment) ---');
console.log('Rows:', outRun2.rows.length, '| Reqs:', outRun2.requirements.length, '| POs:', outRun2.pos.length);
const counts2 = {};
for (const r of outRun2.rows) counts2[r.route] = (counts2[r.route] || 0) + 1;
console.log('Route distribution:', counts2);

// Check differences between Run 1 and Run 2
let diffCount = 0;
for (let i = 0; i < outRun1.rows.length; i++) {
  const r1 = outRun1.rows[i];
  const r2 = outRun2.rows[i];
  if (r1.route !== r2.route || r1.supplier_id !== r2.supplier_id) {
    diffCount++;
    console.log(`Diff #${diffCount}: PR ${r1.pr_no}/${r1.pr_line} (${r1.resolved_item_code})`);
    console.log(`   Run 1: ${r1.route} ${r1.supplier_id || ''} (val: ₹${r1.group_value_inr})`);
    console.log(`   Run 2: ${r2.route} ${r2.supplier_id || ''} [Rule ${r2.reason.slice(0, 30)}...]`);
  }
}
console.log(`Total lines changed route/supplier in Run 2: ${diffCount}`);

// PREFERRED SUPPLIERS as of 2026-12-01
const prefRows = preferredExport(master, '2026-12-01', policyV51.params);
console.log('\nPreferred suppliers export rows as of 2026-12-01:', prefRows.length);
console.log('First 3 preferred rows:', prefRows.slice(0, 3));
