import type { SimParams, TelemetryState } from '../data/systemCatalog';

export class PaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private bgmOsc1: OscillatorNode | null = null;
  private bgmOsc2: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;
  private pttOsc: OscillatorNode | null = null;
  private pttGain: GainNode | null = null;
  private alarmOsc: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private enabled = false;
  private lastPtt = false;

  public start(): boolean {
    if (this.enabled) return true;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'peaking';
      this.filterNode.frequency.value = 1200;
      this.filterNode.Q.value = 0.8;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0;

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Soft ambient BGM pad (A3 + E4)
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0;
      this.bgmOsc1 = this.ctx.createOscillator();
      this.bgmOsc1.type = 'sine';
      this.bgmOsc1.frequency.value = 220;
      this.bgmOsc2 = this.ctx.createOscillator();
      this.bgmOsc2.type = 'triangle';
      this.bgmOsc2.frequency.value = 329.63;
      this.bgmOsc1.connect(this.bgmGain);
      this.bgmOsc2.connect(this.bgmGain);
      this.bgmGain.connect(this.filterNode);
      this.bgmOsc1.start();
      this.bgmOsc2.start();

      // Paging voice-band carrier
      this.pttGain = this.ctx.createGain();
      this.pttGain.gain.value = 0;
      this.pttOsc = this.ctx.createOscillator();
      this.pttOsc.type = 'triangle';
      this.pttOsc.frequency.value = 440;
      this.pttOsc.connect(this.pttGain);
      this.pttGain.connect(this.filterNode);
      this.pttOsc.start();

      // Evacuation alarm sweep
      this.alarmGain = this.ctx.createGain();
      this.alarmGain.gain.value = 0;
      this.alarmOsc = this.ctx.createOscillator();
      this.alarmOsc.type = 'sawtooth';
      this.alarmOsc.frequency.value = 660;
      this.alarmOsc.connect(this.alarmGain);
      this.alarmGain.connect(this.filterNode);
      this.alarmOsc.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.enabled = true;
    return true;
  }

  public stop(): void {
    this.enabled = false;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private playPagingChime(): void {
    if (!this.ctx || !this.filterNode || !this.enabled) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.filterNode) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + idx * 0.14);
      g.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.36);
      osc.connect(g);
      g.connect(this.filterNode);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.38);
    });
  }

  public update(params: SimParams, telemetry: TelemetryState, elapsed: number): void {
    if (!this.enabled || !this.ctx || !this.masterGain || !this.filterNode) {
      this.lastPtt = params.ptt;
      return;
    }

    if (params.ptt && !this.lastPtt && !telemetry.protectTripped) {
      this.playPagingChime();
    }
    this.lastPtt = params.ptt;

    const now = this.ctx.currentTime;
    this.filterNode.gain.setTargetAtTime(params.eq, now, 0.05);

    const cableAtten = Math.max(0.45, 1 - (params.cableMeters / 400) * 0.35);
    const tapScale = params.tapWatts / 15;
    const totalLevel = telemetry.protectTripped
      ? 0
      : Math.min(0.22, params.gain * params.fader * params.atten * cableAtten * (0.35 + tapScale * 0.65) * 0.22);

    this.masterGain.gain.setTargetAtTime(totalLevel, now, 0.06);

    if (this.bgmGain) {
      const bgmOn = params.bgm && !telemetry.priorityActive && !telemetry.protectTripped;
      this.bgmGain.gain.setTargetAtTime(bgmOn ? 0.35 : 0, now, 0.08);
    }

    if (this.pttGain && this.pttOsc) {
      const pttOn = params.ptt && !telemetry.protectTripped;
      this.pttOsc.frequency.setTargetAtTime(
        380 + Math.sin(elapsed * 7) * 45 + Math.cos(elapsed * 11) * 22,
        now,
        0.04
      );
      this.pttGain.gain.setTargetAtTime(pttOn ? 0.22 : 0, now, 0.06);
    }

    if (this.alarmGain && this.alarmOsc) {
      const alarmOn = params.alarm && !telemetry.protectTripped;
      const sweep = 620 + ((Math.sin(elapsed * 6.5) + 1) * 0.5) * 340;
      this.alarmOsc.frequency.setTargetAtTime(sweep, now, 0.03);
      this.alarmGain.gain.setTargetAtTime(alarmOn ? 0.25 : 0, now, 0.05);
    }
  }

  public dispose(): void {
    this.enabled = false;
    try {
      this.bgmOsc1?.stop();
      this.bgmOsc2?.stop();
      this.pttOsc?.stop();
      this.alarmOsc?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore already stopped oscillators
    }
    this.ctx = null;
  }
}
