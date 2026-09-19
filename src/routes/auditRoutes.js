const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { blockClientFromInternal } = require('../middleware/isolation');

router.use(requireAuth);
router.use(blockClientFromInternal);
router.use(requireRole(['OWNER', 'ADMIN']));

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await auditService.listAuditLogs(limit);
    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
