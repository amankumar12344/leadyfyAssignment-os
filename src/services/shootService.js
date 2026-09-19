const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');
const { checkDoubleBooking } = require('./creatorService');

const VALID_SHOOT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESHOOT_REQUIRED'
];

async function scheduleShoot(data, actorId = null) {
  const {
    client_id,
    order_id,
    shoot_date,
    shoot_time,
    location,
    creator_id,
    cameraman = null,
    shoot_manager_id = null,
    assistant = null,
    approved_scripts_summary = '',
    special_notes = '',
    status = 'SCHEDULED',
    pre_shoot_checklist = null,
    post_shoot_checklist = null
  } = data;

  if (!client_id) throw new Error('client_id is required.');
  if (!order_id) throw new Error('order_id is required.');
  if (!shoot_date || !shoot_time) throw new Error('shoot_date and shoot_time are required.');
  if (!location) throw new Error('location is required.');
  if (!creator_id) throw new Error('creator_id is required.');

  // PREVENT DOUBLE BOOKING: Check if creator is already booked on this shoot date
  const conflicts = await checkDoubleBooking(creator_id, shoot_date, shoot_time);
  if (conflicts.length > 0) {
    const conflict = conflicts[0];
    throw new Error(
      `Double Booking Detected: Creator is already scheduled for Shoot #${conflict.id} on ${conflict.shoot_date} at ${conflict.shoot_time} (${conflict.location}).`
    );
  }

  const defaultPreChecklist = JSON.stringify(pre_shoot_checklist || {
    scriptApproved: true,
    creatorConfirmed: false,
    locationPermission: false,
    productReceived: false,
    teamBriefing: false
  });

  const defaultPostChecklist = JSON.stringify(post_shoot_checklist || {
    footageUploaded: false,
    rawFootageVerified: false,
    reshootNeeded: false
  });

  const res = await db.run(`
    INSERT INTO shoots (
      client_id, order_id, shoot_date, shoot_time, location, creator_id,
      cameraman, shoot_manager_id, assistant, approved_scripts_summary,
      special_notes, status, pre_shoot_checklist, post_shoot_checklist
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    client_id,
    order_id,
    shoot_date,
    shoot_time,
    location,
    creator_id,
    cameraman,
    shoot_manager_id,
    assistant,
    approved_scripts_summary,
    special_notes,
    status,
    defaultPreChecklist,
    defaultPostChecklist
  ]);

  const shootId = res.lastID;

  // Insert creator availability slot
  await db.run(`
    INSERT INTO creator_availability (creator_id, shoot_id, booked_from, booked_to, status, notes)
    VALUES (?, ?, ?, ?, 'BOOKED', ?)
  `, [
    creator_id,
    shootId,
    `${shoot_date} ${shoot_time}`,
    `${shoot_date} 23:59:59`,
    `Booked for Shoot #${shootId}`
  ]);

  // Update creator status to BOOKED
  await db.run("UPDATE creators SET availability_status = 'BOOKED' WHERE id = ?", [creator_id]);

  await logAudit({
    actor_id: actorId,
    action: 'SHOOT_CREATED',
    entity: 'SHOOTS',
    entity_id: shootId,
    metadata: { shoot_date, shoot_time, location, creator_id }
  });

  // Notify shoot manager
  if (shoot_manager_id) {
    const mgrUser = await db.get("SELECT user_id FROM employees WHERE id = ?", [shoot_manager_id]);
    if (mgrUser) {
      await sendNotification({
        user_id: mgrUser.user_id,
        title: 'Shoot Scheduled',
        message: `Shoot #${shootId} has been scheduled for ${shoot_date} at ${location}.`,
        event_type: 'SHOOT_REMINDER',
        reference_id: shootId
      });
    }
  }

  return await getShootById(shootId);
}

async function getShootById(id) {
  const shoot = await db.get(`
    SELECT sh.*,
           c.client_name, c.company_name, c.brand_name,
           o.package_name,
           cr.name as creator_name, cr.photo_url as creator_photo, cr.phone as creator_phone,
           sm_u.full_name as shoot_manager_name
    FROM shoots sh
    JOIN clients c ON sh.client_id = c.id
    JOIN orders o ON sh.order_id = o.id
    JOIN creators cr ON sh.creator_id = cr.id
    LEFT JOIN employees sm_emp ON sh.shoot_manager_id = sm_emp.id
    LEFT JOIN users sm_u ON sm_emp.user_id = sm_u.id
    WHERE sh.id = ?
  `, [id]);

  if (!shoot) return null;

  try {
    shoot.pre_shoot_checklist = JSON.parse(shoot.pre_shoot_checklist);
    shoot.post_shoot_checklist = JSON.parse(shoot.post_shoot_checklist);
  } catch (e) {}

  return shoot;
}

async function listShoots(filter = {}) {
  let query = `
    SELECT sh.*,
           c.client_name, c.company_name, c.brand_name,
           o.package_name,
           cr.name as creator_name,
           sm_u.full_name as shoot_manager_name
    FROM shoots sh
    JOIN clients c ON sh.client_id = c.id
    JOIN orders o ON sh.order_id = o.id
    JOIN creators cr ON sh.creator_id = cr.id
    LEFT JOIN employees sm_emp ON sh.shoot_manager_id = sm_emp.id
    LEFT JOIN users sm_u ON sm_emp.user_id = sm_u.id
  `;
  const conditions = [];
  const params = [];

  if (filter.clientId) {
    conditions.push("sh.client_id = ?");
    params.push(filter.clientId);
  }

  if (filter.creatorId) {
    conditions.push("sh.creator_id = ?");
    params.push(filter.creatorId);
  }

  if (filter.status) {
    conditions.push("sh.status = ?");
    params.push(filter.status);
  }

  if (filter.fromDate && filter.toDate) {
    conditions.push("sh.shoot_date BETWEEN ? AND ?");
    params.push(filter.fromDate, filter.toDate);
  } else if (filter.date) {
    conditions.push("sh.shoot_date = ?");
    params.push(filter.date);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY sh.shoot_date ASC, sh.shoot_time ASC";

  const rows = await db.all(query, params);
  return rows.map(r => {
    try {
      r.pre_shoot_checklist = JSON.parse(r.pre_shoot_checklist);
      r.post_shoot_checklist = JSON.parse(r.post_shoot_checklist);
    } catch (e) {}
    return r;
  });
}

async function updateShoot(id, data, actorId = null) {
  const existing = await getShootById(id);
  if (!existing) throw new Error('Shoot not found.');

  if (data.creator_id && data.shoot_date && (data.creator_id !== existing.creator_id || data.shoot_date !== existing.shoot_date)) {
    const conflicts = await checkDoubleBooking(data.creator_id, data.shoot_date, data.shoot_time || existing.shoot_time, id);
    if (conflicts.length > 0) {
      throw new Error(`Double Booking Detected: Creator is already scheduled for Shoot #${conflicts[0].id} on ${data.shoot_date}.`);
    }
  }

  const shoot_date = data.shoot_date || existing.shoot_date;
  const shoot_time = data.shoot_time || existing.shoot_time;
  const location = data.location || existing.location;
  const creator_id = data.creator_id || existing.creator_id;
  const cameraman = data.cameraman !== undefined ? data.cameraman : existing.cameraman;
  const shoot_manager_id = data.shoot_manager_id !== undefined ? data.shoot_manager_id : existing.shoot_manager_id;
  const assistant = data.assistant !== undefined ? data.assistant : existing.assistant;
  const approved_scripts_summary = data.approved_scripts_summary !== undefined ? data.approved_scripts_summary : existing.approved_scripts_summary;
  const special_notes = data.special_notes !== undefined ? data.special_notes : existing.special_notes;
  const status = data.status || existing.status;

  const pre_shoot_checklist = data.pre_shoot_checklist
    ? JSON.stringify(data.pre_shoot_checklist)
    : (typeof existing.pre_shoot_checklist === 'object' ? JSON.stringify(existing.pre_shoot_checklist) : existing.pre_shoot_checklist);

  const post_shoot_checklist = data.post_shoot_checklist
    ? JSON.stringify(data.post_shoot_checklist)
    : (typeof existing.post_shoot_checklist === 'object' ? JSON.stringify(existing.post_shoot_checklist) : existing.post_shoot_checklist);

  if (data.status && !VALID_SHOOT_STATUSES.includes(data.status)) {
    throw new Error(`Invalid status '${data.status}'.`);
  }

  await db.run(`
    UPDATE shoots SET
      shoot_date = ?,
      shoot_time = ?,
      location = ?,
      creator_id = ?,
      cameraman = ?,
      shoot_manager_id = ?,
      assistant = ?,
      approved_scripts_summary = ?,
      special_notes = ?,
      status = ?,
      pre_shoot_checklist = ?,
      post_shoot_checklist = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    shoot_date,
    shoot_time,
    location,
    creator_id,
    cameraman,
    shoot_manager_id,
    assistant,
    approved_scripts_summary,
    special_notes,
    status,
    pre_shoot_checklist,
    post_shoot_checklist,
    id
  ]);

  if (status === 'COMPLETED' || status === 'CANCELLED') {
    await db.run("UPDATE creators SET availability_status = 'AVAILABLE' WHERE id = ?", [creator_id]);
    await db.run("UPDATE creator_availability SET status = 'AVAILABLE' WHERE shoot_id = ?", [id]);
  }

  await logAudit({
    actor_id: actorId,
    action: 'SHOOT_UPDATED',
    entity: 'SHOOTS',
    entity_id: id,
    metadata: { status, shoot_date }
  });

  return await getShootById(id);
}

module.exports = {
  scheduleShoot,
  getShootById,
  listShoots,
  updateShoot
};
