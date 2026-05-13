'use strict';
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');

router.get('/', async (req, res) => {
  const alerts = await db.listAlerts(req.user.id);
  res.render('alerts', { title: 'Alerts', alerts });
});

router.post('/create', async (req, res) => {
  const { ticker, alert_type, threshold, note } = req.body;
  if (!ticker || !alert_type || !threshold) {
    req.flash('error', 'Ticker, type and threshold are required.');
    return res.redirect('/alerts');
  }
  await db.createAlert(req.user.id, ticker.toUpperCase().trim(), alert_type, threshold, note || '');
  req.flash('success', `Alert created for ${ticker.toUpperCase()}.`);
  res.redirect('/alerts');
});

router.post('/delete', async (req, res) => {
  await db.deleteAlert(req.body.alert_id);
  req.flash('success', 'Alert deleted.');
  res.redirect('/alerts');
});

module.exports = router;
