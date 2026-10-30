// Web Audio synthesizer and sound effect manager with swarm-safe throttling.
//
//   audio.play('shoot');
//   audio.register('customLaser', { wave: 'sawtooth', freq: 720, endFreq: 140, duration: 120 });
//   audio.setVolume(0.5);

export class SoundManager {
  constructor({ masterVolume = 0.4 } = {}) {
    this.ctx = null;
    this.masterVolume = Math.max(0, Math.min(1, masterVolume));
    this.muted = false;
    this.sounds = new Map();
    this.lastPlayed = new Map();
    this._noiseBuffer = null;

    this.registerDefaults();
  }

  // Built-in procedural sound presets ready to use without external audio files.
  registerDefaults() {
    this.register('shoot', {
      wave: 'triangle',
      freq: 580,
      endFreq: 160,
      duration: 85,
      volume: 0.35,
      throttleMs: 35,
      pitchVariance: 0.08
    });

    this.register('hit', {
      wave: 'noise',
      freq: 320,
      endFreq: 90,
      duration: 60,
      volume: 0.3,
      throttleMs: 40,
      pitchVariance: 0.12
    });

    this.register('explosion', {
      wave: 'noise',
      freq: 180,
      endFreq: 35,
      duration: 340,
      volume: 0.65,
      throttleMs: 90,
      pitchVariance: 0.06
    });

    this.register('pickup', {
      wave: 'sine',
      freq: 440,
      endFreq: 880,
      duration: 140,
      volume: 0.35,
      throttleMs: 30,
      pitchVariance: 0.04
    });

    this.register('dash', {
      wave: 'sawtooth',
      freq: 220,
      endFreq: 520,
      duration: 130,
      volume: 0.3,
      throttleMs: 80,
      pitchVariance: 0.05
    });

    this.register('levelup', {
      wave: 'triangle',
      freq: 330,
      endFreq: 990,
      duration: 320,
      volume: 0.45,
      throttleMs: 150,
      pitchVariance: 0
    });
  }

  register(id, {
    wave = 'sine',
    freq = 440,
    endFreq = 440,
    duration = 100,
    volume = 0.5,
    throttleMs = 40,
    pitchVariance = 0.05
  } = {}) {
    this.sounds.set(id, {
      id,
      wave,
      freq: Math.max(20, freq),
      endFreq: Math.max(20, endFreq),
      duration: Math.max(10, duration),
      volume: Math.max(0, Math.min(1, volume)),
      throttleMs: Math.max(0, throttleMs),
      pitchVariance: Math.max(0, pitchVariance)
    });
    return this;
  }

  setVolume(level) {
    this.masterVolume = Math.max(0, Math.min(1, level));
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  canPlay(id, now = performance.now()) {
    const preset = this.sounds.get(id);
    if (!preset || this.muted || this.masterVolume <= 0) return false;
    const prev = this.lastPlayed.get(id) ?? -Infinity;
    return now - prev >= preset.throttleMs;
  }

  // Plays a registered preset. Returns false if throttled, muted, or unknown.
  play(id, { volumeScale = 1, pitchScale = 1 } = {}) {
    const now = performance.now();
    const preset = this.sounds.get(id);
    if (!preset) return false;
    if (!this.canPlay(id, now)) return false;

    this.lastPlayed.set(id, now);

    const ctx = this._ensureContext();
    if (!ctx) return true;

    const durSec = preset.duration / 1000;
    const t0 = ctx.currentTime;
    const variance = 1 + (Math.random() * 2 - 1) * preset.pitchVariance;
    const startFreq = Math.max(20, preset.freq * pitchScale * variance);
    const targetFreq = Math.max(20, preset.endFreq * pitchScale * variance);
    const gainVal = Math.max(0.0001, preset.volume * this.masterVolume * volumeScale);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
    gain.connect(ctx.destination);

    if (preset.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this._getNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(startFreq, t0);
      filter.frequency.exponentialRampToValueAtTime(targetFreq, t0 + durSec);
      filter.Q.value = 1.2;

      src.connect(filter);
      filter.connect(gain);
      src.start(t0);
      src.stop(t0 + durSec);
    } else {
      const osc = ctx.createOscillator();
      osc.type = preset.wave;
      osc.frequency.setValueAtTime(startFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, t0 + durSec);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t0 + durSec);
    }

    return true;
  }

  _ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  _getNoiseBuffer(ctx) {
    if (this._noiseBuffer) return this._noiseBuffer;
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
    return buffer;
  }
}

export const audio = new SoundManager();