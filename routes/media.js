'use strict';
const express = require('express');
const router = express.Router();
const { aggregateNews, aggregateSocial, mediaLeaderboard } = require('../modules/news_engine');

router.get('/', async (req, res) => {
  try {
    const [news, social, leaderboard] = await Promise.all([
      aggregateNews(),
      aggregateSocial(),
      mediaLeaderboard(),
    ]);
    res.render('media', { title: 'Media & Sentiment', news, social, leaderboard });
  } catch (e) {
    res.render('media', { title: 'Media & Sentiment', news: {}, social: {}, leaderboard: { buys: [], sells: [] } });
  }
});

module.exports = router;
