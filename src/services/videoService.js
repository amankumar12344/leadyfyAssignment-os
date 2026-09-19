const db = require('../database/db');
const { logAudit } = require('./auditService');
const { sendNotification } = require('./notificationService');
const { syncOrderCounters } = require('./orderService');

const ALLOWED_TRANSITIONS = {
  'SCRIPT_APPROVED': ['SHOOT_PENDING'],
  'SHOOT_PENDING': ['RAW_FOOTAGE_RECEIVED'],
  'RAW_FOOTAGE_RECEIVED': ['VIDEO_EDITING'],
  'VIDEO_EDITING': ['INTERNAL_QA'],
  'INTERNAL_QA': ['CLIENT_REVIEW', 'VIDEO_EDITING'],
  'CLIENT_REVIEW': ['FINAL_APPROVED', 'REVISION'],
  'REVISION': ['VIDEO_EDITING'],
  'FINAL_APPROVED': ['DELIVERED'],
  'DELIVERED': [] // Terminal state
};

async function createVideo(data, actorId = null) {
  const {
    client_id,
    order_id,
    script_id = null,
    creator_id = null,
    shoot_id = null,
    assigned_editor_id = null,
    title,
    deadline = null,
    raw_footage_url = null,
    draft_video_url = null,
    thumbnail_url = null,
    status = 'SCRIPT_APPROVED'
  } = data;

  if (!client_id) throw new Error('client_id is required.');
  if (!order_id) throw new Error('order_id is required.');
  if (!title || !title.trim()) throw new Error('Video title is required.');

  // Validate order
  const order = await db.get("SELECT id, video_count, completed_videos_count FROM orders WHERE id = ?", [order_id]);
  if (!order) throw new Error(`Order ${order_id} does not exist.`);

  const res = await db.run(`
    INSERT INTO videos (
      client_id, order_id, script_id, creator_id, shoot_id,
      assigned_editor_id, title, status, deadline,
      raw_footage_url, draft_video_url, thumbnail_url,
      revision_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [
    client_id,
    order_id,
    script_id,
    creator_id,
    shoot_id,
    assigned_editor_id,
    title.trim(),
    status,
    deadline,
    raw_footage_url,
    draft_video_url,
    thumbnail_url
  ]);

  const newVideoId = res.lastID;

  await syncOrderCounters(order_id);

  await logAudit({
    actor_id: actorId,
    action: 'VIDEO_CREATED',
    entity: 'VIDEOS',
    entity_id: newVideoId,
    metadata: { title, order_id, status }
  });

  return await getVideoById(newVideoId);
}

async function getVideoById(id) {
  const video = await db.get(`
    SELECT v.*,
           c.client_name, c.company_name, c.brand_name,
           o.package_name,
           cr.name as creator_name, cr.photo_url as creator_photo,
           s.title as script_title,
           ed_u.full_name as editor_name, ed_u.email as editor_email
    FROM videos v
    JOIN clients c ON v.client_id = c.id
    JOIN orders o ON v.order_id = o.id
    LEFT JOIN creators cr ON v.creator_id = cr.id
    LEFT JOIN scripts s ON v.script_id = s.id
    LEFT JOIN employees ed_emp ON v.assigned_editor_id = ed_emp.id
    LEFT JOIN users ed_u ON ed_emp.user_id = ed_u.id
    WHERE v.id = ?
  `, [id]);

  if (!video) return null;

  // Retrieve full feedback history
  const feedbackHistory = await db.all(`
    SELECT f.*, c.client_name, c.company_name
    FROM video_feedback f
    JOIN clients c ON f.client_id = c.id
    WHERE f.video_id = ?
    ORDER BY f.revision_number ASC, f.created_at ASC
  `, [id]);

  return {
    ...video,
    feedbackHistory
  };
}

async function listVideos(filter = {}) {
  let query = `
    SELECT v.*,
           c.client_name, c.company_name, c.brand_name,
           o.package_name,
           cr.name as creator_name,
           ed_u.full_name as editor_name
    FROM videos v
    JOIN clients c ON v.client_id = c.id
    JOIN orders o ON v.order_id = o.id
    LEFT JOIN creators cr ON v.creator_id = cr.id
    LEFT JOIN employees ed_emp ON v.assigned_editor_id = ed_emp.id
    LEFT JOIN users ed_u ON ed_emp.user_id = ed_u.id
  `;
  const conditions = [];
  const params = [];

  if (filter.clientId) {
    conditions.push("v.client_id = ?");
    params.push(filter.clientId);
  }

  if (filter.orderId) {
    conditions.push("v.order_id = ?");
    params.push(filter.orderId);
  }

  if (filter.editorId) {
    conditions.push("v.assigned_editor_id = ?");
    params.push(filter.editorId);
  }

  if (filter.status) {
    conditions.push("v.status = ?");
    params.push(filter.status);
  }

  if (filter.search) {
    conditions.push("(v.title LIKE ? OR c.company_name LIKE ?)");
    const s = `%${filter.search}%`;
    params.push(s, s);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY v.id DESC";

  return await db.all(query, params);
}

// STRICT SERVER-SIDE STATE MACHINE TRANSITIONS
async function transitionVideoStatus(id, targetStatus, actorId = null, extraData = {}) {
  const video = await getVideoById(id);
  if (!video) throw new Error('Video not found.');

  const currentStatus = video.status;

  if (currentStatus === targetStatus) {
    return video; // No-op idempotent transition
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    throw new Error(
      `Invalid state transition: Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions from '${currentStatus}' are: [${allowedNext.join(', ')}]`
    );
  }

  const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [targetStatus];

  if (extraData.draft_video_url) {
    updates.push('draft_video_url = ?');
    params.push(extraData.draft_video_url);
  }

  if (extraData.thumbnail_url) {
    updates.push('thumbnail_url = ?');
    params.push(extraData.thumbnail_url);
  }

  if (extraData.raw_footage_url) {
    updates.push('raw_footage_url = ?');
    params.push(extraData.raw_footage_url);
  }

  if (extraData.assigned_editor_id) {
    updates.push('assigned_editor_id = ?');
    params.push(extraData.assigned_editor_id);
  }

  if (targetStatus === 'FINAL_APPROVED') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }

  params.push(id);

  await db.run(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`, params);

  await syncOrderCounters(video.order_id);

  await logAudit({
    actor_id: actorId,
    action: 'VIDEO_STATUS_CHANGED',
    entity: 'VIDEOS',
    entity_id: id,
    metadata: {
      from: currentStatus,
      to: targetStatus,
      title: video.title
    }
  });

  // Notify client if transitioning to CLIENT_REVIEW
  if (targetStatus === 'CLIENT_REVIEW') {
    const clientUser = await db.get("SELECT user_id FROM clients WHERE id = ?", [video.client_id]);
    if (clientUser && clientUser.user_id) {
      await sendNotification({
        user_id: clientUser.user_id,
        title: 'Draft Video Ready for Review',
        message: `Video "${video.title}" is ready for your review and approval in the portal.`,
        event_type: 'CLIENT_REVIEW',
        reference_id: id
      });
    }
  }

  return await getVideoById(id);
}

// CLIENT VIDEO REVIEW & REVISION
async function clientApproveVideo(id, clientId, actorId = null) {
  const video = await getVideoById(id);
  if (!video) throw new Error('Video not found.');
  if (video.client_id !== clientId) {
    throw new Error('Access denied. You do not own this video asset.');
  }

  if (video.status !== 'CLIENT_REVIEW') {
    throw new Error(`Video is in status '${video.status}', not 'CLIENT_REVIEW'. Approval cannot be processed.`);
  }

  return await transitionVideoStatus(id, 'FINAL_APPROVED', actorId);
}

async function clientRequestVideoRevision(id, clientId, feedbackItems = [], actorId = null) {
  const video = await getVideoById(id);
  if (!video) throw new Error('Video not found.');
  if (video.client_id !== clientId) {
    throw new Error('Access denied. You do not own this video asset.');
  }

  if (video.status !== 'CLIENT_REVIEW') {
    throw new Error(`Video is in status '${video.status}', not 'CLIENT_REVIEW'. Revisions can only be submitted during review.`);
  }

  if (!feedbackItems || feedbackItems.length === 0) {
    throw new Error('Please provide at least one timestamped feedback comment for revision.');
  }

  const newRevisionNumber = (video.revision_count || 0) + 1;

  await db.transaction(async () => {
    // 1. Insert feedback logs (preserve previous feedback)
    for (const item of feedbackItems) {
      await db.run(`
        INSERT INTO video_feedback (video_id, client_id, revision_number, timestamp_seconds, comment)
        VALUES (?, ?, ?, ?, ?)
      `, [
        id,
        clientId,
        newRevisionNumber,
        parseFloat(item.timestamp_seconds || 0),
        item.comment.trim()
      ]);
    }

    // 2. Increment revision count and transition status to REVISION
    await db.run(`
      UPDATE videos SET
        status = 'REVISION',
        revision_count = revision_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    // 3. Mark priority task for assigned editor
    if (video.assigned_editor_id) {
      const editor = await db.get("SELECT user_id FROM employees WHERE id = ?", [video.assigned_editor_id]);
      if (editor) {
        await db.run(`
          INSERT INTO tasks (title, description, assigned_user_id, priority, status, deadline, order_id)
          VALUES (?, ?, ?, 'URGENT', 'TODO', date('now', '+2 days'), ?)
        `, [
          `Revision #${newRevisionNumber}: ${video.title}`,
          `Client requested revision #${newRevisionNumber} with ${feedbackItems.length} specific timestamped notes.`,
          editor.user_id,
          video.order_id
        ]);

        await sendNotification({
          user_id: editor.user_id,
          title: 'Urgent Video Revision Requested',
          message: `Client requested Revision #${newRevisionNumber} on "${video.title}". Priority: URGENT.`,
          event_type: 'CLIENT_FEEDBACK',
          reference_id: id
        });
      }
    }

    await logAudit({
      actor_id: actorId,
      action: 'CLIENT_FEEDBACK_CREATED',
      entity: 'VIDEOS',
      entity_id: id,
      metadata: {
        revision_number: newRevisionNumber,
        comments_count: feedbackItems.length
      }
    });
  });

  return await getVideoById(id);
}

// FINAL DELIVERY: TRANSACTIONAL & IDEMPOTENT
async function deliverFinalVideo(id, deliveryLink, actorId = null) {
  if (!deliveryLink || !deliveryLink.trim()) {
    throw new Error('A valid final delivery link (e.g. Google Drive / Cloud Storage URL) is required.');
  }

  const video = await getVideoById(id);
  if (!video) throw new Error('Video not found.');

  // IDEMPOTENCY CHECK: If already DELIVERED, return without double-counting!
  if (video.status === 'DELIVERED') {
    return {
      video,
      alreadyDelivered: true,
      message: 'Video was already delivered. No quota modification or double-counting occurred.'
    };
  }

  // Enforce state machine prerequisite
  if (video.status !== 'FINAL_APPROVED') {
    throw new Error(
      `Delivery Rejected: Video must be in 'FINAL_APPROVED' state before final delivery. Current status: '${video.status}'.`
    );
  }

  let updatedVideo = null;

  await db.transaction(async () => {
    // 1. Mark video DELIVERED and save permanent delivery link
    await db.run(`
      UPDATE videos SET
        status = 'DELIVERED',
        final_delivery_link = ?,
        delivered_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [deliveryLink.trim(), id]);

    // 2. Safely sync order counters: increment completed count, decrement remaining quota
    await syncOrderCounters(video.order_id);

    // 3. Expose final asset to client assets library
    await db.run(`
      INSERT INTO assets (client_id, order_id, asset_type, name, file_url, uploaded_by)
      VALUES (?, ?, 'FINAL_VIDEO', ?, ?, ?)
    `, [
      video.client_id,
      video.order_id,
      video.title,
      deliveryLink.trim(),
      actorId
    ]);

    // 4. Create persistent audit log
    await logAudit({
      actor_id: actorId,
      action: 'VIDEO_DELIVERED',
      entity: 'VIDEOS',
      entity_id: id,
      metadata: {
        title: video.title,
        order_id: video.order_id,
        delivery_link: deliveryLink.trim()
      }
    });

    // 5. Notify client
    const clientUser = await db.get("SELECT user_id FROM clients WHERE id = ?", [video.client_id]);
    if (clientUser && clientUser.user_id) {
      await sendNotification({
        user_id: clientUser.user_id,
        title: 'Master Video Delivered!',
        message: `Your final video "${video.title}" has been delivered and is available for high-res download.`,
        event_type: 'VIDEO_DELIVERED',
        reference_id: id
      });
    }
  });

  updatedVideo = await getVideoById(id);
  return {
    video: updatedVideo,
    alreadyDelivered: false,
    message: 'Video successfully delivered and added to client asset library.'
  };
}

module.exports = {
  createVideo,
  getVideoById,
  listVideos,
  transitionVideoStatus,
  clientApproveVideo,
  clientRequestVideoRevision,
  deliverFinalVideo
};
