import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  computeTelemetryStep,
  type ComponentKey,
  type NodeKey,
  type SimParams,
  type TelemetryState,
} from '../data/systemCatalog';
import { buildPaScene } from '../three/paSceneBuilder';

export interface CameraTargetRequest {
  cam: [number, number, number];
  target: [number, number, number];
  nonce: number;
}

interface HoverTooltip {
  label: string;
  x: number;
  y: number;
}

interface PaViewportProps {
  params: SimParams;
  activeNode: NodeKey;
  selectedPart: ComponentKey;
  cameraRequest: CameraTargetRequest;
  onSelectPart: (partKey: ComponentKey) => void;
  onTelemetryTick: (telemetry: TelemetryState, elapsed: number) => void;
}

const _desiredCam = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _pointer = new THREE.Vector2();
const _ptVec = new THREE.Vector3();
const _tempColor = new THREE.Color();
const _coolColor = new THREE.Color(0x38bdf8);
const _warmColor = new THREE.Color(0xf59e0b);
const _hotColor = new THREE.Color(0xef4444);

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function PaViewport({
  params,
  activeNode,
  selectedPart,
  cameraRequest,
  onSelectPart,
  onTelemetryTick,
}: PaViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [hoverTip, setHoverTip] = useState<HoverTooltip | null>(null);

  const paramsRef = useRef(params);
  const activeNodeRef = useRef(activeNode);
  const selectedPartRef = useRef(selectedPart);
  const camReqRef = useRef(cameraRequest);
  const camAnimatingRef = useRef(true);
  const callbacksRef = useRef({ onSelectPart, onTelemetryTick });

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    activeNodeRef.current = activeNode;
  }, [activeNode]);

  useEffect(() => {
    selectedPartRef.current = selectedPart;
  }, [selectedPart]);

  useEffect(() => {
    camReqRef.current = cameraRequest;
    camAnimatingRef.current = true;
  }, [cameraRequest]);

  useEffect(() => {
    callbacksRef.current = { onSelectPart, onTelemetryTick };
  }, [onSelectPart, onTelemetryTick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareGl();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b14);
    scene.fog = new THREE.FogExp2(0x060b14, 0.012);

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 220);
    camera.position.set(...camReqRef.current.cam);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
    keyLight.position.set(12, 22, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 65;
    keyLight.shadow.camera.left = -24;
    keyLight.shadow.camera.right = 24;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-16, 12, -16);
    scene.add(rimLight);

    let softbox: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      softbox = new THREE.RectAreaLight(0xe0f2fe, 1.8, 22, 6);
      softbox.position.set(0, 11, 8);
      softbox.lookAt(0, 1, 0);
      scene.add(softbox);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 3.0;
    controls.maxDistance = 48;
    controls.target.set(...camReqRef.current.target);
    controls.update();

    const onControlStart = () => {
      camAnimatingRef.current = false;
    };
    controls.addEventListener('start', onControlStart);

    const rig = buildPaScene(scene, renderer);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointer, camera);
      const hits = raycaster.intersectObjects(rig.clickableMeshes, false);
      if (hits.length > 0) {
        const partKey = hits[0].object.userData.partKey as ComponentKey | undefined;
        if (partKey) {
          callbacksRef.current.onSelectPart(partKey);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointer, camera);
      const hits = raycaster.intersectObjects(rig.clickableMeshes, false);
      if (hits.length > 0) {
        const label = hits[0].object.userData.hoverLabel as string | undefined;
        renderer.domElement.style.cursor = 'pointer';
        if (label) {
          setHoverTip({ label, x: e.clientX, y: e.clientY });
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoverTip(null);
      }
    };

    const onPointerLeave = () => {
      setHoverTip(null);
    };

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let explodeAlpha = 1.0;
    let currentTemp = 38.0;
    let lastUiReport = 0;
    let frameId = 0;
    let disposed = false;

    let soundPulseT = 0;
    let acsPulseT = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const p = paramsRef.current;

      const telemetry = computeTelemetryStep(p, currentTemp, delta);
      currentTemp = telemetry.tempC;

      if (elapsed - lastUiReport >= 0.08) {
        lastUiReport = elapsed;
        callbacksRef.current.onTelemetryTick(telemetry, elapsed);
      }

      // 1. Open / Closed Casing Animations (smooth damped lids & shells)
      const micOpen = p.casingOpen.mic;
      rig.micCasingGroup.position.y = THREE.MathUtils.damp(
        rig.micCasingGroup.position.y,
        micOpen ? 5.15 : 3.2,
        7,
        delta
      );
      rig.micCasingGroup.position.x = THREE.MathUtils.damp(
        rig.micCasingGroup.position.x,
        micOpen ? 0.55 : 0.0,
        7,
        delta
      );
      rig.micCasingGroup.rotation.z = THREE.MathUtils.damp(
        rig.micCasingGroup.rotation.z,
        micOpen ? -0.68 : 0.0,
        7,
        delta
      );

      rig.mixerCasingPivot.rotation.x = THREE.MathUtils.damp(
        rig.mixerCasingPivot.rotation.x,
        p.casingOpen.mixer ? -1.28 : 0.0,
        6.5,
        delta
      );

      rig.ampCasingPivot.rotation.x = THREE.MathUtils.damp(
        rig.ampCasingPivot.rotation.x,
        p.casingOpen.amp ? -1.28 : 0.0,
        6.5,
        delta
      );

      const spkOpen = p.casingOpen.spk;
      rig.spkCasingGroup.position.x = THREE.MathUtils.damp(
        rig.spkCasingGroup.position.x,
        spkOpen ? -2.85 : -0.35,
        6.5,
        delta
      );
      rig.spkCasingGroup.position.y = THREE.MathUtils.damp(
        rig.spkCasingGroup.position.y,
        spkOpen ? 2.65 : 2.2,
        6.5,
        delta
      );
      rig.spkCasingGroup.rotation.z = THREE.MathUtils.damp(
        rig.spkCasingGroup.rotation.z,
        spkOpen ? 0.28 : 0.0,
        6.5,
        delta
      );

      // 2. Hardware indicator emissions
      rig.pttMat.emissive.setHex(p.ptt ? 0x16a34a : 0x000000);
      rig.pttMat.emissiveIntensity = p.ptt ? 1.4 : 0;

      rig.priorityRelayMat.emissive.setHex(telemetry.priorityActive ? 0xeab308 : 0x000000);
      rig.priorityRelayMat.emissiveIntensity = telemetry.priorityActive ? 1.3 : 0;

      rig.protectLedMat.color.setHex(telemetry.protectTripped ? 0xef4444 : 0x450a0a);
      rig.protectLedMat.emissive.setHex(telemetry.protectTripped ? 0xdc2626 : 0x000000);
      rig.protectLedMat.emissiveIntensity = telemetry.protectTripped ? 1.8 : 0;

      rig.protectRelayMat.emissive.setHex(telemetry.protectTripped ? 0xdc2626 : 0x000000);
      rig.protectRelayMat.emissiveIntensity = telemetry.protectTripped ? 1.25 : 0;

      const heatRatio = Math.max(0, Math.min(1, (telemetry.tempC - 30) / 45));
      rig.heatsinkMat.emissive.setRGB(heatRatio * 0.85, heatRatio * 0.14, 0);

      // 3. Sensor 1 Simulation: Sound Sensor Waves, DO LED & OUT Wire Pulse
      const soundAmp = Math.max(0, (telemetry.soundDb - 36) / 64);
      rig.soundSensorLedMat.emissiveIntensity = p.ptt || p.alarm ? 1.5 : p.bgm ? 0.8 : 0.2;
      rig.soundDoLedMat.emissiveIntensity = telemetry.soundTriggered ? 1.8 : 0.1;
      rig.soundDoLedMat.color.setHex(telemetry.soundTriggered ? 0x38bdf8 : 0x0c4a6e);

      rig.soundSensorWaves.forEach((wave, idx) => {
        const phase = (elapsed * 1.8 + idx * 0.33) % 1;
        // Move inward toward condenser mic face (-0.69)
        wave.position.x = -1.35 + phase * 0.62;
        wave.scale.setScalar(1.3 - phase * 0.5);
        const wMat = wave.material as THREE.MeshBasicMaterial;
        wMat.opacity = soundAmp > 0.04 ? (1 - phase * 0.65) * soundAmp * 0.72 : 0;
      });

      if (telemetry.soundTriggered) {
        rig.soundTriggerPulse.visible = true;
        soundPulseT = (soundPulseT + delta * 0.95) % 1;
        rig.soundWireCurve.getPointAt(soundPulseT, _ptVec);
        rig.soundTriggerPulse.position.copy(_ptVec);
      } else {
        rig.soundTriggerPulse.visible = false;
      }

      // 4. Sensor 2 Simulation: ACS712 Hall-Effect Flux Rings & Trip Pulse
      const currentNorm = Math.min(1.3, telemetry.currentA / 8.0);
      rig.acsLedMat.emissiveIntensity = telemetry.protectTripped ? 2.0 : 0.55;
      rig.acsFluxRings.forEach((ring, idx) => {
        const speedMult = telemetry.protectTripped ? 3.2 : 0.9 + currentNorm * 1.4;
        const phase = (elapsed * speedMult + idx * 0.33) % 1;
        ring.position.y = 0.14 + phase * 0.34;
        ring.scale.setScalar(0.75 + phase * (0.75 + currentNorm * 0.5));
        const rMat = ring.material as THREE.MeshBasicMaterial;
        rMat.color.setHex(telemetry.protectTripped ? 0xef4444 : currentNorm > 0.6 ? 0xfacc15 : 0x38bdf8);
        rMat.opacity = (1 - phase) * (0.28 + Math.min(0.65, currentNorm * 0.65));
      });

      if (telemetry.currentA > 0.5 || telemetry.protectTripped) {
        rig.acsTripPulse.visible = true;
        acsPulseT = (acsPulseT + delta * (telemetry.protectTripped ? 2.2 : 0.7)) % 1;
        rig.acsWireCurve.getPointAt(acsPulseT, _ptVec);
        rig.acsTripPulse.position.copy(_ptVec);
        (rig.acsTripPulse.material as THREE.MeshBasicMaterial).color.setHex(
          telemetry.protectTripped ? 0xef4444 : 0xfacc15
        );
      } else {
        rig.acsTripPulse.visible = false;
      }

      // 5. Sensor 3 Simulation: DS18B20 Thermal Probe Glow & Collar Color
      if (heatRatio < 0.5) {
        _tempColor.copy(_coolColor).lerp(_warmColor, heatRatio * 2);
      } else {
        _tempColor.copy(_warmColor).lerp(_hotColor, (heatRatio - 0.5) * 2);
      }
      rig.tempAuraMat.color.copy(_tempColor);
      rig.tempAuraMat.opacity = 0.16 + heatRatio * 0.38 + Math.sin(elapsed * (3 + heatRatio * 6)) * 0.06;
      rig.tempAuraMesh.scale.setScalar(0.85 + heatRatio * 0.45 + Math.sin(elapsed * 4) * 0.05);
      rig.tempCollarRingMat.color.copy(_tempColor);
      rig.tempCollarRingMat.emissive.copy(_tempColor);

      // 6. Active unit floor ring
      (['mic', 'mixer', 'amp', 'spk'] as NodeKey[]).forEach((k) => {
        const ringMat = rig.unitHighlightRings[k].material as THREE.MeshBasicMaterial;
        const isCurrent = activeNodeRef.current === k;
        ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, isCurrent ? 0.55 : 0.12, 8, delta);
      });

      // 7. Parallel speaker satellites visibility
      rig.spkSatellites.forEach((sat, idx) => {
        sat.visible = idx + 2 <= p.spkCount;
      });

      // 8. Exploded view + acoustic vibrations
      const targetExp = p.explode ? 1.85 : 1.0;
      explodeAlpha = THREE.MathUtils.damp(explodeAlpha, targetExp, 7, delta);

      const vib = ((telemetry.soundDb - 35) / 65) * 0.08;
      const micOsc = Math.sin(elapsed * 28) * vib;
      rig.micLayers.forEach((l) => {
        const extra = l.idx === 2 || l.idx === 3 ? micOsc : 0;
        l.mesh.position.x = l.baseX * explodeAlpha + extra;
      });

      const spkOsc = telemetry.protectTripped ? 0 : Math.sin(elapsed * 26) * vib * (p.tapWatts / 15 + 0.3);
      rig.spkLayers.forEach((l) => {
        const extra = l.idx === 4 ? spkOsc : 0;
        l.mesh.position.x = l.baseX * explodeAlpha + extra;
      });

      const audioStrength = telemetry.protectTripped ? 0 : Math.max(0, (telemetry.soundDb - 36) / 60);
      rig.acousticRings.forEach((ring, idx) => {
        const phase = (elapsed * 1.4 + idx * 0.33) % 1;
        ring.position.x = 1.55 + phase * 1.65;
        ring.scale.setScalar(0.85 + phase * 0.85);
        const rMat = ring.material as THREE.MeshBasicMaterial;
        rMat.opacity = audioStrength > 0.05 ? (1 - phase) * audioStrength * 0.55 : 0;
      });

      rig.mixerFaders.forEach((f) => {
        f.mesh.position.z = 1.1 + Math.sin(elapsed * 2.2 + f.phase) * (0.25 + p.fader * 0.35);
      });

      const speed = telemetry.protectTripped ? 0.06 * delta : (0.21 + p.atten * 0.18) * delta;
      rig.signals.forEach((sig) => {
        sig.t = (sig.t + speed) % 1;
        rig.pathCurve.getPointAt(sig.t, _ptVec);
        sig.mesh.position.copy(_ptVec);

        const sMat = sig.mesh.material as THREE.MeshBasicMaterial;
        if (telemetry.protectTripped && sig.t > 0.55) {
          sig.mesh.scale.setScalar(0.28);
          sMat.color.setHex(0xef4444);
        } else if (sig.t < 0.45) {
          sig.mesh.scale.setScalar(0.75);
          sMat.color.setHex(0x38bdf8);
        } else if (sig.t < 0.78) {
          sig.mesh.scale.setScalar(1.32);
          sMat.color.setHex(0xfacc15);
        } else {
          sig.mesh.scale.setScalar(1.05);
          sMat.color.setHex(0x4ade80);
        }
      });

      // 9. Smooth damped camera preset glide
      if (camAnimatingRef.current) {
        _desiredCam.set(...camReqRef.current.cam);
        _desiredLook.set(...camReqRef.current.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCam.x, 5.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCam.y, 5.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCam.z, 5.5, delta);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredLook.x, 5.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredLook.y, 5.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredLook.z, 5.5, delta);

        if (
          camera.position.distanceTo(_desiredCam) < 0.04 &&
          controls.target.distanceTo(_desiredLook) < 0.04
        ) {
          camAnimatingRef.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      window.removeEventListener('resize', onResize);

      rig.disposables.geometries.forEach((g) => g.dispose());
      rig.disposables.materials.forEach((m) => m.dispose());
      rig.disposables.textures.forEach((t) => t.dispose());
      envTarget.dispose();
      if (softbox) softbox.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />

      {hoverTip && (
        <div
          className="pointer-events-none fixed z-30 rounded-md border border-sky-400/50 bg-[#0a1120]/95 px-2.5 py-1 text-[11px] font-medium text-sky-200 shadow-lg whitespace-nowrap"
          style={{ left: hoverTip.x + 14, top: hoverTip.y - 12 }}
        >
          {hoverTip.label}
        </div>
      )}

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060b14]/95 z-30 p-6 text-center">
          <div className="max-w-md border border-slate-700 bg-slate-900 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-100">Konteks WebGL Terhenti Sementara</h2>
            <p className="text-sm text-slate-400 mt-2">
              Perangkat grafis sedang memulihkan konteks 3D. Muat ulang halaman jika tampilan belum kembali otomatis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
