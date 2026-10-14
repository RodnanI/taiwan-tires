// Performance upgrade catalog. A car's installed parts are { slotId: levelId } (missing = 'stock').
// Each level's apply(spec, ctx) mutates a working copy of the normalized vehicle spec (see VehicleSpec.js).
// Prices are NT$. To add a part: add a level (or slot) here; UI, AI tune and PI pick it up automatically.
import { ENGINES, ENGINE_IDS, estimateEngineMass } from './engines.js';
import { COMPOUNDS, COMPOUND_KEYS } from '../physics/Tire.js';

const mulTorque = (s, k) => { s.engine.torque = s.engine.torque.map(([r, t]) => [r, t * k]); };
const shiftBand = (s, k) => { // stretch the torque curve to higher rpm (cams)
  s.engine.torque = s.engine.torque.map(([r, t], i) => [i === 0 ? r : r * k, t]);
  s.engine.redline = Math.round(s.engine.redline * k); s.engine.limiter = Math.round(s.engine.limiter * k);
};
const addRedline = (s, rpm) => {
  const e = s.engine;
  const last = e.torque[e.torque.length - 1];
  e.torque = [...e.torque.slice(0, -1), [last[0] + rpm, last[1] * 0.98]];
  e.redline += rpm; e.limiter += rpm;
};
const ensureBoost = (s, b) => { s.engine.boost = { eff: 0.88, ...b }; s.engine.aspiration = b.type === 'supercharger' ? 'supercharger' : (s.engine.aspiration === 'twinturbo' ? 'twinturbo' : 'turbo'); };
const lv = (id, name, price, apply, extra = {}) => ({ id, name, price, apply, ...extra });
const STOCK = { id: 'stock', name: 'Stock', price: 0 };

export const PART_CATEGORIES = [
  { id: 'engine', name: 'Engine', zh: '引擎' },
  { id: 'induction', name: 'Induction', zh: '增壓' },
  { id: 'platform', name: 'Platform & handling', zh: '底盤' },
  { id: 'drivetrain', name: 'Drivetrain', zh: '傳動' },
  { id: 'tires', name: 'Tyres & rims', zh: '輪胎輪框' },
  { id: 'aero', name: 'Aero & drift', zh: '空力與甩尾' },
  { id: 'conversion', name: 'Conversions', zh: '改裝套件' },
];

export const PART_SLOTS = [
  // ---- engine -----------------------------------------------------------------------------
  { id: 'intake', cat: 'engine', name: 'Intake', zh: '進氣', levels: [STOCK,
    lv('street', 'Street intake', 9000, (s) => mulTorque(s, 1.02)),
    lv('sport', 'Sport intake', 22000, (s) => mulTorque(s, 1.04)),
    lv('race', 'Race intake', 48000, (s) => { mulTorque(s, 1.06); shiftBand(s, 1.01); })] },
  { id: 'exhaust', cat: 'engine', name: 'Exhaust', zh: '排氣', levels: [STOCK,
    lv('street', 'Street exhaust', 12000, (s) => { mulTorque(s, 1.02); s.sound.exhaust = 1; }),
    lv('sport', 'Sport cat-back', 30000, (s) => { mulTorque(s, 1.04); s.sound.exhaust = 2; }),
    lv('race', 'Straight pipe', 62000, (s) => { mulTorque(s, 1.06); s.sound.exhaust = 3; s.sound.pops = 1; })] },
  { id: 'camshaft', cat: 'engine', name: 'Camshafts', zh: '凸輪軸', levels: [STOCK,
    lv('street', 'Street cams', 16000, (s) => { mulTorque(s, 1.015); shiftBand(s, 1.02); }),
    lv('sport', 'Sport cams', 36000, (s) => { mulTorque(s, 1.03); shiftBand(s, 1.04); s.sound.lope = 0.4; }),
    lv('race', 'Race cams', 70000, (s) => { mulTorque(s, 1.05); shiftBand(s, 1.06); s.sound.lope = 1; })] },
  { id: 'valves', cat: 'engine', name: 'Valvetrain', zh: '汽門', levels: [STOCK,
    lv('sport', 'Sport valve springs', 18000, (s) => addRedline(s, 300)),
    lv('race', 'Titanium valvetrain', 52000, (s) => addRedline(s, 600))] },
  { id: 'ecu', cat: 'engine', name: 'ECU', zh: '電腦', levels: [STOCK,
    lv('street', 'Street map', 10000, (s) => mulTorque(s, 1.02)),
    lv('race', 'Standalone ECU', 45000, (s) => { mulTorque(s, 1.04); s.engine.limiter += 200; if (s.engine.boost) s.engine.boost.max *= 1.06; })] },
  { id: 'displacement', cat: 'engine', name: 'Displacement', zh: '排氣量', levels: [STOCK,
    lv('sport', 'Stroker kit', 55000, (s) => { mulTorque(s, 1.06); s.engine.displacement *= 1.06; }),
    lv('race', 'Big bore + stroke', 120000, (s) => { mulTorque(s, 1.12); s.engine.displacement *= 1.12; s.engine.inertia *= 1.05; })] },
  { id: 'pistons', cat: 'engine', name: 'Pistons & rods', zh: '活塞連桿', levels: [STOCK,
    lv('sport', 'Forged pistons', 30000, (s) => mulTorque(s, 1.02)),
    lv('race', 'Race internals', 75000, (s) => { mulTorque(s, 1.04); addRedline(s, 250); })] },
  { id: 'flywheel', cat: 'engine', name: 'Flywheel', zh: '飛輪', levels: [STOCK,
    lv('sport', 'Light flywheel', 9000, (s) => { s.engine.inertia *= 0.72; }),
    lv('race', 'Race flywheel', 22000, (s) => { s.engine.inertia *= 0.5; })] },
  // ---- induction --------------------------------------------------------------------------
  { id: 'induction', cat: 'induction', name: 'Forced induction', zh: '增壓系統', levels: [STOCK,
    lv('turboS', 'Small turbo', 85000, (s) => { if (!s.engine.boost) ensureBoost(s, { max: 0.65, spool: [s.engine.redline * 0.3, s.engine.redline * 0.5], lag: 0.45, type: 'turbo' }); else s.engine.boost.max += 0.2; }, { desc: 'Quick spool, modest boost. Upgrades an existing turbo by +0.2 bar.' }),
    lv('turboL', 'Big single turbo', 140000, (s) => { const b = s.engine.boost; ensureBoost(s, { max: Math.max(1.3, (b?.max || 0) + 0.45), spool: [s.engine.redline * 0.42, s.engine.redline * 0.66], lag: 1.15, type: 'turbo' }); }, { desc: 'Huge top end, real lag.' }),
    lv('twinTurbo', 'Twin turbo', 165000, (s) => { const b = s.engine.boost; ensureBoost(s, { max: Math.max(1.0, (b?.max || 0) + 0.3), spool: [s.engine.redline * 0.33, s.engine.redline * 0.55], lag: 0.7, type: 'turbo' }); s.engine.aspiration = 'twinturbo'; }),
    lv('superC', 'Centrifugal supercharger', 120000, (s) => { ensureBoost(s, { max: 0.75, spool: [s.engine.idle, s.engine.redline], lag: 0.05, type: 'supercharger', eff: 0.82 }); }, { desc: 'Boost rises with rpm, zero lag.' }),
    lv('superR', 'Roots supercharger', 135000, (s) => { ensureBoost(s, { max: 0.55, spool: [s.engine.idle, s.engine.idle * 2.2], lag: 0.03, type: 'supercharger', eff: 0.8 }); s.sound.whine = 1; }, { desc: 'Instant low-end torque and that whine.' })] },
  { id: 'intercooler', cat: 'induction', name: 'Intercooler', zh: '中冷器', requires: (p, s) => !!s.engine.boost, levels: [STOCK,
    lv('sport', 'Sport intercooler', 18000, (s) => { if (s.engine.boost) s.engine.boost.eff += 0.04; }),
    lv('race', 'Race intercooler', 42000, (s) => { if (s.engine.boost) s.engine.boost.eff += 0.08; })] },
  { id: 'bov', cat: 'induction', name: 'Blow-off valve', zh: '洩壓閥', requires: (p, s) => !!s.engine.boost && s.engine.boost.type === 'turbo', levels: [STOCK,
    lv('loud', 'Atmospheric BOV', 6000, (s) => { s.sound.bov = 2; }),
    lv('flutter', 'No BOV (flutter)', 2000, (s) => { s.sound.bov = 3; })] },
  // ---- platform ---------------------------------------------------------------------------
  { id: 'brakes', cat: 'platform', name: 'Brakes', zh: '煞車', levels: [STOCK,
    lv('street', 'Street brakes', 15000, (s) => { s.brakes.torque *= 1.15; }),
    lv('sport', 'Sport brakes', 38000, (s) => { s.brakes.torque *= 1.3; }),
    lv('race', 'Race brakes', 85000, (s) => { s.brakes.torque *= 1.55; })] },
  { id: 'suspension', cat: 'platform', name: 'Springs & dampers', zh: '避震', levels: [STOCK,
    lv('street', 'Street coilovers', 25000, (s) => { scaleSusp(s, 1.15, 1.1); s.suspension.front.rideOffset -= 0.015; s.suspension.rear.rideOffset -= 0.015; }),
    lv('sport', 'Sport coilovers', 52000, (s) => { scaleSusp(s, 1.35, 1.25); s.suspension.front.rideOffset -= 0.025; s.suspension.rear.rideOffset -= 0.025; }),
    lv('race', 'Race coilovers', 98000, (s) => { scaleSusp(s, 1.7, 1.45); s.suspension.front.rideOffset -= 0.035; s.suspension.rear.rideOffset -= 0.035; }),
    lv('drift', 'Drift coilovers', 88000, (s) => { scaleSusp(s, 1.55, 1.35); s.suspension.front.rideOffset -= 0.03; s.suspension.rear.rideOffset -= 0.025; s.steering.caster = Math.max(s.steering.caster, 7); }),
    lv('rally', 'Rally suspension', 90000, (s) => { scaleSusp(s, 1.05, 1.2); s.suspension.front.rideOffset += 0.035; s.suspension.rear.rideOffset += 0.035; s.suspension.front.travel[1] += 0.05; s.suspension.rear.travel[1] += 0.05; })] },
  { id: 'arb', cat: 'platform', name: 'Anti-roll bars', zh: '防傾桿', levels: [STOCK,
    lv('sport', 'Sport anti-roll bars', 14000, (s) => { s.suspension.front.arb *= 1.3; s.suspension.rear.arb *= 1.3; }),
    lv('race', 'Race anti-roll bars', 32000, (s) => { s.suspension.front.arb *= 1.6; s.suspension.rear.arb *= 1.6; })] },
  { id: 'weight', cat: 'platform', name: 'Weight reduction', zh: '輕量化', levels: [STOCK,
    lv('street', 'Street', 18000, (s) => { s.mass *= 0.97; s.cgHeight *= 0.995; }),
    lv('sport', 'Sport', 48000, (s) => { s.mass *= 0.93; s.cgHeight *= 0.985; }),
    lv('race', 'Race (gutted)', 110000, (s) => { s.mass *= 0.88; s.cgHeight *= 0.97; })] },
  { id: 'cage', cat: 'platform', name: 'Roll cage', zh: '防滾籠', levels: [STOCK,
    lv('bolt', 'Bolt-in cage', 26000, (s) => { s.mass += 22; s.chassisStiffness = 1.08; }),
    lv('weld', 'Welded race cage', 58000, (s) => { s.mass += 34; s.chassisStiffness = 1.15; s.cgHeight *= 1.004; })] },
  // ---- drivetrain -------------------------------------------------------------------------
  { id: 'clutch', cat: 'drivetrain', name: 'Clutch', zh: '離合器', levels: [STOCK,
    lv('sport', 'Sport clutch', 16000, (s) => { s.transmission.clutchMult = 1.45; }),
    lv('race', 'Twin-plate clutch', 42000, (s) => { s.transmission.clutchMult = 2.1; })] },
  { id: 'transmission', cat: 'drivetrain', name: 'Transmission', zh: '變速箱', levels: [STOCK,
    lv('sport', 'Sport gearbox', 38000, (s) => { s.transmission.shiftTime *= 0.75; }, { desc: 'Unlocks final drive tuning.' }),
    lv('race', 'Race 6-speed', 95000, (s) => { respace(s, 6); s.transmission.shiftTime = Math.min(s.transmission.shiftTime, 0.14); s.sound.gearWhine = 0.5; }, { desc: 'Six close ratios, every ratio tunable.' }),
    lv('sequential', 'Sequential 6-speed', 160000, (s) => { respace(s, 6); s.transmission.shiftTime = 0.06; s.transmission.type = 'sequential'; s.sound.gearWhine = 1; }, { desc: 'Straight-cut dog box: instant shifts and whine.' })] },
  { id: 'driveline', cat: 'drivetrain', name: 'Driveline', zh: '傳動軸', levels: [STOCK,
    lv('sport', 'Light driveshaft', 12000, (s) => { s.driveline.inertiaMult = 0.85; }),
    lv('race', 'Carbon driveshaft', 30000, (s) => { s.driveline.inertiaMult = 0.72; })] },
  { id: 'differential', cat: 'drivetrain', name: 'Differential', zh: '差速器', levels: [STOCK,
    lv('sport', 'Sport LSD', 22000, (s) => { setDiff(s, { type: 'lsd', accel: 0.35, decel: 0.15, preload: 60 }); }),
    lv('race', 'Race LSD', 48000, (s) => { setDiff(s, { type: 'lsd', accel: 0.6, decel: 0.3, preload: 120 }); }, { desc: 'Fully adjustable.' }),
    lv('drift', 'Drift 2-way LSD', 52000, (s) => { setDiff(s, { type: 'lsd', accel: 0.85, decel: 0.7, preload: 180 }); }),
    lv('welded', 'Welded', 4000, (s) => { setDiff(s, { type: 'locked', accel: 1, decel: 1, preload: 0 }); }, { desc: 'Cheap, brutal, always locked.' })] },
  // ---- tyres ------------------------------------------------------------------------------
  { id: 'compound', cat: 'tires', name: 'Tyre compound', zh: '胎質', levels: [STOCK, ...COMPOUND_KEYS.map((k) => ({
    id: k, name: COMPOUNDS[k].name, price: COMPOUNDS[k].price, compound: k, apply: (s) => { s.tires.compound = k; },
  }))] },
  { id: 'widthF', cat: 'tires', name: 'Front tyre width', zh: '前胎寬', levels: [STOCK, ...[10, 20, 30, 40, 60].map((mm) => lv('+' + mm, `+${mm} mm`, 2500 + mm * 260, (s) => { s.tires.width[0] += mm; }))] },
  { id: 'widthR', cat: 'tires', name: 'Rear tyre width', zh: '後胎寬', levels: [STOCK, ...[10, 20, 30, 40, 60, 80].map((mm) => lv('+' + mm, `+${mm} mm`, 2500 + mm * 260, (s) => { s.tires.width[1] += mm; }))] },
  { id: 'rims', cat: 'tires', name: 'Rim weight', zh: '輪框', levels: [STOCK,
    lv('light', 'Lightweight rims', 28000, (s) => { s.tires.wheelMass *= 0.8; }),
    lv('forged', 'Forged rims', 66000, (s) => { s.tires.wheelMass *= 0.66; })] },
  { id: 'track', cat: 'tires', name: 'Track width', zh: '輪距', levels: [STOCK,
    lv('+15', 'Spacers +15 mm', 6000, (s) => { s.track = s.track.map((t) => t + 0.03); }),
    lv('+30', 'Wide track +30 mm', 16000, (s) => { s.track = s.track.map((t) => t + 0.06); })] },
  // ---- aero & drift -----------------------------------------------------------------------
  { id: 'frontAero', cat: 'aero', name: 'Front aero', zh: '前下擾流', levels: [STOCK,
    lv('street', 'Street splitter', 14000, (s) => { s.aero.downforce[0] += 0.18; s.aero.cd += 0.005; s.aeroAdjust.f = [0.08, 0.35]; }),
    lv('race', 'Race splitter', 34000, (s) => { s.aero.downforce[0] += 0.38; s.aero.cd += 0.012; s.aeroAdjust.f = [0.15, 0.75]; })] },
  { id: 'rearAero', cat: 'aero', name: 'Rear wing', zh: '尾翼', levels: [STOCK,
    lv('street', 'Street wing', 16000, (s) => { s.aero.downforce[1] += 0.25; s.aero.cd += 0.01; s.aeroAdjust.r = [0.1, 0.5]; }),
    lv('race', 'Race wing', 40000, (s) => { s.aero.downforce[1] += 0.6; s.aero.cd += 0.025; s.aeroAdjust.r = [0.25, 1.15]; })] },
  { id: 'steering', cat: 'aero', name: 'Steering angle kit', zh: '大角度套件', levels: [STOCK,
    lv('street', 'Extended lock', 12000, (s) => { s.steering.lock += 8; }),
    lv('drift', 'Drift angle kit', 38000, (s) => { s.steering.lock += 22; s.steering.ackermann = Math.min(s.steering.ackermann, 0.3); }),
    lv('pro', 'Pro angle kit', 72000, (s) => { s.steering.lock += 32; s.steering.ackermann = 0.1; })] },
  { id: 'handbrake', cat: 'aero', name: 'Handbrake', zh: '手煞車', levels: [STOCK,
    lv('hydro', 'Hydraulic handbrake', 15000, (s) => { s.brakes.handbrake *= 1.9; })] },
  { id: 'nitrous', cat: 'aero', name: 'Nitrous', zh: '氮氣', levels: [STOCK,
    lv('n50', '50 shot', 30000, (s) => { s.nitrous = { torque: peakTorque(s) * 0.22, duration: 9, refill: 70 }; }),
    lv('n100', '100 shot', 60000, (s) => { s.nitrous = { torque: peakTorque(s) * 0.4, duration: 7, refill: 80 }; }),
    lv('n150', '150 shot', 95000, (s) => { s.nitrous = { torque: peakTorque(s) * 0.6, duration: 5.5, refill: 90 }; })] },
  // ---- conversions (applied first) ---------------------------------------------------------
  { id: 'engineSwap', cat: 'conversion', name: 'Engine swap', zh: '換引擎', order: -10, levels: [STOCK,
    ...ENGINE_IDS.map((id) => lv(id, ENGINES[id].name, ENGINES[id].price, (s) => swapEngine(s, id)))] },
  { id: 'drivetrainSwap', cat: 'conversion', name: 'Drivetrain swap', zh: '驅動形式', order: -9, levels: [STOCK,
    lv('RWD', 'RWD conversion', 120000, (s) => convertDrivetrain(s, 'RWD')),
    lv('AWD', 'AWD conversion', 180000, (s) => convertDrivetrain(s, 'AWD')),
    lv('FWD', 'FWD conversion', 90000, (s) => convertDrivetrain(s, 'FWD'))] },
];

export const SLOT_BY_ID = Object.fromEntries(PART_SLOTS.map((s) => [s.id, s]));
export const APPLY_ORDER = [...PART_SLOTS].sort((a, b) => (a.order || 0) - (b.order || 0));

export function partLevel(slotId, levelId) {
  const slot = SLOT_BY_ID[slotId];
  return slot?.levels.find((l) => l.id === (levelId || 'stock')) || slot?.levels[0] || null;
}
/** Is this level hidden for the vehicle (restrictions in def.upgrades.exclude like "engineSwap:v12-65"). */
export function partAllowed(def, slotId, levelId) {
  const ex = def.upgrades?.exclude || [];
  if (ex.includes(slotId) || ex.includes(`${slotId}:${levelId}`)) return false;
  if (slotId === 'drivetrainSwap' && levelId === def.specs.drivetrain) return false;
  return true;
}
export function partsCost(parts) {
  let sum = 0;
  for (const [slot, level] of Object.entries(parts || {})) sum += partLevel(slot, level)?.price || 0;
  return sum;
}

// ---- helpers ----------------------------------------------------------------------------------
function peakTorque(s) { return Math.max(...s.engine.torque.map((t) => t[1])); }
function scaleSusp(s, k, d) {
  for (const a of [s.suspension.front, s.suspension.rear]) { a.spring *= k; a.bump *= d; a.rebound *= d; }
}
function setDiff(s, d) {
  s.diff = { ...s.diff, ...d };
  if (s.drivetrain === 'AWD') s.diffFront = { ...d, accel: d.accel * 0.6, decel: d.decel * 0.6 };
}
function respace(s, n) {
  const t = s.transmission;
  const first = t.gears[0] * 0.92, last = Math.min(t.gears[t.gears.length - 1], 0.8);
  const k = Math.pow(last / first, 1 / (n - 1));
  t.gears = Array.from({ length: n }, (_, i) => +(first * Math.pow(k, i)).toFixed(3));
}
function swapEngine(s, id) {
  const src = ENGINES[id];
  const oldMass = s.engine.mass || estimateEngineMass(s.engine);
  const front = s.engineLayout !== 'mid' && s.engineLayout !== 'rear';
  s.engine = {
    ...structuredClone(src), torque: src.torque.map((p) => [...p]), friction: null, mass: src.mass,
    boost: src.boost ? { max: src.boost.max, spool: [...src.boost.spool], lag: src.boost.lag, type: src.boost.type, eff: src.boost.eff ?? 0.88 } : null,
  };
  const dm = src.mass - oldMass;
  const newMass = s.mass + dm;
  if (front) s.weightFront = (s.weightFront * s.mass + dm * 0.85) / newMass;
  s.mass = newMass;
  s.sound = { ...s.sound, layout: src.layout, cylinders: null };
  s.transmission.clutchMult = Math.max(s.transmission.clutchMult || 1, 1);
}
function convertDrivetrain(s, layout) {
  if (s.drivetrain === layout) return;
  const from = s.drivetrain;
  s.drivetrain = layout;
  if (layout === 'AWD') { s.mass += 70; s.awdSplit = from === 'FWD' ? 0.6 : 0.35; s.diffCenter = { type: 'lsd', accel: 0.3, decel: 0.2, preload: 40 }; s.diffFront = { ...s.diff, accel: s.diff.accel * 0.6, decel: s.diff.decel * 0.6 }; }
  if (from === 'AWD') s.mass -= 60;
  if (layout === 'FWD' && from === 'RWD') s.weightFront = Math.min(0.66, s.weightFront + 0.03);
  if (layout === 'RWD' && from === 'FWD') s.weightFront = Math.max(0.5, s.weightFront - 0.03);
}
