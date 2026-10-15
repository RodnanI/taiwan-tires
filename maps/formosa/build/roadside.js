// Roadside furniture read off the carved terrain: guardrails wherever the ground falls away, retaining walls on
// deep cuts, chevron boards round the outside of tight corners, convex mirrors at hairpins. Runs inside build(),
// before the kit decorates roads, so it can still write each road's `walls` segments.

/**
 * opts: { from, to (m), drop: m below the road that earns a guardrail, cut: m above for a retaining wall,
 *         skip: [[s0, s1]...] no furniture (towns, junction plazas), chevrons, mirrors }
 */
export function furnish(kit, id, opts = {}) {
  const road = kit.roads.find((r) => r.id === id);
  if (!road) return;
  const { route } = road;
  const drop = opts.drop ?? 1.6, cut = opts.cut ?? 4.5;
  const step = 4, n = route.n;
  const off = (i, k) => route.half[i] + road.shoulder + k;
  const sides = { left: [], right: [] };
  const skipAt = (d) => (opts.skip || []).some(([a, b]) => d >= a && d <= b) || d < (opts.from ?? 0) || d > (opts.to ?? Infinity) || (road.tunnels || []).some((t) => d > t.from - 8 && d < t.to + 8);
  for (let i = 0; i < n; i += 2) {
    const d = route.dist[i];
    for (const [name, s] of [['left', 1], ['right', -1]]) {
      let type = null;
      if (!skipAt(d)) {
        const nx = route.nx(i) * s, nz = route.nz(i) * s;
        const g1 = kit.groundY(route.x[i] + nx * off(i, 3), route.z[i] + nz * off(i, 3));
        const g2 = kit.groundY(route.x[i] + nx * off(i, 9), route.z[i] + nz * off(i, 9));
        const low = Math.min(g1, g2), high = Math.max(g1, g2);
        if (route.y[i] - low > drop) type = 'guardrail';
        else if (opts.walls !== false && high - route.y[i] > cut) type = 'wall';
      }
      sides[name].push({ d, type });
    }
  }
  // per side: close gaps up to 12 m, drop runs under 16 m
  const clean = (arr) => {
    const t = arr.map((q) => q.type);
    for (let k = 1; k < t.length - 1; k++) if (!t[k] && t[k - 1]) { let j = k; while (j < t.length && !t[j] && j - k < 3) j++; if (j < t.length && t[j] === t[k - 1]) for (let q = k; q < j; q++) t[q] = t[k - 1]; }
    for (let k = 0; k < t.length;) { let j = k; while (j < t.length && t[j] === t[k]) j++; if (t[k] && (j - k) * step < 16) for (let q = k; q < j; q++) t[q] = null; k = j; }
    return t;
  };
  const L = clean(sides.left), Rr = clean(sides.right);
  // one segment per run of identical (left, right) pairs: the kit reads both sides from one segment
  const segs = [];
  for (let k = 0; k < L.length;) {
    let j = k; while (j < L.length && L[j] === L[k] && Rr[j] === Rr[k]) j++;
    if (L[k] || Rr[k]) segs.push({ from: sides.left[k].d, to: (sides.left[j]?.d ?? sides.left[j - 1].d + step), left: L[k] || null, right: Rr[k] || null });
    k = j;
  }
  road.spec.walls = [...(Array.isArray(road.spec.walls) ? road.spec.walls : []), ...segs];
  road.spec.wallOffset = opts.wallOffset ?? 0.5;
  // chevrons and mirrors on the outside of tight corners
  if (opts.chevrons !== false) {
    let last = -1e9;
    for (let i = 2; i < n - 2; i += 2) {
      const d = route.dist[i];
      const c = route.curv[i];
      if (Math.abs(c) < 1 / 85 || skipAt(d) || d - last < 9) continue;
      const s = c > 0 ? -1 : 1;                               // outside of the turn: right of a left-hander
      const lat = off(i, 1.6);
      const x = route.x[i] + route.nx(i) * s * lat, z = route.z[i] + route.nz(i) * s * lat;
      const y = kit.groundY(x, z);
      if (Math.abs(y - route.y[i]) > 1.2) continue;          // no footing (bridge, deep drop)
      const face = Math.atan2(-route.tx[i], -route.tz[i]) + (c > 0 ? Math.PI : 0);
      kit.props.place('chevron', [x, y, z], face, 1, null, { collide: false });
      last = d;
    }
  }
  if (opts.mirrors !== false) {
    for (let i = 3; i < n - 3; i++) {
      const c = route.curv[i];
      if (Math.abs(c) < 1 / 32 || Math.abs(c) < Math.abs(route.curv[i - 3]) || Math.abs(c) < Math.abs(route.curv[i + 3]) || skipAt(route.dist[i])) continue;
      const s = c > 0 ? -1 : 1, lat = off(i, 2.2);
      const x = route.x[i] + route.nx(i) * s * lat, z = route.z[i] + route.nz(i) * s * lat;
      const y = kit.groundY(x, z);
      if (Math.abs(y - route.y[i]) > 1.5) continue;
      kit.props.place('mirror', [x, y, z], Math.atan2(-route.nx(i) * s, -route.nz(i) * s));
      i += 20;
    }
  }
}

/** Street lights on parts of a road (segments in metres), added before the kit decorates it. */
export function lightRoad(kit, id, segs) {
  const road = kit.roads.find((r) => r.id === id);
  if (!road) return;
  const prev = Array.isArray(road.spec.lights) ? road.spec.lights : road.spec.lights ? [{ from: 0, to: Infinity, ...road.spec.lights }] : [];
  road.spec.lights = [...prev, ...segs];
}
