// Terrain of the Formosa map: northern Taiwan squeezed into 5 x 5 km.
//   north (-Z): the sea; a narrow coastal shelf carries the north coast highway between headlands
//   west: the Tamsui river and Guanyinshan on the far bank
//   centre-north: the Yangmingshan massif (Qixing, Datun, the Lengshuikeng plateau)
//   south-west: the Taipei basin (a flat plateau at CITY_Y), Elephant Mountain hills east of it
//   east: Keelung Mountain and Jiufen above the harbour, the paddy valley below
// Pure and deterministic: the menus and the validator evaluate it in Node.
// Two layers, both cached on a 16 m grid the first time they are needed:
//   natural  relief, coast, river, plateaus (naturalAt: the mountain roads were traced on this)
//   final    natural + road corridors: designed road profiles pull the hills into benches, shelves and
//            cuts so roads sit in believable earthworks (tunnel and bridge ranges are skipped)
// Fine noise is added per sample, faded out near roads and on the flats.
import { clamp, fbm, ridged, valueNoise } from '../../src/core/math.js';
import { BOUNDS, CITY_Y, FLATS_Y, CITY, VALLEY, CREEK, VENTS, coastZ, cliffAt, shelfAt, RIVER, sst, smax, polyDist } from './geo.js';

const smin = (a, b, k) => -smax(-a, -b, k);
import { CORRIDORS } from './routes.js';

export { BOUNDS, CITY_Y };

// Mountain regions (soft ellipses): x, z, rx, rz, rotation, base height (dome profile, highest in the middle)
// and ridge relief (grows with altitude so the foothills stay drivable).
const REGIONS = [
  { x: -380, z: -1060, rx: 1650, rz: 1510, rot: 0.06, base: 300, relief: 200, p: 1.6 }, // Yangmingshan massif
  { x: 1420, z: -1450, rx: 1420, rz: 1000, rot: -0.1, base: 230, relief: 190, p: 1.4 },  // Wuzhi / Keelung / Jiufen
  { x: 950, z: 1320, rx: 300, rz: 1350, rot: 0.04, base: 120, relief: 90, p: 1.2 },      // Four Beasts ridge (Elephant Mountain)
  { x: -2560, z: -1250, rx: 520, rz: 820, rot: 0, base: 380, relief: 200, p: 1.3 },      // Guanyinshan across the river
  { x: 2760, z: 300, rx: 560, rz: 2900, rot: 0, base: 400, relief: 240, p: 1.2 },        // Snow Mountain foothills (east edge)
  { x: 600, z: 2860, rx: 3400, rz: 600, rot: 0, base: 240, relief: 150, p: 1.2 },        // southern hills (Maokong tea hills)
  { x: -2720, z: 1600, rx: 440, rz: 1400, rot: 0, base: 70, relief: 60, p: 1.2 },        // Linkou plateau edge
];
// Gentle high ground pulled towards a level: the Lengshuikeng plateau.
const PLATEAUS = [
  { x: -430, z: -1040, rx: 430, rz: 330, y: 300, k: 0.75 },
];
// Landmark peaks on top of the relief: x, z, height above the base, radius, profile exponent.
const PEAKS = [
  { x: 140, z: -860, h: 260, r: 420, k: 1.5 },     // Qixing (Seven Star)
  { x: -1060, z: -1020, h: 220, r: 380, k: 1.5 },  // Datun
  { x: -560, z: -1380, h: 150, r: 300, k: 1.5 },   // Xiaoguanyin, north of the plateau
  { x: -240, z: -110, h: 135, r: 160, k: 1.2 },    // Shamao, the little cone above the city
  { x: 1840, z: -1560, h: 230, r: 300, k: 1.25 },  // Keelung Mountain over the harbour
  { x: -2520, z: -1300, h: 230, r: 380, k: 1.4 },  // Guanyinshan summit
  { x: 950, z: 1470, h: 70, r: 220, k: 1.3 },      // Elephant Mountain viewpoint
];
// Ridges raised into the relief: polyline [x, z, crest y], half width of the crest, side slope.
const RIDGES = [
  { pts: [[-60, -1150, 318], [200, -1230, 286], [480, -1200, 262], [760, -1230, 248], [1040, -1270, 236], [1300, -1330, 228], [1520, -1420, 236]], w: 45, slope: 0.42 }, // Wuzhi ridge to Jiufen
];
// Valleys pressed into the relief: polyline [x, z, floor y], half width of the floor, side slope.
// The terrain becomes min(natural, floor + slope * distance beyond the floor) with a soft blend.
const VALLEYS = [
  { pts: [[2310, -1920, 12], [2360, -1700, 34], [2300, -1480, 54], [2350, -1250, 64], [2280, -1030, 52], [2230, -800, 32], [2160, -560, 22]], w: 45, slope: 0.42 }, // Bitou pass
  { pts: [[-1720, -470, 10], [-1560, -420, 30], [-1420, -330, 52], [-1250, -300, 80]], w: 40, slope: 0.45 },                                   // Beitou hot spring valley
];

// ---------------------------------------------------------------------------------------------- natural
function regionDome(x, z, E) {
  const c = Math.cos(E.rot), s = Math.sin(E.rot), dx = x - E.x, dz = z - E.z;
  const u = (dx * c + dz * s) / E.rx, v = (-dx * s + dz * c) / E.rz;
  const d2 = u * u + v * v;
  return d2 >= 1 ? 0 : Math.pow(1 - d2, E.p);
}

/** Valley polyline helper: distance + interpolated floor height. */
function valleyFloor(V, x, z) {
  let best = Infinity, fy = 0;
  for (let i = 0; i < V.pts.length - 1; i++) {
    const [ax, az, ay] = V.pts[i], [bx, bz, by] = V.pts[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x, pz = az + dz * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; fy = ay + (by - ay) * t; }
  }
  return { d: Math.sqrt(best), y: fy };
}

function land(x, z) {
  // lowland base: gently rolling
  let h = 14 + 12 * fbm(x * 0.0021 + 5.3, z * 0.0021 - 1.7, 3);
  // warped coordinates so ridges wander
  const wx = x + 260 * (fbm(x * 0.0009 + 1.7, z * 0.0009 + 9.2, 3) - 0.5);
  const wz = z + 260 * (fbm(x * 0.0009 - 4.4, z * 0.0009 + 3.3, 3) - 0.5);
  let m = 0;
  for (const E of REGIONS) {
    const k = regionDome(wx, wz, E);
    if (k <= 0) continue;
    const r = ridged(wx * 0.00115 + E.x * 0.001, wz * 0.00115 - E.z * 0.001, 5);
    m = smax(m, E.base * k + E.relief * k * k * (r - 0.4), 40);
  }
  for (const P of PLATEAUS) {
    const dx = (x - P.x) / P.rx, dz = (z - P.z) / P.rz, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1.6) m += (P.y - m) * P.k * (1 - sst(0.6, 1.6, d));
  }
  for (const P of PEAKS) {
    const d = Math.hypot(x - P.x, z - P.z) / P.r;
    if (d < 1) m += P.h * Math.pow(1 - d, P.k) * (1 - 0.15 * d);
  }
  if (m > 0) m += (fbm(x * 0.007 - 3.1, z * 0.007 + 8.9, 3) - 0.5) * 22 * sst(20, 120, m);
  h = smax(h, m, 30);
  for (const V of RIDGES) {
    const f = valleyFloor(V, x, z);
    const e = Math.max(0, f.d - V.w);
    const crest = f.y - V.slope * e - Math.max(0, e - 160) ** 2 * 0.006 + 18 * (fbm(x * 0.008 + 1.3, z * 0.008, 2) - 0.5);
    if (crest > h - 30) h = smax(h, crest, 30);
  }
  for (const V of VALLEYS) {
    const f = valleyFloor(V, x, z);
    const e = Math.max(0, f.d - V.w);
    const cap = f.y + V.slope * e + Math.max(0, e - 140) ** 2 * 0.01;   // valley sides, then the hills take over
    if (cap < h + 30) h = smin(h, cap, 30);
  }
  // the Taipei basin
  const cx = Math.max(CITY.x0 - x, 0, x - CITY.x1), cz = Math.max(CITY.z0 - z, 0, z - CITY.z1);
  h += (CITY_Y - h) * (1 - sst(0, 160, Math.hypot(cx, cz)));
  // the paddy valley (Lanyang plain): almost flat, rising gently to the north
  const vx = Math.max(VALLEY.x0 - x, 0, x - VALLEY.x1), vz = Math.max(VALLEY.z0 - z, 0, z - VALLEY.z1);
  h += (VALLEY.floor(z) - h) * (1 - sst(0, 190, Math.hypot(vx, vz)));
  // the creek: a flat-bottomed channel with soft banks
  if (x > CREEK.pts[0][0] - 20 && x < CREEK.pts[CREEK.pts.length - 1][0] + 20 && z > 900 && z < 1140) {
    let best = Infinity;
    for (let i = 0; i < CREEK.pts.length - 1; i++) {
      const [ax, az] = CREEK.pts[i], [bx, bz] = CREEK.pts[i + 1];
      const dx = bx - ax, dz = bz - az; let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
      best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
    }
    h -= CREEK.depth * (1 - sst(CREEK.w, CREEK.w + 9, best));
  }
  return h;
}

function natural(x, z) {
  let h = land(x, z);
  // river, riverside parks and the levee on both banks
  if (x < -1500) {
    const R = polyDist(RIVER, x, z);
    const s = R.d - R.w;                       // metres from the bank, + on land
    if (s < 0) h = -1.2 - 5 * sst(0, 45, -s);
    else if (s < 100) h = Math.min(h, FLATS_Y * sst(0, 10, s) + (s < 10 ? 0.6 * (1 - s / 10) : 0));
    else h = FLATS_Y + (h - FLATS_Y) * sst(100, 128, s);
  }
  // north shore: a shelf (coast highway, villages) where shelfAt > 0, cliffs and beaches elsewhere
  const inland = z - coastZ(x);               // + = land (south of the waterline)
  if (inland < 900) {
    const shelfW = shelfAt(x);
    if (shelfW > 0) {
      const bank = -1.4 + Math.max(0, inland) * 0.3;              // rocky bank / beach up to the shelf
      const rise = Math.max(0, inland - shelfW);
      // escarpment behind the shelf: about 35 degrees for the first ~120 m, then the hills are free again
      const shelf = Math.min(bank, 9 + 3 * fbm(x * 0.004, 2.2, 2)) + rise * 0.7 + Math.max(0, rise - 110) ** 2 * 0.012
        + 40 * (fbm(x * 0.006 + 4.1, z * 0.006 - 2.7, 3) - 0.5) * sst(0, 120, rise);
      h += (smin(h, shelf, 12) - h) * sst(0, 50, shelfW);
    }
  }
  if (inland < 420) {
    const cliff = cliffAt(x);
    const beach = Math.min(h, -1.5 + Math.max(inland, -200) * 0.05);
    const wall = h * sst(-10, 70, inland) - 14 * (1 - sst(-80, 0, inland));
    const shore = beach + (wall - beach) * cliff;
    h = h + (shore - h) * (1 - sst(80, 300, inland));
  }
  if (inland < 0) h = Math.min(h, -2 - Math.min(26, -inland * 0.07));
  // Yehliu: a long thin sandstone cape north of the coast
  const yx = x - (40 + (z + 2040) * 0.18);
  if (z < -1960 && z > -2290 && Math.abs(yx) < 70) {
    const t = 1 - sst(28, 66, Math.abs(yx));
    h = Math.max(h, (3 + 9 * (1 - sst(-2040, -2280, z))) * t - 6 * (1 - t));
  }
  return h;
}

// roughness: how much fine noise to add (0 on flats, 1 in the hills)
function roughAt(x, z, h) {
  const cx = Math.max(CITY.x0 - x, 0, x - CITY.x1), cz = Math.max(CITY.z0 - z, 0, z - CITY.z1);
  return sst(25, 90, h) * sst(60, 200, Math.hypot(cx, cz));
}

// ---------------------------------------------------------------------------------------------- cache
const G = { cell: 16, nx: 0, nz: 0, nat: null, h: null, r: null };
function ensureGrid() {
  if (G.h) return;
  const { x0, x1, z0, z1 } = BOUNDS;
  G.x0 = x0 - 64; G.z0 = z0 - 64;
  G.nx = Math.ceil((x1 - x0 + 128) / G.cell) + 1; G.nz = Math.ceil((z1 - z0 + 128) / G.cell) + 1;
  const n = G.nx * G.nz;
  G.nat = new Float32Array(n); G.r = new Float32Array(n);
  for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) {
    const x = G.x0 + i * G.cell, z = G.z0 + j * G.cell, h = natural(x, z);
    G.nat[j * G.nx + i] = h; G.r[j * G.nx + i] = roughAt(x, z, h);
  }
  G.h = G.nat.slice();
  applyCorridors();
}

/**
 * Road corridors: every corridor segment pulls nearby terrain towards the road height. Weighted average of all
 * nearby road samples (so stacked hairpin legs blend into one slope), strength = strongest single pull.
 * corridor: { pts: [[x, y, z], ...], bench: m at full strength, fall: blend width, skip: [[s0, s1], ...] metres }
 */
function applyCorridors() {
  const n = G.nx * G.nz, wsum = new Float32Array(n), ysum = new Float32Array(n), wmax = new Float32Array(n);
  for (const C of CORRIDORS) {
    const bench = C.bench ?? 14, fall = C.fall ?? 70, reach = bench + fall;
    const pts = C.pts;
    let s = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
      const seg = Math.hypot(bx - ax, bz - az);
      const s0 = s; s += seg;
      if (C.skip && C.skip.some(([u, v]) => s0 + seg * 0.5 > u && s0 + seg * 0.5 < v)) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - G.x0) / G.cell)), i1 = Math.min(G.nx - 1, Math.ceil((Math.max(ax, bx) + reach - G.x0) / G.cell));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - reach - G.z0) / G.cell)), j1 = Math.min(G.nz - 1, Math.ceil((Math.max(az, bz) + reach - G.z0) / G.cell));
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = G.x0 + i * G.cell, z = G.z0 + j * G.cell;
        let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
        if (d >= reach) continue;
        const w = d <= bench ? 1 : 1 - sst(bench, reach, d);
        const y = ay + (by - ay) * t;
        const q = j * G.nx + i, ww = w * w * w + 1e-4;
        wsum[q] += ww; ysum[q] += ww * y;
        if (w > wmax[q]) wmax[q] = w;
      }
    }
  }
  // the hill stays whole over tunnels: no corridor pull within reach of a tunnel's inside
  for (const C of CORRIDORS) {
    if (!C.tunnels) continue;
    for (const [u, v] of C.tunnels) clearAlong(C.pts, u + 4, v - 4, 34, wmax);
  }
  for (let q = 0; q < n; q++) {
    if (wmax[q] <= 0) continue;
    const target = ysum[q] / wsum[q];
    G.h[q] += (target - G.h[q]) * wmax[q];
    G.r[q] *= 1 - wmax[q];
  }
}

/** Zero `w` on grid cells within `r` of the corridor polyline between distances s0 and s1. */
function clearAlong(pts, s0, s1, r, w) {
  let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], seg = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const sa = s; s += seg;
    if (s < s0 || sa > s1) continue;
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - r - G.x0) / G.cell)), i1 = Math.min(G.nx - 1, Math.ceil((Math.max(a[0], b[0]) + r - G.x0) / G.cell));
    const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - r - G.z0) / G.cell)), j1 = Math.min(G.nz - 1, Math.ceil((Math.max(a[2], b[2]) + r - G.z0) / G.cell));
    const dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = G.x0 + i * G.cell, z = G.z0 + j * G.cell;
      let t = ((x - a[0]) * dx + (z - a[2]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const st = sa + seg * t;
      if (st < s0 || st > s1) continue;
      if (Math.hypot(a[0] + dx * t - x, a[2] + dz * t - z) < r) w[j * G.nx + i] = 0;
    }
  }
}

function bilerp(A, x, z) {
  const fx = clamp((x - G.x0) / G.cell, 0, G.nx - 1.001), fz = clamp((z - G.z0) / G.cell, 0, G.nz - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * G.nx + i;
  return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + G.nx] * (1 - u) + A[k + G.nx + 1] * u) * v;
}
// Catmull-Rom across cache cells (bilinear shows the 16 m grid in the shading)
const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
function bicubic(A, x, z) {
  const fx = clamp((x - G.x0) / G.cell, 1, G.nx - 2.001), fz = clamp((z - G.z0) / G.cell, 1, G.nz - 2.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, nx = G.nx;
  const row = (jj) => { const k = jj * nx + i; return cr(A[k - 1], A[k], A[k + 1], A[k + 2], u); };
  return cr(row(j - 1), row(j), row(j + 1), row(j + 2), v);
}

/** Final terrain height (before the kit carves the road beds). */
export function heightAt(x, z) {
  ensureGrid();
  const h = bicubic(G.h, x, z), r = bilerp(G.r, x, z);
  if (r < 0.01) return h;
  return h + (valueNoise(x * 0.022 + 7.7, z * 0.022 - 2.2) - 0.5) * 1.8 * r + (valueNoise(x * 0.07, z * 0.07) - 0.5) * 0.25 * r;
}
/** Smooth final height without fine noise (placing big things). */
export function macroAt(x, z) { ensureGrid(); return bicubic(G.h, x, z); }
/** Terrain before road corridors (the mountain roads were traced on this). */
export function naturalAt(x, z) { ensureGrid(); return bicubic(G.nat, x, z); }

// ---------------------------------------------------------------------------------------------- look
// Vertex colours for the terrain (multiplied with the neutral 'ground' texture) and physics surfaces per cell.
const C = (hex) => { const c = { r: 0, g: 0, b: 0 }; const v = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((k) => { const s = k / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); c.r = v[0]; c.g = v[1]; c.b = v[2]; return c; };
const PAL = {
  forest: C(0x35532a), forest2: C(0x456637), grass: C(0x5d7b39), meadow: C(0x8e9156), straw: C(0xa59c66),
  rock: C(0x5a5f4e), cliff: C(0x8a8170), sand: C(0xcdbb90), wetSand: C(0x9a8b6a), seabed: C(0x56543f),
  jungle: C(0x2f4a25), sandstone: C(0xc4a877), canopyLit: C(0x5e8a3e), sulphur: C(0xc9bb72), ash: C(0x9c9a8a),
  city: C(0x5c5a56), park: C(0x5b8a3a), field: C(0x6a8c34), mud: C(0x6b5a42),
};
const mixC = (a, b, t, o) => { o.r = a.r + (b.r - a.r) * t; o.g = a.g + (b.g - a.g) * t; o.b = a.b + (b.b - a.b) * t; return o; };
const _a = { r: 0, g: 0, b: 0 };

function regionOf(x, z, h) {
  const cx = Math.max(CITY.x0 - x, 0, x - CITY.x1), cz = Math.max(CITY.z0 - z, 0, z - CITY.z1);
  const city = 1 - sst(20, 90, Math.hypot(cx, cz));
  const vx = Math.max(VALLEY.x0 - x, 0, x - VALLEY.x1), vz = Math.max(VALLEY.z0 - z, 0, z - VALLEY.z1);
  const valley = 1 - sst(20, 140, Math.hypot(vx, vz));
  const inland = z - coastZ(x);
  const river = x < -1500 ? polyDist(RIVER, x, z) : null;
  return { city, valley, inland, riverBank: river ? river.d - river.w : 1e9 };
}

/** Terrain vertex colour (linear RGB into out). */
export function terrainColor(x, z, h, slope, out) {
  const R = regionOf(x, z, h);
  const n = fbm(x * 0.012 + 3.3, z * 0.012 - 1.1, 3), n2 = valueNoise(x * 0.05, z * 0.05);
  let c;
  if (h < -0.6) c = mixC(PAL.seabed, PAL.wetSand, sst(-6, -0.6, h), _a);
  else if (R.inland < 140 && h < 4.5 && R.inland > -20) c = mixC(PAL.wetSand, PAL.sand, sst(0.2, 1.6, h), _a);
  else if (R.riverBank < 105 && h < 4) c = mixC(PAL.park, PAL.grass, n2 * 0.5, _a);
  else {
    // vegetation by altitude: lowland grass and scrub, forested slopes, silvergrass meadows on the high ground
    mixC(PAL.grass, PAL.forest, sst(8, 40, h) * (0.7 + 0.3 * n), _a);
    if (n > 0.55) mixC(_a, PAL.forest2, (n - 0.55) * 1.6, _a);
    // crown-sized mottling: from a distance the slopes read as broadleaf canopy, not lawn
    const crowns = valueNoise(x * 0.085 + 11.3, z * 0.085 - 4.1);
    mixC(_a, crowns > 0.5 ? PAL.canopyLit : PAL.jungle, Math.abs(crowns - 0.5) * 1.3 * sst(8, 40, h), _a);
    if (h > 255) mixC(_a, n2 > 0.5 ? PAL.straw : PAL.meadow, sst(255, 300, h) * (0.55 + 0.45 * n), _a);
    if (R.valley > 0) mixC(_a, PAL.field, R.valley * 0.85, _a);
    c = _a;
  }
  // steep slopes stay green under the jungle; only the steepest cuts and the sea cliffs show bare rock
  if (slope > 0.55) c = mixC(c, PAL.jungle, sst(0.55, 1.1, slope) * 0.8, _a);
  const rockT = sst(1.15, 1.9, slope) * (0.75 + 0.25 * n2);
  if (rockT > 0) c = mixC(c, R.inland < 260 ? PAL.cliff : PAL.rock, rockT, _a);
  // the sulphur vents: bare yellow-grey ground
  const vd = Math.hypot(x - VENTS.x, z - VENTS.z) / VENTS.r;
  if (vd < 1.3) c = mixC(c, n2 > 0.5 ? PAL.sulphur : PAL.ash, 1 - sst(0.6, 1.3, vd), _a);
  // Yehliu: the bare sandstone cape
  const yl = Math.hypot((x - 10) / 70, (z + 2235) / 75);
  if (yl < 1.2 && h > -1) c = mixC(c, PAL.sandstone, (1 - sst(0.75, 1.2, yl)) * sst(-1, 0.5, h), _a);
  if (R.city > 0) c = mixC(c, PAL.city, R.city, _a);
  const k = (0.84 + n2 * 0.32) * 1.12;
  out.r = c.r * k; out.g = c.g * k; out.b = c.b * k;
  return out;
}

/** Physics surface per terrain cell. */
export function terrainSurface(x, z, h, slope) {
  const R = regionOf(x, z, h);
  if (R.city > 0.5) return 'concrete';
  if (R.inland < 140 && h < 4.5 && R.inland > -20) return 'sand';
  if (slope > 1.1) return 'gravel';
  if (R.valley > 0.6) return 'dirt';
  return 'grass';
}
