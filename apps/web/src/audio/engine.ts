/**
 * Sound for "Clave" (SPEC §6), synthesized with Web Audio: no files to download (ADR-025).
 * The public surface (unlock, play, setMusic, setVolumes) stays the same when real assets and
 * Howler replace the synth later (docs/AUDIO-ASSETS.md).
 */
export type SoundId =
  | 'ui_click'
  | 'ui_hover'
  | 'join'
  | 'point'
  | 'flip'
  | 'reveal_own'
  | 'reveal_civil'
  | 'reveal_enemy'
  | 'reveal_traitor'
  | 'clue'
  | 'turn_change'
  | 'your_turn'
  | 'tick'
  | 'win'
  | 'lose'
  | 'chat';

export type MusicTrack = 'lobby' | 'game';
export interface Volumes {
  master: number;
  music: number;
  effects: number;
}

type Wave = OscillatorType;
interface HissOptions {
  from?: number;
  /** End of the filter sweep; defaults to `from` (no sweep). */
  to?: number;
  q?: number;
  gain?: number;
  type?: BiquadFilterType;
}
const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private intensityBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volumes: Volumes = { master: 0.8, music: 0.4, effects: 0.8 };
  private track: MusicTrack | null = null;
  private intense = false;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;

  /** iOS/Chrome only allow audio after a user gesture: call this from one (SPEC §6.4). */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext as typeof AudioContext | undefined;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.effectsBus = ctx.createGain();
      this.intensityBus = ctx.createGain();
      this.intensityBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.intensityBus.connect(this.musicBus);
      this.effectsBus.connect(this.master);
      this.master.connect(ctx.destination);
      this.noise = this.makeNoise(ctx);
      // Observable state (Ajustes and E2E): "running" once the first gesture unlocked audio.
      ctx.addEventListener('statechange', () => {
        document.documentElement.dataset.audio = ctx.state;
      });
      this.applyVolumes();
      if (this.track) this.startScheduler();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  setVolumes(volumes: Volumes) {
    this.volumes = volumes;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.master || !this.musicBus || !this.effectsBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.5, t, 0.05);
    this.effectsBus.gain.setTargetAtTime(this.volumes.effects, t, 0.05);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i++) {
      // Small LCG: deterministic noise, no Math.random needed.
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 2 ** 32) * 2 - 1;
    }
    return buffer;
  }

  // ── building blocks ─────────────────────────────────────────────────────

  private tone(
    out: AudioNode,
    freq: number,
    start: number,
    dur: number,
    {
      wave = 'sine',
      gain = 0.2,
      glideTo,
      attack = 0.005,
    }: {
      wave?: Wave;
      gain?: number;
      glideTo?: number;
      attack?: number;
    } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private hiss(
    out: AudioNode,
    start: number,
    dur: number,
    { from = 1000, to, q = 1, gain = 0.15, type = 'bandpass' }: HissOptions = {},
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to ?? from, start + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(env).connect(out);
    src.start(start, Math.random() * 0.5, dur + 0.05);
  }

  // ── effects (SPEC §6.2) ────────────────────────────────────────────────

  play(id: SoundId) {
    const ctx = this.ctx;
    const out = this.effectsBus;
    if (!ctx || !out || ctx.state !== 'running' || this.volumes.effects === 0) return;
    const t = ctx.currentTime + 0.01;
    switch (id) {
      case 'ui_click':
        this.tone(out, 1800, t, 0.035, { wave: 'triangle', gain: 0.12 });
        break;
      case 'ui_hover':
        this.tone(out, 2600, t, 0.02, { gain: 0.025 });
        break;
      case 'join':
        this.tone(out, NOTE(19), t, 0.5, { gain: 0.15 });
        this.tone(out, NOTE(26), t + 0.08, 0.45, { gain: 0.1 });
        break;
      case 'point':
        this.hiss(out, t, 0.03, { from: 3500, type: 'highpass', gain: 0.18 });
        break;
      case 'flip':
        this.hiss(out, t, 0.2, { from: 700, to: 3200, q: 0.8, gain: 0.2 });
        break;
      case 'reveal_own':
        [3, 7, 10, 15].forEach((n, i) => {
          this.tone(out, NOTE(n), t + 0.35 + i * 0.07, 0.35, { wave: 'triangle', gain: 0.16 });
        });
        break;
      case 'reveal_civil':
        this.tone(out, NOTE(-14), t + 0.35, 0.45, { wave: 'sine', gain: 0.22 });
        break;
      case 'reveal_enemy':
        this.tone(out, NOTE(0), t + 0.35, 0.22, { wave: 'square', gain: 0.07 });
        this.tone(out, NOTE(-5), t + 0.6, 0.35, { wave: 'square', gain: 0.07 });
        break;
      case 'reveal_traitor':
        this.tone(out, 110, t + 0.4, 1.6, { glideTo: 38, gain: 0.5 });
        this.hiss(out, t + 0.4, 1.2, { from: 400, to: 80, type: 'lowpass', gain: 0.25 });
        this.tone(out, NOTE(-21), t + 0.9, 2.2, { wave: 'sawtooth', gain: 0.05, attack: 0.3 });
        break;
      case 'clue':
        [0, 0.07, 0.15].forEach((d) => {
          this.hiss(out, t + d, 0.025, { from: 2500, type: 'highpass', gain: 0.2 });
        });
        this.tone(out, NOTE(36), t + 0.28, 0.6, { gain: 0.12 });
        break;
      case 'turn_change':
        this.hiss(out, t, 0.35, { from: 350, to: 4500, q: 0.6, gain: 0.12 });
        break;
      case 'your_turn':
        this.tone(out, NOTE(12), t, 0.25, { wave: 'triangle', gain: 0.25 });
        this.tone(out, NOTE(19), t + 0.16, 0.5, { wave: 'triangle', gain: 0.25 });
        break;
      case 'tick':
        this.tone(out, 1200, t, 0.03, { wave: 'square', gain: 0.06 });
        break;
      case 'win':
        [3, 7, 10, 15, 10, 15].forEach((n, i) => {
          this.tone(out, NOTE(n), t + i * 0.12, i === 5 ? 0.8 : 0.18, {
            wave: 'triangle',
            gain: 0.18,
          });
        });
        break;
      case 'lose':
        [-5, -6, -7, -8].forEach((n, i) => {
          this.tone(out, NOTE(n), t + i * 0.32, i === 3 ? 0.9 : 0.3, {
            wave: 'sawtooth',
            gain: 0.06,
            ...(i === 3 ? { glideTo: NOTE(-10) } : {}),
          });
        });
        break;
      case 'chat':
        this.tone(out, 600, t, 0.07, { glideTo: 950, gain: 0.12 });
        break;
    }
  }

  // ── music (SPEC §6.3): generated loops on a look-ahead scheduler ───────

  setMusic(track: MusicTrack | null) {
    if (track === this.track) return;
    this.track = track;
    this.beat = 0;
    if (!track) {
      this.stopScheduler();
      return;
    }
    if (this.ctx) this.startScheduler();
  }

  /** The extra layer when a team has ≤ 2 agents left (crossfaded in). */
  setIntensity(on: boolean) {
    if (on === this.intense) return;
    this.intense = on;
    if (this.ctx && this.intensityBus) {
      this.intensityBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.8);
    }
  }

  /** The traitor silences the music for a moment (SPEC §6.2). */
  silenceMusic(seconds: number) {
    if (!this.ctx || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.5, t + seconds, 1);
  }

  private startScheduler() {
    this.stopScheduler();
    if (!this.ctx) return;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.scheduler = setInterval(() => {
      this.schedule();
    }, 100);
  }

  private stopScheduler() {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  private schedule() {
    const ctx = this.ctx;
    const bus = this.musicBus;
    const layer = this.intensityBus;
    if (!ctx || !bus || !layer || !this.track || ctx.state !== 'running') return;
    const lobby = this.track === 'lobby';
    const spb = 60 / (lobby ? 96 : 76);
    // Lobby: walking bass over Am7 – D7 – Fmaj7 – E7 (spy lounge). Game: a low pulse on D minor.
    const lobbyBass = [
      -24, -21, -17, -14, -19, -16, -12, -15, -16, -13, -9, -12, -17, -13, -10, -8,
    ];
    const gameBass = [-19, -19, -19, -12, -19, -19, -20, -12];
    while (this.nextBeat < ctx.currentTime + 0.35) {
      const t = this.nextBeat;
      const b = this.beat;
      if (lobby) {
        this.tone(bus, NOTE(lobbyBass[b % lobbyBass.length] ?? -24), t, spb * 0.9, {
          wave: 'triangle',
          gain: 0.16,
        });
        if (b % 2 === 1) this.hiss(bus, t, 0.09, { from: 6000, type: 'highpass', gain: 0.035 });
        if (b % 4 === 0) {
          for (const n of [3, 7, 10]) {
            this.tone(bus, NOTE(n + (lobbyBass[b % lobbyBass.length] ?? -24) + 24), t, spb * 1.8, {
              gain: 0.025,
              attack: 0.05,
            });
          }
        }
      } else {
        this.tone(bus, NOTE(gameBass[b % gameBass.length] ?? -19), t, spb * 0.7, { gain: 0.14 });
        this.hiss(bus, t + spb / 2, 0.05, { from: 7000, type: 'highpass', gain: 0.02 });
        // Tension layer: a high tremolo, audible only when the intensity bus is up.
        this.tone(layer, NOTE(b % 2 ? 8 : 7), t, spb * 0.5, { wave: 'sawtooth', gain: 0.02 });
      }
      this.nextBeat += spb;
      this.beat += 1;
    }
  }
}

export const audio = new AudioEngine();
