import { readCsv } from '../engine/loadCsv.js';
import { buildIndex, matchItem } from '../engine/matchItem.js';

const items = readCsv('../data/item_master.csv');
const index = buildIndex(items);

const tests = [
  'brg 6205 2rs',
  'brg 6308 ZZ for maintenance',
  'pneu cylinder 50x100',
  'hyd hose 1/2 inch 2 wire',
  'monitor 24"',
  'Drinking water purifier 50 LPH',
  'quantum flux capacitor',
];

for (const t of tests) {
  const m = matchItem(t, index);
  console.log(t.padEnd(34), '->', m.status.padEnd(9), m.item ? m.item.item_code + ' ' + m.item.description : '(no item)', '| score', m.score.toFixed(2));
}