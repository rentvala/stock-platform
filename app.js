'use strict';
/**
 * Smartest Stock Analysis Platform — Node.js / Express edition
 * Entry point — mirrors python app.py
 * Compatible with Hostinger Node.js hosting
 */
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

// ─── Init Firebase immediately ───────────────────────────────────────────
db.initFirebase();

// ─── App setup ───────────────────────────────────────────────────────────
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers (relaxed CSP for inline scripts in templates)
app.use(helmet({
  contentSecurityPolicy: false,
}));

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
const PORT = Config.PORT;
app.listen(PORT, () => {
  log.info(`🚀 Smartest Stock Platform running on port ${PORT}`);
  log.info(`   Open: http://localhost:${PORT}`);
  startScheduler();
});

module.exports = app;
