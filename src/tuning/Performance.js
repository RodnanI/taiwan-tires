// Fast analytic performance model (no rendering, no full physics): ~1 ms per car.
// Used for PI/class, stat bars, AI tune fitness and matching AI opponents to the player.
// It mirrors the physics model's tyre/load-sensitivity maths so tune changes move the numbers honestly.
import { specToParams } from '../vehicles/VehicleSpec.js';
import { COMPOUNDS } from '../physics/Tire.js';
import { curveLookupSmooth, clamp, smoothstep, G, AIR_DENSITY } from '../core/math.js';

export const CLASSES = [
  { id: 'D', min: 100, max: 500, color: '#5fb3c9' }, { id: 'C', min: 501, max: 600, color: '#e8c547' }, { id: 'B', min: 601, max: 700, color: '#ec8a3a' },
  { id: 'A', min: 701, max: 800, color: '#e5513b' }, { id: 'S1', min: 801, max: 900, color: '#b34fd1' }, { id: 'S2', min: 901, max: 998, color: '#3d7fe0' }, { id: 'X', min: 999, max: 999, color: '#3ed58f' },
];
export const classFor = (pi) => CLASSES.find((c) => pi <= c.max) || CLASSES[CLASSES.length - 1];

/** Lateral grip capacity of one axle at lateral accel `ay` (m/s^2). */
function axleCapacity(Fz, dFz, mu0, fz0) {
  const out = Fz / 2 + dFz, inn = Math.max(0, Fz / 2 - dFz);
  const m = (f) => mu0 * Math.pow(clamp(f / fz0, 0.05, 4), -0.16) * f;
  return m(out) + m(inn);
}

export function analyze(spec) {
  const p = specToParams(spec);
  const m = p.mass, L = p.wheelbase;
  const wf = spec.weightFront;
  const tF = Math.abs(p.wheels[0].x * 2), tR = Math.abs(p.wheels[2].x * 2);
  const comp = COMPOUNDS[spec.tires.compound] || COMPOUNDS.street;
  const tireMu = (i) => {
    const w = p.wheels[i];
    const pDev = (w.pressure - comp.pOpt) / comp.pOpt;
    return comp.mu * (1 - 0.6 * pDev * pDev) * Math.pow(w.width / 225, 0.22);
  };
  const muF = tireMu(0), muR = tireMu(2);
  const camberLat = (c) => { const cb = (c - 1.2 + 2.5) / 5; return 1 + 0.06 * Math.max(-0.5, 1 - cb * cb); }; // static camber + ~1.2 deg roll gain under load
  const latF = muF * camberLat(p.wheels[0].camber) * comp.latScale, latR = muR * camberLat(p.wheels[2].camber) * comp.latScale;
  const e = p.engine;
  const boost = (rpm) => (e.boost ? 1 + e.boost.max * e.boost.eff * (e.boost.type === 'supercharger' ? 0.35 + 0.65 * smoothstep(e.boost.spoolStart, e.boost.spoolFull, rpm) : smoothstep(e.boost.spoolStart, e.boost.spoolFull, rpm)) : 1);
  const torque = (rpm) => curveLookupSmooth(e.torque, clamp(rpm, e.idle, e.limiter)) * boost(rpm);
  const tr = p.transmission;
  const R = p.wheels[2].radius;
  const drivenF = p.drivetrain.layout !== 'RWD', drivenR = p.drivetrain.layout !== 'FWD';
  const split = p.drivetrain.layout === 'AWD' ? p.drivetrain.split : drivenF ? 1 : 0;
  const cdA = p.aero.cd * p.aero.area;
  const q = 0.5 * AIR_DENSITY;
  const fz0F = 0.5 * (m * G * wf / 2 + 3500), fz0R = 0.5 * (m * G * (1 - wf) / 2 + 3500);
  // ---- longitudinal run (ideal shifting)
  const dt = 0.02;
  let v = 0, x = 0, t = 0, t60 = null, t100 = null, t200 = null, tq = null, vq = 0, shiftPenalty = 0, gearPrev = 1, a = 0;
  let top = 0, stagn = 0;
  const mEff = m * 1.08;
  while (t < 90) {
    let bestF = 0, bestG = gearPrev;
    for (let gi = gearPrev - 1; gi < tr.gears.length; gi++) { // full-throttle runs only ever upshift
      const ratio = tr.gears[gi] * tr.final;
      let rpm = (v / R) * ratio * 30 / Math.PI;
      if (rpm > e.limiter) continue;
      if (gi === 0) rpm = Math.max(rpm, Math.min(e.redline * 0.5, e.idle + 1800));
      const lagK = e.boost && e.boost.type !== 'supercharger' ? 1 - 0.18 * Math.min(1, e.boost.lag) * (1 - smoothstep(e.boost.spoolFull, e.boost.spoolFull * 1.3, rpm)) : 1;
      const F = (torque(rpm) * lagK * ratio * 0.86) / R;
      if (F > bestF) { bestF = F; bestG = gi + 1; }
    }
    if (bestG !== gearPrev) { shiftPenalty = tr.shiftTime; gearPrev = bestG; }
    const down = q * v * v * (p.aero.clF + p.aero.clR);
    const xfer = (mEff * a * 0.95 * p.cgHeight) / L;
    const FzF = m * G * wf + q * v * v * p.aero.clF - xfer, FzR = m * G * (1 - wf) + q * v * v * p.aero.clR + xfer;
    let trac = 0;
    if (drivenF) trac += muF * comp.affinity.paved * Math.max(0, FzF) * (p.drivetrain.layout === 'AWD' ? Math.min(1, split * 2) : 1) * 0.9;
    if (drivenR) trac += muR * comp.affinity.paved * Math.max(0, FzR) * (p.drivetrain.layout === 'AWD' ? Math.min(1, (1 - split) * 2) : 1) * 0.9;
    let Fd = shiftPenalty > 0 ? 0 : Math.min(bestF, trac);
    shiftPenalty = Math.max(0, shiftPenalty - dt);
    const F = Fd - q * cdA * v * v - 0.012 * (m * G + down);
    a = F / mEff;
    v = Math.max(0, v + a * dt); x += v * dt; t += dt;
    const kmh = v * 3.6;
    if (t60 == null && kmh >= 60) t60 = t;
    if (t100 == null && kmh >= 100) t100 = t;
    if (t200 == null && kmh >= 200) t200 = t;
    if (tq == null && x >= 402.3) { tq = t; vq = kmh; }
    if (kmh > top + 1e-4) { top = kmh; stagn = 0; } else if ((stagn += dt) > 3) break;
  }
  // ---- braking 100 -> 0
  let vb = 100 / 3.6, xb = 0;
  while (vb > 0.1) {
    const down = q * vb * vb * (p.aero.clF + p.aero.clR);
    const muAvg = (muF + muR) / 2 * comp.affinity.paved * 0.96;
    const aGrip = muAvg * (G + down / m);
    const aBrake = p.brakes.torque / R / m;
    const ab = Math.min(aGrip, aBrake) + (q * cdA * vb * vb) / m;
    vb -= ab * 0.005; xb += vb * 0.005;
  }
  // ---- steady-state lateral grip with load transfer + sensitivity (fixed-point)
  const rollK = (s, t2) => s.spring * t2 * t2 / 2 + s.arb * t2 * t2;
  const KF = rollK({ spring: p.wheels[0].spring, arb: p.wheels[0].arb }, tF), KR = rollK({ spring: p.wheels[2].spring, arb: p.wheels[2].arb }, tR);
  const fF = KF / (KF + KR);
  const hRoll = p.cgHeight - (p.wheels[0].rollCenter + p.wheels[2].rollCenter) / 2;
  const lateral = (vms) => {
    const dF = q * vms * vms * p.aero.clF, dR = q * vms * vms * p.aero.clR;
    const FzF = m * G * wf + dF, FzR = m * G * (1 - wf) + dR;
    let ay = 9;
    let capF = 0, capR = 0;
    for (let k = 0; k < 12; k++) {
      const totalTransfer = (m * ay * hRoll) / ((tF + tR) / 2);
      const geoF = (m * ay * wf * p.wheels[0].rollCenter) / tF, geoR = (m * ay * (1 - wf) * p.wheels[2].rollCenter) / tR;
      capF = axleCapacity(FzF, totalTransfer * fF + geoF, latF, fz0F);
      capR = axleCapacity(FzR, totalTransfer * (1 - fF) + geoR, latR, fz0R);
      const ayF = capF / (m * wf), ayR = capR / (m * (1 - wf));
      ay = 0.5 * ay + 0.5 * Math.min(ayF, ayR);
    }
    const ayF = capF / (m * wf), ayR = capR / (m * (1 - wf));
    return { g: ay / G, balance: (ayF - ayR) / (ayF + ayR) }; // >0: rear saturates first (oversteer)
  };
  const lat100 = lateral(100 / 3.6), lat200 = lateral(200 / 3.6);
  // ---- drift capability (0..10): rotation authority + power to keep it lit + steering angle + diff
  const pwr = (topPowerKw(e, torque) / m) * 1000; // W/kg
  const rwdish = p.drivetrain.layout === 'RWD' ? 1 : p.drivetrain.layout === 'AWD' ? clamp((0.5 - split) * 2.2, 0, 0.75) : 0;
  const lock = spec.steering.lock;
  const diff = spec.diff.type === 'locked' ? 1 : spec.diff.type === 'lsd' ? clamp(spec.diff.accel, 0, 1) : spec.diff.type === 'viscous' ? 0.4 : 0;
  // can the rear be lit in 3rd gear at ~70 km/h?
  const g3 = tr.gears[Math.min(2, tr.gears.length - 1)] * tr.final;
  const rpm3 = (70 / 3.6 / R) * g3 * 30 / Math.PI;
  const wheelForce3 = (torque(rpm3) * g3 * 0.9) / R;
  const breakaway = clamp(wheelForce3 / (muR * m * G * (1 - wf) * 0.95), 0, 1.8);
  const driftScore = rwdish * (clamp(breakaway / 1.25, 0, 1) * 3.6 + clamp((lock - 30) / 35, 0, 1) * 2.4 + diff * 1.6 + clamp(comp.slide, 0, 1) * 1.2 + clamp(0.4 - Math.abs(lat100.balance + 0.02) * 4, 0, 0.4) * 3);
  // ---- PI
  const S = clamp((top - 160) / 260, 0, 2), A = clamp((16 - (t100 ?? 16)) / 14, 0, 1.15), H = clamp((lat100.g - 0.7) / 0.9, 0, 1.15), B = clamp((60 - xb) / 32, 0, 1.1), Hh = clamp((lat200.g - 0.7) / 1.0, 0, 1.15);
  const raw = 0.24 * S + 0.28 * A + 0.24 * H + 0.1 * Hh + 0.14 * B;
  const pi = Math.round(clamp(100 + 900 * Math.pow(clamp(raw, 0, 1.2), 0.95), 100, 999));
  return {
    topSpeed: Math.round(top), t60, t100, t200, quarter: tq, quarterSpeed: vq, braking: xb, latG: lat100.g, latGHigh: lat200.g, balance: lat100.balance,
    drift: clamp(driftScore, 0, 10), pi, cls: classFor(pi), powerKw: topPowerKw(e, torque), mass: m, pwr,
    bars: { speed: clamp(S * 10, 0, 10), accel: clamp(A * 10, 0, 10), handling: clamp(H * 10, 0, 10), braking: clamp(B * 10, 0, 10), launch: clamp(((8 - (t60 ?? 8)) / 6.5) * 10, 0, 10), drift: clamp(driftScore, 0, 10) },
  };
}

function topPowerKw(e, torque) {
  let best = 0;
  for (let r = e.idle; r <= e.limiter; r += 100) best = Math.max(best, (torque(r) * r * Math.PI) / 30 / 1000);
  return best;
}

/**
 * Estimated lap time on a route with a quasi-steady-state g-g model (forward/backward passes).
 * Used by AI tune for track-specific optimisation. Returns seconds.
 */
export function lapTime(route, metrics, spec) {
  const n = route.n;
  const muLat = metrics.latG * G, muHigh = metrics.latGHigh * G;
  const vmax = metrics.topSpeed / 3.6;
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = Math.abs(route.curv[i]);
    let vi = vmax;
    if (c > 1e-5) { const aL = (vv) => muLat + (muHigh - muLat) * clamp((vv - 27.8) / 27.8, 0, 1.5); vi = Math.sqrt(aL(Math.sqrt(muLat / c)) / c); }
    v[i] = Math.min(vmax, vi);
  }
  const accelAt = (vv) => { const t100 = metrics.t100 || 12; const a0 = 27.8 / t100 * 1.15; return Math.max(0.4, a0 * (1 - Math.pow(vv / vmax, 2.2))); };
  const brake = (27.8 * 27.8) / (2 * Math.max(20, metrics.braking));
  const ds = (i) => Math.hypot(route.x[route.idx(i + 1)] - route.x[i], route.z[route.idx(i + 1)] - route.z[i]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n - (route.closed ? 0 : 1); i++) { const j = route.idx(i + 1); v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 2 * accelAt(v[i]) * ds(i))); }
    for (let i = n - 1; i >= 0; i--) { const j = route.idx(i + 1); if (!route.closed && i === n - 1) continue; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * brake * ds(i))); }
  }
  let t = 0;
  for (let i = 0; i < n - (route.closed ? 0 : 1); i++) t += ds(i) / Math.max(1, (v[i] + v[route.idx(i + 1)]) / 2);
  return t;
}
