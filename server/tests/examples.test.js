import test from 'node:test';
import assert from 'node:assert/strict';
import { hasData, policy, loadMaster, runSample } from './helpers.js';
import { preferredList } from '../engine/suppliers.js';
import { matchItem } from '../engine/matchItem.js';
import { toCsv } from '../engine/index.js';

const opt = { skip: !hasData && 'data folder missing' };
const master = hasData ? loadMaster() : null;
const out = hasData ? runSample(master) : null;
const row = (pr) => out.rows.find((r) => r.pr_no === pr);
const value = (pr) => Math.round(row(pr).group_value_inr);

test('1 contract PO', opt, () => {
  const r = row('PR-26-00019');
  assert.equal(r.route, 'CONTRACT_PO');
  assert.equal(r.supplier_id, 'S001');
  assert.equal(value('PR-26-00019'), 137531);
});

test('2 contract that exists only as a PDF', opt, () => {
  const r = row('PR-26-00045');
  assert.equal(r.route, 'CONTRACT_PO');
  assert.equal(r.supplier_id, 'S021');
  assert.equal(value('PR-26-00045'), 26829);
});

test('3 contract ceiling used up goes to RFQ', opt, () => {
  const r = row('PR-26-00004');
  assert.equal(r.route, 'RFQ');
  assert.equal(value('PR-26-00004'), 220256);
  assert.equal(r.group_id, row('PR-26-00026').group_id);
  assert.equal(r.suggested_supplier_ids, 'S014;S013;S016');
});

test('4 two contracts: the cheaper one has no ceiling', opt, () => {
  const r = row('PR-26-00034');
  assert.equal(r.supplier_id, 'S007');
  assert.equal(value('PR-26-00034'), 32547);
});

test('5 split PRs are clubbed into one requirement', opt, () => {
  const a = row('PR-26-00146');
  assert.equal(a.group_id, row('PR-26-00144').group_id);
  assert.equal(a.group_id, row('PR-26-00145').group_id);
  assert.equal(a.route, 'SPOT_PO');
  assert.equal(a.supplier_id, 'S024');
  assert.equal(value('PR-26-00146'), 126472);
});

test('6 same item in different plants is not clubbed', opt, () => {
  assert.notEqual(row('PR-26-00106').group_id, row('PR-26-00103').group_id);
  assert.equal(row('PR-26-00106').supplier_id, 'S027');
  assert.equal(value('PR-26-00106'), 156170);
});

test('7 free text item is matched', opt, () => {
  const r = row('PR-26-00088');
  assert.equal(r.resolved_item_code, 'ITM-1035');
  assert.equal(r.route, 'SPOT_PO');
  assert.equal(r.supplier_id, 'S023');
  assert.equal(value('PR-26-00088'), 97955);
});

test('8 emergency PO', opt, () => {
  const r = row('PR-26-00059');
  assert.equal(r.route, 'EMERGENCY_PO');
  assert.equal(r.supplier_id, 'S014');
  assert.equal(value('PR-26-00059'), 253184);
});

test('9 RFQ above the PO limit', opt, () => {
  assert.equal(row('PR-26-00089').route, 'RFQ');
  assert.equal(row('PR-26-00089').suggested_supplier_ids, 'S043;S044;S042');
});

test('10 small value but never bought goes to RFQ', opt, () => {
  assert.equal(row('PR-26-00050').route, 'RFQ');
  assert.equal(row('PR-26-00050').suggested_supplier_ids, 'S003;S002;S005');
  assert.equal(value('PR-26-00050'), 80300);
});

test('11 RFP', opt, () => {
  assert.equal(row('PR-26-00100').route, 'RFP');
  assert.equal(row('PR-26-00100').suggested_supplier_ids, 'S020;S017;S019;S018');
  assert.equal(value('PR-26-00100'), 2070780);
});

test('12 capex', opt, () => {
  assert.equal(row('PR-26-00047').route, 'CAPEX_SOURCING');
  assert.equal(row('PR-26-00047').suggested_supplier_ids, 'S045;S047;S020;S048;S046');
});

test('13 new item', opt, () => {
  const r = row('PR-26-00170');
  assert.equal(r.route, 'NEW_ITEM_SOURCING');
  assert.equal(r.resolved_item_code, 'NEW');
  assert.equal(r.suggested_supplier_ids, '');
  assert.equal(value('PR-26-00170'), 141100);
});

test('14 several requirements on one PO', opt, () => {
  const a = row('PR-26-00034');
  const b = row('PR-26-00031');
  assert.equal(a.po_id, b.po_id);
  assert.notEqual(a.group_id, b.group_id);
  assert.equal(value('PR-26-00031'), 23227);
});

test('preferred lists match the three sample rankings', opt, () => {
  const ids = (code) => preferredList(code, '2026-11-01', master, policy.params).map((r) => r.supplier_id);
  assert.deepEqual(ids('ITM-1048'), ['S029', 'S030']);
  assert.deepEqual(ids('ITM-1036'), ['S023', 'S022', 'S024']);
  assert.deepEqual(ids('ITM-1016'), ['S009', 'S010']);
});

test('Blocked and Inactive suppliers never get a PO or a suggestion', opt, () => {
  const bad = new Set(master.suppliers.filter((s) => s.status !== 'Active').map((s) => s.supplier_id));
  for (const r of out.rows) {
    assert.ok(!bad.has(r.supplier_id));
    for (const s of r.suggested_supplier_ids.split(';').filter(Boolean)) assert.ok(!bad.has(s));
  }
});

test('bad lines are NOT_PROCESSED and never dropped', opt, () => {
  assert.equal(row('PR-26-00172').route, 'NOT_PROCESSED');
  assert.equal(row('PR-26-00173').route, 'NOT_PROCESSED');
  assert.equal(out.rows.length, 186);
});

test('item matcher does not invent items', opt, () => {
  assert.equal(matchItem('quantum flux capacitor 9000', master.itemIndex).status, 'NONE');
});

test('same input gives the same CSV every time', opt, () => {
  assert.equal(toCsv(runSample(master).rows), toCsv(out.rows));
});