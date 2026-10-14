// Sky, sun/moon, ambient, fog, environment reflections, rain and wetness for one scene.
// World convention: +X = east, -Z = north, +Y up. Time of day in hours [0, 24).
import * as THREE from 'three';
import { clamp, clamp01, lerp, smoothstep } from '../core/math.js';
import { SHADOW_OPTIONS, REFLECTION_OPTIONS } from './Quality.js';

// colour keyframes: [hour, zenith, horizon, sunColor, sunIntensity, hemiSky, hemiGround, hemiIntensity, fog]
const KEYS = [
  [0, '#03050a', '#121418', '#8fa6c8', 0.18, '#1a2232', '#0a0a0a', 0.32, '#0d0e10'],
  [4.8, '#05070e', '#16161a', '#8fa6c8', 0.15, '#1a2232', '#0a0a0a', 0.3, '#0f1012'],
  [5.7, '#16223a', '#9a6550', '#ff9a66', 0.4, '#33405a', '#1b1612', 0.45, '#5b463c'],
  [6.6, '#3c6aa8', '#f1a46b', '#ffb27a', 1.9, '#7e9bc6', '#4a3a2c', 0.75, '#c39a7c'],
  [9, '#336fbf', '#c6d8e6', '#fff0da', 3.0, '#9cc0ea', '#5c5040', 0.95, '#b9c8d2'],
  [12, '#2c69bf', '#cfe0ec', '#fffaf0', 3.4, '#a8c8ee', '#605444', 1.0, '#c4d2da'],
  [15.5, '#3170be', '#dcd8c6', '#ffeacc', 3.0, '#a2c0e2', '#5e5040', 0.95, '#cdcbbd'],
  [17.6, '#3d5584', '#f08a4c', '#ff9c5e', 1.7, '#8090b4', '#4e3a2a', 0.7, '#c0875f'],
  [18.6, '#1d2744', '#9a4a34', '#ff7a45', 0.35, '#3c4566', '#1f1712', 0.45, '#6a4234'],
  [19.6, '#080b16', '#261e1c', '#8fa6c8', 0.16, '#202a40', '#0c0b0a', 0.34, '#151415'],
  [24, '#03050a', '#121418', '#8fa6c8', 0.18, '#1a2232', '#0a0a0a', 0.32, '#0d0e10'],
];
const C = (h) => new THREE.Color(h);
const KEYC = KEYS.map((k) => [k[0], C(k[1]), C(k[2]), C(k[3]), k[4], C(k[5]), C(k[6]), k[7], C(k[8])]);

const SKY_VERT = /* glsl */`varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = /* glsl */`
varying vec3 vDir;
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 moonDir;
uniform float night; uniform float clouds; uniform float time; uniform vec3 glow; uniform float glowAmt; uniform float overcast; uniform float exposureBoost;
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
  col = mix(col, ground, smoothstep(0.0, -0.08, h));
  // city light pollution near the horizon at night
  col += glow * glowAmt * night * exp(-max(h, 0.0) * 9.0);
  float sd = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(sd, 6.0) * 0.25 + pow(sd, 64.0) * 0.6) * (1.0 - night) * (1.0 - overcast * 0.8);
  col += sunColor * smoothstep(0.9995, 0.99975, sd) * 30.0 * (1.0 - overcast) * step(0.0, sunDir.y + 0.02);
  // stars + moon
  if (night > 0.01 && h > 0.0) {
    vec2 sp = d.xz / (d.y + 0.25) * 140.0;
    float st = step(0.9965, h21(floor(sp))) * (0.6 + 0.4 * sin(time * 3.0 + h21(floor(sp) + 7.0) * 40.0));
    col += vec3(st) * night * (1.0 - overcast) * smoothstep(0.0, 0.25, h) * 0.9;
    float md = max(dot(d, moonDir), 0.0);
    col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99955, 0.9997, md) * 2.5 + pow(md, 80.0) * 0.08) * night * (1.0 - overcast * 0.7);
  }
  // clouds
  if (h > 0.0 && clouds > 0.01) {
    vec2 uv = d.xz / (d.y + 0.08) * 0.9 + vec2(time * 0.004, time * 0.002);
    float n = fbm(uv * 1.6);
    float cov = smoothstep(1.0 - clouds, 1.0 - clouds + 0.35, n);
    vec3 lit = mix(horizon * 0.9 + vec3(0.06), sunColor * 0.9 + zenith * 0.3, clamp(sunDir.y * 2.0 + 0.3, 0.0, 1.0));
    lit = mix(lit, vec3(0.04, 0.035, 0.03) + glow * glowAmt * 0.25, night);
    col = mix(col, lit * (0.75 + 0.35 * (1.0 - n)), cov * smoothstep(0.0, 0.15, h) * 0.92);
  }
  col = mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))) * 0.85, overcast * 0.6);
  gl_FragColor = vec4(col * exposureBoost, 1.0);
}`;

export class Environment {
  /** @param o { scene, renderer (THREE.WebGLRenderer), settings: env def from map } */
  constructor(scene, renderer, envDef = {}) {
    this.scene = scene;
    this.three = renderer;
    this.def = { time: 21, timeScale: 0, weather: 'clear', fogDensity: 0.0009, cityGlow: 0.35, glowColor: '#c8926a', clouds: 0.35, ...envDef };
    this.time = this.def.time;
    this.weather = this.def.weather;
    this.wetness = this.weather === 'rain' ? 0.9 : 0;
    this.rainAmount = this.weather === 'rain' ? 1 : 0;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;
    this.wettable = [];
    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color(0x0c0b0a) }, sunDir: { value: this.sunDir }, moonDir: { value: this.moonDir },
        sunColor: { value: new THREE.Color() }, night: { value: 0 }, clouds: { value: this.def.clouds }, time: { value: 0 }, glow: { value: new THREE.Color(this.def.glowColor) },
        glowAmt: { value: this.def.cityGlow }, overcast: { value: 0 }, exposureBoost: { value: 1 },
      },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.skyMat);
    this.sky.name = 'sky';
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.sky.scale.setScalar(1000);
    scene.add(this.sky);
    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.name = 'sun';
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xaaccff, 0x443322, 0.6);
    scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0x101010, this.def.fogDensity);
    scene.fog = this.fog;
    // env map
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(this.sky.geometry, this.skyMat);
    this.envSky.scale.setScalar(100);
    this.envScene.add(this.envSky);
    this.envRT = null;
    this._envTime = -99; this._envWeather = '';
    this.cube = null; this._cubeFrame = 0;
    this.rain = null;
    this.update(0, null);
  }

  /** Quality-dependent setup: shadows, reflections, rain density. */
  applyQuality(q, renderer) {
    const sh = SHADOW_OPTIONS[q.shadows];
    this.shadowCfg = sh && !sh.blob ? sh : null;
    this.sun.castShadow = !!this.shadowCfg;
    if (this.shadowCfg) {
      const s = this.sun.shadow;
      if (s.map) { s.map.dispose(); s.map = null; }
      s.mapSize.set(sh.size, sh.size);
      const d = sh.distance / 2;
      Object.assign(s.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: sh.distance * 3 });
      s.camera.updateProjectionMatrix();
      s.bias = -0.0004; s.normalBias = 0.035; s.radius = sh.radius;
    }
    renderer.shadowMap.enabled = !!this.shadowCfg;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // car reflections
    const rf = REFLECTION_OPTIONS[q.carReflections];
    if (this.cube) { this.cube.renderTarget.dispose(); this.scene.remove(this.cube); this.cube = null; }
    this.reflCfg = rf;
    if (rf && rf.cube > 0) {
      const rt = new THREE.WebGLCubeRenderTarget(rf.cube, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      this.cube = new THREE.CubeCamera(0.5, Math.min(800, q.drawDistance), rt);
      this.scene.add(this.cube);
    }
    this.scene.environment = rf ? (this.cube ? this.cube.renderTarget.texture : this.envRT?.texture || null) : null;
    this.q = q;
    this._envTime = -99; // force env refresh
    this.setupRain(q);
  }

  setupRain(q) {
    if (this.rain) { this.rain.geometry.dispose(); this.rain.material.dispose(); this.scene.remove(this.rain); this.rain = null; }
    const count = { off: 0, low: 3000, high: 9000 }[q?.weatherFx || 'low'] || 0;
    if (!count) return;
    const pos = new Float32Array(count * 6), seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60, r = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = r; seed[i * 2 + 1] = 1; // second vertex is the tail
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tail = new Float32Array(count * 2); for (let i = 0; i < count; i++) { tail[i * 2] = 0; tail[i * 2 + 1] = 1; }
    g.setAttribute('tail', new THREE.BufferAttribute(tail, 1));
    const rnd = new Float32Array(count * 2); for (let i = 0; i < count; i++) { const r = Math.random(); rnd[i * 2] = r; rnd[i * 2 + 1] = r; }
    g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, center: { value: new THREE.Vector3() }, vel: { value: new THREE.Vector3() }, amount: { value: 0 }, color: { value: new THREE.Color(0.75, 0.8, 0.85) } },
      vertexShader: /* glsl */`
        attribute float tail; attribute float rnd; uniform float time; uniform vec3 center; uniform vec3 vel; uniform float amount; varying float vA;
        void main(){
          vec3 p = position;
          float fall = 22.0 + rnd * 6.0;
          p.y = mod(p.y - time * fall + rnd * 30.0, 30.0) - 6.0;
          p.x = mod(p.x - center.x + 30.0, 60.0) - 30.0 + center.x;
          p.z = mod(p.z - center.z + 30.0, 60.0) - 30.0 + center.z;
          p.y += center.y;
          vec3 streak = vec3(0.0, fall, 0.0) + vel;
          p += streak * 0.028 * tail;
          vA = step(rnd, amount) * (0.35 + 0.4 * tail);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`uniform vec3 color; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(color, vA * 0.5); }`,
      transparent: true, depthWrite: false, fog: false,
    });
    this.rain = new THREE.LineSegments(g, m);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 10;
    this.scene.add(this.rain);
  }

  setTime(h) { this.time = ((h % 24) + 24) % 24; }
  setWeather(w) { this.weather = w; this.rainAmount = w === 'rain' ? 1 : 0; }
  /** Register materials that get darker and glossier when wet (roads, floors). */
  addWettable(mat) { if (mat && !this.wettable.includes(mat)) { this.wettable.push(mat); mat.userData.dry = { r: mat.roughness, c: mat.color.clone() }; } }

  /** @param focus Vector3 the player position (shadow camera + rain + cube camera follow it) */
  update(dt, focus, camera = null, opts = {}) {
    if (this.def.timeScale) this.setTime(this.time + (dt * this.def.timeScale) / 3600);
    const h = this.time;
    // sun path (Taiwan, ~23.5 N): rise ~6:00 in the east (+X), noon high in the south (+Z), set ~18:30 west
    const t = (h - 6.0) / 12.5;
    const el = Math.sin(Math.PI * t) * 72 * Math.PI / 180;
    const az = Math.PI / 2 - Math.PI * t;
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    const mt = ((h + 12.4) % 24 - 6) / 12.5;
    const mel = Math.sin(Math.PI * clamp01(mt)) * 55 * Math.PI / 180 + 0.05;
    const maz = Math.PI / 2 - Math.PI * clamp01(mt);
    this.moonDir.set(Math.sin(maz) * Math.cos(mel), Math.sin(mel), Math.cos(maz) * Math.cos(mel)).normalize();
    // keyframes
    let i = 0; while (i < KEYC.length - 2 && KEYC[i + 1][0] <= h) i++;
    const a = KEYC[i], b = KEYC[i + 1], f = clamp01((h - a[0]) / (b[0] - a[0]));
    const mix = (k) => a[k].clone().lerp(b[k], f);
    const overcast = this.weather === 'rain' ? 0.85 : this.weather === 'overcast' ? 0.65 : this.weather === 'fog' ? 0.5 : 0;
    const zen = mix(1), hor = mix(2), sunC = mix(3), hs = mix(5), hg = mix(6), fogC = mix(8);
    let sunI = lerp(a[4], b[4], f), hemiI = lerp(a[7], b[7], f);
    this.night = 1 - smoothstep(-0.12, 0.06, this.sunDir.y);
    const u = this.skyMat.uniforms;
    u.zenith.value.copy(zen); u.horizon.value.copy(hor); u.sunColor.value.copy(sunC); u.night.value = this.night;
    u.overcast.value = overcast; u.clouds.value = clamp01(this.def.clouds + overcast * 0.7); u.time.value += dt;
    u.ground.value.copy(hg).multiplyScalar(0.6);
    // lights: sun by day, moon by night
    const useMoon = this.sunDir.y < 0.02;
    const L = useMoon ? this.moonDir : this.sunDir;
    if (useMoon) { sunI = 0.2 * (1 - overcast * 0.6); sunC.set(0x9fb4d6); }
    this.sun.color.copy(sunC);
    this.sun.intensity = sunI * (1 - overcast * 0.75);
    this.hemi.color.copy(hs); this.hemi.groundColor.copy(hg);
    this.hemi.intensity = hemiI * (1 + overcast * 0.3);
    // fog
    const far = camera?.far || 2000;
    const weatherFog = this.weather === 'fog' ? 0.006 : this.weather === 'rain' ? 0.0025 : 0;
    this.fog.color.copy(fogC).lerp(new THREE.Color(0x6c7076).multiplyScalar(1 - this.night * 0.85), overcast * 0.5);
    this.fog.density = Math.max(this.def.fogDensity + weatherFog, 1.7 / far);
    // follow focus
    if (focus) {
      this.sky.position.copy(camera ? camera.position : focus);
      this.sky.scale.setScalar(Math.max(10, (camera?.far || 1000) * 0.9));
      if (this.shadowCfg) {
        const d = this.shadowCfg.distance;
        // snap to texels to avoid shimmering
        const texel = d / this.shadowCfg.size;
        const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
        this.sun.target.position.set(fx, focus.y, fz);
        this.sun.position.set(fx + L.x * d * 1.2, focus.y + Math.max(0.15, L.y) * d * 1.2, fz + L.z * d * 1.2);
        this.sun.target.updateMatrixWorld();
      } else {
        this.sun.position.copy(L).multiplyScalar(100).add(focus);
        this.sun.target.position.copy(focus);
      }
    }
    // wetness follows rain slowly
    const targetWet = this.weather === 'rain' ? 1 : 0;
    this.wetness += (targetWet - this.wetness) * Math.min(1, dt / (targetWet > this.wetness ? 40 : 120));
    if (opts.instantWet) this.wetness = targetWet;
    for (const m of this.wettable) {
      const dry = m.userData.dry;
      m.roughness = lerp(dry.r, 0.18, this.wetness * 0.9);
      m.color.copy(dry.c).multiplyScalar(1 - this.wetness * 0.38);
    }
    // rain
    if (this.rain) {
      const ru = this.rain.material.uniforms;
      ru.time.value += dt; ru.amount.value = this.rainAmount;
      if (camera) ru.center.value.copy(camera.position);
      if (opts.vel) ru.vel.value.copy(opts.vel).multiplyScalar(-1);
      ru.color.value.setRGB(0.75, 0.8, 0.85).multiplyScalar(0.35 + 0.65 * (1 - this.night));
      this.rain.visible = this.rainAmount > 0.01;
    }
    // static sky reflections (refresh when the sky changed noticeably)
    if (this.reflCfg && (Math.abs(this._envTime - h) > 0.2 || this._envWeather !== this.weather)) this.refreshEnvMap();
  }

  refreshEnvMap() {
    this._envTime = this.time; this._envWeather = this.weather;
    this.envSky.position.set(0, 0, 0);
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
    if (!this.cube) this.scene.environment = this.envRT.texture;
    old?.dispose();
  }

  /** Dynamic car reflections: render the world around `pos` into a cube map (hides `hide` objects). */
  updateCube(renderer, pos, hide = []) {
    if (!this.cube || !this.reflCfg) return;
    if (++this._cubeFrame % this.reflCfg.every !== 0) return;
    for (const o of hide) o.visible = false;
    const rainVis = this.rain?.visible; if (this.rain) this.rain.visible = false;
    this.cube.position.copy(pos);
    this.cube.update(renderer, this.scene);
    for (const o of hide) o.visible = true;
    if (this.rain) this.rain.visible = rainVis;
  }

  /** Sun info for god rays (screen position + strength). */
  sunScreen(camera, out = { uv: new THREE.Vector2(), intensity: 0, color: new THREE.Color() }) {
    const L = this.sunDir.y > 0.02 ? this.sunDir : this.moonDir;
    const p = L.clone().multiplyScalar(1000).add(camera.position).project(camera);
    out.uv.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const facing = camera.getWorldDirection(new THREE.Vector3()).dot(L);
    const onScreen = p.z < 1 && Math.abs(p.x) < 1.4 && Math.abs(p.y) < 1.4;
    const overcast = this.skyMat.uniforms.overcast.value;
    out.intensity = onScreen && facing > 0 ? smoothstep(0, 0.5, facing) * (this.sunDir.y > 0.02 ? 0.5 : 0.18) * (1 - overcast) * smoothstep(-0.02, 0.15, L.y) : 0;
    out.color.copy(this.sun.color);
    return out;
  }

  dispose() {
    this.scene.remove(this.sky, this.sun, this.sun.target, this.hemi);
    if (this.rain) this.scene.remove(this.rain);
    this.envRT?.dispose(); this.pmrem.dispose(); this.cube?.renderTarget.dispose();
    this.skyMat.dispose();
  }
}
