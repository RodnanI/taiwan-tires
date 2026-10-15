// Jiufen: the old gold-mining town on the ridge above the harbour. Shophouses crowd both sides of the road
// through the terrace and step down the slope towards the sea, red lanterns are strung across the street
// every few metres, and a wooden teahouse with lanterns on every eave stands where the climb finishes.
import { townRow } from './towns.js';
import { templeHall, palaceRoof } from './temple.js';
import { slab } from './city.js';
import { lin } from './geom.js';

export const LANTERN_STREET = [2340, 2690];

export function buildJiufen(kit, shared, r) {
  const road = kit.roads.find((q) => q.id === 'jiufen-road');
  if (!road) return;
  const R = road.route, [s0, s1] = LANTERN_STREET;
  const T = (a, b, side, o) => townRow(shared, 'jiufen-road', a, b, side, { style: 'old', chunk: 14, lit: 0.45, qilou: false, ...o });
  // landmarks first, so the rows fit round them
  const tea = R.pointAt(2612, -(R.half[R.indexAt(2612)] + road.shoulder + 10));
  teahouse(kit, shared, r, tea.x, tea.z, tea.y, R.headingAt(R.indexAt(2612)));
  const tp = R.pointAt(2380, R.half[R.indexAt(2380)] + road.shoulder + 10);
  templeHall(kit, shared.city.wallB, { x: tp.x, z: tp.z, y: tp.y, face: R.headingAt(R.indexAt(2380)) - Math.PI / 2, w: 12, d: 10, h: 4.4, roof: 'orange' });
  shared.mask.circle(tp.x, tp.z, 10);
  // the street, then rows stepping down the seaward slope and a back row uphill
  T(s0, s1, 1, { floors: [2, 4], setback: 1.2, depth: 11 });
  T(s0, s1, -1, { floors: [2, 4], setback: 1.2, depth: 11 });
  T(s0 - 30, s1, -1, { floors: [2, 3], setback: 14, depth: 10, dy: -6 });
  T(s0 - 30, s0 + 200, -1, { floors: [2, 3], setback: 26, depth: 10, dy: -13 });
  T(s0 - 30, s0 + 160, -1, { floors: [2, 3], setback: 38, depth: 9, dy: -21 });
  T(s0 + 10, s1 - 10, 1, { floors: [2, 3], setback: 14, depth: 10, dy: 1.5 });
  // lantern strings across the street, lanterns under the eaves, warm light pools
  for (let s = s0 + 3; s < s1; s += 4.6) {
    const i = R.indexAt(s), half = R.half[i] + 1;
    for (let lat = -half; lat <= half + 0.01; lat += 1.15) {
      const p = R.pointAt(s, lat), sag = 0.7 * (1 - (lat / half) ** 2);
      kit.props.place('lantern', [p.x, p.y + 5.6 - sag, p.z], R.headingAt(i), 1, null, { collide: false });
    }
  }
  for (let s = s0 + 1; s < s1; s += 2.6) for (const side of [-1, 1]) {
    const i = R.indexAt(s), p = R.pointAt(s, side * (R.half[i] + 1.5));
    if (r() < 0.75) kit.props.place('lantern', [p.x, p.y + 3.4, p.z], R.headingAt(i), 1.15, null, { collide: false });
  }
  for (let s = s0 + 20; s < s1; s += 45) { const p = R.pointAt(s, 0); kit.light({ pos: [p.x, p.y + 5, p.z], color: 0xff6a3a, intensity: 80, range: 26, nightOnly: true }); }
}

// A tall timber teahouse: three storeys under a deep roof, a lookout storey with its own roof on top, red
// lanterns along every eave.
function teahouse(kit, shared, r, x, z, y, heading) {
  const B = shared.city.wallB, rot = heading;
  const wood = lin(0x7a4430), w = 16, d = 12;
  const H = slab(B, kit, x, z, w, d, 3, r, 'shutters', null, wood, rot, y);
  palaceRoof(B, { x, z, y: y + H + 0.1, face: rot, hw: w / 2 + 2.2, hd: d / 2 + 2, rise: 3.6, roof: 'red', ridge: false });
  const H2 = slab(B, kit, x, z, w * 0.6, d * 0.6, 1, r, 'shutters', null, wood, rot, y + H + 1.2);
  palaceRoof(B, { x, z, y: y + H + 1.2 + H2 + 0.1, face: rot, hw: w * 0.3 + 1.6, hd: d * 0.3 + 1.5, rise: 2.6, roof: 'red' });
  // lanterns along the eaves of both roofs (all four sides of the lower one)
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (u, v, yy) => [x + u * c + v * s, yy, z - u * s + v * c];
  const ring = (hw, hd, yy, step) => {
    for (let u = -hw; u <= hw + 0.01; u += step) for (const v of [-hd, hd]) kit.props.place('lantern', P(u, v, yy), rot, 1.2, null, { collide: false });
    for (let v = -hd + step; v < hd; v += step) for (const u of [-hw, hw]) kit.props.place('lantern', P(u, v, yy), rot, 1.2, null, { collide: false });
  };
  ring(w / 2 + 1.6, d / 2 + 1.4, y + H - 0.7, 1.4);
  ring(w / 2 + 0.6, d / 2 + 0.6, y + 4.2 - 0.6, 1.6);
  ring(w * 0.3 + 1.1, d * 0.3 + 1, y + H + 1.2 + H2 - 0.5, 1.3);
  kit.light({ pos: [x, y + H, z], color: 0xff5a2a, intensity: 120, range: 34, nightOnly: true });
  shared.mask.circle(x, z, 13);
}
