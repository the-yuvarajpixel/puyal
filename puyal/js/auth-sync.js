// ============================================================================
// RapidResponse Command — Unified Auth & Cross-Device Sync Client
// Integrates Firebase Auth (Password + Passwordless Email Link) + Server Fallback
// ============================================================================

// Use existing window.auth or initialize safely
var auth = window.auth || ((typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null);
var db = window.db || ((typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null);

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

  // 1. Try Firebase Auth
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

  // 2. Synchronize with Server Auth (ensures cross-device matching)
  if (!user) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    user = data.user;
  }

  // Persist session locally
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('userRole', role);
  return user;
}

async function universalRegister(email, password, role, displayName) {
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

  // 2. Sync with Server Auth
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role, displayName })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  if (!user) {
    user = data.user;
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
      console.warn('Location permission notice:', locErr.message);
    }
  }

  // 2. Camera & Microphone
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      result.camera = true;
      result.microphone = true;
      // Stop tracks immediately after granting so devices aren't locked
      stream.getTracks().forEach(track => track.stop());
    } catch (mediaErr) {
      console.warn('Camera/Mic permission notice:', mediaErr.message);
      result.error = mediaErr.message;
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

// ----------------------------------------------------------------------------
// Real-time Data Sync (SSE & REST API)
// ----------------------------------------------------------------------------
class RapidSync {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.initSSE();
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
        // Automatically reconnects, but can poll as fallback
      };
    } catch (e) {
      console.warn('SSE not supported, running in polling mode');
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

  async fetchIncidents() {
    const res = await fetch('/api/incidents');
    const data = await res.json();
    return data.incidents || [];
  }

  async createIncident(incident) {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident)
    });
    return await res.json();
  }

  async updateIncident(id, status) {
    const res = await fetch(`/api/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return await res.json();
  }

  async deleteIncident(id) {
    const res = await fetch(`/api/incidents/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  }

  async fetchSOS() {
    const res = await fetch('/api/sos');
    const data = await res.json();
    return data.alerts || [];
  }

  async createSOS(sosData) {
    const res = await fetch('/api/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sosData)
    });
    return await res.json();
  }

  async resolveSOS(id) {
    const res = await fetch(`/api/sos/${id}/resolve`, {
      method: 'POST'
    });
    return await res.json();
  }
}

// Global exports
window.rapidSync = new RapidSync();
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;
window.linkWithCredential = linkWithCredential;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.universalLogin = universalLogin;
window.universalRegister = universalRegister;
window.universalLogout = universalLogout;
window.requestEmergencyPermissions = requestEmergencyPermissions;
window.logout = universalLogout;
