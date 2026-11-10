import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const puyalDir = path.join(__dirname, 'puyal');
const dataDir = path.join(__dirname, 'data');
const storeFile = path.join(dataDir, 'store.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ----------------------------------------------------------------------------
// Initial Seed Data & Persistence
// ----------------------------------------------------------------------------
const defaultStore = {
  users: [
    {
      uid: 'demo_user_1',
      email: 'civilian.demo@rapidresponse.org',
      password: 'demopassword123',
      role: 'user',
      displayName: 'Civilian Responder (Demo)',
      createdAt: new Date().toISOString()
    },
    {
      uid: 'demo_admin_1',
      email: 'admin.demo@rapidresponse.org',
      password: 'demopassword123',
      role: 'admin',
      displayName: 'HQ Command Dispatcher',
      createdAt: new Date().toISOString()
    }
  ],
  incidents: [
    {
      id: 1731195000001,
      title: 'Structural Risk & Water Surge Alert',
      category: 'Flood',
      severity: 'Critical',
      location: 'Bridge Sector 4B, Riverfront',
      affected: 8,
      description: 'Water surge overflowing embankment. Structural safety assessment needed immediately.',
      contact: 'Civilian Emergency Watch',
      status: 'Reported',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toLocaleString(),
      reportedBy: 'civilian.demo@rapidresponse.org',
      source: 'form'
    },
    {
      id: 1731195000002,
      title: '[Voice Report] Road Accident Emergency',
      category: 'Road Accident',
      severity: 'High',
      location: '12.9716, 77.5946 (GPS Auto)',
      affected: 3,
      description: 'Two vehicles collided at intersection. Paramedics dispatched.',
      contact: 'Voice Report',
      status: 'In Progress',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toLocaleString(),
      reportedBy: 'civilian.demo@rapidresponse.org',
      source: 'voice'
    }
  ],
  sos_alerts: [],
  emailTokens: []
};

function loadStore() {
  try {
    if (fs.existsSync(storeFile)) {
      const content = fs.readFileSync(storeFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading store file, resetting to default:', e);
  }
  saveStore(defaultStore);
  return defaultStore;
}

function saveStore(data) {
  try {
    fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving store:', e);
  }
}

let store = loadStore();

// ----------------------------------------------------------------------------
// Real-time Server-Sent Events (SSE) Bus
// ----------------------------------------------------------------------------
let sseClients = [];

function broadcast(eventType, payload) {
  const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
}

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now() + Math.random().toString(36).substring(2, 7);
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial handshake with state
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', activeSosCount: store.sos_alerts.filter(s => s.active).length })}\n\n`);

  // Heartbeat ping every 25 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// ----------------------------------------------------------------------------
// Unified Authentication Endpoints (Email/Pass + Passwordless Email Link)
// ----------------------------------------------------------------------------

// Universal Login
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = store.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    // If user exists with different role, enforce role separation
    if (role && user.role !== role) {
      return res.status(403).json({
        error: `This account is registered as ${user.role}. Please use the ${user.role === 'admin' ? 'Admin' : 'Civilian'} portal.`
      });
    }
  } else {
    // Auto-register demo / first-time user seamlessly
    user = {
      uid: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      email: normalizedEmail,
      password: password || 'default123',
      role: role || 'user',
      displayName: normalizedEmail.split('@')[0],
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
    saveStore(store);
  }

  return res.json({
    success: true,
    user: {
      uid: user.uid,
      email: user.email,
      role: user.role,
      displayName: user.displayName
    },
    token: 'jwt_mock_' + Buffer.from(user.email).toString('base64')
  });
});

// Universal Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, role, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let existing = store.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (existing) {
    if (role && existing.role !== role) {
      return res.status(400).json({
        error: `Email already registered with ${existing.role} role.`
      });
    }
    return res.json({
      success: true,
      user: {
        uid: existing.uid,
        email: existing.email,
        role: existing.role,
        displayName: existing.displayName
      }
    });
  }

  const newUser = {
    uid: 'usr_' + Date.now(),
    email: normalizedEmail,
    password: password,
    role: role || 'user',
    displayName: displayName || normalizedEmail.split('@')[0],
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  saveStore(store);

  return res.json({
    success: true,
    user: {
      uid: newUser.uid,
      email: newUser.email,
      role: newUser.role,
      displayName: newUser.displayName
    }
  });
});

// Send Sign-In Link To Email (Passwordless / Magic Link)
app.post('/api/auth/send-link', (req, res) => {
  const { email, role, actionCodeSettings } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const token = 'link_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const targetPage = role === 'admin' ? '/login-admin.html' : '/login-user.html';
  const baseUrl = req.protocol + '://' + req.get('host');
  const magicUrl = `${baseUrl}${targetPage}?apiKey=rapidresponse-auth&mode=signIn&oobCode=${token}&email=${encodeURIComponent(email)}&role=${role || 'user'}`;

  const tokenRecord = {
    token,
    email: email.trim().toLowerCase(),
    role: role || 'user',
    expiresAt: Date.now() + 1000 * 60 * 30, // 30 min validity
    createdAt: new Date().toISOString()
  };

  if (!store.emailTokens) store.emailTokens = [];
  store.emailTokens.push(tokenRecord);
  saveStore(store);

  return res.json({
    success: true,
    message: 'Sign-in link created successfully',
    email: email.trim(),
    magicLink: magicUrl
  });
});

// Verify & Complete Sign In with Email Link
app.post('/api/auth/verify-link', (req, res) => {
  const { email, token } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  let tokenRecord = null;
  if (store.emailTokens) {
    tokenRecord = store.emailTokens.find(t => t.token === token && (!normalizedEmail || t.email === normalizedEmail));
  }

  const userRole = tokenRecord?.role || 'user';
  let user = store.users.find(u => u.email.toLowerCase() === (normalizedEmail || tokenRecord?.email));

  if (!user) {
    user = {
      uid: 'usr_link_' + Date.now(),
      email: normalizedEmail || tokenRecord?.email || 'verified.user@rapidresponse.local',
      role: userRole,
      displayName: (normalizedEmail || tokenRecord?.email || 'User').split('@')[0],
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
    saveStore(store);
  }

  return res.json({
    success: true,
    user: {
      uid: user.uid,
      email: user.email,
      role: user.role,
      displayName: user.displayName
    }
  });
});

// Link with credential / reauthenticate helpers
app.post('/api/auth/link-credential', (req, res) => {
  const { email, credential } = req.body;
  return res.json({ success: true, message: 'Credential linked successfully for ' + email });
});

app.post('/api/auth/reauthenticate', (req, res) => {
  const { email, credential } = req.body;
  return res.json({ success: true, message: 'Re-authenticated successfully for ' + email });
});

// ----------------------------------------------------------------------------
// Incidents API (Synchronized Across All Devices)
// ----------------------------------------------------------------------------

app.get('/api/incidents', (req, res) => {
  res.json({ success: true, incidents: store.incidents || [] });
});

app.post('/api/incidents', (req, res) => {
  const inc = req.body;
  const newIncident = {
    id: inc.id || Date.now(),
    title: inc.title || 'Emergency Report',
    category: inc.category || 'Other',
    severity: inc.severity || 'Medium',
    location: inc.location || 'Unknown Location',
    affected: parseInt(inc.affected || 1, 10),
    description: inc.description || 'No description provided.',
    contact: inc.contact || 'Not provided',
    status: inc.status || 'Reported',
    timestamp: inc.timestamp || new Date().toLocaleString(),
    reportedBy: inc.reportedBy || 'Civilian',
    source: inc.source || 'form',
    createdAt: new Date().toISOString()
  };

  store.incidents.unshift(newIncident);
  saveStore(store);

  broadcast('INCIDENT_CREATED', newIncident);
  res.status(201).json({ success: true, incident: newIncident });
});

app.patch('/api/incidents/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  const item = store.incidents.find(i => String(i.id) === String(id));
  if (!item) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (status) item.status = status;
  saveStore(store);

  broadcast('INCIDENT_UPDATED', item);
  res.json({ success: true, incident: item });
});

app.delete('/api/incidents/:id', (req, res) => {
  const id = req.params.id;
  const initialLen = store.incidents.length;
  store.incidents = store.incidents.filter(i => String(i.id) !== String(id));
  saveStore(store);

  broadcast('INCIDENT_DELETED', { id });
  res.json({ success: true, deleted: store.incidents.length < initialLen });
});

// ----------------------------------------------------------------------------
// SOS Alerts API (Live Feeds across all devices)
// ----------------------------------------------------------------------------

app.get('/api/sos', (req, res) => {
  res.json({ success: true, alerts: store.sos_alerts || [] });
});

app.post('/api/sos', (req, res) => {
  const { userId, email, latitude, longitude, accuracy, active = true, media = {} } = req.body;

  const alertId = 'sos_' + Date.now();
  const newAlert = {
    id: alertId,
    userId: userId || 'demo_user',
    email: email || 'civilian.demo@rapidresponse.org',
    latitude: latitude || null,
    longitude: longitude || null,
    accuracy: accuracy || null,
    active: active,
    media: {
      hasVideo: media.hasVideo !== false,
      hasAudio: media.hasAudio !== false
    },
    timestamp: new Date().toISOString(),
    displayTime: new Date().toLocaleTimeString()
  };

  // Prepend to active alerts
  store.sos_alerts.unshift(newAlert);
  saveStore(store);

  // Also auto-create an SOS incident entry if not already present
  const sosIncident = {
    id: Date.now(),
    title: '🚨 LIVE SOS ALERT — ' + (email || 'Civilian User'),
    category: 'SOS Emergency',
    severity: 'Critical',
    location: latitude ? `${latitude}, ${longitude} (GPS ±${accuracy || 5}m)` : 'GPS Pending',
    affected: 1,
    description: `SOS triggered by ${email || 'Civilian'}. Live camera and audio feed initiated. Dispatched to command center.`,
    contact: email || 'SOS Emergency',
    status: 'Reported',
    timestamp: new Date().toLocaleString(),
    reportedBy: email || 'civilian.demo@rapidresponse.org',
    source: 'sos',
    createdAt: new Date().toISOString()
  };
  store.incidents.unshift(sosIncident);
  saveStore(store);

  broadcast('SOS_ACTIVATED', newAlert);
  broadcast('INCIDENT_CREATED', sosIncident);

  res.status(201).json({ success: true, alert: newAlert, incident: sosIncident });
});

app.post('/api/sos/:id/resolve', (req, res) => {
  const id = req.params.id;
  const alert = store.sos_alerts.find(a => a.id === id);
  if (alert) {
    alert.active = false;
    alert.resolvedAt = new Date().toISOString();
    saveStore(store);
    broadcast('SOS_RESOLVED', { id });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ error: 'Alert not found' });
});

app.post('/api/sos/:id/deactivate', (req, res) => {
  const id = req.params.id;
  const alert = store.sos_alerts.find(a => a.id === id);
  if (alert) {
    alert.active = false;
    saveStore(store);
    broadcast('SOS_DEACTIVATED', { id });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ error: 'Alert not found' });
});

// ----------------------------------------------------------------------------
// Static Assets & Routing
// ----------------------------------------------------------------------------

app.use(express.static(puyalDir, { extensions: ['html'] }));
app.use('/puyal', express.static(puyalDir, { extensions: ['html'] }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSosCount: store.sos_alerts.filter(s => s.active).length,
    incidentsCount: store.incidents.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(puyalDir, 'index.html'));
});

// Catch-all route for HTML files
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const potentialFile = path.join(puyalDir, req.path.replace(/^\//, '') + '.html');
    res.sendFile(potentialFile, (err) => {
      if (err) {
        res.sendFile(path.join(puyalDir, 'index.html'));
      }
    });
  } else {
    next();
  }
});

app.listen(PORT, HOST, () => {
  console.log(`RapidResponse Command server running at http://${HOST}:${PORT}`);
});
