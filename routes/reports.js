'use strict';
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');
const { toCsv, buildPdf } = require('../modules/reports');

router.get('/', async (req, res) => {
  const [recs, trades, auditLog] = await Promise.all([
    db.listRecommendations({ limit: 100 }),
    db.listPaperTrades({ limit: 100 }),
    db.listAuditLog(50),
  ]);
  res.render('reports', { title: 'Reports', recs, trades, auditLog });
});

// Download CSV
router.get('/csv/:type', async (req, res) => {
  const { type } = req.params;
  let rows = [], filename = `${type}.csv`;
  if (type === 'recommendations') rows = await db.listRecommendations({ limit: 1000 });
  else if (type === 'trades') rows = await db.listPaperTrades({ limit: 1000 });
  else if (type === 'audit') rows = await db.listAuditLog(1000);
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Download PDF
router.get('/pdf/:type', async (req, res) => {
  const { type } = req.params;
  let sections = [];
  if (type === 'recommendations') {
    const recs = await db.listRecommendations({ limit: 500 });
    sections = [['Recommendations', recs, ['ticker','style','side','entry','target1','target2','stop_loss','score','win_probability','status']]];
  } else if (type === 'trades') {
    const trades = await db.listPaperTrades({ limit: 500 });
    sections = [['Paper Trades', trades, ['ticker','side','entry_price','exit_price','pnl','outcome','status','opened_at']]];
  }
  try {
    const pdf = await buildPdf(`Stock Platform Report — ${type}`, sections);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_report.pdf"`);
    res.send(pdf);
  } catch (e) {
    req.flash('error', 'PDF generation failed: ' + e.message);
    res.redirect('/reports');
  }
});

module.exports = router;
