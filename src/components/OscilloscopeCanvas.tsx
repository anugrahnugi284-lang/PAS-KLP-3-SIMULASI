import { useEffect, useRef } from 'react';
import type { SimParams, TelemetryState } from '../data/systemCatalog';

interface OscilloscopeCanvasProps {
  params: SimParams;
  telemetry: TelemetryState;
}

const STAGE_COLORS = ['#38bdf8', '#818cf8', '#22d3ee', '#facc15', '#4ade80'];

export function OscilloscopeCanvas({ params, telemetry }: OscilloscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ params, telemetry });

  useEffect(() => {
    stateRef.current = { params, telemetry };
  }, [params, telemetry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const draw = (now: number) => {
      const t = (now - startTime) * 0.001;
      const { params: p, telemetry: tel } = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Background technical graticule
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      for (let i = 1; i < 5; i++) {
        const vx = (w / 5) * i;
        ctx.moveTo(vx, 0);
        ctx.lineTo(vx, h);
      }
      ctx.stroke();

      const segW = w / 5;
      const baseAmp = (tel.soundDb - 30) / 70;
      const lineAmp = Math.min(1, baseAmp * (0.4 + p.gain * 0.8) * p.fader);
      const cableAtten = Math.max(0.45, 1 - (p.cableMeters / 400) * 0.35);
      const hvAmp = tel.protectTripped ? 0.02 : Math.min(1.2, lineAmp * (0.5 + p.atten * 1.1));
      const spkAmp = tel.protectTripped
        ? 0.01
        : Math.min(1.2, hvAmp * cableAtten * (p.tapWatts / 15 + 0.35));

      const amps = [baseAmp * 0.6, baseAmp * 0.35, lineAmp * 0.75, hvAmp * 0.9, spkAmp * 0.85];

      for (let s = 0; s < 5; s++) {
        ctx.strokeStyle = STAGE_COLORS[s];
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        const xStart = s * segW;
        for (let px = 0; px <= segW; px += 2) {
          const freq = 0.22 + s * 0.045 + (p.eq / 24) * 0.08;
          const y = h / 2 + Math.sin((xStart + px) * freq + t * 8) * (amps[s] * (h * 0.36));
          if (px === 0) ctx.moveTo(xStart + px, y);
          else ctx.lineTo(xStart + px, y);
        }
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={104}
      className="w-full h-[104px] rounded-md bg-[#040811] border border-slate-800 block"
      aria-label="Osiloskop 5 titik rantai sinyal audio"
    />
  );
}
