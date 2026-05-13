'use strict';
/**
 * Technical analysis engine — Node.js edition
 * Pure math, no external TA library required
 * Mirrors python modules/analyzer.py
 */

// ─── Indicator formulas ────────────────────────────────────────────────────

function ema(values, length) {
  const k = 2 / (length + 1);
  const result = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null || values[i] === undefined) { result[i] = prev; continue; }
    if (prev === null) { prev = values[i]; result[i] = prev; continue; }
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function sma(values, length) {
  return values.map((_, i) => {
    if (i < length - 1) return null;
    const slice = values.slice(i - length + 1, i + 1);
    if (slice.some(v => v === null)) return null;
    return slice.reduce((a, b) => a + b, 0) / length;
  });
}

function rsi(close, length = 14) {
  const result = new Array(close.length).fill(null);
  const gains = [], losses = [];
  for (let i = 1; i < close.length; i++) {
    const diff = close[i] - close[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  for (let i = length - 1; i < gains.length; i++) {
    const avgGain = gains.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0) / length;
    const avgLoss = losses.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0) / length;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i + 1] = 100 - 100 / (1 + rs);
  }
  return result;
}

function macd(close, fast = 12, slow = 26, signal = 9) {
  const ef = ema(close, fast);
  const es = ema(close, slow);
  const line = close.map((_, i) => ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null);
  const sig = ema(line.map(v => v ?? 0), signal);
  const hist = line.map((v, i) => v !== null && sig[i] !== null ? v - sig[i] : null);
  return { line, signal: sig, hist };
}

function bollinger(close, length = 20, stdDev = 2) {
  const mid = sma(close, length);
  return close.map((_, i) => {
    if (i < length - 1 || mid[i] === null) return { upper: null, mid: null, lower: null };
    const slice = close.slice(i - length + 1, i + 1);
    const mean = mid[i];
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / length);
    return { upper: mean + stdDev * std, mid: mean, lower: mean - stdDev * std };
  });
}

function atr(df, length = 14) {
  const tr = df.map((row, i) => {
    if (i === 0) return row.High - row.Low;
    const pc = df[i - 1].Close;
    return Math.max(row.High - row.Low, Math.abs(row.High - pc), Math.abs(row.Low - pc));
  });
  return sma(tr, length);
}

function obv(df) {
  const result = [0];
  for (let i = 1; i < df.length; i++) {
    const sign = df[i].Close > df[i - 1].Close ? 1 : df[i].Close < df[i - 1].Close ? -1 : 0;
    result.push(result[i - 1] + sign * (df[i].Volume || 0));
  }
  return result;
}

function adx(df, length = 14) {
  const result = new Array(df.length).fill(null);
  if (df.length < length * 2) return result;
  const plusDM = [], minusDM = [], tr = [];
  for (let i = 1; i < df.length; i++) {
    const up = df[i].High - df[i - 1].High;
    const dn = df[i - 1].Low - df[i].Low;
    plusDM.push((up > dn && up > 0) ? up : 0);
    minusDM.push((dn > up && dn > 0) ? dn : 0);
    const pc = df[i - 1].Close;
    tr.push(Math.max(df[i].High - df[i].Low, Math.abs(df[i].High - pc), Math.abs(df[i].Low - pc)));
  }
  for (let i = length - 1; i < plusDM.length; i++) {
    const atrSlice = tr.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0) / length;
    if (atrSlice === 0) continue;
    const plusDI = 100 * plusDM.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0) / length / atrSlice;
    const minusDI = 100 * minusDM.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0) / length / atrSlice;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;
    result[i + 1] = dx;
  }
  return result;
}

// ─── Full indicator compute ────────────────────────────────────────────────

function computeIndicators(df) {
  if (!df || df.length < 30) return {};
  const close = df.map(r => r.Close);
  const volume = df.map(r => r.Volume || 0);

  const ema20 = ema(close, 20);
  const ema50 = ema(close, 50);
  const ema200 = ema(close, 200);
  const rsiVals = rsi(close, 14);
  const macdVals = macd(close);
  const bbVals = bollinger(close);
  const atrVals = atr(df, 14);
  const obvVals = obv(df);
  const adxVals = adx(df, 14);

  const n = df.length - 1;
  const volAvg = volume.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volumeSurge = volume[n] > volAvg * 1.5;

  return {
    close: close[n],
    ema20: ema20[n],
    ema50: ema50[n],
    ema200: ema200[n],
    rsi: rsiVals[n],
    macd_line: macdVals.line[n],
    macd_signal: macdVals.signal[n],
    macd_hist: macdVals.hist[n],
    bb_upper: bbVals[n]?.upper,
    bb_mid: bbVals[n]?.mid,
    bb_lower: bbVals[n]?.lower,
    atr: atrVals[n],
    obv: obvVals[n],
    adx: adxVals[n],
    volume_surge: volumeSurge,
    volume_avg: volAvg,
    // crossover flags
    ema_cross_bull: ema20[n] > ema50[n] && ema20[n - 1] <= ema50[n - 1],
    ema_cross_bear: ema20[n] < ema50[n] && ema20[n - 1] >= ema50[n - 1],
    above_ema200: close[n] > ema200[n],
    // series for chart
    ema20_series: ema20,
    ema50_series: ema50,
    rsi_series: rsiVals,
    macd_line_series: macdVals.line,
    macd_signal_series: macdVals.signal,
    macd_hist_series: macdVals.hist,
  };
}

// ─── Pattern detection ─────────────────────────────────────────────────────

function detectPatterns(df) {
  const patterns = [];
  if (!df || df.length < 10) return patterns;
  const n = df.length - 1;

  // Hammer / Doji
  const body = Math.abs(df[n].Close - df[n].Open);
  const shadow = df[n].High - df[n].Low;
  if (shadow > 0 && body / shadow < 0.2) patterns.push('Doji');
  const lower = Math.min(df[n].Close, df[n].Open) - df[n].Low;
  const upper = df[n].High - Math.max(df[n].Close, df[n].Open);
  if (lower > body * 2 && upper < body * 0.5) patterns.push('Hammer');

  // Bullish/Bearish engulfing (last 2 candles)
  if (n >= 1) {
    const prev = df[n - 1], cur = df[n];
    const prevBull = prev.Close > prev.Open;
    const curBull = cur.Close > cur.Open;
    if (!prevBull && curBull && cur.Open < prev.Close && cur.Close > prev.Open)
      patterns.push('Bullish Engulfing');
    if (prevBull && !curBull && cur.Open > prev.Close && cur.Close < prev.Open)
      patterns.push('Bearish Engulfing');
  }

  // Support / resistance test
  const closes = df.map(r => r.Close);
  const recent20High = Math.max(...closes.slice(-20));
  const recent20Low = Math.min(...closes.slice(-20));
  if (Math.abs(df[n].Close - recent20High) / recent20High < 0.005)
    patterns.push('Near 20-day Resistance');
  if (Math.abs(df[n].Close - recent20Low) / recent20Low < 0.005)
    patterns.push('Near 20-day Support');

  return patterns;
}

// ─── Multi-timeframe score ────────────────────────────────────────────────

function scoreTimeframe(indicators) {
  let score = 0;
  const { rsi, macd_hist, ema_cross_bull, ema_cross_bear, bb_lower, bb_upper, close, adx, volume_surge } = indicators;
  if (rsi < 35) score += 2;
  else if (rsi < 45) score += 1;
  else if (rsi > 70) score -= 2;
  else if (rsi > 60) score -= 1;
  if (macd_hist > 0) score += 1;
  if (macd_hist < 0) score -= 1;
  if (ema_cross_bull) score += 2;
  if (ema_cross_bear) score -= 2;
  if (close && bb_lower && close <= bb_lower) score += 1;
  if (close && bb_upper && close >= bb_upper) score -= 1;
  if (adx > 25) score += 1;
  if (volume_surge) score += 1;
  return score;
}

module.exports = { computeIndicators, detectPatterns, scoreTimeframe, ema, sma, rsi, macd, bollinger, atr, obv, adx };
