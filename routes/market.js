'use strict';
const express = require('express');
const router = express.Router();
const { getQuotesBulk, getOhlcv, getCryptoMarket, getIndicesSnapshot } = require('../modules/data_fetcher');
const { computeIndicators, detectPatterns } = require('../modules/analyzer');
const Config = require('../config');

// GET /market — market overview
router.get('/', async (req, res) => {
  const market = req.query.market || 'NSE';
  const tickerMap = { NSE: Config.NSE_DEFAULT, US: Config.US_DEFAULT, MCX: Config.MCX_DEFAULT };
  const tickers = tickerMap[market] || Config.NSE_DEFAULT;
  try {
    const [quotes, crypto, indices] = await Promise.all([
      getQuotesBulk(tickers.slice(0, 20)),
      getCryptoMarket(10),
      getIndicesSnapshot(Config.INDEX_TICKERS),
    ]);
    res.render('market', { title: 'Market', market, quotes, crypto, indices, tickers: tickers.slice(0, 20) });
  } catch (e) {
    res.render('market', { title: 'Market', market, quotes: {}, crypto: [], indices: {}, tickers: [] });
  }
});

// GET /market/stock/:ticker — detailed stock view
router.get('/stock/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const period = req.query.period || '6mo';
  const interval = req.query.interval || '1d';
  try {
    const [df, quote] = await Promise.all([
      getOhlcv(ticker, period, interval),
      require('../modules/data_fetcher').getQuote(ticker),
    ]);
    if (!df) return res.render('stock_detail', { title: ticker, ticker, quote: {}, indicators: {}, patterns: [], df: [] });
    const indicators = computeIndicators(df);
    const patterns = detectPatterns(df);
    // Pass last 90 days for chart
    const chartDf = df.slice(-90).map(r => ({
      date: r.Date instanceof Date ? r.Date.toISOString().split('T')[0] : String(r.Date).split('T')[0],
      open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume,
    }));
    res.render('stock_detail', { title: ticker, ticker, quote, indicators, patterns, df: chartDf, period });
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/market');
  }
});

module.exports = router;
