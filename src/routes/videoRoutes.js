const express = require('express');
const router = express.Router();
const videoService = require('../services/videoService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { enforceClientIsolation } = require('../middleware/isolation');

router.use(requireAuth);

router.get('/', enforceClientIsolation, async (req, res) => {
  try {
    const filter = { ...req.query };
    if (req.user.role === 'CLIENT') {
      filter.clientId = req.user.clientId;
    }
    const videos = await videoService.listVideos(filter);
    return res.json({ success: true, videos });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const video = await videoService.createVideo(req.body, req.user.id);
    return res.status(201).json({ success: true, video });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', enforceClientIsolation, async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const video = await videoService.getVideoById(videoId);
    if (!video) return res.status(404).json({ success: false, error: 'Video not found.' });

    if (req.user.role === 'CLIENT' && req.user.clientId !== video.client_id) {
      return res.status(403).json({ success: false, error: 'Access forbidden.' });
    }

    return res.json({ success: true, video });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// STRICT STATE MACHINE TRANSITION
router.post('/:id/transition', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const { status, ...extraData } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Target status is required.' });

    const updated = await videoService.transitionVideoStatus(videoId, status, req.user.id, extraData);
    return res.json({ success: true, video: updated, message: `Status transitioned to ${status}.` });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// CLIENT APPROVAL
router.post('/:id/approve', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const clientId = req.user.role === 'CLIENT' ? req.user.clientId : req.body.client_id;
    if (!clientId) return res.status(400).json({ success: false, error: 'Client identification required.' });

    const updated = await videoService.clientApproveVideo(videoId, clientId, req.user.id);
    return res.json({ success: true, video: updated, message: 'Video draft approved!' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// CLIENT REVISION WITH TIMESTAMPED FEEDBACK
router.post('/:id/feedback', async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const clientId = req.user.role === 'CLIENT' ? req.user.clientId : req.body.client_id;
    if (!clientId) return res.status(400).json({ success: false, error: 'Client identification required.' });

    const feedbackItems = req.body.feedback || (req.body.comment ? [{ timestamp_seconds: req.body.timestamp_seconds || 0, comment: req.body.comment }] : []);
    const updated = await videoService.clientRequestVideoRevision(videoId, clientId, feedbackItems, req.user.id);
    return res.json({ success: true, video: updated, message: 'Revision submitted with timestamped feedback.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// FINAL DELIVERY (TRANSACTIONAL & IDEMPOTENT)
router.post('/:id/deliver', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    const { delivery_link } = req.body;
    const result = await videoService.deliverFinalVideo(videoId, delivery_link, req.user.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
