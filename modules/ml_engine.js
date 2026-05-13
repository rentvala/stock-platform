'use strict';
/**
 * Self-learning ML engine — Node.js edition
 * Replaces Python scikit-learn SGDClassifier + KMeans with pure-JS equivalents
 * Models are stored as JSON blobs in Firestore (same as Python version)
 * Mirrors python modules/ml_engine.py
 */
const db = require('./firebase_db');
const log = require('./logger');

const LEARNING_RATE = 0.05;
const WEIGHT_FLOOR = 0.3;
const WEIGHT_CAP = 2.5;

// ─── Simple online logistic regression (SGD) ──────────────────────────────
// Replaces sklearn SGDClassifier — pure JS, stores weights in Firestore

function _sigmoid(z) {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
}

function _predict(weights, features) {
  let z = weights.bias;
  for (let i = 0; i < features.length; i++) {
    z += (weights.coef[i] || 0) * features[i];
  }
  return _sigmoid(z);
}

function _sgdUpdate(weights, features, label, lr = 0.01) {
  const pred = _predict(weights, features);
  const err = pred - label;
  weights.bias -= lr * err;
  for (let i = 0; i < features.length; i++) {
    weights.coef[i] = (weights.coef[i] || 0) - lr * err * features[i];
  }
  return weights;
}

function _defaultWeights(nFeatures) {
  return {
    coef: new Array(nFeatures).fill(0),
    bias: 0,
    n_trained: 0,
  };
}

// ─── Feature extraction (mirrors _signals_from_rec) ───────────────────────

function _signalsFromRec(rec) {
  const indicators = rec.indicators || {};
  return [
    _clamp(indicators.rsi || 50, 0, 100) / 100,
    indicators.macd_hist > 0 ? 1 : 0,
    indicators.ema_cross_bull ? 1 : 0,
    indicators.volume_surge ? 1 : 0,
    indicators.above_ema200 ? 1 : 0,
    (indicators.adx || 0) / 100,
    indicators.ema_cross_bear ? 1 : 0,
  ];
}

function _clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const N_FEATURES = 7;

// ─── Predict win probability ───────────────────────────────────────────────

async function predictWinProbability(rec) {
  try {
    const features = _signalsFromRec(rec);
    let modelData = await db.loadModelBlob('sgd_classifier');
    if (!modelData) {
      modelData = _defaultWeights(N_FEATURES);
    }
    const prob = _predict(modelData, features);

    // Weighted ML indicator score
    const weights = await db.getMlWeights();
    const indicators = rec.indicators || {};
    let wScore = 0, wTotal = 0;
    const scoringMap = {
      rsi: () => (indicators.rsi || 50) < 40 ? 1 : (indicators.rsi || 50) > 70 ? -1 : 0,
      macd: () => indicators.macd_hist > 0 ? 1 : -1,
      ema_cross: () => indicators.ema_cross_bull ? 1 : indicators.ema_cross_bear ? -1 : 0,
      bb: () => indicators.close <= indicators.bb_lower ? 1 : 0,
      atr: () => (indicators.atr || 0) > 0 ? 0.5 : 0,
      obv: () => 0,
      adx: () => (indicators.adx || 0) > 25 ? 0.5 : 0,
      volume_surge: () => indicators.volume_surge ? 1 : 0,
    };
    for (const [ind, w] of Object.entries(weights)) {
      const scoreFunc = scoringMap[ind];
      if (scoreFunc) {
        wScore += w * scoreFunc();
        wTotal += w;
      }
    }
    const weightedScore = wTotal > 0 ? wScore / wTotal : 0;

    // Blend ML prob + weighted indicator score
    const blended = 0.6 * prob + 0.4 * _clamp((weightedScore + 1) / 2, 0, 1);
    return Math.round(blended * 100);
  } catch (e) {
    log.warn('predictWinProbability error:', e.message);
    return 50;
  }
}

// ─── Online learning (train on closed trade) ──────────────────────────────

async function learnFromTrade(rec, outcome) {
  try {
    const features = _signalsFromRec(rec);
    const label = outcome === 'WIN' ? 1 : 0;
    let modelData = await db.loadModelBlob('sgd_classifier');
    if (!modelData) modelData = _defaultWeights(N_FEATURES);
    const updated = _sgdUpdate(modelData, features, label, 0.01);
    updated.n_trained = (updated.n_trained || 0) + 1;
    await db.saveModelBlob('sgd_classifier', updated);

    // Update indicator weights
    const indicators = rec.indicators || {};
    const indicatorSignals = {
      rsi: Math.abs(((indicators.rsi || 50) - 50) / 50),
      macd: Math.abs(indicators.macd_hist || 0) > 0 ? 1 : 0,
      ema_cross: (indicators.ema_cross_bull || indicators.ema_cross_bear) ? 1 : 0,
      volume_surge: indicators.volume_surge ? 1 : 0,
      adx: (indicators.adx || 0) > 25 ? 1 : 0,
    };
    for (const [ind, signal] of Object.entries(indicatorSignals)) {
      await db.updateMlWeight(ind, signal, outcome);
    }

    await db.addAuditLog({
      action: 'ml_learn',
      ticker: rec.ticker || 'unknown',
      outcome,
      n_trained: updated.n_trained,
    });
  } catch (e) {
    log.warn('learnFromTrade error:', e.message);
  }
}

// ─── K-Means clustering (setup archetypes) ────────────────────────────────
// Replaces sklearn KMeans — uses ml-kmeans package

async function clusterSetupArchetypes(recs) {
  if (!recs || recs.length < 10) return null;
  try {
    const { kmeans } = require('ml-kmeans');
    const data = recs.map(r => _signalsFromRec(r));
    const k = Math.min(5, Math.floor(data.length / 3));
    const result = kmeans(data, k, { initialization: 'kmeans++' });
    const modelData = { centers: result.centroids, k };
    await db.saveModelBlob('cluster_model', modelData);
    return result;
  } catch (e) {
    log.warn('clusterSetupArchetypes error:', e.message);
    return null;
  }
}

module.exports = { predictWinProbability, learnFromTrade, clusterSetupArchetypes };
