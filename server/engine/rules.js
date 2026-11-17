const OPS = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  in: (a, b) => Array.isArray(b) && b.includes(a),
  not_in: (a, b) => Array.isArray(b) && !b.includes(a),
  contains: (a, b) => String(a ?? '').toLowerCase().includes(String(b).toLowerCase()),
};

export const FIELDS = [
  'is_new_item',
  'item_code',
  'item_type',
  'category',
  'plant',
  'value',
  'urgency',
  'contract_usable',
  'bought_recently',
  'uom',
];

export const OPERATORS = Object.keys(OPS);

export function conditionHolds(cond, ctx) {
  const fn = OPS[cond.op];
  if (!fn) throw new Error(`Unknown operator "${cond.op}"`);
  return fn(ctx[cond.field], cond.value);
}

export function evaluateRules(policy, ctx) {
  for (const rule of policy.rules) {
    if ((rule.when || []).every((c) => conditionHolds(c, ctx))) return { rule, outcome: rule.then };
  }
  return { rule: { id: 'default', text: 'No rule matched: default outcome' }, outcome: policy.default };
}

export function describeCondition(c) {
  const words = {
    eq: 'is',
    ne: 'is not',
    lt: 'is below',
    lte: 'is at most',
    gt: 'is above',
    gte: 'is at least',
    in: 'is one of',
    not_in: 'is not one of',
    contains: 'contains',
  };
  const v = Array.isArray(c.value) ? c.value.join(', ') : c.value;
  return `${c.field.replace(/_/g, ' ')} ${words[c.op] || c.op} ${v}`;
}

export function describeRule(r) {
  const w = (r.when || []).map(describeCondition).join(' AND ') || 'always';
  const t = r.then || {};
  return `${r.id}: IF ${w} THEN ${t.decision}/${t.route}${t.supplier ? ' (supplier: ' + t.supplier + ')' : ''}${t.suggest ? ' suggest ' + t.suggest : ''}`;
}