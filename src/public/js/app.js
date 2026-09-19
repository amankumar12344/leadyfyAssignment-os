/**
 * Leadyfy OS — Master Application Controller & Navigation Router
 */

window.app = {
  currentView: 'dashboard',

  // View definitions with metadata, permissions, and icons
  views: {
    dashboard: {
      id: 'dashboard',
      label: 'Dashboard',
      title: 'Executive Dashboard',
      subtitle: 'Real-time Agency Operations & KPIs',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`
    },
    clients: {
      id: 'clients',
      label: 'Clients',
      title: 'Client Accounts & Portfolios',
      subtitle: 'Directory of enterprise brand accounts, contracts, and 360° health metrics',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`
    },
    orders: {
      id: 'orders',
      label: 'Orders & Quotas',
      title: 'Active Orders & Live Quotas',
      subtitle: 'Monitor video packages, contract delivery targets, and remaining UGC allowances',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>`
    },
    scripts: {
      id: 'scripts',
      label: 'Scripts & Hooks',
      title: 'UGC Script Workshop',
      subtitle: 'Linear review pipeline: Concept, Draft, Client Approval, and Revision Management',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`
    },
    creators: {
      id: 'creators',
      label: 'Creator Roster',
      title: 'Creator Network & Talent Roster',
      subtitle: 'Vetted UGC creators, portfolio niches, payout agreements, and rate cards',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`
    },
    shoots: {
      id: 'shoots',
      label: 'Production Shoots',
      title: 'Production Shoots & Logistics',
      subtitle: 'Schedule shoots, assign creators, verify sample shipments, and enforce 5-point checklists',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
    },
    videos: {
      id: 'videos',
      label: 'Videos & Review',
      title: 'Video Production & Client Review Room',
      subtitle: 'Strict state-machine pipeline: Raw Footages, Editing, Review Cuts, Feedback, and Final Delivery',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    },
    finance: {
      id: 'finance',
      label: 'Financial Ledger',
      title: 'Financial Ledger & Creator Payouts',
      subtitle: 'Client revenue invoices, operating expenses, duplicate-protected creator payouts, and net profit',
      roles: ['OWNER', 'ADMIN'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    },
    tasks: {
      id: 'tasks',
      label: 'Internal Tasks',
      title: 'Operational Task Board',
      subtitle: 'Cross-functional kanban & list for agency assignments and critical deadlines',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>`
    },
    support: {
      id: 'support',
      label: 'Support Tickets',
      title: 'Client Support & Issue Desk',
      subtitle: 'Dedicated ticketing system for creative revision questions and billing inquiries',
      roles: ['OWNER', 'ADMIN', 'EMPLOYEE', 'CLIENT'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
    },
    audit: {
      id: 'audit',
      label: 'Audit Trail',
      title: 'Security & Action Audit Trail',
      subtitle: 'Chronological immutable system log of administrative, financial, and operational operations',
      roles: ['OWNER', 'ADMIN'],
      icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>`
    }
  },

  async init() {
    await window.auth.init();
    this.renderNavigation();
    
    // Hash routing or default to dashboard
    const initialHash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(initialHash);

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(hash);
    });

    this.setupNotifications();
  },

  renderNavigation() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    const user = window.auth.getCurrentUser();
    if (!user) return;

    const userRole = user.role;

    const allowedViews = Object.values(this.views).filter(v => v.roles.includes(userRole));

    nav.innerHTML = allowedViews.map(view => {
      const isActive = this.currentView === view.id;
      return `
        <a href="#${view.id}" class="nav-item ${isActive ? 'active' : ''}" data-view="${view.id}">
          <span class="nav-icon">${view.icon}</span>
          <span class="nav-label">${view.label}</span>
        </a>
      `;
    }).join('');

    // Attach click listeners to update active class immediately
    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const viewId = item.getAttribute('data-view');
        this.navigate(viewId);
      });
    });
  },

  async navigate(viewId) {
    const user = window.auth.getCurrentUser();
    if (!user) return;

    let targetView = this.views[viewId];

    // If unauthorized or view doesn't exist, default to dashboard
    if (!targetView || !targetView.roles.includes(user.role)) {
      targetView = this.views['dashboard'];
      viewId = 'dashboard';
    }

    this.currentView = viewId;
    window.location.hash = viewId;

    // Update document titles
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.innerText = targetView.title;
    if (subtitleEl) subtitleEl.innerText = targetView.subtitle;

    // Update active state in sidebar
    const nav = document.getElementById('sidebar-nav');
    if (nav) {
      nav.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-view') === viewId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    // Render corresponding view module
    const container = document.getElementById('view-container');
    if (!container) return;

    const viewModuleName = `${viewId}View`;
    if (window[viewModuleName] && typeof window[viewModuleName].render === 'function') {
      try {
        await window[viewModuleName].render(container);
      } catch (err) {
        console.error(`Error rendering view ${viewId}:`, err);
        container.innerHTML = `
          <div class="empty-state">
            <h3>Error Loading View</h3>
            <p style="color: var(--color-danger);">${err.message}</p>
          </div>
        `;
      }
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <h3>View Under Construction</h3>
          <p>Module "${viewModuleName}" is being assembled.</p>
        </div>
      `;
    }
  },

  setupNotifications() {
    const trigger = document.getElementById('notification-trigger');
    const badge = document.getElementById('notification-unread-count');

    const updateCount = async () => {
      try {
        const res = await window.api.get('/notifications/unread-count');
        if (res.success && badge) {
          if (res.count > 0) {
            badge.innerText = res.count > 99 ? '99+' : res.count;
            badge.style.display = 'block';
          } else {
            badge.style.display = 'none';
          }
        }
      } catch (err) {
        // Silently ignore background poll errors
      }
    };

    updateCount();
    setInterval(updateCount, 15000);

    if (trigger) {
      trigger.addEventListener('click', async () => {
        try {
          const res = await window.api.get('/notifications?limit=20');
          const notifications = res.notifications || [];

          window.showModal('Notifications', `
            <div style="max-height: 400px; overflow-y: auto;">
              ${notifications.length === 0 ? '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No notifications yet.</div>' : ''}
              ${notifications.map(n => `
                <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); background: ${n.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.05)'}; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 13px; color: var(--text-primary);">${n.title}</strong>
                    <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-secondary);">${n.message}</div>
                </div>
              `).join('')}
            </div>
          `, `
            <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
            <button class="btn btn-primary" id="mark-all-read-btn">Mark All Read</button>
          `);

          const markBtn = document.getElementById('mark-all-read-btn');
          if (markBtn) {
            markBtn.addEventListener('click', async () => {
              await window.api.post('/notifications/mark-all-read', {});
              if (badge) badge.style.display = 'none';
              window.closeModal();
              window.showToast('All notifications marked as read', 'success');
            });
          }
        } catch (err) {
          window.showToast(err.message, 'error');
        }
      });
    }
  }
};

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
