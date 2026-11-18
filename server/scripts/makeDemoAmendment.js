import fs from 'node:fs';

const base = JSON.parse(fs.readFileSync('policy/policy_v5.json', 'utf8'));
const p = JSON.parse(JSON.stringify(base));

p.version = '5.1';
p.title = 'Corvo Procurement Policy v5.1 (demo amendment)';
p.effective_from = '2026-11-01';
p.rules.find((r) => r.id === '5.4').when[0].value = 300000;
p.rules.find((r) => r.id === '5.4').text = 'Value below 3,00,000 and bought from an Active supplier in last 365 days';
p.rules.splice(3, 0, {
  id: 'X.1',
  text: 'Chakan plant: Electrical Spares always go to RFQ',
  when: [
    { field: 'plant', op: 'eq', value: 'CHK1' },
    { field: 'category', op: 'eq', value: 'Electrical Spares' },
  ],
  then: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
});

fs.writeFileSync('policy/demo_v5_1.json', JSON.stringify({ policy: p, approved_by: 'Head of Procurement' }, null, 2));
console.log('written policy/demo_v5_1.json');