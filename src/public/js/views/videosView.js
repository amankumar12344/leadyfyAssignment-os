var videosView = window.videosView = {
  videos: [],

  async render(container) {
    const isClient = auth.currentUser.role === 'CLIENT';

    container.innerHTML = `
      <div class="filter-bar">
        <div class="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="video-search-input" placeholder="Search videos by title or client...">
        </div>

        <div class="filter-actions">
          <select class="select-filter" id="video-status-filter">
            <option value="">All Pipeline Stages</option>
            <option value="SCRIPT_APPROVED">1. Script Approved</option>
            <option value="SHOOT_PENDING">2. Shoot Pending</option>
            <option value="RAW_FOOTAGE_RECEIVED">3. Raw Footage</option>
            <option value="VIDEO_EDITING">4. Video Editing</option>
            <option value="INTERNAL_QA">5. Internal QA</option>
            <option value="CLIENT_REVIEW">6. Client Review</option>
            <option value="REVISION">7. Under Revision</option>
            <option value="FINAL_APPROVED">8. Final Approved</option>
            <option value="DELIVERED">9. Delivered</option>
          </select>

          ${!isClient ? `
            <button class="btn btn-primary" onclick="window.videosView.openCreateVideoModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
              New Video Deliverable
            </button>
          ` : ''}
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Video Deliverables & Production State Machine</div>
          <span style="font-size: 12px; color: var(--text-muted);" id="videos-count-label">0 Deliverables</span>
        </div>
        <div class="panel-body" style="padding: 0;">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Video Asset Title</th>
                  <th>Client Organization</th>
                  <th>Stage / State</th>
                  <th>Assigned Editor</th>
                  <th>Revisions</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="videos-table-body">
                <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading video deliverables...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('video-search-input').addEventListener('input', () => this.applyFilters());
    document.getElementById('video-status-filter').addEventListener('change', () => this.applyFilters());

    await this.loadVideos();
  },

  async loadVideos() {
    try {
      const res = await api.get('/videos');
      this.videos = res.videos || [];
      this.applyFilters();
    } catch (err) {
      showToast('Failed to load videos: ' + err.message, 'error');
    }
  },

  applyFilters() {
    const search = (document.getElementById('video-search-input')?.value || '').toLowerCase().trim();
    const status = document.getElementById('video-status-filter')?.value || '';

    const filtered = this.videos.filter(v => {
      const matchSearch = !search ||
        (v.title && v.title.toLowerCase().includes(search)) ||
        (v.company_name && v.company_name.toLowerCase().includes(search));
      const matchStatus = !status || v.status === status;
      return matchSearch && matchStatus;
    });

    const countLabel = document.getElementById('videos-count-label');
    if (countLabel) countLabel.innerText = `${filtered.length} Deliverables`;

    const tbody = document.getElementById('videos-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No video deliverables found.</td></tr>`;
      return;
    }

    const isClient = auth.currentUser.role === 'CLIENT';

    tbody.innerHTML = filtered.map(v => {
      let badgeClass = 'badge-neutral';
      if (v.status === 'DELIVERED' || v.status === 'FINAL_APPROVED') badgeClass = 'badge-success';
      else if (v.status === 'CLIENT_REVIEW') badgeClass = 'badge-warning';
      else if (v.status === 'REVISION') badgeClass = 'badge-error';
      else if (v.status === 'VIDEO_EDITING') badgeClass = 'badge-info';

      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">
            ${v.title}
            ${v.final_delivery_link ? `
              <div style="font-size: 11px; margin-top: 2px;">
                <a href="${v.final_delivery_link}" target="_blank" style="color: var(--color-amber); text-decoration: underline;">Master 4K File</a>
              </div>
            ` : ''}
          </td>
          <td>${v.company_name}</td>
          <td><span class="badge ${badgeClass}">${v.status.replace(/_/g, ' ')}</span></td>
          <td>${v.editor_name || '<span style="color: var(--text-dim);">Unassigned</span>'}</td>
          <td style="text-align: center; font-weight: 600;">${v.revision_count}</td>
          <td style="color: var(--text-muted); font-size: 12px;">${v.deadline || 'Flexible'}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.videosView.openInspectModal(${v.id})">Details</button>

              ${isClient && v.status === 'CLIENT_REVIEW' ? `
                <button class="btn btn-primary btn-sm" onclick="window.videosView.openReviewModal(${v.id})">Review Cut</button>
              ` : ''}

              ${!isClient && v.status === 'FINAL_APPROVED' ? `
                <button class="btn btn-primary btn-sm" onclick="window.videosView.openDeliverModal(${v.id})">Final Deliver</button>
              ` : ''}

              ${!isClient && v.status !== 'DELIVERED' ? `
                <button class="btn btn-secondary btn-sm" onclick="window.videosView.openTransitionModal(${v.id})">Transition</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openInspectModal(videoId) {
    try {
      const res = await api.get(`/videos/${videoId}`);
      const v = res.video;
      const history = v.feedbackHistory || [];

      const bodyHtml = `
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">${v.title}</h2>
          <div style="font-size: 12px; color: var(--color-amber);">${v.company_name} &bull; Stage: ${v.status}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background-color: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-md); font-size: 12px;">
            <div><strong>Creator:</strong> ${v.creator_name || 'TBD'}</div>
            <div><strong>Assigned Editor:</strong> ${v.editor_name || 'Unassigned'}</div>
            <div><strong>Revisions Count:</strong> ${v.revision_count}</div>
          </div>
          <div style="background-color: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-md); font-size: 12px;">
            <div><strong>Raw Footage:</strong> ${v.raw_footage_url ? `<a href="${v.raw_footage_url}" target="_blank" style="color: var(--color-amber);">Open Drive</a>` : 'Not uploaded'}</div>
            <div><strong>Draft Preview:</strong> ${v.draft_video_url ? `<a href="${v.draft_video_url}" target="_blank" style="color: var(--color-amber);">Preview Video</a>` : 'Pending edit'}</div>
            <div><strong>Master Final:</strong> ${v.final_delivery_link ? `<a href="${v.final_delivery_link}" target="_blank" style="color: var(--status-success-text);">Download Link</a>` : 'Not delivered'}</div>
          </div>
        </div>

        <div class="panel-title" style="margin-bottom: 10px;">Client Feedback & Revision History (${history.length})</div>
        ${history.length === 0 ? `
          <div style="padding: 16px; background-color: var(--bg-input); border-radius: 4px; text-align: center; color: var(--text-dim); font-size: 13px;">
            No revision feedback logged.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px; max-height: 250px; overflow-y: auto;">
            ${history.map(item => `
              <div style="background-color: var(--bg-surface-elevated); border-left: 3px solid var(--color-amber); padding: 10px 14px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                  <span style="font-weight: 700; color: var(--color-amber);">Revision #${item.revision_number} &bull; Timestamp: ${item.timestamp_seconds}s</span>
                  <span style="color: var(--text-dim);">${new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-primary);">${item.comment}</div>
              </div>
            `).join('')}
          </div>
        `}
      `;

      window.openModal({
        title: 'Video Deliverable Inspection',
        bodyHtml,
        width: '680px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // CLIENT VIDEO REVIEW MODAL WITH TIMESTAMPED FEEDBACK
  async openReviewModal(videoId) {
    try {
      const res = await api.get(`/videos/${videoId}`);
      const v = res.video;

      const bodyHtml = `
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 17px; font-weight: 800; color: var(--text-primary);">${v.title}</h2>
          <div style="font-size: 12px; color: var(--color-amber);">Client Review Portal</div>
        </div>

        <div style="background-color: var(--bg-input); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 16px; margin-bottom: 18px; text-align: center;">
          <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 13px;">Review the draft edit submitted by your production editor:</p>
          <a href="${v.draft_video_url || '#'}" target="_blank" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Open Draft Video Player
          </a>
        </div>

        <div style="background-color: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 18px;">
          <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">Request Revisions (Timestamped Notes)</h4>
          <div class="form-row">
            <div class="form-group" style="flex: 0 0 100px;">
              <label class="form-label">Timestamp (s)</label>
              <input type="number" class="form-input" id="review-timestamp" placeholder="0.0" step="0.5" value="0.0">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Feedback Comment *</label>
              <input type="text" class="form-input" id="review-comment" placeholder="e.g. Change music track or trim first 2 seconds...">
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="window.videosView.submitClientRevision(${v.id})">Submit Revision Request</button>
        </div>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
        <button class="btn btn-success" onclick="window.videosView.submitClientApproval(${v.id})">Approve Final Cut</button>
      `;

      window.openModal({
        title: 'Review Video Draft',
        bodyHtml,
        footerHtml,
        width: '640px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitClientApproval(videoId) {
    try {
      await api.post(`/videos/${videoId}/approve`, {});
      showToast('Video draft approved! Moved to FINAL_APPROVED.', 'success');
      window.closeModal();
      await this.loadVideos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitClientRevision(videoId) {
    const timestamp_seconds = document.getElementById('review-timestamp').value;
    const comment = document.getElementById('review-comment').value.trim();

    if (!comment) {
      showToast('Please enter your feedback comment.', 'error');
      return;
    }

    try {
      await api.post(`/videos/${videoId}/feedback`, {
        feedback: [{
          timestamp_seconds: parseFloat(timestamp_seconds || 0),
          comment
        }]
      });

      showToast('Revision request sent to editor with high priority!', 'success');
      window.closeModal();
      await this.loadVideos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // FINAL DELIVERY MODAL (TRANSACTIONAL & IDEMPOTENT)
  openDeliverModal(videoId) {
    const bodyHtml = `
      <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 13px;">
        Final delivery will permanently register the master asset in the client portal, increment the completed/delivered order counters, and decrement remaining quota.
      </p>

      <div class="form-group">
        <label class="form-label">Master Cloud Asset Link (4K Master / Drive) *</label>
        <input type="url" class="form-input" id="delivery-link-input" placeholder="https://drive.google.com/file/d/master-cut-final..." required>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.videosView.submitDelivery(${videoId})">Execute Final Delivery</button>
    `;

    window.openModal({
      title: 'Execute Master Video Delivery',
      bodyHtml,
      footerHtml
    });
  },

  async submitDelivery(videoId) {
    const delivery_link = document.getElementById('delivery-link-input').value.trim();
    if (!delivery_link) {
      showToast('Please provide a valid delivery URL.', 'error');
      return;
    }

    try {
      const res = await api.post(`/videos/${videoId}/deliver`, { delivery_link });
      showToast(res.message || 'Video successfully delivered!', 'success');
      window.closeModal();
      await this.loadVideos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // State Machine Transition Modal
  async openTransitionModal(videoId) {
    const v = this.videos.find(item => item.id === videoId);
    if (!v) return;

    const bodyHtml = `
      <div style="margin-bottom: 16px; font-size: 13px;">
        Current Stage: <span class="badge badge-warning">${v.status}</span>
      </div>

      <div class="form-group">
        <label class="form-label">Target Next Stage *</label>
        <select class="form-select" id="transition-target-status">
          <option value="SHOOT_PENDING">SHOOT_PENDING</option>
          <option value="RAW_FOOTAGE_RECEIVED">RAW_FOOTAGE_RECEIVED</option>
          <option value="VIDEO_EDITING">VIDEO_EDITING</option>
          <option value="INTERNAL_QA">INTERNAL_QA</option>
          <option value="CLIENT_REVIEW">CLIENT_REVIEW</option>
          <option value="FINAL_APPROVED">FINAL_APPROVED</option>
          <option value="DELIVERED">DELIVERED</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Draft / Media Link (Optional)</label>
        <input type="url" class="form-input" id="transition-media-url" placeholder="https://storage.googleapis.com/...">
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.videosView.submitTransition(${v.id})">Execute Transition</button>
    `;

    window.openModal({
      title: `State Transition: ${v.title}`,
      bodyHtml,
      footerHtml
    });
  },

  async submitTransition(videoId) {
    const status = document.getElementById('transition-target-status').value;
    const mediaUrl = document.getElementById('transition-media-url').value.trim();

    try {
      await api.post(`/videos/${videoId}/transition`, {
        status,
        draft_video_url: mediaUrl || undefined
      });

      showToast(`Transitioned to ${status}!`, 'success');
      window.closeModal();
      await this.loadVideos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openCreateVideoModal(preselectedClientId = null, preselectedOrderId = null) {
    try {
      const ordersRes = await api.get('/orders');
      const orders = ordersRes.orders || [];

      const bodyHtml = `
        <form id="create-video-form">
          <div class="form-group">
            <label class="form-label">Order & Client *</label>
            <select class="form-select" id="new-video-order-id" required>
              <option value="">Select an active order...</option>
              ${orders.map(o => `
                <option value="${o.id}" data-client="${o.client_id}" ${preselectedOrderId === o.id ? 'selected' : ''}>
                  ${o.company_name} (${o.package_name})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Video Deliverable Title *</label>
            <input type="text" class="form-input" id="new-video-title" placeholder="e.g. Morning Hydration Routine - Hook 1" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Initial Pipeline Stage</label>
              <select class="form-select" id="new-video-status">
                <option value="SCRIPT_APPROVED">SCRIPT_APPROVED</option>
                <option value="SHOOT_PENDING">SHOOT_PENDING</option>
                <option value="RAW_FOOTAGE_RECEIVED">RAW_FOOTAGE_RECEIVED</option>
                <option value="VIDEO_EDITING">VIDEO_EDITING</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Deadline</label>
              <input type="date" class="form-input" id="new-video-deadline" value="${new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]}">
            </div>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.videosView.submitCreateVideo()">Create Deliverable</button>
      `;

      window.openModal({
        title: 'Create Video Deliverable',
        bodyHtml,
        footerHtml,
        width: '600px'
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitCreateVideo() {
    const orderSelect = document.getElementById('new-video-order-id');
    const order_id = orderSelect.value;
    const client_id = orderSelect.options[orderSelect.selectedIndex]?.getAttribute('data-client');
    const title = document.getElementById('new-video-title').value.trim();
    const status = document.getElementById('new-video-status').value;
    const deadline = document.getElementById('new-video-deadline').value;

    if (!order_id || !title) {
      showToast('Please select order and title.', 'error');
      return;
    }

    try {
      await api.post('/videos', {
        client_id: parseInt(client_id, 10),
        order_id: parseInt(order_id, 10),
        title,
        status,
        deadline
      });

      showToast('Video deliverable created!', 'success');
      window.closeModal();
      await this.loadVideos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
