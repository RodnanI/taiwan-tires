// Geometry helpers for building cars (and anything else) from numbers. All functions return THREE.BufferGeometry.
// Vehicle frame: +Z forward, +Y up, +X = car's LEFT. Units: metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { curveLookupSmooth } from '../../core/math.js';

const crInterp = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** Catmull-Rom resample of a 2D/3D point list to (n-1)*sub+1 points. */
export function smoothPolyline(pts, sub, closed = false) {
  if (sub <= 1 || pts.length < 3) return pts.map((p) => [...p]);
  const out = [];
  const n = pts.length, dim = pts[0].length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const q = [];
      for (let d = 0; d < dim; d++) q.push(crInterp(p0[d], p1[d], p2[d], p3[d], t));
      out.push(q);
    }
  }
  if (!closed) out.push([...pts[n - 1]]);
  return out;
}

/**
 * Loft a surface through cross-sections placed along Z.
 * sections: [{ z, pts: [[x, y], ...] }] all with the same point count.
 *   mirror=true : pts is the LEFT half from bottom centre (x=0) round to top centre (x=0); the right half is mirrored.
 *   mirror=false: pts is a full loop (closed=true) or an open strip (closed=false).
 * opts: { mirror=true, closed=true, capStart=false, capEnd=false, smoothZ=1, smoothU=1 }
 */
export function loft(sections, opts = {}) {
  const { mirror = true, closed = true, capStart = false, capEnd = false, smoothZ = 1, smoothU = 1 } = opts;
  if (!sections.length) return new THREE.BufferGeometry();
  // expand each section into a full ring
  let rings = sections.map((s) => {
    let pts = s.pts.map((p) => [p[0], p[1]]);
    if (smoothU > 1) pts = smoothPolyline(pts, smoothU, !mirror && closed);
    if (mirror) {
      const right = pts.slice(1, -1).reverse().map((p) => [-p[0], p[1]]);
      pts = pts.concat(right);
    }
    return pts.map((p) => [p[0], p[1], s.z]);
  });
  const loop = mirror || closed;
  // smooth along z: interpolate ring point i through the sections
  if (smoothZ > 1 && rings.length > 2) {
    const m = rings[0].length;
    const tracks = [];
    for (let i = 0; i < m; i++) tracks.push(smoothPolyline(rings.map((r) => r[i]), smoothZ, false));
    rings = tracks[0].map((_, k) => tracks.map((t) => t[k]));
  }
  const nR = rings.length, m = rings[0].length;
  const pos = [], uv = [], idx = [];
  for (let r = 0; r < nR; r++) {
    // arc length for u
    let total = 0; const acc = [0];
    for (let i = 1; i <= (loop ? m : m - 1); i++) { const a = rings[r][i - 1], b = rings[r][i % m]; total += Math.hypot(a[0] - b[0], a[1] - b[1]); acc.push(total); }
    const cols = loop ? m + 1 : m; // duplicate seam column for clean UVs
    for (let i = 0; i < cols; i++) {
      const p = rings[r][i % m];
      pos.push(p[0], p[1], p[2]);
      uv.push(total > 0 ? acc[i] / total : 0, nR > 1 ? r / (nR - 1) : 0);
    }
  }
  const cols = loop ? m + 1 : m;
  for (let r = 0; r < nR - 1; r++) for (let i = 0; i < cols - 1; i++) {
    const a = r * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (r, flip) => {
    const ring = rings[r];
    let cx = 0, cy = 0;
    ring.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= m; cy /= m;
    const base = pos.length / 3;
    pos.push(cx, cy, ring[0][2]); uv.push(0.5, 0.5);
    ring.forEach((p) => { pos.push(p[0], p[1], p[2]); uv.push(0.5 + p[0], 0.5 + p[1]); });
    for (let i = 0; i < m; i++) {
      const a = base + 1 + i, b = base + 1 + ((i + 1) % m);
      if (flip) idx.push(base, a, b); else idx.push(base, b, a);
    }
  };
  if (capStart && loop) cap(0, true);
  if (capEnd && loop) cap(nR - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const asFn = (v, dflt) => (typeof v === 'function' ? v : Array.isArray(v) ? (z) => curveLookupSmooth(v, z) : () => (v ?? dflt));

/**
 * Car-body shell from 2D profiles (the quickest way to a believable body).
 *  top:       [[z, y]] centreline height of the upper surface (hood/roof/deck line), or number
 *  bottom:    [[z, y]] centreline height of the underside, or number
 *  halfWidth: [[z, w]] half width at the widest point of each section
 *  shoulder:  0..1 (or [[z, s]]) where the section is widest, as a fraction of bottom->top
 *  tumble:    0..0.5 inward lean of the upper side (tumblehome)
 *  roundTop / roundBottom: superellipse exponents (2 = round, 4 = boxy)
 *  arches:    [{ z, y, r, depth }] wheel-arch recesses on both sides (y = wheel centre height)
 *  z0, z1, segZ, segU, caps
 */
export function shell(o) {
  const top = asFn(o.top, 1.2), bot = asFn(o.bottom, 0.25), half = asFn(o.halfWidth, 0.85), shoulder = asFn(o.shoulder, 0.55), tumble = asFn(o.tumble, 0.08);
  const z0 = o.z0 ?? -2.2, z1 = o.z1 ?? 2.2;
  const nz = o.segZ ?? 56, nu = o.segU ?? 12;
  const nUp = o.roundTop ?? 3.2, nLow = o.roundBottom ?? 5;
  const arches = o.arches || [];
  const sections = [];
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * (0.5 - 0.5 * Math.cos((Math.PI * i) / nz));
    const yT = top(z), yB = bot(z), hw = Math.max(0.01, half(z));
    const sh = Math.min(0.95, Math.max(0.05, shoulder(z))), tb = tumble(z);
    const yS = yB + (yT - yB) * sh;
    const pts = [];
    for (let k = 0; k <= nu; k++) {
      const t = (Math.PI / 2) * (1 - k / nu);
      pts.push([hw * Math.pow(Math.cos(t), 2 / nLow), yS - (yS - yB) * Math.pow(Math.sin(t), 2 / nLow)]);
    }
    for (let k = 1; k <= nu; k++) {
      const t = (Math.PI / 2) * (k / nu);
      const s = Math.sin(t);
      pts.push([hw * Math.pow(Math.cos(t), 2 / nUp) * (1 - tb * s), yS + (yT - yS) * Math.pow(s, 2 / nUp)]);
    }
    for (const a of arches) {
      const dz = z - a.z;
      if (Math.abs(dz) >= a.r) continue;
      const yA = a.y + Math.sqrt(a.r * a.r - dz * dz);
      const inner = hw - (a.depth ?? 0.12);
      for (const p of pts) if (p[1] < yA && p[0] > inner) p[0] = inner;
    }
    sections.push({ z, pts });
  }
  return loft(sections, { mirror: true, capStart: o.caps !== false, capEnd: o.caps !== false });
}

/** Lathe around the local X axis (axles, exhaust tips, knobs). points: [[radius, x], ...] */
export function latheX(points, segments = 24) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments);
  g.rotateZ(-Math.PI / 2); // lathe axis Y -> X
  return g;
}
/** Lathe around the local Z axis (pipes pointing backwards, lamps). points: [[radius, z], ...] */
export function latheZ(points, segments = 24) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments);
  g.rotateX(Math.PI / 2); // Y -> Z
  return g;
}
/** Tube through 3D points. */
export function tube(points, radius = 0.02, tubular = 32, radial = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}
/**
 * Extrude a 2D outline. axis 'x': outline is in (z, y) and extruded along X (side-profile parts, fenders);
 * axis 'z': outline in (x, y) extruded along Z; axis 'y': outline in (x, z) extruded along Y (flat plates).
 */
export function extrude(outline, depth, { axis = 'x', bevel = 0.005, bevelSegments = 2, center = true, curveSegments = 8 } = {}) {
  const shape = new THREE.Shape(outline.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments });
  if (center) g.translate(0, 0, -depth / 2);
  if (axis === 'z') return g;
  // axis swaps are reflections: permute coordinates then flip the triangle winding back
  const m = new THREE.Matrix4();
  if (axis === 'x') m.set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1); // (a,b,d) -> (d,b,a)
  else m.set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);               // (a,b,d) -> (a,d,b)
  g.applyMatrix4(m);
  return fixWinding(g, true);
}
/** Rounded box centred at origin. */
export function roundedBox(w, h, d, r = 0.02, seg = 2) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)); }
export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
export function cylinderX(r, len, seg = 20) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return g; }
export function cylinderZ(r, len, seg = 20) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return g; }

/** Apply position [x,y,z], rotation [rx,ry,rz] (radians, XYZ) and scale to a geometry (in place). */
export function place(g, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  g.applyMatrix4(m);
  return g;
}
/** Mirrored copy across the car's centre plane (x -> -x) with corrected winding. */
export function mirrorX(g) {
  const c = g.clone();
  c.scale(-1, 1, 1);
  return fixWinding(c, true);
}
/** Mirror and merge (symmetric parts: build the left one, get both). */
export function symmetric(g) { return merge([g, mirrorX(g)]); }

export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => {
    let x = g.index ? g : g;
    if (!x.attributes.uv) { const n = x.attributes.position.count; x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); }
    if (!x.attributes.normal) x.computeVertexNormals();
    return x;
  });
  const allIndexed = list.every((g) => g.index), noneIndexed = list.every((g) => !g.index);
  const norm = allIndexed || noneIndexed ? list : list.map((g) => (g.index ? g.toNonIndexed() : g));
  const keep = ['position', 'normal', 'uv'];
  norm.forEach((g) => Object.keys(g.attributes).forEach((k) => { if (!keep.includes(k)) g.deleteAttribute(k); }));
  return mergeGeometries(norm, false) || new THREE.BufferGeometry();
}

function fixWinding(g, flip = false) {
  if (!flip) { g.computeVertexNormals(); return g; }
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.index.needsUpdate = true;
  } else {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      for (const attr of Object.values(g.attributes)) {
        const s = attr.itemSize;
        for (let k = 0; k < s; k++) { const t = attr.array[(i + 1) * s + k]; attr.array[(i + 1) * s + k] = attr.array[(i + 2) * s + k]; attr.array[(i + 2) * s + k] = t; }
      }
    }
  }
  g.computeVertexNormals();
  return g;
}
