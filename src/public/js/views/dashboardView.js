var dashboardView = window.dashboardView = {
  async render(container) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">Loading Dashboard Metrics...</div>`;

    try {
      const res = await api.get('/dashboard');
      const data = res.data;

      if (data.viewType === 'CLIENT') {
        this.renderClientDashboard(container, data);
      } else if (data.viewType === 'EMPLOYEE') {
        this.renderEmployeeDashboard(container, data);
      } else {
        this.renderExecutiveDashboard(container, data);
      }
    } catch (err) {
      container.innerHTML = `<div style="color: var(--status-error-text); padding: 20px;">Failed to load dashboard: ${err.message}</div>`;
    }
  },

  renderExecutiveDashboard(container, data) {
    const k = data.kpis;
    const f = data.financials;

    container.innerHTML = `
      <!-- Primary Operational Metric KPIs -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Active Clients</span>
            <span class="badge badge-success">+${k.newClients} New</span>
          </div>
          <div class="metric-value">${k.activeClients}</div>
          <div class="metric-subtitle">Across active agency retainers</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Active Orders</span>
            <span class="badge badge-warning">${k.activeOrders} In Prod</span>
          </div>
          <div class="metric-value">${k.activeOrders}</div>
          <div class="metric-subtitle">${k.pendingScripts} scripts pending approval</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Video Pipeline</span>
            <span class="badge badge-info">${k.videosInProduction} Active</span>
          </div>
          <div class="metric-value">${k.videosInProduction}</div>
          <div class="metric-subtitle">${k.pendingClientReview} pending client review</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Videos Delivered</span>
            <span class="badge badge-success">${k.deliveredVideos} Done</span>
          </div>
          <div class="metric-value metric-accent-green">${k.deliveredVideos}</div>
          <div class="metric-subtitle">${k.videosUnderRevision} under revision</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Estimated Net Profit</span>
            <span class="badge badge-warning">Live Ledger</span>
          </div>
          <div class="metric-value metric-accent-amber">₹${Number(f.netProfit).toLocaleString('en-IN')}</div>
          <div class="metric-subtitle">Rev: ₹${Number(f.revenue).toLocaleString('en-IN')} | Exp: ₹${Number(f.expenses + f.creatorPayouts).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <!-- Operational Split: Today's Shoots & Urgent Tasks -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <!-- Today's Shoots -->
        <div class="panel-card" style="margin-bottom: 0;">
          <div class="panel-header">
            <div class="panel-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Today's Scheduled Shoots (${data.todayShoots.length})
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.app.navigate('shoots')">View All</button>
          </div>
          <div class="panel-body" style="padding: 0;">
            ${data.todayShoots.length === 0 ? `
              <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">No shoots scheduled for today.</div>
            ` : `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Client</th>
                    <th>Creator</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.todayShoots.map(s => `
                    <tr>
                      <td style="font-weight: 700; color: var(--color-amber);">${s.shoot_time}</td>
                      <td>${s.company_name}</td>
                      <td>${s.creator_name}</td>
                      <td>${s.location}</td>
                      <td><span class="badge badge-info">${s.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <!-- Urgent Bottlenecks & Overdue Tasks -->
        <div class="panel-card" style="margin-bottom: 0;">
          <div class="panel-header">
            <div class="panel-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Urgent Action Items (${data.urgentTasks.length})
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.app.navigate('tasks')">Task Board</button>
          </div>
          <div class="panel-body" style="padding: 0;">
            ${data.urgentTasks.length === 0 ? `
              <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">Zero critical bottlenecks right now.</div>
            ` : `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Task</th>
                    <th>Assigned To</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.urgentTasks.map(t => `
                    <tr>
                      <td><span class="badge ${t.priority === 'URGENT' ? 'badge-error' : 'badge-warning'}">${t.priority}</span></td>
                      <td style="font-weight: 600; color: var(--text-primary);">${t.title}</td>
                      <td>${t.assigned_to_name || 'Unassigned'}</td>
                      <td style="color: var(--text-muted);">${t.deadline || 'ASAP'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>

      <!-- Recent System Activity Audit Stream -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Recent System Activity Feed
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.app.navigate('audit')">Full Audit Trail</button>
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${data.recentActivity.map(l => `
                <tr>
                  <td style="color: var(--text-dim); font-family: var(--font-mono); font-size: 11px;">${new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td><span class="badge badge-neutral">${l.action}</span></td>
                  <td>${l.actor_name || 'System / Auto'}</td>
                  <td style="color: var(--color-amber); font-weight: 600;">${l.entity} #${l.entity_id || ''}</td>
                  <td style="color: var(--text-muted); font-size: 12px;">${l.metadata || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderEmployeeDashboard(container, data) {
    if (data.subRole === 'EDITOR') {
      container.innerHTML = `
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-title">Overdue Edits</div>
            <div class="metric-value metric-accent-amber">${data.overdue.length}</div>
            <div class="metric-subtitle">Requires immediate turnaround</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Due Today</div>
            <div class="metric-value">${data.dueToday.length}</div>
            <div class="metric-subtitle">Scheduled deadline today</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Revision Queue</div>
            <div class="metric-value" style="color: var(--status-error-text);">${data.revisionQueue.length}</div>
            <div class="metric-subtitle">Client feedback changes requested</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Recently Completed</div>
            <div class="metric-value metric-accent-green">${data.completedRecent.length}</div>
            <div class="metric-subtitle">Ready for master client delivery</div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <div class="panel-title">My Video Editing Queue</div>
            <button class="btn btn-primary btn-sm" onclick="window.app.navigate('videos')">Open Pipeline Board</button>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Video Title</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${[...data.revisionQueue, ...data.overdue, ...data.dueToday].map(v => `
                  <tr>
                    <td style="font-weight: 600; color: var(--text-primary);">${v.title}</td>
                    <td>${v.company_name}</td>
                    <td><span class="badge ${v.status === 'REVISION' ? 'badge-error' : 'badge-warning'}">${v.status}</span></td>
                    <td style="color: var(--text-muted);">${v.deadline || 'Not set'}</td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="window.app.navigate('videos')">Work on Video</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="panel-card">
          <div class="panel-header">
            <div class="panel-title">${data.roleTitle}</div>
          </div>
          <div class="panel-body">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">Welcome to your workstation. You have access to your assigned operational modules in the sidebar.</p>
            <div class="panel-title" style="margin-bottom: 12px;">Assigned Tasks</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                ${data.myTasks.map(t => `
                  <tr>
                    <td><span class="badge ${t.priority === 'URGENT' ? 'badge-error' : 'badge-warning'}">${t.priority}</span></td>
                    <td style="font-weight: 600;">${t.title}</td>
                    <td><span class="badge badge-neutral">${t.status}</span></td>
                    <td>${t.deadline || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  },

  renderClientDashboard(container, data) {
    const s = data.summary;
    const c = data.client;

    container.innerHTML = `
      <div style="background-color: var(--bg-surface-elevated); border: 1px solid var(--color-amber-border); border-radius: var(--radius-lg); padding: 20px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h2 style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Welcome back, ${c.client_name}</h2>
          <div style="font-size: 13px; color: var(--color-amber); font-weight: 600;">${c.company_name} — UGC Client Portal</div>
        </div>
        <button class="btn btn-primary" onclick="window.app.navigate('videos')">Review Active Videos</button>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Active Packages</div>
          <div class="metric-value">${s.activeOrdersCount}</div>
          <div class="metric-subtitle">Contracted UGC Orders</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Script Approvals Needed</div>
          <div class="metric-value metric-accent-amber">${s.pendingScriptApprovalsCount}</div>
          <div class="metric-subtitle">Review script concepts</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Video Drafts Ready</div>
          <div class="metric-value" style="color: var(--status-info-text);">${s.pendingVideoReviewsCount}</div>
          <div class="metric-subtitle">Review & request edits</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Delivered Master Videos</div>
          <div class="metric-value metric-accent-green">${s.deliveredVideosCount}</div>
          <div class="metric-subtitle">Ready for ad distribution</div>
        </div>
      </div>

      <!-- Pending Reviews Action Center -->
      ${s.pendingVideoReviewsCount > 0 ? `
        <div class="panel-card" style="border-color: var(--color-amber-border);">
          <div class="panel-header" style="background-color: var(--color-amber-muted);">
            <div class="panel-title" style="color: var(--color-amber);">
              Action Required: Video Drafts Awaiting Your Review (${s.pendingVideoReviewsCount})
            </div>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Video Title</th>
                  <th>Draft Preview</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${data.pendingVideoReviews.map(v => `
                  <tr>
                    <td style="font-weight: 700; color: var(--text-primary);">${v.title}</td>
                    <td>
                      <a href="${v.draft_video_url || '#'}" target="_blank" style="color: var(--color-amber); text-decoration: underline;">Open Draft Video Link</a>
                    </td>
                    <td>
                      <button class="btn btn-primary btn-sm" onclick="window.videosView.openReviewModal(${v.id})">Review & Approve</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Delivered Videos Library -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Completed & Delivered Assets</div>
        </div>
        <div class="panel-body" style="padding: 0;">
          ${data.deliveredVideos.length === 0 ? `
            <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">No videos delivered yet. Check active production queue!</div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Asset Title</th>
                  <th>Delivered At</th>
                  <th>Master 4K Cloud Link</th>
                </tr>
              </thead>
              <tbody>
                ${data.deliveredVideos.map(v => `
                  <tr>
                    <td style="font-weight: 600; color: var(--text-primary);">${v.title}</td>
                    <td style="color: var(--text-muted); font-size: 12px;">${new Date(v.delivered_at || v.updated_at).toLocaleDateString()}</td>
                    <td>
                      <a href="${v.final_delivery_link}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Download Master Asset
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }
};
