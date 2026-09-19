var scriptsView = window.scriptsView = {
  scripts: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="script-search-input" placeholder="Search scripts by title or client...">
        </div>

        <div class="filter-actions">
          <select class="select-filter" id="script-status-filter">
            <option value="">All Workflow States</option>
            <option value="DRAFT">Draft</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="SENT_TO_CLIENT">Sent to Client</option>
            <option value="REVISION_REQUIRED">Revision Required</option>
            <option value="APPROVED">Approved</option>
            <option value="READY_FOR_SHOOT">Ready for Shoot</option>
          </select>

          ${auth.currentUser.role !== 'CLIENT' ? `
            <button class="btn btn-primary" onclick="window.scriptsView.openCreateScriptModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
              New Script
            </button>
          ` : ''}
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">UGC Script Concepts & Client Feedback Hub</div>
          <span style="font-size: 12px; color: var(--text-muted);" id="scripts-count-label">0 Scripts</span>
        </div>
        <div class="panel-body" style="padding: 0;">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title & Concept</th>
                  <th>Client Organization</th>
                  <th>Assigned Writer</th>
                  <th>Creator Match</th>
                  <th>Status</th>
                  <th>Revisions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="scripts-table-body">
                <tr><td colspan="8" style="text-align: center; padding: 24px;">Loading scripts...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('script-search-input').addEventListener('input', () => this.applyFilters());
    document.getElementById('script-status-filter').addEventListener('change', () => this.applyFilters());

    await this.loadScripts();
  },

  async loadScripts() {
    try {
      const res = await api.get('/scripts');
      this.scripts = res.scripts || [];
      this.applyFilters();
    } catch (err) {
      showToast('Failed to load scripts: ' + err.message, 'error');
    }
  },

  applyFilters() {
    const search = (document.getElementById('script-search-input')?.value || '').toLowerCase().trim();
    const status = document.getElementById('script-status-filter')?.value || '';

    const filtered = this.scripts.filter(s => {
      const matchSearch = !search ||
        (s.title && s.title.toLowerCase().includes(search)) ||
        (s.company_name && s.company_name.toLowerCase().includes(search));
      const matchStatus = !status || s.status === status;
      return matchSearch && matchStatus;
    });

    const countLabel = document.getElementById('scripts-count-label');
    if (countLabel) countLabel.innerText = `${filtered.length} Scripts`;

    const tbody = document.getElementById('scripts-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">No scripts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td style="font-weight: 700; color: var(--color-amber);">#${s.video_number}</td>
        <td style="font-weight: 600; color: var(--text-primary);">
          ${s.title}
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Lang: ${s.language} &bull; Deadline: ${s.deadline || 'Flexible'}</div>
        </td>
        <td>${s.company_name}</td>
        <td>${s.writer_name || '<span style="color: var(--text-dim);">Unassigned</span>'}</td>
        <td>${s.creator_name || '<span style="color: var(--text-dim);">TBD</span>'}</td>
        <td>
          <span class="badge ${s.status === 'APPROVED' || s.status === 'READY_FOR_SHOOT' ? 'badge-success' : (s.status === 'REVISION_REQUIRED' ? 'badge-error' : (s.status === 'SENT_TO_CLIENT' ? 'badge-purple' : 'badge-warning'))}">
            ${s.status}
          </span>
        </td>
        <td style="text-align: center;">${s.revision_count}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.scriptsView.openReadModal(${s.id})">Read</button>

            ${auth.currentUser.role === 'CLIENT' && s.status === 'SENT_TO_CLIENT' ? `
              <button class="btn btn-success btn-sm" onclick="window.scriptsView.approveScript(${s.id})">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="window.scriptsView.openRevisionModal(${s.id})">Revise</button>
            ` : ''}

            ${auth.currentUser.role !== 'CLIENT' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.scriptsView.openEditModal(${s.id})">Edit</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  async openReadModal(scriptId) {
    try {
      const res = await api.get(`/scripts/${scriptId}`);
      const s = res.script;

      const bodyHtml = `
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${s.title}</h2>
              <div style="font-size: 12px; color: var(--color-amber);">Script #${s.video_number} &bull; ${s.company_name}</div>
            </div>
            <span class="badge ${s.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}">${s.status}</span>
          </div>
        </div>

        <div style="background-color: var(--bg-input); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; color: var(--text-primary); max-height: 350px; overflow-y: auto;">
          ${s.script_text || '<span style="color: var(--text-dim);">No script text written yet.</span>'}
        </div>

        ${s.reference_links ? `
          <div style="margin-bottom: 14px;">
            <label class="form-label">Reference Inspiration Links</label>
            <a href="${s.reference_links}" target="_blank" style="color: var(--color-amber); font-size: 12px; text-decoration: underline;">${s.reference_links}</a>
          </div>
        ` : ''}

        ${s.client_comments ? `
          <div style="background-color: var(--bg-surface-elevated); border-left: 3px solid var(--color-amber); padding: 10px 14px; border-radius: 4px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-amber); margin-bottom: 2px;">Client Feedback & Notes</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${s.client_comments}</div>
          </div>
        ` : ''}
      `;

      const footerHtml = auth.currentUser.role === 'CLIENT' && s.status === 'SENT_TO_CLIENT' ? `
        <button class="btn btn-danger btn-sm" onclick="window.scriptsView.openRevisionModal(${s.id})">Request Revision</button>
        <button class="btn btn-success btn-sm" onclick="window.scriptsView.approveScript(${s.id})">Approve Script</button>
      ` : `
        <button class="btn btn-secondary btn-sm" onclick="window.closeModal()">Close</button>
      `;

      window.openModal({
        title: `Script: ${s.title}`,
        bodyHtml,
        footerHtml,
        width: '680px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async approveScript(scriptId) {
    try {
      await api.post(`/scripts/${scriptId}/approve`, { comments: 'Approved via portal.' });
      showToast('Script approved successfully!', 'success');
      window.closeModal();
      await this.loadScripts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openRevisionModal(scriptId) {
    const bodyHtml = `
      <div class="form-group">
        <label class="form-label">Revision Notes & Required Changes *</label>
        <textarea class="form-textarea" id="script-revision-notes" rows="5" placeholder="Specify which hook, line, or tone changes you require..."></textarea>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="window.scriptsView.submitRevision(${scriptId})">Submit Revision Request</button>
    `;

    window.openModal({
      title: 'Request Script Revision',
      bodyHtml,
      footerHtml
    });
  },

  async submitRevision(scriptId) {
    const comments = document.getElementById('script-revision-notes').value.trim();
    if (!comments) {
      showToast('Please provide revision comments', 'error');
      return;
    }

    try {
      await api.post(`/scripts/${scriptId}/revision`, { comments });
      showToast('Revision submitted to creative team.', 'success');
      window.closeModal();
      await this.loadScripts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openCreateScriptModal() {
    try {
      const [ordersRes, writersRes, creatorsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/dashboard'),
        api.get('/creators')
      ]);

      const orders = ordersRes.orders || [];
      const creators = creatorsRes.creators || [];

      const bodyHtml = `
        <form id="create-script-form">
          <div class="form-group">
            <label class="form-label">Order & Client *</label>
            <select class="form-select" id="new-script-order-id" required>
              <option value="">Select an active order...</option>
              ${orders.map(o => `<option value="${o.id}" data-client="${o.client_id}">Order #${o.id}: ${o.company_name} (${o.package_name})</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Video Script Title *</label>
              <input type="text" class="form-input" id="new-script-title" placeholder="e.g. 3-Second Problem Hook Reel" required>
            </div>
            <div class="form-group">
              <label class="form-label">Video Number</label>
              <input type="number" class="form-input" id="new-script-num" value="1" min="1">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Target Creator</label>
              <select class="form-select" id="new-script-creator-id">
                <option value="">TBD / Open Casting</option>
                ${creators.map(c => `<option value="${c.id}">${c.name} (${c.niches})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Deadline</label>
              <input type="date" class="form-input" id="new-script-deadline" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Script Hook & Body Text</label>
            <textarea class="form-textarea" id="new-script-text" rows="6" placeholder="[Hook 00:00-00:03]: ...&#10;[Problem 00:04-00:15]: ...&#10;[Solution 00:16-00:25]: ...&#10;[CTA 00:26-00:30]: ..."></textarea>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.scriptsView.submitCreateScript()">Create Script</button>
      `;

      window.openModal({
        title: 'Draft New UGC Script',
        bodyHtml,
        footerHtml,
        width: '680px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitCreateScript() {
    const orderSelect = document.getElementById('new-script-order-id');
    const orderId = orderSelect.value;
    const clientId = orderSelect.options[orderSelect.selectedIndex]?.getAttribute('data-client');
    const title = document.getElementById('new-script-title').value.trim();
    const video_number = document.getElementById('new-script-num').value;
    const creator_id = document.getElementById('new-script-creator-id').value || null;
    const deadline = document.getElementById('new-script-deadline').value;
    const script_text = document.getElementById('new-script-text').value;

    if (!orderId || !title) {
      showToast('Please select an order and title.', 'error');
      return;
    }

    try {
      await api.post('/scripts', {
        client_id: parseInt(clientId, 10),
        order_id: parseInt(orderId, 10),
        title,
        video_number: parseInt(video_number, 10) || 1,
        creator_id: creator_id ? parseInt(creator_id, 10) : null,
        deadline,
        script_text
      });

      showToast('Script created successfully!', 'success');
      window.closeModal();
      await this.loadScripts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openEditModal(scriptId) {
    const s = this.scripts.find(item => item.id === scriptId);
    if (!s) return;

    const bodyHtml = `
      <form id="edit-script-form">
        <div class="form-group">
          <label class="form-label">Workflow Status</label>
          <select class="form-select" id="edit-script-status">
            <option value="DRAFT" ${s.status === 'DRAFT' ? 'selected' : ''}>Draft</option>
            <option value="ASSIGNED" ${s.status === 'ASSIGNED' ? 'selected' : ''}>Assigned</option>
            <option value="IN_REVIEW" ${s.status === 'IN_REVIEW' ? 'selected' : ''}>In Review</option>
            <option value="SENT_TO_CLIENT" ${s.status === 'SENT_TO_CLIENT' ? 'selected' : ''}>Sent to Client</option>
            <option value="REVISION_REQUIRED" ${s.status === 'REVISION_REQUIRED' ? 'selected' : ''}>Revision Required</option>
            <option value="APPROVED" ${s.status === 'APPROVED' ? 'selected' : ''}>Approved</option>
            <option value="READY_FOR_SHOOT" ${s.status === 'READY_FOR_SHOOT' ? 'selected' : ''}>Ready for Shoot</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" class="form-input" id="edit-script-title" value="${s.title}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Script Text</label>
          <textarea class="form-textarea" id="edit-script-text" rows="7">${s.script_text || ''}</textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.scriptsView.submitEditScript(${s.id})">Save Changes</button>
    `;

    window.openModal({
      title: `Edit Script: ${s.title}`,
      bodyHtml,
      footerHtml,
      width: '680px'
    });
  },

  async submitEditScript(scriptId) {
    const status = document.getElementById('edit-script-status').value;
    const title = document.getElementById('edit-script-title').value.trim();
    const script_text = document.getElementById('edit-script-text').value;

    try {
      await api.put(`/scripts/${scriptId}`, {
        status,
        title,
        script_text
      });

      showToast('Script updated.', 'success');
      window.closeModal();
      await this.loadScripts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
