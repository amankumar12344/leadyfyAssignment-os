var shootsView = window.shootsView = {
  shoots: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" id="shoot-view-today" onclick="window.shootsView.filterShoots('today')">Today's Shoots</button>
          <button class="btn btn-secondary btn-sm" id="shoot-view-upcoming" onclick="window.shootsView.filterShoots('upcoming')">Upcoming</button>
          <button class="btn btn-secondary btn-sm" id="shoot-view-all" onclick="window.shootsView.filterShoots('all')">All Shoots</button>
        </div>

        <div class="filter-actions">
          ${auth.currentUser.role !== 'CLIENT' ? `
            <button class="btn btn-primary" onclick="window.shootsView.openScheduleShootModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
              Schedule Shoot
            </button>
          ` : ''}
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Production Shoots Calendar & Logistics</div>
          <span style="font-size: 12px; color: var(--text-muted);" id="shoots-count-label">0 Shoots</span>
        </div>
        <div class="panel-body" style="padding: 0;">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Client & Order</th>
                  <th>Creator Assigned</th>
                  <th>Location</th>
                  <th>Pre-Shoot Checklist</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="shoots-table-body">
                <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading shoot schedules...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    await this.loadShoots();
  },

  async loadShoots() {
    try {
      const res = await api.get('/shoots');
      this.shoots = res.shoots || [];
      this.renderTable(this.shoots);
    } catch (err) {
      showToast('Failed to load shoots: ' + err.message, 'error');
    }
  },

  filterShoots(mode) {
    const today = new Date().toISOString().split('T')[0];
    let filtered = this.shoots;

    if (mode === 'today') {
      filtered = this.shoots.filter(s => s.shoot_date === today);
    } else if (mode === 'upcoming') {
      filtered = this.shoots.filter(s => s.shoot_date >= today && s.status !== 'CANCELLED' && s.status !== 'COMPLETED');
    }

    this.renderTable(filtered);
  },

  renderTable(list) {
    const countLabel = document.getElementById('shoots-count-label');
    if (countLabel) countLabel.innerText = `${list.length} Shoots`;

    const tbody = document.getElementById('shoots-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No shoots found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(sh => {
      const pre = sh.pre_shoot_checklist || {};
      const completedChecks = Object.values(pre).filter(Boolean).length;
      const totalChecks = Object.keys(pre).length || 5;

      return `
        <tr>
          <td style="font-weight: 700; color: var(--color-amber);">
            ${sh.shoot_date}
            <div style="font-size: 12px; color: var(--text-primary); font-weight: 600;">${sh.shoot_time}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${sh.company_name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${sh.package_name || ''}</div>
          </td>
          <td style="font-weight: 600; color: var(--text-primary);">${sh.creator_name}</td>
          <td style="color: var(--text-secondary); max-width: 220px;">${sh.location}</td>
          <td>
            <span class="badge ${completedChecks === totalChecks ? 'badge-success' : 'badge-warning'}">
              ${completedChecks}/${totalChecks} Verified
            </span>
          </td>
          <td>
            <span class="badge ${sh.status === 'COMPLETED' ? 'badge-success' : (sh.status === 'CONFIRMED' ? 'badge-info' : (sh.status === 'RESHOOT_REQUIRED' ? 'badge-error' : 'badge-neutral'))}">
              ${sh.status}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.shootsView.openShootDetailModal(${sh.id})">Inspect</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openScheduleShootModal(preselectedCreatorId = null) {
    try {
      const [ordersRes, creatorsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/creators')
      ]);

      const orders = ordersRes.orders || [];
      const creators = creatorsRes.creators || [];

      const bodyHtml = `
        <form id="schedule-shoot-form">
          <div class="form-group">
            <label class="form-label">Client Order *</label>
            <select class="form-select" id="new-shoot-order-id" required>
              <option value="">Select an active order...</option>
              ${orders.map(o => `<option value="${o.id}" data-client="${o.client_id}">${o.company_name} (${o.package_name})</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Creator Assignment *</label>
              <select class="form-select" id="new-shoot-creator-id" required>
                <option value="">Select a Creator...</option>
                ${creators.map(c => `<option value="${c.id}" ${preselectedCreatorId === c.id ? 'selected' : ''}>${c.name} (${c.location} - ${c.availability_status})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Location *</label>
              <input type="text" class="form-input" id="new-shoot-location" placeholder="e.g. Studio Lumiere, Mumbai" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Shoot Date *</label>
              <input type="date" class="form-input" id="new-shoot-date" value="${new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Shoot Time *</label>
              <input type="text" class="form-input" id="new-shoot-time" value="11:00 AM" placeholder="11:00 AM" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cameraman Name</label>
              <input type="text" class="form-input" id="new-shoot-camera" placeholder="e.g. Arun Kumar">
            </div>
            <div class="form-group">
              <label class="form-label">Approved Scripts Summary</label>
              <input type="text" class="form-input" id="new-shoot-scripts" placeholder="Script #1 and #2">
            </div>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.shootsView.submitScheduleShoot()">Book Shoot</button>
      `;

      window.openModal({
        title: 'Schedule Production Shoot',
        bodyHtml,
        footerHtml,
        width: '640px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitScheduleShoot() {
    const orderSelect = document.getElementById('new-shoot-order-id');
    const order_id = orderSelect.value;
    const client_id = orderSelect.options[orderSelect.selectedIndex]?.getAttribute('data-client');
    const creator_id = document.getElementById('new-shoot-creator-id').value;
    const location = document.getElementById('new-shoot-location').value.trim();
    const shoot_date = document.getElementById('new-shoot-date').value;
    const shoot_time = document.getElementById('new-shoot-time').value.trim();
    const cameraman = document.getElementById('new-shoot-camera').value.trim();
    const approved_scripts_summary = document.getElementById('new-shoot-scripts').value.trim();

    if (!order_id || !creator_id || !location || !shoot_date || !shoot_time) {
      showToast('Please fill out all required fields (*)', 'error');
      return;
    }

    try {
      await api.post('/shoots', {
        client_id: parseInt(client_id, 10),
        order_id: parseInt(order_id, 10),
        creator_id: parseInt(creator_id, 10),
        location,
        shoot_date,
        shoot_time,
        cameraman,
        approved_scripts_summary,
        status: 'CONFIRMED'
      });

      showToast('Shoot scheduled and creator booked!', 'success');
      window.closeModal();
      await this.loadShoots();
    } catch (err) {
      // Highlights double-booking prevention if any
      showToast(err.message, 'error');
    }
  },

  async openShootDetailModal(shootId) {
    try {
      const res = await api.get(`/shoots/${shootId}`);
      const sh = res.shoot;
      const pre = sh.pre_shoot_checklist || {};
      const post = sh.post_shoot_checklist || {};

      const bodyHtml = `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: var(--text-primary);">Shoot #${sh.id}: ${sh.location}</h2>
              <div style="font-size: 13px; color: var(--color-amber);">${sh.company_name} &bull; ${sh.shoot_date} at ${sh.shoot_time}</div>
            </div>
            <span class="badge badge-info">${sh.status}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div class="panel-card" style="margin-bottom: 0; padding: 14px;">
            <h4 style="font-size: 12px; text-transform: uppercase; color: var(--color-amber); font-weight: 700; margin-bottom: 10px;">Pre-Shoot 5-Point Checklist</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${pre.scriptApproved ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'pre', 'scriptApproved', this.checked)">
                Script Approved by Client
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${pre.creatorConfirmed ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'pre', 'creatorConfirmed', this.checked)">
                Creator Confirmed Call Time
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${pre.locationPermission ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'pre', 'locationPermission', this.checked)">
                Location / Studio Booked
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${pre.productReceived ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'pre', 'productReceived', this.checked)">
                Client Product Received at Studio
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${pre.teamBriefing ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'pre', 'teamBriefing', this.checked)">
                Team Creative Briefing Completed
              </label>
            </div>
          </div>

          <div class="panel-card" style="margin-bottom: 0; padding: 14px;">
            <h4 style="font-size: 12px; text-transform: uppercase; color: var(--status-info-text); font-weight: 700; margin-bottom: 10px;">Post-Shoot Verification</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${post.footageUploaded ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'post', 'footageUploaded', this.checked)">
                Raw 4K Footage Uploaded to Cloud
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${post.rawFootageVerified ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'post', 'rawFootageVerified', this.checked)">
                Audio & Video File Integrity Verified
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${post.reshootNeeded ? 'checked' : ''} onchange="window.shootsView.updateChecklist(${sh.id}, 'post', 'reshootNeeded', this.checked)">
                Reshoot Flagged
              </label>
            </div>
          </div>
        </div>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
        ${sh.status !== 'COMPLETED' ? `
          <button class="btn btn-success" onclick="window.shootsView.markShootCompleted(${sh.id})">Mark Shoot Completed</button>
        ` : ''}
      `;

      window.openModal({
        title: `Shoot Logistics: #${sh.id}`,
        bodyHtml,
        footerHtml,
        width: '680px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async updateChecklist(shootId, section, key, val) {
    try {
      const res = await api.get(`/shoots/${shootId}`);
      const sh = res.shoot;
      const pre = sh.pre_shoot_checklist || {};
      const post = sh.post_shoot_checklist || {};

      if (section === 'pre') pre[key] = val;
      else post[key] = val;

      await api.put(`/shoots/${shootId}`, {
        pre_shoot_checklist: pre,
        post_shoot_checklist: post
      });

      showToast('Checklist updated.', 'success');
      await this.loadShoots();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async markShootCompleted(shootId) {
    try {
      await api.put(`/shoots/${shootId}`, { status: 'COMPLETED' });
      showToast('Shoot marked COMPLETED! Creator availability restored.', 'success');
      window.closeModal();
      await this.loadShoots();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
