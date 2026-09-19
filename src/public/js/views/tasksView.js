var tasksView = window.tasksView = {
  tasks: [],

  async render(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div class="filter-actions">
          <select class="select-filter" id="task-status-filter">
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
          <select class="select-filter" id="task-priority-filter">
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <button class="btn btn-primary" onclick="window.tasksView.openCreateTaskModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
          New Task
        </button>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Operations & Creative Task Board</div>
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Task Description</th>
                <th>Assigned To</th>
                <th>Associated Order</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="tasks-table-body">
              <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading tasks...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('task-status-filter').addEventListener('change', () => this.applyFilters());
    document.getElementById('task-priority-filter').addEventListener('change', () => this.applyFilters());

    await this.loadTasks();
  },

  async loadTasks() {
    try {
      const res = await api.get('/tasks');
      this.tasks = res.tasks || [];
      this.applyFilters();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  applyFilters() {
    const status = document.getElementById('task-status-filter')?.value || '';
    const priority = document.getElementById('task-priority-filter')?.value || '';

    const filtered = this.tasks.filter(t => {
      const matchStatus = !status || t.status === status;
      const matchPriority = !priority || t.priority === priority;
      return matchStatus && matchPriority;
    });

    const tbody = document.getElementById('tasks-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">No tasks found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(t => `
      <tr>
        <td>
          <span class="badge ${t.priority === 'URGENT' ? 'badge-error' : (t.priority === 'HIGH' ? 'badge-warning' : 'badge-neutral')}">
            ${t.priority}
          </span>
        </td>
        <td style="font-weight: 600; color: var(--text-primary);">
          ${t.title}
          ${t.description ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">${t.description}</div>` : ''}
        </td>
        <td>${t.assigned_user_name || 'Unassigned'}</td>
        <td>${t.company_name ? `${t.company_name} (${t.package_name})` : '-'}</td>
        <td style="color: var(--text-muted); font-size: 12px;">${t.deadline || '-'}</td>
        <td>
          <span class="badge ${t.status === 'DONE' ? 'badge-success' : (t.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-neutral')}">
            ${t.status}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${t.status !== 'DONE' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.tasksView.updateStatus(${t.id}, 'DONE')">Complete</button>
            ` : ''}
            ${t.status === 'TODO' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.tasksView.updateStatus(${t.id}, 'IN_PROGRESS')">Start</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  async updateStatus(taskId, status) {
    try {
      await api.put(`/tasks/${taskId}`, { status });
      showToast(`Task marked as ${status}.`, 'success');
      await this.loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openCreateTaskModal() {
    const bodyHtml = `
      <form id="create-task-form">
        <div class="form-group">
          <label class="form-label">Task Title *</label>
          <input type="text" class="form-input" id="task-title-input" placeholder="e.g. Export 4K clean master file" required>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="task-desc-input" rows="3"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-select" id="task-priority-input">
              <option value="LOW">Low</option>
              <option value="MEDIUM" selected>Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Deadline</label>
            <input type="date" class="form-input" id="task-deadline-input" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.tasksView.submitCreateTask()">Create Task</button>
    `;

    window.openModal({
      title: 'Create Internal Task',
      bodyHtml,
      footerHtml
    });
  },

  async submitCreateTask() {
    const title = document.getElementById('task-title-input').value.trim();
    const description = document.getElementById('task-desc-input').value.trim();
    const priority = document.getElementById('task-priority-input').value;
    const deadline = document.getElementById('task-deadline-input').value;

    if (!title) {
      showToast('Task title is required.', 'error');
      return;
    }

    try {
      await api.post('/tasks', {
        title,
        description,
        priority,
        deadline,
        status: 'TODO'
      });

      showToast('Task created.', 'success');
      window.closeModal();
      await this.loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
