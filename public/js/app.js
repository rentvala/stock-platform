/* ============================================================
   Stock Analyst Pro — frontend JS (Node.js / EJS version)
   - Theme toggle (light/dark) stored via POST /settings/theme
   - 15-min auto-refresh on live pages
   - Notification poll + popup modal with snooze
   - Live price ticks via /api/quote/:ticker
   ============================================================ */
(function () {
  'use strict';

  const REFRESH_MS     = 15 * 60 * 1000;   // 15 min page reload
  const NOTIF_POLL_MS  = 60 * 1000;         // 1 min notification poll

  // ── THEME TOGGLE ──────────────────────────────────────────────
  const root   = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', async () => {
      const cur  = root.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        await fetch('/settings/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: next }),
        });
      } catch (_) { /* ignore */ }
      // Reload charts on theme switch
      if (document.getElementById('candleChart')) setTimeout(() => location.reload(), 200);
    });
  }

  // ── AUTO-DISMISS FLASH MESSAGES ───────────────────────────────
  document.querySelectorAll('.flash').forEach(el => {
    setTimeout(() => el.style.opacity = '0', 3000);
    setTimeout(() => el.remove(), 3500);
  });

  // ── NOTIFICATION POLLING ──────────────────────────────────────
  const bell       = document.getElementById('notifBell');
  const dropdown   = document.getElementById('notifDropdown');
  const countBadge = document.getElementById('notifCount');

  async function pollNotifications() {
    try {
      const r    = await fetch('/api/notifications');
      const list = await r.json();
      if (!Array.isArray(list)) return;

      const unseen = list.filter(n => !n.read);
      if (countBadge) {
        if (unseen.length > 0) {
          countBadge.style.display = 'inline-block';
          countBadge.textContent   = unseen.length > 99 ? '99+' : unseen.length;
        } else {
          countBadge.style.display = 'none';
        }
      }
      if (dropdown) {
        dropdown.innerHTML = list.length
          ? list.slice(0, 20).map(n => `
              <div class="notif-item ${n.severity || ''}">
                <div class="nt-title"><strong>${escHtml(n.title || '')}</strong></div>
                <div>${escHtml(n.body || '')}</div>
                <div class="nt-time">${(n.created_at || '').slice(0, 16).replace('T', ' ')}</div>
              </div>`).join('')
          : '<div class="notif-item">No notifications yet.</div>';
      }

      // Pop-up critical unread ones (skip already shown / snoozed)
      const popup = unseen.find(n =>
        n.severity === 'critical' &&
        !window.__shownPopupIds?.has(n.id)
      );
      if (popup) {
        showPopup(popup);
        window.__shownPopupIds = window.__shownPopupIds || new Set();
        window.__shownPopupIds.add(popup.id);
      }
    } catch (_) { /* ignore */ }
  }

  if (bell) {
    bell.addEventListener('click', e => {
      if (e.target.closest('.notif-dropdown')) return;
      if (dropdown) dropdown.classList.toggle('show');
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#notifBell') && dropdown)
        dropdown.classList.remove('show');
    });
    pollNotifications();
    setInterval(pollNotifications, NOTIF_POLL_MS);
  }

  // ── POPUP MODAL ───────────────────────────────────────────────
  const overlay  = document.getElementById('popupModal');
  const pTitle   = document.getElementById('popupTitle');
  const pBody    = document.getElementById('popupBody');
  const pOk      = document.getElementById('popupOk');
  const pSnooze  = document.getElementById('popupSnooze');
  let currentPopupId = null;

  function showPopup(n) {
    if (!overlay) return;
    currentPopupId      = n.id;
    pTitle.textContent  = n.title || 'Alert';
    pBody.textContent   = n.body  || '';
    overlay.classList.remove('hidden');
  }
  if (pOk) {
    pOk.onclick = async () => {
      if (currentPopupId) {
        await fetch(`/api/notifications/${currentPopupId}/read`, { method: 'POST' });
      }
      overlay.classList.add('hidden');
    };
  }
  if (pSnooze) {
    pSnooze.onclick = () => overlay.classList.add('hidden');
  }

  // ── 15-MIN AUTO-REFRESH (live pages only) ─────────────────────
  const p = location.pathname;
  const livePages = ['/', '/market', '/recommendations', '/best-picks', '/paper-trade'];
  const isLivePage = livePages.some(lp => p === lp || p.startsWith(lp + '/') || p.startsWith(lp + '?'));
  if (isLivePage) {
    setTimeout(() => location.reload(), REFRESH_MS);
  }

  // ── LIVE PRICE TICKER (watchlist on dashboard) ─────────────────
  const priceCells = document.querySelectorAll('[data-live-price]');
  if (priceCells.length > 0) {
    const tickers = Array.from(new Set(
      Array.from(priceCells).map(el => el.dataset.liveTicker).filter(Boolean)
    ));
    async function refreshPrices() {
      try {
        const r = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers }),
        });
        const data = await r.json();
        priceCells.forEach(el => {
          const ticker = el.dataset.liveTicker;
          const q = data[ticker];
          if (q && q.price) {
            el.textContent = formatNum(q.price);
            const chgEl = document.querySelector(`[data-live-chg="${ticker}"]`);
            if (chgEl && q.change_pct !== undefined) {
              const pct = q.change_pct;
              chgEl.textContent = (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(2) + '%';
              chgEl.className = pct >= 0 ? 'up' : 'down';
            }
          }
        });
      } catch (_) { /* ignore */ }
    }
    refreshPrices();
    setInterval(refreshPrices, 15000);  // refresh every 15 seconds
  }

  // ── HELPERS ───────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNum(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

})();
