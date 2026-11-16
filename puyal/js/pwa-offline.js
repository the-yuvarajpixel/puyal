// ============================================================================
// PUYAL — PWA Registration, Nav Connectivity/SW Dot, Battery Telemetry & Offline Map
// ============================================================================
(function () {
  let deferredInstallPrompt = null;
  let isInstalled = false;
  let isIOS = false;

  // Service Worker & Connectivity live state
  let swStatusState = 'checking'; // 'active' | 'activating' | 'registered' | 'unsupported' | 'unregistered'
  let swStatusDetail = 'Checking Service Worker...';
  let lastKnownOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let firebaseSyncStatus = {
    state: 'idle', // 'idle' | 'pushing' | 'completed' | 'partial'
    remaining: 0,
    total: 0,
    syncedCount: 0,
    updatedAt: 0
  };
  let syncCompleteResetTimer = null;

  // Battery live state (Web Battery Status API)
  let batterySupported = typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function';
  let batteryRef = null;
  let lowBatteryAlertedBelow15 = false;
  let pendingLowBatteryChime = false;
  let batteryAlertAudioCtx = null;
  let batteryState = {
    available: false,
    level: null,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: Infinity
  };

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
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      /* Navbar Connectivity (SW + Online/Offline Dot) & Battery Telemetry */
      .pwa-nav-telemetry {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.86);
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 8px;
        padding: 4px 10px;
        color: #f8fafc;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(2, 6, 23, 0.25);
      }
      .pwa-telemetry-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: 1px solid transparent;
        color: inherit;
        font: inherit;
        padding: 2px 4px;
        border-radius: 5px;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
      }
      .pwa-telemetry-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .pwa-telemetry-divider {
        width: 1px;
        height: 14px;
        background: rgba(148, 163, 184, 0.3);
        flex-shrink: 0;
      }
      .nav-conn-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex-shrink: 0;
        background: #94a3b8;
        transition: background 0.2s ease, box-shadow 0.2s ease;
      }
      .nav-conn-dot.online-sw {
        background: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.85);
      }
      .nav-conn-dot.online-nosw {
        background: #38bdf8;
        box-shadow: 0 0 7px rgba(56, 189, 248, 0.8);
      }
      .nav-conn-dot.offline-sw {
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.9);
        animation: pwaPulse 1.4s infinite ease-in-out;
      }
      .nav-conn-dot.offline-nosw {
        background: #ef4444;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.95);
        animation: pwaPulse 1s infinite ease-in-out;
      }
      .nav-battery-pct {
        font-variant-numeric: tabular-nums;
      }
      .nav-battery-pct.low {
        color: #fde68a;
        animation: pwaPulse 1.3s infinite ease-in-out;
      }
      .nav-battery-pct.critical {
        color: #fecaca;
        font-weight: 800;
        animation: pwaCriticalBatteryPulse 0.9s infinite ease-in-out;
      }
      .nav-battery-pct.charging {
        color: #6ee7b7;
      }
      .pwa-telemetry-btn.battery-critical {
        background: rgba(220, 38, 38, 0.32);
        border: 1px solid rgba(248, 113, 113, 0.78);
        color: #fecaca;
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.45);
        animation: pwaCriticalBatteryPulse 1s infinite ease-in-out;
      }
      .pwa-telemetry-btn.battery-critical:hover {
        background: rgba(220, 38, 38, 0.45);
      }
      .pwa-nav-telemetry.has-critical-battery {
        border-color: rgba(239, 68, 68, 0.78);
        box-shadow: 0 0 14px rgba(239, 68, 68, 0.35);
      }
      @keyframes pwaCriticalBatteryPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.78; transform: scale(1.03); }
      }
      .nav-pending-sync-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(148, 163, 184, 0.14);
        border: 1px solid rgba(148, 163, 184, 0.24);
        color: #cbd5e1;
        border-radius: 6px;
        padding: 2px 7px;
        font-size: 11px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      }
      .nav-pending-sync-btn:hover {
        background: rgba(148, 163, 184, 0.25);
      }
      .nav-pending-sync-btn.has-pending {
        background: rgba(245, 158, 11, 0.22);
        border-color: rgba(251, 191, 36, 0.58);
        color: #fde68a;
      }
      .nav-pending-sync-btn.has-pending:hover {
        background: rgba(245, 158, 11, 0.34);
      }
      .nav-pending-sync-btn.is-syncing-firebase {
        background: rgba(14, 165, 233, 0.24);
        border-color: rgba(56, 189, 248, 0.72);
        color: #bae6fd;
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
      }
      .nav-pending-sync-btn.sync-completed {
        background: rgba(16, 185, 129, 0.22);
        border-color: rgba(52, 211, 153, 0.65);
        color: #a7f3d0;
      }
      .nav-sync-spin {
        display: inline-block;
        animation: pwaSpin 1s linear infinite;
      }
      @keyframes pwaSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .nav-pending-sync-count {
        font-weight: 800;
      }
      .pwa-battery-toast {
        position: fixed;
        top: 72px;
        right: 16px;
        z-index: 1600;
        max-width: 360px;
        background: linear-gradient(135deg, #991b1b, #7f1d1d);
        color: #ffffff;
        border: 1px solid rgba(254, 202, 202, 0.72);
        border-left: 4px solid #f87171;
        border-radius: 10px;
        padding: 11px 14px;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.4;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: pwaBatteryToastSlideIn 0.22s ease-out;
      }
      @keyframes pwaBatteryToastSlideIn {
        from { opacity: 0; transform: translateX(18px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .pwa-battery-toast.hidden { display: none !important; }
      .nav-telemetry-popover {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 268px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.32);
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 14px 34px rgba(2, 6, 23, 0.55);
        z-index: 1500;
        font-size: 11px;
        line-height: 1.45;
        white-space: normal;
      }
      .nav-telemetry-popover.hidden { display: none !important; }
      .nav-telemetry-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      }
      .nav-telemetry-row:last-of-type { border-bottom: none; }
      .nav-telemetry-key { color: #94a3b8; font-weight: 600; }
      .nav-telemetry-val { color: #f8fafc; font-weight: 700; text-align: right; }

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
        50% { opacity: 0.45; transform: scale(0.82); }
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

      /* Offline Alert Notification Stack (works cleanly without network) */
      .pwa-offline-alert-stack {
        position: fixed;
        top: 68px;
        left: 16px;
        z-index: 1650;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: min(390px, calc(100vw - 32px));
        pointer-events: none;
      }
      .pwa-offline-alert-card {
        pointer-events: auto;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-left: 5px solid #f59e0b;
        border-radius: 12px;
        padding: 12px 14px;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        box-shadow: 0 14px 32px rgba(2, 6, 23, 0.48);
        animation: pwaOfflineAlertIn 0.22s ease-out;
      }
      .pwa-offline-alert-card.level-critical {
        background: linear-gradient(135deg, #7f1d1d, #450a0a);
        border-color: rgba(254, 202, 202, 0.55);
        border-left-color: #ef4444;
      }
      .pwa-offline-alert-card.level-warning {
        background: linear-gradient(135deg, #78350f, #451a03);
        border-color: rgba(253, 230, 138, 0.48);
        border-left-color: #f59e0b;
      }
      .pwa-offline-alert-card.level-success {
        background: linear-gradient(135deg, #064e3b, #022c22);
        border-color: rgba(167, 243, 208, 0.45);
        border-left-color: #10b981;
      }
      .pwa-offline-alert-card.level-info {
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-color: rgba(125, 211, 252, 0.45);
        border-left-color: #38bdf8;
      }
      @keyframes pwaOfflineAlertIn {
        from { opacity: 0; transform: translateY(-10px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .pwa-offline-alert-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
      }
      .pwa-offline-alert-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pwa-offline-alert-tag {
        font-size: 9px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.16);
        text-transform: uppercase;
      }
      .pwa-offline-alert-close {
        background: none;
        border: none;
        color: #e2e8f0;
        font-size: 16px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        padding: 0 2px;
      }
      .pwa-offline-alert-body {
        font-size: 12px;
        line-height: 1.45;
        color: #f1f5f9;
      }
      .pwa-offline-alert-meta {
        margin-top: 6px;
        font-size: 10px;
        color: rgba(226, 232, 240, 0.8);
        display: flex;
        justify-content: space-between;
        align-items: center;
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
      btn.setAttribute('aria-label', 'Install PUYAL App for Offline Access');
      btn.innerHTML = '📲 Install Offline App';
      btn.addEventListener('click', handleInstallClick);

      const navRight = document.querySelector('.navbar .nav-right');
      const hudTopBar = document.querySelector('.hud-top-bar');
      if (navRight) {
        navRight.insertBefore(btn, navRight.firstChild);
      } else if (hudTopBar) {
        hudTopBar.appendChild(btn);
      } else {
        let wrap = document.getElementById('pwa-floating-install-wrap');
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.id = 'pwa-floating-install-wrap';
          wrap.className = 'pwa-floating-install-wrap';
          document.body.appendChild(wrap);
        }
        wrap.appendChild(btn);
      }
    }

    if (deferredInstallPrompt) {
      btn.innerHTML = '📲 Install App';
    } else if (isIOS) {
      btn.innerHTML = '📲 Install App (iOS)';
    } else {
      btn.innerHTML = '📲 Install App';
    }
    btn.classList.remove('hidden');
  }

  function formatBatteryDuration(seconds) {
    if (seconds == null || !isFinite(seconds) || seconds <= 0) return 'Calculating…';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `~${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `~${hrs}h ${remMins}m` : `~${hrs}h`;
  }

  function buildBatterySvg(pct, charging, available) {
    const clamped = available ? Math.max(0, Math.min(100, pct)) : 0;
    const isCritical = available && !charging && clamped < 15;
    const fillW = Math.round((clamped / 100) * 14);
    let fillColor = '#22c55e';
    if (!available) fillColor = '#64748b';
    else if (charging) fillColor = '#10b981';
    else if (isCritical) fillColor = '#ef4444';
    else if (clamped <= 20) fillColor = '#f97316';
    else if (clamped <= 50) fillColor = '#f59e0b';

    const frameStroke = isCritical ? 'rgba(252,165,165,0.95)' : 'rgba(226,232,240,0.85)';
    const bolt = charging
      ? '<path d="M9.5 1.8L6.5 6h2.2l-.9 3.2L11 5H8.8l.7-3.2z" fill="#ffffff" stroke="#0f172a" stroke-width="0.4"/>'
      : '';

    return `
      <svg width="21" height="12" viewBox="0 0 21 12" aria-hidden="true" style="display:block; flex-shrink:0;">
        <rect x="0.75" y="1" width="16.5" height="10" rx="2" fill="none" stroke="${frameStroke}" stroke-width="1.3"/>
        <rect x="18" y="3.8" width="2.2" height="4.4" rx="0.8" fill="${frameStroke}"/>
        ${available ? `<rect x="2" y="2.3" width="${Math.max(1, fillW)}" height="7.4" rx="1" fill="${fillColor}"/>` : ''}
        ${bolt}
      </svg>
    `;
  }

  function getPendingSyncStats() {
    let pendingIncidents = 0;
    let totalQueued = 0;
    try {
      if (window.rapidSync && typeof window.rapidSync.getPendingIncidentSyncCount === 'function') {
        pendingIncidents = Number(window.rapidSync.getPendingIncidentSyncCount()) || 0;
        totalQueued = Number(window.rapidSync.getOfflineQueueCount()) || 0;
        return { pendingIncidents, totalQueued };
      }
    } catch (e) {}
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('rapid_offline_outbox') : null;
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          totalQueued = list.length;
          pendingIncidents = list.filter((item) => item && item.type === 'CREATE_INCIDENT').length;
        }
      }
    } catch (e) {}
    return { pendingIncidents, totalQueued };
  }

  function ensureNavbarTelemetryUI() {
    let cluster = document.getElementById('nav-status-telemetry');
    if (cluster) return cluster;

    cluster = document.createElement('div');
    cluster.id = 'nav-status-telemetry';
    cluster.className = 'pwa-nav-telemetry';
    cluster.innerHTML = `
      <button type="button" id="nav-connectivity-indicator" class="pwa-telemetry-btn" aria-label="Connectivity and Service Worker status" aria-live="polite" title="Checking connectivity & Service Worker status">
        <span id="nav-connectivity-dot" class="nav-conn-dot" aria-hidden="true"></span>
        <span id="nav-connectivity-label">Checking…</span>
      </button>
      <span class="pwa-telemetry-divider" aria-hidden="true"></span>
      <button type="button" id="nav-pending-sync-counter" class="nav-pending-sync-btn" aria-label="Data Pending Sync: 0 records waiting for Firebase sync" aria-live="polite" title="Locally stored records waiting to push to Firebase when online" data-pending-count="0" data-sync-state="idle">
        <span id="nav-pending-sync-icon" aria-hidden="true">⏳</span>
        <span id="nav-pending-sync-text">Data Pending Sync:</span>
        <span id="nav-pending-sync-value" class="nav-pending-sync-count">0</span>
      </button>
      <span class="pwa-telemetry-divider" aria-hidden="true"></span>
      <button type="button" id="nav-battery-indicator" class="pwa-telemetry-btn" aria-label="Device battery power level" title="Checking device battery power">
        <span id="nav-battery-icon"></span>
        <span id="nav-battery-label" class="nav-battery-pct">--%</span>
      </button>
      <div id="nav-telemetry-popover" class="nav-telemetry-popover hidden" role="dialog" aria-label="Connectivity, Service Worker, Pending Sync, and Device Power Status">
        <div style="font-weight:800; font-size:12px; color:#38bdf8; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <span>📡 Device &amp; Offline Telemetry</span>
          <button type="button" id="nav-telemetry-close" style="background:none;border:none;color:#94a3b8;font-size:15px;cursor:pointer;line-height:1;" aria-label="Close telemetry">&times;</button>
        </div>
        <div class="nav-telemetry-row">
          <span class="nav-telemetry-key">Network</span>
          <span class="nav-telemetry-val" id="pop-network-val">—</span>
        </div>
        <div class="nav-telemetry-row">
          <span class="nav-telemetry-key">Service Worker</span>
          <span class="nav-telemetry-val" id="pop-sw-val">—</span>
        </div>
        <div class="nav-telemetry-row">
          <span class="nav-telemetry-key">Offline Access</span>
          <span class="nav-telemetry-val" id="pop-offline-ready-val">Checking…</span>
        </div>
        <div class="nav-telemetry-row">
          <span class="nav-telemetry-key">Data Pending Sync</span>
          <span class="nav-telemetry-val" id="pop-queue-val">0 incidents</span>
        </div>
        <div class="nav-telemetry-row">
          <span class="nav-telemetry-key">Battery Level</span>
          <span class="nav-telemetry-val" id="pop-battery-val">—</span>
        </div>
        <div class="nav-telemetry-row">
          <span class="nav-telemetry-key">Power State</span>
          <span class="nav-telemetry-val" id="pop-power-val">—</span>
        </div>
        <div id="pop-sync-actions" style="margin-top:8px; display:none;">
          <button type="button" id="pop-sync-btn" style="width:100%; padding:6px 10px; border:none; border-radius:6px; background:#059669; color:#fff; font-weight:700; font-size:11px; cursor:pointer;">🔄 Push Pending Data to Firebase</button>
        </div>
        <div style="margin-top:8px; display:flex; gap:6px;">
          <button type="button" id="pop-offline-alert-btn" style="flex:1; padding:6px 8px; border:1px solid rgba(248,113,113,0.55); border-radius:6px; background:rgba(220,38,38,0.22); color:#fecaca; font-weight:700; font-size:11px; cursor:pointer;">🚨 Offline Alert</button>
          <button type="button" id="pop-enable-notif-btn" style="flex:1; padding:6px 8px; border:1px solid rgba(56,189,248,0.5); border-radius:6px; background:rgba(2,132,199,0.22); color:#bae6fd; font-weight:700; font-size:11px; cursor:pointer;">🔔 Enable Notifications</button>
        </div>
      </div>
    `;

    const navRight = document.querySelector('.navbar .nav-right');
    const hudTopBar = document.querySelector('.hud-top-bar');
    if (navRight) {
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn && installBtn.parentNode === navRight) {
        navRight.insertBefore(cluster, installBtn.nextSibling);
      } else {
        navRight.insertBefore(cluster, navRight.firstChild);
      }
    } else if (hudTopBar) {
      hudTopBar.appendChild(cluster);
    } else {
      let wrap = document.getElementById('pwa-floating-install-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'pwa-floating-install-wrap';
        wrap.className = 'pwa-floating-install-wrap';
        document.body.appendChild(wrap);
      }
      wrap.appendChild(cluster);
    }

    const popover = document.getElementById('nav-telemetry-popover');
    const togglePopover = (e) => {
      e.stopPropagation();
      if (popover) popover.classList.toggle('hidden');
      renderConnectivityIndicator();
      renderBatteryIndicator();
    };

    document.getElementById('nav-connectivity-indicator').addEventListener('click', togglePopover);
    document.getElementById('nav-pending-sync-counter').addEventListener('click', togglePopover);
    document.getElementById('nav-battery-indicator').addEventListener('click', togglePopover);
    document.getElementById('nav-telemetry-close').addEventListener('click', (e) => {
      e.stopPropagation();
      if (popover) popover.classList.add('hidden');
    });

    const popSyncBtn = document.getElementById('pop-sync-btn');
    if (popSyncBtn) {
      popSyncBtn.addEventListener('click', () => {
        if (window.rapidSync && typeof window.rapidSync.flushOfflineQueue === 'function') {
          window.rapidSync.flushOfflineQueue();
        }
      });
    }

    const popOfflineAlertBtn = document.getElementById('pop-offline-alert-btn');
    if (popOfflineAlertBtn) {
      popOfflineAlertBtn.addEventListener('click', () => {
        const { pendingIncidents, totalQueued } = getPendingSyncStats();
        const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
        window.triggerOfflineAlert({
          id: `manual-${Date.now()}`,
          title: isOnlineNow ? 'Offline Alert Channel Verified' : 'Offline Emergency Alert Active',
          message: isOnlineNow
            ? `App alerts ready even when network drops. ${pendingIncidents} pending incident(s), ${totalQueued} total queued record(s).`
            : `Operating without network. Emergency alerts, cached maps, and local queue (${totalQueued} record(s)) remain active.`,
          level: isOnlineNow ? 'info' : 'critical',
          sound: true,
          notifyOS: true
        });
      });
    }

    const popEnableNotifBtn = document.getElementById('pop-enable-notif-btn');
    if (popEnableNotifBtn) {
      const syncNotifBtnLabel = () => {
        if (typeof Notification === 'undefined') {
          popEnableNotifBtn.textContent = '🔔 In-App Alerts';
        } else if (Notification.permission === 'granted') {
          popEnableNotifBtn.textContent = '✅ Alerts Enabled';
        } else if (Notification.permission === 'denied') {
          popEnableNotifBtn.textContent = '🔕 Banner Mode';
        } else {
          popEnableNotifBtn.textContent = '🔔 Enable Alerts';
        }
      };
      syncNotifBtnLabel();
      popEnableNotifBtn.addEventListener('click', async () => {
        await requestOfflineNotificationPermission();
        syncNotifBtnLabel();
      });
    }

    document.addEventListener('click', (e) => {
      if (popover && !popover.classList.contains('hidden') && !cluster.contains(e.target)) {
        popover.classList.add('hidden');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popover && !popover.classList.contains('hidden')) {
        popover.classList.add('hidden');
      }
    });

    return cluster;
  }

  function renderConnectivityIndicator() {
    ensureNavbarTelemetryUI();
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const dot = document.getElementById('nav-connectivity-dot');
    const label = document.getElementById('nav-connectivity-label');
    const btn = document.getElementById('nav-connectivity-indicator');
    const pendingBtn = document.getElementById('nav-pending-sync-counter');
    const pendingIconEl = document.getElementById('nav-pending-sync-icon');
    const pendingTextEl = document.getElementById('nav-pending-sync-text');
    const pendingValEl = document.getElementById('nav-pending-sync-value');
    const popNet = document.getElementById('pop-network-val');
    const popSw = document.getElementById('pop-sw-val');
    const popOfflineReady = document.getElementById('pop-offline-ready-val');
    const popQueue = document.getElementById('pop-queue-val');
    const popSyncActions = document.getElementById('pop-sync-actions');

    const { pendingIncidents, totalQueued } = getPendingSyncStats();
    const isSyncing = firebaseSyncStatus.state === 'pushing' && (totalQueued > 0 || firebaseSyncStatus.remaining > 0);
    const isJustCompleted = firebaseSyncStatus.state === 'completed' && totalQueued === 0 && firebaseSyncStatus.syncedCount > 0;
    const displayPendingCount = isSyncing ? Math.max(totalQueued, firebaseSyncStatus.remaining) : totalQueued;

    const swControlled =
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      (Boolean(navigator.serviceWorker.controller) || swStatusState === 'active');

    let dotClass = 'nav-conn-dot ';
    let shortText = 'Online';
    let titleMsg = '';

    if (online && swControlled) {
      dotClass += 'online-sw';
      shortText = 'Online · SW';
      titleMsg = 'Online — Service Worker active (offline emergency cache ready)';
    } else if (online) {
      dotClass += 'online-nosw';
      shortText = swStatusState === 'activating' ? 'Online · Syncing SW' : 'Online';
      titleMsg = `Online — ${swStatusDetail}`;
    } else if (swControlled || swStatusState === 'registered') {
      dotClass += 'offline-sw';
      shortText = 'Offline · Cached';
      titleMsg = 'Offline — Service Worker active, serving cached portal data & offline queue';
    } else {
      dotClass += 'offline-nosw';
      shortText = 'Offline';
      titleMsg = 'Offline — No active Service Worker controller detected';
    }

    if (dot) dot.className = dotClass;
    if (label) label.textContent = shortText;
    if (btn) btn.title = titleMsg;

    if (pendingValEl) pendingValEl.textContent = String(displayPendingCount);
    if (pendingIconEl) {
      pendingIconEl.className = isSyncing ? 'nav-sync-spin' : '';
      pendingIconEl.textContent = isSyncing ? '🔄' : isJustCompleted ? '✅' : '⏳';
    }
    if (pendingTextEl) {
      pendingTextEl.textContent = isSyncing
        ? 'Pushing to Firebase:'
        : isJustCompleted
          ? 'Synced to Firebase:'
          : 'Data Pending Sync:';
    }
    if (pendingBtn) {
      pendingBtn.classList.toggle('is-syncing-firebase', isSyncing);
      pendingBtn.classList.toggle('sync-completed', !isSyncing && isJustCompleted);
      pendingBtn.classList.toggle('has-pending', !isSyncing && displayPendingCount > 0);
      pendingBtn.setAttribute('data-pending-count', String(displayPendingCount));
      pendingBtn.setAttribute('data-sync-state', isSyncing ? 'pushing' : isJustCompleted ? 'completed' : 'idle');
      pendingBtn.setAttribute(
        'aria-label',
        isSyncing
          ? `Pushing ${displayPendingCount} local record${displayPendingCount === 1 ? '' : 's'} to Firebase`
          : `Data Pending Sync: ${displayPendingCount} local record${displayPendingCount === 1 ? '' : 's'} waiting for Firebase sync`
      );
      pendingBtn.title = isSyncing
        ? `Online restored — pushing ${displayPendingCount} queued record(s) to Firebase in real time`
        : isJustCompleted
          ? `Successfully pushed ${firebaseSyncStatus.syncedCount} local record(s) to Firebase`
          : displayPendingCount > 0
            ? `${displayPendingCount} locally stored record(s) (${pendingIncidents} incident report(s)) waiting to be pushed to Firebase when connectivity is restored`
            : 'Data Pending Sync: 0 — All local records are synced with Firebase';
    }

    if (popNet) {
      popNet.textContent = online ? '🟢 Connected (Online)' : '🟠 Disconnected (Offline)';
      popNet.style.color = online ? '#6ee7b7' : '#fcd34d';
    }
    if (popSw) {
      popSw.textContent = swStatusDetail;
      popSw.style.color = swControlled ? '#6ee7b7' : '#cbd5e1';
    }
    if (popOfflineReady) {
      const ready = swControlled || swStatusState === 'active';
      popOfflineReady.textContent = ready
        ? '✅ Website & App Open Without Network'
        : swStatusState === 'unsupported'
          ? '⚠️ Local Cache Only'
          : '⏳ Priming Offline Cache';
      popOfflineReady.style.color = ready ? '#6ee7b7' : '#fcd34d';
    }
    if (popQueue) {
      if (isSyncing) {
        popQueue.textContent = `🔄 Pushing to Firebase (${displayPendingCount} left)`;
        popQueue.style.color = '#7dd3fc';
      } else if (isJustCompleted) {
        popQueue.textContent = `✅ Pushed ${firebaseSyncStatus.syncedCount} record(s) to Firebase`;
        popQueue.style.color = '#6ee7b7';
      } else {
        const otherOps = Math.max(0, totalQueued - pendingIncidents);
        const extraActions = otherOps > 0 ? ` (+${otherOps} SOS/updates)` : '';
        popQueue.textContent = `${pendingIncidents} incident${pendingIncidents === 1 ? '' : 's'} pending Firebase${extraActions}`;
        popQueue.style.color = totalQueued > 0 ? '#fcd34d' : '#cbd5e1';
      }
    }
    if (popSyncActions) {
      popSyncActions.style.display = online && totalQueued > 0 ? 'block' : 'none';
    }
  }

  function applyRealtimeFirebaseSyncState(detail) {
    if (!detail || typeof detail !== 'object') return;
    if (syncCompleteResetTimer) {
      clearTimeout(syncCompleteResetTimer);
      syncCompleteResetTimer = null;
    }
    const nextState = detail.state || 'idle';
    firebaseSyncStatus = {
      state: nextState,
      remaining: Number(detail.remaining || 0) || 0,
      total: Number(detail.total || 0) || 0,
      syncedCount: Number(detail.syncedCount || 0) || 0,
      updatedAt: Date.now()
    };
    updateConnectivityBanner();
    if (nextState === 'completed' || nextState === 'partial') {
      syncCompleteResetTimer = setTimeout(() => {
        firebaseSyncStatus.state = 'idle';
        firebaseSyncStatus.syncedCount = 0;
        renderConnectivityIndicator();
      }, 3200);
    }
  }

  let lowBatteryToastTimer = null;

  function hideLowBatteryToast() {
    if (lowBatteryToastTimer) {
      clearTimeout(lowBatteryToastTimer);
      lowBatteryToastTimer = null;
    }
    const toast = document.getElementById('pwa-battery-toast');
    if (toast) toast.classList.add('hidden');
  }

  function showLowBatteryToast(pct) {
    const msg = `🪫 Critical Battery (${pct}%): Power below 15% — connect charger immediately!`;

    let toast = document.getElementById('pwa-battery-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwa-battery-toast';
      toast.className = 'pwa-battery-toast hidden';
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'assertive');
      toast.innerHTML = `
        <span id="pwa-battery-toast-msg"></span>
        <button type="button" id="pwa-battery-toast-close" style="background:none;border:none;color:#fecaca;font-size:15px;font-weight:800;cursor:pointer;line-height:1;" aria-label="Dismiss battery alert">&times;</button>
      `;
      document.body.appendChild(toast);
      const closeBtn = document.getElementById('pwa-battery-toast-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', hideLowBatteryToast);
      }
    }
    const msgEl = document.getElementById('pwa-battery-toast-msg');
    if (msgEl) msgEl.textContent = msg;
    toast.classList.remove('hidden');
    if (lowBatteryToastTimer) clearTimeout(lowBatteryToastTimer);
    lowBatteryToastTimer = setTimeout(hideLowBatteryToast, 7000);

    if (typeof window.showToast === 'function') {
      try {
        window.showToast(msg, 'error');
      } catch (e) {}
    }
  }

  function scheduleLowBatteryAudioUnlock() {
    if (pendingLowBatteryChime) return;
    pendingLowBatteryChime = true;
    const unlockAndPlay = () => {
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
      if (!pendingLowBatteryChime) return;
      pendingLowBatteryChime = false;
      if (batteryState.available && !batteryState.charging && batteryState.level != null && batteryState.level < 0.15) {
        playLowBatteryAlertSound(true);
      }
    };
    window.addEventListener('pointerdown', unlockAndPlay, { once: true, passive: true });
    window.addEventListener('keydown', unlockAndPlay, { once: true, passive: true });
  }

  function playLowBatteryAlertSound(fromUserGesture) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      if (!batteryAlertAudioCtx || batteryAlertAudioCtx.state === 'closed') {
        batteryAlertAudioCtx = new AudioCtx();
      }
      const ctx = batteryAlertAudioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (ctx.state === 'running') {
            triggerSoftBatteryChime(ctx);
          } else if (!fromUserGesture) {
            scheduleLowBatteryAudioUnlock();
          }
        }).catch(() => {
          if (!fromUserGesture) scheduleLowBatteryAudioUnlock();
        });
        return true;
      }
      triggerSoftBatteryChime(ctx);
      return true;
    } catch (e) {
      return false;
    }
  }

  function triggerSoftBatteryChime(ctx) {
    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 784, start: 0, dur: 0.11, peak: 0.08 },
        { freq: 587.33, start: 0.14, dur: 0.17, peak: 0.07 }
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(0.0001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(n.peak, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      });
    } catch (e) {}
  }

  function evaluateLowBatteryThreshold(pct, charging) {
    const below15 = !charging && pct < 15;
    if (below15) {
      if (!lowBatteryAlertedBelow15) {
        lowBatteryAlertedBelow15 = true;
        showLowBatteryToast(pct);
        playLowBatteryAlertSound(false);
      }
    } else {
      lowBatteryAlertedBelow15 = false;
      pendingLowBatteryChime = false;
      hideLowBatteryToast();
    }
  }

  function renderBatteryIndicator() {
    ensureNavbarTelemetryUI();
    const cluster = document.getElementById('nav-status-telemetry');
    const iconEl = document.getElementById('nav-battery-icon');
    const labelEl = document.getElementById('nav-battery-label');
    const btnEl = document.getElementById('nav-battery-indicator');
    const popBat = document.getElementById('pop-battery-val');
    const popPow = document.getElementById('pop-power-val');

    if (!batteryState.available || batteryState.level == null) {
      if (cluster) cluster.classList.remove('has-critical-battery');
      if (btnEl) {
        btnEl.classList.remove('battery-critical');
        btnEl.setAttribute('data-battery-state', 'unavailable');
      }
      if (iconEl) iconEl.innerHTML = buildBatterySvg(0, false, false);
      if (labelEl) {
        labelEl.textContent = batterySupported ? 'Power …' : 'Power N/A';
        labelEl.className = 'nav-battery-pct';
      }
      if (btnEl) {
        btnEl.title = batterySupported
          ? 'Reading device battery level...'
          : 'Battery Status API not supported by this browser';
      }
      if (popBat) popBat.textContent = batterySupported ? 'Detecting…' : 'Unavailable in browser';
      if (popPow) popPow.textContent = batterySupported ? 'Checking power source' : 'OS Telemetry Restricted';
      return;
    }

    const pct = batteryState.level < 0.15
      ? Math.floor(batteryState.level * 100)
      : Math.round(batteryState.level * 100);
    const isCritical = !batteryState.charging && pct < 15;
    const isLow = !batteryState.charging && pct <= 20;

    if (iconEl) iconEl.innerHTML = buildBatterySvg(pct, batteryState.charging, true);
    if (labelEl) {
      labelEl.textContent = batteryState.charging ? `⚡ ${pct}%` : `${pct}%`;
      labelEl.className = `nav-battery-pct${isCritical ? ' critical' : isLow ? ' low' : ''}${batteryState.charging ? ' charging' : ''}`;
    }
    if (btnEl) {
      btnEl.classList.toggle('battery-critical', isCritical);
      btnEl.setAttribute(
        'data-battery-state',
        batteryState.charging ? 'charging' : isCritical ? 'critical' : isLow ? 'low' : 'normal'
      );
    }
    if (cluster) {
      cluster.classList.toggle('has-critical-battery', isCritical);
    }

    let timeNote = '';
    if (batteryState.charging && isFinite(batteryState.chargingTime) && batteryState.chargingTime > 0) {
      timeNote = `${formatBatteryDuration(batteryState.chargingTime)} to full`;
    } else if (!batteryState.charging && isFinite(batteryState.dischargingTime) && batteryState.dischargingTime > 0) {
      timeNote = `${formatBatteryDuration(batteryState.dischargingTime)} remaining`;
    }

    if (btnEl) {
      const warnText = isCritical ? ' — CRITICAL BATTERY (<15%)' : isLow ? ' — LOW POWER WARNING' : '';
      btnEl.title = `Device Battery: ${pct}% (${batteryState.charging ? 'Charging' : 'On Battery'})${timeNote ? ' • ' + timeNote : ''}${warnText}`;
    }
    if (popBat) {
      popBat.textContent = `${pct}%${isCritical ? ' (CRITICAL <15%!)' : isLow ? ' (Low Power!)' : ''}`;
      popBat.style.color = isCritical ? '#fca5a5' : isLow ? '#fde68a' : pct > 50 || batteryState.charging ? '#6ee7b7' : '#fcd34d';
    }
    if (popPow) {
      const sourceText = batteryState.charging ? '⚡ Charging / AC' : '🔋 On Battery';
      popPow.textContent = timeNote ? `${sourceText} (${timeNote})` : sourceText;
    }

    evaluateLowBatteryThreshold(pct, batteryState.charging);
  }

  async function detectServiceWorkerStatus() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      swStatusState = 'unsupported';
      swStatusDetail = 'Unsupported in browser';
      renderConnectivityIndicator();
      return;
    }

    if (navigator.serviceWorker.controller) {
      swStatusState = 'active';
      swStatusDetail = 'Active & Offline Ready';
      renderConnectivityIndicator();
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        if (!navigator.serviceWorker.controller) {
          swStatusState = 'unregistered';
          swStatusDetail = 'Registering…';
        }
      } else {
        const trackWorker = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => detectServiceWorkerStatus());
        };
        if (reg.installing) {
          swStatusState = navigator.serviceWorker.controller ? 'active' : 'activating';
          swStatusDetail = navigator.serviceWorker.controller ? 'Active (Updating cache…)' : 'Installing offline cache…';
          trackWorker(reg.installing);
        } else if (reg.waiting) {
          swStatusState = 'active';
          swStatusDetail = 'Active (Update ready)';
          trackWorker(reg.waiting);
        } else if (reg.active) {
          swStatusState = 'active';
          swStatusDetail = navigator.serviceWorker.controller ? 'Active & Controlling' : 'Activated (Offline Ready)';
        }
      }
    } catch (e) {
      swStatusDetail = navigator.serviceWorker.controller ? 'Active' : 'Unavailable';
    }
    renderConnectivityIndicator();
  }

  async function initBatteryMonitor() {
    renderBatteryIndicator();
    if (!batterySupported) return;
    try {
      batteryRef = await navigator.getBattery();
      const syncBattery = () => {
        batteryState = {
          available: true,
          level: batteryRef.level,
          charging: Boolean(batteryRef.charging),
          chargingTime: batteryRef.chargingTime,
          dischargingTime: batteryRef.dischargingTime
        };
        renderBatteryIndicator();
      };
      syncBattery();
      batteryRef.addEventListener('levelchange', syncBattery);
      batteryRef.addEventListener('chargingchange', syncBattery);
      batteryRef.addEventListener('chargingtimechange', syncBattery);
      batteryRef.addEventListener('dischargingtimechange', syncBattery);
    } catch (err) {
      batterySupported = false;
      batteryState.available = false;
      renderBatteryIndicator();
    }
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
        'Install PUYAL on iPhone / iPad',
        '1. Tap the <strong>Share</strong> icon in your Safari toolbar.<br>2. Scroll down and select <strong>Add to Home Screen</strong>.<br><br>Once installed, all portals, cached data, tactical maps, and offline emergency report queueing work without internet.'
      );
      return;
    }

    const swReady = 'serviceWorker' in navigator && (Boolean(navigator.serviceWorker.controller) || swStatusState === 'active');
    showInstallGuideModal(
      'PUYAL Offline App & Website Ready',
      `${swReady ? '✅ Full offline cache is active on this device.' : '⏳ Activating offline cache...'}<br><br>Both the <strong>website</strong> and the <strong>installed standalone app</strong> open without internet.<br><br>To install as a standalone app, use your browser menu <strong>Install PUYAL</strong> (or <strong>Add to Home Screen</strong>).<br><br>Without a network connection, you can still open all portals, view cached incidents/teams, use offline tactical maps, analyze voice reports locally, and queue SOS or incident submissions for automatic Firebase sync when reconnected.`
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

    renderConnectivityIndicator();
  }

  function warmOfflineOperationalCaches() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!window.rapidSync) return;
    const run = () => {
      try {
        if (!localStorage.getItem('rapid_cache_incidents') && typeof window.rapidSync.fetchIncidents === 'function') {
          window.rapidSync.fetchIncidents().catch(() => {});
        }
        if (!localStorage.getItem('rapid_cache_sos') && typeof window.rapidSync.fetchSOS === 'function') {
          window.rapidSync.fetchSOS().catch(() => {});
        }
        if (!localStorage.getItem('rapid_cache_teams') && typeof window.rapidSync.fetchTeams === 'function') {
          window.rapidSync.fetchTeams().catch(() => {});
        }
        if (!localStorage.getItem('rapid_cache_gov_stations') && typeof window.rapidSync.fetchGovStations === 'function') {
          window.rapidSync.fetchGovStations().catch(() => {});
        }
      } catch (e) {}
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 900);
    }
  }

  function requestWarmOfflineShell(workerTarget) {
    try {
      if (workerTarget && typeof workerTarget.postMessage === 'function') {
        workerTarget.postMessage({ type: 'WARM_OFFLINE_SHELL' });
      }
    } catch (e) {}
  }

  async function ensureOfflinePortalCacheFallback() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (typeof caches === 'undefined') return;
    const criticalPages = [
      '/',
      '/index.html',
      '/dashboard-user.html',
      '/dashboard-admin.html',
      '/login-user.html',
      '/login-admin.html',
      '/tactical-3d.html',
      '/manifest.webmanifest'
    ];
    try {
      const staticCache = await caches.open('puyal-static-v14');
      await Promise.allSettled(
        criticalPages.map(async (pagePath) => {
          const hit = await staticCache.match(pagePath, { ignoreSearch: true });
          if (!hit) {
            const res = await fetch(pagePath, { cache: 'reload' });
            if (res && res.ok && !res.redirected) {
              await staticCache.put(pagePath, res);
            }
          }
        })
      );
    } catch (e) {}
  }

  // ============================================================================
  // OFFLINE ALERT NOTIFICATION HUB (Works without network on Website & App)
  // ============================================================================
  const OFFLINE_ALERT_STORAGE_KEY = 'puyal_offline_alerts';
  let offlineAlertChannel = null;
  const shownAlertIds = new Set();

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      offlineAlertChannel = new BroadcastChannel('puyal_offline_alerts');
      offlineAlertChannel.onmessage = (event) => {
        if (event && event.data && event.data.type === 'OFFLINE_ALERT') {
          renderOfflineAlertCard({ ...event.data.payload, _fromBroadcast: true });
        }
      };
    }
  } catch (e) {}

  function ensureOfflineAlertStack() {
    let stack = document.getElementById('pwa-offline-alert-stack');
    if (!stack && document.body) {
      stack = document.createElement('div');
      stack.id = 'pwa-offline-alert-stack';
      stack.className = 'pwa-offline-alert-stack';
      stack.setAttribute('role', 'region');
      stack.setAttribute('aria-label', 'Offline Emergency Alerts');
      stack.setAttribute('aria-live', 'assertive');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function playOfflineEmergencyTone(level) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!batteryAlertAudioCtx || batteryAlertAudioCtx.state === 'closed') {
        batteryAlertAudioCtx = new AudioCtx();
      }
      const ctx = batteryAlertAudioCtx;
      const playNotes = () => {
        const now = ctx.currentTime;
        const seq = level === 'critical'
          ? [
              { freq: 880, start: 0, dur: 0.12, peak: 0.08 },
              { freq: 660, start: 0.14, dur: 0.12, peak: 0.08 },
              { freq: 880, start: 0.28, dur: 0.16, peak: 0.09 }
            ]
          : [
              { freq: 740, start: 0, dur: 0.11, peak: 0.06 },
              { freq: 587.33, start: 0.13, dur: 0.14, peak: 0.06 }
            ];
        seq.forEach((n) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.freq, now + n.start);
          gain.gain.setValueAtTime(0.0001, now + n.start);
          gain.gain.exponentialRampToValueAtTime(n.peak, now + n.start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + n.start);
          osc.stop(now + n.start + n.dur + 0.02);
        });
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (ctx.state === 'running') playNotes();
        }).catch(() => {});
      } else {
        playNotes();
      }
    } catch (e) {}
  }

  async function requestOfflineNotificationPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        window.triggerOfflineAlert({
          id: `perm-${Date.now()}`,
          title: 'Offline App Alerts Enabled',
          message: 'PUYAL can now surface emergency & SOS alerts offline even when minimized.',
          level: 'success',
          sound: false,
          notifyOS: true,
          ttlMs: 6000
        });
      }
      return perm;
    } catch (e) {
      return 'default';
    }
  }

  function dispatchServiceWorkerLocalNotification(payload) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_LOCAL_NOTIFICATION',
          payload
        });
        return;
      }
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg && typeof reg.showNotification === 'function') {
            reg.showNotification(payload.title || 'PUYAL Emergency Alert', {
              body: payload.body || '',
              icon: '/pwa-192x192.png',
              tag: payload.tag || 'puyal-offline-alert'
            }).catch(() => {});
          }
        }).catch(() => {});
        return;
      }
      new Notification(payload.title || 'PUYAL Emergency Alert', {
        body: payload.body || '',
        icon: '/pwa-192x192.png'
      });
    } catch (e) {}
  }

  function saveOfflineAlertRecord(entry) {
    try {
      const raw = localStorage.getItem(OFFLINE_ALERT_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(list) ? list : [];
      const filtered = arr.filter((x) => x && x.id !== entry.id);
      filtered.unshift(entry);
      localStorage.setItem(OFFLINE_ALERT_STORAGE_KEY, JSON.stringify(filtered.slice(0, 15)));
    } catch (e) {}
  }

  function renderOfflineAlertCard(opts) {
    const stack = ensureOfflineAlertStack();
    if (!stack) return null;

    const id = String(opts.id || `alert-${Date.now()}`);
    if (opts.dedupe && shownAlertIds.has(id)) return null;
    shownAlertIds.add(id);

    const existing = stack.querySelector(`[data-alert-id="${id.replace(/"/g, '')}"]`);
    if (existing) existing.remove();

    while (stack.children.length >= 4) {
      stack.lastElementChild.remove();
    }

    const level = ['critical', 'warning', 'success', 'info'].includes(opts.level) ? opts.level : 'warning';
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const icon = level === 'critical' ? '🚨' : level === 'success' ? '✅' : level === 'info' ? 'ℹ️' : '⚠️';

    const card = document.createElement('div');
    card.className = `pwa-offline-alert-card level-${level}`;
    card.setAttribute('data-alert-id', id);
    card.setAttribute('role', 'alert');

    const head = document.createElement('div');
    head.className = 'pwa-offline-alert-head';

    const titleEl = document.createElement('div');
    titleEl.className = 'pwa-offline-alert-title';
    const tagText = !isOnline ? 'OFFLINE ALERT' : 'APP ALERT';
    titleEl.innerHTML = `<span>${icon}</span><span class="pwa-offline-alert-title-text"></span><span class="pwa-offline-alert-tag">${tagText}</span>`;
    titleEl.querySelector('.pwa-offline-alert-title-text').textContent = opts.title || 'PUYAL Emergency Alert';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pwa-offline-alert-close';
    closeBtn.setAttribute('aria-label', 'Dismiss alert');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => card.remove());

    head.appendChild(titleEl);
    head.appendChild(closeBtn);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'pwa-offline-alert-body';
    bodyEl.textContent = opts.message || '';

    const metaEl = document.createElement('div');
    metaEl.className = 'pwa-offline-alert-meta';
    metaEl.innerHTML = `<span>${isOnline ? 'Network Online · App Ready' : 'No Network · Stored Locally'}</span><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;

    card.appendChild(head);
    card.appendChild(bodyEl);
    card.appendChild(metaEl);
    stack.insertBefore(card, stack.firstChild);

    const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : (level === 'critical' ? 0 : 12000);
    if (ttlMs > 0) {
      setTimeout(() => {
        if (card.parentNode) card.remove();
      }, ttlMs);
    }

    return card;
  }

  window.triggerOfflineAlert = function (opts = {}) {
    const payload = {
      id: opts.id || `puyal-alert-${Date.now()}`,
      title: opts.title || 'PUYAL Offline Alert',
      message: opts.message || 'Emergency alert active without network.',
      level: opts.level || 'warning',
      ttlMs: opts.ttlMs,
      dedupe: Boolean(opts.dedupe),
      createdAt: new Date().toISOString(),
      url: opts.url || (window.location ? window.location.pathname : '/index.html')
    };

    const card = renderOfflineAlertCard(payload);
    if (!card) return null;

    saveOfflineAlertRecord(payload);

    if (opts.sound !== false) {
      playOfflineEmergencyTone(payload.level);
    }
    if (opts.vibrate !== false && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(payload.level === 'critical' ? [200, 90, 200] : [140, 60, 140]);
      } catch (e) {}
    }
    if (opts.notifyOS !== false) {
      dispatchServiceWorkerLocalNotification({
        id: payload.id,
        title: payload.title,
        body: payload.message,
        tag: payload.id,
        level: payload.level,
        url: payload.url
      });
    }
    if (!opts._fromBroadcast && offlineAlertChannel) {
      try {
        offlineAlertChannel.postMessage({ type: 'OFFLINE_ALERT', payload });
      } catch (e) {}
    }
    if (typeof window.showToast === 'function' && opts.toast !== false) {
      try {
        window.showToast(`${payload.title}: ${payload.message}`, payload.level === 'critical' ? 'error' : payload.level);
      } catch (e) {}
    }
    return payload;
  };

  function surfaceStartupOfflineAlerts() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline) return;

    const { pendingIncidents, totalQueued } = getPendingSyncStats();
    let activeSosCount = 0;
    let criticalIncCount = 0;

    try {
      const rawSos = localStorage.getItem('rapid_cache_sos');
      if (rawSos) {
        const list = JSON.parse(rawSos);
        if (Array.isArray(list)) activeSosCount = list.filter((s) => s && s.active).length;
      }
      const rawInc = localStorage.getItem('rapid_cache_incidents');
      if (rawInc) {
        const list = JSON.parse(rawInc);
        if (Array.isArray(list)) {
          criticalIncCount = list.filter((i) => i && i.status !== 'Resolved' && i.severity === 'Critical').length;
        }
      }
    } catch (e) {}

    window.triggerOfflineAlert({
      id: 'startup-offline-mode',
      dedupe: true,
      title: 'Offline Emergency Mode Active',
      message: `PUYAL App is running without network. Cached maps, survival protocols & local SOS queueing (${pendingIncidents} pending / ${totalQueued} queued) are ready.`,
      level: 'warning',
      sound: false,
      notifyOS: false,
      ttlMs: 0
    });

    if (activeSosCount > 0 || criticalIncCount > 0) {
      window.triggerOfflineAlert({
        id: `startup-offline-emergencies-${activeSosCount}-${criticalIncCount}`,
        dedupe: true,
        title: 'Cached Critical Emergency Alert',
        message: `${activeSosCount} active SOS beacon(s) and ${criticalIncCount} Critical incident(s) loaded from local offline cache.`,
        level: 'critical',
        sound: true,
        notifyOS: true,
        ttlMs: 0
      });
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      detectServiceWorkerStatus();
      return;
    }
    navigator.serviceWorker.addEventListener('message', (event) => {
      const msg = event && event.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'OFFLINE_SHELL_READY') {
        swStatusState = 'active';
        swStatusDetail = 'Active & Offline Ready';
        renderConnectivityIndicator();
      } else if (msg.type === 'SW_FIREBASE_SYNC_STATE') {
        applyRealtimeFirebaseSyncState(msg);
      } else if (msg.type === 'SW_TRIGGER_FIREBASE_SYNC') {
        if (window.rapidSync && typeof window.rapidSync.flushOfflineQueue === 'function') {
          window.rapidSync.flushOfflineQueue();
        }
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      detectServiceWorkerStatus();
      requestWarmOfflineShell(navigator.serviceWorker.controller);
    });
    if (navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === 'function') {
      navigator.serviceWorker.ready
        .then((reg) => {
          detectServiceWorkerStatus();
          requestWarmOfflineShell((reg && reg.active) || navigator.serviceWorker.controller);
        })
        .catch(() => {});
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (reg && reg.waiting) {
          try {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } catch (e) {}
        }
        if (reg && reg.addEventListener) {
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  try { installing.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
                }
                detectServiceWorkerStatus();
              });
            }
            detectServiceWorkerStatus();
          });
        }
        detectServiceWorkerStatus();
        if (reg && reg.active) {
          requestWarmOfflineShell(reg.active);
        }
        if (reg && reg.update) {
          reg.update().catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Service Worker registration warning:', err.message);
        detectServiceWorkerStatus();
      });
  }

  function initPwaOfflineSupport() {
    detectEnvironment();
    injectMinimalStylesIfNeeded();
    ensureInstallButtonUI();
    ensureNavbarTelemetryUI();
    updateConnectivityBanner();
    registerServiceWorker();
    detectServiceWorkerStatus();
    initBatteryMonitor();
    warmOfflineOperationalCaches();
    surfaceStartupOfflineAlerts();
    setTimeout(ensureOfflinePortalCacheFallback, 700);
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
    window.triggerOfflineAlert({
      id: `app-installed-${Date.now()}`,
      title: 'PUYAL App Installed',
      message: 'Standalone app installed with offline cache & local alerts active.',
      level: 'success',
      sound: false
    });
  });

  function notifyServiceWorkerOnlineTransition(pendingCount) {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const msg = {
          type: 'ONLINE_TRANSITION_DETECTED',
          pendingCount: Number(pendingCount || 0) || 0,
          state: pendingCount > 0 ? 'pushing' : 'idle',
          ts: Date.now()
        };
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage(msg);
          return true;
        }
        if (navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((reg) => {
            if (reg && reg.active) reg.active.postMessage(msg);
          }).catch(() => {});
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  window.addEventListener('online', () => {
    const wasOffline = lastKnownOnline === false;
    const { totalQueued } = getPendingSyncStats();
    lastKnownOnline = true;

    if (wasOffline) {
      window.triggerOfflineAlert({
        id: `online-restored-${Date.now()}`,
        title: 'Network Restored',
        message: totalQueued > 0
          ? `Connection is back. Pushing ${totalQueued} queued offline record(s) to Firebase.`
          : 'Connection is back. Live telemetry and sync restored.',
        level: 'success',
        sound: false,
        notifyOS: false,
        ttlMs: 6500
      });
      if (totalQueued > 0) {
        applyRealtimeFirebaseSyncState({
          state: 'pushing',
          remaining: totalQueued,
          total: totalQueued,
          syncedCount: 0
        });
      }
      notifyServiceWorkerOnlineTransition(totalQueued);
    }

    updateConnectivityBanner();
    detectServiceWorkerStatus();
    if (window.rapidSync && typeof window.rapidSync.flushOfflineQueue === 'function') {
      window.rapidSync.flushOfflineQueue();
    }
  });

  window.addEventListener('offline', () => {
    const { totalQueued } = getPendingSyncStats();
    if (lastKnownOnline === true) {
      window.triggerOfflineAlert({
        id: `network-lost-${Date.now()}`,
        title: 'Network Disconnected — Offline Alert',
        message: `Running cleanly in offline app mode. Emergency reports & SOS queue locally (${totalQueued} queued) and will auto-sync on reconnect.`,
        level: 'warning',
        sound: true,
        notifyOS: true,
        ttlMs: 0
      });
    }
    lastKnownOnline = false;
    updateConnectivityBanner();
    detectServiceWorkerStatus();
  });

  window.addEventListener('rapidOfflineQueueChanged', updateConnectivityBanner);
  window.addEventListener('rapidSyncStateChanged', (e) => {
    if (e && e.detail) applyRealtimeFirebaseSyncState(e.detail);
  });
  window.addEventListener('storage', (e) => {
    if (!e || !e.key || e.key === 'rapid_offline_outbox') {
      updateConnectivityBanner();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwaOfflineSupport);
  } else {
    initPwaOfflineSupport();
  }

  // Offline Leaflet Canvas Tactical Grid Layer (renders cleanly when OSM tiles fail or device is offline)
  window.attachOfflineMapFallback = function (leafletMap, osmTileLayer) {
    if (!leafletMap || typeof L === 'undefined') return null;
    const OfflineGridLayer = L.GridLayer.extend({
      createTile: function (coords) {
        const tile = document.createElement('canvas');
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        const ctx = tile.getContext('2d');
        if (!ctx) return tile;

        // Tactical dark slate background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size.x, size.y);

        // Minor sector subdivisions
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        for (let g = 64; g < size.x; g += 64) {
          ctx.beginPath();
          ctx.moveTo(g, 0); ctx.lineTo(g, size.y);
          ctx.moveTo(0, g); ctx.lineTo(size.x, g);
          ctx.stroke();
        }

        // Major tile perimeter border
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
        ctx.strokeRect(0.5, 0.5, size.x - 1, size.y - 1);

        // Coordinate & PUYAL OFFLINE GRID watermark
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`PUYAL OFFLINE GRID Z${coords.z}`, 10, 18);
        ctx.font = '10px monospace';
        ctx.fillText(`SEC ${coords.x}:${coords.y}`, 10, 32);

        return tile;
      }
    });

    const gridLayer = new OfflineGridLayer({ zIndex: 0 });
    gridLayer.addTo(leafletMap);

    if (osmTileLayer) {
      osmTileLayer.on('tileerror', (e) => {
        if (e && e.tile) {
          e.tile.style.display = 'none';
        }
      });
      osmTileLayer.on('tileload', (e) => {
        if (e && e.tile) {
          e.tile.style.display = '';
        }
      });
    }
    return gridLayer;
  };
})();
