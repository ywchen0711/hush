// HUSH — 3D sound. Everything is synthesized with the Web Audio API and placed in space with HRTF panning,
// so with headphones you can tell where a sound comes from. Monsters announce themselves by sound first.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.onCaption = null;      // (text, seconds) => void
    this.loops = new Set();
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    // shared noise buffers
    const n = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, n, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5;
    }
    this.ambience();
  }

  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  caption(text, secs) { if (this.onCaption) this.onCaption(text, secs || 2.5); }

  // ---- listener follows the camera ----
  setListener(pos, forward, up) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t);
      L.forwardX.setValueAtTime(forward.x, t); L.forwardY.setValueAtTime(forward.y, t); L.forwardZ.setValueAtTime(forward.z, t);
      L.upX.setValueAtTime(up.x, t); L.upY.setValueAtTime(up.y, t); L.upZ.setValueAtTime(up.z, t);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  // ---- building blocks ----
  panner(pos, ref, roll) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref || 1.5; p.rolloffFactor = roll || 1.1; p.maxDistance = 80;
    this.place(p, pos);
    p.connect(this.master);
    return p;
  }
  place(p, pos) {
    const t = this.ctx.currentTime;
    if (p.positionX) { p.positionX.setValueAtTime(pos.x, t); p.positionY.setValueAtTime(pos.y, t); p.positionZ.setValueAtTime(pos.z, t); }
    else p.setPosition(pos.x, pos.y, pos.z);
  }
  out(pos, ref, roll) { return pos ? this.panner(pos, ref, roll) : this.master; }
  noise(buf, dest, t, dur, type, freq, q, vol, attack, release) {
    const s = this.ctx.createBufferSource(); s.buffer = buf === 'brown' ? this.brown : this.white; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (release || 0.05));
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + (release || 0.05) + 0.05);
    return { src: s, filter: f, gain: g };
  }
  tone(dest, t, freq, dur, type, vol, toFreq, attack) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  // ---- one-shot sounds (pos optional = world position) ----
  play(name, pos, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01, v = vol == null ? 1 : vol;
    const d = (ref, roll) => this.out(pos, ref, roll);
    switch (name) {
      case 'step': {
        const o = d(1, 1.2);
        this.noise('brown', o, t, 0.06, 'lowpass', 380, 1, 0.35 * v);
        this.tone(o, t, 90, 0.09, 'sine', 0.25 * v, 60);
        break;
      }
      case 'creak': {                       // door hinge
        const o = d(2, 0.8);
        const s = this.ctx.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(140, t); s.frequency.linearRampToValueAtTime(95, t + 0.45); s.frequency.linearRampToValueAtTime(120, t + 0.8);
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 1);
        this.noise('white', o, t + 0.85, 0.03, 'highpass', 2000, 1, 0.2 * v);   // latch
        break;
      }
      case 'drawer': this.noise('brown', d(1, 1), t, 0.28, 'bandpass', 700, 1.5, 0.5 * v, 0.05); break;
      case 'locked': for (let i = 0; i < 3; i++) this.noise('white', d(1, 1), t + i * 0.09, 0.03, 'bandpass', 2600, 4, 0.35 * v); break;
      case 'key': [2637, 3136, 3520].forEach((f, i) => this.tone(d(1, 1), t + i * 0.05, f, 0.35, 'sine', 0.08 * v)); break;
      case 'unlock': this.noise('white', d(1, 1), t, 0.05, 'bandpass', 1800, 3, 0.4); this.tone(d(1, 1), t + 0.08, 1400, 0.2, 'triangle', 0.1); break;
      case 'gold': [1568, 2093].forEach((f, i) => this.tone(this.master, t + i * 0.07, f, 0.25, 'triangle', 0.08)); break;
      case 'pickup': [880, 1320].forEach((f, i) => this.tone(this.master, t + i * 0.08, f, 0.25, 'sine', 0.1)); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(this.master, t + i * 0.07, f, 0.3, 'sine', 0.1)); break;
      case 'wardrobe': this.noise('brown', d(1, 1), t, 0.2, 'lowpass', 600, 1, 0.5); this.tone(d(1, 1), t, 200, 0.15, 'triangle', 0.08, 150); break;
      case 'flicker': for (let i = 0; i < 5; i++) this.tone(d(2, 1), t + i * 0.07 + Math.random() * 0.05, 120, 0.04, 'square', 0.05); break;
      case 'shatter': this.noise('white', d(2, 0.8), t, 0.35, 'highpass', 3000, 0.7, 0.4 * v); break;
      case 'psst': {                        // the Hisser
        const o = d(1.2, 1);
        this.noise('white', o, t, 0.02, 'bandpass', 1200, 2, 0.6);
        this.noise('white', o, t + 0.08, 0.55, 'bandpass', 4200, 2.5, 0.55, 0.06, 0.12);
        break;
      }
      case 'repel': this.noise('white', d(1.2, 1), t, 0.6, 'bandpass', 2500, 3, 0.4, 0.02, 0.3); this.tone(d(1.2, 1), t, 400, 0.5, 'sawtooth', 0.04, 120); break;
      case 'bite': this.noise('white', this.master, t, 0.12, 'bandpass', 1500, 1, 0.9); this.tone(this.master, t, 300, 0.25, 'sawtooth', 0.25, 80); break;
      case 'thud': {                        // the Listener's footstep
        const o = d(3, 0.9);
        this.tone(o, t, 55, 0.5, 'sine', 0.7 * v, 35);
        this.noise('brown', o, t, 0.15, 'lowpass', 250, 1, 0.6 * v);
        break;
      }
      case 'growl': {
        const o = d(3, 0.9), s = this.ctx.createOscillator(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
        s.type = 'sawtooth'; s.frequency.value = 62; lfo.frequency.value = 9; lg.gain.value = 18; lfo.connect(lg); lg.connect(s.frequency);
        f.type = 'lowpass'; f.frequency.value = 500;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4 * v, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        s.connect(f); f.connect(g); g.connect(o); s.start(t); lfo.start(t); s.stop(t + 1.5); lfo.stop(t + 1.5);
        break;
      }
      case 'heartbeat': this.tone(this.master, t, 60, 0.12, 'sine', 0.5 * v, 40); this.tone(this.master, t + 0.18, 55, 0.14, 'sine', 0.4 * v, 38); break;
      case 'scream': {                      // death / jumpscare
        this.noise('white', this.master, t, 0.9, 'bandpass', 1800, 0.8, 0.9, 0.01, 0.3);
        const s = this.tone(this.master, t, 900, 1.0, 'sawtooth', 0.35, 180);
        this.tone(this.master, t, 1340, 0.8, 'square', 0.15, 260);
        void s;
        break;
      }
      case 'hit': this.noise('white', this.master, t, 0.1, 'lowpass', 2500, 1, 0.7); this.tone(this.master, t, 160, 0.2, 'square', 0.15, 60); break;
      case 'skitter': for (let i = 0; i < 10; i++) this.noise('white', d(0.8, 1), t + i * 0.035, 0.015, 'highpass', 5000, 1, 0.4); break;
      case 'creakFar': this.play('creak', pos, 0.4); break;
      case 'knock': for (let i = 0; i < 3; i++) { this.tone(d(1.5, 1), t + i * 0.28, 110, 0.12, 'sine', 0.5, 70); this.noise('brown', d(1.5, 1), t + i * 0.28, 0.06, 'lowpass', 600, 1, 0.5); } break;
      case 'win': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(this.master, t + i * 0.18, f, 1.2, 'sine', 0.12)); break;
    }
  }

  // ---- continuous positional sounds; returns a handle with setPos / setVolume / stop ----
  loop(name, pos) {
    if (!this.ctx) return { setPos() {}, setVolume() {}, stop() {} };
    const ctx = this.ctx, t = ctx.currentTime;
    const p = this.panner(pos, name === 'rumble' ? 4 : 2, name === 'rumble' ? 0.7 : 1);
    const vol = ctx.createGain(); vol.gain.value = 0.0001; vol.connect(p);
    const nodes = [];
    if (name === 'rumble') {                // the Stampede: roaring wind and a growling engine
      const s = ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      s.connect(f); f.connect(vol); s.start(t); nodes.push(s);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 46;
      const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 180;
      const og = ctx.createGain(); og.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(og.gain);
      o.connect(of); of.connect(og); og.connect(vol); o.start(t); lfo.start(t); nodes.push(o, lfo);
      const sc = ctx.createBufferSource(); sc.buffer = this.white; sc.loop = true;
      const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1400; sf.Q.value = 3;
      const sg = ctx.createGain(); sg.gain.value = 0.18; sc.connect(sf); sf.connect(sg); sg.connect(vol); sc.start(t); nodes.push(sc);
    } else if (name === 'hum') {            // the Gaze: a low eerie choir
      [196, 233.1, 293.7, 392.4].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (i - 1.5) * 0.002);
        const g = ctx.createGain(); g.gain.value = 0.12;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3 + i * 0.13; const lg = ctx.createGain(); lg.gain.value = 0.08; lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(vol); o.start(t); lfo.start(t); nodes.push(o, lfo);
      });
    } else if (name === 'breath') {         // something behind you in the wardrobe / the Listener
      const s = ctx.createBufferSource(); s.buffer = this.white; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.value = 0.2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(vol); s.start(t); lfo.start(t); nodes.push(s, lfo);
    } else if (name === 'buzz') {           // a dying light bulb
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 120;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0.05; o.connect(f); f.connect(g); g.connect(vol); o.start(t); nodes.push(o);
    }
    const handle = {
      setPos: (q) => this.place(p, q),
      setVolume: (v, ramp) => { vol.gain.cancelScheduledValues(ctx.currentTime); vol.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, ramp || 0.15); },
      stop: () => {
        vol.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); p.disconnect(); }, 900);
        this.loops.delete(handle);
      }
    };
    this.loops.add(handle);
    return handle;
  }

  stopAll() { Array.from(this.loops).forEach((h) => h.stop()); }

  // ---- the building breathes: low drone + distant creaks ----
  ambience() {
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.value = 0.05; g.connect(this.master);
    [55, 55.4, 82.4].forEach((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); });
    const s = ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const ng = ctx.createGain(); ng.gain.value = 0.12; s.connect(f); f.connect(ng); ng.connect(this.master); s.start(t);
  }
}
