const assert = require('assert');
const { app } = require('../src/server');
const db = require('../src/database/db');
const authService = require('../src/services/authService');
const http = require('http');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING TEST: Authentication & RBAC ---');
  await db.init();

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  try {
    // 1. Valid Owner Login
    const ownerRes = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    assert.strictEqual(ownerRes.status, 200);
    assert.strictEqual(ownerRes.body.success, true);
    assert.strictEqual(ownerRes.body.user.role, 'OWNER');
    const ownerToken = ownerRes.body.token;

    // 2. Valid Client Login
    const clientRes = await request('POST', '/api/auth/login', {
      email: 'client1@glowbeauty.com',
      password: 'password123'
    });
    assert.strictEqual(clientRes.status, 200);
    assert.strictEqual(clientRes.body.user.role, 'CLIENT');
    assert.ok(clientRes.body.user.clientId > 0);
    const clientToken = clientRes.body.token;

    // 3. Invalid Login
    const invalidRes = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'wrongpassword'
    });
    assert.strictEqual(invalidRes.status, 400);

    // 4. RBAC: Client attempting to access internal financial summary -> Must be 403
    const financeBlocked = await request('GET', '/api/finance/summary', null, clientToken);
    assert.strictEqual(financeBlocked.status, 403, 'Client must be forbidden from accessing internal financial summary');

    // 5. RBAC: Owner accessing financial summary -> Must be 200
    const financeAllowed = await request('GET', '/api/finance/summary', null, ownerToken);
    assert.strictEqual(financeAllowed.status, 200, 'Owner must have access to financial summary');
    assert.ok(financeAllowed.body.summary.revenue !== undefined);

    // 6. RBAC: Client viewing creator profile -> standard_rate and bank_upi_info must be masked!
    const creatorView = await request('GET', '/api/creators/1', null, clientToken);
    assert.strictEqual(creatorView.status, 200);
    assert.strictEqual(creatorView.body.creator.standard_rate, undefined, 'standard_rate must be masked for client');
    assert.strictEqual(creatorView.body.creator.bank_upi_info, undefined, 'bank_upi_info must be masked for client');

    console.log('✔ Test Auth & RBAC Passed!');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests, request };
