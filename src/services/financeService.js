const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');

// 1. PAYMENTS & INVOICES
async function listInvoices(filter = {}) {
  let query = `
    SELECT p.*,
           c.client_name, c.company_name, c.email as client_email,
           o.package_name, o.video_count
    FROM payments p
    JOIN clients c ON p.client_id = c.id
    JOIN orders o ON p.order_id = o.id
  `;
  const conditions = [];
  const params = [];

  if (filter.clientId) {
    conditions.push("p.client_id = ?");
    params.push(filter.clientId);
  }

  if (filter.status) {
    conditions.push("p.status = ?");
    params.push(filter.status);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.created_at DESC";

  return await db.all(query, params);
}

async function recordPayment(data, actorId = null) {
  const {
    invoice_id,
    amount_paid,
    payment_date = new Date().toISOString().split('T')[0],
    payment_method = 'Bank Transfer',
    transaction_ref = '',
    notes = ''
  } = data;

  if (!invoice_id) throw new Error('invoice_id is required.');
  const paymentAmount = parseFloat(amount_paid);
  if (isNaN(paymentAmount) || paymentAmount <= 0) throw new Error('amount_paid must be a positive number.');

  const invoice = await db.get("SELECT * FROM payments WHERE id = ?", [invoice_id]);
  if (!invoice) throw new Error('Invoice not found.');

  const newAmountReceived = invoice.amount_received + paymentAmount;
  const newOutstanding = Math.max(0, invoice.invoice_amount - newAmountReceived);

  let newStatus = invoice.status;
  if (newOutstanding <= 0) {
    newStatus = 'PAID';
  } else if (newAmountReceived > 0) {
    newStatus = 'PARTIALLY_PAID';
  }

  await db.transaction(async () => {
    // 1. Update invoice
    await db.run(`
      UPDATE payments SET
        amount_received = ?,
        outstanding_balance = ?,
        payment_date = ?,
        payment_method = ?,
        transaction_ref = ?,
        notes = ?,
        status = ?
      WHERE id = ?
    `, [
      newAmountReceived,
      newOutstanding,
      payment_date,
      payment_method,
      transaction_ref,
      notes,
      newStatus,
      invoice_id
    ]);

    // 2. Update parent order received and outstanding
    await db.run(`
      UPDATE orders SET
        amount_received = amount_received + ?,
        outstanding_balance = CASE WHEN (outstanding_balance - ?) < 0 THEN 0 ELSE (outstanding_balance - ?) END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paymentAmount, paymentAmount, paymentAmount, invoice.order_id]);

    await logAudit({
      actor_id: actorId,
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENTS',
      entity_id: invoice_id,
      metadata: {
        invoice_number: invoice.invoice_number,
        amount_paid: paymentAmount,
        outstanding: newOutstanding,
        status: newStatus
      }
    });
  });

  return await db.get("SELECT * FROM payments WHERE id = ?", [invoice_id]);
}

// 2. EXPENSES
async function recordExpense(data, actorId = null) {
  const {
    category,
    description,
    amount,
    date = new Date().toISOString().split('T')[0],
    receipt_url = null
  } = data;

  const validCategories = ['Salaries', 'Office', 'Studio', 'Equipment', 'Fuel', 'Software', 'Other'];
  if (!category || !validCategories.includes(category)) {
    throw new Error(`Category must be one of: ${validCategories.join(', ')}`);
  }
  if (!description || !description.trim()) throw new Error('Description is required.');
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) throw new Error('Amount must be greater than 0.');

  const res = await db.run(`
    INSERT INTO expenses (category, description, amount, recorded_by_user_id, date, receipt_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [category, description.trim(), numericAmount, actorId, date, receipt_url]);

  await logAudit({
    actor_id: actorId,
    action: 'EXPENSE_RECORDED',
    entity: 'EXPENSES',
    entity_id: res.lastID,
    metadata: { category, amount: numericAmount, description }
  });

  return await db.get("SELECT * FROM expenses WHERE id = ?", [res.lastID]);
}

async function listExpenses(filter = {}) {
  let query = `
    SELECT e.*, u.full_name as recorded_by_name
    FROM expenses e
    LEFT JOIN users u ON e.recorded_by_user_id = u.id
  `;
  const conditions = [];
  const params = [];

  if (filter.category) {
    conditions.push("e.category = ?");
    params.push(filter.category);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY e.date DESC, e.id DESC";

  return await db.all(query, params);
}

// 3. CREATOR PAYOUTS (WITH DUPLICATE PREVENTION)
async function createCreatorPayout(data, actorId = null) {
  const {
    creator_id,
    order_id,
    video_count = 1,
    agreed_rate,
    payment_date = null,
    reference_number = null
  } = data;

  if (!creator_id) throw new Error('creator_id is required.');
  if (!order_id) throw new Error('order_id is required.');

  // PREVENT DUPLICATE PAYOUTS: Check if payout already exists for this creator and order
  const existing = await db.get(`
    SELECT id, status, total_payout FROM creator_payouts
    WHERE creator_id = ? AND order_id = ?
  `, [creator_id, order_id]);

  if (existing) {
    throw new Error(
      `Duplicate Payout Prevented: Payout #${existing.id} already exists for Creator #${creator_id} on Order #${order_id} (Status: ${existing.status}, Amount: ₹${existing.total_payout}).`
    );
  }

  const creator = await db.get("SELECT id, name, standard_rate FROM creators WHERE id = ?", [creator_id]);
  if (!creator) throw new Error('Creator not found.');

  const rate = agreed_rate !== undefined ? parseFloat(agreed_rate) : creator.standard_rate;
  const count = parseInt(video_count, 10) || 1;
  const total = rate * count;

  const res = await db.run(`
    INSERT INTO creator_payouts (
      creator_id, order_id, video_count, agreed_rate, total_payout,
      status, payment_date, reference_number, approved_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
  `, [
    creator_id,
    order_id,
    count,
    rate,
    total,
    payment_date,
    reference_number,
    actorId
  ]);

  const payoutId = res.lastID;

  await logAudit({
    actor_id: actorId,
    action: 'PAYOUT_CREATED',
    entity: 'CREATOR_PAYOUTS',
    entity_id: payoutId,
    metadata: { creator_id, order_id, total_payout: total }
  });

  return await getPayoutById(payoutId);
}

async function getPayoutById(id) {
  return await db.get(`
    SELECT cp.*,
           cr.name as creator_name, cr.bank_upi_info, cr.phone as creator_phone,
           o.package_name,
           c.company_name as client_company_name,
           u.full_name as approved_by_name
    FROM creator_payouts cp
    JOIN creators cr ON cp.creator_id = cr.id
    JOIN orders o ON cp.order_id = o.id
    JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON cp.approved_by_user_id = u.id
    WHERE cp.id = ?
  `, [id]);
}

async function listCreatorPayouts(filter = {}) {
  let query = `
    SELECT cp.*,
           cr.name as creator_name, cr.bank_upi_info,
           o.package_name,
           c.company_name as client_company_name
    FROM creator_payouts cp
    JOIN creators cr ON cp.creator_id = cr.id
    JOIN orders o ON cp.order_id = o.id
    JOIN clients c ON o.client_id = c.id
  `;
  const conditions = [];
  const params = [];

  if (filter.status) {
    conditions.push("cp.status = ?");
    params.push(filter.status);
  }

  if (filter.creatorId) {
    conditions.push("cp.creator_id = ?");
    params.push(filter.creatorId);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY cp.created_at DESC";

  return await db.all(query, params);
}

async function updatePayoutStatus(id, status, referenceNumber = null, actorId = null) {
  const valid = ['PENDING', 'APPROVED', 'PAID'];
  if (!valid.includes(status)) throw new Error(`Invalid status '${status}'. Must be: ${valid.join(', ')}`);

  const payout = await getPayoutById(id);
  if (!payout) throw new Error('Payout not found.');

  const updates = ['status = ?'];
  const params = [status];

  if (status === 'PAID') {
    updates.push("payment_date = date('now')");
    if (referenceNumber) {
      updates.push('reference_number = ?');
      params.push(referenceNumber);
    }
  }

  if (status === 'APPROVED' && !payout.approved_by_user_id) {
    updates.push('approved_by_user_id = ?');
    params.push(actorId);
  }

  params.push(id);
  await db.run(`UPDATE creator_payouts SET ${updates.join(', ')} WHERE id = ?`, params);

  await logAudit({
    actor_id: actorId,
    action: status === 'PAID' ? 'PAYOUT_PAID' : 'PAYOUT_APPROVED',
    entity: 'CREATOR_PAYOUTS',
    entity_id: id,
    metadata: { status, total: payout.total_payout }
  });

  return await getPayoutById(id);
}

// 4. FINANCIAL SUMMARY & NET PROFIT
async function getFinancialSummary() {
  // Revenue = Total amount received from client invoices
  const revRes = await db.get("SELECT SUM(amount_received) as total_revenue, SUM(outstanding_balance) as total_receivables, SUM(invoice_amount) as total_invoiced FROM payments;");
  const totalRevenue = revRes.total_revenue || 0;
  const totalReceivables = revRes.total_receivables || 0;
  const totalInvoiced = revRes.total_invoiced || 0;

  // Expenses = Agency expenses
  const expRes = await db.get("SELECT SUM(amount) as total_expenses FROM expenses;");
  const totalExpenses = expRes.total_expenses || 0;

  // Creator Payouts = Paid creator payouts
  const payRes = await db.get("SELECT SUM(total_payout) as total_payouts_paid, SUM(CASE WHEN status = 'PENDING' THEN total_payout ELSE 0 END) as pending_payouts FROM creator_payouts WHERE status = 'PAID';");
  const totalPayoutsPaid = payRes.total_payouts_paid || 0;
  const pendingPayouts = payRes.pending_payouts || 0;

  // Net Profit = Revenue - Expenses - Creator Payouts
  const netProfit = totalRevenue - totalExpenses - totalPayoutsPaid;

  return {
    revenue: totalRevenue,
    receivables: totalReceivables,
    invoiced: totalInvoiced,
    expenses: totalExpenses,
    creatorPayouts: totalPayoutsPaid,
    pendingPayouts,
    netProfit: Math.round(netProfit * 100) / 100
  };
}

module.exports = {
  listInvoices,
  recordPayment,
  recordExpense,
  listExpenses,
  createCreatorPayout,
  getPayoutById,
  listCreatorPayouts,
  updatePayoutStatus,
  getFinancialSummary
};
