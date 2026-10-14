// AI tune: searches parts + tune for a goal under constraints (class cap, budget, drivetrain, tyre rules).
// Genetic algorithm over a mixed genome (discrete part levels + normalised tune sliders), followed by a
// hill-climb on the tune. Fitness comes from Performance.analyze (and lapTime for route goals).
// Runs as a generator so the UI can time-slice it (no worker needed, progress bar stays smooth).
import { PART_SLOTS, partLevel, partAllowed } from './Parts.js';
import { TUNE_DEFS, tuneSliders } from './Tune.js';
import { analyze, lapTime, CLASSES } from './Performance.js';
import { buildWorkingSpec } from '../vehicles/VehicleSpec.js';
import { rng, clamp } from '../core/math.js';

export const GOALS = {
  balanced: { name: 'Best in class', zh: '同級最強', desc: 'Maximise overall performance (PI) within the class limit.' },
  grip: { name: 'Grip / circuit', zh: '抓地', desc: 'Cornering and braking first, then power.' },
  drift: { name: 'Drift', zh: '甩尾', desc: 'Angle, throttle steer, a rear that lights up on demand.' },
  topspeed: { name: 'Top speed', zh: '極速', desc: 'Highways and expressways. Long gears, low drag.' },
  accel: { name: 'Acceleration / drag', zh: '加速', desc: 'Launch, traction and 0-200.' },
  touge: { name: 'Touge', zh: '山道', desc: 'Mountain passes: braking, mid-corner balance, punch out of hairpins.' },
  street: { name: 'City streets', zh: '街道', desc: 'Tight Taipei corners: response and low-speed punch.' },
  track: { name: 'Specific route', zh: '指定路線', desc: 'Minimise the estimated lap time on a chosen event route.' },
};

const SLOT_LIST = PART_SLOTS.filter((s) => s.id !== 'bov');
const STREET_TIRES = ['stock', 'street', 'sport', 'drift', 'rally'];

export function partsCostFor(parts, owned = {}) {
  let c = 0;
  for (const [slot, lvl] of Object.entries(parts)) {
    if (!lvl || lvl === 'stock') continue;
    if ((owned[slot] || []).includes(lvl)) continue;
    c += partLevel(slot, lvl)?.price || 0;
  }
  return c;
}

export class AITuner {
  /**
   * @param def vehicle def
   * @param car garage entry ({ parts, tune, owned })
   * @param o { goal, classMax (PI or null), budget, drivetrain, tires, allowSwap, allowAero, route, population, generations, seed }
   */
  constructor(def, car, o) {
    this.def = def; this.car = car;
    this.o = { goal: 'balanced', classMax: null, budget: Infinity, drivetrain: 'keep', tires: 'any', allowSwap: false, allowAero: true, route: null, population: 34, generations: 26, seed: Date.now() & 0xffff, ...o };
    this.rand = rng(this.o.seed);
    // allowed levels per slot
    this.slots = SLOT_LIST.map((slot) => {
      let levels = slot.levels.map((l) => l.id).filter((id) => partAllowed(def, slot.id, id));
      if (slot.id === 'engineSwap' && !this.o.allowSwap) levels = ['stock'];
      if ((slot.id === 'frontAero' || slot.id === 'rearAero') && !this.o.allowAero) levels = ['stock'];
      if (slot.id === 'drivetrainSwap') {
        const want = this.o.drivetrain;
        if (want === 'keep') levels = ['stock'];
        else if (want !== 'any') levels = def.specs.drivetrain === want ? ['stock'] : [want];
      }
      if (slot.id === 'compound') {
        if (this.o.tires === 'street') levels = levels.filter((l) => STREET_TIRES.includes(l));
        if (this.o.tires === 'drift') levels = ['drift'];
      }
      if (!levels.length) levels = ['stock'];
      return { id: slot.id, levels };
    });
    this.evals = 0;
    this.before = this.evaluate({ parts: { ...(car.parts || {}) }, tune: car.tune ? { ...car.tune } : null, raw: true });
  }

  // ---- genome <-> config
  randomGenome(seedFrom = null) {
    const g = { p: {}, t: {} };
    for (const s of this.slots) {
      const cur = seedFrom?.parts?.[s.id] || 'stock';
      g.p[s.id] = seedFrom ? (s.levels.includes(cur) ? cur : s.levels[0]) : s.levels[Math.floor(this.rand() * s.levels.length)];
    }
    for (const d of TUNE_DEFS) g.t[d.key] = seedFrom ? null : this.rand();
    return g;
  }
  configFrom(g) {
    const parts = {};
    for (const [k, v] of Object.entries(g.p)) if (v && v !== 'stock') parts[k] = v;
    // map normalised tune genes onto the sliders available with these parts
    const base = buildWorkingSpec(this.def, parts, null);
    const sliders = tuneSliders(base, parts);
    const tune = {};
    for (const sl of sliders) {
      const n = g.t[sl.key];
      if (n == null) continue;
      tune[sl.key] = sl.min + (sl.max - sl.min) * clamp(n, 0, 1);
    }
    return { parts, tune };
  }

  evaluate(cfg) {
    this.evals++;
    const spec = buildWorkingSpec(this.def, cfg.parts, cfg.tune);
    const m = analyze(spec);
    const cost = partsCostFor(cfg.parts, this.car.owned);
    let lap = null;
    if (this.o.route) lap = lapTime(this.o.route, m, spec);
    return { ...cfg, m, cost, lap, spec, score: this.fitness(m, cost, lap, spec) };
  }
  fitness(m, cost, lap, spec) {
    const goal = this.o.goal;
    const b = m.bars;
    let f;
    switch (goal) {
      case 'topspeed': f = m.topSpeed + b.accel * 4; break;
      case 'accel': f = 200 / (m.t100 || 20) * 10 + 200 / (m.quarter || 30) * 6 + b.launch * 3; break;
      case 'grip': f = m.latG * 120 + m.latGHigh * 60 + (60 - m.braking) * 2 + b.accel * 4 - Math.abs(m.balance + 0.015) * 300; break;
      case 'drift': {
        const rearBias = spec.drivetrain === 'RWD' ? 1 : spec.drivetrain === 'AWD' ? clamp(1 - spec.awdSplit * 2, 0, 0.8) : 0;
        f = m.drift * 30 + rearBias * 40 + clamp(m.pwr, 80, 260) * 0.08 + clamp(m.balance * 120, -10, 6) + b.handling * 2;
        break;
      }
      case 'touge': f = b.handling * 9 + b.braking * 6 + b.accel * 6 + b.speed * 2 - Math.abs(m.balance) * 200; break;
      case 'street': f = b.accel * 9 + b.handling * 8 + b.braking * 4 + b.launch * 3 - Math.abs(m.balance) * 150; break;
      case 'track': f = lap ? -lap : m.pi; break;
      default: f = m.pi; // balanced: best PI under the cap
    }
    // every part must earn its keep (no buying a wing for a drag build)
    f -= cost / 200000;
    // constraints
    if (this.o.classMax != null && m.pi > this.o.classMax) f -= 50 + (m.pi - this.o.classMax) * 4;
    if (cost > this.o.budget) f -= 30 + ((cost - this.o.budget) / 10000) * 6;
    return f;
  }

  mutate(g, rate = 0.18) {
    const c = { p: { ...g.p }, t: { ...g.t } };
    for (const s of this.slots) if (this.rand() < rate * 0.6 && s.levels.length > 1) c.p[s.id] = s.levels[Math.floor(this.rand() * s.levels.length)];
    for (const k of Object.keys(c.t)) if (this.rand() < rate) c.t[k] = clamp((c.t[k] ?? 0.5) + (this.rand() - 0.5) * 0.35, 0, 1);
    return c;
  }
  cross(a, b) {
    const c = { p: {}, t: {} };
    for (const k of Object.keys(a.p)) c.p[k] = this.rand() < 0.5 ? a.p[k] : b.p[k];
    for (const k of Object.keys(a.t)) c.t[k] = this.rand() < 0.5 ? a.t[k] : b.t[k];
    return c;
  }

  /** Generator: yields { progress, best }, returns the final result. */
  *run() {
    const { population: N, generations: GENS } = this.o;
    // seed: current build (tune genes = middle), stock, and randoms
    const cur = this.randomGenome(this.car); for (const k of Object.keys(cur.t)) cur.t[k] = 0.5;
    let pop = [cur, this.randomGenome({ parts: {} })];
    pop[1].t = Object.fromEntries(Object.keys(cur.t).map((k) => [k, 0.5]));
    while (pop.length < N) pop.push(this.randomGenome());
    let scored = pop.map((g) => ({ g, r: this.evaluate(this.configFrom(g)) }));
    for (let gen = 0; gen < GENS; gen++) {
      scored.sort((a, b) => b.r.score - a.r.score);
      const elite = scored.slice(0, 4);
      const next = elite.map((e) => e.g);
      const pick = () => { let best = null; for (let k = 0; k < 3; k++) { const c = scored[Math.floor(this.rand() * scored.length)]; if (!best || c.r.score > best.r.score) best = c; } return best.g; };
      while (next.length < N) next.push(this.mutate(this.cross(pick(), pick()), 0.12 + 0.2 * (1 - gen / GENS)));
      scored = next.map((g, i) => (i < elite.length ? elite[i] : { g, r: this.evaluate(this.configFrom(g)) }));
      yield { progress: (gen + 1) / (GENS + 6), best: scored[0].r, evals: this.evals };
    }
    scored.sort((a, b) => b.r.score - a.r.score);
    // hill-climb on tune genes of the best
    let best = scored[0];
    const keys = Object.keys(best.g.t);
    for (let pass = 0; pass < 6; pass++) {
      for (let k = 0; k < 14; k++) {
        const key = keys[Math.floor(this.rand() * keys.length)];
        for (const step of [0.08, -0.08]) {
          const g = { p: { ...best.g.p }, t: { ...best.g.t, [key]: clamp((best.g.t[key] ?? 0.5) + step, 0, 1) } };
          const r = this.evaluate(this.configFrom(g));
          if (r.score > best.r.score) { best = { g, r }; break; }
        }
      }
      yield { progress: (GENS + pass + 1) / (GENS + 6), best: best.r, evals: this.evals };
    }
    return this.finish(best.r);
  }

  finish(r) {
    const notes = explain(this.before, r, this.o.goal);
    return { parts: r.parts, tune: r.tune, metrics: r.m, before: this.before.m, cost: r.cost, lap: r.lap, lapBefore: this.before.lap, notes, evals: this.evals, goal: this.o.goal };
  }
}

function explain(before, after, goal) {
  const out = [];
  const a = after.m, b = before.m;
  const newParts = Object.entries(after.parts).filter(([k, v]) => (before.parts?.[k] || 'stock') !== v);
  if (newParts.length) out.push(`Parts: ${newParts.map(([k, v]) => partLevel(k, v)?.name || v).join(', ')}.`);
  const s0 = before.spec, s1 = after.spec;
  const pct = (x, y) => Math.round(((y - x) / Math.max(1e-6, Math.abs(x))) * 100);
  const say = (cond, text) => { if (cond) out.push(text); };
  const arbF = pct(s0.suspension.front.arb, s1.suspension.front.arb), arbR = pct(s0.suspension.rear.arb, s1.suspension.rear.arb);
  say(arbR < -15, `Softer rear anti-roll bar (${arbR}%): more rear grip and traction out of corners.`);
  say(arbR > 15, `Stiffer rear anti-roll bar (+${arbR}%): the rear rotates more readily.`);
  say(arbF > 15, `Stiffer front anti-roll bar (+${arbF}%): sharper response, a little more understeer at the limit.`);
  say(arbF < -15, `Softer front anti-roll bar (${arbF}%): more front bite on turn-in.`);
  const cf = s1.suspension.front.camber - s0.suspension.front.camber;
  say(cf < -0.8, `Front camber to ${s1.suspension.front.camber.toFixed(1)}°: flatter outside tyre mid-corner.`);
  const fd = s1.transmission.final - s0.transmission.final;
  say(fd > 0.15, `Shorter final drive ${s0.transmission.final.toFixed(2)} → ${s1.transmission.final.toFixed(2)}: harder acceleration, top speed ${a.topSpeed} km/h.`);
  say(fd < -0.15, `Longer final drive ${s0.transmission.final.toFixed(2)} → ${s1.transmission.final.toFixed(2)}: top speed up to ${a.topSpeed} km/h.`);
  say(s1.diff.accel - s0.diff.accel > 0.15, `Diff acceleration lock ${Math.round(s1.diff.accel * 100)}%: both rear wheels drive, the slide stays lit.`);
  say(s1.steering.lock - s0.steering.lock > 5, `Steering lock ${s1.steering.lock.toFixed(0)}°: room to hold big angle.`);
  say(s1.brakes.bias - s0.brakes.bias > 0.04, `Brake balance forward to ${Math.round(s1.brakes.bias * 100)}%: more stable under heavy braking.`);
  say(s1.tires.pressure[1] - s0.tires.pressure[1] > 0.2, `Higher rear pressure (${s1.tires.pressure[1].toFixed(2)} bar): less rear grip, easier rotation.`);
  say(Math.abs(a.balance) < Math.abs(b.balance) - 0.01, `Chassis balance closer to neutral (${a.balance > 0 ? 'slight oversteer' : 'slight understeer'}).`);
  out.push(`PI ${b.pi} → ${a.pi} (${a.cls.id}). 0-100 ${b.t100?.toFixed(2)}s → ${a.t100?.toFixed(2)}s. Lateral ${b.latG.toFixed(2)}g → ${a.latG.toFixed(2)}g. Drift ${b.drift.toFixed(1)} → ${a.drift.toFixed(1)}.`);
  return out;
}
export { CLASSES };
