// ============================================================================
// RapidResponse Command — PWA Registration, In-App Install UI & Offline Status
// ============================================================================
(function () {
  let deferredInstallPrompt = null;
  let isInstalled = false;
  let isIOS = false;

  function detectEnvironment() {
    isInstalled =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;

    const ua = (window.navigator.userAgent || '').toLowerCase();
    isIOS = /iphone|ipad|ipod/.test(ua);
  }

  function injectMinimalStylesIfNeeded() {
    if (document.getElementById('pwa-offline-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'pwa-offline-runtime-styles';
    style.textContent = `
      .pwa-install-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #0284c7, #2563eb);
        color: #ffffff;
        border: 1px solid rgba(125, 211, 252, 0.45);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.28);
        transition: transform 0.15s ease, opacity 0.15s ease;
        white-space: nowrap;
      }
      .pwa-install-btn:hover { transform: translateY(-1px); opacity: 0.96; }
      .pwa-install-btn.hidden { display: none !important; }
      .pwa-floating-install-wrap {
        position: fixed;
        top: 14px;
        right: 16px;
        z-index: 950;
      }
      .pwa-offline-banner {
        position: fixed;
        bottom: 16px;
        left: 16px;
        z-index: 960;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #b45309;
        color: #ffffff;
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        border: 1px solid rgba(254, 243, 199, 0.35);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32);
      }
      .pwa-offline-banner.sync-ready {
        background: #047857;
      }
      .pwa-offline-banner.hidden {
        display: none !important;
      }
      .pwa-offline-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fef3c7;
        animation: pwaPulse 1.4s infinite ease-in-out;
        flex-shrink: 0;
      }
      @keyframes pwaPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.8); }
      }
      .pwa-sync-now-btn {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 6px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
      .pwa-guide-modal {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: rgba(15, 23, 42, 0.72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      .pwa-guide-modal.hidden { display: none !important; }
      .pwa-guide-card {
        width: 100%;
        max-width: 380px;
        background: #ffffff;
        color: #0f172a;
        border-radius: 14px;
        padding: 22px;
        box-shadow: 0 20px 44px rgba(0, 0, 0, 0.35);
      }
      .pwa-guide-card h3 {
        margin: 0 0 8px 0;
        font-size: 17px;
        font-weight: 800;
      }
      .pwa-guide-card p {
        margin: 0 0 14px 0;
        font-size: 13px;
        line-height: 1.5;
        color: #475569;
      }
      .pwa-guide-close {
        width: 100%;
        padding: 9px 14px;
        border: none;
        border-radius: 8px;
        background: #0f172a;
        color: #ffffff;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureInstallButtonUI() {
    if (isInstalled) {
      const existing = document.getElementById('pwa-install-btn');
      if (existing) existing.classList.add('hidden');
      return;
    }

    let btn = document.getElementById('pwa-install-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'pwa-install-btn';
      btn.className = 'pwa-install-btn';
      btn.setAttribute('aria-label', 'Install RapidResponse App for Offline Access');
      btn.innerHTML = '📲 Install Offline App';
      btn.addEventListener('click', handleInstallClick);

      const navRight = document.querySelector('.navbar .nav-right');
      const hudTopBar = document.querySelector('.hud-top-bar');
      if (navRight) {
        navRight.insertBefore(btn, navRight.firstChild);
      } else if (hudTopBar) {
        hudTopBar.appendChild(btn);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'pwa-floating-install-wrap';
        wrap.appendChild(btn);
        document.body.appendChild(wrap);
      }
    }

    if (deferredInstallPrompt) {
      btn.innerHTML = '📲 Install App';
    } else if (isIOS) {
      btn.innerHTML = '📲 Install on iOS';
    } else {
      btn.innerHTML = '📲 Offline App';
    }
    btn.classList.remove('hidden');
  }

  function showInstallGuideModal(title, bodyHtml) {
    let modal = document.getElementById('pwa-install-guide-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pwa-install-guide-modal';
      modal.className = 'pwa-guide-modal hidden';
      modal.innerHTML = `
        <div class="pwa-guide-card" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title">
          <h3 id="pwa-guide-title"></h3>
          <p id="pwa-guide-body"></p>
          <button type="button" class="pwa-guide-close" id="pwa-guide-close-btn">Got it</button>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('pwa-guide-close-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }
    document.getElementById('pwa-guide-title').textContent = title;
    document.getElementById('pwa-guide-body').innerHTML = bodyHtml;
    modal.classList.remove('hidden');
  }

  async function handleInstallClick() {
    if (deferredInstallPrompt) {
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          isInstalled = true;
          deferredInstallPrompt = null;
          ensureInstallButtonUI();
        }
      } catch (e) {}
      return;
    }

    if (isIOS) {
      showInstallGuideModal(
        'Install RapidResponse on iPhone / iPad',
        '1. Tap the <strong>Share</strong> icon in your Safari toolbar.<br>2. Scroll down and select <strong>Add to Home Screen</strong>.<br><br>Once installed, all portals, cached data, and offline emergency report queueing work without internet.'
      );
      return;
    }

    const swReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
    showInstallGuideModal(
      'Offline App & Installation Ready',
      `${swReady ? '✅ Offline cache is active on this device.' : '⏳ Activating offline cache...'}<br><br>To install as a standalone app, use your browser menu <strong>Install RapidResponse Command</strong> (or <strong>Add to Home Screen</strong>).<br><br>While offline, you can open all portals, view cached incidents/teams, analyze voice reports locally, and queue SOS or incident submissions for automatic sync when reconnected.`
    );
  }

  function ensureOfflineBanner() {
    let banner = document.getElementById('pwa-offline-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'pwa-offline-banner';
      banner.className = 'pwa-offline-banner hidden';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.innerHTML = `
        <span class="pwa-offline-dot" aria-hidden="true"></span>
        <span id="pwa-offline-text">Offline Mode — Cached data &amp; offline queue active</span>
        <button type="button" id="pwa-sync-now-btn" class="pwa-sync-now-btn" style="display:none;">Sync Now</button>
      `;
      document.body.appendChild(banner);
      const syncBtn = document.getElementById('pwa-sync-now-btn');
      if (syncBtn) {
        syncBtn.addEventListener('click', () => {
          if (window.rapidSync && typeof window.rapidSync.flushOfflineQueue === 'function') {
            window.rapidSync.flushOfflineQueue();
          }
        });
      }
    }
    return banner;
  }

  function updateConnectivityBanner() {
    const banner = ensureOfflineBanner();
    const textEl = document.getElementById('pwa-offline-text');
    const syncBtn = document.getElementById('pwa-sync-now-btn');
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const queuedCount =
      window.rapidSync && typeof window.rapidSync.getOfflineQueueCount === 'function'
        ? window.rapidSync.getOfflineQueueCount()
        : 0;

    if (!online) {
      banner.classList.remove('hidden', 'sync-ready');
      if (textEl) {
        textEl.textContent = queuedCount > 0
          ? `Offline Mode — ${queuedCount} report(s)/SOS queued for auto-sync`
          : 'Offline Mode — Cached portal data & emergency queue active';
      }
      if (syncBtn) syncBtn.style.display = 'none';
    } else if (queuedCount > 0) {
      banner.classList.remove('hidden');
      banner.classList.add('sync-ready');
      if (textEl) {
        textEl.textContent = `Online — ${queuedCount} queued offline record(s) pending sync`;
      }
      if (syncBtn) syncBtn.style.display = 'inline-block';
    } else {
      banner.classList.add('hidden');
      if (syncBtn) syncBtn.style.display = 'none';
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (reg && reg.update) {
          reg.update().catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Service Worker registration warning:', err.message);
      });
  }

  function initPwaOfflineSupport() {
    detectEnvironment();
    injectMinimalStylesIfNeeded();
    ensureInstallButtonUI();
    updateConnectivityBanner();
    registerServiceWorker();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    ensureInstallButtonUI();
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredInstallPrompt = null;
    ensureInstallButtonUI();
  });

  window.addEventListener('online', () => {
    updateConnectivityBanner();
    if (window.rapidSync && typeof window.rapidSync.flushOfflineQueue === 'function') {
      window.rapidSync.flushOfflineQueue();
    }
  });

  window.addEventListener('offline', () => {
    updateConnectivityBanner();
  });

  window.addEventListener('rapidOfflineQueueChanged', updateConnectivityBanner);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwaOfflineSupport);
  } else {
    initPwaOfflineSupport();
  }
})();
