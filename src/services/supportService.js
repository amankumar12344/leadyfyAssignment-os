const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');

async function createTicket(data, actorId = null) {
  const { client_id, subject, description, priority = 'MEDIUM' } = data;

  if (!client_id) throw new Error('client_id is required.');
  if (!subject || !subject.trim()) throw new Error('Ticket subject is required.');
  if (!description || !description.trim()) throw new Error('Ticket description is required.');

  const res = await db.run(`
    INSERT INTO support_tickets (client_id, subject, description, priority, status)
    VALUES (?, ?, ?, ?, 'OPEN')
  `, [client_id, subject.trim(), description.trim(), priority]);

  const ticketId = res.lastID;

  await logAudit({
    actor_id: actorId,
    action: 'TICKET_CREATED',
    entity: 'SUPPORT_TICKETS',
    entity_id: ticketId,
    metadata: { subject, client_id, priority }
  });

  return await getTicketById(ticketId);
}

async function getTicketById(id) {
  const ticket = await db.get(`
    SELECT t.*,
           c.client_name, c.company_name, c.email as client_email,
           u.full_name as assigned_employee_name
    FROM support_tickets t
    JOIN clients c ON t.client_id = c.id
    LEFT JOIN employees e ON t.assigned_employee_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE t.id = ?
  `, [id]);

  if (!ticket) return null;

  const replies = await db.all(`
    SELECT r.*, u.full_name as sender_name, u.role as sender_role
    FROM ticket_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.ticket_id = ?
    ORDER BY r.created_at ASC
  `, [id]);

  return {
    ...ticket,
    replies
  };
}

async function listTickets(filter = {}) {
  let query = `
    SELECT t.*,
           c.client_name, c.company_name,
           u.full_name as assigned_employee_name,
           (SELECT COUNT(*) FROM ticket_replies r WHERE r.ticket_id = t.id) as reply_count
    FROM support_tickets t
    JOIN clients c ON t.client_id = c.id
    LEFT JOIN employees e ON t.assigned_employee_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
  `;
  const conditions = [];
  const params = [];

  if (filter.clientId) {
    conditions.push("t.client_id = ?");
    params.push(filter.clientId);
  }

  if (filter.status) {
    conditions.push("t.status = ?");
    params.push(filter.status);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY t.created_at DESC";

  return await db.all(query, params);
}

async function addTicketReply(ticketId, userId, message, isClient = 0) {
  if (!message || !message.trim()) throw new Error('Reply message cannot be empty.');

  await db.run(`
    INSERT INTO ticket_replies (ticket_id, user_id, message, is_client)
    VALUES (?, ?, ?, ?)
  `, [ticketId, userId, message.trim(), isClient ? 1 : 0]);

  // If client replied and ticket was resolved, reopen
  if (isClient) {
    await db.run("UPDATE support_tickets SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticketId]);
  }

  return await getTicketById(ticketId);
}

async function updateTicketStatus(id, status, assignedEmployeeId = null, actorId = null) {
  const valid = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
  if (!valid.includes(status)) throw new Error(`Invalid ticket status '${status}'.`);

  const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [status];

  if (assignedEmployeeId !== null && assignedEmployeeId !== undefined) {
    updates.push('assigned_employee_id = ?');
    params.push(assignedEmployeeId);
  }

  params.push(id);
  await db.run(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, params);

  return await getTicketById(id);
}

module.exports = {
  createTicket,
  getTicketById,
  listTickets,
  addTicketReply,
  updateTicketStatus
};
