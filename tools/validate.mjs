// Content validator. Normalizes and BUILDS every vehicle and map headless (Node, no browser, no GPU) and
// checks the things that otherwise only show up as a broken game: model/physics mismatch, missing head unit,
// cars falling through the spawn, routes that do not exist, budgets blown.
//   npm run validate                      everything
//   npm run validate -- --only kaze86     ids containing "kaze86"
//   npm run validate -- --strict          warnings fail too (use before committing finished content)
//   npm run validate -- --no-physics      skip the drive tests (faster)
// Exit code 1 on errors (or warnings with --strict). Output is short on purpose: agents read it.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { discoverContent } from './content.mjs';
import { normalizeVehicle, buildPhysicsParams, buildWorkingSpec } from '../src/vehicles/VehicleSpec.js';
import { Vehicle } from '../src/vehicles/Vehicle.js';
import { normalizeMap } from '../src/maps/MapDef.js';
import { loadMap, previewRoute } from '../src/maps/MapLoader.js';
import { MaterialFactory } from '../src/render/materials.js';
import { LightManager } from '../src/render/LightManager.js';
import { CollisionWorld } from '../src/physics/World.js';
import { VehiclePhysics } from '../src/physics/VehiclePhysics.js';
import { analyze } from '../src/tuning/Performance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const strict = argv.includes('--strict');
const physics = !argv.includes('--no-physics');

// budgets (see vehicles/AGENTS.md and maps/AGENTS.md)
const BUDGET = { carTris: 450000, carMeshes: 600, carTrisLod: 120000, carMeshesLod: 200, mapTris: 5000000, mapObjects: 2500 };

let errors = 0, warnings = 0;
const out = [];
const report = (id) => {
  const r = { id, err: [], warn: [], info: [] };
  out.push(r);
  return {
    err: (m) => { r.err.push(m); errors++; },
    warn: (m) => { r.warn.push(m); warnings++; },
    info: (m) => r.info.push(m),
  };
};
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
/** Broken geometry (NaN positions, zero or NaN normals) renders black or poisons the HDR post chain. */
function badGeometry(root) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, n = o.geometry.attributes.normal;
    let nan = 0, zero = 0;
    for (let i = 0; i < p.count; i++) {
      if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) nan++;
      if (n) { const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); if (!(l > 0.5)) zero++; }
    }
    if (nan || zero) { let path = [], q = o; while (q && path.length < 3) { path.push(q.name || q.type); q = q.parent; } out.push(`${path.join(' < ')}: ${nan} NaN positions, ${zero} bad normals of ${p.count}`); }
  });
  return out;
}
function countScene(root) {
  let meshes = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return { meshes, tris: Math.round(tris) };
}
// console.error inside content builders (map.build exceptions are caught and logged by the loader)
const captured = [];
const origError = console.error, origWarn = console.warn;
const capture = (on) => {
  if (on) { console.error = (...a) => captured.push(a.map(String).join(' ')); console.warn = (...a) => captured.push('warn: ' + a.map(String).join(' ')); }
  else { console.error = origError; console.warn = origWarn; }
};
const flatWorld = () => {
  const w = new CollisionWorld(), S = 5000;
  w.addTriangles([-S, 0, -S, S, 0, -S, S, 0, S, -S, 0, -S, S, 0, S, -S, 0, S], null, 'asphalt');
  w.finalize();
  return w;
};
const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

const content = discoverContent(ROOT);
const M = new MaterialFactory({ materials: 'physical', textures: 'low' });
const vehicleDefs = [];

// ---------------------------------------------------------------- vehicles
for (const rel of content.vehicles) {
  const folder = rel.split('/')[2];
  if (only && !folder.includes(only)) continue;
  const R = report(`vehicle ${folder}`);
  let raw;
  try { raw = (await import(pathToFileURL(path.join(ROOT, rel)).href)).default; } catch (e) { R.err(`import failed: ${e.message}`); continue; }
  const { def, problems } = normalizeVehicle(raw);
  if (!def) { R.err(`not a vehicle: ${problems.join(', ')}`); continue; }
  for (const p of problems) R.warn(p);
  if (def.id !== folder) R.err(`id "${def.id}" must equal the folder name "${folder}"`);
  vehicleDefs.push(def);
  if (def.placeholder) R.info('placeholder: true (prototype model)');
  // build with and without interior (AI cars and LOD use interior: false)
  for (const interior of [true, false]) {
    let v;
    captured.length = 0; capture(true);
    try { v = new Vehicle({ def, M, interior, detail: 1 }); } catch (e) { capture(false); R.err(`model.build (interior=${interior}) threw: ${e.message}`); continue; }
    capture(false);
    for (const c of captured) (c.startsWith('warn:') ? R.warn : R.err)(`build log: ${c.slice(0, 160)}`);
    const { meshes, tris } = countScene(v.root);
    for (const b of badGeometry(v.root).slice(0, 5)) R.err(`bad geometry (interior=${interior}) ${b}`);
    if (!interior) {
      R.info(`no-interior ${meshes} meshes, ${fmt(tris)} tris`);
      if (tris > BUDGET.carTrisLod) R.warn(`${fmt(tris)} tris > budget ${fmt(BUDGET.carTrisLod)} without interior (AI / distant cars)`);
      if (meshes > BUDGET.carMeshesLod) R.warn(`${meshes} meshes > budget ${BUDGET.carMeshesLod} without interior: merge static parts`);
      continue;
    }
    R.info(`${meshes} meshes, ${fmt(tris)} tris`);
    if (tris > BUDGET.carTris) R.warn(`${fmt(tris)} tris > budget ${fmt(BUDGET.carTris)} (with interior)`);
    if (meshes > BUDGET.carMeshes) R.warn(`${meshes} meshes > budget ${BUDGET.carMeshes}: merge static parts (kit.geo.merge)`);
    // model vs physics box: the visual body must match specs.dimensions or collisions look wrong
    // wheels sit at their static positions (the runtime moves them from physics every frame)
    v.wheelObjs.forEach((w, i) => { const c = v.params.wheels[i]; w.holder.position.set(c.x, c.radius, c.z); });
    v.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(v.root), size = box.getSize(new THREE.Vector3());
    const [L, W, H] = def.specs.dimensions;
    if (Math.abs(size.z - L) / L > 0.12) R.warn(`model length ${size.z.toFixed(2)} m vs specs.dimensions ${L} m`);
    if (size.x < W * 0.85 || size.x > W * 1.3) R.warn(`model width ${size.x.toFixed(2)} m vs specs.dimensions ${W} m (mirrors allowed)`);
    if (Math.abs(size.y - H) / H > 0.15) R.warn(`model height ${size.y.toFixed(2)} m vs specs.dimensions ${H} m`);
    if (Math.abs(box.min.y) > 0.08) R.warn(`lowest point at y=${box.min.y.toFixed(2)}: the origin must be on the ground (tyre contact)`);
    if (Math.abs((box.max.z + box.min.z) / 2 - def.specs.bodyOffsetZ) > 0.25) R.warn(`model centre z=${((box.max.z + box.min.z) / 2).toFixed(2)} but specs.bodyOffsetZ=${def.specs.bodyOffsetZ}: origin must be the wheelbase centre`);
    // runtime hooks the game needs
    if (!v.screen) R.warn('no head unit screen (kit.interior.headUnit): the cockpit menu falls back to a flat screen');
    if (!v.steeringObj) R.warn('no steering wheel (kit.interior.steeringWheel)');
    const lm = v.lightMats || {};
    if (!lm.head?.length) R.warn('no headlights registered (kit.ext.headlight)');
    if (!lm.brake?.length) R.warn('no brake lights registered (kit.ext.taillight)');
    if (!v.anchors?.exhaust?.length) R.warn('no exhaust anchors (kit.ext.exhaust): no backfire flames');
    const eye = v.anchors?.cockpit;
    if (!eye) R.warn('no anchors.cockpit eye position');
    else if (!box.containsPoint(new THREE.Vector3(...eye))) R.warn(`anchors.cockpit ${JSON.stringify(eye)} is outside the model`);
    else if (eye[0] < 0) R.warn('anchors.cockpit x < 0: Taiwan is left-hand drive, the driver sits at +X');
  }
  // performance model + a real drive on a flat plane
  const m = analyze(buildWorkingSpec(def, {}, null));
  R.info(`PI ${m.pi} (${m.cls.id}) top ${m.topSpeed} km/h, 0-100 ${m.t100?.toFixed(1)} s, ${m.latG.toFixed(2)} g`);
  if (!physics) continue;
  const car = new VehiclePhysics(buildPhysicsParams(def, {}, null), flatWorld());
  car.reset(0, 0, 0, 0, 0);
  for (let i = 0; i < 480; i++) car.step(1 / 240);
  if (!finite(car.pos) || car.vel.length() > 0.2 || car.wheels.some((w) => !w.contact)) { R.err(`does not settle on flat ground (pos ${car.pos.toArray().map((n) => n.toFixed(2))}, v ${car.vel.length().toFixed(2)})`); continue; }
  car.controls.throttle = 1;
  let t = 0, t100 = null;
  while (t < 40 && t100 == null) { car.step(1 / 240); t += 1 / 240; if (car.tel.speed * 3.6 >= 100) t100 = t; if (!finite(car.pos)) break; }
  if (!finite(car.pos)) { R.err('physics produced NaN under full throttle'); continue; }
  if (t100 == null) { R.err('never reaches 100 km/h'); continue; }
  car.controls.throttle = 0; car.controls.brake = 1;
  const p0 = car.pos.clone(); t = 0;
  while (t < 15 && car.tel.speed > 0.3) { car.step(1 / 240); t += 1 / 240; }
  const brake = car.pos.distanceTo(p0);
  R.info(`drive test: 0-100 ${t100.toFixed(1)} s, 100-0 ~${brake.toFixed(0)} m`);
  if (m.t100 && Math.abs(t100 - m.t100) / m.t100 > 0.4) R.warn(`physics 0-100 ${t100.toFixed(1)} s vs performance model ${m.t100.toFixed(1)} s: check torque curve / gearing / tyres`);
  if (brake > 70) R.warn(`100-0 braking ${brake.toFixed(0)} m is very long (brakes.torque?)`);
}

// ---------------------------------------------------------------- maps
const envStub = new Proxy({}, { get: () => () => {} });
for (const rel of content.maps) {
  const folder = rel.split('/')[2];
  if (only && !folder.includes(only)) continue;
  const R = report(`map ${folder}`);
  let raw;
  try { raw = (await import(pathToFileURL(path.join(ROOT, rel)).href)).default; } catch (e) { R.err(`import failed: ${e.message}`); continue; }
  const { def, problems } = normalizeMap(raw);
  if (!def) { R.err(`not a map: ${problems.join(', ')}`); continue; }
  for (const p of problems) R.warn(p);
  if (def.id !== folder) R.err(`id "${def.id}" must equal the folder name "${folder}"`);
  if (def.placeholder) R.info('placeholder: true (test map)');
  let map;
  const t0 = performance.now();
  captured.length = 0; capture(true);
  try {
    map = await loadMap(def, { M: new MaterialFactory({ materials: 'standard', textures: 'low' }), lights: new LightManager(new THREE.Scene()), env: envStub, quality: { detail: 1, vegetation: 1, textures: 'low', materials: 'standard' } });
  } catch (e) { capture(false); R.err(`loadMap threw: ${e.message}`); continue; }
  capture(false);
  for (const c of captured) (c.startsWith('warn:') ? R.warn : R.err)(`build log: ${c.slice(0, 200)}`);
  const { meshes, tris } = countScene(map.root);
  R.info(`built in ${Math.round(performance.now() - t0)} ms: ${meshes} objects, ${fmt(tris)} tris, ${map.world.statics.length} colliders, roads ${map.kit.roads.map((r) => `${r.id} ${Math.round(r.route.length)} m`).join(', ') || 'none'}`);
  if (tris > BUDGET.mapTris) R.warn(`${fmt(tris)} tris > budget ${fmt(BUDGET.mapTris)} at detail 1`);
  if (meshes > BUDGET.mapObjects) R.warn(`${meshes} objects > budget ${BUDGET.mapObjects}: use kit.addStatic / props (batched, instanced)`);
  // spawn: a car dropped there must land on something drivable
  const sp = map.spawn;
  if (![sp.x, sp.y, sp.z].every(Number.isFinite)) R.err(`spawn is not finite: ${JSON.stringify(sp)}`);
  else if (physics && vehicleDefs[0]) {
    const car = new VehiclePhysics(buildPhysicsParams(vehicleDefs[0], {}, null), map.world);
    car.reset(sp.x, sp.y, sp.z, sp.heading, 0);
    for (let i = 0; i < 480; i++) car.step(1 / 240);
    if (!finite(car.pos) || car.pos.y < sp.y - 3 || car.pos.y < map.waterLevel) R.err(`a car dropped at the spawn falls (y ${car.pos.y.toFixed(1)}): is there ground at ${sp.x}, ${sp.z}?`);
    else if (car.wheels.filter((w) => w.contact).length < 4) R.warn('car at the spawn does not have 4 wheels on the ground');
  }
  // events: routes exist and agree between the menu preview and the loaded map
  for (const e of def.events) {
    const r = map.routeFor(e);
    if (!r) { R.err(`event ${e.id}: no route (route "${typeof e.route === 'string' ? e.route : 'points'}")`); continue; }
    if (r.length < 80) R.warn(`event ${e.id}: route only ${Math.round(r.length)} m`);
    if ((e.type === 'circuit' || e.type === 'timeattack') && !r.closed) R.err(`event ${e.id}: ${e.type} needs a closed route`);
    const pv = previewRoute(def, e);
    if (!pv) R.warn(`event ${e.id}: no menu preview route (road defined inside build()?): AI tune "specific route" can't use it`);
    else if (Math.abs(pv.length - r.length) / r.length > 0.02) R.warn(`event ${e.id}: preview route ${Math.round(pv.length)} m vs loaded ${Math.round(r.length)} m`);
    const y = map.world.heightAt(r.x[0], r.z[0], r.y[0] + 5);
    if (!Number.isFinite(y) || Math.abs(y - r.y[0]) > 1.5) R.warn(`event ${e.id}: start of the route is not on drivable ground (route y ${r.y[0].toFixed(1)}, ground ${y})`);
  }
  map.dispose?.();
}

// ---------------------------------------------------------------- report
for (const r of out) {
  const tag = r.err.length ? 'FAIL' : r.warn.length ? 'warn' : ' ok ';
  console.log(`[${tag}] ${r.id}`);
  for (const m of r.info) console.log(`        ${m}`);
  for (const m of r.warn) console.log(`   warn ${m}`);
  for (const m of r.err) console.log(`  ERROR ${m}`);
}
if (!out.length) console.log(only ? `nothing matches --only ${only}` : 'no content found');
console.log(`\n${errors} error(s), ${warnings} warning(s)${strict ? ' (strict)' : ''}`);
process.exit(errors || (strict && warnings) ? 1 : 0);
