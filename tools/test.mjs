// Engine sanity tests (Node, headless, ~20 s). Not unit tests of every function: each check guards a behaviour
// that broke at least once while building the foundation (see docs/physics.md "known pitfalls").
//   npm test                 all
//   npm test -- tyre drift   only groups whose name contains one of the words
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverContent } from './content.mjs';
import { COMPOUNDS, COMPOUND_KEYS, makeTireState, evaluateTire } from '../src/physics/Tire.js';
import { CollisionWorld } from '../src/physics/World.js';
import { VehiclePhysics } from '../src/physics/VehiclePhysics.js';
import { normalizeVehicle, buildPhysicsParams, buildWorkingSpec } from '../src/vehicles/VehicleSpec.js';
import { analyze, classFor } from '../src/tuning/Performance.js';
import { AITuner } from '../src/tuning/AITune.js';
import { PART_SLOTS, partLevel } from '../src/tuning/Parts.js';
import { PRESETS, GFX_KEYS } from '../src/render/Quality.js';
import { SCHEMA } from '../src/core/Settings.js';
import { Route } from '../src/maps/Route.js';
import { RaceTracker } from '../src/gameplay/RaceTracker.js';
import { DriftScorer } from '../src/gameplay/DriftScorer.js';
import { Events } from '../src/core/Events.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const groups = [];
const group = (name, fn) => groups.push({ name, fn });
let failed = 0, passed = 0;
function check(cond, msg) {
  if (cond) { passed++; return true; }
  failed++; console.log(`    FAIL ${msg}`);
  return false;
}
const DT = 1 / 240;
const flat = (surface = 'asphalt') => {
  const w = new CollisionWorld(), S = 6000;
  w.addTriangles([-S, 0, -S, S, 0, -S, S, 0, S, -S, 0, -S, S, 0, S, -S, 0, S], null, surface);
  w.finalize();
  return w;
};
const defs = [];
for (const rel of discoverContent(ROOT).vehicles) defs.push(normalizeVehicle((await import(pathToFileURL(path.join(ROOT, rel)).href)).default).def);
const byLayout = (l) => defs.find((d) => d.specs.drivetrain === l);
function car(def, parts = {}, tune = null, world = flat()) {
  const c = new VehiclePhysics(buildPhysicsParams(def, parts, tune), world);
  c.reset(0, 0, 0, 0, 0);
  for (let i = 0; i < 480; i++) c.step(DT);
  return c;
}
const run = (c, sec, ctl = {}) => { Object.assign(c.controls, ctl); for (let i = 0; i < sec / DT; i++) c.step(DT); };
/** Throttle controller to hold a speed (m/s) with a fixed steer; returns mean |latG| over the last second. */
function holdSpeed(c, v, sec, steer = 0) {
  let lat = 0, n = 0;
  // get up to speed in a straight line first (full throttle while turning spins light RWD cars, as it should)
  for (let i = 0; i < 25 / DT && c.tel.speed < v - 0.5; i++) { c.controls.steer = 0; c.controls.throttle = 1; c.step(DT); }
  for (let i = 0; i < sec / DT; i++) {
    c.controls.steer = steer;
    c.controls.throttle = Math.max(0, Math.min(1, (v - c.tel.speed) * 0.5 + 0.25));
    c.controls.brake = c.tel.speed > v + 2 ? 0.3 : 0;
    c.step(DT);
    if (i * DT > sec - 1) { lat += Math.abs(c.tel.latG); n++; }
  }
  return lat / n;
}

// ------------------------------------------------------------------ tyres
group('tyre model', () => {
  for (const k of COMPOUND_KEYS) {
    const t = makeTireState(k, 225, COMPOUNDS[k].pOpt, 4000);
    const o = {};
    let best = 0, bestK = 0;
    for (let s = 0; s <= 1.0001; s += 0.01) {
      evaluateTire(t, 4000, 20, 0, 20 * (1 + s), 0, 1, o);
      if (!check(Number.isFinite(o.fx), `${k}: fx finite at slip ${s.toFixed(2)}`)) return;
      if (o.fx > best) { best = o.fx; bestK = s; }
    }
    check(Math.abs(bestK - COMPOUNDS[k].peakSlip) < 0.05, `${k}: longitudinal peak at slip ${bestK.toFixed(2)} (spec ${COMPOUNDS[k].peakSlip})`);
    evaluateTire(t, 4000, 20, 0, 40, 0, 1, o);
    check(o.fx < best && o.fx > best * 0.55, `${k}: locked/spinning force ${o.fx.toFixed(0)} drops below peak ${best.toFixed(0)} but not to zero`);
    // combined slip: lateral force shrinks when the tyre is also driving hard
    evaluateTire(t, 4000, 20, 2, 20, 0, 1, o); const fyFree = Math.abs(o.fy);
    evaluateTire(t, 4000, 20, 2, 20 * 1.3, 0, 1, o);
    check(Math.abs(o.fy) < fyFree, `${k}: combined slip reduces lateral force`);
  }
  // load sensitivity: mu falls with load
  const t = makeTireState('street', 225, 2.2, 4000), o = {};
  evaluateTire(t, 2000, 20, 0, 22, 0, 1, o); const mu1 = o.fx / 2000;
  evaluateTire(t, 8000, 20, 0, 22, 0, 1, o); const mu2 = o.fx / 8000;
  check(mu2 < mu1, `load sensitivity: mu at 8 kN (${mu2.toFixed(2)}) < mu at 2 kN (${mu1.toFixed(2)})`);
  // standstill: no force without slip, no NaN at zero speed
  evaluateTire(t, 4000, 0, 0, 0, 0, 1, o);
  check(o.fx === 0 || Math.abs(o.fx) < 1e-6, 'no force at standstill without slip');
});

// ------------------------------------------------------------------ vehicle physics
group('physics: settle, launch, brake', () => {
  for (const def of defs) {
    const c = car(def);
    check(c.vel.length() < 0.05 && c.wheels.every((w) => w.contact), `${def.id}: settles on flat ground`);
    const y0 = c.pos.y;
    run(c, 2);
    check(Math.abs(c.pos.y - y0) < 0.005, `${def.id}: stays still (drift ${(c.pos.y - y0).toFixed(4)} m)`);
    let t = 0, t100 = null, maxYaw = 0;
    c.controls.throttle = 1;
    while (t < 30 && t100 == null) { c.step(DT); t += DT; maxYaw = Math.max(maxYaw, Math.abs(c.tel.yawRate)); if (c.tel.speed * 3.6 >= 100) t100 = t; }
    check(t100 != null && t100 > 2 && t100 < 20, `${def.id}: 0-100 in ${t100?.toFixed(1)} s`);
    check(maxYaw < 0.15, `${def.id}: straight launch stays straight (max yaw rate ${maxYaw.toFixed(3)} rad/s)`);
    const p0 = c.pos.clone();
    c.controls.throttle = 0; c.controls.brake = 1; t = 0;
    while (t < 15 && c.tel.speed > 0.3) { c.step(DT); t += DT; }
    const d = c.pos.distanceTo(p0);
    check(d > 25 && d < 60, `${def.id}: 100-0 in ${d.toFixed(1)} m`);
    check(c.gearbox.gear !== -1, `${def.id}: braking to a stop does not engage reverse while braking momentarily`);
  }
});

group('physics: start-line hold does not select reverse', () => {
  const c = car(defs[0]);
  run(c, 3, { hold: true, brake: 0, throttle: 0, clutch: 1 });
  check(c.gearbox.gear === 1, `gear ${c.gearbox.gear} after holding at the line`);
  run(c, 2, { hold: false, clutch: 0, throttle: 1 });
  check(c.tel.speed > 3, `launches after release (${(c.tel.speed * 3.6).toFixed(0)} km/h)`);
});

group('physics: auto reverse', () => {
  const c = car(defs[0]);
  run(c, 1.5, { brake: 1 });
  check(c.gearbox.gear === -1, 'holding brake at a standstill selects reverse');
  run(c, 2, { brake: 1 });
  check(c.tel.fwdSpeed < -1, `reverses (${c.tel.fwdSpeed.toFixed(1)} m/s)`);
});

group('physics: cornering and drift', () => {
  for (const def of defs) {
    const c = car(def);
    const lat = holdSpeed(c, 60 / 3.6, 8, 0.12);
    check(lat > 0.4 && lat < 1.4, `${def.id}: steady cornering ${lat.toFixed(2)} g at 60 km/h`);
    check(Number.isFinite(c.pos.x), `${def.id}: no NaN while cornering`);
  }
  const rwd = byLayout('RWD');
  if (rwd) {
    const c = car(rwd, { compound: 'drift', differential: 'drift' });
    holdSpeed(c, 70 / 3.6, 6, 0);
    let maxAngle = 0;
    for (let i = 0; i < 2.5 / DT; i++) {
      c.controls.steer = i * DT < 0.6 ? 0.5 : -0.25; c.controls.throttle = 1; c.controls.handbrake = i * DT < 0.5 ? 1 : 0;
      c.step(DT);
      maxAngle = Math.max(maxAngle, Math.abs(c.tel.driftAngle) * 180 / Math.PI);
    }
    check(maxAngle > 15, `${rwd.id}: handbrake + throttle on drift tyres slides (${maxAngle.toFixed(0)} deg)`);
  }
});

group('physics: rewind snapshot is deterministic', () => {
  const c = car(defs[0]);
  run(c, 1, { throttle: 1, steer: 0.1 });
  const snap = c.snapshot();
  run(c, 1.5, { throttle: 1, steer: -0.2 });
  const a = c.pos.clone();
  c.restore(snap);
  run(c, 1.5, { throttle: 1, steer: -0.2 });
  check(c.pos.distanceTo(a) < 1e-6, `restore + same inputs reproduces the same position (off by ${c.pos.distanceTo(a).toExponential(1)} m)`);
});

group('physics: drivetrain and tyre swaps change behaviour', () => {
  const base = defs[0];
  for (const lvl of ['FWD', 'AWD', 'RWD']) {
    if (lvl === base.specs.drivetrain) continue;
    const s = buildWorkingSpec(base, { drivetrainSwap: lvl }, null);
    check(s.drivetrain === lvl, `drivetrainSwap ${lvl} applies`);
    const c = car(base, { drivetrainSwap: lvl });
    run(c, 3, { throttle: 1 });
    check(c.tel.speed > 8, `${lvl} swap drives (${(c.tel.speed * 3.6).toFixed(0)} km/h after 3 s)`);
  }
  const slick = analyze(buildWorkingSpec(base, { compound: 'slick' }, null)), street = analyze(buildWorkingSpec(base, {}, null));
  check(slick.latG > street.latG, `slicks grip more than stock (${slick.latG.toFixed(2)} vs ${street.latG.toFixed(2)} g)`);
});

// ------------------------------------------------------------------ tuning
group('performance model', () => {
  for (const def of defs) {
    const m = analyze(buildWorkingSpec(def, {}, null));
    check(m.pi >= 100 && m.pi <= 999 && classFor(m.pi).id === m.cls.id, `${def.id}: PI ${m.pi} class ${m.cls.id}`);
    const turbo = SLOT_LEVEL('induction', 1);
    if (turbo) {
      const mt = analyze(buildWorkingSpec(def, { induction: turbo }, null));
      check(mt.pi > m.pi, `${def.id}: ${turbo} raises PI (${m.pi} -> ${mt.pi})`);
    }
  }
  for (const slot of PART_SLOTS) for (const lvl of slot.levels) {
    for (const def of defs) {
      let s;
      try { s = buildWorkingSpec(def, { [slot.id]: lvl.id }, null); } catch (e) { check(false, `${slot.id}:${lvl.id} on ${def.id} throws ${e.message}`); continue; }
      const m = analyze(s);
      if (!check(Number.isFinite(m.pi) && Number.isFinite(m.topSpeed), `${slot.id}:${lvl.id} on ${def.id} gives finite metrics`)) break;
    }
  }
});
function SLOT_LEVEL(slotId, i) { const s = PART_SLOTS.find((x) => x.id === slotId); return s?.levels[i]?.id || null; }

group('AI tune respects constraints', () => {
  const def = defs[0];
  for (const [goal, cap, budget] of [['drift', null, 400000], ['balanced', 600, 900000]]) {
    const tuner = new AITuner(def, { parts: {}, tune: null, owned: {} }, { goal, classMax: cap, budget });
    const it = tuner.run();
    let r; for (;;) { const s = it.next(); if (s.done) { r = s.value; break; } }
    check(r.cost <= budget, `${goal}: cost ${r.cost} <= budget ${budget}`);
    if (cap) check(r.metrics.pi <= cap, `${goal}: PI ${r.metrics.pi} <= class cap ${cap}`);
    check(r.metrics.pi !== r.before.pi || r.cost === 0, `${goal}: changes the car (PI ${r.before.pi} -> ${r.metrics.pi})`);
    if (goal === 'drift') check(r.metrics.drift >= r.before.drift, `drift score ${r.before.drift.toFixed(1)} -> ${r.metrics.drift.toFixed(1)}`);
  }
});

// ------------------------------------------------------------------ settings + quality
group('settings and quality presets', () => {
  for (const [name, p] of Object.entries(PRESETS)) for (const k of GFX_KEYS) check(k in p, `preset ${name} defines ${k}`);
  const keys = new Set();
  for (const s of SCHEMA) {
    check(!keys.has(s.key), `setting ${s.key} is unique`); keys.add(s.key);
    if (s.options) check(s.options.some((o) => (o.value ?? o) === s.default) || s.default == null, `setting ${s.key}: default ${JSON.stringify(s.default)} is one of its options`);
    if (s.min != null && typeof s.default === 'number') check(s.default >= s.min && s.default <= s.max, `setting ${s.key}: default within ${s.min}..${s.max}`);
  }
  for (const k of GFX_KEYS) check(keys.has('gfx.' + k), `gfx.${k} is exposed in the settings schema`);
});

// ------------------------------------------------------------------ gameplay
group('race tracker', () => {
  const pts = [];
  for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push({ x: Math.cos(a) * 200, y: 0, z: Math.sin(a) * 200, w: 12 }); }
  const route = new Route(pts, { closed: true });
  const tr = new RaceTracker(route, { laps: 2 });
  // start 20 m behind the line: ranks behind a car on the line
  const at = (s) => { const i = Math.floor(((s % route.length) + route.length) % route.length / route.length * route.n) % route.n; return [route.x[i], route.z[i], { x: route.tx[i], z: route.tz[i] }]; };
  let [x, z, h] = at(-20);
  tr.update(x, z, h, 0);
  check(tr.total < 0, `grid slot behind the line has negative progress (${tr.total.toFixed(0)})`);
  let laps = 0, time = 0;
  for (let s = -20; s < route.length * 2 + 30; s += 3) { [x, z, h] = at(s); time += 0.1; const ev = tr.update(x, z, h, time); if (ev?.lap) laps++; }
  check(laps === 2 && tr.finished, `two laps counted and finished (laps ${laps}, finished ${tr.finished})`);
  // shortcut: jumping across the circle does not count a lap
  const t2 = new RaceTracker(route, { laps: 1 });
  [x, z, h] = at(5); t2.update(x, z, h, 0);
  [x, z, h] = at(route.length - 10); t2.update(x, z, h, 1);
  [x, z, h] = at(4); const ev = t2.update(x, z, h, 2);
  check(!ev?.lap, 'cutting back across the line without checkpoints is not a lap');
});

group('drift scorer', () => {
  const ev = new Events();
  const d = new DriftScorer(ev);
  const ph = { tel: { speed: 20, driftAngle: 30 * Math.PI / 180, onGround: true, fwdSpeed: 18 }, left: { x: 1, z: 0 }, pos: { x: 0, y: 0, z: 0 }, fx: { collisions: [] } };
  for (let i = 0; i < 120; i++) d.update(1 / 60, ph, null);
  check(d.chain > 0 || d.total > 0, `points accrue while sliding (chain ${Math.round(d.chain)})`);
  ph.tel.driftAngle = 0;
  for (let i = 0; i < 240; i++) d.update(1 / 60, ph, null);
  check(d.total > 0, `chain banks after the slide ends (total ${Math.round(d.total)})`);
});

// ------------------------------------------------------------------ run
const t0 = performance.now();
for (const g of groups) {
  if (filter.length && !filter.some((f) => g.name.includes(f))) continue;
  const before = failed;
  const t = performance.now();
  try { g.fn(); } catch (e) { failed++; console.log(`    FAIL threw: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`); }
  console.log(`${failed > before ? 'FAIL' : 'ok  '} ${g.name} (${Math.round(performance.now() - t)} ms)`);
}
console.log(`\n${passed} passed, ${failed} failed in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
