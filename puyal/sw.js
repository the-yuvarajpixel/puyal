// ============================================================================
// RapidResponse Command — Offline-First Emergency Service Worker
// Caches all portal pages, scripts, icons, 3D assets, and API snapshots
// ============================================================================

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `rapidresponse-static-${CACHE_VERSION}`;
const API_CACHE = `rapidresponse-api-${CACHE_VERSION}`;
const RUNTIME_CACHE = `rapidresponse-runtime-${CACHE_VERSION}`;

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
  '/manifest.webmanifest',
  '/favicon.svg',
  '/logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) {
              await cache.put(url, res);
            }
          } catch (e) {
            // Skip unreachable optional assets during install
          }
        })
      );
    }).then(() => self.skipWaiting())
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

async function fetchWithTimeout(request, timeoutMs = 2500) {
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

async function matchStaticWithFallback(request, url) {
  const direct = await caches.match(request, { ignoreSearch: true });
  if (direct) return direct;

  if (!url.pathname.includes('.') && url.pathname !== '/') {
    const htmlMatch = await caches.match(url.origin + url.pathname + '.html', { ignoreSearch: true });
    if (htmlMatch) return htmlMatch;
  }

  if (request.mode === 'navigate') {
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
    headers: { 'Content-Type': 'application/json', 'X-RapidResponse-Offline': '1' }
  });
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

  // Same-origin cacheable API GET endpoints: NetworkFirst -> API_CACHE -> safe empty JSON
  if (
    url.origin === self.location.origin &&
    CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    event.respondWith((async () => {
      const apiCache = await caches.open(API_CACHE);
      try {
        const networkRes = await fetchWithTimeout(request, 2500);
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

  // Same-origin pages, JS, CSS, SVG/PNG icons, vendor Three.js modules
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      try {
        const networkRes = await fetchWithTimeout(request, 2200);
        if (networkRes && networkRes.ok) {
          staticCache.put(url.pathname + url.search, networkRes.clone()).catch(() => {});
          if (url.search) {
            staticCache.put(url.pathname, networkRes.clone()).catch(() => {});
          }
        }
        return networkRes;
      } catch (err) {
        const cached = await matchStaticWithFallback(request, url);
        if (cached) return cached;
        return new Response('Offline — resource not cached yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // External CDN assets (Leaflet, Google Fonts): Stale-While-Revalidate
  if (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith((async () => {
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const cached = await runtimeCache.match(request);
      const networkPromise = fetchWithTimeout(request, 3000)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            runtimeCache.put(request, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        return cached;
      }
      const netRes = await networkPromise;
      if (netRes) return netRes;
      return new Response('', { status: 204 });
    })());
  }
});
