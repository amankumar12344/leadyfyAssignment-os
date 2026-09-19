// API Client & Utility Functions for Leadyfy OS

var api = window.api = {
  getToken() {
    return localStorage.getItem('leadyfy_token');
  },

  setToken(token) {
    localStorage.setItem('leadyfy_token', token);
  },

  clearToken() {
    localStorage.removeItem('leadyfy_token');
  },

  async request(method, path, data = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch('/api' + path, options);
      const json = await response.json();

      if (!response.ok || !json.success) {
        const errorMsg = json.error || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }

      return json;
    } catch (err) {
      console.error(`API Error [${method} ${path}]:`, err.message);
      throw err;
    }
  },

  get(path) {
    return this.request('GET', path);
  },

  post(path, data) {
    return this.request('POST', path, data);
  },

  put(path, data) {
    return this.request('PUT', path, data);
  }
};

// UI Toast Notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Modal management
window.openModal = function({ title, bodyHtml, footerHtml, width = '640px' }) {
  const modal = document.getElementById('global-modal');
  const dialog = document.getElementById('modal-dialog');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');

  dialog.style.maxWidth = width;
  titleEl.innerText = title;
  bodyEl.innerHTML = bodyHtml;
  footerEl.innerHTML = footerHtml || `
    <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
  `;

  modal.classList.add('open');
};

window.closeModal = function() {
  const modal = document.getElementById('global-modal');
  if (modal) modal.classList.remove('open');
};

window.api = api;
window.showToast = showToast;

window.showModal = function(title, bodyHtml, footerHtml, width) {
  if (typeof title === 'object') {
    return window.openModal(title);
  }
  return window.openModal({ title, bodyHtml, footerHtml, width });
};

