// Builds a playable map instance from a normalized definition.
import * as THREE from 'three';
import { CollisionWorld } from '../physics/World.js';
import { createMapKit } from './kit/index.js';
import { Route } from './Route.js';
import { roadRoute } from './kit/roads.js';
import { terrainHeightFn } from './kit/terrain.js';
import { makeCanvas } from '../core/canvas.js';
import { clamp } from '../core/math.js';

export class MapInstance {
  constructor(def) {
    this.def = def;
    this.root = new THREE.Group();
    this.root.name = `map:${def.id}`;
    this.world = new CollisionWorld();
    this.routes = new Map();
    this.time = 0;
  }
  /** Route for an event (built lazily, cached). */
  routeFor(event) {
    if (!this.routes.has(event.id)) this.routes.set(event.id, eventRoute(event, (id) => this.roadById(id)?.route || null, (x, z) => this.kit.groundY(x, z)));
    return this.routes.get(event.id);
  }
  roadById(id) { return this.kit.roads.find((r) => r.id === id) || null; }
  /** Nearest road sample to a point: { road, i, x, y, z, heading } (used for resets / free roam). */
  nearestRoadPoint(x, z) {
    let best = null, bd = Infinity;
    for (const r of this.kit.roads) {
      const p = r.route.project(x, z);
      if (p.dist < bd) { bd = p.dist; best = { road: r, i: p.i, x: r.route.x[p.i], y: r.route.y[p.i], z: r.route.z[p.i], heading: r.route.headingAt(p.i) }; }
    }
    return best;
  }
  update(dt, night, camera = null) {
    this.time += dt;
    for (const fn of this.kit.animated) fn(dt, this.time, camera);
    // distance culling of big instanced prop sets (forests, street furniture), a few times a second
    if (camera && this.kit.inst.culled.length && (this._cullT = (this._cullT || 0) + dt) > 0.25) {
      this._cullT = 0;
      this.kit.inst.cull(camera.position, this.kit.cullScale ?? 1);
    }
    if (Math.abs((this._night ?? -1) - night) > 0.02) {
      this._night = night;
      for (const m of this.kit.nightMaterials) {
        const [d, n] = m.userData.nightEmissive || [0, 1];
        m.emissiveIntensity = d + (n - d) * night;
      }
      if (this.kit.glowMesh) this.kit.glowMesh.material.uniforms.night.value = night;
    }
  }
  dispose() {
    this.root.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.geometry?.dispose(); } });
    this.root.parent?.remove(this.root);
  }
}

/**
 * @param def normalized map def
 * @param o { M, lights, env, quality, onProgress(p, label) }
 */
export async function loadMap(def, { M, lights, env, quality, onProgress = () => {} }) {
  const inst = new MapInstance(def);
  const step = async (p, label) => { onProgress(p, label); await new Promise((r) => setTimeout(r, 0)); };
  const kit = createMapKit({ root: inst.root, world: inst.world, M, lights, env, quality, seed: def.seed, batchChunk: def.batchChunk });
  inst.kit = kit;
  await step(0.05, 'Terrain');
  if (def.terrain) kit.terrain(def.terrain);
  await step(0.15, 'Roads');
  for (const r of def.roads) kit.road(r);
  for (const j of def.junctions) kit.junction(j);
  if (def.water) kit.water(def.water);
  await step(0.35, 'City');
  if (def.build) {
    const ctx = { THREE, kit, quality, env: def.environment, rand: kit.rand };
    try { await def.build(ctx); } catch (e) { console.error(`[map ${def.id}] build() failed`, e); }
  }
  await step(0.75, 'Batching');
  kit.finalize();
  inst.waterLevel = kit.waterLevel;
  await step(0.9, 'Minimap');
  inst.minimap = renderMinimap(inst);
  // spawn
  const sp = def.spawn;
  inst.spawn = { x: sp.pos[0], y: sp.pos[1], z: sp.pos[2], heading: (sp.heading || 0) * Math.PI / 180 };
  if (inst.spawn.y == null || isNaN(inst.spawn.y)) {
    const h = inst.world.heightAt(inst.spawn.x, inst.spawn.z, 3000);
    inst.spawn.y = isNaN(h) ? 0 : h;
  }
  await step(1, 'Ready');
  return inst;
}

/** Route for an event given a road lookup and a ground height function (reverse / start / finish applied). */
export function eventRoute(event, roadRouteById, groundY) {
  let route = null;
  if (typeof event.route === 'string') route = roadRouteById(event.route);
  else if (event.route?.points) {
    const w = event.route.width ?? 12;
    const pts = event.route.points.map((p) => (p.length === 2 ? { x: p[0], y: groundY(p[0], p[1]) + 0.05, z: p[1], w } : { x: p[0], y: p[1], z: p[2], w }));
    route = new Route(pts, { closed: !!event.route.closed, id: event.id });
  }
  if (!route) return null;
  if (event.reverse) route = route.reversed();
  if (event.type !== 'circuit' && event.type !== 'timeattack' && (event.startAt || event.finishAt != null)) route = route.slice(event.startAt || 0, event.finishAt ?? route.length);
  return route;
}

/** Event route straight from a map definition without building the map (menus, AI tune lap estimates).
 *  Only works for roads declared in def.roads; roads created inside build() need the loaded map. */
export function previewRoute(def, event) {
  const hf = def.terrain ? terrainHeightFn(def.terrain) : () => 0;
  return eventRoute(event, (id) => { const r = def.roads.find((x) => x.id === id); return r ? roadRoute(r, hf) : null; }, hf);
}

/** Top-down map image: roads, buildings, water. Returns { canvas, bounds, scale }. */
function renderMinimap(inst) {
  const b = inst.world.bounds;
  const pad = 30;
  const minX = b.minX - pad, minZ = b.minZ - pad, maxX = b.maxX + pad, maxZ = b.maxZ + pad;
  const span = Math.max(maxX - minX, maxZ - minZ);
  const N = 1024;
  const scale = N / span;
  const c = makeCanvas(N, N), g = c.getContext('2d');
  g.fillStyle = '#0d0e0f'; g.fillRect(0, 0, N, N);
  const tx = (x) => (x - minX) * scale, tz = (z) => (z - minZ) * scale;
  if (inst.waterLevel > -Infinity) { g.fillStyle = '#0f1d24'; g.fillRect(0, 0, N, N); }
  // terrain shading
  const T = inst.kit.terrainRef;
  if (T) {
    const img = g.getImageData(0, 0, N, N);
    for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
      const wx = minX + x / scale, wz = minZ + y / scale;
      const h = T.heightAt(wx, wz);
      if (h < inst.waterLevel) continue;
      const v = clamp(26 + h * 0.25, 18, 70);
      for (let k = 0; k < 4; k++) { const i = ((y + (k >> 1)) * N + x + (k & 1)) * 4; img.data[i] = v; img.data[i + 1] = v * 1.05; img.data[i + 2] = v * 0.92; img.data[i + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  } else if (inst.waterLevel > -Infinity) {
    g.fillStyle = '#1a1b1c'; g.fillRect(tx(b.minX), tz(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
  }
  // buildings / solids
  g.fillStyle = '#2b2c2e';
  for (const s of inst.world.statics) {
    if (s.kind !== 'building' && s.kind !== 'container') continue;
    g.save(); g.translate(tx(s.x), tz(s.z)); g.rotate(Math.atan2(s.sin, s.cos));
    if (s.type === 0) g.fillRect(-s.hx * scale, -s.hz * scale, s.hx * 2 * scale, s.hz * 2 * scale);
    else { g.beginPath(); g.arc(0, 0, s.r * scale, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // roads
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of inst.kit.roads) {
    const R = r.route;
    g.strokeStyle = pass ? '#8c8579' : '#3c3a36';
    g.lineWidth = Math.max(2, (R.half[0] * 2 + (pass ? 0 : 3)) * scale);
    g.beginPath();
    for (let i = 0; i < R.n; i++) { const X = tx(R.x[i]), Z = tz(R.z[i]); if (i) g.lineTo(X, Z); else g.moveTo(X, Z); }
    if (R.closed) g.closePath();
    g.stroke();
  }
  return { canvas: c, minX, minZ, scale, size: N };
}
