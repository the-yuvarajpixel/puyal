// ============================================================================
// PUYAL — Offline-First Emergency Service Worker
// Caches all portal pages, scripts, icons, Leaflet GIS, 3D assets, & APIs
// ============================================================================

const CACHE_VERSION = 'v10';
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
  '/js/pwa-offline.js',
  '/js/qrcode.min.js',
  '/js/incident-qr.js',
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
  '/api/bhashini/languages'
];

const PREWARM_EXTERNAL_URLS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        CORE_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) {
              await staticCache.put(url, res);
            }
          } catch (e) {
            // Skip unreachable asset during install
          }
        })
      );

      // Best-effort pre-warm of operational read APIs & external Firebase SDKs
      const apiCache = await caches.open(API_CACHE);
      await Promise.allSettled(
        PREWARM_API_URLS.map(async (apiUrl) => {
          try {
            const res = await fetch(apiUrl, { cache: 'no-store' });
            if (res && res.ok) {
              await apiCache.put(apiUrl, res);
            }
          } catch (e) {}
        })
      );

      const runtimeCache = await caches.open(RUNTIME_CACHE);
      await Promise.allSettled(
        PREWARM_EXTERNAL_URLS.map(async (extUrl) => {
          try {
            const res = await fetch(extUrl, { mode: 'cors' });
            if (res && (res.ok || res.type === 'opaque')) {
              await runtimeCache.put(extUrl, res);
            }
          } catch (e) {}
        })
      );
    })().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const expectedCaches = new Set([STATIC_CACHE, API_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !expectedCaches.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

async function matchStaticWithFallback(request, url) {
  const direct = await caches.match(request, { ignoreSearch: true });
  if (direct) return direct;

  const normPath = normalizeAppPathname(url.pathname);
  if (normPath !== url.pathname) {
    const normalizedMatch = await caches.match(url.origin + normPath, { ignoreSearch: true });
    if (normalizedMatch) return normalizedMatch;
  }

  if (!normPath.includes('.') && normPath !== '/') {
    const htmlMatch = await caches.match(url.origin + normPath + '.html', { ignoreSearch: true });
    if (htmlMatch) return htmlMatch;
  }

  if (normPath === '/') {
    const rootMatch =
      (await caches.match('/index.html', { ignoreSearch: true })) ||
      (await caches.match('/', { ignoreSearch: true }));
    if (rootMatch) return rootMatch;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    return (
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
  return new Response('', { status: 204 });
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
        if (networkRes && networkRes.ok) {
          apiCache.put(request, networkRes.clone()).catch(() => {});
        }
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
      // HTML Documents: instant cache when offline; fast 900ms network-first when online
      event.respondWith((async () => {
        const staticCache = await caches.open(STATIC_CACHE);
        if (isKnownOffline()) {
          const cachedOffline = await matchStaticWithFallback(request, url);
          if (cachedOffline) return cachedOffline;
        }
        try {
          const networkRes = await fetchWithTimeout(request, 900);
          if (networkRes && networkRes.ok) {
            const normPath = normalizeAppPathname(url.pathname);
            staticCache.put(normPath + url.search, networkRes.clone()).catch(() => {});
            if (url.search) {
              staticCache.put(normPath, networkRes.clone()).catch(() => {});
            }
          }
          return networkRes;
        } catch (err) {
          const cached = await matchStaticWithFallback(request, url);
          if (cached) return cached;
          return new Response('PUYAL Offline — page not cached yet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      })());
      return;
    }

    // Same-origin JS, CSS, Icons, Vendor Leaflet & Three.js: Stale-While-Revalidate (instant offline & dead-Wi-Fi)
    event.respondWith((async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      const cached = await matchStaticWithFallback(request, url);
      if (cached) {
        if (!isKnownOffline()) {
          fetchWithTimeout(request, 2500)
            .then((networkRes) => {
              if (networkRes && networkRes.ok) {
                const normPath = normalizeAppPathname(url.pathname);
                staticCache.put(normPath, networkRes.clone()).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return cached;
      }

      try {
        const networkRes = await fetchWithTimeout(request, 1200);
        if (networkRes && networkRes.ok) {
          const normPath = normalizeAppPathname(url.pathname);
          staticCache.put(normPath, networkRes.clone()).catch(() => {});
        }
        return networkRes;
      } catch (err) {
        return new Response('', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // External CDN assets (Firebase, Fonts, OSM Tiles, Maps): CacheFirst / SWR + fast 850ms offline stub
  if (
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith((async () => {
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const cached = await runtimeCache.match(request);
      if (cached) {
        if (!isKnownOffline()) {
          fetchWithTimeout(request, 2500)
            .then((res) => {
              if (res && (res.ok || res.type === 'opaque')) {
                runtimeCache.put(request, res.clone()).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return cached;
      }
      if (isKnownOffline()) {
        return buildOfflineExternalStub(url, request);
      }
      try {
        const netRes = await fetchWithTimeout(request, 850);
        if (netRes && (netRes.ok || netRes.type === 'opaque')) {
          runtimeCache.put(request, netRes.clone()).catch(() => {});
        }
        return netRes;
      } catch (e) {
        return buildOfflineExternalStub(url, request);
      }
    })());
  }
});
