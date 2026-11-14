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

  // Battery live state (Web Battery Status API)
  let batterySupported = typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function';
  let batteryRef = null;
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
        border: none;
        color: inherit;
        font: inherit;
        padding: 2px 3px;
        border-radius: 5px;
        cursor: pointer;
        transition: background 0.15s ease;
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
        color: #fca5a5;
        animation: pwaPulse 1.1s infinite ease-in-out;
      }
      .nav-battery-pct.charging {
        color: #6ee7b7;
      }
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
      btn.innerHTML = '📲 Install on iOS';
    } else {
      btn.innerHTML = '📲 Offline App';
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
    const fillW = Math.round((clamped / 100) * 14);
    let fillColor = '#22c55e';
    if (!available) fillColor = '#64748b';
    else if (charging) fillColor = '#10b981';
    else if (clamped <= 20) fillColor = '#ef4444';
    else if (clamped <= 50) fillColor = '#f59e0b';

    const bolt = charging
      ? '<path d="M9.5 1.8L6.5 6h2.2l-.9 3.2L11 5H8.8l.7-3.2z" fill="#ffffff" stroke="#0f172a" stroke-width="0.4"/>'
      : '';

    return `
      <svg width="21" height="12" viewBox="0 0 21 12" aria-hidden="true" style="display:block; flex-shrink:0;">
        <rect x="0.75" y="1" width="16.5" height="10" rx="2" fill="none" stroke="rgba(226,232,240,0.85)" stroke-width="1.3"/>
        <rect x="18" y="3.8" width="2.2" height="4.4" rx="0.8" fill="rgba(226,232,240,0.85)"/>
        ${available ? `<rect x="2" y="2.3" width="${Math.max(1, fillW)}" height="7.4" rx="1" fill="${fillColor}"/>` : ''}
        ${bolt}
      </svg>
    `;
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
      <button type="button" id="nav-battery-indicator" class="pwa-telemetry-btn" aria-label="Device battery power level" title="Checking device battery power">
        <span id="nav-battery-icon"></span>
        <span id="nav-battery-label" class="nav-battery-pct">--%</span>
      </button>
      <div id="nav-telemetry-popover" class="nav-telemetry-popover hidden" role="dialog" aria-label="Connectivity, Service Worker, and Device Power Status">
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
          <span class="nav-telemetry-key">Offline Queue</span>
          <span class="nav-telemetry-val" id="pop-queue-val">0 pending</span>
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
          <button type="button" id="pop-sync-btn" style="width:100%; padding:6px 10px; border:none; border-radius:6px; background:#059669; color:#fff; font-weight:700; font-size:11px; cursor:pointer;">🔄 Sync Queued Records</button>
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
    const popNet = document.getElementById('pop-network-val');
    const popSw = document.getElementById('pop-sw-val');
    const popQueue = document.getElementById('pop-queue-val');
    const popSyncActions = document.getElementById('pop-sync-actions');

    const queuedCount =
      window.rapidSync && typeof window.rapidSync.getOfflineQueueCount === 'function'
        ? window.rapidSync.getOfflineQueueCount()
        : 0;

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

    if (popNet) {
      popNet.textContent = online ? '🟢 Connected (Online)' : '🟠 Disconnected (Offline)';
      popNet.style.color = online ? '#6ee7b7' : '#fcd34d';
    }
    if (popSw) {
      popSw.textContent = swStatusDetail;
      popSw.style.color = swControlled ? '#6ee7b7' : '#cbd5e1';
    }
    if (popQueue) {
      popQueue.textContent = queuedCount > 0 ? `${queuedCount} queued` : '0 pending';
      popQueue.style.color = queuedCount > 0 ? '#fcd34d' : '#cbd5e1';
    }
    if (popSyncActions) {
      popSyncActions.style.display = online && queuedCount > 0 ? 'block' : 'none';
    }
  }

  function renderBatteryIndicator() {
    ensureNavbarTelemetryUI();
    const iconEl = document.getElementById('nav-battery-icon');
    const labelEl = document.getElementById('nav-battery-label');
    const btnEl = document.getElementById('nav-battery-indicator');
    const popBat = document.getElementById('pop-battery-val');
    const popPow = document.getElementById('pop-power-val');

    if (!batteryState.available || batteryState.level == null) {
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

    const pct = Math.round(batteryState.level * 100);
    const isLow = !batteryState.charging && pct <= 20;

    if (iconEl) iconEl.innerHTML = buildBatterySvg(pct, batteryState.charging, true);
    if (labelEl) {
      labelEl.textContent = batteryState.charging ? `⚡ ${pct}%` : `${pct}%`;
      labelEl.className = `nav-battery-pct${isLow ? ' low' : ''}${batteryState.charging ? ' charging' : ''}`;
    }

    let timeNote = '';
    if (batteryState.charging && isFinite(batteryState.chargingTime) && batteryState.chargingTime > 0) {
      timeNote = `${formatBatteryDuration(batteryState.chargingTime)} to full`;
    } else if (!batteryState.charging && isFinite(batteryState.dischargingTime) && batteryState.dischargingTime > 0) {
      timeNote = `${formatBatteryDuration(batteryState.dischargingTime)} remaining`;
    }

    if (btnEl) {
      btnEl.title = `Device Battery: ${pct}% (${batteryState.charging ? 'Charging' : 'On Battery'})${timeNote ? ' • ' + timeNote : ''}${isLow ? ' — LOW POWER WARNING' : ''}`;
    }
    if (popBat) {
      popBat.textContent = `${pct}%${isLow ? ' (Low Power!)' : ''}`;
      popBat.style.color = isLow ? '#fca5a5' : pct > 50 || batteryState.charging ? '#6ee7b7' : '#fcd34d';
    }
    if (popPow) {
      const sourceText = batteryState.charging ? '⚡ Charging / AC' : '🔋 On Battery';
      popPow.textContent = timeNote ? `${sourceText} (${timeNote})` : sourceText;
    }
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

    const swReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
    showInstallGuideModal(
      'PUYAL Offline App Ready',
      `${swReady ? '✅ Offline cache is active on this device.' : '⏳ Activating offline cache...'}<br><br>To install as a standalone app, use your browser menu <strong>Install PUYAL</strong> (or <strong>Add to Home Screen</strong>).<br><br>While offline, you can open all portals, view cached incidents/teams, use offline tactical maps, analyze voice reports locally, and queue SOS or incident submissions for automatic sync when reconnected.`
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

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      detectServiceWorkerStatus();
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      detectServiceWorkerStatus();
    });
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        detectServiceWorkerStatus();
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
    if (lastKnownOnline === false && typeof window.showToast === 'function') {
      window.showToast('🌐 Connection restored! Service Worker & sync active.', 'success');
    }
    lastKnownOnline = true;
    updateConnectivityBanner();
    detectServiceWorkerStatus();
    if (window.rapidSync && typeof window.rapidSync.flushOfflineQueue === 'function') {
      window.rapidSync.flushOfflineQueue();
    }
  });

  window.addEventListener('offline', () => {
    if (lastKnownOnline === true && typeof window.showToast === 'function') {
      window.showToast('📴 Offline mode — Service Worker serving cached data & local queue.', 'warning');
    }
    lastKnownOnline = false;
    updateConnectivityBanner();
    detectServiceWorkerStatus();
  });

  window.addEventListener('rapidOfflineQueueChanged', updateConnectivityBanner);

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
    }
    return gridLayer;
  };
})();
