import test from 'node:test';
import assert from 'node:assert/strict';
import { policy } from './helpers.js';
import { evaluateRules, describeRule } from '../engine/rules.js';

const ctx = {
  is_new_item: false,
  item_type: 'Material',
  category: 'Electrical Spares',
  plant: 'CHK1',
  value: 50000,
  urgency: 'Normal',
  contract_usable: false,
  bought_recently: true,
};

test('first rule that fits decides', () => {
  assert.equal(evaluateRules(policy, { ...ctx, item_type: 'Capex', contract_usable: true }).rule.id, '5.1');
  assert.equal(evaluateRules(policy, { ...ctx, contract_usable: true, value: 9000000 }).rule.id, '5.2');
});

test('emergency above 5 lakh falls through to the normal limits', () => {
  const r = evaluateRules(policy, { ...ctx, urgency: 'Emergency', value: 600000 });
  assert.equal(r.outcome.route, 'RFQ');
});

test('amendment: a changed limit and a new Chakan-only rule need no code change', () => {
  const p2 = JSON.parse(JSON.stringify(policy));
  p2.rules.find((r) => r.id === '5.4').when[0].value = 300000;
  p2.rules.splice(3, 0, {
    id: 'X.1',
    text: 'Chakan electrical spares always RFQ',
    when: [
      { field: 'plant', op: 'eq', value: 'CHK1' },
      { field: 'category', op: 'eq', value: 'Electrical Spares' },
    ],
    then: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
  });
  assert.equal(evaluateRules(policy, ctx).outcome.route, 'SPOT_PO');
  assert.equal(evaluateRules(p2, ctx).outcome.route, 'RFQ');
  assert.equal(evaluateRules(p2, { ...ctx, plant: 'PUN1', value: 250000 }).outcome.route, 'SPOT_PO');
  assert.match(describeRule(p2.rules[3]), /plant is CHK1 AND category is Electrical Spares/);
});

test('an unknown operator is an error, not a silent pass', () => {
  const bad = JSON.parse(JSON.stringify(policy));
  bad.rules[0].when[0].op = 'resembles';
  assert.throws(() => evaluateRules(bad, ctx));
});