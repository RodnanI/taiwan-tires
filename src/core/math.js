// Small, allocation-free math helpers shared by every system. Pure functions only (safe in Node).
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const G = 9.81;
export const AIR_DENSITY = 1.225;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => c + (d - c) * clamp01(invLerp(a, b, v));
export const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const sq = (v) => v * v;

/** Frame-rate independent exponential smoothing. lambda ~ 1/time-constant. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
/** Move value towards target by at most maxDelta. */
export const approach = (v, target, maxDelta) => (v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target));
export const wrapAngle = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

/** Piecewise-linear lookup in [[x, y], ...] sorted by x. Clamps at the ends. */
export function curveLookup(points, x) {
  const n = points.length;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid][0] <= x) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi];
  return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0]));
}

/** Smooth (monotone-ish Catmull-Rom) lookup in [[x, y], ...]. */
export function curveLookupSmooth(points, x) {
  const n = points.length;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];
  let i = 0;
  while (i < n - 2 && points[i + 1][0] < x) i++;
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
  const t = (x - p1[0]) / (p2[0] - p1[0]);
  const m1 = (p2[1] - p0[1]) / Math.max(1e-6, (p2[0] - p0[0])) * (p2[0] - p1[0]);
  const m2 = (p3[1] - p1[1]) / Math.max(1e-6, (p3[0] - p1[0])) * (p2[0] - p1[0]);
  const t2 = t * t, t3 = t2 * t;
  const v = (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
  return clamp(v, lo - (hi - lo) * 0.15, hi + (hi - lo) * 0.15);
}

/** Seeded PRNG (mulberry32). Returns a function producing [0,1). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashString = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 2D value noise in [0,1]. */
export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise in roughly [0,1]. */
export function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * valueNoise(x * freq, y * freq); norm += amp; amp *= gain; freq *= lacunarity; }
  return sum / norm;
}
/** Ridged noise, nice for mountains, in [0,1]. */
export function ridged(x, y, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { const n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1); sum += amp * n * n; norm += amp; amp *= 0.5; freq *= 2.03; }
  return sum / norm;
}

// ---- formatting -------------------------------------------------------------------------------
export function fmtTime(sec, withMs = true) {
  if (sec == null || !isFinite(sec)) return withMs ? '--:--.---' : '--:--';
  const neg = sec < 0; sec = Math.abs(sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), ms = Math.floor((sec * 1000) % 1000);
  const base = `${m}:${String(s).padStart(2, '0')}`;
  return (neg ? '-' : '') + (withMs ? `${base}.${String(ms).padStart(3, '0')}` : base);
}
export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
export const fmtCredits = (n) => `NT$ ${fmtInt(n)}`;
export const speedUnit = (units) => (units === 'mph' ? 'MPH' : 'KM/H');
export const toDisplaySpeed = (ms, units) => (units === 'mph' ? ms * 2.23694 : ms * 3.6);
