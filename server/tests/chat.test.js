import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMaster } from './helpers.js';
import { extractDraft, validateDraft, processChatMessage } from '../engine/chat.js';
import fs from 'node:fs';

const master = loadMaster();
const policy = JSON.parse(fs.readFileSync('policy/policy_v5.json', 'utf8'));

test('chat extracts slots from natural text', () => {
  const text = 'need 200 nitrile gloves for Chakan by next Friday';
  const draft = extractDraft(text, {}, master);
  assert.equal(draft.quantity, 200);
  assert.equal(draft.plant, 'CHK1');
  assert.ok(draft.need_by_date);
  assert.equal(draft.urgency, 'Normal');
});

test('chat detects emergency urgency and specific date', () => {
  const text = 'need 50 safety helmets for Bhosari urgently by 2026-11-25';
  const draft = extractDraft(text, {}, master);
  assert.equal(draft.quantity, 50);
  assert.equal(draft.plant, 'PUN1');
  assert.equal(draft.urgency, 'Emergency');
  assert.equal(draft.need_by_date, '2026-11-25');
});

test('chat asks for missing fields when incomplete', async () => {
  const res = await processChatMessage({
    message: 'need some bearings for Chakan',
    master,
    policies: [policy],
  });
  assert.equal(res.status, 'collecting');
  assert.ok(res.reply.includes('quantity'));
  assert.ok(res.reply.includes('need-by date'));
});

test('chat presents confirmation and creates evaluated PR', async () => {
  const draft = {
    item_code: 'ITM-1065',
    description: 'Nitrile gloves (pair)',
    quantity: 200,
    plant: 'CHK1',
    need_by_date: '2026-11-25',
    urgency: 'Normal',
  };

  const confirmRes = await processChatMessage({
    message: 'yes',
    draft,
    master,
    policies: [policy],
  });

  assert.equal(confirmRes.status, 'created');
  assert.ok(confirmRes.decision);
  assert.ok(confirmRes.decision.route);
  assert.ok(confirmRes.decision.group_value_inr > 0);
});
