// Forza-style racing line on the road: green = flat out, amber = lift / settle, red = brake now.
// Colours are dynamic: they compare the player's current speed with the speed the car can carry ahead.
import * as THREE from 'three';
import { capability, speedProfile } from '../ai/AIDriver.js';
import { clamp, G } from '../core/math.js';

const N = 110; // samples drawn ahead (~220 m)

export class RacingLineView {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 2 * 3);
    this.col = new Float32Array(N * 2 * 4);
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: false, toneMapped: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.route = null;
    this.hint = -1;
  }
  setRoute(route, vehicle) {
    this.route = route;
    this.hint = -1;
    if (route && vehicle) { this.cap = capability(vehicle.params); this.profile = speedProfile(route, this.cap, 0.95); }
  }
  update(vehicle, mode = 'braking') {
    const R = this.route;
    this.mesh.visible = !!R && mode !== 'off';
    if (!this.mesh.visible) return;
    const ph = vehicle.physics;
    const p = R.project(ph.pos.x, ph.pos.z, this.hint);
    this.hint = p.i;
    const v0 = ph.tel.speed;
    const brakeCap = this.cap.mu * G * 0.85;
    let d = 0;
    for (let k = 0; k < N; k++) {
      const i = R.idx(p.i + 2 + k * 2);
      if (k > 0) { const j = R.idx(p.i + k * 2); d += Math.hypot(R.lx[i] - R.lx[j], R.lz[i] - R.lz[j]); }
      const vt = this.profile[i];
      const need = d > 1 ? (v0 * v0 - vt * vt) / (2 * d) : v0 > vt ? brakeCap : 0;
      let r = 0.18, g = 0.86, b = 0.36, a = 0.55; // green
      if (need > brakeCap * 0.55) { r = 0.95; g = 0.16; b = 0.12; a = 0.8; }
      else if (need > brakeCap * 0.12) { r = 0.98; g = 0.68; b = 0.12; a = 0.7; }
      else if (mode === 'braking') a = 0;
      a *= clamp(1 - k / N, 0, 1) * clamp(d / 6, 0, 1);
      if (!R.closed && R.idx(p.i + 2 + k * 2) >= R.n - 1) a = 0;
      const tx = R.tx[i], tz = R.tz[i], nx = tz * 0.32, nz = -tx * 0.32;
      const x = R.lx[i], z = R.lz[i], y = R.y[i] + 0.05;
      this.pos.set([x + nx, y, z + nz, x - nx, y, z - nz], k * 6);
      this.col.set([r, g, b, a, r, g, b, a], k * 8);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
