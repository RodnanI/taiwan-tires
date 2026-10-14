// Virtual lights: maps register hundreds of street lamps / neon signs; only the N most relevant become real
// THREE lights (N = gfx.dynamicLights). The pool size is fixed per quality so shaders never recompile.
import * as THREE from 'three';

export class LightManager {
  constructor(scene) {
    this.scene = scene;
    this.virtual = [];
    this.pool = [];
    this.frame = 0;
    this.enabled = true;
  }
  /** v: { pos:[x,y,z], color, intensity (candela-ish), range, kind:'point'|'spot' } */
  add(v) {
    const L = { pos: new THREE.Vector3(...v.pos), color: new THREE.Color(v.color ?? 0xffc98a), intensity: v.intensity ?? 60, range: v.range ?? 28, nightOnly: v.nightOnly !== false, score: 0 };
    this.virtual.push(L);
    return L;
  }
  setPoolSize(n) {
    for (const l of this.pool) this.scene.remove(l);
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 30, 2);
      l.castShadow = false;
      l.position.set(0, -1000, 0);
      this.scene.add(l);
      this.pool.push(l);
    }
  }
  /** Assign pool lights to the virtual lights closest to `focus` (biased to what the camera looks at). */
  update(focus, camera, night = 1) {
    if (!this.pool.length) return;
    this.frame++;
    if (this.frame % 3 !== 0 && this._last) return;
    this._last = true;
    const dir = camera ? camera.getWorldDirection(_d) : null;
    for (const v of this.virtual) {
      const dx = v.pos.x - focus.x, dy = v.pos.y - focus.y, dz = v.pos.z - focus.z;
      let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dir) { const ahead = (dx * dir.x + dz * dir.z) / (d || 1); d *= ahead > 0 ? 1 - ahead * 0.35 : 1.25; }
      v.score = d - v.range * 0.3;
    }
    const sorted = this.virtual.slice().sort((a, b) => a.score - b.score);
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i], v = sorted[i];
      if (!v || (v.nightOnly && night < 0.05)) { l.intensity = 0; continue; }
      l.position.copy(v.pos);
      l.color.copy(v.color);
      l.distance = v.range;
      l.intensity = v.intensity * (v.nightOnly ? night : 1);
    }
  }
  clear() { this.virtual = []; }
  dispose() { for (const l of this.pool) this.scene.remove(l); this.pool = []; this.virtual = []; }
}
const _d = new THREE.Vector3();
