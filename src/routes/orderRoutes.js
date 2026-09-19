const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
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
    const orders = await orderService.listOrders(filter);
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const order = await orderService.createOrder(req.body, req.user.id);
    return res.status(201).json({ success: true, order });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', enforceClientIsolation, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    if (req.user.role === 'CLIENT' && req.user.clientId !== order.client_id) {
      return res.status(403).json({ success: false, error: 'Access forbidden. You cannot access orders of another client.' });
    }

    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/status', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const updated = await orderService.updateOrderStatus(orderId, req.body.status, req.user.id);
    return res.json({ success: true, order: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
