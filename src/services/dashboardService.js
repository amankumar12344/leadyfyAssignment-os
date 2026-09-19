const db = require('../database/db');
const { getFinancialSummary } = require('./financeService');

async function getDashboardData(user) {
  if (user.role === 'CLIENT') {
    return await getClientDashboard(user.clientId);
  } else if (user.role === 'EMPLOYEE') {
    return await getEmployeeDashboard(user);
  } else {
    // OWNER or ADMIN / OPERATIONS_MANAGER
    return await getExecutiveDashboard(user);
  }
}

// 1. EXECUTIVE / ADMIN DASHBOARD
async function getExecutiveDashboard(user) {
  const [
    clientStats,
    orderStats,
    scriptStats,
    videoStats,
    shootStats,
    todayShoots,
    urgentTasks,
    financialSummary,
    recentActivity,
    alerts
  ] = await Promise.all([
    // Clients
    db.get(`
      SELECT
        COUNT(*) as total_clients,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_clients,
        SUM(CASE WHEN status IN ('NEW', 'LEAD', 'ONBOARDING') THEN 1 ELSE 0 END) as new_clients
      FROM clients
    `),
    // Orders
    db.get(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('NEW', 'ONBOARDING', 'IN_PRODUCTION') THEN 1 ELSE 0 END) as active_orders,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders
      FROM orders
    `),
    // Scripts
    db.get(`
      SELECT
        COUNT(*) as total_scripts,
        SUM(CASE WHEN status IN ('DRAFT', 'ASSIGNED', 'IN_REVIEW') THEN 1 ELSE 0 END) as pending_scripts,
        SUM(CASE WHEN status = 'SENT_TO_CLIENT' THEN 1 ELSE 0 END) as pending_client_approval,
        SUM(CASE WHEN status = 'REVISION_REQUIRED' THEN 1 ELSE 0 END) as revision_scripts,
        SUM(CASE WHEN status IN ('APPROVED', 'READY_FOR_SHOOT') THEN 1 ELSE 0 END) as approved_scripts
      FROM scripts
    `),
    // Videos pipeline
    db.get(`
      SELECT
        COUNT(*) as total_videos,
        SUM(CASE WHEN status IN ('SCRIPT_APPROVED', 'SHOOT_PENDING', 'RAW_FOOTAGE_RECEIVED', 'VIDEO_EDITING', 'INTERNAL_QA') THEN 1 ELSE 0 END) as in_production,
        SUM(CASE WHEN status = 'CLIENT_REVIEW' THEN 1 ELSE 0 END) as pending_client_review,
        SUM(CASE WHEN status = 'REVISION' THEN 1 ELSE 0 END) as under_revision,
        SUM(CASE WHEN status = 'FINAL_APPROVED' THEN 1 ELSE 0 END) as final_approved,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered
      FROM videos
    `),
    // Shoots
    db.get(`
      SELECT
        COUNT(*) as total_shoots,
        SUM(CASE WHEN status IN ('SCHEDULED', 'CONFIRMED') AND shoot_date >= date('now') THEN 1 ELSE 0 END) as upcoming_shoots,
        SUM(CASE WHEN shoot_date = date('now') THEN 1 ELSE 0 END) as today_shoots_count
      FROM shoots
    `),
    // Today's Shoots
    db.all(`
      SELECT sh.*, c.company_name, cr.name as creator_name
      FROM shoots sh
      JOIN clients c ON sh.client_id = c.id
      JOIN creators cr ON sh.creator_id = cr.id
      WHERE sh.shoot_date = date('now')
      ORDER BY sh.shoot_time ASC
    `),
    // Urgent Tasks
    db.all(`
      SELECT t.*, u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_user_id = u.id
      WHERE t.status != 'DONE' AND (t.priority = 'URGENT' OR t.deadline <= date('now', '+1 day'))
      ORDER BY t.priority = 'URGENT' DESC, t.deadline ASC
      LIMIT 10
    `),
    // Financials
    getFinancialSummary(),
    // Recent Activity
    db.all(`
      SELECT l.*, u.full_name as actor_name
      FROM activity_logs l
      LEFT JOIN users u ON l.actor_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 15
    `),
    // Alerts (Pending client actions, overdue invoices, urgent bottlenecks)
    db.all(`
      SELECT 'OVERDUE_INVOICE' as alert_type, invoice_number as reference, outstanding_balance as amount, created_at
      FROM payments
      WHERE status = 'OVERDUE' OR (status = 'UNPAID' AND created_at < datetime('now', '-15 days'))
      LIMIT 5
    `)
  ]);

  return {
    viewType: 'EXECUTIVE',
    kpis: {
      activeClients: clientStats.active_clients || 0,
      newClients: clientStats.new_clients || 0,
      activeOrders: orderStats.active_orders || 0,
      pendingScripts: scriptStats.pending_scripts || 0,
      upcomingShoots: shootStats.upcoming_shoots || 0,
      videosInProduction: videoStats.in_production || 0,
      pendingClientReview: videoStats.pending_client_review || 0,
      videosUnderRevision: videoStats.under_revision || 0,
      deliveredVideos: videoStats.delivered || 0,
      todayShootsCount: shootStats.today_shoots_count || 0
    },
    financials: financialSummary,
    todayShoots,
    urgentTasks,
    recentActivity,
    alerts
  };
}

// 2. EMPLOYEE DASHBOARD (SCOPED STRICTLY BY SUB-ROLE)
async function getEmployeeDashboard(user) {
  const subRole = user.sub_role;
  const empId = user.employeeId;

  let scopedData = {};

  if (subRole === 'EDITOR') {
    // EDITOR: Overdue, Due Today, Due Tomorrow, Revision, Completed
    const [overdue, dueToday, dueTomorrow, revisionQueue, completedRecent] = await Promise.all([
      db.all(`
        SELECT v.*, c.company_name, s.title as script_title
        FROM videos v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN scripts s ON v.script_id = s.id
        WHERE v.assigned_editor_id = ? AND v.deadline < date('now') AND v.status NOT IN ('FINAL_APPROVED', 'DELIVERED')
        ORDER BY v.deadline ASC
      `, [empId]),
      db.all(`
        SELECT v.*, c.company_name, s.title as script_title
        FROM videos v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN scripts s ON v.script_id = s.id
        WHERE v.assigned_editor_id = ? AND v.deadline = date('now') AND v.status NOT IN ('FINAL_APPROVED', 'DELIVERED')
      `, [empId]),
      db.all(`
        SELECT v.*, c.company_name, s.title as script_title
        FROM videos v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN scripts s ON v.script_id = s.id
        WHERE v.assigned_editor_id = ? AND v.deadline = date('now', '+1 day') AND v.status NOT IN ('FINAL_APPROVED', 'DELIVERED')
      `, [empId]),
      db.all(`
        SELECT v.*, c.company_name, s.title as script_title
        FROM videos v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN scripts s ON v.script_id = s.id
        WHERE v.assigned_editor_id = ? AND v.status = 'REVISION'
        ORDER BY v.updated_at DESC
      `, [empId]),
      db.all(`
        SELECT v.*, c.company_name
        FROM videos v
        JOIN clients c ON v.client_id = c.id
        WHERE v.assigned_editor_id = ? AND v.status IN ('FINAL_APPROVED', 'DELIVERED')
        ORDER BY v.completed_at DESC
        LIMIT 10
      `, [empId])
    ]);

    scopedData = {
      roleTitle: 'Video Editor Workstation',
      overdue,
      dueToday,
      dueTomorrow,
      revisionQueue,
      completedRecent
    };
  } else if (subRole === 'SCRIPT_WRITER') {
    const assignedScripts = await db.all(`
      SELECT s.*, c.company_name, o.package_name
      FROM scripts s
      JOIN clients c ON s.client_id = c.id
      JOIN orders o ON s.order_id = o.id
      WHERE s.writer_id = ?
      ORDER BY CASE s.status WHEN 'REVISION_REQUIRED' THEN 1 WHEN 'DRAFT' THEN 2 WHEN 'ASSIGNED' THEN 3 ELSE 4 END, s.deadline ASC
    `, [empId]);

    scopedData = {
      roleTitle: 'Script Writer Desk',
      scripts: assignedScripts
    };
  } else if (subRole === 'SHOOT_MANAGER') {
    const upcomingShoots = await db.all(`
      SELECT sh.*, c.company_name, cr.name as creator_name
      FROM shoots sh
      JOIN clients c ON sh.client_id = c.id
      JOIN creators cr ON sh.creator_id = cr.id
      WHERE sh.shoot_manager_id = ? AND sh.status NOT IN ('CANCELLED', 'COMPLETED')
      ORDER BY sh.shoot_date ASC, sh.shoot_time ASC
    `, [empId]);

    scopedData = {
      roleTitle: 'Shoot Logistics Desk',
      shoots: upcomingShoots
    };
  } else {
    // SALES or General Employee
    const myClients = await db.all(`
      SELECT * FROM clients WHERE assigned_employee_id = ? ORDER BY created_at DESC
    `, [empId]);

    scopedData = {
      roleTitle: 'Sales & Client Onboarding',
      clients: myClients
    };
  }

  // Personal tasks
  const myTasks = await db.all(`
    SELECT * FROM tasks
    WHERE assigned_user_id = ? AND status != 'DONE'
    ORDER BY CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, deadline ASC
  `, [user.id]);

  return {
    viewType: 'EMPLOYEE',
    subRole,
    ...scopedData,
    myTasks
  };
}

// 3. ISOLATED CLIENT PORTAL DASHBOARD
async function getClientDashboard(clientId) {
  if (!clientId) {
    throw new Error('Client organization identifier not provided.');
  }

  const [
    client,
    orders,
    scripts,
    videos,
    invoices,
    supportTickets,
    assets
  ] = await Promise.all([
    db.get("SELECT id, client_name, company_name, brand_name, status FROM clients WHERE id = ?", [clientId]),
    db.all(`
      SELECT *, (video_count - completed_videos_count) as remaining_quota
      FROM orders
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [clientId]),
    db.all(`
      SELECT * FROM scripts
      WHERE client_id = ?
      ORDER BY id DESC
    `, [clientId]),
    db.all(`
      SELECT * FROM videos
      WHERE client_id = ?
      ORDER BY id DESC
    `, [clientId]),
    db.all(`
      SELECT id, invoice_number, invoice_amount, amount_received, outstanding_balance, payment_date, status
      FROM payments
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [clientId]),
    db.all(`
      SELECT * FROM support_tickets
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [clientId]),
    db.all(`
      SELECT * FROM assets
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [clientId])
  ]);

  // Action required by client:
  const pendingScriptApprovals = scripts.filter(s => s.status === 'SENT_TO_CLIENT');
  const pendingVideoReviews = videos.filter(v => v.status === 'CLIENT_REVIEW');
  const deliveredVideos = videos.filter(v => v.status === 'DELIVERED');

  return {
    viewType: 'CLIENT',
    client,
    summary: {
      activeOrdersCount: orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length,
      pendingScriptApprovalsCount: pendingScriptApprovals.length,
      pendingVideoReviewsCount: pendingVideoReviews.length,
      deliveredVideosCount: deliveredVideos.length
    },
    orders,
    pendingScriptApprovals,
    pendingVideoReviews,
    deliveredVideos,
    invoices,
    supportTickets,
    assets
  };
}

module.exports = {
  getDashboardData
};
