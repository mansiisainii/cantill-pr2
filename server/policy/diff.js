import { describeRule, FIELDS, OPERATORS } from '../engine/rules.js';

export function validatePolicy(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['Policy is not an object'];
  if (!p.version) errs.push('version is missing');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effective_from || '')) errs.push('effective_from must be YYYY-MM-DD');
  if (!p.params) errs.push('params are missing');
  if (!Array.isArray(p.rules) || !p.rules.length) errs.push('rules are missing');

  const ids = new Set();
  for (const r of p.rules || []) {
    if (!r.id) errs.push('a rule has no id');
    else if (ids.has(r.id)) errs.push(`duplicate rule id ${r.id}`);
    ids.add(r.id);
    if (!r.then?.decision || !r.then?.route) errs.push(`rule ${r.id}: outcome needs a decision and a route`);
    for (const c of r.when || []) {
      if (!OPERATORS.includes(c.op)) errs.push(`rule ${r.id}: unknown operator "${c.op}"`);
      if (!FIELDS.includes(c.field)) errs.push(`rule ${r.id}: unknown field "${c.field}" (allowed: ${FIELDS.join(', ')})`);
    }
  }
  if (!p.default?.route) errs.push('default outcome is missing');
  return errs;
}

const flatten = (o, pre = '') =>
  Object.entries(o || {}).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, pre + k + '.') : [[pre + k, v]]
  );

export function diffPolicies(oldP, newP) {
  const changes = [];

  if (oldP.effective_from !== newP.effective_from) {
    changes.push({ type: 'date', text: `Effective date: ${oldP.effective_from} -> ${newP.effective_from}` });
  }

  const a = Object.fromEntries(flatten(oldP.params));
  const b = Object.fromEntries(flatten(newP.params));
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      changes.push({ type: 'param', text: `Setting "${k}": ${a[k] ?? '(none)'} -> ${b[k] ?? '(removed)'}` });
    }
  }

  const oldRules = new Map(oldP.rules.map((r) => [r.id, r]));
  const newRules = new Map(newP.rules.map((r) => [r.id, r]));
  for (const [id, r] of newRules) {
    if (!oldRules.has(id)) changes.push({ type: 'rule_added', text: `NEW RULE ${describeRule(r)}` });
    else if (JSON.stringify(oldRules.get(id)) !== JSON.stringify(r)) {
      changes.push({ type: 'rule_changed', text: `CHANGED ${describeRule(oldRules.get(id))}  =>  ${describeRule(r)}` });
    }
  }
  for (const [id, r] of oldRules) {
    if (!newRules.has(id)) changes.push({ type: 'rule_removed', text: `REMOVED ${describeRule(r)}` });
  }

  const oldOrder = oldP.rules.map((r) => r.id).filter((id) => newRules.has(id));
  const newOrder = newP.rules.map((r) => r.id).filter((id) => oldRules.has(id));
  if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) {
    changes.push({ type: 'order', text: `Rule order changed: ${oldOrder.join(' > ')}  =>  ${newOrder.join(' > ')}` });
  }
  if (JSON.stringify(oldP.default) !== JSON.stringify(newP.default)) {
    changes.push({ type: 'default', text: 'Default outcome changed' });
  }
  return changes;
}