// Web Audio graph: master -> compressor -> out, with engine / sfx / music / ui buses (Settings > Audio).
// All sounds are synthesised (single-file build, no samples). AudioContext starts on the boot click.
import { EngineSound } from './EngineSound.js';
import { Radio } from './Radio.js';
import { surfaceById } from '../physics/Surfaces.js';
import { clamp } from '../core/math.js';

export class AudioSystem {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.voices = new Map(); // vehicle -> { engine, tire }
    this.hidden = false; this.paused = false;
  }
  async unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.buses = {};
    for (const b of ['engine', 'sfx', 'music', 'ui']) { this.buses[b] = c.createGain(); this.buses[b].connect(this.master); }
    // shared noise
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.buildAmbience();
    this.radio = new Radio(this);
    this.applyVolumes();
    if (c.state !== 'running') await c.resume().catch(() => {});
  }
  get ready() { return !!this.ctx; }
  noiseSource(brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brown : this.noise; s.loop = true;
    s.start(0, Math.random() * 1.9);
    return s;
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings, t = this.ctx.currentTime;
    const mute = this.hidden && s.get('audio.muteUnfocused');
    this.master.gain.setTargetAtTime(mute ? 0 : s.get('audio.master'), t, 0.05);
    this.buses.engine.gain.setTargetAtTime(s.get('audio.engine') * 0.9, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(s.get('audio.sfx'), t, 0.05);
    this.buses.music.gain.setTargetAtTime(s.get('audio.music') * 0.55, t, 0.05);
    this.buses.ui.gain.setTargetAtTime(s.get('audio.ui') * 0.5, t, 0.05);
  }
  setHidden(h) { this.hidden = h; this.applyVolumes(); }
  setPaused(p) { this.paused = p; if (p) this.horn(false); }

  // ---- continuous world layers (wind, road, tyres) for the player
  buildAmbience() {
    const c = this.ctx;
    const mk = (type, freq, q, brown = false) => { const s = this.noiseSource(brown); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.buses.sfx); return { s, f, g }; };
    this.wind = mk('lowpass', 400, 0.5);
    this.road = mk('lowpass', 180, 0.6, true);
    this.gravel = mk('bandpass', 2400, 0.8);
    this.squeal = mk('bandpass', 1100, 7);
    this.squeal2 = mk('bandpass', 2200, 10);
    this.scrape = mk('bandpass', 1800, 1.5);
    this.rain = mk('highpass', 2500, 0.3);
  }

  attachVehicle(v, isPlayer, o = {}) {
    if (!this.ctx || this.voices.has(v)) return;
    this.voices.set(v, { engine: new EngineSound(this, v, { player: isPlayer, menu: !!o.menu }), player: isPlayer, menu: !!o.menu });
  }
  detachVehicle(v) {
    const vc = this.voices.get(v);
    if (!vc) return;
    vc.engine.dispose();
    this.voices.delete(v);
  }
  sessionStarted() { this.radio?.setContext('drive'); }
  sessionEnded() { this.horn(false); for (const [v] of [...this.voices]) if (!this.voices.get(v).menu) this.detachVehicle(v); this.quietAmbience(); this.radio?.setContext('menu'); }
  quietAmbience() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const l of [this.wind, this.road, this.gravel, this.squeal, this.squeal2, this.scrape, this.rain]) l.g.gain.setTargetAtTime(0, t, 0.1); }

  /** Per-frame from Session.update. */
  updateSession(session, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const cam = session.rig.camera;
    const cockpit = session.rig.mode === 'cockpit';
    const paused = session.paused;
    // listener follows the camera
    const L = this.ctx.listener;
    const fwd = cam.getWorldDirection(session._tmpV ||= cam.position.clone());
    if (L.positionX) {
      L.positionX.setTargetAtTime(cam.position.x, t, 0.02); L.positionY.setTargetAtTime(cam.position.y, t, 0.02); L.positionZ.setTargetAtTime(cam.position.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    }
    const pv = session.player.physics.vel;
    for (const [v, vc] of this.voices) {
      if (vc.menu) { vc.engine.update(dt, { cockpit: false, paused: true }); continue; }
      vc.engine.update(dt, { cockpit: cockpit && vc.player, camPos: cam.position, camVel: pv, paused });
    }
    // player world layers
    const ph = session.player.physics, tel = ph.tel;
    const k = paused ? 0 : 1;
    const sp = tel.speed;
    this.wind.f.frequency.setTargetAtTime(250 + sp * 22, t, 0.1);
    this.wind.g.gain.setTargetAtTime(k * clamp(sp * sp / 5200, 0, 0.7) * (cockpit ? 0.45 : 1), t, 0.1);
    this.road.g.gain.setTargetAtTime(k * clamp(sp / 45, 0, 0.6) * (tel.onGround ? 1 : 0), t, 0.05);
    // tyres: strongest slipping wheel drives squeal; loose surfaces crunch instead
    let slip = 0, loose = 0, rumble = 0;
    for (const w of ph.wheels) {
      if (!w.contact) continue;
      const surf = surfaceById(w.surface);
      const slipV = Math.hypot(w.omega * w.c.radius - w.vx, w.vy);
      const intensity = clamp((slipV - 1.6) / 9, 0, 1) * clamp(w.Fz / w.c.staticLoad, 0.2, 1.4);
      if (surf.class === 'paved' && surf.skid) slip = Math.max(slip, intensity);
      else loose = Math.max(loose, clamp(sp / 20, 0, 1) * 0.6 + intensity * 0.4);
      if (surf.rumble) rumble = Math.max(rumble, clamp(sp / 20, 0, 1));
    }
    const wet = session.env.wetness;
    this.squeal.f.frequency.setTargetAtTime(900 + slip * 500 + sp * 3, t, 0.05);
    this.squeal.g.gain.setTargetAtTime(k * slip * 0.32 * (1 - wet * 0.8), t, 0.04);
    this.squeal2.g.gain.setTargetAtTime(k * slip * slip * 0.12 * (1 - wet * 0.8), t, 0.04);
    this.gravel.g.gain.setTargetAtTime(k * loose * 0.3, t, 0.05);
    this.road.f.frequency.setTargetAtTime(160 + rumble * 140, t, 0.05);
    if (rumble > 0) this.road.g.gain.setTargetAtTime(k * (0.3 + rumble * 0.5), t, 0.03);
    this.scrape.g.gain.setTargetAtTime(this._scrapeT > 0 ? 0.25 : 0, t, 0.04);
    this._scrapeT = (this._scrapeT || 0) - dt;
    this.rain.g.gain.setTargetAtTime(k * session.env.rainAmount * (cockpit ? 0.18 : 0.1), t, 0.3);
  }

  /** One-shot vehicle events (called per vehicle per frame before fx is cleared). */
  /** Car horn: two detuned square tones through a resonant band (a classic dual-tone horn). on = held. */
  horn(on) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (on && !this._horn) {
      const g = c.createGain(); g.gain.value = 0;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
      const oscs = [415, 523].map((f) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(); return o; });
      bp.connect(g); g.connect(this.buses.sfx);
      g.gain.setTargetAtTime(0.22, t, 0.012);
      this._horn = { g, oscs };
    } else if (!on && this._horn) {
      const hn = this._horn; this._horn = null;
      hn.g.gain.setTargetAtTime(0, t, 0.02);
      for (const o of hn.oscs) o.stop(t + 0.15);
    }
  }
  vehicleEvents(v, fx) {
    const vc = this.voices.get(v);
    if (!this.ctx || !vc) return;
    if (fx.bov > 0 && v.spec.sound?.bov !== 0) this.bov(vc.engine, fx.bov, v.spec.sound?.bov === 3);
    if (fx.backfire > 0) this.pop(vc.engine, fx.backfire);
    if (fx.shift && vc.player) this.shiftClunk(v.spec.transmission.type === 'sequential');
    for (const c of fx.collisions) {
      if (!vc.player && v.physics.pos.distanceTo(this.game.session?.rig.camera.position || v.physics.pos) > 60) continue;
      if (c.scrape && c.impulse < 2500) { this._scrapeT = 0.12; continue; }
      this.impact(Math.min(1, c.impulse / 12000), vc.player);
    }
  }

  // ---- one-shots ---------------------------------------------------------------------------
  envNoise(dest, { dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.5, sweepTo = null, attack = 0.002 }) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return g;
  }
  tone(dest, { freq = 440, to = null, dur = 0.1, type = 'sine', gain = 0.3, attack = 0.003, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  pop(engine, strength = 0.5) {
    const target = engine.panner ? engine.out : this.buses.engine;
    this.envNoise(target, { dur: 0.05 + strength * 0.06, freq: 700 + Math.random() * 500, q: 0.7, type: 'lowpass', gain: 0.6 * strength });
    this.tone(target, { freq: 90 + Math.random() * 40, to: 40, dur: 0.08, gain: 0.5 * strength, type: 'triangle' });
  }
  bov(engine, strength, flutter) {
    const target = engine.panner ? engine.out : this.buses.sfx;
    if (flutter) {
      // compressor surge: "stu-tu-tu-tu"
      for (let i = 0; i < 6; i++) this.tone(target, { freq: 900 - i * 60, dur: 0.04, gain: 0.06 * strength, type: 'square', delay: i * 0.055 });
      this.envNoise(target, { dur: 0.35, freq: 1300, q: 3, gain: 0.18 * strength, attack: 0.004 });
    } else this.envNoise(target, { dur: 0.45 + strength * 0.2, freq: 3800, q: 1.2, gain: 0.32 * strength, sweepTo: 900, attack: 0.01 });
  }
  shiftClunk(seq) {
    this.tone(this.buses.sfx, { freq: seq ? 180 : 120, to: 60, dur: 0.06, gain: seq ? 0.25 : 0.15, type: 'triangle' });
    this.envNoise(this.buses.sfx, { dur: 0.04, freq: 2500, q: 2, gain: seq ? 0.12 : 0.05 });
  }
  impact(strength, player) {
    const dest = this.buses.sfx;
    this.tone(dest, { freq: 110, to: 38, dur: 0.18 + strength * 0.25, gain: 0.5 * strength * (player ? 1 : 0.5), type: 'sine' });
    this.envNoise(dest, { dur: 0.12 + strength * 0.3, freq: 1600, q: 0.8, gain: 0.45 * strength * (player ? 1 : 0.5), type: 'lowpass' });
    if (strength > 0.4) this.envNoise(dest, { dur: 0.6, freq: 5200, q: 3, gain: 0.08 * strength, attack: 0.02 }); // glass/metal tinkle
  }
  /** Head-unit UI sounds. */
  ui(kind) {
    if (!this.ctx) return;
    const d = this.buses.ui;
    const now = this.ctx.currentTime;
    if (kind === 'tick') { if (now - (this._tickT || 0) < 0.03) return; this._tickT = now; this.tone(d, { freq: 2600, dur: 0.025, gain: 0.08, type: 'sine' }); }
    else if (kind === 'select') this.tone(d, { freq: 1300, to: 1700, dur: 0.06, gain: 0.12 });
    else if (kind === 'back') this.tone(d, { freq: 1500, to: 1000, dur: 0.07, gain: 0.1 });
    else if (kind === 'confirm') { this.tone(d, { freq: 880, dur: 0.08, gain: 0.12 }); this.tone(d, { freq: 1320, dur: 0.12, gain: 0.12, delay: 0.07 }); }
    else if (kind === 'buy') { [988, 1319, 1760].forEach((f, i) => this.tone(d, { freq: f, dur: 0.12, gain: 0.12, delay: i * 0.06 })); }
    else if (kind === 'error') this.tone(d, { freq: 220, dur: 0.18, gain: 0.15, type: 'square' });
    else if (kind === 'beep') this.tone(d, { freq: 880, dur: 0.18, gain: 0.25, type: 'square' });
    else if (kind === 'go') this.tone(d, { freq: 1760, dur: 0.45, gain: 0.28, type: 'square' });
  }

  update(dt) {
    if (!this.ctx) return;
    // menu car idles quietly behind the head unit
    if (this.game.state === 'menu') for (const [, vc] of this.voices) if (vc.menu) vc.engine.update(dt, { cockpit: true, paused: false });
    this.radio?.update(dt);
  }
}
