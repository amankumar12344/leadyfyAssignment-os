const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.id);
    return res.json({ success: true, notifications });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    await notificationService.markNotificationAsRead(notificationId, req.user.id);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await notificationService.markAllNotificationsAsRead(req.user.id);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
