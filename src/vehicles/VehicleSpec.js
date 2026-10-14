// Vehicle definitions: normalization (defaults + validation) and conversion to physics parameters.
//   raw vehicle.js  --normalizeVehicle-->  def  --buildWorkingSpec(def, parts, tune)-->  spec  --specToParams-->  params
// `spec` is the human-readable SI spec (what vehicles/AGENTS.md documents); `params` is what VehiclePhysics eats.
import { G, DEG } from '../core/math.js';
import { COMPOUNDS } from '../physics/Tire.js';
import { APPLY_ORDER, partLevel } from '../tuning/Parts.js';
import { applyTune } from '../tuning/Tune.js';
import { estimateEngineMass, peakPower } from '../tuning/engines.js';

const LAYOUT_CYL = { I3: 3, I4: 4, I5: 5, I6: 6, F4: 4, F6: 6, V6: 6, V8: 8, V10: 10, V12: 12, R2: 2, R3: 3, EV: 0 };
const isNum = (v) => typeof v === 'number' && isFinite(v);
const pair = (v, d) => (Array.isArray(v) ? [v[0] ?? d, v[1] ?? v[0] ?? d] : isNum(v) ? [v, v] : [d, d]);

function axleDefaults(a = {}, isFront, mass, wf) {
  const corner = mass * (isFront ? wf : 1 - wf) / 2;
  const freq = isFront ? 1.65 : 1.8;                    // ride frequency (Hz)
  const spring = a.spring ?? Math.round(corner * (2 * Math.PI * freq) ** 2);
  const crit = 2 * Math.sqrt(spring * corner);
  return {
    spring,
    bump: a.bump ?? Math.round(crit * 0.28),
    rebound: a.rebound ?? Math.round(crit * 0.42),
    travel: a.travel ? pair(a.travel, 0.1) : [0.1, 0.12],
    arb: a.arb ?? Math.round(spring * (isFront ? 0.55 : 0.35)),
    camber: a.camber ?? (isFront ? -1 : -0.6),
    toe: a.toe ?? (isFront ? 0 : 0.1),
    rollCenter: a.rollCenter ?? (isFront ? 0.07 : 0.11),
    rideOffset: 0,
  };
}

/** Fills defaults and reports problems. Never throws for content mistakes it can fix. */
export function normalizeVehicle(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object') return { def: null, problems: ['not an object'] };
  if (!raw.id || !/^[a-z0-9-]+$/.test(raw.id)) problems.push('id must be kebab-case (a-z, 0-9, -)');
  if (!raw.name) problems.push('missing name');
  if (!raw.model || typeof raw.model.build !== 'function') problems.push('model.build(ctx) is required');
  const sp = raw.specs || {};
  if (!raw.specs) problems.push('missing specs (physics data)');
  const mass = sp.mass ?? 1300;
  const wf = sp.weightFront ?? 0.55;
  const e = sp.engine || {};
  if (!Array.isArray(e.torque) || e.torque.length < 3) problems.push('specs.engine.torque needs >= 3 [rpm, Nm] points');
  const torque = (Array.isArray(e.torque) && e.torque.length >= 2 ? e.torque : [[1000, 140], [4000, 190], [6500, 170], [7200, 150]]).map(([r, t]) => [r, t]).sort((a, b) => a[0] - b[0]);
  const redline = e.redline ?? Math.round(torque[torque.length - 1][0] * 0.95);
  const engine = {
    layout: e.layout || 'I4', displacement: e.displacement ?? 2.0, aspiration: e.aspiration || (e.boost ? 'turbo' : 'NA'),
    idle: e.idle ?? 850, redline, limiter: e.limiter ?? redline + 250, torque,
    inertia: e.inertia ?? 0.15, friction: e.friction ?? null, mass: e.mass ?? null,
    boost: e.boost ? { max: e.boost.max ?? 0.8, spool: pair(e.boost.spool, 3000), lag: e.boost.lag ?? 0.8, type: e.boost.type || 'turbo', eff: e.boost.eff ?? 0.88 } : null,
  };
  if (engine.limiter <= engine.redline) engine.limiter = engine.redline + 200;
  const tr = sp.transmission || {};
  const gears = Array.isArray(tr.gears) && tr.gears.length ? tr.gears.slice() : [3.6, 2.1, 1.45, 1.1, 0.88, 0.74];
  const tires = sp.tires || {};
  const compound = COMPOUNDS[tires.compound] ? tires.compound : 'street';
  if (tires.compound && !COMPOUNDS[tires.compound]) problems.push(`unknown tyre compound "${tires.compound}"`);
  const susp = sp.suspension || {};
  const drivetrain = ['RWD', 'FWD', 'AWD'].includes(sp.drivetrain) ? sp.drivetrain : 'RWD';
  if (sp.drivetrain && !['RWD', 'FWD', 'AWD'].includes(sp.drivetrain)) problems.push('drivetrain must be RWD | FWD | AWD');
  const diff = { type: 'open', accel: 0, decel: 0, preload: 0, ...(sp.diff || {}) };
  const specs = {
    mass, weightFront: wf, cgHeight: sp.cgHeight ?? 0.5, wheelbase: sp.wheelbase ?? 2.55, track: pair(sp.track, 1.5),
    dimensions: Array.isArray(sp.dimensions) ? sp.dimensions.slice(0, 3) : [4.4, 1.78, 1.35], bodyOffsetZ: sp.bodyOffsetZ ?? 0,
    clearance: sp.clearance ?? 0.13, inertiaScale: sp.inertiaScale ?? 1, engineLayout: sp.engineLayout || 'front',
    engine,
    transmission: { gears, reverse: tr.reverse ?? 3.4, final: tr.final ?? 4.1, shiftTime: tr.shiftTime ?? 0.2, type: tr.type || 'manual', clutchMult: 1 },
    drivetrain, awdSplit: sp.awdSplit ?? 0.4,
    diff, diffFront: sp.diffFront ? { type: 'open', accel: 0, decel: 0, preload: 0, ...sp.diffFront } : (drivetrain === 'AWD' ? { type: 'open', accel: 0, decel: 0, preload: 0 } : null),
    diffCenter: sp.centerDiff ? { ...sp.centerDiff } : (drivetrain === 'AWD' ? { type: 'viscous', viscous: 140 } : null),
    steering: { lock: sp.steering?.lock ?? 36, ratio: sp.steering?.ratio ?? 14.5, ackermann: sp.steering?.ackermann ?? 0.6, caster: sp.steering?.caster ?? 5.5 },
    suspension: { front: axleDefaults(susp.front, true, mass, wf), rear: axleDefaults(susp.rear, false, mass, wf) },
    brakes: { torque: sp.brakes?.torque ?? Math.round(mass * 3.9), bias: sp.brakes?.bias ?? 0.64, handbrake: sp.brakes?.handbrake ?? Math.round(mass * 1.6) },
    tires: { compound, width: pair(tires.width, 225), radius: pair(tires.radius, 0.32), pressure: pair(tires.pressure, COMPOUNDS[compound].pOpt), wheelMass: tires.wheelMass ?? 20 },
    aero: { cd: sp.aero?.cd ?? 0.34, area: sp.aero?.area ?? 2.0, downforce: pair(sp.aero?.downforce, 0) },
    nitrous: null,
  };
  // sanity ranges (warn, keep)
  const chk = (v, lo, hi, name) => { if (!(v >= lo && v <= hi)) problems.push(`${name}=${v} outside ${lo}..${hi}`); };
  chk(specs.mass, 300, 4000, 'mass'); chk(specs.weightFront, 0.25, 0.75, 'weightFront'); chk(specs.cgHeight, 0.2, 1.2, 'cgHeight');
  chk(specs.wheelbase, 1.6, 4.2, 'wheelbase'); chk(specs.tires.radius[0], 0.2, 0.6, 'tire radius'); chk(engine.redline, 2000, 20000, 'redline');
  const def = {
    id: raw.id, name: raw.name || raw.id, make: raw.make || '', year: raw.year || null, country: raw.country || '',
    price: raw.price ?? 500000, starter: !!raw.starter, hidden: !!raw.hidden, tags: raw.tags || [], description: raw.description || '',
    placeholder: !!raw.placeholder,
    specs,
    upgrades: raw.upgrades || {},
    visual: normalizeVisual(raw.visual),
    sound: { layout: engine.layout, cylinders: LAYOUT_CYL[engine.layout] ?? 4, ...(raw.sound || {}) },
    model: raw.model || { build: () => null },
    raw,
  };
  return { def, problems };
}

function normalizeVisual(v = {}) {
  const slots = {};
  for (const [id, s] of Object.entries(v.slots || {})) {
    slots[id] = { name: s.name || id, zh: s.zh || '', options: (s.options || []).map((o) => ({ price: 0, ...o })) };
  }
  return {
    paint: { color: '#c8c2b4', finish: 'gloss', ...(v.paint || {}) },
    paints: v.paints || [],
    slots,
  };
}

const clone = (o) => structuredClone(o);

/** Working spec = def.specs + parts + tune. Pure function (does not touch def). */
export function buildWorkingSpec(def, parts = {}, tune = null) {
  const s = clone(def.specs);
  s.sound = { ...def.sound, exhaust: 0, pops: 0, lope: 0, bov: def.specs.engine.boost ? 1 : 0, whine: def.specs.engine.boost?.type === 'supercharger' ? 1 : 0, gearWhine: 0 };
  s.aeroAdjust = {};
  s.driveline = { inertiaMult: 1 };
  s.chassisStiffness = 1;
  for (const slot of APPLY_ORDER) {
    const id = parts?.[slot.id];
    if (!id || id === 'stock') continue;
    const level = partLevel(slot.id, id);
    if (level?.apply && (!slot.requires || slot.requires(parts, s))) level.apply(s);
  }
  applyTune(s, tune, parts);
  return s;
}

/** Converts a working spec into VehiclePhysics params. */
export function specToParams(s) {
  const [L, W, H] = s.dimensions;
  const mass = s.mass, wf = s.weightFront, wb = s.wheelbase;
  const cgZ = (wf - 0.5) * wb;
  const k = 0.8 * s.inertiaScale;
  const inertia = [(mass / 12) * (H * H + L * L) * k, (mass / 12) * (W * W + L * L) * k, (mass / 12) * (W * W + H * H) * k];
  const e = s.engine;
  const peakT = Math.max(...e.torque.map((t) => t[1]));
  const boostMult = e.boost ? 1 + e.boost.max * e.boost.eff : 1;
  const drivenF = s.drivetrain !== 'RWD', drivenR = s.drivetrain !== 'FWD';
  // cgHeight is the CG height in the body frame at stock ride height; ride-height offsets move the body,
  // not the CG inside it (VehiclePhysics.reset adds rideAvg when placing the car).
  const rideAvg = (s.suspension.front.rideOffset + s.suspension.rear.rideOffset) / 2;
  const cgHeight = s.cgHeight;
  const wheel = (i) => {
    const front = i < 2;
    const ax = front ? s.suspension.front : s.suspension.rear;
    const radius = s.tires.radius[front ? 0 : 1];
    const driven = front ? drivenF : drivenR;
    const iw = s.tires.wheelMass * radius * radius * 0.75 + (driven ? 0.35 * s.driveline.inertiaMult : 0.1);
    return {
      x: (i % 2 === 0 ? 1 : -1) * s.track[front ? 0 : 1] / 2, z: front ? wb / 2 : -wb / 2,
      radius, width: s.tires.width[front ? 0 : 1], inertia: iw,
      staticLoad: mass * G * (front ? wf : 1 - wf) / 2,
      spring: ax.spring, damperBump: ax.bump, damperRebound: ax.rebound,
      bumpTravel: ax.travel[0], droopTravel: ax.travel[1], rideOffset: ax.rideOffset,
      arb: ax.arb, camber: ax.camber, toe: ax.toe, rollCenter: ax.rollCenter,
      compound: s.tires.compound, pressure: s.tires.pressure[front ? 0 : 1],
    };
  };
  const clearance = Math.max(0.05, s.clearance);
  const hy = Math.max(0.2, (H - clearance) / 2);
  return {
    mass, inertia, cgHeight, cgZ, wheelbase: wb, rideAvg,
    body: { hx: W / 2, hy, hz: L / 2, cy: clearance + hy - cgHeight, cz: s.bodyOffsetZ - cgZ },
    wheels: [wheel(0), wheel(1), wheel(2), wheel(3)],
    steering: { lock: s.steering.lock * DEG, ackermann: s.steering.ackermann, caster: s.steering.caster, ratio: s.steering.ratio },
    engine: {
      idle: e.idle, redline: e.redline, limiter: e.limiter, torque: e.torque, inertia: e.inertia,
      friction: e.friction ?? peakT * 0.16,
      boost: e.boost ? { max: e.boost.max, spoolStart: e.boost.spool[0], spoolFull: e.boost.spool[1], lag: e.boost.lag, type: e.boost.type, eff: e.boost.eff } : null,
    },
    transmission: {
      gears: s.transmission.gears, reverse: s.transmission.reverse, final: s.transmission.final, shiftTime: s.transmission.shiftTime,
      clutchTorque: peakT * boostMult * 1.6 * (s.transmission.clutchMult || 1) + (s.nitrous ? s.nitrous.torque : 0),
    },
    drivetrain: {
      layout: s.drivetrain, split: s.awdSplit,
      front: s.drivetrain === 'FWD' ? s.diff : s.drivetrain === 'AWD' ? (s.diffFront || { type: 'open' }) : { type: 'open' },
      rear: s.drivetrain === 'FWD' ? { type: 'open' } : s.diff,
      center: s.drivetrain === 'AWD' ? (s.diffCenter || { type: 'viscous', viscous: 140 }) : null,
    },
    brakes: { torque: s.brakes.torque, bias: s.brakes.bias, handbrake: s.brakes.handbrake },
    aero: { cd: s.aero.cd, area: s.aero.area, clF: s.aero.downforce[0], clR: s.aero.downforce[1], zF: wb / 2 - cgZ, zR: -wb / 2 - cgZ },
    nitrous: s.nitrous,
  };
}

export const buildPhysicsParams = (def, parts, tune) => specToParams(buildWorkingSpec(def, parts, tune));

/** Display summary for menus. */
export function specSummary(s) {
  const e = s.engine;
  const pp = peakPower(e.torque, e.boost ? (r) => 1 + e.boost.max * e.boost.eff * smooth(e.boost.spool[0], e.boost.spool[1], r) : undefined);
  const peakT = Math.max(...e.torque.map((t) => t[1])) * (e.boost ? 1 + e.boost.max * e.boost.eff : 1);
  return {
    hp: Math.round(pp.hp), kw: Math.round(pp.kw), powerRpm: pp.rpm, torque: Math.round(peakT), mass: Math.round(s.mass),
    weightFront: s.weightFront, drivetrain: s.drivetrain, engine: `${e.displacement.toFixed(1)}L ${e.layout}${e.boost ? (e.boost.type === 'supercharger' ? ' SC' : e.aspiration === 'twinturbo' ? ' TT' : ' T') : ''}`,
    gears: s.transmission.gears.length, compound: COMPOUNDS[s.tires.compound]?.name || s.tires.compound,
    pwr: pp.hp / (s.mass / 1000), redline: e.redline, engineMass: e.mass || estimateEngineMass(e),
  };
}
function smooth(a, b, v) { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
