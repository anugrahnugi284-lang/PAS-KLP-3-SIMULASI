import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  DoorOpen,
  Lock,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PaAudioEngine } from './audio/paAudioEngine';
import { OscilloscopeCanvas } from './components/OscilloscopeCanvas';
import { PaViewport, type CameraTargetRequest } from './components/PaViewport';
import {
  CAMERA_PRESETS,
  COMPONENT_CATALOG,
  INITIAL_SIM_PARAMS,
  INITIAL_TELEMETRY,
  UNIT_COMPONENTS,
  type CameraPreset,
  type ComponentKey,
  type FaultType,
  type NodeKey,
  type SensorKey,
  type SimParams,
  type TelemetryState,
} from './data/systemCatalog';

type ControlTab = 'mixer' | 'amp';

export default function App() {
  const [params, setParams] = useState<SimParams>(INITIAL_SIM_PARAMS);
  const [telemetry, setTelemetry] = useState<TelemetryState>(INITIAL_TELEMETRY);
  const [activeNode, setActiveNode] = useState<NodeKey>('mic');
  const [selectedPart, setSelectedPart] = useState<ComponentKey>('mic');
  const [controlTab, setControlTab] = useState<ControlTab>('mixer');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [imgError, setImgError] = useState(false);

  const [cameraRequest, setCameraRequest] = useState<CameraTargetRequest>({
    cam: CAMERA_PRESETS.overview.cam,
    target: CAMERA_PRESETS.overview.target,
    nonce: 0,
  });

  const audioRef = useRef<PaAudioEngine | null>(null);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    const engine = new PaAudioEngine();
    audioRef.current = engine;
    return () => {
      engine.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const inspected = COMPONENT_CATALOG[selectedPart];

  const pushCamera = useCallback(
    (cam: [number, number, number], target: [number, number, number]) => {
      setCameraRequest((prev) => ({ cam, target, nonce: prev.nonce + 1 }));
    },
    []
  );

  const selectPart = useCallback(
    (partKey: ComponentKey) => {
      const entry = COMPONENT_CATALOG[partKey];
      if (!entry) return;
      setSelectedPart(partKey);
      setActiveNode(entry.parentUnit);
      setImgError(false);
      pushCamera(entry.cam, entry.target);
    },
    [pushCamera]
  );

  const applyCameraPreset = useCallback(
    (preset: CameraPreset) => {
      if (preset === 'closeup') {
        const entry = COMPONENT_CATALOG[selectedPart];
        pushCamera(entry.cam, entry.target);
        return;
      }
      const cfg = CAMERA_PRESETS[preset];
      pushCamera(cfg.cam, cfg.target);
    },
    [selectedPart, pushCamera]
  );

  const handleTelemetryTick = useCallback(
    (next: TelemetryState, elapsed: number) => {
      setTelemetry(next);
      audioRef.current?.update(paramsRef.current, next, elapsed);
    },
    []
  );

  const toggleAudio = () => {
    const engine = audioRef.current;
    if (!engine) return;
    if (engine.isEnabled()) {
      engine.stop();
      setAudioOn(false);
    } else {
      const started = engine.start();
      setAudioOn(started);
    }
  };

  const toggleFault = (fault: Exclude<FaultType, null>) => {
    setParams((prev) => ({
      ...prev,
      fault: prev.fault === fault ? null : fault,
    }));
  };

  const allCasingsOpen = useMemo(
    () =>
      params.casingOpen.mic &&
      params.casingOpen.mixer &&
      params.casingOpen.amp &&
      params.casingOpen.spk,
    [params.casingOpen]
  );

  const toggleAllCasings = () => {
    const next = !allCasingsOpen;
    setParams((prev) => ({
      ...prev,
      casingOpen: {
        mic: next,
        mixer: next,
        amp: next,
        spk: next,
      },
    }));
  };

  const toggleUnitCasing = (unit: NodeKey) => {
    setParams((prev) => ({
      ...prev,
      casingOpen: {
        ...prev.casingOpen,
        [unit]: !prev.casingOpen[unit],
      },
    }));
  };

  const resetSimulation = () => {
    setParams(INITIAL_SIM_PARAMS);
    setSelectedPart('mic');
    setActiveNode('mic');
    setImgError(false);
    applyCameraPreset('overview');
  };

  const statusMeta = useMemo(() => {
    if (telemetry.protectTripped) {
      return {
        label: params.fault === 'short' ? 'SHORT CIRCUIT' : 'OVERLOAD',
        sub: 'Proteksi Aktif · Output Diputus',
        tone: 'text-rose-400',
      };
    }
    if (telemetry.priorityActive) {
      return {
        label: 'PRIORITY OVERRIDE',
        sub: 'BGM Diredam · Paging/Alarm',
        tone: 'text-amber-300',
      };
    }
    return {
      label: 'NORMAL',
      sub: 'Alur 100V Line Stabil',
      tone: 'text-emerald-400',
    };
  }, [telemetry.protectTripped, telemetry.priorityActive, params.fault]);

  const tempTone =
    telemetry.tempC > 65
      ? 'text-rose-400'
      : telemetry.tempC > 50
      ? 'text-amber-300'
      : 'text-emerald-400';

  const tempSub =
    telemetry.tempC > 65
      ? 'Suhu Kritis Heatsink'
      : telemetry.tempC > 50
      ? 'Beban Termal Meningkat'
      : 'Heatsink Terpantau';

  const soundSub = params.alarm
    ? 'Alarm Prioritas'
    : params.ptt
    ? 'Paging PTT Aktif'
    : params.bgm
    ? 'BGM Aktif'
    : 'Sunyi / Standby';

  const unitCasingIsOpen = params.casingOpen[inspected.parentUnit];
  const unitParts = UNIT_COMPONENTS[activeNode];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060b14] text-slate-100">
      {/* FULL-VIEWPORT 3D DIGITAL TWIN */}
      <PaViewport
        params={params}
        activeNode={activeNode}
        selectedPart={selectedPart}
        cameraRequest={cameraRequest}
        onSelectPart={selectPart}
        onTelemetryTick={handleTelemetryTick}
      />

      {/* TOP HEADER & LIVE TELEMETRY BAR */}
      <header className="pointer-events-none absolute top-3 left-4 right-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0a1120]/94 px-4 py-2.5 shadow-lg">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100 whitespace-nowrap">
              3D Digital Twin · Public Address System (100V Line)
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
              Klik komponen atau sensor mana saja pada 3D · Buka/tutup casing perangkat
            </p>
          </div>
          <div className="h-7 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleAllCasings}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                allCasingsOpen
                  ? 'border-amber-400/60 bg-amber-600/90 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-400/60'
              }`}
            >
              {allCasingsOpen ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Tutup Casing</span>
                </>
              ) : (
                <>
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Buka Casing</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={toggleAudio}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                audioOn
                  ? 'border-sky-400/60 bg-sky-600 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
              title="Aktifkan/Matikan Audio Monitor Sintetis"
            >
              {audioOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{audioOn ? 'Audio: ON' : 'Audio: OFF'}</span>
            </button>
            <button
              type="button"
              onClick={resetSimulation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Reset simulasi"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* TELEMETRY STRIP */}
        <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-slate-800 bg-[#0a1120]/94 px-3.5 py-2 min-w-[138px] shadow-lg">
            <div className="text-[10px] font-medium text-slate-400">Suhu Probe (DS18B20)</div>
            <div className={`font-mono-tech text-sm font-bold mt-0.5 ${tempTone}`}>
              {telemetry.tempC.toFixed(1)} °C
            </div>
            <div className="text-[10px] text-slate-500 truncate">{tempSub}</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0a1120]/94 px-3.5 py-2 min-w-[138px] shadow-lg">
            <div className="text-[10px] font-medium text-slate-400">Sensor Suara (LM393)</div>
            <div className="font-mono-tech text-sm font-bold mt-0.5 text-sky-300">
              {telemetry.soundDb.toFixed(1)} dB
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {telemetry.soundTriggered ? 'Trigger DO Aktif' : soundSub}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0a1120]/94 px-3.5 py-2 min-w-[148px] shadow-lg">
            <div className="text-[10px] font-medium text-slate-400">Arus Beban (ACS712)</div>
            <div
              className={`font-mono-tech text-sm font-bold mt-0.5 ${
                telemetry.protectTripped ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {telemetry.currentA.toFixed(2)} A
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              Tap {params.tapWatts}W × {params.spkCount} · {params.cableMeters}m
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0a1120]/94 px-3.5 py-2 min-w-[155px] shadow-lg">
            <div className="text-[10px] font-medium text-slate-400">Status Sistem</div>
            <div className={`font-mono-tech text-sm font-bold mt-0.5 ${statusMeta.tone}`}>
              {statusMeta.label}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{statusMeta.sub}</div>
          </div>
        </div>
      </header>

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL & INSPECTOR DOCK */}
      <section
        aria-label="Panel Kontrol, Inspektor Komponen, dan Osiloskop"
        className={`fixed bottom-3 left-1/2 z-20 w-[96vw] max-w-[1280px] -translate-x-1/2 transition-transform duration-200 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Handle */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-700/90 bg-[#0a1120]/95 px-4 py-1 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
                <span>Tampilkan Panel Kontrol &amp; Inspektor (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Sembunyikan Panel (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Dock Shell */}
        <div className="rounded-xl border border-slate-800 bg-[#0a1120]/95 shadow-2xl overflow-hidden">
          {/* Chain & Camera Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 px-3.5 py-2 bg-[#0d1629]/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Perangkat:</span>
              {(['mic', 'mixer', 'amp', 'spk'] as NodeKey[]).map((key) => {
                const labels: Record<NodeKey, string> = {
                  mic: '1. Paging Mic',
                  mixer: '2. Pre-Amp / Mixer',
                  amp: '3. Power Amp 100V',
                  spk: '4. Ceiling Speaker',
                };
                const isActiveUnit = activeNode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectPart(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActiveUnit
                        ? 'bg-sky-600 text-white border border-sky-400/50'
                        : 'bg-slate-900 text-slate-300 border border-slate-700/80 hover:border-sky-500/60 hover:text-white'
                    }`}
                  >
                    {labels[key]}
                  </button>
                );
              })}

              <span className="mx-1 h-4 w-px bg-slate-800 hidden sm:inline-block" />

              {(['sound', 'current', 'temp'] as SensorKey[]).map((sKey) => {
                const sLabels: Record<SensorKey, string> = {
                  sound: 'Sensor Suara',
                  current: 'Sensor Arus ACS712',
                  temp: 'Sensor Suhu Probe',
                };
                const isSelected = selectedPart === sKey;
                return (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => selectPart(sKey)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white border border-amber-400/60'
                        : 'bg-slate-900 text-slate-300 border border-slate-700/80 hover:border-amber-400/60 hover:text-white'
                    }`}
                  >
                    {sLabels[sKey]}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Kamera:</span>
              <button
                type="button"
                onClick={() => applyCameraPreset('overview')}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-700/80 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => applyCameraPreset('closeup')}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-700/80 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Fokus Komponen
              </button>
              <button
                type="button"
                onClick={() => applyCameraPreset('sensors')}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-300 border border-slate-700/80 hover:border-sky-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Posisi Sensor
              </button>
            </div>
          </div>

          {/* 3-Column Dock Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/90 max-h-[290px] overflow-y-auto lg:overflow-hidden dock-scroll">
            {/* COLUMN 1: OPERATOR CONTROLS */}
            <div className="lg:col-span-4 p-3.5 flex flex-col gap-2.5">
              {/* Quick Priority & Explode Toggles */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, ptt: !p.ptt }))}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    params.ptt
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-500'
                  }`}
                >
                  {params.ptt ? 'PTT: ON' : 'PTT: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, bgm: !p.bgm }))}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    params.bgm
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  {params.bgm ? 'BGM: ON' : 'BGM: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, alarm: !p.alarm }))}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    params.alarm
                      ? 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-rose-500'
                  }`}
                >
                  {params.alarm ? 'Alarm: ON' : 'Alarm: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, explode: !p.explode }))}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    params.explode
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500'
                  }`}
                >
                  {params.explode ? 'Explode: ON' : 'Explode'}
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setControlTab('mixer')}
                  className={`py-1 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    controlTab === 'mixer'
                      ? 'bg-slate-800 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mixer &amp; Pre-Amp
                </button>
                <button
                  type="button"
                  onClick={() => setControlTab('amp')}
                  className={`py-1 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    controlTab === 'amp'
                      ? 'bg-slate-800 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Power Amp &amp; Speaker
                </button>
              </div>

              {controlTab === 'mixer' ? (
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Gain / Pre-Amp</span>
                      <span className="font-mono-tech text-sky-300">
                        {Math.round(params.gain * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(params.gain * 100)}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, gain: Number(e.target.value) / 100 }))
                      }
                      className="studio-range"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>EQ Tone (Bass/Mid/Treble)</span>
                      <span className="font-mono-tech text-sky-300">
                        {params.eq >= 0 ? `+${params.eq}` : params.eq} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      value={params.eq}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, eq: Number(e.target.value) }))
                      }
                      className="studio-range"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Master Fader (Mixing)</span>
                      <span className="font-mono-tech text-sky-300">
                        {Math.round(params.fader * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(params.fader * 100)}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, fader: Number(e.target.value) / 100 }))
                      }
                      className="studio-range"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>Attenuator</span>
                        <span className="font-mono-tech text-sky-300">
                          {Math.round(params.atten * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(params.atten * 100)}
                        onChange={(e) =>
                          setParams((p) => ({ ...p, atten: Number(e.target.value) / 100 }))
                        }
                        className="studio-range"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>Kabel 100V</span>
                        <span className="font-mono-tech text-sky-300">
                          {params.cableMeters} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={400}
                        step={10}
                        value={params.cableMeters}
                        onChange={(e) =>
                          setParams((p) => ({ ...p, cableMeters: Number(e.target.value) }))
                        }
                        className="studio-range"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <div className="text-[11px] text-slate-300 mb-1">Tap Speaker 100V</div>
                      <div className="grid grid-cols-3 gap-1">
                        {([3, 6, 15] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setParams((p) => ({ ...p, tapWatts: w }))}
                            className={`py-1 rounded text-[11px] font-mono-tech border transition-colors cursor-pointer ${
                              params.tapWatts === w
                                ? 'bg-sky-600 border-sky-400 text-white font-semibold'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-sky-500'
                            }`}
                          >
                            {w}W
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>Speaker Paralel</span>
                        <span className="font-mono-tech text-sky-300">
                          {params.spkCount} Unit
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={params.spkCount}
                        onChange={(e) =>
                          setParams((p) => ({ ...p, spkCount: Number(e.target.value) }))
                        }
                        className="studio-range"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleFault('short')}
                      className={`py-1 px-2 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                        params.fault === 'short'
                          ? 'bg-rose-600 border-rose-400 text-white font-semibold'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-rose-500'
                      }`}
                    >
                      {params.fault === 'short' ? 'Short Circuit: AKTIF' : 'Short Circuit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFault('overload')}
                      className={`py-1 px-2 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                        params.fault === 'overload'
                          ? 'bg-rose-600 border-rose-400 text-white font-semibold'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-rose-500'
                      }`}
                    >
                      {params.fault === 'overload' ? 'Overload: AKTIF' : 'Overload'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMN 2: COMPONENT & SENSOR INSPECTOR */}
            <div className="lg:col-span-5 p-3.5 overflow-y-auto dock-scroll max-h-[272px]">
              {/* Unit Casing Toggle + Active Sub-Component Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1">
                  {unitParts.map((part) => (
                    <button
                      key={part.key}
                      type="button"
                      onClick={() => selectPart(part.key)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        selectedPart === part.key
                          ? 'bg-sky-600/90 border-sky-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      {part.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => toggleUnitCasing(inspected.parentUnit)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    unitCasingIsOpen
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-300 hover:bg-amber-600/30'
                      : 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                  }`}
                >
                  {unitCasingIsOpen ? 'Tutup Casing Unit' : 'Buka Casing Unit'}
                </button>
              </div>

              <div className="text-[11px] font-medium text-sky-400">{inspected.kicker}</div>
              <h2 className="text-sm font-semibold text-slate-100 mt-0.5">{inspected.title}</h2>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                <div className="sm:col-span-5 rounded-lg overflow-hidden border border-slate-700/80 bg-[#050912]">
                  {!imgError ? (
                    <img
                      src={inspected.photo}
                      alt={inspected.caption}
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="w-full h-[112px] object-cover block"
                    />
                  ) : (
                    <div className="w-full h-[112px] flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-slate-900 to-slate-800">
                      <Cpu className="w-5 h-5 text-sky-400 mb-1" />
                      <span className="text-[10px] text-slate-300 font-medium">
                        {inspected.title}
                      </span>
                    </div>
                  )}
                  <div className="px-2 py-1 text-[10px] text-slate-400 border-t border-slate-800 truncate">
                    {inspected.caption}
                  </div>
                </div>

                <div className="sm:col-span-7 space-y-1.5">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400">Penjelasan</div>
                    <p className="text-[11.5px] leading-relaxed text-slate-200">
                      {inspected.explanation}
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400">Cara Kerja</div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300">
                      {inspected.workingPrinciple}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                <div>
                  <span className="text-[10px] font-semibold text-sky-300">Alur Sinyal: </span>
                  <span className="text-[11px] text-slate-200">{inspected.signalFlow}</span>
                </div>
                <ul className="space-y-0.5 text-[11px] text-slate-400 list-disc pl-4">
                  {inspected.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* COLUMN 3: 5-POINT REAL-TIME OSCILLOSCOPE */}
            <div className="lg:col-span-3 p-3.5 flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Osiloskop 5 Titik Rantai Sinyal
                  </span>
                  <span className="font-mono-tech text-[10px] text-sky-300">Real-Time</span>
                </div>
                <OscilloscopeCanvas params={params} telemetry={telemetry} />
                <div className="grid grid-cols-5 gap-1 mt-1.5 text-center text-[9.5px] font-medium">
                  <span className="text-sky-400">1. Akustik</span>
                  <span className="text-indigo-400">2. Mic mV</span>
                  <span className="text-cyan-400">3. Line</span>
                  <span className="text-amber-300">4. 100V</span>
                  <span className="text-emerald-400">5. Out</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2 text-[10.5px]">
                <div>
                  <div className="text-slate-500">Tegangan Line</div>
                  <div className="font-mono-tech font-semibold text-amber-300">
                    {telemetry.lineVoltageV} V
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Total Beban</div>
                  <div className="font-mono-tech font-semibold text-slate-200">
                    {telemetry.totalLoadWatts} W
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Rugi Kabel</div>
                  <div className="font-mono-tech font-semibold text-sky-300">
                    {telemetry.cableLossPct}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
