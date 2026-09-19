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
  console.log('--- RUNNING TEST: Strict Video Production State Machine & Client Review ---');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    const ownerLogin = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    const ownerToken = ownerLogin.body.token;

    const clientLogin = await request('POST', '/api/auth/login', {
      email: 'client1@glowbeauty.com',
      password: 'password123'
    });
    const clientToken = clientLogin.body.token;
    const clientId = clientLogin.body.user.clientId;

    // 1. Create a video in SCRIPT_APPROVED state
    const createRes = await request('POST', '/api/videos', {
      client_id: clientId,
      order_id: 1,
      title: 'State Machine Test Video - Glow Serum Reel',
      status: 'SCRIPT_APPROVED'
    }, ownerToken);
    assert.strictEqual(createRes.status, 201);
    const videoId = createRes.body.video.id;
    assert.strictEqual(createRes.body.video.status, 'SCRIPT_APPROVED');

    // 2. TEST INVALID TRANSITION: SCRIPT_APPROVED -> DELIVERED (Must be REJECTED!)
    const invalidRes1 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'DELIVERED'
    }, ownerToken);
    assert.strictEqual(invalidRes1.status, 400, 'SCRIPT_APPROVED -> DELIVERED must be rejected');
    assert.ok(invalidRes1.body.error.includes('Invalid state transition'));

    // 3. Valid transition: SCRIPT_APPROVED -> SHOOT_PENDING
    const resStep1 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'SHOOT_PENDING'
    }, ownerToken);
    assert.strictEqual(resStep1.status, 200);
    assert.strictEqual(resStep1.body.video.status, 'SHOOT_PENDING');

    // 4. Valid transition: SHOOT_PENDING -> RAW_FOOTAGE_RECEIVED
    const resStep2 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'RAW_FOOTAGE_RECEIVED',
      raw_footage_url: 'https://drive.google.com/drive/folders/test-raw-4k'
    }, ownerToken);
    assert.strictEqual(resStep2.status, 200);
    assert.strictEqual(resStep2.body.video.status, 'RAW_FOOTAGE_RECEIVED');

    // 5. Valid transition: RAW_FOOTAGE_RECEIVED -> VIDEO_EDITING
    const resStep3 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'VIDEO_EDITING',
      assigned_editor_id: 4
    }, ownerToken);
    assert.strictEqual(resStep3.status, 200);
    assert.strictEqual(resStep3.body.video.status, 'VIDEO_EDITING');

    // 6. TEST INVALID TRANSITION: VIDEO_EDITING -> DELIVERED (Must be REJECTED!)
    const invalidRes2 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'DELIVERED'
    }, ownerToken);
    assert.strictEqual(invalidRes2.status, 400, 'VIDEO_EDITING -> DELIVERED must be rejected');

    // 7. Valid transition: VIDEO_EDITING -> INTERNAL_QA
    const resStep4 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'INTERNAL_QA',
      draft_video_url: 'https://storage.googleapis.com/test-draft.mp4'
    }, ownerToken);
    assert.strictEqual(resStep4.status, 200);

    // 8. Valid transition: INTERNAL_QA -> CLIENT_REVIEW
    const resStep5 = await request('POST', `/api/videos/${videoId}/transition`, {
      status: 'CLIENT_REVIEW'
    }, ownerToken);
    assert.strictEqual(resStep5.status, 200);
    assert.strictEqual(resStep5.body.video.status, 'CLIENT_REVIEW');

    // 9. Client reviews and submits timestamped revision feedback
    const feedbackPayload = {
      feedback: [
        { timestamp_seconds: 3.2, comment: 'Opening hook text is too low on the frame.' },
        { timestamp_seconds: 14.8, comment: 'Product texture shot could be slightly slower.' }
      ]
    };
    const revisionRes = await request('POST', `/api/videos/${videoId}/feedback`, feedbackPayload, clientToken);
    assert.strictEqual(revisionRes.status, 200, 'Client revision feedback must be accepted');
    assert.strictEqual(revisionRes.body.video.status, 'REVISION', 'Status must transition to REVISION');
    assert.strictEqual(revisionRes.body.video.revision_count, 1, 'Revision count must increment to 1');
    assert.strictEqual(revisionRes.body.video.feedbackHistory.length, 2, 'Feedback items must be saved in history');

    // 10. Editor takes it back: REVISION -> VIDEO_EDITING -> INTERNAL_QA -> CLIENT_REVIEW
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'VIDEO_EDITING' }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'INTERNAL_QA' }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'CLIENT_REVIEW' }, ownerToken);

    // 11. Client approves video draft -> transitions to FINAL_APPROVED
    const approveRes = await request('POST', `/api/videos/${videoId}/approve`, {}, clientToken);
    assert.strictEqual(approveRes.status, 200, 'Client approval must succeed');
    assert.strictEqual(approveRes.body.video.status, 'FINAL_APPROVED');

    console.log('✔ Test Strict Video Production State Machine & Client Review Passed!');
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
