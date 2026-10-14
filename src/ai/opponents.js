// Picks AI opponent cars and upgrades them to roughly the player's performance index (PI).
import { buildWorkingSpec } from '../vehicles/VehicleSpec.js';
import { analyze } from '../tuning/Performance.js';
import { partAllowed } from '../tuning/Parts.js';

// greedy upgrade order: cheap balanced gains first
const LADDER = [
  ['compound', 'sport'], ['intake', 'street'], ['exhaust', 'street'], ['brakes', 'street'], ['suspension', 'street'], ['ecu', 'street'],
  ['weight', 'street'], ['intake', 'sport'], ['exhaust', 'sport'], ['arb', 'sport'], ['suspension', 'sport'], ['compound', 'semiSlick'],
  ['camshaft', 'sport'], ['brakes', 'sport'], ['weight', 'sport'], ['induction', 'turboS'], ['differential', 'race'], ['intake', 'race'],
  ['exhaust', 'race'], ['ecu', 'race'], ['suspension', 'race'], ['compound', 'slick'], ['weight', 'race'], ['brakes', 'race'], ['induction', 'twinTurbo'],
];

export function pickOpponents(registry, playerVehicle, count, rand = Math.random) {
  const defs = registry.vehicles();
  const target = analyze(playerVehicle.spec).pi;
  const out = [];
  for (let i = 0; i < count; i++) {
    const def = defs[Math.floor(rand() * defs.length)];
    const parts = {};
    let pi = analyze(buildWorkingSpec(def, parts, null)).pi;
    for (const [slot, level] of LADDER) {
      if (pi >= target - 15) break;
      if (!partAllowed(def, slot, level)) continue;
      const prev = parts[slot];
      parts[slot] = level;
      const np = analyze(buildWorkingSpec(def, parts, null)).pi;
      if (np > target + 30) { if (prev) parts[slot] = prev; else delete parts[slot]; continue; }
      pi = np;
    }
    const paints = def.visual.paints?.length ? def.visual.paints : [def.visual.paint.color];
    const rims = def.visual.slots?.rims?.options || [];
    const config = {
      parts,
      tune: null,
      visual: { paint: { color: paints[Math.floor(rand() * paints.length)], finish: rand() < 0.5 ? 'metallic' : 'gloss' }, mods: rims.length ? { rims: rims[Math.floor(rand() * rims.length)].id } : {} },
    };
    out.push({ def, config, pi, powerScale: pi > target + 40 ? Math.max(0.75, Math.pow(target / pi, 1.4)) : 1 });
  }
  return out;
}
