const express = require('express');
const router = express.Router();
const financeService = require('../services/financeService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { blockClientFromInternal, enforceClientIsolation } = require('../middleware/isolation');

router.use(requireAuth);

// 1. Invoices / Payments
router.get('/invoices', enforceClientIsolation, async (req, res) => {
  try {
    const filter = { ...req.query };
    if (req.user.role === 'CLIENT') {
      filter.clientId = req.user.clientId;
    }
    const invoices = await financeService.listInvoices(filter);
    return res.json({ success: true, invoices });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/payments', requireRole(['OWNER', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const payment = await financeService.recordPayment(req.body, req.user.id);
    return res.status(201).json({ success: true, payment, message: 'Payment recorded successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Expenses (Clients strictly blocked!)
router.get('/expenses', blockClientFromInternal, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const expenses = await financeService.listExpenses(req.query);
    return res.json({ success: true, expenses });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/expenses', blockClientFromInternal, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const expense = await financeService.recordExpense(req.body, req.user.id);
    return res.status(201).json({ success: true, expense, message: 'Expense recorded.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Creator Payouts (Clients strictly blocked!)
router.get('/payouts', blockClientFromInternal, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const payouts = await financeService.listCreatorPayouts(req.query);
    return res.json({ success: true, payouts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/payouts', blockClientFromInternal, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const payout = await financeService.createCreatorPayout(req.body, req.user.id);
    return res.status(201).json({ success: true, payout, message: 'Payout created.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/payouts/:id/status', blockClientFromInternal, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const payoutId = parseInt(req.params.id, 10);
    const { status, reference_number } = req.body;
    const updated = await financeService.updatePayoutStatus(payoutId, status, reference_number, req.user.id);
    return res.json({ success: true, payout: updated, message: `Payout status updated to ${status}.` });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Executive Financial Summary (Net Profit = Revenue - Expenses - Creator Payouts)
router.get('/summary', blockClientFromInternal, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const summary = await financeService.getFinancialSummary();
    return res.json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
