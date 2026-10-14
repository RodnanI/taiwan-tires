// Drift scoring: points accrue while the car slides (angle x speed), a multiplier grows with chain length,
// wall proximity adds a bonus, and the chain banks after a short grace period. Collisions or spins lose it.
import { clamp, DEG } from '../core/math.js';

export const DRIFT_LABELS = [[0, 'DRIFT', '甩尾'], [2500, 'GOOD DRIFT', '漂亮'], [8000, 'GREAT DRIFT', '厲害'], [20000, 'AWESOME', '超讚'], [45000, 'INSANE', '瘋狂'], [90000, 'LEGENDARY', '傳奇']];

export class DriftScorer {
  constructor(events, { owner = 'player' } = {}) {
    this.events = events;
    this.owner = owner;
    this.reset();
  }
  reset() {
    this.total = 0; this.chain = 0; this.mult = 1; this.chainTime = 0; this.grace = 0; this.angle = 0; this.active = false;
    this.best = 0; this.proximity = 0; this.lastBank = 0; this.enabled = true;
  }
  snapshot() { return { t: this.total, c: this.chain, m: this.mult, ct: this.chainTime, g: this.grace, b: this.best }; }
  restore(s) { this.total = s.t; this.chain = s.c; this.mult = s.m; this.chainTime = s.ct; this.grace = s.g; this.best = s.b; }

  /** @param ph VehiclePhysics; world for proximity checks; inZone: false pauses scoring (drift events). */
  update(dt, ph, world, inZone = true) {
    if (!this.enabled) return;
    const t = ph.tel;
    const speed = t.speed;
    const ang = Math.abs(t.driftAngle) / DEG;
    this.angle = ang;
    const sliding = inZone && t.onGround && speed > 6 && ang > 11 && ang < 115 && t.fwdSpeed > 0.5;
    if (ang >= 125 && this.chain > 0 && speed > 4) { this.fail('spin'); return; }
    if (sliding) {
      this.active = true;
      this.grace = 0;
      this.chainTime += dt;
      const angleF = clamp((ang - 10) / 45, 0, 1.4);
      const speedF = clamp(speed * 3.6 / 70, 0.3, 2.6);
      // wall proximity bonus (cheap: sample both sides every frame)
      let prox = 0;
      if (world) {
        const lx = ph.left.x, lz = ph.left.z, px = ph.pos.x, pz = ph.pos.z, py = ph.pos.y;
        const reach = 3.2;
        const tl = world.segmentStatics(px, pz, px + lx * reach, pz + lz * reach, py, 0.1);
        const tr = world.segmentStatics(px, pz, px - lx * reach, pz - lz * reach, py, 0.1);
        const tb = world.segmentStatics(px, pz, px - ph.fwd.x * (reach + 1.5), pz - ph.fwd.z * (reach + 1.5), py, 0.1);
        prox = Math.max(1 - Math.min(tl, tr, tb), 0);
      }
      this.proximity = prox;
      this.chain += dt * 120 * angleF * speedF * (1 + prox * 1.5);
      this.mult = Math.min(10, 1 + Math.floor(this.chainTime / 2.2) * 0.5 + Math.floor(prox * 2) * 0.5);
    } else if (this.active) {
      this.grace += dt;
      if (this.grace > 1.6) this.bank();
    }
  }
  bank() {
    const pts = Math.round(this.chain * this.mult);
    if (pts > 50) {
      this.total += pts;
      this.best = Math.max(this.best, pts);
      this.lastBank = pts;
      this.events?.emit('drift:bank', { owner: this.owner, points: pts, mult: this.mult, label: labelFor(pts) });
    }
    this.chain = 0; this.mult = 1; this.chainTime = 0; this.grace = 0; this.active = false; this.proximity = 0;
  }
  fail(reason = 'crash') {
    if (this.chain > 50) this.events?.emit('drift:fail', { owner: this.owner, points: Math.round(this.chain * this.mult), reason });
    this.chain = 0; this.mult = 1; this.chainTime = 0; this.grace = 0; this.active = false;
  }
  get pending() { return Math.round(this.chain * this.mult); }
}
export function labelFor(points) {
  let l = DRIFT_LABELS[0];
  for (const d of DRIFT_LABELS) if (points >= d[0]) l = d;
  return { en: l[1], zh: l[2] };
}
