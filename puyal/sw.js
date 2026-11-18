// ============================================================================
// PUYAL — Offline-First Emergency Service Worker
// Guarantees all portals, scripts, icons, Leaflet GIS, 3D assets, & APIs open
// instantaneously with or without network (website + installed standalone PWA)
// ============================================================================

const CACHE_VERSION = 'v17';
const STATIC_CACHE = `puyal-static-${CACHE_VERSION}`;
const API_CACHE = `puyal-api-${CACHE_VERSION}`;
const RUNTIME_CACHE = `puyal-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/dashboard-user.html',
  '/dashboard-admin.html',
  '/login-user.html',
  '/login-admin.html',
  '/tactical-3d.html',
  '/css/styles.css',
  '/js/auth-sync.js',
  '/js/translations.js',
  '/js/firebase-config.js',
  '/js/gemini-assistant.js',
  '/js/google-maps-manager.js',
  '/js/tactical-3d-scene.js',
  '/js/leaflet-idb-cache.js',
  '/js/pwa-offline.js',
  '/js/qrcode.min.js',
  '/js/incident-qr.js',
  '/js/haptic-feedback.js',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/vendor/leaflet/leaflet.css',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/images/marker-icon.png',
  '/vendor/leaflet/images/marker-icon-2x.png',
  '/vendor/leaflet/images/marker-shadow.png',
  '/vendor/leaflet/images/layers.png',
  '/vendor/leaflet/images/layers-2x.png',
  '/vendor/three/build/three.module.js',
  '/vendor/three/build/three.core.js',
  '/vendor/three/examples/jsm/controls/OrbitControls.js',
  '/vendor/three/examples/jsm/environments/RoomEnvironment.js'
];

const CACHEABLE_API_PREFIXES = [
  '/api/incidents',
  '/api/sos',
  '/api/teams',
  '/api/government/stations',
  '/api/bhashini/languages',
  '/api/maps/config',
  '/api/health'
];

const PREWARM_API_URLS = [
  '/api/incidents',
  '/api/sos',
  '/api/teams',
  '/api/government/stations',
  '/api/bhashini/languages',
  '/api/health'
];

const PREWARM_EXTERNAL_URLS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

async function stripRedirectFlag(response) {
  if (!response || !response.redirected) return response;
  const body = await response.clone().arrayBuffer();
  const headers = new Headers(response.headers);
  return new Response(body, {
    status: response.status || 200,
    statusText: response.statusText || 'OK',
    headers
  });
}

async function cacheCoreAssets() {
  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    CORE_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) {
          const cleanRes = res.redirected ? await stripRedirectFlag(res) : res;
          await staticCache.put(url, cleanRes);
        }
      } catch (e) {
        // Skip unreachable asset during install
      }
    })
  );
}

async function warmOperationalCachesInBackground() {
  try {
    const apiCache = await caches.open(API_CACHE);
    await Promise.allSettled(
      PREWARM_API_URLS.map(async (apiUrl) => {
        try {
          const res = await fetchWithTimeout(apiUrl, 2500);
          if (res && res.ok && !res.redirected) {
            await apiCache.put(apiUrl, res);
          }
        } catch (e) {}
      })
    );

    const runtimeCache = await caches.open(RUNTIME_CACHE);
    await Promise.allSettled(
      PREWARM_EXTERNAL_URLS.map(async (extUrl) => {
        try {
          const res = await fetchWithTimeout(new Request(extUrl, { mode: 'cors' }), 2500);
          if (res && (res.ok || res.type === 'opaque')) {
            await runtimeCache.put(extUrl, res);
          }
        } catch (e) {}
      })
    );
  } catch (e) {}
}

self.addEventListener('install', (event) => {
  // Fast local install only — never block skipWaiting() on external CDNs or APIs
  event.waitUntil(
    cacheCoreAssets().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const expectedCaches = new Set([STATIC_CACHE, API_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !expectedCaches.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Fire-and-forget pre-warming once SW already owns all open clients
        warmOperationalCachesInBackground();
      })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
    if (self.registration && typeof self.registration.showNotification === 'function') {
      const payload = event.data.payload || {};
      const title = payload.title || 'PUYAL Emergency Alert';
      const options = {
        body: payload.body || 'Offline alert active — open PUYAL to review.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: payload.tag || 'puyal-offline-alert',
        renotify: true,
        requireInteraction: payload.level === 'critical',
        vibrate: payload.level === 'critical' ? [220, 100, 220, 100, 220] : [160, 80, 160],
        data: {
          url: payload.url || '/index.html',
          alertId: payload.id || null
        }
      };
      const notifyPromise = self.registration.showNotification(title, options).catch(() => {});
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(notifyPromise);
      }
    }
    return;
  }
  if (event.data.type === 'WARM_OFFLINE_SHELL') {
    const promise = (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      const missing = [];
      for (const asset of CORE_ASSETS) {
        const hit = await staticCache.match(asset, { ignoreSearch: true });
        if (!hit) missing.push(asset);
      }
      if (missing.length > 0 && !isKnownOffline()) {
        await Promise.allSettled(
          missing.map(async (asset) => {
            try {
              const res = await fetchWithTimeout(asset, 2500);
              if (res && res.ok) {
                const cleanRes = res.redirected ? await stripRedirectFlag(res) : res;
                await staticCache.put(asset, cleanRes);
              }
            } catch (e) {}
          })
        );
      }
      if (!isKnownOffline()) {
        await warmOperationalCachesInBackground();
      }
      if (event.source && typeof event.source.postMessage === 'function') {
        const verified = await staticCache.match('/index.html', { ignoreSearch: true });
        event.source.postMessage({
          type: 'OFFLINE_SHELL_READY',
          cacheVersion: CACHE_VERSION,
          ready: Boolean(verified)
        });
      }
    })();
    if (typeof event.waitUntil === 'function') {
      event.waitUntil(promise);
    }
    return;
  }

  if (
    event.data.type === 'ONLINE_TRANSITION_DETECTED' ||
    event.data.type === 'SYNC_QUEUE_PROGRESS' ||
    event.data.type === 'RETRY_BACKGROUND_SYNC'
  ) {
    const isTransition = event.data.type === 'ONLINE_TRANSITION_DETECTED';
    const isManualRetry = event.data.type === 'RETRY_BACKGROUND_SYNC';
    const pendingCount = Number(event.data.pendingCount ?? event.data.remaining ?? 0) || 0;
    const rawState = event.data.state || (pendingCount > 0 ? 'pushing' : 'idle');
    const derivedBadgeStatus = isKnownOffline()
      ? 'offline_retry'
      : rawState === 'pushing'
        ? 'syncing'
        : rawState === 'partial' || (rawState === 'idle' && pendingCount > 0)
          ? 'offline_retry'
          : 'synced';

    const payload = {
      type: 'SW_FIREBASE_SYNC_STATE',
      state: rawState,
      badgeStatus: derivedBadgeStatus,
      remaining: pendingCount,
      total: Number(event.data.total ?? pendingCount) || 0,
      syncedCount: Number(event.data.syncedCount || 0) || 0,
      recordType: event.data.recordType || null,
      transition: isTransition ? 'offline-to-online' : isManualRetry ? 'manual-retry' : 'progress',
      ts: Date.now()
    };

    const relayPromise = (async () => {
      try {
        if ((isTransition || isManualRetry) && pendingCount > 0 && self.registration && self.registration.sync) {
          await self.registration.sync.register('puyal-firebase-sync').catch(() => {});
        }
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((client) => {
          try {
            client.postMessage(payload);
            client.postMessage({
              type: 'SW_SYNC_EVENT_STATUS',
              status: derivedBadgeStatus,
              remaining: pendingCount,
              syncedCount: payload.syncedCount,
              tag: 'puyal-firebase-sync',
              ts: payload.ts
            });
            if (isManualRetry && !isKnownOffline()) {
              client.postMessage({
                type: 'SW_TRIGGER_FIREBASE_SYNC',
                tag: 'puyal-firebase-sync',
                manualRetry: true,
                ts: payload.ts
              });
            }
          } catch (e) {}
        });
        if (typeof resolvePendingSyncWaiters === 'function' && (rawState === 'completed' || rawState === 'partial')) {
          resolvePendingSyncWaiters({ state: rawState, remaining: pendingCount, syncedCount: payload.syncedCount });
        }
      } catch (e) {}
    })();

    if (typeof event.waitUntil === 'function') {
      event.waitUntil(relayPromise);
    }
    return;
  }
});

const pendingSyncWaiters = new Set();
function resolvePendingSyncWaiters(result) {
  pendingSyncWaiters.forEach((resolve) => {
    try { resolve(result); } catch (e) {}
  });
  pendingSyncWaiters.clear();
}

async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => {
    try {
      client.postMessage(message);
    } catch (e) {}
  });
  return clients.length;
}

self.addEventListener('sync', (event) => {
  if (!event || event.tag !== 'puyal-firebase-sync') return;
  event.waitUntil((async () => {
    const lastChance = Boolean(event.lastChance);
    if (isKnownOffline()) {
      await broadcastToClients({
        type: 'SW_SYNC_EVENT_STATUS',
        status: 'offline_retry',
        state: 'partial',
        tag: event.tag,
        lastChance,
        ts: Date.now()
      });
      if (!lastChance) {
        throw new Error('Offline during Background Sync; retry scheduled');
      }
      return;
    }

    await broadcastToClients({
      type: 'SW_SYNC_EVENT_STATUS',
      status: 'syncing',
      state: 'pushing',
      tag: event.tag,
      ts: Date.now()
    });

    const clientCount = await broadcastToClients({
      type: 'SW_TRIGGER_FIREBASE_SYNC',
      tag: event.tag,
      lastChance,
      ts: Date.now()
    });

    if (clientCount === 0) {
      return;
    }

    const ackResult = await new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        pendingSyncWaiters.delete(done);
        clearTimeout(timer);
        resolve(val);
      };
      const timer = setTimeout(() => done({ state: 'timeout', remaining: 0 }), 8000);
      pendingSyncWaiters.add(done);
    });

    if (ackResult && ackResult.state === 'partial') {
      await broadcastToClients({
        type: 'SW_SYNC_EVENT_STATUS',
        status: 'offline_retry',
        state: 'partial',
        remaining: ackResult.remaining || 0,
        lastChance,
        tag: event.tag,
        ts: Date.now()
      });
      if (!lastChance) {
        throw new Error('Partial Firebase sync; retry requested');
      }
      return;
    }

    if (ackResult && ackResult.state === 'completed') {
      await broadcastToClients({
        type: 'SW_SYNC_EVENT_STATUS',
        status: 'synced',
        state: 'completed',
        remaining: 0,
        syncedCount: ackResult.syncedCount || 0,
        tag: event.tag,
        ts: Date.now()
      });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil((async () => {
    try {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if (client && typeof client.focus === 'function') {
          await client.focus();
          return;
        }
      }
      if (self.clients && typeof self.clients.openWindow === 'function') {
        await self.clients.openWindow(targetUrl);
      }
    } catch (e) {}
  })());
});

function isKnownOffline() {
  return typeof self.navigator !== 'undefined' && self.navigator.onLine === false;
}

async function fetchWithTimeout(request, timeoutMs = 1200) {
  if (isKnownOffline()) {
    throw new Error('Offline');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function normalizeAppPathname(pathname) {
  let clean = pathname || '/';
  if (clean === '/puyal' || clean === '/puyal/') return '/';
  if (clean.startsWith('/puyal/')) clean = clean.slice('/puyal'.length);
  return clean || '/';
}

function isHtmlOrNavigationRequest(request, url) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const norm = normalizeAppPathname(url.pathname);
  if (norm === '/' || norm.endsWith('.html')) return true;
  return !norm.includes('.');
}

function isUsableHtmlResponse(res) {
  if (!res || !res.ok || res.redirected) return false;
  const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
  return !ct || ct.includes('text/html') || ct.includes('application/xhtml+xml');
}

async function matchStaticWithFallback(request, url) {
  const staticCache = await caches.open(STATIC_CACHE);
  const normPath = normalizeAppPathname(url.pathname);

  const direct = await staticCache.match(request, { ignoreSearch: true });
  if (direct) return direct;

  if (normPath !== url.pathname) {
    const normalizedMatch = await staticCache.match(url.origin + normPath, { ignoreSearch: true });
    if (normalizedMatch) return normalizedMatch;
  }

  const byNormPath = await staticCache.match(normPath, { ignoreSearch: true });
  if (byNormPath) return byNormPath;

  if (!normPath.includes('.') && normPath !== '/') {
    const htmlMatch =
      (await staticCache.match(normPath + '.html', { ignoreSearch: true })) ||
      (await staticCache.match(url.origin + normPath + '.html', { ignoreSearch: true }));
    if (htmlMatch) return htmlMatch;
  }

  if (normPath === '/') {
    const rootMatch =
      (await staticCache.match('/index.html', { ignoreSearch: true })) ||
      (await staticCache.match('/', { ignoreSearch: true }));
    if (rootMatch) return rootMatch;
  }

  // Fallback across any versioned cache just in case of first-load race
  const anyDirect = await caches.match(request, { ignoreSearch: true });
  if (anyDirect) return anyDirect;

  if (request.mode === 'navigate' || request.destination === 'document') {
    return (
      (await staticCache.match('/index.html', { ignoreSearch: true })) ||
      (await staticCache.match('/', { ignoreSearch: true })) ||
      (await caches.match('/index.html', { ignoreSearch: true })) ||
      (await caches.match('/', { ignoreSearch: true }))
    );
  }
  return null;
}

function buildOfflineApiFallback(pathname) {
  const body = {
    success: true,
    offlineFallback: true,
    incidents: [],
    alerts: [],
    teams: [],
    stations: [],
    languages: []
  };
  if (pathname.startsWith('/api/health')) {
    body.status = 'offline';
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-PUYAL-Offline': '1' }
  });
}

function buildOfflineExternalStub(url, request) {
  const dest = request.destination || '';
  if (dest === 'script' || url.pathname.endsWith('.js')) {
    return new Response('/* PUYAL offline external script stub */\n', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
    });
  }
  if (dest === 'style' || url.hostname.includes('fonts.googleapis.com') || url.pathname.endsWith('.css')) {
    return new Response('/* PUYAL offline stylesheet stub */\n', {
      status: 200,
      headers: { 'Content-Type': 'text/css; charset=utf-8' }
    });
  }
  if (dest === 'image' || url.hostname.includes('tile.openstreetmap.org') || url.pathname.endsWith('.png')) {
    return new Response('', { status: 504, statusText: 'Offline Image Unavailable' });
  }
  return new Response('', { status: 204 });
}

function buildOfflineFallbackHtml() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PUYAL — Offline Portal Ready</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 440px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 20px 44px rgba(0,0,0,0.45); }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 18px; color: #cbd5e1; font-size: 14px; line-height: 1.5; }
    .links { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    a { background: #2563eb; color: #fff; text-decoration: none; padding: 9px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>PUYAL Offline Emergency Shell</h1>
    <p>You are currently offline. Open one of your locally cached portals below:</p>
    <div class="links">
      <a href="/index.html">Home Portal</a>
      <a href="/dashboard-user.html">Civilian Emergency &amp; SOS</a>
      <a href="/dashboard-admin.html">Admin Command</a>
    </div>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-PUYAL-Offline': '1' }
    }
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never cache real-time SSE streams or WebSocket handshakes
  if (url.pathname.startsWith('/api/events') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // Never intercept /sw.js itself so updates always reach the browser
  if (url.origin === self.location.origin && url.pathname === '/sw.js') {
    return;
  }

  // Same-origin cacheable API GET endpoints: NetworkFirst (1200ms race -> API_CACHE -> offline JSON)
  if (
    url.origin === self.location.origin &&
    CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    event.respondWith((async () => {
      const apiCache = await caches.open(API_CACHE);
      try {
        const networkRes = await fetchWithTimeout(request, 1200);
        if (!networkRes || !networkRes.ok || networkRes.redirected) {
          throw new Error('API upstream unavailable');
        }
        apiCache.put(request, networkRes.clone()).catch(() => {});
        return networkRes;
      } catch (err) {
        const cached = await apiCache.match(request, { ignoreSearch: true });
        return cached || buildOfflineApiFallback(url.pathname);
      }
    })());
    return;
  }

  // Same-origin HTML navigations vs static assets
  if (url.origin === self.location.origin) {
    const isHtmlNav = isHtmlOrNavigationRequest(request, url);

    if (isHtmlNav) {
      // HTML App Shell: Cache-First / Stale-While-Revalidate so website & PWA always open
      // instantaneously without waiting for network, dead Wi-Fi, or upstream proxy errors.
      event.respondWith((async () => {
        const staticCache = await caches.open(STATIC_CACHE);
        const normPath = normalizeAppPathname(url.pathname);
        const cacheKeyPath = !normPath.includes('.') && normPath !== '/'
          ? `${normPath}.html`
          : normPath;

        const cached = await matchStaticWithFallback(request, url);
        if (cached) {
          if (!isKnownOffline()) {
            const refreshPromise = fetchWithTimeout(request, 2500)
              .then(async (networkRes) => {
                if (isUsableHtmlResponse(networkRes)) {
                  await staticCache.put(cacheKeyPath, networkRes.clone());
                  if (normPath !== cacheKeyPath) {
                    await staticCache.put(normPath, networkRes.clone());
                  }
                }
              })
              .catch(() => {});
            if (typeof event.waitUntil === 'function') {
              event.waitUntil(refreshPromise);
            }
          }
          return stripRedirectFlag(cached);
        }

        // First-time uncached route: try network cleanly, falling back to cached shell on any error/5xx
        try {
          const networkRes = await fetchWithTimeout(request, 1200);
          if (!isUsableHtmlResponse(networkRes)) {
            throw new Error('Upstream HTML unavailable');
          }
          staticCache.put(cacheKeyPath, networkRes.clone()).catch(() => {});
          if (normPath !== cacheKeyPath) {
            staticCache.put(normPath, networkRes.clone()).catch(() => {});
          }
          return stripRedirectFlag(networkRes);
        } catch (err) {
          const fallbackCached = await matchStaticWithFallback(request, url);
          if (fallbackCached) return stripRedirectFlag(fallbackCached);
          return buildOfflineFallbackHtml();
        }
      })());
      return;
    }

    // Same-origin JS, CSS, Icons, Vendor Leaflet & Three.js: Stale-While-Revalidate
    event.respondWith((async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      const normPath = normalizeAppPathname(url.pathname);
      const cached = await matchStaticWithFallback(request, url);
      if (cached) {
        if (!isKnownOffline()) {
          const refreshAsset = fetchWithTimeout(request, 2500)
            .then((networkRes) => {
              if (networkRes && networkRes.ok && !networkRes.redirected) {
                staticCache.put(normPath, networkRes.clone()).catch(() => {});
              }
            })
            .catch(() => {});
          if (typeof event.waitUntil === 'function') {
            event.waitUntil(refreshAsset);
          }
        }
        return cached;
      }

      try {
        const networkRes = await fetchWithTimeout(request, 1200);
        if (!networkRes || !networkRes.ok || networkRes.redirected) {
          throw new Error('Asset upstream unavailable');
        }
        staticCache.put(normPath, networkRes.clone()).catch(() => {});
        return networkRes;
      } catch (err) {
        return new Response('', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // External CDN assets (Firebase, Fonts, OSM Tiles, Maps): CacheFirst / SWR + fast 700ms offline stub
  if (
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith((async () => {
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const cached = await runtimeCache.match(request, { ignoreSearch: true });
      if (cached) {
        if (!isKnownOffline()) {
          const refreshExt = fetchWithTimeout(request, 2500)
            .then((res) => {
              if (res && (res.ok || res.type === 'opaque')) {
                runtimeCache.put(request, res.clone()).catch(() => {});
              }
            })
            .catch(() => {});
          if (typeof event.waitUntil === 'function') {
            event.waitUntil(refreshExt);
          }
        }
        return cached;
      }
      if (isKnownOffline()) {
        return buildOfflineExternalStub(url, request);
      }
      const isOsmTile = url.hostname.includes('tile.openstreetmap.org');
      try {
        const netRes = await fetchWithTimeout(request, isOsmTile ? 4000 : 1200);
        if (!netRes || (!netRes.ok && netRes.type !== 'opaque')) {
          return buildOfflineExternalStub(url, request);
        }
        runtimeCache.put(request, netRes.clone()).catch(() => {});
        return netRes;
      } catch (e) {
        return buildOfflineExternalStub(url, request);
      }
    })());
  }
});
