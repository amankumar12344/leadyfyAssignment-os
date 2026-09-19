/**
 * Leadyfy OS — Audit Logs View
 * Enterprise-grade security and action traceability ledger.
 * Restricted to OWNER and ADMIN roles.
 */

window.auditView = {
  async render(container) {
    const user = window.authService.getCurrentUser();
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Access Denied</h3>
          <p>System audit logs are strictly restricted to Executive and Administrative roles.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-card">
        <div class="table-header-controls">
          <div>
            <span class="table-title">System Audit Ledger</span>
            <span class="table-subtitle">Immutable chronological log of all administrative, financial, and operational operations</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="audit-filter-input" class="search-input" placeholder="Search by actor, action, entity..." style="width: 260px;" />
            <button class="btn btn-secondary" id="refresh-audit-btn">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              Refresh
            </button>
          </div>
        </div>

        <div id="audit-content">
          <div style="padding: 32px; text-align: center; color: var(--text-muted);">Loading audit logs...</div>
        </div>
      </div>
    `;

    const filterInput = container.querySelector('#audit-filter-input');
    const refreshBtn = container.querySelector('#refresh-audit-btn');

    let allLogs = [];

    const loadLogs = async () => {
      try {
        const res = await window.api.get('/audit?limit=100');
        if (!res.success) throw new Error(res.error || 'Failed to fetch logs');
        allLogs = res.logs || [];
        renderTable(allLogs);
      } catch (err) {
        container.querySelector('#audit-content').innerHTML = `
          <div style="padding: 32px; text-align: center; color: var(--color-danger);">
            Failed to load audit logs: ${err.message}
          </div>
        `;
      }
    };

    const renderTable = (logs) => {
      const auditContent = container.querySelector('#audit-content');
      if (!logs || logs.length === 0) {
        auditContent.innerHTML = `
          <div class="empty-state">
            <h3>No Audit Records Found</h3>
            <p>No operational actions have been recorded matching this filter.</p>
          </div>
        `;
        return;
      }

      auditContent.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 170px;">Timestamp</th>
                <th>Actor / User</th>
                <th>Action</th>
                <th>Target Entity</th>
                <th>Metadata / Details</th>
                <th style="width: 110px;">IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => {
                let detailsDisplay = '-';
                if (log.details) {
                  try {
                    const parsed = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                    detailsDisplay = `<pre style="font-family: var(--font-mono); font-size: 11px; margin: 0; background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px; max-width: 320px; overflow-x: auto;">${JSON.stringify(parsed, null, 1)}</pre>`;
                  } catch (e) {
                    detailsDisplay = `<span style="font-family: var(--font-mono); font-size: 11px;">${log.details}</span>`;
                  }
                }

                const actionBadgeClass = 
                  log.action.includes('CREATE') || log.action.includes('SUBMIT') ? 'badge-primary' :
                  log.action.includes('APPROVE') || log.action.includes('DELIVER') ? 'badge-success' :
                  log.action.includes('REJECT') || log.action.includes('DELETE') ? 'badge-danger' :
                  'badge-muted';

                return `
                  <tr>
                    <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">
                      ${new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--text-primary);">${log.user_name || 'System / Auto'}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">${log.user_email || log.user_id || 'system'}</div>
                      ${log.user_role ? `<span class="badge ${log.user_role === 'OWNER' ? 'badge-primary' : 'badge-muted'}" style="font-size: 10px; padding: 1px 6px; margin-top: 2px;">${log.user_role}</span>` : ''}
                    </td>
                    <td>
                      <span class="badge ${actionBadgeClass}">${log.action}</span>
                    </td>
                    <td>
                      <div style="font-weight: 600; font-family: var(--font-mono); font-size: 12px;">${log.entity_type}</div>
                      <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${log.entity_id || 'N/A'}</div>
                    </td>
                    <td>${detailsDisplay}</td>
                    <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">
                      ${log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderTable(allLogs);
        return;
      }
      const filtered = allLogs.filter(l => 
        (l.user_name && l.user_name.toLowerCase().includes(q)) ||
        (l.user_email && l.user_email.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.entity_type && l.entity_type.toLowerCase().includes(q)) ||
        (l.entity_id && l.entity_id.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
      renderTable(filtered);
    });

    refreshBtn.addEventListener('click', loadLogs);
    await loadLogs();
  }
};
