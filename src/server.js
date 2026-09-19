const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const env = require('./config/env');
const db = require('./database/db');
const seed = require('./database/seed');

const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const orderRoutes = require('./routes/orderRoutes');
const scriptRoutes = require('./routes/scriptRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const shootRoutes = require('./routes/shootRoutes');
const videoRoutes = require('./routes/videoRoutes');
const financeRoutes = require('./routes/financeRoutes');
const taskRoutes = require('./routes/taskRoutes');
const supportRoutes = require('./routes/supportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/shoots', shootRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Leadyfy OS',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

async function startServer() {
  await db.init();
  await seed();

  const server = app.listen(env.PORT, () => {
    console.log(`==================================================`);
    console.log(`  LEADYFY OS - Agency Management SaaS`);
    console.log(`  Server running at: http://localhost:${env.PORT}`);
    console.log(`  Environment: ${env.NODE_ENV}`);
    console.log(`==================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
