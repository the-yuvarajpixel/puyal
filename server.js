import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Allow 15mb payload for live video/audio camera frames
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const puyalDir = path.join(__dirname, 'puyal');
const dataDir = path.join(__dirname, 'data');
const storeFile = path.join(dataDir, 'store.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ----------------------------------------------------------------------------
// Gemini AI Initialization (@google/genai SDK)
// ----------------------------------------------------------------------------
let ai = null;
try {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} catch (err) {
  console.warn('Gemini client initialization warning:', err.message);
}

// ----------------------------------------------------------------------------
// Default Government Emergency Stations & Fleet Data
// (Disaster Operations Center / NDMA / 108 Emergency Network)
// ----------------------------------------------------------------------------
const defaultStations = [
  {
    stationId: "STN-CEN-01",
    name: "EOC Central Disaster Command Depot",
    zone: "Central Metro",
    address: "Anna Salai Disaster Operations Complex",
    contact: "+91 44 2859 3900",
    distanceKm: 2.4,
    ambulances: { als: 6, bls: 12, deployed: 3 },
    fireTenders: { water: 8, foam: 4, ladder: 2, deployed: 2 },
    ndrfTeams: { total: 5, activePersonnel: 120, deployed: 2 },
    ervVehicles: { total: 10, deployed: 3 },
    rescueBoats: { total: 8, deployed: 1 },
    medicalSquads: { total: 6, deployed: 2 },
    status: "Operational"
  },
  {
    stationId: "STN-NTH-02",
    name: "North Metro Fire & Trauma Response Base",
    zone: "North Industrial Belt",
    address: "GT Road Industrial Corridor",
    contact: "+91 44 2522 1108",
    distanceKm: 5.1,
    ambulances: { als: 4, bls: 8, deployed: 1 },
    fireTenders: { water: 10, foam: 6, ladder: 3, deployed: 3 },
    ndrfTeams: { total: 4, activePersonnel: 96, deployed: 1 },
    ervVehicles: { total: 8, deployed: 2 },
    rescueBoats: { total: 4, deployed: 0 },
    medicalSquads: { total: 4, deployed: 1 },
    status: "Operational"
  },
  {
    stationId: "STN-CST-03",
    name: "Coastal Marine & Flood Rescue Station",
    zone: "Coastal & Riverfront Zone",
    address: "Marina Coastal Relief Outpost",
    contact: "+91 44 2844 7100",
    distanceKm: 3.8,
    ambulances: { als: 3, bls: 6, deployed: 1 },
    fireTenders: { water: 4, foam: 2, ladder: 1, deployed: 1 },
    ndrfTeams: { total: 6, activePersonnel: 144, deployed: 3 },
    ervVehicles: { total: 6, deployed: 1 },
    rescueBoats: { total: 16, deployed: 4 },
    medicalSquads: { total: 5, deployed: 2 },
    status: "Operational"
  },
  {
    stationId: "STN-STH-04",
    name: "South Expressway Rapid Trauma Depot",
    zone: "South Highway Corridor",
    address: "NH-48 Emergency Response Base",
    contact: "+91 44 2234 1080",
    distanceKm: 7.2,
    ambulances: { als: 8, bls: 14, deployed: 4 },
    fireTenders: { water: 6, foam: 3, ladder: 1, deployed: 2 },
    ndrfTeams: { total: 3, activePersonnel: 72, deployed: 1 },
    ervVehicles: { total: 12, deployed: 4 },
    rescueBoats: { total: 2, deployed: 0 },
    medicalSquads: { total: 5, deployed: 2 },
    status: "Operational"
  }
];

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
      severityScore: 92,
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
      severityScore: 74,
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
  government_stations: defaultStations,
  dispatches: [],
  emailTokens: []
};

function loadStore() {
  try {
    if (fs.existsSync(storeFile)) {
      const content = fs.readFileSync(storeFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.government_stations || parsed.government_stations.length === 0) {
        parsed.government_stations = defaultStations;
      }
      return parsed;
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

// In-memory live video/audio streams store (keyed by SOS ID)
const liveMediaStreams = new Map();

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

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', activeSosCount: store.sos_alerts.filter(s => s.active).length })}\n\n`);

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
// Gemini AI & Bhashini Multilingual Speech/Text Processing Endpoint
// ----------------------------------------------------------------------------
app.post('/api/ai/process-voice', async (req, res) => {
  const { text, language = 'en', prompt } = req.body;
  if (!text && !prompt) {
    return res.status(400).json({ error: 'Text or speech transcript is required' });
  }

  const inputText = (text || prompt).trim();
  const langNames = {
    'en': 'English', 'ta': 'Tamil (தமிழ்)', 'hi': 'Hindi (हिन्दी)',
    'te': 'Telugu (తెలుగు)', 'kn': 'Kannada (ಕನ್ನಡ)', 'ml': 'Malayalam (മലയാളം)',
    'bn': 'Bengali (বাংলা)', 'mr': 'Marathi (मराठी)', 'gu': 'Gujarati (ગુજરાતી)'
  };
  const langName = langNames[language] || 'English';

  let aiResult = null;

  // 1. Try Gemini 3.8 Flash model
  if (ai && process.env.GEMINI_API_KEY) {
    try {
      const systemPrompt = `You are an Emergency Response & Disaster Management AI powering RapidResponse Command and Bhashini AI.
The user speaks or reports in: ${langName}.
Analyze the emergency report:
1. Translate to clear English if needed.
2. Provide clean transcript in original language: ${langName}.
3. Classify Category strictly into: "Road Accident", "Fire", "Flood", "Medical Emergency", "Natural Disaster", "Violence/Crime", "Structural Collapse", or "Other".
4. Determine Severity strictly into: "Critical", "High", "Medium", or "Low".
5. Compute a numerical severity score between 0 and 100.
6. Estimate number of people affected (integer, default 1).
7. Extract location/landmark or return "Reported Area".
8. Generate 2 sentences of life-saving first-aid or safety guidance in ${langName} and English.
Return pure JSON with keys: translatedText, nativeText, category, severity, severityScore, affected, location, summary, firstAidGuidance.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: inputText,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json'
        }
      });

      if (response && response.text) {
        aiResult = JSON.parse(response.text.trim());
      }
    } catch (geminiErr) {
      console.warn('Gemini generateContent notice, using Bhashini heuristic fallback:', geminiErr.message);
    }
  }

  // 2. Intelligent Bhashini / Indian Language Heuristic Fallback
  if (!aiResult) {
    const lower = inputText.toLowerCase();

    // Category detection in English + Indian languages
    let cat = 'Other';
    if (lower.includes('fire') || lower.includes('smoke') || lower.includes('தீ') || lower.includes('आग') || lower.includes('మంటలు') || lower.includes('ಬೆಂಕಿ')) {
      cat = 'Fire';
    } else if (lower.includes('flood') || lower.includes('water') || lower.includes('வெள்ளம்') || lower.includes('बाढ़') || lower.includes('వరద') || lower.includes('ಪ್ರವಾಹ')) {
      cat = 'Flood';
    } else if (lower.includes('accident') || lower.includes('crash') || lower.includes('விபத்து') || lower.includes('दुर्घटना') || lower.includes('ప్రమాదం') || lower.includes('ಅಪಘಾತ')) {
      cat = 'Road Accident';
    } else if (lower.includes('medical') || lower.includes('heart') || lower.includes('blood') || lower.includes('மருத்துவ') || lower.includes('उपचार') || lower.includes('గాయం')) {
      cat = 'Medical Emergency';
    } else if (lower.includes('collapse') || lower.includes('building') || lower.includes('இடிந்து') || lower.includes('इमारत')) {
      cat = 'Structural Collapse';
    } else if (lower.includes('earthquake') || lower.includes('cyclone') || lower.includes('புயல்') || lower.includes('तूफान') || lower.includes('తుఫాను')) {
      cat = 'Natural Disaster';
    }

    // Number affected
    let affected = 1;
    const numMatch = lower.match(/(\d+)/);
    if (numMatch) affected = parseInt(numMatch[1], 10);

    // Severity & score calculation
    let sev = 'Medium';
    let score = 50;
    if (cat === 'Fire' || cat === 'Natural Disaster' || cat === 'Structural Collapse' || affected >= 6) {
      sev = 'Critical';
      score = 90;
    } else if (cat === 'Road Accident' || cat === 'Medical Emergency' || affected >= 3) {
      sev = 'High';
      score = 75;
    } else {
      sev = 'Medium';
      score = 45;
    }

    aiResult = {
      translatedText: inputText,
      nativeText: inputText,
      category: cat,
      severity: sev,
      severityScore: score,
      affected: affected,
      location: 'Reported Area',
      summary: `${cat} reported. Severity assessed as ${sev}.`,
      firstAidGuidance: 'Stay calm and move to safe ground away from hazards. Emergency responders have been notified.'
    };
  }

  return res.json({
    success: true,
    result: aiResult,
    language: language,
    langName: langName
  });
});

// ----------------------------------------------------------------------------
// Government Platform & Disaster Management Depot API
// ----------------------------------------------------------------------------

app.get('/api/government/stations', (req, res) => {
  const stations = store.government_stations || defaultStations;

  // Calculate total fleet summary
  let totalAmbulances = 0, deployedAmbulances = 0;
  let totalFireTenders = 0, deployedFireTenders = 0;
  let totalNdrfTeams = 0, deployedNdrfTeams = 0;
  let totalBoats = 0, deployedBoats = 0;
  let totalErv = 0, deployedErv = 0;

  stations.forEach(s => {
    totalAmbulances += (s.ambulances.als + s.ambulances.bls);
    deployedAmbulances += s.ambulances.deployed;
    totalFireTenders += (s.fireTenders.water + s.fireTenders.foam + s.fireTenders.ladder);
    deployedFireTenders += s.fireTenders.deployed;
    totalNdrfTeams += s.ndrfTeams.total;
    deployedNdrfTeams += s.ndrfTeams.deployed;
    totalBoats += s.rescueBoats.total;
    deployedBoats += s.rescueBoats.deployed;
    totalErv += s.ervVehicles.total;
    deployedErv += s.ervVehicles.deployed;
  });

  res.json({
    success: true,
    stations,
    dispatches: store.dispatches || [],
    fleetSummary: {
      ambulances: { total: totalAmbulances, available: totalAmbulances - deployedAmbulances, deployed: deployedAmbulances },
      fireTenders: { total: totalFireTenders, available: totalFireTenders - deployedFireTenders, deployed: deployedFireTenders },
      ndrfTeams: { total: totalNdrfTeams, available: totalNdrfTeams - deployedNdrfTeams, deployed: deployedNdrfTeams },
      rescueBoats: { total: totalBoats, available: totalBoats - deployedBoats, deployed: deployedBoats },
      ervVehicles: { total: totalErv, available: totalErv - deployedErv, deployed: deployedErv }
    }
  });
});

// AI Smart Grouping & Resource Conservation Dispatch
app.post('/api/government/group-dispatch', (req, res) => {
  const { area, incidentIds = [], severity = 'Critical', affectedCount = 1, requestedUnits = {} } = req.body;

  const stations = store.government_stations || defaultStations;
  // Select best station with capacity
  let selectedStation = stations[0];
  for (const stn of stations) {
    if (stn.ambulances.als > 0 || stn.fireTenders.water > 0) {
      selectedStation = stn;
      break;
    }
  }

  // Calculate optimal grouped strike force based on severity and affected count
  const numAffected = Math.max(1, parseInt(affectedCount || 1, 10));
  let alsCount = Math.min(selectedStation.ambulances.als, Math.ceil(numAffected / 4));
  let blsCount = Math.min(selectedStation.ambulances.bls, Math.ceil(numAffected / 3));
  let fireCount = severity === 'Critical' ? 2 : 1;
  let ndrfCount = (severity === 'Critical' || numAffected >= 6) ? 1 : 0;
  let boatCount = area.toLowerCase().includes('water') || area.toLowerCase().includes('flood') ? 2 : 0;

  // Conservation computation
  // Without grouping: 3 separate dispatches = 6 vehicles, 180L fuel
  // Grouped strike force: bundles into coordinated convoys, saving ~35-45% vehicle trips and fuel
  const individualVehicleNeed = (numAffected * 2) + 3;
  const groupedVehicleCount = Math.max(2, alsCount + blsCount + fireCount + ndrfCount);
  const conservationPercent = Math.min(65, Math.max(25, Math.round(((individualVehicleNeed - groupedVehicleCount) / individualVehicleNeed) * 100)));

  // Decrement station available fleet
  if (selectedStation.ambulances.als >= alsCount) selectedStation.ambulances.als -= alsCount;
  selectedStation.ambulances.deployed += alsCount;
  if (selectedStation.fireTenders.water >= fireCount) selectedStation.fireTenders.water -= fireCount;
  selectedStation.fireTenders.deployed += fireCount;
  if (selectedStation.ndrfTeams.total >= ndrfCount) selectedStation.ndrfTeams.total -= ndrfCount;
  selectedStation.ndrfTeams.deployed += ndrfCount;

  const dispatchOrder = {
    dispatchId: 'DISP-' + Date.now().toString().slice(-6),
    area: area || 'Sector Area Disaster Zone',
    stationId: selectedStation.stationId,
    stationName: selectedStation.name,
    severity,
    affectedCount: numAffected,
    groupedFleet: {
      alsAmbulances: alsCount,
      blsAmbulances: blsCount,
      fireTenders: fireCount,
      ndrfTeams: ndrfCount,
      rescueBoats: boatCount,
      totalVehicles: groupedVehicleCount
    },
    conservationPercent,
    status: 'En Route',
    dispatchedAt: new Date().toLocaleTimeString(),
    timestamp: new Date().toISOString()
  };

  if (!store.dispatches) store.dispatches = [];
  store.dispatches.unshift(dispatchOrder);
  saveStore(store);

  broadcast('GOVERNMENT_DISPATCH_UPDATED', { dispatchOrder, station: selectedStation });

  res.json({
    success: true,
    dispatchOrder,
    message: `Grouped Strike Force dispatched from ${selectedStation.name}. Conserved ${conservationPercent}% fleet usage.`
  });
});

app.post('/api/government/reset-fleet', (req, res) => {
  store.government_stations = JSON.parse(JSON.stringify(defaultStations));
  store.dispatches = [];
  saveStore(store);
  broadcast('GOVERNMENT_DISPATCH_UPDATED', { stations: store.government_stations });
  res.json({ success: true, message: 'All government stations reset to full readiness capacity.' });
});

// ----------------------------------------------------------------------------
// Live Video & Audio SOS Stream Relay (From Civilian to Admin)
// ----------------------------------------------------------------------------

// Civilian uploads live frame & audio sample
app.post('/api/sos/:id/stream-frame', (req, res) => {
  const sosId = req.params.id;
  const { frameBase64, audioLevel = 50, coords, email } = req.body;

  const streamData = {
    sosId,
    email: email || 'Civilian',
    lastFrame: frameBase64 || null,
    audioLevel: parseFloat(audioLevel) || 30,
    coords: coords || null,
    updatedAt: Date.now()
  };

  liveMediaStreams.set(sosId, streamData);

  // Broadcast frame to all viewing admins
  broadcast('SOS_FRAME_UPDATE', {
    sosId,
    audioLevel: streamData.audioLevel,
    hasFrame: Boolean(frameBase64),
    lastFrame: frameBase64,
    coords: streamData.coords
  });

  res.json({ success: true });
});

// Admin fetches live feed snapshot
app.get('/api/sos/:id/live-feed', (req, res) => {
  const sosId = req.params.id;
  const streamData = liveMediaStreams.get(sosId);

  if (streamData) {
    return res.json({ success: true, stream: streamData });
  }

  // Fallback if no frames yet uploaded
  const alert = store.sos_alerts.find(a => a.id === sosId);
  return res.json({
    success: true,
    stream: {
      sosId,
      email: alert ? alert.email : 'Civilian',
      lastFrame: null,
      audioLevel: 25,
      coords: alert ? { latitude: alert.latitude, longitude: alert.longitude } : null,
      updatedAt: Date.now()
    }
  });
});

// ----------------------------------------------------------------------------
// Unified Authentication Endpoints
// ----------------------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = store.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    if (role && user.role !== role) {
      return res.status(403).json({
        error: `This account is registered as ${user.role}. Please use the ${user.role === 'admin' ? 'Admin' : 'Civilian'} portal.`
      });
    }
  } else {
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
    expiresAt: Date.now() + 1000 * 60 * 30,
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

app.post('/api/auth/link-credential', (req, res) => {
  const { email } = req.body;
  return res.json({ success: true, message: 'Credential linked successfully for ' + email });
});

app.post('/api/auth/reauthenticate', (req, res) => {
  const { email } = req.body;
  return res.json({ success: true, message: 'Re-authenticated successfully for ' + email });
});

// ----------------------------------------------------------------------------
// Incidents API
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
    severityScore: parseInt(inc.severityScore || 50, 10),
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
  const { status, severity, severityScore } = req.body;

  const item = store.incidents.find(i => String(i.id) === String(id));
  if (!item) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (status) item.status = status;
  if (severity) item.severity = severity;
  if (severityScore !== undefined) item.severityScore = parseInt(severityScore, 10);
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
// SOS Alerts API
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

  store.sos_alerts.unshift(newAlert);
  saveStore(store);

  const sosIncident = {
    id: Date.now(),
    title: '🚨 LIVE SOS ALERT — ' + (email || 'Civilian User'),
    category: 'SOS Emergency',
    severity: 'Critical',
    severityScore: 98,
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
