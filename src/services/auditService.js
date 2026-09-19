const db = require('../database/db');

async function logAudit({ actor_id, action, entity, entity_id, metadata, ip_address = '127.0.0.1' }) {
  try {
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    await db.run(`
      INSERT INTO activity_logs (actor_id, action, entity, entity_id, metadata, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [actor_id || null, action, entity, entity_id || null, metaStr || null, ip_address]);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

async function listAuditLogs(limit = 50) {
  return await db.all(`
    SELECT l.*, u.full_name as actor_name, u.email as actor_email, u.role as actor_role
    FROM activity_logs l
    LEFT JOIN users u ON l.actor_id = u.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `, [limit]);
}

module.exports = {
  logAudit,
  listAuditLogs
};
