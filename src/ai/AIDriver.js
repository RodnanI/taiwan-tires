// AI racing driver. Uses the same physics as the player (no cheating on grip); difficulty only changes how
// close to the car's real limit it drives. Speed profile = curvature-limited speed with forward
// (acceleration) and backward (braking) passes, computed from the car's own params.
import { clamp, G, DEG, AIR_DENSITY, rng } from '../core/math.js';
import { COMPOUNDS } from '../physics/Tire.js';

export const DIFFICULTY = { rookie: 0.8, amateur: 0.87, pro: 0.925, expert: 0.965, legend: 1.0 };
export const AI_NAMES = ['Kai 阿凱', 'Wei-Lun 偉倫', 'Mei 小美', 'Jun-Hao 俊豪', 'Ting 婷', 'Hsin-Yi 心怡', 'Yu-Chen 宇辰', 'Po-Han 柏翰', 'Shu-Fen 淑芬', 'Chih-Ming 志明', 'A-Hui 阿輝', 'Li-Hua 麗華', 'Kuan 冠', 'Yi-Ting 怡婷'];

/** Vehicle capability estimate used for speed profiles (also used by the racing-line overlay). */
export function capability(params) {
  const w = params.wheels;
  const tire = COMPOUNDS[w[0].compound] || COMPOUNDS.street;
  const mu = tire.mu * Math.pow(((w[0].width + w[2].width) / 2) / 225, 0.18);
  const peakT = Math.max(...params.engine.torque.map((t) => t[1])) * (params.engine.boost ? 1 + params.engine.boost.max * params.engine.boost.eff * 0.85 : 1);
  const redline = params.engine.redline;
  const peakKw = peakT * redline * 0.82 * Math.PI / 30 / 1000;
  return { mu, mass: params.mass, peakKw, cdA: params.aero.cd * params.aero.area, clA: params.aero.clF + params.aero.clR, wheelbase: params.wheelbase, lock: params.steering.lock };
}

/** Max speed profile along a route for given capability and skill (0..1 fraction of the limit). */
export function speedProfile(route, cap, skill = 0.93) {
  const n = route.n;
  const v = new Float32Array(n);
  const mu = cap.mu * (0.84 + skill * 0.14);
  const k = (0.5 * AIR_DENSITY * Math.max(0, cap.clA)) / cap.mass; // downforce accel per v^2
  const drag = (0.5 * AIR_DENSITY * cap.cdA) / cap.mass;
  for (let i = 0; i < n; i++) {
    const c = Math.abs(route.curv[i]);
    const denom = c - mu * k;
    v[i] = denom <= 1e-5 ? 95 : Math.min(95, Math.sqrt((mu * G) / denom));
  }
  const ds = (i) => Math.max(0.5, Math.hypot(route.x[route.idx(i + 1)] - route.x[i], route.z[route.idx(i + 1)] - route.z[i]));
  const passes = route.closed ? 3 : 1;
  for (let p = 0; p < passes; p++) {
    // forward: acceleration limit (power-limited at speed, traction-limited at low speed)
    for (let j = 0; j < n; j++) {
      const i = j, nx = route.idx(i + 1);
      if (!route.closed && i === n - 1) break;
      const vi = Math.max(1, v[i]);
      const aPow = (cap.peakKw * 1000 * 0.82) / (cap.mass * vi) - drag * vi * vi;
      const aMax = Math.min(mu * G * 0.55, Math.max(0.3, aPow));
      v[nx] = Math.min(v[nx], Math.sqrt(vi * vi + 2 * aMax * ds(i)));
    }
    // backward: braking limit
    for (let j = n - 1; j >= 0; j--) {
      const i = j, nx = route.idx(i + 1);
      if (!route.closed && i === n - 1) continue;
      const vn = v[nx];
      const aBrk = mu * G * (0.78 + 0.12 * skill) + drag * vn * vn + k * vn * vn * mu * 0.5;
      v[i] = Math.min(v[i], Math.sqrt(vn * vn + 2 * aBrk * ds(i)));
    }
  }
  return v;
}

export class AIDriver {
  constructor(vehicle, route, { skill = 0.92, aggression = 0.5, seed = 1, name = 'AI' } = {}) {
    this.v = vehicle;
    this.route = route;
    this.baseSkill = skill;
    this.skill = skill;
    this.aggr = aggression;
    this.rand = rng(seed);
    this.name = name;
    this.hint = -1;
    this.avoid = 0;
    this.stuckT = 0;
    this.lineBias = (this.rand() - 0.5) * 1.2;
    this.mistakeT = 0;
    this.enabled = true;
    const ph = vehicle.physics;
    ph.assists = { ...ph.assists, abs: true, tcs: 1, esc: 1, autoShift: true, autoClutch: true, revMatch: true, handbrakeClutch: true, autoReverse: false };
    this.refresh();
  }
  refresh() {
    this.cap = capability(this.v.params);
    this.profile = speedProfile(this.route, this.cap, this.skill);
  }
  setSkill(s) { if (Math.abs(s - this.skill) > 0.004) { this.skill = s; this.profile = speedProfile(this.route, this.cap, s); } }

  /** ctx: { others: Vehicle[], racing: bool (false = hold at the line), dt } */
  update(dt, ctx) {
    const ph = this.v.physics, R = this.route, c = ph.controls, t = ph.tel;
    if (!ctx.racing) { c.throttle = ctx.rev ? 0.35 + 0.3 * Math.sin(performance.now() / 300 + this.lineBias * 9) : 0; c.brake = 0; c.hold = true; c.handbrake = 0; c.clutch = 1; c.steer = 0; return; }
    c.hold = false;
    c.clutch = 0;
    const p = R.project(ph.pos.x, ph.pos.z, this.hint);
    this.hint = p.i;
    const speed = t.speed;
    // ---- avoidance: look for cars ahead in our corridor
    let wantAvoid = 0, blockSlow = Infinity;
    for (const o of ctx.others) {
      if (o === this.v) continue;
      const op = o.physics;
      const dx = op.pos.x - ph.pos.x, dz = op.pos.z - ph.pos.z;
      const ahead = dx * ph.fwd.x + dz * ph.fwd.z;
      if (ahead < -4 || ahead > 28) continue;
      const lat = dx * ph.left.x + dz * ph.left.z;
      if (Math.abs(lat) > 3.4) continue;
      const closing = speed - op.tel.speed;
      if (ahead > 0 && closing > -1) {
        // pass on the side with more road
        const roomLeft = p.half - (p.lateral + 2), roomRight = p.half + (p.lateral - 2);
        wantAvoid = (lat > 0 ? -1 : 1) * 3.0;
        if (lat > 0 && roomRight < 2.5) wantAvoid = 3.0 * (roomLeft > 2.5 ? 1 : 0);
        if (lat <= 0 && roomLeft < 2.5) wantAvoid = -3.0 * (roomRight > 2.5 ? 1 : 0);
        if (ahead < 9 && Math.abs(lat) < 2.2) blockSlow = Math.min(blockSlow, op.tel.speed - 1 + this.aggr * 2);
      }
    }
    this.avoid += (wantAvoid - this.avoid) * Math.min(1, dt * 2.5);
    // ---- steering: pure pursuit on the racing line (+ bias + avoidance)
    const Ld = clamp(5 + speed * 0.42, 7, 34);
    const ti = R.indexAt(p.s + Ld);
    const lat = clamp(R.off[ti] + this.lineBias + this.avoid, -R.half[ti] + 1.2, R.half[ti] - 1.2);
    const tx = R.x[ti] + R.nx(ti) * lat, tz = R.z[ti] + R.nz(ti) * lat;
    const dx = tx - ph.pos.x, dz = tz - ph.pos.z;
    const lx = dx * ph.left.x + dz * ph.left.z, lz = dx * ph.fwd.x + dz * ph.fwd.z;
    const d2 = lx * lx + lz * lz;
    const curvature = (2 * lx) / Math.max(1, d2);
    let steer = Math.atan(this.cap.wheelbase * curvature) / this.cap.lock;
    // catch slides: steer along the velocity and damp yaw
    if (speed > 5) steer += clamp(t.driftAngle * 1.1, -0.6, 0.6) * 0.8 - t.yawRate * 0.02;
    if (lz < 0) steer = Math.sign(lx || 1); // target behind: full lock towards it
    c.steer = clamp(steer, -1, 1);
    // ---- speed
    const brakeLook = R.indexAt(p.s + clamp(speed * 0.35, 2, 18));
    let vt = Math.min(this.profile[p.i], this.profile[brakeLook]) * (0.97 + this.skill * 0.03);
    vt = Math.min(vt, blockSlow);
    if (this.mistakeT > 0) { this.mistakeT -= dt; vt *= 0.93; }
    else if (this.rand() < dt * (1 - this.skill) * 0.08) this.mistakeT = 0.6 + this.rand();
    const err = vt - speed;
    c.throttle = err > 0 ? clamp(0.25 + err * 0.35, 0, 1) : 0;
    c.brake = err < -0.8 ? clamp(-err * 0.22, 0, 1) : 0;
    if (Math.abs(t.driftAngle) > 18 * DEG) c.throttle *= 0.5;
    c.handbrake = 0;
    c.nitrous = ph.p.nitrous && err > 6 && Math.abs(c.steer) < 0.15;
    // ---- stuck / wrong way recovery
    if (speed < 1.2) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    this.needsReset = this.stuckT > 4 || Math.abs(p.lateral) > p.half + 30 || t.upright < 0.2;
  }
}
