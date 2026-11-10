# RapidResponse Command — Disaster Management & Emergency Operations Center

RapidResponse Command is a real-time emergency dispatch and disaster response platform connecting civilian distress reports, live SOS audio/video streaming, government fleet stations, and specialized emergency response teams.

---

## 🛡️ Master Admin Credentials

| Parameter | Value |
|---|---|
| **Master Admin Email** | `master.admin@rapidresponse.gov` |
| **Master Admin Password** | `MasterAdmin@2026!` |
| **Role** | Supreme Master Commander (Full System Access) |
| **1-Click Login** | Available on `/puyal/login-admin.html` |

### Demo Accounts
- **HQ Demo Admin**: `admin.demo@rapidresponse.org` / `demopassword123`
- **Civilian Demo User**: `civilian.demo@rapidresponse.org` / `demopassword123`

---

## 🚀 Key Features

1. **Location-Based Team Assignment & Smart AI Dispatch**
   - Algorithm based distance calculations from incident GPS coordinates to station bases.
   - Smart classification: Category Expertise (45%), Proximity Distance (40%), Readiness Status (15%).
   - 1-Click Dispatch: Dispatches best-fit team, marks team busy, and sets incident status to best fit .

2. **Tactical GIS Disaster Map & Real-Time Route Visualizer**
   - **Open-source Leaflet + OpenStreetMap engine** (no external API keys required).
   - **Disaster Hazard Pins**: Category badges (🔥 Fire, 🌊 Flood, 🩹 Medical, 🚗 Crash, 🏚️ Collapse, 🚨 SOS) with priority pulse halos.
   - **Emergency Vehicles**: Field team units (🚒, 🚑, 🚤, 🚨, 🏗️, ☣️) with readiness borders (Available, Dispatched, On Scene).
   - **Station Command Depots**: Depot locations with fleet inventory breakdown.
   - **Civilian SOS GPS Beacons**: Pulsing distress beacons with one-click live stream access.
   - **2 km Tactical Response Perimeters**: Visualizes the immediate 2000m impact zone around each disaster.
   - **Dispatch Routes & ETA**: Dashed routing vectors between dispatched teams and their target disaster with real-time distance and estimated transit time.

3. **Advanced Operations Analytics Dashboard**
   - 6 Key Operational KPIs: Total Incidents, Critical Incidents, Available Teams, Busy Teams, Assigned Incidents, Resolved Incidents.
   - Incident Distribution by Category: Visual breakdown bars with counts and percentages across all disaster categories.
   - Regional Threat Severity Index & Fleet Readiness Rate.

4. **Live Civilian Video & Audio Streaming**
   - Real-time video frame transmission from civilian camera feeds.
   - Live acoustic visualizer & optional audio monitor for command operators.

5. **Voice Access for easy S.O.S reporting**
   - Multiple languages speech-to-text api integration
   
---

## 🌐 Running Locally
```bash
npm install
npm run dev
# Server runs on port 3000
```
Open `http://localhost:3000/puyal/` to access the platform.
