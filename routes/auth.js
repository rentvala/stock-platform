'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../modules/firebase_db');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.render('login', { title: 'Login' });
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }
    req.session.userId = user.id;
    req.flash('success', `Welcome back, ${user.username}!`);
    res.redirect('/');
  } catch (e) {
    req.flash('error', 'Login error: ' + e.message);
    res.redirect('/login');
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// GET /settings — change password / theme
router.get('/settings', async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  res.render('settings', { title: 'Settings' });
});

router.post('/settings/password', async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  const { current_pass, new_pass } = req.body;
  try {
    const user = await db.getUserById(req.session.userId);
    const match = await bcrypt.compare(current_pass, user.password_hash);
    if (!match) { req.flash('error', 'Current password incorrect.'); return res.redirect('/settings'); }
    const hash = await bcrypt.hash(new_pass, 12);
    await db.updatePassword(user.id, hash);
    req.flash('success', 'Password updated successfully.');
    res.redirect('/settings');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings');
  }
});

router.post('/settings/theme', async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  const { theme } = req.body;
  await db.updateUserTheme(req.session.userId, theme);
  res.json({ ok: true });
});

module.exports = router;
