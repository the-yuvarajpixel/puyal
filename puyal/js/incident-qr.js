// ============================================================================
// PUYAL — Offline Incident QR Code Generator & Responder Dispatch Modal
// Runs 100% client-side (online & offline) via bundled window.QRCode engine
// ============================================================================
(function () {
  'use strict';

  const MODAL_ID = 'puyal-incident-qr-modal';
  const STYLE_ID = 'puyal-incident-qr-styles';

  let activeIncident = null;
  let activeMode = 'brief'; // 'brief' | 'json' | 'geo'
  let highContrastMode = false;

  function escapeHtml(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanText(val, maxLen) {
    const str = String(val == null ? '' : val).replace(/\s+/g, ' ').trim();
    if (!maxLen || str.length <= maxLen) return str;
    return str.slice(0, maxLen - 1).trim() + '…';
  }

  function extractCoords(inc) {
    let lat = inc && (inc.latitude ?? inc.lat ?? inc.coords?.lat ?? inc.coords?.latitude);
    let lon = inc && (inc.longitude ?? inc.lon ?? inc.lng ?? inc.coords?.lon ?? inc.coords?.longitude);
    if ((lat == null || lon == null || isNaN(Number(lat)) || isNaN(Number(lon))) && inc && inc.location) {
      const m = String(inc.location).match(/(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)/);
      if (m) {
        lat = parseFloat(m[1]);
        lon = parseFloat(m[2]);
      }
    }
    if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return {
        lat: Number(Number(lat).toFixed(6)),
        lon: Number(Number(lon).toFixed(6))
      };
    }
    return null;
  }

  function normalizeIncident(raw) {
    const src = raw || {};
    const coords = extractCoords(src);
    const id = src.id ? String(src.id) : `DRAFT-${Date.now().toString().slice(-6)}`;
    const teamName =
      src.assignedTeamName ||
      (src.assignedTeam && src.assignedTeam.name) ||
      src.teamName ||
      '';

    return {
      id,
      title: cleanText(src.title, 90) || 'Emergency Incident Draft',
      category: cleanText(src.category, 40) || 'Emergency',
      severity: cleanText(src.severity, 20) || 'High',
      severityScore: src.severityScore != null ? Number(src.severityScore) : (src.priorityScore != null ? Number(src.priorityScore) : 65),
      status: cleanText(src.status, 24) || 'Reported',
      affected: src.affected != null && !isNaN(Number(src.affected)) ? Number(src.affected) : 1,
      location: cleanText(src.location, 100) || (coords ? `${coords.lat}, ${coords.lon}` : 'Location pending'),
      latitude: coords ? coords.lat : null,
      longitude: coords ? coords.lon : null,
      contact: cleanText(src.contact, 60) || 'Not provided',
      description: cleanText(src.description, 160) || 'No additional notes.',
      assignedTeamName: cleanText(teamName, 50),
      timestamp: cleanText(src.timestamp, 40) || new Date().toLocaleString(),
      source: cleanText(src.source, 16) || 'portal'
    };
  }

  function buildIncidentQRPayload(rawIncident, mode) {
    const inc = normalizeIncident(rawIncident);
    const targetMode = mode || 'brief';

    if (targetMode === 'geo') {
      if (inc.latitude != null && inc.longitude != null) {
        const label = encodeURIComponent(`PUYAL ${inc.severity}: ${inc.title}`.slice(0, 60));
        return `geo:${inc.latitude},${inc.longitude}?q=${inc.latitude},${inc.longitude}(${label})`;
      }
      return `PUYAL LOC: ${inc.location} (${inc.title})`;
    }

    if (targetMode === 'json') {
      const payload = {
        app: 'PUYAL',
        id: inc.id,
        title: inc.title,
        cat: inc.category,
        sev: inc.severity,
        score: inc.severityScore,
        status: inc.status,
        affected: inc.affected,
        loc: inc.location,
        lat: inc.latitude,
        lon: inc.longitude,
        contact: inc.contact,
        unit: inc.assignedTeamName || undefined,
        notes: inc.description,
        ts: inc.timestamp
      };
      return JSON.stringify(payload);
    }

    // Default: 'brief' — clean human-readable responder dispatch card
    const lines = [
      'PUYAL INCIDENT REPORT',
      `ID: #${inc.id}`,
      `Title: ${inc.title}`,
      `Cat: ${inc.category} | Sev: ${inc.severity} (${inc.severityScore}/100)`,
      `Status: ${inc.status} | Affected: ${inc.affected}`,
      `Location: ${inc.location}`
    ];
    if (inc.latitude != null && inc.longitude != null) {
      lines.push(`GPS: ${inc.latitude}, ${inc.longitude}`);
    }
    if (inc.assignedTeamName) {
      lines.push(`Unit: ${inc.assignedTeamName}`);
    }
    lines.push(`Contact: ${inc.contact}`);
    lines.push(`Notes: ${inc.description}`);
    lines.push(`Time: ${inc.timestamp}`);
    return lines.join('\n');
  }

  function getCurrentFormIncidentDraft() {
    const titleEl = document.getElementById('title');
    const catEl = document.getElementById('category');
    const sevEl = document.getElementById('severity');
    const locEl = document.getElementById('location');
    const affEl = document.getElementById('affected');
    const descEl = document.getElementById('description');
    const contactEl = document.getElementById('contact');

    let score = 50;
    if (typeof window.updateDynamicSeverityMeter === 'function') {
      try {
        score = window.updateDynamicSeverityMeter();
      } catch (e) {}
    }

    let resolvedSeverity = sevEl ? sevEl.value : 'Auto';
    if (!resolvedSeverity || resolvedSeverity === 'Auto') {
      resolvedSeverity = score >= 81 ? 'Critical' : score >= 56 ? 'High' : score >= 26 ? 'Medium' : 'Low';
    }

    const locInput = locEl ? locEl.value.trim() : '';
    let lat = window._currentCoords && window._currentCoords.latitude ? parseFloat(window._currentCoords.latitude) : null;
    let lon = window._currentCoords && window._currentCoords.longitude ? parseFloat(window._currentCoords.longitude) : null;
    const match = locInput.match(/(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)/);
    if (match) {
      lat = parseFloat(match[1]);
      lon = parseFloat(match[2]);
    }

    return normalizeIncident({
      id: `DRAFT-${Date.now().toString().slice(-6)}`,
      title: (titleEl && titleEl.value.trim()) || 'Current Incident Draft',
      category: (catEl && catEl.value) || 'Other',
      severity: resolvedSeverity,
      severityScore: score,
      status: 'Draft (Ready to Dispatch)',
      affected: affEl && affEl.value !== '' ? parseInt(affEl.value, 10) : 1,
      location: locInput || (lat != null && lon != null ? `${lat}, ${lon} (GPS Auto)` : 'GPS Detecting'),
      latitude: lat,
      longitude: lon,
      contact: (contactEl && contactEl.value.trim()) || 'Not provided',
      description: (descEl && descEl.value.trim()) || 'On-scene responder handoff summary.',
      timestamp: new Date().toLocaleString(),
      source: 'form-draft'
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 12000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(6px);
        transition: background 0.2s ease;
      }
      #${MODAL_ID}.hidden { display: none !important; }
      #${MODAL_ID}.high-contrast { background: #ffffff; }
      .puyal-qr-dialog {
        width: 100%;
        max-width: 580px;
        max-height: 92vh;
        overflow-y: auto;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(2, 6, 23, 0.55);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-dialog {
        background: #ffffff;
        color: #0f172a;
        border: 2px solid #0f172a;
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.22);
      }
      .puyal-qr-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 14px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      }
      .puyal-qr-tag {
        display: inline-block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.14);
        border: 1px solid rgba(56, 189, 248, 0.35);
        padding: 3px 8px;
        border-radius: 6px;
        margin-bottom: 6px;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-tag {
        color: #0369a1;
        background: #e0f2fe;
        border-color: #7dd3fc;
      }
      .puyal-qr-close {
        background: rgba(148, 163, 184, 0.16);
        color: inherit;
        border: none;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        flex-shrink: 0;
      }
      .puyal-qr-close:hover { background: rgba(239, 68, 68, 0.28); }
      .puyal-qr-body { padding: 18px 20px 20px; }
      .puyal-qr-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .puyal-qr-tab {
        flex: 1;
        min-width: 120px;
        padding: 8px 10px;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(30, 41, 59, 0.65);
        color: #cbd5e1;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .puyal-qr-tab.active {
        background: #2563eb;
        border-color: #3b82f6;
        color: #ffffff;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-tab {
        background: #f1f5f9;
        color: #334155;
        border-color: #cbd5e1;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-tab.active {
        background: #0f172a;
        color: #ffffff;
        border-color: #0f172a;
      }
      .puyal-qr-stage {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 18px;
        background: rgba(30, 41, 59, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 14px;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-stage {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .puyal-qr-canvas-frame {
        background: #ffffff;
        padding: 16px;
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        border: 2px solid #e2e8f0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .puyal-qr-canvas-frame canvas {
        display: block;
        width: 248px;
        height: 248px;
        image-rendering: pixelated;
      }
      .puyal-qr-hint {
        font-size: 12px;
        color: #94a3b8;
        text-align: center;
        margin: 0;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-hint { color: #334155; }
      .puyal-qr-meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
        gap: 8px;
        margin-top: 14px;
      }
      .puyal-qr-meta-box {
        background: rgba(30, 41, 59, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-meta-box {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .puyal-qr-meta-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: #94a3b8;
        margin-bottom: 2px;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-meta-label { color: #475569; }
      .puyal-qr-payload {
        margin-top: 12px;
        background: rgba(2, 6, 23, 0.65);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 10px;
        padding: 10px 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        line-height: 1.45;
        color: #e2e8f0;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 135px;
        overflow-y: auto;
      }
      #${MODAL_ID}.high-contrast .puyal-qr-payload {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #94a3b8;
      }
      .puyal-qr-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }
      .puyal-qr-btn {
        flex: 1;
        min-width: 130px;
        padding: 10px 12px;
        border-radius: 10px;
        border: none;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .puyal-qr-btn-primary { background: #2563eb; color: #ffffff; }
      .puyal-qr-btn-success { background: #059669; color: #ffffff; }
      .puyal-qr-btn-neutral {
        background: rgba(148, 163, 184, 0.2);
        color: inherit;
        border: 1px solid rgba(148, 163, 184, 0.35);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    injectStyles();
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'puyal-qr-modal-title');
    modal.innerHTML = `
      <div class="puyal-qr-dialog">
        <div class="puyal-qr-head">
          <div>
            <span class="puyal-qr-tag">PUYAL OFFLINE RESPONDER HANDOFF QR</span>
            <h3 id="puyal-qr-modal-title" style="margin: 0; font-size: 17px; font-weight: 800;">Incident Dispatch QR Code</h3>
            <div id="puyal-qr-modal-sub" style="font-size: 12px; opacity: 0.78; margin-top: 3px;"></div>
          </div>
          <button type="button" class="puyal-qr-close" id="puyal-qr-close-btn" aria-label="Close QR Modal">&times;</button>
        </div>
        <div class="puyal-qr-body">
          <div class="puyal-qr-tabs">
            <button type="button" class="puyal-qr-tab active" data-qr-mode="brief">📋 Responder Brief</button>
            <button type="button" class="puyal-qr-tab" data-qr-mode="json">{ } JSON Telemetry</button>
            <button type="button" class="puyal-qr-tab" data-qr-mode="geo">📍 GPS Geo Pin</button>
          </div>

          <div class="puyal-qr-stage">
            <div class="puyal-qr-canvas-frame">
              <canvas id="puyal-qr-canvas" width="248" height="248"></canvas>
            </div>
            <p class="puyal-qr-hint" id="puyal-qr-scan-hint">
              Point a responder's phone or tablet camera at this screen to scan incident &amp; GPS details (works 100% offline).
            </p>
          </div>

          <div class="puyal-qr-meta-grid" id="puyal-qr-meta-grid"></div>
          <pre class="puyal-qr-payload" id="puyal-qr-payload-preview"></pre>

          <div class="puyal-qr-actions">
            <button type="button" class="puyal-qr-btn puyal-qr-btn-primary" id="puyal-qr-copy-btn">📋 Copy Details</button>
            <button type="button" class="puyal-qr-btn puyal-qr-btn-success" id="puyal-qr-download-btn">💾 Download QR PNG</button>
            <button type="button" class="puyal-qr-btn puyal-qr-btn-neutral" id="puyal-qr-contrast-btn">☀️ Screen Contrast</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeIncidentQRModal();
    });
    document.getElementById('puyal-qr-close-btn').addEventListener('click', closeIncidentQRModal);

    modal.querySelectorAll('[data-qr-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMode = btn.getAttribute('data-qr-mode') || 'brief';
        modal.querySelectorAll('[data-qr-mode]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        renderActiveQR();
      });
    });

    document.getElementById('puyal-qr-copy-btn').addEventListener('click', async () => {
      if (!activeIncident) return;
      const text = buildIncidentQRPayload(activeIncident, activeMode);
      const copyBtn = document.getElementById('puyal-qr-copy-btn');
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (err) {}
      if (!copied) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (err2) {}
      }
      copyBtn.textContent = copied ? '✅ Copied Payload!' : '⚠️ Select Text Above';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy Details';
      }, 2200);
    });

    document.getElementById('puyal-qr-download-btn').addEventListener('click', async () => {
      if (!activeIncident || !window.QRCode) return;
      const payload = buildIncidentQRPayload(activeIncident, activeMode);
      try {
        const dataUrl = await window.QRCode.toDataURL(payload, {
          width: 560,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' }
        });
        const a = document.createElement('a');
        const safeId = String(activeIncident.id || 'incident').replace(/[^a-zA-Z0-9_-]/g, '');
        a.href = dataUrl;
        a.download = `puyal-incident-${safeId}-${activeMode}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {
        if (typeof window.showToast === 'function') {
          window.showToast('Unable to export QR PNG: ' + e.message, 'error');
        }
      }
    });

    document.getElementById('puyal-qr-contrast-btn').addEventListener('click', () => {
      highContrastMode = !highContrastMode;
      modal.classList.toggle('high-contrast', highContrastMode);
      const btn = document.getElementById('puyal-qr-contrast-btn');
      btn.textContent = highContrastMode ? '🌙 Dark Tactical' : '☀️ Screen Contrast';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeIncidentQRModal();
      }
    });

    return modal;
  }

  function renderActiveQR() {
    if (!activeIncident) return;
    const inc = activeIncident;
    const payload = buildIncidentQRPayload(inc, activeMode);

    const titleEl = document.getElementById('puyal-qr-modal-title');
    const subEl = document.getElementById('puyal-qr-modal-sub');
    const previewEl = document.getElementById('puyal-qr-payload-preview');
    const metaEl = document.getElementById('puyal-qr-meta-grid');
    const hintEl = document.getElementById('puyal-qr-scan-hint');
    const canvas = document.getElementById('puyal-qr-canvas');

    if (titleEl) titleEl.textContent = inc.title;
    if (subEl) subEl.textContent = `Incident #${inc.id} • ${inc.category} • ${inc.status}`;
    if (previewEl) previewEl.textContent = payload;

    if (hintEl) {
      hintEl.textContent =
        activeMode === 'geo'
          ? 'Scan to open incident GPS pin directly in mobile navigation & offline maps.'
          : activeMode === 'json'
            ? 'Scan with responder triage tablet or dispatch scanner to import structured JSON.'
            : "Point a responder's phone or tablet camera here to scan full dispatch brief (works offline).";
    }

    if (metaEl) {
      metaEl.innerHTML = `
        <div class="puyal-qr-meta-box">
          <div class="puyal-qr-meta-label">Severity</div>
          <div style="font-weight: 800;">${escapeHtml(inc.severity)} (${escapeHtml(inc.severityScore)}/100)</div>
        </div>
        <div class="puyal-qr-meta-box">
          <div class="puyal-qr-meta-label">GPS / Location</div>
          <div style="font-weight: 700;">${inc.latitude != null ? `${inc.latitude}, ${inc.longitude}` : escapeHtml(inc.location)}</div>
        </div>
        <div class="puyal-qr-meta-box">
          <div class="puyal-qr-meta-label">People Affected</div>
          <div style="font-weight: 800;">👥 ${escapeHtml(inc.affected)}</div>
        </div>
        <div class="puyal-qr-meta-box">
          <div class="puyal-qr-meta-label">${inc.assignedTeamName ? 'Assigned Unit' : 'Contact'}</div>
          <div style="font-weight: 700;">${escapeHtml(inc.assignedTeamName || inc.contact)}</div>
        </div>
      `;
    }

    if (canvas && window.QRCode && typeof window.QRCode.toCanvas === 'function') {
      window.QRCode.toCanvas(
        canvas,
        payload,
        {
          width: 248,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' }
        },
        (err) => {
          if (err && previewEl) {
            previewEl.textContent = 'QR render fallback: ' + err.message + '\n\n' + payload;
          }
        }
      );
    }
  }

  function showIncidentQRModal(incidentData, options) {
    const modal = ensureModal();
    activeIncident = normalizeIncident(incidentData || getCurrentFormIncidentDraft());
    activeMode = (options && options.mode) || 'brief';

    modal.querySelectorAll('[data-qr-mode]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-qr-mode') === activeMode);
    });

    modal.classList.remove('hidden');
    renderActiveQR();
  }

  function closeIncidentQRModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.add('hidden');
  }

  window.getCurrentFormIncidentDraft = getCurrentFormIncidentDraft;
  window.buildIncidentQRPayload = buildIncidentQRPayload;
  window.showIncidentQRModal = showIncidentQRModal;
  window.closeIncidentQRModal = closeIncidentQRModal;
})();
