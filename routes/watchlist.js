'use strict';
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');

router.get('/', async (req, res) => {
  const watchlist = await db.getWatchlist(req.user.id);
  res.render('watchlist', { title: 'Watchlist', watchlist });
});

router.post('/add', async (req, res) => {
  const { ticker, market } = req.body;
  if (!ticker) { req.flash('error', 'Ticker required.'); return res.redirect('/watchlist'); }
  await db.addToWatchlist(req.user.id, ticker.toUpperCase().trim(), market || 'NSE');
  req.flash('success', `${ticker.toUpperCase()} added to watchlist.`);
  res.redirect('/watchlist');
});

router.post('/remove', async (req, res) => {
  const { ticker } = req.body;
  await db.removeFromWatchlist(req.user.id, ticker);
  req.flash('success', `${ticker} removed from watchlist.`);
  res.redirect('/watchlist');
});

module.exports = router;
