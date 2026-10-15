// Street life: scooters parked in rows on every city sidewalk, street trees along the kerbs, traffic signals
// at the junctions, bus shelters; out on the open roads, betel nut booths with their neon trim.
import * as THREE from 'three';
import { EW, NS, cityJunctions, ROUNDABOUT } from '../city-plan.js';
import { treeTint } from './city.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const SCOOTERS = [0xd8d8d0, 0x2b2d30, 0xb0262a, 0x5c8fbf, 0xe8e2d0, 0x6a8f4f, 0xc9c9c9, 0x1f3f6f, 0xe0b040, 0x8a8f94];

export function buildStreetLife(kit, shared, r) {
  defineSignals(kit);
  const junctions = cityJunctions();
  const nearJ = (x, z, pad) => junctions.some((j) => Math.hypot(j.pos[0] - x, j.pos[2] - z) < j.radius + pad) || Math.hypot(x - ROUNDABOUT.x, z - ROUNDABOUT.z) < ROUNDABOUT.r + 24;
  const ids = [...EW.map((a) => a.id), ...NS.map((a) => a.id)];
  const roads = kit.roads.filter((q) => ids.some((id) => q.id === id || q.id.startsWith(`${id}-`)) || q.id === 'taipei-circuit');
  let scooters = 0, trees = 0;
  for (const road of roads) {
    const R = road.route, ew = Math.abs(R.tx[0]) > 0.7;
    for (const side of [-1, 1]) {
      let s = 4 + r() * 20, nextTree = s + 6 + r() * 6, stop = 120 + r() * 200;
      while (s < R.length - 4) {
        const i = R.indexAt(s), half = R.half[i];
        const p = R.pointAt(s, side * (half + 2.3));
        if (nearJ(p.x, p.z, 7)) { s += 4; continue; }
        const heading = R.headingAt(i);
        // a bus shelter now and then (east-west avenues)
        if (ew && s > stop) {
          const q = R.pointAt(s, side * (half + 2.2));
          kit.props.place('busStop', [q.x, p.y, q.z], heading + (side > 0 ? Math.PI : 0), 1);
          stop = s + 360 + r() * 160; s += 6; continue;
        }
        // street tree at the kerb
        if (s > nextTree) {
          const q = R.pointAt(s, side * (half + 0.9));
          kit.props.place('broadleaf', [q.x, p.y - 0.1, q.z], r() * 6, 0.62 + r() * 0.22, treeTint(r));
          trees++; nextTree = s + 13 + r() * 6;
        }
        // a row of scooters, nose to the kerb, then a gap
        if (r() < 0.5) {
          const n = 3 + Math.floor(r() * 10);
          for (let k = 0; k < n && s < R.length - 4; k++, s += 0.86) {
            const q = R.pointAt(s, side * (half + 2.2));
            if (nearJ(q.x, q.z, 7)) break;
            kit.props.place('scooterRow', [q.x, p.y, q.z], heading + Math.PI / 2 * side + (r() - 0.5) * 0.18, 1, pick(r, SCOOTERS));
            scooters++;
          }
        }
        s += 12 + r() * 30;
      }
    }
  }
  // traffic signals at the four corners of every crossing (not the roundabout or the T junctions on the ring)
  for (const E of EW) for (const N of NS) {
    if (N.x < E.x0 - 1 || N.x > E.x1 + 1 || E.z < N.z0 - 1 || E.z > N.z1 + 1) continue;
    if (Math.hypot(N.x - ROUNDABOUT.x, E.z - ROUNDABOUT.z) < 5) continue;
    for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = N.x + sx * (N.w / 2 + 1.4), z = E.z + sz * (E.w / 2 + 1.4);
      // two corners reach across the north-south road, two across the east-west road
      const rot = sx === sz ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : (sz > 0 ? Math.PI : 0);
      const gy = kit.groundY(x, z);
      kit.props.place('signalPole', [x, gy, z], rot, 1);
      kit.props.place(sx === sz ? 'signalLitG' : 'signalLitR', [x, gy, z], rot, 1);
      kit.collision.cylinder({ x, z, r: 0.16, y0: gy - 1, y1: gy + 6, kind: 'pole' });
    }
  }
  betelStands(kit, shared, r);
  return { scooters, trees };
}

// Taiwanese signals: a pole with an arm over the carriageway and a horizontal three-lamp head; the lit lamp
// is a separate untinted part (red or green) so it glows at night.
function defineSignals(kit) {
  const { M, props } = kit;
  // a cheap scooter for the thousands parked on the sidewalks: boxes only, untinted tyres
  {
    const body = new THREE.BoxGeometry(0.36, 0.45, 1.25); body.translate(0, 0.52, 0);
    const seat = new THREE.BoxGeometry(0.3, 0.12, 0.62); seat.translate(0, 0.82, -0.2);
    const front = new THREE.BoxGeometry(0.3, 0.65, 0.18); front.translate(0, 0.74, 0.56);
    const tyres = [-0.5, 0.5].map((z) => { const g = new THREE.BoxGeometry(0.1, 0.42, 0.42); g.translate(0, 0.21, z); return g; });
    props.define('scooterRow', [
      { geometry: kit.merge([body, seat, front]), material: M.shared('scooterPaint', () => M.surface({ color: 0xffffff, roughness: 0.45, metalness: 0.2 })), castShadow: true },
      { geometry: kit.merge(tyres), material: M.shared('rubber', () => M.surface({ color: 0x151515, roughness: 0.9 })), castShadow: false, tint: false },
    ], { maxDistance: 320 });
  }
  const grey = M.shared('signalGrey', () => M.surface({ color: 0x8a8f92, roughness: 0.5, metalness: 0.5 }));
  const black = M.shared('signalBlack', () => M.surface({ color: 0x1a1b1c, roughness: 0.6 }));
  const pole = new THREE.CylinderGeometry(0.09, 0.13, 6.2, 8); pole.translate(0, 3.1, 0);
  const arm = new THREE.BoxGeometry(0.1, 0.1, 6.5); arm.translate(0, 6.0, 3.25);
  const head = new THREE.BoxGeometry(0.32, 0.42, 1.25); head.translate(0, 5.65, 5.9);
  const hood = new THREE.BoxGeometry(0.36, 0.06, 1.3); hood.translate(0, 5.9, 5.9);
  props.define('signalPole', [{ geometry: kit.merge([pole, arm]), material: grey, castShadow: true }, { geometry: kit.merge([head, hood]), material: black, castShadow: false }], { maxDistance: 700 });
  const lamp = (dz) => { const g = new THREE.CylinderGeometry(0.13, 0.13, 0.36, 10); g.rotateZ(Math.PI / 2); g.translate(0, 5.65, 5.9 + dz); return g; };
  const lit = (name, color, dz) => M.shared(name, () => { const m = M.surface({ color: 0x101010, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }); m.userData.nightEmissive = [0.6, 5]; kit.nightMaterials.push(m); return m; });
  props.define('signalLitR', [{ geometry: lamp(-0.4), material: lit('signalRed', 0xff2a1a), castShadow: false }], { maxDistance: 700 });
  props.define('signalLitG', [{ geometry: lamp(0.4), material: lit('signalGreen', 0x2aff8a), castShadow: false }], { maxDistance: 700 });
}

// Betel nut booths: glass kiosks with green and pink neon at the roadside outside the city.
function betelStands(kit, shared, r) {
  const ring = kit.roads.find((q) => q.id === 'formosa-ring');
  if (!ring) return;
  const R = ring.route, hs = kit.hsigns, rect = hs.slot('檳榔', 3);
  let placed = 0;
  for (let k = 0; k < 120 && placed < 22; k++) {
    const s = 1300 + r() * 10600, i = R.indexAt(s);
    if ((ring.tunnels || []).some((t) => s > t.from - 60 && s < t.to + 60)) continue;
    const side = r() < 0.5 ? -1 : 1, lat = side * (R.half[i] + ring.shoulder + 3.2);
    const p = R.pointAt(s, lat), gy = kit.groundY(p.x, p.z);
    if (Math.abs(gy - R.y[i]) > 0.6 || !shared.mask.free(p.x, p.z) || !shared.mask.free(p.x + R.nx(i) * side * 2, p.z + R.nz(i) * side * 2)) continue;
    const face = R.headingAt(i) + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI;
    kit.props.place('betelStand', [p.x, gy, p.z], face, 1);
    const g = hs.geometry(rect, 2.2, 0.55, 0.12); g.rotateY(face + Math.PI / 2); g.translate(p.x - Math.sin(face) * -1.0, gy + 2.85, p.z - Math.cos(face) * -1.0);
    kit.addStatic(g, hs.material, { cast: false, receive: false });
    kit.light({ pos: [p.x, gy + 2.6, p.z], color: 0x7aff9a, intensity: 30, range: 12, nightOnly: true });
    shared.mask.circle(p.x, p.z, 3);
    placed++;
  }
}
