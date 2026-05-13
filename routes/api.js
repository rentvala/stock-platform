'use strict';
/**
 * JSON API routes — used by frontend JS for live price ticks,
 * notifications, self-audit, and AJAX updates
 */
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');
const { getQuote, getQuotesBulk } = require('../modules/data_fetcher');
const { evaluateAlerts, checkNearDecision } = require('../modules/scheduler');
const Config = require('../config');

// Live price for a single ticker
router.get('/quote/:ticker', async (req, res) => {
  const q = await getQuote(req.params.ticker);
  res.json(q);
});

// Bulk quotes
router.post('/quotes', async (req, res) => {
  const { tickers } = req.body;
  if (!Array.isArray(tickers)) return res.status(400).json({ error: 'tickers must be array' });
  const quotes = await getQuotesBulk(tickers.slice(0, 50));
  res.json(quotes);
});

// Indices snapshot
router.get('/indices', async (req, res) => {
  const { getIndicesSnapshot } = require('../modules/data_fetcher');
  const snap = await getIndicesSnapshot(Config.INDEX_TICKERS);
  res.json(snap);
});

// Notifications
router.get('/notifications', async (req, res) => {
  const notes = await db.listNotifications(req.user.id, 30);
  res.json(notes);
});

router.post('/notifications/:id/read', async (req, res) => {
  await db.markNotificationRead(req.params.id);
  res.json({ ok: true });
});

// Self-audit log
router.get('/self-audit', async (req, res) => {
  const log = await db.listAuditLog(100);
  res.render('self_audit', { title: 'Self Audit', log });
});

// ML weights
router.get('/ml-weights', async (req, res) => {
  const weights = await db.getMlWeights();
  res.json(weights);
});

// Manual trigger scheduler tasks (for testing / admin)
router.post('/run-alerts', async (req, res) => {
  await evaluateAlerts();
  res.json({ ok: true, message: 'Alert check complete' });
});

router.post('/run-decision-check', async (req, res) => {
  await checkNearDecision();
  res.json({ ok: true, message: 'Decision check complete' });
});

module.exports = router;
