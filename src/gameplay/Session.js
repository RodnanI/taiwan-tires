// A Session = one loaded map + cars + a mode. Owns the scene graph for driving and runs the fixed-step
// simulation (player input, AI, physics, collisions, scoring, rewind) and per-frame visuals (effects, camera).
import * as THREE from 'three';
import { loadMap } from '../maps/MapLoader.js';
import { Environment } from '../render/Environment.js';
import { LightManager } from '../render/LightManager.js';
import { Particles } from '../render/Particles.js';
import { SkidMarks } from '../render/SkidMarks.js';
import { MaterialFactory } from '../render/materials.js';
import { Vehicle } from '../vehicles/Vehicle.js';
import { collideCars } from '../physics/VehiclePhysics.js';
import { surfaceById } from '../physics/Surfaces.js';
import { CameraRig } from '../camera/CameraRig.js';
import { MODES } from './modes.js';
import { AIDriver, DIFFICULTY, AI_NAMES } from '../ai/AIDriver.js';
import { pickOpponents } from '../ai/opponents.js';
import { RacingLineView } from '../render/RacingLineView.js';
import { clamp, rng, DEG } from '../core/math.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

export class Session {
  /**
   * @param game Game
   * @param o { mapId, eventId (null = free roam), car (profile garage entry), time, weather, aiCount, laps }
   */
  constructor(game, o) {
    this.game = game;
    this.opts = o;
    this.scene = new THREE.Scene();
    this.scene.name = 'session';
    this.vehicles = [];
    this.ai = [];
    this.paused = false;
    this.rewinding = false;
    this.history = [];
    this.histT = 0;
    this.finished = false;
    this.ghost = null;
    this.inputLatch = { shiftUp: false, shiftDown: false };
    this.flipT = 0;
  }

  async load(onProgress = () => {}) {
    const g = this.game;
    const q = g.settings.gfx();
    this.q = q;
    const def = g.registry.map(this.opts.mapId);
    if (!def) throw new Error(`unknown map ${this.opts.mapId}`);
    this.mapDef = def;
    this.event = this.opts.eventId ? def.events.find((e) => e.id === this.opts.eventId) || null : null;
    const envDef = { ...def.environment };
    if (this.opts.time != null) envDef.time = this.opts.time;
    if (this.opts.weather) envDef.weather = this.opts.weather;
    if (this.event?.time != null && this.opts.time == null) envDef.time = this.event.time;
    this.env = new Environment(this.scene, g.renderer.three, envDef);
    this.env.applyQuality(q, g.renderer.three);
    this.lights = new LightManager(this.scene);
    this.lights.setPoolSize(q.dynamicLights);
    this.M = new MaterialFactory({ materials: q.materials, textures: q.textures });
    this.map = await loadMap(def, { M: this.M, lights: this.lights, env: this.env, quality: q, onProgress: (p, l) => onProgress(p * 0.8, l) });
    this.scene.add(this.map.root);
    this.particles = new Particles(this.scene);
    this.particles.setBudget(q.particles);
    this.skids = new SkidMarks(this.scene, q.skidmarks);
    this.rig = new CameraRig(g.settings);
    this.rig.setFar(q.drawDistance);
    this.rig.setAspect(g.renderer.width / g.renderer.height);
    this.lineView = new RacingLineView(this.scene, this.M);
    onProgress(0.85, 'Cars');
    // player
    const car = this.opts.car;
    const pdef = g.registry.vehicle(car.vehicleId);
    this.player = new Vehicle({ def: pdef, config: car, world: this.map.world, M: this.M, interior: true, isPlayer: true, accent: g.accentHex(), detail: q.detail });
    this.player.driverName = 'YOU';
    this.applyAssists(this.player.physics);
    this.addVehicle(this.player);
    this.player.enableHeadlightLights(q.dynamicLights > 0, this.scene, q.shadows === 'insane' || q.shadows === 'extreme');
    await this.startMode(this.event ? { ...this.event, laps: this.opts.laps ?? this.event.laps } : null);
    onProgress(1, 'Ready');
    this.game.renderer.refreshMaterials(this.scene);
  }

  applyAssists(ph) {
    const s = this.game.settings;
    const tr = s.get('controls.transmission');
    ph.assists.abs = s.get('assist.abs');
    ph.assists.tcs = { off: 0, low: 1, high: 2 }[s.get('assist.tcs')] || 0;
    ph.assists.esc = { off: 0, low: 1, high: 2 }[s.get('assist.stability')] || 0;
    ph.assists.autoShift = tr === 'auto';
    ph.assists.autoClutch = tr !== 'manualClutch';
    ph.assists.revMatch = s.get('assist.revMatch');
    ph.assists.handbrakeClutch = s.get('assist.handbrakeClutch');
    ph.assists.autoReverse = true;
  }

  addVehicle(v) { this.vehicles.push(v); this.scene.add(v.root); this.game.audio?.attachVehicle(v, v === this.player); }
  removeVehicle(v) { this.vehicles = this.vehicles.filter((x) => x !== v); this.game.audio?.detachVehicle(v); v.dispose(); }

  /** Switch to an event (or free roam with null) without reloading the map. */
  async startMode(event) {
    this.mode?.dispose();
    for (const a of this.ai) this.removeVehicle(a.v);
    this.ai = [];
    if (this.ghost) { this.scene.remove(this.ghost.mesh); this.ghost = null; }
    this.event = event;
    this.finished = false;
    this.history = [];
    this.skids.clear(); this.particles.clear();
    const g = this.game;
    this.route = event ? this.map.routeFor(event) : null;
    this.recordKey = event ? `${this.mapDef.id}/${event.id}/${this.player.def.id}` : null;
    const Mode = MODES[event ? event.type : 'freeroam'];
    this.mode = new Mode(this, event);
    const ph = this.player.physics;
    if (event && this.route) {
      // grid
      const count = 1 + (event.type === 'circuit' || event.type === 'sprint' || event.type === 'touge' ? clamp(this.opts.aiCount ?? event.ai, 0, 11) : 0);
      const s0 = this.route.closed ? 0 : 12 + Math.ceil(count / 2) * 9;
      const slots = this.route.grid(count, s0);
      const pSlot = slots[count - 1 - Math.min(count - 1, Math.floor(count * 0.6))] || slots[0];
      const playerIndex = slots.indexOf(pSlot);
      ph.reset(pSlot.x, pSlot.y, pSlot.z, pSlot.heading, 0);
      // opponents
      if (count > 1) {
        const configs = pickOpponents(g.registry, this.player, count - 1, rng(Date.now() & 0xffff));
        const diff = DIFFICULTY[this.opts.difficulty || g.settings.get('gameplay.difficulty')] ?? 0.92;
        let k = 0;
        for (let i = 0; i < slots.length; i++) {
          if (i === playerIndex) continue;
          const c = configs[k];
          const v = new Vehicle({ def: c.def, config: c.config, world: this.map.world, M: this.M, interior: false, accent: g.accentHex(), detail: Math.min(0.7, this.q.detail) });
          v.physics.powerScale = c.powerScale ?? 1;
          v.driverName = AI_NAMES[k % AI_NAMES.length];
          v.physics.reset(slots[i].x, slots[i].y, slots[i].z, slots[i].heading, 0);
          const skill = clamp(diff + (k % 3 - 1) * 0.015 + (Math.random() - 0.5) * 0.02, 0.6, 1.02);
          const d = new AIDriver(v, this.route, { skill, aggression: Math.random(), seed: 100 + k, name: v.driverName });
          this.ai.push({ v, d });
          this.addVehicle(v);
          k++;
        }
      }
      if (event.type === 'timeattack') this.loadGhost();
      // collisions off at the start?
      const col = g.settings.get('gameplay.collisions');
      for (const v of this.vehicles) v.physics.ghost = col === 'off';
      this.ghostUntil = col === 'ghostStart' ? 10 : 0;
    } else {
      const sp = this.opts.spawn || this.map.spawn;
      ph.reset(sp.x, sp.y, sp.z, sp.heading, 0);
    }
    this.mode.start();
    this.lineView.setRoute(this.route || null, this.player);
    this.rig.reset();
    this.game.renderer.post?.resetHistory();
    this.game.events.emit('session:mode', { event, route: this.route });
  }

  loadGhost() {
    const data = this.game.profile.loadGhost(this.recordKey);
    if (!data?.frames?.length) return;
    const v = new Vehicle({ def: this.player.def, config: this.opts.car, world: null, M: this.M, interior: false, detail: 0.5 });
    v.root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; o.castShadow = false; } });
    this.scene.add(v.root);
    this.ghost = { v, mesh: v.root, frames: data.frames, i: 0 };
  }
  saveGhost(frames) {
    if (!this.recordKey || frames.length < 10) return;
    this.game.profile.saveGhost(this.recordKey, { frames, car: this.player.def.id, at: Date.now() });
  }

  /** Called by modes when the player finishes. */
  finishEvent(results) {
    if (this.finished) return;
    this.finished = true;
    const p = this.game.profile;
    if (results.reward) p.addCredits(results.reward, 'event');
    p.stat('events', 1);
    if (results.kind === 'race') { p.stat('races', 1); if (results.position === 1) p.stat('wins', 1); if (results.position <= 3) p.stat('podiums', 1); }
    results.improved = p.record(this.recordKey || `${this.mapDef.id}/${results.event.id}`, { time: results.kind === 'drift' ? null : results.total, lap: results.bestLap ?? null, score: results.kind === 'drift' ? results.score : null });
    this.game.events.emit('session:finished', results);
  }

  // ------------------------------------------------------------------------------------ fixed step
  fixedUpdate(dt) {
    if (this.paused || this.rewinding) return;
    const g = this.game, inp = g.input, ph = this.player.physics, s = g.settings;
    const counting = this.mode.state === 'countdown';
    const done = this.finished;
    // ---- player controls
    const c = ph.controls;
    if (done && this.event) {
      // after the flag the car coasts to a halt on its own
      c.throttle = 0; c.brake = 0.4; c.steer *= 0.95; c.handbrake = 0; c.nitrous = false; c.hold = false;
    } else {
      c.throttle = inp.throttle;
      c.brake = counting ? 0 : inp.brake;
      c.hold = counting;
      c.handbrake = inp.analog.handbrake;
      c.clutch = counting ? 1 : s.get('controls.transmission') === 'manualClutch' ? inp.analog.clutch : 0;
      c.nitrous = inp.analog.nitrous > 0.5;
      // counter-steer assist (aim the front wheels along the slide when the player isn't steering hard)
      let st = inp.steerOut;
      const assist = s.get('assist.counterSteer') * (inp.device === 'keyboard' ? 1 : 0.55);
      const t = ph.tel;
      if (assist > 0 && t.speed > 5 && Math.abs(t.driftAngle) > 3 * DEG && t.fwdSpeed > 0) {
        const want = clamp(t.driftAngle / ph.p.steering.lock, -1, 1);
        st += (want - st) * assist * (1 - Math.min(1, Math.abs(inp.steerOut)) * 0.65) * 0.85;
      }
      c.steer = clamp(st, -1, 1);
      if (this.inputLatch.shiftUp) { ph.shift(1); this.inputLatch.shiftUp = false; }
      if (this.inputLatch.shiftDown) { ph.shift(-1); this.inputLatch.shiftDown = false; }
    }
    // ---- AI
    const racing = !counting && this.mode.state !== 'countdown';
    const rb = { off: 0, low: 0.025, high: 0.05 }[s.get('gameplay.rubberBand')] ?? 0;
    for (const a of this.ai) {
      if (rb && this.mode.trackers) {
        const lead = this.mode.trackers.get(a.v)?.total - this.mode.trackers.get(this.player)?.total;
        a.d.setSkill(a.d.baseSkill + clamp(-lead / 400, -1, 1) * rb);
      }
      a.d.update(dt, { others: this.vehicles, racing: racing && !(this.mode.trackers?.get(a.v)?.finished && false), rev: counting });
      if (a.d.needsReset) { this.resetToRoute(a.v, a.d.hint); a.d.needsReset = false; a.d.stuckT = 0; }
    }
    // ---- physics
    for (const v of this.vehicles) v.physics.step(dt);
    if (this.ghostUntil > 0) { this.ghostUntil -= dt; for (const v of this.vehicles) v.physics.ghost = this.ghostUntil > 0; }
    const n = this.vehicles.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) collideCars(this.vehicles[i].physics, this.vehicles[j].physics);
    // ---- rules
    this.mode.fixedUpdate(dt);
    // ---- safety resets
    const tel = ph.tel;
    if (tel.upright < 0.25) this.flipT += dt; else this.flipT = 0;
    if (this.flipT > 2.5 || ph.pos.y < this.map.waterLevel - 1.2 || ph.pos.y < this.map.world.killY) { this.flipT = 0; this.resetPlayer(); }
    // ---- rewind history (10 Hz, 15 s)
    this.histT += dt;
    if (this.histT >= 0.1 && s.get('gameplay.rewind')) {
      this.histT = 0;
      this.history.push({ v: this.vehicles.map((v) => v.physics.snapshot()), m: this.mode.snapshot(), ai: this.ai.map((a) => a.d.hint) });
      if (this.history.length > 150) this.history.shift();
    }
  }

  resetPlayer() { this.resetToRoute(this.player, -1); this.mode.drift?.fail('reset'); this.game.events.emit('player:reset'); }
  /** Put a car back on the road (route for events, nearest road in free roam). */
  resetToRoute(v, hint = -1) {
    const ph = v.physics;
    let x, y, z, h;
    if (this.route) {
      const p = this.route.project(ph.pos.x, ph.pos.z, hint);
      const i = this.route.idx(p.i + 2);
      x = this.route.x[i]; y = this.route.y[i]; z = this.route.z[i]; h = this.route.headingAt(i);
    } else {
      const r = this.map.nearestRoadPoint(ph.pos.x, ph.pos.z);
      if (r) { x = r.x; y = r.y; z = r.z; h = r.heading; if (Math.cos(h - Math.atan2(ph.fwd.x, ph.fwd.z)) < 0) h += Math.PI; }
      else { const sp = this.map.spawn; x = sp.x; y = sp.y; z = sp.z; h = sp.heading; }
    }
    ph.reset(x, y + 0.3, z, h, 0);
    if (v === this.player) { this.rig.reset(); this.game.renderer.post?.resetHistory(); }
  }

  // ------------------------------------------------------------------------------------ per frame
  update(dt, alpha) {
    const g = this.game, inp = g.input, ph = this.player.physics;
    // latched edge inputs for the fixed step
    if (!this.paused) {
      if (inp.pressed.shiftUp) this.inputLatch.shiftUp = true;
      if (inp.pressed.shiftDown) this.inputLatch.shiftDown = true;
      if (inp.pressed.camera) { const m = this.rig.next(); g.events.emit('hud:toast', { text: m.toUpperCase(), small: true }); }
      if (inp.pressed.reset && !this.finished) this.resetPlayer();
      if (inp.pressed.lights) { this.player.lightsAuto = false; this.player.headlightsOn = !this.player.headlightsOn; }
      if (inp.pressed.radio && g.audio?.radio) { const id = g.audio.radio.cycle(); g.events.emit('hud:toast', { text: `Radio: ${id}`, small: true }); }
      g.audio?.horn?.(inp.analog.horn > 0.5);
      this.rig.lookBack = inp.analog.lookBack > 0.5;
      // rewind (hold)
      const wantRewind = inp.analog.rewind > 0.5 && g.settings.get('gameplay.rewind') && this.history.length > 1 && !this.finished;
      if (wantRewind) {
        if (!this.rewinding) { this.rewinding = true; g.events.emit('rewind', { on: true }); }
        this._rwT = (this._rwT || 0) + dt;
        while (this._rwT > 0.05 && this.history.length > 1) {
          this._rwT -= 0.05;
          const snap = this.history.pop();
          this.vehicles.forEach((v, i) => snap.v[i] && v.physics.restore(snap.v[i]));
          this.mode.restore(snap.m);
          this.ai.forEach((a, i) => { a.d.hint = snap.ai[i] ?? -1; });
        }
      } else if (this.rewinding) { this.rewinding = false; this._rwT = 0; g.events.emit('rewind', { on: false }); }
    }
    const a = this.paused || this.rewinding ? 1 : alpha;
    const night = this.env.night;
    const now = performance.now();
    const cockpit = this.rig.mode === 'cockpit';
    for (const v of this.vehicles) v.update(a, { now, units: g.settings.get('display.units'), cockpitVisible: v === this.player && cockpit, night: night > 0.35 });
    // ghost playback
    if (this.ghost && this.mode.tracker) {
      const t = this.mode.time - this.mode.tracker.lapStart;
      const F = this.ghost.frames;
      while (this.ghost.i < F.length - 2 && F[this.ghost.i + 1][0] < t) this.ghost.i++;
      if (t < (this.ghost.lastT ?? 0)) this.ghost.i = 0;
      this.ghost.lastT = t;
      const f0 = F[this.ghost.i], f1 = F[Math.min(F.length - 1, this.ghost.i + 1)];
      const k = clamp((t - f0[0]) / Math.max(0.001, f1[0] - f0[0]), 0, 1);
      _v.set(f0[1], f0[2], f0[3]).lerp(_v2.set(f1[1], f1[2], f1[3]), k);
      _q.set(f0[4], f0[5], f0[6], f0[7]).slerp(new THREE.Quaternion(f1[4], f1[5], f1[6], f1[7]), k);
      const gv = this.ghost.v;
      gv.physics.pos.copy(_v); gv.physics.quat.copy(_q); gv.physics.prevPos.copy(_v); gv.physics.prevQuat.copy(_q);
      gv.update(1, { night: night > 0.35 });
      gv.root.visible = t > 0.2 && F.length > 10;
    }
    // camera
    this.rig.update(dt, this.player, this.map.world);
    const cam = this.rig.camera;
    // environment + lights + map animation
    this.env.update(this.paused ? 0 : dt, this.player.root.position, cam, { vel: ph.vel });
    this.lights.update(this.player.root.position, cam, night);
    this.map.update(dt, night, cam);
    this.env.updateCube(g.renderer.three, _v.copy(this.player.root.position).setY(this.player.root.position.y + 1.0), [this.player.root]);
    // wetness affects grip
    for (const v of this.vehicles) v.physics.wetness = this.env.wetness;
    // effects
    if (!this.paused) this.emitEffects(dt);
    this.particles.update(this.paused ? 0 : dt, this.env.hemi.color.clone().multiplyScalar(0.55 + this.env.hemi.intensity * 0.5).lerp(new THREE.Color(1, 1, 1), 0.25 * (1 - night)));
    this.lineView.update(this.player, g.settings.get('display.racingLine'));
    this.mode.update(dt);
    // audio + HUD
    g.audio?.updateSession(this, dt);
    g.hud?.update(this, dt);
  }

  emitEffects(dt) {
    const camPos = this.rig.camera.position;
    for (const v of this.vehicles) {
      const ph = v.physics;
      const far = ph.pos.distanceToSquared(camPos) > 160 * 160;
      if (!far) {
        const smokeColor = v.config.visual?.smoke || [0.92, 0.92, 0.92];
        for (let i = 0; i < 4; i++) {
          const w = ph.wheels[i];
          if (!w.contact) { this.skids.mark(`${v.root.id}:${i}`, w.cp, w.wl, w.n, 0, 0); continue; }
          const surf = surfaceById(w.surface);
          const slipV = Math.hypot(w.omega * w.c.radius - w.vx, w.vy);
          const strength = clamp((slipV - 2.2) / 9, 0, 1) * clamp(w.Fz / w.c.staticLoad, 0, 1.4);
          if (surf.skid) {
            this.skids.mark(`${v.root.id}:${i}`, w.cp, w.wl, w.n, w.c.width / 1000, strength * (0.6 + 0.4 * (1 - this.env.wetness)));
            if (strength > 0.05 && this.env.wetness < 0.6) this.particles.smoke(w.cp, ph.vel, strength, smokeColor, w.c.width / 1000);
            if (this.env.wetness > 0.3 && ph.tel.speed > 8) this.particles.spray(w.cp, ph.vel, this.env.wetness * Math.min(1, ph.tel.speed / 30));
          } else {
            this.skids.mark(`${v.root.id}:${i}`, w.cp, w.wl, w.n, 0, 0);
            if (surf.dust && ph.tel.speed > 3) this.particles.dust(w.cp, ph.vel, clamp(ph.tel.speed / 25 + strength, 0, 1), surf.dust);
          }
        }
        // backfire flames
        if (ph.fx.backfire > 0 && v.anchors.exhaust?.length) {
          for (const e of v.anchors.exhaust) {
            _v.set(e[0], e[1], e[2]).applyMatrix4(v.root.matrixWorld);
            _v2.set(0, 0, -1).applyQuaternion(v.root.quaternion);
            this.particles.flame(_v, _v2, 0.7 + ph.fx.backfire * 0.5);
          }
        }
      }
      // collisions: sparks, shake, drift fail
      for (const c of ph.fx.collisions) {
        if (c.kind !== 'ground' && c.impulse > 400) this.particles.sparks(_v.set(c.x, c.y, c.z), _v2.set(c.nx, 0, c.nz), clamp(c.impulse / 300, 3, 24), 4 + Math.min(8, c.impulse / 800));
        if (v === this.player) {
          this.rig.shake(clamp(c.impulse / 9000, 0, 0.7));
          this.game.input.rumble(clamp(c.impulse / 8000, 0, 1), 0.4, 160);
          if (c.impulse > 2500 && c.kind !== 'ground') this.mode.drift?.fail('crash');
        }
      }
      this.game.audio?.vehicleEvents(v, ph.fx);
      ph.fx.collisions.length = 0; ph.fx.backfire = 0; ph.fx.bov = 0; ph.fx.shift = 0; ph.fx.limiter = false;
    }
  }

  render(renderer) {
    const cam = this.rig.camera;
    const sun = this.env.sunScreen(cam);
    const speedK = this.rig.speedNorm;
    renderer.render(this.scene, cam, {
      speed: speedK, minDepth: this.rig.minDepth, wetness: this.env.wetness, dryGloss: 0.06 + this.env.night * 0.08, sun, time: this.map.time,
      mbScale: this.rewinding ? 0 : 1, fade: this.fade || 0,
    });
  }

  setPaused(p) { this.paused = p; }
  onResize(w, h) { this.rig.setAspect(w / h); }
  dispose() {
    this.mode?.dispose();
    for (const v of [...this.vehicles]) this.removeVehicle(v);
    if (this.ghost) this.ghost.v.dispose();
    this.particles.dispose(); this.skids.dispose(); this.lineView.dispose();
    this.lights.dispose(); this.env.dispose(); this.map.dispose();
    this.scene.clear();
  }
}
