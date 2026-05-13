'use strict';
/**
 * Firebase Firestore database layer — Node.js edition
 * Mirrors python modules/firebase_db.py exactly
 */
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const Config = require('../config');

let _db = null;

function getDb() {
  if (!_db) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return _db;
}

function initFirebase() {
  if (admin.apps.length > 0) {
    _db = admin.firestore();
    return;
  }
  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      serviceAccount = require(require('path').resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      throw new Error('No Firebase credentials provided. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH in .env');
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    _db = admin.firestore();
    console.log('Firebase initialized successfully');
    _seedDefaultData().catch(e => console.error('Seed error:', e));
  } catch (e) {
    console.error('Firebase init error:', e.message);
    throw e;
  }
}

function _now() {
  return new Date().toISOString();
}

async function _seedDefaultData() {
  const db = getDb();
  // Seed default user
  const usersRef = db.collection('users');
  const snap = await usersRef.where('username', '==', Config.DEFAULT_USER).limit(1).get();
  if (snap.empty) {
    const hash = await bcrypt.hash(Config.DEFAULT_PASS, 12);
    const ref = await usersRef.add({
      username: Config.DEFAULT_USER,
      password_hash: hash,
      created_at: _now(),
      theme: 'light',
    });
    console.log(`Seeded default user: ${Config.DEFAULT_USER} (id: ${ref.id})`);
  }

  // Seed ML weights
  const defaultWeights = {
    rsi: 1.0, macd: 1.2, ema_cross: 1.1, bb: 0.9,
    atr: 0.7, obv: 1.0, adx: 1.0, volume_surge: 1.3,
    pattern: 1.5, multi_tf: 1.4, news_sentiment: 0.8,
  };
  for (const [indicator, weight] of Object.entries(defaultWeights)) {
    const ref = db.collection('ml_weights').doc(indicator);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({ indicator, weight, wins: 0, losses: 0, last_updated: _now() });
    }
  }

  // Seed watchlist for default user
  const userSnap = await usersRef.where('username', '==', Config.DEFAULT_USER).limit(1).get();
  if (!userSnap.empty) {
    const uid = userSnap.docs[0].id;
    const wlRef = db.collection('watchlist');
    const wlSnap = await wlRef.where('user_id', '==', uid).limit(1).get();
    if (wlSnap.empty) {
      for (const ticker of Config.NSE_DEFAULT.slice(0, 10)) {
        await wlRef.add({ user_id: uid, ticker, market: 'NSE', added_at: _now() });
      }
    }
  }
}

// ── Users ──────────────────────────────────────────────────────────────────
async function getUserByUsername(username) {
  const snap = await getDb().collection('users').where('username', '==', username).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getUserById(uid) {
  const doc = await getDb().collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function updateUserTheme(uid, theme) {
  await getDb().collection('users').doc(uid).update({ theme });
}

async function updatePassword(uid, newHash) {
  await getDb().collection('users').doc(uid).update({ password_hash: newHash });
}

// ── Watchlist ──────────────────────────────────────────────────────────────
async function getWatchlist(userId) {
  const snap = await getDb().collection('watchlist').where('user_id', '==', userId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addToWatchlist(userId, ticker, market = 'NSE') {
  const existing = await getDb().collection('watchlist')
    .where('user_id', '==', userId).where('ticker', '==', ticker).limit(1).get();
  if (!existing.empty) return existing.docs[0].id;
  const ref = await getDb().collection('watchlist').add({
    user_id: userId, ticker, market, added_at: _now()
  });
  return ref.id;
}

async function removeFromWatchlist(userId, ticker) {
  const snap = await getDb().collection('watchlist')
    .where('user_id', '==', userId).where('ticker', '==', ticker).limit(1).get();
  if (!snap.empty) await snap.docs[0].ref.delete();
}

// ── Alerts ─────────────────────────────────────────────────────────────────
async function listAlerts(userId) {
  const snap = await getDb().collection('alerts').where('user_id', '==', userId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createAlert(userId, ticker, alertType, threshold, note = '') {
  const ref = await getDb().collection('alerts').add({
    user_id: userId, ticker, alert_type: alertType,
    threshold: parseFloat(threshold), note, active: true, fired_at: null,
    created_at: _now(),
  });
  return ref.id;
}

async function triggerAlert(alertId) {
  await getDb().collection('alerts').doc(alertId).update({
    active: false, fired_at: _now()
  });
}

async function deleteAlert(alertId) {
  await getDb().collection('alerts').doc(alertId).delete();
}

// ── Recommendations ────────────────────────────────────────────────────────
async function saveRecommendation(rec) {
  const ref = await getDb().collection('recommendations').add({
    ...rec, created_at: _now(), status: 'OPEN'
  });
  return ref.id;
}

async function listRecommendations({ status = null, limit = 50 } = {}) {
  let q = getDb().collection('recommendations').orderBy('created_at', 'desc').limit(limit);
  if (status) q = getDb().collection('recommendations')
    .where('status', '==', status).orderBy('created_at', 'desc').limit(limit);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getRecommendation(recId) {
  const doc = await getDb().collection('recommendations').doc(recId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function closeRecommendation(recId, outcome, exitPrice) {
  await getDb().collection('recommendations').doc(recId).update({
    status: 'CLOSED', outcome, exit_price: exitPrice, closed_at: _now()
  });
}

// ── Paper Trades ───────────────────────────────────────────────────────────
async function openPaperTrade({ recId, ticker, style, side, entryPrice, invested }) {
  const ref = await getDb().collection('paper_trades').add({
    rec_id: recId, ticker, style, side,
    entry_price: entryPrice, invested,
    status: 'OPEN', opened_at: _now(),
    exit_price: null, pnl: null, closed_at: null, outcome: null, reason: null,
  });
  return ref.id;
}

async function listPaperTrades({ status = null, limit = 200 } = {}) {
  let q = getDb().collection('paper_trades').orderBy('opened_at', 'desc').limit(limit);
  if (status) q = getDb().collection('paper_trades')
    .where('status', '==', status).orderBy('opened_at', 'desc').limit(limit);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function closePaperTrade(tradeId, { outcome, reason, exitPrice, pnl }) {
  await getDb().collection('paper_trades').doc(tradeId).update({
    status: 'CLOSED', outcome, reason,
    exit_price: exitPrice, pnl, closed_at: _now()
  });
}

async function getPaperStats() {
  const trades = await listPaperTrades({ limit: 10000 });
  const closed = trades.filter(t => t.status === 'CLOSED');
  const wins = closed.filter(t => t.outcome === 'WIN').length;
  const losses = closed.filter(t => t.outcome === 'LOSS').length;
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const winRate = closed.length ? ((wins / closed.length) * 100).toFixed(1) : '0.0';
  return { total: trades.length, open: trades.filter(t => t.status === 'OPEN').length, closed: closed.length, wins, losses, totalPnl, winRate };
}

// ── ML Weights ─────────────────────────────────────────────────────────────
async function getMlWeights() {
  const snap = await getDb().collection('ml_weights').get();
  const weights = {};
  snap.docs.forEach(d => { weights[d.id] = d.data().weight; });
  return weights;
}

async function updateMlWeight(indicator, delta, outcome) {
  const ref = getDb().collection('ml_weights').doc(indicator);
  const doc = await ref.get();
  if (!doc.exists) return;
  const d = doc.data();
  const FLOOR = 0.3, CAP = 2.5, LR = 0.05;
  let w = d.weight + (outcome === 'WIN' ? LR : -LR) * delta;
  w = Math.max(FLOOR, Math.min(CAP, w));
  const wins = outcome === 'WIN' ? (d.wins || 0) + 1 : (d.wins || 0);
  const losses = outcome === 'LOSS' ? (d.losses || 0) + 1 : (d.losses || 0);
  await ref.update({ weight: w, wins, losses, last_updated: _now() });
}

// ── ML Models (Firestore-persisted blobs) ──────────────────────────────────
async function saveModelBlob(key, data) {
  const blob = Buffer.from(JSON.stringify(data)).toString('base64');
  await getDb().collection('ml_models').doc(key).set({ blob, updated_at: _now() });
}

async function loadModelBlob(key) {
  const doc = await getDb().collection('ml_models').doc(key).get();
  if (!doc.exists) return null;
  const blob = doc.data().blob;
  if (!blob) return null;
  return JSON.parse(Buffer.from(blob, 'base64').toString());
}

// ── Self-Audit Log ─────────────────────────────────────────────────────────
async function addAuditLog(entry) {
  await getDb().collection('audit_log').add({ ...entry, created_at: _now() });
}

async function listAuditLog(limit = 100) {
  const snap = await getDb().collection('audit_log')
    .orderBy('created_at', 'desc').limit(limit).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Notifications ──────────────────────────────────────────────────────────
async function pushNotification({ userId, title, body, severity = 'info' }) {
  await getDb().collection('notifications').add({
    user_id: userId, title, body, severity, read: false, created_at: _now()
  });
}

async function listNotifications(userId, limit = 50) {
  const snap = await getDb().collection('notifications')
    .where('user_id', '==', userId)
    .orderBy('created_at', 'desc').limit(limit).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markNotificationRead(notifId) {
  await getDb().collection('notifications').doc(notifId).update({ read: true });
}

module.exports = {
  initFirebase, getDb,
  getUserByUsername, getUserById, updateUserTheme, updatePassword,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  listAlerts, createAlert, triggerAlert, deleteAlert,
  saveRecommendation, listRecommendations, getRecommendation, closeRecommendation,
  openPaperTrade, listPaperTrades, closePaperTrade, getPaperStats,
  getMlWeights, updateMlWeight,
  saveModelBlob, loadModelBlob,
  addAuditLog, listAuditLog,
  pushNotification, listNotifications, markNotificationRead,
};
