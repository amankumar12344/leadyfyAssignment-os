const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../database/db');
const { logAudit } = require('./auditService');

async function login(email, password, ipAddress = '127.0.0.1') {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const user = await db.get(`
    SELECT id, email, password_hash, full_name, role, sub_role, phone, is_active
    FROM users
    WHERE email = ?
  `, [email.toLowerCase().trim()]);

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  if (!user.is_active) {
    throw new Error('This account has been deactivated. Contact your administrator.');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  // If role is CLIENT, fetch client record
  let clientInfo = null;
  if (user.role === 'CLIENT') {
    clientInfo = await db.get("SELECT id, client_name, company_name, status FROM clients WHERE user_id = ?", [user.id]);
  }

  let employeeInfo = null;
  if (user.role === 'EMPLOYEE' || user.role === 'ADMIN') {
    employeeInfo = await db.get("SELECT id, department FROM employees WHERE user_id = ?", [user.id]);
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      sub_role: user.sub_role,
      clientId: clientInfo ? clientInfo.id : null,
      employeeId: employeeInfo ? employeeInfo.id : null
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  await logAudit({
    actor_id: user.id,
    action: 'USER_LOGIN',
    entity: 'USERS',
    entity_id: user.id,
    metadata: { role: user.role, email: user.email },
    ip_address: ipAddress
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      subRole: user.sub_role,
      clientId: clientInfo ? clientInfo.id : null,
      clientCompanyName: clientInfo ? clientInfo.company_name : null,
      employeeId: employeeInfo ? employeeInfo.id : null
    }
  };
}

async function getProfile(userId) {
  const user = await db.get(`
    SELECT id, email, full_name, role, sub_role, phone, is_active, created_at
    FROM users
    WHERE id = ?
  `, [userId]);

  if (!user) return null;

  let clientInfo = null;
  if (user.role === 'CLIENT') {
    clientInfo = await db.get("SELECT id, client_name, company_name, status, brand_name, gst_tax_id FROM clients WHERE user_id = ?", [user.id]);
  }

  let employeeInfo = null;
  if (user.role === 'EMPLOYEE' || user.role === 'ADMIN') {
    employeeInfo = await db.get("SELECT id, department, salary, joining_date, skills FROM employees WHERE user_id = ?", [user.id]);
  }

  return {
    ...user,
    client: clientInfo,
    employee: employeeInfo
  };
}

async function register(data, ipAddress = '127.0.0.1') {
  const { full_name, email, password, phone, role = 'CLIENT', sub_role = 'NONE', company_name } = data;
  if (!email || !password || !full_name) {
    throw new Error('Full name, email, and password are required.');
  }

  const existing = await db.get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = (role === 'OWNER' || role === 'ADMIN') ? 'CLIENT' : role;

  let newUserId;
  let clientId = null;

  await db.transaction(async () => {
    const userRes = await db.run(`
      INSERT INTO users (email, password_hash, full_name, role, sub_role, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [email.toLowerCase().trim(), passwordHash, full_name.trim(), userRole, sub_role, phone || null]);

    newUserId = userRes.lastID;

    if (userRole === 'CLIENT') {
      const clientCompany = (company_name || full_name + ' Brand').trim();
      const clientRes = await db.run(`
        INSERT INTO clients (user_id, client_name, company_name, email, phone, status)
        VALUES (?, ?, ?, ?, ?, 'NEW')
      `, [newUserId, full_name.trim(), clientCompany, email.toLowerCase().trim(), phone || null]);
      clientId = clientRes.lastID;
    }
  });

  await logAudit({
    actor_id: newUserId,
    action: 'USER_REGISTER',
    entity: 'USERS',
    entity_id: newUserId,
    metadata: { role: userRole, email },
    ip_address: ipAddress
  });

  return login(email, password, ipAddress);
}

module.exports = {
  login,
  register,
  getProfile
};
