var creatorsView = window.creatorsView = {
  creators: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="creator-search-input" placeholder="Search creators by name, niche, location...">
        </div>

        <div class="filter-actions">
          <select class="select-filter" id="creator-availability-filter">
            <option value="">All Availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="BOOKED">Booked</option>
            <option value="ON_HOLD">On Hold</option>
          </select>

          ${auth.currentUser.role !== 'CLIENT' ? `
            <button class="btn btn-primary" onclick="window.creatorsView.openCreateCreatorModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
              Add Creator
            </button>
          ` : ''}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;" id="creators-grid">
        <div style="padding: 30px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">Loading creators...</div>
      </div>
    `;

    document.getElementById('creator-search-input').addEventListener('input', () => this.applyFilters());
    document.getElementById('creator-availability-filter').addEventListener('change', () => this.applyFilters());

    await this.loadCreators();
  },

  async loadCreators() {
    try {
      const res = await api.get('/creators');
      this.creators = res.creators || [];
      this.applyFilters();
    } catch (err) {
      showToast('Failed to load creators: ' + err.message, 'error');
    }
  },

  applyFilters() {
    const search = (document.getElementById('creator-search-input')?.value || '').toLowerCase().trim();
    const status = document.getElementById('creator-availability-filter')?.value || '';

    const filtered = this.creators.filter(c => {
      const matchSearch = !search ||
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.niches && c.niches.toLowerCase().includes(search)) ||
        (c.location && c.location.toLowerCase().includes(search));
      const matchStatus = !status || c.availability_status === status;
      return matchSearch && matchStatus;
    });

    const grid = document.getElementById('creators-grid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">No creators found.</div>`;
      return;
    }

    const isClient = auth.currentUser.role === 'CLIENT';

    grid.innerHTML = filtered.map(c => `
      <div class="panel-card" style="margin-bottom: 0; display: flex; flex-direction: column;">
        <div class="panel-body" style="flex: 1; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; gap: 14px; align-items: center;">
            <img src="${c.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}" alt="${c.name}" style="width: 54px; height: 54px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-strong);">
            <div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">${c.name}</h3>
              <div style="font-size: 12px; color: var(--text-muted);">${c.location} &bull; ${c.age_group} (${c.gender})</div>
            </div>
          </div>

          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 4px;">Niches & Categories</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${(c.niches || 'Lifestyle').split(',').map(n => `<span class="badge badge-neutral" style="font-size: 10px;">${n.trim()}</span>`).join('')}
            </div>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary);">
            <div><strong>Languages:</strong> ${c.languages || 'English'}</div>
            <div><strong>Audience:</strong> ${c.demographics || 'All'}</div>
          </div>

          ${!isClient && c.standard_rate !== undefined ? `
            <div style="background-color: var(--bg-surface-elevated); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Standard Rate / Video</span>
              <span style="font-size: 14px; font-weight: 800; color: var(--color-amber);">₹${Number(c.standard_rate).toLocaleString('en-IN')}</span>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
            <span class="badge ${c.availability_status === 'AVAILABLE' ? 'badge-success' : (c.availability_status === 'BOOKED' ? 'badge-warning' : 'badge-neutral')}">
              ${c.availability_status}
            </span>

            ${!isClient ? `
              <button class="btn btn-secondary btn-sm" onclick="window.shootsView.openScheduleShootModal(${c.id})">Book for Shoot</button>
            ` : (c.portfolio_url ? `
              <a href="${c.portfolio_url}" target="_blank" class="btn btn-secondary btn-sm">Portfolio</a>
            ` : '')}
          </div>
        </div>
      </div>
    `).join('');
  },

  openCreateCreatorModal() {
    const bodyHtml = `
      <form id="create-creator-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Creator Full Name *</label>
            <input type="text" class="form-input" id="new-creator-name" placeholder="e.g. Meera Joshi" required>
          </div>
          <div class="form-group">
            <label class="form-label">Photo URL</label>
            <input type="url" class="form-input" id="new-creator-photo" placeholder="https://images.unsplash.com/...">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Location (City, State) *</label>
            <input type="text" class="form-input" id="new-creator-location" placeholder="e.g. Mumbai, MH" required>
          </div>
          <div class="form-group">
            <label class="form-label">Standard Rate per Video (₹) *</label>
            <input type="number" class="form-input" id="new-creator-rate" value="12000" min="0" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Niches (Comma separated)</label>
            <input type="text" class="form-input" id="new-creator-niches" placeholder="Beauty, Fashion, Skincare">
          </div>
          <div class="form-group">
            <label class="form-label">Languages</label>
            <input type="text" class="form-input" id="new-creator-languages" placeholder="English, Hindi">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bank / UPI Account Info (Protected)</label>
            <input type="text" class="form-input" id="new-creator-bank" placeholder="name@upi / IFSC + Acc">
          </div>
          <div class="form-group">
            <label class="form-label">Portfolio / Social Link</label>
            <input type="url" class="form-input" id="new-creator-portfolio" placeholder="https://instagram.com/...">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.creatorsView.submitCreateCreator()">Save Creator</button>
    `;

    window.openModal({
      title: 'Add New Creator to Roster',
      bodyHtml,
      footerHtml,
      width: '640px'
    });
  },

  async submitCreateCreator() {
    const name = document.getElementById('new-creator-name').value.trim();
    const photo_url = document.getElementById('new-creator-photo').value.trim();
    const location = document.getElementById('new-creator-location').value.trim();
    const standard_rate = document.getElementById('new-creator-rate').value;
    const niches = document.getElementById('new-creator-niches').value.trim();
    const languages = document.getElementById('new-creator-languages').value.trim();
    const bank_upi_info = document.getElementById('new-creator-bank').value.trim();
    const portfolio_url = document.getElementById('new-creator-portfolio').value.trim();

    if (!name || !location || !standard_rate) {
      showToast('Please fill in name, location, and rate.', 'error');
      return;
    }

    try {
      await api.post('/creators', {
        name,
        photo_url,
        location,
        standard_rate: parseFloat(standard_rate),
        niches,
        languages,
        bank_upi_info,
        portfolio_url
      });

      showToast(`Creator ${name} added to roster!`, 'success');
      window.closeModal();
      await this.loadCreators();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
