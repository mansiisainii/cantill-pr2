import test from 'node:test';
import assert from 'node:assert/strict';
import { policy } from './helpers.js';
import { diffPolicies, validatePolicy } from '../policy/diff.js';

const amended = () => {
  const p = JSON.parse(JSON.stringify(policy));
  p.version = '5.1';
  p.effective_from = '2026-11-10';
  p.rules.find((r) => r.id === '5.4').when[0].value = 300000;
  p.rules.splice(3, 0, {
    id: 'X.1',
    text: 'Chakan electrical spares always RFQ',
    when: [
      { field: 'plant', op: 'eq', value: 'CHK1' },
      { field: 'category', op: 'eq', value: 'Electrical Spares' },
    ],
    then: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggest: 3 },
  });
  return p;
};

test('the shipped policy is valid', () => {
  assert.deepEqual(validatePolicy(policy), []);
});

test('an amended policy is valid and its diff is readable', () => {
  const p2 = amended();
  assert.deepEqual(validatePolicy(p2), []);
  const text = diffPolicies(policy, p2).map((c) => c.text).join('\n');
  assert.match(text, /NEW RULE X\.1/);
  assert.match(text, /CHANGED 5\.4/);
  assert.match(text, /Effective date: 2026-04-01 -> 2026-11-10/);
});

test('unknown fields and operators are rejected', () => {
  const bad = JSON.parse(JSON.stringify(policy));
  bad.rules[0].when[0].field = 'colour';
  bad.rules[1].when[0].op = 'resembles';
  assert.equal(validatePolicy(bad).length, 2);
});

test('duplicate rule ids and bad dates are rejected', () => {
  const bad = JSON.parse(JSON.stringify(policy));
  bad.rules[1].id = bad.rules[0].id;
  bad.effective_from = '1 Dec 2026';
  assert.equal(validatePolicy(bad).length, 2);
});

test('no change gives an empty diff', () => {
  assert.deepEqual(diffPolicies(policy, JSON.parse(JSON.stringify(policy))), []);
});