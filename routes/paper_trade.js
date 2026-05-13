'use strict';
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');
const { evaluateOpenTrades } = require('../modules/paper_trade');

router.get('/', async (req, res) => {
  const [trades, stats] = await Promise.all([
    db.listPaperTrades({ limit: 100 }),
    db.getPaperStats(),
  ]);
  res.render('paper_trade', { title: 'Paper Trade', trades, stats });
});

router.post('/evaluate', async (req, res) => {
  const count = await evaluateOpenTrades();
  req.flash('success', `Evaluated trades. ${count} closed.`);
  res.redirect('/paper-trade');
});

module.exports = router;
