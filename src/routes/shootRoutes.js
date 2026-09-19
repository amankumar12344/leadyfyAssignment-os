const express = require('express');
const router = express.Router();
const shootService = require('../services/shootService');
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
    const shoots = await shootService.listShoots(filter);
    return res.json({ success: true, shoots });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const shoot = await shootService.scheduleShoot(req.body, req.user.id);
    return res.status(201).json({ success: true, shoot });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', enforceClientIsolation, async (req, res) => {
  try {
    const shootId = parseInt(req.params.id, 10);
    const shoot = await shootService.getShootById(shootId);
    if (!shoot) return res.status(404).json({ success: false, error: 'Shoot not found.' });

    if (req.user.role === 'CLIENT' && req.user.clientId !== shoot.client_id) {
      return res.status(403).json({ success: false, error: 'Access forbidden.' });
    }

    return res.json({ success: true, shoot });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const shootId = parseInt(req.params.id, 10);
    const updated = await shootService.updateShoot(shootId, req.body, req.user.id);
    return res.json({ success: true, shoot: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id/checklist', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const shootId = parseInt(req.params.id, 10);
    const updated = await shootService.updateShoot(shootId, {
      pre_shoot_checklist: req.body
    }, req.user.id);
    return res.json({ success: true, shoot: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
