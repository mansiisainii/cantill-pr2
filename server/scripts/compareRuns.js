import { readCsv } from '../engine/loadCsv.js';

const [a, b] = [readCsv(process.argv[2]), readCsv(process.argv[3])];
const key = (r) => `${r.pr_no}/${r.pr_line}`;
const mapB = new Map(b.map((r) => [key(r), r]));

let changed = 0;
const shown = [];
for (const r of a) {
  const x = mapB.get(key(r));
  if (!x) continue;
  if (r.route !== x.route || r.supplier_id !== x.supplier_id) {
    changed++;
    if (shown.length < 6) shown.push(`${key(r)}  ${r.route} ${r.supplier_id}  ->  ${x.route} ${x.supplier_id}  (policy v${r.policy_version} -> v${x.policy_version})`);
  }
}
console.log(`lines: ${a.length} vs ${b.length} | changed route or supplier: ${changed}`);
shown.forEach((s) => console.log(' ', s));