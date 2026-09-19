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
  console.log('--- RUNNING TEST: Financial System, Ledgers & Duplicate Payout Prevention ---');
  await db.init();

  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'owner@leadyfy.com',
      password: 'password123'
    });
    const token = loginRes.body.token;

    // 1. Record an Expense
    const expenseRes = await request('POST', '/api/finance/expenses', {
      category: 'Software',
      description: 'Monthly Cloudflare & Storage Hosting',
      amount: 4500,
      date: '2026-09-18'
    }, token);
    assert.strictEqual(expenseRes.status, 201);
    assert.strictEqual(expenseRes.body.expense.amount, 4500);

    // 2. Record a Payment for Invoice #1
    const paymentRes = await request('POST', '/api/finance/payments', {
      invoice_id: 1,
      amount_paid: 10000,
      payment_method: 'Bank Transfer',
      transaction_ref: 'UTR99887766'
    }, token);
    assert.strictEqual(paymentRes.status, 201);
    assert.strictEqual(paymentRes.body.payment.status, 'PARTIALLY_PAID');

    // 3. Create Creator Payout for Creator 3 and Order 2
    const payoutPayload = {
      creator_id: 3,
      order_id: 2,
      video_count: 1,
      agreed_rate: 14000
    };
    const payoutRes1 = await request('POST', '/api/finance/payouts', payoutPayload, token);
    assert.strictEqual(payoutRes1.status, 201, 'First payout creation must succeed');
    assert.strictEqual(payoutRes1.body.payout.total_payout, 14000);
    const payoutId = payoutRes1.body.payout.id;

    // 4. DUPLICATE PAYOUT PREVENTION: Attempt duplicate payout for same creator & order
    const payoutRes2 = await request('POST', '/api/finance/payouts', payoutPayload, token);
    assert.strictEqual(payoutRes2.status, 400, 'Duplicate payout must be rejected with 400');
    assert.ok(payoutRes2.body.error.includes('Duplicate Payout Prevented'));

    // 5. Approve and pay the payout
    await request('PUT', `/api/finance/payouts/${payoutId}/status`, { status: 'APPROVED' }, token);
    const paidRes = await request('PUT', `/api/finance/payouts/${payoutId}/status`, {
      status: 'PAID',
      reference_number: 'UPI-PAID-TEST-009'
    }, token);
    assert.strictEqual(paidRes.status, 200);
    assert.strictEqual(paidRes.body.payout.status, 'PAID');

    // 6. Net Profit Calculation: Revenue - Expenses - Creator Payouts
    const summaryRes = await request('GET', '/api/finance/summary', null, token);
    assert.strictEqual(summaryRes.status, 200);
    const { revenue, expenses, creatorPayouts, netProfit } = summaryRes.body.summary;
    const expectedProfit = revenue - expenses - creatorPayouts;
    assert.strictEqual(netProfit, Math.round(expectedProfit * 100) / 100, 'Net profit formula must match');

    console.log('✔ Test Financial System & Duplicate Payout Prevention Passed!');
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
