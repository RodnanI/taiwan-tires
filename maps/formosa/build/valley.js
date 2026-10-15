// The paddy valley: a patchwork of flooded, green and golden rice fields on little terraces, farmsteads
// (red-brick courtyard houses and rows of tiled townhouses with iron sheds on top) among betel palms and
// bananas, earth god shrines at the field corners, Dongshan creek with water in it, the village temple at
// Wujie and power lines along the highway.
import * as THREE from 'three';
import { Builder, lin, mulC } from './geom.js';
import { tileUV } from './atlas.js';
import { streetWall } from './streetwall.js';
import { templeHall, incenseBurner, palaceRoof } from './temple.js';
import { makeCanvas } from '../../../src/core/canvas.js';
import { canvasTexture } from '../../../src/render/textures.js';
import { valueNoise } from '../../../src/core/math.js';
import { VALLEY, CREEK } from '../geo.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const PALMS = [0x6f9a4a, 0x7aa556, 0x86ac5a];

export function buildValley(kit, shared, r) {
  creek(kit, shared);
  wujieTemple(kit, shared, r);
  powerLines(kit, shared, r);
  paddies(kit, shared, r);
  shared.city.wallB.flush();
}

/** Rows of young rice over water: the texture of a spring paddy. */
function riceTexture() {
  const n = 128, c = makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = '#3d5658'; g.fillRect(0, 0, n, n);
  for (let y = 1; y < n; y += 8) for (let x = 0; x < n; x += 4) {
    const h = 4 + ((x * 7 + y * 3) % 4);
    g.fillStyle = (x + y) % 3 ? '#d6f08a' : '#bfe26e';
    g.fillRect(x, y, 3, h);
  }
  return canvasTexture(c, { repeat: true });
}

function paddies(kit, shared, r) {
  const M = kit.M, mask = shared.mask, T = kit.terrainRef;
  const water = M.shared('paddyWater', () => M.surface({ color: 0xffffff, vertexColors: true, roughness: 0.04, metalness: 0.35, envMapIntensity: 1.25 }));
  const rice = M.shared('paddyRice', () => M.surface({ map: riceTexture(), vertexColors: true, roughness: 0.75 }));
  const BW = new Builder(kit, water, { cast: false }), BR = new Builder(kit, rice, { cast: false });
  const wet = [], dry = [];
  const W = 34, D = 22, gapW = 1.6;
  let farms = 0;
  for (let z = VALLEY.z0 + 40; z < VALLEY.z1 - 40; z += D + gapW) for (let x = VALLEY.x0 + 30; x < VALLEY.x1 - 30; x += W + gapW) {
    const x0 = x, x1 = x + W, z0 = z, z1 = z + D;
    // corners checked a little inside the field (the mask's 4 m cells round outwards)
    const corners = [[x0 + 2.5, z0 + 2.5], [x1 - 2.5, z0 + 2.5], [x1 - 2.5, z1 - 2.5], [x0 + 2.5, z1 - 2.5], [(x0 + x1) / 2, (z0 + z1) / 2]];
    if (!corners.every(([px, pz]) => mask.free(px, pz)) || !mask.free(x0 + 2.5, (z0 + z1) / 2) || !mask.free(x1 - 2.5, (z0 + z1) / 2)) continue;
    const hs = corners.map(([px, pz]) => kit.groundY(px, pz));
    const lo = Math.min(...hs), hi = Math.max(...hs);
    if (hi - lo > 3 || lo < 2) continue;
    // a farmstead now and then instead of a field
    if (r() < 0.045 && farms < 70) { farmstead(kit, shared, r, (x0 + x1) / 2, (z0 + z1) / 2, hs.reduce((a, b) => a + b) / 5); farms++; continue; }
    const y = hs.reduce((a, b) => a + b) / 5 + 0.05;
    T.flatten([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, 1.4);
    mask.rect(x0 + 1, z0 + 1, x1 - 1, z1 - 1);
    const n = valueNoise(x * 0.004 + 3.1, z * 0.004 - 1.7), k = r() * 0.08;
    const top = (B, c) => B.quad([x0, y + 0.03, z1], [x1, y + 0.03, z1], [x1, y + 0.03, z0], [x0, y + 0.03, z0], [x0 / 4, z0 / 4, x1 / 4, z1 / 4], c);
    if (n < 0.36) { top(BW, lin(r() < 0.5 ? 0x6f8f9a : 0x7a9aa0)); wet.push([x0, z0, x1, z1, y]); }              // flooded, just planted
    else if (n < 0.7) { top(BR, mulC([0.82, 1, 0.62], 0.9 + k)); wet.push([x0, z0, x1, z1, y]); }       // young rice
    else if (n < 0.86) { top(BR, mulC([1.0, 0.78, 0.25], 0.9 + k)); dry.push([x0, z0, x1, z1, y]); }       // ripe, golden
    else { top(BR, mulC([0.5, 0.38, 0.26], 0.9 + k)); dry.push([x0, z0, x1, z1, y]); }                     // harvested stubble
    // an earth god shrine at some field corners
    if (r() < 0.02) kit.props.place('shrine', [x0 - 0.6, kit.groundY(x0 - 0.6, z0 - 0.6), z0 - 0.6], r() * 6);
  }
  BW.flush(); BR.flush();
  // physics: flooded and young fields splash, the rest is mud
  const collide = (list, surface) => {
    if (!list.length) return;
    const pos = [];
    for (const [x0, z0, x1, z1, y] of list) pos.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    kit.collision.triangles(g, surface);
  };
  collide(wet, 'puddle'); collide(dry, 'dirt');
}

/** Red-brick courtyard house (sanheyuan) or a row of tiled townhouses, with palms and bananas round it. */
function farmstead(kit, shared, r, cx, cz, gy) {
  const B = shared.city.wallB, mask = shared.mask;
  const y = gy + 0.1, face = pick(r, [0, Math.PI / 2, Math.PI, -Math.PI / 2]) + (r() - 0.5) * 0.2;
  kit.pad({ poly: [[cx - 18, cz - 12], [cx + 18, cz - 12], [cx + 18, cz + 12], [cx - 18, cz + 12]], y, surface: 'concrete', blend: 3 });
  mask.rect(cx - 20, cz - 14, cx + 20, cz + 14);
  const c = Math.cos(face), s = Math.sin(face), P = (u, v) => [cx + u * c + v * s, cz - u * s + v * c];
  if (r() < 0.55) {
    // three wings round a courtyard that opens to the front
    const brick = lin(0xb9654a), tile = tileUV('brick');
    const wing = (u, v, hu, hv, h, rot) => {
      const [x, z] = P(u, v), t = [Math.cos(face + rot), -Math.sin(face + rot)];
      B.box(x, z, t, [t[1], -t[0]], hu, hv, y, y + h, tile, null, brick);
      palaceRoof(B, { x, z, y: y + h, face: face + rot, hw: hu + 0.9, hd: hv + 0.9, rise: hv * 0.55, roof: 'orange', ridge: false });
      kit.collision.box({ x, z, hx: hu, hz: hv, rotY: face + rot, y0: y - 1, y1: y + h + 2, kind: 'building' });
    };
    wing(0, -6, 9, 3.4, 3.6, 0);
    wing(-9.5, 1, 6, 3, 3.2, Math.PI / 2);
    wing(9.5, 1, 6, 3, 3.2, Math.PI / 2);
  } else {
    // townhouses side by side, facing the front
    const [ax, az] = P(-14, -2), [bx, bz] = P(14, -2);
    streetWall(shared.city.ctx, { a: [ax, az], b: [bx, bz], n: [-Math.sin(face), -Math.cos(face)], style: 'farm', y, depth: 12 });
  }
  // trees round the yard: betel palms in rows behind, bananas and a shade tree at the sides
  for (let k = 0; k < 9; k++) { const [x, z] = P(-16 + k * 4, -15.5 - (k % 2)); kit.props.place('betelPalm', [x, kit.groundY(x, z), z], r() * 6, 0.85 + r() * 0.3, pick(r, PALMS)); }
  for (let k = 0; k < 5; k++) { const [x, z] = P(r() < 0.5 ? -19 : 19, -8 + k * 4); kit.props.place('banana', [x, kit.groundY(x, z), z], r() * 6, 0.9 + r() * 0.3, pick(r, PALMS)); }
  if (r() < 0.6) { const [x, z] = P(13, 9); kit.props.place('parkedCar', [x, y, z], face + Math.PI / 2, 1, pick(r, [0xe8e8e4, 0x9aa1a6, 0x2c4f7e, 0xb02a24])); }
  { const [x, z] = P(-12, 9); kit.props.place('scooter', [x, y, z], face + 0.4, 1, pick(r, [0x2b2d30, 0xd8d8d0, 0xb0262a])); }
}

/** Water in Dongshan creek, except under the roads that bridge it (the rally fords it, and splashes). */
function creek(kit, shared) {
  const M = kit.M;
  const near = (q) => { const R = q.route; for (let i = 0; i < R.n; i += 8) if (R.x[i] > 1100 && R.x[i] < 2420 && R.z[i] > 900 && R.z[i] < 1100) return true; return false; };
  const roads = kit.roads.filter((q) => q.id !== 'paddy-rally' && near(q));
  const pts = [];
  for (let k = 0; k < CREEK.pts.length - 1; k++) {
    const [ax, az] = CREEK.pts[k], [bx, bz] = CREEK.pts[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
    for (let j = 0; j < n; j++) pts.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]);
  }
  const bridged = (x, z) => roads.some((q) => { const p = q.route.project(x, z); return p.dist < p.half + q.shoulder + 4; });
  const mat = M.shared('creekWater', () => M.surface({ color: 0x3e5a52, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.1 }));
  let run = [];
  const flush = () => {
    if (run.length < 2) { run = []; return; }
    const pos = [], idx = [];
    run.forEach(([x, z, y, nx, nz], i) => { pos.push(x + nx * 3.4, y, z + nz * 3.4, x - nx * 3.4, y, z - nz * 3.4); if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
    kit.addStatic(g, mat, { cast: false });
    kit.collision.triangles(g, 'puddle');
    run = [];
  };
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], [px, pz] = pts[Math.max(0, i - 1)], [qx, qz] = pts[Math.min(pts.length - 1, i + 1)];
    const tx = qx - px, tz = qz - pz, l = Math.hypot(tx, tz) || 1;
    if (bridged(x, z)) { flush(); continue; }
    run.push([x, z, kit.groundY(x, z) + 0.6, -tz / l, tx / l]);
    shared.mask.circle(x, z, 6);
  }
  flush();
}

/** The village temple at Wujie, facing the highway across a small square. */
function wujieTemple(kit, shared, r) {
  const ring = kit.roads.find((q) => q.id === 'formosa-ring');
  const R = ring.route, s = 10300, i = R.indexAt(s), lat = -(R.half[i] + ring.shoulder + 30);
  const p = R.pointAt(s, lat), face = R.headingAt(i) + Math.PI / 2;
  const y = R.y[i];
  const toRoad = [Math.sin(face), Math.cos(face)];
  kit.pad({ poly: [[-26, -16], [26, -16], [26, 28], [-26, 28]].map(([u, v]) => [p.x + u * Math.cos(face) + v * toRoad[0], p.z - u * Math.sin(face) + v * toRoad[1]]), y, surface: 'concrete', blend: 4 });
  templeHall(kit, shared.city.wallB, { x: p.x, z: p.z, y, face, w: 20, d: 14, h: 5, tiers: 2, roof: 'orange' });
  incenseBurner(kit, p.x + toRoad[0] * 14, p.z + toRoad[1] * 14, y, 1.1);
  shared.mask.circle(p.x + toRoad[0] * 6, p.z + toRoad[1] * 6, 30);
  for (let k = -2; k <= 2; k++) {
    const x = p.x + toRoad[0] * 22 + Math.cos(face) * k * 7, z = p.z + toRoad[1] * 22 - Math.sin(face) * k * 7;
    kit.props.place('lantern', [x, y + 3.6, z], face, 1.3, null, { collide: false });
  }
}

/** Wooden power poles down the east side of the valley highway, two wires between them. */
function powerLines(kit, shared, r) {
  const ring = kit.roads.find((q) => q.id === 'formosa-ring');
  const R = ring.route, wire = kit.M.shared('wire', () => kit.M.surface({ color: 0x1a1a1a, roughness: 0.6 }));
  const geos = [];
  for (const [a, b] of [[9060, 9900], [10600, 11500]]) {
    let prev = null;
    for (let s = a; s <= b; s += 42) {
      const i = R.indexAt(s), p = R.pointAt(s, R.half[i] + ring.shoulder + 3.5), gy = kit.groundY(p.x, p.z);
      if (!shared.mask.free(p.x, p.z)) { prev = null; continue; }
      const h = R.headingAt(i);
      kit.props.place('powerPole', [p.x, gy, p.z], h + Math.PI / 2, 1);
      const top = [p.x, gy + 9.3, p.z];
      if (prev) for (const off of [-0.95, 0.95]) {
        const ax = prev[0] + Math.cos(prev[3]) * off, az = prev[2] - Math.sin(prev[3]) * off, bx = top[0] + Math.cos(h + Math.PI / 2) * off, bz = top[2] - Math.sin(h + Math.PI / 2) * off;
        const v = new THREE.Vector3(bx - ax, top[1] - prev[1], bz - az), len = v.length();
        const g = new THREE.BoxGeometry(0.035, 0.035, len);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.normalize()));
        g.translate((ax + bx) / 2, (prev[1] + top[1]) / 2 - 0.25, (az + bz) / 2);
        geos.push(g);
      }
      prev = [...top, h + Math.PI / 2];
      shared.mask.circle(p.x, p.z, 1.5);
    }
  }
  if (geos.length) kit.addStatic(kit.merge(geos), wire, { cast: false });
}
