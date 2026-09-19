const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const data = await dashboardService.getDashboardData(req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
