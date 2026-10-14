// Tyre model: normalized combined-slip curve (similarity method) with load sensitivity.
//   sx = slipRatio / peakSlip, sy = tan(slipAngle) / tan(peakAngle), s = |(sx, sy)|
//   f(s) rises as sin(pi/2 s) to 1 at s = 1, then decays to `slide` (Gaussian falloff).
//   F = mu_eff * Fz * f(s), split along (sx, sy)/s. Spinning rears (big sx) steal lateral grip -> oversteer.
// Everything a compound needs lives in COMPOUNDS so tuning, AI tune and docs share one source of truth.
import { DEG } from '../core/math.js';
import { surfaceById } from './Surfaces.js';

export const COMPOUNDS = {
  street:    { name: 'Street',     zh: '街胎',   mu: 0.9, latScale: 1, slide: 0.79, peakSlip: 0.10,  peakAngle: 7.5, falloff: 1.0,  pOpt: 2.2, affinity: { paved: 1, loose: 0.66, grass: 0.6 },  wet: 0.8,  rr: 1.0,  price: 0,      grade: 1 },
  sport:     { name: 'Sport',      zh: '運動胎', mu: 0.98, latScale: 1, slide: 0.78, peakSlip: 0.095, peakAngle: 7.0, falloff: 1.1,  pOpt: 2.2, affinity: { paved: 1, loose: 0.6, grass: 0.55 },  wet: 0.76, rr: 1.0,  price: 28000,  grade: 2 },
  semiSlick: { name: 'Semi-slick', zh: '半熱熔', mu: 1.08, latScale: 1, slide: 0.76, peakSlip: 0.09,  peakAngle: 6.5, falloff: 1.25, pOpt: 2.0, affinity: { paved: 1, loose: 0.52, grass: 0.48 }, wet: 0.64, rr: 1.05, price: 56000,  grade: 3 },
  slick:     { name: 'Race slick', zh: '熱熔胎', mu: 1.2, latScale: 1, slide: 0.73, peakSlip: 0.085, peakAngle: 6.0, falloff: 1.4,  pOpt: 1.9, affinity: { paved: 1, loose: 0.42, grass: 0.4 },  wet: 0.42, rr: 1.1,  price: 92000,  grade: 4 },
  drift:     { name: 'Drift',      zh: '甩尾胎', mu: 0.92, latScale: 1, slide: 0.9,  peakSlip: 0.12,  peakAngle: 9.0, falloff: 0.55, pOpt: 2.4, affinity: { paved: 1, loose: 0.6, grass: 0.56 },  wet: 0.72, rr: 1.0,  price: 34000,  grade: 2 },
  rally:     { name: 'Rally',      zh: '拉力胎', mu: 0.9, latScale: 1, slide: 0.86, peakSlip: 0.13,  peakAngle: 9.5, falloff: 0.7,  pOpt: 2.0, affinity: { paved: 1, loose: 0.97, grass: 0.82 }, wet: 0.86, rr: 1.15, price: 38000,  grade: 2 },
  offroad:   { name: 'Off-road',   zh: '越野胎', mu: 0.82, latScale: 1, slide: 0.86, peakSlip: 0.14,  peakAngle: 10,  falloff: 0.6,  pOpt: 1.8, affinity: { paved: 1, loose: 1.03, grass: 0.95 }, wet: 0.85, rr: 1.4,  price: 30000,  grade: 1 },
  drag:      { name: 'Drag',       zh: '直線胎', mu: 1.24,  latScale: 0.72, slide: 0.8, peakSlip: 0.1, peakAngle: 8.5, falloff: 1.0, pOpt: 1.4, affinity: { paved: 1, loose: 0.5, grass: 0.45 }, wet: 0.5, rr: 1.2, price: 45000, grade: 3 },
};
export const COMPOUND_KEYS = Object.keys(COMPOUNDS);

const HALF_PI = Math.PI / 2;
export const V_EPS = 1.0; // m/s: below this the tyre behaves like a (clamped) viscous damper

/**
 * Static per-wheel tyre parameters (recomputed when tune/surface changes).
 * Returns an object reused every step by evaluateTire().
 */
export function makeTireState(compoundKey, widthMm, pressureBar, staticLoad) {
  const c = COMPOUNDS[compoundKey] || COMPOUNDS.street;
  const pressure = pressureBar || c.pOpt;
  const pDev = (pressure - c.pOpt) / c.pOpt;
  const pressureGrip = 1 - 0.6 * pDev * pDev;
  const stiff = Math.pow(c.pOpt / pressure, 0.35);
  const widthGrip = Math.pow((widthMm || 225) / 225, 0.22);
  return {
    compound: c, key: compoundKey,
    baseMu: c.mu * pressureGrip * widthGrip,
    latScale: c.latScale,
    slide: c.slide,
    falloff: c.falloff,
    peakSlip: c.peakSlip * stiff,
    tanPeak: Math.tan(c.peakAngle * DEG * stiff),
    fz0: 0.5 * (staticLoad + 3500),
    rr: 0.011 * c.rr * (1 + Math.max(0, -pDev) * 0.8),
    width: widthMm, pressure,
  };
}

/**
 * Evaluate tyre forces in the contact frame.
 * @param t      tyre state from makeTireState
 * @param Fz     normal load (N)
 * @param vx,vy  contact-patch velocity along wheel forward / left (m/s)
 * @param wR     wheel surface speed omega * radius (m/s)
 * @param surf   surface id
 * @param grip   extra multiplier (camber, wetness, assists, difficulty)
 * @param out    result object {fx, fy, slipRatio, slipAngle, s, dFx, mu}
 */
export function evaluateTire(t, Fz, vx, vy, wR, surf, grip, out) {
  const s0 = surfaceById(surf);
  const vden = Math.max(Math.abs(vx), V_EPS);
  const kappa = (wR - vx) / vden;
  const tanA = vy / vden;
  const sx = kappa / t.peakSlip;
  const sy = tanA / t.tanPeak;
  const s = Math.sqrt(sx * sx + sy * sy);
  let ratio = Fz / t.fz0;
  ratio = ratio < 0.05 ? 0.05 : ratio > 4 ? 4 : ratio;
  const mu = t.baseMu * (t.compound.affinity[s0.class] ?? 1) * s0.friction * Math.pow(ratio, -0.16) * grip;
  const Fmax = mu * Fz;
  let f, df;
  if (s <= 1) { f = Math.sin(HALF_PI * s); df = HALF_PI * Math.cos(HALF_PI * s); }
  else { const d = s - 1; const e = Math.exp(-t.falloff * d * d); f = t.slide + (1 - t.slide) * e; df = (1 - t.slide) * e * (-2 * t.falloff * d); }
  let fx = 0, fy = 0, dFdk;
  if (s > 1e-5) {
    const inv = 1 / s;
    fx = Fmax * f * sx * inv;
    fy = -Fmax * f * sy * inv * t.latScale;
    // d fx / d kappa (for the implicit wheel solve). Only the stable (positive) part.
    const kx = df * sx * sx * inv * inv + f * sy * sy * inv * inv * inv;
    dFdk = kx > 0 ? (Fmax * kx) / t.peakSlip : 0;
  } else {
    dFdk = (Fmax * HALF_PI) / t.peakSlip;
  }
  out.fx = fx; out.fy = fy;
  out.slipRatio = kappa;
  out.slipAngle = Math.atan(tanA);
  out.s = s;
  out.dFdOmegaR = dFdk / vden; // d fx / d (omega*R)
  out.mu = mu;
  return out;
}
