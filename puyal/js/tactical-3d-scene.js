// ============================================================================
// RapidResponse Command — Three.js 3D Tactical Sector Digital Twin
// Procedural PBR Engine: RoomEnvironment IBL, ACESFilmicToneMapping,
// SRGBColorSpace, InstancedMesh urban/coastal sector, composite 3D fleets,
// zero external assets, software-WebGL guard, and zero-allocation rAF loop.
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ORIGIN_LAT = 13.0604;
const ORIGIN_LNG = 80.2496;
const GEO_TO_WORLD_SCALE = 360; // ~0.1 deg spans +/-36 world units

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function geoToWorld(lat, lng, outVec) {
  const fLat = Number.isFinite(parseFloat(lat)) ? parseFloat(lat) : ORIGIN_LAT;
  const fLng = Number.isFinite(parseFloat(lng)) ? parseFloat(lng) : ORIGIN_LNG;
  const x = THREE.MathUtils.clamp((fLng - ORIGIN_LNG) * GEO_TO_WORLD_SCALE, -38, 25);
  const z = THREE.MathUtils.clamp(-(fLat - ORIGIN_LAT) * GEO_TO_WORLD_SCALE, -38, 38);
  outVec.set(x, 0, z);
  return outVec;
}

function createGroundTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Asphalt-slate base terrain
  ctx.fillStyle = '#182235';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle sector grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Primary Arterial Corridors (NH-48 North-South & Central East-West)
  ctx.fillStyle = '#243044';
  ctx.fillRect(468, 0, 72, 1024);
  ctx.fillRect(0, 480, 820, 64);

  // Diagonal Port Link
  ctx.save();
  ctx.translate(504, 512);
  ctx.rotate(-0.42);
  ctx.fillRect(-380, -24, 720, 48);
  ctx.restore();

  // Road Center Markings
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(504, 0);
  ctx.lineTo(504, 1024);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(815, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  // Coastal Shoreline Sand Strip on East Edge
  const coastGrad = ctx.createLinearGradient(790, 0, 870, 0);
  coastGrad.addColorStop(0, '#182235');
  coastGrad.addColorStop(0.65, '#475569');
  coastGrad.addColorStop(1, '#0f2a4a');
  ctx.fillStyle = coastGrad;
  ctx.fillRect(790, 0, 234, 1024);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  return tex;
}

function createFacadeTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 512);

  const rand = mulberry32(4219);
  for (let y = 16; y < 496; y += 28) {
    for (let x = 16; x < 240; x += 28) {
      const lit = rand() > 0.45;
      ctx.fillStyle = lit ? 'rgba(125, 211, 252, 0.42)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x, y, 16, 18);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, maxAnisotropy || 1);
  return tex;
}

function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.35)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Tactical3DScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.pmremGenerator = null;
    this.envRT = null;

    this.isSoftwareGl = false;
    this.disposed = false;
    this.rafId = 0;
    this.afterDrawTimer = 0;

    this.autoOrbit = false;
    this.showPerimeters = true;
    this.followDispatched = false;

    this.entityGroups = {
      depots: new Map(),
      teams: new Map(),
      incidents: new Map(),
      sos: new Map()
    };
    this.routeLines = new Map();
    this.selectableRoots = [];
    this.selectedMeta = null;

    // Pre-allocated scratch math (zero allocation inside rAF tick)
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._pointer = new THREE.Vector2();
    this._raycaster = new THREE.Raycaster();
    this._camTargetGoal = new THREE.Vector3();
    this._camPosGoal = new THREE.Vector3();
    this._cameraAnimating = false;
    this._lastTime = performance.now();
    this._elapsed = 0;

    this._shared = {};
    this._boundResize = () => this.resize();
    this._boundPointerDown = (e) => this._onPointerDown(e);
  }

  init() {
    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);

    // Detect software WebGL prior to selecting heavy shadow/DPR budgets
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (probeGl) {
      const dbg = probeGl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = dbg ? String(probeGl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      this.isSoftwareGl = /SwiftShader|llvmpipe|softpipe/i.test(rendererStr);
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isSoftwareGl ? 1.0 : 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Scene & horizon-matched fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.FogExp2(0x0b1220, 0.0115);

    // Studio PBR IBL via RoomEnvironment + PMREMGenerator
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.78;
    roomEnv.dispose();

    // Perspective camera framed diagonally across the coastal metro sector
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 220);
    this.camera.position.set(-28, 26, 34);

    // Damped OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.455;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 85;
    this.controls.target.set(0, 0.5, 0);

    // Stop camera fly-to when user grabs the scene manually
    this.controls.addEventListener('start', () => {
      this._cameraAnimating = false;
      this.followDispatched = false;
    });

    this._setupLighting();
    this._setupSharedAssets();
    this._buildTerrainAndCity();

    window.addEventListener('resize', this._boundResize);
    this.renderer.domElement.addEventListener('pointerdown', this._boundPointerDown);

    this._lastTime = performance.now();
    this._scheduleNextFrame();
  }

  _setupLighting() {
    const hemi = new THREE.HemisphereLight(0x8bb8e8, 0x1e293b, 0.75);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.25);
    sun.position.set(34, 48, 28);
    sun.castShadow = true;
    const shadowSize = this.isSoftwareGl ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 130;
    const d = 46;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.52);
    rim.position.set(-36, 20, -28);
    this.scene.add(rim);
  }

  _setupSharedAssets() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this._shared.groundTex = createGroundTexture(maxAniso);
    this._shared.facadeTex = createFacadeTexture(maxAniso);
    this._shared.shadowTex = createContactShadowTexture();

    this._shared.contactShadowMat = new THREE.MeshBasicMaterial({
      map: this._shared.shadowTex,
      transparent: true,
      depthWrite: false
    });
    this._shared.shadowGeo = new THREE.PlaneGeometry(3.4, 3.4);

    // Distinct roughness/metalness materials
    this._shared.tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.92, metalness: 0.05 });
    this._shared.chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.22, metalness: 0.88 });
    this._shared.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08
    });
    this._shared.concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.86, metalness: 0.05 });
    this._shared.fireBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      roughness: 0.28,
      metalness: 0.22,
      clearcoat: 0.85
    });
    this._shared.ambBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.34,
      metalness: 0.1,
      clearcoat: 0.6
    });
    this._shared.boatHullMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.25 });
    this._shared.rescueOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.38, metalness: 0.15 });
  }

  _buildTerrainAndCity() {
    // 1. Coastal & Metro Ground Plane
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this._shared.groundTex,
      roughness: 0.84,
      metalness: 0.08
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Bay of Bengal Coastal Water Strip on +X edge
    const waterGeo = new THREE.PlaneGeometry(24, 100);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0c4a6e,
      roughness: 0.16,
      metalness: 0.42
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(38, 0.03, 0);
    water.receiveShadow = true;
    this.scene.add(water);

    // 3. Instanced Urban City Blocks (muted navy-slate palette, avoiding road corridors)
    const rand = mulberry32(9001);
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      map: this._shared.facadeTex,
      roughness: 0.55,
      metalness: 0.28
    });
    const buildingCount = 72;
    const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, buildingCount);
    buildings.castShadow = true;
    buildings.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    while (placed < buildingCount && attempts < 500) {
      attempts++;
      const bx = (rand() - 0.54) * 72;
      const bz = (rand() - 0.5) * 74;
      // Keep roads and coastal ocean clear
      if (bx > 23) continue;
      if (Math.abs(bx) < 4.5 || Math.abs(bz) < 4.5) continue;

      const bw = 2.0 + rand() * 2.4;
      const bd = 2.0 + rand() * 2.4;
      const bh = 2.2 + rand() * 6.5;

      dummy.position.set(bx, bh * 0.5, bz);
      dummy.rotation.set(0, (rand() - 0.5) * 0.12, 0);
      dummy.scale.set(bw, bh, bd);
      dummy.updateMatrix();
      buildings.setMatrixAt(placed, dummy.matrix);

      const shade = 0.65 + rand() * 0.35;
      color.setRGB(shade * 0.72, shade * 0.82, shade);
      buildings.setColorAt(placed, color);
      placed++;
    }
    buildings.count = placed;
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    buildings.computeBoundingSphere();
    this.scene.add(buildings);

    // 4. Instanced Coastal & Park Trees (Trunks + Crowns)
    const treeCount = 48;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, metalness: 0.0 });
    const crownGeo = new THREE.DodecahedronGeometry(0.85, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78, metalness: 0.02 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
    crowns.castShadow = true;

    let tPlaced = 0;
    attempts = 0;
    while (tPlaced < treeCount && attempts < 400) {
      attempts++;
      const tx = 14 + rand() * 11;
      const tz = (rand() - 0.5) * 76;
      if (Math.abs(tz) < 4.5) continue;
      const scaleJitter = 0.85 + rand() * 0.3;

      dummy.position.set(tx, 0.65 * scaleJitter, tz);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(scaleJitter);
      dummy.updateMatrix();
      trunks.setMatrixAt(tPlaced, dummy.matrix);

      dummy.position.set(tx, 1.75 * scaleJitter, tz);
      dummy.updateMatrix();
      crowns.setMatrixAt(tPlaced, dummy.matrix);
      color.setRGB(0.82 + rand() * 0.18, 0.95, 0.82 + rand() * 0.15);
      crowns.setColorAt(tPlaced, color);
      tPlaced++;
    }
    trunks.count = tPlaced;
    crowns.count = tPlaced;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    this.scene.add(trunks);
    this.scene.add(crowns);
  }

  _addContactShadow(group, scale = 1.0) {
    const shadow = new THREE.Mesh(this._shared.shadowGeo, this._shared.contactShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.scale.setScalar(scale);
    group.add(shadow);
  }

  // Composite Multi-Part Group: Command Depot (6 parts, bottom-center pivot y=0)
  _createDepotGroup(stn) {
    const group = new THREE.Group();
    this._addContactShadow(group, 1.9);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 5.2), this._shared.concreteMat);
    pad.position.y = 0.175;
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);

    const coreTower = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.2, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.55 })
    );
    coreTower.position.set(-0.6, 1.95, 0);
    coreTower.castShadow = true;
    group.add(coreTower);

    const obsDeck = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.75, 2.65), this._shared.glassMat);
    obsDeck.position.set(-0.6, 3.3, 0);
    group.add(obsDeck);

    const helipad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.65, metalness: 0.25 })
    );
    helipad.position.set(1.4, 0.39, 0.9);
    group.add(helipad);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.1, 8), this._shared.chromeMat);
    mast.position.set(-0.6, 4.7, -0.4);
    group.add(mast);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.8 })
    );
    beacon.position.set(-0.6, 5.8, -0.4);
    group.add(beacon);

    group.userData = {
      entityType: 'Command Depot',
      id: stn.stationId,
      title: stn.name,
      subtitle: `${stn.zone || 'Metro Sector'} • Fleet Ready`,
      details: `Contact: ${stn.contact || '+91 108'}`
    };
    return group;
  }

  // Composite Multi-Part Group: Response Vehicle (Fire Tender / Ambulance / Boat)
  _createVehicleGroup(team) {
    const group = new THREE.Group();
    this._addContactShadow(group, 0.95);

    if (team.category === 'Flood') {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 2.7), this._shared.boatHullMat);
      hull.position.y = 0.35;
      hull.castShadow = true;
      group.add(hull);

      const pLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.5, 10), this._shared.rescueOrangeMat);
      pLeft.rotation.x = Math.PI / 2;
      pLeft.position.set(-0.72, 0.42, 0);
      group.add(pLeft);

      const pRight = pLeft.clone();
      pRight.position.x = 0.72;
      group.add(pRight);

      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 16, Math.PI), this._shared.chromeMat);
      arch.position.set(0, 0.62, -0.4);
      group.add(arch);
    } else {
      const isFire = team.category === 'Fire';
      const bodyMat = isFire ? this._shared.fireBodyMat : this._shared.ambBodyMat;

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 2.9), this._shared.tireMat);
      chassis.position.y = 0.42;
      chassis.castShadow = true;
      group.add(chassis);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.95, 2.75), bodyMat);
      cabin.position.y = 1.05;
      cabin.castShadow = true;
      group.add(cabin);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.42, 0.14), this._shared.glassMat);
      windshield.position.set(0, 1.18, 1.35);
      group.add(windshield);

      // Four grounded tires (pivot respects y=0)
      const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
      const wheelOffsets = [
        [-0.72, 0.32, 0.92],
        [0.72, 0.32, 0.92],
        [-0.72, 0.32, -0.92],
        [0.72, 0.32, -0.92]
      ];
      wheelOffsets.forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(wheelGeo, this._shared.tireMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, wy, wz);
        w.castShadow = true;
        group.add(w);
      });

      if (isFire) {
        const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 2.1), this._shared.chromeMat);
        ladder.position.set(0, 1.62, -0.2);
        group.add(ladder);
      } else {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.18, 2.4), this._shared.fireBodyMat);
        stripe.position.set(0, 0.96, -0.1);
        group.add(stripe);
      }

      const lightColor = team.status === 'Dispatched' ? 0xef4444 : 0x38bdf8;
      const lightBarMat = new THREE.MeshStandardMaterial({
        color: lightColor,
        emissive: lightColor,
        emissiveIntensity: team.status === 'Dispatched' ? 2.2 : 0.9
      });
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.25), lightBarMat);
      lightBar.position.set(0, 1.62, 0.92);
      lightBar.name = 'lightbar';
      group.add(lightBar);
      group.userData.lightBarMat = lightBarMat;
    }

    group.userData = {
      ...group.userData,
      entityType: 'Response Unit',
      id: team.teamId || team.id,
      title: team.name,
      subtitle: `${team.status || 'Available'} • ${team.category || 'EMS'}`,
      details: team.assignedIncidentTitle
        ? `Target: ${team.assignedIncidentTitle} (ETA ~${team.etaMinutes || 3} min)`
        : 'Station Standby Ready'
    };
    return group;
  }

  // Composite Multi-Part Group: Incident Threat Beacon + 2km Scaled Perimeter
  _createIncidentGroup(inc) {
    const group = new THREE.Group();
    const isCrit = inc.severity === 'Critical';
    const isHigh = inc.severity === 'High';
    const hex = isCrit ? 0xef4444 : isHigh ? 0xf97316 : 0x38bdf8;

    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.35, 24),
      new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.06;
    group.add(baseRing);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.24, 3.2, 12),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.75, transparent: true, opacity: 0.65 })
    );
    pillar.position.y = 1.6;
    group.add(pillar);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.65 })
    );
    crystal.position.y = 4.1;
    crystal.name = 'floatingCore';
    group.add(crystal);

    const perim = new THREE.Mesh(
      new THREE.RingGeometry(5.6, 5.85, 48),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    perim.rotation.x = -Math.PI / 2;
    perim.position.y = 0.07;
    perim.visible = this.showPerimeters && (isCrit || isHigh);
    perim.name = 'perimeterRing';
    group.add(perim);

    group.userData = {
      entityType: `${inc.severity || 'Active'} Incident`,
      id: inc.id,
      title: inc.title,
      subtitle: `${inc.category || 'Disaster'} • Priority #${inc.priorityRank || 1}`,
      details: `${inc.location || 'Sector Zone'} • Affected: ${inc.affected || 1}`
    };
    return group;
  }

  _createSosGroup(sos) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 2.0,
      roughness: 0.25
    });

    const disc = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 28), new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.08;
    group.add(disc);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 12), mat);
    mast.position.y = 2.2;
    group.add(mast);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 10, 28), mat);
    halo.position.y = 4.8;
    halo.name = 'floatingCore';
    group.add(halo);

    group.userData = {
      entityType: 'Live Civilian SOS',
      id: sos.id,
      title: sos.email || sos.userEmail || 'Civilian Distress Beacon',
      subtitle: 'Emergency Audio/Video Stream Active',
      details: `GPS: ${Number(sos.latitude || ORIGIN_LAT).toFixed(4)}, ${Number(sos.longitude || ORIGIN_LNG).toFixed(4)}`
    };
    return group;
  }

  syncOperationalState({ incidents = [], teams = [], stations = [], sosAlerts = [] }) {
    if (this.disposed || !this.scene) return;

    this.selectableRoots = [];

    // Helper to reconcile a category map
    const syncCollection = (map, items, getId, factory, getLatLng) => {
      const seen = new Set();
      items.forEach(item => {
        const key = String(getId(item));
        seen.add(key);
        let group = map.get(key);
        if (!group) {
          group = factory(item);
          group.userData.targetWorld = new THREE.Vector3();
          geoToWorld(...getLatLng(item), group.userData.targetWorld);
          group.position.copy(group.userData.targetWorld);
          map.set(key, group);
          this.scene.add(group);
        } else {
          geoToWorld(...getLatLng(item), group.userData.targetWorld);
          // Refresh details text
          if (item.assignedIncidentTitle) {
            group.userData.subtitle = `${item.status} • ${item.category}`;
            group.userData.details = `Target: ${item.assignedIncidentTitle} (ETA ~${item.etaMinutes || 3} min)`;
          }
        }
        this.selectableRoots.push(group);
      });

      for (const [key, grp] of map.entries()) {
        if (!seen.has(key)) {
          this.scene.remove(grp);
          map.delete(key);
        }
      }
    };

    syncCollection(
      this.entityGroups.depots,
      stations,
      s => s.stationId,
      s => this._createDepotGroup(s),
      s => [s.latitude, s.longitude]
    );

    syncCollection(
      this.entityGroups.incidents,
      incidents,
      i => i.id,
      i => this._createIncidentGroup(i),
      i => [i.latitude || (i.coords && i.coords.lat), i.longitude || (i.coords && i.coords.lon)]
    );

    syncCollection(
      this.entityGroups.teams,
      teams,
      t => t.teamId || t.id,
      t => this._createVehicleGroup(t),
      t => [t.latitude, t.longitude]
    );

    const activeSos = sosAlerts.filter(s => s.active);
    syncCollection(
      this.entityGroups.sos,
      activeSos,
      s => s.id,
      s => this._createSosGroup(s),
      s => [s.latitude, s.longitude]
    );

    // Dispatch Route Arcs
    const activeRouteIds = new Set();
    teams.forEach(team => {
      if (team.status === 'Dispatched' && team.originLatitude && team.targetLatitude) {
        const key = String(team.teamId || team.id);
        activeRouteIds.add(key);
        if (!this.routeLines.has(key)) {
          const p0 = geoToWorld(team.originLatitude, team.originLongitude, new THREE.Vector3());
          const p2 = geoToWorld(team.targetLatitude, team.targetLongitude, new THREE.Vector3());
          const mid = p0.clone().add(p2).multiplyScalar(0.5);
          mid.y = 3.2;
          const curve = new THREE.QuadraticBezierCurve3(p0.setY(0.18), mid, p2.setY(0.18));
          const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.1, 6, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x10b981,
            emissiveIntensity: 0.75
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          this.scene.add(tube);
          this.routeLines.set(key, tube);
        }
      }
    });

    for (const [key, mesh] of this.routeLines.entries()) {
      if (!activeRouteIds.has(key)) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.scene.remove(mesh);
        this.routeLines.delete(key);
      }
    }
  }

  setPerimeterVisibility(visible) {
    this.showPerimeters = Boolean(visible);
    this.entityGroups.incidents.forEach(grp => {
      const ring = grp.getObjectByName('perimeterRing');
      if (ring) ring.visible = this.showPerimeters;
    });
  }

  setAutoOrbit(enabled) {
    this.autoOrbit = Boolean(enabled);
    if (this.controls) {
      this.controls.autoRotate = this.autoOrbit;
      this.controls.autoRotateSpeed = 0.85;
    }
  }

  focusPreset(mode) {
    this.followDispatched = false;
    if (mode === 'overview') {
      this._camPosGoal.set(-28, 26, 34);
      this._camTargetGoal.set(0, 0.5, 0);
      this._cameraAnimating = true;
    } else if (mode === 'hq') {
      const firstDepot = this.entityGroups.depots.values().next().value;
      const p = firstDepot ? firstDepot.position : this._v1.set(0, 0, 0);
      this._camTargetGoal.copy(p).setY(1.2);
      this._camPosGoal.set(p.x - 12, 11, p.z + 14);
      this._cameraAnimating = true;
    } else if (mode === 'incident') {
      const firstInc = this.entityGroups.incidents.values().next().value;
      const p = firstInc ? firstInc.position : this._v1.set(6, 0, -4);
      this._camTargetGoal.copy(p).setY(1.2);
      this._camPosGoal.set(p.x - 11, 10, p.z + 13);
      this._cameraAnimating = true;
    } else if (mode === 'dispatch') {
      this.followDispatched = true;
      const firstRoute = this.entityGroups.teams.values().next().value;
      if (firstRoute) {
        this._camTargetGoal.copy(firstRoute.position).setY(1.0);
        this._camPosGoal.set(firstRoute.position.x - 10, 9, firstRoute.position.z + 12);
        this._cameraAnimating = true;
      }
    }
  }

  _onPointerDown(event) {
    if (!this.renderer || !this.camera) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this.selectableRoots, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.entityType && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData && obj.userData.entityType) {
        this.selectedMeta = obj.userData;
        if (typeof this.callbacks.onSelect === 'function') {
          this.callbacks.onSelect(this.selectedMeta);
        }
        this._camTargetGoal.copy(obj.position).setY(1.2);
        this._camPosGoal.set(obj.position.x - 10, 9, obj.position.z + 11);
        this._cameraAnimating = true;
      }
    }
  }

  _scheduleNextFrame() {
    if (this.disposed) return;
    const tick = (now) => {
      if (this.disposed) return;
      const rawDt = (now - this._lastTime) * 0.001;
      this._lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      this._elapsed += dt;

      this._update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDrawTimer = window.setTimeout(() => {
          this.rafId = window.requestAnimationFrame(tick);
        }, 12);
      } else {
        this.rafId = window.requestAnimationFrame(tick);
      }
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  _update(dt) {
    // Smooth vehicle telemetry interpolation + orientation (no allocation)
    this.entityGroups.teams.forEach(grp => {
      const target = grp.userData.targetWorld;
      if (target) {
        const dx = target.x - grp.position.x;
        const dz = target.z - grp.position.z;
        if (dx * dx + dz * dz > 0.0004) {
          this._v1.copy(target);
          grp.lookAt(this._v1);
        }
        grp.position.x = THREE.MathUtils.damp(grp.position.x, target.x, 4.5, dt);
        grp.position.z = THREE.MathUtils.damp(grp.position.z, target.z, 4.5, dt);
      }
      if (grp.userData.lightBarMat) {
        const pulse = 0.8 + 1.4 * Math.abs(Math.sin(this._elapsed * 5.2));
        grp.userData.lightBarMat.emissiveIntensity = pulse;
      }
    });

    // Spin floating threat/SOS beacon cores cleanly
    this.entityGroups.incidents.forEach(grp => {
      const core = grp.getObjectByName('floatingCore');
      if (core) {
        core.rotation.y += dt * 1.4;
        core.position.y = 4.1 + Math.sin(this._elapsed * 2.4) * 0.25;
      }
    });

    this.entityGroups.sos.forEach(grp => {
      const halo = grp.getObjectByName('floatingCore');
      if (halo) {
        halo.rotation.y += dt * 2.1;
        halo.rotation.x = Math.sin(this._elapsed * 1.8) * 0.35;
      }
    });

    // Frame-rate independent exponential damping for camera focus transitions
    if (this._cameraAnimating) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this._camPosGoal.x, 6.0, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this._camPosGoal.y, 6.0, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this._camPosGoal.z, 6.0, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this._camTargetGoal.x, 6.0, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this._camTargetGoal.y, 6.0, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this._camTargetGoal.z, 6.0, dt);

      if (this.camera.position.distanceToSquared(this._camPosGoal) < 0.04) {
        this._cameraAnimating = false;
      }
    }

    this.controls.update();
  }

  resize() {
    if (!this.renderer || !this.camera || !this.container) return;
    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.afterDrawTimer);
    window.removeEventListener('resize', this._boundResize);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this._boundPointerDown);
    }

    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });

    if (this.envRT) this.envRT.dispose();
    if (this.pmremGenerator) this.pmremGenerator.dispose();
    if (this.controls) this.controls.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
