// Tune sliders. A car's tune is { key: value }; missing keys use the spec default (after parts).
// Availability depends on installed parts (like Forza: race suspension unlocks camber etc).
// UI groups come from `group`. fmt: how the tuning screen displays the value.
const P = (parts, slot) => parts?.[slot] || 'stock';
const any = (parts, slot, levels) => levels.includes(P(parts, slot));

const SUSP_RANGE = { stock: null, street: [0.8, 1.2], sport: [0.55, 1.6], race: [0.35, 2.6], drift: [0.35, 2.6], rally: [0.5, 1.8] };

export const TUNE_GROUPS = [
  { id: 'tires', name: 'Tyres', zh: '輪胎' },
  { id: 'gearing', name: 'Gearing', zh: '齒比' },
  { id: 'alignment', name: 'Alignment', zh: '定位' },
  { id: 'arb', name: 'Anti-roll bars', zh: '防傾桿' },
  { id: 'springs', name: 'Springs', zh: '彈簧' },
  { id: 'damping', name: 'Damping', zh: '阻尼' },
  { id: 'aero', name: 'Aero', zh: '空力' },
  { id: 'brakes', name: 'Brakes', zh: '煞車' },
  { id: 'diff', name: 'Differential', zh: '差速器' },
  { id: 'steering', name: 'Steering & boost', zh: '轉向與增壓' },
];

const suspRange = (parts) => SUSP_RANGE[P(parts, 'suspension')];
const rel = (lo, hi) => ({ min: (b) => b * lo, max: (b) => b * hi });

export const TUNE_DEFS = [
  // tyres (always available)
  { key: 'pressureF', group: 'tires', label: 'Front pressure', fmt: 'bar', step: 0.05, min: () => 1.2, max: () => 3.4, get: (s) => s.tires.pressure[0], set: (s, v) => { s.tires.pressure[0] = v; } },
  { key: 'pressureR', group: 'tires', label: 'Rear pressure', fmt: 'bar', step: 0.05, min: () => 1.2, max: () => 3.4, get: (s) => s.tires.pressure[1], set: (s, v) => { s.tires.pressure[1] = v; } },
  // gearing
  { key: 'final', group: 'gearing', label: 'Final drive', fmt: 'ratio', step: 0.01, min: () => 2.2, max: () => 6.5, get: (s) => s.transmission.final, set: (s, v) => { s.transmission.final = v; },
    requires: (p) => any(p, 'transmission', ['sport', 'race', 'sequential']) },
  ...Array.from({ length: 8 }, (_, i) => ({
    key: 'gear' + (i + 1), group: 'gearing', label: `Gear ${i + 1}`, fmt: 'ratio', step: 0.01, min: () => 0.45, max: () => 5.2,
    get: (s) => s.transmission.gears[i], set: (s, v) => { if (i < s.transmission.gears.length) s.transmission.gears[i] = v; },
    requires: (p, s) => any(p, 'transmission', ['race', 'sequential']) && i < s.transmission.gears.length,
  })),
  // alignment
  { key: 'camberF', group: 'alignment', label: 'Front camber', fmt: 'deg', step: 0.1, min: () => -7, max: () => 2, get: (s) => s.suspension.front.camber, set: (s, v) => { s.suspension.front.camber = v; }, requires: (p) => any(p, 'suspension', ['sport', 'race', 'drift', 'rally']) },
  { key: 'camberR', group: 'alignment', label: 'Rear camber', fmt: 'deg', step: 0.1, min: () => -5, max: () => 2, get: (s) => s.suspension.rear.camber, set: (s, v) => { s.suspension.rear.camber = v; }, requires: (p) => any(p, 'suspension', ['sport', 'race', 'drift', 'rally']) },
  { key: 'toeF', group: 'alignment', label: 'Front toe (+ in)', fmt: 'deg', step: 0.05, min: () => -1.5, max: () => 1.5, get: (s) => s.suspension.front.toe, set: (s, v) => { s.suspension.front.toe = v; }, requires: (p) => any(p, 'suspension', ['sport', 'race', 'drift', 'rally']) },
  { key: 'toeR', group: 'alignment', label: 'Rear toe (+ in)', fmt: 'deg', step: 0.05, min: () => -1.5, max: () => 1.5, get: (s) => s.suspension.rear.toe, set: (s, v) => { s.suspension.rear.toe = v; }, requires: (p) => any(p, 'suspension', ['sport', 'race', 'drift', 'rally']) },
  { key: 'caster', group: 'alignment', label: 'Caster', fmt: 'deg', step: 0.1, min: () => 2, max: () => 10, get: (s) => s.steering.caster, set: (s, v) => { s.steering.caster = v; }, requires: (p) => any(p, 'suspension', ['race', 'drift', 'rally']) },
  // anti-roll bars
  { key: 'arbF', group: 'arb', label: 'Front anti-roll bar', fmt: 'Nmm', step: 100, ...rel(0.2, 2.8), get: (s) => s.suspension.front.arb, set: (s, v) => { s.suspension.front.arb = v; }, requires: (p) => any(p, 'arb', ['sport', 'race']) },
  { key: 'arbR', group: 'arb', label: 'Rear anti-roll bar', fmt: 'Nmm', step: 100, ...rel(0.2, 2.8), get: (s) => s.suspension.rear.arb, set: (s, v) => { s.suspension.rear.arb = v; }, requires: (p) => any(p, 'arb', ['sport', 'race']) },
  // springs + ride height
  { key: 'springF', group: 'springs', label: 'Front springs', fmt: 'Nmm', step: 250, min: (b, p) => b * (suspRange(p)?.[0] ?? 1), max: (b, p) => b * (suspRange(p)?.[1] ?? 1), get: (s) => s.suspension.front.spring, set: (s, v) => { s.suspension.front.spring = v; }, requires: (p) => !!suspRange(p) },
  { key: 'springR', group: 'springs', label: 'Rear springs', fmt: 'Nmm', step: 250, min: (b, p) => b * (suspRange(p)?.[0] ?? 1), max: (b, p) => b * (suspRange(p)?.[1] ?? 1), get: (s) => s.suspension.rear.spring, set: (s, v) => { s.suspension.rear.spring = v; }, requires: (p) => !!suspRange(p) },
  { key: 'rideF', group: 'springs', label: 'Front ride height', fmt: 'cm', step: 0.005, min: (b, p) => b - (P(p, 'suspension') === 'street' ? 0.02 : 0.06), max: (b, p) => b + (P(p, 'suspension') === 'rally' ? 0.1 : 0.04), get: (s) => s.suspension.front.rideOffset, set: (s, v) => { s.suspension.front.rideOffset = v; }, requires: (p) => !!suspRange(p) },
  { key: 'rideR', group: 'springs', label: 'Rear ride height', fmt: 'cm', step: 0.005, min: (b, p) => b - (P(p, 'suspension') === 'street' ? 0.02 : 0.06), max: (b, p) => b + (P(p, 'suspension') === 'rally' ? 0.1 : 0.04), get: (s) => s.suspension.rear.rideOffset, set: (s, v) => { s.suspension.rear.rideOffset = v; }, requires: (p) => !!suspRange(p) },
  // damping
  ...[['bumpF', 'front', 'bump', 'Front bump'], ['bumpR', 'rear', 'bump', 'Rear bump'], ['reboundF', 'front', 'rebound', 'Front rebound'], ['reboundR', 'rear', 'rebound', 'Rear rebound']].map(([key, axle, k, label]) => ({
    key, group: 'damping', label, fmt: 'kNsm', step: 50, ...rel(0.3, 2.6), get: (s) => s.suspension[axle][k], set: (s, v) => { s.suspension[axle][k] = v; },
    requires: (p) => any(p, 'suspension', ['sport', 'race', 'drift', 'rally']),
  })),
  // aero
  { key: 'aeroF', group: 'aero', label: 'Front downforce', fmt: 'aero', step: 0.01, min: (b, p, s) => s.aeroAdjust.f?.[0] ?? b, max: (b, p, s) => s.aeroAdjust.f?.[1] ?? b, get: (s) => s.aero.downforce[0], set: (s, v) => { s.aero.downforce[0] = v; }, requires: (p) => P(p, 'frontAero') !== 'stock' },
  { key: 'aeroR', group: 'aero', label: 'Rear downforce', fmt: 'aero', step: 0.01, min: (b, p, s) => s.aeroAdjust.r?.[0] ?? b, max: (b, p, s) => s.aeroAdjust.r?.[1] ?? b, get: (s) => s.aero.downforce[1], set: (s, v) => { s.aero.downforce[1] = v; }, requires: (p) => P(p, 'rearAero') !== 'stock' },
  // brakes
  { key: 'brakeBias', group: 'brakes', label: 'Balance (front)', fmt: 'pct', step: 0.01, min: () => 0.4, max: () => 0.8, get: (s) => s.brakes.bias, set: (s, v) => { s.brakes.bias = v; }, requires: (p) => any(p, 'brakes', ['sport', 'race']) },
  { key: 'brakePressure', group: 'brakes', label: 'Pressure', fmt: 'pct', step: 0.01, min: () => 0.6, max: () => 1.4, get: () => 1, set: (s, v) => { s.brakes.torque *= v; }, requires: (p) => any(p, 'brakes', ['sport', 'race']) },
  // differential
  { key: 'diffAccel', group: 'diff', label: 'Acceleration lock', fmt: 'pct', step: 0.01, min: () => 0, max: () => 1, get: (s) => s.diff.accel, set: (s, v) => { s.diff.accel = v; }, requires: (p, s) => s.diff.type === 'lsd' && any(p, 'differential', ['sport', 'race', 'drift']) },
  { key: 'diffDecel', group: 'diff', label: 'Deceleration lock', fmt: 'pct', step: 0.01, min: () => 0, max: () => 1, get: (s) => s.diff.decel, set: (s, v) => { s.diff.decel = v; }, requires: (p, s) => s.diff.type === 'lsd' && any(p, 'differential', ['race', 'drift']) },
  { key: 'diffFAccel', group: 'diff', label: 'Front accel lock', fmt: 'pct', step: 0.01, min: () => 0, max: () => 1, get: (s) => s.diffFront?.accel ?? 0, set: (s, v) => { if (s.diffFront) s.diffFront.accel = v; }, requires: (p, s) => s.drivetrain === 'AWD' && s.diffFront?.type === 'lsd' && any(p, 'differential', ['race', 'drift']) },
  { key: 'awdSplit', group: 'diff', label: 'Front torque split', fmt: 'pct', step: 0.01, min: () => 0.1, max: () => 0.9, get: (s) => s.awdSplit, set: (s, v) => { s.awdSplit = v; }, requires: (p, s) => s.drivetrain === 'AWD' && any(p, 'differential', ['race', 'drift']) },
  // steering + boost
  { key: 'steerLock', group: 'steering', label: 'Steering lock', fmt: 'deg', step: 0.5, min: (b) => Math.max(25, b - 18), max: (b) => b, get: (s) => s.steering.lock, set: (s, v) => { s.steering.lock = v; }, requires: (p) => P(p, 'steering') !== 'stock' },
  { key: 'boost', group: 'steering', label: 'Boost', fmt: 'boost', step: 0.01, min: (b) => b * 0.5, max: (b) => b * 1.25, get: (s) => s.engine.boost?.max ?? 0, set: (s, v) => { if (s.engine.boost) s.engine.boost.max = v; }, requires: (p, s) => !!s.engine.boost && any(p, 'ecu', ['street', 'race']) },
];

export const TUNE_BY_KEY = Object.fromEntries(TUNE_DEFS.map((d) => [d.key, d]));

/** Available tune sliders for a working spec (parts already applied) with resolved ranges and defaults. */
export function tuneSliders(spec, parts) {
  const out = [];
  for (const d of TUNE_DEFS) {
    if (d.requires && !d.requires(parts, spec)) continue;
    const base = d.get(spec);
    const min = d.min(base, parts, spec), max = d.max(base, parts, spec);
    if (!(max > min)) continue;
    out.push({ ...d, base, min, max });
  }
  return out;
}

/** Applies tune values (clamped to legal ranges) onto a working spec that already has parts applied. */
export function applyTune(spec, tune, parts) {
  if (!tune) return spec;
  const sliders = tuneSliders(spec, parts);
  for (const sl of sliders) {
    const v = tune[sl.key];
    if (v == null || !isFinite(v)) continue;
    sl.set(spec, Math.min(sl.max, Math.max(sl.min, v)));
  }
  return spec;
}

export function formatTune(fmt, v, units = 'metric') {
  switch (fmt) {
    case 'bar': return units === 'imperial' ? `${(v * 14.5038).toFixed(1)} psi` : `${v.toFixed(2)} bar`;
    case 'ratio': return v.toFixed(2);
    case 'deg': return `${v >= 0 && v !== 0 ? '+' : ''}${v.toFixed(1)}°`;
    case 'Nmm': return `${(v / 1000).toFixed(1)} N/mm`;
    case 'kNsm': return `${(v / 1000).toFixed(2)} kN·s/m`;
    case 'cm': return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} cm`;
    case 'pct': return `${Math.round(v * 100)}%`;
    case 'aero': return `${Math.round(v * 0.5 * 1.225 * 55.56 * 55.56 / 9.81)} kgf @200`;
    case 'boost': return `${v.toFixed(2)} bar`;
    default: return String(+v.toFixed(3));
  }
}
