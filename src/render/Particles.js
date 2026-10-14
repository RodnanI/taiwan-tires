// CPU-simulated, GPU-instanced billboard particles: tyre smoke, dust, sparks, backfire flames, spray.
// Two batches: alpha-blended (smoke/dust/spray) and additive (sparks/flames). Budget = gfx.particles.
import * as THREE from 'three';
import { PARTICLE_OPTIONS } from './Quality.js';

const VERT = /* glsl */`
attribute vec3 offset; attribute vec4 color; attribute vec2 sizeRot; attribute float seed;
uniform vec3 light; varying vec4 vColor; varying vec2 vUv; varying float vSeed;
void main(){
  vUv = uv; vSeed = seed;
  vColor = vec4(color.rgb * light, color.a);
  vec4 mv = modelViewMatrix * vec4(offset, 1.0);
  float c = cos(sizeRot.y), s = sin(sizeRot.y);
  vec2 q = (uv - 0.5) * sizeRot.x;
  mv.xy += vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_SOFT = /* glsl */`
varying vec4 vColor; varying vec2 vUv; varying float vSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
void main(){
  vec2 p = vUv - 0.5; float r = length(p) * 2.0;
  float noise = n(vUv * 4.0 + vSeed * 13.0) * 0.6 + n(vUv * 9.0 - vSeed * 7.0) * 0.4;
  float a = smoothstep(1.0, 0.25, r + (noise - 0.5) * 0.55) * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb * (0.82 + noise * 0.3), a);
}`;
const FRAG_ADD = /* glsl */`
varying vec4 vColor; varying vec2 vUv;
void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) * vColor.a; if (a < 0.003) discard; gl_FragColor = vec4(vColor.rgb * a, a); }`;

class Batch {
  constructor(max, additive) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    this.offset = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeRot = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.seed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('offset', this.offset); g.setAttribute('color', this.color); g.setAttribute('sizeRot', this.sizeRot); g.setAttribute('seed', this.seed);
    g.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      uniforms: { light: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: VERT, fragmentShader: additive ? FRAG_ADD : FRAG_SOFT,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
    this.geometry = g;
    // simulation state (structure of arrays)
    const F = (n) => new Float32Array(max * n);
    this.p = F(3); this.v = F(3); this.life = F(1); this.maxLife = F(1); this.s0 = F(1); this.s1 = F(1); this.rgb = F(3); this.a0 = F(1);
    this.rot = F(1); this.rotV = F(1); this.drag = F(1); this.grav = F(1); this.sd = F(1);
    this.count = 0;
  }
  spawn(o) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.p.set(o.p, i * 3); this.v.set(o.v, i * 3);
    this.life[i] = 0; this.maxLife[i] = o.life; this.s0[i] = o.s0; this.s1[i] = o.s1; this.rgb.set(o.c, i * 3); this.a0[i] = o.a;
    this.rot[i] = Math.random() * 6.28; this.rotV[i] = (Math.random() - 0.5) * (o.spin ?? 1); this.drag[i] = o.drag ?? 1; this.grav[i] = o.grav ?? 0; this.sd[i] = Math.random();
  }
  update(dt, wind) {
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const life = this.life[i] + dt;
      if (life >= this.maxLife[i]) continue;
      // compact in place
      if (n !== i) {
        this.p.copyWithin(n * 3, i * 3, i * 3 + 3); this.v.copyWithin(n * 3, i * 3, i * 3 + 3); this.rgb.copyWithin(n * 3, i * 3, i * 3 + 3);
        this.maxLife[n] = this.maxLife[i]; this.s0[n] = this.s0[i]; this.s1[n] = this.s1[i]; this.a0[n] = this.a0[i];
        this.rot[n] = this.rot[i]; this.rotV[n] = this.rotV[i]; this.drag[n] = this.drag[i]; this.grav[n] = this.grav[i]; this.sd[n] = this.sd[i];
      }
      this.life[n] = life;
      const k = Math.exp(-this.drag[n] * dt);
      const b = n * 3;
      this.v[b] = this.v[b] * k + wind.x * (1 - k); this.v[b + 1] = this.v[b + 1] * k - this.grav[n] * dt + (this.grav[n] < 0 ? 0 : 0); this.v[b + 2] = this.v[b + 2] * k + wind.z * (1 - k);
      this.p[b] += this.v[b] * dt; this.p[b + 1] += this.v[b + 1] * dt; this.p[b + 2] += this.v[b + 2] * dt;
      this.rot[n] += this.rotV[n] * dt;
      const t = life / this.maxLife[n];
      this.offset.array[b] = this.p[b]; this.offset.array[b + 1] = this.p[b + 1]; this.offset.array[b + 2] = this.p[b + 2];
      const c = n * 4;
      this.color.array[c] = this.rgb[b]; this.color.array[c + 1] = this.rgb[b + 1]; this.color.array[c + 2] = this.rgb[b + 2];
      this.color.array[c + 3] = this.a0[n] * Math.min(1, t * 8) * (1 - t) * (1 - t * 0.3);
      this.sizeRot.array[n * 2] = this.s0[n] + (this.s1[n] - this.s0[n]) * Math.sqrt(t);
      this.sizeRot.array[n * 2 + 1] = this.rot[n];
      this.seed.array[n] = this.sd[n];
      n++;
    }
    this.count = n;
    this.geometry.instanceCount = n;
    if (n) { this.offset.needsUpdate = true; this.color.needsUpdate = true; this.sizeRot.needsUpdate = true; this.seed.needsUpdate = true; }
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.wind = new THREE.Vector3(0.6, 0, 0.3);
    this.setBudget('medium');
  }
  setBudget(level) {
    this.dispose();
    const max = PARTICLE_OPTIONS[level] ?? 1800;
    this.enabled = max > 0;
    this.soft = new Batch(Math.max(16, max), false);
    this.add = new Batch(Math.max(16, Math.round(max / 4)), true);
    this.scene.add(this.soft.mesh, this.add.mesh);
    this.density = max / 4000;
  }
  /** Tyre smoke. strength 0..1, color [r,g,b] (tuning: smoke colour). */
  smoke(pos, vel, strength, color = [0.9, 0.9, 0.9], width = 0.25) {
    if (!this.enabled || Math.random() > Math.min(1, strength * 1.4 * Math.max(0.35, this.density))) return;
    this.soft.spawn({
      p: [pos.x + (Math.random() - 0.5) * width, pos.y + 0.12, pos.z + (Math.random() - 0.5) * width],
      v: [vel.x * 0.25 + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 1.2, vel.z * 0.25 + (Math.random() - 0.5) * 1.2],
      life: 1.6 + strength * 2.6 + Math.random(), s0: 0.6, s1: 3.2 + strength * 4, c: color, a: 0.18 + strength * 0.32, drag: 1.4, grav: -0.25, spin: 0.8,
    });
  }
  dust(pos, vel, strength, color = [0.55, 0.45, 0.33]) {
    if (!this.enabled || Math.random() > strength * Math.max(0.35, this.density)) return;
    this.soft.spawn({ p: [pos.x, pos.y + 0.1, pos.z], v: [vel.x * 0.3 + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 1.5, vel.z * 0.3 + (Math.random() - 0.5) * 2], life: 1.2 + Math.random() * 1.5, s0: 0.5, s1: 3 + strength * 3, c: color, a: 0.35 * strength + 0.1, drag: 1.8, grav: 0.4 });
  }
  spray(pos, vel, strength) {
    if (!this.enabled || Math.random() > strength * this.density * 2) return;
    this.soft.spawn({ p: [pos.x, pos.y + 0.1, pos.z], v: [vel.x * 0.5 + (Math.random() - 0.5), 0.8 + Math.random(), vel.z * 0.5 + (Math.random() - 0.5)], life: 0.5 + Math.random() * 0.5, s0: 0.3, s1: 1.6, c: [0.75, 0.78, 0.82], a: 0.22, drag: 2.5, grav: 3 });
  }
  sparks(pos, normal, count = 8, speed = 6) {
    if (!this.enabled) return;
    const n = Math.round(count * Math.max(0.3, this.density));
    for (let i = 0; i < n; i++) {
      this.add.spawn({ p: [pos.x, pos.y, pos.z], v: [normal.x * speed * Math.random() + (Math.random() - 0.5) * speed, Math.random() * speed * 0.6, normal.z * speed * Math.random() + (Math.random() - 0.5) * speed], life: 0.25 + Math.random() * 0.35, s0: 0.09, s1: 0.03, c: [1.0, 0.62, 0.22], a: 1.4, drag: 0.6, grav: 9.8, spin: 0 });
    }
  }
  flame(pos, dir, strength = 1) {
    if (!this.enabled) return;
    for (let i = 0; i < 4; i++) {
      const s = Math.random() * 6 + 4;
      this.add.spawn({ p: [pos.x, pos.y, pos.z], v: [dir.x * s + (Math.random() - 0.5), dir.y * s + Math.random() * 0.4, dir.z * s + (Math.random() - 0.5)], life: 0.06 + Math.random() * 0.08, s0: 0.18 * strength, s1: 0.45 * strength, c: [1.0, 0.45 + Math.random() * 0.2, 0.12], a: 1.6, drag: 4, grav: -2, spin: 0 });
    }
  }
  update(dt, lightColor) {
    if (lightColor) this.soft.material.uniforms.light.value.copy(lightColor);
    this.soft.update(dt, this.wind);
    this.add.update(dt, this.wind);
  }
  clear() { this.soft.count = 0; this.add.count = 0; }
  dispose() {
    for (const b of [this.soft, this.add]) if (b) { this.scene.remove(b.mesh); b.dispose(); }
  }
}
