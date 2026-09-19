var ordersView = window.ordersView = {
  orders: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="order-search-input" placeholder="Search orders by package or client...">
        </div>

        <div class="filter-actions">
          <select class="select-filter" id="order-status-filter">
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="IN_PRODUCTION">In Production</option>
            <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
            <option value="COMPLETED">Completed</option>
          </select>

          ${auth.currentUser.role !== 'CLIENT' ? `
            <button class="btn btn-primary" onclick="window.ordersView.openCreateOrderModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
              Create Order
            </button>
          ` : ''}
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Active Packages & Order Pipeline</div>
          <span style="font-size: 12px; color: var(--text-muted);" id="orders-count-label">0 Orders</span>
        </div>
        <div class="panel-body" style="padding: 0;">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Client / Company</th>
                  <th>Package Name</th>
                  <th>Quota Progress (Delivered / Total)</th>
                  <th>Pricing & GST</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="orders-table-body">
                <tr><td colspan="8" style="text-align: center; padding: 24px;">Loading orders...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('order-search-input').addEventListener('input', () => this.applyFilters());
    document.getElementById('order-status-filter').addEventListener('change', () => this.applyFilters());

    await this.loadOrders();
  },

  async loadOrders() {
    try {
      const res = await api.get('/orders');
      this.orders = res.orders || [];
      this.applyFilters();
    } catch (err) {
      showToast('Failed to load orders: ' + err.message, 'error');
    }
  },

  applyFilters() {
    const search = (document.getElementById('order-search-input')?.value || '').toLowerCase().trim();
    const status = document.getElementById('order-status-filter')?.value || '';

    const filtered = this.orders.filter(o => {
      const matchSearch = !search ||
        (o.package_name && o.package_name.toLowerCase().includes(search)) ||
        (o.company_name && o.company_name.toLowerCase().includes(search)) ||
        (o.client_name && o.client_name.toLowerCase().includes(search));
      const matchStatus = !status || o.status === status;
      return matchSearch && matchStatus;
    });

    const countLabel = document.getElementById('orders-count-label');
    if (countLabel) countLabel.innerText = `${filtered.length} Orders`;

    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(o => {
      const percent = Math.min(100, Math.round(((o.delivered_videos_count || 0) / o.video_count) * 100));
      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">
            ${o.company_name || 'Client #' + o.client_id}
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Contact: ${o.client_name || '-'}</div>
          </td>
          <td style="font-weight: 600; color: var(--color-amber);">${o.package_name}</td>
          <td style="min-width: 180px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span><strong>${o.delivered_videos_count || 0}</strong> of ${o.video_count} delivered</span>
              <span style="color: var(--text-dim);">${o.remaining_quota} remaining</span>
            </div>
            <div class="quota-bar-bg">
              <div class="quota-bar-fill" style="width: ${percent}%;"></div>
            </div>
          </td>
          <td>
            <div style="font-weight: 700;">₹${Number(o.total_amount).toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: var(--text-dim);">Base: ₹${Number(o.pricing).toLocaleString('en-IN')} + ${o.gst_rate}% GST</div>
          </td>
          <td style="color: ${o.outstanding_balance > 0 ? 'var(--status-error-text)' : 'var(--status-success-text)'}; font-weight: 600;">
            ₹${Number(o.outstanding_balance).toLocaleString('en-IN')}
          </td>
          <td style="color: var(--text-muted); font-size: 12px;">${o.due_date}</td>
          <td>
            <span class="badge ${o.status === 'COMPLETED' ? 'badge-success' : (o.status === 'IN_PRODUCTION' ? 'badge-warning' : 'badge-neutral')}">
              ${o.status}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.ordersView.openOrderDetailModal(${o.id})">Details</button>
              ${auth.currentUser.role !== 'CLIENT' ? `
                <button class="btn btn-primary btn-sm" onclick="window.videosView.openCreateVideoModal(${o.client_id}, ${o.id})">+ Video</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openCreateOrderModal(preselectedClientId = null) {
    try {
      const clientsRes = await api.get('/clients');
      const clients = clientsRes.clients || [];

      const bodyHtml = `
        <form id="create-order-form">
          <div class="form-group">
            <label class="form-label">Client Organization *</label>
            <select class="form-select" id="new-order-client-id" required>
              <option value="">Select a Client...</option>
              ${clients.map(c => `
                <option value="${c.id}" ${preselectedClientId === c.id ? 'selected' : ''}>
                  ${c.company_name} (${c.client_name})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Package Name *</label>
              <input type="text" class="form-input" id="new-order-package" placeholder="e.g. 10 UGC Reels Growth Pack" required>
            </div>
            <div class="form-group">
              <label class="form-label">Contracted Video Count *</label>
              <input type="number" class="form-input" id="new-order-video-count" value="10" min="1" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Base Pricing (₹) *</label>
              <input type="number" class="form-input" id="new-order-pricing" placeholder="100000" min="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">GST Rate (%)</label>
              <input type="number" class="form-input" id="new-order-gst" value="18" min="0">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Initial Amount Received (₹)</label>
              <input type="number" class="form-input" id="new-order-received" value="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select class="form-select" id="new-order-paymethod">
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="Credit Card">Credit Card / Razorpay</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date *</label>
              <input type="date" class="form-input" id="new-order-start" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Due Date *</label>
              <input type="date" class="form-input" id="new-order-due" value="${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}" required>
            </div>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.ordersView.submitCreateOrder()">Create Order & Invoice</button>
      `;

      window.openModal({
        title: 'Create Client Order & Package',
        bodyHtml,
        footerHtml,
        width: '640px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitCreateOrder() {
    const client_id = document.getElementById('new-order-client-id').value;
    const package_name = document.getElementById('new-order-package').value.trim();
    const video_count = document.getElementById('new-order-video-count').value;
    const pricing = document.getElementById('new-order-pricing').value;
    const gst_rate = document.getElementById('new-order-gst').value;
    const amount_received = document.getElementById('new-order-received').value;
    const payment_method = document.getElementById('new-order-paymethod').value;
    const start_date = document.getElementById('new-order-start').value;
    const due_date = document.getElementById('new-order-due').value;

    if (!client_id || !package_name || !video_count || !pricing || !start_date || !due_date) {
      showToast('Please fill out all required fields (*)', 'error');
      return;
    }

    try {
      const res = await api.post('/orders', {
        client_id: parseInt(client_id, 10),
        package_name,
        video_count: parseInt(video_count, 10),
        pricing: parseFloat(pricing),
        gst_rate: parseFloat(gst_rate || 18),
        amount_received: parseFloat(amount_received || 0),
        payment_method,
        start_date,
        due_date
      });

      showToast(`Order created for ${res.order.company_name}!`, 'success');
      window.closeModal();
      await this.loadOrders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openOrderDetailModal(orderId) {
    try {
      const res = await api.get(`/orders/${orderId}`);
      const o = res.order;

      const bodyHtml = `
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${o.package_name}</h2>
          <div style="font-size: 13px; color: var(--color-amber);">${o.company_name} &bull; Order #${o.id}</div>
        </div>

        <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
          <div class="metric-card" style="padding: 12px;">
            <div class="metric-title">Contracted</div>
            <div class="metric-value" style="font-size: 20px;">${o.video_count}</div>
          </div>
          <div class="metric-card" style="padding: 12px;">
            <div class="metric-title">Completed</div>
            <div class="metric-value" style="font-size: 20px; color: var(--status-success-text);">${o.completed_videos_count}</div>
          </div>
          <div class="metric-card" style="padding: 12px;">
            <div class="metric-title">Delivered</div>
            <div class="metric-value" style="font-size: 20px; color: var(--color-amber);">${o.delivered_videos_count}</div>
          </div>
          <div class="metric-card" style="padding: 12px;">
            <div class="metric-title">Remaining</div>
            <div class="metric-value" style="font-size: 20px;">${o.remaining_quota}</div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div class="panel-title" style="margin-bottom: 8px;">Associated Videos (${o.videos.length})</div>
          ${o.videos.length === 0 ? '<p style="color: var(--text-dim); font-size: 13px;">No video records created yet.</p>' : `
            <table class="data-table">
              <thead><tr><th>Title</th><th>Status</th><th>Editor</th></tr></thead>
              <tbody>
                ${o.videos.map(v => `
                  <tr>
                    <td style="font-weight: 600;">${v.title}</td>
                    <td><span class="badge ${v.status === 'DELIVERED' ? 'badge-success' : 'badge-warning'}">${v.status}</span></td>
                    <td>${v.editor_name || 'Unassigned'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div>
          <div class="panel-title" style="margin-bottom: 8px;">Invoices & Payments</div>
          <table class="data-table">
            <thead><tr><th>Invoice #</th><th>Total</th><th>Received</th><th>Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              ${o.payments.map(p => `
                <tr>
                  <td style="font-weight: 700; color: var(--color-amber);">${p.invoice_number}</td>
                  <td>₹${Number(p.invoice_amount).toLocaleString('en-IN')}</td>
                  <td>₹${Number(p.amount_received).toLocaleString('en-IN')}</td>
                  <td>₹${Number(p.outstanding_balance).toLocaleString('en-IN')}</td>
                  <td><span class="badge ${p.status === 'PAID' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      window.openModal({
        title: `Order #${o.id} Details`,
        bodyHtml,
        width: '720px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
