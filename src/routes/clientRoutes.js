const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { enforceClientIsolation } = require('../middleware/isolation');

router.use(requireAuth);

// List clients (Clients only see their own company)
router.get('/', enforceClientIsolation, async (req, res) => {
  try {
    const filter = { ...req.query };
    if (req.user.role === 'CLIENT') {
      filter.clientId = req.user.clientId;
    }
    const clients = await clientService.listClients(filter);
    return res.json({ success: true, clients });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create client (Restricted to OWNER, ADMIN, SALES)
router.post('/', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const newClient = await clientService.createClient(req.body, req.user.id);
    return res.status(201).json({ success: true, client: newClient });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 360 Client Profile (Enforces client isolation)
router.get('/:id', enforceClientIsolation, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    if (req.user.role === 'CLIENT' && req.user.clientId !== clientId) {
      return res.status(403).json({ success: false, error: 'Access forbidden. You cannot view another client profile.' });
    }

    const client = await clientService.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found.' });
    }

    return res.json({ success: true, client });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update client
router.put('/:id', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const updated = await clientService.updateClient(clientId, req.body, req.user.id);
    return res.json({ success: true, client: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
