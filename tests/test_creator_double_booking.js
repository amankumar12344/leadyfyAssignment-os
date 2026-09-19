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
  console.log('--- RUNNING TEST: Creator Double-Booking Prevention ---');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    const token = loginRes.body.token;

    const shootDate = '2026-11-15';
    const shootTime = '14:00 PM';
    const creatorId = 2; // Rohan Mehta

    // 1. First booking -> Must succeed
    const shootPayload1 = {
      client_id: 1,
      order_id: 1,
      shoot_date: shootDate,
      shoot_time: shootTime,
      location: 'Studio Alpha, Connaught Place, New Delhi',
      creator_id: creatorId,
      cameraman: 'Sanjay Dutt',
      approved_scripts_summary: 'Script #1'
    };

    const res1 = await request('POST', '/api/shoots', shootPayload1, token);
    assert.strictEqual(res1.status, 201, 'First shoot booking must succeed');
    assert.strictEqual(res1.body.shoot.creator_id, creatorId);

    // 2. Conflicting booking for the same creator on same date -> Must be REJECTED
    const shootPayload2 = {
      client_id: 2,
      order_id: 2,
      shoot_date: shootDate,
      shoot_time: '16:00 PM',
      location: 'Studio Beta, Cyber City, Gurugram',
      creator_id: creatorId,
      cameraman: 'Rajesh Sharma',
      approved_scripts_summary: 'Script #2'
    };

    const res2 = await request('POST', '/api/shoots', shootPayload2, token);
    assert.strictEqual(res2.status, 400, 'Conflicting booking must be rejected with 400');
    assert.ok(res2.body.error.includes('Double Booking Detected'), 'Error message must specify Double Booking Detected');

    console.log('✔ Test Creator Double Booking Prevention Passed!');
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
