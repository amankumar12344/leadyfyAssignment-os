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
  console.log('--- RUNNING TEST: Idempotent Final Delivery ---');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    const ownerLogin = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    const ownerToken = ownerLogin.body.token;

    // Create video and move to FINAL_APPROVED
    const createRes = await request('POST', '/api/videos', {
      client_id: 1,
      order_id: 1,
      title: 'Idempotency Delivery Test Video',
      status: 'FINAL_APPROVED'
    }, ownerToken);
    const videoId = createRes.body.video.id;

    // Check order counters before delivery
    const orderBefore = await request('GET', '/api/orders/1', null, ownerToken);
    const deliveredCountBefore = orderBefore.body.order.delivered_videos_count;
    const completedCountBefore = orderBefore.body.order.completed_videos_count;

    // 1. First Delivery call
    const deliveryPayload = {
      delivery_link: 'https://drive.google.com/file/d/master-4k-asset-test/view'
    };
    const res1 = await request('POST', `/api/videos/${videoId}/deliver`, deliveryPayload, ownerToken);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.video.status, 'DELIVERED');
    assert.strictEqual(res1.body.alreadyDelivered, false);

    // Verify order counters incremented
    const orderAfter1 = await request('GET', '/api/orders/1', null, ownerToken);
    assert.strictEqual(
      orderAfter1.body.order.delivered_videos_count,
      deliveredCountBefore + 1,
      'Delivered count must increment by 1'
    );

    // 2. Second Delivery call (IDEMPOTENCY TEST: same video, same endpoint)
    const res2 = await request('POST', `/api/videos/${videoId}/deliver`, deliveryPayload, ownerToken);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.alreadyDelivered, true, 'Subsequent delivery call must flag alreadyDelivered');

    // Verify order counters did NOT increment again!
    const orderAfter2 = await request('GET', '/api/orders/1', null, ownerToken);
    assert.strictEqual(
      orderAfter2.body.order.delivered_videos_count,
      orderAfter1.body.order.delivered_videos_count,
      'Delivered count must NOT increment again on duplicate call'
    );
    assert.strictEqual(
      orderAfter2.body.order.completed_videos_count,
      orderAfter1.body.order.completed_videos_count,
      'Completed count must NOT double-increment'
    );

    console.log('✔ Test Final Delivery Idempotency Passed!');
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
