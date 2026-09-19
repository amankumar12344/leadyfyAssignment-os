// Authentication & Role State Manager

var auth = window.auth = window.authService = {
  currentUser: null,

  getCurrentUser() {
    return this.currentUser;
  },

  async init() {
    try {
      if (api.getToken()) {
        const res = await api.get('/auth/me');
        this.currentUser = res.user;
      } else {
        // Auto-login as Owner for immediate live operation
        await this.login('owner@leadyfy.com', 'password123');
      }
    } catch (e) {
      console.warn('Session expired or invalid. Re-authenticating as Owner...');
      await this.login('owner@leadyfy.com', 'password123');
    }

    this.updateUserUI();
    this.setupRoleSwitcher();
  },

  async login(email, password) {
    try {
      const res = await api.post('/auth/login', { email, password });
      api.setToken(res.token);
      this.currentUser = res.user;
      this.updateUserUI();
      showToast(`Logged in as ${res.user.fullName} (${res.user.role})`, 'success');
      return res.user;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  },

  async switchRole(email) {
    await this.login(email, 'password123');
    // Re-render navigation and active view
    if (window.app) {
      window.app.renderNavigation();
      window.app.navigate(window.app.currentView || 'dashboard');
    }
  },

  updateUserUI() {
    if (!this.currentUser) return;

    const initialsEl = document.getElementById('user-avatar-initials');
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const switcherSelect = document.getElementById('role-switcher-select');

    if (initialsEl) {
      const names = (this.currentUser.full_name || this.currentUser.fullName || 'User').split(' ');
      initialsEl.innerText = names.map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }

    if (nameEl) {
      nameEl.innerText = this.currentUser.full_name || this.currentUser.fullName;
    }

    if (roleEl) {
      const role = this.currentUser.role;
      const subRole = this.currentUser.sub_role || this.currentUser.subRole;
      roleEl.innerText = (subRole && subRole !== 'NONE') ? `${role}: ${subRole}` : role;
    }

    if (switcherSelect) {
      switcherSelect.value = this.currentUser.email;
    }
  },

  async register(data) {
    try {
      const res = await api.post('/auth/register', data);
      api.setToken(res.token);
      this.currentUser = res.user;
      this.updateUserUI();
      if (window.closeModal) window.closeModal();
      showToast(`Account created for ${res.user.fullName}! Welcome to Leadyfy OS.`, 'success');
      if (window.app) {
        window.app.renderNavigation();
        window.app.navigate('dashboard');
      }
      return res.user;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  },

  showLoginModal(initialTab = 'login') {
    const isLogin = initialTab === 'login';
    const bodyHtml = `
      <div style="display: flex; border-bottom: 1px solid var(--border-subtle); margin-bottom: 20px; gap: 8px;">
        <button id="tab-btn-login" class="btn ${isLogin ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;" onclick="window.auth.switchLoginTab('login')">Sign In</button>
        <button id="tab-btn-register" class="btn ${!isLogin ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;" onclick="window.auth.switchLoginTab('register')">Create Client Account</button>
      </div>

      <div id="login-tab-content" style="display: ${isLogin ? 'block' : 'none'};">
        <form id="login-form" onsubmit="event.preventDefault(); window.auth.handleLoginFormSubmit();">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="name@company.com" required value="owner@leadyfy.com">
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="Enter password" required value="password123">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In to Leadyfy OS</button>
        </form>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Quick 1-Click Role Testing</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.auth.quickLogin('owner@leadyfy.com')">👑 Owner</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.auth.quickLogin('admin@leadyfy.com')">⚙️ Admin</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.auth.quickLogin('writer@leadyfy.com')">✍️ Writer</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.auth.quickLogin('editor@leadyfy.com')">🎬 Editor</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.auth.quickLogin('client1@glowbeauty.com')">🌟 Client 1</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.auth.quickLogin('client2@fitfuel.com')">💪 Client 2</button>
          </div>
        </div>
      </div>

      <div id="register-tab-content" style="display: ${!isLogin ? 'block' : 'none'};">
        <form id="register-form" onsubmit="event.preventDefault(); window.auth.handleRegisterFormSubmit();">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Full Name</label>
            <input type="text" id="reg-name" class="form-control" placeholder="e.g. Priyanshu Sharma" required>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Brand / Company Name</label>
            <input type="text" id="reg-company" class="form-control" placeholder="e.g. Zen Skin Wellness" required>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Work Email</label>
            <input type="email" id="reg-email" class="form-control" placeholder="priyanshu@zenskin.com" required>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Password</label>
            <input type="password" id="reg-password" class="form-control" placeholder="Create password" required value="password123">
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Phone / WhatsApp</label>
            <input type="text" id="reg-phone" class="form-control" placeholder="+91 98765 43210">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Create Account & Enter Portal</button>
        </form>
      </div>
    `;

    window.openModal({
      title: 'Leadyfy OS — Authentication & Access',
      bodyHtml,
      width: '480px'
    });
  },

  switchLoginTab(tab) {
    const isLogin = tab === 'login';
    const loginTab = document.getElementById('login-tab-content');
    const regTab = document.getElementById('register-tab-content');
    const btnLogin = document.getElementById('tab-btn-login');
    const btnReg = document.getElementById('tab-btn-register');

    if (loginTab) loginTab.style.display = isLogin ? 'block' : 'none';
    if (regTab) regTab.style.display = !isLogin ? 'block' : 'none';
    if (btnLogin) btnLogin.className = `btn ${isLogin ? 'btn-primary' : 'btn-secondary'}`;
    if (btnReg) btnReg.className = `btn ${!isLogin ? 'btn-primary' : 'btn-secondary'}`;
  },

  async handleLoginFormSubmit() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    await this.login(email, password);
    if (window.closeModal) window.closeModal();
    if (window.app) {
      window.app.renderNavigation();
      window.app.navigate('dashboard');
    }
  },

  async handleRegisterFormSubmit() {
    const full_name = document.getElementById('reg-name').value.trim();
    const company_name = document.getElementById('reg-company').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value.trim();

    await this.register({
      full_name,
      company_name,
      email,
      password,
      phone,
      role: 'CLIENT'
    });
  },

  async quickLogin(email) {
    await this.login(email, 'password123');
    if (window.closeModal) window.closeModal();
    if (window.app) {
      window.app.renderNavigation();
      window.app.navigate('dashboard');
    }
  },

  setupRoleSwitcher() {
    const switcherSelect = document.getElementById('role-switcher-select');
    if (switcherSelect) {
      switcherSelect.addEventListener('change', (e) => {
        this.switchRole(e.target.value);
      });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await api.post('/auth/logout', {});
        } catch (e) {}
        api.clearToken();
        this.currentUser = null;
        showToast('Logged out.', 'info');
        this.showLoginModal('login');
      });
    }
  }
};

window.auth = auth;
window.authService = auth;
