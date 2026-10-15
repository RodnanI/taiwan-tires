// The Tamsui river: the riverside park under the levee (a big car park that hosts the drift event, ball fields,
// the bike path along the bank) and Guandu Bridge's red twin arch over the water, with the Bali car park on
// the far bank.
import * as THREE from 'three';
import { RIVER_PARK, GUANDU_BRIDGE } from '../routes.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];

export function buildRiver(kit, shared, r) {
  riversidePark(kit, shared, r);
  guanduArch(kit, shared);
  baliCarPark(kit, shared, r);
}

function riversidePark(kit, shared, r) {
  const { x0, x1, z0, z1, y } = RIVER_PARK;
  const mask = shared.mask;
  kit.pad({ poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, surface: 'asphalt', blend: 6 });
  mask.rect(x0 - 2, z0 - 2, x1 + 2, z1 + 2);
  // the island the drift loop runs round: kerbed grass with palms
  const ix = -1871, iz0 = 1284, iz1 = 1398, iw = 5;
  const kerb = kit.roadMats.curb();
  const box = (cx, cz, hx, hz, y0, y1, mat) => { const g = new THREE.BoxGeometry(hx * 2, y1 - y0, hz * 2); g.translate(cx, (y0 + y1) / 2, cz); kit.addStatic(g, mat, { cast: false }); };
  box(ix, (iz0 + iz1) / 2, iw + 0.3, (iz1 - iz0) / 2 + 0.3, y, y + 0.18, kerb);
  box(ix, (iz0 + iz1) / 2, iw, (iz1 - iz0) / 2, y, y + 0.2, kit.M.textured('grass', { repeat: 1 }));
  kit.collision.box({ x: ix, z: (iz0 + iz1) / 2, hx: iw + 0.3, hz: (iz1 - iz0) / 2 + 0.3, y0: y - 1, y1: y + 0.2, kind: 'kerb' });
  for (let z = iz0 + 8; z < iz1 - 4; z += 15) kit.props.place('palm', [ix, y + 0.2, z], r() * 6, 0.9 + r() * 0.2);
  // painted bays down both long sides (empty at night: this is where people come to slide)
  const mark = kit.roadMats.mark(), lines = [];
  const strip = (cx, cz, w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(cx, y + 0.05, cz); lines.push(g); };
  for (let z = z0 + 6; z < z1 - 6; z += 2.6) { strip(x0 + 3, z, 5.2, 0.12); strip(x1 - 3, z, 5.2, 0.12); }
  strip(x0 + 5.6, (z0 + z1) / 2, 0.12, z1 - z0 - 12); strip(x1 - 5.6, (z0 + z1) / 2, 0.12, z1 - z0 - 12);
  kit.addStatic(kit.merge(lines), mark, { cast: false });
  // lamps on both edges, arms pointing in
  for (let z = z0 + 14; z < z1; z += 42) {
    kit.props.streetLamp([x0 - 1.2, y, z], Math.PI / 2, { height: 10, arm: 1.8, intensity: 120, range: 36, color: 0xfff0d8 });
    kit.props.streetLamp([x1 + 1.2, y, z + 21], -Math.PI / 2, { height: 10, arm: 1.8, intensity: 120, range: 36, color: 0xfff0d8 });
  }
  // a few cars and scooters parked at the far ends, a vending machine, benches
  const cars = [0xe8e8e4, 0x1c1d1f, 0x9aa1a6, 0xb02a24, 0x2c4f7e, 0xd8d2c4];
  for (let z = z1 - 8; z > z1 - 30; z -= 2.6) if (r() < 0.5) kit.props.place('parkedCar', [x1 - 3, y, z], Math.PI / 2, 1, pick(r, cars));
  for (let z = z0 + 6; z < z0 + 24; z += 2.6) if (r() < 0.5) kit.props.place('parkedCar', [x0 + 3, y, z], -Math.PI / 2, 1, pick(r, cars));
  for (let k = 0; k < 12; k++) kit.props.place('scooter', [x1 - 2 + r() * 1.2, y, z0 + 30 + k * 1.1], Math.PI / 2 + (r() - 0.5) * 0.3, 1, pick(r, [0xd8d8d0, 0x2b2d30, 0xb0262a, 0x5c8fbf]));
  kit.props.place('vending', [x1 + 2.5, y, (z0 + z1) / 2], -Math.PI / 2);
  // ball fields and the bike path north and south of the car park, on the flats
  const field = kit.M.shared('ballfield', () => kit.M.surface({ color: 0x5b8a3c, roughness: 0.95 }));
  const dirt = kit.M.shared('infield', () => kit.M.surface({ color: 0xb8875a, roughness: 0.95 }));
  for (const zc of [1640, 1780, 1040]) {
    const g = new THREE.CircleGeometry(36, 24, Math.PI * 0.25, Math.PI * 0.5); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 4); g.translate(-1874, kit.groundY(-1874, zc) + 0.06, zc + 14);
    kit.addStatic(g, field, { cast: false });
    const d = new THREE.PlaneGeometry(16, 16); d.rotateX(-Math.PI / 2); d.rotateY(Math.PI / 4); d.translate(-1874, kit.groundY(-1874, zc) + 0.08, zc - 2);
    kit.addStatic(d, dirt, { cast: false });
    for (let k = 0; k < 3; k++) kit.props.place('bench', [-1850, kit.groundY(-1850, zc), zc - 8 + k * 6], -Math.PI / 2);
  }
  const path = [];
  for (let z = 700; z < 2000; z += 4) {
    const x = -1909 + Math.sin(z * 0.01) * 2;
    if (z > z0 - 8 && z < z1 + 8) continue;
    const g = new THREE.PlaneGeometry(3, 4.2); g.rotateX(-Math.PI / 2); g.translate(x, kit.groundY(x, z) + 0.05, z); path.push(g);
  }
  if (path.length) kit.addStatic(kit.merge(path), kit.roadMats.concrete(), { cast: false });
  for (let z = 720; z < 2000; z += 18) { const x = -1915 + r() * 3; if (z > z0 - 4 && z < z1 + 4) continue; kit.props.place('broadleaf', [x, kit.groundY(x, z) - 0.2, z], r() * 6, 0.8 + r() * 0.4, pick(r, [0x9fc38a, 0x8fb878, 0xb2cf92])); }
  for (let z = z0; z < z1; z += 16) kit.props.place('broadleaf', [x0 - 6, kit.groundY(x0 - 6, z) - 0.2, z], r() * 6, 0.9 + r() * 0.4, pick(r, [0x9fc38a, 0x8fb878, 0xb2cf92]));
  mask.rect(-1920, 600, -1900, 2000);
}

// Guandu Bridge: two red arch ribs over the main span, braced across the top, with hangers to the deck edges.
function guanduArch(kit, shared) {
  const road = kit.roads.find((q) => q.id === 'guandu-bridge');
  if (!road) return;
  const R = road.route;
  const red = kit.M.shared('guanduRed', () => kit.M.surface({ color: 0xc8321e, roughness: 0.5, metalness: 0.3 }));
  const s0 = GUANDU_BRIDGE.from + 70, s1 = GUANDU_BRIDGE.to - 70, rise = 48, n = 28;
  const geos = [];
  const tube = (a, b, rad) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = new THREE.CylinderGeometry(rad, rad, len, 8, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    geos.push(g);
  };
  const lat = R.half[R.indexAt((s0 + s1) / 2)] + 1.6;
  const rib = (side) => {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const s = s0 + ((s1 - s0) * k) / n, u = (k / n) * 2 - 1;
      const p = R.pointAt(s, side * lat), deck = p.y;
      pts.push({ p: new THREE.Vector3(p.x, deck + rise * (1 - u * u), p.z), deck });
    }
    for (let k = 0; k < n; k++) tube(pts[k].p, pts[k + 1].p, 1.15);
    for (let k = 1; k < n; k++) tube(new THREE.Vector3(pts[k].p.x, pts[k].deck + 0.8, pts[k].p.z), pts[k].p, 0.12);
    return pts;
  };
  const L = rib(1), Rr = rib(-1);
  for (let k = 3; k < n - 2; k += 3) tube(L[k].p, Rr[k].p, 0.6);
  for (let k = 3; k < n - 5; k += 3) { tube(L[k].p, Rr[k + 3].p, 0.4); tube(Rr[k].p, L[k + 3].p, 0.4); }
  kit.addStatic(kit.merge(geos), red, { cast: true });
  // the ribs land on the deck: a collider at each foot
  for (const P of [L[0], L[n], Rr[0], Rr[n]]) kit.collision.cylinder({ x: P.p.x, z: P.p.z, r: 1.4, y0: P.deck - 1, y1: P.deck + 6, kind: 'pillar' });
  // night: floodlit ribs (a few pooled lights along the span)
  for (const k of [6, 14, 22]) kit.light({ pos: [(L[k].p.x + Rr[k].p.x) / 2, L[k].p.y - 6, (L[k].p.z + Rr[k].p.z) / 2], color: 0xff7a50, intensity: 90, range: 40, nightOnly: true });
}

function baliCarPark(kit, shared, r) {
  const road = kit.roads.find((q) => q.id === 'guandu-bridge');
  if (!road) return;
  const R = road.route, e = R.n - 1, x = R.x[e], z = R.z[e], y = R.y[e];
  const poly = [[x - 30, z + 2], [x + 30, z + 2], [x + 30, z - 60], [x - 30, z - 60]];
  kit.pad({ poly, y: y - 0.02, surface: 'asphalt', blend: 6 });
  shared.mask.rect(x - 32, z - 62, x + 32, z + 4);
  for (let k = 0; k < 10; k++) if (r() < 0.55) kit.props.place('parkedCar', [x - 26 + k * 5.6, y, z - 55], 0, 1, pick(r, [0xe8e8e4, 0x1c1d1f, 0x9aa1a6, 0xb02a24, 0x2c4f7e]));
  kit.props.streetLamp([x - 31, y, z - 30], Math.PI / 2, { height: 9, arm: 1.6, intensity: 100, range: 30 });
  kit.props.streetLamp([x + 31, y, z - 30], -Math.PI / 2, { height: 9, arm: 1.6, intensity: 100, range: 30 });
}
