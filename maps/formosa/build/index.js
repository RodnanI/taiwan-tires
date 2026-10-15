// Formosa build: everything placed after terrain and roads exist. Regions build in turn and yield between
// them so the loading screen stays responsive.
import { buildCity } from './city.js';
import { CITY_Y } from '../geo.js';
import { ROUNDABOUT } from '../city-plan.js';

const tick = () => new Promise((res) => setTimeout(res, 0));

export async function build(ctx) {
  const { kit } = ctx;
  const r = kit.rand;
  const shared = {
    parks: [],
    // whole blocks other builders own (Da'an park, the tower plaza, the temple, the campus)
    reserved: [
      { x0: -490, x1: -160, z0: 1730, z1: 2010, kind: 'daan' },
      { x0: 210, x1: 550, z0: 1430, z1: 1710, kind: 'tower' },
      { x0: -1440, x1: -1160, z0: 1730, z1: 2010, kind: 'temple' },
      { x0: -490, x1: -160, z0: 2030, z1: 2240, kind: 'campus' },
    ],
    keepOut: [{ x: ROUNDABOUT.x, z: ROUNDABOUT.z, r: ROUNDABOUT.r + 20 }],
  };
  buildCity(kit, r, shared);
  await tick();
}
export { CITY_Y };
