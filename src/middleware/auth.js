const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../database/db');

async function requireAuth(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.leadyfy_token) {
      token = req.cookies.leadyfy_token;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await db.get(`
      SELECT id, email, full_name, role, sub_role, phone, is_active
      FROM users
      WHERE id = ? AND is_active = 1
    `, [decoded.id]);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists or is inactive.' });
    }

    // Attach client details if CLIENT
    if (user.role === 'CLIENT') {
      const client = await db.get("SELECT id, company_name, client_name FROM clients WHERE user_id = ?", [user.id]);
      if (client) {
        user.clientId = client.id;
        user.companyName = client.company_name;
      }
    }

    // Attach employee details if EMPLOYEE or ADMIN
    if (user.role === 'EMPLOYEE' || user.role === 'ADMIN') {
      const employee = await db.get("SELECT id, department FROM employees WHERE user_id = ?", [user.id]);
      if (employee) {
        user.employeeId = employee.id;
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
  }
}

module.exports = { requireAuth };
