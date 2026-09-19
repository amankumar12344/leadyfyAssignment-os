const assert = require('assert');
const { app } = require('../src/server');
const db = require('../src/database/db');
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
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING TEST: Client Isolation & Sensitive Data Masking ---');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    // Login as Client 1 (Glow Beauty, clientId = 1)
    const client1Login = await request('POST', '/api/auth/login', {
      email: 'client1@glowbeauty.com',
      password: 'password123'
    });
    const client1Token = client1Login.body.token;

    // Login as Client 2 (FitFuel, clientId = 2)
    const client2Login = await request('POST', '/api/auth/login', {
      email: 'client2@fitfuel.com',
      password: 'password123'
    });
    const client2Token = client2Login.body.token;

    // 1. Client 1 attempting to view Client 2's 360 profile -> Must be 403
    const profileRes = await request('GET', '/api/clients/2', null, client1Token);
    assert.strictEqual(profileRes.status, 403, 'Client 1 must be forbidden from accessing Client 2 profile');

    // 2. Client 1 attempting to view Client 2's order (Order #2 belongs to Client 2)
    const orderRes = await request('GET', '/api/orders/2', null, client1Token);
    assert.strictEqual(orderRes.status, 403, 'Client 1 must be forbidden from accessing Client 2 order');

    // 3. Client 1 listing orders -> Must ONLY return Client 1's orders
    const ordersList = await request('GET', '/api/orders', null, client1Token);
    assert.strictEqual(ordersList.status, 200);
    assert.ok(ordersList.body.orders.every(o => o.client_id === 1), 'Client 1 order list must only contain client 1 orders');

    // 4. Client 1 listing scripts -> Must ONLY return Client 1's scripts
    const scriptsList = await request('GET', '/api/scripts', null, client1Token);
    assert.strictEqual(scriptsList.status, 200);
    assert.ok(scriptsList.body.scripts.every(s => s.client_id === 1), 'Client 1 script list must only contain client 1 scripts');

    // 5. Client 1 listing invoices -> Must ONLY return Client 1's invoices
    const invoicesList = await request('GET', '/api/finance/invoices', null, client1Token);
    assert.strictEqual(invoicesList.status, 200);
    assert.ok(invoicesList.body.invoices.every(i => i.client_id === 1), 'Client 1 invoice list must only contain client 1 invoices');

    // 6. Client 1 attempting to access audit logs -> Must be 403
    const auditRes = await request('GET', '/api/audit', null, client1Token);
    assert.strictEqual(auditRes.status, 403, 'Client 1 must be forbidden from accessing audit logs');

    // 7. Client 1 attempting to access internal tasks -> Must be 403
    const tasksRes = await request('GET', '/api/tasks', null, client1Token);
    assert.strictEqual(tasksRes.status, 403, 'Client 1 must be forbidden from accessing internal tasks');

    // 8. Client 1 attempting to access internal expenses -> Must be 403
    const expensesRes = await request('GET', '/api/finance/expenses', null, client1Token);
    assert.strictEqual(expensesRes.status, 403, 'Client 1 must be forbidden from accessing internal expenses');

    console.log('✔ Test Client Isolation & Data Protection Passed!');
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

module.exports = { runTests };
