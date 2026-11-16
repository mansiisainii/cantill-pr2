import { readCsv, joinContracts } from '../engine/loadCsv.js';
import { buildMaster } from '../engine/master.js';
import { prepareLines } from '../engine/prepare.js';
import { clubLines } from '../engine/club.js';

const d = '../data/';
const master = buildMaster({
  items: readCsv(d + 'item_master.csv'),
  suppliers: readCsv(d + 'supplier_master.csv'),
  plants: readCsv(d + 'plants.csv'),
  poHistory: readCsv(d + 'po_history.csv'),
  contracts: joinContracts(readCsv(d + 'contract_register.csv'), readCsv(d + 'contract_lines.csv')),
});

const prs = readCsv(d + 'sample_pr_batch.csv');
const { valid, rejected } = prepareLines(prs, master);
const params = { club_days: 14, club_needby_days: 7 };
const reqs = clubLines(valid, () => params);

console.log('PR lines:', prs.length, '| rejected:', rejected.length, '| valid:', valid.length, '| requirements:', reqs.length);
for (const r of rejected) console.log('REJECTED', r.line.pr_no, '->', r.reason);

const show = (title, prNos) => {
  console.log('\n' + title);
  for (const r of reqs) {
    const hit = r.lines.filter((l) => prNos.includes(l.pr_no));
    if (hit.length) console.log(' ', r.id, r.item?.item_code ?? 'NEW', r.plant, 'qty', r.qty, '<-', r.lines.map((l) => l.pr_no).join(', '));
  }
};

show('Example 5 (3 PRs ek requirement):', ['PR-26-00146', 'PR-26-00144', 'PR-26-00145']);
show('Example 6 (alag plant, alag requirement):', ['PR-26-00106', 'PR-26-00103']);
show('Example 14 (do requirements):', ['PR-26-00034', 'PR-26-00032', 'PR-26-00031', 'PR-26-00035']);
show('Example 3 (free-text + code wali line club):', ['PR-26-00004', 'PR-26-00026']);