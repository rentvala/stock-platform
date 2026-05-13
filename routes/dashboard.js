'use strict';
const express = require('express');
const router = express.Router();
const db = require('../modules/firebase_db');
const { getIndicesSnapshot, getQuotesBulk } = require('../modules/data_fetcher');
const Config = require('../config');

// GET / — Main dashboard
router.get('/', async (req, res) => {
  try {
    const [indices, watchlist, notifications, paperStats] = await Promise.all([
      getIndicesSnapshot(Config.INDEX_TICKERS),
      db.getWatchlist(req.user.id),
      db.listNotifications(req.user.id, 10),
      db.getPaperStats(),
    ]);

    // Get live prices for watchlist tickers
    let watchlistQuotes = {};
    if (watchlist.length > 0) {
      watchlistQuotes = await getQuotesBulk(watchlist.map(w => w.ticker));
    }

    res.render('dashboard', {
      title: 'Dashboard',
      indices,
      watchlist,
      watchlistQuotes,
      notifications,
      paperStats,
      refresh_interval: Config.REFRESH_INTERVAL_MS,
    });
  } catch (e) {
    req.flash('error', e.message);
    res.render('dashboard', {
      title: 'Dashboard',
      indices: {}, watchlist: [], watchlistQuotes: {},
      notifications: [], paperStats: {},
    });
  }
});

module.exports = router;
