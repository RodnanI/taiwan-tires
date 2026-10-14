// Player profile: credits (NT$), owned cars with their parts/tune/visual config, records and stats.
// Persisted to localStorage. Car entries are plain JSON so they can be exported/imported as text.
import { storage } from './storage.js';

const KEY = 'tt.profile.v1';
const GHOST_PREFIX = 'tt.ghost.';
const START_CREDITS = 450000;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export class Profile {
  constructor(events, registry) {
    this.events = events;
    this.registry = registry;
    this.data = storage.get(KEY);
    if (!this.data || this.data.version !== 1) this.reset(false);
    // drop cars whose vehicle definition no longer exists (content removed)
    this.data.garage = this.data.garage.filter((c) => registry.vehicle(c.vehicleId));
    if (!this.data.garage.length) this._grantStarter();
    if (!this.getCar(this.data.selected)) this.data.selected = this.data.garage[0].uid;
    this.save();
  }
  reset(emit = true) {
    this.data = {
      version: 1, credits: START_CREDITS, garage: [], selected: null, records: {},
      stats: { distance: 0, driftPoints: 0, races: 0, wins: 0, podiums: 0, topSpeed: 0, bestDrift: 0, playTime: 0, events: 0 },
      created: Date.now(), savedTunes: {},
    };
    this._grantStarter();
    this.save();
    if (emit) this.events.emit('profile:changed', { reset: true });
  }
  _grantStarter() {
    const list = this.registry.vehicles();
    if (!list.length) return;
    const starter = list.find((v) => v.starter) || [...list].sort((a, b) => a.price - b.price)[0];
    const car = this.addCar(starter.id, { silent: true });
    this.data.selected = car.uid;
  }
  save() { storage.set(KEY, this.data); }

  get credits() { return this.data.credits; }
  addCredits(n, reason = '') {
    this.data.credits = Math.max(0, Math.round(this.data.credits + n));
    this.save();
    this.events.emit('profile:credits', { credits: this.data.credits, delta: n, reason });
  }
  spend(n, reason = '') {
    if (n > this.data.credits) return false;
    this.addCredits(-n, reason);
    return true;
  }

  get garage() { return this.data.garage; }
  getCar(id) { return this.data.garage.find((c) => c.uid === id) || null; }
  selectedCar() { return this.getCar(this.data.selected) || this.data.garage[0]; }
  select(id) { if (this.getCar(id)) { this.data.selected = id; this.save(); this.events.emit('profile:car', { uid: id }); } }
  addCar(vehicleId, { silent = false } = {}) {
    const def = this.registry.vehicle(vehicleId);
    const car = {
      uid: uid(), vehicleId, parts: {}, tune: null, owned: {}, ownedVisual: {},
      visual: { paint: { ...(def?.visual?.paint || { color: '#c8c2b4', finish: 'gloss' }) }, mods: {} },
      odometer: 0, acquired: Date.now(), nickname: '',
    };
    this.data.garage.push(car);
    this.save();
    if (!silent) this.events.emit('profile:garage', { added: car.uid });
    return car;
  }
  sellCar(id) {
    if (this.data.garage.length <= 1) return 0;
    const car = this.getCar(id);
    if (!car) return 0;
    const def = this.registry.vehicle(car.vehicleId);
    const value = Math.round((def?.price || 0) * 0.6);
    this.data.garage = this.data.garage.filter((c) => c.uid !== id);
    if (this.data.selected === id) this.data.selected = this.data.garage[0].uid;
    this.addCredits(value, 'sold car');
    this.events.emit('profile:garage', { removed: id });
    return value;
  }
  updateCar(id, patch) {
    const car = this.getCar(id);
    if (!car) return;
    Object.assign(car, patch);
    this.save();
    this.events.emit('profile:car', { uid: id, patch });
  }

  /** Buy (if needed) and install a part level on a car. Returns { ok, cost, reason }. */
  installPart(id, slot, level, price) {
    const car = this.getCar(id);
    if (!car) return { ok: false, reason: 'no car' };
    car.owned ||= {};
    const owned = level === 'stock' || (car.owned[slot] || []).includes(level);
    if (!owned) {
      if (!this.spend(price, 'part')) return { ok: false, reason: 'credits' };
      (car.owned[slot] ||= []).push(level);
    }
    if (level === 'stock') delete car.parts[slot]; else car.parts[slot] = level;
    this.save();
    this.events.emit('profile:car', { uid: id });
    return { ok: true, cost: owned ? 0 : price };
  }
  /** Buy a visual option (rims, spoilers...) once; afterwards switching is free. */
  setVisualMod(id, slot, option, price) {
    const car = this.getCar(id);
    if (!car) return { ok: false };
    car.ownedVisual ||= {};
    const owned = !price || (car.ownedVisual[slot] || []).includes(option);
    if (!owned) { if (!this.spend(price, 'visual')) return { ok: false, reason: 'credits' }; (car.ownedVisual[slot] ||= []).push(option); }
    car.visual.mods = { ...(car.visual.mods || {}), [slot]: option };
    this.save();
    this.events.emit('profile:car', { uid: id });
    return { ok: true };
  }

  /** Stores a result if it beats the previous best. Returns which fields improved. */
  record(key, { time, lap, score }) {
    const r = this.data.records[key] || (this.data.records[key] = {});
    const out = {};
    if (time != null && (r.time == null || time < r.time)) { r.time = time; out.time = true; }
    if (lap != null && (r.lap == null || lap < r.lap)) { r.lap = lap; out.lap = true; }
    if (score != null && (r.score == null || score > r.score)) { r.score = score; out.score = true; }
    this.save();
    return out;
  }
  getRecord(key) { return this.data.records[key] || null; }
  stat(key, delta) { this.data.stats[key] = (this.data.stats[key] || 0) + delta; }
  statMax(key, v) { if (v > (this.data.stats[key] || 0)) this.data.stats[key] = v; }

  saveGhost(key, ghost) { return storage.set(GHOST_PREFIX + key, ghost); }
  loadGhost(key) { return storage.get(GHOST_PREFIX + key); }

  saveTune(vehicleId, name, parts, tune) {
    const list = this.data.savedTunes[vehicleId] || (this.data.savedTunes[vehicleId] = []);
    list.push({ name, parts: structuredClone(parts), tune: structuredClone(tune), at: Date.now() });
    if (list.length > 20) list.shift();
    this.save();
  }
}
