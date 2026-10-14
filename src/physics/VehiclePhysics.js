// Rigid-body vehicle simulation. One instance per car (player, AI, AI-tune test rigs).
// Frames: body/model space is +Z forward, +Y up, +X left (glTF convention). SI units everywhere.
// Pipeline per fixed step (see docs/physics.md for the math):
//   controls+assists -> steering/Ackermann -> wheel raycasts -> springs/dampers/ARB -> tyre forces
//   -> implicit drivetrain solve (engine, clutch, diffs, brakes) -> aero/gravity -> integrate -> collisions
import { Vector3, Quaternion, Matrix3, Matrix4 } from 'three';
import { evaluateTire, makeTireState } from './Tire.js';
import { surfaceById } from './Surfaces.js';
import { BOX } from './World.js';
import { clamp, clamp01, lerp, smoothstep, curveLookupSmooth, approach, DEG, G, AIR_DENSITY, valueNoise } from '../core/math.js';

const FL = 0, FR = 1, RL = 2, RR = 3;
const _hit = { dist: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, surface: 0 };
const _tire = { fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, s: 0, dFdOmegaR: 0, mu: 1 };
const v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3(), v4 = new Vector3(), v5 = new Vector3();
const _q = new Quaternion();

export class VehiclePhysics {
  /** @param params output of buildPhysicsParams() (src/vehicles/VehicleSpec.js) */
  constructor(params, world) {
    this.world = world;
    this.pos = new Vector3(); this.quat = new Quaternion(); this.vel = new Vector3(); this.angVel = new Vector3();
    this.prevPos = new Vector3(); this.prevQuat = new Quaternion();
    this.rot = new Matrix3(); this.invIw = new Matrix3();
    this.right = new Vector3(); this.up = new Vector3(); this.fwd = new Vector3(); this.left = new Vector3();
    this.force = new Vector3(); this.torque = new Vector3();
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0, nitrous: false, hold: false };
    this.assists = { abs: true, tcs: 0, esc: 0, autoShift: true, autoClutch: true, revMatch: true, handbrakeClutch: true, autoReverse: true };
    this.gripScale = 1;     // difficulty / AI skill
    this.powerScale = 1;    // rubber banding
    this.wetness = 0;       // 0..1 from weather
    this.ghost = false;     // ghost cars skip car-car collisions
    this.engine = { rpm: 900, omega: 94, boost: 0, cut: 0, throttle: 0, torque: 0, load: 0, nitrous: 1, nitrousActive: false };
    this.gearbox = { gear: 1, shiftTimer: 0, shiftTo: 1, shiftFrom: 1, clutch: 1, auto: 0, reverseHold: 0, lastShift: -10 };
    this.fx = { bov: 0, backfire: 0, shift: 0, limiter: false, collisions: [] };
    this.tel = {
      speed: 0, fwdSpeed: 0, slipAngle: 0, yawRate: 0, latG: 0, longG: 0, onGround: false, wheelsOnGround: 0,
      airTime: 0, upright: 1, rpm: 0, gear: 1, boost: 0, throttle: 0, brake: 0, steer: 0, distance: 0, wheelspin: 0, lockup: 0, driftAngle: 0,
    };
    this._prevVel = new Vector3();
    this._tcs = 1; this._lastThrottle = 0;
    this.time = 0;
    this.setParams(params);
  }

  /** Apply (new) physics params. Keeps the dynamic state so tuning can change mid-session. */
  setParams(p) {
    this.p = p;
    this.mass = p.mass;
    this.invMass = 1 / p.mass;
    this.Ibody = new Vector3(p.inertia[0], p.inertia[1], p.inertia[2]);
    this.invIbody = new Vector3(1 / p.inertia[0], 1 / p.inertia[1], 1 / p.inertia[2]);
    const old = this.wheels;
    this.wheels = p.wheels.map((c, i) => {
      const staticLoad = c.staticLoad;
      const w = {
        c, i, front: i < 2, side: i % 2 === 0 ? 1 : -1,
        // mount = wheel centre at full bump, relative to CG, body frame
        mount: new Vector3(c.x, c.radius - p.cgHeight + c.bumpTravel, c.z - p.cgZ),
        bump: Math.max(0.02, c.bumpTravel + c.rideOffset),
        droop: Math.max(0.03, c.droopTravel - c.rideOffset),
        tire: makeTireState(c.compound, c.width, c.pressure, staticLoad),
        omega: old?.[i]?.omega ?? 0, spin: old?.[i]?.spin ?? 0, steer: 0,
        x: 0, xPrev: 0, contact: false, Fz: 0, fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, s: 0, surface: 0,
        cp: new Vector3(), n: new Vector3(0, 1, 0), wf: new Vector3(), wl: new Vector3(), vx: 0, vy: 0,
        dFdO: 0, dFdV: 0, dvx: 0, J: c.inertia, brakeT: 0, driveT: 0, abs: 1, camber: c.camber, travel: 0, load: 0, susp: 0,
      };
      w.travel = w.bump; // distance from mount to wheel centre (static)
      return w;
    });
    // wheel weights in the driveline (sum 1)
    const layout = p.drivetrain.layout;
    const s = layout === 'AWD' ? p.drivetrain.split : layout === 'FWD' ? 1 : 0;
    this.driveW = [s / 2, s / 2, (1 - s) / 2, (1 - s) / 2];
    this.engine.nitrous = this.engine.nitrous ?? 1;
    // optimal upshift points per gear
    const e = p.engine, gears = p.transmission.gears;
    this.shiftUpRpm = gears.map((gr, gi) => {
      if (gi === gears.length - 1) return Infinity;
      const next = gears[gi + 1];
      for (let r = e.redline * 0.55; r <= e.limiter; r += 50) {
        const fNow = this.engineFullTorque(r) * gr;
        const fNext = this.engineFullTorque(r * next / gr) * next;
        if (fNext >= fNow && r > e.redline * 0.82) return r;
      }
      return e.limiter - 120;
    });
    this.peakTorque = Math.max(...e.torque.map((t) => t[1]));
    this.gearbox.gear = clamp(this.gearbox.gear, -1, gears.length);
  }

  engineFullTorque(rpm) { return curveLookupSmooth(this.p.engine.torque, rpm); }

  /** Place the car at rest on the ground at (x, ?, z) facing heading (radians, 0 = +Z, positive = towards +X). */
  reset(x, y, z, heading = 0, speed = 0) {
    const p = this.p;
    this.quat.setFromAxisAngle(v1.set(0, 1, 0), heading);
    let gy = y == null || isNaN(y) ? 0 : y;
    if (this.world) {
      const h = this.world.heightAt(x, z, y == null || isNaN(y) ? 5000 : y + 3);
      if (!isNaN(h)) gy = h;
    }
    const avgRide = (p.wheels[0].rideOffset + p.wheels[2].rideOffset) / 2;
    this.pos.set(x, gy + p.cgHeight + avgRide + 0.02, z);
    this.vel.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
    this.angVel.set(0, 0, 0);
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    for (const w of this.wheels) { w.omega = speed / w.c.radius; w.x = 0; w.xPrev = 0; w.travel = w.bump; }
    const gb = this.gearbox; gb.gear = 1; gb.shiftTimer = 0; gb.clutch = 1;
    const e = this.engine; e.rpm = p.engine.idle; e.omega = e.rpm * Math.PI / 30; e.boost = 0; e.cut = 0;
    if (speed > 1) this._pickGearForSpeed();
    this.tel.airTime = 0;
  }
  _pickGearForSpeed() {
    const p = this.p, gears = p.transmission.gears;
    const wheelOmega = this.vel.length() / this.wheels[2].c.radius;
    let gear = 1;
    for (let g = 1; g <= gears.length; g++) { const rpm = wheelOmega * gears[g - 1] * p.transmission.final * 30 / Math.PI; if (rpm < p.engine.redline * 0.8) { gear = g; break; } gear = g; }
    this.gearbox.gear = gear;
    this.engine.omega = wheelOmega * gears[gear - 1] * p.transmission.final;
    this.engine.rpm = Math.max(p.engine.idle, this.engine.omega * 30 / Math.PI);
  }

  /** Sequential shift: dir +1 / -1. Gear -1 = reverse, 1..n forward (neutral only exists mid-shift). */
  shift(dir) {
    const gb = this.gearbox, n = this.p.transmission.gears.length;
    if (gb.shiftTimer > 0) return false;
    let target = gb.gear + dir;
    if (target === 0) target = dir > 0 ? 1 : -1;
    if (target > n || target < -1) return false;
    if (target === -1 && this.tel.fwdSpeed > 2) return false;
    if (gb.gear === -1 && target === 1 && this.tel.fwdSpeed < -2) return false;
    gb.shiftTo = target;
    gb.shiftFrom = gb.gear;
    gb.shiftTimer = this.p.transmission.shiftTime;
    gb.lastShift = this.time;
    this.fx.shift = dir;
    if (dir > 0 && this.controls.throttle > 0.8 && this.engine.rpm > this.p.engine.redline * 0.75) this.fx.backfire = Math.max(this.fx.backfire, 0.8);
    return true;
  }

  // ===================================================================================== STEP
  step(dt) {
    const p = this.p, ctl = this.controls, as = this.assists, e = this.engine, gb = this.gearbox, ws = this.wheels;
    this.time += dt;
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    this._prevVel.copy(this.vel);

    // ---- frame
    this.rot.setFromMatrix4(_m4.makeRotationFromQuaternion(this.quat));
    const R = this.rot.elements;
    this.left.set(R[0], R[1], R[2]); this.up.set(R[3], R[4], R[5]); this.fwd.set(R[6], R[7], R[8]);
    this.right.copy(this.left).negate();
    // world inverse inertia = R * diag(invI) * R^T
    const iI = this.invIbody, W = this.invIw.elements;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      W[c * 3 + r] = R[r] * iI.x * R[c] + R[3 + r] * iI.y * R[3 + c] + R[6 + r] * iI.z * R[6 + c];
    }
    const fwdSpeed = this.vel.dot(this.fwd);
    const speed = this.vel.length();

    // ---- pedals, auto reverse, assists
    let throttle = clamp01(ctl.throttle), brake = clamp01(ctl.brake);
    if (as.autoShift && as.autoReverse) {
      if (gb.gear === -1) { const t = throttle; throttle = brake; brake = t; }
      if (gb.shiftTimer <= 0) {
        if (ctl.hold) gb.reverseHold = 0;
        else if (gb.gear > 0 && fwdSpeed < 0.8 && ctl.brake > 0.3 && ctl.throttle < 0.05) { gb.reverseHold += dt; if (gb.reverseHold > 0.3) { this._forceGear(-1); gb.reverseHold = 0; } }
        else if (gb.gear === -1 && fwdSpeed > -0.8 && ctl.throttle > 0.3 && ctl.brake < 0.05) { gb.reverseHold += dt; if (gb.reverseHold > 0.15) { this._forceGear(1); gb.reverseHold = 0; } }
        else gb.reverseHold = 0;
      }
    }
    // start-line hold (countdown): full brakes without the brake pedal meaning "reverse"
    if (ctl.hold) brake = 1;
    // traction control: proportional throttle trim holding driven-wheel slip near the tyre's peak
    if (as.tcs > 0 && speed > 0.3) {
      let slip = 0, peak = 0.1;
      for (let i = 0; i < 4; i++) if (this.driveW[i] > 0 && ws[i].contact) { slip = Math.max(slip, ws[i].slipRatio); peak = ws[i].tire.peakSlip; }
      const target = peak * (as.tcs > 1 ? 1.0 : 1.5);
      const desired = clamp01(1 - (slip - target) * (as.tcs > 1 ? 7 : 4.5));
      this._tcs += (desired - this._tcs) * Math.min(1, dt * 30);
      throttle *= this._tcs;
    } else this._tcs = 1;
    // stability control: limits body slip angle by trimming throttle and braking the outer front wheel
    let escBrake = -1, escAmount = 0;
    if (as.esc > 0 && speed > 7 && Math.abs(this.tel.slipAngle) > (as.esc > 1 ? 6 : 13) * DEG) {
      throttle *= as.esc > 1 ? 0.35 : 0.65;
      escBrake = this.tel.slipAngle > 0 ? FL : FR; // nose right of travel (right-hand oversteer) -> brake left front
      escAmount = as.esc > 1 ? 0.35 : 0.18;
    }

    // ---- steering + Ackermann + toe
    const lock = p.steering.lock;
    const delta = clamp(ctl.steer, -1, 1) * lock;
    const L = p.wheelbase, trackF = Math.abs(p.wheels[0].x - p.wheels[1].x);
    let dl = delta, dr = delta;
    if (Math.abs(delta) > 1e-4) {
      const Rt = L / Math.tan(Math.abs(delta));
      const inner = Math.atan(L / Math.max(0.3, Rt - trackF / 2)), outer = Math.atan(L / (Rt + trackF / 2));
      const a = p.steering.ackermann;
      const di = Math.min(85 * DEG, Math.abs(delta) + (inner - Math.abs(delta)) * a), dout = Math.abs(delta) + (outer - Math.abs(delta)) * a;
      if (delta > 0) { dl = di; dr = dout; } else { dl = -dout; dr = -di; }
    }
    ws[FL].steer = dl - ws[FL].c.toe * DEG; ws[FR].steer = dr + ws[FR].c.toe * DEG;
    ws[RL].steer = -ws[RL].c.toe * DEG; ws[RR].steer = ws[RR].c.toe * DEG;

    // body roll angle (positive = roof towards +X)
    const roll = Math.asin(clamp(-this.left.y, -1, 1));

    // ---- suspension raycasts
    this.force.set(0, -G * this.mass, 0);
    this.torque.set(0, 0, 0);
    let onGround = 0;
    const downX = -this.up.x, downY = -this.up.y, downZ = -this.up.z;
    const LIFT = 0.5; // rays start above the mount so steps/kerbs higher than the wheel are still found
    for (let i = 0; i < 4; i++) {
      const w = ws[i], c = w.c;
      v1.copy(w.mount).applyMatrix3(this.rot).add(this.pos); // mount world
      const maxLen = LIFT + w.bump + w.droop + c.radius;
      w.xPrev = w.x;
      const hit = this.world ? this.world.raycast(v1.x - downX * LIFT, v1.y - downY * LIFT, v1.z - downZ * LIFT, downX, downY, downZ, maxLen, _hit) : false;
      if (hit) {
        const surf = surfaceById(_hit.surface);
        let d = _hit.dist - LIFT;
        if (surf.rough > 0) d -= surf.rough * (valueNoise(_hit.x * 2.7, _hit.z * 2.7) - 0.5) * 2;
        if (surf.rumble) d -= 0.011 * surf.rumble * (Math.sin((_hit.x + _hit.z) * 9) > 0 ? 1 : 0);
        const s = d - c.radius;
        w.contact = s < w.bump + w.droop;
        w.travel = clamp(s, -0.15, w.bump + w.droop);
        w.x = w.bump - w.travel;
        w.surface = _hit.surface;
        w.cp.set(_hit.x, _hit.y, _hit.z);
        w.n.set(_hit.nx, _hit.ny, _hit.nz);
      } else {
        w.contact = false;
        w.travel = Math.min(w.bump + w.droop, w.travel + dt * 2.5);
        w.x = w.bump - w.travel;
      }
      if (w.contact) onGround++;
    }
    // springs, dampers, bump stops, anti-roll bars
    const aF = p.wheels[0].arb, aR = p.wheels[2].arb;
    for (let i = 0; i < 4; i++) {
      const w = ws[i], c = w.c;
      if (!w.contact) { w.Fz = 0; w.susp = 0; continue; }
      const other = ws[i ^ 1];
      let F = c.staticLoad + c.spring * w.x;
      if (w.x > w.bump - 0.01) F += 220000 * (w.x - (w.bump - 0.01)); // bump stop
      let xv = (w.x - w.xPrev) / dt;
      xv = clamp(xv, -4, 4);
      F += xv * (xv > 0 ? c.damperBump : c.damperRebound);
      const arbK = w.front ? aF : aR;
      F += arbK * (w.x - other.x);
      if (F < 0) F = 0;
      w.susp = F;
      w.Fz = F * Math.max(0, this.up.dot(w.n));
      // suspension force on the body along body up at the mount
      v1.copy(w.mount).applyMatrix3(this.rot); // r
      v2.copy(this.up).multiplyScalar(F);
      this.force.add(v2);
      this.torque.add(v3.crossVectors(v1, v2));
    }

    // ---- tyre contact frames + slip velocities + forces
    const grip0 = this.gripScale;
    for (let i = 0; i < 4; i++) {
      const w = ws[i], c = w.c;
      if (!w.contact) { w.fx = w.fy = 0; w.slipRatio *= 0.9; w.slipAngle *= 0.9; w.s = 0; w.dFdO = 0; continue; }
      // wheel heading in body space -> world -> projected on ground plane
      const sn = Math.sin(w.steer), cs = Math.cos(w.steer);
      v1.set(sn, 0, cs).applyMatrix3(this.rot);
      const nd = v1.dot(w.n);
      w.wf.copy(v1).addScaledVector(w.n, -nd).normalize();
      w.wl.crossVectors(w.n, w.wf);
      // contact point velocity
      v2.subVectors(w.cp, this.pos);
      v3.crossVectors(this.angVel, v2).add(this.vel);
      const vxNow = v3.dot(w.wf);
      w.dvx = clamp(vxNow - w.vx, -0.5, 0.5); // expected ground-speed change this step (predictor)
      w.vx = vxNow; w.vy = v3.dot(w.wl);
      // dynamic camber (deg, negative = top inwards)
      w.camber = c.camber + w.side * roll / DEG * 0.55 + (w.front ? w.side * (w.steer / DEG) * Math.sin(p.steering.caster * DEG) : 0);
      const cb = (w.camber + 2.5) / 5;
      const camberLat = 1 + 0.06 * Math.max(-0.5, 1 - cb * cb);
      const wet = 1 - this.wetness * (1 - w.tire.compound.wet);
      const g = grip0 * wet;
      evaluateTire(w.tire, w.Fz, w.vx, w.vy, w.omega * c.radius, w.surface, g, _tire);
      let fx = _tire.fx * (1 - 0.012 * Math.abs(w.camber));
      let fy = _tire.fy * camberLat;
      // anti-overshoot clamps (low-speed stability)
      const mShare = this.mass * 0.3;
      const fyMax = Math.abs(w.vy) * mShare / dt;
      if (Math.abs(fy) > fyMax) fy = Math.sign(fy) * fyMax;
      // (the wheel side of the longitudinal slip is integrated implicitly, only the body side needs a clamp)
      const fxMax = Math.abs(w.omega * c.radius - w.vx) * mShare / dt;
      if (Math.abs(fx) > fxMax) fx = Math.sign(fx) * fxMax;
      w.fx = fx; w.fy = fy;
      w.slipRatio = _tire.slipRatio; w.slipAngle = _tire.slipAngle; w.s = _tire.s;
      w.dFdO = _tire.dFdOmegaR * c.radius; // d fx / d omega
      w.dFdV = _tire.dFdOmegaR;            // d fx / d (omega R)
      // apply at contact point raised to the roll centre
      v4.copy(w.cp).addScaledVector(w.n, c.rollCenter).sub(this.pos);
      v5.copy(w.wf).multiplyScalar(fx).addScaledVector(w.wl, fy);
      this.force.add(v5);
      this.torque.add(v3.crossVectors(v4, v5));
    }

    // ---- engine + drivetrain + brakes (implicit wheel solve)
    this._drivetrain(dt, throttle, brake, escBrake, escAmount);

    // ---- aero
    if (speed > 0.5) {
      const q = 0.5 * AIR_DENSITY;
      v1.copy(this.vel).multiplyScalar(-q * p.aero.cd * p.aero.area * speed);
      this.force.add(v1);
      const vf2 = fwdSpeed * Math.abs(fwdSpeed) * q;
      if (vf2 > 0) {
        const fF = p.aero.clF * vf2, fR = p.aero.clR * vf2;
        v2.copy(this.up).multiplyScalar(-fF); v3.set(0, 0, p.aero.zF).applyMatrix3(this.rot);
        this.force.add(v2); this.torque.add(v4.crossVectors(v3, v2));
        v2.copy(this.up).multiplyScalar(-fR); v3.set(0, 0, p.aero.zR).applyMatrix3(this.rot);
        this.force.add(v2); this.torque.add(v4.crossVectors(v3, v2));
      }
    }

    // ---- integrate (semi-implicit Euler)
    this.vel.addScaledVector(this.force, this.invMass * dt);
    v1.copy(this.torque).applyMatrix3(this.invIw).multiplyScalar(dt);
    this.angVel.add(v1);
    this.angVel.multiplyScalar(1 - 0.05 * dt);
    this.pos.addScaledVector(this.vel, dt);
    const wx = this.angVel.x, wy = this.angVel.y, wz = this.angVel.z;
    const qx = this.quat.x, qy = this.quat.y, qz = this.quat.z, qw = this.quat.w;
    const h = 0.5 * dt;
    this.quat.set(qx + h * (wx * qw + wy * qz - wz * qy), qy + h * (wy * qw + wz * qx - wx * qz), qz + h * (wz * qw + wx * qy - wy * qx), qw + h * (-wx * qx - wy * qy - wz * qz)).normalize();

    // ---- collisions
    if (this.world) {
      this._collideStatics(dt);
      if (onGround < 4 || this.up.y < 0.75) this._collideBodyGround();
    }

    // ---- telemetry
    const t = this.tel;
    t.speed = this.vel.length();
    t.fwdSpeed = this.vel.dot(this.fwd);
    const lat = this.vel.dot(this.left);
    t.slipAngle = t.speed > 2 ? Math.atan2(lat, Math.abs(t.fwdSpeed)) : 0;
    t.driftAngle = t.speed > 4 ? Math.atan2(lat, t.fwdSpeed) : 0;
    t.yawRate = this.angVel.dot(this.up);
    v1.subVectors(this.vel, this._prevVel).divideScalar(dt);
    t.latG += (v1.dot(this.left) / G - t.latG) * Math.min(1, dt * 12);
    t.longG += (v1.dot(this.fwd) / G - t.longG) * Math.min(1, dt * 12);
    t.wheelsOnGround = onGround; t.onGround = onGround > 0;
    t.airTime = onGround ? 0 : t.airTime + dt;
    t.upright = this.up.y;
    t.rpm = e.rpm; t.gear = gb.gear; t.boost = e.boost; t.throttle = throttle; t.brake = brake; t.steer = ctl.steer;
    t.distance += t.speed * dt;
    let spin = 0, lockup = 0;
    for (const w of ws) if (w.contact) { spin = Math.max(spin, w.slipRatio); lockup = Math.min(lockup, w.slipRatio); }
    t.wheelspin = spin; t.lockup = -lockup;
    for (const w of ws) { w.spin = (w.spin + w.omega * dt) % (Math.PI * 2); }
  }

  _forceGear(g) { this.gearbox.gear = g; this.gearbox.shiftTimer = 0; }

  _drivetrain(dt, throttleIn, brakeIn, escBrake, escAmount) {
    const p = this.p, e = this.engine, gb = this.gearbox, ws = this.wheels, ctl = this.controls, as = this.assists;
    const pe = p.engine, tr = p.transmission;
    // --- gearbox state machine
    if (gb.shiftTimer > 0) {
      gb.shiftTimer -= dt;
      if (gb.shiftTimer <= tr.shiftTime * 0.5 && gb.gear !== gb.shiftTo) gb.gear = gb.shiftTo;
      if (gb.shiftTimer <= 0) gb.shiftTimer = 0;
    }
    const shifting = gb.shiftTimer > 0;
    const gear = gb.gear;
    const ratio = gear > 0 ? tr.gears[gear - 1] : gear < 0 ? -tr.reverse : 0;
    const Gr = ratio * tr.final;
    // driveline speed (wheel side, weighted by torque split)
    let wdl = 0;
    for (let i = 0; i < 4; i++) wdl += this.driveW[i] * ws[i].omega;

    // --- throttle shaping: idle control, limiter, shift cut, rev-match blip
    let thr = throttleIn;
    if (e.cut > 0) { e.cut -= dt; thr = 0; }
    if (e.rpm > pe.limiter) { e.cut = 0.05; thr = 0; this.fx.limiter = true; }
    if (shifting) {
      const upshift = gb.shiftTo > gb.shiftFrom;
      if (upshift) thr = 0;
      else if (as.revMatch && gb.shiftTo > 0) {
        const target = Math.abs(wdl * tr.gears[gb.shiftTo - 1] * tr.final) * 30 / Math.PI;
        thr = clamp01((target - e.rpm) / 900);
      }
    }
    const idleThr = clamp01((pe.idle - e.rpm) / 250) * 0.4;
    thr = Math.max(thr, idleThr);
    // nitrous
    e.nitrousActive = false;
    if (ctl.nitrous && p.nitrous && e.nitrous > 0 && thr > 0.5 && gear > 0) {
      e.nitrousActive = true;
      e.nitrous = Math.max(0, e.nitrous - dt / p.nitrous.duration);
    } else if (p.nitrous) e.nitrous = Math.min(1, e.nitrous + dt / p.nitrous.refill);
    // turbo / supercharger
    const bo = pe.boost;
    if (bo) {
      const spool = smoothstep(bo.spoolStart, bo.spoolFull, e.rpm);
      const target = bo.max * (bo.type === 'supercharger' ? (0.35 + 0.65 * spool) * thr : spool * thr);
      const prev = e.boost;
      if (bo.type === 'supercharger') e.boost = target;
      else {
        const rate = target > e.boost ? 1 / bo.lag : 3.2 / bo.lag;
        e.boost += (target - e.boost) * (1 - Math.exp(-rate * dt));
      }
      if (prev > 0.35 && this._lastThrottle > 0.6 && throttleIn < 0.15) this.fx.bov = Math.max(this.fx.bov, prev / bo.max);
    }
    if (this._lastThrottle > 0.75 && throttleIn < 0.1 && e.rpm > pe.redline * 0.62) this.fx.backfire = Math.max(this.fx.backfire, 0.6);
    this._lastThrottle = throttleIn;

    // --- clutch engagement (decided before engine torque so launch control can trim the throttle)
    let launch = false;
    let engage = 1 - clamp01(ctl.clutch);
    if (as.handbrakeClutch && ctl.handbrake > 0.5) engage = 0;
    if (as.autoClutch && gear !== 0) {
      // launch regime judged from ground speed, so wheelspin cannot end it early
      const rD = this.driveW[2] > 0 ? ws[2].c.radius : ws[0].c.radius;
      const groundIn = (Math.abs(this.tel.fwdSpeed) / rD) * Math.abs(Gr) * 30 / Math.PI;
      if (groundIn < Math.max(pe.idle * 1.2, e.rpm - 350)) {
        // release the clutch over time while throttle is applied (like a driver would), anti-stall below idle
        if (throttleIn > 0.04) gb.auto = Math.min(1, gb.auto + dt * (0.8 + 3.2 * throttleIn) * (e.rpm > pe.idle * 1.08 ? 1 : 0.25));
        else gb.auto = Math.max(0, gb.auto - dt * 4);
        if (e.rpm < pe.idle * 0.85) gb.auto = Math.max(0, gb.auto - dt * 8);
        engage = Math.min(engage, gb.auto * gb.auto);
        launch = true;
      } else gb.auto = 1;
    }
    if (shifting) {
      const prog = 1 - gb.shiftTimer / tr.shiftTime;
      engage = Math.min(engage, prog < 0.5 ? 0 : smoothstep(0.5, 1, prog));
    }
    gb.clutch = engage;
    // launch control (with TCS): hold the engine near 60% of redline while the clutch slips
    if (launch && as.tcs > 0) thr = Math.min(thr, Math.max(idleThr, clamp01((pe.redline * 0.6 + 500 - e.rpm) / 500)));
    e.throttle = thr;

    // --- engine torque (crank)
    const full = this.engineFullTorque(e.rpm) * (1 + e.boost * (bo ? bo.eff : 0)) * this.powerScale + (e.nitrousActive ? p.nitrous.torque : 0);
    const fric = -pe.friction * (0.25 + 0.75 * e.rpm / pe.redline);
    const Te = thr * full + (1 - thr) * fric;
    e.torque = Te;
    e.load = full > 0 ? clamp01(Te / full) : 0;

    let C = engage * tr.clutchTorque;
    if (launch && Gr !== 0) {
      // launch control: the slipping clutch never sends much more torque than the driven tyres can use
      let grip = 0;
      for (let i = 0; i < 4; i++) if (this.driveW[i] > 0) grip += ws[i].tire.baseMu * ws[i].Fz * ws[i].c.radius;
      C = Math.min(C, (grip / Math.abs(Gr)) * (as.tcs > 0 ? 0.95 : 1.3));
    }

    // --- per-wheel free (no drive) update incl. brakes, rolling resistance, tyre reaction
    const bias = p.brakes.bias;
    for (let i = 0; i < 4; i++) {
      const w = ws[i], c = w.c;
      w.J = c.inertia + dt * c.radius * w.dFdO; // implicit inertia (tyre stiffness folded in)
      let b = brakeIn * p.brakes.torque * (w.front ? bias : 1 - bias) * 0.5;
      if (!w.front) b += ctl.handbrake * p.brakes.handbrake * 0.5;
      if (i === escBrake) b += escAmount * p.brakes.torque * 0.5;
      // ABS
      if (as.abs && brakeIn > 0 && !(ctl.handbrake > 0.1 && !w.front)) {
        w.abs = w.slipRatio < -w.tire.peakSlip * 1.25 && this.tel.speed > 3 ? Math.max(0.3, w.abs - dt * 30) : Math.min(1, w.abs + dt * 6);
        b *= w.abs;
      } else w.abs = 1;
      w.brakeT = b + (w.contact ? w.tire.rr * w.Fz * c.radius * surfaceById(w.surface).rolling : 0) + 2;
      // linearized implicit step; the dvx term keeps free-rolling wheels from lagging an accelerating body
      const free = w.omega + (dt * c.radius * (-w.fx + (w.contact ? w.dFdV * w.dvx : 0))) / w.J;
      const bd = (w.brakeT * dt) / w.J;
      w.a = Math.abs(free) <= bd ? 0 : free - Math.sign(free) * bd;
      w.b = (dt * this.driveW[i] * Gr) / w.J;
    }
    // --- clutch solve: lock engine to driveline if within capacity
    let Tc = 0;
    if (Gr !== 0 && C > 0) {
      let A = 0, B = 0;
      for (let i = 0; i < 4; i++) { A += this.driveW[i] * ws[i].a; B += this.driveW[i] * ws[i].b; }
      Tc = (e.omega + (dt * Te) / pe.inertia - Gr * A) / (dt / pe.inertia + Gr * B);
      if (Tc > C) Tc = C; else if (Tc < -C) Tc = -C;
    }
    for (let i = 0; i < 4; i++) { const w = ws[i]; w.omega = w.a + w.b * Tc; w.driveT = this.driveW[i] * Gr * Tc; }
    e.omega += (dt * (Te - Tc)) / pe.inertia;
    // --- differentials (torque transfer between wheels / axles, impulse-limited)
    const dt_ = p.drivetrain;
    const axleIn = Gr * Tc;
    if (this.driveW[0] > 0) diffAxle(ws[FL], ws[FR], dt_.front, axleIn * (this.driveW[0] * 2), dt);
    if (this.driveW[2] > 0) diffAxle(ws[RL], ws[RR], dt_.rear, axleIn * (this.driveW[2] * 2), dt);
    if (dt_.layout === 'AWD') diffCenter(ws, dt_.center, axleIn, dt);
    // keep engine within sane bounds
    const minW = (pe.idle * 0.5 * Math.PI) / 30, maxW = ((pe.limiter + 400) * Math.PI) / 30;
    if (e.omega < minW) e.omega = minW;
    if (e.omega > maxW) e.omega = maxW;
    e.rpm = (e.omega * 30) / Math.PI;

    // --- automatic gearbox (decisions use ground-speed rpm so wheelspin flare does not cause gear hunting)
    if (as.autoShift && !shifting && gear > 0) {
      const n = tr.gears.length;
      const drifting = Math.abs(this.tel.slipAngle) > 14 * DEG && this.tel.speed > 6;
      const since = this.time - gb.lastShift;
      const rD = this.driveW[2] > 0 ? ws[2].c.radius : ws[0].c.radius;
      const groundRpm = (this.tel.speed / rD) * tr.gears[gear - 1] * tr.final * 30 / Math.PI;
      // full throttle: the optimal (max-thrust) shift point; part throttle: short-shift like a road automatic,
      // but never so early that the next gear lands under the part-throttle downshift point (hunting)
      const partUp = gear < n ? Math.max(pe.redline * 0.5, pe.redline * 0.46 * tr.gears[gear - 1] / tr.gears[gear]) : Infinity;
      const upRpm = gear < n ? lerp(Math.min(partUp, this.shiftUpRpm[gear - 1]), this.shiftUpRpm[gear - 1], smoothstep(0.35, 0.9, throttleIn)) : Infinity;
      if (gear < n && e.rpm > upRpm && throttleIn > 0.05 && since > 0.3 && gb.clutch > 0.9 && !(drifting && e.rpm < pe.limiter - 60)) this.shift(1);
      else if (gear > 1 && since > 0.6 && !drifting) {
        const after = groundRpm * (tr.gears[gear - 2] / tr.gears[gear - 1]);
        const limitAfter = Math.min(pe.redline * 0.9, this.shiftUpRpm[gear - 2] * 0.9);
        let want;
        if (brakeIn > 0.2) want = groundRpm < pe.redline * 0.55;
        else if (throttleIn > 0.85) want = groundRpm < pe.redline * (since > 1.2 ? 0.5 : 0.3); // kickdown; bogged (spin recovery) right away
        else want = groundRpm < pe.redline * 0.36;
        if (want && after < limitAfter) this.shift(-1);
      }
    }
  }

  // ------------------------------------------------------------------------------- collisions
  _collideStatics(dt) {
    const p = this.p, box = p.body;
    const fx = this.fwd.x, fz = this.fwd.z;
    const fl = Math.hypot(fx, fz) || 1;
    const ax = fx / fl, az = fz / fl;           // car forward (2D)
    const bx = az, bz = -ax;                    // car right... we only need an orthonormal pair
    v1.set(0, box.cy, box.cz).applyMatrix3(this.rot).add(this.pos);
    const cx = v1.x, cz = v1.z, cy = v1.y;
    const ehz = box.hz, ehx = box.hx;
    const y0 = cy - box.hy, y1 = cy + box.hy;
    const rad = Math.hypot(ehz, ehx);
    const self = this;
    this.world.forEachStaticNear(cx - rad, cz - rad, cx + rad, cz + rad, (s) => {
      if (s.y1 < y0 || s.y0 > y1) return;
      let nx, nz, depth, px, pz;
      if (s.type === BOX) {
        const r = obbOverlap(cx, cz, ax, az, bx, bz, ehz, ehx, s.x, s.z, s.cos, s.sin, -s.sin, s.cos, s.hx, s.hz);
        if (!r) return;
        ({ nx, nz, depth, px, pz } = r);
      } else {
        // closest point on car OBB to circle centre
        const dx = s.x - cx, dz = s.z - cz;
        const la = clamp(dx * ax + dz * az, -ehz, ehz), lb = clamp(dx * bx + dz * bz, -ehx, ehx);
        const qx = cx + ax * la + bx * lb, qz = cz + az * la + bz * lb;
        let ddx = qx - s.x, ddz = qz - s.z;
        const d = Math.hypot(ddx, ddz);
        if (d >= s.r) return;
        if (d < 1e-4) { ddx = cx - s.x; ddz = cz - s.z; const l = Math.hypot(ddx, ddz) || 1; ddx /= l; ddz /= l; depth = s.r; }
        else { ddx /= d; ddz /= d; depth = s.r - d; }
        nx = ddx; nz = ddz; px = qx; pz = qz;
      }
      const j = self._resolveStatic(nx, nz, depth, px, cy - 0.1, pz, s.bounce, s.friction);
      if (j > 50 && self.fx.collisions.length < 24) self.fx.collisions.push({ impulse: j, x: px, y: cy - 0.1, z: pz, kind: s.kind, nx, nz, scrape: j < self.mass * 1.5 });
    });
  }
  _resolveStatic(nx, nz, depth, px, py, pz, e, mu) {
    this.pos.x += nx * Math.max(0, depth - 0.002) * 0.95;
    this.pos.z += nz * Math.max(0, depth - 0.002) * 0.95;
    return this.applyImpulseNormal(nx, 0, nz, px, py, pz, e, mu);
  }
  /** Collision impulse along normal n at world point. Returns impulse magnitude. */
  applyImpulseNormal(nx, ny, nz, px, py, pz, e = 0.15, mu = 0.3) {
    const r = v1.set(px - this.pos.x, py - this.pos.y, pz - this.pos.z);
    const vp = v2.crossVectors(this.angVel, r).add(this.vel);
    const n = v3.set(nx, ny, nz);
    const vn = vp.dot(n);
    if (vn >= 0) return 0;
    const rn = v4.crossVectors(r, n).applyMatrix3(this.invIw);
    const k = this.invMass + v5.crossVectors(rn, r).dot(n);
    const j = (-(1 + e) * vn) / k;
    this._applyImpulse(n.x * j, n.y * j, n.z * j, r);
    // friction
    const vp2 = v2.crossVectors(this.angVel, r).add(this.vel);
    const vt = vp2.addScaledVector(n, -vp2.dot(n));
    const tl = vt.length();
    if (tl > 1e-3) {
      vt.multiplyScalar(1 / tl);
      const rt = v4.crossVectors(r, vt).applyMatrix3(this.invIw);
      const kt = this.invMass + v5.crossVectors(rt, r).dot(vt);
      const jt = Math.min(tl / kt, mu * j);
      this._applyImpulse(-vt.x * jt, -vt.y * jt, -vt.z * jt, r);
    }
    return j;
  }
  _applyImpulse(jx, jy, jz, r) {
    this.vel.x += jx * this.invMass; this.vel.y += jy * this.invMass; this.vel.z += jz * this.invMass;
    _imp.set(jx, jy, jz);
    _tq.crossVectors(r, _imp).applyMatrix3(this.invIw);
    this.angVel.add(_tq);
  }
  _collideBodyGround() {
    const b = this.p.body;
    for (let k = 0; k < 8; k++) {
      const sx = k & 1 ? 1 : -1, sy = k & 2 ? 1 : -1, sz = k & 4 ? 1 : -1;
      _corner.set(sx * b.hx * 0.92, b.cy + sy * b.hy, b.cz + sz * b.hz * 0.95).applyMatrix3(this.rot).add(this.pos);
      if (!this.world.raycast(_corner.x, _corner.y + 1.5, _corner.z, 0, -1, 0, 1.5, _hit)) continue;
      const depth = _hit.y - _corner.y;
      if (depth <= 0) continue;
      this.pos.addScaledVector(_n.set(_hit.nx, _hit.ny, _hit.nz), depth * 0.6);
      const j = this.applyImpulseNormal(_hit.nx, _hit.ny, _hit.nz, _corner.x, _corner.y, _corner.z, 0.05, 0.6);
      if (j > 300 && this.fx.collisions.length < 24) this.fx.collisions.push({ impulse: j, x: _corner.x, y: _corner.y, z: _corner.z, kind: 'ground', nx: _hit.nx, nz: _hit.nz, scrape: true });
    }
  }

  /** Snapshot of every piece of dynamic state (rewind). restore() + the same inputs reproduces the same motion. */
  snapshot() {
    return {
      p: this.pos.toArray(), q: this.quat.toArray(), v: this.vel.toArray(), w: this.angVel.toArray(), pv: this._prevVel.toArray(),
      wh: this.wheels.map((w) => { const o = {}; for (const k in w) if (typeof w[k] === 'number' || typeof w[k] === 'boolean') o[k] = w[k]; return o; }),
      tel: { ...this.tel }, ax: [this.fwd.toArray(), this.left.toArray(), this.up.toArray()],
      e: { ...this.engine }, g: { ...this.gearbox }, m: [this._tcs, this._lastThrottle, this.time],
    };
  }
  restore(s) {
    this.pos.fromArray(s.p); this.quat.fromArray(s.q); this.vel.fromArray(s.v); this.angVel.fromArray(s.w); this._prevVel.fromArray(s.pv);
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    s.wh.forEach((o, i) => Object.assign(this.wheels[i], o));
    Object.assign(this.tel, s.tel); this.fwd.fromArray(s.ax[0]); this.left.fromArray(s.ax[1]); this.up.fromArray(s.ax[2]);
    Object.assign(this.engine, s.e); Object.assign(this.gearbox, s.g);
    [this._tcs, this._lastThrottle, this.time] = s.m;
  }
  /** Interpolated transform for rendering. */
  getInterpolated(alpha, outPos, outQuat) {
    outPos.lerpVectors(this.prevPos, this.pos, alpha);
    outQuat.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }
}

const _m4 = new Matrix4();
const _imp = new Vector3(), _tq = new Vector3(), _corner = new Vector3(), _n = new Vector3();

// ---- differentials ---------------------------------------------------------------------------
function lockTorque(d, Tin) {
  if (!d || d.type === 'open') return 0;
  if (d.type === 'locked') return Infinity;
  const lock = Tin >= 0 ? d.accel : d.decel;
  return (d.preload || 0) + lock * Math.abs(Tin) * 1.5;
}
function diffAxle(a, b, d, Tin, dt) {
  if (!d || d.type === 'open') return;
  const sync = (a.omega - b.omega) / (dt * (1 / a.J + 1 / b.J));
  let T;
  if (d.type === 'viscous') { T = (d.viscous || 60) * (a.omega - b.omega); if (Math.abs(T) > Math.abs(sync)) T = sync; }
  else { const cap = lockTorque(d, Tin); T = sync > cap ? cap : sync < -cap ? -cap : sync; }
  a.omega -= (T * dt) / a.J; b.omega += (T * dt) / b.J;
}
function diffCenter(ws, d, Tin, dt) {
  if (!d || d.type === 'open') return;
  const Jf = ws[0].J + ws[1].J, Jr = ws[2].J + ws[3].J;
  const of = (ws[0].omega + ws[1].omega) / 2, or = (ws[2].omega + ws[3].omega) / 2;
  const sync = (of - or) / (dt * (1 / Jf + 1 / Jr));
  let T;
  if (d.type === 'viscous') { T = (d.viscous || 120) * (of - or); if (Math.abs(T) > Math.abs(sync)) T = sync; }
  else { const cap = lockTorque(d, Tin); T = sync > cap ? cap : sync < -cap ? -cap : sync; }
  const dwf = (T * dt) / Jf, dwr = (T * dt) / Jr;
  ws[0].omega -= dwf; ws[1].omega -= dwf; ws[2].omega += dwr; ws[3].omega += dwr;
}

// ---- 2D OBB overlap (SAT). A = car, B = static. Returns normal pointing from B to A. --------------
function obbOverlap(ax0, az0, a0x, a0z, a1x, a1z, ea0, ea1, bx0, bz0, b0x, b0z, b1x, b1z, eb0, eb1) {
  const dx = ax0 - bx0, dz = az0 - bz0;
  let best = Infinity, nx = 0, nz = 0, fromB = false;
  const axes = [[a0x, a0z, false], [a1x, a1z, false], [b0x, b0z, true], [b1x, b1z, true]];
  for (let k = 0; k < 4; k++) {
    const lx = axes[k][0], lz = axes[k][1];
    const ra = ea0 * Math.abs(a0x * lx + a0z * lz) + ea1 * Math.abs(a1x * lx + a1z * lz);
    const rb = eb0 * Math.abs(b0x * lx + b0z * lz) + eb1 * Math.abs(b1x * lx + b1z * lz);
    const dist = dx * lx + dz * lz;
    const o = ra + rb - Math.abs(dist);
    if (o <= 0) return null;
    if (o < best) { best = o; const sgn = dist >= 0 ? 1 : -1; nx = lx * sgn; nz = lz * sgn; fromB = axes[k][2]; }
  }
  // contact point: deepest vertex
  let px = 0, pz = 0;
  if (fromB) {
    let m = Infinity;
    for (let k = 0; k < 4; k++) {
      const s0 = k & 1 ? 1 : -1, s1 = k & 2 ? 1 : -1;
      const vx = ax0 + a0x * ea0 * s0 + a1x * ea1 * s1, vz = az0 + a0z * ea0 * s0 + a1z * ea1 * s1;
      const d = vx * nx + vz * nz;
      if (d < m) { m = d; px = vx; pz = vz; }
    }
  } else {
    let m = -Infinity;
    for (let k = 0; k < 4; k++) {
      const s0 = k & 1 ? 1 : -1, s1 = k & 2 ? 1 : -1;
      const vx = bx0 + b0x * eb0 * s0 + b1x * eb1 * s1, vz = bz0 + b0z * eb0 * s0 + b1z * eb1 * s1;
      const d = vx * nx + vz * nz;
      if (d > m) { m = d; px = vx; pz = vz; }
    }
  }
  return { nx, nz, depth: best, px, pz };
}

/** Car vs car (both dynamic). Call after stepping all cars. Returns impulse or 0. */
export function collideCars(A, B) {
  if (A.ghost || B.ghost) return 0;
  const ba = A.p.body, bb = B.p.body;
  const pa = v1.set(0, ba.cy, ba.cz).applyMatrix3(A.rot).add(A.pos);
  const pax = pa.x, pay = pa.y, paz = pa.z;
  const pb = v2.set(0, bb.cy, bb.cz).applyMatrix3(B.rot).add(B.pos);
  const pbx = pb.x, pby = pb.y, pbz = pb.z;
  if (Math.abs(pay - pby) > ba.hy + bb.hy) return 0;
  const rr = Math.hypot(ba.hz, ba.hx) + Math.hypot(bb.hz, bb.hx);
  if ((pax - pbx) ** 2 + (paz - pbz) ** 2 > rr * rr) return 0;
  const afl = Math.hypot(A.fwd.x, A.fwd.z) || 1, bfl = Math.hypot(B.fwd.x, B.fwd.z) || 1;
  const a0x = A.fwd.x / afl, a0z = A.fwd.z / afl, b0x = B.fwd.x / bfl, b0z = B.fwd.z / bfl;
  const r = obbOverlap(pax, paz, a0x, a0z, a0z, -a0x, ba.hz, ba.hx, pbx, pbz, b0x, b0z, b0z, -b0x, bb.hz, bb.hx);
  if (!r) return 0;
  const { nx, nz, depth, px, pz } = r;
  const py = (pay + pby) / 2 - 0.1;
  // positional split by inverse mass
  const wsum = A.invMass + B.invMass;
  const corr = Math.max(0, depth - 0.002) * 0.9 / wsum;
  A.pos.x += nx * corr * A.invMass; A.pos.z += nz * corr * A.invMass;
  B.pos.x -= nx * corr * B.invMass; B.pos.z -= nz * corr * B.invMass;
  // relative velocity at contact
  const ra = v3.set(px - A.pos.x, py - A.pos.y, pz - A.pos.z);
  const rb = v4.set(px - B.pos.x, py - B.pos.y, pz - B.pos.z);
  const va = _va.crossVectors(A.angVel, ra).add(A.vel);
  const vb = _vb.crossVectors(B.angVel, rb).add(B.vel);
  const n = _nn.set(nx, 0, nz);
  const vn = va.sub(vb).dot(n);
  if (vn >= 0) return 0;
  const ka = _k1.crossVectors(ra, n).applyMatrix3(A.invIw); const kaa = _k2.crossVectors(ka, ra).dot(n);
  const kb = _k1.crossVectors(rb, n).applyMatrix3(B.invIw); const kbb = _k2.crossVectors(kb, rb).dot(n);
  const j = (-(1 + 0.2) * vn) / (wsum + kaa + kbb);
  A._applyImpulse(nx * j, 0, nz * j, ra);
  B._applyImpulse(-nx * j, 0, -nz * j, rb);
  const ev = { impulse: j, x: px, y: py, z: pz, kind: 'car', nx, nz, scrape: j < 1500 };
  A.fx.collisions.push(ev); B.fx.collisions.push({ ...ev, nx: -nx, nz: -nz });
  return j;
}
const _va = new Vector3(), _vb = new Vector3(), _nn = new Vector3(), _k1 = new Vector3(), _k2 = new Vector3();
