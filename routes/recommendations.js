'use strict';
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');
const { generateRecommendations, analyzeTicker } = require('../modules/recommender');
const { autoOpenPaperForRec } = require('../modules/paper_trade');
const Config = require('../config');

// GET /recommendations — list existing
router.get('/', async (req, res) => {
  const status = req.query.status || null;
  const recs = await db.listRecommendations({ status, limit: 50 });
  res.render('recommendations', { title: 'Recommendations', recs, status });
});

// GET /recommendations/best-picks — run fresh recommendations
router.get('/best-picks', async (req, res) => {
  const market = req.query.market || 'NSE';
  const marketMap = { NSE: Config.NSE_DEFAULT, US: Config.US_DEFAULT, MCX: Config.MCX_DEFAULT, CRYPTO: Config.CRYPTO_DEFAULT };
  const tickers = marketMap[market] || Config.NSE_DEFAULT;
  try {
    const recs = await generateRecommendations(tickers.slice(0, 30), 10);
    // Save and open paper trades
    const saved = [];
    for (const rec of recs) {
      const recId = await db.saveRecommendation({ ...rec, user_id: req.user.id, market });
      await autoOpenPaperForRec(recId, rec);
      saved.push({ id: recId, ...rec });
    }
    res.render('best_picks', { title: 'Best Picks', recs: saved, market });
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/recommendations');
  }
});

// GET /recommendations/analyze/:ticker
router.get('/analyze/:ticker', async (req, res) => {
  const { ticker } = req.params;
  try {
    const rec = await analyzeTicker(ticker);
    if (!rec) { req.flash('error', `Could not analyze ${ticker}`); return res.redirect('/recommendations'); }
    res.render('stock_detail', { title: `Analysis: ${ticker}`, ticker, rec, quote: { price: rec.entry, name: rec.name }, indicators: rec.indicators, patterns: (rec.patterns || '').split(', ').filter(Boolean), df: [] });
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/recommendations');
  }
});

// POST /recommendations/swap — manual swap BUY/SELL
router.post('/swap', async (req, res) => {
  const { rec_id, new_side } = req.body;
  await require('../modules/paper_trade').manualSwap(rec_id, new_side);
  req.flash('success', 'Position swapped.');
  res.redirect('/recommendations');
});

module.exports = router;
