'use strict';
/**
 * Data fetcher — Node.js edition
 * Uses yahoo-finance2 (yfinance equivalent) + axios for CoinGecko
 * Mirrors python modules/data_fetcher.py
 */
const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');

const log = require('./logger');

const _CG_BASE = 'https://api.coingecko.com/api/v3';
const _CG_ID_MAP = {
  'BTC-USD': 'bitcoin', 'ETH-USD': 'ethereum', 'BNB-USD': 'binancecoin',
  'SOL-USD': 'solana', 'XRP-USD': 'ripple', 'ADA-USD': 'cardano',
  'DOGE-USD': 'dogecoin', 'TRX-USD': 'tron', 'MATIC-USD': 'matic-network',
  'DOT-USD': 'polkadot', 'AVAX-USD': 'avalanche-2', 'LINK-USD': 'chainlink',
  'LTC-USD': 'litecoin',
};

/**
 * Get a single live quote
 */
async function getQuote(ticker) {
  try {
    const q = await yahooFinance.quote(ticker);
    if (!q) return {};
    return {
      ticker,
      price: q.regularMarketPrice || null,
      open: q.regularMarketOpen || null,
      high: q.regularMarketDayHigh || null,
      low: q.regularMarketDayLow || null,
      close: q.regularMarketPreviousClose || null,
      volume: q.regularMarketVolume || null,
      change: q.regularMarketChange || null,
      change_pct: q.regularMarketChangePercent || null,
      market_cap: q.marketCap || null,
      pe_ratio: q.trailingPE || null,
      week_52_high: q.fiftyTwoWeekHigh || null,
      week_52_low: q.fiftyTwoWeekLow || null,
      name: q.shortName || q.longName || ticker,
      currency: q.currency || 'USD',
      exchange: q.exchangeName || '',
    };
  } catch (e) {
    log.warn(`getQuote error for ${ticker}: ${e.message}`);
    return {};
  }
}

/**
 * Bulk quotes (array of tickers)
 */
async function getQuotesBulk(tickers) {
  const results = await Promise.allSettled(tickers.map(t => getQuote(t)));
  const out = {};
  tickers.forEach((t, i) => {
    out[t] = results[i].status === 'fulfilled' ? results[i].value : {};
  });
  return out;
}

/**
 * Get OHLCV historical data
 * period1/period2 as Date objects or ISO strings
 * interval: '1d', '1wk', '1mo'
 */
async function getOhlcv(ticker, period = '6mo', interval = '1d') {
  try {
    // Map period strings
    const periodMap = {
      '1mo': { period1: _daysAgo(30) },
      '3mo': { period1: _daysAgo(90) },
      '6mo': { period1: _daysAgo(180) },
      '1y':  { period1: _daysAgo(365) },
      '2y':  { period1: _daysAgo(730) },
    };
    const range = periodMap[period] || periodMap['6mo'];
    const result = await yahooFinance.chart(ticker, {
      period1: range.period1,
      interval,
    });
    if (!result || !result.quotes || result.quotes.length === 0) return null;
    // Convert to pandas-like array of objects
    return result.quotes.map(q => ({
      Date: q.date,
      Open: q.open,
      High: q.high,
      Low: q.low,
      Close: q.close,
      Volume: q.volume,
    })).filter(q => q.Close !== null);
  } catch (e) {
    log.warn(`getOhlcv error for ${ticker}: ${e.message}`);
    return null;
  }
}

function _daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Snapshot of major indices
 */
async function getIndicesSnapshot(indexTickers) {
  const tickers = Object.values(indexTickers);
  const quotes = await getQuotesBulk(tickers);
  const result = {};
  for (const [name, sym] of Object.entries(indexTickers)) {
    result[name] = quotes[sym] || {};
  }
  return result;
}

/**
 * CoinGecko crypto market data
 */
async function getCryptoMarket(limit = 25) {
  try {
    const r = await axios.get(`${_CG_BASE}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false,
      },
      timeout: 10000,
    });
    return r.data;
  } catch (e) {
    log.warn(`CoinGecko error: ${e.message}`);
    return [];
  }
}

module.exports = { getQuote, getQuotesBulk, getOhlcv, getIndicesSnapshot, getCryptoMarket };
