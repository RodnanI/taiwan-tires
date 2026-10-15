// Street walls: a continuous frontage of lots along a street edge, Taipei style. Lots share party walls, so
// only the street face, the roof, the back and any stepped side walls are built. Every face is one atlas quad
// per bay and floor; signs, arcades and rooftop sheds come on top. Returns the lots (for props and collision).
import * as THREE from 'three';
import { tileUV, LIT } from './atlas.js';
import { lin, mulC } from './geom.js';

const G_H = 4.2, U_H = 3.2;   // ground floor and upper floor heights
const pick = (r, list) => list[Math.floor(r() * list.length)];

// wall tints (sRGB) per style: Taipei's tiled facades in faded pastels, greys and brick
export const STYLES = {
  old: { w: [5, 8], floors: [2, 4], qilou: 0.85, signs: 0.8, shed: 0.35, uppers: ['arch', 'shutters', 'brick', 'twin', 'grille'], grounds: ['shop', 'tea', 'shopB', 'closed', 'pharmacy', 'eatery', 'market'], tints: [0xf0dfc8, 0xe6c7a8, 0xd8b59a, 0xe9e2cf, 0xcfd8c5, 0xd9c2b0] },
  shop: { w: [4.5, 7.5], floors: [4, 6], qilou: 0.6, signs: 0.9, shed: 0.55, uppers: ['grille', 'grille', 'ac', 'balcony', 'twin', 'enclosed', 'laundry'], grounds: ['shop', 'shopB', 'shopC', 'eatery', 'closed', 'scooterShop', 'conv', 'pharmacy', 'tea', 'closedB'], tints: [0xf2ece0, 0xe8d9d0, 0xd5dde0, 0xe9e1cc, 0xd4dcd0, 0xf0e2d6, 0xcfd1d4, 0xe2cfc0] },
  apartment: { w: [14, 24], floors: [5, 7], qilou: 0.15, signs: 0.25, shed: 0.65, uppers: ['apt', 'apt', 'enclosed', 'laundry', 'grille', 'ac'], grounds: ['closed', 'garage', 'shop', 'gate', 'closedB', 'conv', 'blank'], tints: [0xdedbd3, 0xcfcac0, 0xd8d0c4, 0xc6c9c9, 0xe0d7c9, 0xbfc3bd] },
  commercial: { w: [8, 16], floors: [6, 12], qilou: 0.7, signs: 1.0, shed: 0.3, uppers: ['hotel', 'band', 'grid', 'enclosed', 'ac', 'twin'], grounds: ['shop', 'eatery', 'conv', 'shopB', 'shopC', 'tea', 'pharmacy', 'eatery'], tints: [0xeae6dd, 0xdcd6cc, 0xe4dccf, 0xc9ccd0, 0xd8cfc6] },
  lane: { w: [9, 18], floors: [3, 5], qilou: 0, signs: 0.3, shed: 0.6, uppers: ['apt', 'grille', 'laundry', 'enclosed', 'ac', 'balcony'], grounds: ['closed', 'garage', 'shop', 'gate', 'closedB', 'blank', 'scooterShop'], tints: [0xdedbd3, 0xe8d9d0, 0xd5dde0, 0xe9e1cc, 0xcfd1d4, 0xe2cfc0, 0xc9c3b6] },
  // rural townhouses (透天厝): narrow, three or four storeys, tiled in pale colours, iron sheds on the roof
  farm: { w: [5.5, 7.5], floors: [3, 4], qilou: 0, signs: 0.08, shed: 0.75, uppers: ['balcony', 'grille', 'twin', 'enclosed', 'balcony'], grounds: ['garage', 'closed', 'gate', 'closedB', 'garage'], tints: [0xf3efe6, 0xf0d9d4, 0xe8e0c8, 0xd4e0e6, 0xdce8d4, 0xf2e4c4] },
  tower: { w: [30, 48], floors: [16, 34], qilou: 0, signs: 0.1, shed: 0, uppers: ['curtain', 'band', 'fins', 'grid'], grounds: ['lobby', 'lobby', 'shopC', 'conv'], tints: [0xa9b9c4, 0x9fb0ae, 0xb7b0a2, 0xc7cdd1, 0x8fa1b0, 0xbcc6c3] },
};

/**
 * ctx: { kit, wallB (Builder on the atlas), signB (Builder on the vertical sign atlas), hsignB, vsigns, hsigns, rand, lots }
 * o: { a: [x, z], b: [x, z], n: [nx, nz] unit vector from the street into the lots, depth, style, y,
 *      gaps: [[s0, s1]...] metres along a->b kept open (lanes), floors: [min, max] override, qilou, litChance }
 */
export function streetWall(ctx, o) {
  const { kit, rand: r } = ctx;
  const S = STYLES[o.style] || STYLES.shop;
  const dx = o.b[0] - o.a[0], dz = o.b[1] - o.a[1], len = Math.hypot(dx, dz);
  if (len < 4) return [];
  const t = [dx / len, dz / len];
  const n = o.n;
  // front faces must face the street (-n): wall(a->b) faces (-tz, tx)
  const flip = -t[1] * n[0] + t[0] * n[1] > 0;
  const y0 = o.y ?? 0;
  const depth = o.depth ?? 16;
  const litChance = o.litChance ?? 0.26;
  const qilouAll = o.qilou ?? (r() < S.qilou);
  const gaps = o.gaps || [];
  const P = (s, d, y) => [o.a[0] + t[0] * s + n[0] * d, y0 + y, o.a[1] + t[1] * s + n[1] * d];
  const lots = [];
  let s = 0;
  while (s < len - 3) {
    const gap = gaps.find(([g0, g1]) => s >= g0 - 0.5 && s < g1);
    if (gap) { s = gap[1]; continue; }
    const nextGap = gaps.filter(([g0]) => g0 > s).reduce((m, [g0]) => Math.min(m, g0), len);
    let w = S.w[0] + r() * (S.w[1] - S.w[0]);
    if (nextGap - (s + w) < S.w[0] * 0.8) w = nextGap - s;            // absorb a sliver
    w = Math.min(w, nextGap - s);
    if (w < 3) { s += w; continue; }
    const mid = P(s + w / 2, depth / 2, 0);
    if (ctx.keepOut && ctx.keepOut.some((K) => Math.hypot(mid[0] - K.x, mid[2] - K.z) < K.r)) { s += w; continue; }
    const fl = o.floors || S.floors;
    let floors = Math.round(fl[0] + Math.pow(r(), 1.4) * (fl[1] - fl[0]));
    const H = G_H + (floors - 1) * U_H;
    lots.push({ s0: s, s1: s + w, w, floors, H, tint: lin(pick(r, S.tints)), upper: pick(r, S.uppers), ground: pick(r, S.grounds), qilou: qilouAll && o.style !== 'tower', d: depth * (0.85 + r() * 0.3) });
    s += w;
  }
  // geometry
  const B = ctx.wallB;
  const face = (sa, sb, d, ya, yb, uv, c) => {
    const p0 = P(sa, d, ya), p1 = P(sb, d, ya), p2 = P(sb, d, yb), p3 = P(sa, d, yb);
    if (flip) B.quad(p1, p0, p3, p2, uv, c); else B.quad(p0, p1, p2, p3, uv, c);
  };
  // back faces face +n: reverse of a front face
  const back = (sa, sb, d, ya, yb, uv, c) => {
    const p0 = P(sa, d, ya), p1 = P(sb, d, ya), p2 = P(sb, d, yb), p3 = P(sa, d, yb);
    if (flip) B.quad(p0, p1, p2, p3, uv, c); else B.quad(p1, p0, p3, p2, uv, c);
  };
  // side wall across the lot at s (facing -t if dir < 0, +t if dir > 0)
  const side = (sv, d0, d1, ya, yb, dir, uv, c) => {
    const p0 = P(sv, d0, ya), p1 = P(sv, d1, ya), p2 = P(sv, d1, yb), p3 = P(sv, d0, yb);
    const facesPlusT = (() => { const ux = p1[0] - p0[0], uz = p1[2] - p0[2]; return -uz * t[0] + ux * t[1] > 0; })();
    if (facesPlusT === dir > 0) B.quad(p0, p1, p2, p3, uv, c); else B.quad(p1, p0, p3, p2, uv, c);
  };
  const roofQuad = (sa, sb, d0, d1, yy, uv, c) => {
    const a = P(sa, d0, yy), b = P(sb, d0, yy), cc = P(sb, d1, yy), d = P(sa, d1, yy);
    // up-facing: (b - a) x (d - a) must point up
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = d[0] - a[0], vz = d[2] - a[2];
    if (uz * vx - ux * vz > 0) B.quad(a, b, cc, d, uv, c); else B.quad(b, a, d, cc, uv, c);
  };
  const roofC = lin(0x9f9b93), shedTints = [0x5f8fc0, 0xd8dcd8, 0x9fb2b8, 0x6f9a83, 0xc9c0a6, 0x4d79a8];
  const arcade = 2.7;
  lots.forEach((L, k) => {
    const prev = lots[k - 1], next = lots[k + 1];
    const nb = Math.max(1, Math.round(L.w / (o.style === 'tower' ? 4.2 : 3.4)));
    const bw = L.w / nb;
    const front = L.qilou ? arcade : 0;
    // ground floor
    for (let b = 0; b < nb; b++) {
      const g = L.ground === 'conv' && b > 0 ? 'shop' : (r() < 0.2 ? pick(r, S.grounds) : L.ground);
      face(L.s0 + b * bw, L.s0 + (b + 1) * bw, front, 0, G_H, tileUV(g), [1, 1, 1]);
    }
    if (L.qilou) {
      // arcade ceiling, pillars at the street line, a lintel over them
      const ceil = lin(0xd8d2c6);
      const a = P(L.s0, 0, G_H - 0.05), b = P(L.s1, 0, G_H - 0.05), c2 = P(L.s1, arcade, G_H - 0.05), d = P(L.s0, arcade, G_H - 0.05);
      const ux = b[0] - a[0], uz = b[2] - a[2], vx = d[0] - a[0], vz = d[2] - a[2];
      if (uz * vx - ux * vz > 0) B.quad(b, a, d, c2, tileUV('plain'), ceil); else B.quad(a, b, c2, d, tileUV('plain'), ceil);
      for (let b2 = 0; b2 <= nb; b2++) {
        if (b2 === 0 && prev?.qilou) continue; // shared pillar
        const sp = L.s0 + b2 * bw, c = P(sp, 0.3, 0);
        B.box(c[0], c[2], t, [t[1], -t[0]], 0.25, 0.25, y0, y0 + G_H, tileUV('plain'), null, mulC(L.tint, 0.92));
      }
      face(L.s0, L.s1, 0, G_H - 0.9, G_H, tileUV('plain'), mulC(L.tint, 0.95));
      // arcade end walls when the neighbour has no arcade
      if (!prev?.qilou) side(L.s0, 0, arcade, 0, G_H, 1, tileUV('wall'), L.tint);
      if (!next?.qilou) side(L.s1, 0, arcade, 0, G_H, -1, tileUV('wall'), L.tint);
    }
    // upper floors
    for (let f = 1; f < L.floors; f++) {
      const ya = G_H + (f - 1) * U_H, yb = ya + U_H;
      for (let b = 0; b < nb; b++) {
        let up = L.upper;
        if (o.style !== 'tower' && r() < 0.18) up = pick(r, S.uppers);
        if (LIT[up] && r() < litChance) up = LIT[up];
        face(L.s0 + b * bw, L.s0 + (b + 1) * bw, 0, ya, yb, tileUV(up), L.tint);
      }
    }
    // parapet band on the roof edge
    face(L.s0, L.s1, 0, L.H, L.H + 0.8, tileUV('plain'), mulC(L.tint, 0.9));
    // roof, back
    roofQuad(L.s0, L.s1, 0, L.d, L.H + 0.02, tileUV(r() < 0.5 ? 'roof' : 'roofB'), roofC);
    for (let f = 0; f < L.floors; f++) {
      const ya = f === 0 ? 0 : G_H + (f - 1) * U_H, yb = f === 0 ? G_H : ya + U_H;
      back(L.s0, L.s1, L.d, ya, yb, tileUV(f === 0 ? 'blank' : r() < 0.5 ? 'ac' : (r() < litChance ? 'grilleLit' : 'grille')), mulC(L.tint, 0.86));
    }
    // stepped side walls where the neighbour is lower (or missing), shallower lots expose their flank too
    const exposed = (nbL, sv, dir) => {
      const h0 = nbL ? Math.min(nbL.H, L.H) : 0;
      if (L.H - h0 > 0.2) side(sv, 0, L.d, h0, L.H + 0.8, dir, tileUV(r() < 0.5 ? 'wall' : 'vent'), mulC(L.tint, 0.8));
      if (nbL && nbL.d < L.d - 0.5) side(sv, nbL.d, L.d, 0, Math.min(nbL.H, L.H), dir, tileUV('wall'), mulC(L.tint, 0.8));
    };
    exposed(prev && Math.abs(prev.s1 - L.s0) < 0.01 ? prev : null, L.s0, -1);
    exposed(next && Math.abs(next.s0 - L.s1) < 0.01 ? next : null, L.s1, 1);
    // rooftop iron-sheet shed (the Taipei skyline): a box with sheet metal walls and roof
    if (r() < S.shed && L.floors >= 3) {
      const sw = L.w * (0.5 + r() * 0.4), sd = L.d * (0.35 + r() * 0.35), sc = lin(pick(r, shedTints));
      const c = P(L.s0 + L.w / 2, L.d * 0.55, 0);
      B.box(c[0], c[2], t, [t[1], -t[0]], sw / 2, sd / 2, y0 + L.H, y0 + L.H + 2.5, tileUV(r() < 0.6 ? 'sheet' : 'sheetB'), tileUV('sheet'), sc, mulC(sc, 1.05));
    }
    L.front = P(L.s0 + L.w / 2, 0, 0);
    L.t = t; L.n = n;
  });
  // signs
  if (ctx.signB) for (const L of lots) {
    if (r() > S.signs) continue;
    const count = L.w > 9 ? 2 : 1;
    for (let k = 0; k < count && L.floors >= 2; k++) {
      const sv = L.s0 + L.w * (count === 1 ? 0.25 + r() * 0.5 : (k + 0.5) / count);
      const h = Math.min(L.H - G_H - 0.4, 3 + r() * 5);
      if (h < 2) continue;
      const yb = G_H + 0.4 + r() * Math.max(0, L.H - G_H - h - 0.6);
      const c = P(sv, -0.75, yb + h / 2);
      const rect = ctx.vsign(r);
      const g = ctx.vsigns.geometry(rect, 1.0, h, 0.24);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(t[0], 0, t[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], 0, n[1])).setPosition(c[0], c[1], c[2]));
      ctx.kit.addStatic(g, ctx.vsigns.material, { cast: false, receive: false });
    }
    // fascia board over the shopfront
    if (r() < 0.8 && L.ground !== 'conv') {
      const c = P(L.s0 + L.w / 2, (L.qilou ? 0 : 0) - 0.18, G_H - 0.55);
      const rect = ctx.hsign(r);
      const g = ctx.hsigns.geometry(rect, Math.min(L.w * 0.86, 8), 0.95, 0.2);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(-n[0], 0, -n[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(flip ? -t[0] : t[0], 0, flip ? -t[1] : t[1])).setPosition(c[0], c[1], c[2]));
      ctx.kit.addStatic(g, ctx.hsigns.material, { cast: false, receive: false });
    }
  }
  // collision: one box per lot run (cheap broadphase entries)
  for (const L of lots) {
    const c = P(L.s0 + L.w / 2, L.d / 2, 0);
    kit.collision.box({ x: c[0], z: c[2], hx: L.w / 2, hz: L.d / 2, rotY: Math.atan2(t[0], t[1]) - Math.PI / 2, y0: y0 - 2, y1: y0 + L.H + 1, kind: 'building' });
    if (L.qilou) { /* the arcade is walkable but cars hit the pillars: the lot box starts at the street line anyway */ }
  }
  B.flush();
  return lots;
}
