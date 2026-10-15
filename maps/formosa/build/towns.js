// Towns along the open roads: shophouse rows that follow a road edge in short straight runs, each run at the
// road's own height so the row steps with the grade. A plinth under every run hides ground that falls away
// behind it. Runs that would land on another road, a junction or a pad are left out.
import { streetWall } from './streetwall.js';
import { tileUV } from './atlas.js';
import { lin } from './geom.js';

/**
 * Shophouse row beside `roadId` from station s0 to s1 (m). side: 1 = left of the road's direction, -1 = right.
 * o: { style, setback (m from the shoulder edge), depth, floors, chunk (run length), skip: [[s0, s1]...], lit }
 */
export function townRow(shared, roadId, s0, s1, side, o = {}) {
  const { kit } = shared.city.ctx;
  const road = kit.roads.find((r) => r.id === roadId);
  if (!road) return [];
  const R = road.route, mask = shared.mask, B = shared.city.wallB;
  const chunk = o.chunk ?? 24, depth = o.depth ?? 14, setback = o.setback ?? 2.5;
  const lots = [];
  for (let s = s0; s < s1 - 8; s += chunk) {
    const e = Math.min(s1, s + chunk);
    if ((o.skip || []).some(([a, b]) => e > a && s < b)) continue;
    const i = R.indexAt((s + e) / 2);
    const lat = side * (R.half[i] + road.shoulder + setback);
    const a = R.pointAt(s, lat), b = R.pointAt(e, lat);
    const n = [R.nx(i) * side, R.nz(i) * side];
    // the whole footprint must be free ground (no other road, pad or building)
    let clear = true;
    for (let u = 0.1; u <= 0.9 && clear; u += 0.2) for (let v = 1.5; v <= depth - 1; v += 3) {
      const px = a.x + (b.x - a.x) * u + n[0] * v, pz = a.z + (b.z - a.z) * u + n[1] * v;
      if (!mask.free(px, pz)) { clear = false; break; }
    }
    if (!clear) continue;
    const y = Math.min(a.y, b.y) - 0.05;
    const res = streetWall(shared.city.ctx, { a: [a.x, a.z], b: [b.x, b.z], n, style: o.style ?? 'shop', y, depth, floors: o.floors, qilou: o.qilou, litChance: o.lit ?? 0.3 });
    if (!res.length) continue;
    // plinth: the lot footprint down to well below the ground
    const t = [(b.x - a.x) / Math.hypot(b.x - a.x, b.z - a.z), (b.z - a.z) / Math.hypot(b.x - a.x, b.z - a.z)];
    const len = Math.hypot(b.x - a.x, b.z - a.z), dmax = Math.max(...res.map((L) => L.d));
    const cx = (a.x + b.x) / 2 + n[0] * dmax / 2, cz = (a.z + b.z) / 2 + n[1] * dmax / 2;
    const low = Math.min(kit.groundY(cx + n[0] * dmax / 2, cz + n[1] * dmax / 2), kit.groundY(a.x + n[0] * dmax, a.z + n[1] * dmax), kit.groundY(b.x + n[0] * dmax, b.z + n[1] * dmax));
    if (low < y - 0.3) B.box(cx, cz, t, [t[1], -t[0]], len / 2, dmax / 2 - 0.05, low - 1.5, y, tileUV('wall'), null, lin(0xa8a59c));
    mask.box(cx, cz, len / 2 + 1, dmax / 2 + 1, Math.atan2(-t[1], t[0]));
    lots.push(...res);
  }
  B.flush();
  return lots;
}

/** The towns on the Formosa Ring (stations in metres along the ring). */
export function buildTowns(shared) {
  const T = (s0, s1, side, style, floors, extra = {}) => townRow(shared, 'formosa-ring', s0, s1, side, { style, floors, ...extra });
  T(2980, 3400, -1, 'old', [2, 4]);                        // Tamsui old street, inland side
  T(3040, 3300, 1, 'shop', [3, 5], { setback: 4 });        // Tamsui waterfront
  T(5440, 5780, -1, 'shop', [3, 5]);                       // Jinshan
  T(5480, 5740, 1, 'old', [2, 3], { setback: 3.5 });
  T(6470, 6780, -1, 'shop', [3, 5], { depth: 12 });        // harbour seafood restaurants
  T(9950, 10560, -1, 'old', [2, 4]);                       // Wujie village
  T(10000, 10500, 1, 'shop', [2, 4], { setback: 3.5 });
}
