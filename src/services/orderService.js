const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');

async function createOrder(data, actorId = null) {
  const {
    client_id,
    package_name,
    video_count,
    pricing,
    gst_rate = 18.0,
    start_date,
    due_date,
    assigned_team_id = null
  } = data;

  if (!client_id) throw new Error('client_id is required.');
  if (!package_name) throw new Error('package_name is required.');
  if (!video_count || parseInt(video_count, 10) <= 0) throw new Error('video_count must be greater than 0.');
  if (pricing === undefined || parseFloat(pricing) < 0) throw new Error('pricing must be valid non-negative number.');
  if (!start_date || !due_date) throw new Error('start_date and due_date are required.');

  // Verify client exists and get company_name
  const client = await db.get("SELECT id, client_name, company_name, email FROM clients WHERE id = ?", [client_id]);
  if (!client) throw new Error(`Client with id ${client_id} does not exist.`);

  const numericPricing = parseFloat(pricing);
  const numericGstRate = parseFloat(gst_rate);
  const gst_amount = Math.round((numericPricing * numericGstRate / 100) * 100) / 100;
  const total_amount = numericPricing + gst_amount;
  const amount_received = parseFloat(data.amount_received || 0);
  const outstanding_balance = total_amount - amount_received;
  const status = data.status || 'NEW';

  const orderResult = await db.run(`
    INSERT INTO orders (
      client_id, package_name, video_count, pricing, gst_rate, gst_amount,
      total_amount, amount_received, outstanding_balance, start_date, due_date,
      status, assigned_team_id, assigned_videos_count, completed_videos_count, delivered_videos_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
  `, [
    client_id,
    package_name,
    parseInt(video_count, 10),
    numericPricing,
    numericGstRate,
    gst_amount,
    total_amount,
    amount_received,
    outstanding_balance,
    start_date,
    due_date,
    status,
    assigned_team_id
  ]);

  const newOrderId = orderResult.lastID;

  // Auto-generate invoice
  const invNumber = `INV-${new Date().getFullYear()}-${String(newOrderId).padStart(4, '0')}`;
  await db.run(`
    INSERT INTO payments (
      client_id, order_id, invoice_number, invoice_amount, amount_received,
      outstanding_balance, payment_date, payment_method, notes, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    client_id,
    newOrderId,
    invNumber,
    total_amount,
    amount_received,
    outstanding_balance,
    amount_received > 0 ? start_date : null,
    amount_received > 0 ? (data.payment_method || 'Bank Transfer') : null,
    `Initial invoice generated for order: ${package_name}`,
    amount_received >= total_amount ? 'PAID' : (amount_received > 0 ? 'PARTIALLY_PAID' : 'UNPAID')
  ]);

  await logAudit({
    actor_id: actorId,
    action: 'ORDER_CREATED',
    entity: 'ORDERS',
    entity_id: newOrderId,
    metadata: {
      client_id,
      company_name: client.company_name,
      package_name,
      video_count,
      total_amount
    }
  });

  return await getOrderById(newOrderId);
}

async function getOrderById(id) {
  const order = await db.get(`
    SELECT o.*,
           c.client_name, c.company_name, c.email as client_email, c.brand_name,
           e.department as assigned_team_department, u.full_name as assigned_team_lead
    FROM orders o
    JOIN clients c ON o.client_id = c.id
    LEFT JOIN employees e ON o.assigned_team_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE o.id = ?
  `, [id]);

  if (!order) return null;

  // Compute live quota counters
  const remaining_quota = Math.max(0, order.video_count - order.completed_videos_count);

  // Fetch associated child resources
  const [scripts, shoots, videos, payments] = await Promise.all([
    db.all("SELECT * FROM scripts WHERE order_id = ? ORDER BY video_number ASC", [id]),
    db.all("SELECT sh.*, cr.name as creator_name FROM shoots sh LEFT JOIN creators cr ON sh.creator_id = cr.id WHERE sh.order_id = ? ORDER BY sh.shoot_date DESC", [id]),
    db.all("SELECT v.*, cr.name as creator_name, e_u.full_name as editor_name FROM videos v LEFT JOIN creators cr ON v.creator_id = cr.id LEFT JOIN employees emp ON v.assigned_editor_id = emp.id LEFT JOIN users e_u ON emp.user_id = e_u.id WHERE v.order_id = ? ORDER BY v.id ASC", [id]),
    db.all("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC", [id])
  ]);

  return {
    ...order,
    remaining_quota,
    scripts,
    shoots,
    videos,
    payments
  };
}

async function listOrders(filter = {}) {
  let query = `
    SELECT o.*,
           c.client_name, c.company_name, c.brand_name,
           e.department as assigned_team_department, u.full_name as assigned_team_lead,
           (o.video_count - o.completed_videos_count) as remaining_quota
    FROM orders o
    JOIN clients c ON o.client_id = c.id
    LEFT JOIN employees e ON o.assigned_team_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
  `;
  const conditions = [];
  const params = [];

  if (filter.clientId) {
    conditions.push("o.client_id = ?");
    params.push(filter.clientId);
  }

  if (filter.status) {
    conditions.push("o.status = ?");
    params.push(filter.status);
  }

  if (filter.search) {
    conditions.push("(c.company_name LIKE ? OR c.client_name LIKE ? OR o.package_name LIKE ?)");
    const s = `%${filter.search}%`;
    params.push(s, s, s);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY o.created_at DESC";

  return await db.all(query, params);
}

async function syncOrderCounters(orderId) {
  // Live counts calculated from actual videos records
  const stats = await db.get(`
    SELECT
      COUNT(id) as total_videos,
      SUM(CASE WHEN assigned_editor_id IS NOT NULL THEN 1 ELSE 0 END) as assigned_count,
      SUM(CASE WHEN status IN ('FINAL_APPROVED', 'DELIVERED') THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count
    FROM videos
    WHERE order_id = ?
  `, [orderId]);

  const assigned = stats.assigned_count || 0;
  const completed = stats.completed_count || 0;
  const delivered = stats.delivered_count || 0;

  const order = await db.get("SELECT video_count, status FROM orders WHERE id = ?", [orderId]);
  if (!order) return;

  let newStatus = order.status;
  if (delivered >= order.video_count) {
    newStatus = 'COMPLETED';
  } else if (delivered > 0) {
    newStatus = 'PARTIALLY_DELIVERED';
  } else if (completed > 0 || assigned > 0) {
    if (order.status === 'NEW' || order.status === 'ONBOARDING') {
      newStatus = 'IN_PRODUCTION';
    }
  }

  await db.run(`
    UPDATE orders SET
      assigned_videos_count = ?,
      completed_videos_count = ?,
      delivered_videos_count = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [assigned, completed, delivered, newStatus, orderId]);
}

async function updateOrderStatus(id, status, actorId = null) {
  const validStatuses = ['NEW', 'ONBOARDING', 'IN_PRODUCTION', 'PARTIALLY_DELIVERED', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid order status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  await db.run("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
  await logAudit({
    actor_id: actorId,
    action: 'ORDER_STATUS_CHANGED',
    entity: 'ORDERS',
    entity_id: id,
    metadata: { status }
  });

  return await getOrderById(id);
}

module.exports = {
  createOrder,
  getOrderById,
  listOrders,
  syncOrderCounters,
  updateOrderStatus
};
