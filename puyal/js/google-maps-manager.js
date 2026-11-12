// ============================================================================
// Google Maps Platform Tactical Integration
// Compliant with Google Maps Platform standards:
// - AdvancedMarkerElement (no legacy Marker)
// - mapId: "DEMO_MAP_ID"
// - internalUsageAttributionIds: ["gmp_mcp_codeassist_v1_aistudio"]
// - Two-Tier Demo Quota Defense & Sticky Warning Banner
// ============================================================================

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Quota Defense Tier 1: Global Error Interceptor
  // --------------------------------------------------------------------------
  window.gm_authFailure = function () {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const origConsoleError = console.error;
  console.error = function (...args) {
    origConsoleError.apply(console, args);
    const msg = args.map(a => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };

  function showQuotaBanner() {
    let banner = document.getElementById('gmp-quota-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'gmp-quota-banner';
      banner.style.cssText = 'background:#fffbeb; border-bottom:1px solid #fde68a; color:#78350f; padding:10px 16px; font-size:12px; text-align:center; position:sticky; top:0; z-index:99999; box-shadow:0 1px 3px rgba(0,0,0,0.1); font-family:sans-serif;';
      banner.innerHTML = `
        <span>
          ⚠️ Google Maps Platform quota reached. If you are the app owner, visit
          <a href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
             target="_blank" rel="noopener noreferrer"
             style="text-decoration:underline; font-weight:700; color:#451a03; margin-left:4px;">
            maps developer site
          </a> for instructions to update your account.
        </span>
      `;
      document.body.prepend(banner);
    }
    banner.style.display = 'block';
  }

  window.addEventListener('gmp-quota-exceeded', showQuotaBanner);

  // --------------------------------------------------------------------------
  // Google Maps Loader
  // --------------------------------------------------------------------------
  let mapsConfig = null;
  let isGoogleMapsLoaded = false;
  let googleMapsLoadPromise = null;

  async function fetchMapsConfig() {
    if (mapsConfig) return mapsConfig;
    try {
      const res = await fetch('/api/maps/config');
      mapsConfig = await res.json();
      return mapsConfig;
    } catch (e) {
      console.warn('Unable to load Maps config from server:', e);
      return { apiKey: '', mapId: 'DEMO_MAP_ID', configured: false };
    }
  }

  async function loadGoogleMapsScript() {
    if (googleMapsLoadPromise) return googleMapsLoadPromise;

    googleMapsLoadPromise = new Promise(async (resolve, reject) => {
      const config = await fetchMapsConfig();
      if (!config.apiKey) {
        console.warn('Google Maps API key not present, maintaining Leaflet GIS fallback mode.');
        return resolve(false);
      }

      if (window.google && window.google.maps) {
        isGoogleMapsLoaded = true;
        return resolve(true);
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.apiKey)}&libraries=maps,marker,places,routes&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        isGoogleMapsLoaded = true;
        resolve(true);
      };
      script.onerror = (err) => {
        console.warn('Failed to load Google Maps script:', err);
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return googleMapsLoadPromise;
  }

  // --------------------------------------------------------------------------
  // Tactical Map Instance Class
  // --------------------------------------------------------------------------
  class TacticalGoogleMap {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);
      this.options = options;
      this.map = null;
      this.markers = {
        disasters: [],
        teams: [],
        stations: [],
        sos: []
      };
      this.circles = [];
      this.polylines = [];
      this.infoWindow = null;
      this.activeFilter = 'all';
      this.showPerimeterCircles = true;
    }

    async init() {
      if (!this.container) return false;

      const loaded = await loadGoogleMapsScript();
      if (!loaded || !window.google || !window.google.maps) {
        return false;
      }

      try {
        const center = this.options.center || { lat: 13.0604, lng: 80.2496 };
        const zoom = this.options.zoom || 12;

        // Ensure container has height
        if (!this.container.style.height && !this.container.offsetHeight) {
          this.container.style.height = '480px';
        }

        this.map = new google.maps.Map(this.container, {
          center: center,
          zoom: zoom,
          mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio']
        });

        this.infoWindow = new google.maps.InfoWindow();

        return true;
      } catch (err) {
        console.error('Error initializing Google Maps:', err);
        return false;
      }
    }

    clearLayers() {
      // Clear markers
      Object.keys(this.markers).forEach(k => {
        this.markers[k].forEach(m => {
          if (m.marker && m.marker.map) m.marker.map = null;
        });
        this.markers[k] = [];
      });

      // Clear circles
      this.circles.forEach(c => c.setMap(null));
      this.circles = [];

      // Clear polylines
      this.polylines.forEach(p => p.setMap(null));
      this.polylines = [];
    }

    // Add Incident / Disaster Pin
    addDisasterPin(inc) {
      if (!this.map || !window.google || !window.google.maps.marker) return;

      const lat = parseFloat(inc.latitude || (inc.coords && inc.coords.lat) || 13.0604);
      const lng = parseFloat(inc.longitude || (inc.coords && inc.coords.lon) || 80.2496);

      const isCritical = inc.severity === 'Critical';
      const color = isCritical ? '#dc2626' : (inc.severity === 'High' ? '#ea580c' : '#0284c7');

      // Custom DOM element for AdvancedMarkerElement
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        display:flex; align-items:center; justify-content:center;
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; border: 3px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer;
        font-size: 14px; color: #fff;
        ${isCritical ? 'animation: alertPulse 1.6s infinite;' : ''}
      `;
      pinEl.innerHTML = inc.category === 'Fire' ? '🔥' : (inc.category === 'Flood' ? '🌊' : '⚠️');

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: { lat, lng },
        title: `${inc.title} (${inc.severity})`,
        content: pinEl
      });

      const infoHtml = `
        <div style="font-family:sans-serif; max-width:260px; padding:6px 2px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="background:${color}; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">${inc.severity}</span>
            <span style="font-size:11px; font-weight:700; color:#64748b;">${inc.category || 'Incident'}</span>
          </div>
          <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:800; color:#0f172a;">${inc.title}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">📍 ${inc.location || 'Reported Location'}</p>
          <div style="font-size:11px; color:#64748b;">👥 Affected: <strong>${inc.affected || 1} people</strong> &bull; Status: <strong>${inc.status || 'Active'}</strong></div>
        </div>
      `;

      marker.addListener('click', () => {
        this.infoWindow.setContent(infoHtml);
        this.infoWindow.open({
          anchor: marker,
          map: this.map
        });
      });

      this.markers.disasters.push({ id: inc.id, marker });

      // Add 2km operational zone circle if critical/high
      if (this.showPerimeterCircles && (inc.severity === 'Critical' || inc.severity === 'High')) {
        const circle = new google.maps.Circle({
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: color,
          fillOpacity: 0.12,
          map: this.map,
          center: { lat, lng },
          radius: 2000 // 2 km perimeter
        });
        this.circles.push(circle);
      }
    }

    // Add Station Base Depot
    addStationPin(stn) {
      if (!this.map || !window.google || !window.google.maps.marker) return;

      const lat = parseFloat(stn.latitude || 13.0604);
      const lng = parseFloat(stn.longitude || 80.2496);

      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        display:flex; align-items:center; justify-content:center;
        width: 32px; height: 32px; border-radius: 6px;
        background: #0f172a; border: 2px solid #38bdf8;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer;
        font-size: 15px; color: #fff;
      `;
      pinEl.innerHTML = '🏢';

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: { lat, lng },
        title: stn.name,
        content: pinEl
      });

      const totalAmb = (stn.ambulances?.als || 0) + (stn.ambulances?.bls || 0);
      const totalFire = (stn.fireTenders?.water || 0) + (stn.fireTenders?.foam || 0);

      const infoHtml = `
        <div style="font-family:sans-serif; max-width:260px; padding:6px 2px;">
          <span style="background:#0f172a; color:#38bdf8; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">STATION BASE</span>
          <h4 style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:#0f172a;">${stn.name}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">📍 ${stn.address || stn.zone}</p>
          <div style="font-size:11px; color:#475569; line-height:1.4;">
            🚑 Ambulances: <strong>${totalAmb}</strong> &bull; 🚒 Fire: <strong>${totalFire}</strong><br>
            📞 Contact: <strong>${stn.contact || '+91 108'}</strong>
          </div>
        </div>
      `;

      marker.addListener('click', () => {
        this.infoWindow.setContent(infoHtml);
        this.infoWindow.open({
          anchor: marker,
          map: this.map
        });
      });

      this.markers.stations.push({ id: stn.stationId, marker });
    }

    // Add Emergency Response Team / Vehicle Pin
    addTeamPin(team) {
      if (!this.map || !window.google || !window.google.maps.marker) return;

      const lat = parseFloat(team.latitude || 13.0604);
      const lng = parseFloat(team.longitude || 80.2496);

      const isDispatched = team.status === 'Dispatched' || team.status === 'On Scene';
      const color = isDispatched ? '#059669' : '#0284c7';

      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        display:flex; align-items:center; justify-content:center;
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; border: 2.5px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer;
        font-size: 15px; color: #fff;
        ${isDispatched ? 'animation: alertPulse 2s infinite;' : ''}
      `;
      pinEl.innerHTML = team.category === 'Fire' ? '🚒' : (team.category === 'Flood' ? '🚤' : '🚑');

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: { lat, lng },
        title: `${team.name} [${team.status}]`,
        content: pinEl
      });

      const infoHtml = `
        <div style="font-family:sans-serif; max-width:260px; padding:6px 2px;">
          <span style="background:${color}; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">${team.status.toUpperCase()}</span>
          <h4 style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:#0f172a;">${team.name}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">🛡️ ${team.expertise || team.category}</p>
          ${team.assignedIncidentTitle ? `<div style="font-size:11px; color:#059669; font-weight:700;">🎯 Heading to: ${team.assignedIncidentTitle}</div>` : ''}
          ${team.etaMinutes ? `<div style="font-size:11px; color:#475569;">⏱️ ETA: <strong>${team.etaMinutes} mins</strong> (${team.remainingDistKm || 1} km)</div>` : ''}
        </div>
      `;

      marker.addListener('click', () => {
        this.infoWindow.setContent(infoHtml);
        this.infoWindow.open({
          anchor: marker,
          map: this.map
        });
      });

      this.markers.teams.push({ id: team.teamId || team.id, marker });

      // If dispatched, draw route polyline from origin to target
      if (team.status === 'Dispatched' && team.originLatitude && team.targetLatitude) {
        const polyline = new google.maps.Polyline({
          path: [
            { lat: parseFloat(team.originLatitude), lng: parseFloat(team.originLongitude) },
            { lat: parseFloat(team.latitude), lng: parseFloat(team.longitude) },
            { lat: parseFloat(team.targetLatitude), lng: parseFloat(team.targetLongitude) }
          ],
          geodesic: true,
          strokeColor: '#059669',
          strokeOpacity: 0.8,
          strokeWeight: 3
        });
        polyline.setMap(this.map);
        this.polylines.push(polyline);
      }
    }

    // Add Live Civilian SOS Beacon
    addSosBeacon(sos) {
      if (!this.map || !window.google || !window.google.maps.marker) return;

      const lat = parseFloat(sos.latitude || 13.0604);
      const lng = parseFloat(sos.longitude || 80.2496);

      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        display:flex; align-items:center; justify-content:center;
        width: 36px; height: 36px; border-radius: 50%;
        background: #ef4444; border: 3px solid #ffffff;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.8); cursor: pointer;
        font-size: 16px; color: #fff; animation: alertPulse 1.2s infinite;
      `;
      pinEl.innerHTML = '🚨';

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: { lat, lng },
        title: `CIVILIAN SOS BEACON (${sos.userEmail || 'Emergency'})`,
        content: pinEl
      });

      const infoHtml = `
        <div style="font-family:sans-serif; max-width:260px; padding:6px 2px;">
          <span style="background:#ef4444; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">🚨 LIVE SOS BEACON</span>
          <h4 style="margin:4px 0 6px 0; font-size:14px; font-weight:800; color:#dc2626;">Distress Alert Active</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#334155;">User: ${sos.userEmail || 'Civilian'}</p>
          <div style="font-size:11px; color:#64748b;">GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>
      `;

      marker.addListener('click', () => {
        this.infoWindow.setContent(infoHtml);
        this.infoWindow.open({
          anchor: marker,
          map: this.map
        });
      });

      this.markers.sos.push({ id: sos.id, marker });
    }

    flyTo(lat, lng, zoom = 14) {
      if (!this.map) return;
      this.map.panTo({ lat, lng });
      this.map.setZoom(zoom);
    }
  }

  // Export to window
  window.TacticalGoogleMap = TacticalGoogleMap;
  window.loadGoogleMapsScript = loadGoogleMapsScript;
})();
