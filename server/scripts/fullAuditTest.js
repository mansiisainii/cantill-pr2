import http from 'http';
import fs from 'fs';
import path from 'path';

function request({ method = 'GET', path, body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers: { ...headers },
    };
    if (body && typeof body === 'string') {
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runFullVerification() {
  console.log('=====================================================');
  console.log('   CANTILL PR-TO-PO END-TO-END VERIFICATION SUITE    ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, label, details = '') {
    if (condition) {
      console.log(`  [PASS] ${label} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${label} - ${details}`);
      failed++;
    }
  }

  // 1. Static UI & Assets
  console.log('1. Checking Frontend UI Delivery:');
  const uiRes = await request({ path: '/' });
  assert(uiRes.status === 200, 'GET / returns 200 OK', `length: ${uiRes.body.length}`);
  assert(uiRes.body.includes('Cantill') && uiRes.body.includes('<div id="root"></div>'), 'HTML contains Cantill root container');

  // Check CSS asset
  const cssMatch = uiRes.body.match(/href="(\/assets\/[^"]+\.css)"/);
  if (cssMatch) {
    const cssRes = await request({ path: cssMatch[1] });
    assert(cssRes.status === 200, `CSS bundle loads (${cssMatch[1]})`, `length: ${cssRes.body.length}`);
  }
  // Check JS asset
  const jsMatch = uiRes.body.match(/src="(\/assets\/[^"]+\.js)"/);
  if (jsMatch) {
    const jsRes = await request({ path: jsMatch[1] });
    assert(jsRes.status === 200, `JS bundle loads (${jsMatch[1]})`, `length: ${jsRes.body.length}`);
  }

  // 2. Health & System Status
  console.log('\n2. Checking System Status & Master Data Auto-seed:');
  const statusRes = await request({ path: '/api/status' });
  assert(statusRes.status === 200, 'GET /api/status returns 200 OK');
  const statusData = JSON.parse(statusRes.body);
  assert(statusData.counts?.items === 73, 'Master items auto-seeded (73 items)', `count: ${statusData.counts?.items}`);
  assert(statusData.counts?.suppliers === 48, 'Suppliers auto-seeded (48 suppliers)', `count: ${statusData.counts?.suppliers}`);
  assert(statusData.counts?.contracts >= 12, 'Contracts auto-seeded (includes PDF-only)', `count: ${statusData.counts?.contracts}`);

  // 3. Active Policy
  console.log('\n3. Checking Policy Engine Governance:');
  const policyRes = await request({ path: '/api/policies' });
  assert(policyRes.status === 200, 'GET /api/policies returns 200 OK');
  const policies = JSON.parse(policyRes.body);
  const activePol = policies.find((p) => p.status === 'active');
  assert(activePol && activePol.version === '5.0', 'Policy v5.0 is Active', `rules count: ${activePol?.rules?.length}`);

  // 4. Batch Processing (Sample 186-line PR Batch)
  console.log('\n4. Checking Batch Processing Engine (sample_pr_batch.csv):');
  const csvData = fs.readFileSync(path.resolve('..', 'data/sample_pr_batch.csv'), 'utf8');
  const batchRes = await request({
    method: 'POST',
    path: '/api/process-batch?format=csv',
    body: csvData,
    headers: { 'Content-Type': 'text/csv' },
  });
  assert(batchRes.status === 200, 'POST /api/process-batch?format=csv returns 200 OK');
  const rows = batchRes.body.trim().split('\n');
  assert(rows.length === 187, 'Batch output has exactly 186 decision rows + 1 header', `rows: ${rows.length}`);
  const header = rows[0];
  assert(
    header === 'pr_no,pr_line,resolved_item_code,group_id,po_id,decision,route,supplier_id,unit_price,group_value_inr,suggested_supplier_ids,policy_version,reason',
    'CSV columns match Task Brief Section 4 schema exactly'
  );

  // 5. Chat Intake Conversation
  console.log('\n5. Checking Natural Language Chat Intake:');
  // 5a. Missing fields follow up
  const chat1 = await request({
    method: 'POST',
    path: '/api/chat',
    body: JSON.stringify({ message: 'Need some bearings for Chakan' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const chat1Data = JSON.parse(chat1.body);
  assert(chat1Data.status === 'collecting', 'Chat asks for missing fields on incomplete request');

  // 5b. Complete slot-filled message
  const chat2 = await request({
    method: 'POST',
    path: '/api/chat',
    body: JSON.stringify({ message: 'Need 200 nitrile gloves for Chakan by next Friday' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const chat2Data = JSON.parse(chat2.body);
  assert(chat2Data.status === 'confirm', 'Chat successfully extracts all slots and requests confirmation', `Item: ${chat2Data.draft?.item_code}, Qty: ${chat2Data.draft?.quantity}`);

  // 5c. User confirms -> creates evaluated PR
  const chat3 = await request({
    method: 'POST',
    path: '/api/chat',
    body: JSON.stringify({ message: 'Yes, confirm and create PR', draft: chat2Data.draft }),
    headers: { 'Content-Type': 'application/json' },
  });
  const chat3Data = JSON.parse(chat3.body);
  assert(chat3Data.status === 'created', 'Chat creates and evaluates PR', `PR: ${chat3Data.decision?.pr_no}, Route: ${chat3Data.decision?.route}, Val: ₹${chat3Data.decision?.group_value_inr}`);

  // 6. Buyer Workspace (Batches, Approvals, Overrides)
  console.log('\n6. Checking Buyer Workspace Actions:');
  const batchesRes = await request({ path: '/api/batches' });
  const batches = JSON.parse(batchesRes.body);
  assert(batches.length > 0, `Batches listed (${batches.length} batches available)`);
  const testBatch = batches[0];
  const bDetailRes = await request({ path: `/api/batches/${testBatch.id}` });
  const bDetail = JSON.parse(bDetailRes.body);
  assert(bDetail.requirements && bDetail.requirements.length > 0, `Batch has ${bDetail.requirements?.length} requirements`);

  if (bDetail.requirements.length > 0) {
    const targetReq = bDetail.requirements[0];
    if (targetReq.status === 'pending') {
      // Test Approve
      const appRes = await request({
        method: 'POST',
        path: `/api/batches/${testBatch.id}/requirements/${targetReq.group_id}/approve`,
        body: JSON.stringify({ user: 'Audit Tester' }),
        headers: { 'Content-Type': 'application/json' },
      });
      assert(appRes.status === 200, `Approve requirement ${targetReq.group_id} returns 200 OK`);
    } else {
      console.log(`  [INFO] First requirement already ${targetReq.status}`);
    }
  }

  // 7. Preferred Suppliers & Export
  console.log('\n7. Checking Preferred Suppliers & Export:');
  const prefRes = await request({ path: '/api/preferred?item=ITM-1022&asOf=2026-11-01' });
  assert(prefRes.status === 200, 'GET /api/preferred for ITM-1022 returns 200 OK');
  const prefData = JSON.parse(prefRes.body);
  assert(prefData.list && prefData.list.length > 0, `Preferred rankings computed (${prefData.list?.length} ranked suppliers)`);

  const expRes = await request({ path: '/api/preferred/export.csv?asOf=2026-11-01' });
  assert(expRes.status === 200, 'GET /api/preferred/export.csv returns 200 OK');
  const expLines = expRes.body.trim().split('\n');
  assert(expLines[0] === 'item_code,rank,supplier_id,reference_price', 'Preferred CSV header matches required schema');
  assert(expLines.length > 10, `Exported top suppliers lines: ${expLines.length}`);

  // 8. Contracts Register
  console.log('\n8. Checking Contracts Register:');
  const contractsRes = await request({ path: '/api/contracts' });
  assert(contractsRes.status === 200, 'GET /api/contracts returns 200 OK');
  const contractList = JSON.parse(contractsRes.body);
  assert(contractList.some((c) => c.source === 'pdf'), 'Includes signed PDF contracts (e.g. RC-2026-031/033)');

  // 9. Compliance Audit Trail
  console.log('\n9. Checking Compliance Audit Trail:');
  const auditRes = await request({ path: '/api/audit' });
  assert(auditRes.status === 200, 'GET /api/audit returns 200 OK');
  const auditList = JSON.parse(auditRes.body);
  assert(auditList.length > 0, `Audit events tracked (${auditList.length} total logged events)`);

  console.log('\n=====================================================');
  console.log(`   SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=====================================================');

  if (failed > 0) process.exit(1);
}

runFullVerification().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
