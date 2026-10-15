// Car body toolkit (ctx.kit.body): one smooth closed surface lofted through cross-sections, then cut into real
// panels (hood, doors, bumpers, glass, lamp lenses...) with rolled edges and dark shut lines.
//
//   const S = kit.body.loft(stations, { counts, caps })   // closed surface + shape queries
//   let [door, rest] = kit.body.cut(S.patch, f, { gap })   // f(x, y, z) <= 0 keeps (signed distance-ish, metres)
//   kit.body.assemble({ paint: [door, ...], glass: [...] }) -> THREE.Group (one mesh per material)
//
// Stations are rounded polygons of the LEFT half (+X), from the bottom centreline round to the top centreline:
// { z, pts: [[x, y, r], ...] } with the same corner count in every station; r is the corner size (tangent length,
// metres). The first and last corners sit on the centreline (x = 0). Corner coordinates are interpolated between
// stations with a monotone cubic (no overshoot), so 10 to 20 stations describe a whole car. Every corner keeps
// fixed sample counts, so creases stay aligned along the body. A Patch is an indexed triangle mesh with
// position, normal and uv per vertex; cutting interpolates all three, so shading never shows the cut.
import * as THREE from 'three';
import { getTextureSet, canvasTexture } from '../../render/textures.js';
import { makeCanvas, FONT_UI, FONT_CJK } from '../../core/canvas.js';

const STRIDE = 8; // x y z nx ny nz u v

// ------------------------------------------------------------------------------------------- patch
// A Patch is a triangle list over a vertex pool. Cutting never copies vertices: pieces cut from one surface share
// its pool (intersection points are appended), so dozens of cuts stay cheap. Operations that move vertices
// (offset, warp, mirror...) return compacted copies with their own pool.
export class Patch {
  // e: open boundary edges as a flat list of oriented vertex pairs (patch on the left), tracked through cuts;
  // null = unknown (computed on demand by boundary()).
  constructor(v = []) { this.v = v; this.t = []; this.e = null; }
  get vertexCount() { return this.v.length / STRIDE; }
  get triCount() { return this.t.length / 3; }
  add(x, y, z, nx, ny, nz, u = 0, w = 0) { this.v.push(x, y, z, nx, ny, nz, u, w); return this.v.length / STRIDE - 1; }
  tri(a, b, c) { this.t.push(a, b, c); }
  /** Same vertices, own triangle list. */
  clone() { const p = new Patch(this.v); p.t = this.t.slice(); p.e = this.e ? this.e.slice() : null; return p; }
  /** Copy with only the used vertices in a new pool. */
  compact() {
    const p = new Patch(), map = new Int32Array(this.vertexCount).fill(-1), src = this.v, T = this.t;
    const take = (i) => {
      let j = map[i];
      if (j < 0) { const o = i * STRIDE; j = p.add(src[o], src[o + 1], src[o + 2], src[o + 3], src[o + 4], src[o + 5], src[o + 6], src[o + 7]); map[i] = j; }
      return j;
    };
    const t = new Array(T.length);
    for (let k = 0; k < T.length; k++) t[k] = take(T[k]);
    p.t = t;
    if (this.e) p.e = this.e.map(take);
    return p;
  }
  /** Append another patch (shares nothing unless both use the same pool). */
  append(o) {
    const known = (this.e || this.isEmpty()) && o.e;
    if (o.v === this.v) {
      for (const i of o.t) this.t.push(i);
      this.e = known ? (this.e || []).concat(o.e) : null;
      return this;
    }
    const c = o.compact(), base = this.vertexCount;
    for (let i = 0; i < c.v.length; i++) this.v.push(c.v[i]);
    for (const i of c.t) this.t.push(i + base);
    this.e = known ? (this.e || []).concat(c.e.map((i) => i + base)) : null;
    return this;
  }
  isEmpty() { return this.t.length === 0; }
  bounds() {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const i of this.t) for (let k = 0; k < 3; k++) { const q = this.v[i * STRIDE + k]; if (q < mn[k]) mn[k] = q; if (q > mx[k]) mx[k] = q; }
    return [mn, mx];
  }
}

/**
 * BufferGeometry (indexed or not) -> Patch. Vertices sharing position and normal are welded (spheres and lathes
 * duplicate their seam and pole vertices), so boundaries are only real open edges.
 */
export function fromGeometry(g, { weld = true } = {}) {
  const p = new Patch();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const map = new Int32Array(pos.count), seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    if (weld) {
      const key = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
      const list = seen.get(key);
      let hit = -1;
      if (list) for (const j of list) { const o = j * STRIDE; if (p.v[o + 3] * nx + p.v[o + 4] * ny + p.v[o + 5] * nz > 0.97) { hit = j; break; } }
      if (hit >= 0) { map[i] = hit; continue; }
      const id = p.add(x, y, z, nx, ny, nz, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      if (list) list.push(id); else seen.set(key, [id]);
      map[i] = id;
    } else map[i] = p.add(x, y, z, nx, ny, nz, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
  }
  if (g.index) for (let i = 0; i < g.index.count; i += 3) { const a = map[g.index.getX(i)], b = map[g.index.getX(i + 1)], c = map[g.index.getX(i + 2)]; if (a !== b && b !== c && a !== c) p.t.push(a, b, c); }
  else for (let i = 0; i < pos.count; i += 3) { const a = map[i], b = map[i + 1], c = map[i + 2]; if (a !== b && b !== c && a !== c) p.t.push(a, b, c); }
  return p;
}

/** Patch -> indexed BufferGeometry (compacted). */
export function toGeometry(p0) {
  const p = p0.compact();
  const g = new THREE.BufferGeometry();
  const n = p.vertexCount;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    pos[i * 3] = p.v[o]; pos[i * 3 + 1] = p.v[o + 1]; pos[i * 3 + 2] = p.v[o + 2];
    nrm[i * 3] = p.v[o + 3]; nrm[i * 3 + 1] = p.v[o + 4]; nrm[i * 3 + 2] = p.v[o + 5];
    uv[i * 2] = p.v[o + 6]; uv[i * 2 + 1] = p.v[o + 7];
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(p.t, 1) : new THREE.Uint16BufferAttribute(p.t, 1));
  g.computeBoundingSphere();
  return g;
}

/** Area-weighted smooth normals from the triangles. Only for patches that own their pool. */
export function computeNormals(p) {
  const v = p.v, t = p.t, n = p.vertexCount;
  const acc = new Float64Array(n * 3);
  for (let i = 0; i < t.length; i += 3) {
    const ia = t[i], ib = t[i + 1], ic = t[i + 2];
    const a = ia * STRIDE, b = ib * STRIDE, c = ic * STRIDE;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    acc[ia * 3] += nx; acc[ia * 3 + 1] += ny; acc[ia * 3 + 2] += nz;
    acc[ib * 3] += nx; acc[ib * 3 + 1] += ny; acc[ib * 3 + 2] += nz;
    acc[ic * 3] += nx; acc[ic * 3 + 1] += ny; acc[ic * 3 + 2] += nz;
  }
  for (let i = 0; i < n; i++) {
    const x = acc[i * 3], y = acc[i * 3 + 1], z = acc[i * 3 + 2], l = Math.hypot(x, y, z);
    if (l > 1e-14) { v[i * STRIDE + 3] = x / l; v[i * STRIDE + 4] = y / l; v[i * STRIDE + 5] = z / l; }
  }
  return p;
}

// ------------------------------------------------------------------------------------------- clipping
/**
 * Keep the part of the patch where f(x, y, z, u, v) <= 0. Cuts are exact along f = 0 (linear inside each triangle)
 * and crack-free (shared edges are cut once). Normals and uvs are interpolated. The result shares the pool.
 */
export function clip(p, f, pre = null) {
  const v = p.v, n = pre ? pre.n : p.vertexCount, T = p.t;
  const fv = new Float64Array(n), done = new Uint8Array(n);
  const val = pre
    ? (i) => { if (!done[i]) { fv[i] = pre.k * pre.fv[i] + pre.c; done[i] = 1; } return fv[i]; }
    : (i) => { if (!done[i]) { const o = i * STRIDE; fv[i] = f(v[o], v[o + 1], v[o + 2], v[o + 6], v[o + 7]); done[i] = 1; } return fv[i]; };
  const out = new Patch(v);
  const edges = new Map();
  const cross = (i, j) => {
    const a = i < j ? i : j, b = i < j ? j : i;
    const key = a * n + b;
    let r = edges.get(key);
    if (r === undefined) {
      const t = fv[a] / (fv[a] - fv[b]);
      const oa = a * STRIDE, ob = b * STRIDE;
      const L = (k) => v[oa + k] + (v[ob + k] - v[oa + k]) * t;
      let nx = L(3), ny = L(4), nz = L(5); const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      r = out.add(L(0), L(1), L(2), nx, ny, nz, L(6), L(7));
      edges.set(key, r);
    }
    return r;
  };
  const poly = [0, 0, 0, 0], isX = [false, false, false, false];
  const track = !!p.e;
  const E = track ? [] : null;
  for (let k = 0; k < T.length; k += 3) {
    const a = T[k], b = T[k + 1], c = T[k + 2];
    const ia = val(a) <= 0, ib = val(b) <= 0, ic = val(c) <= 0;
    if (ia && ib && ic) { out.t.push(a, b, c); continue; }
    if (!ia && !ib && !ic) continue;
    let m = 0;
    if (ia) { isX[m] = false; poly[m++] = a; } if (ia !== ib) { isX[m] = true; poly[m++] = cross(a, b); }
    if (ib) { isX[m] = false; poly[m++] = b; } if (ib !== ic) { isX[m] = true; poly[m++] = cross(b, c); }
    if (ic) { isX[m] = false; poly[m++] = c; } if (ic !== ia) { isX[m] = true; poly[m++] = cross(c, a); }
    for (let e = 1; e < m - 1; e++) out.t.push(poly[0], poly[e], poly[e + 1]);
    if (track) for (let j = 0; j < m; j++) { const j1 = (j + 1) % m; if (isX[j] && isX[j1]) E.push(poly[j], poly[j1]); }
  }
  if (track) {
    // carry the old boundary through the cut
    const pe = p.e;
    for (let k = 0; k < pe.length; k += 2) {
      const a = pe[k], b = pe[k + 1], ia = val(a) <= 0, ib = val(b) <= 0;
      if (ia && ib) E.push(a, b);
      else if (ia) E.push(a, cross(a, b));
      else if (ib) E.push(cross(a, b), b);
    }
    out.e = E;
  }
  return out;
}

/** Split into [f <= -half, f >= half]. */
export function split(p, f, half = 0) {
  // evaluate f once per used vertex, then clip both sides from the cached values
  const v = p.v, n = p.vertexCount, fv = new Float64Array(n), done = new Uint8Array(n);
  const T = p.t, E = p.e || [];
  const ev = (i) => { if (!done[i]) { const o = i * STRIDE; fv[i] = f(v[o], v[o + 1], v[o + 2], v[o + 6], v[o + 7]); done[i] = 1; } };
  for (let k = 0; k < T.length; k++) ev(T[k]);
  for (let k = 0; k < E.length; k++) ev(E[k]);
  return [clip(p, null, { fv, n, k: 1, c: half }), clip(p, null, { fv, n, k: -1, c: half })];
}

/** Move every vertex along its normal (negative = inwards). */
export function offset(p, d) {
  const q = p.compact(), v = q.v;
  const fn = typeof d === 'function' ? d : null;
  for (let i = 0; i < v.length; i += STRIDE) {
    const dd = fn ? fn(v[i], v[i + 1], v[i + 2]) : d;
    v[i] += v[i + 3] * dd; v[i + 1] += v[i + 4] * dd; v[i + 2] += v[i + 5] * dd;
  }
  return q;
}
/** Reverse the faces (inside view of a surface: door cards, headliner). */
export function flip(p) {
  const q = p.compact();
  for (let i = 0; i < q.t.length; i += 3) { const t = q.t[i + 1]; q.t[i + 1] = q.t[i + 2]; q.t[i + 2] = t; }
  if (q.e) for (let i = 0; i < q.e.length; i += 2) { const t = q.e[i]; q.e[i] = q.e[i + 1]; q.e[i + 1] = t; }
  for (let i = 0; i < q.v.length; i += STRIDE) { q.v[i + 3] *= -1; q.v[i + 4] *= -1; q.v[i + 5] *= -1; }
  return q;
}
/** Apply fn(x, y, z) -> [x, y, z] to positions and recompute normals (bends, morphs). */
export function warp(p, fn, renormal = true) {
  const q = p.compact(), v = q.v;
  for (let i = 0; i < v.length; i += STRIDE) { const r = fn(v[i], v[i + 1], v[i + 2]); v[i] = r[0]; v[i + 1] = r[1]; v[i + 2] = r[2]; }
  return renormal ? computeNormals(q) : q;
}
/** Mirror x -> -x with correct winding. */
export function mirror(p) {
  const q = p.compact();
  for (let i = 0; i < q.v.length; i += STRIDE) { q.v[i] *= -1; q.v[i + 3] *= -1; }
  for (let i = 0; i < q.t.length; i += 3) { const t = q.t[i + 1]; q.t[i + 1] = q.t[i + 2]; q.t[i + 2] = t; }
  if (q.e) for (let i = 0; i < q.e.length; i += 2) { const t = q.e[i]; q.e[i] = q.e[i + 1]; q.e[i + 1] = t; }
  return q;
}
/** Planar uv projection (for textured pieces): axis 'x' | 'y' | 'z', scale in uv units per metre. */
export function projectUV(p, axis = 'x', scale = 1) {
  const q = p.compact(), v = q.v;
  const [a, b] = axis === 'x' ? [2, 1] : axis === 'y' ? [0, 2] : [0, 1];
  for (let i = 0; i < v.length; i += STRIDE) { v[i + 6] = v[i + a] * scale; v[i + 7] = v[i + b] * scale; }
  return q;
}
/**
 * Box uv projection per triangle (each triangle projected along its dominant normal axis, vertices duplicated):
 * no stretching on curved trim (seats, bolsters), in metres times scale.
 */
export function boxUV(p, scale = 1) {
  const q = new Patch(), v = p.v, T = p.t;
  for (let k = 0; k < T.length; k += 3) {
    const o = [T[k] * STRIDE, T[k + 1] * STRIDE, T[k + 2] * STRIDE];
    const ux = v[o[1]] - v[o[0]], uy = v[o[1] + 1] - v[o[0] + 1], uz = v[o[1] + 2] - v[o[0] + 2];
    const wx = v[o[2]] - v[o[0]], wy = v[o[2] + 1] - v[o[0] + 1], wz = v[o[2] + 2] - v[o[0] + 2];
    const nx = Math.abs(uy * wz - uz * wy), ny = Math.abs(uz * wx - ux * wz), nz = Math.abs(ux * wy - uy * wx);
    const [a, b] = nx >= ny && nx >= nz ? [2, 1] : ny >= nz ? [0, 2] : [0, 1];
    const ids = o.map((oo) => q.add(v[oo], v[oo + 1], v[oo + 2], v[oo + 3], v[oo + 4], v[oo + 5], v[oo + a] * scale, v[oo + b] * scale));
    q.tri(ids[0], ids[1], ids[2]);
  }
  return q;
}
export function mergePatches(list) {
  const ok = list.filter((q) => q && !q.isEmpty());
  if (!ok.length) return new Patch();
  const p = new Patch(ok[0].v);
  for (const q of ok) p.append(q);
  return p;
}

// ------------------------------------------------------------------------------------------- boundaries
/**
 * Open edges of a patch as chains of vertex indices, oriented so the patch is on the left (CCW seen from outside).
 * Returns { edges: [[a, b], ...], out: Map(vertex -> outward in-surface direction [x, y, z]) }.
 */
export function boundary(p) {
  const n = p.vertexCount, T = p.t, v = p.v;
  const edges = [];
  const okLen = (a, b) => { const oa = a * STRIDE, ob = b * STRIDE; return Math.hypot(v[ob] - v[oa], v[ob + 1] - v[oa + 1], v[ob + 2] - v[oa + 2]) > 1e-7; };
  if (p.e) {
    for (let k = 0; k < p.e.length; k += 2) if (okLen(p.e[k], p.e[k + 1])) edges.push([p.e[k], p.e[k + 1]]);
  } else {
    const count = new Map();
    for (let k = 0; k < T.length; k += 3) for (let e = 0; e < 3; e++) {
      const a = T[k + e], b = T[k + (e + 1) % 3];
      const key = a < b ? a * n + b : b * n + a;
      count.set(key, (count.get(key) || 0) + 1);
    }
    for (let k = 0; k < T.length; k += 3) for (let e = 0; e < 3; e++) {
      const a = T[k + e], b = T[k + (e + 1) % 3];
      const key = a < b ? a * n + b : b * n + a;
      if (count.get(key) === 1 && okLen(a, b)) edges.push([a, b]);
    }
  }
  const out = new Map();
  for (const [a, b] of edges) {
    const oa = a * STRIDE, ob = b * STRIDE;
    const dx = v[ob] - v[oa], dy = v[ob + 1] - v[oa + 1], dz = v[ob + 2] - v[oa + 2];
    for (const i of [a, b]) {
      const o = i * STRIDE;
      const nx = v[o + 3], ny = v[o + 4], nz = v[o + 5];
      // cross(edge, normal) points away from the patch interior
      let ex = dy * nz - dz * ny, ey = dz * nx - dx * nz, ez = dx * ny - dy * nx;
      const l = Math.hypot(ex, ey, ez) || 1; ex /= l; ey /= l; ez /= l;
      const acc = out.get(i) || [0, 0, 0];
      acc[0] += ex; acc[1] += ey; acc[2] += ez;
      out.set(i, acc);
    }
  }
  for (const [, e] of out) { const l = Math.hypot(e[0], e[1], e[2]) || 1; e[0] /= l; e[1] /= l; e[2] /= l; }
  return { edges, out };
}

/**
 * Rolled edge along every open edge of a patch: the panel curls down by `r` (quarter round) and continues as a
 * wall `depth` deep (along -normal, or along `axis` if given). opts.only(x, y, z) can skip edges.
 * Returns the roll as a separate Patch (same material as the panel) and, if wallPatch is requested, the wall
 * below the roll as a second patch (for dark insides of openings).
 */
/** Chain oriented boundary edges into vertex runs (loops repeat their first vertex at the end). */
export function chains(edges) {
  const next = new Map(), hasIn = new Set();
  for (const [a, b] of edges) { if (!next.has(a)) next.set(a, b); hasIn.add(b); }
  const used = new Set(), out = [];
  const walk = (s) => {
    const run = [s]; let c = s;
    while (next.has(c) && !used.has(c)) { used.add(c); c = next.get(c); run.push(c); if (c === s) break; }
    if (run.length > 1) out.push(run);
  };
  for (const [a] of edges) if (!hasIn.has(a) && !used.has(a)) walk(a);   // open chains first
  for (const [a] of edges) if (!used.has(a)) walk(a);                    // then loops
  return out;
}
/** Drop nearly collinear vertices from a run (keeps ends, turns > maxAngle, spacing <= maxLen). */
function decimate(run, v, maxAngle = 0.07, maxLen = 0.045) {
  if (run.length < 3) return run;
  const P = (i) => [v[i * STRIDE], v[i * STRIDE + 1], v[i * STRIDE + 2]];
  const keep = [run[0]];
  let last = P(run[0]), dir = null, acc = 0;
  for (let k = 1; k < run.length - 1; k++) {
    const p = P(run[k]), q = P(run[k + 1]);
    const d1 = [p[0] - last[0], p[1] - last[1], p[2] - last[2]], d2 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const l1 = Math.hypot(...d1), l2 = Math.hypot(...d2);
    if (l1 < 1e-9 || l2 < 1e-9) continue;
    const c = (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (l1 * l2);
    const ang = Math.acos(Math.max(-1, Math.min(1, c)));
    if (!dir) dir = d1.map((x) => x / l1);
    const dd = [q[0] - last[0], q[1] - last[1], q[2] - last[2]], ld = Math.hypot(...dd) || 1;
    const dev = Math.acos(Math.max(-1, Math.min(1, (dd[0] * dir[0] + dd[1] * dir[1] + dd[2] * dir[2]) / ld)));
    acc += ang;
    if (dev > maxAngle || acc > maxAngle * 2 || ld > maxLen) { keep.push(run[k]); last = p; dir = null; acc = 0; }
  }
  keep.push(run[run.length - 1]);
  return keep;
}

/**
 * Rolled edge along every open edge of a patch: the panel curls down by `r` (quarter round) and continues as a
 * wall `depth` deep (along -normal, or along `axis` if given). opts.only(x, y, z) can skip edges.
 * The boundary is simplified first (the roll is a few millimetres wide, its vertices need not match the panel's).
 * Returns the roll as a separate Patch (same material as the panel) or [roll, wall] with splitWall.
 */
export function roll(p, { r = 0.002, depth = 0.004, steps = 2, only = null, axis = null, splitWall = false, flare = 0, simplify = true } = {}) {
  const { edges, out } = boundary(p);
  const rollP = new Patch(), wallP = splitWall ? new Patch() : rollP;
  const v = p.v;
  const rowsR = new Map(), rowsW = new Map();
  const ring = (i) => {
    if (rowsR.has(i)) return;
    const o = i * STRIDE, e = out.get(i);
    const px = v[o], py = v[o + 1], pz = v[o + 2], nx = v[o + 3], ny = v[o + 4], nz = v[o + 5];
    const idx = [];
    for (let s = 0; s <= steps; s++) {
      const ph = (s / steps) * Math.PI / 2, sn = Math.sin(ph), cs = Math.cos(ph);
      const x = px + e[0] * r * sn - nx * r * (1 - cs), y = py + e[1] * r * sn - ny * r * (1 - cs), z = pz + e[2] * r * sn - nz * r * (1 - cs);
      let mx = nx * cs + e[0] * sn, my = ny * cs + e[1] * sn, mz = nz * cs + e[2] * sn;
      const l = Math.hypot(mx, my, mz) || 1;
      idx.push(rollP.add(x, y, z, mx / l, my / l, mz / l, v[o + 6], v[o + 7]));
    }
    rowsR.set(i, idx);
    const dep = typeof depth === 'function' ? depth(px, py, pz) : depth;
    if (dep > 0) {
      const top = idx[idx.length - 1], to = top * STRIDE, rv = rollP.v;
      const ax = axis ? axis[0] : -nx, ay = axis ? axis[1] : -ny, az = axis ? axis[2] : -nz;
      const w = [];
      if (splitWall) w.push(wallP.add(rv[to], rv[to + 1], rv[to + 2], e[0], e[1], e[2], v[o + 6], v[o + 7]));
      else w.push(top);
      w.push(wallP.add(rv[to] + ax * dep + e[0] * flare, rv[to + 1] + ay * dep + e[1] * flare, rv[to + 2] + az * dep + e[2] * flare, e[0], e[1], e[2], v[o + 6], v[o + 7]));
      rowsW.set(i, w);
    }
  };
  const runs = chains(edges);
  for (const run0 of runs) {
    const run = simplify ? decimate(run0, v) : run0;
    for (let k = 0; k < run.length - 1; k++) {
      const a = run[k], b = run[k + 1];
      if (only) {
        const oa = a * STRIDE, ob = b * STRIDE;
        if (!only((v[oa] + v[ob]) / 2, (v[oa + 1] + v[ob + 1]) / 2, (v[oa + 2] + v[ob + 2]) / 2)) continue;
      }
      ring(a); ring(b);
      const A = rowsR.get(a), Bv = rowsR.get(b);
      for (let s = 0; s < steps; s++) { rollP.tri(Bv[s], A[s], A[s + 1]); rollP.tri(Bv[s], A[s + 1], Bv[s + 1]); }
      const WA = rowsW.get(a), WB = rowsW.get(b);
      if (WA && WB) { wallP.tri(WB[0], WA[0], WA[1]); wallP.tri(WB[0], WA[1], WB[1]); }
    }
  }
  return splitWall ? [rollP, wallP] : rollP;
}

/**
 * Extrude the open edges of a patch along a direction (lamp housings behind lenses, tunnels behind openings).
 * Faces point inwards (towards the extrusion axis centre) when inward = true.
 */
export function skirt(p, dir, { inward = true, only = null } = {}) {
  const { edges } = boundary(p);
  const q = new Patch(), v = p.v, map = new Map();
  const top = (i) => { if (!map.has(i)) { const o = i * STRIDE; map.set(i, [q.add(v[o], v[o + 1], v[o + 2], 0, 0, 0), q.add(v[o] + dir[0], v[o + 1] + dir[1], v[o + 2] + dir[2], 0, 0, 0)]); } return map.get(i); };
  for (const [a, b] of edges) {
    if (only) { const oa = a * STRIDE; if (!only(v[oa], v[oa + 1], v[oa + 2])) continue; }
    const A = top(a), B = top(b);
    if (inward) { q.tri(A[0], B[0], B[1]); q.tri(A[0], B[1], A[1]); } else { q.tri(B[0], A[0], A[1]); q.tri(B[0], A[1], B[1]); }
  }
  return computeNormals(q);
}

// ------------------------------------------------------------------------------------------- sweeps
const crI = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
/** Catmull-Rom resample of 3D points (sub samples per span). */
export function smooth3(pts, sub = 4, closed = false) {
  if (sub <= 1 || pts.length < 3) return pts.map((p) => [...p]);
  const n = pts.length, out = [], segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k++) { const t = k / sub; out.push([0, 1, 2].map((d) => crI(p0[d], p1[d], p2[d], p3[d], t))); }
  }
  if (!closed) out.push([...pts[n - 1]]);
  return out;
}
/**
 * Sweep a 2D profile along a 3D path. profile: [[side, up], ...] (or fn(s) -> points, s = 0..1 along the path),
 * where side = cross(up, tangent) (outwards when the path runs forward along the car's left side) and up is
 * `up` (default world +Y) orthogonalised against the tangent. Faces are oriented so the profile's left side
 * (walking along the profile) faces out; pass flip to invert. opts: closed (path loop), capStart, capEnd,
 * sub (Catmull-Rom subdivisions of the path), upFn(p) -> custom up vector per path point.
 */
export function sweep(path, profile, { closed = false, up = [0, 1, 0], upFn = null, capStart = false, capEnd = false, sub = 1, flip = false, profileClosed = false } = {}) {
  const P = sub > 1 ? smooth3(path, sub, closed) : path.map((p) => [...p]);
  const n = P.length;
  const prof = typeof profile === 'function' ? profile : () => profile;
  const q = new Patch();
  const rows = [];
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
  const total = len[n - 1] || 1;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const U = upFn ? upFn(P[i]) : up;
    // up orthogonal to the tangent
    const dot = U[0] * tx + U[1] * ty + U[2] * tz;
    let ux = U[0] - tx * dot, uy = U[1] - ty * dot, uz = U[2] - tz * dot;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    // side = cross(up, tangent)
    const sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx;
    const pts = prof(len[i] / total, i);
    m = pts.length;
    const row = [];
    let arc = 0;
    for (let j = 0; j < pts.length; j++) {
      const [a2, b2] = pts[j];
      if (j) arc += Math.hypot(a2 - pts[j - 1][0], b2 - pts[j - 1][1]);
      row.push(q.add(P[i][0] + sx * a2 + ux * b2, P[i][1] + sy * a2 + uy * b2, P[i][2] + sz * a2 + uz * b2, 0, 0, 0, len[i], arc));
    }
    rows.push(row);
  }
  const cols = profileClosed ? m : m - 1;
  const R = closed ? n : n - 1;
  for (let i = 0; i < R; i++) {
    const r0 = rows[i], r1 = rows[(i + 1) % n];
    for (let j = 0; j < cols; j++) {
      const j1 = (j + 1) % m;
      if (flip) { q.tri(r0[j], r1[j], r1[j1]); q.tri(r0[j], r1[j1], r0[j1]); } else { q.tri(r0[j], r0[j1], r1[j1]); q.tri(r0[j], r1[j1], r1[j]); }
    }
  }
  const cap = (row, rev) => {
    let cx = 0, cy = 0, cz = 0;
    for (const k of row) { cx += q.v[k * STRIDE]; cy += q.v[k * STRIDE + 1]; cz += q.v[k * STRIDE + 2]; }
    const c = q.add(cx / row.length, cy / row.length, cz / row.length, 0, 0, 0);
    // caps get their own vertices so they stay flat-shaded
    const ring = row.map((k) => q.add(q.v[k * STRIDE], q.v[k * STRIDE + 1], q.v[k * STRIDE + 2], 0, 0, 0));
    for (let j = 0; j < ring.length - (profileClosed ? 0 : 1); j++) { const a2 = ring[j], b2 = ring[(j + 1) % ring.length]; if (rev !== flip) q.tri(c, a2, b2); else q.tri(c, b2, a2); }
  };
  if (!closed && capStart) cap(rows[0], true);
  if (!closed && capEnd) cap(rows[n - 1], false);
  return computeNormals(q);
}
/**
 * Bead along the open edges of a patch (window seals, trims): profile [[out, up], ...] in the edge frame
 * (out = away from the patch along the surface, up = surface normal). opts.only(x, y, z) filters edges.
 */
export function bead(p, profile, { only = null } = {}) {
  const { edges, out } = boundary(p);
  const q = new Patch(), v = p.v, rows = new Map();
  const ring = (i) => {
    if (rows.has(i)) return rows.get(i);
    const o = i * STRIDE, e = out.get(i);
    const r = profile.map(([a, b]) => q.add(v[o] + e[0] * a + v[o + 3] * b, v[o + 1] + e[1] * a + v[o + 4] * b, v[o + 2] + e[2] * a + v[o + 5] * b, 0, 0, 0));
    rows.set(i, r);
    return r;
  };
  for (const [a, b] of edges) {
    if (only) { const oa = a * STRIDE, ob = b * STRIDE; if (!only((v[oa] + v[ob]) / 2, (v[oa + 1] + v[ob + 1]) / 2, (v[oa + 2] + v[ob + 2]) / 2)) continue; }
    const A = ring(a), Bv = ring(b);
    for (let j = 0; j < profile.length - 1; j++) { q.tri(Bv[j], A[j], A[j + 1]); q.tri(Bv[j], A[j + 1], Bv[j + 1]); }
  }
  return computeNormals(q);
}

// ------------------------------------------------------------------------------------------- 1D interpolation
/** Monotone cubic (Fritsch-Carlson) through [x, y] pairs: smooth, never overshoots. */
export function monotone(xs, ys) {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

// ------------------------------------------------------------------------------------------- sections
/**
 * Sample a rounded half-section. C: corners [[x, y, r]], F: samples per corner fillet (first/last = half fillets
 * on the centreline), G: interior samples per straight segment. Corner fillets are quadratic Beziers between the
 * tangent points (softer than circular arcs, so reflections flow).
 */
export function roundedHalf(C, F, G) {
  const K = C.length;
  const P = (i) => (i < 0 ? [-C[-i][0], C[-i][1]] : i >= K ? [-C[2 * K - 2 - i][0], C[2 * K - 2 - i][1]] : C[i]);
  const tIn = new Array(K), tOut = new Array(K), dI = new Array(K), dO = new Array(K);
  for (let k = 0; k < K; k++) {
    const a = P(k - 1), b = P(k), c = P(k + 1);
    const ix = b[0] - a[0], iy = b[1] - a[1], li = Math.hypot(ix, iy) || 1e-9;
    const ox = c[0] - b[0], oy = c[1] - b[1], lo = Math.hypot(ox, oy) || 1e-9;
    dI[k] = [ix / li, iy / li, li]; dO[k] = [ox / lo, oy / lo, lo];
    const r = Math.max(0.0012, C[k][2] ?? 0.01);
    tIn[k] = r; tOut[k] = r;
  }
  for (let k = 0; k < K - 1; k++) {
    const L = dO[k][2] * 0.999, s = tOut[k] + tIn[k + 1];
    if (s > L) { const f = L / s; tOut[k] *= f; tIn[k + 1] *= f; }
  }
  // centreline corners are symmetric: both tangents equal the clamped one (and at most the half segment)
  tIn[0] = tOut[0] = Math.min(tOut[0], dO[0][2] * 0.999);
  tOut[K - 1] = tIn[K - 1] = Math.min(tIn[K - 1], dI[K - 1][2] * 0.999);
  const out = [];
  const bez = (k, s) => {
    const c = P(k), ti = [c[0] - dI[k][0] * tIn[k], c[1] - dI[k][1] * tIn[k]], to = [c[0] + dO[k][0] * tOut[k], c[1] + dO[k][1] * tOut[k]];
    const u = 1 - s;
    return [u * u * ti[0] + 2 * s * u * c[0] + s * s * to[0], u * u * ti[1] + 2 * s * u * c[1] + s * s * to[1]];
  };
  const fillet = (k, s0, s1, nPts) => { for (let i = 0; i < nPts; i++) out.push(bez(k, nPts === 1 ? s0 : s0 + (s1 - s0) * (i / (nPts - 1)))); };
  fillet(0, 0.5, 1, F[0]);
  for (let k = 0; k < K - 1; k++) {
    const c0 = P(k), c1 = P(k + 1);
    const a = [c0[0] + dO[k][0] * tOut[k], c0[1] + dO[k][1] * tOut[k]], b = [c1[0] - dI[k + 1][0] * tIn[k + 1], c1[1] - dI[k + 1][1] * tIn[k + 1]];
    const g = G[k];
    for (let j = 1; j <= g; j++) { const s = j / (g + 1); out.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]); }
    if (k + 1 < K - 1) fillet(k + 1, 0, 1, F[k + 1]);
  }
  fillet(K - 1, 0, 0.5, F[K - 1]);
  out[0][0] = 0; out[out.length - 1][0] = 0;
  return out;
}

/**
 * Lofted closed body surface.
 * stations: [{ z, pts: [[x, y, r], ...] }] sorted by z (rear first); the same corner count everywhere.
 * opts:
 *   fillet: samples per corner (number or array), seg: interior samples per segment (number or array)
 *   rows: stations along z (scaled by detail), cluster 0..1 extra density towards the ends
 *   capRear / capFront: { dome: m (bulge of the end face), rings, yc (centre height) } or false
 *   displace: [(x, y, z) => [dx, dy]] smooth displacement fields (flares, bulges); x = 0 stays on the centreline
 *   seg: function scaling counts by the detail setting
 */
export function loftBody(stations, opts = {}) {
  const K = stations[0].pts.length;
  const segF = opts.segFn || ((n) => n);
  const arr = (v, len, dflt) => Array.from({ length: len }, (_, i) => (Array.isArray(v) ? v[i] ?? dflt : v ?? dflt));
  const F = arr(opts.fillet, K, 6).map((n) => Math.max(2, Math.round(segF(n))));
  const G = arr(opts.seg, K - 1, 3).map((n) => Math.max(0, Math.round(segF(n))));
  // per-corner coordinate splines
  const zs = stations.map((s) => s.z);
  const spl = [];
  for (let k = 0; k < K; k++) {
    spl.push([0, 1, 2].map((c) => monotone(zs, stations.map((s) => s.pts[k][c] ?? (c === 2 ? 0.01 : 0)))));
  }
  const disp = opts.displace || [];
  const sectionAt = (z) => {
    const C = [];
    for (let k = 0; k < K; k++) C.push([k === 0 || k === K - 1 ? 0 : spl[k][0](z), spl[k][1](z), spl[k][2](z)]);
    const pts = roundedHalf(C, F, G);
    if (disp.length) for (const p of pts) { let dx = 0, dy = 0; for (const d of disp) { const r = d(p[0], p[1], z); dx += r[0]; dy += r[1]; } p[0] += dx; p[1] += dy; }
    pts[0][0] = 0; pts[pts.length - 1][0] = 0;
    return pts;
  };
  // corner sample indices (middle of each fillet) for corner traces
  const cornerIdx = [];
  { let i = 0; cornerIdx.push(0); i += F[0]; for (let k = 0; k < K - 1; k++) { i += G[k]; if (k + 1 < K - 1) { cornerIdx.push(i + (F[k + 1] - 1) / 2); i += F[k + 1]; } } cornerIdx.push(i + F[K - 1] - 1); }
  const z0 = zs[0], z1 = zs[zs.length - 1];
  const nRows = Math.max(12, Math.round(segF(opts.rows ?? 120)));
  const cl = opts.cluster ?? 0.35;
  const zRows = [];
  for (let i = 0; i <= nRows; i++) { const s = i / nRows; zRows.push(z0 + (z1 - z0) * ((1 - cl) * s + cl * (0.5 - 0.5 * Math.cos(Math.PI * s)))); }
  const sections = zRows.map((z) => ({ z, pts: sectionAt(z) }));
  const N = sections[0].pts.length;
  // rows of rings (with caps)
  const rows = [];
  const capRings = (cap, sec, sgn) => {
    if (!cap) return [];
    const m = Math.max(2, Math.round(segF(cap.rings ?? 8)));
    const ys = sec.pts.map((p) => p[1]);
    const yc = cap.yc ?? (Math.min(...ys) + Math.max(...ys)) / 2;
    const res = [];
    for (let k = 1; k <= m; k++) {
      const t = k / m, s = 1 - t;
      const dz = (cap.dome ?? 0.02) * (1 - s * s) + (cap.extend ?? 0) * t;
      res.push(k === m ? { pole: true, z: sec.z + sgn * dz, pt: [0, yc] } : { z: sec.z + sgn * dz, pts: sec.pts.map((p) => [p[0] * s, yc + (p[1] - yc) * s]) });
    }
    return res;
  };
  const rear = capRings(opts.capRear ?? { dome: 0.02 }, sections[0], -1).reverse();
  const front = capRings(opts.capFront ?? { dome: 0.02 }, sections[sections.length - 1], 1);
  for (const r of rear) rows.push(r);
  for (const s of sections) rows.push(s);
  for (const r of front) rows.push(r);
  // vertices: ring = left N (bottom -> top) + right N-2 (top -> bottom, mirrored)
  const p = new Patch();
  const M = 2 * N - 2;
  const rowIdx = [];
  rows.forEach((r, ri) => {
    const v = (ri / (rows.length - 1));
    if (r.pole) { rowIdx.push(p.add(0, r.pt[1], r.z, 0, 0, 0, 0.5, v)); return; }
    const base = p.vertexCount;
    for (let j = 0; j < M; j++) {
      const q = j < N ? r.pts[j] : r.pts[2 * N - 2 - j];
      const x = j < N ? q[0] : -q[0];
      p.add(x, q[1], r.z, 0, 0, 0, j < N ? j / (N - 1) * 0.5 : 1 - (2 * N - 2 - j) / (N - 1) * 0.5, v);
    }
    rowIdx.push(base);
  });
  const at = (ri, j) => (rows[ri].pole ? rowIdx[ri] : rowIdx[ri] + (j % M));
  for (let ri = 0; ri < rows.length - 1; ri++) {
    for (let j = 0; j < M; j++) {
      const A = at(ri, j), B = at(ri, j + 1), Cc = at(ri + 1, j + 1), D = at(ri + 1, j);
      if (A !== B) p.tri(A, B, Cc);
      if (Cc !== D) p.tri(A, Cc, D);
    }
  }
  computeNormals(p);
  p.e = [];
  // ---- queries (interpolated between sampled rows)
  const zArr = sections.map((s) => s.z);
  const rowAt = (z) => {
    if (z <= zArr[0]) return [0, 0, 0];
    if (z >= zArr[zArr.length - 1]) return [zArr.length - 1, zArr.length - 1, 0];
    let lo = 0, hi = zArr.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (zArr[mid] <= z) lo = mid; else hi = mid; }
    return [lo, hi, (z - zArr[lo]) / (zArr[hi] - zArr[lo])];
  };
  const lerpPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  /** Section point by sample index (fractional allowed) at z. */
  const pointAt = (z, idx) => {
    const [lo, hi, t] = rowAt(z);
    const i0 = Math.floor(idx), f = idx - i0, i1 = Math.min(N - 1, i0 + 1);
    const a = lerpPt(sections[lo].pts[i0], sections[lo].pts[i1], f), b = lerpPt(sections[hi].pts[i0], sections[hi].pts[i1], f);
    return lerpPt(a, b, t);
  };
  /** Outermost x of the surface at height y (0 if the section does not reach y). */
  const sideAt = (z, y) => {
    const [lo, hi, t] = rowAt(z);
    const w = (pts) => { let best = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const x = a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1])); if (x > best) best = x; } } return best; };
    return w(sections[lo].pts) * (1 - t) + w(sections[hi].pts) * t;
  };
  /** Highest y of the surface at lateral position x (NaN if outside). */
  const topAt = (z, x) => {
    const ax = Math.abs(x);
    const [lo, hi, t] = rowAt(z);
    const h = (pts) => { let best = -Infinity; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if ((a[0] - ax) * (b[0] - ax) <= 0 && a[0] !== b[0]) { const y = a[1] + (b[1] - a[1]) * ((ax - a[0]) / (b[0] - a[0])); if (y > best) best = y; } } return best; };
    const a = h(sections[lo].pts), b = h(sections[hi].pts);
    return a === -Infinity || b === -Infinity ? (a === -Infinity ? b : a) : a * (1 - t) + b * t;
  };
  /** Lowest y of the surface at lateral position x. */
  const bottomAt = (z, x) => {
    const ax = Math.abs(x);
    const [lo, hi, t] = rowAt(z);
    const h = (pts) => { let best = Infinity; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if ((a[0] - ax) * (b[0] - ax) <= 0 && a[0] !== b[0]) { const y = a[1] + (b[1] - a[1]) * ((ax - a[0]) / (b[0] - a[0])); if (y < best) best = y; } } return best; };
    return h(sections[lo].pts) * (1 - t) + h(sections[hi].pts) * t;
  };
  /** Point and outward normal on the surface: side (x at height y) or top (y at x). */
  const sidePoint = (z, y) => {
    const x = sideAt(z, y), e = 0.004;
    const dxdy = (sideAt(z, y + e) - sideAt(z, y - e)) / (2 * e), dxdz = (sideAt(z + e, y) - sideAt(z - e, y)) / (2 * e);
    const n = new THREE.Vector3(1, -dxdy, -dxdz).normalize();
    return { p: [x, y, z], n: [n.x, n.y, n.z] };
  };
  const topPoint = (z, x) => {
    const y = topAt(z, x), e = 0.004;
    const dydx = (topAt(z, x + e) - topAt(z, x - e)) / (2 * e), dydz = (topAt(z + e, x) - topAt(z - e, x)) / (2 * e);
    const n = new THREE.Vector3(-dydx, 1, -dydz).normalize();
    return { p: [x, y, z], n: [n.x, n.y, n.z] };
  };
  // corner traces sampled on a uniform z grid: O(1) lookups inside cut functions (called per vertex)
  const LUTN = 1024, zr = z1 - z0;
  const lut = cornerIdx.map((ci) => { const a = new Float64Array(LUTN * 2); for (let i = 0; i < LUTN; i++) { const q = pointAt(z0 + (zr * i) / (LUTN - 1), ci); a[i * 2] = q[0]; a[i * 2 + 1] = q[1]; } return a; });
  const corner = (k, z) => {
    let f = ((z - z0) / zr) * (LUTN - 1);
    f = f < 0 ? 0 : f > LUTN - 1 ? LUTN - 1 : f;
    const i = Math.min(LUTN - 2, Math.floor(f)), t = f - i, a = lut[k];
    return [a[i * 2] + (a[i * 2 + 2] - a[i * 2]) * t, a[i * 2 + 1] + (a[i * 2 + 3] - a[i * 2 + 1]) * t];
  };
  return {
    patch: p, sections, N, K, cornerIdx, z0, z1, sectionAt, corner,
    pointAt, sideAt, topAt, bottomAt, sidePoint, topPoint,
  };
}

// ------------------------------------------------------------------------------------------- 2D signed distances
export const sd = {
  /** Rounded rectangle centred (cx, cy), half sizes (hx, hy), corner radius r. */
  box: (px, py, cx, cy, hx, hy, r = 0) => {
    const dx = Math.abs(px - cx) - hx + r, dy = Math.abs(py - cy) - hy + r;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  },
  circle: (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r,
  /** Ellipse (approximate distance). */
  ellipse: (px, py, cx, cy, rx, ry) => { const x = (px - cx) / rx, y = (py - cy) / ry; const k = Math.hypot(x, y); return (k - 1) * Math.min(rx, ry); },
  /** Signed distance to a closed polygon [[x, y], ...] (negative inside). */
  poly: (px, py, pts) => {
    let d = Infinity, s = 1;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = pts[j][0], ay = pts[j][1], bx = pts[i][0], by = pts[i][1];
      const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      const qx = wx - ex * t, qy = wy - ey * t;
      d = Math.min(d, qx * qx + qy * qy);
      const c1 = py >= ay, c2 = py < by, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  },
  /** Distance to a polyline (unsigned) minus half width: a stroke. */
  stroke: (px, py, pts, w) => {
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], ex = pts[i + 1][0] - ax, ey = pts[i + 1][1] - ay, wx = px - ax, wy = py - ay;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    }
    return d - w / 2;
  },
  /** Signed vertical distance to a polyline y(x) given as [[x, y], ...] sorted by x: < 0 below it. */
  below: (px, py, pts) => py - lookup(pts, px),
  union: (a, b) => Math.min(a, b),
  inter: (a, b) => Math.max(a, b),
  sub: (a, b) => Math.max(a, -b),
  smin: (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; },
  smax: (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; },
};
/** Piecewise linear lookup in sorted [[x, y], ...] with clamped ends. */
export function lookup(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  const n = pts.length;
  if (x >= pts[n - 1][0]) return pts[n - 1][1];
  let i = 0;
  while (i < n - 2 && pts[i + 1][0] < x) i++;
  const a = pts[i], b = pts[i + 1];
  return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0]));
}
/** Smooth lookup (monotone cubic) with clamped ends; build once, call often. */
export function curve(pts) { const f = monotone(pts.map((p) => p[0]), pts.map((p) => p[1])); return (x) => f(Math.max(pts[0][0], Math.min(pts[pts.length - 1][0], x))); }

// ------------------------------------------------------------------------------------------- kit binding
export function makeBodyKit(kit) {
  const { M } = kit;
  const B = {
    Patch, clip, split, offset, flip, warp, mirror, roll, skirt, boundary, chains, boxUV, projectUV, sd, lookup, curve, monotone, sweep, bead, smooth3,
    fromGeometry, toGeometry, computeNormals, merge: mergePatches,
    /** Lofted body surface (see loftBody). Counts scale with the detail setting. */
    loft: (stations, opts = {}) => loftBody(stations, { segFn: (n) => Math.max(1, n * kit.detail * (opts.lod ?? 1)), ...opts }),
    /**
     * Cut a patch in two along f = 0 leaving a shut-line gap: returns [inside (f < 0), outside (f > 0)].
     * The visible gap is `gap`; rolls added later by assemble() eat `r` on each side.
     */
    cut: (p, f, { gap = 0.004, r = 0.0018 } = {}) => split(p, f, gap / 2 + r),
    /** Remove f <= 0 (openings) keeping a margin for the roll. */
    hole: (p, f, { r = 0.0018 } = {}) => clip(p, (x, y, z, u, v) => r - f(x, y, z, u, v)),
    /** Keep f <= 0 with a margin for the roll. */
    keep: (p, f, { r = 0.0018 } = {}) => clip(p, (x, y, z, u, v) => f(x, y, z, u, v) + r),
  };

  /**
   * Turn patches into meshes: one mesh per material key. pieces: { key: Patch | Patch[] | { patches, roll } }.
   * mats: { key: THREE.Material }. Rolled edges: roll: { r, depth } (default panel edge) or false.
   */
  B.assemble = (pieces, mats, { shadow = true, receive = true } = {}) => {
    const g = new THREE.Group();
    for (const [key, val] of Object.entries(pieces)) {
      const list = Array.isArray(val) ? val : val instanceof Patch ? [val] : val.patches;
      const rl = val instanceof Patch || Array.isArray(val) ? null : val.roll;
      const parts = [];
      for (const p of list) {
        if (!p || p.isEmpty()) continue;
        parts.push(p);
        if (rl) parts.push(roll(p, rl));
      }
      if (!parts.length) continue;
      const mat = mats[key];
      if (!mat) throw new Error(`assemble: no material for "${key}"`);
      const mesh = new THREE.Mesh(toGeometry(mergePatches(parts)), mat);
      mesh.name = key;
      mesh.castShadow = shadow && !(mat.transparent);
      mesh.receiveShadow = receive;
      g.add(mesh);
    }
    return g;
  };
  /** Mesh from patches with one material. */
  B.mesh = (patches, mat, { shadow = true, receive = true, name } = {}) => {
    const list = (Array.isArray(patches) ? patches : [patches]).filter((p) => p && !p.isEmpty());
    const m = new THREE.Mesh(toGeometry(mergePatches(list)), mat);
    m.castShadow = shadow; m.receiveShadow = receive;
    if (name) m.name = name;
    return m;
  };
  // ---- shared car materials (cached per factory)
  const texNormal = (key, repeat) => {
    if (!M.normalMapsAllowed?.()) return null;
    const t = getTextureSet(key, 256).normalMap?.clone();
    if (!t) return null;
    t.needsUpdate = true; t.repeat.set(repeat, repeat);
    return t;
  };
  const lens = (key, color, opacity, optic, rep) => M.shared(key, () => {
    const m = M.surface({ color, roughness: 0.04, metalness: 0, transparent: true, opacity, physical: true, normalMap: optic ? texNormal(optic, rep) : null });
    m.depthWrite = false;
    if (m.normalScale) m.normalScale.set(0.35, 0.35);
    if (m.isMeshPhysicalMaterial) { m.clearcoat = 1; m.clearcoatRoughness = 0.02; }
    return m;
  });
  B.mat = {
    blackPlastic: () => M.shared('car:blackPlastic', () => { const m = M.surface({ color: 0x141415, roughness: 0.66, normalMap: texNormal('grain', 40) }); if (m.normalScale) m.normalScale.set(0.45, 0.45); return m; }),
    satinBlack: () => M.shared('car:satinBlack', () => M.surface({ color: 0x0b0b0c, roughness: 0.34 })),
    glossBlack: () => M.shared('car:glossBlack', () => M.surface({ color: 0x040405, roughness: 0.05, metalness: 0.1, physical: true })),
    rubber: () => M.shared('car:rubber', () => M.surface({ color: 0x0d0d0e, roughness: 0.85 })),
    chrome: () => M.chrome(),
    brightMetal: () => M.shared('car:brightMetal', () => M.surface({ color: 0xc8cacd, roughness: 0.18, metalness: 1 })),
    darkMetal: () => M.shared('car:darkMetal', () => M.surface({ color: 0x3a3b3e, roughness: 0.45, metalness: 0.8 })),
    cavity: () => M.shared('car:cavity', () => M.surface({ color: 0x050505, roughness: 0.95 })),
    underbody: () => M.shared('car:underbody', () => M.surface({ color: 0x18191a, roughness: 0.9 })),
    reflector: () => M.shared('car:reflector', () => M.surface({ color: 0xd6d8dc, roughness: 0.1, metalness: 1 })),
    lensClear: (optic = null, rep = 6) => lens(`car:lensClear:${optic}:${rep}`, 0xffffff, 0.16, optic, rep),
    lensRed: (optic = null, rep = 6) => lens(`car:lensRed:${optic}:${rep}`, 0xc0160f, 0.62, optic, rep),
    lensAmber: (optic = null, rep = 6) => lens(`car:lensAmber:${optic}:${rep}`, 0xe08a12, 0.6, optic, rep),
    lensSmoke: (optic = null, rep = 6) => lens(`car:lensSmoke:${optic}:${rep}`, 0x2a2a2e, 0.55, optic, rep),
    frit: () => M.shared('car:frit', () => M.surface({ color: 0x030303, roughness: 0.12, metalness: 0.2, physical: true })),
    well: () => M.shared('well', () => M.surface({ color: 0x050505, roughness: 1, side: THREE.BackSide })),
    wellLiner: () => M.shared('car:wellLiner', () => M.surface({ color: 0x0c0c0d, roughness: 0.95 })),
  };
  /** Registered light emitter (runtime animates emissiveIntensity). kind: head brake reverse indicator drl fog. */
  B.emitter = (kind, color, base = 0.05) => {
    const m = M.lightLens(color, base);
    (kit._lights[kind] ||= []).push(m);
    return m;
  };
  // ---- decals: a piece of the surface re-textured with a canvas (badges, lettering, stripes)
  B.canvas = (w, h) => makeCanvas(w, h);
  /** Canvas -> sRGB texture (no repeat). */
  B.tex = (c, srgb = true) => canvasTexture(c, { repeat: false, srgb });
  B.fonts = { ui: FONT_UI, cjk: FONT_CJK };
  /** Canvas with text, transparent background. opts: { w, h, font, size, weight, color, spacing, italic, stroke, align } */
  B.textCanvas = (text, o = {}) => {
    const w = o.w ?? 1024, h = o.h ?? 256;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    const size = o.size ?? h * 0.7;
    g.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 700} ${size}px ${o.font ?? FONT_UI}`;
    g.textBaseline = 'middle';
    g.textAlign = o.align ?? 'center';
    if ('letterSpacing' in g && o.spacing) g.letterSpacing = `${o.spacing}px`;
    const x = o.align === 'left' ? (o.pad ?? 0) : o.align === 'right' ? w - (o.pad ?? 0) : w / 2;
    if (o.stroke) { g.lineWidth = o.strokeWidth ?? size * 0.08; g.strokeStyle = o.stroke; g.strokeText(text, x, h / 2); }
    g.fillStyle = o.color ?? '#e8e8e8';
    g.fillText(text, x, h / 2 + (o.dy ?? 0));
    return c;
  };
  B.decalMat = (canvas, { roughness = 0.35, metalness = 0, key = null, emissive = null } = {}) => {
    const make = () => {
      const t = canvasTexture(canvas, { repeat: false });
      const m = M.surface({ map: t, transparent: true, roughness, metalness, alphaTest: 0.35 });
      m.depthWrite = false;
      m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4;
      if (emissive != null && m.emissive) { m.emissive.set(emissive); m.emissiveMap = t; }
      return m;
    };
    return key ? M.shared(`decal:${key}`, make) : make();
  };
  /**
   * Decal on a surface patch: region f(x, y, z) <= 0, projected along axis ('x' side, 'z' front/rear, 'y' top)
   * so that plane coords [a0, b0]..[a0 + w, b0 + h] map to uv 0..1. flipU mirrors (use on the side whose
   * reading direction runs against +a).
   */
  B.decal = (patch, f, { axis = 'x', a0, b0, w, h, flipU = false, lift = 0.0008, material }) => {
    let piece = clip(patch, f);
    if (piece.isEmpty()) return null;
    piece = offset(piece, lift);
    const v = piece.v;
    const [ia, ib] = axis === 'x' ? [2, 1] : axis === 'z' ? [0, 1] : [0, 2];
    for (let i = 0; i < v.length; i += STRIDE) {
      let u = (v[i + ia] - a0) / w; if (flipU) u = 1 - u;
      v[i + 6] = u; v[i + 7] = (v[i + ib] - b0) / h;
    }
    const m = new THREE.Mesh(toGeometry(piece), material);
    m.renderOrder = 1; m.castShadow = false; m.receiveShadow = true;
    return m;
  };
  // ---- shared shapes
  /** Fan caps over every open loop of a patch (mirror glass, lamp backs). Faces away from the patch normal side unless flip. */
  B.capLoops = (p, { flip: fl = false, lift = 0 } = {}) => {
    const { edges } = boundary(p);
    const q = new Patch(), v = p.v;
    for (const run of chains(edges)) {
      if (run.length < 4 || run[0] !== run[run.length - 1]) continue;
      let cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0;
      const pts = run.slice(0, -1);
      for (const i of pts) { const o = i * STRIDE; cx += v[o]; cy += v[o + 1]; cz += v[o + 2]; nx += v[o + 3]; ny += v[o + 4]; nz += v[o + 5]; }
      cx /= pts.length; cy /= pts.length; cz /= pts.length;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const c = q.add(cx + nx * lift, cy + ny * lift, cz + nz * lift, 0, 0, 0);
      const ring = pts.map((i) => { const o = i * STRIDE; return q.add(v[o] + nx * lift, v[o + 1] + ny * lift, v[o + 2] + nz * lift, 0, 0, 0); });
      for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; if (fl) q.tri(c, a, b); else q.tri(c, b, a); }
    }
    // caps are flat: one normal for all their vertices (fan triangles can be degenerate near the rim)
    computeNormals(q);
    let ax = 0, ay = 0, az = 0;
    for (let i = 0; i < q.v.length; i += STRIDE) { ax += q.v[i + 3]; ay += q.v[i + 4]; az += q.v[i + 5]; }
    const al = Math.hypot(ax, ay, az) || 1;
    for (let i = 0; i < q.v.length; i += STRIDE) { q.v[i + 3] = ax / al; q.v[i + 4] = ay / al; q.v[i + 5] = az / al; }
    return q;
  };
  /** Ellipsoid patch centred at the origin. */
  B.ellipsoid = (rx, ry, rz, seg = 20) => {
    const n = Math.max(8, Math.round(seg * kit.detail));
    const g = new THREE.SphereGeometry(1, n * 2, n);
    g.scale(rx, ry, rz);
    return fromGeometry(g);
  };
  /** Plan-view U path (bumpers, skirts): side at half width wx from zEnd towards the face at zFace, corner radius rc. */
  B.planPath = (wx, zEnd, zFace, rc, n = 9, y = 0) => {
    const pts = [], sgn = Math.sign(zFace);
    pts.push([wx, y, zEnd]);
    pts.push([wx, y, zEnd + (zFace - sgn * rc - zEnd) * 0.5]);
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([wx - rc + Math.cos(a) * rc, y, zFace - sgn * rc + sgn * Math.sin(a) * rc]); }
    pts.push([Math.min(0.25, wx - rc - 0.01), y, zFace]);
    const right = pts.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]]);
    pts.push([0, y, zFace]);
    return sgn > 0 ? pts.concat(right) : pts.concat(right).reverse();
  };
  B.pathLength = (path, sub = 1) => { const P = sub > 1 ? smooth3(path, sub) : path; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return L; };
  /**
   * Modern door mirror (left side; mirrored for side = -1): ellipsoid housing cut flat at the back for the glass,
   * stalk to the door. o: { base: [x, y, z] on the door, size: [w, h, d], mat, capMat, stalkMat, glassMat, out, up, indicator }
   */
  B.doorMirror = (o) => {
    const g = new THREE.Group();
    const [w, h, d] = o.size ?? [0.2, 0.11, 0.09];
    const [bx, by, bz] = o.base;
    const cx = bx + (o.out ?? 0.07) + w / 2, cy = by + (o.up ?? 0.03), cz = bz;
    let shellP = B.ellipsoid(w / 2, h / 2, d / 2, 22);
    shellP = warp(shellP, (x, y, z) => [cx + x + (z > 0 ? 0 : -z * 0.15) * Math.sign(x), cy + y * (1 - Math.max(0, x / w) * 0.15), cz + z * (z > 0 ? 1.15 : 1)], true);
    const zBack = cz - d * 0.22;
    let housing = clip(shellP, (x, y, z) => zBack - z);
    const glassP = B.capLoops(housing, { flip: true });
    // body-colour cap on the front, darker lower half
    const [capP, lowP] = split(housing, (x, y, z) => cy - 0.006 - y + (z - cz) * 0.2, 0.0015);
    g.add(B.mesh([capP, roll(capP, { r: 0.0012, depth: 0.003 })], o.capMat ?? kit.paint));
    g.add(B.mesh([lowP, roll(lowP, { r: 0.0012, depth: 0.003 })], o.mat ?? B.mat.satinBlack()));
    const gm = B.mesh([offset(glassP, -0.004)], o.glassMat ?? M.shared('car:mirrorGlass', () => M.surface({ color: 0xa8b0ba, roughness: 0.02, metalness: 1 })));
    g.add(gm);
    g.add(B.mesh([bead(housing, [[-0.003, 0], [0.0, 0.003], [0.003, 0]])], B.mat.satinBlack()));
    // stalk: tapered sweep from the door to the housing
    const st = sweep([[bx - 0.005, by, bz + 0.01], [bx + (o.out ?? 0.07) * 0.6, by + (o.up ?? 0.03) * 0.5, bz], [cx - w * 0.3, cy - h * 0.15, cz]], (s) => { const k = 1 - 0.35 * s; return [[-0.03 * k, -0.014], [0.03 * k, -0.014], [0.03 * k, 0.012], [-0.03 * k, 0.012]]; }, { sub: 4, profileClosed: true, upFn: () => [0, 1, 0] });
    g.add(B.mesh([st], o.stalkMat ?? B.mat.satinBlack()));
    if (o.indicator) {
      const ind = clip(shellP, (x, y, z) => Math.max(B.sd.box(x - cx, y - cy, w * 0.18, -h * 0.05, w * 0.24, h * 0.07, 0.006), -(z - cz) + 0.0));
      g.add(B.mesh([offset(ind, 0.0006)], B.mat.lensAmber()));
    }
    if (o.side === -1) g.scale.x = -1;
    return g;
  };
  /**
   * Project onto a patch along an axis: returns { p: [x, y, z], n: [nx, ny, nz] } of the hit nearest to `toward`
   * (axis 'z': a = x, b = y; 'x': a = z, b = y; 'y': a = x, b = z), or null. Brute force: use on small patches.
   */
  B.project = (patch, axis, a, b, toward = Infinity) => {
    const v = patch.v, T = patch.t;
    const [ia, ib, ic] = axis === 'z' ? [0, 1, 2] : axis === 'x' ? [2, 1, 0] : [0, 2, 1];
    let best = null, bestD = Infinity;
    for (let k = 0; k < T.length; k += 3) {
      const o0 = T[k] * STRIDE, o1 = T[k + 1] * STRIDE, o2 = T[k + 2] * STRIDE;
      const ax = v[o0 + ia], ay = v[o0 + ib], bx = v[o1 + ia], by = v[o1 + ib], cx = v[o2 + ia], cy = v[o2 + ib];
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(det) < 1e-14) continue;
      const l0 = ((by - cy) * (a - cx) + (cx - bx) * (b - cy)) / det, l1 = ((cy - ay) * (a - cx) + (ax - cx) * (b - cy)) / det, l2 = 1 - l0 - l1;
      if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
      const c = l0 * v[o0 + ic] + l1 * v[o1 + ic] + l2 * v[o2 + ic];
      const d = Math.abs(c - toward);
      if (d < bestD) {
        bestD = d;
        const n = [0, 1, 2].map((q) => l0 * v[o0 + 3 + q] + l1 * v[o1 + 3 + q] + l2 * v[o2 + 3 + q]);
        const nl = Math.hypot(...n) || 1;
        const pt = [0, 0, 0]; pt[ia] = a; pt[ib] = b; pt[ic] = c;
        best = { p: pt, n: n.map((q) => q / nl) };
      }
    }
    return best;
  };
  // ---- cabin helpers
  /**
   * Interior trim shell: the body surface inside the cabin pushed inwards by thick(x, y, z), with returns that
   * reach the glass, split into roof lining, pillar trims and door cards (+ insert regions).
   * o: { zFront, zBack, yLow, holes: [glass region f], arches, archFn, thick, belt(z), onTop, overlap,
   *      mats: { roof, pillar, card }, inserts: [{ f, mat, gap }] }
   */
  B.trimShell = (S, o) => {
    let shell = clip(S.patch, (x, y, z) => Math.max(z - o.zFront, o.zBack - z, o.yLow - y));
    for (const a of o.arches || []) shell = clip(shell, (x, y, z) => -o.archFn(a, 0.01)(x, y, z));
    const ov = o.overlap ?? 0.008;
    for (const f of o.holes) shell = clip(shell, (x, y, z) => -(f(x, y, z) + ov));
    const innerAll = flip(offset(shell, (x, y, z) => -o.thick(x, y, z)));
    const lip = roll(innerAll, { r: 0.003, depth: (x, y, z) => o.thick(x, y, z) + 0.002, only: (x, y, z) => Math.abs(z - o.zFront) > 0.02 && Math.abs(z - o.zBack) > 0.02 && y > o.yLow + 0.04 });
    const trim = mergePatches([innerAll, lip]);
    const [lower, upper] = split(trim, (x, y, z) => y - o.belt(z) - (o.beltLift ?? 0.012), 0);
    const [roof, pillar] = split(upper, (x, y, z) => o.onTop(x, y, z) + 0.01, 0);
    const g = new THREE.Group(); g.name = 'trim';
    let rest = lower;
    for (const ins of o.inserts || []) { const [a, b] = split(rest, ins.f, ins.gap ?? 0.003); g.add(B.mesh([projectUV(a, 'x', 1)], ins.mat, { name: 'trim-insert' })); rest = b; }
    g.add(B.mesh([projectUV(rest, 'x', 1)], o.mats.card, { name: 'trim-card' }));
    g.add(B.mesh([projectUV(roof, 'y', 1)], o.mats.roof, { name: 'trim-roof' }));
    g.add(B.mesh([projectUV(pillar, 'x', 1)], o.mats.pillar, { name: 'trim-pillar' }));
    return g;
  };
  /** Carpeted floor pan: height field y = fy(x, z) clipped to the inside of the body (minus margin(y, z)). */
  B.floorPan = (S, { x0 = -0.8, x1 = 0.8, z0, z1, fy, margin = () => 0.04, nx = 40, nz = 64 }) => {
    const NX = Math.max(16, Math.round(nx * kit.detail)), NZ = Math.max(24, Math.round(nz * kit.detail));
    const p = new Patch();
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = x0 + (x1 - x0) * (i / NX), z = z0 + (z1 - z0) * (j / NZ); p.add(x, fy(x, z), z, 0, 1, 0, x, z); }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; p.tri(a, c, b); p.tri(b, c, d); }
    computeNormals(p);
    return clip(p, (x, y, z) => Math.abs(x) - (S.sideAt(z, y + 0.06) - margin(y, z)));
  };
  /** Dash/console sweep across x (path from +half to -half); prof(x) -> [[z, y], ...] (same count for every x). */
  B.dashSweep = (half, prof, { n = 90, clipTo = null } = {}) => {
    const N = Math.max(30, Math.round(n * kit.detail));
    const path = [];
    for (let i = 0; i <= N; i++) path.push([half - (2 * half * i) / N, 0, 0]);
    let p = sweep(path, (s) => prof(half - 2 * half * s), { up: [0, 1, 0], flip: true });
    if (clipTo) p = clip(p, clipTo);
    return p;
  };
  /** Geometry helpers as patches. */
  B.from = (g) => fromGeometry(g);
  /**
   * Window glass seen from both sides: tinted and reflective from outside, nearly clear from inside (the
   * cockpit camera looks through it). Returns a Group of two meshes sharing one geometry.
   */
  B.glass = (patches, { tint = 0x1a2024, outer = 0.55, inner = 0.12, name = 'glass' } = {}) => {
    const geom = toGeometry(mergePatches((Array.isArray(patches) ? patches : [patches]).filter((p) => p && !p.isEmpty())));
    const mo = M.shared(`glassOut:${tint}:${outer}`, () => { const m = M.glass(tint, outer).clone(); m.side = THREE.FrontSide; return m; });
    const mi = M.shared(`glassIn:${tint}:${inner}`, () => { const m = M.glass(tint, inner).clone(); m.side = THREE.BackSide; if (m.envMapIntensity !== undefined) m.envMapIntensity = 0.5; return m; });
    const g = new THREE.Group(); g.name = name;
    const a = new THREE.Mesh(geom, mo), b = new THREE.Mesh(geom, mi);
    a.renderOrder = 3; b.renderOrder = 2;
    a.castShadow = b.castShadow = false;
    g.add(a, b);
    return g;
  };

  /**
   * Wheel well: liner (cylinder) + inner wall, clipped to stay inside the body surface S.
   * { z, y: wheel centre height, r: arch radius, xi: inner wall x, bottom: lowest y }
   */
  B.wheelWell = (S, { z, y, r, xi, bottom = 0.12, margin = 0.004, seg = 28 }) => {
    const n = Math.max(12, Math.round(seg * kit.detail));
    const xo = 1.4;
    const cyl = new THREE.CylinderGeometry(r, r, xo - xi, n, 1, true);
    cyl.rotateZ(Math.PI / 2);
    cyl.translate((xo + xi) / 2, y, z);
    let liner = flip(fromGeometry(cyl.toNonIndexed ? cyl : cyl));
    liner = clip(liner, (x, yy, zz) => x - (S.sideAt(zz, yy) - margin));
    liner = clip(liner, (x, yy) => bottom - yy);
    const wallG = new THREE.CircleGeometry(r, n);
    wallG.rotateY(Math.PI / 2); // faces +x (towards the wheel)
    wallG.translate(xi, y, z);
    let wall = clip(fromGeometry(wallG), (x, yy) => bottom - yy);
    const left = mergePatches([liner, wall]);
    return mergePatches([left, mirror(left)]);
  };
  return B;
}
