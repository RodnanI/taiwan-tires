// Engine swap catalog. Generic engines (no trademarks). torque: [[rpm, Nm], ...] at full throttle, NA.
// mass = complete engine mass in kg (used to adjust vehicle mass and balance on swap).
export const ENGINES = {
  'i4-16': {
    name: '1.6L I4 16V', zh: '1.6升直四', layout: 'I4', displacement: 1.6, aspiration: 'NA', idle: 900, redline: 7600, limiter: 7900,
    torque: [[1000, 102], [2500, 122], [4000, 140], [5500, 151], [6600, 148], [7600, 130], [8200, 112]], inertia: 0.12, mass: 118, price: 90000,
  },
  'i4-20t': {
    name: '2.0L I4 Turbo', zh: '2.0升直四渦輪', layout: 'I4', displacement: 2.0, aspiration: 'turbo', idle: 850, redline: 7200, limiter: 7500,
    torque: [[1000, 150], [2500, 205], [3500, 225], [5000, 228], [6500, 205], [7200, 182], [7800, 160]], inertia: 0.15, mass: 140, price: 260000,
    boost: { max: 1.0, spool: [2400, 4000], lag: 0.75, type: 'turbo', eff: 0.88 },
  },
  'f4-25t': {
    name: '2.5L Flat-4 Turbo', zh: '2.5升水平對臥四缸渦輪', layout: 'F4', displacement: 2.5, aspiration: 'turbo', idle: 800, redline: 6800, limiter: 7100,
    torque: [[1000, 180], [2500, 238], [3600, 255], [5000, 250], [6000, 228], [6800, 205], [7300, 182]], inertia: 0.16, mass: 150, price: 310000,
    boost: { max: 1.05, spool: [2600, 4100], lag: 0.85, type: 'turbo', eff: 0.88 },
  },
  'i5-25t': {
    name: '2.5L I5 Turbo', zh: '2.5升直五渦輪', layout: 'I5', displacement: 2.5, aspiration: 'turbo', idle: 850, redline: 7000, limiter: 7300,
    torque: [[1000, 190], [2200, 260], [3500, 272], [5000, 268], [6200, 245], [7000, 215], [7600, 190]], inertia: 0.16, mass: 160, price: 380000,
    boost: { max: 1.2, spool: [2300, 3900], lag: 0.8, type: 'turbo', eff: 0.9 },
  },
  'i6-26tt': {
    name: '2.6L I6 Twin-Turbo', zh: '2.6升直六雙渦輪', layout: 'I6', displacement: 2.6, aspiration: 'twinturbo', idle: 850, redline: 7600, limiter: 8000,
    torque: [[1000, 170], [2500, 225], [4000, 250], [5500, 258], [6800, 240], [7600, 215], [8200, 190]], inertia: 0.17, mass: 205, price: 420000,
    boost: { max: 0.9, spool: [2700, 4300], lag: 0.65, type: 'turbo', eff: 0.9 },
  },
  'i6-30t': {
    name: '3.0L I6 Turbo', zh: '3.0升直六渦輪', layout: 'I6', displacement: 3.0, aspiration: 'turbo', idle: 800, redline: 7000, limiter: 7300,
    torque: [[1000, 215], [2500, 280], [3800, 300], [5000, 302], [6200, 280], [7000, 250], [7600, 220]], inertia: 0.19, mass: 230, price: 480000,
    boost: { max: 1.0, spool: [2900, 4500], lag: 0.95, type: 'turbo', eff: 0.9 },
  },
  'r2-13tt': {
    name: '1.3L Twin-Rotor Twin-Turbo', zh: '1.3升雙轉子雙渦輪', layout: 'R2', displacement: 1.3, aspiration: 'twinturbo', idle: 950, redline: 8800, limiter: 9200,
    torque: [[1000, 120], [3000, 168], [5000, 190], [6500, 196], [7800, 186], [8800, 165], [9400, 145]], inertia: 0.09, mass: 120, price: 400000,
    boost: { max: 0.8, spool: [3000, 4800], lag: 0.6, type: 'turbo', eff: 0.88 },
  },
  'v6-35tt': {
    name: '3.5L V6 Twin-Turbo', zh: '3.5升V6雙渦輪', layout: 'V6', displacement: 3.5, aspiration: 'twinturbo', idle: 800, redline: 7100, limiter: 7400,
    torque: [[1000, 260], [2400, 340], [3600, 360], [5000, 352], [6200, 325], [7100, 290], [7600, 260]], inertia: 0.2, mass: 215, price: 560000,
    boost: { max: 0.85, spool: [2200, 3800], lag: 0.6, type: 'turbo', eff: 0.9 },
  },
  'v8-50': {
    name: '5.0L V8', zh: '5.0升V8', layout: 'V8', displacement: 5.0, aspiration: 'NA', idle: 750, redline: 7400, limiter: 7700,
    torque: [[1000, 390], [2500, 465], [4000, 520], [5000, 540], [6200, 520], [7400, 470], [7900, 430]], inertia: 0.25, mass: 215, price: 520000,
  },
  'v8-62sc': {
    name: '6.2L V8 Supercharged', zh: '6.2升V8機械增壓', layout: 'V8', displacement: 6.2, aspiration: 'supercharger', idle: 700, redline: 6500, limiter: 6800,
    torque: [[1000, 480], [2000, 560], [3500, 600], [4500, 610], [5500, 580], [6500, 520], [7000, 480]], inertia: 0.3, mass: 260, price: 760000,
    boost: { max: 0.6, spool: [1200, 4000], lag: 0.05, type: 'supercharger', eff: 0.85 },
  },
  'v10-52': {
    name: '5.2L V10', zh: '5.2升V10', layout: 'V10', displacement: 5.2, aspiration: 'NA', idle: 900, redline: 8500, limiter: 8800,
    torque: [[1000, 360], [3000, 455], [5000, 520], [6500, 560], [7600, 550], [8500, 505], [9000, 470]], inertia: 0.2, mass: 225, price: 880000,
  },
  'v12-65': {
    name: '6.5L V12', zh: '6.5升V12', layout: 'V12', displacement: 6.5, aspiration: 'NA', idle: 950, redline: 8500, limiter: 8800,
    torque: [[1000, 430], [3000, 560], [5000, 640], [6500, 700], [7500, 690], [8500, 630], [9000, 590]], inertia: 0.24, mass: 250, price: 1250000,
  },
};
export const ENGINE_IDS = Object.keys(ENGINES);

/** Rough engine mass when a vehicle spec does not give one. */
export function estimateEngineMass(e) {
  const cyl = { I3: 3, I4: 4, I5: 5, I6: 6, F4: 4, F6: 6, V6: 6, V8: 8, V10: 10, V12: 12, R2: 2, R3: 3 }[e.layout] || 4;
  return Math.round(55 + e.displacement * 28 + cyl * 6 + (e.aspiration !== 'NA' ? 18 : 0));
}

/** Peak power (kW) and the rpm it happens at, from a torque curve [[rpm, Nm]...] and optional boost multiplier fn. */
export function peakPower(torque, mult = () => 1) {
  let best = 0, at = 0;
  const lo = torque[0][0], hi = torque[torque.length - 1][0];
  for (let r = lo; r <= hi; r += 50) {
    let t = 0;
    for (let i = 0; i < torque.length - 1; i++) {
      if (r >= torque[i][0] && r <= torque[i + 1][0]) { const k = (r - torque[i][0]) / (torque[i + 1][0] - torque[i][0]); t = torque[i][1] + (torque[i + 1][1] - torque[i][1]) * k; break; }
    }
    const kw = (t * mult(r) * r * Math.PI) / 30 / 1000;
    if (kw > best) { best = kw; at = r; }
  }
  return { kw: best, hp: best * 1.341, rpm: at };
}
