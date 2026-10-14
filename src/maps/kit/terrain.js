// Heightfield terrain: raw heights from a function, carved flat under roads, rendered in chunks with
// slope-based colouring, and registered as an analytic heightfield for physics (exact same triangulation).
import * as THREE from 'three';
import { clamp, smoothstep, fbm, ridged } from '../../core/math.js';

/**
 * spec: { size: [w, d] | number, center: [x, z], cell: 4, height: (x, z) => y  |  { base, amplitude, scale, ridged, seed },
 *         surface: 'grass', color: 0x.., rockColor, sandLevel, material: 'grass'|'dirt' }
 */
/** Raw terrain height function of a terrain spec (before road carving). */
export function terrainHeightFn(spec) {
  return typeof spec.height === 'function' ? spec.height : proceduralHeight(spec.height || {});
}

export function makeTerrain(kit, spec) {
  const size = Array.isArray(spec.size) ? spec.size : [spec.size ?? 2000, spec.size ?? 2000];
  const center = spec.center ?? [0, 0];
  const cell = spec.cell ?? 4;
  const nx = Math.round(size[0] / cell) + 1, nz = Math.round(size[1] / cell) + 1;
  const x0 = center[0] - size[0] / 2, z0 = center[1] - size[1] / 2;
  const hf = terrainHeightFn(spec);
  const raw = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) raw[j * nx + i] = hf(x0 + i * cell, z0 + j * cell);
  const heights = raw.slice();
  const carvedW = new Float32Array(nx * nz); // carve weight already applied (max)

  const sample = (H, x, z) => {
    const fx = (x - x0) / cell, fz = (z - z0) / cell;
    if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return hf(x, z);
    let ix = Math.min(nx - 2, Math.floor(fx)), iz = Math.min(nz - 2, Math.floor(fz));
    const u = fx - ix, v = fz - iz;
    const h00 = H[iz * nx + ix], h10 = H[iz * nx + ix + 1], h01 = H[(iz + 1) * nx + ix], h11 = H[(iz + 1) * nx + ix + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  };

  const T = {
    spec, nx, nz, x0, z0, cell, heights, raw,
    rawHeightAt: (x, z) => sample(raw, x, z),
    heightAt: (x, z) => sample(heights, x, z),
    /** Flatten the terrain under a route: inside half width + pad -> road height - 0.12, blend over `blend` metres. */
    carve(route, pad = 2, blend = 14) {
      for (let k = 0; k < route.n; k++) {
        const rx = route.x[k], rz = route.z[k], ry = route.y[k] - 0.14;
        const inner = route.half[k] + pad, outer = inner + blend;
        const i0 = Math.max(0, Math.floor((rx - outer - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((rx + outer - x0) / cell));
        const j0 = Math.max(0, Math.floor((rz - outer - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((rz + outer - z0) / cell));
        const tx = route.tx[k], tz = route.tz[k];
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const dx = x0 + i * cell - rx, dz = z0 + j * cell - rz;
          const along = Math.abs(dx * tx + dz * tz);
          if (along > 2.5 + cell) continue; // only the slab around this sample
          const lat = Math.abs(dx * tz - dz * tx);
          const w = 1 - smoothstep(inner, outer, lat);
          const idx = j * nx + i;
          if (w <= 0) continue;
          if (w > carvedW[idx]) { heights[idx] = raw[idx] + (ry - raw[idx]) * w; carvedW[idx] = w; }
        }
      }
    },
    /** Build render chunks + physics heightfield. */
    build() {
      kit.world.addHeightfield({ x0, z0, cell, nx, nz, heights, surface: spec.surface || 'grass' });
      const step = Math.max(1, Math.round(spec.renderStep ?? (kit.quality.detail >= 1 ? 1 : kit.quality.detail >= 0.6 ? 2 : 3)));
      const chunkCells = 64;
      const mat = kit.M.shared('terrain:' + (spec.material || 'grass'), () => {
        const m = kit.M.textured(spec.material || 'grass', { repeat: 1, roughness: 0.95 }).clone();
        m.vertexColors = true;
        return m;
      });
      const base = new THREE.Color(spec.color ?? 0x6f8a4a), rock = new THREE.Color(spec.rockColor ?? 0x7b746a), sand = new THREE.Color(spec.sandColor ?? 0xb7a780);
      const tmp = new THREE.Color();
      for (let cz = 0; cz < nz - 1; cz += chunkCells) for (let cx = 0; cx < nx - 1; cx += chunkCells) {
        const ex = Math.min(nx - 1, cx + chunkCells), ez = Math.min(nz - 1, cz + chunkCells);
        const cols = Math.floor((ex - cx) / step) + 1, rows = Math.floor((ez - cz) / step) + 1;
        const pos = new Float32Array(cols * rows * 3), col = new Float32Array(cols * rows * 3), uv = new Float32Array(cols * rows * 2);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const i = Math.min(ex, cx + c * step), j = Math.min(ez, cz + r * step);
          const v = r * cols + c, h = heights[j * nx + i];
          const x = x0 + i * cell, z = z0 + j * cell;
          pos.set([x, h, z], v * 3);
          uv.set([x / 24, z / 24], v * 2);
          // slope from neighbours
          const hx = heights[j * nx + Math.min(nx - 1, i + 1)] - heights[j * nx + Math.max(0, i - 1)];
          const hz = heights[Math.min(nz - 1, j + 1) * nx + i] - heights[Math.max(0, j - 1) * nx + i];
          const slope = Math.hypot(hx, hz) / (2 * cell);
          tmp.copy(base).lerp(rock, smoothstep(0.45, 0.85, slope));
          if (spec.sandLevel != null) tmp.lerp(sand, 1 - smoothstep(spec.sandLevel, spec.sandLevel + 1.5, h));
          const n = fbm(x * 0.02, z * 0.02, 3);
          tmp.multiplyScalar(0.85 + n * 0.3);
          col.set([tmp.r, tmp.g, tmp.b], v * 3);
        }
        const idx = [];
        for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
          const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
          // same split as the physics heightfield: (00,10,01) and (11,01,10), counter-clockwise from above
          idx.push(a, d, b, e, b, d);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, mat);
        mesh.receiveShadow = true;
        mesh.name = 'terrain';
        kit.root.add(mesh);
      }
    },
  };
  return T;
}

function proceduralHeight({ base = 0, amplitude = 40, scale = 0.0025, ridged: rid = false, seed = 1, octaves = 5, plateau = null }) {
  return (x, z) => {
    const sx = x * scale + seed * 13.1, sz = z * scale - seed * 7.7;
    let h = rid ? ridged(sx, sz, octaves) : fbm(sx, sz, octaves);
    if (plateau != null) h = Math.min(h, plateau + (h - plateau) * 0.2);
    return base + h * amplitude;
  };
}
export { clamp };
