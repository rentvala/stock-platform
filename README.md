# 📈 Stock Analyst Pro — Node.js Edition
**Full-stack stock analysis platform converted from Python/Flask to Node.js/Express for Hostinger deployment.**

---

## ✅ What This App Does
- **Live Market Data** — NSE India, US Stocks, MCX Commodities, Crypto (via Yahoo Finance + CoinGecko)
- **Technical Analysis** — RSI, MACD, Bollinger Bands, EMA, ATR, OBV, ADX — all in pure JavaScript
- **Self-Learning ML** — Online SGD logistic regression that learns from each closed paper trade
- **AI Recommendations** — Best Picks with BUY/SELL signals, entry/target/stop-loss levels, win probability
- **Paper Trading** — Auto paper trade every recommendation with P&L tracking
- **Price Alerts** — Get notified when tickers cross your set thresholds
- **News & Sentiment** — RSS feeds + Reddit sentiment analysis with media leaderboard
- **Reports** — Download CSV and PDF reports for all recommendations and trades
- **Self Audit** — Full ML learning log and indicator weight viewer
- **Dark/Light Theme** — Fully themeable UI
- **Firebase Firestore** — Cloud database (same as original Python version)

---

## 🚀 Hostinger Deployment Guide

### Step 1 — Upload the project
1. Log into **Hostinger hPanel**
2. Go to **Websites → Manage → Node.js**
3. Set **Node.js version**: 18 or 20 (both work)
4. Set **App root**: your upload directory (e.g. `/public_html/stockapp` or a subdomain folder)
5. Set **Startup file**: `app.js`

### Step 2 — Upload files via File Manager or SFTP
- Upload **all files EXCEPT `node_modules/`** to your chosen app root directory
- Your directory should look like:
  ```
  app.js
  config.js
  package.json
  .env           ← YOU MUST CREATE THIS (see Step 3)
  modules/
  routes/
  views/
  public/
  ```

### Step 3 — Create your `.env` file
Create a file named `.env` in the app root with the following:

```env
SECRET_KEY=your-super-secret-random-string-here
DEFAULT_USER=admin
DEFAULT_PASS=your-secure-password

# Firebase service account JSON (paste the entire JSON as one line)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"YOUR_PROJECT","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

PORT=3000
NODE_ENV=production
```

> 💡 **Get your Firebase service account JSON:**
> Firebase Console → Project Settings → Service Accounts → Generate New Private Key

### Step 4 — Install dependencies via SSH
SSH into your Hostinger server and run:
```bash
cd /path/to/your/app
npm install --production
```

### Step 5 — Start the app
In Hostinger hPanel Node.js manager, click **Restart** or **Start**.

The app will be live at your domain! Default login: `admin` / `admin123` ← **Change this immediately!**

---

## 🔧 Local Development
```bash
npm install
cp .env.example .env    # then fill in your values
npm run dev             # starts with nodemon (auto-reload)
# OR
npm start               # production mode
```
Open: http://localhost:3000

---

## 📦 Python → Node.js Library Mapping

| Python Library | Node.js Equivalent | Notes |
|---|---|---|
| Flask | Express.js | Same concept, different syntax |
| Jinja2 templates | EJS templates | `{{ var }}` → `<%= var %>` |
| flask-login | express-session | Session-based auth |
| yfinance | yahoo-finance2 | Same Yahoo Finance API |
| scikit-learn SGD | Pure JS SGD (ml_engine.js) | Same online learning algorithm |
| scikit-learn KMeans | ml-kmeans | NPM package |
| textblob sentiment | sentiment (npm) | Same polarity analysis |
| feedparser | rss-parser | Same RSS parsing |
| reportlab | pdfkit | PDF generation |
| APScheduler/Cron | node-cron | Market-hours scheduler |
| firebase-admin | firebase-admin | Same package! (Node.js version) |
| pandas/numpy | Pure JS arrays | All indicators reimplemented |

---

## 📁 File Structure
```
├── app.js                    ← Express app entry point
├── config.js                 ← App configuration
├── package.json
├── .env                      ← Your secrets (never commit this)
├── modules/
│   ├── firebase_db.js        ← Firestore database layer
│   ├── data_fetcher.js       ← Yahoo Finance + CoinGecko data
│   ├── analyzer.js           ← All technical indicators (pure JS)
│   ├── ml_engine.js          ← Self-learning ML (SGD + KMeans)
│   ├── news_engine.js        ← RSS + Reddit sentiment analysis
│   ├── recommender.js        ← Recommendation generation engine
│   ├── paper_trade.js        ← Paper trading engine
│   ├── reports.js            ← CSV + PDF report generation
│   ├── scheduler.js          ← node-cron scheduled tasks
│   └── logger.js             ← Simple logger
├── routes/
│   ├── auth.js               ← Login/logout/settings
│   ├── dashboard.js          ← Main dashboard
│   ├── market.js             ← Market overview + stock detail
│   ├── watchlist.js          ← Watchlist CRUD
│   ├── alerts.js             ← Price alerts CRUD
│   ├── recommendations.js    ← Recommendations + best picks
│   ├── paper_trade.js        ← Paper trade management
│   ├── reports.js            ← Report downloads
│   ├── media.js              ← News + sentiment
│   └── api.js                ← JSON API endpoints
├── views/                    ← EJS templates
│   ├── partials/
│   │   ├── header.ejs
│   │   └── footer.ejs
│   ├── dashboard.ejs
│   ├── login.ejs
│   ├── market.ejs
│   ├── stock_detail.ejs
│   ├── recommendations.ejs
│   ├── best_picks.ejs
│   ├── paper_trade.ejs
│   ├── watchlist.ejs
│   ├── alerts.ejs
│   ├── media.ejs
│   ├── reports.ejs
│   ├── self_audit.ejs
│   ├── settings.ejs
│   └── error.ejs
└── public/
    ├── css/style.css         ← All styles (light + dark theme)
    └── js/app.js             ← Frontend JS (theme, notifications, live prices)
```

---

## 🔐 Security Notes
- Change `DEFAULT_PASS` before going live
- Set a strong random `SECRET_KEY` (min 32 chars)
- Firebase rules should restrict reads/writes to authenticated service account
- The `.env` file must **never** be committed to Git

---

## 📝 License
MIT — same as original Python version.
