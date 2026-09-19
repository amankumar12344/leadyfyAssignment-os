const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const result = await authService.login(email, password, ip);

    // Set secure cookie
    res.cookie('leadyfy_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const result = await authService.register(req.body, ip);

    res.cookie('leadyfy_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('leadyfy_token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    return res.json({ success: true, user: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
