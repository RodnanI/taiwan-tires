// Procedural Taiwanese urban buildings. Facades are procedural textures (window grids with lit windows
// for night), geometry goes through the static batcher, small repeated details through the instancer.
import * as THREE from 'three';
import { makeCanvas } from '../../core/canvas.js';
import { canvasTexture } from '../../render/textures.js';
import { rng, hashString } from '../../core/math.js';
import { pickSign } from './signs.js';

export const BUILDING_STYLES = {
  shophouse: { floors: [4, 7], floorH: 3.2, groundH: 4.2, colors: ['#d8cdb8', '#c9c3b8', '#b8b2a6', '#d6c3b0', '#a9b0ad', '#e2d8c5', '#c4a99a'], qilou: true, signs: true, cages: true },
  apartment: { floors: [8, 15], floorH: 3.0, groundH: 4.0, colors: ['#cfc8bb', '#bdb9b0', '#d9d3c7', '#a7a39b', '#c2b6a4'], qilou: false, signs: false, cages: true },
  office: { floors: [10, 28], floorH: 3.8, groundH: 5.5, colors: ['#5d6b74', '#4a5157', '#6f7a7a', '#3e4a52', '#7c868a'], qilou: false, signs: false, glass: true },
  warehouse: { floors: [1, 2], floorH: 5.5, groundH: 6, colors: ['#8e9496', '#7b8a8f', '#a8a294', '#6d7c74'], qilou: false, signs: false, metal: true },
};

export function makeBuildings(kit) {
  const { M, batch, inst } = kit;
  const facadeCache = new Map();

  /** Facade material: window grid; emissive map holds lit windows (night). */
  function facade(style, color, seed) {
    const key = `${style}|${color}|${seed % 3}`;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const S = BUILDING_STYLES[style];
    const n = Math.min(512, kit.texSize);
    const c = makeCanvas(n, n), e = makeCanvas(n, n);
    const g = c.getContext('2d'), ge = e.getContext('2d');
    const r = rng(hashString(key));
    g.fillStyle = color; g.fillRect(0, 0, n, n);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, n, n);
    // tile texture noise
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * n, r() * n, n / 64, n / 64); }
    const bays = 4, floors = 4;
    const bw = n / bays, fh = n / floors;
    for (let f = 0; f < floors; f++) {
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, f * fh + fh - 3, n, 3); // floor line
      for (let b = 0; b < bays; b++) {
        const x = b * bw, y = f * fh;
        if (S.glass) {
          g.fillStyle = '#2a3238'; g.fillRect(x + 2, y + fh * 0.12, bw - 4, fh * 0.8);
          g.fillStyle = 'rgba(160,190,205,0.25)'; g.fillRect(x + 2, y + fh * 0.12, bw - 4, fh * 0.3);
        } else if (S.metal) {
          for (let k = 0; k < bw; k += 6) { g.fillStyle = k % 12 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)'; g.fillRect(x + k, y, 3, fh); }
          if (f === 0 && b % 2 === 0) { g.fillStyle = '#3c4246'; g.fillRect(x + bw * 0.15, y + fh * 0.2, bw * 0.7, fh * 0.8); }
          continue;
        } else {
          const ww = bw * 0.56, wh = fh * 0.5;
          const wx = x + (bw - ww) / 2, wy = y + fh * 0.22;
          g.fillStyle = '#1b2022'; g.fillRect(wx, wy, ww, wh);
          g.fillStyle = 'rgba(190,200,205,0.18)'; g.fillRect(wx, wy, ww, wh * 0.35);
          g.strokeStyle = 'rgba(40,40,40,0.6)'; g.lineWidth = 2; g.strokeRect(wx, wy, ww, wh);
          g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
        }
        // lit windows (emissive)
        if (r() < 0.42) {
          const warm = r() < 0.75;
          ge.fillStyle = warm ? `rgb(${230 + r() * 25},${170 + r() * 40},${90 + r() * 40})` : `rgb(${170 + r() * 30},${200 + r() * 30},${225})`;
          if (S.glass) ge.fillRect(x + 4, y + fh * 0.14, bw - 8, fh * 0.76);
          else ge.fillRect(x + (bw - bw * 0.56) / 2 + 2, y + fh * 0.22 + 2, bw * 0.56 - 4, fh * 0.5 - 4);
        }
      }
    }
    const map = canvasTexture(c), em = canvasTexture(e);
    const mat = M.surface({ map, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.0, roughness: S.glass ? 0.25 : 0.85, metalness: S.glass ? 0.3 : 0 });
    mat.userData.nightEmissive = [0.0, 1.1];
    kit.nightMaterials.push(mat);
    const out = { mat, bayW: 3.2, floorH: S.floorH };
    facadeCache.set(key, out);
    return out;
  }

  // box with UVs scaled in metres so facades tile per bay / floor
  function facadeBox(w, h, d, bayW, floorH) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = nrm.getX(i), ny = nrm.getY(i);
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (Math.abs(ny) > 0.5) { uv.setXY(i, 0.01, 0.01); continue; }
      const horiz = Math.abs(nx) > 0.5 ? z : x;
      uv.setXY(i, (horiz + w + d) / (bayW * 4), (y + h / 2) / (floorH * 4));
    }
    return g;
  }

  const roofMat = () => M.shared('roof', () => M.surface({ color: 0x5e5b56, roughness: 0.95 }));
  const shopMat = () => M.shared('shopfront', () => { const m = M.surface({ color: 0x1a1c1d, emissive: 0xffd9a0, emissiveIntensity: 0.0, roughness: 0.3, metalness: 0.2 }); m.userData.nightEmissive = [0.0, 0.55]; kit.nightMaterials.push(m); return m; });
  const pillarMat = () => M.shared('pillar', () => M.surface({ color: 0xbdb5a6, roughness: 0.85 }));

  /**
   * One building. spec: { x, z, w, d, rotY, style, floors | h, color, seed, front: 'z+' (street side), signs, qilou, rooftop }
   * Footprint centred on (x, z), front face towards local +Z.
   */
  function building(spec) {
    const style = BUILDING_STYLES[spec.style] ? spec.style : 'shophouse';
    const S = BUILDING_STYLES[style];
    const seed = spec.seed ?? hashString(`${spec.x},${spec.z}`);
    const r = rng(seed);
    const floors = spec.floors ?? Math.round(S.floors[0] + r() * (S.floors[1] - S.floors[0]));
    const H = spec.h ?? S.groundH + (floors - 1) * S.floorH;
    const w = spec.w ?? 8, d = spec.d ?? 14;
    const y0 = spec.y ?? kit.groundY(spec.x, spec.z);
    const color = spec.color ?? S.colors[Math.floor(r() * S.colors.length)];
    const F = facade(style, color, seed);
    const rot = spec.rotY ?? 0;
    const place = (geo, mat, lx, ly, lz, cast = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(lx, ly, lz);
      const holder = new THREE.Object3D();
      holder.position.set(spec.x, y0, spec.z); holder.rotation.y = rot;
      holder.add(m); holder.updateMatrixWorld(true);
      m.castShadow = cast; m.receiveShadow = true;
      batch.add(m);
    };
    const qilou = spec.qilou ?? S.qilou;
    const arcade = qilou ? 2.6 : 0;
    // main volume above the arcade
    place(facadeBox(w, H - S.groundH, d, F.bayW, F.floorH), F.mat, 0, S.groundH + (H - S.groundH) / 2, 0);
    // ground floor: recessed shopfront behind the arcade
    place(new THREE.BoxGeometry(w - 0.2, S.groundH, d - arcade), shopMat(), 0, S.groundH / 2, -arcade / 2, false);
    if (qilou) {
      const n = Math.max(2, Math.round(w / 4) + 1);
      for (let i = 0; i < n; i++) {
        const lx = -w / 2 + 0.3 + (i * (w - 0.6)) / (n - 1);
        place(new THREE.BoxGeometry(0.5, S.groundH, 0.5), pillarMat(), lx, S.groundH / 2, d / 2 - 0.3);
      }
      place(new THREE.BoxGeometry(w, 0.25, arcade), pillarMat(), 0, S.groundH - 0.12, d / 2 - arcade / 2, false);
    }
    // roof slab + rooftop clutter
    place(new THREE.BoxGeometry(w + 0.1, 0.4, d + 0.1), roofMat(), 0, H + 0.2, 0);
    const wp = (lx, ly, lz) => { const v = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); return [spec.x + v.x, y0 + v.y, spec.z + v.z]; };
    if ((spec.rooftop ?? true) && style !== 'office' && kit.detail > 0.4) {
      if (r() < 0.75) kit.props.place('waterTank', wp((r() - 0.5) * w * 0.5, H + 0.4, (r() - 0.5) * d * 0.5), r() * 6, 1, null, { collide: false });
      if (style !== 'warehouse' && r() < 0.45) place(new THREE.BoxGeometry(w * 0.6, 2.4, d * 0.4), M.shared('shed', () => M.textured('brushed', { repeat: 1, color: 0x9fa7a6, roughness: 0.5, metalness: 0.6 })), (r() - 0.5) * w * 0.2, H + 1.6, -d * 0.2);
    }
    // facade details: AC units + iron window cages (front face)
    if (S.cages && kit.detail > 0.55) {
      const bays = Math.max(1, Math.floor(w / F.bayW));
      for (let f = 1; f < floors; f++) for (let b = 0; b < bays; b++) {
        const lx = -w / 2 + (b + 0.5) * (w / bays), ly = S.groundH + (f - 1) * S.floorH + S.floorH * 0.45;
        const rv = r();
        if (rv < 0.28) kit.props.place('cage', wp(lx, ly, d / 2 + 0.25), rot, 1, null, { collide: false });
        else if (rv < 0.5) kit.props.place('acUnit', wp(lx + 0.6, ly - 0.7, d / 2 + 0.25), rot, 1, null, { collide: false });
      }
    }
    // vertical shop signs at the street face
    if ((spec.signs ?? S.signs) && kit.signs) {
      const count = Math.max(1, Math.round(w / 5));
      for (let i = 0; i < count; i++) {
        const s = pickSign(r);
        const rect = kit.signs.slot(s.text, s.palette);
        const sh = Math.min(H - S.groundH - 1, 3 + r() * 4);
        const lx = -w / 2 + (i + 0.5) * (w / count);
        place(kit.signs.geometry(rect, 0.9, sh, 0.22), kit.signs.material, lx, S.groundH + 0.6 + sh / 2, d / 2 + 0.55, false);
      }
    }
    // collision
    kit.collision.box({ x: spec.x, z: spec.z, hx: w / 2, hz: d / 2, rotY: rot, y0: y0 - 2, y1: y0 + H + 1, kind: 'building' });
    return { H, w, d };
  }

  /**
   * Fill one side of a street with buildings. a, b: street-side corners [x, z] (front edge), depth: lot depth,
   * side: +1 = buildings on the left of a->b, -1 = right.
   */
  function row({ a, b, depth = 16, side = 1, style = 'shophouse', minW = 6, maxW = 12, gap = 0.4, setback = 0, seed = 1, floors }) {
    const r = rng(seed);
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const tx = dx / len, tz = dz / len;
    const nx = tz * side, nz = -tx * side; // points away from the street into the lot
    const rotY = Math.atan2(-nx, -nz);     // building front (+Z local) faces the street
    let s = 0;
    while (s < len - minW) {
      const w = Math.min(len - s, minW + r() * (maxW - minW));
      const cx = a[0] + tx * (s + w / 2) + nx * (setback + depth / 2), cz = a[1] + tz * (s + w / 2) + nz * (setback + depth / 2);
      const st = Array.isArray(style) ? style[Math.floor(r() * style.length)] : style;
      building({ x: cx, z: cz, w: w - gap, d: depth, rotY, style: st, seed: Math.floor(r() * 1e9), floors: floors ? Math.round(floors[0] + r() * (floors[1] - floors[0])) : undefined });
      s += w;
    }
  }

  /** Cheap distant skyline: boxes with lit windows, no collision, no details. */
  function skyline({ center = [0, 0], radius = [900, 1600], count = 80, height = [30, 140], seed = 7, y = 0 }) {
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = radius[0] + r() * (radius[1] - radius[0]);
      const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
      const h = height[0] + Math.pow(r(), 2) * (height[1] - height[0]);
      const w = 18 + r() * 30, dd = 18 + r() * 30;
      const F = facade(r() < 0.4 ? 'office' : 'apartment', BUILDING_STYLES.apartment.colors[Math.floor(r() * 5)], i);
      const m = new THREE.Mesh(facadeBox(w, h, dd, F.bayW * 2, F.floorH * 2), F.mat);
      m.position.set(x, y + h / 2 - 2, z); m.rotation.y = r() * Math.PI;
      m.castShadow = false;
      batch.add(m);
    }
  }

  /** Stacked-pagoda supertall (a landmark silhouette). */
  function supertall({ pos = [0, 0, 0], height = 420, segments = 8, color = 0x6f8a86 }) {
    const [x, y, z] = pos;
    const glass = M.shared('tower-glass', () => { const m = M.surface({ color, roughness: 0.18, metalness: 0.6, emissive: 0x9fe3c8, emissiveIntensity: 0.0 }); m.userData.nightEmissive = [0.0, 0.25]; kit.nightMaterials.push(m); return m; });
    const baseH = height * 0.2, segH = (height * 0.62) / segments;
    const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; batch.add(m); };
    add(new THREE.CylinderGeometry(30, 36, baseH, 4, 1), glass, x, y + baseH / 2, z);
    for (let i = 0; i < segments; i++) {
      const g = new THREE.CylinderGeometry(27, 21, segH, 4, 1);
      add(g, glass, x, y + baseH + segH * (i + 0.5), z);
      kit.light({ pos: [x, y + baseH + segH * (i + 1), z], color: 0xfff0c8, intensity: 0, range: 1 });
    }
    const topY = y + baseH + segH * segments;
    add(new THREE.CylinderGeometry(12, 18, height * 0.06, 4, 1), glass, x, topY + height * 0.03, z);
    add(new THREE.CylinderGeometry(0.8, 2.2, height * 0.12, 8, 1), M.metal(0xb8b8b8, 0.3), x, topY + height * 0.06 + height * 0.06, z);
    kit.collision.cylinder({ x, z, r: 34, y0: y - 5, y1: y + height, kind: 'building' });
  }

  return { building, row, skyline, supertall, facade };
}
