// Roads from control points. Phase 1 (immediately): surface + shoulders + collision + terrain carving.
// Phase 2 (kit.finalize): markings, kerbs, walls/guardrails, street lights, bridge pillars, tunnels - so
// junctions declared later still cut gaps into markings and walls.
// Segment specs (`walls`, `lights`, `bridge`) take [{ from, to, ... }] in metres along the road; `tunnels`
// [{ from, to, name, zh }] skip carving (the hill stays on top) and get a lit shell with portals.
import * as THREE from 'three';
import { Route, resamplePath } from '../Route.js';
import { clamp } from '../../core/math.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Normalize a segment spec: true/object -> whole road, array -> as given, falsy -> none. */
const segList = (v) => (Array.isArray(v) ? v : v ? [{ from: 0, to: Infinity, ...(typeof v === 'object' ? v : {}) }] : []);
const segAt = (list, d) => list.find((s) => d >= (s.from ?? 0) && d < (s.to ?? Infinity)) || null;

/** Centre-line Route of a road spec without building meshes. groundY(x, z) fills points given as [x, z].
 *  Shared by kit.road() and menu previews (AI tune lap estimates). */
export function roadRoute(spec, groundY = () => 0) {
  const width = spec.width ?? 10;
  const pts = spec.points.map((p) => {
    if (p.length === 2) return [p[0], null, p[1], width];
    if (p.length === 3) return [p[0], p[1], p[2], width];
    return [p[0], p[1], p[2], p[3] ?? width];
  });
  for (const p of pts) if (p[1] == null) p[1] = groundY(p[0], p[2]);
  let samples = resamplePath(pts, !!spec.closed, spec.step ?? 2);
  // smooth elevation (unless the author pinned exact heights)
  if (spec.smoothY !== false) {
    const n = samples.length, passes = spec.smoothPasses ?? 6, win = 5;
    for (let pass = 0; pass < passes; pass++) {
      const y = samples.map((s) => s[1]);
      for (let i = 0; i < n; i++) {
        let sum = 0, c = 0;
        for (let k = -win; k <= win; k++) { const j = spec.closed ? (i + k + n) % n : clamp(i + k, 0, n - 1); sum += y[j]; c++; }
        samples[i][1] = sum / c;
      }
    }
  }
  return new Route(samples.map((s) => ({ x: s[0], y: s[1] + (spec.lift ?? 0.02), z: s[2], w: s[3] })), { closed: !!spec.closed, id: spec.id, name: spec.name });
}

/** Build a ribbon / swept surface. rows: [{ p: Vector3, n: Vector3 (lateral, left), u: Vector3 (up) }], profile: [[lat, h], ...]. */
export function sweep(rows, profile, { closed = false, vScale = 8, uvAcross = true, colors = null } = {}) {
  const pos = [], uv = [], idx = [], col = [];
  const m = profile.length;
  let dist = 0;
  for (let r = 0; r < rows.length; r++) {
    const R = rows[r];
    if (r > 0) dist += R.p.distanceTo(rows[r - 1].p);
    for (let k = 0; k < m; k++) {
      const [lat, h] = profile[k];
      pos.push(R.p.x + R.n.x * lat + R.u.x * h, R.p.y + R.n.y * lat + R.u.y * h, R.p.z + R.n.z * lat + R.u.z * h);
      uv.push(uvAcross ? k / (m - 1) : lat, dist / vScale);
      if (colors) { const c = colors(r, k); col.push(c[0], c[1], c[2]); }
    }
  }
  const rcount = rows.length;
  const segs = closed ? rcount : rcount - 1;
  for (let r = 0; r < segs; r++) {
    const r2 = (r + 1) % rcount;
    for (let k = 0; k < m - 1; k++) {
      const a = r * m + k, b = r * m + k + 1, c = r2 * m + k, d = r2 * m + k + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Make sure a geometry's triangles face up (so roads are visible from above regardless of path direction). */
function faceUp(g) {
  const p = g.attributes.position, idx = g.index.array;
  let sum = 0;
  for (let i = 0; i < Math.min(idx.length, 300); i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const e1x = p.getX(b) - p.getX(a), e1z = p.getZ(b) - p.getZ(a), e2x = p.getX(c) - p.getX(a), e2z = p.getZ(c) - p.getZ(a);
    sum += e1z * e2x - e1x * e2z; // y of cross(e1, e2)
  }
  if (sum < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
  return g;
}

// marking colours (linear, the material multiplies vertex colours)
const MARK = { white: new THREE.Color(0xe6e3da), yellow: new THREE.Color(0xe0a72a), red: new THREE.Color(0xb8231c) };

export function makeRoads(kit) {
  const { M } = kit;
  const roads = [];
  const junctions = [];
  const mats = {
    asphalt: () => kit.M.textured('asphalt', { repeat: 1, roughness: 0.92 }),
    concrete: () => kit.M.textured('concrete', { repeat: 1, roughness: 0.9 }),
    mark: () => M.shared('marking', () => M.surface({ color: 0xffffff, vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    curb: () => M.shared('curb', () => M.surface({ vertexColors: true, roughness: 0.6 })),
    rail: () => M.shared('guardrail', () => M.surface({ color: 0xb9bcbe, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide })),
    jersey: () => M.shared('jersey', () => M.surface({ color: 0xbab6ad, roughness: 0.9 })),
    wall: () => kit.M.textured('concrete', { repeat: 1, roughness: 0.95, color: 0xc8c4bb }),
    tire: () => M.shared('tirewall', () => M.surface({ color: 0x151515, roughness: 0.95 })),
    tunnelTile: () => M.shared('tunnelTile', () => M.surface({ color: 0xd8d4c8, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide })),
    tunnelVault: () => M.shared('tunnelVault', () => M.surface({ color: 0x34363a, roughness: 0.92, side: THREE.DoubleSide })),
    tunnelLamp: () => M.shared('tunnelLamp', () => M.surface({ color: 0x1a1612, emissive: 0xffc27a, emissiveIntensity: 2.6, roughness: 0.4 })),
  };

  function rowsFor(route, bankFn) {
    const rows = [];
    for (let i = 0; i < route.n; i++) {
      const a = route.idx(i - 1), b = route.idx(i + 1);
      const t = new THREE.Vector3(route.x[b] - route.x[a], route.y[b] - route.y[a], route.z[b] - route.z[a]).normalize();
      const n = new THREE.Vector3().crossVectors(UP, t).normalize(); // left of travel
      const bank = bankFn ? bankFn(i) : 0;
      if (bank) n.applyAxisAngle(t, bank);
      const u = new THREE.Vector3().crossVectors(t, n).normalize();
      rows.push({ p: new THREE.Vector3(route.x[i], route.y[i], route.z[i]), n, u, t, i });
    }
    return rows;
  }

  /**
   * Build a road. spec: { id, points: [[x,z] | [x,y,z] | [x,y,z,w]], closed, width, surface, lanes, markings,
   *   shoulder: { width, surface }, curbs, walls: 'guardrail'|'barrier'|'wall'|'tires'|{left,right}|[{from,to,left,right}],
   *   wallOffset, lights: { spacing, side, color, height, offset } | [{ from, to, ... }], banking: deg | 'auto',
   *   bridge: true | [{ from, to }], tunnels: [{ from, to, name, zh }], smoothY, tag }
   */
  function road(spec) {
    const width = spec.width ?? 10;
    const route = roadRoute(spec, kit.rawGroundY);
    const bankDeg = spec.banking ?? 0;
    const bankFn = bankDeg === 'auto' ? (i) => clamp(route.curv[i] * 160, -7, 7) * Math.PI / 180 : bankDeg ? () => bankDeg * Math.PI / 180 : null;
    const rows = rowsFor(route, bankFn);
    const half = (i) => route.half[i];
    const bridges = segList(spec.bridge), tunnels = spec.tunnels || [];
    // ---- surface
    const surfKey = spec.surface || 'asphalt';
    const surfGeo = faceUp(sweepVar(rows, (i) => [[half(i), 0], [half(i) * 0.5, 0.012], [0, 0.02], [-half(i) * 0.5, 0.012], [-half(i), 0]], { closed: route.closed, vScale: 8 }));
    const surfMat = surfKey === 'concrete' ? mats.concrete() : surfKey === 'dirt' || surfKey === 'gravel' ? kit.M.textured('dirt', { repeat: 1 }) : mats.asphalt();
    kit.addStatic(surfGeo, surfMat, { cast: false, receive: true });
    kit.collision.triangles(surfGeo, surfKey);
    kit.env?.addWettable(surfMat);
    // ---- shoulders
    const sh = spec.shoulder === false ? null : { width: 1.2, surface: 'concrete', ...(spec.shoulder || {}) };
    if (sh && sh.width > 0) {
      for (const side of [1, -1]) {
        const g = faceUp(sweepVar(rows, (i) => side > 0 ? [[half(i) + sh.width, -0.06], [half(i), 0]] : [[-half(i), 0], [-half(i) - sh.width, -0.06]], { closed: route.closed, vScale: 6 }));
        const mat = sh.surface === 'grass' ? kit.M.textured('grass', { repeat: 1 }) : sh.surface === 'dirt' ? kit.M.textured('dirt', { repeat: 1 }) : mats.concrete();
        kit.addStatic(g, mat, { cast: false, receive: true });
        kit.collision.triangles(g, sh.surface);
      }
    }
    // carve terrain under the road (not inside tunnels, not under bridge decks standing clear of the ground)
    let skip = null;
    if (bridges.length || tunnels.length) {
      skip = new Uint8Array(route.n);
      for (let i = 0; i < route.n; i++) {
        const d = route.dist[i];
        if (segAt(tunnels, d)) skip[i] = 1;
        else if (segAt(bridges, d) && route.y[i] - kit.rawGroundY(route.x[i], route.z[i]) > 1.2) skip[i] = 1;
      }
    }
    kit.terrainRef?.carve(route, (sh?.width || 0) + 1.5, spec.carveBlend ?? 14, skip);
    const r = { id: spec.id || `road${roads.length}`, spec, route, rows, width, shoulder: sh?.width || 0, tag: spec.tag || 'road', bridges, tunnels };
    roads.push(r);
    return r;
  }

  /** Variable-profile sweep (profile depends on row index). */
  function sweepVar(rows, profileFn, opts) {
    const pos = [], uv = [], idx = [];
    let m = 0, dist = 0;
    rows.forEach((R, r) => {
      const profile = profileFn(R.i ?? r);
      m = profile.length;
      if (r > 0) dist += R.p.distanceTo(rows[r - 1].p);
      profile.forEach(([lat, h], k) => {
        pos.push(R.p.x + R.n.x * lat + R.u.x * h, R.p.y + R.n.y * lat + R.u.y * h, R.p.z + R.n.z * lat + R.u.z * h);
        uv.push(k / (m - 1), dist / (opts.vScale || 8));
      });
    });
    const segs = opts.closed ? rows.length : rows.length - 1;
    for (let r = 0; r < segs; r++) {
      const r2 = (r + 1) % rows.length;
      for (let k = 0; k < m - 1; k++) { const a = r * m + k, b = a + 1, c = r2 * m + k, d = c + 1; idx.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** Flat patch that hides overlapping road ribbons at a junction and cuts markings / walls around it.
   *  pos: [x, z] (height from the ground) or [x, y, z] (exact road height, needed on slopes and decks). */
  function junction({ pos, radius = 12, surface = 'asphalt', shape = 'round' }) {
    const y = pos.length === 3 ? pos[1] : kit.groundY(pos[0], pos[pos.length - 1]);
    const x = pos[0], z = pos[pos.length - 1];
    const g = shape === 'square' ? new THREE.PlaneGeometry(radius * 2, radius * 2) : new THREE.CircleGeometry(radius, 32);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y + 0.035, z);
    const mat = surface === 'concrete' ? mats.concrete() : mats.asphalt();
    kit.addStatic(g, mat, { cast: false, receive: true });
    kit.collision.triangles(g, surface);
    junctions.push({ x, y, z, r: radius });
  }
  /** Inside a junction patch? With y, only patches at that height count (decks pass over ground junctions). */
  const inJunction = (x, z, pad = 0, y = null) => junctions.some((j) => (x - j.x) ** 2 + (z - j.z) ** 2 < (j.r + pad) ** 2 && (y == null || Math.abs(y - j.y) < 4));
  /** Another road's deck or surface under (x, z), more than `below` metres lower than y. */
  const roadBelow = (self, x, z, y, pad = 2.5, below = 3) => roads.some((o) => {
    if (o === self) return false;
    const p = o.route.project(x, z);
    return p.dist < p.half + o.shoulder + pad && y - o.route.y[p.i] > below;
  });

  // ---------------------------------------------------------------------------- phase 2
  function decorate(r) {
    const { spec, route, rows, bridges, tunnels } = r;
    const half = (i) => route.half[i];
    const lift = 0.028;
    const inTunnel = (i) => !!segAt(tunnels, route.dist[i]);
    // markings: list of { lat, w, color, dash }
    const marks = [];
    const style = spec.markings ?? 'center-dashed';
    const lanes = spec.lanes ?? 2;
    if (style !== 'none') {
      if (spec.edgeLines !== false) { marks.push({ lat: (i) => half(i) - 0.35, w: 0.15, color: 'white' }); marks.push({ lat: (i) => -half(i) + 0.35, w: 0.15, color: 'white' }); }
      if (style === 'center-dashed') marks.push({ lat: () => 0, w: 0.15, color: 'white', dash: [4, 6] });
      if (style === 'center-solid') marks.push({ lat: () => 0, w: 0.15, color: 'white' });
      if (style === 'double-yellow') { marks.push({ lat: () => 0.15, w: 0.12, color: 'yellow' }); marks.push({ lat: () => -0.15, w: 0.12, color: 'yellow' }); }
      if (style === 'race') { /* edge lines only */ }
      if (lanes > 2) {
        for (let k = 1; k < lanes; k++) {
          if (lanes % 2 === 0 && k === lanes / 2) continue;
          marks.push({ lat: (i) => -half(i) + (2 * half(i) * k) / lanes, w: 0.13, color: 'white', dash: [4, 6] });
        }
      }
      if (spec.redCurb) marks.push({ lat: (i) => half(i) - 0.12, w: 0.18, color: 'red' });
    }
    for (const mk of marks) {
      const groups = [];
      let cur = null;
      let d = 0;
      for (let k = 0; k < rows.length + (route.closed ? 1 : 0); k++) {
        const R = rows[k % rows.length];
        if (k > 0) d += R.p.distanceTo(rows[(k - 1) % rows.length].p);
        let on = true;
        if (mk.dash) on = d % (mk.dash[0] + mk.dash[1]) < mk.dash[0];
        const lat = mk.lat(R.i);
        const px = R.p.x + R.n.x * lat, pz = R.p.z + R.n.z * lat;
        if (inJunction(px, pz, 2, R.p.y)) on = false;
        if (on) { if (!cur) { cur = []; groups.push(cur); } cur.push(R); } else cur = null;
      }
      const c = MARK[mk.color] || MARK.white;
      for (const gRows of groups) {
        if (gRows.length < 2) continue;
        const g = faceUp(sweepVar(gRows, (i) => { const l = mk.lat(i); return [[l + mk.w / 2, lift], [l - mk.w / 2, lift]]; }, { closed: false, vScale: 4 }));
        const col = new Float32Array(g.attributes.position.count * 3);
        for (let v = 0; v < col.length; v += 3) { col[v] = c.r; col[v + 1] = c.g; col[v + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        kit.addStatic(g, mats.mark(), { cast: false, receive: true });
      }
    }
    // kerbs on the inside (and outside if 'both') of corners
    if (spec.curbs) {
      const thr = 1 / (spec.curbRadius ?? 140);
      for (const side of [1, -1]) {
        let run = [];
        const flush = () => {
          if (run.length > 4) {
            const g = faceUp(sweepVar(run, (i) => side > 0 ? [[half(i) + 1.0, 0.0], [half(i) + 0.6, 0.06], [half(i), 0.03]] : [[-half(i), 0.03], [-half(i) - 0.6, 0.06], [-half(i) - 1.0, 0.0]], { closed: false, vScale: 2 }));
            const cnt = g.attributes.position.count, col = new Float32Array(cnt * 3);
            const uvs = g.attributes.uv.array;
            for (let v = 0; v < cnt; v++) { const red = Math.floor(uvs[v * 2 + 1] * 2) % 2 === 0; col.set(red ? [0.72, 0.1, 0.08] : [0.92, 0.92, 0.9], v * 3); }
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            kit.addStatic(g, mats.curb(), { cast: false, receive: true });
            kit.collision.triangles(g, 'curb');
          }
          run = [];
        };
        for (const R of rows) {
          const c = route.curv[R.i];
          const inside = side > 0 ? c > thr : c < -thr; // left side is inside of a left turn
          if (inside || (spec.curbs === 'both' && Math.abs(c) > thr)) run.push(R); else flush();
        }
        flush();
      }
    }
    // walls / guardrails: string | { left, right } | [{ from, to, left, right }] (metres along the road)
    const segs = Array.isArray(spec.walls) ? spec.walls : [{ from: 0, to: Infinity, ...(typeof spec.walls === 'string' ? { left: spec.walls, right: spec.walls } : spec.walls || {}) }];
    for (const sideName of ['left', 'right']) {
      const side = sideName === 'left' ? 1 : -1;
      const off = (i) => half(i) + (r.shoulder || 0) + (spec.wallOffset ?? 0.6);
      let run = [], runType = null;
      const flush = () => { if (run.length > 1 && runType && runType !== 'none') buildWall(runType, run, side, off); run = []; };
      for (const R of rows) {
        const d = route.dist[R.i];
        const type = segs.find((sg) => d >= (sg.from ?? 0) && d < (sg.to ?? Infinity))?.[sideName] || null;
        const lat = side * off(R.i);
        const blocked = !type || inTunnel(R.i) || inJunction(R.p.x + R.n.x * lat, R.p.z + R.n.z * lat, 4, R.p.y);
        if (blocked || type !== runType) { flush(); runType = blocked ? null : type; }
        if (!blocked) run.push(R);
      }
      if (route.closed && run.length === rows.length) run.push(rows[0]);
      flush();
    }
    // street lights (segments may change spacing / colour or switch them off)
    const lightSegs = segList(spec.lights);
    if (lightSegs.length) {
      let d = 0, n = 0, prevSeg = null;
      for (let k = 1; k < rows.length; k++) {
        d += rows[k].p.distanceTo(rows[k - 1].p);
        const seg = segAt(lightSegs, route.dist[rows[k].i]);
        if (seg !== prevSeg) { prevSeg = seg; d = 0; }
        if (!seg || seg.off) continue;
        const L = { spacing: 32, side: 'both', height: 8.5, color: 0xffc27a, intensity: 120, range: 34, offset: 0.8, style: 'cobra', ...seg };
        if (d < L.spacing) continue;
        d = 0; n++;
        const R = rows[k];
        if (inTunnel(R.i)) continue;
        const sides = L.side === 'both' ? [1, -1] : L.side === 'left' ? [1] : L.side === 'right' ? [-1] : [n % 2 ? 1 : -1];
        for (const s of sides) {
          const lat = s * (half(R.i) + (r.shoulder || 0) + L.offset);
          const x = R.p.x + R.n.x * lat, z = R.p.z + R.n.z * lat;
          if (inJunction(x, z, 1, R.p.y)) continue;
          const onDeck = segAt(bridges, route.dist[R.i]) && R.p.y - kit.rawGroundY(x, z) > 1.5;
          const y = onDeck ? R.p.y : kit.groundY(x, z, R.p.y);
          const heading = Math.atan2(-R.n.x * s, -R.n.z * s); // arm points over the road
          kit.props.streetLamp([x, y, z], heading, { height: L.height, color: L.color, intensity: L.intensity, range: L.range, style: L.style });
        }
      }
    }
    // bridge decks: pillars where the deck stands clear, skirt walls down to the ground on low ramps
    if (bridges.length) {
      const spacing = Math.round((spec.pillarSpacing ?? 28) / 2);
      for (let k = 0; k < rows.length; k += spacing) {
        const R = rows[k];
        if (!segAt(bridges, route.dist[R.i])) continue;
        const gy = kit.rawGroundY(R.p.x, R.p.z);
        const h = R.p.y - gy;
        if (h < 4.5 || gy < (kit.waterLevel ?? -Infinity) - 30) continue;
        if (inJunction(R.p.x, R.p.z, 3) || roadBelow(r, R.p.x, R.p.z, R.p.y)) continue; // keep streets underneath clear
        kit.props.pillar([R.p.x, gy, R.p.z], Math.atan2(R.t.x, R.t.z), h - 0.9, Math.max(2, half(R.i) * 0.5));
      }
      let run = [];
      const W = (i) => half(i) + (r.shoulder || 0);
      const flush = () => {
        if (run.length > 1) {
          const g = faceUp(sweepVar(run, (i) => {
            const h = route.y[i] - kit.rawGroundY(route.x[i], route.z[i]);
            const depth = h < 5 ? Math.max(0.9, h + 0.4) : 0.9; // low ramps read as solid retaining walls
            return [[W(i), -0.06], [W(i), -depth], [-W(i), -depth], [-W(i), -0.06]];
          }, { closed: false, vScale: 8 }));
          kit.addStatic(g, mats.wall(), { cast: true, receive: true });
        }
        run = [];
      };
      for (const R of rows) { if (segAt(bridges, route.dist[R.i])) run.push(R); else flush(); }
      if (route.closed && run.length === rows.length) run.push(rows[0]);
      flush();
    }
    for (const T of tunnels) buildTunnel(r, T);
  }

  /** Tunnel shell: tiled walls, dark vault, lamp rows, portal headwalls with name boards, side collision. */
  function buildTunnel(r, T) {
    const { route, rows } = r;
    const i0 = Math.max(0, route.indexAt(T.from) - 1), i1 = Math.min(rows.length - 1, route.indexAt(T.to) + 1);
    const run = rows.slice(i0, i1 + 1);
    if (run.length < 2) return;
    const W = (i) => route.half[i] + (r.shoulder || 0) + 0.8;
    const tile = sweepVar(run, (i) => [[W(i), -0.3], [W(i), 3.4]], { vScale: 4 });
    const tile2 = sweepVar(run, (i) => [[-W(i), 3.4], [-W(i), -0.3]], { vScale: 4 });
    const vault = sweepVar(run, (i) => { const w = W(i); return [[w, 3.4], [w, 4.5], [w * 0.88, 5.9], [w * 0.62, 6.9], [w * 0.3, 7.4], [0, 7.55], [-w * 0.3, 7.4], [-w * 0.62, 6.9], [-w * 0.88, 5.9], [-w, 4.5], [-w, 3.4]]; }, { vScale: 6 });
    kit.addStatic(tile, mats.tunnelTile(), { cast: false, receive: true });
    kit.addStatic(tile2, mats.tunnelTile(), { cast: false, receive: true });
    kit.addStatic(vault, mats.tunnelVault(), { cast: true, receive: true });
    // lamp boxes along both upper walls, real (pooled) lights every 30 m, on day and night
    if (!kit.props.has?.('tunnelLamp')) { const g = new THREE.BoxGeometry(0.35, 0.16, 1.4); kit.props.define('tunnelLamp', [{ geometry: g, material: mats.tunnelLamp(), castShadow: false }]); }
    let acc = 0, n = 0;
    for (let k = 1; k < run.length; k++) {
      acc += run[k].p.distanceTo(run[k - 1].p);
      if (acc < 7) continue;
      acc = 0; n++;
      const R = run[k], w = W(R.i);
      for (const s of [1, -1]) {
        const p = R.p.clone().addScaledVector(R.n, s * (w - 0.35)).addScaledVector(R.u, 4.8);
        kit.props.place('tunnelLamp', [p.x, p.y, p.z], Math.atan2(R.t.x, R.t.z), 1, null, { collide: false });
      }
      if (n % 4 === 0) { const p = R.p.clone().addScaledVector(R.u, 5.4); kit.light({ pos: [p.x, p.y, p.z], color: T.light ?? 0xffc07a, intensity: 70, range: 24, nightOnly: false }); }
    }
    // side walls for the car body
    for (const s of [1, -1]) {
      const pts = run.map((R) => { const p = R.p.clone().addScaledVector(R.n, s * (W(R.i) - 0.15)); return [p.x, p.z]; });
      kit.world.addWallPath(pts, { y0: Math.min(...run.map((R) => R.p.y)) - 1, y1: Math.max(...run.map((R) => R.p.y)) + 7, thickness: 0.5, kind: 'wall', bounce: 0.1, friction: 0.3 });
    }
    // portals: headwall frame around the opening, name board above
    for (const [R, dir] of [[run[0], -1], [run[run.length - 1], 1]]) {
      const w = W(R.i);
      const t = R.t.clone().multiplyScalar(dir);
      const basis = new THREE.Matrix4().makeBasis(R.n, UP, t).setPosition(R.p);
      const parts = [];
      const box = (sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); parts.push(g); };
      box(4, 10.5, 1.4, w + 2, 4.6, 0.7);            // piers
      box(4, 10.5, 1.4, -w - 2, 4.6, 0.7);
      box(2 * w + 8, 3.0, 1.4, 0, 8.6, 0.7);         // lintel over the vault
      box(2 * w + 9, 0.5, 1.8, 0, 10.1, 0.7);        // coping
      const g = kit.merge(parts); g.applyMatrix4(basis);
      kit.addStatic(g, mats.wall(), { cast: true, receive: true });
      if (T.zh && kit.hsigns) {
        const rect = kit.hsigns.slot(T.zh, 3);
        const sg = kit.hsigns.geometry(rect, 7.5, 1.6, 0.2);
        sg.rotateY(Math.PI / 2); sg.translate(0, 8.6, 1.5); sg.applyMatrix4(basis);
        kit.addStatic(sg, kit.hsigns.material, { cast: false, receive: false });
      }
    }
  }

  function buildWall(type, run, side, off) {
    const profiles = {
      guardrail: [[0.0, 0.5], [0.0, 0.78]],
      barrier: [[0.3, 0.0], [0.12, 0.25], [0.08, 0.8], [-0.08, 0.8], [-0.12, 0.25], [-0.3, 0.0]],
      wall: [[0.15, 0.0], [0.15, 2.4], [-0.15, 2.4], [-0.15, 0.0]],
      tires: [[0.4, 0.0], [0.4, 0.75], [-0.4, 0.75], [-0.4, 0.0]],
    };
    const prof = profiles[type] || profiles.barrier;
    const wallRows = run.map((R) => {
      const lat = side * off(R.i);
      const p = R.p.clone().addScaledVector(R.n, lat);
      p.y = R.p.y - 0.03;
      return { p, n: R.n.clone().multiplyScalar(side), u: UP, i: R.i };
    });
    const g = sweep(wallRows, prof.map(([a, b]) => [a, b]), { closed: false, vScale: 4 });
    const mat = type === 'guardrail' ? mats.rail() : type === 'wall' ? mats.wall() : type === 'tires' ? mats.tire() : mats.jersey();
    kit.addStatic(g, mat, { cast: true, receive: true });
    if (type === 'guardrail') {
      for (let k = 0; k < wallRows.length; k += 2) kit.props.place('railPost', [wallRows[k].p.x, wallRows[k].p.y, wallRows[k].p.z], Math.atan2(wallRows[k].n.x, wallRows[k].n.z));
    }
    const pts = wallRows.map((w) => [w.p.x, w.p.z]);
    const y0 = Math.min(...wallRows.map((w) => w.p.y)) - 1, y1 = Math.max(...wallRows.map((w) => w.p.y)) + (type === 'wall' ? 2.4 : 1.0);
    kit.world.addWallPath(pts, { y0, y1, thickness: type === 'guardrail' ? 0.3 : 0.5, kind: type === 'guardrail' ? 'guardrail' : 'wall', bounce: type === 'tires' ? 0.35 : 0.1, friction: type === 'guardrail' ? 0.18 : 0.3 });
  }

  return { road, junction, decorate, all: roads, junctions, inJunction, sweep, sweepVar, faceUp, mats };
}
