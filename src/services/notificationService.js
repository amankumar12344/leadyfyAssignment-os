const db = require('../database/db');

async function sendNotification({ user_id, title, message, event_type, reference_id }) {
  try {
    // Check duplicate notification within last 1 hour
    const existing = await db.get(`
      SELECT id FROM notifications
      WHERE user_id = ? AND event_type = ? AND reference_id = ?
        AND created_at >= datetime('now', '-1 hour')
    `, [user_id, event_type, reference_id || 0]);

    if (existing) {
      // Avoid duplicate alert
      return null;
    }

    const res = await db.run(`
      INSERT INTO notifications (user_id, title, message, event_type, reference_id)
      VALUES (?, ?, ?, ?, ?)
    `, [user_id, title, message, event_type, reference_id || null]);

    return res.lastID;
  } catch (err) {
    console.error('Failed to dispatch notification:', err.message);
    return null;
  }
}

async function getUserNotifications(userId) {
  return await db.all(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `, [userId]);
}

async function markNotificationAsRead(notificationId, userId) {
  return await db.run(`
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND user_id = ?
  `, [notificationId, userId]);
}

async function markAllNotificationsAsRead(userId) {
  return await db.run(`
    UPDATE notifications SET is_read = 1
    WHERE user_id = ?
  `, [userId]);
}

module.exports = {
  sendNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
