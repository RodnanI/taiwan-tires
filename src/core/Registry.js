// Content registry: every vehicle in vehicles/*/vehicle.js and map in maps/*/map.js (auto-discovered by
// tools/build.mjs). Definitions are normalized once (defaults filled, problems reported) and cached.
import { normalizeVehicle } from '../vehicles/VehicleSpec.js';
import { normalizeMap } from '../maps/MapDef.js';

export class Registry {
  constructor({ vehicles = [], maps = [] }) {
    this.problems = [];
    this._vehicles = new Map();
    this._maps = new Map();
    for (const raw of vehicles) {
      try {
        const { def, problems } = normalizeVehicle(raw);
        problems.forEach((p) => this.problems.push(`vehicle ${raw?.id}: ${p}`));
        if (def) this._vehicles.set(def.id, def);
      } catch (e) { this.problems.push(`vehicle ${raw?.id}: ${e.message}`); }
    }
    for (const raw of maps) {
      try {
        const { def, problems } = normalizeMap(raw);
        problems.forEach((p) => this.problems.push(`map ${raw?.id}: ${p}`));
        if (def) this._maps.set(def.id, def);
      } catch (e) { this.problems.push(`map ${raw?.id}: ${e.message}`); }
    }
    if (this.problems.length) console.warn('[registry] content problems:\n' + this.problems.join('\n'));
  }
  vehicles() { return [...this._vehicles.values()].filter((v) => !v.hidden); }
  allVehicles() { return [...this._vehicles.values()]; }
  vehicle(id) { return this._vehicles.get(id) || null; }
  maps() { return [...this._maps.values()].filter((m) => !m.hidden); }
  map(id) { return this._maps.get(id) || null; }
  event(mapId, eventId) { return this.map(mapId)?.events.find((e) => e.id === eventId) || null; }
}
