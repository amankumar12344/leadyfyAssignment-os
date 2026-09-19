const express = require('express');
const router = express.Router();
const creatorService = require('../services/creatorService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const isClient = req.user.role === 'CLIENT';
    const creators = await creatorService.listCreators(req.query, isClient);
    return res.json({ success: true, creators });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const creator = await creatorService.createCreator(req.body, req.user.id);
    return res.status(201).json({ success: true, creator });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const creatorId = parseInt(req.params.id, 10);
    const isClient = req.user.role === 'CLIENT';
    const creator = await creatorService.getCreatorById(creatorId, isClient);
    if (!creator) return res.status(404).json({ success: false, error: 'Creator not found.' });

    return res.json({ success: true, creator });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
