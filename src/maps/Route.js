// A drivable path (race route / road centreline): evenly spaced samples with tangents, lateral normals,
// half widths, cumulative distance, an optimised racing line and projection helpers.
import { clamp } from '../core/math.js';

export class Route {
  /**
   * @param samples [{ x, y, z, w }] centreline points ~2 m apart (w = full road width)
   * @param o { closed, id, name }
   */
  constructor(samples, { closed = false, id = 'route', name = '' } = {}) {
    this.id = id; this.name = name; this.closed = closed;
    const n = samples.length;
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
    this.tx = new Float32Array(n); this.tz = new Float32Array(n); // tangent (horizontal, unit)
    this.half = new Float32Array(n); this.dist = new Float32Array(n);
    this.off = new Float32Array(n); // racing-line lateral offset (+ = left of travel)
    this.curv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const s = samples[i]; this.x[i] = s.x; this.y[i] = s.y; this.z[i] = s.z; this.half[i] = (s.w ?? 10) / 2; }
    for (let i = 0; i < n; i++) {
      const a = this.idx(i - 1), b = this.idx(i + 1);
      let dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l; this.tz[i] = dz / l;
      if (i > 0) this.dist[i] = this.dist[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.z[i] - this.z[i - 1]);
    }
    this.length = this.dist[n - 1] + (closed ? Math.hypot(this.x[0] - this.x[n - 1], this.z[0] - this.z[n - 1]) : 0);
    this.optimizeLine();
  }
  idx(i) { const n = this.n; return this.closed ? ((i % n) + n) % n : clamp(i, 0, n - 1); }
  /** Left-pointing lateral normal (+X is left when facing +Z): n = (tz, -tx)? -> left of travel = (tz, -tx) rotated. */
  nx(i) { return this.tz[i]; }
  nz(i) { return -this.tx[i]; }

  /** Minimum-curvature-ish racing line by iterative Laplacian smoothing inside the road edges. */
  optimizeLine(margin = 1.4) {
    const n = this.n, px = new Float32Array(n), pz = new Float32Array(n);
    for (let i = 0; i < n; i++) { px[i] = this.x[i]; pz[i] = this.z[i]; this.off[i] = 0; }
    // multi-scale smoothing: long corners need wide stencils, short ones narrow
    for (const k of [32, 16, 8, 4, 2, 1]) {
      for (let it = 0; it < 40; it++) {
        for (let i = 0; i < n; i++) {
          if (!this.closed && (i < k || i > n - 1 - k)) continue;
          const a = this.idx(i - k), b = this.idx(i + k);
          const mx = (px[a] + px[b]) / 2, mz = (pz[a] + pz[b]) / 2;
          let lat = (mx - this.x[i]) * this.nx(i) + (mz - this.z[i]) * this.nz(i);
          const lim = Math.max(0, this.half[i] - margin);
          lat = clamp(lat, -lim, lim);
          const nl = this.off[i] + (lat - this.off[i]) * 0.5;
          this.off[i] = nl;
          px[i] = this.x[i] + this.nx(i) * nl; pz[i] = this.z[i] + this.nz(i) * nl;
        }
      }
    }
    this.lx = px; this.lz = pz;
    // curvature of the racing line (1/m, signed: + = turning left)
    for (let i = 0; i < n; i++) {
      const a = this.idx(i - 2), b = this.idx(i + 2);
      const ax = px[i] - px[a], az = pz[i] - pz[a], bx = px[b] - px[i], bz = pz[b] - pz[i];
      const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
      const cross = ax * bz - az * bx;
      const ang = Math.asin(clamp(cross / (la * lb), -1, 1));
      this.curv[i] = -ang / ((la + lb) / 2);
    }
    // smooth curvature a little
    const c2 = new Float32Array(n);
    for (let i = 0; i < n; i++) c2[i] = (this.curv[this.idx(i - 1)] + this.curv[i] * 2 + this.curv[this.idx(i + 1)]) / 4;
    this.curv = c2;
  }

  /** Nearest sample to (x,z). hint: previous index for a fast local search (window). */
  project(x, z, hint = -1, window = 40) {
    let best = -1, bd = Infinity;
    const scan = (i) => { const dx = this.x[i] - x, dz = this.z[i] - z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } };
    if (hint >= 0) for (let k = -window; k <= window; k++) scan(this.idx(hint + k));
    if (hint < 0 || bd > 900) for (let i = 0; i < this.n; i++) scan(i);
    const i = best;
    const dx = x - this.x[i], dz = z - this.z[i];
    const along = dx * this.tx[i] + dz * this.tz[i];
    const lateral = dx * this.nx(i) + dz * this.nz(i);
    let s = this.dist[i] + along;
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    return { i, s, lateral, dist: Math.sqrt(bd), half: this.half[i] };
  }
  /** Index for distance s along the route. */
  indexAt(s) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    else s = clamp(s, 0, this.dist[this.n - 1]);
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.dist[m] <= s) lo = m; else hi = m; }
    return lo;
  }
  /** Position on centreline (lat = 0) or offset laterally. */
  pointAt(s, lat = 0, out = { x: 0, y: 0, z: 0 }) {
    const i = this.indexAt(s), j = this.idx(i + 1);
    const segLen = (j === 0 && this.closed ? this.length : this.dist[j]) - this.dist[i] || 1;
    const t = clamp((s - this.dist[i]) / segLen, 0, 1);
    out.x = this.x[i] + (this.x[j] - this.x[i]) * t + this.nx(i) * lat;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * t;
    out.z = this.z[i] + (this.z[j] - this.z[i]) * t + this.nz(i) * lat;
    return out;
  }
  linePoint(i) { return { x: this.lx[i], y: this.y[i], z: this.lz[i] }; }
  headingAt(i) { return Math.atan2(this.tx[i], this.tz[i]); }

  /** Grid slots behind distance s0: two columns, 8 m apart. Returns [{x,y,z,heading}]. */
  grid(count, s0 = 0, { spacing = 9, cols = 2 } = {}) {
    const slots = [];
    for (let k = 0; k < count; k++) {
      const row = Math.floor(k / cols), col = k % cols;
      const s = s0 - 6 - row * spacing - col * spacing * 0.5;
      const i = this.indexAt(this.closed ? s : Math.max(0, s));
      const lat = (col === 0 ? 1 : -1) * Math.min(2.6, this.half[i] * 0.45);
      const p = this.pointAt(this.closed ? s : Math.max(0, s), lat);
      slots.push({ x: p.x, y: p.y, z: p.z, heading: this.headingAt(i) });
    }
    return slots;
  }
  /** Reversed copy (for reverse layouts). */
  reversed() {
    const s = [];
    for (let i = this.n - 1; i >= 0; i--) s.push({ x: this.x[i], y: this.y[i], z: this.z[i], w: this.half[i] * 2 });
    return new Route(s, { closed: this.closed, id: this.id + ':rev', name: this.name });
  }
  /** Sub-route between distances (sprints on part of a road). */
  slice(s0, s1) {
    const out = [];
    for (let s = s0; s <= s1; s += 2) { const p = this.pointAt(s); out.push({ x: p.x, y: p.y, z: p.z, w: this.half[this.indexAt(s)] * 2 }); }
    return new Route(out, { closed: false, id: `${this.id}:${s0}-${s1}` });
  }
}

/** Resample a polyline [[x,y,z,w]] to ~`step` metre spacing with Catmull-Rom smoothing. */
export function resamplePath(points, closed, step = 2) {
  const P = points;
  const n = P.length;
  const seg = closed ? n : n - 1;
  const dense = [];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < seg; i++) {
    const p0 = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
    const k = Math.max(2, Math.ceil(len / (step * 0.5)));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      dense.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t), cr(p0[2], p1[2], p2[2], p3[2], t), p1[3] + (p2[3] - p1[3]) * t]);
    }
  }
  if (!closed) dense.push([...P[n - 1]]);
  // uniform arc-length resample
  const out = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    acc += d;
    if (acc >= step) { out.push(b); acc = 0; }
  }
  if (!closed) { const last = dense[dense.length - 1]; if (out[out.length - 1] !== last) out.push(last); }
  return out;
}
