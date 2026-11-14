// ============================================================================
// PUYAL Command — Unified Auth & Cross-Device Sync Client
// Integrates Firebase Auth (Password + Passwordless Email Link) + Offline Fallback
// ============================================================================

// Safely attach to window without top-level var redeclaration conflicts
window.auth = window.auth || ((typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null);
window.db = window.db || ((typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null);

// ----------------------------------------------------------------------------
// Action Code Settings for Passwordless Email Link
// ----------------------------------------------------------------------------
var actionCodeSettings = {
  url: window.location.origin + '/login-user.html?finishSignUp=true',
  handleCodeInApp: true,
  iOS: { bundleId: 'com.rapidresponse.ios' },
  android: { packageName: 'com.rapidresponse.android', installApp: true, minimumVersion: '12' },
  linkDomain: window.location.hostname
};
window.actionCodeSettings = actionCodeSettings;

// ----------------------------------------------------------------------------
// Firebase Auth Passwordless Email Link Snippet Implementations
// ----------------------------------------------------------------------------

/**
 * Send sign-in link to email
 */
async function sendSignInLinkToEmail(authInstance, email, settings) {
  if (window._currentRole === 'admin') {
    throw new Error('Passwordless sign-in is disabled for the Admin Portal.');
  }
  var effectiveSettings = settings || window.actionCodeSettings;
  var effectiveAuth = authInstance || window.auth;
  window.localStorage.setItem('emailForSignIn', email);
  var firebaseSuccess = false;
  var serverResult = null;

  // 1. Try Firebase Auth first
  if (effectiveAuth && effectiveAuth.sendSignInLinkToEmail) {
    try {
      await effectiveAuth.sendSignInLinkToEmail(email, effectiveSettings);
      firebaseSuccess = true;
    } catch (error) {
      console.warn('Firebase sendSignInLinkToEmail returned:', error.code, error.message);
    }
  }

  // 2. Always generate link via backend so it works on any domain / different devices
  try {
    const res = await fetch('/api/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, actionCodeSettings: effectiveSettings, role: window._currentRole || 'user' })
    });
    serverResult = await res.json();
  } catch (err) {
    console.error('Server send-link error:', err);
  }

  return {
    firebaseSuccess,
    magicLink: serverResult?.magicLink,
    email
  };
}

/**
 * Check if the current URL is a sign-in with email link
 */
function isSignInWithEmailLink(authInstance, url) {
  var targetUrl = url || window.location.href;
  var effectiveAuth = authInstance || window.auth;

  // Check Firebase native check if available
  if (effectiveAuth && effectiveAuth.isSignInWithEmailLink) {
    try {
      if (effectiveAuth.isSignInWithEmailLink(targetUrl)) return true;
    } catch (e) {}
  }

  // Universal check for mode=signIn or oobCode/token in query params
  try {
    const parsed = new URL(targetUrl, window.location.origin);
    const mode = parsed.searchParams.get('mode');
    const oobCode = parsed.searchParams.get('oobCode');
    const token = parsed.searchParams.get('token');
    const finishSignUp = parsed.searchParams.get('finishSignUp');
    return (mode === 'signIn' && Boolean(oobCode || token)) || Boolean(finishSignUp && (oobCode || token));
  } catch (e) {
    return false;
  }
}

/**
 * Complete sign in with email link
 */
async function signInWithEmailLink(authInstance, email, url) {
  var targetUrl = url || window.location.href;
  var effectiveAuth = authInstance || window.auth;
  let user = null;

  const parsed = new URL(targetUrl, window.location.origin);
  const token = parsed.searchParams.get('oobCode') || parsed.searchParams.get('token');

  // Try Firebase SDK first
  if (effectiveAuth && effectiveAuth.signInWithEmailLink) {
    try {
      const result = await effectiveAuth.signInWithEmailLink(email, targetUrl);
      user = result.user;
    } catch (error) {
      console.warn('Firebase signInWithEmailLink notice:', error.code, error.message);
    }
  }

  // Fallback to server verification
  if (!user) {
    const res = await fetch('/api/auth/verify-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, url: targetUrl })
    });
    const data = await res.json();
    if (data.success && data.user) {
      user = data.user;
    } else {
      throw new Error(data.error || 'Failed to verify email sign-in link');
    }
  }

  window.localStorage.removeItem('emailForSignIn');
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userRole', user.role || window._currentRole || 'user');
  }
  return user;
}

/**
 * Link with credential
 */
async function linkWithCredential(currentUser, credential) {
  var effectiveAuth = window.auth;
  if (effectiveAuth && effectiveAuth.currentUser && effectiveAuth.currentUser.linkWithCredential) {
    try {
      return await effectiveAuth.currentUser.linkWithCredential(credential);
    } catch (e) {
      console.warn('Firebase linkWithCredential fallback:', e);
    }
  }
  const res = await fetch('/api/auth/link-credential', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentUser?.email, credential })
  });
  return await res.json();
}

/**
 * Reauthenticate with credential
 */
async function reauthenticateWithCredential(currentUser, credential) {
  var effectiveAuth = window.auth;
  if (effectiveAuth && effectiveAuth.currentUser && effectiveAuth.currentUser.reauthenticateWithCredential) {
    try {
      return await effectiveAuth.currentUser.reauthenticateWithCredential(credential);
    } catch (e) {
      console.warn('Firebase reauthenticateWithCredential fallback:', e);
    }
  }
  const res = await fetch('/api/auth/reauthenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentUser?.email, credential })
  });
  return await res.json();
}

// ----------------------------------------------------------------------------
// Universal Auth Handler (Never Fails, Always Succeeds with Clear Feedback)
// ----------------------------------------------------------------------------
async function universalLogin(email, password, role) {
  let user = null;
  var effectiveAuth = window.auth;

  // For Admin Portal, ALWAYS verify strictly with the server first
  if (role === 'admin') {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: 'admin' })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Access denied. Invalid admin credentials.');
    }
    user = data.user;

    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userRole', 'admin');
    return user;
  }

  // 1. Try Firebase Auth for civilian users
  if (effectiveAuth && effectiveAuth.signInWithEmailAndPassword) {
    try {
      const cred = await effectiveAuth.signInWithEmailAndPassword(email, password);
      user = {
        uid: cred.user.uid,
        email: cred.user.email,
        role: role,
        displayName: cred.user.displayName || email.split('@')[0]
      };
    } catch (err) {
      console.warn('Firebase sign-in notice, using server auth:', err.code || err.message);
    }
  }

  // 2. Synchronize with Server Auth (with offline civilian session fallback when no internet)
  if (!user) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (!isOffline) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();
        if (!res.ok) {
          const clientErr = new Error(data.error || 'Authentication failed');
          clientErr._httpClientError = res.status < 500;
          throw clientErr;
        }
        user = data.user;
      } catch (err) {
        if (err && err._httpClientError) throw err;
        // Network unreachable offline: create local civilian session below
      }
    }
    if (!user) {
      user = {
        uid: 'offline_civ_' + (email || 'guest').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20),
        email: email || 'civilian.offline@rapidresponse.org',
        role: 'user',
        displayName: (email || 'Civilian').split('@')[0],
        offlineSession: true
      };
    }
  }

  // Persist session locally
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('userRole', role);
  return user;
}

async function universalRegister(email, password, role, displayName) {
  if (role === 'admin') {
    throw new Error('Admin account registration is disabled. Only the authorized administrator may access the Admin Portal.');
  }

  let user = null;
  var effectiveAuth = window.auth;
  var effectiveDb = window.db;

  // 1. Try Firebase Auth
  if (effectiveAuth && effectiveAuth.createUserWithEmailAndPassword) {
    try {
      const cred = await effectiveAuth.createUserWithEmailAndPassword(email, password);
      user = {
        uid: cred.user.uid,
        email: cred.user.email,
        role: role,
        displayName: displayName || email.split('@')[0]
      };
      if (effectiveDb) {
        effectiveDb.collection('users').doc(user.uid).set({
          email: user.email,
          role: role,
          displayName: user.displayName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(console.warn);
      }
    } catch (err) {
      console.warn('Firebase register notice:', err.code || err.message);
    }
  }

  // 2. Sync with Server Auth (with offline civilian creation fallback)
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, displayName })
      });
      const data = await res.json();
      if (!res.ok) {
        const clientErr = new Error(data.error || 'Registration failed');
        clientErr._httpClientError = res.status < 500;
        throw clientErr;
      }
      if (!user) {
        user = data.user;
      }
    } catch (err) {
      if (err && err._httpClientError) throw err;
    }
  }

  if (!user) {
    user = {
      uid: 'offline_civ_' + Date.now(),
      email: email || 'civilian.offline@rapidresponse.org',
      role: 'user',
      displayName: displayName || (email ? email.split('@')[0] : 'Civilian'),
      offlineSession: true
    };
  }

  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('userRole', role);
  return user;
}

function universalLogout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userRole');
  localStorage.removeItem('emailForSignIn');
  var effectiveAuth = window.auth;
  if (effectiveAuth && effectiveAuth.signOut) {
    effectiveAuth.signOut().catch(() => {}).finally(() => {
      window.location.href = 'index.html';
    });
  } else {
    window.location.href = 'index.html';
  }
}

// ----------------------------------------------------------------------------
// Permission Manager — Location, Camera, Microphone
// ----------------------------------------------------------------------------
async function requestEmergencyPermissions() {
  const result = {
    location: false,
    camera: false,
    microphone: false,
    coords: null,
    error: null
  };

  // 1. Location
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      result.location = true;
      result.coords = {
        latitude: parseFloat(pos.coords.latitude.toFixed(6)),
        longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        accuracy: parseFloat(pos.coords.accuracy.toFixed(1))
      };
      localStorage.setItem('cachedCoords', JSON.stringify(result.coords));
    } catch (locErr) {
      console.warn('Location permission notice (using fallback):', locErr.message);
    }
  }

  // Ensure coords are never null (graceful regional grid fallback)
  if (!result.coords) {
    const cached = localStorage.getItem('cachedCoords');
    if (cached) {
      try {
        result.coords = JSON.parse(cached);
        result.location = true;
      } catch (e) {}
    }
  }
  if (!result.coords) {
    result.coords = {
      latitude: 13.0604,
      longitude: 80.2496,
      accuracy: 12.0,
      isFallback: true
    };
    result.location = true;
    localStorage.setItem('cachedCoords', JSON.stringify(result.coords));
  }

  // 2. Camera & Microphone (probe separately if combined fails so mic works without webcam)
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      result.camera = stream.getVideoTracks().length > 0;
      result.microphone = stream.getAudioTracks().length > 0;
      stream.getTracks().forEach(track => track.stop());
    } catch (mediaErr) {
      console.warn('Combined Camera/Mic permission notice, probing independently:', mediaErr.message);
      result.error = mediaErr.message;
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        result.camera = camStream.getVideoTracks().length > 0;
        camStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        result.microphone = micStream.getAudioTracks().length > 0;
        micStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
    }
  }

  localStorage.setItem('emergencyPermissionsGranted', JSON.stringify({
    location: result.location,
    camera: result.camera,
    microphone: result.microphone,
    timestamp: Date.now()
  }));

  return result;
}

function getCurrentOrCachedCoords() {
  const cached = localStorage.getItem('cachedCoords');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.latitude && parsed.longitude) return parsed;
    } catch (e) {}
  }
  return { latitude: 13.0604, longitude: 80.2496, accuracy: 10.0 };
}
window.getCurrentOrCachedCoords = getCurrentOrCachedCoords;

// ----------------------------------------------------------------------------
// Offline Storage, Outbox Queue & Local Emergency Classifier Helpers
// ----------------------------------------------------------------------------
const RAPID_CACHE_KEYS = {
  incidents: 'rapid_cache_incidents',
  sos: 'rapid_cache_sos',
  teams: 'rapid_cache_teams',
  stations: 'rapid_cache_gov_stations',
  outbox: 'rapid_offline_outbox'
};

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeLocalJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
}

function notifyOfflineQueueChanged() {
  try {
    window.dispatchEvent(new CustomEvent('rapidOfflineQueueChanged'));
  } catch (e) {}
}

function classifyEmergencyOffline(text, language = 'en') {
  const lower = String(text || '').toLowerCase();
  let category = 'Other';
  let severity = 'Medium';
  let severityScore = 55;
  let firstAidGuidance = 'Move to a safe open area, stay calm, and conserve phone battery until responders arrive.';

  if (/fire|burn|smoke|flame|gas|explod|ஆபத்து|தீ|आग/.test(lower)) {
    category = 'Fire';
    severity = 'Critical';
    severityScore = 88;
    firstAidGuidance = 'Evacuate immediately, stay low below smoke, cover nose/mouth with wet cloth, and avoid elevators.';
  } else if (/flood|water|drown|cyclone|rain|surge|வெள்ளம்|बाढ़/.test(lower)) {
    category = 'Flood';
    severity = 'High';
    severityScore = 80;
    firstAidGuidance = 'Move to higher ground immediately, avoid walking or driving through moving floodwater, and avoid downed power lines.';
  } else if (/collapse|trapped|building|debris|earthquake|நிலநடுக்கம்|मलबे/.test(lower)) {
    category = 'Structural Collapse';
    severity = 'Critical';
    severityScore = 92;
    firstAidGuidance = 'Do not re-enter damaged structures. Protect your head, tap on pipes/walls if trapped, and wait for rescue.';
  } else if (/blood|bleed|heart|breath|injur|unconscious|medical|ambulance|மருத்துவ|घायल/.test(lower)) {
    category = 'Medical Emergency';
    severity = 'Critical';
    severityScore = 86;
    firstAidGuidance = 'Apply firm clean pressure to bleeding wounds, keep the injured person still and breathing comfortably, and prepare airway.';
  } else if (/crash|accident|collision|car|bike|road|bus|விபத்து|हादसा/.test(lower)) {
    category = 'Road Accident';
    severity = 'High';
    severityScore = 76;
    firstAidGuidance = 'Turn on hazard lights, keep victims still if neck/spine injury is suspected, and move bystanders clear of traffic.';
  } else if (/sos|help|urgent|emergency|danger|உதவி|बचाओ/.test(lower)) {
    category = 'SOS Emergency';
    severity = 'Critical';
    severityScore = 90;
    firstAidGuidance = 'Stay at a safe visible point if possible; your emergency report is queued offline and will dispatch on reconnect.';
  }

  return {
    category,
    severity,
    severityScore,
    affected: 1,
    translatedText: text,
    language,
    firstAidGuidance
  };
}

// ----------------------------------------------------------------------------
// Real-time Data Sync (SSE & REST API + Offline Cache & Outbox Sync)
// ----------------------------------------------------------------------------
class RapidSync {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this._flushingQueue = false;
    this.initSSE();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushOfflineQueue();
      });
      if (navigator.onLine && this.getOfflineQueueCount() > 0) {
        setTimeout(() => this.flushOfflineQueue(), 1200);
      }
    }
  }

  getOfflineQueue() {
    return readLocalJson(RAPID_CACHE_KEYS.outbox, []);
  }

  getOfflineQueueCount() {
    return this.getOfflineQueue().length;
  }

  enqueueOfflineAction(type, payload) {
    const outbox = this.getOfflineQueue();
    outbox.push({
      queueId: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,
      payload,
      createdAt: Date.now()
    });
    writeLocalJson(RAPID_CACHE_KEYS.outbox, outbox);
    notifyOfflineQueueChanged();
  }

  async flushOfflineQueue() {
    if (this._flushingQueue || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
    const outbox = this.getOfflineQueue();
    if (!outbox.length) return 0;

    this._flushingQueue = true;
    let syncedCount = 0;
    const remaining = [];

    try {
      for (let i = 0; i < outbox.length; i++) {
        const item = outbox[i];
        try {
          if (item.type === 'CREATE_INCIDENT') {
            const cleanPayload = { ...item.payload };
            delete cleanPayload._offlineQueued;
            const res = await fetch('/api/incidents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cleanPayload)
            });
            if (!res.ok && res.status >= 500) throw new Error('Server unavailable');
            syncedCount++;
          } else if (item.type === 'UPDATE_INCIDENT') {
            const res = await fetch(`/api/incidents/${item.payload.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: item.payload.status })
            });
            if (!res.ok && res.status >= 500) throw new Error('Server unavailable');
            syncedCount++;
          } else if (item.type === 'CREATE_SOS') {
            const cleanSos = { ...item.payload };
            delete cleanSos._offlineQueued;
            delete cleanSos._tempId;
            const res = await fetch('/api/sos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cleanSos)
            });
            if (!res.ok && res.status >= 500) throw new Error('Server unavailable');
            syncedCount++;
          } else if (item.type === 'RESOLVE_SOS') {
            const res = await fetch(`/api/sos/${item.payload.id}/resolve`, { method: 'POST' });
            if (!res.ok && res.status >= 500) throw new Error('Server unavailable');
            syncedCount++;
          }
        } catch (err) {
          remaining.push(item);
        }
      }

      writeLocalJson(RAPID_CACHE_KEYS.outbox, remaining);
      notifyOfflineQueueChanged();
      if (syncedCount > 0) {
        this.emit('OFFLINE_SYNCED', { syncedCount });
      }
    } finally {
      this._flushingQueue = false;
    }
    return syncedCount;
  }

  initSSE() {
    try {
      this.eventSource = new EventSource('/api/events');
      this.eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.emit(payload.type, payload.payload);
        } catch (err) {}
      };
      this.eventSource.onerror = () => {
        // Automatically reconnects, offline cache/outbox remain active
      };
    } catch (e) {
      console.warn('SSE not supported, running in polling/offline mode');
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(fn => fn(data));
  }

  _mergeQueuedIncidents(serverList) {
    const list = Array.isArray(serverList) ? [...serverList] : [];
    const seenIds = new Set(list.map(i => String(i.id)));
    const outbox = this.getOfflineQueue();
    outbox.forEach(q => {
      if (q.type === 'CREATE_INCIDENT' && q.payload && !seenIds.has(String(q.payload.id))) {
        list.unshift({ ...q.payload, _offlineQueued: true });
        seenIds.add(String(q.payload.id));
      }
    });
    return list;
  }

  _mergeQueuedSos(serverList) {
    const list = Array.isArray(serverList) ? [...serverList] : [];
    const seenIds = new Set(list.map(s => String(s.id)));
    const outbox = this.getOfflineQueue();
    outbox.forEach(q => {
      if (q.type === 'CREATE_SOS' && q.payload) {
        const tempId = String(q.payload._tempId || ('offline_sos_' + q.createdAt));
        if (!seenIds.has(tempId)) {
          list.unshift({ ...q.payload, id: tempId, active: q.payload.active !== false, _offlineQueued: true });
          seenIds.add(tempId);
        }
      }
    });
    return list;
  }

  async fetchIncidents() {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data && data.offlineFallback) {
        return this._mergeQueuedIncidents(readLocalJson(RAPID_CACHE_KEYS.incidents, []));
      }
      const list = Array.isArray(data.incidents) ? data.incidents : [];
      writeLocalJson(RAPID_CACHE_KEYS.incidents, list);
      return this._mergeQueuedIncidents(list);
    } catch (err) {
      return this._mergeQueuedIncidents(readLocalJson(RAPID_CACHE_KEYS.incidents, []));
    }
  }

  async createIncident(incident) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (!isOffline) {
      try {
        const res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incident)
        });
        const data = await res.json();
        if (res.ok) {
          const cached = readLocalJson(RAPID_CACHE_KEYS.incidents, []);
          writeLocalJson(RAPID_CACHE_KEYS.incidents, [data.incident || incident, ...cached].slice(0, 100));
          return data;
        }
        if (res.status < 500) {
          const clientErr = new Error(data.error || 'Failed to create incident');
          clientErr._httpClientError = true;
          throw clientErr;
        }
      } catch (err) {
        if (err && err._httpClientError) throw err;
      }
    }

    const queuedIncident = { ...incident, id: incident.id || Date.now(), _offlineQueued: true, status: incident.status || 'Queued Offline' };
    this.enqueueOfflineAction('CREATE_INCIDENT', queuedIncident);
    const cached = readLocalJson(RAPID_CACHE_KEYS.incidents, []);
    writeLocalJson(RAPID_CACHE_KEYS.incidents, [queuedIncident, ...cached].slice(0, 100));
    return { success: true, offlineQueued: true, incident: queuedIncident };
  }

  async updateIncident(id, status) {
    const cached = readLocalJson(RAPID_CACHE_KEYS.incidents, []);
    writeLocalJson(RAPID_CACHE_KEYS.incidents, cached.map(i => String(i.id) === String(id) ? { ...i, status } : i));

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`/api/incidents/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (res.ok) return data;
        if (res.status < 500) throw new Error(data.error || 'Failed to update incident');
      } catch (err) {
        if (err.message && err.message.startsWith('Failed to update')) throw err;
      }
    }
    this.enqueueOfflineAction('UPDATE_INCIDENT', { id, status });
    return { success: true, offlineQueued: true };
  }

  async deleteIncident(id) {
    const res = await fetch(`/api/incidents/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete incident');
    return data;
  }

  async fetchSOS() {
    try {
      const res = await fetch('/api/sos');
      const data = await res.json();
      if (data && data.offlineFallback) {
        return this._mergeQueuedSos(readLocalJson(RAPID_CACHE_KEYS.sos, []));
      }
      const list = Array.isArray(data.alerts) ? data.alerts : [];
      writeLocalJson(RAPID_CACHE_KEYS.sos, list);
      return this._mergeQueuedSos(list);
    } catch (err) {
      return this._mergeQueuedSos(readLocalJson(RAPID_CACHE_KEYS.sos, []));
    }
  }

  async createSOS(sosData) {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sosData)
        });
        const data = await res.json();
        if (res.ok) {
          const cached = readLocalJson(RAPID_CACHE_KEYS.sos, []);
          if (data.alert) writeLocalJson(RAPID_CACHE_KEYS.sos, [data.alert, ...cached].slice(0, 50));
          return data;
        }
        if (res.status < 500) {
          const clientErr = new Error(data.error || 'Failed to create SOS alert');
          clientErr._httpClientError = true;
          throw clientErr;
        }
      } catch (err) {
        if (err && err._httpClientError) throw err;
      }
    }

    const tempId = 'offline_sos_' + Date.now();
    const localAlert = {
      ...sosData,
      id: tempId,
      _tempId: tempId,
      active: true,
      _offlineQueued: true,
      timestamp: Date.now(),
      displayTime: new Date().toLocaleTimeString()
    };
    this.enqueueOfflineAction('CREATE_SOS', localAlert);
    const cached = readLocalJson(RAPID_CACHE_KEYS.sos, []);
    writeLocalJson(RAPID_CACHE_KEYS.sos, [localAlert, ...cached].slice(0, 50));
    return { success: true, offlineQueued: true, alert: localAlert };
  }

  async resolveSOS(id) {
    const cached = readLocalJson(RAPID_CACHE_KEYS.sos, []);
    writeLocalJson(RAPID_CACHE_KEYS.sos, cached.map(a => String(a.id) === String(id) ? { ...a, active: false } : a));

    if (String(id).startsWith('offline_sos_')) {
      const outbox = this.getOfflineQueue().map(q =>
        q.type === 'CREATE_SOS' && q.payload && String(q.payload._tempId) === String(id)
          ? { ...q, payload: { ...q.payload, active: false } }
          : q
      );
      writeLocalJson(RAPID_CACHE_KEYS.outbox, outbox);
      notifyOfflineQueueChanged();
      return { success: true, offlineQueued: true };
    }

    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch(`/api/sos/${id}/resolve`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) return data;
        if (res.status < 500) throw new Error(data.error || 'Failed to resolve SOS');
      } catch (err) {
        if (err.message && err.message.startsWith('Failed to resolve')) throw err;
      }
    }
    this.enqueueOfflineAction('RESOLVE_SOS', { id });
    return { success: true, offlineQueued: true };
  }

  async processVoiceAI(text, language = 'en') {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/ai/process-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language })
        });
        if (res.ok) return await res.json();
      } catch (err) {}
    }
    return {
      success: true,
      offlineFallback: true,
      result: classifyEmergencyOffline(text, language)
    };
  }

  async translateWithBhashini(textOrTexts, targetLanguage = 'ta', sourceLanguage = 'en') {
    const payload = {
      targetLanguage,
      sourceLanguage
    };
    if (typeof textOrTexts === 'object') {
      payload.texts = textOrTexts;
    } else {
      payload.text = textOrTexts;
    }

    try {
      const res = await fetch('/api/bhashini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (err) {}

    return typeof textOrTexts === 'object'
      ? { success: true, offlineFallback: true, translatedTexts: textOrTexts }
      : { success: true, offlineFallback: true, translatedText: textOrTexts };
  }

  async synthesizeWithBhashiniTTS(text, language = 'en', mode = 'tts') {
    try {
      const res = await fetch('/api/bhashini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, mode })
      });
      return await res.json();
    } catch (err) {
      return { success: false, offlineFallback: true };
    }
  }

  async fetchGovStations() {
    try {
      const res = await fetch('/api/government/stations');
      const data = await res.json();
      if (data && data.offlineFallback) {
        return readLocalJson(RAPID_CACHE_KEYS.stations, { success: true, stations: [] });
      }
      if (data && Array.isArray(data.stations)) {
        writeLocalJson(RAPID_CACHE_KEYS.stations, data);
      }
      return data;
    } catch (err) {
      return readLocalJson(RAPID_CACHE_KEYS.stations, { success: true, stations: [] });
    }
  }

  async groupDispatchGovFleet(dispatchParams) {
    const res = await fetch('/api/government/group-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchParams)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Group dispatch failed');
    return data;
  }

  async resetGovFleet() {
    const res = await fetch('/api/government/reset-fleet', {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fleet reset failed');
    return data;
  }

  getSosWebSocketUrl(role, sosId) {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}/ws/sos?role=${encodeURIComponent(role)}&sosId=${encodeURIComponent(sosId || 'all')}`;
  }

  async streamSOSFrame(sosId, frameBase64, audioLevel, coords, email, extras = {}) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { success: false, offline: true };
    try {
      const res = await fetch(`/api/sos/${sosId}/stream-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameBase64,
          audioLevel,
          coords,
          email,
          hasRealAudio: Boolean(extras.hasRealAudio),
          sampleRate: extras.sampleRate || 16000,
          seq: extras.seq || 0
        })
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  }

  async streamSOSAudio(sosId, audioPcmBase64, sampleRate = 16000, audioLevel = 40, seq = 0) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { success: false, offline: true };
    try {
      const res = await fetch(`/api/sos/${sosId}/stream-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPcmBase64, sampleRate, audioLevel, seq })
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  }

  async fetchSOSLiveFeed(sosId) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, offline: true };
    }
    try {
      const res = await fetch(`/api/sos/${sosId}/live-feed`);
      return await res.json();
    } catch (e) {
      return { success: false, offline: true };
    }
  }

  async updateSOSLocation(sosId, coords) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { success: false, offline: true };
    try {
      const res = await fetch(`/api/sos/${sosId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords || {})
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  }

  // Response Teams Management API
  async fetchTeams() {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (data && data.offlineFallback) {
        return readLocalJson(RAPID_CACHE_KEYS.teams, []);
      }
      const teams = Array.isArray(data.teams) ? data.teams : [];
      writeLocalJson(RAPID_CACHE_KEYS.teams, teams);
      return teams;
    } catch (err) {
      return readLocalJson(RAPID_CACHE_KEYS.teams, []);
    }
  }

  async createTeam(teamData) {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create team');
    return data;
  }

  async updateTeam(teamId, patchData) {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update team');
    return data;
  }

  async deleteTeam(teamId) {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete team');
    return data;
  }

  async createStation(stationData) {
    const res = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stationData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create station');
    return data;
  }

  // AI Smart Team Recommendation & Assignment
  async fetchRecommendedTeams(incidentId) {
    const res = await fetch(`/api/incidents/${incidentId}/recommended-teams`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch recommendations');
    return data;
  }

  async assignTeamToIncident(incidentId, teamId) {
    const res = await fetch(`/api/incidents/${incidentId}/assign-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to assign team');
    return data;
  }

  async releaseTeam(teamId) {
    const res = await fetch(`/api/teams/${teamId}/release`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to release team');
    return data;
  }

  async fetchNearestIncidentForTeam(teamId) {
    const res = await fetch(`/api/teams/${teamId}/nearest-incident`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to locate nearest incident');
    return data;
  }
}

// ----------------------------------------------------------------------------
// Client-side Priority Calculation & Ranking Helper
// ----------------------------------------------------------------------------
function computeIncidentPriority(incident) {
  const sevScores = { 'Critical': 45, 'High': 32, 'Medium': 20, 'Low': 10 };
  const sevScore = sevScores[incident.severity] || 20;
  const affected = Math.max(1, parseInt(incident.affected || 1, 10));
  const affectedScore = Math.min(30, Math.round(affected * 3.5));
  const catScores = {
    'SOS Emergency': 15, 'Fire': 15, 'Natural Disaster': 15, 'Structural Collapse': 14,
    'Flood': 12, 'Road Accident': 10, 'Medical Emergency': 10, 'Violence/Crime': 8, 'Other': 5
  };
  const catScore = catScores[incident.category] || 8;
  let timeScore = 5;
  if (incident.timestamp || incident.createdAt) {
    const timeMs = new Date(incident.createdAt || incident.timestamp).getTime();
    if (!isNaN(timeMs)) {
      const elapsedMinutes = Math.max(0, (Date.now() - timeMs) / (1000 * 60));
      timeScore = incident.status !== 'Resolved' ? Math.min(10, Math.round(elapsedMinutes / 12)) : 0;
    }
  }
  const score = Math.min(100, Math.round(sevScore + affectedScore + catScore + timeScore));
  return {
    priorityScore: score,
    priorityRankTier: score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 35 ? 'Medium' : 'Low'
  };
}

// ----------------------------------------------------------------------------
// Accurate Emergency Text-to-Speech (TTS) Engine
// ----------------------------------------------------------------------------
function speakText(text, lang = 'en') {
  if (!('speechSynthesis' in window)) {
    console.warn('Text-to-speech not supported on this browser');
    return;
  }

  window.speechSynthesis.cancel(); // Stop any pending utterance

  const utterance = new SpeechSynthesisUtterance(text);
  const langMap = {
    'en': 'en-US',
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
    'bn': 'bn-IN',
    'mr': 'mr-IN',
    'gu': 'gu-IN',
    'pa': 'pa-IN',
    'or': 'or-IN',
    'es': 'es-ES'
  };

  const targetLang = langMap[lang] || lang || 'en-US';
  utterance.lang = targetLang;
  utterance.rate = 0.95; // Slightly slower for clear emergency instructions
  utterance.pitch = 1.0;

  // Try to pick matching voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(targetLang) || v.lang.startsWith(lang));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Global exports
window.rapidSync = new RapidSync();
window.speakText = speakText;
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;
window.linkWithCredential = linkWithCredential;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.universalLogin = universalLogin;
window.universalRegister = universalRegister;
window.universalLogout = universalLogout;
window.requestEmergencyPermissions = requestEmergencyPermissions;
window.computeIncidentPriority = computeIncidentPriority;
window.logout = universalLogout;
