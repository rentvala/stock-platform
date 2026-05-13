'use strict';
require('dotenv').config();

const Config = {
  SECRET_KEY: process.env.SECRET_KEY || 'change-me-in-production-2026',
  DEFAULT_USER: process.env.DEFAULT_USER || 'admin',
  DEFAULT_PASS: process.env.DEFAULT_PASS || 'admin123',

  SESSION_COOKIE_SECURE: process.env.NODE_ENV === 'production',
  SESSION_COOKIE_SAMESITE: 'Lax',
  SESSION_MAX_AGE: 60 * 60 * 24 * 7 * 1000, // 1 week in ms

  REFRESH_INTERVAL_MS: 15 * 60 * 1000,
  QUICK_REFRESH_MS: 15 * 1000,

  PAPER_CAPITAL_PER_REC: 100000,
  PAPER_STARTING_WALLET: 10000000,

  NSE_DEFAULT: [
    'RELIANCE.NS','TCS.NS','INFY.NS','HDFCBANK.NS','ICICIBANK.NS',
    'SBIN.NS','AXISBANK.NS','KOTAKBANK.NS','ITC.NS','LT.NS',
    'HINDUNILVR.NS','BHARTIARTL.NS','ASIANPAINT.NS','MARUTI.NS',
    'TITAN.NS','BAJFINANCE.NS','WIPRO.NS','HCLTECH.NS',
    'ADANIENT.NS','TATAMOTORS.NS','TATASTEEL.NS','JSWSTEEL.NS',
    'ONGC.NS','POWERGRID.NS','NTPC.NS','COALINDIA.NS',
    'SUNPHARMA.NS','DRREDDY.NS','CIPLA.NS','ULTRACEMCO.NS',
  ],
  US_DEFAULT: [
    'AAPL','MSFT','GOOGL','AMZN','META','NVDA','TSLA',
    'AMD','NFLX','AVGO','INTC','ORCL','CRM','ADBE',
    'PYPL','DIS','BA','JPM','BAC','WMT','KO','PEP',
    'JNJ','PFE','XOM','CVX',
  ],
  MCX_DEFAULT: ['GC=F','SI=F','HG=F','CL=F','NG=F','PL=F','ZC=F'],
  CRYPTO_DEFAULT: [
    'BTC-USD','ETH-USD','BNB-USD','SOL-USD','XRP-USD',
    'ADA-USD','DOGE-USD','TRX-USD','MATIC-USD','DOT-USD',
    'AVAX-USD','LINK-USD','LTC-USD',
  ],
  INDEX_TICKERS: {
    'Nifty 50': '^NSEI',
    'Bank Nifty': '^NSEBANK',
    'Sensex': '^BSESN',
    'India VIX': '^INDIAVIX',
    'S&P 500': '^GSPC',
    'Nasdaq': '^IXIC',
    'Dow Jones': '^DJI',
    'Gold': 'GC=F',
    'Crude Oil': 'CL=F',
    'USD/INR': 'INR=X',
  },
  PORT: parseInt(process.env.PORT) || 3000,
};

module.exports = Config;
