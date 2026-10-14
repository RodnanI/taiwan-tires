// Skid marks: one ring buffer of road-hugging quads shared by every car. Budget = gfx.skidmarks segments.
import * as THREE from 'three';

export class SkidMarks {
  constructor(scene, maxSegments = 2000) {
    this.scene = scene;
    this.trails = new Map(); // key -> { l: Vector3, r: Vector3, alpha }
    this.setBudget(maxSegments);
  }
  setBudget(max) {
    this.dispose();
    this.max = Math.max(0, max | 0);
    if (!this.max) return;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 4 * 3);
    this.alpha = new Float32Array(this.max * 4);
    const idx = new Uint32Array(this.max * 6);
    for (let i = 0; i < this.max; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); }
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('alpha', this.alphaAttr);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0x0b0b0b) } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 color; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(color, vA); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.geometry = g;
    this.head = 0;
    this.scene.add(this.mesh);
  }
  /**
   * Called per wheel per frame. key: unique wheel id. center: contact point, side: unit lateral vector,
   * normal: ground normal, width: tyre width (m), strength 0..1 (0 = lift the pen).
   */
  mark(key, center, side, normal, width, strength) {
    if (!this.max) return;
    let t = this.trails.get(key);
    if (strength < 0.06) { if (t) t.active = false; return; }
    const lift = 0.012;
    const lx = center.x + side.x * width / 2 + normal.x * lift, ly = center.y + side.y * width / 2 + normal.y * lift, lz = center.z + side.z * width / 2 + normal.z * lift;
    const rx = center.x - side.x * width / 2 + normal.x * lift, ry = center.y - side.y * width / 2 + normal.y * lift, rz = center.z - side.z * width / 2 + normal.z * lift;
    if (!t) { t = { l: new THREE.Vector3(), r: new THREE.Vector3(), a: 0, active: false }; this.trails.set(key, t); }
    const a = Math.min(0.85, strength);
    if (t.active) {
      const dx = (lx + rx) / 2 - (t.l.x + t.r.x) / 2, dz = (lz + rz) / 2 - (t.l.z + t.r.z) / 2;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.09) return; // ~30 cm segments
      if (d2 > 25) { t.active = false; }
      else {
        const i = this.head, v = i * 4;
        this.pos.set([t.l.x, t.l.y, t.l.z, t.r.x, t.r.y, t.r.z, lx, ly, lz, rx, ry, rz], v * 3);
        this.alpha.set([t.a, t.a, a, a], v);
        this.head = (this.head + 1) % this.max;
        this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true;
      }
    }
    t.l.set(lx, ly, lz); t.r.set(rx, ry, rz); t.a = a; t.active = true;
  }
  clear() { if (this.alpha) { this.alpha.fill(0); this.alphaAttr.needsUpdate = true; } this.trails.clear(); }
  dispose() { if (this.mesh) { this.scene.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); this.mesh = null; } }
}
