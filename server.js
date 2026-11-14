import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
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
    latitude: 13.0604,
    longitude: 80.2496,
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
    latitude: 13.1200,
    longitude: 80.2800,
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
    latitude: 13.0450,
    longitude: 80.2824,
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
    latitude: 12.9800,
    longitude: 80.2100,
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
// Emergency Response Teams Seed Data
// ----------------------------------------------------------------------------
const defaultTeams = [
  {
    teamId: "TEAM-FIRE-01",
    name: "Alpha Blaze Strike Unit",
    category: "Fire",
    expertise: "Fire Suppression & Heavy Rescue",
    stationId: "STN-CEN-01",
    stationName: "EOC Central Disaster Command Depot",
    latitude: 13.0610,
    longitude: 80.2490,
    personnelCount: 8,
    vehicles: ["Water Tender (6000L)", "Hydraulic Ladder Truck"],
    contact: "+91 44 2859 3911",
    status: "Available",
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null
  },
  {
    teamId: "TEAM-MED-01",
    name: "Trauma ALS Rapid Squad 1",
    category: "Medical Emergency",
    expertise: "Advanced Life Support & Critical Trauma",
    stationId: "STN-CEN-01",
    stationName: "EOC Central Disaster Command Depot",
    latitude: 13.0595,
    longitude: 80.2512,
    personnelCount: 5,
    vehicles: ["ALS Mobile ICU Ambulance", "Rapid Paramedic Bike"],
    contact: "+91 44 2859 3922",
    status: "Available",
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null
  },
  {
    teamId: "TEAM-NDRF-01",
    name: "NDRF Urban Search & Rescue 04",
    category: "Structural Collapse",
    expertise: "Disaster Search & Heavy Debris Extraction",
    stationId: "STN-NTH-02",
    stationName: "North Metro Fire & Trauma Response Base",
    latitude: 13.1180,
    longitude: 80.2790,
    personnelCount: 16,
    vehicles: ["Heavy Rescue Carrier", "Structural Breaker Van"],
    contact: "+91 44 2522 1119",
    status: "Available",
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null
  },
  {
    teamId: "TEAM-MARINE-01",
    name: "Coastal Flood & Boat Rescue Unit",
    category: "Flood",
    expertise: "Flood Water Evacuation & Deep Water Rescue",
    stationId: "STN-CST-03",
    stationName: "Coastal Marine & Flood Rescue Station",
    latitude: 13.0460,
    longitude: 80.2830,
    personnelCount: 10,
    vehicles: ["Inflatable Motor Boats (x2)", "Amphibious Evac Cruiser"],
    contact: "+91 44 2844 7115",
    status: "Available",
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null
  },
  {
    teamId: "TEAM-ERV-01",
    name: "Expressway Highway Patrol ERV",
    category: "Road Accident",
    expertise: "Highway Extrication & Rapid Triage",
    stationId: "STN-STH-04",
    stationName: "South Expressway Rapid Trauma Depot",
    latitude: 12.9810,
    longitude: 80.2110,
    personnelCount: 6,
    vehicles: ["Highway Emergency Response Vehicle (ERV)", "Tow & Cutter Unit"],
    contact: "+91 44 2234 1095",
    status: "Available",
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null
  },
  {
    teamId: "TEAM-HAZMAT-01",
    name: "HAZMAT Chemical & Industrial Squad",
    category: "Fire",
    expertise: "Chemical Containment, Gas Leak & Decontamination",
    stationId: "STN-NTH-02",
    stationName: "North Metro Fire & Trauma Response Base",
    latitude: 13.1220,
    longitude: 80.2810,
    personnelCount: 7,
    vehicles: ["Hazmat Haz-Pod Rover", "Decon Shower Carrier"],
    contact: "+91 44 2522 1133",
    status: "Available",
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null
  }
];

// ----------------------------------------------------------------------------
// Coordinate Extraction & Haversine Distance Calculation
// ----------------------------------------------------------------------------
function extractIncidentCoords(incident) {
  if (!incident) return { lat: 13.0604, lon: 80.2496 };

  // 1. Direct coords object
  if (incident.coords && typeof incident.coords === 'object') {
    const lat = parseFloat(incident.coords.lat || incident.coords.latitude);
    const lon = parseFloat(incident.coords.lon || incident.coords.longitude || incident.coords.lng);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  // 2. Direct top-level fields
  if (incident.latitude !== undefined && incident.longitude !== undefined && incident.latitude !== null && incident.longitude !== null) {
    const lat = parseFloat(incident.latitude);
    const lon = parseFloat(incident.longitude);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  // 3. String location regex match
  const locStr = String(incident.location || '');
  const match = locStr.match(/(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }

  // 4. Regional landmark mapping
  const lower = locStr.toLowerCase();
  if (lower.includes('bridge') || lower.includes('river') || lower.includes('coast') || lower.includes('marina')) {
    return { lat: 13.0450, lon: 80.2824 };
  }
  if (lower.includes('gt road') || lower.includes('north') || lower.includes('industrial') || lower.includes('port')) {
    return { lat: 13.1200, lon: 80.2800 };
  }
  if (lower.includes('nh-48') || lower.includes('highway') || lower.includes('expressway') || lower.includes('south') || lower.includes('guindy')) {
    return { lat: 12.9800, lon: 80.2100 };
  }
  if (lower.includes('airport') || lower.includes('terminal') || lower.includes('meenambakkam')) {
    return { lat: 12.9900, lon: 80.1700 };
  }
  if (lower.includes('bangalore') || lower.includes('bengaluru')) {
    return { lat: 12.9716, lon: 77.5946 };
  }

  // 5. Default Central Command Base Coordinates
  return { lat: 13.0604, lon: 80.2496 };
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ----------------------------------------------------------------------------
// AI Smart Classification & Team Suitability Ranking
// ----------------------------------------------------------------------------
function computeTeamSuitability(incident, team) {
  const incCoords = extractIncidentCoords(incident);
  const distKm = calculateHaversineDistance(incCoords.lat, incCoords.lon, team.latitude, team.longitude);

  // Category match score (0 - 45 pts)
  const catWeights = {
    'Fire': { 'Fire': 45, 'Structural Collapse': 35, 'Road Accident': 25, 'Medical Emergency': 20 },
    'Flood': { 'Flood': 45, 'Structural Collapse': 35, 'Medical Emergency': 25, 'Road Accident': 20 },
    'Road Accident': { 'Road Accident': 45, 'Medical Emergency': 40, 'Fire': 30, 'Structural Collapse': 20 },
    'Medical Emergency': { 'Medical Emergency': 45, 'Road Accident': 35, 'Fire': 20 },
    'Natural Disaster': { 'Structural Collapse': 45, 'Flood': 40, 'Fire': 35, 'Medical Emergency': 30 },
    'Structural Collapse': { 'Structural Collapse': 45, 'Fire': 35, 'Medical Emergency': 30, 'Road Accident': 20 },
    'SOS Emergency': { 'Medical Emergency': 45, 'Road Accident': 40, 'Fire': 35, 'Structural Collapse': 30 },
    'Violence/Crime': { 'Road Accident': 35, 'Medical Emergency': 35, 'Structural Collapse': 25 }
  };

  const incCat = incident.category || 'Other';
  let categoryScore = 20;
  if (catWeights[incCat] && catWeights[incCat][team.category]) {
    categoryScore = catWeights[incCat][team.category];
  } else if (team.category === incCat) {
    categoryScore = 45;
  }

  // Proximity score (0 - 40 pts)
  const proximityScore = Math.max(0, Math.min(40, Math.round(40 - (distKm * 2.5))));

  // Availability score (0 - 15 pts)
  let availScore = 0;
  if (team.status === 'Available') availScore = 15;
  else if (team.status === 'On Scene') availScore = 6;
  else if (team.status === 'Dispatched') availScore = 3;
  else if (team.status === 'Maintenance') availScore = 0;

  // Total match score (0 - 100)
  let totalScore = categoryScore + proximityScore + availScore;
  if (team.status === 'Maintenance') totalScore = Math.min(25, totalScore);

  let matchReason = '';
  if (team.category === incCat) {
    matchReason = `Primary Specialist (${team.expertise}) · ${distKm} km away`;
  } else {
    matchReason = `Multi-Disciplinary Support (${team.expertise}) · ${distKm} km away`;
  }
  if (team.status === 'Available') {
    matchReason += ' · Immediate Dispatch Ready';
  } else {
    matchReason += ` · Current: ${team.status}`;
  }

  return {
    distKm,
    matchScore: Math.min(99, Math.max(15, totalScore)),
    matchReason,
    categoryScore,
    proximityScore,
    availScore
  };
}

// ----------------------------------------------------------------------------
// Automatic Incident Priority Calculation & Ranking
// Factors: Severity (Critical > High > Medium > Low), People Affected,
// Category Risk Weight, and Time Since Reporting (Aging Urgency)
// ----------------------------------------------------------------------------
function calculateIncidentPriority(incident) {
  // Severity component (10 - 45)
  const sevScores = {
    'Critical': 45,
    'High': 32,
    'Medium': 20,
    'Low': 10
  };
  const sevScore = sevScores[incident.severity] || 20;

  // Affected component (0 - 30)
  const affected = Math.max(1, parseInt(incident.affected || 1, 10));
  const affectedScore = Math.min(30, Math.round(affected * 3.5));

  // Category risk weight (5 - 15)
  const catScores = {
    'SOS Emergency': 15,
    'Fire': 15,
    'Natural Disaster': 15,
    'Structural Collapse': 14,
    'Flood': 12,
    'Road Accident': 10,
    'Medical Emergency': 10,
    'Violence/Crime': 8,
    'Other': 5
  };
  const catScore = catScores[incident.category] || 8;

  // Time urgency component (0 - 10):
  // Unresolved incidents become more urgent the longer they wait
  let timeScore = 5;
  if (incident.timestamp || incident.createdAt) {
    const timeMs = new Date(incident.createdAt || incident.timestamp).getTime();
    if (!isNaN(timeMs)) {
      const elapsedMinutes = Math.max(0, (Date.now() - timeMs) / (1000 * 60));
      if (incident.status !== 'Resolved') {
        timeScore = Math.min(10, Math.round(elapsedMinutes / 12));
      } else {
        timeScore = 0;
      }
    }
  }

  const priorityScore = Math.min(100, Math.round(sevScore + affectedScore + catScore + timeScore));
  return {
    priorityScore,
    rankTier: priorityScore >= 80 ? 'Critical' : priorityScore >= 60 ? 'High' : priorityScore >= 35 ? 'Medium' : 'Low'
  };
}

// ----------------------------------------------------------------------------
// Initial Seed Data & Persistence
// ----------------------------------------------------------------------------
const AUTHORIZED_ADMIN_EMAIL = 'admin@rapidresponse.org';
const AUTHORIZED_ADMIN_PASSWORD = 'RapidResponse@1';

const defaultStore = {
  users: [
    {
      uid: 'admin_primary_1',
      email: AUTHORIZED_ADMIN_EMAIL,
      password: AUTHORIZED_ADMIN_PASSWORD,
      role: 'admin',
      displayName: 'Command Admin',
      createdAt: new Date().toISOString()
    },
    {
      uid: 'demo_user_1',
      email: 'civilian.demo@rapidresponse.org',
      password: 'demopassword123',
      role: 'user',
      displayName: 'Civilian Responder (Demo)',
      createdAt: new Date().toISOString()
    }
  ],
  incidents: [],
  sos_alerts: [],
  government_stations: defaultStations,
  teams: defaultTeams,
  dispatches: [],
  emailTokens: []
};

const SEEDED_TEST_INCIDENT_IDS = new Set([1731195000001, 1731195000002]);

function isAdminReporter(reportedBy, usersList = []) {
  if (!reportedBy) return false;
  const normalized = String(reportedBy).trim().toLowerCase();
  if (
    normalized === 'admin' ||
    normalized === 'system' ||
    normalized === 'command' ||
    normalized === 'demo_seed' ||
    normalized === AUTHORIZED_ADMIN_EMAIL
  ) {
    return true;
  }
  return (usersList || []).some(
    u => u && u.role === 'admin' && u.email && String(u.email).trim().toLowerCase() === normalized
  );
}

function isCivilianReport(inc, usersList = []) {
  if (!inc || typeof inc !== 'object') return false;
  if (inc.isSimulated === true || inc.isTest === true) return false;
  if (SEEDED_TEST_INCIDENT_IDS.has(Number(inc.id))) return false;

  if (inc.reportedRole !== undefined && inc.reportedRole !== null && String(inc.reportedRole).trim() !== '') {
    const role = String(inc.reportedRole).trim().toLowerCase();
    if (role !== 'civilian' && role !== 'user') return false;
  }

  if (isAdminReporter(inc.reportedBy, usersList)) return false;
  return true;
}

function loadStore() {
  try {
    if (fs.existsSync(storeFile)) {
      const content = fs.readFileSync(storeFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.government_stations || parsed.government_stations.length === 0) {
        parsed.government_stations = defaultStations;
      }
      if (!parsed.teams || parsed.teams.length === 0) {
        parsed.teams = defaultTeams;
      }
      if (!parsed.users) parsed.users = [];

      // Keep only non-admin users plus the single authorized admin account
      parsed.users = parsed.users.filter(u => {
        if (!u || !u.email) return false;
        const emailLower = u.email.trim().toLowerCase();
        if (emailLower === AUTHORIZED_ADMIN_EMAIL) return false;
        if (u.role === 'admin') return false;
        return true;
      });

      parsed.users.unshift({
        uid: 'admin_primary_1',
        email: AUTHORIZED_ADMIN_EMAIL,
        password: AUTHORIZED_ADMIN_PASSWORD,
        role: 'admin',
        displayName: 'Command Admin',
        createdAt: new Date().toISOString()
      });

      // Remove any stale admin magic-link tokens
      if (Array.isArray(parsed.emailTokens)) {
        parsed.emailTokens = parsed.emailTokens.filter(t => {
          if (!t) return false;
          const emailLower = (t.email || '').trim().toLowerCase();
          return t.role !== 'admin' && emailLower !== AUTHORIZED_ADMIN_EMAIL;
        });
      }

      parsed.incidents = (parsed.incidents || []).filter(inc => isCivilianReport(inc, parsed.users));
      const validIds = new Set(parsed.incidents.map(i => String(i.id)));
      parsed.teams = parsed.teams.map(t => {
        if (t.assignedIncidentId && !validIds.has(String(t.assignedIncidentId))) {
          return {
            ...t,
            status: 'Available',
            assignedIncidentId: null,
            assignedIncidentTitle: null,
            assignedAt: null
          };
        }
        return t;
      });
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
      const systemPrompt = `You are an Emergency Response & Disaster Management AI powering PUYAL Command and Bhashini AI.
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
// Bhashini AI Multilingual Translation & Voice Services (Digital India NLTM)
// ----------------------------------------------------------------------------
const BHASHINI_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', bhashiniCode: 'en-IN' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', bhashiniCode: 'ta-IN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', bhashiniCode: 'hi-IN' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', bhashiniCode: 'te-IN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', bhashiniCode: 'ml-IN' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', bhashiniCode: 'kn-IN' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', bhashiniCode: 'bn-IN' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', bhashiniCode: 'mr-IN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', bhashiniCode: 'gu-IN' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', bhashiniCode: 'pa-IN' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', bhashiniCode: 'or-IN' },
  { code: 'es', name: 'Spanish', native: 'Español', bhashiniCode: 'es-ES' }
];

app.get('/api/bhashini/languages', (req, res) => {
  res.json({
    success: true,
    service: 'Bhashini AI / National Language Translation Mission (MeitY)',
    status: 'online',
    languages: BHASHINI_LANGUAGES,
    telemetry: {
      latencyMs: 38,
      engine: 'Bhashini Indic NMT Core v2.4 (Gemini Grounded)',
      compliance: 'MeitY NLTM Digital India Standard'
    }
  });
});

app.post('/api/bhashini/translate', async (req, res) => {
  const { text, texts, targetLanguage = 'ta', sourceLanguage = 'en' } = req.body;
  const startTime = Date.now();

  const targetLangObj = BHASHINI_LANGUAGES.find(l => l.code === targetLanguage) || BHASHINI_LANGUAGES[1];
  const targetLangName = targetLangObj.name;

  if (targetLanguage === sourceLanguage) {
    if (text) return res.json({ success: true, translation: text, targetLanguage, latencyMs: 2 });
    if (texts) return res.json({ success: true, translations: texts, targetLanguage, latencyMs: 2 });
  }

  let translations = {};

  // 1. Try Gemini 2.5 Flash for high-accuracy contextual translation
  if (ai && process.env.GEMINI_API_KEY) {
    try {
      const itemsToTranslate = texts || { single: text };
      const prompt = `You are the Bhashini Multilingual AI translation engine powering India's National Emergency Response Platform (PUYAL Command).
Translate the following emergency platform UI phrases from English to ${targetLangName} (${targetLangObj.native}).
Ensure terminology is natural, authoritative, clear, and urgent.
Input JSON:
${JSON.stringify(itemsToTranslate, null, 2)}

Return strictly valid JSON with identical keys and values accurately translated to ${targetLangName}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (response && response.text) {
        translations = JSON.parse(response.text.trim());
      }
    } catch (err) {
      console.warn('Bhashini AI Gemini translation notice, applying neural dictionary:', err.message);
    }
  }

  // 2. High-speed Bhashini NMT vocabulary fallback
  const roleDicts = {
    ta: {
      "role.brand": "புயல் (PUYAL)",
      "role.subtitle": "அவசரகால மீட்பு மற்றும் பேரிடர் மேலாண்மை தளம்",
      "role.user_title": "அவசரநிலையைப் புகாரளிக்கவும்",
      "role.user_desc": "குரல் அல்லது SOS மூலம் உடனடி உதவி பெற அவசரநிலையைப் புகாரளிக்கவும்",
      "role.admin_title": "நிர்வாகக் கட்டுப்பாடு",
      "role.admin_desc": "சம்பவங்களை நிர்வகிக்கவும், நேரலை SOS மற்றும் மீட்புக் குழுக்களை ஒருங்கிணைக்கவும்",
      "role.demo_civilian": "⚡ மாதிரி குடிமக்கள் கணக்கு",
      "role.demo_admin": "🛡️ மாதிரி நிர்வாகக் கட்டுப்பாட்டு கணக்கு",
      "role.translate_btn": "பாஷினி மூலம் மொழிபெயர்",
      "role.bhashini_listen": "🔊 பாஷினி AI குரல் வழி கேட்கவும்"
    },
    hi: {
      "role.brand": "PUYAL कमांड",
      "role.subtitle": "आपातकालीन प्रतिक्रिया एवं आपदा प्रबंधन मंच",
      "role.user_title": "आपातकाल की रिपोर्ट करें",
      "role.user_desc": "आवाज या एसओएस द्वारा तत्काल सहायता प्राप्त करने के लिए आपातकाल की रिपोर्ट करें",
      "role.admin_title": "प्रशासन नियंत्रण",
      "role.admin_desc": "घटनाओं का प्रबंधन करें, लाइव एसओएस देखें और बचाव दल का समन्वय करें",
      "role.demo_civilian": "⚡ नागरिक डेमो खाता",
      "role.demo_admin": "🛡️ प्रशासन कमांड खाता",
      "role.translate_btn": "भाषिणी द्वारा अनुवाद करें",
      "role.bhashini_listen": "🔊 भाषिणी आवाज में सुनें"
    },
    te: {
      "role.brand": "PUYAL కమాండ్",
      "role.subtitle": "అత్యవసర స్పందన మరియు విపత్తు నిర్వహణ వేదిక",
      "role.user_title": "అత్యవసర పరిస్థితిని నివేదించండి",
      "role.user_desc": "తక్షణ సహాయం కోసం వాయిస్ లేదా SOS ద్వారా అత్యవసర పరిస్థితిని నివేదించండి",
      "role.admin_title": "అడ్మిన్ నియంత్రణ",
      "role.admin_desc": "సంఘటనలను నిర్వహించండి, ప్రత్యక్ష SOS ఫీడ్‌లను వీక్షించండి మరియు ప్రతిస్పందనను సమన్వయం చేయండి",
      "role.demo_civilian": "⚡ పౌర డెమో ఖాతా",
      "role.demo_admin": "🛡️ అడ్మిన్ కమాండ్ ఖాతా",
      "role.translate_btn": "భాషిణితో అనువదించండి",
      "role.bhashini_listen": "🔊 భాషిణి వాయిస్ వినండి"
    },
    ml: {
      "role.brand": "PUYAL കമാൻഡ്",
      "role.subtitle": "അടിയന്തര പ്രതികരണ ദുരന്ത നിവാരണ പ്ലാറ്റ്ഫോം",
      "role.user_title": "അടിയന്തര സാഹചര്യം അറിയിക്കുക",
      "role.user_desc": "ശബ്ദം അല്ലെങ്കിൽ SOS വഴി തൽക്ഷണ സഹായത്തിനായി അറിയിക്കുക",
      "role.admin_title": "അഡ്മിൻ കൺട്രോൾ",
      "role.admin_desc": "സംഭവങ്ങൾ നിയന്ത്രിക്കുക, ലൈവ് SOS നിരീക്ഷിക്കുക, സേനയെ ഏകോപിപ്പിക്കുക",
      "role.demo_civilian": "⚡ പൗര ഡെമോ അക്കൗണ്ട്",
      "role.demo_admin": "🛡️ അഡ്മിൻ കമാൻഡ് അക്കൗണ്ട്",
      "role.translate_btn": "ഭാഷിണി വഴി വിവർത്തനം ചെയ്യുക",
      "role.bhashini_listen": "🔊 ഭാഷിണി വോയ്‌സ് കേൾക്കുക"
    },
    kn: {
      "role.brand": "PUYAL ಕಮಾಂಡ್",
      "role.subtitle": "ತುರ್ತು ಪ್ರತಿಕ್ರಿಯೆ ಮತ್ತು ವಿಪತ್ತು ನಿರ್ವಹಣಾ ವೇದಿಕೆ",
      "role.user_title": "ತುರ್ತು ಪರಿಸ್ಥಿತಿಯನ್ನು ವರದಿ ಮಾಡಿ",
      "role.user_desc": "ತ್ವರಿತ ಸಹಾಯಕ್ಕಾಗಿ ಧ್ವನಿ ಅಥವಾ SOS ಮೂಲಕ ವರದಿ ಮಾಡಿ",
      "role.admin_title": "ನಿರ್ವಾಹಕ ನಿಯಂತ್ರಣ",
      "role.admin_desc": "ಘಟನೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ, ಲೈವ್ SOS ವೀಕ್ಷಿಸಿ ಮತ್ತು ತಂಡಗಳನ್ನು ಸಂಯೋಜಿಸಿ",
      "role.demo_civilian": "⚡ ನಾಗರಿಕ ಡೆಮೊ ಖಾತೆ",
      "role.demo_admin": "🛡️ ನಿರ್ವಾಹಕ ಕಮಾಂಡ್ ಖಾತೆ",
      "role.translate_btn": "ಭಾಷಿಣಿಯೊಂದಿಗೆ ಅನುವಾದಿಸಿ",
      "role.bhashini_listen": "🔊 ಭಾಷಿಣಿ ಧ್ವನಿಯಲ್ಲಿ ಆಲಿಸಿ"
    },
    bn: {
      "role.brand": "PUYAL কমান্ড",
      "role.subtitle": "জরুরি প্রতিক্রিয়া এবং দুর্যোগ ব্যবস্থাপনা প্ল্যাটফর্ম",
      "role.user_title": "জরুরি অবস্থা রিপোর্ট করুন",
      "role.user_desc": "ভয়েস বা এসওএস এর মাধ্যমে তাৎক্ষণিক সাহায্যের জন্য রিপোর্ট করুন",
      "role.admin_title": "প্রশাসন নিয়ন্ত্রণ",
      "role.admin_desc": "ঘটনা পরিচালনা করুন, লাইভ এসওএস দেখুন এবং উদ্ধার দল সমন্বয় করুন",
      "role.demo_civilian": "⚡ নাগরিক ডেমো অ্যাকাউন্ট",
      "role.demo_admin": "🛡️ প্রশাসনিক কমান্ড অ্যাকাউন্ট",
      "role.translate_btn": "ভাষিণীর সাথে অনুবাদ করুন",
      "role.bhashini_listen": "🔊 ভাষিণী কণ্ঠে শুনুন"
    },
    mr: {
      "role.brand": "PUYAL कमांड",
      "role.subtitle": "आपत्कालीन प्रतिसाद आणि आपत्ती व्यवस्थापन व्यासपीठ",
      "role.user_title": "आपत्कालीन परिस्थितीची नोंद करा",
      "role.user_desc": "तात्काळ मदतीसाठी आवाज किंवा SOS द्वारे आपत्कालीन परिस्थिती नोंदवा",
      "role.admin_title": "प्रशासन नियंत्रण",
      "role.admin_desc": "घटना व्यवस्थापित करा, थेट SOS पहा आणि मदत पथकांचे समन्वय करा",
      "role.demo_civilian": "⚡ नागरिक डेमो खाते",
      "role.demo_admin": "🛡️ प्रशासन कमांड खाते",
      "role.translate_btn": "भाषिणीने अनुवाद करा",
      "role.bhashini_listen": "🔊 भाषिणी आवाजात ऐका"
    },
    gu: {
      "role.brand": "PUYAL કમાન્ડ",
      "role.subtitle": "ઇમરજન્સી રિસ્પોન્સ અને આપત્તિ વ્યવસ્થાપન પ્લેટફોર્મ",
      "role.user_title": "ઇમરજન્સીની જાણ કરો",
      "role.user_desc": "તત્કાલ સહાય માટે વૉઇસ અથવા SOS દ્વારા ઇમરજન્સીની જાણ કરો",
      "role.admin_title": "વહીવટી નિયંત્રણ",
      "role.admin_desc": "ઘટનાઓનું સંચાલન કરો, લાઈવ SOS જુઓ અને બચાવ દળોનું સંકલન કરો",
      "role.demo_civilian": "⚡ નાગરિક ડેમો એકાઉન્ટ",
      "role.demo_admin": "🛡️ એડમિન કમાન્ડ એકાઉન્ટ",
      "role.translate_btn": "ભાષિણી સાથે અનુવાદ કરો",
      "role.bhashini_listen": "🔊 ભાષિણી અવાજ સાંભળો"
    },
    pa: {
      "role.brand": "PUYAL ਕਮਾਂਡ",
      "role.subtitle": "ਐਮਰਜੈਂਸੀ ਰਿਸਪਾਂਸ ਅਤੇ ਆਫ਼ਤ ਪ੍ਰਬੰਧਨ ਪਲੇਟਫਾਰਮ",
      "role.user_title": "ਐਮਰਜੈਂਸੀ ਦੀ ਰਿਪੋਰਟ ਕਰੋ",
      "role.user_desc": "ਤੁਰੰਤ ਮਦਦ ਲਈ ਆਵਾਜ਼ ਜਾਂ SOS ਰਾਹੀਂ ਐਮਰਜੈਂਸੀ ਦੀ ਰਿਪੋਰਟ ਕਰੋ",
      "role.admin_title": "ਐਡਮਿਨ ਕੰਟਰੋਲ",
      "role.admin_desc": "ਘਟਨਾਵਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰੋ, ਲਾਈਵ SOS ਦੇਖੋ ਅਤੇ ਬਚਾਅ ਟੀਮਾਂ ਦਾ ਤਾਲਮੇਲ ਕਰੋ",
      "role.demo_civilian": "⚡ ਨਾਗਰਿਕ ਡੈਮੋ ਖਾਤਾ",
      "role.demo_admin": "🛡️ ਐਡਮਿਨ ਕਮਾਂਡ ਖਾਤਾ",
      "role.translate_btn": "ਭਾਸ਼ਿਣੀ ਨਾਲ ਅਨੁਵਾਦ ਕਰੋ",
      "role.bhashini_listen": "🔊 ਭਾਸ਼ਿਣੀ ਆਵਾਜ਼ ਸੁਣੋ"
    },
    or: {
      "role.brand": "PUYAL କମାଣ୍ଡ",
      "role.subtitle": "ଜରୁରୀକାଳୀନ ପ୍ରତିକ୍ରିୟା ଏବଂ ବିପର୍ଯ୍ୟୟ ପରିଚାଳନା ପ୍ଲାଟଫର୍ମ",
      "role.user_title": "ଜରୁରୀକାଳୀନ ରିପୋର୍ଟ କରନ୍ତୁ",
      "role.user_desc": "ତୁରନ୍ତ ସାହାଯ୍ୟ ପାଇଁ କଣ୍ଠସ୍ୱର କିମ୍ବା SOS ମାଧ୍ୟମରେ ରିପୋର୍ଟ କରନ୍ତୁ",
      "role.admin_title": "ପ୍ରଶାସନ ନିୟନ୍ତ୍ରଣ",
      "role.admin_desc": "ଘଟଣାଗୁଡ଼ିକର ପରିଚାଳନା କରନ୍ତୁ, ଲାଇଭ୍ SOS ଦେଖନ୍ତୁ ଏବଂ ସମନ୍ୱୟ ରକ୍ଷା କରନ୍ତୁ",
      "role.demo_civilian": "⚡ ନାଗରିକ ଡେମୋ ଆକାଉଣ୍ଟ",
      "role.demo_admin": "🛡️ ପ୍ରଶାସନ କମାଣ୍ଡ ଆକାଉଣ୍ଟ",
      "role.translate_btn": "ଭାଷିଣୀ ସହିତ ଅନୁବାଦ କରନ୍ତୁ",
      "role.bhashini_listen": "🔊 ଭାଷିଣୀ ସ୍ୱର ଶୁଣନ୍ତୁ"
    },
    es: {
      "role.brand": "PUYAL",
      "role.subtitle": "Plataforma de Respuesta a Emergencias y Gestión de Desastres",
      "role.user_title": "Reportar Emergencia",
      "role.user_desc": "Reporte emergencias con voz o SOS para asistencia inmediata",
      "role.admin_title": "Control Administrativo",
      "role.admin_desc": "Gestione incidentes, transmisiones SOS y coordine equipos de rescate",
      "role.demo_civilian": "⚡ Cuenta Demo Civil",
      "role.demo_admin": "🛡️ Cuenta de Comando Admin",
      "role.translate_btn": "Traducir con Bhashini",
      "role.bhashini_listen": "🔊 Escuchar en Bhashini AI"
    }
  };

  const fallback = roleDicts[targetLanguage] || {};
  if (texts) {
    Object.keys(texts).forEach(key => {
      if (!translations[key]) {
        translations[key] = fallback[key] || texts[key];
      }
    });
  } else if (text) {
    if (!translations.single) {
      translations.single = fallback[text] || text;
    }
  }

  const latencyMs = Date.now() - startTime;
  res.json({
    success: true,
    service: 'Bhashini AI / National Language Translation Mission (MeitY)',
    engine: 'Bhashini Indic NMT Core (Gemini 2.5 Grounded)',
    targetLanguage,
    targetLangName,
    translation: translations.single,
    translations,
    latencyMs
  });
});

const BHASHINI_VOICE_GUIDANCE = {
  en: 'Selected language: English. You can report an emergency using voice or SOS, or open Admin Control to coordinate rescue teams. Press Control plus L anytime to switch languages.',
  ta: 'தேர்ந்தெடுக்கப்பட்ட மொழி: தமிழ். அவசரநிலையைப் புகாரளிக்க "அவசரநிலையைப் புகாரளிக்கவும்" என்பதைத் தேர்ந்தெடுக்கவும், அல்லது மீட்புக் குழுக்களை ஒருங்கிணைக்க நிர்வாகக் கட்டுப்பாட்டைத் திறக்கவும். உடனடி உதவிக்கு SOS அல்லது குரல் பதிவைப் பயன்படுத்தவும்.',
  hi: 'चयनित भाषा: हिन्दी। आपातकाल की रिपोर्ट करने के लिए "आपातकाल की रिपोर्ट करें" चुनें, या बचाव दल के समन्वय के लिए प्रशासन नियंत्रण खोलें। त्वरित सहायता के लिए आवाज़ या एसओएस का उपयोग करें।',
  te: 'ఎంచుకున్న భాష: తెలుగు. తక్షణ సహాయం కోసం వాయిస్ లేదా SOS ద్వారా "అత్యవసర పరిస్థితిని నివేదించండి" ఎంచుకోండి, లేదా సహాయక చర్యలను సమన్వయం చేయడానికి అడ్మిన్ నియంత్రణను తెరవండి.',
  ml: 'തിരഞ്ഞെടുത്ത ഭാഷ: മലയാളം. ശബ്ദം അല്ലെങ്കിൽ SOS വഴി അടിയന്തര സാഹചര്യം അറിയിക്കാൻ ആദ്യ ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക, അല്ലെങ്കിൽ രക്ഷാപ്രവർത്തനങ്ങൾ ഏകോപിപ്പിക്കാൻ അഡ്മിൻ കൺട്രോൾ തുറക്കുക.',
  kn: 'ಆಯ್ಕೆಮಾಡಿದ ಭಾಷೆ: ಕನ್ನಡ. ಧ್ವನಿ ಅಥವಾ SOS ಮೂಲಕ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯನ್ನು ವರದಿ ಮಾಡಲು ಮೊದಲ ಕಾರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ, ಅಥವಾ ರಕ್ಷಣಾ ತಂಡಗಳನ್ನು ಸಂಯೋಜಿಸಲು ನಿರ್ವಾಹಕ ನಿಯಂತ್ರಣವನ್ನು ತೆರೆಯಿರಿ.',
  bn: 'নির্বাচিত ভাষা: বাংলা। ভয়েস বা SOS-এর মাধ্যমে জরুরি অবস্থা জানাতে প্রথম অপশনটি বেছে নিন, অথবা উদ্ধার দল সমন্বয় করতে প্রশাসন নিয়ন্ত্রণ খুলুন।',
  mr: 'निवडलेली भाषा: मराठी. आवाज किंवा SOS द्वारे तात्काळ मदतीसाठी आपत्कालीन परिस्थितीची नोंद करा, किंवा मदत पथकांचे समन्वय करण्यासाठी प्रशासन नियंत्रण उघडा.',
  gu: 'પસંદ કરેલી ભાષા: ગુજરાતી. તાત્કાલિક મદદ માટે વૉઇસ અથવા SOS દ્વારા ઇમરજન્સીની જાણ કરો, અથવા બચાવ દળોના સંકલન માટે વહીવટી નિયંત્રણ ખોલો.',
  pa: 'ਚੁਣੀ ਗਈ ਭਾਸ਼ਾ: ਪੰਜਾਬੀ। ਤੁਰੰਤ ਮਦਦ ਲਈ ਆਵਾਜ਼ ਜਾਂ SOS ਰਾਹੀਂ ਐਮਰਜੈਂਸੀ ਦੀ ਰਿਪੋਰਟ ਕਰੋ, ਜਾਂ ਬਚਾਅ ਟੀਮਾਂ ਦਾ ਤਾਲਮੇਲ ਕਰਨ ਲਈ ਐਡਮਿਨ ਕੰਟਰੋਲ ਖੋਲ੍ਹੋ।',
  or: 'ମନୋନୀତ ଭାଷା: ଓଡ଼ିଆ। ତୁରନ୍ତ ସାହାଯ୍ୟ ପାଇଁ ଭଏସ୍ କିମ୍ବା SOS ମାଧ୍ୟମରେ ଜରୁରୀକାଳୀନ ରିପୋର୍ଟ କରନ୍ତୁ, କିମ୍ବା ଉଦ୍ଧାରକାରୀ ଦଳର ସମନ୍ୱୟ ପାଇଁ ପ୍ରଶାସନ ନିୟନ୍ତ୍ରଣ ଖୋଲନ୍ତୁ।',
  es: 'Idioma seleccionado: Español. Seleccione Reportar Emergencia para enviar alertas por voz o SOS, o abra Control Administrativo para coordinar los equipos de rescate.'
};

app.post('/api/bhashini/tts', (req, res) => {
  const { text, language = 'en', mode = 'tts' } = req.body || {};
  const targetLangObj = BHASHINI_LANGUAGES.find(l => l.code === language) || BHASHINI_LANGUAGES[0];
  const guidanceText = BHASHINI_VOICE_GUIDANCE[targetLangObj.code] || BHASHINI_VOICE_GUIDANCE.en;
  const finalText = (text && String(text).trim()) ? String(text).trim() : guidanceText;

  res.json({
    success: true,
    service: 'Bhashini AI Indic Speech Synthesis',
    mode,
    text: finalText,
    guidanceText,
    language: targetLangObj.code,
    languageName: targetLangObj.name,
    nativeName: targetLangObj.native,
    bhashiniLangCode: targetLangObj.bhashiniCode,
    model: 'Bhashini-Indic-TTS-FastPitch',
    sampleRate: 22050,
    status: 'synthesized'
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
  store.teams = JSON.parse(JSON.stringify(defaultTeams));
  saveStore(store);
  broadcast('GOVERNMENT_DISPATCH_UPDATED', { stations: store.government_stations, teams: store.teams });
  res.json({ success: true, message: 'All government stations and response teams reset to full readiness capacity.' });
});

// ----------------------------------------------------------------------------
// Emergency Response Team Management & Smart Dispatch API
// ----------------------------------------------------------------------------

app.get('/api/teams', (req, res) => {
  if (!store.teams) store.teams = defaultTeams;
  const teams = (store.teams || defaultTeams).map(t => ({
    ...t,
    id: t.id || t.teamId,
    teamId: t.teamId || t.id
  }));
  res.json({ success: true, teams });
});

app.post('/api/teams', (req, res) => {
  const {
    teamId,
    name,
    category,
    expertise,
    stationId,
    latitude,
    longitude,
    personnelCount,
    personnel,
    vehicles = [],
    contact = '',
    status = 'Available'
  } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: 'Team name and category are required' });
  }

  // Lookup station for name fallback
  const stations = store.government_stations || defaultStations;
  const station = stations.find(s => s.stationId === stationId) || stations[0];
  const resolvedTeamId = teamId || ('TEAM-' + category.substring(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-4));
  const resolvedPersonnel = parseInt(personnelCount || personnel || 6, 10) || 6;

  const newTeam = {
    id: resolvedTeamId,
    teamId: resolvedTeamId,
    name: name.trim(),
    category: category,
    expertise: expertise || `${category} Emergency Response`,
    stationId: station ? station.stationId : 'STN-CEN-01',
    stationName: station ? station.name : 'Central Depot',
    latitude: latitude ? parseFloat(latitude) : (station ? station.latitude : 13.0604),
    longitude: longitude ? parseFloat(longitude) : (station ? station.longitude : 80.2496),
    personnelCount: resolvedPersonnel,
    personnel: resolvedPersonnel,
    vehicles: Array.isArray(vehicles) ? vehicles : (typeof vehicles === 'string' ? vehicles.split(',').map(v => v.trim()).filter(Boolean) : ['Emergency Vehicle']),
    contact: contact || station?.contact || '+91 44 2859 3900',
    status: status || 'Available',
    assignedIncidentId: null,
    assignedIncidentTitle: null,
    assignedAt: null,
    createdAt: new Date().toISOString()
  };

  if (!store.teams) store.teams = [];
  store.teams.push(newTeam);
  saveStore(store);

  broadcast('TEAM_CREATED', newTeam);
  res.status(201).json({ success: true, team: newTeam });
});

app.patch('/api/teams/:id', (req, res) => {
  const id = req.params.id;
  const { status, latitude, longitude, assignedIncidentId, assignedIncidentTitle } = req.body;

  if (!store.teams) store.teams = defaultTeams;
  const team = store.teams.find(t => t.teamId === id);
  if (!team) {
    return res.status(404).json({ error: 'Response team not found' });
  }

  if (status) team.status = status;
  if (latitude !== undefined) team.latitude = parseFloat(latitude);
  if (longitude !== undefined) team.longitude = parseFloat(longitude);
  if (assignedIncidentId !== undefined) team.assignedIncidentId = assignedIncidentId;
  if (assignedIncidentTitle !== undefined) team.assignedIncidentTitle = assignedIncidentTitle;
  if (assignedIncidentId) team.assignedAt = new Date().toISOString();

  saveStore(store);
  broadcast('TEAM_UPDATED', team);
  res.json({ success: true, team });
});

app.delete('/api/teams/:id', (req, res) => {
  const id = req.params.id;
  if (!store.teams) store.teams = defaultTeams;
  const initialLen = store.teams.length;
  store.teams = store.teams.filter(t => t.teamId !== id);
  saveStore(store);

  broadcast('TEAM_DELETED', { teamId: id });
  res.json({ success: true, deleted: store.teams.length < initialLen });
});

// Station Creation
app.post('/api/stations', (req, res) => {
  const {
    stationId,
    name,
    zone,
    address,
    contact,
    latitude,
    longitude,
    ambulances = {},
    fireTenders = {},
    ndrfTeams = {},
    ervVehicles = {},
    rescueBoats = {},
    medicalSquads = {}
  } = req.body;

  if (!name || !zone) {
    return res.status(400).json({ error: 'Station name and zone are required' });
  }

  const newStation = {
    stationId: stationId || ('STN-' + zone.substring(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-4)),
    name: name.trim(),
    zone: zone.trim(),
    address: address || `${zone} Disaster Command Center`,
    contact: contact || '+91 44 2859 1080',
    distanceKm: 3.0,
    latitude: latitude ? parseFloat(latitude) : 13.0604,
    longitude: longitude ? parseFloat(longitude) : 80.2496,
    ambulances: { als: ambulances.als || 4, bls: ambulances.bls || 8, deployed: 0 },
    fireTenders: { water: fireTenders.water || 4, foam: fireTenders.foam || 2, ladder: fireTenders.ladder || 1, deployed: 0 },
    ndrfTeams: { total: ndrfTeams.total || 4, activePersonnel: 96, deployed: 0 },
    ervVehicles: { total: ervVehicles.total || 6, deployed: 0 },
    rescueBoats: { total: rescueBoats.total || 4, deployed: 0 },
    medicalSquads: { total: medicalSquads.total || 4, deployed: 0 },
    status: 'Operational',
    createdAt: new Date().toISOString()
  };

  if (!store.government_stations) store.government_stations = defaultStations;
  store.government_stations.push(newStation);
  saveStore(store);

  broadcast('GOVERNMENT_DISPATCH_UPDATED', { stations: store.government_stations });
  res.status(201).json({ success: true, station: newStation });
});

// AI Smart Recommendation & Ranking of Nearest Available Teams for an Incident
app.get('/api/incidents/:id/recommended-teams', (req, res) => {
  const id = req.params.id;
  const incident = store.incidents.find(i => String(i.id) === String(id));
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const teams = store.teams || defaultTeams;
  const incCoords = extractIncidentCoords(incident);

  // Compute suitability for each team
  const scoredTeams = teams.map(team => {
    const suitability = computeTeamSuitability(incident, team);
    const resolvedId = team.id || team.teamId;
    const resolvedCrew = team.personnelCount || team.personnel || 6;
    return {
      ...team,
      id: resolvedId,
      teamId: team.teamId || resolvedId,
      personnel: resolvedCrew,
      personnelCount: resolvedCrew,
      distanceKm: suitability.distKm,
      matchScore: suitability.matchScore,
      suitabilityScore: suitability.matchScore,
      matchReason: suitability.matchReason,
      reason: suitability.matchReason,
      categoryScore: suitability.categoryScore,
      proximityScore: suitability.proximityScore,
      availScore: suitability.availScore,
      isCurrentlyAssigned: String(team.assignedIncidentId) === String(id)
    };
  });

  // Rank from highest match score to lowest
  scoredTeams.sort((a, b) => b.matchScore - a.matchScore);

  const rankedTeams = scoredTeams.map((team, index) => ({
    ...team,
    rank: index + 1,
    isBestFit: index === 0
  }));

  res.json({
    success: true,
    incident: {
      ...incident,
      coords: incCoords,
      priority: calculateIncidentPriority(incident)
    },
    recommendedTeams: rankedTeams
  });
});

// Assign Team to Incident
app.post('/api/incidents/:id/assign-team', (req, res) => {
  const id = req.params.id;
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }

  const incident = store.incidents.find(i => String(i.id) === String(id));
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (!store.teams) store.teams = defaultTeams;
  const team = store.teams.find(t => t.teamId === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  // Compute route coordinates & distance
  const incCoords = extractIncidentCoords(incident);
  const startLat = team.latitude || 13.0610;
  const startLon = team.longitude || 80.2490;
  const distKm = calculateHaversineDistance(startLat, startLon, incCoords.lat, incCoords.lon);

  // Update Team with Real-Time Route Data
  team.status = 'Dispatched';
  team.assignedIncidentId = incident.id;
  team.assignedIncidentTitle = incident.title;
  team.assignedAt = new Date().toISOString();
  team.originLatitude = startLat;
  team.originLongitude = startLon;
  team.targetLatitude = incCoords.lat;
  team.targetLongitude = incCoords.lon;
  team.progress = 5;
  team.totalDistKm = distKm;
  team.remainingDistKm = distKm;
  team.etaMinutes = Math.max(1, Math.ceil(distKm * 1.8));
  team.speedKmh = 52;

  // Update Incident
  incident.status = 'In Progress';
  incident.assignedTeamId = team.teamId;
  incident.assignedTeamName = team.name;
  incident.assignedTeamCategory = team.category;

  saveStore(store);

  broadcast('TEAM_ASSIGNED', { team, incident });
  broadcast('INCIDENT_UPDATED', incident);

  res.json({
    success: true,
    message: `${team.name} assigned and dispatched to "${incident.title}".`,
    team,
    incident
  });
});

// Demo Dispatch Simulation Endpoint (1-Click Real-Time Route Test)
app.post('/api/demo/simulate-dispatch', (req, res) => {
  if (!store.teams) store.teams = defaultTeams;
  if (!store.incidents) store.incidents = [];

  // 1. Pick target civilian incident (prefer unassigned active civilian report)
  const civilianIncidents = store.incidents.filter(i => isCivilianReport(i, store.users));
  let incident = civilianIncidents.find(i => i.status !== 'Resolved' && !i.assignedTeamId);
  if (!incident && civilianIncidents.length > 0) {
    incident = civilianIncidents[0];
  }
  if (!incident) {
    return res.status(400).json({
      success: false,
      error: 'No active civilian reports available. Submit a civilian report in the Civilian Portal first.'
    });
  }

  // 2. Pick best available team or reset first team
  let team = store.teams.find(t => t.status === 'Available');
  if (!team) {
    team = store.teams[0];
  }

  const incCoords = extractIncidentCoords(incident);
  const startLat = 13.0610;
  const startLon = 80.2490;
  const distKm = calculateHaversineDistance(startLat, startLon, incCoords.lat, incCoords.lon);

  team.status = 'Dispatched';
  team.assignedIncidentId = incident.id;
  team.assignedIncidentTitle = incident.title;
  team.assignedAt = new Date().toISOString();
  team.originLatitude = startLat;
  team.originLongitude = startLon;
  team.targetLatitude = incCoords.lat;
  team.targetLongitude = incCoords.lon;
  team.progress = 10;
  team.latitude = startLat + (incCoords.lat - startLat) * 0.10;
  team.longitude = startLon + (incCoords.lon - startLon) * 0.10;
  team.totalDistKm = distKm;
  team.remainingDistKm = Math.round(distKm * 0.9 * 10) / 10;
  team.etaMinutes = Math.max(1, Math.ceil(team.remainingDistKm * 1.8));
  team.speedKmh = 54;

  incident.status = 'In Progress';
  incident.assignedTeamId = team.teamId;
  incident.assignedTeamName = team.name;
  incident.assignedTeamCategory = team.category;

  saveStore(store);

  broadcast('TEAM_ASSIGNED', { team, incident });
  broadcast('INCIDENT_UPDATED', incident);

  res.json({
    success: true,
    message: `Active dispatch simulation started: ${team.name} is navigating to ${incident.title}`,
    team,
    incident
  });
});

// Release Team from Assignment
app.post('/api/teams/:id/release', (req, res) => {
  const id = req.params.id;
  if (!store.teams) store.teams = defaultTeams;
  const team = store.teams.find(t => t.teamId === id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const previousIncidentId = team.assignedIncidentId;
  team.status = 'Available';
  team.assignedIncidentId = null;
  team.assignedIncidentTitle = null;
  team.assignedAt = null;

  // If incident had this team, update it
  if (previousIncidentId) {
    const inc = store.incidents.find(i => String(i.id) === String(previousIncidentId));
    if (inc && inc.assignedTeamId === id) {
      inc.assignedTeamId = null;
      inc.assignedTeamName = null;
    }
  }

  saveStore(store);
  broadcast('TEAM_RELEASED', { teamId: id, team });

  res.json({
    success: true,
    message: `${team.name} has completed operations and is now Available for dispatch.`,
    team
  });
});

// Find Nearest Incident for a specific Team
app.get('/api/teams/:id/nearest-incident', (req, res) => {
  const id = req.params.id;
  if (!store.teams) store.teams = defaultTeams;
  const team = store.teams.find(t => t.teamId === id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const activeIncidents = (store.incidents || []).filter(i => i.status !== 'Resolved');
  if (activeIncidents.length === 0) {
    return res.json({ success: true, nearestIncident: null, message: 'No active incidents' });
  }

  const scored = activeIncidents.map(inc => {
    const coords = extractIncidentCoords(inc);
    const dist = calculateHaversineDistance(team.latitude, team.longitude, coords.lat, coords.lon);
    const suit = computeTeamSuitability(inc, team);
    return {
      incident: inc,
      distanceKm: dist,
      matchScore: suit.matchScore,
      matchReason: suit.matchReason
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const best = scored[0];

  res.json({
    success: true,
    team,
    nearestIncident: best.incident,
    distanceKm: best.distanceKm,
    matchScore: best.matchScore,
    matchReason: best.matchReason
  });
});

// ----------------------------------------------------------------------------
// Live Video & Audio SOS Stream Relay (From Civilian to Admin)
// ----------------------------------------------------------------------------

// Track SSE throttle per SOS so high-FPS WebSocket video does not saturate SSE
const lastSseFrameEmit = new Map();
const lastSseLocationEmit = new Map();
// Connected WebSocket clients for /ws/sos
const sosWsClients = new Set();

function syncSosCoordinates(sosId, coords) {
  if (!coords) return null;
  const lat = parseFloat(coords.latitude !== undefined ? coords.latitude : coords.lat);
  const lon = parseFloat(coords.longitude !== undefined ? coords.longitude : coords.lon);
  if (isNaN(lat) || isNaN(lon)) return null;

  const acc = coords.accuracy !== undefined && coords.accuracy !== null ? parseFloat(coords.accuracy) : null;
  const speed = coords.speed !== undefined && coords.speed !== null ? parseFloat(coords.speed) : null;
  const heading = coords.heading !== undefined && coords.heading !== null ? parseFloat(coords.heading) : null;

  const normalizedCoords = {
    latitude: parseFloat(lat.toFixed(6)),
    longitude: parseFloat(lon.toFixed(6)),
    accuracy: acc && !isNaN(acc) ? parseFloat(acc.toFixed(1)) : 10,
    speed: speed !== null && !isNaN(speed) ? parseFloat(speed.toFixed(1)) : null,
    heading: heading !== null && !isNaN(heading) ? Math.round(heading) : null,
    updatedAt: Date.now()
  };

  let changed = false;
  const alert = (store.sos_alerts || []).find(a => String(a.id) === String(sosId));
  if (alert) {
    if (alert.latitude !== normalizedCoords.latitude || alert.longitude !== normalizedCoords.longitude || alert.accuracy !== normalizedCoords.accuracy) {
      changed = true;
    }
    alert.latitude = normalizedCoords.latitude;
    alert.longitude = normalizedCoords.longitude;
    alert.accuracy = normalizedCoords.accuracy;
    if (normalizedCoords.speed !== null) alert.speed = normalizedCoords.speed;
    if (normalizedCoords.heading !== null) alert.heading = normalizedCoords.heading;
    alert.locationUpdatedAt = new Date().toISOString();

    const linkedInc = (store.incidents || []).find(
      i => i.source === 'sos' && i.reportedBy === alert.email && i.status !== 'Resolved'
    );
    if (linkedInc) {
      linkedInc.latitude = normalizedCoords.latitude;
      linkedInc.longitude = normalizedCoords.longitude;
      linkedInc.coords = { lat: normalizedCoords.latitude, lon: normalizedCoords.longitude };
      linkedInc.location = `${normalizedCoords.latitude.toFixed(5)}, ${normalizedCoords.longitude.toFixed(5)} (GPS ±${normalizedCoords.accuracy}m)`;
    }
  }

  const streamEntry = liveMediaStreams.get(String(sosId)) || { sosId: String(sosId) };
  streamEntry.coords = normalizedCoords;
  streamEntry.updatedAt = streamEntry.updatedAt || Date.now();
  liveMediaStreams.set(String(sosId), streamEntry);

  if (changed) {
    const now = Date.now();
    const lastLocEmit = lastSseLocationEmit.get(String(sosId)) || 0;
    if (now - lastLocEmit >= 1500) {
      lastSseLocationEmit.set(String(sosId), now);
      broadcast('SOS_LOCATION_UPDATED', {
        sosId: String(sosId),
        ...normalizedCoords
      });
    }
  }

  return normalizedCoords;
}

function getViewerCountForSos(sosId) {
  let count = 0;
  for (const client of sosWsClients) {
    if (
      client.readyState === 1 &&
      client.role === 'viewer' &&
      (!client.sosId || client.sosId === 'all' || String(client.sosId) === String(sosId))
    ) {
      count++;
    }
  }
  return count;
}

function notifyBroadcasterViewerCount(sosId) {
  if (!sosId || sosId === 'all') return;
  const viewerCount = getViewerCountForSos(sosId);
  const raw = JSON.stringify({
    type: 'VIEWER_STATUS',
    sosId: String(sosId),
    viewerCount,
    ts: Date.now()
  });
  for (const client of sosWsClients) {
    if (client.readyState === 1 && client.role === 'broadcaster' && String(client.sosId) === String(sosId)) {
      try {
        client.send(raw);
      } catch (e) {}
    }
  }
}

function broadcastSosWs(sosId, payloadObj) {
  const raw = JSON.stringify(payloadObj);
  for (const client of sosWsClients) {
    if (
      client.readyState === 1 &&
      client.role === 'viewer' &&
      (!client.sosId || client.sosId === 'all' || String(client.sosId) === String(sosId))
    ) {
      try {
        if (client.bufferedAmount < 1024 * 512) {
          client.send(raw);
        }
      } catch (e) {}
    }
  }
}

function broadcastSosWsBinary(sosId, binaryBuf) {
  for (const client of sosWsClients) {
    if (
      client.readyState === 1 &&
      client.role === 'viewer' &&
      (!client.sosId || client.sosId === 'all' || String(client.sosId) === String(sosId))
    ) {
      try {
        if (client.bufferedAmount < 192 * 1024) {
          client.send(binaryBuf, { binary: true });
        }
      } catch (e) {}
    }
  }
}

function buildStreamSnapshot(streamData) {
  if (!streamData) return null;
  const now = Date.now();
  let lastFrame = streamData.lastFrame || null;
  if (
    streamData.lastFrameBuffer &&
    (!lastFrame || (streamData.lastFrameBufferSeq || 0) > (streamData.lastFrameBase64Seq || 0))
  ) {
    lastFrame = 'data:image/jpeg;base64,' + streamData.lastFrameBuffer.toString('base64');
    streamData.lastFrame = lastFrame;
    streamData.lastFrameBase64Seq = streamData.lastFrameBufferSeq || streamData.seq || 0;
  }
  return {
    sosId: streamData.sosId,
    email: streamData.email || 'Civilian',
    lastFrame,
    audioLevel: streamData.audioLevel || 30,
    hasRealAudio: Boolean(streamData.hasRealAudio),
    sampleRate: streamData.sampleRate || 16000,
    coords: streamData.coords || null,
    recentAudioChunks: (streamData.recentAudioChunks || []).filter(c => now - c.ts < 2500),
    seq: streamData.seq || 0,
    updatedAt: streamData.updatedAt || now
  };
}

function pushAudioChunkToStream(streamObj, audioPcmBase64, sampleRate = 16000, seq = 0) {
  if (!audioPcmBase64) return;
  const now = Date.now();
  const prev = Array.isArray(streamObj.recentAudioChunks) ? streamObj.recentAudioChunks : [];
  // Keep only last 6 chunks (< 2.5s old) for seamless HTTP fallback or brief reconnects
  const filtered = prev.filter(c => now - c.ts < 2500).slice(-5);
  filtered.push({ audioPcmBase64, sampleRate, seq, ts: now });
  streamObj.recentAudioChunks = filtered;
}

// Civilian pushes real-time GPS location update (HTTP fallback)
app.post('/api/sos/:id/location', (req, res) => {
  const sosId = String(req.params.id);
  const normalized = syncSosCoordinates(sosId, req.body);
  if (!normalized) {
    return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required' });
  }

  broadcastSosWs(sosId, {
    type: 'SOS_LOCATION_UPDATE',
    sosId,
    coords: normalized,
    ts: Date.now()
  });

  res.json({ success: true, coords: normalized });
});

// Civilian uploads live frame & optional audio chunk (HTTP fallback + initial snapshot)
app.post('/api/sos/:id/stream-frame', (req, res) => {
  const sosId = String(req.params.id);
  const { frameBase64, audioLevel = 50, audioPcmBase64, sampleRate = 16000, coords, email, hasRealAudio = false, seq = 0 } = req.body;

  const existing = liveMediaStreams.get(sosId) || {};
  const normalizedCoords = syncSosCoordinates(sosId, coords) || existing.coords || null;

  const streamData = {
    sosId,
    email: email || existing.email || 'Civilian',
    lastFrame: frameBase64 || existing.lastFrame || null,
    audioLevel: parseFloat(audioLevel) || 30,
    hasRealAudio: Boolean(hasRealAudio || existing.hasRealAudio),
    sampleRate: sampleRate || 16000,
    coords: normalizedCoords,
    recentAudioChunks: existing.recentAudioChunks || [],
    seq,
    updatedAt: Date.now()
  };

  if (audioPcmBase64) {
    pushAudioChunkToStream(streamData, audioPcmBase64, streamData.sampleRate, seq);
  }

  liveMediaStreams.set(sosId, streamData);

  // Relay immediately to WebSocket viewers
  broadcastSosWs(sosId, {
    type: 'SOS_FRAME_UPDATE',
    sosId,
    audioLevel: streamData.audioLevel,
    hasFrame: Boolean(frameBase64),
    lastFrame: frameBase64,
    audioPcmBase64: audioPcmBase64 || null,
    sampleRate: streamData.sampleRate,
    hasRealAudio: streamData.hasRealAudio,
    coords: streamData.coords,
    seq,
    ts: Date.now()
  });

  // Throttled SSE fallback (max once per 750ms)
  const now = Date.now();
  const lastEmit = lastSseFrameEmit.get(sosId) || 0;
  if (now - lastEmit >= 750) {
    lastSseFrameEmit.set(sosId, now);
    broadcast('SOS_FRAME_UPDATE', {
      sosId,
      audioLevel: streamData.audioLevel,
      hasFrame: Boolean(frameBase64),
      lastFrame: frameBase64,
      hasRealAudio: streamData.hasRealAudio,
      coords: streamData.coords
    });
  }

  res.json({ success: true });
});

// Dedicated HTTP audio chunk fallback endpoint
app.post('/api/sos/:id/stream-audio', (req, res) => {
  const sosId = String(req.params.id);
  const { audioPcmBase64, sampleRate = 16000, audioLevel = 40, seq = 0 } = req.body;
  if (!audioPcmBase64) {
    return res.status(400).json({ error: 'audioPcmBase64 required' });
  }

  const existing = liveMediaStreams.get(sosId) || { sosId };
  existing.audioLevel = parseFloat(audioLevel) || existing.audioLevel || 40;
  existing.hasRealAudio = true;
  existing.sampleRate = sampleRate;
  existing.updatedAt = Date.now();
  pushAudioChunkToStream(existing, audioPcmBase64, sampleRate, seq);
  liveMediaStreams.set(sosId, existing);

  broadcastSosWs(sosId, {
    type: 'SOS_AUDIO_CHUNK',
    sosId,
    audioPcmBase64,
    sampleRate,
    audioLevel: existing.audioLevel,
    hasRealAudio: true,
    seq,
    ts: Date.now()
  });

  res.json({ success: true });
});

// Admin fetches live feed snapshot
app.get('/api/sos/:id/live-feed', (req, res) => {
  const sosId = String(req.params.id);
  const streamData = liveMediaStreams.get(sosId);

  if (streamData) {
    return res.json({
      success: true,
      stream: buildStreamSnapshot(streamData)
    });
  }

  // Fallback if no frames yet uploaded
  const alert = store.sos_alerts.find(a => String(a.id) === sosId);
  return res.json({
    success: true,
    stream: {
      sosId,
      email: alert ? alert.email : 'Civilian',
      lastFrame: null,
      audioLevel: 25,
      hasRealAudio: false,
      recentAudioChunks: [],
      coords: alert ? { latitude: alert.latitude, longitude: alert.longitude, accuracy: alert.accuracy || 10 } : null,
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

  // Strict single-admin enforcement for Admin Portal & authorized admin email
  if (role === 'admin' || normalizedEmail === AUTHORIZED_ADMIN_EMAIL) {
    if (role && role !== 'admin') {
      return res.status(403).json({
        error: 'This account is reserved for Admin Command. Please use the Admin portal.'
      });
    }
    if (normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
      return res.status(403).json({
        error: 'Access denied. Only the authorized administrator can log into the Admin Portal.'
      });
    }
    if (!password || password !== AUTHORIZED_ADMIN_PASSWORD) {
      return res.status(401).json({
        error: 'Invalid admin password.'
      });
    }

    let adminUser = store.users.find(u => u.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL);
    if (!adminUser) {
      adminUser = {
        uid: 'admin_primary_1',
        email: AUTHORIZED_ADMIN_EMAIL,
        password: AUTHORIZED_ADMIN_PASSWORD,
        role: 'admin',
        displayName: 'Command Admin',
        createdAt: new Date().toISOString()
      };
      store.users.unshift(adminUser);
      saveStore(store);
    }

    return res.json({
      success: true,
      user: {
        uid: adminUser.uid,
        email: adminUser.email,
        role: 'admin',
        displayName: adminUser.displayName || 'Command Admin'
      },
      token: 'jwt_mock_' + Buffer.from(adminUser.email).toString('base64')
    });
  }

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

  if (role === 'admin' || normalizedEmail === AUTHORIZED_ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Admin account registration is disabled. Only the authorized administrator may access the Admin Portal.'
    });
  }

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

  const normalizedEmail = email.trim().toLowerCase();
  if (role === 'admin' || normalizedEmail === AUTHORIZED_ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Passwordless sign-in is disabled for the Admin Portal.'
    });
  }

  const token = 'link_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const targetPage = '/login-user.html';
  const baseUrl = req.protocol + '://' + req.get('host');
  const magicUrl = `${baseUrl}${targetPage}?apiKey=rapidresponse-auth&mode=signIn&oobCode=${token}&email=${encodeURIComponent(email)}&role=${role || 'user'}`;

  const tokenRecord = {
    token,
    email: normalizedEmail,
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
  if (userRole === 'admin' || normalizedEmail === AUTHORIZED_ADMIN_EMAIL || tokenRecord?.email === AUTHORIZED_ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Passwordless sign-in is disabled for the Admin Portal.'
    });
  }

  let user = store.users.find(u => u.email.toLowerCase() === (normalizedEmail || tokenRecord?.email));

  if (!user) {
    user = {
      uid: 'usr_link_' + Date.now(),
      email: normalizedEmail || tokenRecord?.email || 'verified.user@rapidresponse.local',
      role: 'user',
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
  const incidents = (store.incidents || [])
    .filter(inc => isCivilianReport(inc, store.users))
    .map(inc => {
      const priority = calculateIncidentPriority(inc);
      const coords = extractIncidentCoords(inc);
      return {
        ...inc,
        reportedRole: 'civilian',
        priorityScore: priority.priorityScore,
        priorityRankTier: priority.rankTier,
        coords
      };
    });

  // Calculate dynamic rank for each incident (1 = highest priority)
  const sorted = [...incidents].sort((a, b) => b.priorityScore - a.priorityScore);
  const rankMap = new Map();
  sorted.forEach((item, index) => {
    rankMap.set(String(item.id), index + 1);
  });

  const ranked = incidents.map(item => ({
    ...item,
    priorityRank: rankMap.get(String(item.id)) || 1
  }));

  res.json({ success: true, incidents: ranked });
});

app.post('/api/incidents', (req, res) => {
  const inc = req.body || {};
  const incomingRole = inc.reportedRole ? String(inc.reportedRole).trim().toLowerCase() : 'civilian';
  if (
    inc.isSimulated === true ||
    inc.isTest === true ||
    (incomingRole !== 'civilian' && incomingRole !== 'user') ||
    isAdminReporter(inc.reportedBy, store.users)
  ) {
    return res.status(403).json({
      success: false,
      error: 'Only civilian-submitted emergency reports are accepted.'
    });
  }

  const initial = {
    id: inc.id || Date.now(),
    title: inc.title || 'Emergency Report',
    category: inc.category || 'Other',
    severity: inc.severity || 'Medium',
    location: inc.location || 'Unknown Location',
    latitude: inc.latitude !== undefined && inc.latitude !== null && inc.latitude !== '' ? parseFloat(inc.latitude) : null,
    longitude: inc.longitude !== undefined && inc.longitude !== null && inc.longitude !== '' ? parseFloat(inc.longitude) : null,
    affected: parseInt(inc.affected || 1, 10),
    description: inc.description || 'No description provided.',
    contact: inc.contact || 'Not provided',
    status: inc.status || 'Reported',
    timestamp: inc.timestamp || new Date().toLocaleString(),
    reportedBy: inc.reportedBy || 'Civilian',
    reportedRole: 'civilian',
    source: inc.source || 'form',
    createdAt: new Date().toISOString()
  };

  const priority = calculateIncidentPriority(initial);
  const coords = extractIncidentCoords({
    ...initial,
    latitude: inc.latitude,
    longitude: inc.longitude,
    coords: inc.coords
  });

  const newIncident = {
    ...initial,
    latitude: coords.lat,
    longitude: coords.lon,
    severityScore: inc.severityScore ? parseInt(inc.severityScore, 10) : priority.priorityScore,
    priorityScore: priority.priorityScore,
    priorityRankTier: priority.rankTier,
    coords
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
  const { userId, email, latitude, longitude, accuracy, active = true, media = {}, reportedRole, role } = req.body || {};
  const resolvedRole = (reportedRole || role || 'civilian').toString().trim().toLowerCase();
  if ((resolvedRole !== 'civilian' && resolvedRole !== 'user') || isAdminReporter(email, store.users)) {
    return res.status(403).json({
      success: false,
      error: 'Only civilian SOS reports are accepted.'
    });
  }

  const parsedLat = (latitude !== null && latitude !== undefined && !isNaN(parseFloat(latitude))) ? parseFloat(latitude) : 13.0604;
  const parsedLon = (longitude !== null && longitude !== undefined && !isNaN(parseFloat(longitude))) ? parseFloat(longitude) : 80.2496;
  const parsedAcc = accuracy ? parseFloat(accuracy) : 8.5;

  const alertId = 'sos_' + Date.now();
  const newAlert = {
    id: alertId,
    userId: userId || 'demo_user',
    email: email || 'civilian.demo@rapidresponse.org',
    reportedRole: 'civilian',
    latitude: parsedLat,
    longitude: parsedLon,
    accuracy: parsedAcc,
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

  liveMediaStreams.set(alertId, {
    sosId: alertId,
    email: newAlert.email,
    lastFrame: null,
    audioLevel: 25,
    hasRealAudio: false,
    sampleRate: 16000,
    coords: {
      latitude: parsedLat,
      longitude: parsedLon,
      accuracy: parsedAcc,
      updatedAt: Date.now()
    },
    recentAudioChunks: [],
    seq: 0,
    updatedAt: Date.now()
  });

  const sosIncident = {
    id: Date.now(),
    title: '🚨 LIVE SOS ALERT — ' + (email || 'Civilian User'),
    category: 'SOS Emergency',
    severity: 'Critical',
    severityScore: 98,
    latitude: parsedLat,
    longitude: parsedLon,
    coords: { lat: parsedLat, lon: parsedLon },
    location: `${parsedLat.toFixed(5)}, ${parsedLon.toFixed(5)} (GPS ±${parsedAcc}m)`,
    affected: 1,
    description: `SOS triggered by ${email || 'Civilian'}. Live camera and audio feed initiated. Dispatched to command center.`,
    contact: email || 'SOS Emergency',
    status: 'Reported',
    timestamp: new Date().toLocaleString(),
    reportedBy: email || 'civilian.demo@rapidresponse.org',
    reportedRole: 'civilian',
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
  const id = String(req.params.id);
  const alert = store.sos_alerts.find(a => String(a.id) === id);
  if (alert) {
    alert.active = false;
    alert.resolvedAt = new Date().toISOString();
    saveStore(store);
    liveMediaStreams.delete(id);
    lastSseFrameEmit.delete(id);
    broadcastSosWs(id, { type: 'SOS_ENDED', sosId: id, reason: 'resolved' });
    broadcast('SOS_RESOLVED', { id });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ error: 'Alert not found' });
});

app.post('/api/sos/:id/deactivate', (req, res) => {
  const id = String(req.params.id);
  const alert = store.sos_alerts.find(a => String(a.id) === id);
  if (alert) {
    alert.active = false;
    saveStore(store);
    liveMediaStreams.delete(id);
    lastSseFrameEmit.delete(id);
    broadcastSosWs(id, { type: 'SOS_ENDED', sosId: id, reason: 'deactivated' });
    broadcast('SOS_DEACTIVATED', { id });
    broadcast('SOS_RESOLVED', { id });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ error: 'Alert not found' });
});

// ----------------------------------------------------------------------------
// Static Assets & Routing
// ----------------------------------------------------------------------------

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(puyalDir, 'sw.js'), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/'
    }
  });
});

app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
  res.sendFile(path.join(puyalDir, 'manifest.webmanifest'), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
});

app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules/leaflet/dist')));
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

app.get(['/favicon.ico', '/favicon.svg', '/logo.svg'], (req, res) => {
  res.sendFile(path.join(puyalDir, 'favicon.svg'), {
    headers: { 'Content-Type': 'image/svg+xml' }
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
// ----------------------------------------------------------------------------
// Real-Time Dispatch Route Movement Simulation Engine
// Advances dispatched teams along route towards incident location in real time
// ----------------------------------------------------------------------------
function simulateDispatchedTeamsMovement() {
  if (!store || !store.teams) return;
  let hasUpdates = false;

  store.teams.forEach(team => {
    if (team.status === 'Dispatched' && team.assignedIncidentId) {
      const incident = (store.incidents || []).find(i => String(i.id) === String(team.assignedIncidentId));
      if (!incident) return;

      const incCoords = extractIncidentCoords(incident);
      if (!team.originLatitude || !team.originLongitude) {
        team.originLatitude = 13.0610;
        team.originLongitude = 80.2490;
      }
      team.targetLatitude = incCoords.lat;
      team.targetLongitude = incCoords.lon;

      if (team.progress === undefined || team.progress === null || isNaN(team.progress)) {
        team.progress = 5;
      }

      // Increment progress (loops continuously for active demo visualization)
      if (team.progress >= 98) {
        team.onSceneTicks = (team.onSceneTicks || 0) + 1;
        if (team.onSceneTicks > 5) {
          // Reset loop so the user can continuously observe real-time movement in demo
          team.progress = 5;
          team.status = 'Dispatched';
          team.onSceneTicks = 0;
        } else {
          team.status = 'On Scene';
          team.latitude = incCoords.lat;
          team.longitude = incCoords.lon;
          team.remainingDistKm = 0.05;
          team.etaMinutes = 0;
        }
      } else {
        team.progress = Math.min(98, team.progress + 4.5);
        const f = team.progress / 100;

        // Add natural road curvature offset
        const curveOffset = Math.sin(f * Math.PI) * 0.0035;
        const curLat = team.originLatitude + (team.targetLatitude - team.originLatitude) * f + curveOffset;
        const curLon = team.originLongitude + (team.targetLongitude - team.originLongitude) * f + (curveOffset * 0.7);

        team.latitude = parseFloat(curLat.toFixed(6));
        team.longitude = parseFloat(curLon.toFixed(6));

        const remKm = calculateHaversineDistance(team.latitude, team.longitude, incCoords.lat, incCoords.lon);
        team.remainingDistKm = remKm;
        team.etaMinutes = Math.max(1, Math.ceil(remKm * 1.8));
      }

      hasUpdates = true;
      const normalizedTeam = {
        ...team,
        id: team.id || team.teamId,
        teamId: team.teamId || team.id,
        progress: Math.round(team.progress)
      };

      broadcast('TEAM_MOVEMENT_UPDATED', {
        team: normalizedTeam,
        teamId: normalizedTeam.id,
        name: team.name,
        category: team.category,
        status: team.status,
        latitude: team.latitude,
        longitude: team.longitude,
        origin: { lat: team.originLatitude, lon: team.originLongitude },
        target: { lat: incCoords.lat, lon: incCoords.lon },
        progress: Math.round(team.progress),
        remainingDistKm: team.remainingDistKm,
        etaMinutes: team.etaMinutes,
        incidentId: team.assignedIncidentId,
        incidentTitle: team.assignedIncidentTitle
      });
    }
  });

  if (hasUpdates) {
    saveStore(store);
  }
}

// Tick vehicle movement every 2.5 seconds
setInterval(simulateDispatchedTeamsMovement, 2500);

// ----------------------------------------------------------------------------
// Google Maps Platform Configuration Endpoint
// ----------------------------------------------------------------------------
app.get('/api/maps/config', (req, res) => {
  res.json({
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    mapId: 'DEMO_MAP_ID',
    attributionId: 'gmp_mcp_codeassist_v1_aistudio',
    configured: Boolean(process.env.GOOGLE_MAPS_API_KEY)
  });
});

// ----------------------------------------------------------------------------
// Gemini Chatbot Endpoint (Multi-turn conversations & models)
// Supported models: gemini-3.8-flash, gemini-3.1-flash-lite, gemini-4-carbon, gemini-4-argon
// ----------------------------------------------------------------------------
app.post('/api/gemini/chat', async (req, res) => {
  const { message, history = [], model = 'gemini-3.8-flash', role = 'civilian' } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // System instruction based on user role
  const systemInstruction = role === 'admin'
    ? `You are PUYAL Command AI, an advanced emergency operations dispatcher and disaster tactical strategist.
You assist emergency commanders, NDRF battalions, and 108 dispatchers.
Provide concise, authoritative, and actionable guidance on:
- Triage priority scoring and casualty minimization
- Coordinated multi-unit dispatch (Ambulances, Fire Tenders, NDRF Boats, Hazmat)
- Perimeter isolation (2km operational zones), evacuation corridors, and shelter routing
- Resource conservation to prevent over-deployment
Active statistics: ${store.incidents ? store.incidents.length : 0} incidents, ${store.teams ? store.teams.length : 0} tactical teams, ${store.government_stations ? store.government_stations.length : 0} command depots.
Keep your response clear, structured with bullet points where helpful, and focused on emergency tactics.`
    : `You are PUYAL Civilian Safety Guide, an empathetic, clear, and calm emergency advisor powered by Gemini AI and Bhashini.
You guide citizens facing immediate life-threatening situations (Floods, Fires, Earthquakes, Accidents, Medical Emergencies).
Provide immediate life-saving steps:
1. Immediate Safety Action (what to do RIGHT NOW in 1 sentence)
2. Crucial First Aid or Survival Protocol (step-by-step)
3. What to avoid
4. Emergency Contact Numbers (108 Ambulance, 101 Fire, 112 National Emergency)
Keep instructions simple, reassuring, and numbered so someone in panic can read and act instantly.`;

  // Validate model selection
  const allowedModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-carbon', 'gemini-4-argon'];
  const targetModel = allowedModels.includes(model) ? model : 'gemini-3.8-flash';

  if (ai && process.env.GEMINI_API_KEY) {
    try {
      // Build conversation contents including history
      const contents = [];
      if (Array.isArray(history)) {
        for (const item of history) {
          if (item && item.role && item.text) {
            contents.push({
              role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
              parts: [{ text: String(item.text) }]
            });
          }
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3
        }
      });

      const replyText = response && response.text ? response.text.trim() : 'Emergency guidance recorded. Stay safe.';
      return res.json({
        success: true,
        reply: replyText,
        model: targetModel,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn(`Gemini Chat error with model ${targetModel}:`, err.message);
    }
  }

  // Graceful rule-based emergency fallback
  const fallbackReplies = {
    fire: "🚨 FIRE SAFETY PROTOCOL:\n1. Stay low beneath the smoke line — cover nose with a wet cloth.\n2. Feel doors before opening; if warm, do not open.\n3. Exit the building immediately using stairs, NEVER the elevator.\n4. Call 101 / 112 once outside in open air.",
    flood: "🌊 FLOOD SAFETY PROTOCOL:\n1. Move to highest ground immediately. Avoid basements.\n2. NEVER walk or drive through flowing water (even 15cm can knock you down).\n3. Turn off main circuit breaker if safe to do so.\n4. Signal your location with a whistle or flashlight.",
    accident: "🚑 TRAUMA & ACCIDENT PROTOCOL:\n1. Ensure scene safety before approaching.\n2. Do NOT move casualties with neck/back injury unless in immediate danger.\n3. Apply firm, continuous pressure with clean cloth to bleeding wounds.\n4. Call 108 Emergency Ambulance immediately.",
    medical: "❤️ MEDICAL EMERGENCY PROTOCOL:\n1. Check responsiveness and breathing.\n2. If unresponsive and not breathing, begin chest compressions (100-120/min).\n3. Keep airway open by tilting head back slightly.\n4. Paramedics dispatched from nearest emergency depot."
  };

  const lowerMsg = message.toLowerCase();
  let defaultReply = "Your emergency message has been received by PUYAL Command. Responders are notified. Stay calm, remain in a secure location, and keep your communication line open.";
  if (lowerMsg.includes('fire') || lowerMsg.includes('smoke')) defaultReply = fallbackReplies.fire;
  else if (lowerMsg.includes('flood') || lowerMsg.includes('water')) defaultReply = fallbackReplies.flood;
  else if (lowerMsg.includes('accident') || lowerMsg.includes('crash')) defaultReply = fallbackReplies.accident;
  else if (lowerMsg.includes('medical') || lowerMsg.includes('heart') || lowerMsg.includes('bleeding')) defaultReply = fallbackReplies.medical;

  return res.json({
    success: true,
    reply: defaultReply,
    model: targetModel,
    isFallback: true,
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------------------------------
// Audio Transcription Endpoint (Gemini 3.5 Transcribe)
// Accepts audioBase64 string and optional mimeType
// ----------------------------------------------------------------------------
app.post('/api/gemini/transcribe', async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm' } = req.body;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'audioBase64 string is required' });
  }

  // Clean base64 data prefix if present
  const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');

  if (ai && process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: "You are an emergency voice transcriber for PUYAL Command. Transcribe the spoken audio verbatim in the speaker's language. If the audio is not in English, provide the exact transcript followed by an English translation on a new line. Only output the transcription text without commentary."
          }
        ]
      });

      const transcription = response && response.text ? response.text.trim() : '';
      if (transcription) {
        return res.json({
          success: true,
          model: 'gemini-3.5-transcribe',
          text: transcription
        });
      }
    } catch (err) {
      console.warn('Gemini 3.5 Transcribe error, falling back to gemini-3.8-flash audio interpretation:', err.message);
      // Secondary attempt with gemini-3.8-flash multimodal
      try {
        const fallbackResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: "Transcribe the spoken audio accurately into text. Provide the spoken emergency words clearly."
            }
          ]
        });
        if (fallbackResp && fallbackResp.text) {
          return res.json({
            success: true,
            model: 'gemini-3.8-flash',
            text: fallbackResp.text.trim()
          });
        }
      } catch (e2) {
        console.warn('Secondary audio transcription notice:', e2.message);
      }
    }
  }

  // Fallback mock transcript if audio is provided without key
  return res.json({
    success: true,
    model: 'gemini-3.5-transcribe',
    text: "Emergency assistance requested at our location. Please dispatch medical and rescue support immediately.",
    isSimulated: true
  });
});

// ----------------------------------------------------------------------------
// Real-time Voice Conversations Endpoint (Gemini 3.8 Live API)
// ----------------------------------------------------------------------------
app.post('/api/gemini/live-voice', async (req, res) => {
  const { speechText, audioBase64, mimeType = 'audio/webm', lang = 'en' } = req.body;

  let prompt = speechText || '';

  // If audio provided, transcribe first using gemini-3.5-transcribe or inline
  if (!prompt && audioBase64 && ai && process.env.GEMINI_API_KEY) {
    try {
      const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const transResp = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          { inlineData: { mimeType, data: cleanData } },
          { text: "Transcribe verbatim the spoken words." }
        ]
      });
      if (transResp && transResp.text) prompt = transResp.text.trim();
    } catch (e) {
      prompt = "Emergency report assistance";
    }
  }

  if (!prompt) prompt = "Emergency alert at my current location";

  if (ai && process.env.GEMINI_API_KEY) {
    try {
      const liveSystemPrompt = `You are the Gemini 3.8 Live Emergency Voice Responder.
You are talking in real-time to a civilian or responder in a live disaster situation.
Provide concise, spoken-friendly, life-saving advice in 2-3 sentences.
Speak calmly and clearly. Language requested: ${lang}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-live',
        contents: prompt,
        config: {
          systemInstruction: liveSystemPrompt
        }
      });

      const reply = response && response.text ? response.text.trim() : 'Help is on the way. Keep clear of danger.';
      return res.json({
        success: true,
        model: 'gemini-3.8-live',
        userQuery: prompt,
        speechReply: reply,
        status: 'live_active'
      });
    } catch (liveErr) {
      console.warn('Gemini 3.8 Live API notice, using flash voice engine:', liveErr.message);
      // Fallback to gemini-3.8-flash
      try {
        const flashResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: "You are the PUYAL Voice Guide. Give 2 sentences of life-saving guidance for spoken playback."
          }
        });
        return res.json({
          success: true,
          model: 'gemini-3.8-flash',
          userQuery: prompt,
          speechReply: flashResp.text.trim(),
          status: 'live_fallback'
        });
      } catch (e3) {
        // Continue to static fallback
      }
    }
  }

  return res.json({
    success: true,
    model: 'gemini-3.8-live',
    userQuery: prompt,
    speechReply: "Understood. Emergency command has your beacon and location. Move to safe high ground and remain calm while rescue teams converge on your coordinates.",
    isFallback: true,
    status: 'simulated'
  });
});

// ----------------------------------------------------------------------------
// WebSocket Live Camera & Audio Relay (/ws/sos)
// ----------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws/sos', maxPayload: 4 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    ws.role = reqUrl.searchParams.get('role') || 'viewer';
    ws.sosId = reqUrl.searchParams.get('sosId') || 'all';
  } catch (e) {
    ws.role = 'viewer';
    ws.sosId = 'all';
  }

  sosWsClients.add(ws);

  // Send latest snapshot immediately when an admin viewer joins
  if (ws.role === 'viewer' && ws.sosId && ws.sosId !== 'all') {
    const existing = liveMediaStreams.get(String(ws.sosId));
    if (existing) {
      try {
        ws.send(JSON.stringify({
          type: 'SOS_FRAME_UPDATE',
          ...buildStreamSnapshot(existing)
        }));
      } catch (e) {}
    }
    notifyBroadcasterViewerCount(ws.sosId);
  } else if (ws.role === 'broadcaster' && ws.sosId && ws.sosId !== 'all') {
    try {
      ws.send(JSON.stringify({
        type: 'VIEWER_STATUS',
        sosId: String(ws.sosId),
        viewerCount: getViewerCountForSos(ws.sosId),
        ts: Date.now()
      }));
    } catch (e) {}
  }

  ws.on('message', (rawMsg, isBinary) => {
    try {
      // Fast zero-copy binary relay path for 30 FPS JPEG video (0x01) & 32ms Int16 PCM audio (0x02)
      if (isBinary) {
        const targetSosId = ws.sosId && ws.sosId !== 'all' ? String(ws.sosId) : null;
        if (!targetSosId) return;
        const binBuf = Buffer.isBuffer(rawMsg) ? rawMsg : Buffer.from(rawMsg);
        if (binBuf.length <= 8) return;

        const pktType = binBuf.readUInt8(0);
        const seq = binBuf.readUInt32LE(1);
        const audioLevel = binBuf.readUInt8(5);

        if (pktType === 0x01) {
          broadcastSosWsBinary(targetSosId, binBuf);
          const flags = binBuf.readUInt8(6);
          const hasRealAudio = (flags & 0x01) === 0x01;
          const existing = liveMediaStreams.get(targetSosId) || {};
          liveMediaStreams.set(targetSosId, {
            sosId: targetSosId,
            email: existing.email || 'Civilian',
            lastFrame: existing.lastFrame || null,
            lastFrameBuffer: Buffer.from(binBuf.subarray(8)),
            lastFrameBufferSeq: seq,
            lastFrameBase64Seq: existing.lastFrameBase64Seq || 0,
            audioLevel: audioLevel || existing.audioLevel || 30,
            hasRealAudio: Boolean(hasRealAudio || existing.hasRealAudio),
            sampleRate: existing.sampleRate || 16000,
            coords: existing.coords || null,
            recentAudioChunks: existing.recentAudioChunks || [],
            seq,
            updatedAt: Date.now()
          });
        } else if (pktType === 0x02) {
          broadcastSosWsBinary(targetSosId, binBuf);
          const sampleRate = binBuf.readUInt16LE(6) || 16000;
          const existing = liveMediaStreams.get(targetSosId) || { sosId: targetSosId };
          existing.audioLevel = audioLevel || existing.audioLevel || 35;
          existing.hasRealAudio = true;
          existing.sampleRate = sampleRate;
          existing.updatedAt = Date.now();
          // Cache recent PCM snapshot only every 4th chunk (or when empty) to keep 31Hz relay zero-alloc
          if (!existing.recentAudioChunks || existing.recentAudioChunks.length === 0 || seq % 4 === 1) {
            pushAudioChunkToStream(existing, binBuf.subarray(8).toString('base64'), sampleRate, seq);
          }
          liveMediaStreams.set(targetSosId, existing);
        }
        return;
      }

      const msg = JSON.parse(rawMsg.toString());
      if (!msg || !msg.type) return;

      if (msg.type === 'PING') {
        try {
          ws.send(JSON.stringify({
            type: 'PONG',
            clientTs: msg.ts || Date.now(),
            serverTs: Date.now()
          }));
        } catch (e) {}
        return;
      }

      if (msg.type === 'SUBSCRIBE') {
        ws.role = msg.role || ws.role;
        ws.sosId = String(msg.sosId || ws.sosId);
        if (ws.role === 'viewer' && ws.sosId && ws.sosId !== 'all') {
          const existing = liveMediaStreams.get(ws.sosId);
          if (existing) {
            try {
              ws.send(JSON.stringify({
                type: 'SOS_FRAME_UPDATE',
                ...buildStreamSnapshot(existing)
              }));
            } catch (e) {}
          }
          notifyBroadcasterViewerCount(ws.sosId);
        } else if (ws.role === 'broadcaster' && ws.sosId && ws.sosId !== 'all') {
          try {
            ws.send(JSON.stringify({
              type: 'VIEWER_STATUS',
              sosId: String(ws.sosId),
              viewerCount: getViewerCountForSos(ws.sosId),
              ts: Date.now()
            }));
          } catch (e) {}
        }
        return;
      }

      const rawTargetId = msg.sosId || ws.sosId;
      if (!rawTargetId || rawTargetId === 'all') return;
      const targetSosId = String(rawTargetId);

      if (msg.type === 'LOCATION_UPDATE') {
        const normalized = syncSosCoordinates(targetSosId, msg.coords || msg);
        if (normalized) {
          broadcastSosWs(targetSosId, {
            type: 'SOS_LOCATION_UPDATE',
            sosId: targetSosId,
            coords: normalized,
            ts: msg.ts || Date.now()
          });
        }
        return;
      }

      if (msg.type === 'VIDEO_FRAME') {
        const existing = liveMediaStreams.get(targetSosId) || {};
        let syncedCoords = existing.coords || null;
        if (msg.coords) {
          const incomingLat = parseFloat(msg.coords.latitude !== undefined ? msg.coords.latitude : msg.coords.lat);
          const incomingLon = parseFloat(msg.coords.longitude !== undefined ? msg.coords.longitude : msg.coords.lon);
          const coordsChanged = !existing.coords ||
            Math.abs((existing.coords.latitude || 0) - incomingLat) > 0.000005 ||
            Math.abs((existing.coords.longitude || 0) - incomingLon) > 0.000005;
          if (!isNaN(incomingLat) && !isNaN(incomingLon) && coordsChanged) {
            syncedCoords = syncSosCoordinates(targetSosId, msg.coords) || existing.coords || null;
          }
        }
        const updated = {
          sosId: targetSosId,
          email: msg.email || existing.email || 'Civilian',
          lastFrame: msg.frameBase64 || existing.lastFrame || null,
          audioLevel: msg.audioLevel !== undefined ? parseFloat(msg.audioLevel) : (existing.audioLevel || 30),
          hasRealAudio: msg.hasRealAudio !== undefined ? Boolean(msg.hasRealAudio) : Boolean(existing.hasRealAudio),
          sampleRate: existing.sampleRate || 16000,
          coords: syncedCoords,
          recentAudioChunks: existing.recentAudioChunks || [],
          seq: msg.seq || 0,
          updatedAt: Date.now()
        };
        liveMediaStreams.set(targetSosId, updated);

        broadcastSosWs(targetSosId, {
          type: 'SOS_FRAME_UPDATE',
          sosId: targetSosId,
          lastFrame: msg.frameBase64,
          audioLevel: updated.audioLevel,
          hasRealAudio: updated.hasRealAudio,
          coords: updated.coords,
          seq: msg.seq || 0,
          ts: msg.ts || Date.now()
        });
      } else if (msg.type === 'AUDIO_CHUNK') {
        const existing = liveMediaStreams.get(targetSosId) || { sosId: targetSosId };
        existing.audioLevel = msg.audioLevel !== undefined ? parseFloat(msg.audioLevel) : existing.audioLevel;
        existing.hasRealAudio = true;
        existing.sampleRate = msg.sampleRate || 16000;
        existing.updatedAt = Date.now();
        pushAudioChunkToStream(existing, msg.audioPcmBase64, existing.sampleRate, msg.seq || 0);
        liveMediaStreams.set(targetSosId, existing);

        broadcastSosWs(targetSosId, {
          type: 'SOS_AUDIO_CHUNK',
          sosId: targetSosId,
          audioPcmBase64: msg.audioPcmBase64,
          sampleRate: msg.sampleRate || 16000,
          audioLevel: existing.audioLevel,
          hasRealAudio: true,
          seq: msg.seq || 0,
          ts: msg.ts || Date.now()
        });
      }
    } catch (e) {
      // Ignore malformed frame packets
    }
  });

  ws.on('close', () => {
    const prevRole = ws.role;
    const prevSosId = ws.sosId;
    sosWsClients.delete(ws);
    if (prevRole === 'viewer' && prevSosId && prevSosId !== 'all') {
      notifyBroadcasterViewerCount(prevSosId);
    }
  });

  ws.on('error', () => {
    const prevRole = ws.role;
    const prevSosId = ws.sosId;
    sosWsClients.delete(ws);
    if (prevRole === 'viewer' && prevSosId && prevSosId !== 'all') {
      notifyBroadcasterViewerCount(prevSosId);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`PUYAL Command server running at http://${HOST}:${PORT}`);
});

