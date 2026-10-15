// Heightfield terrain: raw heights from a function, carved flat under roads, rendered in chunks with
// slope-based colouring, and registered as an analytic heightfield for physics (exact same triangulation).
// Rendering is adaptive: each 16-cell block uses the coarsest step (1, 2, 4 or 8 cells) whose error against
// the physics heights stays under a tolerance, so flat land (cities, sea floor, paddies) costs almost nothing.
// Skirts under block edges hide the seams between blocks of different steps.
import * as THREE from 'three';
import { clamp, smoothstep, fbm, ridged } from '../../core/math.js';
import { surfaceId } from '../../physics/Surfaces.js';

/**
 * spec: { size: [w, d] | number, center: [x, z], cell: 4, height: (x, z) => y  |  { base, amplitude, scale, ridged, seed },
 *         surface: 'grass', color: 0x.., rockColor, sandLevel, material: 'grass'|'dirt'|'terrain',
 *         colorFn(x, z, h, slope, outColor), surfaceFn(x, z, h, slope) -> surface key, lodTolerance (m) }
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
  const slopeAt = (i, j) => {
    const hx = heights[j * nx + Math.min(nx - 1, i + 1)] - heights[j * nx + Math.max(0, i - 1)];
    const hz = heights[Math.min(nz - 1, j + 1) * nx + i] - heights[Math.max(0, j - 1) * nx + i];
    return Math.hypot(hx, hz) / (2 * cell);
  };

  const T = {
    spec, nx, nz, x0, z0, cell, heights, raw,
    rawHeightAt: (x, z) => sample(raw, x, z),
    heightAt: (x, z) => sample(heights, x, z),
    /** Flatten the terrain under a route: inside half width + pad -> road height - 0.12, blend over `blend` metres.
     *  skip[k] (optional) leaves sample k alone (tunnels, bridge decks). */
    carve(route, pad = 2, blend = 14, skip = null) {
      for (let k = 0; k < route.n; k++) {
        if (skip && skip[k]) continue;
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
      // physics: per-cell surfaces when the map asks for them (beaches, mud, rock)
      let surfaceGrid = null;
      if (spec.surfaceFn) {
        surfaceGrid = new Uint8Array((nx - 1) * (nz - 1));
        for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
          surfaceGrid[j * (nx - 1) + i] = surfaceId(spec.surfaceFn(x, z, heights[j * nx + i], slopeAt(i, j)) || spec.surface || 'grass');
        }
      }
      kit.world.addHeightfield({ x0, z0, cell, nx, nz, heights, surface: spec.surface || 'grass', surfaceGrid });

      const minStep = spec.renderStep ?? (kit.quality.detail >= 1 ? 1 : kit.quality.detail >= 0.6 ? 2 : 4);
      const tol = (spec.lodTolerance ?? 0.12) * (kit.quality.detail >= 1 ? 1 : 2.5);
      const roadTol = Math.min(tol, 0.1);
      const B = spec.lodBlock ?? 16;      // block size in cells
      const CH = spec.chunkBlocks ?? Math.max(1, Math.round(128 / B)); // blocks per chunk side: 128-cell chunks (draw call granularity)
      const mat = kit.M.shared('terrain:' + (spec.material || 'grass'), () => {
        const m = kit.M.textured(spec.material || 'grass', { repeat: 1, roughness: 0.95 }).clone();
        m.vertexColors = true;
        if ('envMapIntensity' in m) m.envMapIntensity = 0.45; // ground lit by the sky, not by the car's local cube map
        return m;
      });
      const base = new THREE.Color(spec.color ?? 0x6f8a4a), rock = new THREE.Color(spec.rockColor ?? 0x7b746a), sand = new THREE.Color(spec.sandColor ?? 0xb7a780);
      const tmp = new THREE.Color();
      const colorOf = (i, j, out) => {
        const h = heights[j * nx + i], x = x0 + i * cell, z = z0 + j * cell;
        const slope = slopeAt(i, j);
        if (spec.colorFn) { spec.colorFn(x, z, h, slope, tmp); }
        else {
          tmp.copy(base).lerp(rock, smoothstep(0.45, 0.85, slope));
          if (spec.sandLevel != null) tmp.lerp(sand, 1 - smoothstep(spec.sandLevel, spec.sandLevel + 1.5, h));
          tmp.multiplyScalar(0.85 + fbm(x * 0.02, z * 0.02, 3) * 0.3);
        }
        out.push(tmp.r, tmp.g, tmp.b);
      };
      // block step from the measured error of the coarse triangulation against the physics heights
      const blocksX = Math.ceil((nx - 1) / B), blocksZ = Math.ceil((nz - 1) / B);
      const stepOf = new Uint8Array(blocksX * blocksZ);
      const coarseErr = (bi, bj, s) => {
        const ci0 = bi * B, cj0 = bj * B, ci1 = Math.min(nx - 1, ci0 + B), cj1 = Math.min(nz - 1, cj0 + B);
        if ((ci1 - ci0) % s || (cj1 - cj0) % s) return Infinity;
        let err = 0;
        for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
          const gi = Math.min(ci1 - s, ci0 + Math.floor((i - ci0) / s) * s), gj = Math.min(cj1 - s, cj0 + Math.floor((j - cj0) / s) * s);
          const u = (i - gi) / s, v = (j - gj) / s;
          const h00 = heights[gj * nx + gi], h10 = heights[gj * nx + gi + s], h01 = heights[(gj + s) * nx + gi], h11 = heights[(gj + s) * nx + gi + s];
          const hc = u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
          const e = Math.abs(hc - heights[j * nx + i]) * (carvedW[j * nx + i] > 0 ? tol / roadTol : 1); // stricter next to roads
          if (e > err) { err = e; if (err > tol) return err; }
        }
        return err;
      };
      for (let bj = 0; bj < blocksZ; bj++) for (let bi = 0; bi < blocksX; bi++) {
        let s = minStep;
        for (const cand of [8, 4, 2]) if (cand > s && coarseErr(bi, bj, cand) <= tol) { s = cand; break; }
        stepOf[bj * blocksX + bi] = s;
      }
      // emit chunks (CH x CH blocks each)
      for (let cbz = 0; cbz < blocksZ; cbz += CH) for (let cbx = 0; cbx < blocksX; cbx += CH) {
        const pos = [], col = [], uv = [], idx = [];
        for (let bj = cbz; bj < Math.min(blocksZ, cbz + CH); bj++) for (let bi = cbx; bi < Math.min(blocksX, cbx + CH); bi++) {
          const s = stepOf[bj * blocksX + bi];
          const ci0 = bi * B, cj0 = bj * B, ci1 = Math.min(nx - 1, ci0 + B), cj1 = Math.min(nz - 1, cj0 + B);
          const cols = Math.floor((ci1 - ci0) / s) + 1, rows = Math.floor((cj1 - cj0) / s) + 1;
          const v0 = pos.length / 3;
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const i = Math.min(ci1, ci0 + c * s), j = Math.min(cj1, cj0 + r * s);
            const x = x0 + i * cell, z = z0 + j * cell;
            pos.push(x, heights[j * nx + i], z);
            uv.push(x / 24, z / 24);
            colorOf(i, j, col);
          }
          for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
            const a = v0 + r * cols + c, b = a + 1, d = a + cols, e = d + 1;
            // same split as the physics heightfield: (00,10,01) and (11,01,10), counter-clockwise from above
            idx.push(a, d, b, e, b, d);
          }
          // skirts on the edges this block shares with a block of a different step
          const skirt = (list, outwardFlip) => {
            for (let k = 0; k < list.length - 1; k++) {
              const [ia, ja] = list[k], [ib, jb] = list[k + 1];
              const a = pos.length / 3;
              for (const [i, j] of [[ia, ja], [ib, jb]]) {
                const x = x0 + i * cell, z = z0 + j * cell, h = heights[j * nx + i];
                pos.push(x, h, z); uv.push(x / 24, z / 24); colorOf(i, j, col);
                pos.push(x, h - 2.5, z); uv.push(x / 24, z / 24); colorOf(i, j, col);
              }
              if (outwardFlip) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
          };
          const nb = (di, dj) => { const x = bi + di, y = bj + dj; return x < 0 || y < 0 || x >= blocksX || y >= blocksZ ? s : stepOf[y * blocksX + x]; };
          const edge = (fixed, from, to, alongI) => { const out = []; for (let t = from; t <= to; t += s) out.push(alongI ? [t, fixed] : [fixed, t]); if (out[out.length - 1][alongI ? 0 : 1] !== to) out.push(alongI ? [to, fixed] : [fixed, to]); return out; };
          // winding chosen so every skirt faces away from its block (north and east edges flip)
          if (nb(0, -1) !== s) skirt(edge(cj0, ci0, ci1, true), true);
          if (nb(0, 1) !== s) skirt(edge(cj1, ci0, ci1, true), false);
          if (nb(-1, 0) !== s) skirt(edge(ci0, cj0, cj1, false), false);
          if (nb(1, 0) !== s) skirt(edge(ci1, cj0, cj1, false), true);
        }
        if (!idx.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, mat);
        mesh.receiveShadow = true;
        mesh.name = 'terrain';
        kit.root.add(mesh);
      }
      T.lodStats = { blocks: stepOf.length, steps: [1, 2, 4, 8].map((s) => stepOf.filter((v) => v === s).length) };
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
