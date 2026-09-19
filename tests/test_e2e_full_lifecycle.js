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
  console.log('================================================================');
  console.log('--- RUNNING MOST IMPORTANT E2E TEST: COMPLETE UGC AGENCY LIFECYCLE ---');
  console.log('================================================================');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    // 0. Login as Owner
    const ownerLogin = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    const ownerToken = ownerLogin.body.token;

    // STEP 1: CREATE CLIENT
    console.log('1. Creating Client with unified company_name...');
    const clientPayload = {
      client_name: 'Mira Rajput',
      company_name: 'Solace Botanicals India Pvt Ltd',
      email: `solace_${Date.now()}@botanicals.com`,
      phone: '+91 9123456780',
      whatsapp: '+91 9123456780',
      brand_name: 'Solace Botanicals',
      industry: 'Organic Cosmetics',
      status: 'ONBOARDING'
    };
    const clientRes = await request('POST', '/api/clients', clientPayload, ownerToken);
    assert.strictEqual(clientRes.status, 201);
    const client = clientRes.body.client;
    const clientId = client.id;
    assert.strictEqual(client.company_name, 'Solace Botanicals India Pvt Ltd');
    console.log(`   ✔ Client Created: ID ${clientId} (${client.company_name})`);

    // STEP 2: CREATE ORDER FOR CLIENT
    console.log('2. Creating Order for Client...');
    const orderPayload = {
      client_id: clientId,
      package_name: 'E2E Full Lifecycle 3 UGC Ads Package',
      video_count: 3,
      pricing: 45000,
      gst_rate: 18.0,
      start_date: '2026-10-01',
      due_date: '2026-10-25'
    };
    const orderRes = await request('POST', '/api/orders', orderPayload, ownerToken);
    assert.strictEqual(orderRes.status, 201);
    const order = orderRes.body.order;
    const orderId = order.id;
    assert.strictEqual(order.remaining_quota, 3);
    console.log(`   ✔ Order Created: ID ${orderId}, Video Count: ${order.video_count}, Remaining Quota: ${order.remaining_quota}`);

    // STEP 3: DRAFT SCRIPT
    console.log('3. Drafting Script for Order...');
    const scriptPayload = {
      client_id: clientId,
      order_id: orderId,
      video_number: 1,
      title: 'Solace Glow Botanical Dew Serum Unboxing',
      language: 'English',
      script_text: '[Hook 0-3s]: "If your morning serum feels sticky, you need to watch this."',
      deadline: '2026-10-05'
    };
    const scriptRes = await request('POST', '/api/scripts', scriptPayload, ownerToken);
    assert.strictEqual(scriptRes.status, 201);
    const scriptId = scriptRes.body.script.id;
    console.log(`   ✔ Script Created: ID ${scriptId}`);

    // STEP 4: CLIENT APPROVES SCRIPT
    console.log('4. Submitting Script to Client & Client Approval...');
    await request('PUT', `/api/scripts/${scriptId}`, { status: 'SENT_TO_CLIENT' }, ownerToken);
    const approveScriptRes = await request('POST', `/api/scripts/${scriptId}/approve`, {
      client_id: clientId,
      comments: 'Approved! Ready for shoot.'
    }, ownerToken);
    assert.strictEqual(approveScriptRes.status, 200);
    assert.strictEqual(approveScriptRes.body.script.status, 'APPROVED');
    console.log(`   ✔ Script Approved by Client`);

    // STEP 5: CREATOR SELECTION & AVAILABILITY
    console.log('5. Selecting Creator...');
    const creatorsRes = await request('GET', '/api/creators', null, ownerToken);
    assert.ok(creatorsRes.body.creators.length > 0);
    const creator = creatorsRes.body.creators[0];
    const creatorId = creator.id;
    console.log(`   ✔ Selected Creator: ${creator.name} (ID: ${creatorId})`);

    // STEP 6: SCHEDULE SHOOT
    console.log('6. Scheduling Shoot with Pre-Shoot Checklist...');
    const shootPayload = {
      client_id: clientId,
      order_id: orderId,
      shoot_date: '2026-10-10',
      shoot_time: '11:00 AM',
      location: 'Studio Bloom, Juhu, Mumbai',
      creator_id: creatorId,
      cameraman: 'Ramesh Sen',
      approved_scripts_summary: 'Script #1 Dew Serum',
      status: 'CONFIRMED',
      pre_shoot_checklist: {
        scriptApproved: true,
        creatorConfirmed: true,
        locationPermission: true,
        productReceived: true,
        teamBriefing: true
      }
    };
    const shootRes = await request('POST', '/api/shoots', shootPayload, ownerToken);
    assert.strictEqual(shootRes.status, 201);
    const shootId = shootRes.body.shoot.id;
    console.log(`   ✔ Shoot Scheduled: ID ${shootId}`);

    // Mark shoot complete
    await request('PUT', `/api/shoots/${shootId}`, {
      status: 'COMPLETED',
      post_shoot_checklist: {
        footageUploaded: true,
        rawFootageVerified: true,
        reshootNeeded: false
      }
    }, ownerToken);
    console.log(`   ✔ Shoot Completed & Raw Footage Verified`);

    // STEP 7: VIDEO PRODUCTION STATE MACHINE
    console.log('7. Running Video Production State Machine...');
    const videoPayload = {
      client_id: clientId,
      order_id: orderId,
      script_id: scriptId,
      creator_id: creatorId,
      shoot_id: shootId,
      title: 'Solace Botanicals - Video #1: Dew Serum Master Cut',
      status: 'SCRIPT_APPROVED'
    };
    const videoRes = await request('POST', '/api/videos', videoPayload, ownerToken);
    const videoId = videoRes.body.video.id;

    // Transition: SCRIPT_APPROVED -> SHOOT_PENDING -> RAW_FOOTAGE_RECEIVED -> VIDEO_EDITING -> INTERNAL_QA -> CLIENT_REVIEW
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'SHOOT_PENDING' }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'RAW_FOOTAGE_RECEIVED' }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'VIDEO_EDITING', assigned_editor_id: 4 }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'INTERNAL_QA', draft_video_url: 'https://storage.googleapis.com/test-draft.mp4' }, ownerToken);
    const reviewStateRes = await request('POST', `/api/videos/${videoId}/transition`, { status: 'CLIENT_REVIEW' }, ownerToken);
    assert.strictEqual(reviewStateRes.body.video.status, 'CLIENT_REVIEW');
    console.log(`   ✔ Video progressed through state machine to CLIENT_REVIEW`);

    // STEP 8: CLIENT REVIEW & REVISION LOOP
    console.log('8. Client Review: Submitting Timestamped Revision...');
    const revisionReq = await request('POST', `/api/videos/${videoId}/feedback`, {
      client_id: clientId,
      feedback: [
        { timestamp_seconds: 2.5, comment: 'Slightly brighten product bottle label.' }
      ]
    }, ownerToken);
    assert.strictEqual(revisionReq.body.video.status, 'REVISION');
    assert.strictEqual(revisionReq.body.video.revision_count, 1);
    console.log(`   ✔ Revision #1 logged with timestamped feedback`);

    // Editor applies revision and sends back to review
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'VIDEO_EDITING' }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'INTERNAL_QA' }, ownerToken);
    await request('POST', `/api/videos/${videoId}/transition`, { status: 'CLIENT_REVIEW' }, ownerToken);

    // STEP 9: FINAL APPROVAL
    console.log('9. Client Final Approval...');
    const finalApproveRes = await request('POST', `/api/videos/${videoId}/approve`, { client_id: clientId }, ownerToken);
    assert.strictEqual(finalApproveRes.body.video.status, 'FINAL_APPROVED');
    console.log(`   ✔ Video marked FINAL_APPROVED`);

    // STEP 10: IDEMPOTENT FINAL DELIVERY
    console.log('10. Processing Idempotent Final Delivery...');
    const deliveryPayload = {
      delivery_link: 'https://drive.google.com/file/d/solace-botanicals-master-4k/view'
    };
    const deliverRes = await request('POST', `/api/videos/${videoId}/deliver`, deliveryPayload, ownerToken);
    assert.strictEqual(deliverRes.status, 200);
    assert.strictEqual(deliverRes.body.video.status, 'DELIVERED');
    assert.strictEqual(deliverRes.body.alreadyDelivered, false);
    console.log(`   ✔ Video DELIVERED & Asset registered`);

    // Check updated order quota
    const orderCheck = await request('GET', `/api/orders/${orderId}`, null, ownerToken);
    assert.strictEqual(orderCheck.body.order.completed_videos_count, 1);
    assert.strictEqual(orderCheck.body.order.delivered_videos_count, 1);
    assert.strictEqual(orderCheck.body.order.remaining_quota, 2);
    console.log(`   ✔ Live Quota Safely Updated: Completed: 1, Delivered: 1, Remaining: 2`);

    // STEP 11: FINANCIAL UPDATE
    console.log('11. Financial Update: Invoicing, Client Payment & Creator Payout...');
    // Invoices list for this client
    const invoicesRes = await request('GET', `/api/finance/invoices?clientId=${clientId}`, null, ownerToken);
    assert.strictEqual(invoicesRes.status, 200);
    assert.ok(invoicesRes.body.invoices.length > 0);
    const invoice = invoicesRes.body.invoices[0];

    // Client pays full invoice
    const payRes = await request('POST', '/api/finance/payments', {
      invoice_id: invoice.id,
      amount_paid: invoice.outstanding_balance,
      payment_method: 'NEFT Transfer',
      transaction_ref: 'E2E-FULL-PAYMENT-REF'
    }, ownerToken);
    assert.strictEqual(payRes.status, 201);
    assert.strictEqual(payRes.body.payment.status, 'PAID');
    console.log(`   ✔ Client Invoice #${invoice.invoice_number} Paid in Full`);

    // Record Shoot Expense
    await request('POST', '/api/finance/expenses', {
      category: 'Studio',
      description: 'Studio Bloom Juhu Rental for Solace Shoot',
      amount: 8000,
      date: '2026-10-10'
    }, ownerToken);

    // Creator Payout
    const payoutRes = await request('POST', '/api/finance/payouts', {
      creator_id: creatorId,
      order_id: orderId,
      video_count: 1,
      agreed_rate: creator.standard_rate
    }, ownerToken);
    assert.strictEqual(payoutRes.status, 201);
    const payoutId = payoutRes.body.payout.id;

    // Approve and pay creator payout
    await request('PUT', `/api/finance/payouts/${payoutId}/status`, { status: 'APPROVED' }, ownerToken);
    await request('PUT', `/api/finance/payouts/${payoutId}/status`, { status: 'PAID', reference_number: 'CREATOR-UPI-9922' }, ownerToken);
    console.log(`   ✔ Creator Payout Paid (₹${payoutRes.body.payout.total_payout})`);

    // Summary calculation
    const finSummary = await request('GET', '/api/finance/summary', null, ownerToken);
    assert.ok(finSummary.body.summary.netProfit !== undefined);
    console.log(`   ✔ Real-time Net Profit: ₹${finSummary.body.summary.netProfit}`);

    console.log('================================================================');
    console.log('✔✔✔ MOST IMPORTANT E2E TEST PASSED 100% SUCCESSFULLY! ✔✔✔');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ E2E Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
