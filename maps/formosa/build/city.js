// The Taipei basin: every block between the avenues gets street walls on its four sides, a cross of lanes
// with their own rows, and a feature in each quadrant core (apartment courts, parking, parks, schools,
// neighbourhood temples, markets). Districts pick the style: Dadaocheng and Wanhua (old town) in the west,
// Ximending (commercial) around Zhonghua, Xinyi towers in the east, homes and shophouses in between.
import * as THREE from 'three';
import { SignAtlas, SHOP_NAMES } from '../../../src/maps/kit/signs.js';
import { makeFacadeAtlas, tileUV } from './atlas.js';
import { Builder, lin, mulC } from './geom.js';
import { streetWall } from './streetwall.js';
import { EW, NS, LEVEE_X, HEPING_Z, EAST_X, ROUNDABOUT, ELEVATED_Z, ELEVATED_X } from '../city-plan.js';
import { CITY_Y, CITY } from '../geo.js';

const Y = CITY_Y;
const SIDEWALK = 3.2;

/** District style for a point in the basin. */
export function districtAt(x, z) {
  if (x > 150 && z > 1000 && z < 2000) return 'tower';                         // Xinyi
  if (x < -1300) return 'old';                                                   // Dadaocheng / Wanhua by the river
  if (x > -1300 && x < -950 && z > 1000 && z < 1700) return 'commercial';        // Ximending
  if (Math.abs(z - 1120) < 40 || Math.abs(z - 1420) < 40) return 'commercial';   // Zhongxiao / Ren'ai frontages
  if (z > HEPING_Z + 20) return 'apartment';                                     // Gongguan / university quarter
  return (Math.floor(x / 350) + Math.floor(z / 300)) % 3 === 0 ? 'apartment' : 'shop';
}

export function buildCity(kit, r, shared) {
  const atlas = makeFacadeAtlas(kit.M, kit.nightMaterials);
  const wallB = new Builder(kit, atlas.mat);
  // a bigger vertical sign atlas than the kit default: 64 different boards
  const vsigns = new SignAtlas(kit.M, { cols: 16, rows: 4, slotW: 64, slotH: 256 });
  vsigns.material.userData.nightEmissive = [0.05, 1.5];
  kit.nightMaterials.push(vsigns.material);
  const hsigns = kit.hsigns;
  const VS = [], HS = [];
  for (let i = 0; i < 64; i++) VS.push(vsigns.slot(SHOP_NAMES[i % SHOP_NAMES.length] + (i >= SHOP_NAMES.length ? ['館', '行', '店', '坊'][i % 4] : ''), i % 10));
  for (let i = 0; i < 56; i++) HS.push(hsigns.slot(SHOP_NAMES[(i * 7) % SHOP_NAMES.length] + ['', '專賣', '老店', '大王'][i % 4], (i * 3) % 10));
  const ctx = { kit, rand: r, wallB, vsigns, hsigns, keepOut: shared.keepOut, vsign: (rr) => VS[Math.floor(rr() * VS.length)], hsign: (rr) => HS[Math.floor(rr() * HS.length)], signB: true };
  shared.city = { atlas, wallB, ctx };

  const roadHalf = (id) => (EW.find((a) => a.id === id) || NS.find((a) => a.id === id))?.w / 2 ?? 7;
  const xs = [{ x: LEVEE_X, w: 12 }, ...NS.map((a) => ({ x: a.x, w: a.w }))];
  const zs = [...EW.filter((a) => a.z < HEPING_Z).map((a) => ({ z: a.z, w: a.w })), { z: HEPING_Z, w: 12 }, ...EW.filter((a) => a.z > HEPING_Z).map((a) => ({ z: a.z, w: a.w }))];
  const lots = [];
  const features = [];
  // keep-outs: landmarks and the elevated's pillar line
  const reserved = shared.reserved || [];
  const isReserved = (x, z, pad = 0) => reserved.some((R) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad);

  const frontage = (a, b, n, style, opts = {}) => {
    const res = streetWall(ctx, { a, b, n, style, y: Y, depth: opts.depth ?? (style === 'tower' ? 34 : 17), gaps: opts.gaps, floors: opts.floors, qilou: opts.qilou, litChance: opts.lit });
    lots.push(...res.map((L) => ({ ...L, style })));
    return res;
  };

  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const X0 = xs[i].x + xs[i].w / 2 + SIDEWALK, X1 = xs[i + 1].x - xs[i + 1].w / 2 - SIDEWALK;
    const Z0 = zs[j].z + zs[j].w / 2 + SIDEWALK, Z1 = zs[j + 1].z - zs[j + 1].w / 2 - SIDEWALK;
    if (X1 - X0 < 40 || Z1 - Z0 < 40) continue;
    const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    if (isReserved(cx, cz)) { buildReservedBlock(cx, cz); continue; }
    const style = districtAt(cx, cz);
    // the elevated crosses blocks at z = ELEVATED_Z: keep a corridor under the deck open
    const elevCut = Z0 < ELEVATED_Z && Z1 > ELEVATED_Z && X1 > LEVEE_X + 200;
    const elevSouth = X0 < ELEVATED_X + 30 && X1 > ELEVATED_X - 30;
    // lane cross (alleys) with gaps in the frontage where they meet the avenues
    const laneX = cx + (r() - 0.5) * 40, laneZ = elevCut ? ELEVATED_Z : cz + (r() - 0.5) * 40;
    const LW = elevCut ? 26 : 7;
    const gapNS = [[laneX - X0 - 3.5, laneX - X0 + 3.5]], gapEW = [[laneZ - Z0 - LW / 2, laneZ - Z0 + LW / 2]];
    const D = style === 'tower' ? 34 : 17;
    // avenue frontages: north and south sides run corner to corner, east and west fit between them
    frontage([X0, Z0], [X1, Z0], [0, 1], style, { gaps: gapNS, depth: D });
    frontage([X0, Z1], [X1, Z1], [0, -1], style, { gaps: gapNS, depth: D });
    frontage([X0, Z0 + D], [X0, Z1 - D], [1, 0], style, { gaps: [[laneZ - (Z0 + D) - LW / 2, laneZ - (Z0 + D) + LW / 2]], depth: D });
    if (!elevSouth) frontage([X1, Z0 + D], [X1, Z1 - D], [-1, 0], style, { gaps: [[laneZ - (Z0 + D) - LW / 2, laneZ - (Z0 + D) + LW / 2]], depth: D });
    // lane rows and quadrant cores
    const inner = { x0: X0 + D + 1, x1: X1 - D - 1, z0: Z0 + D + 1, z1: Z1 - D - 1 };
    const laneStyle = style === 'old' ? 'old' : 'lane';
    const rowD = 12;
    const quads = [[inner.x0, laneX - 3.5, inner.z0, laneZ - LW / 2], [laneX + 3.5, inner.x1, inner.z0, laneZ - LW / 2], [inner.x0, laneX - 3.5, laneZ + LW / 2, inner.z1], [laneX + 3.5, inner.x1, laneZ + LW / 2, inner.z1]];
    for (const [qx0, qx1, qz0, qz1] of quads) {
      if (qx1 - qx0 < 24 || qz1 - qz0 < 24) continue;
      // rows facing the N-S lane and the E-W lane
      const facesLaneX = Math.abs(qx1 - (laneX - 3.5)) < 0.1 ? 'east' : 'west';
      const facesLaneZ = Math.abs(qz1 - (laneZ - LW / 2)) < 0.1 ? 'south' : 'north';
      const lx = facesLaneX === 'east' ? qx1 : qx0, lz = facesLaneZ === 'south' ? qz1 : qz0;
      const floorsLane = laneStyle === 'apartment' ? [4, 6] : [3, 5];
      if (!elevCut || facesLaneZ !== 'south' && facesLaneZ !== 'north') {
        frontage([lx, qz0 + (facesLaneZ === 'north' ? rowD : 0)], [lx, qz1 - (facesLaneZ === 'south' ? rowD : 0)], [facesLaneX === 'east' ? -1 : 1, 0], laneStyle === 'tower' ? 'shop' : laneStyle, { depth: rowD, floors: floorsLane, qilou: false, lit: 0.3 });
      }
      if (!elevCut) frontage([qx0, lz], [qx1, lz], [0, facesLaneZ === 'south' ? -1 : 1], laneStyle === 'tower' ? 'shop' : laneStyle, { depth: rowD, floors: floorsLane, qilou: false, lit: 0.3 });
      else frontage([qx0, lz], [qx1, lz], [0, facesLaneZ === 'south' ? -1 : 1], 'shop', { depth: rowD, floors: [2, 4], qilou: true, lit: 0.35 });
      // core
      const core = { x0: facesLaneX === 'east' ? qx0 : qx0 + rowD + 1, x1: facesLaneX === 'east' ? qx1 - rowD - 1 : qx1, z0: facesLaneZ === 'north' ? qz0 + rowD + 1 : qz0, z1: facesLaneZ === 'south' ? qz1 - rowD - 1 : qz1 };
      if (core.x1 - core.x0 > 20 && core.z1 - core.z0 > 20) features.push({ ...core, style });
    }
  }

  function buildReservedBlock() { /* landmark blocks are built by their own builders */ }

  // quadrant cores
  for (const F of features) buildCore(kit, ctx, F, r, shared);
  wallB.flush();
  return { lots, features };
}

/** Fill the core of a quadrant: apartment court, parking, a pocket park, a school, a temple or a market. */
function buildCore(kit, ctx, F, r, shared) {
  const w = F.x1 - F.x0, d = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
  const roll = r();
  const B = ctx.wallB;
  const big = w > 55 && d > 55;
  if (F.style === 'tower' && big) { towerOnPodium(kit, ctx, F, r); return; }
  if (big && roll < 0.12) { school(kit, ctx, F, r, shared); return; }
  if (roll < 0.45) {
    // apartment court: freestanding mid-rise slabs with windows all round
    const n = Math.max(1, Math.floor(w / 30));
    for (let k = 0; k < n; k++) {
      const bw = Math.min(26, w / n - 6), bd = Math.min(14, d - 10), bx = F.x0 + (k + 0.5) * (w / n), bz = cz + (r() - 0.5) * Math.max(0, d - bd - 10);
      slab(B, kit, bx, bz, bw, bd, 6 + Math.floor(r() * 7), r, F.style === 'tower' ? 'band' : 'apt');
    }
    scatterParked(kit, F, r, 0.08);
  } else if (roll < 0.68) {
    // parking lot: scooters and cars on bare concrete, a few shade trees
    scatterParked(kit, F, r, 1);
    for (let k = 0; k < Math.round(w * d / 900); k++) kit.props.place('broadleaf', [F.x0 + 3 + r() * (w - 6), CITY_Y, F.z0 + 3 + r() * (d - 6)], r() * 6, 0.8 + r() * 0.4, treeTint(r));
  } else if (roll < 0.86) {
    // pocket park with a banyan, benches and an earth god shrine
    kit.props.place('banyan', [cx, CITY_Y, cz], r() * 6, 0.9 + r() * 0.4, treeTint(r));
    for (let k = 0; k < 6; k++) kit.props.place('broadleaf', [F.x0 + 4 + r() * (w - 8), CITY_Y, F.z0 + 4 + r() * (d - 8)], r() * 6, 0.7 + r() * 0.5, treeTint(r));
    for (let k = 0; k < 4; k++) kit.props.place('bench', [cx + (r() - 0.5) * w * 0.6, CITY_Y, cz + (r() - 0.5) * d * 0.6], r() * 6);
    kit.props.place('shrine', [F.x0 + 3, CITY_Y, F.z0 + 3], r() * 6);
    shared.parks?.push({ x: cx, z: cz, r: Math.min(w, d) / 2 });
  } else {
    // traditional market hall: a low wide roof over stalls
    const mw = Math.min(w - 6, 60), md = Math.min(d - 6, 40);
    slab(B, kit, cx, cz, mw, md, 2, r, 'shutters', 'sheet', lin(0xd6d0c2));
    for (let k = 0; k < 6; k++) kit.props.place('stall', [cx + (r() - 0.5) * mw, CITY_Y, cz + md / 2 + 2.5], 0, 1, [0xd84a3a, 0x3a7ad8, 0xe8c24a, 0x4aa86a][k % 4]);
  }
}

export const treeTint = (r) => [0x9fc38a, 0x8fb878, 0xb2cf92, 0x86ac70][Math.floor(r() * 4)];

/** Freestanding slab building (windows on all four faces) on the atlas. */
export function slab(B, kit, x, z, w, d, floors, r, upper = 'apt', roof = null, tintOverride = null, rot = 0, y = CITY_Y) {
  const tint = tintOverride || lin([0xdedbd3, 0xcfcac0, 0xd8d0c4, 0xc6c9c9, 0xe0d7c9][Math.floor(r() * 5)]);
  const H = 4.2 + (floors - 1) * 3.2;
  const c = Math.cos(rot), s = Math.sin(rot);
  const L = (lx, lz, yy) => [x + lx * c + lz * s, y + yy, z - lx * s + lz * c];
  const lit = { apt: 'aptLit', band: 'bandLit', grille: 'grilleLit', shutters: 'shuttersLit', curtain: 'curtainLit', hotel: 'hotelLit', grid: 'gridLit', fins: 'finsLit' };
  const faces = [[[-w / 2, d / 2], [w / 2, d / 2], w], [[w / 2, d / 2], [w / 2, -d / 2], d], [[w / 2, -d / 2], [-w / 2, -d / 2], w], [[-w / 2, -d / 2], [-w / 2, d / 2], d]];
  for (const [[ax, az], [bx, bz], len] of faces) {
    const nb = Math.max(1, Math.round(len / 3.6));
    for (let f = 0; f < floors; f++) {
      const ya = f === 0 ? 0 : 4.2 + (f - 1) * 3.2, yb = f === 0 ? 4.2 : ya + 3.2;
      for (let k = 0; k < nb; k++) {
        const t0 = k / nb, t1 = (k + 1) / nb;
        const px0 = ax + (bx - ax) * t0, pz0 = az + (bz - az) * t0, px1 = ax + (bx - ax) * t1, pz1 = az + (bz - az) * t1;
        const tile = f === 0 ? (r() < 0.5 ? 'closed' : 'lobby') : (lit[upper] && r() < 0.3 ? lit[upper] : upper);
        B.quad(L(px0, pz0, ya), L(px1, pz1, ya), L(px1, pz1, yb), L(px0, pz0, yb), tileUV(tile), f === 0 ? [1, 1, 1] : tint);
      }
    }
  }
  B.quad(L(-w / 2, d / 2, H), L(w / 2, d / 2, H), L(w / 2, -d / 2, H), L(-w / 2, -d / 2, H), tileUV(roof || 'roof'), roof === 'sheet' ? lin(0x7a95a8) : lin(0x9f9b93));
  kit.collision.box({ x, z, hx: w / 2, hz: d / 2, rotY: rot, y0: y - 2, y1: y + H + 1, kind: 'building' });
  return H;
}

function scatterParked(kit, F, r, density) {
  const w = F.x1 - F.x0, d = F.z1 - F.z0;
  const carColors = [0xe8e8e4, 0x1c1d1f, 0x9aa1a6, 0xb02a24, 0x2c4f7e, 0xd8d2c4, 0x3c3f42, 0x7f8c8d];
  for (let row = 0; row * 7 + 6 < d; row++) {
    if (row % 2 === 1) continue; // aisle
    const zz = F.z0 + 4 + row * 7;
    for (let xx = F.x0 + 3; xx < F.x1 - 3; xx += 2.8) if (r() < 0.22 * density) kit.props.place('parkedCar', [xx, CITY_Y, zz], (row % 2 ? 0 : Math.PI) + (r() - 0.5) * 0.08, 1, carColors[Math.floor(r() * carColors.length)]);
  }
}

/** A school: red running track around a field and a four-storey U-shaped building. */
function school(kit, ctx, F, r, shared) {
  const w = F.x1 - F.x0, d = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
  const tw = Math.min(w - 8, 90), td = Math.min(d - 30, 55);
  // track: a stadium shape (red), field inside (green)
  const shape = (ow, od, y) => { const s = new THREE.Shape(); const rr = od / 2; s.absarc(-ow / 2 + rr, 0, rr, Math.PI / 2, Math.PI * 1.5, false); s.absarc(ow / 2 - rr, 0, rr, -Math.PI / 2, Math.PI / 2, false); const g = new THREE.ShapeGeometry(s, 12); g.rotateX(-Math.PI / 2); g.translate(cx, CITY_Y + y, cz - d * 0.12); return g; };
  kit.addStatic(shape(tw, td, 0.05), kit.M.shared('trackRed', () => kit.M.surface({ color: 0xa84a3c, roughness: 0.85 })), { cast: false });
  kit.addStatic(shape(tw - 12, td - 12, 0.07), kit.M.shared('fieldGreen', () => kit.M.surface({ color: 0x4f7e3a, roughness: 0.95 })), { cast: false });
  slab(ctx.wallB, kit, cx, F.z1 - 8, Math.min(w - 10, 70), 12, 4, r, 'balcony', null, lin(0xe9e1cf));
  for (let k = 0; k < 10; k++) kit.props.place('broadleaf', [F.x0 + 3 + r() * (w - 6), CITY_Y, F.z0 + 2 + r() * 4], r() * 6, 0.9, treeTint(r));
}

/** Xinyi: a podium with a glass tower on top. */
function towerOnPodium(kit, ctx, F, r) {
  const w = F.x1 - F.x0, d = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
  const tw = Math.min(w - 10, 32), td = Math.min(d - 10, 28);
  const H = slab(ctx.wallB, kit, cx, cz, Math.min(w - 4, 60), Math.min(d - 4, 50), 4, r, 'band', null, lin(0xc9cdd0));
  const up = ['curtain', 'band', 'grid', 'fins'][Math.floor(r() * 4)];
  slab(ctx.wallB, kit, cx, cz, tw, td, 14 + Math.floor(r() * 22), r, up, null, lin([0xa9b9c4, 0x9fb0ae, 0xb7b0a2, 0x8fa1b0][Math.floor(r() * 4)]), 0, CITY_Y + H);
}
