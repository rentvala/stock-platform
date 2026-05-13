'use strict';
/**
 * Recommendation engine — Node.js edition
 * Mirrors python modules/recommender.py
 */
const { getOhlcv, getQuote } = require('./data_fetcher');
const { computeIndicators, detectPatterns, scoreTimeframe } = require('./analyzer');
const { predictWinProbability } = require('./ml_engine');
const log = require('./logger');

const STYLES = ['Swing', 'Intraday', 'Positional'];

async function analyzeTicker(ticker) {
  try {
    const [quote, df6mo, df1mo] = await Promise.all([
      getQuote(ticker),
      getOhlcv(ticker, '6mo', '1d'),
      getOhlcv(ticker, '1mo', '1d'),
    ]);

    if (!df6mo || df6mo.length < 30) return null;

    const indicators = computeIndicators(df6mo);
    const patterns = detectPatterns(df6mo);
    const score = scoreTimeframe(indicators);

    const price = quote.price || indicators.close;
    if (!price) return null;

    // Entry / targets / stop-loss based on ATR
    const atr = indicators.atr || price * 0.02;
    const entry = parseFloat(price.toFixed(2));
    const target1 = parseFloat((price + atr * 1.5).toFixed(2));
    const target2 = parseFloat((price + atr * 3.0).toFixed(2));
    const stopLoss = parseFloat((price - atr * 1.0).toFixed(2));

    // Style selection
    let style = 'Swing';
    if (indicators.adx > 30 && indicators.volume_surge) style = 'Intraday';
    else if (indicators.above_ema200 && score >= 4) style = 'Positional';

    // Risk:reward
    const rr = atr > 0 ? ((target1 - entry) / (entry - stopLoss)).toFixed(1) : '1.0';

    const recData = {
      ticker,
      style,
      side: score >= 0 ? 'BUY' : 'SELL',
      entry,
      target1,
      target2,
      stop_loss: stopLoss,
      score,
      rr,
      patterns: patterns.join(', '),
      indicators: {
        rsi: indicators.rsi,
        macd_hist: indicators.macd_hist,
        ema_cross_bull: indicators.ema_cross_bull,
        ema_cross_bear: indicators.ema_cross_bear,
        volume_surge: indicators.volume_surge,
        above_ema200: indicators.above_ema200,
        adx: indicators.adx,
        atr: indicators.atr,
        close: indicators.close,
        bb_lower: indicators.bb_lower,
        bb_upper: indicators.bb_upper,
      },
      change_pct: quote.change_pct,
      name: quote.name || ticker,
      currency: quote.currency || 'INR',
    };

    const winProb = await predictWinProbability(recData);
    recData.win_probability = winProb;

    return recData;
  } catch (e) {
    log.warn(`analyzeTicker error for ${ticker}: ${e.message}`);
    return null;
  }
}

async function generateRecommendations(tickers, topN = 10) {
  const results = await Promise.allSettled(tickers.map(t => analyzeTicker(t)));
  const valid = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
    .filter(r => Math.abs(r.score) >= 2)  // only meaningful signals
    .sort((a, b) => b.win_probability - a.win_probability)
    .slice(0, topN);
  return valid;
}

module.exports = { analyzeTicker, generateRecommendations };
