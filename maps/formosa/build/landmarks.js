// The landmark blocks of the Taipei basin and its edges: the Xinyi supertall and its mall, the Longshan
// temple precinct facing Heping Road, Da'an forest park, the university with its palm boulevard, the night
// market under the elevated and the Grand Hotel on the hill above Civic Boulevard.
import * as THREE from 'three';
import { tileUV } from './atlas.js';
import { Builder, lin, mulC } from './geom.js';
import { slab, treeTint } from './city.js';
import { streetWall } from './streetwall.js';
import { templeHall, templeGate, incenseBurner, palaceRoof } from './temple.js';
import { CITY_Y } from '../geo.js';
import { EW, NS, LEVEE_X, HEPING_Z, ELEVATED_Z } from '../city-plan.js';

const Y = CITY_Y, SIDEWALK = 3.2;
const pick = (r, a) => a[Math.floor(r() * a.length)];

/** Inner extents of the city block containing (cx, cz): the kerb lines of the four streets round it. */
function blockAt(cx, cz) {
  const xs = [{ x: LEVEE_X, w: 12 }, ...NS.map((a) => ({ x: a.x, w: a.w }))].sort((a, b) => a.x - b.x);
  const zs = [...EW.map((a) => ({ z: a.z, w: a.w })), { z: HEPING_Z, w: 12 }].sort((a, b) => a.z - b.z);
  const i = xs.findIndex((a, k) => k < xs.length - 1 && a.x < cx && xs[k + 1].x > cx), j = zs.findIndex((a, k) => k < zs.length - 1 && a.z < cz && zs[k + 1].z > cz);
  return { X0: xs[i].x + xs[i].w / 2 + SIDEWALK, X1: xs[i + 1].x - xs[i + 1].w / 2 - SIDEWALK, Z0: zs[j].z + zs[j].w / 2 + SIDEWALK, Z1: zs[j + 1].z - zs[j + 1].w / 2 - SIDEWALK };
}
function distToLine(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return d;
}
const rectPoly = (b, pad = 0) => [[b.X0 + pad, b.Z0 + pad], [b.X1 - pad, b.Z0 + pad], [b.X1 - pad, b.Z1 - pad], [b.X0 + pad, b.Z1 - pad]];

/** Ribbon of quads along a polyline (paths, the palm boulevard), laid flat just above the ground. */
function strip(kit, pts, width, y, material) {
  const pos = [], uv = [], idx = [];
  let d = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0] + nx * width / 2, y, pts[i][1] + nz * width / 2, pts[i][0] - nx * width / 2, y, pts[i][1] - nz * width / 2);
    uv.push(0, d / 8, width / 8, d / 8);
    if (i) { const v = i * 2; idx.push(v - 2, v, v - 1, v - 1, v, v + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure it faces up whichever way the polyline runs
  if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
  kit.addStatic(g, material, { cast: false });
  return g;
}

export function buildLandmarks(kit, shared, r) {
  xinyiTower(kit, shared, r);
  longshan(kit, shared, r);
  daan(kit, shared, r);
  campus(kit, shared, r);
  nightMarket(kit, shared, r);
  grandHotel(kit, shared, r);
  shared.city.wallB.flush();
}

// ------------------------------------------------------------------------------------------- Xinyi tower
// Eight flared segments stacked on a tapering base, a crown and a spire: the stacked-pagoda supertall.
function xinyiTower(kit, shared, r) {
  const b = blockAt(380, 1570), B = shared.city.wallB, mask = shared.mask;
  kit.pad({ poly: rectPoly(b), y: Y + 0.02, surface: 'concrete', blend: 0.5 });
  const cx = 470, cz = 1596;
  const glass = lin(0x8fb6ad), ledge = lin(0x6f7d7a);
  const rot = (p, k) => { let [x, y, z] = p; for (let i = 0; i < k; i++) [x, z] = [z, -x]; return [cx + x, Y + y, cz + z]; };
  const section = (y0, y1, hb, ht, bays) => {
    const floors = Math.max(1, Math.round((y1 - y0) / 4));
    for (let k = 0; k < 4; k++) for (let f = 0; f < floors; f++) {
      const ya = y0 + ((y1 - y0) * f) / floors, yb = y0 + ((y1 - y0) * (f + 1)) / floors;
      const ha = hb + ((ht - hb) * f) / floors, hc = hb + ((ht - hb) * (f + 1)) / floors;
      for (let q = 0; q < bays; q++) {
        const ua = -1 + (2 * q) / bays, ub = -1 + (2 * (q + 1)) / bays;
        const tile = r() < 0.28 ? 'curtainLit' : 'curtain';
        B.quad(rot([ua * ha, ya, ha], k), rot([ub * ha, ya, ha], k), rot([ub * hc, yb, hc], k), rot([ua * hc, yb, hc], k), tileUV(tile), glass);
      }
    }
  };
  // flat ring between two sections (the ledge where a flared segment overhangs the next)
  const ring = (y, hIn, hOut) => {
    for (let k = 0; k < 4; k++) B.quad(rot([-hOut, y, hOut], k), rot([hOut, y, hOut], k), rot([hIn, y, hIn], k), rot([-hIn, y, hIn], k), tileUV('plain'), ledge);
  };
  section(0, 60, 27, 22.5, 12);
  ring(60, 19, 22.5);
  const segH = 31, bands = [];
  for (let s = 0; s < 8; s++) {
    const y0 = 60 + s * segH;
    section(y0, y0 + segH, 19, 24, 10);
    ring(y0 + segH, s < 7 ? 19 : 15, 24);
    bands.push(y0 + segH);
  }
  const top = 60 + 8 * segH;
  section(top, top + 18, 15, 13.5, 6); ring(top + 18, 9, 13.5);
  section(top + 18, top + 28, 9, 7.5, 4); ring(top + 28, 0.01, 7.5);
  // night bands under every ledge, the spire and its beacon
  const M = kit.M;
  const bandMat = M.shared('towerBand', () => { const m = M.surface({ color: 0x3a3020, emissive: 0xffd58a, emissiveIntensity: 0.05, roughness: 0.4 }); m.userData.nightEmissive = [0.05, 3.2]; kit.nightMaterials.push(m); return m; });
  const geos = [];
  for (const y of bands) for (let k = 0; k < 4; k++) { const g = new THREE.BoxGeometry(48.4, 0.5, 0.3); g.translate(0, y - 0.45, 24.1); g.rotateY((k * Math.PI) / 2); g.translate(cx, Y, cz); geos.push(g); }
  kit.addStatic(kit.merge(geos), bandMat, { cast: false });
  kit.mesh(new THREE.CylinderGeometry(0.5, 2.4, 62, 8), M.metal(0xc8c8c8, 0.3), { pos: [cx, Y + top + 28 + 31, cz] });
  const red = M.shared('aviationRed', () => { const m = M.surface({ color: 0x400806, emissive: 0xff2a1a, emissiveIntensity: 0.2 }); m.userData.nightEmissive = [0.2, 9]; kit.nightMaterials.push(m); return m; });
  kit.mesh(new THREE.SphereGeometry(0.9, 8, 6), red, { pos: [cx, Y + top + 28 + 62.5, cz], cast: false });
  kit.collision.box({ x: cx, z: cz, hx: 27, hz: 27, y0: Y - 2, y1: Y + top + 30, kind: 'building' });
  // the mall on its west side, a lower annex north, a plaza with trees round the rest
  slab(B, kit, 352, cz, 150, 92, 6, r, 'grid', 'roof', lin(0xc9cdd0));
  slab(B, kit, 352, 1478, 120, 40, 4, r, 'band', 'roof', lin(0xd4cfc6));
  const hs = kit.hsigns;
  for (const [x, z, rotY, text] of [[352, cz + 46.3, Math.PI / 2, '信義購物中心'], [352, cz - 46.3, Math.PI / 2, '百貨公司'], [276.7, cz, 0, '影城']]) {
    const g = hs.geometry(hs.slot(text, 4), 16, 3.2, 0.3); g.rotateY(rotY); g.translate(x, Y + 15.5, z);
    kit.addStatic(g, hs.material, { cast: false, receive: false });
  }
  mask.rect(b.X0, b.Z0, b.X1, b.Z1);
  for (let k = 0; k < 90; k++) {
    const x = b.X0 + 4 + r() * (b.X1 - b.X0 - 8), z = b.Z0 + 4 + r() * (b.Z1 - b.Z0 - 8);
    if ((x > 272 && x < 432 && z > cz - 50 && z < cz + 50) || (x > 288 && x < 416 && z > 1454 && z < 1502) || Math.hypot(x - cx, z - cz) < 40) continue;
    kit.props.place('broadleaf', [x, Y, z], r() * 6, 0.8 + r() * 0.4, treeTint(r));
  }
  for (let k = 0; k < 8; k++) kit.props.streetLamp([cx - 36 + k * 11, Y, cz + 44], 0, { height: 7, arm: 0.8, intensity: 70, range: 22 });
}

// ------------------------------------------------------------------------------------------- Longshan temple
function longshan(kit, shared, r) {
  const b = blockAt(-1300, 1870), B = shared.city.wallB, ctx = shared.city.ctx, mask = shared.mask;
  const D = 16, mid = (b.X0 + b.X1) / 2;
  // shophouses round the block, open to Heping Road in front of the temple
  const gap = [mid - 40 - b.X0, mid + 40 - b.X0], PW = 46;
  streetWall(ctx, { a: [b.X0, b.Z0], b: [b.X1, b.Z0], n: [0, 1], style: 'old', y: Y, depth: D, qilou: true });
  streetWall(ctx, { a: [b.X0, b.Z1], b: [b.X1, b.Z1], n: [0, -1], style: 'old', y: Y, depth: D, qilou: true, gaps: [gap] });
  streetWall(ctx, { a: [b.X0, b.Z0 + D], b: [b.X0, b.Z1 - D], n: [1, 0], style: 'old', y: Y, depth: D });
  streetWall(ctx, { a: [b.X1, b.Z0 + D], b: [b.X1, b.Z1 - D], n: [-1, 0], style: 'old', y: Y, depth: D });
  // the precinct: rows of old shops facing in from both sides
  streetWall(ctx, { a: [mid - PW, b.Z0 + D + 6], b: [mid - PW, b.Z1 - D - 4], n: [-1, 0], style: 'old', y: Y, depth: 14, floors: [2, 3], qilou: true });
  streetWall(ctx, { a: [mid + PW, b.Z0 + D + 6], b: [mid + PW, b.Z1 - D - 4], n: [1, 0], style: 'old', y: Y, depth: 14, floors: [2, 3], qilou: true });
  // the rest of the block behind them: lanes of old shophouses
  for (const side of [-1, 1]) {
    const xa = mid + side * (PW + 14), xb = side < 0 ? b.X0 + D : b.X1 - D, xm = (xa + xb) / 2;
    streetWall(ctx, { a: [xm, b.Z0 + D + 4], b: [xm, b.Z1 - D - 4], n: [side, 0], style: 'old', y: Y, depth: Math.abs(xb - xm) - 1, floors: [2, 4] });
    streetWall(ctx, { a: [xm - side * 4, b.Z0 + D + 4], b: [xm - side * 4, b.Z1 - D - 4], n: [-side, 0], style: 'old', y: Y, depth: Math.abs(xm - xa) - 5, floors: [2, 3] });
  }
  const B2 = new Builder(kit, shared.city.atlas.mat, { cast: false });
  const pv = [[mid - PW + 1, b.Z0 + D + 2], [mid + PW - 1, b.Z0 + D + 2], [mid + PW - 1, b.Z1 + 0.5], [mid - PW + 1, b.Z1 + 0.5]];
  kit.pad({ poly: pv, y: Y + 0.03, surface: 'concrete', blend: 0.5 });
  for (let x = pv[0][0]; x < pv[1][0] - 0.1; x += 8) for (let z = pv[0][1]; z < pv[2][1] - 0.1; z += 8) {
    const x2 = Math.min(x + 8, pv[1][0]), z2 = Math.min(z + 8, pv[2][1]);
    B2.quad([x, Y + 0.07, z2], [x2, Y + 0.07, z2], [x2, Y + 0.07, z], [x, Y + 0.07, z], tileUV('paving'), lin(0xd8d0c0));
  }
  B2.flush();
  mask.rect(mid - PW, b.Z0, mid + PW, b.Z1);
  // halls: front hall, main hall (double eaves), rear hall, the side corridors, bell and drum towers
  const zF = b.Z1 - 62;
  templeHall(kit, B, { x: mid, z: zF, y: Y, face: 0, w: 34, d: 13, h: 5.6, roof: 'orange' });
  templeHall(kit, B, { x: mid, z: zF - 46, y: Y, face: 0, w: 22, d: 18, h: 6, tiers: 2, roof: 'gold' });
  templeHall(kit, B, { x: mid, z: zF - 92, y: Y, face: 0, w: 46, d: 13, h: 5.4, roof: 'orange' });
  templeHall(kit, B, { x: mid - 29, z: zF - 46, y: Y, face: Math.PI / 2, w: 74, d: 8, h: 4.6, roof: 'orange', lanterns: true });
  templeHall(kit, B, { x: mid + 29, z: zF - 46, y: Y, face: -Math.PI / 2, w: 74, d: 8, h: 4.6, roof: 'orange', lanterns: true });
  templeHall(kit, B, { x: mid - 20, z: zF - 18, y: Y, face: 0, w: 7, d: 7, h: 5, tiers: 2, roof: 'green', lanterns: false });
  templeHall(kit, B, { x: mid + 20, z: zF - 18, y: Y, face: 0, w: 7, d: 7, h: 5, tiers: 2, roof: 'green', lanterns: false });
  // the gate on Heping Road, the burner in the forecourt, lantern strings across it
  templeGate(kit, B, { x: mid, z: b.Z1 - 3, y: Y, face: 0, w: 16, h: 8, name: '龍山寺', palette: 0 });
  incenseBurner(kit, mid, zF + 22, Y, 1.4);
  for (const z of [zF + 14, zF + 24, zF + 34, zF + 44]) {
    for (const x of [mid - 26, mid + 26]) { kit.props.place('lampPole', [x, Y, z], 0, [1.2, 6, 1.2]); kit.collision.cylinder({ x, z, r: 0.2, y0: Y - 1, y1: Y + 6, kind: 'pole' }); }
    for (let x = mid - 25; x <= mid + 25; x += 1.7) kit.props.place('lantern', [x, Y + 5.2 - 0.6 * Math.cos(((x - mid) / 26) * Math.PI * 0.5), z], 0, 1, null, { collide: false });
  }
  // banyans down both sides of the forecourt, temple-fair stalls under them
  for (let z = zF + 12; z < b.Z1 - 8; z += 11) for (const sx of [-1, 1]) {
    kit.props.place('banyan', [mid + sx * 36, Y, z], r() * 6, 0.9 + r() * 0.3, treeTint(r));
    kit.props.place('stall', [mid + sx * 40.5, Y, z + 5], sx > 0 ? -Math.PI / 2 : Math.PI / 2, 1, pick(r, [0xd84a3a, 0xe8c24a, 0xf2f0ea]));
  }
  for (const sx of [-1, 1]) kit.props.place('banyan', [mid + sx * 38, Y, zF - 100], r() * 6, 1.1, treeTint(r));
  kit.light({ pos: [mid, Y + 7, zF + 30], color: 0xff8a4a, intensity: 110, range: 40, nightOnly: true });
  kit.light({ pos: [mid, Y + 7, zF - 30], color: 0xff8a4a, intensity: 90, range: 34, nightOnly: true });
}

// ------------------------------------------------------------------------------------------- Da'an park
function daan(kit, shared, r) {
  const b = blockAt(-330, 1870), mask = shared.mask, M = kit.M;
  kit.pad({ poly: rectPoly(b), y: Y + 0.02, surface: 'grass', blend: 0.5, material: M.textured('grass', { repeat: 1 }) });
  mask.rect(b.X0, b.Z0, b.X1, b.Z1);
  const pave = kit.roadMats.concrete(), y = Y + 0.07;
  // a loop path, two diagonals and a ring round the pond
  const inset = 16, loop = [];
  const L = [b.X0 + inset, b.Z0 + inset, b.X1 - inset, b.Z1 - inset];
  for (let k = 0; k <= 64; k++) {
    const t = k / 64, a = t * Math.PI * 2, cxp = (L[0] + L[2]) / 2, czp = (L[1] + L[3]) / 2, rx = (L[2] - L[0]) / 2, rz = (L[3] - L[1]) / 2;
    // superellipse: a rounded rectangle
    const c = Math.cos(a), s = Math.sin(a);
    loop.push([cxp + rx * Math.sign(c) * Math.abs(c) ** 0.25, czp + rz * Math.sign(s) * Math.abs(s) ** 0.25]);
  }
  strip(kit, loop, 4, y, pave);
  strip(kit, [[b.X0 + 2, b.Z0 + 2], [b.X1 - 2, b.Z1 - 2]], 3.5, y + 0.01, pave);
  strip(kit, [[b.X1 - 2, b.Z0 + 2], [b.X0 + 2, b.Z1 - 2]], 3.5, y + 0.01, pave);
  const pond = { x: b.X0 + (b.X1 - b.X0) * 0.3, z: b.Z0 + (b.Z1 - b.Z0) * 0.62, rx: 48, rz: 28 };
  const ring = [];
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; ring.push([pond.x + Math.cos(a) * (pond.rx + 5), pond.z + Math.sin(a) * (pond.rz + 5)]); }
  strip(kit, ring, 3, y + 0.02, pave);
  const water = new THREE.CircleGeometry(1, 40); water.rotateX(-Math.PI / 2); water.scale(pond.rx, 1, pond.rz); water.translate(pond.x, Y + 0.12, pond.z);
  kit.addStatic(water, M.shared('pond', () => M.surface({ color: 0x24443c, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.1 })), { cast: false });
  kit.collision.triangles(water, 'puddle');
  // trees everywhere off the paths and the pond: banyans, broadleaf, palms along the loop
  const onPath = (x, z) => distToLine(loop, x, z) < 5 || Math.hypot((x - pond.x) / (pond.rx + 9), (z - pond.z) / (pond.rz + 9)) < 1
    || distToLine([[b.X0, b.Z0], [b.X1, b.Z1]], x, z) < 4.5 || distToLine([[b.X1, b.Z0], [b.X0, b.Z1]], x, z) < 4.5;
  let n = 0;
  for (let k = 0; k < 2400 && n < 520; k++) {
    const x = b.X0 + 3 + r() * (b.X1 - b.X0 - 6), z = b.Z0 + 3 + r() * (b.Z1 - b.Z0 - 6);
    if (onPath(x, z)) continue;
    const kind = r() < 0.12 ? 'banyan' : 'broadleaf';
    kit.props.place(kind, [x, Y, z], r() * 6, kind === 'banyan' ? 0.8 + r() * 0.5 : 0.9 + r() * 0.6, treeTint(r));
    n++;
  }
  // palms just outside the loop, lamps and benches just inside it
  const lc = [(L[0] + L[2]) / 2, (L[1] + L[3]) / 2];
  const off = (p, d) => { const dx = p[0] - lc[0], dz = p[1] - lc[1], l = Math.hypot(dx, dz) || 1; return [p[0] + (dx / l) * d, p[1] + (dz / l) * d, Math.atan2(-dx, -dz)]; };
  for (let k = 0; k < loop.length - 1; k += 2) { const [x, z] = off(loop[k], 3.6); kit.props.place('palm', [x, Y, z], r() * 6, 1.1 + r() * 0.3); }
  for (let k = 1; k < loop.length - 1; k += 4) { const [x, z, h] = off(loop[k], -2.8); kit.props.streetLamp([x, Y, z], h + Math.PI, { height: 5.5, arm: 0.6, intensity: 60, range: 20, color: 0xfff1d8 }); }
  for (let k = 3; k < loop.length - 1; k += 4) { const [x, z, h] = off(loop[k], -3); kit.props.place('bench', [x, Y, z], h); }
  // the open-air stage: a white shell on the pond's far shore
  const shell = new THREE.SphereGeometry(14, 16, 8, 0, Math.PI, 0, Math.PI / 2); shell.scale(1, 0.7, 1);
  shell.rotateY(-Math.PI / 2); shell.translate(pond.x + pond.rx + 26, Y, pond.z);
  kit.addStatic(shell, M.shared('stageShell', () => M.surface({ color: 0xeeeae2, roughness: 0.5, side: THREE.DoubleSide })), { cast: true });
  kit.collision.box({ x: pond.x + pond.rx + 26, z: pond.z, hx: 7, hz: 14, y0: Y - 1, y1: Y + 9, kind: 'building' });
  for (let x = b.X0 + 2; x < b.X1 - 2; x += 3) { kit.props.place('shrub', [x, Y, b.Z0 + 1.2], r() * 6, 0.8, 0x7fa86a); kit.props.place('shrub', [x, Y, b.Z1 - 1.2], r() * 6, 0.8, 0x7fa86a); }
}

// ------------------------------------------------------------------------------------------- university
function campus(kit, shared, r) {
  const b = blockAt(-330, 2140), B = shared.city.wallB, mask = shared.mask, M = kit.M;
  kit.pad({ poly: rectPoly(b), y: Y + 0.02, surface: 'grass', blend: 0.5, material: M.textured('grass', { repeat: 1 }) });
  mask.rect(b.X0, b.Z0, b.X1, b.Z1);
  const bx = (b.X0 + b.X1) / 2 + 30, y = Y + 0.07;
  // palm boulevard from the gate on Roosevelt Road up to the library
  strip(kit, [[bx, b.Z1], [bx, b.Z0 + 44]], 12, y, kit.roadMats.asphalt());
  strip(kit, [[bx - 9.5, b.Z1], [bx - 9.5, b.Z0 + 44]], 3, y + 0.01, kit.roadMats.concrete());
  strip(kit, [[bx + 9.5, b.Z1], [bx + 9.5, b.Z0 + 44]], 3, y + 0.01, kit.roadMats.concrete());
  for (let z = b.Z1 - 6; z > b.Z0 + 50; z -= 9) for (const sx of [-7.2, 7.2]) kit.props.place('palm', [bx + sx, Y, z], r() * 6, 1.7 + r() * 0.15);
  // library at the head of the boulevard, a central tower over its door
  slab(B, kit, bx, b.Z0 + 24, 86, 30, 4, r, 'arch', 'tileRoof', lin(0xdcc9a4));
  slab(B, kit, bx, b.Z0 + 24, 18, 18, 7, r, 'arch', 'tileRoof', lin(0xd2bc94));
  // red brick halls facing the boulevard
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = b.Z1 - 34 - k * 46, x = bx + side * 38;
    slab(B, kit, x, z, 22, 38, 3, r, k % 2 ? 'arch' : 'brick', 'tileRoof', lin(k % 2 ? 0xb8735a : 0xa9604a), Math.PI / 2);
  }
  // the athletics field west of the boulevard
  const fx = b.X0 + 70, fz = (b.Z0 + b.Z1) / 2 + 10, tw = 104, td = 64;
  const shape = (ow, od, yy) => { const s = new THREE.Shape(); const rr = od / 2; s.absarc(-ow / 2 + rr, 0, rr, Math.PI / 2, Math.PI * 1.5, false); s.absarc(ow / 2 - rr, 0, rr, -Math.PI / 2, Math.PI / 2, false); const g = new THREE.ShapeGeometry(s, 14); g.rotateX(-Math.PI / 2); g.translate(fx, Y + yy, fz); return g; };
  kit.addStatic(shape(tw, td, 0.09), M.shared('trackRed', () => M.surface({ color: 0xa84a3c, roughness: 0.85 })), { cast: false });
  kit.addStatic(shape(tw - 14, td - 14, 0.11), M.shared('fieldGreen', () => M.surface({ color: 0x4f7e3a, roughness: 0.95 })), { cast: false });
  // trees and bikes
  for (let k = 0; k < 160; k++) {
    const x = b.X0 + 3 + r() * (b.X1 - b.X0 - 6), z = b.Z0 + 3 + r() * (b.Z1 - b.Z0 - 6);
    if (Math.abs(x - bx) < 60 || Math.hypot((x - fx) / (tw / 2 + 6), (z - fz) / (td / 2 + 6)) < 1 || z < b.Z0 + 42) continue;
    kit.props.place(r() < 0.15 ? 'banyan' : 'broadleaf', [x, Y, z], r() * 6, 0.8 + r() * 0.5, treeTint(r));
  }
  for (let z = b.Z1 - 20; z > b.Z0 + 60; z -= 1.1) if (r() < 0.6) kit.props.place('scooter', [bx + 12.5, Y, z], Math.PI / 2 + (r() - 0.5) * 0.2, 1, pick(r, [0x2b2d30, 0xd8d8d0, 0x5c8fbf, 0xb0262a, 0x6a8f4f]));
  const hs = kit.hsigns;
  const g = hs.geometry(hs.slot('國立大學', 6), 7, 1.6, 0.3); g.rotateY(Math.PI / 2); g.translate(bx - 14, Y + 1.6, b.Z1 - 2);
  kit.addStatic(g, hs.material, { cast: false, receive: false });
  B.box(bx - 14, b.Z1 - 2, [1, 0], [0, -1], 4, 0.4, Y, Y + 0.8, tileUV('plain'), tileUV('plain'), lin(0x8a8378));
}

// ------------------------------------------------------------------------------------------- night market
// The 26 m lane under the elevated between Zhonghua and Zhongshan roads: two rows of stalls facing the aisle,
// lantern strings overhead, gates at both ends. You can drive through it, slowly.
function nightMarket(kit, shared, r) {
  const B = shared.city.wallB, ctx = shared.city.ctx;
  const x0 = -1150 + 8 + SIDEWALK + 2, x1 = -850 - 8 - SIDEWALK - 2, z = ELEVATED_Z;
  const awn = [0xd84a3a, 0xe8c24a, 0x3a7ad8, 0x4aa86a, 0xf2f0ea, 0xe86a2a];
  for (let x = x0 + 4; x < x1 - 4; x += 2.9) for (const side of [-1, 1]) {
    if (r() < 0.06) continue;
    kit.props.place('stall', [x, Y, z + side * 8.6], side > 0 ? Math.PI : 0, 1, pick(r, awn));
    if (r() < 0.35) {
      const rect = ctx.hsign(r), g = kit.hsigns.geometry(rect, 2.6, 0.62, 0.12);
      g.rotateY(Math.PI / 2); g.translate(x, Y + 2.95, z + side * 7.7);
      kit.addStatic(g, kit.hsigns.material, { cast: false, receive: false });
    }
  }
  for (let x = x0 + 8; x < x1 - 6; x += 9) for (let zz = z - 6; zz <= z + 6; zz += 1.5) kit.props.place('lantern', [x, Y + 4.6 - 0.4 * Math.cos(((zz - z) / 6) * Math.PI * 0.5), zz], 0, 1, null, { collide: false });
  for (let x = x0 + 20; x < x1; x += 34) kit.light({ pos: [x, Y + 4, z], color: 0xffb070, intensity: 90, range: 26, nightOnly: true });
  templeGate(kit, B, { x: x0 - 1, z, y: Y, face: Math.PI / 2, w: 18, h: 7, name: '城中夜市', palette: 1 });
  templeGate(kit, B, { x: x1 + 1, z, y: Y, face: -Math.PI / 2, w: 18, h: 7, name: '城中夜市', palette: 1 });
  shared.mask.rect(x0 - 3, z - 13, x1 + 3, z + 13);
}

// ------------------------------------------------------------------------------------------- Grand Hotel
// The red palace hotel on the hill above Civic Boulevard: a long block of red columns under a huge golden
// roof, two lower wings, floodlit at night.
function grandHotel(kit, shared, r) {
  const B = shared.city.wallB, x = -560, z = 262, w = 84, d = 20;
  const y = kit.groundY(x, z + d / 2) + 0.5;
  kit.pad({ poly: [[x - w / 2 - 34, z - d / 2 - 6], [x + w / 2 + 34, z - d / 2 - 6], [x + w / 2 + 34, z + d / 2 + 26], [x - w / 2 - 34, z + d / 2 + 26]], y, surface: 'asphalt', blend: 14 });
  shared.mask.rect(x - w / 2 - 36, z - d / 2 - 8, x + w / 2 + 36, z + d / 2 + 28);
  const red = lin(0xc4422e);
  const H = slab(B, kit, x, z, w, d, 9, r, 'hotel', null, red, 0, y);
  for (let k = 0; k <= 14; k++) B.box(x - w / 2 + (w * k) / 14, z + d / 2 + 0.4, [1, 0], [0, -1], 0.45, 0.45, y, y + H, tileUV('plain'), null, lin(0xa8281c));
  palaceRoof(B, { x, z, y: y + H + 0.3, hw: w / 2 + 3, hd: d / 2 + 3, rise: 9, roof: 'gold' });
  palaceRoof(B, { x, z, y: y + H + 6.5, hw: w / 4, hd: d / 4 + 1, rise: 5, roof: 'gold' });
  for (const sx of [-1, 1]) {
    const H2 = slab(B, kit, x + sx * (w / 2 + 16), z + 4, 28, 16, 6, r, 'hotel', null, red, 0, y);
    palaceRoof(B, { x: x + sx * (w / 2 + 16), z: z + 4, y: y + H2 + 0.3, hw: 16, hd: 10, rise: 6, roof: 'gold' });
  }
  for (const k of [-1, 0, 1]) kit.light({ pos: [x + k * 30, y + 6, z + d / 2 + 18], color: 0xffc070, intensity: 160, range: 60, nightOnly: true });
  for (let k = 0; k < 12; k++) kit.props.place('palm', [x - w / 2 - 20 + k * ((w + 40) / 11), y, z + d / 2 + 22], r() * 6, 1.3);
}
