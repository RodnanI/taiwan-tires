// Runtime vehicle = physics + visual model + lights + gauges. One per car on track (player, AI, ghost, menu).
// The session drives physics in fixed steps; update() syncs visuals every rendered frame.
import * as THREE from 'three';
import { VehiclePhysics } from '../physics/VehiclePhysics.js';
import { buildWorkingSpec, specToParams } from './VehicleSpec.js';
import { createVehicleKit, finalizeKit } from './kit/index.js';
import { DEG } from '../core/math.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _off = new THREE.Vector3();

export class Vehicle {
  /**
   * @param o.def      normalized vehicle definition (registry)
   * @param o.config   garage entry { parts, tune, visual } (or a partial)
   * @param o.world    CollisionWorld (null = no physics ground, e.g. menu showroom)
   * @param o.M        MaterialFactory
   * @param o.interior build the cabin interior (player / menu only)
   */
  constructor({ def, config = {}, world = null, M, interior = true, isPlayer = false, accent = '#ff9a2e', detail = 1, name = '' }) {
    this.def = def;
    this.M = M;
    this.isPlayer = isPlayer;
    this.withInterior = interior;
    this.accent = accent;
    this.detail = detail;
    this.name = name || def.name;
    this.config = { parts: {}, tune: null, visual: { paint: { ...def.visual.paint }, mods: {} }, ...structuredClone(config) };
    this.spec = buildWorkingSpec(def, this.config.parts, this.config.tune);
    this.params = specToParams(this.spec);
    this.physics = new VehiclePhysics(this.params, world);
    this.root = new THREE.Group();
    this.root.name = `vehicle:${def.id}`;
    this.modelRoot = new THREE.Group();
    this.root.add(this.modelRoot);
    this.headlightsOn = false;
    this.lightsAuto = true;
    this.visible = true;
    this.spot = null;
    this.buildModel();
  }

  // ------------------------------------------------------------------------------------- model
  buildModel() {
    this.disposeModel();
    const visual = this.config.visual || {};
    const kit = createVehicleKit({ M: this.M, spec: this.spec, visual, detail: this.detail, accent: this.accent });
    // every visual slot resolves to a concrete option (first option = factory default)
    const mods = {};
    for (const [slot, def] of Object.entries(this.def.visual.slots || {})) mods[slot] = def.options[0]?.id;
    Object.assign(mods, visual.mods || {});
    const ctx = { THREE, kit, spec: this.spec, visual: { paint: visual.paint || this.def.visual.paint, mods }, parts: this.config.parts || {}, interior: this.withInterior, detail: this.detail, accent: this.accent };
    const body = new THREE.Group();
    body.name = 'body';
    let ret = null;
    try {
      ret = this.def.model.build(ctx) || {};
      if (ret.body) body.add(ret.body);
      else if (ret.isObject3D) body.add(ret);
    } catch (e) {
      console.error(`[vehicle ${this.def.id}] model.build failed, using fallback box`, e);
      const [L, W, H] = this.spec.dimensions;
      body.add(new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.7, L), kit.paint).translateY(H * 0.45));
      ret = {};
    }
    this.modelRoot.add(body);
    this.paint = kit.paint;
    // wheels
    const wheelsIn = Array.isArray(ret.wheels) && ret.wheels.length === 4 ? ret.wheels : null;
    const rimStyle = ctx.visual.mods?.rims || kit._wheelOverride?.style || 'spoke5';
    this.wheelObjs = [];
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const c = this.params.wheels[i];
      let w = wheelsIn?.[i];
      if (!w) {
        const o = { radius: c.radius, width: c.width / 1000, rimRadius: c.radius * (kit._wheelOverride?.rimRatio ?? 0.66), style: rimStyle, color: visual.rimColor ?? kit._wheelOverride?.color, caliperColor: kit._wheelOverride?.caliperColor, ...(kit._wheelOverride || {}) };
        o.style = rimStyle;
        o.front = front;
        o.compound = this.spec.tires?.compound;
        if (o.brake == null) o.brake = { street: 1, sport: 2, race: 3 }[this.config.parts?.brakes] ?? 0;
        o.width = c.width / 1000 * (kit._wheelOverride?.widthScale ?? 1);
        w = kit.buildWheel(o);
      }
      const holder = new THREE.Group();
      holder.name = `wheel${i}`;
      const steer = new THREE.Group();
      holder.add(steer);
      if (w.hub) steer.add(w.hub);
      steer.add(w.spin);
      if (i % 2 === 1) holder.scale.x = -1; // right side: outer face to -X
      this.modelRoot.add(holder);
      w.spin.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.wheelObjs.push({ holder, steer, spin: w.spin, front });
    }
    const fin = finalizeKit(kit, this.modelRoot, ret);
    this.anchors = fin.anchors;
    this.lightMats = fin.lights;
    this.gauges = fin.gauges;
    this.steeringObj = fin.steering?.object || null;
    this.screen = fin.anchors.screen || null;
    // optional per-frame hook from the model (pop-up lamps, wipers, active aero): animate(dt, state)
    this.animateFn = typeof ret.animate === 'function' ? ret.animate : null;
    this._animNow = 0;
    this.modelRoot.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
    this.root.updateMatrixWorld(true);
  }
  disposeModel() {
    if (!this.modelRoot) return;
    this.modelRoot.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m && !m.userData?.shared && this.M && ![...this.M.cache.values()].includes(m)) m.dispose?.();
      }
    });
    this.modelRoot.clear();
  }

  /** New parts/tune/visual config. Rebuilds physics params (keeping motion) and the model if visuals changed. */
  applyConfig(config, { rebuildModel = true } = {}) {
    const prevVisual = JSON.stringify(this.config.visual?.mods || {}) + JSON.stringify(this.config.parts || {});
    this.config = { ...this.config, ...structuredClone(config) };
    this.spec = buildWorkingSpec(this.def, this.config.parts, this.config.tune);
    this.params = specToParams(this.spec);
    this.physics.setParams(this.params);
    const nowVisual = JSON.stringify(this.config.visual?.mods || {}) + JSON.stringify(this.config.parts || {});
    if (rebuildModel && prevVisual !== nowVisual) this.buildModel();
    else if (this.config.visual?.paint) this.setPaint(this.config.visual.paint.color, this.config.visual.paint.finish);
  }
  setPaint(color, finish) {
    if (this.paint) this.M.setPaint(this.paint, color, finish);
    this.config.visual = { ...(this.config.visual || {}), paint: { color, finish } };
  }

  /** Optional spot lights for the player's headlights (count limited by quality). */
  enableHeadlightLights(on, scene, castShadow = false) {
    if (!on) { if (this.spot) { this.spot.forEach((s) => { s.parent?.remove(s); s.target.parent?.remove(s.target); s.dispose?.(); }); this.spot = null; } return; }
    if (this.spot) return;
    const hl = this.anchors.headlights?.length ? this.anchors.headlights : [[0.6, 0.7, this.spec.dimensions[0] / 2], [-0.6, 0.7, this.spec.dimensions[0] / 2]];
    // one light per side pair (centre) keeps the light count low
    const cx = 0, cy = hl.reduce((a, h) => a + h[1], 0) / hl.length, cz = hl.reduce((a, h) => a + h[2], 0) / hl.length;
    const s = new THREE.SpotLight(0xfff1dc, 0, 90, 0.52, 0.55, 1.4);
    s.position.set(cx, cy, cz + 0.1);
    s.target.position.set(0, -0.6, cz + 25);
    s.castShadow = castShadow;
    if (castShadow) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0005; s.shadow.camera.near = 0.5; s.shadow.camera.far = 60; }
    this.modelRoot.add(s, s.target);
    this.spot = [s];
  }

  // ------------------------------------------------------------------------------------- frame
  /**
   * Sync visuals to physics.
   * @param alpha interpolation factor between the last two physics states
   * @param o { now, units, cockpitVisible, night }
   */
  update(alpha, o = {}) {
    const ph = this.physics, p = this.params;
    ph.getInterpolated(alpha, _p, _q);
    // model origin = CG - (0, cgHeight, cgZ) in body space
    _off.set(0, -p.cgHeight, -p.cgZ).applyQuaternion(_q);
    this.root.position.copy(_p).add(_off);
    this.root.quaternion.copy(_q);
    // wheels
    for (let i = 0; i < 4; i++) {
      const w = ph.wheels[i], c = p.wheels[i], obj = this.wheelObjs[i];
      const y = c.radius + c.bumpTravel - Math.max(-0.02, w.travel);
      obj.holder.position.set(c.x, y, c.z);
      obj.steer.rotation.y = i % 2 === 1 ? -w.steer : w.steer;
      obj.steer.rotation.z = -w.camber * DEG * 0.6; // mirrored holders make this symmetric
      obj.spin.rotation.x = w.spin;
    }
    // steering wheel
    if (this.steeringObj) {
      const avg = (ph.wheels[0].steer + ph.wheels[1].steer) / 2;
      this.steeringObj.rotation.z = Math.max(-8, Math.min(8, avg * p.steering.ratio));
    }
    // lights
    const t = ph.tel;
    const night = !!o.night;
    if (this.lightsAuto) this.headlightsOn = night;
    const head = this.headlightsOn ? 5 : 0.04;
    const brake = t.brake > 0.05 || ph.controls.handbrake > 0.5 ? 6 : this.headlightsOn ? 1.6 : 0.3;
    const rev = ph.gearbox.gear === -1 ? 4 : 0.02;
    for (const m of this.lightMats.head) m.emissiveIntensity = head;
    for (const m of this.lightMats.drl || []) m.emissiveIntensity = 2;
    for (const m of this.lightMats.brake) m.emissiveIntensity = brake;
    for (const m of this.lightMats.reverse) m.emissiveIntensity = rev;
    if (this.spot) this.spot[0].intensity = this.headlightsOn ? 2600 : 0;
    if (this.animateFn) {
      const now = o.now || performance.now();
      const dt = this._animNow ? Math.min(0.1, Math.max(0, (now - this._animNow) / 1000)) : 1;
      this._animNow = now;
      this.animateFn(dt, { lights: this.headlightsOn, brake: t.brake, reverse: ph.gearbox.gear === -1, speed: t.speed, steer: ph.controls.steer, throttle: ph.controls.throttle, rpm: ph.engine.rpm, night });
    }
    // gauges (only when somebody can see them)
    if (o.cockpitVisible && this.gauges.length) {
      const tel = { rpm: ph.engine.rpm, speed: t.speed, gear: ph.gearbox.gear, boost: ph.engine.boost, boostMax: p.engine.boost?.max || 0 };
      for (const g of this.gauges) g.update(tel, o.now || performance.now(), o.units);
    }
  }

  dispose() {
    this.enableHeadlightLights(false);
    this.disposeModel();
    this.root.parent?.remove(this.root);
  }
}
