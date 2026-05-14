'use strict';
/**
 * Smartest Stock Analysis Platform — Node.js / Express edition
 * Entry point — Compatible with Hostinger Node.js hosting
 */

// ─── Crash protection — logs errors before dying ──────────────────────────
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

console.log('=== APP STARTING ===');
console.log('Node version:', process.version);
console.log('PORT env:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FIREBASE_SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
console.log('FIREBASE_SERVICE_ACCOUNT set:', !!process.env.FIREBASE_SERVICE_ACCOUNT);

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');

const Config = require('./config');
const db = require('./modules/firebase_db');
const { startScheduler } = require('./modules/scheduler');
const log = require('./modules/logger');

// ─── Init Firebase with error handling ───────────────────────────────────
console.log('Initializing Firebase...');
try {
  db.initFirebase();
  console.log('Firebase initialized OK');
} catch (e) {
  console.error('Firebase init FAILED:', e.message);
  // Don't crash — app will still start, Firebase-dependent routes will error gracefully
}

// ─── App setup ───────────────────────────────────────────────────────────
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: Config.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: Config.SESSION_COOKIE_SECURE,
    sameSite: Config.SESSION_COOKIE_SAMESITE,
    maxAge: Config.SESSION_MAX_AGE,
  },
}));
app.use(flash());

// ─── Health check (always works, even if Firebase is down) ───────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Auth middleware ──────────────────────────────────────────────────────
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  req.flash('error', 'Please log in first.');
  res.redirect('/login');
}

// Make user + flash available to all templates
app.use(async (req, res, next) => {
  res.locals.flash_messages = req.flash();
  res.locals.user = null;
  res.locals.config = Config;
  if (req.session && req.session.userId) {
    try {
      const user = await db.getUserById(req.session.userId);
      res.locals.user = user;
      req.user = user;
    } catch (e) { /* ignore */ }
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/', require('./routes/auth'));
app.use('/', requireLogin, require('./routes/dashboard'));
app.use('/market', requireLogin, require('./routes/market'));
app.use('/watchlist', requireLogin, require('./routes/watchlist'));
app.use('/alerts', requireLogin, require('./routes/alerts'));
app.use('/recommendations', requireLogin, require('./routes/recommendations'));
app.use('/paper-trade', requireLogin, require('./routes/paper_trade'));
app.use('/reports', requireLogin, require('./routes/reports'));
app.use('/media', requireLogin, require('./routes/media'));
app.use('/api', requireLogin, require('./routes/api'));

// ─── 404 + Error handlers ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', code: 404 });
});
app.use((err, req, res, next) => {
  log.error('Unhandled error:', err);
  res.status(500).render('error', { message: err.message || 'Internal server error', code: 500 });
});

// ─── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || Config.PORT || 3000;
console.log('Starting server on port:', PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER STARTED on port ${PORT}`);
  log.info(`Smartest Stock Platform running on port ${PORT}`);
  startScheduler();
});

module.exports = app;