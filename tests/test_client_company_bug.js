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
  console.log('--- RUNNING TEST: Critical Client Bug (company vs company_name) Complete Flow ---');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    const token = loginRes.body.token;

    // STEP 1: Create Client using 'company_name'
    const payload1 = {
      client_name: 'Ananya Deshmukh',
      company_name: 'Zenith Organic Health Pvt Ltd',
      email: `zenith_${Date.now()}@health.com`,
      phone: '+91 9988776655',
      brand_name: 'Zenith Health',
      industry: 'Wellness',
      status: 'NEW'
    };
    const res1 = await request('POST', '/api/clients', payload1, token);
    assert.strictEqual(res1.status, 201, 'Client creation with company_name must return 201');
    assert.strictEqual(res1.body.client.company_name, 'Zenith Organic Health Pvt Ltd');
    const clientId1 = res1.body.client.id;

    // STEP 2: Create Client using legacy 'company' payload (verifying backward-compatibility & data unification)
    const payload2 = {
      client_name: 'Harsh Vardhan',
      company: 'Apex Robotics India Ltd',
      email: `apex_${Date.now()}@robotics.com`,
      phone: '+91 9911223388',
      brand_name: 'Apex Robotics',
      industry: 'Technology',
      status: 'ONBOARDING'
    };
    const res2 = await request('POST', '/api/clients', payload2, token);
    assert.strictEqual(res2.status, 201, 'Client creation with legacy company field must normalize and return 201');
    assert.strictEqual(res2.body.client.company_name, 'Apex Robotics India Ltd');
    const clientId2 = res2.body.client.id;

    // STEP 3: List Clients -> Verify company_name is present in table response
    const listRes = await request('GET', '/api/clients', null, token);
    assert.strictEqual(listRes.status, 200);
    const foundClient1 = listRes.body.clients.find(c => c.id === clientId1);
    assert.ok(foundClient1, 'Client 1 must be present in listing');
    assert.strictEqual(foundClient1.company_name, 'Zenith Organic Health Pvt Ltd');

    // STEP 4: Open Client 360 Profile -> Verify company_name and aggregated sections
    const profileRes = await request('GET', `/api/clients/${clientId1}`, null, token);
    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.body.client.company_name, 'Zenith Organic Health Pvt Ltd');
    assert.ok(Array.isArray(profileRes.body.client.orders), 'Client profile must aggregate orders array');
    assert.ok(Array.isArray(profileRes.body.client.scripts), 'Client profile must aggregate scripts array');

    // STEP 5: Edit Client -> Update company_name
    const editRes = await request('PUT', `/api/clients/${clientId1}`, {
      company_name: 'Zenith Organic Global Wellness Ltd',
      status: 'ACTIVE'
    }, token);
    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.body.client.company_name, 'Zenith Organic Global Wellness Ltd');
    assert.strictEqual(editRes.body.client.status, 'ACTIVE');

    // STEP 6: Create Order for Client -> Verify company_name is associated and returned
    const orderPayload = {
      client_id: clientId1,
      package_name: '10 UGC Scale Up Tier',
      video_count: 10,
      pricing: 150000,
      gst_rate: 18.0,
      start_date: '2026-10-01',
      due_date: '2026-10-31',
      amount_received: 50000
    };
    const orderRes = await request('POST', '/api/orders', orderPayload, token);
    assert.strictEqual(orderRes.status, 201, 'Order creation must return 201');
    assert.strictEqual(orderRes.body.order.client_id, clientId1);
    assert.strictEqual(orderRes.body.order.company_name, 'Zenith Organic Global Wellness Ltd', 'Order must be directly associated with company_name');
    assert.strictEqual(orderRes.body.order.remaining_quota, 10, 'Live quota counter must be initialized to 10');

    console.log('✔ Test Critical Client Bug & Complete Flow Passed!');
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
