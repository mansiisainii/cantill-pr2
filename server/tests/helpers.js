import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster, processBatch } from '../engine/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA = path.join(here, '..', '..', 'data');
export const hasData = fs.existsSync(path.join(DATA, 'item_master.csv'));
export const policy = JSON.parse(fs.readFileSync(path.join(here, '..', 'policy', 'policy_v5.json'), 'utf8'));

export function loadMaster() {
  const pdfOnly = JSON.parse(fs.readFileSync(path.join(DATA, 'contracts_pdf_only.json'), 'utf8'));
  return buildMaster({
    items: readCsv(path.join(DATA, 'item_master.csv')),
    suppliers: readCsv(path.join(DATA, 'supplier_master.csv')),
    plants: readCsv(path.join(DATA, 'plants.csv')),
    poHistory: readCsv(path.join(DATA, 'po_history.csv')),
    contracts: joinContracts(
      readCsv(path.join(DATA, 'contract_register.csv')),
      readCsv(path.join(DATA, 'contract_lines.csv')),
      pdfOnly
    ),
  });
}

export function runSample(master, policies = [policy]) {
  return processBatch(readCsv(path.join(DATA, 'sample_pr_batch.csv')), master, policies);
}