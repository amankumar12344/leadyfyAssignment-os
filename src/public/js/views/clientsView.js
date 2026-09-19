var clientsView = window.clientsView = {
  clients: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="client-search-input" placeholder="Search by company, client name, or email...">
        </div>

        <div class="filter-actions">
          <select class="select-filter" id="client-status-filter">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="NEW">New</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="LEAD">Lead</option>
          </select>

          ${auth.currentUser.role !== 'CLIENT' ? `
            <button class="btn btn-primary" onclick="window.clientsView.openCreateModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
              Add Client
            </button>
          ` : ''}
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Clients Directory</div>
          <span style="font-size: 12px; color: var(--text-muted);" id="clients-count-label">0 Clients</span>
        </div>
        <div class="panel-body" style="padding: 0;">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Email & Phone</th>
                  <th>Industry</th>
                  <th>Status</th>
                  <th>Total Orders</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="clients-table-body">
                <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading clients...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('client-search-input').addEventListener('input', () => this.applyFilters());
    document.getElementById('client-status-filter').addEventListener('change', () => this.applyFilters());

    await this.loadClients();
  },

  async loadClients() {
    try {
      const res = await api.get('/clients');
      this.clients = res.clients || [];
      this.applyFilters();
    } catch (err) {
      showToast('Failed to load clients: ' + err.message, 'error');
    }
  },

  applyFilters() {
    const search = (document.getElementById('client-search-input')?.value || '').toLowerCase().trim();
    const status = document.getElementById('client-status-filter')?.value || '';

    const filtered = this.clients.filter(c => {
      const matchSearch = !search ||
        (c.company_name && c.company_name.toLowerCase().includes(search)) ||
        (c.client_name && c.client_name.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search));
      const matchStatus = !status || c.status === status;
      return matchSearch && matchStatus;
    });

    const countLabel = document.getElementById('clients-count-label');
    if (countLabel) countLabel.innerText = `${filtered.length} Clients`;

    const tbody = document.getElementById('clients-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No clients found matching filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">
          ${c.company_name}
          ${c.brand_name ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Brand: ${c.brand_name}</div>` : ''}
        </td>
        <td style="font-weight: 600;">${c.client_name}</td>
        <td>
          <div style="font-size: 12px; color: var(--text-secondary);">${c.email}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${c.phone || '-'}</div>
        </td>
        <td>${c.industry || 'General'}</td>
        <td>
          <span class="badge ${c.status === 'ACTIVE' ? 'badge-success' : (c.status === 'ONBOARDING' ? 'badge-warning' : 'badge-neutral')}">
            ${c.status}
          </span>
        </td>
        <td style="font-weight: 600; color: var(--color-amber);">${c.total_orders_count || 0}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.clientsView.openProfileModal(${c.id})">360 View</button>
            ${auth.currentUser.role !== 'CLIENT' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.clientsView.openEditModal(${c.id})">Edit</button>
              <button class="btn btn-primary btn-sm" onclick="window.ordersView.openCreateOrderModal(${c.id})">+ Order</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  // CRITICAL FIX: Add Client Modal with company_name input
  openCreateModal() {
    const bodyHtml = `
      <form id="create-client-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Company Name *</label>
            <input type="text" class="form-input" id="new-company-name" placeholder="e.g. Zenith Cosmetics Pvt Ltd" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contact Person Name *</label>
            <input type="text" class="form-input" id="new-client-name" placeholder="e.g. Ananya Deshmukh" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Business Email *</label>
            <input type="email" class="form-input" id="new-email" placeholder="contact@company.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Phone / WhatsApp</label>
            <input type="text" class="form-input" id="new-phone" placeholder="+91 9876543210">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Brand / Trade Name</label>
            <input type="text" class="form-input" id="new-brand-name" placeholder="e.g. Zenith Skincare">
          </div>
          <div class="form-group">
            <label class="form-label">Industry</label>
            <input type="text" class="form-input" id="new-industry" placeholder="e.g. Health & Wellness">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">GST / Tax ID</label>
            <input type="text" class="form-input" id="new-gst" placeholder="07AAAAA0000A1Z5">
          </div>
          <div class="form-group">
            <label class="form-label">Initial Status</label>
            <select class="form-select" id="new-status">
              <option value="NEW">New</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="ACTIVE" selected>Active</option>
              <option value="LEAD">Lead</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Brand Kit / Drive Link</label>
          <input type="url" class="form-input" id="new-brand-kit" placeholder="https://drive.google.com/folder/...">
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.clientsView.submitCreate()">Create Client</button>
    `;

    window.openModal({
      title: 'Add New Client Organization',
      bodyHtml,
      footerHtml,
      width: '620px'
    });
  },

  async submitCreate() {
    const company_name = document.getElementById('new-company-name').value.trim();
    const client_name = document.getElementById('new-client-name').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const phone = document.getElementById('new-phone').value.trim();
    const brand_name = document.getElementById('new-brand-name').value.trim();
    const industry = document.getElementById('new-industry').value.trim();
    const gst_tax_id = document.getElementById('new-gst').value.trim();
    const status = document.getElementById('new-status').value;
    const brand_kit_url = document.getElementById('new-brand-kit').value.trim();

    if (!company_name || !client_name || !email) {
      showToast('Please fill out all required fields (*)', 'error');
      return;
    }

    try {
      const res = await api.post('/clients', {
        company_name,
        client_name,
        email,
        phone,
        whatsapp: phone,
        brand_name,
        industry,
        gst_tax_id,
        status,
        brand_kit_url
      });

      showToast(`Client "${res.client.company_name}" created successfully!`, 'success');
      window.closeModal();
      await this.loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // 360 Client Profile View
  async openProfileModal(clientId) {
    try {
      const res = await api.get(`/clients/${clientId}`);
      const c = res.client;

      const bodyHtml = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${c.company_name}</h2>
              <div style="font-size: 13px; color: var(--color-amber);">${c.client_name} &bull; ${c.email} &bull; ${c.phone || 'No phone'}</div>
            </div>
            <span class="badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            GST: <span style="color: var(--text-secondary);">${c.gst_tax_id || 'N/A'}</span> &bull;
            Industry: <span style="color: var(--text-secondary);">${c.industry || 'General'}</span>
          </div>
        </div>

        <!-- 360 Aggregated Tabs -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 16px;">
          <button class="btn btn-secondary btn-sm" id="tab-btn-orders" onclick="window.clientsView.switchProfileTab('orders')">Orders (${c.orders.length})</button>
          <button class="btn btn-secondary btn-sm" id="tab-btn-scripts" onclick="window.clientsView.switchProfileTab('scripts')">Scripts (${c.scripts.length})</button>
          <button class="btn btn-secondary btn-sm" id="tab-btn-shoots" onclick="window.clientsView.switchProfileTab('shoots')">Shoots (${c.shoots.length})</button>
          <button class="btn btn-secondary btn-sm" id="tab-btn-videos" onclick="window.clientsView.switchProfileTab('videos')">Videos (${c.videos.length})</button>
          <button class="btn btn-secondary btn-sm" id="tab-btn-invoices" onclick="window.clientsView.switchProfileTab('invoices')">Invoices (${c.invoices.length})</button>
        </div>

        <!-- Tab Content Containers -->
        <div id="profile-tab-orders" class="profile-tab-pane">
          ${c.orders.length === 0 ? '<p style="color: var(--text-dim);">No orders created yet.</p>' : `
            <table class="data-table">
              <thead><tr><th>Package</th><th>Videos</th><th>Total</th><th>Outstanding</th><th>Status</th></tr></thead>
              <tbody>
                ${c.orders.map(o => `
                  <tr>
                    <td style="font-weight: 600;">${o.package_name}</td>
                    <td>${o.video_count}</td>
                    <td>₹${Number(o.total_amount).toLocaleString('en-IN')}</td>
                    <td style="color: ${o.outstanding_balance > 0 ? 'var(--status-error-text)' : 'var(--status-success-text)'};">₹${Number(o.outstanding_balance).toLocaleString('en-IN')}</td>
                    <td><span class="badge badge-info">${o.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div id="profile-tab-scripts" class="profile-tab-pane" style="display: none;">
          ${c.scripts.length === 0 ? '<p style="color: var(--text-dim);">No scripts created yet.</p>' : `
            <table class="data-table">
              <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Revision Count</th></tr></thead>
              <tbody>
                ${c.scripts.map(s => `
                  <tr>
                    <td>#${s.video_number}</td>
                    <td style="font-weight: 600;">${s.title}</td>
                    <td><span class="badge badge-warning">${s.status}</span></td>
                    <td>${s.revision_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div id="profile-tab-shoots" class="profile-tab-pane" style="display: none;">
          ${c.shoots.length === 0 ? '<p style="color: var(--text-dim);">No shoots scheduled yet.</p>' : `
            <table class="data-table">
              <thead><tr><th>Date & Time</th><th>Creator</th><th>Location</th><th>Status</th></tr></thead>
              <tbody>
                ${c.shoots.map(sh => `
                  <tr>
                    <td style="font-weight: 600;">${sh.shoot_date} ${sh.shoot_time}</td>
                    <td>${sh.creator_name}</td>
                    <td>${sh.location}</td>
                    <td><span class="badge badge-info">${sh.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div id="profile-tab-videos" class="profile-tab-pane" style="display: none;">
          ${c.videos.length === 0 ? '<p style="color: var(--text-dim);">No video deliverables yet.</p>' : `
            <table class="data-table">
              <thead><tr><th>Title</th><th>Status</th><th>Revisions</th><th>Master Link</th></tr></thead>
              <tbody>
                ${c.videos.map(v => `
                  <tr>
                    <td style="font-weight: 600;">${v.title}</td>
                    <td><span class="badge ${v.status === 'DELIVERED' ? 'badge-success' : 'badge-warning'}">${v.status}</span></td>
                    <td>${v.revision_count}</td>
                    <td>${v.final_delivery_link ? `<a href="${v.final_delivery_link}" target="_blank" style="color: var(--color-amber);">Open Asset</a>` : 'Pending final cut'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div id="profile-tab-invoices" class="profile-tab-pane" style="display: none;">
          ${c.invoices.length === 0 ? '<p style="color: var(--text-dim);">No invoices generated yet.</p>' : `
            <table class="data-table">
              <thead><tr><th>Invoice #</th><th>Amount</th><th>Received</th><th>Outstanding</th><th>Status</th></tr></thead>
              <tbody>
                ${c.invoices.map(i => `
                  <tr>
                    <td style="font-weight: 700; color: var(--color-amber);">${i.invoice_number}</td>
                    <td>₹${Number(i.invoice_amount).toLocaleString('en-IN')}</td>
                    <td style="color: var(--status-success-text);">₹${Number(i.amount_received).toLocaleString('en-IN')}</td>
                    <td style="color: ${i.outstanding_balance > 0 ? 'var(--status-error-text)' : 'inherit'};">₹${Number(i.outstanding_balance).toLocaleString('en-IN')}</td>
                    <td><span class="badge ${i.status === 'PAID' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;

      window.openModal({
        title: `360 Client Profile: ${c.company_name}`,
        bodyHtml,
        width: '780px'
      });
    } catch (err) {
      showToast('Failed to open client profile: ' + err.message, 'error');
    }
  },

  switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab-pane').forEach(el => el.style.display = 'none');
    document.getElementById(`profile-tab-${tabName}`).style.display = 'block';
  },

  async openEditModal(clientId) {
    const c = this.clients.find(item => item.id === clientId);
    if (!c) return;

    const bodyHtml = `
      <form id="edit-client-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Company Name *</label>
            <input type="text" class="form-input" id="edit-company-name" value="${c.company_name}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contact Person *</label>
            <input type="text" class="form-input" id="edit-client-name" value="${c.client_name}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="text" class="form-input" id="edit-phone" value="${c.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="edit-status">
              <option value="ACTIVE" ${c.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
              <option value="ONBOARDING" ${c.status === 'ONBOARDING' ? 'selected' : ''}>Onboarding</option>
              <option value="NEW" ${c.status === 'NEW' ? 'selected' : ''}>New</option>
              <option value="ON_HOLD" ${c.status === 'ON_HOLD' ? 'selected' : ''}>On Hold</option>
              <option value="COMPLETED" ${c.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
              <option value="INACTIVE" ${c.status === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.clientsView.submitEdit(${c.id})">Save Changes</button>
    `;

    window.openModal({
      title: `Edit Client: ${c.company_name}`,
      bodyHtml,
      footerHtml
    });
  },

  async submitEdit(clientId) {
    const company_name = document.getElementById('edit-company-name').value.trim();
    const client_name = document.getElementById('edit-client-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const status = document.getElementById('edit-status').value;

    try {
      await api.put(`/clients/${clientId}`, {
        company_name,
        client_name,
        phone,
        status
      });

      showToast('Client updated successfully!', 'success');
      window.closeModal();
      await this.loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
