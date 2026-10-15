// Shared geography of the Formosa map: bounds, the city plateau, the paddy valley, the coastline and the river.
// Pure data and helpers (Node-safe); terrain.js, routes.js and the builders all read from here.
// World: +X east, -Z north (the sea), +Y up, 1 unit = 1 m.

export const BOUNDS = { x0: -2560, x1: 2560, z0: -2400, z1: 2560 };
export const CITY_Y = 10;
export const FLATS_Y = 2.6;           // riverside parks between the river and the levee
export const CITY = { x0: -1700, x1: 740, z0: 440, z1: 2320 };
/** The paddy valley (Lanyang plain, compressed): floor rises gently to the north. */
export const VALLEY = { x0: 1200, x1: 2300, z0: -380, z1: 2300, floor: (z) => 8 + Math.min(1, Math.max(0, (900 - z) / 1300)) * 12 };

export const sst = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
export const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

/** Catmull-Rom through [x, y] points sorted by x (clamped at the ends). */
export function curve1D(pts) {
  const n = pts.length;
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (i < n - 2 && pts[i + 1][0] < x) i++;
    const p0 = pts[Math.max(0, i - 1)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(n - 1, i + 2)][1];
    const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
}

/** Distance from (x, z) to a polyline of [x, z, w] points: { d, w } (w interpolated half width). */
export function polyDist(pts, x, z) {
  let best = Infinity, bw = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, aw] = pts[i], [bx, bz, bw2] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x, pz = az + dz * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; bw = aw + (bw2 - aw) * t; }
  }
  return { d: Math.sqrt(best), w: bw };
}

// North shore: z of the waterline as a function of x (capes reach further north = more negative z).
export const coastZ = curve1D([
  [-2700, -1700], [-2450, -1780], [-2250, -1930], [-2050, -1930], [-1800, -1900], [-1450, -1990], [-1150, -2120],
  [-950, -2110], [-700, -1960], [-350, -1990], [-80, -2040], [180, -1990], [520, -1880], [820, -1950], [1050, -2080],
  [1300, -1960], [1520, -1890], [1800, -1930], [2100, -2130], [2350, -2060], [2700, -1900],
]);
// How cliffy the shore is where there is no shelf (0 = beach, 1 = cliff) along x.
export const cliffAt = curve1D([
  [-2700, 0.7], [-2300, 0.2], [-1800, 0.1], [-1450, 0.05], [-1250, 0.6], [-1100, 1], [-900, 0.9], [-700, 0.3],
  [-300, 0.4], [-80, 0.3], [250, 0.15], [520, 0.0], [760, 0.7], [1050, 1], [1250, 0.5], [1520, 0.1], [1850, 0.6],
  [2100, 1], [2700, 1],
]);
// Width of the flat coastal shelf (m from the waterline) carrying the coast highway; 0 at the headlands.
export const shelfAt = curve1D([
  [-2700, 0], [-2300, 0], [-1800, 160], [-1450, 200], [-1300, 150], [-1200, 0], [-920, 0], [-820, 150],
  [-400, 170], [-150, 160], [200, 190], [520, 240], [700, 140], [780, 0], [1180, 0], [1260, 120], [1500, 190],
  [1800, 160], [1880, 0], [2700, 0],
]);
// Dongshan creek: a shallow stream across the paddy valley (fordable; the rally loop splashes through it).
export const CREEK = { pts: [[1150, 1080], [1320, 1010], [1500, 1040], [1660, 980], [1820, 1010], [2000, 960], [2180, 1000], [2360, 960]], w: 7, depth: 1.7 };
// Tamsui river: centreline [x, z, half width], south edge to the mouth.
export const RIVER = [
  [-2230, 2760, 170], [-2160, 2200, 160], [-2075, 1600, 150], [-2045, 1000, 145], [-2070, 400, 150], [-2115, -200, 165],
  [-2085, -800, 175], [-2035, -1300, 190], [-2090, -1720, 240], [-2200, -2150, 320],
];
