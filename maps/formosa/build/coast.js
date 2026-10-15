// The north coast: the fishing harbour (quay apron, breakwaters armoured with tetrapods, squid boats with
// their lamp strings, the fish market and the ice plant), the harbour entrance lights, the two cape
// lighthouses with sweeping beams, the Shimen wind farm and the Yehliu hoodoo field.
import * as THREE from 'three';
import { tileUV } from './atlas.js';
import { Builder, lin, mulC } from './geom.js';
import { slab } from './city.js';
import { templeHall, incenseBurner } from './temple.js';
import { coastZ } from '../geo.js';
import { HARBOUR } from '../routes.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];

export function buildCoast(kit, shared, r) {
  defineProps(kit);
  harbour(kit, shared, r);
  lighthouse(kit, shared, { x: 2104, z: -2046, striped: false, h: 15 });
  lighthouse(kit, shared, { x: -1012, z: -2066, striped: true, h: 13 });
  windFarm(kit, shared, r);
  yehliu(kit, shared, r);
  shared.city.wallB.flush();
}

// ------------------------------------------------------------------------------------------- props
function defineProps(kit) {
  const { M, props } = kit;
  const white = M.shared('boatWhite', () => M.surface({ color: 0xffffff, roughness: 0.55 }));
  const dark = M.shared('boatDark', () => M.surface({ color: 0x2a2c2e, roughness: 0.6, metalness: 0.3 }));
  const bulbs = M.shared('squidLamps', () => { const m = M.surface({ color: 0xfff6e0, emissive: 0xfff1cf, emissiveIntensity: 0.2, roughness: 0.3 }); m.userData.nightEmissive = [0.2, 7]; kit.nightMaterials.push(m); return m; });
  const concrete = M.shared('tetrapod', () => M.surface({ color: 0xb9b6ad, roughness: 0.95, flatShading: true }));
  const P = (geometry, material, extra = {}) => ({ geometry, material, castShadow: true, ...extra });
  // squid boat: pointed hull, wheelhouse aft, a mast, two strings of big lamps over the deck
  {
    const s = new THREE.Shape();
    s.moveTo(-2.3, -8); s.lineTo(2.3, -8); s.lineTo(2.4, 2); s.quadraticCurveTo(2.2, 6.5, 0, 8.6); s.quadraticCurveTo(-2.2, 6.5, -2.4, 2); s.closePath();
    const hull = new THREE.ExtrudeGeometry(s, { depth: 2.6, bevelEnabled: false, curveSegments: 4 });
    hull.rotateX(-Math.PI / 2); hull.translate(0, -1.2, 0);          // bow towards -z, keel 1.2 m under water
    const deck = new THREE.BoxGeometry(4.3, 0.1, 13); deck.translate(0, 1.25, -0.6);
    const cabin = new THREE.BoxGeometry(3.4, 2.4, 3.8); cabin.translate(0, 2.6, 4.6);
    const roof = new THREE.BoxGeometry(3.8, 0.2, 4.3); roof.translate(0, 3.9, 4.6);
    const mast = new THREE.CylinderGeometry(0.09, 0.12, 8, 6); mast.translate(0, 5, 1.2);
    const boom = new THREE.BoxGeometry(0.12, 0.12, 12); boom.translate(0, 5.2, -1.8);
    const lamps = [];
    for (let k = 0; k < 7; k++) for (const sx of [-1.6, 1.6]) { const g = new THREE.SphereGeometry(0.17, 6, 4); g.translate(sx, 4.4, -7 + k * 1.7); lamps.push(g); }
    for (const sx of [-1.6, 1.6]) { const w = new THREE.BoxGeometry(0.03, 0.03, 11); w.translate(sx, 4.62, -1.9); lamps.push(w); }
    props.define('squidBoat', [P(hull, white), P(kit.merge([deck, roof]), dark, { tint: false }), P(cabin, white, { tint: false }), P(kit.merge([mast, boom]), dark, { tint: false, castShadow: false }), P(kit.merge(lamps), bulbs, { tint: false, castShadow: false })], { maxDistance: 1400 });
  }
  // tetrapod: four legs from the centre towards the corners of a tetrahedron
  {
    const legs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(([x, y, z]) => {
      const g = new THREE.CylinderGeometry(0.32, 0.55, 1.7, 7); g.translate(0, 0.85, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
      g.applyQuaternion(q); return g;
    });
    props.define('tetrapod', [P(kit.merge(legs), concrete)]);
  }
  const plastic = M.shared('crateWhite', () => M.surface({ color: 0xffffff, roughness: 0.6 }));
  { const g = new THREE.BoxGeometry(0.7, 0.36, 0.5); g.translate(0, 0.18, 0); props.define('fishCrate', [P(g, plastic, { castShadow: false })]); }
  { const g = new THREE.IcosahedronGeometry(1, 1); g.scale(1.4, 0.5, 1.1); g.translate(0, 0.25, 0); props.define('netPile', [P(g, M.shared('nets', () => M.surface({ color: 0xffffff, roughness: 0.95 })), { castShadow: false })]); }
  { const a = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 8); a.translate(0, 0.27, 0); const c = new THREE.CylinderGeometry(0.34, 0.3, 0.12, 8); c.translate(0, 0.6, 0); props.define('mooringBollard', [P(kit.merge([a, c]), dark)]); }
  { const g = new THREE.TorusGeometry(0.5, 0.2, 6, 10); props.define('fender', [P(g, M.shared('rubber', () => M.surface({ color: 0x151515, roughness: 0.9 })), { castShadow: false })]); }
  // Yehliu hoodoo: a narrow sandstone neck under a heavy cap
  {
    const neck = new THREE.CylinderGeometry(0.45, 0.9, 2.4, 7); neck.translate(0, 1.2, 0);
    const cap = new THREE.IcosahedronGeometry(1.35, 1); cap.scale(1.15, 0.75, 1); cap.translate(0.15, 2.9, 0);
    props.define('hoodoo', [P(kit.merge([neck, cap]), M.shared('sandstone', () => M.surface({ color: 0xffffff, roughness: 0.95, flatShading: true })))], { maxDistance: 900 });
  }
}

// ------------------------------------------------------------------------------------------- harbour
function harbour(kit, shared, r) {
  const { x0, x1, zq, y } = HARBOUR;
  const B = shared.city.wallB, mask = shared.mask;
  // the apron follows the ring 11 m off its centreline and ends at the quay
  const ring = kit.roads.find((q) => q.id === 'formosa-ring').route;
  const ringZ = (x) => { const p = ring.project(x, -1815); return ring.z[p.i]; };
  const nl = Math.ceil((x1 - x0) / 16), land = [];
  // (further off the ring by the Jiufen junction, so the junction's rim keeps its footing)
  for (let k = 0; k <= nl; k++) { const x = x0 + ((x1 - x0) * k) / nl; land.push([x, ringZ(x) - 11 - 6 * Math.max(0, 1 - Math.abs(x - 1688) / 40)]); }
  const poly = [...land, [x1, zq], [x0, zq]];
  kit.pad({ poly, y, surface: 'concrete', blend: 3 });
  mask.rect(x0 - 1, zq - 1, x1 + 1, Math.max(...land.map((p) => p[1])));
  const grey = lin(0xa9a69e), dark = lin(0x7e7b74);
  // quay face and the retaining walls round the landward side (up to the ring, with a parapet)
  B.wall(x1, zq, x0, zq, -6, y + 0.35, tileUV('plain'), grey);
  for (let k = 0; k < land.length - 1; k++) {
    const [ax, az] = land[k], [bx, bz] = land[k + 1];
    const top = Math.max(kit.groundY(ax, az + 4), kit.groundY(bx, bz + 4), y) + 0.9;
    B.wall(ax, az, bx, bz, y - 0.3, top, tileUV('wall'), grey);
    kit.collision.wall(ax, az, bx, bz, { y0: y - 1, y1: top, kind: 'wall' });
  }
  // side walls (the east one leaves a gap for the ramp)
  const sideTop = (x, z) => Math.max(y + 0.9, kit.groundY(x, z) + 0.9);
  const rampZ = HARBOUR.rampZ, le = land[land.length - 1][1];
  for (const [x, za, zb, out] of [[x0, land[0][1], zq, -4], [x1, zq, rampZ - 5, 4], [x1, rampZ + 5, le, 4]]) {
    B.wall(x, za, x, zb, -6, sideTop(x + out, (za + zb) / 2), tileUV('wall'), grey);
    kit.collision.wall(x, za, x, zb, { y0: y - 1, y1: y + 2, kind: 'wall' });
  }
  // painted kerb along the quay edge
  B.box((x0 + x1) / 2, zq + 0.25, [1, 0], [0, -1], (x1 - x0) / 2, 0.25, y, y + 0.35, tileUV('plain'), tileUV('plain'), lin(0xe0b83a));
  // quay furniture: bollards, tyre fenders, lamps
  for (let x = x0 + 6; x < x1 - 4; x += 10) {
    kit.props.place('mooringBollard', [x, y, zq + 0.9], 0);
    kit.collision.cylinder({ x, z: zq + 0.9, r: 0.3, y0: y - 1, y1: y + 0.7, kind: 'bollard' });
    kit.props.place('fender', [x + 5, y - 1.6, zq - 0.25], 0);
  }
  // paint: a yellow line along the quay edge, parking bays along the east wall, a box at the ramp foot
  const paint = new Builder(kit, kit.roadMats.mark(), { cast: false });
  const rect = (ax, az, bx, bz, c) => paint.quad([ax, y + 0.045, bz], [bx, y + 0.045, bz], [bx, y + 0.045, az], [ax, y + 0.045, az], tileUV('plain'), c);
  const yellow = lin(0xe8b828), white = [0.92, 0.92, 0.9];
  rect(x0 + 2, zq + 1.4, x1 - 2, zq + 1.6, yellow);
  for (let x = 1632; x < x1 - 14; x += 2.6) rect(x, ringZ(x) - 19, x + 0.12, ringZ(x) - 14, white);
  for (const [ax, az, bx, bz] of [[x1 - 16, HARBOUR.rampZ - 6, x1 - 1, HARBOUR.rampZ - 5.8], [x1 - 16, HARBOUR.rampZ + 5.8, x1 - 1, HARBOUR.rampZ + 6], [x1 - 16, HARBOUR.rampZ - 6, x1 - 15.8, HARBOUR.rampZ + 6]]) rect(ax, az, bx, bz, yellow);
  paint.flush();
  for (let x = 1634; x < x1 - 16; x += 2.6) if (r() < 0.45) kit.props.place('parkedCar', [x + 1.3, y, ringZ(x) - 16.5], r() < 0.5 ? 0 : Math.PI, 1, pick(r, [0xe8e8e4, 0x1c1d1f, 0x9aa1a6, 0xb02a24, 0x2c4f7e, 0xd8d2c4]));
  for (let x = x0 + 25; x < x1 - 10; x += 46) kit.props.streetLamp([x, y, zq + 3], 0, { height: 10, arm: 1.6, intensity: 130, range: 36, color: 0xfff1d6 });
  kit.collision.wall(x0, zq + 0.2, x1, zq + 0.2, { y0: y - 1, y1: y + 0.35, kind: 'kerb' });
  // breakwaters: concrete arms out to the entrance, tetrapods piled along the seaward face
  const arms = [[[x0, zq], [x0, -1972], [1468, -2006]], [[x1, zq], [x1, -1970], [1640, -2006]]];
  const basin = [(x0 + x1) / 2, -1950];
  for (const arm of arms) for (let k = 0; k < arm.length - 1; k++) {
    const [ax, az] = arm[k], [bx, bz] = arm[k + 1];
    const len = Math.hypot(bx - ax, bz - az), t = [(bx - ax) / len, (bz - az) / len], n = [t[1], -t[0]];
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, top = 3.2;
    B.box(cx, cz, t, n, len / 2 + 4.5, 4.5, -8, top, tileUV('plain'), tileUV('plain'), dark, grey);
    const deck = new THREE.PlaneGeometry(len + 9, 9); deck.rotateX(-Math.PI / 2); deck.rotateY(Math.atan2(t[0], t[1]) + Math.PI / 2); deck.translate(cx, top, cz);
    kit.collision.triangles(deck, 'concrete');
    // seaward side: away from the basin
    const out = (basin[0] - cx) * n[0] + (basin[1] - cz) * n[1] > 0 ? -1 : 1;
    for (let s = -len / 2 - 3; s < len / 2 + 3; s += 2.2) for (let row = 0; row < 2; row++) {
      const lat = out * (5.6 + row * 2.2 + r() * 0.8);
      const px = cx + t[0] * s + n[0] * lat, pz = cz + t[1] * s + n[1] * lat;
      kit.props.place('tetrapod', [px, -0.6 + row * -0.9 + r() * 1.6, pz], [r() * 6, r() * 6, r() * 6], 1 + r() * 0.35, null, { collide: false });
    }
  }
  // entrance lights: green on the west arm, red on the east (entering from the sea)
  for (const [x, z, col] of [[1468, -2006, 0x2fd06a], [1640, -2006, 0xff3a2a]]) beacon(kit, x, z, 3.2, col);
  // squid boats along the quay (some rafted two deep) and a few at anchor
  const hulls = [0xf4f2ec, 0x3a7bb5, 0xdfe5e6, 0x2e6e8c, 0xc8473a, 0x4c9a88, 0xf4f2ec, 0xe0b640];
  for (let x = x0 + 16; x < x1 - 12; x += 21 + r() * 4) {
    kit.props.place('squidBoat', [x, 0, zq - 3.7], r() < 0.5 ? Math.PI / 2 : -Math.PI / 2, 1.25, pick(r, hulls));
    if (r() < 0.55) kit.props.place('squidBoat', [x + (r() - 0.5) * 3, 0, zq - 9.6], r() < 0.5 ? Math.PI / 2 : -Math.PI / 2, 1.15, pick(r, hulls));
  }
  for (let z = zq - 16; z > -1962; z -= 20) kit.props.place('squidBoat', [x0 + 8.6, 0, z], r() < 0.5 ? 0 : Math.PI, 1.15, pick(r, hulls));
  for (let z = zq - 18; z > -1960; z -= 22) kit.props.place('squidBoat', [x1 - 8.6, 0, z], r() < 0.5 ? 0 : Math.PI, 1.15, pick(r, hulls));
  for (let k = 0; k < 5; k++) kit.props.place('squidBoat', [1480 + r() * 150, 0, -1925 - r() * 45], r() * 6, 1.2, pick(r, hulls));
  // Mazu, goddess of the sea, faces the harbour from the west end of the quay
  const T = templeHall(kit, shared.city.wallB, { x: 1411, z: zq + 13, y, face: Math.PI, w: 18, d: 13, h: 4.8, tiers: 2, roof: 'gold' });
  incenseBurner(kit, 1411, zq + 3.4, y + 0.02, 0.9);
  mask.rect(1399, zq, 1424, zq + 22);
  // seafood stalls along the landward wall, facing the quay
  const stallC = [0xd84a3a, 0x3a7ad8, 0xe8c24a, 0x4aa86a, 0xf2f0ea];
  for (let k = 0; k < land.length - 1; k++) {
    const [ax, az] = land[k], [bx, bz] = land[k + 1];
    if (ax < 1440 || bx > 1626) continue;
    for (let s2 = 2; s2 < 15; s2 += 4.6) {
      const t = s2 / 16, sx = ax + (bx - ax) * t, sz = az + (bz - az) * t - 2.2;
      if (r() < 0.2) continue;
      kit.props.place('stall', [sx, y, sz], Math.PI, 1, pick(r, stallC));
      if (r() < 0.6) kit.props.place('umbrella', [sx + 2.2, y, sz - 3.6], r() * 6, 1, pick(r, stallC));
    }
    if (k % 2) kit.props.place('lantern', [ax, y + 3.2, az - 0.6], 0, 1, null, { collide: false });
  }
  // the fish market: an open hall under a gabled sheet roof, crates and nets underneath
  fishMarket(kit, shared, r, { x0: 1636, x1: 1700, z0: zq + 5, z1: zq + 33, y });
  // ice plant at the west end
  slab(B, kit, 1411, zq + 34, 24, 18, 3, r, 'shutters', 'sheet', lin(0xd9d6cc), 0, y);
  mask.rect(1398, zq + 24, 1424, zq + 44);
  const hs = kit.hsigns;
  signBoard(kit, hs, hs.slot('製冰廠', 2), [1411, y + 12, zq + 24.7], Math.PI / 2, 9);
  // crates, nets and drums scattered on the quay outside the drift loop
  const crateC = [0x2f6fb5, 0x2f6fb5, 0xd84a3a, 0xe8c24a, 0xeef0ee];
  for (let k = 0; k < 60; k++) {
    const x = 1630 + r() * 76, z = zq + 2 + r() * 34;
    if (x > 1636 && x < 1700 && z > zq + 5 && z < zq + 33 && r() < 0.5) continue;
    const h = 1 + Math.floor(r() * 4), c = pick(r, crateC), rot = r() * 0.4;
    for (let q = 0; q < h; q++) kit.props.place('fishCrate', [x, y + q * 0.36, z], rot, 1, c);
  }
  for (let k = 0; k < 14; k++) kit.props.place('netPile', [x0 + 4 + r() * 28, y, zq + 2 + r() * 18], r() * 6, 0.8 + r() * 0.6, pick(r, [0x3f7d4c, 0xd86a2a, 0x2f5f9f, 0x5f8f3f]));
  for (let k = 0; k < 10; k++) kit.props.place('drum', [x0 + 30 + r() * 6, y, zq + 26 + r() * 10], 0, 1);
}

function beacon(kit, x, z, y, color) {
  const { M } = kit;
  const body = M.shared('beaconWhite', () => M.surface({ color: 0xf2f1ec, roughness: 0.6 }));
  const band = M.shared(`beaconBand${color}`, () => M.surface({ color, roughness: 0.5 }));
  const lamp = M.shared(`beaconLamp${color}`, () => { const m = M.surface({ color, emissive: color, emissiveIntensity: 0.3 }); m.userData.nightEmissive = [0.3, 6]; kit.nightMaterials.push(m); return m; });
  kit.mesh(new THREE.CylinderGeometry(1.1, 1.5, 6, 10), body, { pos: [x, y + 3, z] });
  kit.mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.2, 10), band, { pos: [x, y + 4.4, z] });
  kit.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 8), lamp, { pos: [x, y + 6.5, z], cast: false });
  kit.collision.cylinder({ x, z, r: 1.5, y0: y - 1, y1: y + 7, kind: 'pole' });
  kit.light({ pos: [x, y + 7, z], color, intensity: 60, range: 26, nightOnly: true });
}

function signBoard(kit, atlas, rect, [x, y, z], rotY, w, h = w / 4) {
  const g = atlas.geometry(rect, w, h, 0.25);
  g.rotateY(rotY); g.translate(x, y, z);
  kit.addStatic(g, atlas.material, { cast: false, receive: false });
}

function fishMarket(kit, shared, r, { x0, x1, z0, z1, y }) {
  const B = shared.city.wallB;
  const eave = y + 6.2, ridge = y + 9.4, zm = (z0 + z1) / 2;
  const roofC = lin(0x6f8ea6), post = lin(0x8f8b83);
  for (let x = x0; x <= x1 + 0.1; x += 8) for (const z of [z0, z1]) {
    B.box(x, z, [1, 0], [0, -1], 0.25, 0.25, y, eave, tileUV('plain'), null, post);
    kit.collision.cylinder({ x, z, r: 0.35, y0: y - 1, y1: eave, kind: 'pillar' });
  }
  // two roof slopes (both faces, it is open underneath) and the gable ends
  const slope = (za, ya, zb, yb) => {
    B.quad([x0 - 1, ya, za], [x1 + 1, ya, za], [x1 + 1, yb, zb], [x0 - 1, yb, zb], tileUV('sheet'), mulC(roofC, 0.7));
    B.quad([x0 - 1, yb, zb], [x1 + 1, yb, zb], [x1 + 1, ya, za], [x0 - 1, ya, za], tileUV('sheet'), roofC);
  };
  slope(z0 - 1, eave, zm, ridge); slope(zm, ridge, z1 + 1, eave);
  for (const x of [x0 - 1, x1 + 1]) {
    B.quad([x, eave, z0 - 1], [x, eave, z1 + 1], [x, ridge, zm], [x, ridge, zm], tileUV('sheetB'), roofC);
    B.quad([x, eave, z1 + 1], [x, eave, z0 - 1], [x, ridge, zm], [x, ridge, zm], tileUV('sheetB'), roofC);
  }
  // stall tables in rows with crates and styrofoam boxes on them
  for (let x = x0 + 5; x < x1 - 4; x += 7) for (const z of [z0 + 7, z1 - 7]) {
    B.box(x, z, [1, 0], [0, -1], 2.6, 1.1, y, y + 0.85, tileUV('plain'), tileUV('plain'), lin(0xc9cfd2));
    kit.collision.box({ x, z, hx: 2.6, hz: 1.1, y0: y - 1, y1: y + 0.9, kind: 'stall' });
    for (let k = 0; k < 4; k++) kit.props.place('fishCrate', [x - 2 + k * 1.3, y + 0.85, z], 0, 1, r() < 0.6 ? 0xeef0ee : 0x2f6fb5);
  }
  const hs = kit.hsigns;
  signBoard(kit, hs, hs.slot('漁港魚市', 0), [(x0 + x1) / 2, eave + 1.0, z1 + 1.2], Math.PI / 2, 14);
  kit.light({ pos: [(x0 + x1) / 2, eave - 0.6, zm], color: 0xf4fbff, intensity: 120, range: 34, nightOnly: true });
  shared.mask.rect(x0 - 2, z0 - 2, x1 + 2, z1 + 2);
}

// ------------------------------------------------------------------------------------------- lighthouses
function lighthouse(kit, shared, { x, z, striped, h }) {
  const { M } = kit;
  const gy = kit.groundY(x, z);
  const white = M.shared('lhWhite', () => M.surface({ color: 0xf3f2ee, roughness: 0.55 }));
  const black = M.shared('lhBlack', () => M.surface({ color: 0x1d1e20, roughness: 0.5 }));
  const glass = M.shared('lhGlass', () => { const m = M.surface({ color: 0x302a1a, emissive: 0xfff0b8, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.4 }); m.userData.nightEmissive = [0.3, 8]; kit.nightMaterials.push(m); return m; });
  const segs = striped ? 6 : 1, sh = h / segs;
  for (let k = 0; k < segs; k++) kit.mesh(new THREE.CylinderGeometry(2.4 - (k + 1) * 0.5 / segs, 2.4 - k * 0.5 / segs, sh, striped ? 8 : 16), striped && k % 2 ? black : white, { pos: [x, gy + sh * (k + 0.5), z] });
  kit.mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.4, 16), black, { pos: [x, gy + h + 0.2, z] });
  kit.mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 12), glass, { pos: [x, gy + h + 1.6, z], cast: false });
  kit.mesh(new THREE.ConeGeometry(1.8, 1.4, 12), black, { pos: [x, gy + h + 3.5, z] });
  // keeper's house
  slab(shared.city.wallB, kit, x + 9, z + 7, 10, 7, 1, kit.rand, 'shutters', 'tileRoof', lin(0xf1eee6), 0, gy - 0.3);
  kit.collision.cylinder({ x, z, r: 2.5, y0: gy - 1, y1: gy + h + 4, kind: 'building' });
  shared.mask.circle(x, z, 16);
  kit.light({ pos: [x, gy + h + 1.6, z], color: 0xfff0c0, intensity: 90, range: 40, nightOnly: true });
  // the sweeping beam: two long additive cones that only show at night
  const beamMat = M.shared('lhBeam', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff2c8, emissiveIntensity: 0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    m.userData.nightEmissive = [0, 1]; kit.nightMaterials.push(m); return m;
  });
  const cone = new THREE.ConeGeometry(9, 260, 16, 1, true); cone.translate(0, -130, 0); cone.rotateZ(Math.PI / 2);
  const back = cone.clone(); back.rotateY(Math.PI);
  const beam = new THREE.Mesh(kit.merge([cone, back]), beamMat);
  beam.position.set(x, gy + h + 1.6, z);
  beam.renderOrder = 3; beam.frustumCulled = false;
  kit.add(beam);
  const phase = x * 0.01;
  kit.animate((dt, t) => { beam.rotation.y = phase + t * 0.9; });
}

// ------------------------------------------------------------------------------------------- wind farm
function windFarm(kit, shared, r) {
  const { M } = kit;
  const white = M.shared('turbineWhite', () => M.surface({ color: 0xeef0ef, roughness: 0.45 }));
  const red = M.shared('aviationRed', () => { const m = M.surface({ color: 0x400806, emissive: 0xff2a1a, emissiveIntensity: 0.2 }); m.userData.nightEmissive = [0.2, 9]; kit.nightMaterials.push(m); return m; });
  const blade = new THREE.BoxGeometry(1.2, 30, 0.35); blade.translate(0, 15, 0);
  const rotorGeo = kit.merge([0, 1, 2].map((k) => blade.clone().rotateZ((k * Math.PI * 2) / 3)).concat([new THREE.SphereGeometry(1.4, 10, 8)]));
  const rotors = [];
  for (let x = -1690; x <= -1320; x += 62) {
    const px = x + (r() - 0.5) * 18, pz = coastZ(px) + 34 + r() * 22;
    const gy = kit.groundY(px, pz);
    if (gy < 1 || !shared.mask.free(px, pz)) continue;
    const H = 62;
    kit.mesh(new THREE.CylinderGeometry(1.1, 2.1, H, 12), white, { pos: [px, gy + H / 2, pz] });
    // nacelle faces into the north-east monsoon: rotor upwind, its plane square to the wind
    const yaw = Math.PI * 0.75;
    kit.mesh(new THREE.BoxGeometry(2.6, 2.8, 8), white, { pos: [px, gy + H + 1, pz], rot: [0, yaw, 0] });
    kit.mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), red, { pos: [px, gy + H + 2.6, pz], cast: false });
    kit.collision.cylinder({ x: px, z: pz, r: 2.2, y0: gy - 1, y1: gy + H, kind: 'pole' });
    const rotor = new THREE.Mesh(rotorGeo, white);
    rotor.position.set(px + Math.sin(yaw) * 4.6, gy + H + 1, pz + Math.cos(yaw) * 4.6);
    rotor.rotation.order = 'YXZ'; rotor.rotation.y = yaw;
    rotor.castShadow = true;
    kit.add(rotor);
    rotors.push([rotor, 0.9 + r() * 0.3]);
    shared.mask.circle(px, pz, 8);
  }
  kit.animate((dt) => { for (const [m, w] of rotors) m.rotation.z += dt * w; });
}

// ------------------------------------------------------------------------------------------- Yehliu
function yehliu(kit, shared, r) {
  const road = kit.roads.find((q) => q.id === 'yehliu-road');
  if (!road) return;
  const R = road.route, end = R.n - 1, ex = R.x[end], ez = R.z[end], ey = R.y[end];
  // visitor car park at the road end and a low visitor centre
  const poly = [[ex - 26, ez + 2], [ex + 26, ez + 2], [ex + 26, ez - 30], [ex - 26, ez - 30]];
  kit.pad({ poly, y: ey - 0.02, surface: 'asphalt', blend: 5 });
  shared.mask.rect(ex - 28, ez - 32, ex + 28, ez + 4);
  for (let k = 0; k < 9; k++) if (r() < 0.6) kit.props.place('parkedCar', [ex - 22 + k * 5.4, ey, ez - 26], (r() - 0.5) * 0.1, 1, pick(r, [0xe8e8e4, 0x1c1d1f, 0x9aa1a6, 0xb02a24, 0x2c4f7e]));
  slab(shared.city.wallB, kit, ex - 42, ez + 2, 20, 12, 1, r, 'shutters', 'sheet', lin(0xe8e2d2), 0, kit.groundY(ex - 42, ez + 2));
  shared.mask.rect(ex - 54, ez - 6, ex - 30, ez + 10);
  // the hoodoo field on the cape beyond
  let n = 0;
  for (let k = 0; k < 400 && n < 75; k++) {
    const x = -38 + r() * 96, z = -2290 + r() * 84;
    const gy = kit.groundY(x, z);
    if (gy < 0.6 || !shared.mask.free(x, z)) continue;
    const s = 0.6 + r() * 0.9;
    kit.props.place('hoodoo', [x, gy - 0.2, z], r() * 6, [s * (0.9 + r() * 0.3), s * (0.8 + r() * 0.5), s], pick(r, [0xd9bf86, 0xcfae78, 0xe2cc9c, 0xc49a68]), { collide: false });
    kit.collision.cylinder({ x, z, r: 0.7 * s, y0: gy - 1, y1: gy + 3 * s, kind: 'rock' });
    shared.mask.circle(x, z, 2.5);
    n++;
  }
  for (let k = 0; k < 40; k++) {
    const x = -50 + r() * 120, z = -2295 + r() * 110, gy = kit.groundY(x, z);
    if (gy < -0.5 || !shared.mask.free(x, z)) continue;
    kit.props.place('rock', [x, gy - 0.3, z], r() * 6, 0.8 + r() * 1.6, pick(r, [0xc9ab7a, 0xb8996a, 0xd6be90]));
  }
}
