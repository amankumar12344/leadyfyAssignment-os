const express = require('express');
const router = express.Router();
const scriptService = require('../services/scriptService');
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
    const scripts = await scriptService.listScripts(filter);
    return res.json({ success: true, scripts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const script = await scriptService.createScript(req.body, req.user.id);
    return res.status(201).json({ success: true, script });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', enforceClientIsolation, async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);
    const script = await scriptService.getScriptById(scriptId);
    if (!script) return res.status(404).json({ success: false, error: 'Script not found.' });

    if (req.user.role === 'CLIENT' && req.user.clientId !== script.client_id) {
      return res.status(403).json({ success: false, error: 'Access forbidden.' });
    }

    return res.json({ success: true, script });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);
    const updated = await scriptService.updateScript(scriptId, req.body, req.user.id);
    return res.json({ success: true, script: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Client approval
router.post('/:id/approve', async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);
    let clientId = req.user.role === 'CLIENT' ? req.user.clientId : req.body.client_id;
    if (!clientId) {
      const existing = await scriptService.getScriptById(scriptId);
      if (existing) clientId = existing.client_id;
    }
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client identification required.' });
    }

    const updated = await scriptService.clientApproveScript(scriptId, clientId, req.body.comments, req.user.id);
    return res.json({ success: true, script: updated, message: 'Script approved successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Client revision request
router.post('/:id/revision', async (req, res) => {
  try {
    const scriptId = parseInt(req.params.id, 10);
    let clientId = req.user.role === 'CLIENT' ? req.user.clientId : req.body.client_id;
    if (!clientId) {
      const existing = await scriptService.getScriptById(scriptId);
      if (existing) clientId = existing.client_id;
    }
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client identification required.' });
    }

    const updated = await scriptService.clientRequestRevision(scriptId, clientId, req.body.comments, req.user.id);
    return res.json({ success: true, script: updated, message: 'Script revision requested.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
