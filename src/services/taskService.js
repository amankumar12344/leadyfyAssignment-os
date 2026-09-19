const db = require('../database/db');
const { logAudit } = require('./auditService');

async function createTask(data, actorId = null) {
  const {
    title,
    description = '',
    assigned_user_id = null,
    priority = 'MEDIUM',
    status = 'TODO',
    deadline = null,
    attachment_url = null,
    order_id = null
  } = data;

  if (!title || !title.trim()) throw new Error('Task title is required.');

  const res = await db.run(`
    INSERT INTO tasks (
      title, description, assigned_user_id, priority, status,
      deadline, attachment_url, order_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    title.trim(),
    description,
    assigned_user_id,
    priority,
    status,
    deadline,
    attachment_url,
    order_id
  ]);

  await logAudit({
    actor_id: actorId,
    action: 'TASK_CREATED',
    entity: 'TASKS',
    entity_id: res.lastID,
    metadata: { title, priority, status }
  });

  return await getTaskById(res.lastID);
}

async function getTaskById(id) {
  return await db.get(`
    SELECT t.*, u.full_name as assigned_user_name, u.email as assigned_user_email
    FROM tasks t
    LEFT JOIN users u ON t.assigned_user_id = u.id
    WHERE t.id = ?
  `, [id]);
}

async function listTasks(filter = {}) {
  let query = `
    SELECT t.*, u.full_name as assigned_user_name, u.email as assigned_user_email,
           o.package_name, c.company_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_user_id = u.id
    LEFT JOIN orders o ON t.order_id = o.id
    LEFT JOIN clients c ON o.client_id = c.id
  `;
  const conditions = [];
  const params = [];

  if (filter.assignedUserId) {
    conditions.push("t.assigned_user_id = ?");
    params.push(filter.assignedUserId);
  }

  if (filter.status) {
    conditions.push("t.status = ?");
    params.push(filter.status);
  }

  if (filter.priority) {
    conditions.push("t.priority = ?");
    params.push(filter.priority);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, t.deadline ASC, t.id DESC";

  return await db.all(query, params);
}

async function updateTask(id, data, actorId = null) {
  const existing = await getTaskById(id);
  if (!existing) throw new Error('Task not found.');

  const title = data.title !== undefined ? data.title : existing.title;
  const description = data.description !== undefined ? data.description : existing.description;
  const assigned_user_id = data.assigned_user_id !== undefined ? data.assigned_user_id : existing.assigned_user_id;
  const priority = data.priority !== undefined ? data.priority : existing.priority;
  const status = data.status !== undefined ? data.status : existing.status;
  const deadline = data.deadline !== undefined ? data.deadline : existing.deadline;

  await db.run(`
    UPDATE tasks SET
      title = ?,
      description = ?,
      assigned_user_id = ?,
      priority = ?,
      status = ?,
      deadline = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [title, description, assigned_user_id, priority, status, deadline, id]);

  return await getTaskById(id);
}

module.exports = {
  createTask,
  getTaskById,
  listTasks,
  updateTask
};
