// Taipei basin street plan (pure data): avenues, the night circuit, the elevated expressway, junctions and the
// blocks between streets that the city builder fills. Everything sits on the flat basin at CITY_Y.
// Avenues are named after the real Taipei roads they stand in for; the layout is compressed, not a copy.
import { belt, fillet } from './align.js';
import { CITY_Y } from './geo.js';

const Y = CITY_Y;
export const LEVEE_X = -1765;    // the ring runs north-south on the river levee
export const HEPING_Z = 2020;    // the ring runs east-west on Heping Road
export const EAST_X = 560;       // Keelung Road: the last avenue before Elephant Mountain

// East-west avenues (z) and north-south avenues (x). w = carriageway width.
export const EW = [
  { id: 'civic-blvd', name: 'Civic Boulevard', zh: '市民大道', z: 520, w: 16, x0: LEVEE_X, x1: EAST_X },
  { id: 'nanjing-rd', name: 'Nanjing Road', zh: '南京東路', z: 820, w: 16, x0: LEVEE_X, x1: EAST_X },
  { id: 'zhongxiao-rd', name: 'Zhongxiao Road', zh: '忠孝東路', z: 1120, w: 18, x0: LEVEE_X, x1: EAST_X },
  { id: 'renai-rd', name: "Ren'ai Road", zh: '仁愛路', z: 1420, w: 18, x0: LEVEE_X, x1: EAST_X },
  { id: 'xinyi-rd', name: 'Xinyi Road', zh: '信義路', z: 1720, w: 16, x0: LEVEE_X, x1: EAST_X },
  { id: 'roosevelt-rd', name: 'Roosevelt Road', zh: '羅斯福路', z: 2250, w: 14, x0: LEVEE_X + 140, x1: EAST_X },
];
export const NS = [
  { id: 'yanping-rd', name: 'Yanping Road', zh: '延平北路', x: -1450, w: 12, z0: 520, z1: 2250 },
  { id: 'zhonghua-rd', name: 'Zhonghua Road', zh: '中華路', x: -1150, w: 16, z0: 520, z1: 2250 },
  { id: 'zhongshan-rd', name: 'Zhongshan Road', zh: '中山北路', x: -850, w: 16, z0: 520, z1: 2250 },
  { id: 'xinsheng-rd', name: 'Xinsheng Road', zh: '新生南路', x: -500, w: 16, z0: 520, z1: 2250 },
  { id: 'jianguo-rd', name: 'Jianguo Road', zh: '建國南路', x: -150, w: 16, z0: 520, z1: 2250 },
  { id: 'dunhua-rd', name: 'Dunhua Road', zh: '敦化南路', x: 200, w: 18, z0: 520, z1: 2250 },
  { id: 'keelung-rd', name: 'Keelung Road', zh: '基隆路', x: EAST_X, w: 16, z0: 520, z1: HEPING_Z },
];

// ------------------------------------------------------------------------------------------- night circuit
// Taipei Night GP, clockwise: Ren'ai east, three quarters round the Dunhua roundabout, Dunhua north,
// Zhongxiao east, down Keelung Road past the tower, Xinyi west, Jianguo north. Corners are real 90s.
export const ROUNDABOUT = { x: 200, z: 1420, r: 40, island: 26 };
function buildCircuit() {
  const R = ROUNDABOUT;
  const pts = belt([-30, 1420], [
    [R.x - 60, 1420 + 14, 14, 'R'],             // flare right into the roundabout
    [R.x, R.z, R.r, 'L'],                        // round the island, counter-clockwise
    [R.x - 14, R.z - 60, 14, 'R'],              // flare right out, north onto Dunhua
    [200 + 22, 1120 + 22, 22, 'R'],             // Dunhua -> Zhongxiao
    [EAST_X - 26, 1120 + 26, 26, 'R'],          // Zhongxiao -> Keelung
    [EAST_X - 30, 1720 - 30, 30, 'R'],          // Keelung -> Xinyi
    [-150 + 22, 1720 - 22, 22, 'R'],            // Xinyi -> Jianguo
    [-150 + 22, 1420 + 22, 22, 'R'],            // Jianguo -> Ren'ai
  ], [-30, 1420], { step: 12 });
  pts.pop(); // closed: the start point is not repeated
  return pts.map((p) => [p[0], Y, p[1], 16]);
}
export const CIRCUIT = buildCircuit();
// Which avenue spans the circuit already covers (so those avenues are split around it).
const ARM = ROUNDABOUT.r + 7; // roundabout arms stop at the circulating lane
const COVERED = {
  'renai-rd': [[-150, ROUNDABOUT.x + ARM]], 'dunhua-rd': [[1120, ROUNDABOUT.z + ARM]], 'zhongxiao-rd': [[200, EAST_X]],
  'keelung-rd': [[1120, 1720]], 'xinyi-rd': [[-150, EAST_X]], 'jianguo-rd': [[1420, 1720]],
};

// ------------------------------------------------------------------------------------------- elevated
// Civic Elevated: up from the levee, east above the city at z = 670, a long right-hander, south along the
// foot of Elephant Mountain and down onto Heping Road. Deck 12 m above the streets.
export const ELEVATED_Z = 670, ELEVATED_X = 680, DECK = Y + 12;
function buildElevated() {
  const p2 = fillet([[LEVEE_X, ELEVATED_Z], [-1600, ELEVATED_Z], [ELEVATED_X, ELEVATED_Z], [ELEVATED_X, HEPING_Z - 160], [ELEVATED_X, HEPING_Z]], [0, 0, 170, 0, 0], { step: 14 });
  // ramps: 0 -> deck over the first 230 m and the last 260 m
  let d = 0;
  const L = p2.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - p2[i - 1][0], p[1] - p2[i - 1][1]) : 0), 0);
  return p2.map((p, i) => {
    if (i) d += Math.hypot(p[0] - p2[i - 1][0], p[1] - p2[i - 1][1]);
    const up = Math.min(1, d / 230), down = Math.min(1, (L - d) / 260);
    const t = Math.min(up, down), e = t * t * (3 - 2 * t);
    return [p[0], +(Y + (DECK - Y) * e).toFixed(2), p[1], 15];
  });
}
export const ELEVATED = buildElevated();

// ------------------------------------------------------------------------------------------- avenues
function spans(lo, hi, cut) {
  let parts = [[lo, hi]];
  for (const [a, b] of cut || []) parts = parts.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, a], [b, v]].filter(([p, q]) => q - p > 30)));
  return parts;
}
/** Avenue road specs (split around the circuit). */
export function avenueRoads() {
  const out = [];
  for (const A of EW) for (const [a, b] of spans(A.x0, A.x1, COVERED[A.id])) {
    const n = Math.max(2, Math.round((b - a) / 160));
    out.push({ ...A, id: `${A.id}${a === A.x0 ? '' : '-' + Math.round(a)}`, points: Array.from({ length: n + 1 }, (_, k) => [a + (b - a) * k / n, Y, A.z]) });
  }
  for (const A of NS) for (const [a, b] of spans(A.z0, A.z1, COVERED[A.id])) {
    const n = Math.max(2, Math.round((b - a) / 160));
    out.push({ ...A, id: `${A.id}${a === A.z0 ? '' : '-' + Math.round(a)}`, points: Array.from({ length: n + 1 }, (_, k) => [A.x, Y, a + (b - a) * k / n]) });
  }
  return out;
}

/** Junction patches where streets meet at grade (radius covers both carriageways and their sidewalks). */
export function cityJunctions() {
  const J = [];
  const add = (x, z, r) => { if (!J.some((j) => Math.hypot(j.pos[0] - x, j.pos[2] - z) < 6)) J.push({ pos: [x, Y + 0.02, z], radius: r }); };
  for (const E of EW) for (const N of NS) {
    if (N.x < E.x0 - 1 || N.x > E.x1 + 1 || E.z < N.z0 - 1 || E.z > N.z1 + 1) continue;
    if (N.x === ROUNDABOUT.x && E.z === ROUNDABOUT.z) { add(N.x, E.z, ROUNDABOUT.r + 12); continue; } // one plaza under the whole roundabout
    add(N.x, E.z, Math.max(E.w, N.w) * 0.5 + 6);
  }
  for (const E of EW) if (E.x0 === LEVEE_X) add(LEVEE_X, E.z, E.w * 0.5 + 10);   // T into the ring on the levee
  for (const N of NS) add(N.x, HEPING_Z, N.w * 0.5 + 10);                         // across the ring on Heping
  return J;
}
