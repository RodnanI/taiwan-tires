// Driving cameras with "speed feel": velocity-led chase cam, FOV kick, shake (speed, surface, impacts),
// look-back, G-force head motion and look-to-apex in the cockpit.
import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep, valueNoise } from '../core/math.js';

export const CAMERA_MODES = ['chase', 'chaseFar', 'hood', 'bumper', 'cockpit'];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();

export class CameraRig {
  constructor(settings) {
    this.settings = settings;
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2000);
    this.mode = settings.get('display.defaultCamera') || 'chase';
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.heading = 0; this.fov = 68; this.trauma = 0; this.t = 0;
    this.lookBack = false;
    this.speedNorm = 0;
    this.minDepth = 6;
    this.initialized = false;
    this.orbit = { yaw: 0.6, pitch: 0.18, dist: 7, target: new THREE.Vector3() };
  }
  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
  setFar(f) { this.camera.far = f; this.camera.updateProjectionMatrix(); }
  next() { const i = CAMERA_MODES.indexOf(this.mode); this.mode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length]; this.initialized = false; return this.mode; }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  reset() { this.initialized = false; }

  /**
   * @param vehicle runtime Vehicle (uses root transform + physics telemetry)
   * @param world   CollisionWorld for camera collision
   */
  update(dt, vehicle, world) {
    this.t += dt;
    const cam = this.camera, ph = vehicle.physics, tel = ph.tel;
    const root = vehicle.root;
    root.updateMatrixWorld();
    const speed = tel.speed;
    const kmh = speed * 3.6;
    this.speedNorm = damp(this.speedNorm, smoothstep(70, 300, kmh), 3, dt);
    const fwd = _v.set(0, 0, 1).applyQuaternion(root.quaternion);
    const carHeading = Math.atan2(fwd.x, fwd.z);
    const shakeAmt = this.settings.get('display.cameraShake');
    const speedFov = this.settings.get('display.speedFov');
    // trauma from impacts decays
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const surfRough = ph.wheels.reduce((a, w) => a + (w.contact ? (w.surface >= 5 ? 0.6 : w.surface === 3 ? 1 : 0) : 0), 0) / 4;
    const shakeMag = (Math.pow(this.speedNorm, 2) * 0.35 + surfRough * 0.5 * smoothstep(5, 30, speed) + this.trauma * this.trauma * 2.2) * shakeAmt;
    const nx = (valueNoise(this.t * 17, 1.3) - 0.5) * shakeMag, ny = (valueNoise(4.1, this.t * 19) - 0.5) * shakeMag;

    if (this.mode === 'chase' || this.mode === 'chaseFar') {
      const far = this.mode === 'chaseFar';
      const dist = (far ? 7.4 : 5.4) + vehicle.spec.dimensions[0] * 0.25 + this.speedNorm * 0.8;
      const height = (far ? 2.25 : 1.65) + vehicle.spec.dimensions[2] * 0.25;
      // follow the velocity direction (shows drift angle), fall back to heading at low speed
      const velHeading = Math.atan2(ph.vel.x, ph.vel.z);
      const useVel = smoothstep(4, 14, speed) * (tel.fwdSpeed > -1 ? 1 : 0);
      let target = carHeading;
      if (useVel > 0) { let d = wrap(velHeading - carHeading); d = clamp(d, -1.1, 1.1); target = carHeading + d * useVel * 0.72; }
      if (!this.initialized) this.heading = target;
      this.heading += wrap(target - this.heading) * (1 - Math.exp(-dt * (far ? 3.2 : 4.2)));
      const h = this.lookBack ? this.heading + Math.PI : this.heading;
      const base = _v2.copy(root.position);
      base.y += vehicle.params.cgHeight * 0.6;
      const desired = new THREE.Vector3(base.x - Math.sin(h) * dist, base.y + height, base.z - Math.cos(h) * dist);
      if (!this.initialized) { this.pos.copy(desired); this.vel.set(0, 0, 0); }
      // critically damped spring (stiff laterally, soft longitudinally = sense of acceleration)
      const k = far ? 30 : 46, c = 2 * Math.sqrt(k);
      this.vel.addScaledVector(_v.subVectors(desired, this.pos), k * dt).addScaledVector(this.vel, -c * dt);
      this.pos.addScaledVector(this.vel, dt);
      // keep the chase cam within a sane radius
      const off = _v.subVectors(this.pos, desired);
      if (off.length() > 3) this.pos.copy(desired).addScaledVector(off.normalize(), 3);
      this.look.set(base.x + Math.sin(h) * 3, base.y + 0.55, base.z + Math.cos(h) * 3);
      // camera collision with walls / buildings + ground
      if (world) {
        const t = world.segmentStatics(this.look.x, this.look.z, this.pos.x, this.pos.z, this.pos.y - 0.5, 0.35);
        if (t < 1) this.pos.lerpVectors(this.look, this.pos, Math.max(0.25, t));
        const gy = world.heightAt(this.pos.x, this.pos.z, this.pos.y + 2);
        if (!isNaN(gy) && this.pos.y < gy + 0.5) this.pos.y = gy + 0.5;
      }
      cam.position.copy(this.pos);
      cam.position.x += nx * 0.12; cam.position.y += ny * 0.1;
      cam.up.set(0, 1, 0);
      cam.lookAt(this.look);
      cam.near = 0.1;
      this.fov = damp(this.fov, this.settings.get('display.fov') + this.speedNorm * 16 * speedFov + (ph.engine.nitrousActive ? 6 * speedFov : 0), 4, dt);
      this.minDepth = dist * 0.85 + vehicle.spec.dimensions[0] * 0.5;
    } else {
      // attached cameras
      const anchors = vehicle.anchors || {};
      const L = vehicle.spec.dimensions[0];
      let local;
      if (this.mode === 'cockpit') local = anchors.cockpit || [0.37, 1.1, -0.3];
      else if (this.mode === 'hood') local = anchors.hood || [0, vehicle.spec.dimensions[2] * 0.78, L * 0.12];
      else local = anchors.bumper || [0, 0.55, L / 2 + 0.05];
      const p = _v2.set(local[0], local[1], local[2]);
      // G-force head motion in the cockpit
      if (this.mode === 'cockpit') { p.x += clamp(-tel.latG * 0.035, -0.05, 0.05); p.z += clamp(-tel.longG * 0.04, -0.05, 0.05); p.y += clamp(Math.abs(tel.longG) * -0.01, -0.02, 0); }
      p.applyMatrix4(root.matrixWorld);
      cam.position.copy(p);
      // smoothed orientation (removes the harshest vibration)
      _q.copy(root.quaternion);
      if (!this.initialized) this.camQuat = _q.clone();
      this.camQuat.slerp(_q, 1 - Math.exp(-dt * (this.mode === 'cockpit' ? 22 : 30)));
      cam.quaternion.copy(this.camQuat);
      // cameras look down +Z in vehicle space; three cameras look down -Z
      cam.rotateY(Math.PI + (this.lookBack ? Math.PI : 0));
      if (this.mode === 'cockpit') {
        const apex = clamp(tel.yawRate * 0.12 + ph.controls.steer * 0.06, -0.3, 0.3);
        cam.rotateY(apex);
        cam.rotateX(-0.06);
      } else cam.rotateX(this.mode === 'hood' ? -0.04 : -0.02);
      cam.rotateZ(nx * 0.004); cam.rotateX(ny * 0.004);
      cam.near = this.mode === 'cockpit' ? 0.04 : 0.08;
      const baseFov = this.mode === 'cockpit' ? this.settings.get('display.cockpitFov') : this.settings.get('display.fov') + 4;
      this.fov = damp(this.fov, baseFov + this.speedNorm * 9 * speedFov, 4, dt);
      this.minDepth = this.mode === 'cockpit' ? 1.4 : this.mode === 'hood' ? 2.6 : 0.6;
    }
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    this.initialized = true;
  }

  /** Free orbit around a point (menus, photo mode, results). */
  updateOrbit(dt, target, { yawSpeed = 0.12, dist = 7, pitch = 0.16, height = 0.8 } = {}) {
    this.orbit.yaw += yawSpeed * dt;
    const c = this.camera;
    c.position.set(target.x + Math.sin(this.orbit.yaw) * dist, target.y + height + Math.sin(pitch) * dist, target.z + Math.cos(this.orbit.yaw) * dist);
    c.lookAt(target.x, target.y + height * 0.5, target.z);
    c.fov = 40; c.near = 0.1; c.updateProjectionMatrix();
  }
}
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export { lerp };
