import { readCsv, joinContracts } from '../engine/loadCsv.js';

const d = '../data/';
const items = readCsv(d + 'item_master.csv');
const suppliers = readCsv(d + 'supplier_master.csv');
const plants = readCsv(d + 'plants.csv');
const pos = readCsv(d + 'po_history.csv');
const contracts = joinContracts(readCsv(d + 'contract_register.csv'), readCsv(d + 'contract_lines.csv'));
const prs = readCsv(d + 'sample_pr_batch.csv');

console.log({ items: items.length, suppliers: suppliers.length, plants: plants.length, pos: pos.length, contracts: contracts.length, prs: prs.length });
console.log('Pehla contract:', contracts[0]);
console.log('Pehla PR line:', prs[0]);