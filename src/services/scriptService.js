const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');

const VALID_SCRIPT_STATUSES = [
  'DRAFT',
  'ASSIGNED',
  'IN_REVIEW',
  'SENT_TO_CLIENT',
  'REVISION_REQUIRED',
  'APPROVED',
  'READY_FOR_SHOOT'
];

async function createScript(data, actorId = null) {
  const {
    client_id,
    order_id,
    video_number = 1,
    title,
    language = 'English',
    script_text = '',
    reference_links = '',
    writer_id = null,
    creator_id = null,
    deadline = null,
    client_comments = null
  } = data;

  if (!client_id) throw new Error('client_id is required.');
  if (!order_id) throw new Error('order_id is required.');
  if (!title) throw new Error('Script title is required.');

  // Verify order exists
  const order = await db.get("SELECT id, client_id FROM orders WHERE id = ?", [order_id]);
  if (!order) throw new Error(`Order ${order_id} does not exist.`);
  if (order.client_id !== parseInt(client_id, 10)) {
    throw new Error('Order does not belong to specified client.');
  }

  const initialStatus = writer_id ? 'ASSIGNED' : 'DRAFT';

  const result = await db.run(`
    INSERT INTO scripts (
      client_id, order_id, video_number, title, language, script_text,
      reference_links, writer_id, creator_id, deadline, revision_count,
      status, client_comments
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    client_id,
    order_id,
    video_number,
    title,
    language,
    script_text,
    reference_links,
    writer_id,
    creator_id,
    deadline,
    initialStatus,
    client_comments
  ]);

  const scriptId = result.lastID;

  if (writer_id) {
    const writerUser = await db.get("SELECT user_id FROM employees WHERE id = ?", [writer_id]);
    if (writerUser) {
      await sendNotification({
        user_id: writerUser.user_id,
        title: 'New Script Assigned',
        message: `You have been assigned to draft script #${video_number}: "${title}".`,
        event_type: 'SCRIPT_ASSIGNED',
        reference_id: scriptId
      });
    }
  }

  await logAudit({
    actor_id: actorId,
    action: 'SCRIPT_CREATED',
    entity: 'SCRIPTS',
    entity_id: scriptId,
    metadata: { title, order_id, status: initialStatus }
  });

  return await getScriptById(scriptId);
}

async function getScriptById(id) {
  return await db.get(`
    SELECT s.*,
           c.client_name, c.company_name, c.brand_name,
           o.package_name,
           w_u.full_name as writer_name,
           cr.name as creator_name
    FROM scripts s
    JOIN clients c ON s.client_id = c.id
    JOIN orders o ON s.order_id = o.id
    LEFT JOIN employees w_emp ON s.writer_id = w_emp.id
    LEFT JOIN users w_u ON w_emp.user_id = w_u.id
    LEFT JOIN creators cr ON s.creator_id = cr.id
    WHERE s.id = ?
  `, [id]);
}

async function listScripts(filter = {}) {
  let query = `
    SELECT s.*,
           c.client_name, c.company_name, c.brand_name,
           o.package_name,
           w_u.full_name as writer_name,
           cr.name as creator_name
    FROM scripts s
    JOIN clients c ON s.client_id = c.id
    JOIN orders o ON s.order_id = o.id
    LEFT JOIN employees w_emp ON s.writer_id = w_emp.id
    LEFT JOIN users w_u ON w_emp.user_id = w_u.id
    LEFT JOIN creators cr ON s.creator_id = cr.id
  `;
  const conditions = [];
  const params = [];

  if (filter.clientId) {
    conditions.push("s.client_id = ?");
    params.push(filter.clientId);
  }

  if (filter.orderId) {
    conditions.push("s.order_id = ?");
    params.push(filter.orderId);
  }

  if (filter.writerId) {
    conditions.push("s.writer_id = ?");
    params.push(filter.writerId);
  }

  if (filter.status) {
    conditions.push("s.status = ?");
    params.push(filter.status);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY s.id DESC";

  return await db.all(query, params);
}

async function updateScript(id, data, actorId = null) {
  const existing = await getScriptById(id);
  if (!existing) throw new Error('Script not found.');

  const title = data.title !== undefined ? data.title : existing.title;
  const script_text = data.script_text !== undefined ? data.script_text : existing.script_text;
  const reference_links = data.reference_links !== undefined ? data.reference_links : existing.reference_links;
  const writer_id = data.writer_id !== undefined ? data.writer_id : existing.writer_id;
  const creator_id = data.creator_id !== undefined ? data.creator_id : existing.creator_id;
  const deadline = data.deadline !== undefined ? data.deadline : existing.deadline;
  const language = data.language !== undefined ? data.language : existing.language;
  let status = data.status !== undefined ? data.status : existing.status;
  const client_comments = data.client_comments !== undefined ? data.client_comments : existing.client_comments;

  if (data.status && !VALID_SCRIPT_STATUSES.includes(data.status)) {
    throw new Error(`Invalid status '${data.status}'. Must be one of: ${VALID_SCRIPT_STATUSES.join(', ')}`);
  }

  await db.run(`
    UPDATE scripts SET
      title = ?,
      script_text = ?,
      reference_links = ?,
      writer_id = ?,
      creator_id = ?,
      deadline = ?,
      language = ?,
      status = ?,
      client_comments = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    title,
    script_text,
    reference_links,
    writer_id,
    creator_id,
    deadline,
    language,
    status,
    client_comments,
    id
  ]);

  await logAudit({
    actor_id: actorId,
    action: 'SCRIPT_UPDATED',
    entity: 'SCRIPTS',
    entity_id: id,
    metadata: { status, title }
  });

  return await getScriptById(id);
}

async function clientApproveScript(id, clientId, comments = '', actorId = null) {
  const script = await getScriptById(id);
  if (!script) throw new Error('Script not found.');
  if (script.client_id !== clientId) {
    throw new Error('Access denied. You do not own this script.');
  }

  await db.run(`
    UPDATE scripts SET
      status = 'APPROVED',
      client_comments = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [comments || 'Approved by client.', id]);

  await logAudit({
    actor_id: actorId,
    action: 'SCRIPT_APPROVED',
    entity: 'SCRIPTS',
    entity_id: id,
    metadata: { script_title: script.title, comments }
  });

  // Notify writer / shoot manager
  if (script.writer_id) {
    const writerUser = await db.get("SELECT user_id FROM employees WHERE id = ?", [script.writer_id]);
    if (writerUser) {
      await sendNotification({
        user_id: writerUser.user_id,
        title: 'Script Approved by Client!',
        message: `Client approved script: "${script.title}". Ready for shoot scheduling.`,
        event_type: 'SCRIPT_APPROVED',
        reference_id: id
      });
    }
  }

  return await getScriptById(id);
}

async function clientRequestRevision(id, clientId, comments, actorId = null) {
  if (!comments || !comments.trim()) {
    throw new Error('Revision comments are required explaining what needs to be changed.');
  }

  const script = await getScriptById(id);
  if (!script) throw new Error('Script not found.');
  if (script.client_id !== clientId) {
    throw new Error('Access denied. You do not own this script.');
  }

  await db.run(`
    UPDATE scripts SET
      status = 'REVISION_REQUIRED',
      revision_count = revision_count + 1,
      client_comments = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [comments.trim(), id]);

  await logAudit({
    actor_id: actorId,
    action: 'SCRIPT_REVISION_REQUESTED',
    entity: 'SCRIPTS',
    entity_id: id,
    metadata: { script_title: script.title, comments }
  });

  // Notify writer
  if (script.writer_id) {
    const writerUser = await db.get("SELECT user_id FROM employees WHERE id = ?", [script.writer_id]);
    if (writerUser) {
      await sendNotification({
        user_id: writerUser.user_id,
        title: 'Script Revision Requested',
        message: `Client requested revision on script: "${script.title}". Notes: ${comments.trim()}`,
        event_type: 'SCRIPT_REVISION',
        reference_id: id
      });
    }
  }

  return await getScriptById(id);
}

module.exports = {
  createScript,
  getScriptById,
  listScripts,
  updateScript,
  clientApproveScript,
  clientRequestRevision
};
