// Game modes. A mode owns rules + scoring for a Session; the Session owns the world and the cars.
// Add a mode: subclass Mode, register it in MODES, give events in map.js that `type`.
import * as THREE from 'three';
import { RaceTracker } from './RaceTracker.js';
import { DriftScorer } from './DriftScorer.js';
import { fmtTime } from '../core/math.js';

export class Mode {
  constructor(session, event = null) { this.s = session; this.event = event; this.time = 0; this.state = 'running'; this.countdown = 0; }
  get usesCountdown() { return false; }
  start() {}
  fixedUpdate() {}
  update() {}
  hud() { return {}; }
  snapshot() { return { time: this.time }; }
  restore(o) { this.time = o.time; }
  dispose() {}
}

// ------------------------------------------------------------------------------------- free roam
export class FreeRoamMode extends Mode {
  start() {
    const s = this.s;
    this.drift = new DriftScorer(s.game.events, { owner: 'player' });
    this.beacons = [];
    this.prompt = null;
    // event start beacons
    for (const ev of s.map.def.events) {
      const route = s.map.routeFor(ev);
      if (!route) continue;
      const p = route.pointAt(route.closed ? 0 : 12);
      const beacon = makeBeacon(ev);
      beacon.position.set(p.x, p.y, p.z);
      s.scene.add(beacon);
      this.beacons.push({ ev, mesh: beacon, x: p.x, z: p.z });
    }
    this.offBank = s.game.events.on('drift:bank', (e) => {
      if (e.owner !== 'player') return;
      const credits = Math.round(e.points / 40);
      s.game.profile.addCredits(credits, 'drift');
      s.game.profile.stat('driftPoints', e.points);
      s.game.profile.statMax('bestDrift', e.points);
      const ph = s.player.physics;
      if (ph.p.nitrous) ph.engine.nitrous = Math.min(1, ph.engine.nitrous + e.points / 30000);
    });
  }
  fixedUpdate(dt) {
    this.time += dt;
    this.drift.update(dt, this.s.player.physics, this.s.map.world);
  }
  update(dt) {
    const ph = this.s.player.physics;
    this.prompt = null;
    for (const b of this.beacons) {
      b.mesh.rotation.y += dt * 0.6;
      const d = Math.hypot(ph.pos.x - b.x, ph.pos.z - b.z);
      b.mesh.material.opacity = 0.15 + 0.2 * Math.min(1, 60 / Math.max(d, 1));
      if (d < 12 && ph.tel.speed < 12) this.prompt = b.ev;
    }
  }
  hud() { return { drift: this.drift, prompt: this.prompt, freeRoam: true }; }
  snapshot() { return { time: this.time, d: this.drift.snapshot() }; }
  restore(o) { this.time = o.time; this.drift.restore(o.d); }
  dispose() { this.offBank?.(); for (const b of this.beacons) { this.s.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); } }
}

function makeBeacon(ev) {
  const color = { circuit: 0xffa531, sprint: 0xff6a3d, drift: 0xff3b6b, timeattack: 0x3dd6a0, touge: 0xffd84a }[ev.type] || 0xffa531;
  const g = new THREE.CylinderGeometry(6, 6, 60, 24, 1, true);
  g.translate(0, 30, 0);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 8;
  mesh.name = 'beacon';
  return mesh;
}

// ------------------------------------------------------------------------------------- race
export class RaceMode extends Mode {
  get usesCountdown() { return true; }
  start() {
    const s = this.s;
    this.route = s.route;
    this.trackers = new Map();
    for (const v of s.vehicles) this.trackers.set(v, new RaceTracker(this.route, { laps: this.event.laps }));
    this.countdown = 3.999;
    this.state = 'countdown';
    this.positions = [];
    this.results = null;
  }
  fixedUpdate(dt) {
    const s = this.s;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.state = 'running'; s.game.events.emit('race:go'); }
      return;
    }
    if (this.state === 'finished') { this.time += dt; this.post(dt); return; }
    this.time += dt;
    for (const v of s.vehicles) {
      const tr = this.trackers.get(v);
      const ph = v.physics;
      const ev = tr.update(ph.pos.x, ph.pos.z, ph.fwd, this.time);
      if (ev?.lap && v === s.player) s.game.events.emit('race:lap', { lap: tr.lap, time: ev.lapTime, best: tr.bestLap === ev.lapTime });
      if (ev?.finish && v === s.player) this.finish();
    }
    this.rank();
  }
  post(dt) { for (const v of this.s.vehicles) { const tr = this.trackers.get(v); if (!tr.finished) tr.update(v.physics.pos.x, v.physics.pos.z, v.physics.fwd, this.time); } this.rank(); }
  rank() {
    const list = [...this.trackers.entries()].map(([v, t]) => ({ v, t }));
    list.sort((a, b) => {
      if (a.t.finished && b.t.finished) return a.t.finishTime - b.t.finishTime;
      if (a.t.finished) return -1; if (b.t.finished) return 1;
      return b.t.total - a.t.total;
    });
    this.positions = list;
  }
  finish() {
    this.state = 'finished';
    const s = this.s;
    this.rank();
    const rows = this.positions.map(({ v, t }) => {
      let time = t.finishTime;
      if (!t.finished) {
        const rate = t.total / Math.max(1, this.time); // m/s
        time = this.time + (this.route.length * this.event.laps - t.total) / Math.max(5, rate);
      }
      return { name: v === s.player ? 'YOU' : v.driverName || v.name, car: v.def.name, time, best: t.bestLap, player: v === s.player };
    }).sort((a, b) => a.time - b.time);
    const pos = rows.findIndex((r) => r.player) + 1;
    const tr = this.trackers.get(s.player);
    const reward = this.event.rewards?.credits?.[pos - 1] ?? Math.round((this.event.rewards?.credits?.[2] || 10000) / (pos - 1));
    this.results = { kind: 'race', position: pos, of: rows.length, rows, reward, bestLap: tr.bestLap, total: tr.finishTime, event: this.event };
    s.finishEvent(this.results);
  }
  hud() {
    const s = this.s, tr = this.trackers.get(s.player);
    const pos = this.positions.findIndex((p) => p.v === s.player) + 1;
    return {
      race: true, countdown: this.state === 'countdown' ? this.countdown : null, position: pos || 1, of: s.vehicles.length,
      lap: Math.min(this.event.laps, tr.lap + 1), laps: this.event.laps, time: this.time, lapTime: this.time - tr.lapStart, bestLap: tr.bestLap,
      wrongWay: tr.wrongWay > 60, progress: tr.progress, sprint: !this.route.closed,
    };
  }
  snapshot() { return { time: this.time, st: this.state, cd: this.countdown, tr: [...this.trackers.values()].map((t) => t.snapshot()) }; }
  restore(o) { this.time = o.time; this.state = o.st === 'finished' ? 'running' : o.st; this.countdown = o.cd; [...this.trackers.values()].forEach((t, i) => t.restore(o.tr[i])); }
}

// ------------------------------------------------------------------------------------- drift
export class DriftMode extends Mode {
  get usesCountdown() { return true; }
  start() {
    this.route = this.s.route;
    this.drift = new DriftScorer(this.s.game.events, { owner: 'player' });
    this.limit = this.event.timeLimit || 90;
    this.countdown = 3.999; this.state = 'countdown';
    this.inZone = true;
    this.hint = -1;
  }
  fixedUpdate(dt) {
    if (this.state === 'countdown') { this.countdown -= dt; if (this.countdown <= 0) { this.state = 'running'; this.s.game.events.emit('race:go'); } return; }
    if (this.state !== 'running') return;
    this.time += dt;
    const ph = this.s.player.physics;
    const p = this.route.project(ph.pos.x, ph.pos.z, this.hint);
    this.hint = p.i;
    this.inZone = Math.abs(p.lateral) < p.half + 6;
    this.drift.update(dt, ph, this.s.map.world, this.inZone);
    if (this.time >= this.limit) {
      this.drift.bank();
      this.state = 'finished';
      const score = this.drift.total, t = this.event.targets || [20000, 50000, 90000];
      const stars = score >= t[2] ? 3 : score >= t[1] ? 2 : score >= t[0] ? 1 : 0;
      const reward = stars ? this.event.rewards?.credits?.[3 - stars] ?? 0 : Math.round(score / 20);
      this.s.finishEvent({ kind: 'drift', score, best: this.drift.best, stars, targets: t, reward, event: this.event });
    }
  }
  hud() { return { driftEvent: true, drift: this.drift, countdown: this.state === 'countdown' ? this.countdown : null, timeLeft: Math.max(0, this.limit - this.time), score: this.drift.total, targets: this.event.targets, outOfZone: !this.inZone }; }
  snapshot() { return { time: this.time, st: this.state, cd: this.countdown, d: this.drift.snapshot() }; }
  restore(o) { this.time = o.time; this.state = o.st; this.countdown = o.cd; this.drift.restore(o.d); }
}

// ------------------------------------------------------------------------------------- time attack
export class TimeAttackMode extends Mode {
  get usesCountdown() { return true; }
  start() {
    this.route = this.s.route;
    this.tracker = new RaceTracker(this.route, { laps: this.event.laps });
    this.countdown = 3.999; this.state = 'countdown';
    this.record = this.s.game.profile.getRecord(this.s.recordKey);
    this.ghostRec = [];
    this.ghostT = 0;
  }
  fixedUpdate(dt) {
    if (this.state === 'countdown') { this.countdown -= dt; if (this.countdown <= 0) { this.state = 'running'; this.s.game.events.emit('race:go'); } return; }
    if (this.state !== 'running') return;
    this.time += dt;
    const ph = this.s.player.physics;
    // record ghost at 20 Hz
    this.ghostT += dt;
    if (this.ghostT >= 0.05) { this.ghostT = 0; this.ghostRec.push([+(this.time - this.tracker.lapStart).toFixed(3), ...ph.pos.toArray().map((v) => +v.toFixed(2)), ...ph.quat.toArray().map((v) => +v.toFixed(4))]); }
    const ev = this.tracker.update(ph.pos.x, ph.pos.z, ph.fwd, this.time);
    if (ev?.lap) {
      const isBest = this.tracker.bestLap === ev.lapTime;
      this.s.game.events.emit('race:lap', { lap: this.tracker.lap, time: ev.lapTime, best: isBest });
      if (isBest && (!this.record?.lap || ev.lapTime < this.record.lap)) this.s.saveGhost(this.ghostRec.filter((g) => g[0] >= 0));
      this.ghostRec = [];
    }
    if (ev?.finish) {
      this.state = 'finished';
      const t = this.tracker;
      this.s.finishEvent({ kind: 'timeattack', total: t.finishTime, bestLap: t.bestLap, laps: t.lapTimes, previous: this.record, reward: this.event.rewards?.credits?.[0] ?? 20000, event: this.event });
    }
  }
  hud() {
    const t = this.tracker;
    return { race: true, timeAttack: true, countdown: this.state === 'countdown' ? this.countdown : null, lap: Math.min(this.event.laps, t.lap + 1), laps: this.event.laps, time: this.time, lapTime: this.time - t.lapStart, bestLap: t.bestLap, record: this.record?.lap ?? null, position: null, wrongWay: t.wrongWay > 60 };
  }
  snapshot() { return { time: this.time, st: this.state, cd: this.countdown, tr: this.tracker.snapshot() }; }
  restore(o) { this.time = o.time; this.state = o.st; this.countdown = o.cd; this.tracker.restore(o.tr); }
}

export const MODES = { freeroam: FreeRoamMode, circuit: RaceMode, sprint: RaceMode, touge: RaceMode, drift: DriftMode, timeattack: TimeAttackMode };
export { fmtTime };
