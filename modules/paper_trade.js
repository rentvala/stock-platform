'use strict';
/**
 * Paper trading engine — Node.js edition
 * Mirrors python modules/paper_trade.py
 */
const db = require('./firebase_db');
const { getQuote } = require('./data_fetcher');
const { learnFromTrade } = require('./ml_engine');
const Config = require('../config');
const log = require('./logger');

async function autoOpenPaperForRec(recId, rec) {
  if (!rec.entry) return null;
  return db.openPaperTrade({
    recId,
    ticker: rec.ticker,
    style: rec.style,
    side: rec.side || 'BUY',
    entryPrice: rec.entry,
    invested: Config.PAPER_CAPITAL_PER_REC,
  });
}

async function evaluateOpenTrades() {
  const openTrades = await db.listPaperTrades({ status: 'OPEN', limit: 10000 });
  let closedCount = 0;

  for (const t of openTrades) {
    const rec = await db.getRecommendation(t.rec_id);
    if (!rec) continue;
    const q = await getQuote(t.ticker);
    const cur = q.price;
    if (cur === null || cur === undefined) continue;

    let outcome = null, reason = null, finalPrice = null;
    const side = t.side || 'BUY';

    if (side === 'BUY') {
      if (cur >= (rec.target2 || 0)) {
        [outcome, reason, finalPrice] = ['WIN', 'Target 2 hit', rec.target2];
      } else if (cur >= (rec.target1 || 0)) {
        [outcome, reason, finalPrice] = ['WIN', 'Target 1 hit', rec.target1];
      } else if (cur <= (rec.stop_loss || 0)) {
        [outcome, reason, finalPrice] = ['LOSS', 'Stop loss hit', rec.stop_loss];
      }
    } else {
      if (cur <= (rec.target1 || 999999)) {
        [outcome, reason, finalPrice] = ['WIN', 'Short Target 1 hit', rec.target1];
      } else if (cur >= (rec.stop_loss || 0)) {
        [outcome, reason, finalPrice] = ['LOSS', 'Short Stop loss hit', rec.stop_loss];
      }
    }

    // Time exit: close after 30 days regardless
    const openedAt = new Date(t.opened_at);
    const daysSince = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (!outcome && daysSince > 30) {
      finalPrice = cur;
      outcome = cur >= t.entry_price ? 'WIN' : 'LOSS';
      reason = 'Time exit (30 days)';
    }

    if (outcome) {
      const pnl = side === 'BUY'
        ? t.invested * ((finalPrice - t.entry_price) / t.entry_price)
        : t.invested * ((t.entry_price - finalPrice) / t.entry_price);

      await db.closePaperTrade(t.id, { outcome, reason, exitPrice: finalPrice, pnl });
      await db.closeRecommendation(t.rec_id, outcome, finalPrice);
      await learnFromTrade(rec, outcome);

      await db.addAuditLog({
        action: 'paper_trade_closed',
        ticker: t.ticker,
        outcome,
        reason,
        pnl: pnl.toFixed(2),
        entry: t.entry_price,
        exit: finalPrice,
      });
      closedCount++;
    }
  }
  return closedCount;
}

async function manualSwap(recId, newSide) {
  const rec = await db.getRecommendation(recId);
  if (!rec) return null;
  return db.saveRecommendation({
    ...rec,
    side: newSide,
    parent_rec_id: recId,
  });
}

module.exports = { autoOpenPaperForRec, evaluateOpenTrades, manualSwap };
