// tunes.js — synthesized sound: WebAudio only, no audio files.
// Engine hum, siren, gunshot, pickup and finale jingles, door thud.
export function createTunes() {
  const tunes = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    engineOn: false,
    muted: false,

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        return true;
      } catch {
        return false;
      }
    },

    tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
      if (!this.ensure() || this.muted) return;
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },

    noise(dur, vol = 0.3, freq = 1200) {
      if (!this.ensure() || this.muted) return;
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0);
    },

    blip(freq = 660, dur = 0.08) { this.tone(freq, dur, 'square', 0.12); },
    clickSound() { this.tone(180, 0.05, 'square', 0.1); },
    thud() { this.noise(0.12, 0.35, 300); this.tone(70, 0.12, 'sine', 0.3); },

    gunshot() {
      this.noise(0.16, 0.5, 2400);
      this.tone(160, 0.1, 'sawtooth', 0.18);
    },

    sirenBurst() {
      if (!this.ensure() || this.muted) return;
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(720, t0);
      o.frequency.linearRampToValueAtTime(1080, t0 + 0.45);
      o.frequency.linearRampToValueAtTime(720, t0 + 0.9);
      g.gain.setValueAtTime(0.07, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.95);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + 1);
    },

    engine(level, on) {
      if (!this.ensure() || this.muted) { this.stopEngine(); return; }
      if (!on || level <= 0.02) { this.stopEngine(); return; }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        this.engineOsc.connect(f);
        f.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.setTargetAtTime(55 + level * 130, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + level * 0.05, this.ctx.currentTime, 0.1);
    },

    stopEngine() {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch { /* already stopped */ }
        this.engineOsc = null;
        this.engineGain = null;
      }
    },

    pickupJingle() {
      this.tone(660, 0.1, 'sine', 0.2);
      this.tone(880, 0.14, 'sine', 0.2, 0.09);
    },
    jobJingle() {
      this.tone(523, 0.12, 'triangle', 0.22);
      this.tone(659, 0.12, 'triangle', 0.22, 0.11);
      this.tone(784, 0.2, 'triangle', 0.22, 0.22);
    },
    payJingle() {
      this.tone(880, 0.1, 'sine', 0.22);
      this.tone(1174, 0.1, 'sine', 0.22, 0.08);
      this.tone(1568, 0.22, 'sine', 0.22, 0.16);
    },
    finaleJingle() {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.22, i * 0.14));
    },
    bustedJingle() {
      this.tone(392, 0.25, 'sawtooth', 0.15);
      this.tone(311, 0.4, 'sawtooth', 0.15, 0.22);
    },
    wastedJingle() {
      this.tone(330, 0.3, 'sawtooth', 0.15);
      this.tone(262, 0.3, 'sawtooth', 0.15, 0.28);
      this.tone(196, 0.6, 'sawtooth', 0.15, 0.56);
    },
    doorSound() {
      this.noise(0.18, 0.25, 500);
      this.tone(120, 0.15, 'sine', 0.2);
    },
  };
  return tunes;
}
