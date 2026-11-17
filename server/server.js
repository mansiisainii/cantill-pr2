import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { memoryStore, mongoStore } from './store.js';
import { parseCsvText, joinContracts } from './engine/loadCsv.js';
import { buildMaster, processBatch, toCsv } from './engine/index.js';
import { createRequire } from 'node:module';
import { parseContractText } from './engine/contracts.js';
import { preferredList } from './engine/suppliers.js';
import { preferredExport } from './engine/preferredExport.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = process.env.MONGODB_URI ? await mongoStore(process.env.MONGODB_URI) : memoryStore();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.text({ type: 'text/csv', limit: '20mb' }));

const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message });
  });
const audit = (action, user, details) =>
  store.insert('audit', { at: new Date().toISOString(), action, user: user || 'buyer', details });

const seedPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, 'policy/policy_v5.json'), 'utf8'));
if (!(await store.count('policies'))) {
  await store.insert('policies', { ...seedPolicy, status: 'active', approved_by: 'system', approved_at: new Date().toISOString() });
}

let cache = null;
const invalidate = () => {
  cache = null;
};

async function getMaster() {
  if (cache) return cache;
  const names = ['items', 'suppliers', 'plants', 'poHistory', 'contracts'];
  const [items, suppliers, plants, poHistory, contracts] = await Promise.all(names.map((n) => store.all(n)));
  if (!items.length) throw fail(400, 'No master data yet. Import the master data files first.');
  cache = buildMaster({ items, suppliers, plants, poHistory, contracts });
  return cache;
}

async function getPolicies() {
  const all = await store.all('policies');
  return all.filter((p) => p.status === 'active').sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

const fileText = (f) => f.buffer.toString('utf8');

app.get(
  '/api/status',
  wrap(async (req, res) => {
    const counts = {};
    for (const n of ['items', 'suppliers', 'plants', 'poHistory', 'contracts', 'policies', 'batches', 'audit']) {
      counts[n] = await store.count(n);
    }
    res.json({ storage: store.kind, counts });
  })
);

const importFields = ['item_master', 'supplier_master', 'plants', 'po_history', 'contract_register', 'contract_lines'].map((name) => ({
  name,
  maxCount: 1,
}));

app.post(
  '/api/admin/import',
  upload.fields(importFields),
  wrap(async (req, res) => {
    const f = req.files || {};
    const done = [];

    if (f.item_master) {
      const rows = parseCsvText(fileText(f.item_master[0])).map((r) => ({ ...r, standard_price: Number(r.standard_price) }));
      await store.replace('items', rows);
      done.push('items');
    }
    if (f.supplier_master) {
      const rows = parseCsvText(fileText(f.supplier_master[0])).map((r) => ({
        ...r,
        on_time_pct: Number(r.on_time_pct),
        quality_rating: Number(r.quality_rating),
      }));
      await store.replace('suppliers', rows);
      done.push('suppliers');
    }
    if (f.plants) {
      await store.replace('plants', parseCsvText(fileText(f.plants[0])));
      done.push('plants');
    }
    if (f.po_history) {
      const rows = parseCsvText(fileText(f.po_history[0])).map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        unit_price: Number(r.unit_price),
      }));
      await store.replace('poHistory', rows);
      done.push('poHistory');
    }
    if (f.contract_register || f.contract_lines) {
      if (!(f.contract_register && f.contract_lines)) throw fail(400, 'Upload contract_register.csv and contract_lines.csv together.');
      const kept = (await store.all('contracts')).filter((c) => c.source === 'pdf' || c.source === 'manual');
      const joined = joinContracts(parseCsvText(fileText(f.contract_register[0])), parseCsvText(fileText(f.contract_lines[0])), kept);
      await store.replace('contracts', joined);
      done.push('contracts');
    }

    invalidate();
    await audit('import', req.body?.user, { done });
    res.json({ imported: done });
  })
);

function readPrCsv(req) {
  const text = req.file ? fileText(req.file) : typeof req.body === 'string' ? req.body : req.body?.csv;
  if (!text) throw fail(400, 'Send the PR batch as a CSV file (field "file") or as a text/csv body.');
  return parseCsvText(text);
}

app.post(
  '/api/process-batch',
  upload.single('file'),
  wrap(async (req, res) => {
    const prLines = readPrCsv(req);
    const master = await getMaster();
    const policies = await getPolicies();
    const out = processBatch(prLines, master, policies, { policyMode: req.query.policyMode });
    const versions = [...new Set(out.requirements.map((r) => r.policy_version))];

    const batch = await store.insert('batches', {
      created_at: new Date().toISOString(),
      label: req.file?.originalname || 'api batch',
      policy_versions: versions,
      rows: out.rows,
      requirements: out.requirements.map((r) => ({ ...r, status: 'pending' })),
      pos: out.pos,
    });

    if (req.query.format === 'csv') {
      res.type('text/csv').send(toCsv(out.rows));
      return;
    }
    res.json({
      batch_id: batch.id,
      policy_versions: versions,
      decisions: out.rows,
      summary: { lines: out.rows.length, requirements: out.requirements.length, pos: out.pos.length },
    });
  })
);

app.get(
  '/api/batches',
  wrap(async (req, res) => {
    const all = await store.all('batches');
    const list = all
      .map(({ rows, requirements, pos, ...b }) => ({ ...b, lines: rows.length, requirements: requirements.length, pos: pos.length }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(list);
  })
);

app.get(
  '/api/batches/:id',
  wrap(async (req, res) => {
    const b = await store.get('batches', req.params.id);
    if (!b) throw fail(404, 'Batch not found');
    res.json(b);
  })
);

app.get(
  '/api/batches/:id/export.csv',
  wrap(async (req, res) => {
    const b = await store.get('batches', req.params.id);
    if (!b) throw fail(404, 'Batch not found');
    res.type('text/csv').attachment(`decisions_${b.id.slice(0, 8)}.csv`).send(toCsv(b.rows));
  })
);

const policyAsOf = (policies, date) => policies.filter((p) => p.effective_from <= date).pop() || policies[0];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

app.get(
  '/api/contracts',
  wrap(async (req, res) => {
    res.json(await store.all('contracts'));
  })
);

app.post(
  '/api/contracts/extract',
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw fail(400, 'Upload the signed contract PDF (field "file").');
    const pdf = require('pdf-parse/lib/pdf-parse.js');
    const data = await pdf(req.file.buffer);
    res.json(parseContractText(data.text));
  })
);

app.post(
  '/api/contracts',
  wrap(async (req, res) => {
    const c = req.body;
    if (!c.contract_id || !c.supplier_id || !c.value_cap || !Array.isArray(c.lines) || !c.lines.length) {
      throw fail(400, 'A contract needs a number, supplier, ceiling and at least one item line.');
    }
    if (!isDate(c.start_date) || !isDate(c.end_date) || c.start_date > c.end_date) {
      throw fail(400, 'Start and end dates must be YYYY-MM-DD, and the start must not be after the end.');
    }
    const [contracts, items, suppliers] = await Promise.all([store.all('contracts'), store.all('items'), store.all('suppliers')]);
    if (contracts.some((x) => x.contract_id === c.contract_id)) throw fail(400, `${c.contract_id} already exists.`);
    if (suppliers.length && !suppliers.some((s) => s.supplier_id === c.supplier_id)) throw fail(400, `Unknown supplier ${c.supplier_id}.`);
    const known = new Set(items.map((i) => i.item_code));
    const unknown = c.lines.filter((l) => items.length && !known.has(l.item_code)).map((l) => l.item_code);
    if (unknown.length) throw fail(400, `Unknown item code(s): ${unknown.join(', ')}`);

    const saved = await store.insert('contracts', {
      contract_id: c.contract_id,
      supplier_id: c.supplier_id,
      start_date: c.start_date,
      end_date: c.end_date,
      value_cap: Number(c.value_cap),
      consumed_value: Number(c.consumed_value || 0),
      source: c.source === 'pdf' ? 'pdf' : 'manual',
      lines: c.lines.map((l) => ({ item_code: l.item_code, rate: Number(l.rate) })),
    });
    invalidate();
    await audit('contract_added', c.user, { contract_id: c.contract_id, source: saved.source });
    res.json(saved);
  })
);

const ROUTES = ['CONTRACT_PO', 'EMERGENCY_PO', 'SPOT_PO', 'RFQ', 'RFP', 'CAPEX_SOURCING', 'NEW_ITEM_SOURCING'];
const PO_ROUTES = ['CONTRACT_PO', 'EMERGENCY_PO', 'SPOT_PO'];

async function loadRequirement(batchId, group) {
  const batch = await store.get('batches', batchId);
  if (!batch) throw fail(404, 'Batch not found');
  const req = batch.requirements.find((x) => x.group_id === group);
  if (!req) throw fail(404, 'Requirement not found');
  return { batch, req };
}

app.post(
  '/api/batches/:id/requirements/:group/approve',
  wrap(async (req, res) => {
    const { batch, req: r } = await loadRequirement(req.params.id, req.params.group);
    if (r.status !== 'pending') throw fail(400, `This requirement is already ${r.status}.`);
    r.status = 'approved';
    r.approved_by = req.body?.user || 'buyer';
    r.approved_at = new Date().toISOString();
    r.document =
      r.decision === 'PO'
        ? { type: 'PO', number: r.po_id }
        : { type: r.route, number: `${r.route}-${batch.id.slice(0, 6)}-${r.group_id}` };
    await store.update('batches', batch.id, { requirements: batch.requirements });
    await audit('approve', r.approved_by, { batch: batch.id, group: r.group_id, document: r.document });
    res.json(r);
  })
);

app.post(
  '/api/batches/:id/requirements/:group/override',
  wrap(async (req, res) => {
    const { comment, user, route, supplier_id } = req.body || {};
    if (!comment || comment.trim().length < 5) throw fail(400, 'An override needs a written reason (at least a few words).');
    if (route && !ROUTES.includes(route)) throw fail(400, `Unknown route ${route}.`);
    const { batch, req: r } = await loadRequirement(req.params.id, req.params.group);
    if (r.status !== 'pending') throw fail(400, `This requirement is already ${r.status}.`);

    const newRoute = route || r.route;
    const newSupplier = supplier_id !== undefined ? supplier_id : r.supplier_id;
    if (PO_ROUTES.includes(newRoute) && !newSupplier) throw fail(400, 'A PO override needs a supplier id.');
    if (newSupplier) {
      const suppliers = await store.all('suppliers');
      const s = suppliers.find((x) => x.supplier_id === newSupplier);
      if (!s) throw fail(400, `Unknown supplier ${newSupplier}.`);
      if (s.status !== 'Active') throw fail(400, `Supplier ${newSupplier} is ${s.status} and cannot receive a PO.`);
    }

    r.original_decision = { decision: r.decision, route: r.route, supplier_id: r.supplier_id, rule_id: r.rule_id };
    r.route = newRoute;
    r.decision = PO_ROUTES.includes(newRoute) ? 'PO' : 'SOURCING_REQUEST';
    r.supplier_id = PO_ROUTES.includes(newRoute) ? newSupplier : '';
    r.status = 'overridden';
    r.override = { comment: comment.trim(), by: user || 'buyer', at: new Date().toISOString() };
    await store.update('batches', batch.id, { requirements: batch.requirements });
    await audit('override', r.override.by, { batch: batch.id, group: r.group_id, comment: r.override.comment, original: r.original_decision, now: { route: r.route, supplier_id: r.supplier_id } });
    res.json(r);
  })
);

app.get(
  '/api/preferred',
  wrap(async (req, res) => {
    const master = await getMaster();
    const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);
    const policy = policyAsOf(await getPolicies(), asOf);
    if (req.query.item) {
      const item = master.itemMap.get(req.query.item);
      if (!item) throw fail(404, `Unknown item ${req.query.item}`);
      res.json({ as_of: asOf, policy_version: policy.version, item, list: preferredList(item.item_code, asOf, master, policy.params) });
      return;
    }
    const items = master.items.map((i) => ({
      ...i,
      top: preferredList(i.item_code, asOf, master, policy.params).slice(0, 3).map((r) => r.supplier_id),
    }));
    res.json({ as_of: asOf, policy_version: policy.version, items });
  })
);

app.get(
  '/api/preferred/export.csv',
  wrap(async (req, res) => {
    const asOf = req.query.asOf;
    if (!isDate(asOf)) throw fail(400, 'asOf=YYYY-MM-DD is required.');
    const master = await getMaster();
    const policy = policyAsOf(await getPolicies(), asOf);
    const rows = preferredExport(master, asOf, policy.params);
    res.type('text/csv').attachment(`preferred_${asOf}.csv`).send(toCsv(rows, ['item_code', 'rank', 'supplier_id', 'reference_price']));
  })
);

app.get(
  '/api/audit',
  wrap(async (req, res) => {
    const all = await store.all('audit');
    res.json(all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300));
  })
);
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on :${port} (storage: ${store.kind})`));