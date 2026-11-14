// ============================================================================
// Google Maps Platform Tactical Integration
// Modern Maps JavaScript API Integration:
// - Dynamic Library Import bootstrap (google.maps.importLibrary)
// - AdvancedMarkerElement + PinElement + gmp-click accessibility events
// - Route.computeRoutes() (Routes API) with route cache & geodesic fallback
// - mapId: "DEMO_MAP_ID", internalUsageAttributionIds: ["gmp_mcp_codeassist_v1_aistudio"]
// - Two-Tier Quota Defense & Sticky Warning Banner
// ============================================================================

(function () {
  'use strict';

  const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --------------------------------------------------------------------------
  // Quota Defense Tier 1: Global Error Interceptor
  // --------------------------------------------------------------------------
  window.gm_authFailure = function () {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { reason: 'gm_authFailure' } }));
  };

  const origConsoleError = console.error;
  console.error = function (...args) {
    origConsoleError.apply(console, args);
    const msg = args.map(a => String(a)).join(' ');
    if (
      msg.includes('OverQuotaMapError') ||
      msg.includes('QuotaExceededError') ||
      msg.includes('RESOURCE_EXHAUSTED')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { reason: msg } }));
    }
  };

  function showQuotaBanner() {
    let banner = document.getElementById('gmp-quota-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'gmp-quota-banner';
      banner.style.cssText =
        'background:#fffbeb; border-bottom:1px solid #fde68a; color:#78350f; padding:10px 16px; ' +
        'font-size:12px; text-align:center; position:sticky; top:0; z-index:99999; ' +
        'box-shadow:0 1px 3px rgba(0,0,0,0.1); font-family:Inter, sans-serif;';
      banner.innerHTML =
        '<span>' +
        'Google Maps Platform quota or key restriction notice. If you are the app owner, visit ' +
        '<a href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=' +
        ATTRIBUTION_ID +
        '#quota_exceeded_errors" target="_blank" rel="noopener noreferrer" ' +
        'style="text-decoration:underline; font-weight:700; color:#451a03; margin-left:4px;">' +
        'maps developer site</a> for instructions to update your account.' +
        '</span>';
      document.body.prepend(banner);
    }
    banner.style.display = 'block';
  }

  window.addEventListener('gmp-quota-exceeded', showQuotaBanner);

  // --------------------------------------------------------------------------
  // Dynamic Library Import Bootstrap Loader
  // --------------------------------------------------------------------------
  let mapsConfig = null;
  let bootstrapInstalled = false;
  let librariesPromise = null;
  let cachedLibs = null;

  async function fetchMapsConfig() {
    if (mapsConfig) return mapsConfig;
    try {
      const res = await fetch('/api/maps/config');
      mapsConfig = await res.json();
      return mapsConfig;
    } catch (e) {
      console.warn('Unable to load Maps config from server:', e);
      return { apiKey: '', mapId: 'DEMO_MAP_ID', attributionId: ATTRIBUTION_ID, configured: false };
    }
  }

  function installDynamicBootstrap(config) {
    if (bootstrapInstalled || (window.google && window.google.maps && window.google.maps.importLibrary)) {
      bootstrapInstalled = true;
      return;
    }
    bootstrapInstalled = true;

    (function (g) {
      var h, a, k,
        p = 'The Google Maps JavaScript API',
        c = 'google',
        l = 'importLibrary',
        q = '__ib__',
        m = document,
        b = window;
      b = b[c] || (b[c] = {});
      var d = b.maps || (b.maps = {}),
        r = new Set(),
        e = new URLSearchParams(),
        u = function () {
          return (
            h ||
            (h = new Promise(async function (f, n) {
              await (a = m.createElement('script'));
              e.set('libraries', [...r] + '');
              for (k in g) {
                if (g[k] !== undefined && g[k] !== null && g[k] !== '') {
                  e.set(k.replace(/[A-Z]/g, function (t) { return '_' + t[0].toLowerCase(); }), g[k]);
                }
              }
              e.set('callback', c + '.maps.' + q);
              a.src = 'https://maps.' + c + 'apis.com/maps/api/js?' + e;
              d[q] = f;
              a.onerror = function () {
                h = n(Error(p + ' could not load.'));
              };
              a.nonce = (m.querySelector('script[nonce]') && m.querySelector('script[nonce]').nonce) || '';
              m.head.append(a);
            }))
          );
        };
      if (d[l]) {
        // Already installed
      } else {
        d[l] = function (f) {
          r.add(f);
          var args = Array.prototype.slice.call(arguments, 1);
          return u().then(function () {
            return d[l].apply(d, [f].concat(args));
          });
        };
      }
    })({
      key: config.apiKey,
      v: 'weekly'
    });
  }

  async function loadGoogleMapsLibraries() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    if (cachedLibs) return cachedLibs;
    if (librariesPromise) return librariesPromise;

    librariesPromise = (async () => {
      const config = await fetchMapsConfig();
      if (!config || !config.apiKey) {
        return null;
      }

      try {
        installDynamicBootstrap(config);
        const [mapsLib, markerLib] = await Promise.all([
          window.google.maps.importLibrary('maps'),
          window.google.maps.importLibrary('marker')
        ]);

        let routesLib = null;
        try {
          routesLib = await window.google.maps.importLibrary('routes');
        } catch (routeErr) {
          console.warn('Routes JS library optional load skipped:', routeErr.message || routeErr);
        }

        cachedLibs = {
          config,
          Map: mapsLib.Map,
          InfoWindow: mapsLib.InfoWindow,
          Circle: mapsLib.Circle,
          Polyline: mapsLib.Polyline,
          ColorScheme: mapsLib.ColorScheme,
          AdvancedMarkerElement: markerLib.AdvancedMarkerElement,
          PinElement: markerLib.PinElement,
          Route: routesLib && routesLib.Route ? routesLib.Route : null
        };
        return cachedLibs;
      } catch (err) {
        console.warn('Google Maps dynamic import failed, using fallback:', err);
        if (err && /429|403|quota|RESOURCE_EXHAUSTED/i.test(String(err.message || err))) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { reason: String(err) } }));
        }
        return null;
      }
    })();

    return librariesPromise;
  }

  // --------------------------------------------------------------------------
  // Route Computation Cache (Routes API JS class + geodesic fallback)
  // --------------------------------------------------------------------------
  const computedRouteCache = new Map();
  let routesQuotaTripped = false;

  function routeCacheKey(oLat, oLng, dLat, dLng) {
    return `${oLat.toFixed(4)},${oLng.toFixed(4)}->${dLat.toFixed(4)},${dLng.toFixed(4)}`;
  }

  async function resolveRoutePath(libs, oLat, oLng, dLat, dLng) {
    const fallbackPath = [
      { lat: oLat, lng: oLng },
      { lat: dLat, lng: dLng }
    ];

    if (!libs || !libs.Route || routesQuotaTripped) {
      return fallbackPath;
    }

    const key = routeCacheKey(oLat, oLng, dLat, dLng);
    if (computedRouteCache.has(key)) {
      return computedRouteCache.get(key);
    }

    try {
      const { routes } = await libs.Route.computeRoutes({
        origin: { lat: oLat, lng: oLng },
        destination: { lat: dLat, lng: dLng },
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters'],
        internalUsageAttributionIds: [ATTRIBUTION_ID]
      });

      if (routes && routes.length > 0 && Array.isArray(routes[0].path) && routes[0].path.length >= 2) {
        computedRouteCache.set(key, routes[0].path);
        return routes[0].path;
      }
    } catch (err) {
      const errText = String(err && (err.message || err.code || err));
      if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|429/i.test(errText)) {
        routesQuotaTripped = true;
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { reason: errText } }));
      }
    }

    computedRouteCache.set(key, fallbackPath);
    return fallbackPath;
  }

  // --------------------------------------------------------------------------
  // Tactical Google Map Manager Class
  // --------------------------------------------------------------------------
  class TacticalGoogleMap {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);
      this.options = options;
      this.libs = null;
      this.map = null;
      this.infoWindow = null;
      this.activeMarker = null;

      this.markers = {
        disasters: [],
        teams: [],
        stations: [],
        sos: []
      };
      this.circles = [];
      this.polylines = [];
      this.civState = {
        stationMarker: null,
        incidentMarker: null,
        incidentPerimeter: null,
        vehicleMarker: null,
        routeTraveled: null,
        routeAhead: null
      };

      this.activeFilter = 'all';
      this.showPerimeterCircles = true;
    }

    async init() {
      if (!this.container) return false;

      const libs = await loadGoogleMapsLibraries();
      if (!libs) return false;

      this.libs = libs;

      try {
        const center = this.options.center || { lat: 13.0604, lng: 80.2496 };
        const zoom = this.options.zoom || 12;

        if (!this.container.style.height && !this.container.offsetHeight) {
          this.container.style.height = '480px';
        }

        this.map = new libs.Map(this.container, {
          center,
          zoom,
          mapId: (libs.config && libs.config.mapId) || 'DEMO_MAP_ID',
          gestureHandling: this.options.gestureHandling || 'cooperative',
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          internalUsageAttributionIds: [ATTRIBUTION_ID]
        });

        this.infoWindow = new libs.InfoWindow();
        return true;
      } catch (err) {
        console.error('Error initializing Google Maps:', err);
        return false;
      }
    }

    _openInfo(marker, htmlContent) {
      if (!this.infoWindow || !this.map) return;
      if (this.activeMarker && this.activeMarker !== marker) {
        this.activeMarker.zIndex = null;
      }
      marker.zIndex = 999;
      this.activeMarker = marker;
      this.infoWindow.close();
      this.infoWindow.setContent(htmlContent);
      this.infoWindow.open({
        anchor: marker,
        map: this.map
      });
    }

    _layerVisible(layerKey) {
      if (this.activeFilter === 'all') return true;
      if (this.activeFilter === 'disasters') return layerKey === 'disasters';
      if (this.activeFilter === 'vehicles') return layerKey === 'teams';
      if (this.activeFilter === 'stations') return layerKey === 'stations';
      if (this.activeFilter === 'sos') return layerKey === 'sos';
      return true;
    }

    setFilter(filterType) {
      this.activeFilter = filterType || 'all';

      Object.keys(this.markers).forEach(key => {
        const visible = this._layerVisible(key);
        this.markers[key].forEach(entry => {
          if (entry.marker) {
            entry.marker.map = visible ? this.map : null;
          }
        });
      });

      const showPerim = this.showPerimeterCircles && (this.activeFilter === 'all' || this.activeFilter === 'disasters');
      this.circles.forEach(c => c.setMap(showPerim ? this.map : null));

      const showRoutes = this.activeFilter === 'all' || this.activeFilter === 'disasters' || this.activeFilter === 'vehicles';
      this.polylines.forEach(p => p.setMap(showRoutes ? this.map : null));
    }

    setShowPerimeters(show) {
      this.showPerimeterCircles = Boolean(show);
      const visible = this.showPerimeterCircles && (this.activeFilter === 'all' || this.activeFilter === 'disasters');
      this.circles.forEach(c => c.setMap(visible ? this.map : null));
    }

    clearLayers() {
      Object.keys(this.markers).forEach(k => {
        this.markers[k].forEach(m => {
          if (m.marker) m.marker.map = null;
        });
        this.markers[k] = [];
      });

      this.circles.forEach(c => c.setMap(null));
      this.circles = [];

      this.polylines.forEach(p => p.setMap(null));
      this.polylines = [];
    }

    addDisasterPin(inc) {
      if (!this.map || !this.libs) return;
      const { AdvancedMarkerElement, PinElement, Circle } = this.libs;

      const lat = parseFloat(inc.latitude || (inc.coords && inc.coords.lat) || 13.0604);
      const lng = parseFloat(inc.longitude || (inc.coords && inc.coords.lon) || 80.2496);

      const isCritical = inc.severity === 'Critical';
      const color = isCritical ? '#dc2626' : (inc.severity === 'High' ? '#ea580c' : '#0284c7');
      const borderColor = isCritical ? '#7f1d1d' : (inc.severity === 'High' ? '#9a3412' : '#075985');
      const glyphSymbol = inc.category === 'Fire' ? '🔥' : (inc.category === 'Flood' ? '🌊' : '!');

      const pin = new PinElement({
        background: color,
        borderColor,
        glyphText: glyphSymbol,
        glyphColor: '#ffffff',
        scale: isCritical ? 1.25 : 1.05
      });

      const visible = this._layerVisible('disasters');
      const marker = new AdvancedMarkerElement({
        map: visible ? this.map : null,
        position: { lat, lng },
        title: `${inc.title || 'Incident'} (${inc.severity || 'Active'})`,
        content: pin.element,
        gmpClickable: true
      });

      const infoHtml = `
        <div style="font-family:Inter,sans-serif; max-width:260px; padding:4px 2px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="background:${color}; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">${escapeHtml(inc.severity || 'Active')}</span>
            <span style="font-size:11px; font-weight:700; color:#64748b;">${escapeHtml(inc.category || 'Incident')}</span>
          </div>
          <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(inc.title || 'Emergency Incident')}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">Location: ${escapeHtml(inc.location || 'Reported Coordinates')}</p>
          <div style="font-size:11px; color:#64748b;">Affected: <strong>${escapeHtml(inc.affected || 1)}</strong> &bull; Status: <strong>${escapeHtml(inc.status || 'Active')}</strong></div>
        </div>
      `;

      marker.addEventListener('gmp-click', () => this._openInfo(marker, infoHtml));
      this.markers.disasters.push({ id: inc.id, marker });

      if (inc.severity === 'Critical' || inc.severity === 'High') {
        const showPerim = this.showPerimeterCircles && visible;
        const circle = new Circle({
          strokeColor: color,
          strokeOpacity: 0.75,
          strokeWeight: 1.5,
          fillColor: color,
          fillOpacity: 0.12,
          map: showPerim ? this.map : null,
          center: { lat, lng },
          radius: 2000
        });
        this.circles.push(circle);
      }
    }

    addStationPin(stn) {
      if (!this.map || !this.libs) return;
      const { AdvancedMarkerElement, PinElement } = this.libs;

      const lat = parseFloat(stn.latitude || 13.0604);
      const lng = parseFloat(stn.longitude || 80.2496);

      const pin = new PinElement({
        background: '#0f172a',
        borderColor: '#38bdf8',
        glyphText: 'HQ',
        glyphColor: '#38bdf8',
        scale: 1.05
      });

      const marker = new AdvancedMarkerElement({
        map: this._layerVisible('stations') ? this.map : null,
        position: { lat, lng },
        title: stn.name || 'Command Depot',
        content: pin.element,
        gmpClickable: true
      });

      const totalAmb = ((stn.ambulances && stn.ambulances.als) || 0) + ((stn.ambulances && stn.ambulances.bls) || 0);
      const totalFire = ((stn.fireTenders && stn.fireTenders.water) || 0) + ((stn.fireTenders && stn.fireTenders.foam) || 0);

      const infoHtml = `
        <div style="font-family:Inter,sans-serif; max-width:260px; padding:4px 2px;">
          <span style="background:#0f172a; color:#38bdf8; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">STATION BASE</span>
          <h4 style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(stn.name)}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">${escapeHtml(stn.address || stn.zone || '')}</p>
          <div style="font-size:11px; color:#475569; line-height:1.4;">
            Ambulances: <strong>${totalAmb}</strong> &bull; Fire Tenders: <strong>${totalFire}</strong><br>
            Contact: <strong>${escapeHtml(stn.contact || '+91 108')}</strong>
          </div>
        </div>
      `;

      marker.addEventListener('gmp-click', () => this._openInfo(marker, infoHtml));
      this.markers.stations.push({ id: stn.stationId, marker });
    }

    async addTeamPin(team) {
      if (!this.map || !this.libs) return;
      const { AdvancedMarkerElement, Polyline } = this.libs;

      const lat = parseFloat(team.latitude || 13.0604);
      const lng = parseFloat(team.longitude || 80.2496);

      const isDispatched = team.status === 'Dispatched' || team.status === 'On Scene';
      const color = isDispatched ? '#059669' : '#0284c7';

      const badge = document.createElement('div');
      badge.style.cssText =
        `display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; ` +
        `background:${color}; border:2.5px solid #ffffff; box-shadow:0 4px 10px rgba(0,0,0,0.3); cursor:pointer; font-size:15px; color:#fff;`;
      badge.textContent = team.category === 'Fire' ? '🚒' : (team.category === 'Flood' ? '🚤' : '🚑');

      const visible = this._layerVisible('teams');
      const marker = new AdvancedMarkerElement({
        map: visible ? this.map : null,
        position: { lat, lng },
        title: `${team.name || 'Unit'} [${team.status || 'Standby'}]`,
        content: badge,
        gmpClickable: true
      });

      const infoHtml = `
        <div style="font-family:Inter,sans-serif; max-width:260px; padding:4px 2px;">
          <span style="background:${color}; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">${escapeHtml((team.status || 'Active').toUpperCase())}</span>
          <h4 style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(team.name)}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">${escapeHtml(team.expertise || team.category || 'Response Unit')}</p>
          ${team.assignedIncidentTitle ? `<div style="font-size:11px; color:#059669; font-weight:700;">Heading to: ${escapeHtml(team.assignedIncidentTitle)}</div>` : ''}
          ${team.etaMinutes !== undefined ? `<div style="font-size:11px; color:#475569;">ETA: <strong>${escapeHtml(team.etaMinutes)} mins</strong> (${escapeHtml(team.remainingDistKm || 1)} km)</div>` : ''}
        </div>
      `;

      marker.addEventListener('gmp-click', () => this._openInfo(marker, infoHtml));
      this.markers.teams.push({ id: team.teamId || team.id, marker });

      if (team.status === 'Dispatched' && team.originLatitude && team.targetLatitude) {
        const oLat = parseFloat(team.originLatitude);
        const oLng = parseFloat(team.originLongitude);
        const tLat = parseFloat(team.targetLatitude);
        const tLng = parseFloat(team.targetLongitude);

        const routePath = await resolveRoutePath(this.libs, lat, lng, tLat, tLng);
        const showRoute = this.activeFilter === 'all' || this.activeFilter === 'disasters' || this.activeFilter === 'vehicles';

        const traveledLine = new Polyline({
          path: [{ lat: oLat, lng: oLng }, { lat, lng }],
          geodesic: true,
          strokeColor: '#10b981',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: showRoute ? this.map : null
        });
        this.polylines.push(traveledLine);

        const aheadLine = new Polyline({
          path: routePath,
          geodesic: true,
          strokeColor: '#dc2626',
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: showRoute ? this.map : null
        });
        this.polylines.push(aheadLine);
      }
    }

    addSosBeacon(sos) {
      if (!this.map || !this.libs) return;
      const { AdvancedMarkerElement } = this.libs;

      const lat = parseFloat(sos.latitude || 13.0604);
      const lng = parseFloat(sos.longitude || 80.2496);

      const pinEl = document.createElement('div');
      pinEl.style.cssText =
        'display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; ' +
        'background:#ef4444; border:3px solid #ffffff; box-shadow:0 0 14px rgba(239,68,68,0.8); cursor:pointer; font-size:16px; color:#fff;';
      pinEl.textContent = '🚨';

      const marker = new AdvancedMarkerElement({
        map: this._layerVisible('sos') ? this.map : null,
        position: { lat, lng },
        title: `SOS Beacon (${sos.userEmail || sos.email || 'Civilian'})`,
        content: pinEl,
        gmpClickable: true
      });

      const safeSosId = escapeHtml(String(sos.id || '')).replace(/'/g, '');
      const infoHtml = `
        <div style="font-family:Inter,sans-serif; max-width:260px; padding:4px 2px;">
          <span style="background:#ef4444; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">LIVE SOS BEACON</span>
          <h4 style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:#dc2626;">Distress Alert Active</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">User: ${escapeHtml(sos.userEmail || sos.email || 'Civilian')}</p>
          <div style="font-size:11px; color:#64748b;">GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <button type="button" onclick="window.openLiveStreamForSOS && window.openLiveStreamForSOS('${safeSosId}')" style="width:100%; background:#dc2626; color:#fff; border:none; padding:7px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; margin-top:8px;">
            📹 Watch Live Camera &amp; Mic Stream
          </button>
        </div>
      `;

      marker.addEventListener('gmp-click', () => this._openInfo(marker, infoHtml));
      this.markers.sos.push({ id: sos.id, marker });
    }

    // Specialized live dispatch view for Civilian Portal
    async renderCivilianDispatchTracking(team, incident) {
      if (!this.map || !this.libs || !team) return;
      const { AdvancedMarkerElement, PinElement, Circle, Polyline } = this.libs;

      const vLat = parseFloat(team.latitude || 13.0530);
      const vLng = parseFloat(team.longitude || 80.2650);
      const oLat = parseFloat(team.originLatitude || 13.0610);
      const oLng = parseFloat(team.originLongitude || 80.2490);
      const tLat = parseFloat(team.targetLatitude || (incident && incident.latitude) || 13.0450);
      const tLng = parseFloat(team.targetLongitude || (incident && incident.longitude) || 80.2824);

      if (!this.civState.stationMarker) {
        const stnPin = new PinElement({
          background: '#0f172a',
          borderColor: '#38bdf8',
          glyphText: 'HQ',
          glyphColor: '#38bdf8',
          scale: 1.0
        });
        this.civState.stationMarker = new AdvancedMarkerElement({
          map: this.map,
          position: { lat: oLat, lng: oLng },
          title: `Dispatch Depot: ${team.stationName || 'Central Command Base'}`,
          content: stnPin.element,
          gmpClickable: true
        });
        this.civState.stationMarker.addEventListener('gmp-click', () => {
          this._openInfo(
            this.civState.stationMarker,
            `<strong>Dispatch Depot:</strong> ${escapeHtml(team.stationName || 'Central Command Base')}`
          );
        });
      }

      if (!this.civState.incidentMarker) {
        const incPin = new PinElement({
          background: '#dc2626',
          borderColor: '#7f1d1d',
          glyphText: '!',
          glyphColor: '#ffffff',
          scale: 1.2
        });
        this.civState.incidentMarker = new AdvancedMarkerElement({
          map: this.map,
          position: { lat: tLat, lng: tLng },
          title: incident && incident.title ? incident.title : 'Reported Incident Site',
          content: incPin.element,
          gmpClickable: true
        });
        this.civState.incidentMarker.addEventListener('gmp-click', () => {
          this._openInfo(
            this.civState.incidentMarker,
            `<strong>Reported Incident Site</strong><br>${escapeHtml((incident && incident.title) || 'Incident Location')}`
          );
        });

        this.civState.incidentPerimeter = new Circle({
          strokeColor: '#dc2626',
          strokeOpacity: 0.75,
          strokeWeight: 1.5,
          fillColor: '#dc2626',
          fillOpacity: 0.12,
          map: this.map,
          center: { lat: tLat, lng: tLng },
          radius: 500
        });
      }

      if (!this.civState.vehicleMarker) {
        const vehEl = document.createElement('div');
        vehEl.style.cssText =
          'display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; ' +
          'background:#059669; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.35); font-size:17px; cursor:pointer;';
        vehEl.textContent = team.category === 'Fire' ? '🚒' : (team.category === 'Flood' ? '🚤' : '🚑');

        this.civState.vehicleMarker = new AdvancedMarkerElement({
          map: this.map,
          position: { lat: vLat, lng: vLng },
          title: `${team.name || 'Response Unit'} (${team.status || 'En Route'})`,
          content: vehEl,
          gmpClickable: true
        });
        this.civState.vehicleMarker.addEventListener('gmp-click', () => {
          this._openInfo(
            this.civState.vehicleMarker,
            `<strong>${escapeHtml(team.name)}</strong><br>Status: ${escapeHtml(team.status)}<br>Speed: ~${escapeHtml(team.speedKmh || 52)} km/h`
          );
        });
      } else {
        this.civState.vehicleMarker.position = { lat: vLat, lng: vLng };
      }

      const traveledPath = [{ lat: oLat, lng: oLng }, { lat: vLat, lng: vLng }];
      if (!this.civState.routeTraveled) {
        this.civState.routeTraveled = new Polyline({
          path: traveledPath,
          geodesic: true,
          strokeColor: '#10b981',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map: this.map
        });
      } else {
        this.civState.routeTraveled.setPath(traveledPath);
      }

      const aheadPath = await resolveRoutePath(this.libs, vLat, vLng, tLat, tLng);
      if (!this.civState.routeAhead) {
        this.civState.routeAhead = new Polyline({
          path: aheadPath,
          geodesic: true,
          strokeColor: '#dc2626',
          strokeOpacity: 0.92,
          strokeWeight: 5,
          map: this.map
        });
      } else {
        this.civState.routeAhead.setPath(aheadPath);
      }
    }

    flyTo(lat, lng, zoom = 14) {
      if (!this.map) return;
      this.map.panTo({ lat: parseFloat(lat), lng: parseFloat(lng) });
      this.map.setZoom(zoom);
    }
  }

  window.TacticalGoogleMap = TacticalGoogleMap;
  window.loadGoogleMapsLibraries = loadGoogleMapsLibraries;
})();
