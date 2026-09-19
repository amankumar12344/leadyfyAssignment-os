var financeView = window.financeView = {
  invoices: [],
  expenses: [],
  payouts: [],
  summary: null,

  async render(container) {
    const isClient = auth.currentUser.role === 'CLIENT';

    if (isClient) {
      container.innerHTML = `
        <div class="panel-card">
          <div class="panel-header">
            <div class="panel-title">Your Invoices & Billing History</div>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Order / Package</th>
                  <th>Total Amount</th>
                  <th>Amount Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="client-invoices-body">
                <tr><td colspan="6" style="text-align: center; padding: 24px;">Loading invoices...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      await this.loadClientInvoices();
      return;
    }

    container.innerHTML = `
      <!-- Financial Overview Top Cards -->
      <div class="metrics-grid" id="finance-metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Total Revenue Collected</div>
          <div class="metric-value metric-accent-green" id="fin-rev">₹0</div>
          <div class="metric-subtitle">Inbound client receipts</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Outstanding Receivables</div>
          <div class="metric-value metric-accent-amber" id="fin-rec">₹0</div>
          <div class="metric-subtitle">Pending client payments</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Agency Operating Expenses</div>
          <div class="metric-value" style="color: var(--status-error-text);" id="fin-exp">₹0</div>
          <div class="metric-subtitle">Studio, gear, salaries</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Creator Payouts Paid</div>
          <div class="metric-value" id="fin-pay">₹0</div>
          <div class="metric-subtitle">Talent compensation</div>
        </div>
        <div class="metric-card" style="border-color: var(--color-amber-border);">
          <div class="metric-title" style="color: var(--color-amber);">Calculated Net Profit</div>
          <div class="metric-value metric-accent-amber" id="fin-profit">₹0</div>
          <div class="metric-subtitle">Revenue - Expenses - Payouts</div>
        </div>
      </div>

      <!-- Financial Sub-Tabs -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button class="btn btn-secondary btn-sm" id="fin-tab-invoices" onclick="window.financeView.switchTab('invoices')">Client Invoices</button>
        <button class="btn btn-secondary btn-sm" id="fin-tab-expenses" onclick="window.financeView.switchTab('expenses')">Agency Expenses</button>
        <button class="btn btn-secondary btn-sm" id="fin-tab-payouts" onclick="window.financeView.switchTab('payouts')">Creator Payouts</button>
      </div>

      <!-- Tab 1: Invoices -->
      <div class="panel-card fin-tab-pane" id="fin-pane-invoices">
        <div class="panel-header">
          <div class="panel-title">Invoices & Inbound Payments</div>
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client Organization</th>
                <th>Total Invoiced</th>
                <th>Amount Received</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="invoices-table-body">
              <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading invoices...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Expenses -->
      <div class="panel-card fin-tab-pane" id="fin-pane-expenses" style="display: none;">
        <div class="panel-header">
          <div class="panel-title">Agency Expense Ledger</div>
          <button class="btn btn-primary btn-sm" onclick="window.financeView.openRecordExpenseModal()">+ Record Expense</button>
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody id="expenses-table-body">
              <tr><td colspan="5" style="text-align: center; padding: 24px;">Loading expenses...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 3: Creator Payouts -->
      <div class="panel-card fin-tab-pane" id="fin-pane-payouts" style="display: none;">
        <div class="panel-header">
          <div class="panel-title">Creator Compensation & Payouts</div>
          <button class="btn btn-primary btn-sm" onclick="window.financeView.openCreatePayoutModal()">+ Create Payout</button>
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Creator Name</th>
                <th>Order Reference</th>
                <th>Videos Count</th>
                <th>Agreed Rate</th>
                <th>Total Payout</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="payouts-table-body">
              <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading creator payouts...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadAllFinancialData();
  },

  async loadClientInvoices() {
    try {
      const res = await api.get('/finance/invoices');
      const tbody = document.getElementById('client-invoices-body');
      const invoices = res.invoices || [];

      if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">No invoices found.</td></tr>`;
        return;
      }

      tbody.innerHTML = invoices.map(i => `
        <tr>
          <td style="font-weight: 700; color: var(--color-amber);">${i.invoice_number}</td>
          <td>${i.package_name || '-'}</td>
          <td>₹${Number(i.invoice_amount).toLocaleString('en-IN')}</td>
          <td style="color: var(--status-success-text);">₹${Number(i.amount_received).toLocaleString('en-IN')}</td>
          <td style="color: ${i.outstanding_balance > 0 ? 'var(--status-error-text)' : 'inherit'};">₹${Number(i.outstanding_balance).toLocaleString('en-IN')}</td>
          <td><span class="badge ${i.status === 'PAID' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async loadAllFinancialData() {
    try {
      const [sumRes, invRes, expRes, payRes] = await Promise.all([
        api.get('/finance/summary'),
        api.get('/finance/invoices'),
        api.get('/finance/expenses'),
        api.get('/finance/payouts')
      ]);

      this.summary = sumRes.summary;
      this.invoices = invRes.invoices || [];
      this.expenses = expRes.expenses || [];
      this.payouts = payRes.payouts || [];

      // Update Summary Cards
      document.getElementById('fin-rev').innerText = `₹${Number(this.summary.revenue).toLocaleString('en-IN')}`;
      document.getElementById('fin-rec').innerText = `₹${Number(this.summary.receivables).toLocaleString('en-IN')}`;
      document.getElementById('fin-exp').innerText = `₹${Number(this.summary.expenses).toLocaleString('en-IN')}`;
      document.getElementById('fin-pay').innerText = `₹${Number(this.summary.creatorPayouts).toLocaleString('en-IN')}`;
      document.getElementById('fin-profit').innerText = `₹${Number(this.summary.netProfit).toLocaleString('en-IN')}`;

      this.renderInvoicesTable();
      this.renderExpensesTable();
      this.renderPayoutsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  switchTab(tabName) {
    document.querySelectorAll('.fin-tab-pane').forEach(el => el.style.display = 'none');
    document.getElementById(`fin-pane-${tabName}`).style.display = 'block';
  },

  renderInvoicesTable() {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;

    if (this.invoices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No invoices found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.invoices.map(i => `
      <tr>
        <td style="font-weight: 700; color: var(--color-amber);">${i.invoice_number}</td>
        <td>
          <div style="font-weight: 600;">${i.company_name}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${i.package_name || ''}</div>
        </td>
        <td style="font-weight: 700;">₹${Number(i.invoice_amount).toLocaleString('en-IN')}</td>
        <td style="color: var(--status-success-text); font-weight: 600;">₹${Number(i.amount_received).toLocaleString('en-IN')}</td>
        <td style="color: ${i.outstanding_balance > 0 ? 'var(--status-error-text)' : 'inherit'}; font-weight: 600;">₹${Number(i.outstanding_balance).toLocaleString('en-IN')}</td>
        <td><span class="badge ${i.status === 'PAID' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
        <td>
          ${i.outstanding_balance > 0 ? `
            <button class="btn btn-secondary btn-sm" onclick="window.financeView.openRecordPaymentModal(${i.id}, ${i.outstanding_balance})">Record Payment</button>
          ` : '<span style="font-size: 11px; color: var(--status-success-text); font-weight: 700;">PAID IN FULL</span>'}
        </td>
      </tr>
    `).join('');
  },

  renderExpensesTable() {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;

    if (this.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">No expenses recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.expenses.map(e => `
      <tr>
        <td style="color: var(--text-muted); font-size: 12px;">${e.date}</td>
        <td><span class="badge badge-neutral">${e.category}</span></td>
        <td style="font-weight: 600; color: var(--text-primary);">${e.description}</td>
        <td style="font-weight: 700; color: var(--status-error-text);">₹${Number(e.amount).toLocaleString('en-IN')}</td>
        <td>${e.recorded_by_name || 'Admin'}</td>
      </tr>
    `).join('');
  },

  renderPayoutsTable() {
    const tbody = document.getElementById('payouts-table-body');
    if (!tbody) return;

    if (this.payouts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No creator payouts recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.payouts.map(p => `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${p.creator_name}</td>
        <td>
          <div>${p.client_company_name}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${p.package_name}</div>
        </td>
        <td style="text-align: center;">${p.video_count}</td>
        <td>₹${Number(p.agreed_rate).toLocaleString('en-IN')}</td>
        <td style="font-weight: 800; color: var(--color-amber);">₹${Number(p.total_payout).toLocaleString('en-IN')}</td>
        <td>
          <span class="badge ${p.status === 'PAID' ? 'badge-success' : (p.status === 'APPROVED' ? 'badge-info' : 'badge-warning')}">
            ${p.status}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${p.status === 'PENDING' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.financeView.updatePayout(${p.id}, 'APPROVED')">Approve</button>
            ` : ''}
            ${p.status === 'APPROVED' ? `
              <button class="btn btn-success btn-sm" onclick="window.financeView.openPayPayoutModal(${p.id}, ${p.total_payout})">Pay</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  openRecordPaymentModal(invoiceId, outstanding) {
    const bodyHtml = `
      <div class="form-group">
        <label class="form-label">Amount Paid (₹) *</label>
        <input type="number" class="form-input" id="payment-amount" value="${outstanding}" max="${outstanding}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Payment Date</label>
          <input type="date" class="form-input" id="payment-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Method</label>
          <select class="form-select" id="payment-method">
            <option value="Bank Transfer (NEFT)">Bank Transfer (NEFT)</option>
            <option value="Razorpay UPI">Razorpay UPI</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Transaction Reference #</label>
        <input type="text" class="form-input" id="payment-ref" placeholder="UTR / Txn ID">
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.financeView.submitPayment(${invoiceId})">Save Payment</button>
    `;

    window.openModal({
      title: 'Record Client Payment Receipt',
      bodyHtml,
      footerHtml
    });
  },

  async submitPayment(invoiceId) {
    const amount_paid = document.getElementById('payment-amount').value;
    const payment_date = document.getElementById('payment-date').value;
    const payment_method = document.getElementById('payment-method').value;
    const transaction_ref = document.getElementById('payment-ref').value.trim();

    try {
      await api.post('/finance/payments', {
        invoice_id: invoiceId,
        amount_paid: parseFloat(amount_paid),
        payment_date,
        payment_method,
        transaction_ref
      });

      showToast('Payment recorded successfully!', 'success');
      window.closeModal();
      await this.loadAllFinancialData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openRecordExpenseModal() {
    const bodyHtml = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category *</label>
          <select class="form-select" id="expense-cat">
            <option value="Studio">Studio</option>
            <option value="Equipment">Equipment</option>
            <option value="Salaries">Salaries</option>
            <option value="Office">Office</option>
            <option value="Fuel">Fuel</option>
            <option value="Software">Software</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₹) *</label>
          <input type="number" class="form-input" id="expense-amount" placeholder="5000" min="1" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description *</label>
        <input type="text" class="form-input" id="expense-desc" placeholder="e.g. Studio lighting gear rental" required>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" id="expense-date" value="${new Date().toISOString().split('T')[0]}">
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.financeView.submitExpense()">Save Expense</button>
    `;

    window.openModal({
      title: 'Record Agency Operating Expense',
      bodyHtml,
      footerHtml
    });
  },

  async submitExpense() {
    const category = document.getElementById('expense-cat').value;
    const amount = document.getElementById('expense-amount').value;
    const description = document.getElementById('expense-desc').value.trim();
    const date = document.getElementById('expense-date').value;

    if (!amount || !description) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    try {
      await api.post('/finance/expenses', {
        category,
        amount: parseFloat(amount),
        description,
        date
      });

      showToast('Expense recorded successfully.', 'success');
      window.closeModal();
      await this.loadAllFinancialData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openCreatePayoutModal() {
    try {
      const [creatorsRes, ordersRes] = await Promise.all([
        api.get('/creators'),
        api.get('/orders')
      ]);

      const creators = creatorsRes.creators || [];
      const orders = ordersRes.orders || [];

      const bodyHtml = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Creator *</label>
            <select class="form-select" id="payout-creator-id" required>
              <option value="">Select Creator...</option>
              ${creators.map(c => `<option value="${c.id}">${c.name} (Std: ₹${c.standard_rate})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Order *</label>
            <select class="form-select" id="payout-order-id" required>
              <option value="">Select Order...</option>
              ${orders.map(o => `<option value="${o.id}">Order #${o.id}: ${o.company_name} (${o.package_name})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Video Count *</label>
            <input type="number" class="form-input" id="payout-video-count" value="1" min="1" required>
          </div>
          <div class="form-group">
            <label class="form-label">Agreed Rate per Video (₹) *</label>
            <input type="number" class="form-input" id="payout-rate" placeholder="12000" required>
          </div>
        </div>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.financeView.submitPayout()">Create Payout</button>
      `;

      window.openModal({
        title: 'Create Creator Payout (Duplicate Protected)',
        bodyHtml,
        footerHtml
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitPayout() {
    const creator_id = document.getElementById('payout-creator-id').value;
    const order_id = document.getElementById('payout-order-id').value;
    const video_count = document.getElementById('payout-video-count').value;
    const agreed_rate = document.getElementById('payout-rate').value;

    if (!creator_id || !order_id || !agreed_rate) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    try {
      await api.post('/finance/payouts', {
        creator_id: parseInt(creator_id, 10),
        order_id: parseInt(order_id, 10),
        video_count: parseInt(video_count, 10),
        agreed_rate: parseFloat(agreed_rate)
      });

      showToast('Creator payout created successfully!', 'success');
      window.closeModal();
      await this.loadAllFinancialData();
    } catch (err) {
      // Catches duplicate payout prevention error
      showToast(err.message, 'error');
    }
  },

  async updatePayout(payoutId, status) {
    try {
      await api.put(`/finance/payouts/${payoutId}/status`, { status });
      showToast(`Payout marked as ${status}!`, 'success');
      await this.loadAllFinancialData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openPayPayoutModal(payoutId, amount) {
    const bodyHtml = `
      <p style="color: var(--text-secondary); margin-bottom: 14px; font-size: 13px;">
        Executing payout of <strong style="color: var(--color-amber);">₹${Number(amount).toLocaleString('en-IN')}</strong> to creator account.
      </p>
      <div class="form-group">
        <label class="form-label">Payment Reference # (Bank UTR / UPI Ref) *</label>
        <input type="text" class="form-input" id="payout-ref-no" placeholder="UPI-TRANS-992200..." required>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="window.financeView.submitPayPayout(${payoutId})">Confirm & Mark Paid</button>
    `;

    window.openModal({
      title: 'Pay Creator Payout',
      bodyHtml,
      footerHtml
    });
  },

  async submitPayPayout(payoutId) {
    const reference_number = document.getElementById('payout-ref-no').value.trim();
    if (!reference_number) {
      showToast('Please provide transaction reference number.', 'error');
      return;
    }

    try {
      await api.put(`/finance/payouts/${payoutId}/status`, {
        status: 'PAID',
        reference_number
      });

      showToast('Payout successfully marked PAID!', 'success');
      window.closeModal();
      await this.loadAllFinancialData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
