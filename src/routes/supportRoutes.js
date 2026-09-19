const express = require('express');
const router = express.Router();
const supportService = require('../services/supportService');
const { requireAuth } = require('../middleware/auth');
const { enforceClientIsolation } = require('../middleware/isolation');

router.use(requireAuth);

router.get('/', enforceClientIsolation, async (req, res) => {
  try {
    const filter = { ...req.query };
    if (req.user.role === 'CLIENT') {
      filter.clientId = req.user.clientId;
    }
    const tickets = await supportService.listTickets(filter);
    return res.json({ success: true, tickets });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const clientId = req.user.role === 'CLIENT' ? req.user.clientId : req.body.client_id;
    if (!clientId) return res.status(400).json({ success: false, error: 'client_id is required.' });

    const ticket = await supportService.createTicket({ ...req.body, client_id: clientId }, req.user.id);
    return res.status(201).json({ success: true, ticket });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', enforceClientIsolation, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const ticket = await supportService.getTicketById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found.' });

    if (req.user.role === 'CLIENT' && req.user.clientId !== ticket.client_id) {
      return res.status(403).json({ success: false, error: 'Access forbidden.' });
    }

    return res.json({ success: true, ticket });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const isClient = req.user.role === 'CLIENT' ? 1 : 0;
    const ticket = await supportService.addTicketReply(ticketId, req.user.id, req.body.message, isClient);
    return res.json({ success: true, ticket, message: 'Reply sent.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { status, assigned_employee_id } = req.body;
    const updated = await supportService.updateTicketStatus(ticketId, status, assigned_employee_id, req.user.id);
    return res.json({ success: true, ticket: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
