// Road alignment helpers for the Formosa map (pure data, Node-safe).
// Roads are designed like real alignments: tangents and circular arcs with a grade per element, so every
// corner radius and climb is intentional. Output is [x, y, z] control points for map.js `roads`.
// Compass headings in degrees here: 0 = north (-Z), 90 = east (+X), 180 = south, 270 = west.

const D2R = Math.PI / 180;

/**
 * Turtle path. ops: ['S', len, grade?] straight, ['L' | 'R', radius, degrees, grade?] arc,
 * ['G', grade] default grade, ['Y', y] jump the height (pin), ['T', x, z, grade?] straight to a point
 * (re-aims the heading), ['W', width] width from here on, ['M', name] mark (index recorded in .marks).
 * Returns { pts: [[x, y, z, w]], end: { x, z, y, h }, marks, length }.
 */
export function turtle(x, z, heading, y, ops, { width = 10, step = 22 } = {}) {
  const pts = [[x, y, z, width]];
  const marks = {};
  let h = heading, g = 0, w = width, len = 0;
  const push = () => pts.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), w]);
  for (const op of ops) {
    const k = op[0];
    if (k === 'G') { g = op[1]; continue; }
    if (k === 'Y') { y = op[1]; pts[pts.length - 1][1] = y; continue; }
    if (k === 'W') { w = op[1]; continue; }
    if (k === 'M') { marks[op[1]] = { i: pts.length - 1, s: len, x, z, y, h }; continue; }
    if (k === 'S' || k === 'T') {
      let L = op[1], gr = op[2] ?? g;
      if (k === 'T') { const tx = op[1], tz = op[2]; gr = op[3] ?? g; L = Math.hypot(tx - x, tz - z); h = Math.atan2(tx - x, -(tz - z)) / D2R; }
      const n = Math.max(1, Math.ceil(L / step));
      for (let i = 0; i < n; i++) { x += Math.sin(h * D2R) * L / n; z -= Math.cos(h * D2R) * L / n; y += gr * L / n; len += L / n; push(); }
      continue;
    }
    if (k === 'L' || k === 'R') {
      const R = op[1], deg = op[2], gr = op[3] ?? g;
      const arcLen = R * deg * D2R;
      const ds = Math.min(8, Math.max(2.5, R * 0.3));
      const n = Math.max(2, Math.ceil(arcLen / ds));
      const dh = (k === 'L' ? -deg : deg) / n;
      for (let i = 0; i < n; i++) {
        // midpoint rule keeps the arc on its circle
        const hm = h + dh / 2;
        const sl = arcLen / n;
        x += Math.sin(hm * D2R) * sl; z -= Math.cos(hm * D2R) * sl; y += gr * sl; len += sl;
        h += dh;
        push();
      }
      continue;
    }
    throw new Error(`turtle: unknown op ${k}`);
  }
  return { pts, end: { x, z, y, h }, marks, length: len };
}

/** Polyline through intersection points with circular fillets of radius r (number or per-point array). */
export function fillet(pis, r, { width = 10, closed = false, step = 24 } = {}) {
  const n = pis.length, out = [];
  const R = (i) => (Array.isArray(r) ? r[i] ?? r[0] : r);
  const at = (i) => pis[closed ? (i + n) % n : i];
  const segs = closed ? n : n - 1;
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) { corners.push(null); continue; }
    const p = at(i), a = at(i - 1), b = at(i + 1);
    const ux = p[0] - a[0], uz = p[1] - a[1], vx = b[0] - p[0], vz = b[1] - p[1];
    const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
    const cos = (ux * vx + uz * vz) / (lu * lv), cross = ux * vz - uz * vx;
    const defl = Math.acos(Math.max(-1, Math.min(1, cos)));
    const rad = R(i);
    if (!rad || defl < 0.01) { corners.push(null); continue; }
    let T = rad * Math.tan(defl / 2);
    T = Math.min(T, lu * 0.48, lv * 0.48);
    const rr = T / Math.tan(defl / 2);
    const t1 = [p[0] - ux / lu * T, p[1] - uz / lu * T], t2 = [p[0] + vx / lv * T, p[1] + vz / lv * T];
    // centre: from t1 perpendicular towards the inside of the turn
    const side = cross > 0 ? 1 : -1; // + = turning towards +x of (u rotated) ... sign used below
    const nx = -uz / lu * side, nz = ux / lu * side;
    const c = [t1[0] + nx * rr, t1[1] + nz * rr];
    corners.push({ t1, t2, c, rr, side, defl });
  }
  const addLine = (a, b, incl) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / step));
    for (let j = incl ? 0 : 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  };
  const addArc = (C) => {
    const a0 = Math.atan2(C.t1[1] - C.c[1], C.t1[0] - C.c[0]);
    const a1 = Math.atan2(C.t2[1] - C.c[1], C.t2[0] - C.c[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const k = Math.max(2, Math.ceil(Math.abs(da) * C.rr / Math.min(8, Math.max(2.5, C.rr * 0.3))));
    for (let j = 1; j <= k; j++) { const a = a0 + da * j / k; out.push([C.c[0] + Math.cos(a) * C.rr, C.c[1] + Math.sin(a) * C.rr]); }
  };
  const startOf = (i) => (corners[i] ? corners[i].t2 : at(i));
  const endOf = (i) => (corners[i] ? corners[i].t1 : at(i));
  // stations: output index nearest to each PI (arc midpoint for filleted corners)
  const stations = new Array(n).fill(0);
  if (!closed) out.push([...pis[0]]);
  for (let i = 0; i < segs; i++) {
    const a = startOf(i), j = closed ? (i + 1) % n : i + 1, b = endOf(j);
    if (closed && i === 0) { stations[0] = 0; out.push([...a]); }
    addLine(a, b, false);
    const before = out.length;
    if (corners[j] && (closed || j < n - 1)) addArc(corners[j]);
    stations[j] = corners[j] ? Math.round((before - 1 + out.length - 1) / 2) : out.length - 1;
  }
  if (closed) { out.pop(); stations[0] = 0; }
  const res = out.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]);
  res.stations = stations.map((k) => Math.min(k, res.length - 1));
  return res;
}

/**
 * Heights along a filleted path from per-PI heights (linear by distance between PI stations, closed paths wrap).
 * ys: array of heights per PI (null = interpolate). Returns [[x, y, z, w], ...] and .dist (station distances).
 */
export function stationHeights(pts, ys, width, closed = false) {
  const d = cumDist(pts), st = pts.stations, n = pts.length;
  const total = d[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
  const keys = [];
  ys.forEach((y, i) => { if (y != null) keys.push([d[st[i]], y]); });
  keys.sort((a, b) => a[0] - b[0]);
  if (closed) { const f = keys[0], l = keys[keys.length - 1]; keys.unshift([l[0] - total, l[1]]); keys.push([f[0] + total, f[1]]); }
  const out = pts.map((p, i) => {
    const s = d[i];
    let y = keys[0][1];
    for (let k = 0; k < keys.length - 1; k++) if (s >= keys[k][0] && s <= keys[k + 1][0]) { const t = (s - keys[k][0]) / Math.max(1e-6, keys[k + 1][0] - keys[k][0]); y = keys[k][1] + (keys[k + 1][1] - keys[k][1]) * t; break; }
    if (s > keys[keys.length - 1][0]) y = keys[keys.length - 1][1];
    return [p[0], +y.toFixed(2), p[1], width];
  });
  out.stationDist = st.map((k) => d[k]);
  out.total = total;
  return out;
}

/** Cumulative 2D distance of a point list. */
export function cumDist(pts) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][pts[i].length === 2 ? 1 : 2] - pts[i - 1][pts[i - 1].length === 2 ? 1 : 2]));
  return d;
}

/** Heights for [x, z] points from keyframes [[s, y], ...] (s = metres along); linear between, clamped. */
export function profile(pts2, keys, width) {
  const d = cumDist(pts2);
  return pts2.map((p, i) => {
    const s = d[i];
    let y = keys[0][1];
    for (let k = 0; k < keys.length - 1; k++) {
      if (s >= keys[k][0] && s <= keys[k + 1][0]) { const t = (s - keys[k][0]) / Math.max(1e-6, keys[k + 1][0] - keys[k][0]); y = keys[k][1] + (keys[k + 1][1] - keys[k][1]) * t; break; }
      if (s > keys[keys.length - 1][0]) y = keys[keys.length - 1][1];
    }
    return width == null ? [p[0], +y.toFixed(2), p[1]] : [p[0], +y.toFixed(2), p[1], width];
  });
}

/** Total 2D length of a point list ([x, z] or [x, y, z, ...]). */
export const pathLength = (pts) => { const d = cumDist(pts); return d[d.length - 1]; };

/**
 * Belt path: a road wrapped around a sequence of circles like a belt around pulleys. Exact tangents between
 * circles, arcs on them, so hairpin centres and sweeper radii are placed precisely.
 * start, end: [x, z]; circles: [[cx, cz, r, 'L' | 'R'], ...] (turn side as driven from start to end).
 * Returns [[x, z], ...] with .stations: [0, arc midpoint index per circle..., last].
 */
export function belt(start, circles, end, { step = 20, arcStep = null } = {}) {
  const C = [{ c: start, r: 0, s: 1 }, ...circles.map((q) => ({ c: [q[0], q[1]], r: q[2], s: q[3] === 'R' ? 1 : -1 })), { c: end, r: 0, s: 1 }];
  // tangent leaving A and arriving at B: direction theta = phi - asin(k / d), k = sB rB - sA rA
  const tangents = [];
  for (let i = 0; i < C.length - 1; i++) {
    const A = C[i], B = C[i + 1];
    const dx = B.c[0] - A.c[0], dz = B.c[1] - A.c[1], d = Math.hypot(dx, dz);
    const k = B.s * B.r - A.s * A.r;
    if (Math.abs(k) > d) throw new Error(`belt: circles ${i} and ${i + 1} overlap (d ${d.toFixed(1)}, k ${k.toFixed(1)})`);
    const th = Math.atan2(dz, dx) - Math.asin(k / d);
    const tx = Math.cos(th), tz = Math.sin(th), nx = -tz, nz = tx; // right normal on the map (x right, z down)
    tangents.push({ a: [A.c[0] - A.s * A.r * nx, A.c[1] - A.s * A.r * nz], b: [B.c[0] - B.s * B.r * nx, B.c[1] - B.s * B.r * nz] });
  }
  const out = [[...start]], stations = [0], sweeps = [];
  const line = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); };
  for (let i = 0; i < tangents.length; i++) {
    const T = tangents[i];
    if (i > 0) {
      // arc on circle i from the previous tangent's end to this tangent's start
      const Q = C[i], p0 = tangents[i - 1].b, p1 = T.a;
      const a0 = Math.atan2(p0[1] - Q.c[1], p0[0] - Q.c[0]), a1 = Math.atan2(p1[1] - Q.c[1], p1[0] - Q.c[0]);
      let da = a1 - a0;
      if (Q.s > 0) { while (da < 0) da += Math.PI * 2; } else { while (da > 0) da -= Math.PI * 2; }
      sweeps.push(Math.round(Math.abs(da) * 180 / Math.PI));
      if (Math.abs(da) > Math.PI * 1.7) throw new Error(`belt: circle ${i - 1} wraps ${Math.round(Math.abs(da) * 180 / Math.PI)} deg (placed on the wrong side?)`);
      const ds = arcStep ?? Math.min(8, Math.max(2.5, Q.r * 0.3));
      const n = Math.max(2, Math.ceil(Math.abs(da) * Q.r / ds));
      const first = out.length;
      for (let j = 1; j <= n; j++) { const a = a0 + da * j / n; out.push([Q.c[0] + Math.cos(a) * Q.r, Q.c[1] + Math.sin(a) * Q.r]); }
      stations.push(Math.round((first + out.length - 1) / 2));
    }
    line(out[out.length - 1], T.b);
  }
  stations.push(out.length - 1);
  const res = out.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]);
  res.stations = stations;
  res.sweeps = sweeps;   // degrees turned on each circle (a wiggle circle near 360 means it was placed on the wrong side)
  return res;
}

/**
 * Join paths end to start (duplicate joint dropped). Each part carries .stations; the result's .stations
 * lists every part's stations in order (the shared joint appears once).
 */
export function chain(...parts) {
  const out = [], stations = [];
  for (const p of parts) {
    const skip = out.length && Math.hypot(p[0][0] - out[out.length - 1][0], p[0][1] - out[out.length - 1][1]) < 0.5 ? 1 : 0;
    const base = out.length - skip;
    for (const s of p.stations || [0, p.length - 1]) if (!(skip && s === 0)) stations.push(base + s);
    for (let i = skip; i < p.length; i++) out.push(p[i]);
  }
  out.stations = stations;
  return out;
}
