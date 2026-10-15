// Vegetation over the hills: subtropical broadleaf on the low slopes, Japanese cedar plantations higher up,
// bamboo and betel palm patches near farms, silvergrass meadows on the plateau. Full trees within ~60 m of
// a road (what players see), canopy clumps further out, nothing in the city, the paddies or the water.
import { fbm, valueNoise } from '../../../src/core/math.js';
import { CITY, VALLEY, coastZ } from '../geo.js';

const inRect = (x, z, R, pad = 0) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;
export const GREENS = [0x8fb878, 0x9fc38a, 0x7fa86a, 0xa9c98d, 0x86ac70, 0x93b27c];
export const CEDARS = [0x6f8f62, 0x7a9a6a, 0x65855a, 0x80a070];
const pick = (r, a) => a[Math.floor(r() * a.length)];

export function plantHills(kit, mask, r) {
  const slopeAt = (x, z) => { const e = 3; return Math.hypot(kit.groundY(x + e, z) - kit.groundY(x - e, z), kit.groundY(x, z + e) - kit.groundY(x, z - e)) / (2 * e); };
  const veg = kit.vegetation;
  let trees = 0, clumps = 0, grass = 0;
  const step = 13;
  for (let z = -2300; z < 2540; z += step) for (let x = -2540; x < 2540; x += step) {
    const px = x + (r() - 0.5) * step * 0.9, pz = z + (r() - 0.5) * step * 0.9;
    if (inRect(px, pz, CITY, 40) || inRect(px, pz, VALLEY, 30)) continue;
    if (!mask.free(px, pz)) continue;
    const y = kit.groundY(px, pz);
    if (y < 1.5) continue;                                     // water, beaches, river flats
    const inland = pz - coastZ(px);
    const near = mask.nearRoad(px, pz);
    const s = slopeAt(px, pz);
    if (s > 1.25) continue;                                    // rock faces
    const n = fbm(px * 0.006 + 2.1, pz * 0.006 - 4.7, 3), n2 = valueNoise(px * 0.03, pz * 0.03);
    // plateau meadows: silvergrass along the roads, scattered cedar windbreaks
    if (y > 262) {
      if (near < 22 && r() < 0.8 * veg) { kit.props.place('silvergrass', [px, y - 0.1, pz], r() * 6, 0.8 + r() * 0.7, pick(r, [0xe8dcb0, 0xd9cfa0, 0xf0e6c2])); grass++; }
      if (n > 0.62 && r() < 0.55 * veg) { kit.props.place('cedar', [px, y - 0.3, pz], r() * 6, 0.8 + r() * 0.4, pick(r, CEDARS)); trees++; }
      continue;
    }
    if (inland < 120 && y < 30) {                              // the coastal shelf: salt-bent scrub
      if (r() < 0.35 * veg) kit.props.place('shrub', [px, y - 0.2, pz], r() * 6, 1 + r() * 1.5, pick(r, GREENS));
      continue;
    }
    if (near < 60) {
      if (r() > 0.62 * veg) continue;
      let kind = 'broadleaf';
      if (y > 90 && n > 0.55) kind = 'cedar';
      else if (y < 120 && n2 > 0.78) kind = 'bamboo';
      else if (y < 70 && n2 < 0.12) kind = 'betelPalm';
      else if (y < 50 && n2 > 0.66 && n < 0.4) kind = 'banana';
      const scale = kind === 'cedar' ? 0.85 + r() * 0.5 : kind === 'betelPalm' ? 0.8 + r() * 0.35 : 0.85 + r() * 0.6;
      kit.props.place(kind, [px, y - 0.25, pz], r() * 6, scale, kind === 'cedar' ? pick(r, CEDARS) : kind === 'bamboo' ? 0xa8c88a : pick(r, GREENS));
      trees++;
    } else {
      // canopy fill on a coarser lattice
      if ((Math.round(x / step) + Math.round(z / step)) % 2 || r() > 0.42 * veg) continue;
      kit.props.place('canopy', [px, y - 1.2, pz], r() * 6, 0.8 + r() * 0.5, y > 100 && n > 0.5 ? pick(r, CEDARS) : pick(r, GREENS));
      clumps++;
    }
  }
  return { trees, clumps, grass };
}
