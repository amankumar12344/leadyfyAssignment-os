const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');

async function createClient(data, actorId = null) {
  // CRITICAL FIX: Ensure complete data flow unification for company vs company_name
  const company_name = (data.company_name || data.company || data.brand_name || '').trim();
  const client_name = (data.client_name || data.name || '').trim();
  const email = (data.email || '').toLowerCase().trim();
  const phone = (data.phone || '').trim();
  const whatsapp = (data.whatsapp || phone || '').trim();
  const brand_name = (data.brand_name || company_name).trim();
  const industry = (data.industry || '').trim();
  const gst_tax_id = (data.gst_tax_id || data.gst || '').trim();
  const assigned_employee_id = data.assigned_employee_id || null;
  const source = data.source || 'Direct';
  const brand_kit_url = data.brand_kit_url || null;
  const status = data.status || 'NEW';

  if (!client_name) {
    throw new Error('Validation Error: client_name is required.');
  }

  if (!company_name) {
    throw new Error('Validation Error: company_name is required.');
  }

  if (!email) {
    throw new Error('Validation Error: email is required.');
  }

  // Check unique email
  const existing = await db.get("SELECT id FROM clients WHERE email = ?", [email]);
  if (existing) {
    throw new Error(`A client with email '${email}' already exists.`);
  }

  const result = await db.run(`
    INSERT INTO clients (
      client_name, company_name, email, phone, whatsapp,
      brand_name, industry, gst_tax_id, assigned_employee_id,
      source, brand_kit_url, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    client_name,
    company_name,
    email,
    phone,
    whatsapp,
    brand_name,
    industry,
    gst_tax_id,
    assigned_employee_id,
    source,
    brand_kit_url,
    status
  ]);

  const newClientId = result.lastID;
  const createdClient = await db.get(`
    SELECT c.*, e.department as assigned_department, u.full_name as assigned_employee_name
    FROM clients c
    LEFT JOIN employees e ON c.assigned_employee_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE c.id = ?
  `, [newClientId]);

  await logAudit({
    actor_id: actorId,
    action: 'CLIENT_CREATED',
    entity: 'CLIENTS',
    entity_id: newClientId,
    metadata: {
      client_name: createdClient.client_name,
      company_name: createdClient.company_name,
      email: createdClient.email
    }
  });

  // Notify assigned employee or admin
  if (assigned_employee_id) {
    const empUser = await db.get("SELECT user_id FROM employees WHERE id = ?", [assigned_employee_id]);
    if (empUser) {
      await sendNotification({
        user_id: empUser.user_id,
        title: 'New Client Assigned',
        message: `You have been assigned to newly onboarded client: ${company_name} (${client_name}).`,
        event_type: 'NEW_CLIENT',
        reference_id: newClientId
      });
    }
  }

  return createdClient;
}

async function listClients(filter = {}) {
  let query = `
    SELECT c.*, e.department as assigned_department, u.full_name as assigned_employee_name,
           (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id) as total_orders_count,
           (SELECT COUNT(*) FROM videos v WHERE v.client_id = c.id) as total_videos_count
    FROM clients c
    LEFT JOIN employees e ON c.assigned_employee_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
  `;
  const params = [];
  const conditions = [];

  if (filter.status) {
    conditions.push("c.status = ?");
    params.push(filter.status);
  }

  if (filter.search) {
    conditions.push("(c.client_name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ? OR c.brand_name LIKE ?)");
    const s = `%${filter.search}%`;
    params.push(s, s, s, s);
  }

  if (filter.clientId) {
    conditions.push("c.id = ?");
    params.push(filter.clientId);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY c.created_at DESC";

  return await db.all(query, params);
}

async function getClientById(id) {
  const client = await db.get(`
    SELECT c.*, e.department as assigned_department, u.full_name as assigned_employee_name
    FROM clients c
    LEFT JOIN employees e ON c.assigned_employee_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE c.id = ?
  `, [id]);

  if (!client) return null;

  // Aggregate 360 view
  const [orders, scripts, shoots, videos, assets, invoices, supportTickets, activityHistory] = await Promise.all([
    db.all("SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC", [id]),
    db.all("SELECT * FROM scripts WHERE client_id = ? ORDER BY created_at DESC", [id]),
    db.all(`
      SELECT sh.*, cr.name as creator_name
      FROM shoots sh
      LEFT JOIN creators cr ON sh.creator_id = cr.id
      WHERE sh.client_id = ?
      ORDER BY sh.shoot_date DESC
    `, [id]),
    db.all("SELECT * FROM videos WHERE client_id = ? ORDER BY created_at DESC", [id]),
    db.all("SELECT * FROM assets WHERE client_id = ? ORDER BY created_at DESC", [id]),
    db.all("SELECT * FROM payments WHERE client_id = ? ORDER BY created_at DESC", [id]),
    db.all("SELECT * FROM support_tickets WHERE client_id = ? ORDER BY created_at DESC", [id]),
    db.all(`
      SELECT * FROM activity_logs
      WHERE entity = 'CLIENTS' AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [id])
  ]);

  return {
    ...client,
    orders,
    scripts,
    shoots,
    videos,
    assets,
    invoices,
    supportTickets,
    activityHistory
  };
}

async function updateClient(id, data, actorId = null) {
  const existing = await db.get("SELECT * FROM clients WHERE id = ?", [id]);
  if (!existing) {
    throw new Error('Client not found.');
  }

  const company_name = (data.company_name || data.company || existing.company_name).trim();
  const client_name = (data.client_name || existing.client_name).trim();
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  const whatsapp = data.whatsapp !== undefined ? data.whatsapp : existing.whatsapp;
  const brand_name = data.brand_name !== undefined ? data.brand_name : existing.brand_name;
  const industry = data.industry !== undefined ? data.industry : existing.industry;
  const gst_tax_id = data.gst_tax_id !== undefined ? data.gst_tax_id : existing.gst_tax_id;
  const assigned_employee_id = data.assigned_employee_id !== undefined ? data.assigned_employee_id : existing.assigned_employee_id;
  const source = data.source !== undefined ? data.source : existing.source;
  const brand_kit_url = data.brand_kit_url !== undefined ? data.brand_kit_url : existing.brand_kit_url;
  const status = data.status !== undefined ? data.status : existing.status;

  await db.run(`
    UPDATE clients SET
      client_name = ?,
      company_name = ?,
      phone = ?,
      whatsapp = ?,
      brand_name = ?,
      industry = ?,
      gst_tax_id = ?,
      assigned_employee_id = ?,
      source = ?,
      brand_kit_url = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    client_name,
    company_name,
    phone,
    whatsapp,
    brand_name,
    industry,
    gst_tax_id,
    assigned_employee_id,
    source,
    brand_kit_url,
    status,
    id
  ]);

  await logAudit({
    actor_id: actorId,
    action: 'CLIENT_UPDATED',
    entity: 'CLIENTS',
    entity_id: id,
    metadata: { company_name, status }
  });

  return await getClientById(id);
}

module.exports = {
  createClient,
  listClients,
  getClientById,
  updateClient
};
