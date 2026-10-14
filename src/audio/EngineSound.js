// Procedural engine sound (source-filter model).
// Source: one engine cycle (720 deg of crank) of exhaust pulses rendered into a looping buffer, with the
// firing pattern of the layout (even I4/I6/V10/V12, crossplane V8 burble, unequal-header flat-4 rumble,
// rotary buzz, I5 warble). Playback rate = rpm / REF_RPM, so pulse spacing and width scale with rpm.
// Filters (fixed in Hz, like real pipes): body resonance, rpm/load lowpass, drive waveshaper.
// Extra layers: induction noise, turbo whistle + spool, supercharger whine, gear whine, BOV, pops.
const REF_RPM = 1200;

const PATTERNS = {
  I3: { n: 3, offsets: [0, 240, 480], amps: [1, 0.95, 1], pulse: 0.55 },
  I4: { n: 4, offsets: [0, 180, 360, 540], amps: [1, 0.92, 0.98, 0.94], pulse: 0.5 },
  I5: { n: 5, offsets: [0, 144, 288, 432, 576], amps: [1, 0.85, 0.95, 0.8, 0.92], pulse: 0.55 },
  I6: { n: 6, offsets: [0, 120, 240, 360, 480, 600], amps: [1, 0.95, 0.97, 0.94, 0.99, 0.95], pulse: 0.45 },
  F4: { n: 4, offsets: [0, 192, 354, 550], amps: [1, 0.72, 0.95, 0.68], pulse: 0.65 }, // unequal headers: the rumble
  F6: { n: 6, offsets: [0, 120, 240, 360, 480, 600], amps: [1, 0.9, 0.95, 0.88, 0.97, 0.9], pulse: 0.5 },
  V6: { n: 6, offsets: [0, 120, 240, 360, 480, 600], amps: [1, 0.86, 0.95, 0.9, 0.97, 0.84], pulse: 0.5 },
  V8: { n: 8, offsets: [0, 90, 180, 270, 360, 450, 540, 630], amps: [1, 0.62, 0.95, 1, 0.66, 0.97, 0.6, 0.64], pulse: 0.62 }, // crossplane bank pattern
  V10: { n: 10, offsets: [0, 72, 144, 216, 288, 360, 432, 504, 576, 648], amps: [1, 0.92, 0.97, 0.9, 0.95, 0.93, 1, 0.9, 0.96, 0.91], pulse: 0.4 },
  V12: { n: 12, offsets: [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660], amps: [1, 0.96, 0.98, 0.95, 0.99, 0.96, 1, 0.95, 0.97, 0.96, 0.98, 0.95], pulse: 0.36 },
  R2: { n: 4, offsets: [0, 180, 360, 540], amps: [1, 0.9, 1, 0.9], pulse: 1.1, buzz: 0.6 },
  R3: { n: 6, offsets: [0, 120, 240, 360, 480, 600], amps: [1, 0.9, 1, 0.9, 1, 0.9], pulse: 1.0, buzz: 0.5 },
};

function cycleBuffer(ctx, layout, onLoad, seed = 1) {
  const P = PATTERNS[layout] || PATTERNS.I4;
  const sr = ctx.sampleRate;
  const cycle = 120 / REF_RPM; // seconds per 720 deg at REF_RPM
  const len = Math.round(sr * cycle);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pulseW = (P.pulse * (onLoad ? 1 : 1.4)) / 1000; // seconds at REF_RPM
  for (let k = 0; k < P.n; k++) {
    const t0 = (P.offsets[k] / 720) * cycle;
    const amp = P.amps[k] * (onLoad ? 1 : 0.45);
    const tau1 = pulseW * 2.2, tau2 = pulseW * 0.35;
    for (let i = 0; i < len; i++) {
      // wrap so pulses near the end continue at the start (seamless loop)
      let t = i / sr - t0; if (t < 0) t += cycle;
      if (t > pulseW * 14) continue;
      const env = Math.exp(-t / tau1) - Math.exp(-t / tau2);
      const ring = Math.sin(2 * Math.PI * t * (onLoad ? 520 : 380)) * Math.exp(-t / (pulseW * 3)) * 0.35;
      const noise = (rnd() * 2 - 1) * Math.exp(-t / (pulseW * (P.buzz ? 4 : 1.6))) * (onLoad ? 0.32 : 0.12) * (1 + (P.buzz || 0));
      d[i] += amp * (env * 1.6 + ring + noise);
    }
  }
  // remove DC, normalise
  let mean = 0; for (let i = 0; i < len; i++) mean += d[i]; mean /= len;
  let mx = 0; for (let i = 0; i < len; i++) { d[i] -= mean; mx = Math.max(mx, Math.abs(d[i])); }
  for (let i = 0; i < len; i++) d[i] /= mx || 1;
  return buf;
}

const bufCache = new Map();
function getBuf(ctx, layout, onLoad) {
  const k = `${layout}|${onLoad}`;
  if (!bufCache.has(k)) bufCache.set(k, cycleBuffer(ctx, layout, onLoad, onLoad ? 3 : 7));
  return bufCache.get(k);
}
function driveCurve(amount) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * (1 + amount * 4)) / Math.tanh(1 + amount * 4); }
  return c;
}

export class EngineSound {
  /**
   * @param audio AudioSystem   @param vehicle runtime Vehicle   @param o { player, menu }
   */
  constructor(audio, vehicle, { player = false, menu = false } = {}) {
    this.audio = audio;
    this.v = vehicle;
    this.player = player;
    const ctx = audio.ctx;
    const snd = vehicle.spec.sound || {};
    const layout = snd.layout || vehicle.spec.engine.layout || 'I4';
    this.layout = layout;
    this.disp = vehicle.spec.engine.displacement || 2;
    this.snd = snd;
    // nodes
    this.out = ctx.createGain(); this.out.gain.value = 0;
    if (player) { this.panner = null; this.out.connect(audio.buses.engine); }
    else {
      this.panner = ctx.createPanner();
      Object.assign(this.panner, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 7, maxDistance: 600, rolloffFactor: 1.15 });
      this.out.connect(this.panner); this.panner.connect(audio.buses.engine);
    }
    this.cabin = ctx.createBiquadFilter(); this.cabin.type = 'lowpass'; this.cabin.frequency.value = 20000; this.cabin.Q.value = 0.4;
    this.cabin.connect(this.out);
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.7;
    this.body = ctx.createBiquadFilter(); this.body.type = 'peaking'; this.body.frequency.value = 80 + 140 / Math.sqrt(this.disp); this.body.Q.value = 1.1; this.body.gain.value = 7;
    this.mid = ctx.createBiquadFilter(); this.mid.type = 'peaking'; this.mid.frequency.value = 420 + 160 / this.disp; this.mid.Q.value = 1.4; this.mid.gain.value = 3 + (snd.exhaust || 0) * 2;
    this.shaper = ctx.createWaveShaper(); this.shaper.curve = driveCurve(0.35 + (snd.exhaust || 0) * 0.15); this.shaper.oversample = '2x';
    this.shaper.connect(this.body); this.body.connect(this.mid); this.mid.connect(this.lp); this.lp.connect(this.cabin);
    this.onGain = ctx.createGain(); this.offGain = ctx.createGain();
    this.onGain.connect(this.shaper); this.offGain.connect(this.shaper);
    this.srcOn = ctx.createBufferSource(); this.srcOn.buffer = getBuf(ctx, layout, true); this.srcOn.loop = true;
    this.srcOff = ctx.createBufferSource(); this.srcOff.buffer = getBuf(ctx, layout, false); this.srcOff.loop = true;
    this.srcOn.connect(this.onGain); this.srcOff.connect(this.offGain);
    const t = ctx.currentTime;
    this.srcOn.start(t, Math.random() * 0.05); this.srcOff.start(t, Math.random() * 0.05);
    // sub layer for big engines (felt more than heard)
    this.sub = ctx.createOscillator(); this.sub.type = 'sine';
    this.subGain = ctx.createGain(); this.subGain.gain.value = 0;
    this.sub.connect(this.subGain); this.subGain.connect(this.cabin); this.sub.start();
    // induction / intake noise
    this.intake = audio.noiseSource();
    this.intakeF = ctx.createBiquadFilter(); this.intakeF.type = 'bandpass'; this.intakeF.Q.value = 0.9;
    this.intakeG = ctx.createGain(); this.intakeG.gain.value = 0;
    this.intake.connect(this.intakeF); this.intakeF.connect(this.intakeG); this.intakeG.connect(this.cabin);
    // turbo whistle + spool hiss
    const fi = vehicle.params.engine.boost;
    if (fi && fi.type !== 'supercharger') {
      this.whistle = ctx.createOscillator(); this.whistle.type = 'sine';
      this.whistleG = ctx.createGain(); this.whistleG.gain.value = 0;
      this.whistle.connect(this.whistleG); this.whistleG.connect(this.cabin); this.whistle.start();
      this.hiss = audio.noiseSource(); this.hissF = ctx.createBiquadFilter(); this.hissF.type = 'highpass'; this.hissF.frequency.value = 4000;
      this.hissG = ctx.createGain(); this.hissG.gain.value = 0;
      this.hiss.connect(this.hissF); this.hissF.connect(this.hissG); this.hissG.connect(this.cabin);
    }
    if (fi?.type === 'supercharger' || snd.whine) {
      this.whine = ctx.createOscillator(); this.whine.type = 'triangle';
      this.whineG = ctx.createGain(); this.whineG.gain.value = 0;
      this.whine.connect(this.whineG); this.whineG.connect(this.cabin); this.whine.start();
    }
    if (snd.gearWhine) {
      this.gear = ctx.createOscillator(); this.gear.type = 'sawtooth';
      this.gearF = ctx.createBiquadFilter(); this.gearF.type = 'bandpass'; this.gearF.Q.value = 6;
      this.gearG = ctx.createGain(); this.gearG.gain.value = 0;
      this.gear.connect(this.gearF); this.gearF.connect(this.gearG); this.gearG.connect(this.cabin); this.gear.start();
    }
    this.popT = 0;
    this.level = menu ? 0.55 : 1;
    this.lastLoad = 0;
  }

  update(dt, { cockpit = false, camPos = null, camVel = null, paused = false } = {}) {
    const ctx = this.audio.ctx, t = ctx.currentTime;
    const ph = this.v.physics, e = ph.engine, p = ph.p.engine;
    const rpm = Math.max(300, e.rpm);
    const rate = rpm / REF_RPM;
    let doppler = 1;
    if (this.panner && camPos) {
      const dx = ph.pos.x - camPos.x, dy = ph.pos.y - camPos.y, dz = ph.pos.z - camPos.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const vr = ((ph.vel.x - (camVel?.x || 0)) * dx + (ph.vel.y - (camVel?.y || 0)) * dy + (ph.vel.z - (camVel?.z || 0)) * dz) / dist;
      doppler = Math.max(0.7, Math.min(1.4, 343 / (343 + vr)));
      this.panner.positionX.setTargetAtTime(ph.pos.x, t, 0.03); this.panner.positionY.setTargetAtTime(ph.pos.y, t, 0.03); this.panner.positionZ.setTargetAtTime(ph.pos.z, t, 0.03);
    }
    const r = Math.min(16, rate * doppler);
    this.srcOn.playbackRate.setTargetAtTime(r, t, 0.012);
    this.srcOff.playbackRate.setTargetAtTime(r, t, 0.012);
    const load = Math.max(0, Math.min(1, e.throttle)) * (ph.gearbox.clutch > 0.2 || ph.gearbox.gear === 0 ? 1 : 0.6);
    const L = this.lastLoad += (load - this.lastLoad) * Math.min(1, dt * 18);
    const rpmF = rpm / p.redline;
    const vol = (0.28 + 0.5 * rpmF) * (0.55 + 0.45 * L) * this.level * (paused ? 0.25 : 1);
    this.out.gain.setTargetAtTime(vol, t, 0.03);
    this.onGain.gain.setTargetAtTime(0.25 + L * 0.85, t, 0.03);
    this.offGain.gain.setTargetAtTime((1 - L) * 0.8, t, 0.04);
    this.lp.frequency.setTargetAtTime(500 + rpm * 0.55 + L * 3200 + (this.snd.exhaust || 0) * 600, t, 0.03);
    this.sub.frequency.setTargetAtTime((rpm / 60) * (PATTERNS[this.layout]?.n || 4) / 4, t, 0.03);
    this.subGain.gain.setTargetAtTime(Math.min(0.5, this.disp / 10) * (0.3 + L * 0.5), t, 0.05);
    this.intakeF.frequency.setTargetAtTime(600 + rpm * 0.35, t, 0.04);
    this.intakeG.gain.setTargetAtTime(L * rpmF * 0.22, t, 0.04);
    if (this.whistle) {
      const b = e.boost / (ph.p.engine.boost?.max || 1);
      this.whistle.frequency.setTargetAtTime(2600 + b * 5200 + rpm * 0.2, t, 0.05);
      this.whistleG.gain.setTargetAtTime(b * b * 0.05, t, 0.05);
      this.hissG.gain.setTargetAtTime(b * 0.06, t, 0.05);
    }
    if (this.whine) { this.whine.frequency.setTargetAtTime(rpm / 60 * 4.2 * 3, t, 0.02); this.whineG.gain.setTargetAtTime((0.015 + L * 0.05) * rpmF, t, 0.04); }
    if (this.gear) {
      const w = Math.abs(ph.wheels[2].omega) * 16 * (this.snd.gearWhine || 0.5);
      this.gear.frequency.setTargetAtTime(Math.max(40, w * 6), t, 0.03); this.gearF.frequency.setTargetAtTime(Math.max(200, w * 6), t, 0.03);
      this.gearG.gain.setTargetAtTime(Math.min(0.05, ph.tel.speed / 900) * (this.snd.gearWhine || 0.5), t, 0.05);
    }
    // cockpit: muffled exhaust, more intake
    this.cabin.frequency.setTargetAtTime(cockpit ? 2400 + L * 1500 : 20000, t, 0.08);
    // overrun pops (lift-off at high rpm)
    const popsOn = (this.snd.pops || (this.snd.exhaust || 0) >= 2) && !paused;
    if (popsOn && L < 0.08 && rpmF > 0.55 && ph.tel.speed > 5) {
      this.popT -= dt;
      if (this.popT <= 0) { this.popT = 0.05 + Math.random() * 0.22; this.audio.pop(this, 0.35 + Math.random() * 0.5); }
    }
  }
  dispose() {
    const nodes = [this.srcOn, this.srcOff, this.sub, this.intake, this.whistle, this.hiss, this.whine, this.gear];
    for (const n of nodes) { try { n?.stop(); } catch { /* already stopped */ } }
    this.out.disconnect(); this.panner?.disconnect();
  }
}
