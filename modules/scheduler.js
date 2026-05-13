'use strict';
/**
 * Scheduled tasks — Node.js edition using node-cron
 * Replaces Vercel Cron + APScheduler from python version
 * Mirrors python modules/scheduler_tasks.py
 */
const cron = require('node-cron');
const db = require('./firebase_db');
const { getQuote } = require('./data_fetcher');
const log = require('./logger');

async function evaluateAlerts() {
  log.info('Running evaluateAlerts...');
  try {
    const fsDb = db.getDb();
    const snap = await fsDb.collection('alerts').where('active', '==', true).get();
    const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const a of alerts) {
      const q = await getQuote(a.ticker);
      const price = q.price;
      if (price === null || price === undefined) continue;

      let fired = false, msg = '';
      if (a.alert_type === 'ABOVE' && price >= a.threshold) {
        fired = true;
        msg = `${a.ticker} is above ₹${a.threshold} (now ₹${price})`;
      } else if (a.alert_type === 'BELOW' && price <= a.threshold) {
        fired = true;
        msg = `${a.ticker} is below ₹${a.threshold} (now ₹${price})`;
      }

      if (fired) {
        await db.triggerAlert(a.id);
        await db.pushNotification({
          userId: a.user_id,
          title: `Alert: ${a.ticker}`,
          body: msg + (a.note ? ` — Note: ${a.note}` : ''),
          severity: 'warn',
        });
        log.info(`Alert fired for ${a.ticker}: ${msg}`);
      }
    }
  } catch (e) {
    log.error('evaluateAlerts error:', e.message);
  }
}

async function checkNearDecision() {
  log.info('Running checkNearDecision...');
  try {
    const recs = await db.listRecommendations({ status: 'OPEN', limit: 500 });
    for (const r of recs) {
      const q = await getQuote(r.ticker);
      const price = q.price;
      if (price === null || price === undefined) continue;
      const levels = [
        ['Target 1', r.target1],
        ['Target 2', r.target2],
        ['Stop Loss', r.stop_loss],
      ];
      for (const [name, lv] of levels) {
        if (!lv) continue;
        if (Math.abs(price - lv) / lv <= 0.01) {
          await db.pushNotification({
            userId: r.user_id || '1',
            title: `${r.ticker} near ${name}`,
            body: `${r.ticker} is at ₹${price.toFixed(2)} — within 1% of ${name} (₹${lv.toFixed(2)}). Consider action.`,
            severity: 'critical',
          });
        }
      }
    }
  } catch (e) {
    log.error('checkNearDecision error:', e.message);
  }
}

function startScheduler() {
  // Run alert checks every 15 minutes during market hours
  cron.schedule('*/15 9-16 * * 1-5', evaluateAlerts, {
    timezone: 'Asia/Kolkata',
  });

  // Run decision checks every 30 minutes
  cron.schedule('*/30 9-16 * * 1-5', checkNearDecision, {
    timezone: 'Asia/Kolkata',
  });

  log.info('Scheduler started (market hours: Mon-Fri 9am-4pm IST)');
}

module.exports = { startScheduler, evaluateAlerts, checkNearDecision };
