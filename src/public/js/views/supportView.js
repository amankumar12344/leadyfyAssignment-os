var supportView = window.supportView = {
  tickets: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="filter-actions">
          <select class="select-filter" id="ticket-status-filter">
            <option value="">All Tickets</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <button class="btn btn-primary" onclick="window.supportView.openCreateTicketModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
          New Support Ticket
        </button>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Client Support & Communications Desk</div>
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Subject</th>
                <th>Client / Organization</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Replies</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="tickets-table-body">
              <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading tickets...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('ticket-status-filter').addEventListener('change', () => this.applyFilters());
    await this.loadTickets();
  },

  async loadTickets() {
    try {
      const res = await api.get('/support');
      this.tickets = res.tickets || [];
      this.applyFilters();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  applyFilters() {
    const status = document.getElementById('ticket-status-filter')?.value || '';
    const filtered = this.tickets.filter(t => !status || t.status === status);

    const tbody = document.getElementById('tickets-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No tickets found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(t => `
      <tr>
        <td style="font-weight: 700; color: var(--color-amber);">#T-${t.id}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${t.subject}</td>
        <td>${t.company_name}</td>
        <td><span class="badge ${t.priority === 'URGENT' ? 'badge-error' : (t.priority === 'HIGH' ? 'badge-warning' : 'badge-neutral')}">${t.priority}</span></td>
        <td><span class="badge ${t.status === 'RESOLVED' ? 'badge-success' : 'badge-info'}">${t.status}</span></td>
        <td style="text-align: center; font-weight: 600;">${t.reply_count || 0}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.supportView.openTicketThreadModal(${t.id})">Open Thread</button>
        </td>
      </tr>
    `).join('');
  },

  openCreateTicketModal() {
    const isClient = auth.currentUser.role === 'CLIENT';

    const bodyHtml = `
      <form id="create-ticket-form">
        <div class="form-group">
          <label class="form-label">Subject *</label>
          <input type="text" class="form-input" id="ticket-subject" placeholder="e.g. Question regarding Diwali campaign script tone" required>
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="ticket-priority">
            <option value="LOW">Low</option>
            <option value="MEDIUM" selected>Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description / Question *</label>
          <textarea class="form-textarea" id="ticket-desc" rows="4" placeholder="Provide details of your query..." required></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.supportView.submitCreateTicket()">Submit Ticket</button>
    `;

    window.openModal({
      title: 'Submit Support Inquiry',
      bodyHtml,
      footerHtml
    });
  },

  async submitCreateTicket() {
    const subject = document.getElementById('ticket-subject').value.trim();
    const priority = document.getElementById('ticket-priority').value;
    const description = document.getElementById('ticket-desc').value.trim();

    if (!subject || !description) {
      showToast('Please fill out subject and description.', 'error');
      return;
    }

    try {
      await api.post('/support', {
        subject,
        priority,
        description
      });

      showToast('Ticket submitted successfully!', 'success');
      window.closeModal();
      await this.loadTickets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openTicketThreadModal(ticketId) {
    try {
      const res = await api.get(`/support/${ticketId}`);
      const t = res.ticket;
      const replies = t.replies || [];

      const bodyHtml = `
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h2 style="font-size: 16px; font-weight: 800; color: var(--text-primary);">${t.subject}</h2>
              <div style="font-size: 12px; color: var(--color-amber);">Ticket #${t.id} &bull; ${t.company_name}</div>
            </div>
            <span class="badge ${t.status === 'RESOLVED' ? 'badge-success' : 'badge-info'}">${t.status}</span>
          </div>
          <div style="margin-top: 10px; background-color: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); font-size: 13px; color: var(--text-secondary);">
            ${t.description}
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div class="panel-title" style="margin-bottom: 10px;">Replies Thread (${replies.length})</div>
          <div style="display: flex; flex-direction: column; gap: 10px; max-height: 250px; overflow-y: auto;">
            ${replies.map(r => `
              <div style="background-color: ${r.is_client ? 'var(--bg-input)' : 'var(--color-amber-muted)'}; border: 1px solid ${r.is_client ? 'var(--border-subtle)' : 'var(--color-amber-border)'}; padding: 10px 14px; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                  <span style="font-weight: 700; color: ${r.is_client ? 'var(--text-primary)' : 'var(--color-amber)'};">${r.sender_name} (${r.sender_role})</span>
                  <span style="color: var(--text-dim);">${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary);">${r.message}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <input type="text" class="form-input" id="ticket-reply-input" placeholder="Type your reply message...">
          <button class="btn btn-primary" onclick="window.supportView.submitReply(${t.id})">Send</button>
        </div>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
        ${t.status !== 'RESOLVED' ? `
          <button class="btn btn-success btn-sm" onclick="window.supportView.resolveTicket(${t.id})">Mark Resolved</button>
        ` : ''}
      `;

      window.openModal({
        title: `Ticket #${t.id}: ${t.subject}`,
        bodyHtml,
        footerHtml,
        width: '680px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitReply(ticketId) {
    const input = document.getElementById('ticket-reply-input');
    const message = input.value.trim();
    if (!message) return;

    try {
      await api.post(`/support/${ticketId}/reply`, { message });
      input.value = '';
      showToast('Reply sent.', 'success');
      await this.openTicketThreadModal(ticketId);
      await this.loadTickets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async resolveTicket(ticketId) {
    try {
      await api.put(`/support/${ticketId}/status`, { status: 'RESOLVED' });
      showToast('Ticket marked RESOLVED.', 'success');
      window.closeModal();
      await this.loadTickets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
