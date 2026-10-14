// 3D scene behind the menus: your selected car on a rooftop car park above a Taiwanese city at night.
// Cockpit mode: the camera sits in the driver's seat looking at the car's real head-unit screen, and the
// UI is projection-mapped onto it. Showroom mode: the camera orbits outside; the UI docks to the side.
import * as THREE from 'three';
import { Environment } from '../render/Environment.js';
import { LightManager } from '../render/LightManager.js';
import { MaterialFactory } from '../render/materials.js';
import { createMapKit } from '../maps/kit/index.js';
import { CollisionWorld } from '../physics/World.js';
import { Vehicle } from '../vehicles/Vehicle.js';
import { buildWorkingSpec } from '../vehicles/VehicleSpec.js';
import { clamp, smoothstep } from '../core/math.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.02, 3000);
    this.cameraMode = 'cockpit';
    this.built = false;
    this.vehicle = null;
    this.previewKey = '';
    this.t = 0;
    this.trans = { t: 1, dur: 0.9, fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3() };
    this.look = new THREE.Vector3();
    this.orbit = { yaw: 2.4, pitch: 0.12, drag: false, vel: 0 };
    this.active = false;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const q = this.game.settings.gfx();
    this.q = q;
    this.scene = new THREE.Scene();
    this.env = new Environment(this.scene, this.game.renderer.three, { time: 21.7, weather: 'clear', fogDensity: 0.0005, cityGlow: 0.4, clouds: 0.35 });
    this.env.applyQuality(q, this.game.renderer.three);
    this.lights = new LightManager(this.scene);
    this.lights.setPoolSize(Math.min(8, q.dynamicLights));
    this.M = new MaterialFactory({ materials: q.materials, textures: q.textures });
    const root = new THREE.Group();
    this.scene.add(root);
    const world = new CollisionWorld();
    const kit = createMapKit({ root, world, M: this.M, lights: this.lights, env: this.env, quality: { ...q, detail: Math.min(1, q.detail) } });
    this.kit = kit;
    // rooftop deck
    const deck = new THREE.PlaneGeometry(60, 60); deck.rotateX(-Math.PI / 2);
    const deckMat = this.M.textured('concrete', { repeat: 1, roughness: 0.6, color: 0x77746f });
    const uv = deck.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 12);
    kit.addStatic(deck, deckMat, { cast: false, receive: true });
    this.env.addWettable(deckMat);
    const lineMat = this.M.surface({ color: 0xd9d4c6, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = -3; i <= 3; i++) { const g = new THREE.PlaneGeometry(0.14, 5.4); g.rotateX(-Math.PI / 2); g.translate(i * 3.1 + 1.55, 0.01, 0.5); kit.addStatic(g, lineMat, { cast: false }); }
    // parapet walls with light strips
    const wall = this.M.textured('concrete', { repeat: 1, color: 0x9a968e });
    for (const [x, z, w, d] of [[0, 30, 60, 0.4], [0, -30, 60, 0.4], [30, 0, 0.4, 60], [-30, 0, 0.4, 60]]) { const g = new THREE.BoxGeometry(w, 1.1, d); g.translate(x, 0.55, z); kit.addStatic(g, wall); }
    // light poles
    for (const [x, z] of [[-9, -8], [9, -8], [-9, 10], [9, 10]]) kit.props.streetLamp([x, 0, z], Math.atan2(-x, -z), { height: 7, arm: 1.2, intensity: 90, range: 22, color: 0xfff1d8 });
    // neighbouring buildings + the big vertical neon of the game itself
    kit.building({ x: -38, z: 42, w: 16, d: 14, rotY: 0.2, style: 'shophouse', floors: 9, y: -24 });
    kit.building({ x: 40, z: 46, w: 18, d: 16, rotY: -0.3, style: 'apartment', floors: 12, y: -24 });
    kit.building({ x: -6, z: 70, w: 22, d: 14, rotY: 0, style: 'office', floors: 14, y: -24 });
    this.neon(root, kit);
    kit.skyline({ center: [0, 0], radius: [120, 900], count: 120, height: [25, 140], seed: 3, y: -24 });
    kit.supertall({ pos: [180, -24, 620], height: 420, segments: 8, color: 0x5d7a74 });
    kit.finalize();
    this.map = { kit, update: (dt, night) => { for (const fn of kit.animated) fn(dt, this.t); for (const m of kit.nightMaterials) { const [d, n] = m.userData.nightEmissive || [0, 1]; m.emissiveIntensity = d + (n - d) * night; } if (kit.glowMesh) kit.glowMesh.material.uniforms.night.value = night; } };
    // showroom key lights
    const key = new THREE.SpotLight(0xfff0dc, 0, 30, 0.6, 0.6, 2); key.position.set(4, 7, 5); key.target.position.set(0, 0.5, 0);
    const rim = new THREE.SpotLight(0xffc89a, 0, 30, 0.7, 0.7, 2); rim.position.set(-5, 4, -6); rim.target.position.set(0, 0.6, 0);
    this.scene.add(key, key.target, rim, rim.target);
    this.keyLights = [key, rim];
  }

  neon(root, kit) {
    // a tall vertical sign: 台灣輪胎 (Taiwan Tires) on the building across the street
    const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0606'; g.fillRect(0, 0, 256, 1024);
    g.strokeStyle = '#ff3a26'; g.lineWidth = 10; g.strokeRect(14, 14, 228, 996);
    g.fillStyle = '#ffe9c0'; g.shadowColor = '#ff7a2e'; g.shadowBlur = 24; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 190px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    ['台', '灣', '輪', '胎'].forEach((ch, i) => g.fillText(ch, 128, 140 + i * 248));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.M.surface({ color: 0x050505, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.6 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 3.6), mat);
    sign.position.set(-27, 9, 36); sign.rotation.y = 0.35;
    root.add(sign);
    this.signMat = mat;
    kit.light({ pos: [-25, 6, 34], color: 0xff6a3a, intensity: 140, range: 30, nightOnly: false });
    kit.animate((dt, t) => { mat.emissiveIntensity = 2.4 + Math.sin(t * 2.1) * 0.08 + (Math.sin(t * 17) > 0.985 ? -1.6 : 0); });
  }

  applyQuality() {
    if (!this.built) return;
    const q = this.game.settings.gfx();
    this.env.applyQuality(q, this.game.renderer.three);
    this.lights.setPoolSize(Math.min(8, q.dynamicLights));
    this.game.renderer.refreshMaterials(this.scene);
  }
  enter() { this.build(); this.active = true; const car = this.game.profile.selectedCar(); this.preview({ def: this.game.registry.vehicle(car.vehicleId), config: car }); this.onResize(); }
  exit() { this.active = false; }

  /** Lightweight spec access for menus (no model build). */
  vehicleFor(car) {
    if (!car) return null;
    const def = this.game.registry.vehicle(car.vehicleId);
    if (!def) return null;
    return { def, spec: buildWorkingSpec(def, car.parts, car.tune), config: car };
  }

  /** Show a car (garage / dealer / paint). paintOnly avoids rebuilding the model. */
  preview({ def, config }, { paintOnly = false } = {}) {
    this.build();
    const key = `${def.id}|${JSON.stringify(config.parts || {})}|${JSON.stringify(config.visual?.mods || {})}|${config.uid || ''}`;
    if (this.vehicle && paintOnly && this.vehicle.def.id === def.id) { this.vehicle.setPaint(config.visual.paint.color, config.visual.paint.finish); this.vehicle.config.visual = structuredClone(config.visual); return; }
    if (this.vehicle && key === this.previewKey) { if (config.visual?.paint) this.vehicle.setPaint(config.visual.paint.color, config.visual.paint.finish); return; }
    this.previewKey = key;
    if (this.vehicle) { this.game.audio?.detachVehicle(this.vehicle); this.vehicle.dispose(); }
    const q = this.game.settings.gfx();
    this.vehicle = new Vehicle({ def, config, world: null, M: this.M, interior: true, accent: this.game.accentHex(), detail: q.detail });
    const ph = this.vehicle.physics;
    ph.pos.set(0, ph.p.cgHeight + ph.p.rideAvg, -0.4 + ph.p.cgZ);
    ph.prevPos.copy(ph.pos);
    this.vehicle.update(1, { night: true });
    this.vehicle.headlightsOn = true; this.vehicle.lightsAuto = false;
    this.scene.add(this.vehicle.root);
    this.vehicle.enableHeadlightLights(this.q.dynamicLights > 0, this.scene, false);
    this.addScreenGlow(this.vehicle);
    this.game.audio?.attachVehicle(this.vehicle, true, { menu: true });
    this.game.renderer.post?.resetHistory();
    if (this.cameraMode === 'cockpit') this.startTransition();
  }

  /** Light spill from the lit head unit onto the dash, wheel and console (the cabin is otherwise dark at night). */
  addScreenGlow(v) {
    const sc = v.screen;
    if (!sc || this.q.materials === 'basic') return;
    const tl = new THREE.Vector3(...sc.tl), tr = new THREE.Vector3(...sc.tr), bl = new THREE.Vector3(...sc.bl), br = new THREE.Vector3(...sc.br);
    const c = tl.clone().add(tr).add(bl).add(br).multiplyScalar(0.25);
    const n = tr.clone().sub(tl).cross(bl.clone().sub(tl)).normalize();
    if (n.z > 0) n.negate(); // face the cabin (rearwards)
    const glow = new THREE.PointLight(0xffc89a, 0.12, 2.2, 2);
    glow.position.copy(c).addScaledVector(n, 0.25);
    v.root.add(glow);
  }

  setCameraMode(mode) {
    if (mode === 'none') return;
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.startTransition();
  }
  startTransition() {
    this.trans.t = 0;
    this.trans.fromPos.copy(this.camera.position);
    this.trans.fromLook.copy(this.look);
    this.game.ui?.info?.animatePlacement(this.trans.dur * 1000);
  }

  // ---- camera poses
  cockpitPose(outPos, outLook) {
    const v = this.vehicle;
    if (!v?.screen) return false;
    const m = v.root.matrixWorld;
    const S = v.screen;
    const tl = _v.fromArray(S.tl).applyMatrix4(m), tr = _v2.fromArray(S.tr).applyMatrix4(m), bl = _v3.fromArray(S.bl).applyMatrix4(m);
    const C = new THREE.Vector3().addVectors(tr, bl).multiplyScalar(0.5);
    const right = new THREE.Vector3().subVectors(tr, tl), down = new THREE.Vector3().subVectors(bl, tl);
    const n = new THREE.Vector3().crossVectors(down, right).normalize();
    const eye = new THREE.Vector3().fromArray(v.anchors.cockpit || [0.37, 1.1, -0.3]).applyMatrix4(m);
    if (n.dot(_v.subVectors(eye, C)) < 0) n.negate();
    const aspect = this.camera.aspect;
    const vf = (this.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    // big enough to read: the head unit fills most of the view, the dash and windscreen frame it
    const fillW = aspect > 1.4 ? 0.8 : 0.9;
    const dW = (S.width / 2) / (Math.tan(hf / 2) * fillW), dH = (S.height / 2) / (Math.tan(vf / 2) * 0.84);
    const D = Math.max(dW, dH);
    const front = C.clone().addScaledVector(n, D);
    outPos.copy(front).lerp(eye, 0.03);
    outPos.y += 0.015;
    outLook.copy(C);
    return true;
  }
  showroomPose(outPos, outLook, dt = 0) {
    const v = this.vehicle;
    const L = v ? v.spec.dimensions[0] : 4.4;
    if (!this.orbit.drag) this.orbit.yaw += dt * 0.12 + this.orbit.vel * dt;
    this.orbit.vel *= Math.exp(-dt * 3);
    const p = this.game.ui?.info?.sideFrac || 0;                 // screen fraction covered by the docked head unit
    const dist = Math.max(5.2, L * (1.32 + p * 0.3));
    const c = v ? v.root.position : _v.set(0, 0, 0);
    // shift the camera sideways so the car is centred in the free part of the screen (NDC x = -p)
    const side = p * Math.tan(this.camera.fov * Math.PI / 360) * this.camera.aspect * dist;
    outLook.set(c.x, 0.7, c.z);
    outPos.set(c.x + Math.sin(this.orbit.yaw) * dist, 1.35 + this.orbit.pitch * dist, c.z + Math.cos(this.orbit.yaw) * dist);
    const rightV = _v.set(Math.cos(this.orbit.yaw), 0, -Math.sin(this.orbit.yaw));
    outPos.addScaledVector(rightV, side);
    outLook.addScaledVector(rightV, side);
    return true;
  }

  update(dt) {
    if (!this.built || !this.active) return;
    this.t += dt;
    const v = this.vehicle;
    if (v) { v.root.updateMatrixWorld(true); v.update(1, { now: performance.now(), units: this.game.settings.get('display.units'), cockpitVisible: this.cameraMode === 'cockpit', night: true }); }
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    let ok = this.cameraMode === 'cockpit' ? this.cockpitPose(pos, look) : this.showroomPose(pos, look, dt);
    if (!ok) this.showroomPose(pos, look, dt);
    // idle head sway in the cockpit
    if (this.cameraMode === 'cockpit') { pos.x += Math.sin(this.t * 0.6) * 0.004; pos.y += Math.sin(this.t * 0.9) * 0.003; }
    if (this.trans.t < 1) {
      this.trans.t = Math.min(1, this.trans.t + dt / this.trans.dur);
      const k = ease(this.trans.t);
      // swing outside the car when going cockpit <-> showroom
      const mid = new THREE.Vector3().lerpVectors(this.trans.fromPos, pos, k);
      mid.y += Math.sin(k * Math.PI) * 1.2;
      this.camera.position.copy(mid);
      this.look.lerpVectors(this.trans.fromLook, look, k);
    } else { this.camera.position.copy(pos); this.look.copy(look); }
    this.camera.near = this.cameraMode === 'cockpit' && this.trans.t >= 1 ? 0.01 : 0.05;
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.keyLights[0].intensity = this.cameraMode === 'showroom' ? 170 : 14;
    this.keyLights[1].intensity = this.cameraMode === 'showroom' ? 95 : 0;
    this.env.update(dt, _v.set(0, 0, 0), this.camera);
    this.lights.update(_v.set(0, 0, 0), this.camera, 1);
    this.map.update(dt, this.env.night);
    if (v) this.env.updateCube(this.game.renderer.three, _v.copy(v.root.position).setY(1), [v.root]);
  }

  /** Screen quad as it will be when the current camera transition ends. */
  finalQuad() {
    if (this.cameraMode !== 'cockpit') return null;
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    if (!this.cockpitPose(pos, look)) return null;
    const sp = this.camera.position.clone(), sq = this.camera.quaternion.clone();
    this.camera.position.copy(pos); this.camera.lookAt(look); this.camera.updateMatrixWorld();
    const q = this.screenQuad();
    this.camera.position.copy(sp); this.camera.quaternion.copy(sq); this.camera.updateMatrixWorld();
    return q;
  }

  /** Projected corners of the head-unit screen in CSS px, or null when it is not usable. */
  screenQuad() {
    const v = this.vehicle;
    if (!v?.screen || this.cameraMode !== 'cockpit') return null;
    const W = window.innerWidth, H = window.innerHeight;
    const m = v.root.matrixWorld;
    const out = [];
    for (const k of ['tl', 'tr', 'bl', 'br']) {
      const p = _v.fromArray(v.screen[k]).applyMatrix4(m);
      const vp = p.clone().applyMatrix4(this.camera.matrixWorldInverse);
      if (vp.z > -0.005) return null; // behind the camera
      p.project(this.camera);
      out.push([(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H]);
    }
    const w = Math.hypot(out[1][0] - out[0][0], out[1][1] - out[0][1]);
    if (w < Math.min(520, W * 0.45)) return null; // too small to read: caller falls back to flat
    return { tl: out[0], tr: out[1], bl: out[2], br: out[3] };
  }

  render(renderer) {
    if (!this.built || !this.active) { renderer.three.setRenderTarget(null); renderer.three.clear(); return; }
    // depth of field: the eye focuses on the head unit (cockpit) or on the car (showroom)
    const dof = { focus: this.camera.position.distanceTo(this.look), aperture: this.cameraMode === 'cockpit' ? 1.6 : 0.7, maxBlur: this.cameraMode === 'cockpit' ? 9 : 12 };
    renderer.render(this.scene, this.camera, { speed: 0, minDepth: 0.5, wetness: this.env.wetness, dryGloss: 0.18, sun: this.env.sunScreen(this.camera), time: this.t, mbScale: 0, dof });
  }
  onResize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }
  /** Drag to orbit in showroom mode. */
  bindDrag(el) {
    let lx = 0;
    el.addEventListener('pointerdown', (e) => { if (this.cameraMode !== 'showroom') return; this.orbit.drag = true; lx = e.clientX; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (!this.orbit.drag) return; const dx = e.clientX - lx; lx = e.clientX; this.orbit.yaw -= dx * 0.008; this.orbit.vel = -dx * 0.3; });
    el.addEventListener('pointerup', () => { this.orbit.drag = false; });
  }
}
export { clamp, smoothstep };
