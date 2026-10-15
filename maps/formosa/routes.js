// Road geometry of the Formosa map (pure data): alignments, height profiles, tunnel ranges and the terrain
// corridors derived from them. map.js turns these into `roads`; terrain.js bends the hills to CORRIDORS.
// Points are [x, y, z, width]. Mountain roads were traced along the terrain (traced.js, generated).
import { fillet, belt, chain, stationHeights, cumDist } from './align.js';
import { CITY_Y, coastZ } from './geo.js';
import * as TR from './traced.js';

/** Point on the coast shelf: x and metres inland from the waterline. */
const coast = (x, inland) => [x, Math.round(coastZ(x) + inland)];

// ------------------------------------------------------------------------------------------- Formosa Ring
// One closed road through every region, clockwise: city levee north along the Tamsui, the river to Tamsui,
// east along the north coast (Shimen tunnel, Wanli cliff ledge and tunnel, the harbour, the cape tunnel),
// south through the Bitou pass, down the paddy valley, west through the Elephant Mountain tunnel into Xinyi
// and along Heping Road back to the river. PIs: [x, z, height, fillet radius, tag].
const RING_PI = [
  [-1765, 1520, CITY_Y, 0, 'start'],      // 0 start / finish on the levee (straight)
  [-1765, 420, CITY_Y, 1200],             // 1
  [-1805, -240, 8.5, 900],                // 2 Guandu
  [-1785, -820, 8.5, 900],                // 3
  [-1722, -1300, 9.5, 700],               // 4
  [-1735, -1640, 10, 230],                // 5 Tamsui: turn onto the coast
  [...coast(-1530, 105), 9, 420],         // 6
  [...coast(-1285, 110), 11, 0, 'shimen-in'],  // 7 Shimen tunnel west portal
  [...coast(-890, 112), 12, 0, 'shimen-out'],  // 8 east portal
  [...coast(-640, 100), 9, 600],          // 9
  [...coast(-330, 100), 9, 700],          // 10
  [...coast(40, 125), 9.5, 700],          // 11 Yehliu
  [...coast(330, 115), 9, 600],           // 12
  [...coast(560, 150), 8.5, 420],         // 13 Jinshan
  [...coast(720, 80), 12, 260],           // 14 onto the Wanli cliff ledge
  [...coast(830, 46), 21, 0, 'wanli-in'], // 15 Wanli tunnel west portal
  [...coast(1070, 58), 22, 0, 'wanli-out'], // 16 east portal
  [...coast(1210, 70), 15, 240],          // 17 down off the ledge
  [...coast(1400, 110), 8.5, 500],        // 18 the harbour
  [...coast(1720, 105), 9, 420],          // 19
  [...coast(1860, 120), 12, 0, 'cape-in'], // 20 cape tunnel west portal
  [2235, -1975, 14, 0, 'cape-out'],       // 21 east portal
  [2305, -1880, 16, 150],                 // 22 into the Bitou pass
  [2355, -1690, 34, 260],                 // 23
  [2300, -1470, 52, 300],                 // 24
  [2345, -1250, 62, 320],                 // 25 the pass
  [2280, -1020, 50, 300],                 // 26
  [2230, -790, 31, 360],                  // 27
  [2120, -470, 21, 500],                  // 28 into the valley
  [1880, 120, 16, 900],                   // 29
  [1790, 720, 10, 900],                   // 30 Wujie village
  [1730, 1250, 9, 800],                   // 31
  [1580, 1720, 9, 380],                   // 32
  [1330, 1930, 11, 0, 'elephant-in'],     // 33 Elephant Mountain tunnel east portal
  [870, 2018, 11, 0, 'elephant-out'],     // 34 west portal (Xinyi)
  [700, 2020, CITY_Y, 0],                 // 35 Heping Road
  [-1765, 2020, CITY_Y, 60],              // 36 the corner at the river
];

function buildRing() {
  const pis = RING_PI.map((p) => [p[0], p[1]]);
  const pts = fillet(pis, RING_PI.map((p) => p[3]), { closed: true, step: 20 });
  const out = stationHeights(pts, RING_PI.map((p) => p[2]), 12, true);
  const tag = (t) => out.stationDist[RING_PI.findIndex((p) => p[4] === t)];
  // portal offsets (m) put each portal where the hillside is about 10 m above the road
  const tunnels = [['shimen', 'Shimen Tunnel', '石門隧道', 18, 28], ['wanli', 'Wanli Tunnel', '萬里隧道', 0, 125], ['cape', 'Bitou Cape Tunnel', '鼻頭隧道', -24, 12], ['elephant', 'Elephant Mountain Tunnel', '象山隧道', 228, 82]]
    .map(([k, name, zh, da, db]) => ({ from: tag(`${k}-in`) + da, to: tag(`${k}-out`) + db, name, zh }));
  return { pts: out, tunnels, length: out.total, stations: out.stationDist };
}
export const RING = buildRing();

// ------------------------------------------------------------------------------------------- mountains
export const QIXING_LOOP = TR.QIXING_LOOP;
// Yangming Road: the traced climb, then the last 350 m run east under the loop embankment and meet the loop
// at a T in its low point (the traced end reached the loop 24 m below it). The grade eases from the climb's
// 10 % to level at the junction.
export const TOUGE_JUNCTION = TR.QIXING_LOOP[30];
export const TOUGE = (() => {
  const keep = 148, head = TR.TOUGE.slice(0, keep + 1), a = head[keep], J = TOUGE_JUNCTION;
  const tail = fillet([[a[0], a[2]], [-320, -650], [J[0], J[2]]], [0, 45, 0], { step: 12 });
  const d = cumDist(tail.map((p) => [p[0], 0, p[1]])), L = d[d.length - 1];
  const m0 = (a[1] - head[keep - 1][1]) / Math.hypot(a[0] - head[keep - 1][0], a[2] - head[keep - 1][2]);
  const k = m0 * L / (J[1] - a[1]), b = 0.05;                     // cubic ease: slope k at the start, b at the end
  const ease = (t) => k * t + (3 - 2 * k - b) * t * t + (k + b - 2) * t * t * t;
  return [...head, ...tail.slice(1).map((p, i) => [p[0], +(a[1] + (J[1] - a[1]) * ease(d[i + 1] / L)).toFixed(2), p[1]])];
})();
const loopAt = (k) => TR.QIXING_LOOP[TR.QIXING_STATIONS[k]];
const nearestOn = (pts, x, z) => { let b = null, bd = Infinity; for (const q of pts) { const d = Math.hypot(q[0] - x, q[2] - z); if (d < bd) { bd = d; b = q; } } return b; };



// Jiufen Road: from the harbour on the ring, four hairpins up the bowl under Jiufen, the lantern street along
// the Jiufen terrace, then west along the Wuzhi ridge crest to the Seven Star loop. One road: "sea to summit".
function buildJiufen() {
  const a = nearestOn(RING.pts, 1690, -1795);
  const stack = belt([a[0], a[2]], [
    [1636.5, -1814.8, 40, 'R'],  // leave the ring at 35 degrees, then swing west under the town
    [1290, -1732, 27, 'L'],      // H1
    [1760, -1677, 27, 'R'],      // H2
    [1300, -1622, 27, 'L'],      // H3
    [1740, -1567, 27, 'R'],      // H4
  ], [1520, -1540], { step: 16 });
  const loopJ = nearestOn(TR.QIXING_LOOP, -225, -1223);
  const ridge = fillet([[1520, -1540], [1380, -1500], [1180, -1445], [1060, -1300], [900, -1370], [740, -1300], [600, -1340],
    [460, -1250], [300, -1300], [160, -1215], [20, -1250], [-110, -1310], [loopJ[0], loopJ[2]]],
  [0, 120, 200, 110, 120, 120, 130, 120, 130, 110, 90, 50, 0], { step: 14 });
  const pts = chain(stack, ridge);
  // heights per station: ring, the swing west, H1..H4, leg end | street, street end, ridge bends..., loop
  const ys = [a[1], 14, 52, 99, 146, 192, 214, 228, 232, 236, 238, 240, 244, 256, 266, 280, 296, 310, loopJ[1]];
  return { pts: stationHeights(pts, ys, 9), from: a, to: loopJ };
}
export const JIUFEN_ROAD = buildJiufen();
export const JIUFEN = JIUFEN_ROAD.pts;

// ------------------------------------------------------------------------------------------- valley + spurs
// Paddy rally: a gravel farm-road loop west of the valley highway. Long dike straights, square farm corners,
// two splashes through Dongshan creek and a humped canal bridge that throws the car in the air.
export const RALLY = (() => {
  const pis = [[1330, 1420], [1320, 1160], [1335, 1060], [1320, 940], [1360, 780], [1300, 600], [1310, 400], [1330, 250], [1450, 175],
    [1600, 230], [1655, 520], [1570, 660], [1640, 820], [1655, 960], [1650, 1060], [1665, 1200], [1590, 1320], [1470, 1470]];
  const pts = fillet(pis, [40, 0, 120, 0, 90, 70, 0, 50, 45, 50, 60, 55, 60, 0, 120, 70, 60, 50], { closed: true, step: 12 });
  // terrain-following [x, z] points, except the canal hump on the west straight (pinned for the jump)
  return pts.map((p) => {
    const dz = p[1] - 700;
    if (Math.abs(p[0] - 1310) < 30 && Math.abs(dz) < 22) return [p[0], +(9.6 + 1.25 * Math.cos((dz / 22) * Math.PI * 0.5) ** 2).toFixed(2), p[1], 8];
    return [p[0], p[1]];
  });
})();
// Guandu Bridge: the red arch across the Tamsui to the Bali riverside car park (dead end, drift zone).
export const GUANDU = (() => {
  const p2 = fillet([[-1805, -250], [-2120, -262], [-2330, -268], [-2380, -330], [-2370, -520]], [0, 0, 60, 50, 0], { step: 12 });
  let d = 0;
  return p2.map((p, i) => {
    if (i) d += Math.hypot(p[0] - p2[i - 1][0], p[1] - p2[i - 1][1]);
    const x = p[0];
    // deck: 9 m at the levee, 15 m over the water, down to the west flats
    const y = x > -1850 ? 8.5 + (-1805 - x) * 0.0 : x > -2290 ? 15 - Math.abs((x + 2070) / 220) ** 2 * 5.5 : Math.max(3.1, 9.5 - (-2290 - x) * 0.09 - Math.max(0, d - 600) * 0.05);
    return [p[0], +y.toFixed(2), p[1], 11];
  });
})();
export const GUANDU_BRIDGE = { from: 40, to: 520 };
// Yehliu: out along the sandstone cape to the geopark car park.
const YEHLIU_FROM = nearestOn(RING.pts, 30, -1920);
export const YEHLIU = fillet([[YEHLIU_FROM[0], YEHLIU_FROM[2]], [42, -2030], [26, -2120], [20, -2175]], [0, 60, 80, 0], { step: 10 }).map((p) => [p[0], p[1]]);
// Riverside park: down the levee from Heping corner to the flats under the city, then north along the river to
// the big riverside car park (the drift venue) where it ends.
export const RIVER_PARK = { x0: -1906, x1: -1832, z0: 1168, z1: 1546, y: 3.12 };
export const RIVERSIDE = (() => {
  const a = nearestOn(RING.pts, -1765, 1920);
  const p2 = fillet([[a[0], a[2]], [-1830, 1930], [-1868, 1860], [-1868, 1700], [-1868, RIVER_PARK.z1]], [0, 30, 40, 0, 0], { step: 12 });
  let d = 0;
  return p2.map((p, i) => { if (i) d += Math.hypot(p[0] - p2[i - 1][0], p[1] - p2[i - 1][1]); return [p[0], +(Math.max(3.1, 10 - d * 0.075)).toFixed(2), p[1], 10]; });
})();

// Dongshan farm road: a concrete lane from the valley highway across to the rally loop's east dike.
const LINK_RING = nearestOn(RING.pts, 1765, 900);
export const FARM_LINK = [[1649, 900], [1700, 901], [LINK_RING[0], LINK_RING[2]]];

// Fishing harbour: the quay apron sits under the ring at 5 m; a ramp drops to it from the east.
export const HARBOUR = { x0: 1395, x1: 1712, zq: -1893, y: 5.0, rampZ: -1849 };
const RAMP_FROM = nearestOn(RING.pts, 1765, -1814);
export const HARBOUR_RAMP = [[RAMP_FROM[0], RAMP_FROM[1], RAMP_FROM[2]], [1746, 7.9, -1830], [1726, 6.0, -1843], [HARBOUR.x1, HARBOUR.y + 0.01, HARBOUR.rampZ]];

/** Junction patches outside the city grid: bent to the roads on a grade. */
export const JUNCTIONS = [
  { pos: TOUGE_JUNCTION.slice(0, 3), radius: 12, fit: true },
  { pos: JIUFEN_ROAD.to.slice(0, 3), radius: 12, fit: true },
  { pos: JIUFEN_ROAD.from.slice(0, 3), radius: 13, fit: true },
  { pos: YEHLIU_FROM.slice(0, 3), radius: 12, fit: true },
  { pos: RIVERSIDE[0].slice(0, 3), radius: 12, fit: true },
  { pos: GUANDU[0].slice(0, 3), radius: 13, fit: true },
  { pos: LINK_RING.slice(0, 3), radius: 11, fit: true },
  { pos: FARM_LINK[0], radius: 8, fit: true, surface: 'gravel' },
  { pos: RAMP_FROM.slice(0, 3), radius: 10, fit: true },
];

// ------------------------------------------------------------------------------------------- corridors
// Terrain follows these road profiles (bench = full strength half width, fall = blend distance).
const skip = (list) => list.map((t) => [t.from - 6, t.to + 6]);
export const CORRIDORS = [
  { pts: RING.pts, bench: 16, fall: 60, skip: skip(RING.tunnels), tunnels: RING.tunnels.map((t) => [t.from, t.to]) },
  { pts: TOUGE, bench: 12, fall: 55 },
  { pts: [...QIXING_LOOP, QIXING_LOOP[0]], bench: 14, fall: 60 },
  { pts: JIUFEN, bench: 11, fall: 50 },
  { pts: GUANDU, bench: 8, fall: 20, skip: [[GUANDU_BRIDGE.from, GUANDU_BRIDGE.to]] },
  { pts: RIVERSIDE, bench: 9, fall: 24 },
];
