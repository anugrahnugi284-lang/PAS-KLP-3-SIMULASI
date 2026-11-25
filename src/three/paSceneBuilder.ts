import * as THREE from 'three';
import type { ComponentKey, NodeKey } from '../data/systemCatalog';

export interface AnimatedLayer {
  mesh: THREE.Mesh;
  baseX: number;
  idx: number;
}

export interface AnimatedFader {
  mesh: THREE.Mesh;
  phase: number;
}

export interface SignalParticle {
  mesh: THREE.Mesh;
  t: number;
}

export interface PaSceneRig {
  clickableMeshes: THREE.Object3D[];
  partMeshes: Map<ComponentKey, THREE.Mesh[]>;
  micLayers: AnimatedLayer[];
  spkLayers: AnimatedLayer[];
  spkSatellites: THREE.Group[];
  acousticRings: THREE.Mesh[];
  mixerFaders: AnimatedFader[];
  signals: SignalParticle[];
  pathCurve: THREE.CatmullRomCurve3;
  // Casing animation pivots
  micCasingGroup: THREE.Group;
  mixerCasingPivot: THREE.Group;
  ampCasingPivot: THREE.Group;
  spkCasingGroup: THREE.Group;
  // Live sensor simulation objects
  soundSensorWaves: THREE.Mesh[];
  soundDoLedMat: THREE.MeshStandardMaterial;
  soundTriggerPulse: THREE.Mesh;
  soundWireCurve: THREE.CatmullRomCurve3;
  acsFluxRings: THREE.Mesh[];
  acsTripPulse: THREE.Mesh;
  acsWireCurve: THREE.CatmullRomCurve3;
  tempAuraMat: THREE.MeshBasicMaterial;
  tempAuraMesh: THREE.Mesh;
  tempCollarRingMat: THREE.MeshStandardMaterial;
  // Dynamic component materials
  pttMat: THREE.MeshStandardMaterial;
  priorityRelayMat: THREE.MeshStandardMaterial;
  protectRelayMat: THREE.MeshStandardMaterial;
  protectLedMat: THREE.MeshStandardMaterial;
  heatsinkMat: THREE.MeshStandardMaterial;
  soundSensorLedMat: THREE.MeshStandardMaterial;
  acsLedMat: THREE.MeshStandardMaterial;
  unitHighlightRings: Record<NodeKey, THREE.Mesh>;
  disposables: {
    geometries: THREE.BufferGeometry[];
    materials: THREE.Material[];
    textures: THREE.Texture[];
  };
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(2, 6, 18, 0.72)');
    grad.addColorStop(0.55, 'rgba(2, 6, 18, 0.34)');
    grad.addColorStop(1, 'rgba(2, 6, 18, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrushedMetalTexture(maxAniso: number, baseHex = '#334155'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      const alpha = ((y * 19) % 24) / 255;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, y, 256, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createPcbSilkscreenTexture(
  baseColor: string,
  traceColor: string,
  lines: string[],
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 4;
    for (let i = 40; i < 470; i += 52) {
      ctx.beginPath();
      ctx.moveTo(24, i);
      ctx.lineTo(190, i);
      ctx.lineTo(240, i + 20);
      ctx.lineTo(486, i + 20);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
    ctx.font = 'bold 28px monospace';
    lines.forEach((line, idx) => {
      ctx.fillText(line, 24, 52 + idx * 46);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createFaceplateTexture(title: string, subtitle: string, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 1008, 240);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(title, 44, 102);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px monospace';
    ctx.fillText(subtitle, 44, 152);

    // Decorative vent slots on right
    ctx.fillStyle = '#020617';
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(700 + i * 28, 56, 14, 144);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function buildPaScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): PaSceneRig {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const shadowTex = trackTex(createContactShadowTexture());
  const brushedTex = trackTex(createBrushedMetalTexture(maxAniso, '#334155'));
  const darkRackTex = trackTex(createBrushedMetalTexture(maxAniso, '#111827'));
  const mixerPcbTex = trackTex(
    createPcbSilkscreenTexture('#0d6e66', '#14b8a6', ['PRE-AMP / EQ', 'PRIORITY RELAY', 'SUMMING BUFFER'], maxAniso)
  );
  const soundPcbTex = trackTex(
    createPcbSilkscreenTexture('#1d4ed8', '#60a5fa', ['SOUND MOD', 'MIC   LM393', 'VCC  GND  OUT'], maxAniso)
  );
  const acsPcbTex = trackTex(
    createPcbSilkscreenTexture('#1d4ed8', '#60a5fa', ['ACS712 20A', 'HALL CURRENT', 'IP+       IP-'], maxAniso)
  );
  const mixerFaceTex = trackTex(
    createFaceplateTexture('PA-1600 PRE-AMP / MIXER', 'CH1-4 GAIN · 3-BAND EQ · PRIORITY OVERRIDE', maxAniso)
  );
  const ampFaceTex = trackTex(
    createFaceplateTexture('PA-500D 100V LINE AMP', 'DUAL TOROID · MOSFET · PROTECT · 100V OUT', maxAniso)
  );

  // Studio floor + grid
  const floor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(90, 60)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x070d19, roughness: 0.92, metalness: 0.08 }))
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  floor.userData.ignoreClick = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(70, 70, 0x1e293b, 0x0f172a);
  grid.position.y = 0.0;
  grid.userData.ignoreClick = true;
  const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMats.forEach((m) => {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -1;
    trackMat(m);
  });
  trackGeo(grid.geometry);
  scene.add(grid);

  const addContactShadow = (x: number, z: number, sx: number, sz: number) => {
    const plane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(sx, sz)),
      trackMat(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.52, depthWrite: false }))
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, 0.015, z);
    plane.userData.ignoreClick = true;
    scene.add(plane);
  };

  const clickableMeshes: THREE.Object3D[] = [];
  const partMeshes = new Map<ComponentKey, THREE.Mesh[]>();

  const tagPart = (obj: THREE.Object3D, partKey: ComponentKey, label: string) => {
    obj.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && !m.userData.ignoreClick) {
        m.userData.partKey = partKey;
        m.userData.hoverLabel = label;
        clickableMeshes.push(m);
        const list = partMeshes.get(partKey) ?? [];
        list.push(m);
        partMeshes.set(partKey, list);
      }
    });
  };

  const createHighlightRing = (x: number, radius: number) => {
    const mat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const mesh = new THREE.Mesh(trackGeo(new THREE.RingGeometry(radius, radius + 0.14, 48)), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.03, 0);
    mesh.userData.ignoreClick = true;
    scene.add(mesh);
    return mesh;
  };

  const unitHighlightRings: Record<NodeKey, THREE.Mesh> = {
    mic: createHighlightRing(-14, 2.9),
    mixer: createHighlightRing(-4.5, 4.1),
    amp: createHighlightRing(5.5, 5.5),
    spk: createHighlightRing(15.5, 3.0),
  };

  // =========================================================================
  // 1. PAGING MICROPHONE + HYPER-DETAILED SOUND SENSOR + OUTER WINDSCREEN CASING
  // =========================================================================
  const micGroup = new THREE.Group();
  micGroup.position.set(-14, 0, 0);
  scene.add(micGroup);
  addContactShadow(-14, 0, 5.4, 5.6);

  const micPttGroup = new THREE.Group();
  const micBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.2, 0.72, 3.6)),
    trackMat(new THREE.MeshStandardMaterial({ map: brushedTex, color: 0x475569, metalness: 0.58, roughness: 0.4 }))
  );
  micBase.position.y = 0.36;
  micBase.castShadow = true;
  micBase.receiveShadow = true;
  micPttGroup.add(micBase);

  const micConsoleSlope = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.9, 0.24, 2.6)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.35, roughness: 0.55 }))
  );
  micConsoleSlope.position.set(0, 0.78, 0.3);
  micConsoleSlope.rotation.x = 0.12;
  micConsoleSlope.castShadow = true;
  micPttGroup.add(micConsoleSlope);

  const pttMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.28, metalness: 0.2 }));
  const pttButton = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.22, 1.1)), pttMat);
  pttButton.position.set(0, 0.94, 0.72);
  micPttGroup.add(pttButton);

  const micCollar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.32, 0.4, 0.35, 16)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.22 }))
  );
  micCollar.position.set(0, 0.92, -0.75);
  micPttGroup.add(micCollar);
  micGroup.add(micPttGroup);
  tagPart(micPttGroup, 'mic_ptt', 'Sakelar PTT & Basis Mic');

  // Gooseneck (part of magnet/housing group)
  const micMagnetGroup = new THREE.Group();
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.0, -0.75),
    new THREE.Vector3(0, 2.1, -0.9),
    new THREE.Vector3(0, 2.95, -0.65),
    new THREE.Vector3(0, 3.2, -0.5),
  ]);
  const gooseneck = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(neckCurve, 24, 0.1, 10, false)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.2 }))
  );
  gooseneck.castShadow = true;
  micMagnetGroup.add(gooseneck);
  micGroup.add(micMagnetGroup);

  const capsuleGroup = new THREE.Group();
  capsuleGroup.position.set(0, 3.2, -0.5);
  micGroup.add(capsuleGroup);

  const micLayers: AnimatedLayer[] = [];
  const micLayerSpecs: Array<{
    geo: THREE.BufferGeometry;
    rotZ?: number;
    rotY?: number;
    color: number;
    wire: boolean;
    offset: number;
    rough: number;
    metal: number;
    partKey: ComponentKey;
    label: string;
  }> = [
    { geo: new THREE.SphereGeometry(0.66, 18, 16, 0, Math.PI * 2, 0, Math.PI / 2), rotZ: Math.PI / 2, color: 0xcbd5e1, wire: true, offset: -0.9, rough: 0.25, metal: 0.85, partKey: 'mic_grille', label: 'Grille Logam Kapsul' },
    { geo: new THREE.CylinderGeometry(0.58, 0.58, 0.2, 18), rotZ: Math.PI / 2, color: 0x1e293b, wire: false, offset: -0.6, rough: 0.9, metal: 0.05, partKey: 'mic_grille', label: 'Foam Akustik Pop-Filter' },
    { geo: new THREE.SphereGeometry(0.52, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), rotZ: Math.PI / 2, color: 0x38bdf8, wire: false, offset: -0.3, rough: 0.22, metal: 0.15, partKey: 'mic_diaphragm', label: 'Diafragma Membran' },
    { geo: new THREE.TorusGeometry(0.36, 0.08, 10, 24), rotY: Math.PI / 2, color: 0xd97706, wire: false, offset: 0.0, rough: 0.24, metal: 0.88, partKey: 'mic_diaphragm', label: 'Voice Coil (Kumparan Suara)' },
    { geo: new THREE.TorusGeometry(0.52, 0.16, 12, 24), rotY: Math.PI / 2, color: 0x64748b, wire: false, offset: 0.35, rough: 0.45, metal: 0.72, partKey: 'mic_magnet', label: 'Magnet Permanen Kapsul' },
    { geo: new THREE.CylinderGeometry(0.62, 0.62, 0.52, 20), rotZ: Math.PI / 2, color: 0x475569, wire: false, offset: 0.72, rough: 0.38, metal: 0.65, partKey: 'mic_magnet', label: 'Rumah Kapsul Dinamis' },
  ];
  micLayerSpecs.forEach((s, idx) => {
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: s.color,
        wireframe: s.wire,
        metalness: s.metal,
        roughness: s.rough,
      })
    );
    const m = new THREE.Mesh(trackGeo(s.geo), mat);
    if (s.rotZ) m.rotation.z = s.rotZ;
    if (s.rotY) m.rotation.y = s.rotY;
    m.position.x = s.offset;
    m.castShadow = true;
    capsuleGroup.add(m);
    tagPart(m, s.partKey, s.label);
    micLayers.push({ mesh: m, baseX: s.offset, idx });
  });
  tagPart(micMagnetGroup, 'mic_magnet', 'Gooseneck & Kabel Sinyal Mic');

  // Outer Windscreen Shell Casing for Paging Mic (covers capsule when closed)
  const micCasingGroup = new THREE.Group();
  micCasingGroup.position.set(0, 3.2, -0.5);
  const micShellFront = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.84, 24, 20, 0, Math.PI * 2, 0, Math.PI / 2)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.65, roughness: 0.42 }))
  );
  micShellFront.rotation.z = Math.PI / 2;
  micShellFront.position.x = -0.3;
  const micShellBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.82, 0.52, 1.45, 24)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.38 }))
  );
  micShellBody.rotation.z = Math.PI / 2;
  micShellBody.position.x = 0.42;
  const micShellBand = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.83, 0.045, 10, 28)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.2 }))
  );
  micShellBand.rotation.y = Math.PI / 2;
  micShellBand.position.x = -0.28;
  micCasingGroup.add(micShellFront, micShellBody, micShellBand);
  micGroup.add(micCasingGroup);
  tagPart(micCasingGroup, 'mic', 'Casing Windscreen Paging Mic');

  // === HYPER-DETAILED 3D SOUND SENSOR MODULE (Matches reference photo) ===
  const soundSensorGroup = new THREE.Group();
  soundSensorGroup.position.set(-1.95, 3.2, -0.5);
  soundSensorGroup.rotation.y = 0.28;
  soundSensorGroup.scale.setScalar(1.35);

  // Blue PCB with silkscreen
  const soundPcb = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.95, 0.48, 0.08)),
    trackMat(new THREE.MeshStandardMaterial({ map: soundPcbTex, color: 0x2563eb, roughness: 0.4, metalness: 0.12 }))
  );
  soundSensorGroup.add(soundPcb);

  // Brushed silver cylindrical electret condenser mic on left + dark felt face + 2 bent silver pins
  const condBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.24, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.18 }))
  );
  condBody.rotation.z = Math.PI / 2;
  condBody.position.set(-0.56, 0, 0.08);
  const condFelt = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.18, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 }))
  );
  condFelt.rotation.y = -Math.PI / 2;
  condFelt.position.set(-0.685, 0, 0.08);
  const leadMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 }));
  [-0.07, 0.07].forEach((ly) => {
    const lead = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.025, 0.025)), leadMat);
    lead.position.set(-0.4, ly, 0.06);
    soundSensorGroup.add(lead);
  });
  soundSensorGroup.add(condBody, condFelt);

  // Blue 10K trimmer pot + brass cross screw
  const trimpot = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.24, 0.24, 0.16)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 }))
  );
  trimpot.position.set(-0.1, 0.04, 0.11);
  const trimDial = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 14)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 }))
  );
  trimDial.rotation.x = Math.PI / 2;
  trimDial.position.set(-0.1, 0.04, 0.19);
  soundSensorGroup.add(trimpot, trimDial);

  // Black 8-pin LM393 comparator IC + metallic legs
  const lm393 = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.22, 0.16, 0.08)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }))
  );
  lm393.position.set(0.2, 0.03, 0.08);
  soundSensorGroup.add(lm393);
  for (let p = 0; p < 4; p++) {
    const px = 0.12 + p * 0.052;
    [-0.09, 0.09].forEach((py) => {
      const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.03, 0.04)), leadMat);
      leg.position.set(px, 0.03 + py, 0.06);
      soundSensorGroup.add(leg);
    });
  }

  // PWR green LED & DO cyan trigger LED
  const soundSensorLedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.7 })
  );
  const pwrLed = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.035, 10, 10)), soundSensorLedMat);
  pwrLed.position.set(0.25, -0.14, 0.06);
  const soundDoLedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.2 })
  );
  const doLed = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 10, 10)), soundDoLedMat);
  doLed.position.set(0.12, -0.14, 0.06);
  soundSensorGroup.add(pwrLed, doLed);

  // 3 bent gold-plated male header pins (VCC, GND, OUT)
  const goldPinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.92, roughness: 0.18 }));
  [-0.12, 0, 0.12].forEach((py) => {
    const pin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.028, 0.028)), goldPinMat);
    pin.position.set(0.56, py, 0.05);
    soundSensorGroup.add(pin);
  });

  // Animated acoustic waves entering condenser mic
  const soundSensorWaves: THREE.Mesh[] = [];
  for (let w = 0; w < 3; w++) {
    const wave = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.22, 0.255, 24)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }))
    );
    wave.rotation.y = Math.PI / 2;
    wave.position.set(-0.95 - w * 0.22, 0, 0.08);
    wave.userData.ignoreClick = true;
    soundSensorGroup.add(wave);
    soundSensorWaves.push(wave);
  }

  micGroup.add(soundSensorGroup);
  tagPart(soundSensorGroup, 'sound', 'Modul Sensor Suara (LM393)');

  // Signal wire & pulse from Sound Sensor OUT to Mixer Priority
  const soundWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-14.95, 3.2, -0.45),
    new THREE.Vector3(-12.2, 2.2, -0.7),
    new THREE.Vector3(-8.5, 1.5, -0.65),
    new THREE.Vector3(-4.5, 1.6, -0.65),
  ]);
  const soundWireMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(soundWireCurve, 48, 0.03, 6, false)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.42 }))
  );
  soundWireMesh.userData.ignoreClick = true;
  scene.add(soundWireMesh);

  const soundTriggerPulse = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.11, 10, 10)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }))
  );
  soundTriggerPulse.userData.ignoreClick = true;
  scene.add(soundTriggerPulse);

  // =========================================================================
  // 2. PRE-AMPLIFIER / MIXER (19-INCH RACKMOUNT) + HINGED SERVICE LID
  // =========================================================================
  const mixerGroup = new THREE.Group();
  mixerGroup.position.set(-4.5, 0, 0);
  scene.add(mixerGroup);
  addContactShadow(-4.5, 0, 7.6, 7.2);

  const mixerChassis = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.6, 1.3, 5.2)),
    trackMat(new THREE.MeshStandardMaterial({ map: darkRackTex, color: 0x1e293b, metalness: 0.62, roughness: 0.42 }))
  );
  mixerChassis.position.y = 0.65;
  mixerChassis.castShadow = true;
  mixerChassis.receiveShadow = true;
  mixerGroup.add(mixerChassis);
  tagPart(mixerChassis, 'mixer', 'Sasis 19-Inch Pre-Amp / Mixer');

  // Rack ears
  [-2.95, 2.95].forEach((rx) => {
    const ear = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.28, 1.28, 0.45)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 }))
    );
    ear.position.set(rx, 0.65, 2.45);
    mixerGroup.add(ear);
    tagPart(ear, 'mixer', 'Kuping Rak 19-Inch Mixer');
  });

  // Pre-Amp PCB & EQ Knobs
  const mixerPreampGroup = new THREE.Group();
  const mixerPcbFront = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.0, 0.14, 2.3)),
    trackMat(new THREE.MeshStandardMaterial({ map: mixerPcbTex, color: 0x0f766e, roughness: 0.48, metalness: 0.12 }))
  );
  mixerPcbFront.position.set(0, 1.32, -1.1);
  mixerPreampGroup.add(mixerPcbFront);

  const knobMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.78, roughness: 0.25 }));
  const knobGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.19, 0.26, 16));
  for (let k = 0; k < 5; k++) {
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.position.set(-1.6 + k * 0.8, 1.52, -1.65);
    mixerPreampGroup.add(knob);
  }
  mixerGroup.add(mixerPreampGroup);
  tagPart(mixerPreampGroup, 'mixer_preamp', 'Blok Pre-Amp Gain & EQ Tone');

  // Priority Override Relay
  const priorityRelayMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.2 }));
  const priorityRelay = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.56, 0.95)), priorityRelayMat);
  priorityRelay.position.set(0, 1.65, -0.65);
  priorityRelay.castShadow = true;
  mixerGroup.add(priorityRelay);
  tagPart(priorityRelay, 'mixer_priority', 'Relay Priority Override');

  // Mixing Faders & Output Buffer
  const mixerFadersGroup = new THREE.Group();
  const mixerPcbBack = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.0, 0.14, 2.1)),
    trackMat(new THREE.MeshStandardMaterial({ map: mixerPcbTex, color: 0x0d9488, roughness: 0.48, metalness: 0.12 }))
  );
  mixerPcbBack.position.set(0, 1.32, 1.15);
  mixerFadersGroup.add(mixerPcbBack);

  const trackSlotMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 }));
  const faderCapMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.15 }));
  const mixerFaders: AnimatedFader[] = [];
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.04, 1.45)), trackSlotMat);
    slot.position.set(-1.2 + i * 0.8, 1.41, 1.1);
    mixerFadersGroup.add(slot);

    const f = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.24, 0.42)), faderCapMat);
    f.position.set(-1.2 + i * 0.8, 1.52, 1.1);
    f.castShadow = true;
    mixerFadersGroup.add(f);
    mixerFaders.push({ mesh: f, phase: i * 1.15 });
  }
  mixerGroup.add(mixerFadersGroup);
  tagPart(mixerFadersGroup, 'mixer_faders', 'Mixing Fader & Output Buffer');

  // Hinged Rack Lid for Mixer
  const mixerCasingPivot = new THREE.Group();
  mixerCasingPivot.position.set(0, 1.36, -2.6);
  const mixerTopLid = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.68, 0.12, 5.28)),
    trackMat(new THREE.MeshStandardMaterial({ map: darkRackTex, color: 0x1e293b, metalness: 0.65, roughness: 0.38 }))
  );
  mixerTopLid.position.set(0, 0.56, 2.6);
  mixerTopLid.castShadow = true;

  const mixerFrontSkirt = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.68, 0.58, 0.12)),
    trackMat(new THREE.MeshStandardMaterial({ map: mixerFaceTex, roughness: 0.4, metalness: 0.35 }))
  );
  mixerFrontSkirt.position.set(0, 0.28, 5.2);
  const mixerSideLeft = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.1, 0.55, 5.2)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 }))
  );
  mixerSideLeft.position.set(-2.79, 0.28, 2.6);
  const mixerSideRight = mixerSideLeft.clone();
  mixerSideRight.position.x = 2.79;
  mixerCasingPivot.add(mixerTopLid, mixerFrontSkirt, mixerSideLeft, mixerSideRight);
  mixerGroup.add(mixerCasingPivot);
  tagPart(mixerCasingPivot, 'mixer', 'Penutup Casing Pre-Amp / Mixer');

  // =========================================================================
  // 3. POWER AMPLIFIER 100V LINE + DETAILED SENSORS + HINGED 3U LID
  // =========================================================================
  const ampGroup = new THREE.Group();
  ampGroup.position.set(5.5, 0, 0);
  scene.add(ampGroup);
  addContactShadow(5.5, 0, 10.6, 8.2);

  const ampBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8.6, 0.34, 6.0)),
    trackMat(new THREE.MeshStandardMaterial({ map: darkRackTex, color: 0x0f172a, metalness: 0.72, roughness: 0.32 }))
  );
  ampBase.position.y = 0.17;
  ampBase.castShadow = true;
  ampBase.receiveShadow = true;
  ampGroup.add(ampBase);
  tagPart(ampBase, 'amp', 'Sasis Bawah Power Amp 100V');

  // Dual Copper Toroidal Transformers + Filter Elcos
  const toroidGroup = new THREE.Group();
  const copperMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.88, roughness: 0.22 }));
  const toroidCoreMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.45 }));
  for (let t = 0; t < 2; t++) {
    const toroid = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.75, 0.32, 16, 32)), copperMat);
    toroid.rotation.x = Math.PI / 2;
    toroid.position.set(-3.1, 0.82, -1.0 + t * 2.0);
    toroid.castShadow = true;
    toroidGroup.add(toroid);

    const bolt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.56, 16)), toroidCoreMat);
    bolt.position.set(-3.1, 0.82, -1.0 + t * 2.0);
    toroidGroup.add(bolt);
  }
  const capBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.2 }));
  const capTopMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }));
  for (let c = 0; c < 4; c++) {
    const zPos = -1.5 + c * 1.0;
    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.26, 0.26, 1.04, 16)), capBodyMat);
    cap.position.set(-1.65, 0.86, zPos);
    cap.castShadow = true;
    toroidGroup.add(cap);

    const top = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16)), capTopMat);
    top.position.set(-1.65, 1.39, zPos);
    toroidGroup.add(top);
  }
  ampGroup.add(toroidGroup);
  tagPart(toroidGroup, 'amp_toroid', 'Dual Trafo Toroidal & Bank Elco');

  // Power MOSFETs along heatsink spine
  const mosfetGroup = new THREE.Group();
  const mosfetBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45 }));
  const mosfetTabMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 }));
  for (let m = 0; m < 6; m++) {
    const mz = -1.75 + m * 0.7;
    const pkg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.5, 0.36)), mosfetBodyMat);
    pkg.position.set(-0.08, 1.0, mz);
    const tab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.64, 0.32)), mosfetTabMat);
    tab.position.set(0.02, 1.05, mz);
    mosfetGroup.add(pkg, tab);
  }
  ampGroup.add(mosfetGroup);
  tagPart(mosfetGroup, 'amp_mosfet', 'Deretan MOSFET Daya (TO-247)');

  // 14-fin Aluminum Heatsink
  const heatsinkGroup = new THREE.Group();
  const heatsinkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.88, roughness: 0.24, emissive: 0x000000 })
  );
  const heatsinkSpine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 1.45, 4.4)), heatsinkMat);
  heatsinkSpine.position.set(0.2, 1.06, 0);
  heatsinkSpine.castShadow = true;
  heatsinkGroup.add(heatsinkSpine);

  const finGeo = trackGeo(new THREE.BoxGeometry(1.0, 1.4, 0.08));
  for (let f = 0; f < 14; f++) {
    const fin = new THREE.Mesh(finGeo, heatsinkMat);
    fin.position.set(0.75, 1.06, -1.95 + f * 0.3);
    fin.castShadow = true;
    heatsinkGroup.add(fin);
  }
  ampGroup.add(heatsinkGroup);
  tagPart(heatsinkGroup, 'amp_heatsink', 'Heatsink Aluminium 14 Sirip');

  // === HYPER-DETAILED 3D TEMPERATURE PROBE DS18B20 (Matches reference photo) ===
  const tempSensorGroup = new THREE.Group();
  tempSensorGroup.position.set(1.42, 1.24, 0.4);
  const probeBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.88, 16)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.18 }))
  );
  probeBody.rotation.z = Math.PI / 2;
  const probeTip = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.11, 0.04, 0.22, 16)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 }))
  );
  probeTip.rotation.z = -Math.PI / 2;
  probeTip.position.x = -0.54;
  // Hexagonal stainless mounting collar
  const probeCollar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 6)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.22 }))
  );
  probeCollar.rotation.z = Math.PI / 2;
  probeCollar.position.x = 0.28;
  // Heat-shrink strain relief + curved black cable + white 3-pin JST plug
  const strainBoot = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.085, 0.11, 0.22, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }))
  );
  strainBoot.rotation.z = Math.PI / 2;
  strainBoot.position.x = 0.52;
  const probeCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.62, 0, 0),
    new THREE.Vector3(0.95, -0.15, -0.35),
    new THREE.Vector3(0.92, -0.52, -0.82),
  ]);
  const probeCable = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(probeCableCurve, 18, 0.045, 8, false)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 }))
  );
  const jstPlug = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.2, 0.12, 0.24)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }))
  );
  jstPlug.position.set(0.92, -0.54, -0.92);
  // Thermal collar indicator ring + translucent thermal aura
  const tempCollarRingMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9, roughness: 0.3 })
  );
  const tempCollarRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.24, 0.03, 10, 24)), tempCollarRingMat);
  tempCollarRing.rotation.y = Math.PI / 2;
  tempCollarRing.position.x = 0.14;
  const tempAuraMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
  );
  const tempAuraMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 16, 16)), tempAuraMat);
  tempAuraMesh.position.x = -0.35;
  tempAuraMesh.userData.ignoreClick = true;

  tempSensorGroup.add(
    probeBody,
    probeTip,
    probeCollar,
    strainBoot,
    probeCable,
    jstPlug,
    tempCollarRing,
    tempAuraMesh
  );
  ampGroup.add(tempSensorGroup);
  tagPart(tempSensorGroup, 'temp', 'Sensor Suhu Probe (DS18B20)');

  // Protect Relay & Protect LED
  const ampProtectGroup = new THREE.Group();
  const protectRelayMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.2 }));
  const protectRelay = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.7, 1.5)), protectRelayMat);
  protectRelay.position.set(2.2, 0.69, -1.2);
  protectRelay.castShadow = true;
  const protectLedMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.25 }));
  const protectLed = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.22, 14, 14)), protectLedMat);
  protectLed.position.set(2.2, 1.25, 2.75);
  ampProtectGroup.add(protectRelay, protectLed);
  ampGroup.add(ampProtectGroup);
  tagPart(ampProtectGroup, 'amp_protect', 'Sirkuit & Relay Proteksi');

  // === HYPER-DETAILED 3D CURRENT SENSOR ACS712 20A (Matches reference photo) ===
  const currentSensorGroup = new THREE.Group();
  currentSensorGroup.position.set(2.2, 0.62, 1.2);
  currentSensorGroup.scale.setScalar(1.22);

  const acsPcb = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.12, 0.1, 0.88)),
    trackMat(new THREE.MeshStandardMaterial({ map: acsPcbTex, color: 0x2563eb, roughness: 0.4, metalness: 0.12 }))
  );
  const acsIc = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.11, 0.28)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }))
  );
  acsIc.position.y = 0.1;
  currentSensorGroup.add(acsPcb, acsIc);

  // 8 metallic gull-wing IC pins
  for (let p = 0; p < 4; p++) {
    const px = -0.09 + p * 0.06;
    [-0.16, 0.16].forEach((pz) => {
      const pin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.025, 0.04, 0.05)), leadMat);
      pin.position.set(px, 0.07, pz);
      currentSensorGroup.add(pin);
    });
  }

  // Dual blue screw terminal blocks (IP+ / IP-) with silver slotted screws
  const termMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 }));
  const screwMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 }));
  [-0.36, 0.36].forEach((tx) => {
    const block = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.26, 0.36)), termMat);
    block.position.set(tx, 0.17, 0.24);
    currentSensorGroup.add(block);
    [-0.08, 0.08].forEach((sx) => {
      const screw = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12)), screwMat);
      screw.position.set(tx + sx, 0.31, 0.24);
      currentSensorGroup.add(screw);
    });
  });

  // 3 vertical gold header pins (OUT, VCC, GND) + PWR red LED
  [-0.09, 0, 0.09].forEach((px) => {
    const pin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.24, 0.028)), goldPinMat);
    pin.position.set(px, 0.16, -0.34);
    currentSensorGroup.add(pin);
  });
  const acsLedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.65 })
  );
  const acsLed = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 8, 8)), acsLedMat);
  acsLed.position.set(0.32, 0.09, -0.26);
  currentSensorGroup.add(acsLed);

  // Hall-effect magnetic flux rings above ACS712 IC
  const acsFluxRings: THREE.Mesh[] = [];
  for (let f = 0; f < 3; f++) {
    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.18, 0.022, 8, 24)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, depthWrite: false }))
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.16 + f * 0.08, 0);
    ring.userData.ignoreClick = true;
    currentSensorGroup.add(ring);
    acsFluxRings.push(ring);
  }

  ampGroup.add(currentSensorGroup);
  tagPart(currentSensorGroup, 'current', 'Modul Sensor Arus ACS712');

  // Signal wire & trip pulse from ACS712 OUT pin to Protect Relay
  const acsWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(7.7, 0.85, 0.8),
    new THREE.Vector3(7.7, 1.05, 0.0),
    new THREE.Vector3(7.7, 0.95, -0.9),
  ]);
  const acsWireMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(acsWireCurve, 24, 0.025, 6, false)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.45 }))
  );
  acsWireMesh.userData.ignoreClick = true;
  scene.add(acsWireMesh);

  const acsTripPulse = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.09, 10, 10)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 }))
  );
  acsTripPulse.userData.ignoreClick = true;
  scene.add(acsTripPulse);

  // Output Transformer 100V Line
  const ampTrafoGroup = new THREE.Group();
  const outTrafoCore = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.42, 1.42, 1.56)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.72, roughness: 0.3 }))
  );
  outTrafoCore.position.set(3.6, 1.02, 0.6);
  outTrafoCore.castShadow = true;
  const outTrafoTop = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.48, 0.14, 1.62)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.25 }))
  );
  outTrafoTop.position.set(3.6, 1.75, 0.6);
  ampTrafoGroup.add(outTrafoCore, outTrafoTop);
  ampGroup.add(ampTrafoGroup);
  tagPart(ampTrafoGroup, 'amp_trafo100v', 'Trafo Output Step-Up 100V Line');

  // Hinged 3U Amplifier Cover
  const ampCasingPivot = new THREE.Group();
  ampCasingPivot.position.set(0, 1.95, -3.0);
  const ampTopLid = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8.7, 0.14, 6.08)),
    trackMat(new THREE.MeshStandardMaterial({ map: darkRackTex, color: 0x0f172a, metalness: 0.7, roughness: 0.35 }))
  );
  ampTopLid.position.set(0, 0.0, 3.0);
  ampTopLid.castShadow = true;

  const ampFrontSkirt = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8.7, 1.65, 0.14)),
    trackMat(new THREE.MeshStandardMaterial({ map: ampFaceTex, roughness: 0.4, metalness: 0.4 }))
  );
  ampFrontSkirt.position.set(0, -0.82, 6.0);
  const ampSideLeft = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.12, 1.65, 6.0)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.4 }))
  );
  ampSideLeft.position.set(-4.3, -0.82, 3.0);
  const ampSideRight = ampSideLeft.clone();
  ampSideRight.position.x = 4.3;
  ampCasingPivot.add(ampTopLid, ampFrontSkirt, ampSideLeft, ampSideRight);
  ampGroup.add(ampCasingPivot);
  tagPart(ampCasingPivot, 'amp', 'Penutup Casing Power Amp 100V');

  // =========================================================================
  // 4. CEILING SPEAKER (100V LINE) + BACKCAN DOME + SATELLITES
  // =========================================================================
  const spkGroup = new THREE.Group();
  spkGroup.position.set(15.5, 0, 0);
  scene.add(spkGroup);
  addContactShadow(15.5, 0, 5.4, 5.4);

  const spkStand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.1, 0.16, 2.0, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 }))
  );
  spkStand.position.set(-0.2, 1.0, 0);
  spkGroup.add(spkStand);
  tagPart(spkStand, 'spk', 'Penyangga Ceiling Speaker');

  const spkSubGroup = new THREE.Group();
  spkSubGroup.position.set(0, 2.2, 0);
  spkGroup.add(spkSubGroup);

  const spkLayerSpecs: Array<{
    geo: THREE.BufferGeometry;
    rotZ?: number;
    rotY?: number;
    posX: number;
    color: number;
    metal: number;
    rough: number;
    partKey: ComponentKey;
    label: string;
  }> = [
    { geo: new THREE.BoxGeometry(0.72, 0.72, 0.72), posX: -1.1, color: 0xd97706, metal: 0.72, rough: 0.3, partKey: 'spk_trafo', label: 'Trafo Matching 100V (3W/6W/15W)' },
    { geo: new THREE.TorusGeometry(0.45, 0.1, 10, 24), rotY: Math.PI / 2, posX: -0.5, color: 0xb45309, metal: 0.85, rough: 0.24, partKey: 'spk_driver', label: 'Voice Coil Speaker' },
    { geo: new THREE.TorusGeometry(0.72, 0.22, 14, 28), rotY: Math.PI / 2, posX: -0.05, color: 0x475569, metal: 0.7, rough: 0.35, partKey: 'spk_driver', label: 'Magnet Permanen Ferit' },
    { geo: new THREE.RingGeometry(0.35, 0.85, 24), rotY: Math.PI / 2, posX: 0.35, color: 0xca8a04, metal: 0.25, rough: 0.65, partKey: 'spk_driver', label: 'Suspensi Spider' },
    { geo: new THREE.ConeGeometry(1.15, 0.85, 28, 1, true), rotZ: -Math.PI / 2, posX: 0.85, color: 0x1e293b, metal: 0.15, rough: 0.72, partKey: 'spk_cone', label: 'Diafragma Cone Speaker' },
    { geo: new THREE.CylinderGeometry(1.22, 1.22, 0.14, 28), rotZ: Math.PI / 2, posX: 1.35, color: 0xe2e8f0, metal: 0.55, rough: 0.32, partKey: 'spk_cone', label: 'Grille Logam Pelindung' },
  ];
  const spkLayers: AnimatedLayer[] = [];
  spkLayerSpecs.forEach((l, idx) => {
    const m = new THREE.Mesh(
      trackGeo(l.geo),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: l.color,
          side: THREE.DoubleSide,
          metalness: l.metal,
          roughness: l.rough,
        })
      )
    );
    if (l.rotY) m.rotation.y = l.rotY;
    if (l.rotZ) m.rotation.z = l.rotZ;
    m.position.x = l.posX;
    m.castShadow = true;
    spkSubGroup.add(m);
    tagPart(m, l.partKey, l.label);
    spkLayers.push({ mesh: m, baseX: l.posX, idx });
  });

  // Rear Fire-Dome Backcan Casing for Ceiling Speaker
  const spkCasingGroup = new THREE.Group();
  spkCasingGroup.position.set(-0.35, 2.2, 0);
  const backcanBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.24, 1.18, 2.15, 28)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.38 }))
  );
  backcanBody.rotation.z = Math.PI / 2;
  backcanBody.position.x = -0.3;
  const backcanBezel = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.24, 0.08, 12, 32)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 }))
  );
  backcanBezel.rotation.y = Math.PI / 2;
  backcanBezel.position.x = 0.75;
  spkCasingGroup.add(backcanBody, backcanBezel);
  spkGroup.add(spkCasingGroup);
  tagPart(spkCasingGroup, 'spk', 'Backcan / Casing Ceiling Speaker');

  // Acoustic wave emission rings
  const acousticRings: THREE.Mesh[] = [];
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.55, 0.63, 32)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }))
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(1.6 + r * 0.45, 2.2, 0);
    ring.userData.ignoreClick = true;
    spkGroup.add(ring);
    acousticRings.push(ring);
  }

  // Parallel speaker array indicators (Unit #2 .. #6)
  const spkSatellites: THREE.Group[] = [];
  const satBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.45 }));
  const satGrilleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.55, roughness: 0.32 }));
  for (let s = 0; s < 5; s++) {
    const sat = new THREE.Group();
    const row = Math.floor(s / 2);
    const side = s % 2 === 0 ? -1 : 1;
    sat.position.set(-1.0 + row * 1.4, 0.55, side * (2.6 + row * 0.35));

    const body = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.5, 0.55, 0.35, 18)), satBodyMat);
    const grille = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.56, 0.56, 0.08, 18)), satGrilleMat);
    grille.position.y = 0.2;
    sat.add(body, grille);
    spkGroup.add(sat);
    tagPart(sat, 'spk', `Ceiling Speaker Paralel #${s + 2}`);
    spkSatellites.push(sat);
  }

  // =========================================================================
  // 5. SIGNAL PATH CURVE & ANIMATED SIGNAL PACKETS
  // =========================================================================
  const pathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-13.3, 3.2, -0.5),
    new THREE.Vector3(-10.0, 1.2, 0.0),
    new THREE.Vector3(-4.5, 1.4, 0.0),
    new THREE.Vector3(2.4, 0.9, -1.0),
    new THREE.Vector3(9.1, 1.0, 0.6),
    new THREE.Vector3(14.4, 2.2, 0.0),
  ]);

  const pathLine = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(pathCurve, 128, 0.055, 8, false)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.36 }))
  );
  pathLine.userData.ignoreClick = true;
  scene.add(pathLine);

  const signalGeo = trackGeo(new THREE.SphereGeometry(0.14, 10, 10));
  const signals: SignalParticle[] = [];
  for (let i = 0; i < 36; i++) {
    const sMesh = new THREE.Mesh(signalGeo, trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })));
    sMesh.userData.ignoreClick = true;
    scene.add(sMesh);
    signals.push({ mesh: sMesh, t: i / 36 });
  }

  return {
    clickableMeshes,
    partMeshes,
    micLayers,
    spkLayers,
    spkSatellites,
    acousticRings,
    mixerFaders,
    signals,
    pathCurve,
    micCasingGroup,
    mixerCasingPivot,
    ampCasingPivot,
    spkCasingGroup,
    soundSensorWaves,
    soundDoLedMat,
    soundTriggerPulse,
    soundWireCurve,
    acsFluxRings,
    acsTripPulse,
    acsWireCurve,
    tempAuraMat,
    tempAuraMesh,
    tempCollarRingMat,
    pttMat,
    priorityRelayMat,
    protectRelayMat,
    protectLedMat,
    heatsinkMat,
    soundSensorLedMat,
    acsLedMat,
    unitHighlightRings,
    disposables: { geometries, materials, textures },
  };
}
