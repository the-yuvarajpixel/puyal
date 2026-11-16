// ============================================================================
// PUYAL — Leaflet IndexedDB Base Map Tile Cache Engine
// Persists OpenStreetMap / XYZ Leaflet base map tiles in IndexedDB so
// Tactical Map layers stay visible even when disconnected from the network.
// ============================================================================
(function () {
  'use strict';

  const DB_NAME = 'puyal_map_tile_cache';
  const DB_VERSION = 1;
  const STORE_NAME = 'tiles';
  const MAX_CACHED_TILES = 1500;
  const PRUNE_TARGET = 1200;
  const STALE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  const DEFAULT_TILE_TEMPLATE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const SUBDOMAINS = ['a', 'b', 'c'];

  let dbPromise = null;
  const activeUrlByTile = new WeakMap();
  const inFlightFetches = new Map();

  function openTileDB() {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('by_ts', 'ts', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });

    return dbPromise;
  }

  function buildTileKey(coords, layerId = 'osm') {
    return `${layerId}:${coords.z}/${coords.x}/${coords.y}`;
  }

  function idbGetTile(key) {
    return openTileDB().then((db) => {
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  function idbPutTile(record) {
    return openTileDB().then((db) => {
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(record);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function getStats() {
    return openTileDB().then((db) => {
      if (!db) return { count: 0, supported: false };
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.count();
          req.onsuccess = () => resolve({ count: Number(req.result) || 0, supported: true });
          req.onerror = () => resolve({ count: 0, supported: true });
        } catch (e) {
          resolve({ count: 0, supported: false });
        }
      });
    });
  }

  let pruneScheduled = false;
  function schedulePruneIfNeeded() {
    if (pruneScheduled) return;
    pruneScheduled = true;
    setTimeout(async () => {
      pruneScheduled = false;
      const db = await openTileDB();
      if (!db) return;
      try {
        const { count } = await getStats();
        if (count <= MAX_CACHED_TILES) return;
        const removeCount = count - PRUNE_TARGET;
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const index = tx.objectStore(STORE_NAME).index('by_ts');
          let removed = 0;
          const cursorReq = index.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor && removed < removeCount) {
              cursor.delete();
              removed++;
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => resolve();
        });
      } catch (e) {}
    }, 3000);
  }

  let statsEventTimer = null;
  function emitCacheUpdated() {
    if (statsEventTimer) return;
    statsEventTimer = setTimeout(async () => {
      statsEventTimer = null;
      const stats = await getStats();
      try {
        window.dispatchEvent(new CustomEvent('puyal-tile-cache-updated', { detail: stats }));
      } catch (e) {}
    }, 350);
  }

  function revokeTileObjectUrl(tile) {
    const existing = activeUrlByTile.get(tile);
    if (existing) {
      try { URL.revokeObjectURL(existing); } catch (e) {}
      activeUrlByTile.delete(tile);
    }
  }

  async function fetchAndStoreTileBlob(tileUrl, key, coords) {
    if (inFlightFetches.has(key)) {
      return inFlightFetches.get(key);
    }
    const promise = (async () => {
      try {
        const res = await fetch(tileUrl, { mode: 'cors', cache: 'default' });
        if (!res || !res.ok) return null;
        const blob = await res.blob();
        if (!blob || blob.size === 0) return null;
        await idbPutTile({
          key,
          blob,
          z: coords.z,
          x: coords.x,
          y: coords.y,
          ts: Date.now(),
          bytes: blob.size
        });
        schedulePruneIfNeeded();
        emitCacheUpdated();
        return blob;
      } catch (e) {
        return null;
      } finally {
        inFlightFetches.delete(key);
      }
    })();
    inFlightFetches.set(key, promise);
    return promise;
  }

  // Slippy-map coordinate math for area pre-fetching
  function latLonToTileCoords(lat, lon, zoom) {
    const latRad = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { x, y, z: zoom };
  }

  function resolveUrlFromTemplate(template, coords) {
    const sub = SUBDOMAINS[Math.abs(coords.x + coords.y) % SUBDOMAINS.length];
    return String(template || DEFAULT_TILE_TEMPLATE)
      .replace('{s}', sub)
      .replace('{z}', String(coords.z))
      .replace('{x}', String(coords.x))
      .replace('{y}', String(coords.y));
  }

  async function prefetchCenterTiles(lat, lon, opts = {}) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { fetched: 0, cachedHits: 0, totalTarget: 0, offline: true };
    }
    const zooms = Array.isArray(opts.zooms) && opts.zooms.length > 0 ? opts.zooms : [11, 12, 13, 14];
    const radiusByZoom = opts.radiusByZoom || { 11: 1, 12: 2, 13: 2, 14: 1 };
    const template = opts.urlTemplate || DEFAULT_TILE_TEMPLATE;
    const layerId = opts.layerId || 'osm';
    const maxTiles = opts.maxTiles || 64;

    const candidates = [];
    const seen = new Set();

    for (const z of zooms) {
      const n = Math.pow(2, z);
      const center = latLonToTileCoords(lat, lon, z);
      const r = radiusByZoom[z] != null ? radiusByZoom[z] : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const tx = ((center.x + dx) % n + n) % n;
          const ty = center.y + dy;
          if (ty < 0 || ty >= n) continue;
          const coords = { x: tx, y: ty, z };
          const key = buildTileKey(coords, layerId);
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({ coords, key, url: resolveUrlFromTemplate(template, coords) });
          if (candidates.length >= maxTiles) break;
        }
        if (candidates.length >= maxTiles) break;
      }
      if (candidates.length >= maxTiles) break;
    }

    let fetched = 0;
    let cachedHits = 0;
    let cursor = 0;
    const CONCURRENCY = 4;

    async function worker() {
      while (cursor < candidates.length) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        const item = candidates[cursor++];
        const existing = await idbGetTile(item.key);
        if (existing && existing.blob && (Date.now() - (existing.ts || 0)) < STALE_MS) {
          cachedHits++;
          continue;
        }
        const blob = await fetchAndStoreTileBlob(item.url, item.key, item.coords);
        if (blob) fetched++;
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    const stats = await getStats();
    emitCacheUpdated();
    return {
      fetched,
      cachedHits,
      totalTarget: candidates.length,
      totalCached: stats.count,
      offline: false
    };
  }

  async function findCachedAncestorTile(coords, layerId) {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    for (let dz = 1; dz <= 3; dz++) {
      const pz = coords.z - dz;
      if (pz < 0) break;
      const scale = 1 << dz;
      const px = Math.floor(coords.x / scale);
      const py = Math.floor(coords.y / scale);
      const ancestorKey = buildTileKey({ z: pz, x: px, y: py }, layerId);
      const ancestor = await idbGetTile(ancestorKey);
      if (ancestor && ancestor.blob) {
        try {
          const bmp = await createImageBitmap(ancestor.blob);
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (typeof bmp.close === 'function') bmp.close();
            continue;
          }
          const rx = ((coords.x % scale) + scale) % scale;
          const ry = ((coords.y % scale) + scale) % scale;
          const sw = bmp.width / scale;
          const sh = bmp.height / scale;
          const sx = rx * sw;
          const sy = ry * sh;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, 256, 256);
          if (typeof bmp.close === 'function') bmp.close();
          return canvas.toDataURL('image/png');
        } catch (e) {}
      }
    }
    return null;
  }

  function installLeafletIndexedDBExtension() {
    if (typeof L === 'undefined' || !L.TileLayer || L.TileLayer.IndexedDB) return;

    L.TileLayer.IndexedDB = L.TileLayer.extend({
      options: {
        crossOrigin: 'anonymous',
        layerCacheId: 'osm'
      },

      onAdd: function (map) {
        this._boundUnloadCleanup = (e) => {
          if (e && e.tile) revokeTileObjectUrl(e.tile);
        };
        this.on('tileunload', this._boundUnloadCleanup);
        return L.TileLayer.prototype.onAdd.call(this, map);
      },

      onRemove: function (map) {
        if (this._boundUnloadCleanup) {
          this.off('tileunload', this._boundUnloadCleanup);
        }
        return L.TileLayer.prototype.onRemove.call(this, map);
      },

      createTile: function (coords, done) {
        const tile = document.createElement('img');
        tile.alt = '';
        tile.setAttribute('role', 'presentation');
        tile.crossOrigin = 'anonymous';

        const layerId = this.options.layerCacheId || 'osm';
        const key = buildTileKey(coords, layerId);
        const tileUrl = this.getTileUrl(coords);
        let settled = false;

        const finish = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            tile.style.display = 'none';
          }
          if (typeof done === 'function') {
            done(err, tile);
          }
        };

        const assignBlobToImg = (blob) => {
          try {
            const objUrl = URL.createObjectURL(blob);
            activeUrlByTile.set(tile, objUrl);
            tile.onload = () => {
              tile.style.display = '';
              finish(null);
            };
            tile.onerror = () => {
              revokeTileObjectUrl(tile);
              finish(new Error('Cached tile decode error'));
            };
            tile.src = objUrl;
          } catch (e) {
            finish(e);
          }
        };

        (async () => {
          const cached = await idbGetTile(key);
          if (cached && cached.blob) {
            assignBlobToImg(cached.blob);
            // Refresh stale tile silently in background when online
            if (
              (typeof navigator === 'undefined' || navigator.onLine !== false) &&
              (Date.now() - (cached.ts || 0)) > STALE_MS
            ) {
              fetchAndStoreTileBlob(tileUrl, key, coords).catch(() => {});
            }
            return;
          }

          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            const upscaledDataUrl = await findCachedAncestorTile(coords, layerId);
            if (upscaledDataUrl) {
              tile.crossOrigin = null;
              tile.onload = () => {
                tile.style.display = '';
                finish(null);
              };
              tile.onerror = () => finish(new Error('Ancestor tile decode error'));
              tile.src = upscaledDataUrl;
              return;
            }
            finish(new Error('Offline and tile not cached in IndexedDB'));
            return;
          }

          const blob = await fetchAndStoreTileBlob(tileUrl, key, coords);
          if (blob) {
            assignBlobToImg(blob);
            return;
          }

          // CORS/fetch fallback: load directly via <img> so online view never breaks
          tile.crossOrigin = null;
          tile.onload = () => finish(null);
          tile.onerror = (e) => finish(e || new Error('Tile load failed'));
          tile.src = tileUrl;
        })();

        return tile;
      }
    });

    L.tileLayer.indexedDB = function (urlTemplate, options) {
      return new L.TileLayer.IndexedDB(urlTemplate, options);
    };
  }

  installLeafletIndexedDBExtension();

  window.createCachedLeafletTileLayer = function (urlTemplate, options) {
    installLeafletIndexedDBExtension();
    const url = urlTemplate || DEFAULT_TILE_TEMPLATE;
    const opts = Object.assign(
      {
        maxZoom: 19,
        layerCacheId: 'osm',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      },
      options || {}
    );

    if (typeof L !== 'undefined' && L.TileLayer && L.TileLayer.IndexedDB) {
      return new L.TileLayer.IndexedDB(url, opts);
    }
    if (typeof L !== 'undefined' && L.tileLayer) {
      return L.tileLayer(url, opts);
    }
    return null;
  };

  window.PuyalTileCache = {
    openTileDB,
    buildTileKey,
    getTile: idbGetTile,
    putTile: idbPutTile,
    getStats,
    latLonToTileCoords,
    prefetchCenterTiles,
    emitCacheUpdated
  };
})();
