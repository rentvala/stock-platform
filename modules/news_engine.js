'use strict';
/**
 * News + social-media sentiment engine — Node.js edition
 * Replaces feedparser + textblob with rss-parser + sentiment npm package
 * Mirrors python modules/news_engine.py
 */
const RSSParser = require('rss-parser');
const axios = require('axios');
const Sentiment = require('sentiment');

const log = require('./logger');

const rssParser = new RSSParser({ timeout: 10000 });
const sentimentAnalyzer = new Sentiment();

const UA = { 'User-Agent': 'Mozilla/5.0 stock-platform/1.0' };

const _FEEDS = {
  'Global Markets': 'https://news.google.com/rss/search?q=stock+market&hl=en&gl=US',
  'Indian Markets': 'https://news.google.com/rss/search?q=NSE+India+stock&hl=en&gl=IN',
  'US Markets':     'https://news.google.com/rss/search?q=NASDAQ+OR+S%26P500&hl=en&gl=US',
  'Commodities':    'https://news.google.com/rss/search?q=gold+silver+crude+commodity&hl=en',
  'Crypto':         'https://news.google.com/rss/search?q=cryptocurrency+bitcoin+ethereum&hl=en',
};

const _SUBREDDITS = {
  'Indian Markets': 'IndianStockMarket',
  'US Markets':     'stocks',
  'Crypto':         'CryptoCurrency',
};

function _polarity(text) {
  try {
    const result = sentimentAnalyzer.analyze(text);
    // Normalize to -1..1 range (sentiment returns comparative score)
    const score = Math.max(-1, Math.min(1, result.comparative));
    if (score > 0.15) return { label: 'positive', score };
    if (score < -0.15) return { label: 'negative', score };
    return { label: 'neutral', score };
  } catch (e) {
    return { label: 'neutral', score: 0 };
  }
}

async function fetchRss(url, limit = 20) {
  try {
    const feed = await rssParser.parseURL(url);
    return (feed.items || []).slice(0, limit).map(item => {
      const title = item.title || '';
      const { label, score } = _polarity(title);
      return {
        title,
        link: item.link || '',
        pub: item.pubDate || '',
        sentiment: label,
        score,
      };
    });
  } catch (e) {
    log.warn(`RSS error for ${url}: ${e.message}`);
    return [];
  }
}

async function fetchReddit(sub, limit = 25) {
  try {
    const r = await axios.get(
      `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`,
      { headers: UA, timeout: 8000 }
    );
    return (r.data?.data?.children || []).map(c => {
      const d = c.data;
      const title = d.title || '';
      const { label, score } = _polarity(title);
      return {
        title,
        link: `https://reddit.com${d.permalink || ''}`,
        score,
        ups: d.ups || 0,
        sentiment: label,
        subreddit: sub,
      };
    });
  } catch (e) {
    log.warn(`Reddit error for r/${sub}: ${e.message}`);
    return [];
  }
}

async function aggregateNews() {
  const out = {};
  await Promise.all(
    Object.entries(_FEEDS).map(async ([label, url]) => {
      out[label] = await fetchRss(url, 15);
    })
  );
  return out;
}

async function aggregateSocial() {
  const out = {};
  await Promise.all(
    Object.entries(_SUBREDDITS).map(async ([label, sub]) => {
      out[label] = await fetchReddit(sub, 20);
    })
  );
  return out;
}

// ─── Media leaderboard ────────────────────────────────────────────────────

const _TICKER_PAT = /\b([A-Z]{2,6})\b/g;
const _INR_PAT = /\b(RELIANCE|TCS|INFY|HDFC|ICICI|SBI|AXIS|KOTAK|ITC|LT|ADANI|TATA|JSW|ONGC|NTPC|COAL|SUN|DRREDDY|CIPLA|WIPRO|HCL|MARUTI|BHARTI|TITAN|BAJAJ|ASIAN|ULTRACEMCO|POWERGRID|NIFTY|BANKNIFTY)\b/gi;

async function mediaLeaderboard() {
  const scoreboard = {};
  const addToBoard = (ticker, sentimentLabel, title, link) => {
    const k = ticker.toUpperCase();
    if (!scoreboard[k]) scoreboard[k] = { pos: 0, neg: 0, mentions: 0, sources: [] };
    scoreboard[k].mentions++;
    if (sentimentLabel === 'positive') scoreboard[k].pos++;
    if (sentimentLabel === 'negative') scoreboard[k].neg++;
    if (scoreboard[k].sources.length < 3) scoreboard[k].sources.push({ title, link });
  };

  const [newsData, socialData] = await Promise.all([aggregateNews(), aggregateSocial()]);

  for (const items of Object.values(newsData)) {
    for (const it of items) {
      const matches = new Set([
        ...(it.title.match(_INR_PAT) || []),
        ...(it.title.match(_TICKER_PAT) || []),
      ]);
      for (const m of matches) addToBoard(m, it.sentiment, it.title, it.link);
    }
  }
  for (const items of Object.values(socialData)) {
    for (const it of items) {
      const matches = new Set([
        ...(it.title.match(_INR_PAT) || []),
        ...(it.title.match(_TICKER_PAT) || []),
      ]);
      for (const m of matches) addToBoard(m, it.sentiment, it.title, it.link);
    }
  }

  const rows = Object.entries(scoreboard)
    .filter(([, s]) => s.mentions >= 2)
    .map(([ticker, s]) => ({ ticker, ...s, net: s.pos - s.neg }));

  const buys = rows.filter(r => r.net > 0)
    .sort((a, b) => b.net - a.net || b.mentions - a.mentions).slice(0, 5);
  const sells = rows.filter(r => r.net < 0)
    .sort((a, b) => a.net - b.net).slice(0, 5);

  return { buys, sells, generated_at: new Date().toISOString() };
}

module.exports = { aggregateNews, aggregateSocial, mediaLeaderboard, fetchRss, fetchReddit };
