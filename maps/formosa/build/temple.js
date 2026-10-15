// Taiwanese folk temples: a hall on a stone platform with red columns across the porch, carved doors, a
// curved tile roof (optionally double eaved) whose ridge sweeps up into swallowtail tips, dragons and a
// pagoda on the ridge, red lanterns under the eaves. Built on the facade atlas, so a temple costs no extra
// draw calls. Also an incense burner and a gateway arch.
import * as THREE from 'three';
import { tileUV } from './atlas.js';
import { lin, mulC } from './geom.js';

const RED = lin(0xb3261b), GOLD = lin(0xd6a63c), STONE = lin(0xb9b3a6), WALL = lin(0xc9573a);
// roof colours: [tile, tint]. Orange and red are terracotta; gold and green are glazed tiles.
const ROOFS = { orange: ['tileRoof', lin(0xffc29a)], red: ['tileRoof', lin(0xff9a86)], gold: ['glazed', lin(0xe8b236)], green: ['glazed', lin(0x4f9a62)] };
const DRAGON = [lin(0x2e9d6c), lin(0x2f6fb8), lin(0xe0b030), lin(0xd84a3a)];

/** Local frame helper: u across the front, v towards the front, yy up; face = rotation.y of the hall. */
function frame(x, z, y, face) {
  const c = Math.cos(face), s = Math.sin(face);
  const P = (u, v, yy) => [x + u * c + v * s, y + yy, z - u * s + v * c];
  return { P, t: [c, -s], n: [-s, -c] };
}

/**
 * opts: { x, z, y, face, w, d, h (wall height), roof: 'orange' | 'gold' | 'green' | 'red', tiers (1 | 2),
 *         porch (depth of the open front), lanterns, ridge: true, collide: true }
 * Returns the front porch centre [x, y, z] and the roof top height.
 */
export function templeHall(kit, B, o) {
  const { x, z, y, face = 0, w = 16, d = 12, h = 5.2, roof = 'orange', tiers = 1, porch = 2.6 } = o;
  const F = frame(x, z, y, face), P = F.P;
  const q = (a, b, c, e, uv, col) => B.quad(P(...a), P(...b), P(...c), P(...e), tileUV(uv), col);
  const box = (u, v, hu, hv, y0, y1, uv, col, top = null) => { const c = P(u, v, 0); B.box(c[0], c[2], F.t, F.n, hu, hv, y + y0, y + y1, tileUV(uv), top ? tileUV(top) : null, col, col); };
  const base = 0.7;
  // platform and steps
  box(0, 0, w / 2 + 1.2, d / 2 + 1.2, -1.5, base, 'plain', STONE, 'plain');
  box(0, d / 2 + 1.7, w * 0.22, 0.5, -1.5, base * 0.5, 'plain', mulC(STONE, 0.95), 'plain');
  // walls behind the porch, doors and a carved lintel on the front wall
  const wd = d - porch, vc = -porch / 2;
  box(0, vc, w / 2, wd / 2, base, base + h, 'plain', WALL);
  const vf = vc + wd / 2 + 0.03;
  for (const k of [-1, 0, 1]) {
    const dw = k === 0 ? w * 0.13 : w * 0.1, uc = k * w * 0.27, dh = (k === 0 ? 0.78 : 0.66) * h;
    q([uc - dw, vf, base], [uc + dw, vf, base], [uc + dw, vf, base + dh], [uc - dw, vf, base + dh], 'door', lin(0xb02a1c));
    q([uc - dw - 0.25, vf - 0.01, base + dh], [uc + dw + 0.25, vf - 0.01, base + dh], [uc + dw + 0.25, vf - 0.01, base + dh + 0.45], [uc - dw - 0.25, vf - 0.01, base + dh + 0.45], 'plain', GOLD);
  }
  q([-w / 2, vf + 0.01, base + h - 0.9], [w / 2, vf + 0.01, base + h - 0.9], [w / 2, vf + 0.01, base + h], [-w / 2, vf + 0.01, base + h], 'plain', mulC(GOLD, 0.85));
  // porch columns, a beam across them
  const nc = Math.max(4, Math.round(w / 4.2));
  for (let k = 0; k < nc; k++) box(-w / 2 + 0.4 + ((w - 0.8) * k) / (nc - 1), d / 2 - 0.45, 0.28, 0.28, base, base + h, 'plain', RED);
  box(0, d / 2 - 0.45, w / 2, 0.35, base + h - 0.7, base + h, 'plain', mulC(RED, 0.8));
  // roof (and a second, smaller roof above for double eaves)
  let top = roofTier(B, P, { hw: w / 2 + 1.5, hd: d / 2 + 1.3, ye: base + h + 0.15, rise: d * 0.3, roof, ridge: o.ridge !== false && tiers === 1 });
  if (tiers > 1) {
    const w2 = w * 0.62, d2 = d * 0.55, yb = top - d * 0.3 * 0.45;
    box(0, 0, w2 / 2, d2 / 2, yb, yb + 1.9, 'plain', WALL);
    for (let k = 0; k < 4; k++) box(-w2 / 2 + 0.3 + ((w2 - 0.6) * k) / 3, d2 / 2 - 0.2, 0.2, 0.2, yb, yb + 1.9, 'plain', RED);
    top = roofTier(B, P, { hw: w2 / 2 + 1.3, hd: d2 / 2 + 1.1, ye: yb + 1.9, rise: d2 * 0.34, roof, ridge: o.ridge !== false });
  }
  // lanterns under the front eave
  if (o.lanterns !== false) {
    const n = Math.max(3, Math.floor(w / 2.6));
    for (let k = 0; k < n; k++) { const p = P(-w / 2 + 1 + ((w - 2) * k) / (n - 1), d / 2 + 0.4, base + h - 0.4); kit.props.place('lantern', [p[0], p[1] - 0.9, p[2]], face, 1, null, { collide: false }); }
    const c = P(0, d / 2 + 1, base + h - 1);
    kit.light({ pos: c, color: 0xff6a3a, intensity: 70, range: 22, nightOnly: true });
  }
  if (o.collide !== false) kit.collision.box({ x, z, hx: w / 2 + 1.2, hz: d / 2 + 1.2, rotY: face, y0: y - 2, y1: y + base + h + 2, kind: 'building' });
  return { front: P(0, d / 2 + 3, base), top: y + top };
}

/** One roof: concave slopes front and back with eave corners curling up, gable ends, ridge with ornaments. */
function roofTier(B, P, { hw, hd, ye, rise, roof, ridge }) {
  const [tile, col] = ROOFS[roof] || ROOFS.orange;
  const yr = ye + rise, ym = ye + rise * 0.36, vm = hd * 0.5, curl = 0.75, cu = Math.min(3.2, hw * 0.3);
  const under = mulC(col, 0.45), uvR = tileUV(tile), uvP = tileUV('plain');
  const both = (a, b, c, d, uv, front, back) => { B.quad(a, b, c, d, uv, front); B.quad(b, a, d, c, uv, back); };
  // u stations across the roof: the outer bays curl up at the eaves
  const us = [-hw, -hw + cu, hw - cu, hw];
  const lift = (u) => (Math.abs(u) > hw - 0.01 ? curl : 0);
  for (const side of [1, -1]) {
    const rows = [[side * hd, ye, 1], [side * vm, ym, 0.3], [0, yr, 0]];
    for (let k = 0; k < 3; k++) {
      const ua = us[k], ub = us[k + 1];
      for (let r = 0; r < 2; r++) {
        const [va, ya, fa] = rows[r], [vb, yb, fb] = rows[r + 1];
        const a = P(ua, va, ya + lift(ua) * fa), b = P(ub, va, ya + lift(ub) * fa), c = P(ub, vb, yb + lift(ub) * fb), d = P(ua, vb, yb + lift(ua) * fb);
        // (a, b, c, d) faces up on the front slope and down on the back one
        if (side > 0) both(a, b, c, d, uvR, col, under); else both(b, a, d, c, uvR, col, under);
      }
    }
  }
  // gable ends in line with the walls (both faces)
  for (const su of [-1, 1]) {
    const u = su * (hw - 1.4);
    const prof = [[-hd + 0.3, ye], [-vm, ym], [0, yr], [vm, ym], [hd - 0.3, ye]];
    for (let k = 0; k < 4; k++) {
      const [va, ya] = prof[k], [vb, yb] = prof[k + 1];
      both(P(u, va, ye), P(u, vb, ye), P(u, vb, yb), P(u, va, ya), uvP, WALL, WALL);
    }
  }
  if (!ridge) return yr;
  // main ridge: a straight run, then each end sweeps up into a forked swallowtail
  const seg = (u0, y0, u1, y1, th, c) => {
    const up = (p) => [p[0], p[1] + th, p[2]];
    const a = P(u0, -0.22, y0), b = P(u1, -0.22, y1), cc = P(u1, 0.22, y1), d = P(u0, 0.22, y0);
    both(a, b, up(b), up(a), uvP, c, c);
    both(d, cc, up(cc), up(d), uvP, c, c);
    both(up(a), up(b), up(cc), up(d), uvP, mulC(c, 1.1), c);
  };
  const rc = lin(0xc4472e), band = lin(0x2f8f6a);
  const straight = hw - 2.6;
  seg(-straight, yr, straight, yr, 0.55, rc);
  seg(-straight, yr + 0.55, straight, yr + 0.55, 0.12, band);
  for (const su of [-1, 1]) {
    let u = su * straight, yy = yr;
    for (const [len, ang] of [[0.9, 0.2], [0.8, 0.5], [0.7, 0.9], [0.6, 1.25]]) {
      const u1 = u + su * len * Math.cos(ang), y1 = yy + len * Math.sin(ang);
      seg(u, yy, u1, y1, 0.45, rc);
      u = u1; yy = y1;
    }
    for (const sv of [-0.3, 0.3]) both(P(u, sv - 0.08, yy + 0.3), P(u + su * 0.5, sv * 1.8 - 0.08, yy + 1.1), P(u + su * 0.5, sv * 1.8 + 0.08, yy + 1.1), P(u, sv + 0.08, yy + 0.3), uvP, rc, rc);
  }
  // ornaments: a little pagoda in the middle and a dragon on each side facing it
  const o0 = P(0, 0, 0), o1 = P(1, 0, 0), t = [o1[0] - o0[0], o1[2] - o0[2]];
  const box = (u, v, hu, hv, y0, y1, c) => { const p = P(u, v, 0); B.box(p[0], p[2], t, [t[1], -t[0]], hu, hv, P(0, 0, y0)[1], P(0, 0, y1)[1], uvP, uvP, c, c); };
  box(0, 0, 0.5, 0.5, yr + 0.6, yr + 1.4, GOLD);
  box(0, 0, 0.35, 0.35, yr + 1.4, yr + 2.1, lin(0xd84a3a));
  box(0, 0, 0.2, 0.2, yr + 2.1, yr + 2.7, GOLD);
  for (const su of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const u = su * (1.2 + k * 0.55), yy = yr + 0.7 + Math.sin(k * 1.1) * 0.35 + (k === 0 ? 0.25 : 0);
      box(u, 0, k === 0 ? 0.35 : 0.3, k === 0 ? 0.28 : 0.2, yy, yy + (k === 0 ? 0.55 : 0.32), DRAGON[k % DRAGON.length]);
    }
  }
  return yr;
}

/** Bronze incense burner on legs with a little roof. */
export function incenseBurner(kit, x, z, y, s = 1) {
  const { M } = kit;
  const bronze = M.shared('bronze', () => M.surface({ color: 0x6b5530, roughness: 0.45, metalness: 0.7 }));
  const body = new THREE.CylinderGeometry(0.75 * s, 0.6 * s, 0.9 * s, 10); body.translate(0, 1.0 * s, 0);
  const legs = [0, 1, 2].map((k) => { const g = new THREE.BoxGeometry(0.16 * s, 0.6 * s, 0.16 * s); const a = (k / 3) * Math.PI * 2; g.translate(Math.cos(a) * 0.5 * s, 0.3 * s, Math.sin(a) * 0.5 * s); return g; });
  const roof = new THREE.ConeGeometry(0.95 * s, 0.7 * s, 8); roof.translate(0, 2.0 * s, 0);
  const posts = [0, 1, 2, 3].map((k) => { const g = new THREE.BoxGeometry(0.08 * s, 0.6 * s, 0.08 * s); const a = (k / 4) * Math.PI * 2 + 0.4; g.translate(Math.cos(a) * 0.55 * s, 1.75 * s, Math.sin(a) * 0.55 * s); return g; });
  const g = kit.merge([body, ...legs, roof, ...posts]); g.translate(x, y, z);
  kit.addStatic(g, bronze, { cast: true });
  kit.collision.cylinder({ x, z, r: 0.8 * s, y0: y - 1, y1: y + 2.4 * s, kind: 'pillar' });
}

/** Gateway arch (paifang): two or four red columns, a lintel with a name board, a small tile roof. */
export function templeGate(kit, B, { x, z, y, face = 0, w = 10, h = 6.5, name = null, palette = 0 }) {
  const F = frame(x, z, y, face), P = F.P;
  const box = (u, v, hu, hv, y0, y1, col, top = null) => { const c = P(u, v, 0); B.box(c[0], c[2], F.t, F.n, hu, hv, y + y0, y + y1, tileUV('plain'), top ? tileUV(top) : null, col, col); };
  for (const u of [-w / 2, w / 2]) { box(u, 0, 0.35, 0.35, 0, h, RED); kit.collision.box({ x: P(u, 0, 0)[0], z: P(u, 0, 0)[2], hx: 0.4, hz: 0.4, rotY: face, y0: y - 1, y1: y + h, kind: 'pillar' }); }
  box(0, 0, w / 2 + 0.6, 0.3, h - 1.2, h - 0.6, mulC(RED, 0.85));
  roofTier(B, P, { hw: w / 2 + 1.2, hd: 1.2, ye: h, rise: 0.9, roof: 'orange', ridge: false });
  if (name) {
    const rect = kit.hsigns.slot(name, palette);
    const g = kit.hsigns.geometry(rect, Math.min(w * 0.6, 6), 1.1, 0.2);
    g.rotateY(face + Math.PI / 2);
    const c = P(0, 0, h - 1.75);
    g.translate(c[0], c[1], c[2]);
    kit.addStatic(g, kit.hsigns.material, { cast: false, receive: false });
  }
}

/** A palace roof on its own (hotels, gates, pavilions): centred on (x, z), eaves at y, ridge along the width. */
export function palaceRoof(B, { x, z, y, face = 0, hw, hd, rise, roof = 'orange', ridge = true }) {
  const F = frame(x, z, 0, face);
  return roofTier(B, F.P, { hw, hd, ye: y, rise, roof, ridge });
}
