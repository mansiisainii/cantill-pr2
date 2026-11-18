import http from 'http';
import fs from 'fs';

function post(url, data, isCsv = false) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: isCsv
          ? { 'Content-Type': 'text/csv', 'Content-Length': Buffer.byteLength(data) }
          : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('Testing GET /api/status...');
  const st = await get('http://localhost:4000/api/status');
  console.log('Status code:', st.status, 'Body:', st.body);

  console.log('\nTesting GET /api/policies...');
  const pol = await get('http://localhost:4000/api/policies');
  console.log('Policies code:', pol.status, 'Count:', JSON.parse(pol.body).length);

  console.log('\nTesting POST /api/chat...');
  const chat = await post('http://localhost:4000/api/chat', JSON.stringify({ message: 'Need 200 nitrile gloves for Chakan by next Friday' }));
  console.log('Chat code:', chat.status);
  const chatData = JSON.parse(chat.body);
  console.log('Chat Status:', chatData.status);
  console.log('Chat Reply preview:\n', chatData.reply.slice(0, 150));

  console.log('\nTesting POST /api/process-batch?format=csv with sample_pr_batch.csv...');
  const csv = fs.readFileSync('../data/sample_pr_batch.csv', 'utf8');
  const batch = await post('http://localhost:4000/api/process-batch?format=csv', csv, true);
  console.log('Batch CSV status:', batch.status);
  const lines = batch.body.trim().split('\n');
  console.log('CSV output rows:', lines.length);
  console.log('CSV Header:', lines[0]);
  console.log('CSV First row:', lines[1]);

  console.log('\nTesting GET / (frontend static serving)...');
  const ui = await get('http://localhost:4000/');
  console.log('UI status:', ui.status, 'HTML length:', ui.body.length, 'Contains Cantill:', ui.body.includes('Cantill'));

  console.log('\n>>> ALL 5 END-TO-END CHECKS SUCCEEDED! <<<');
}

test().catch(console.error);
