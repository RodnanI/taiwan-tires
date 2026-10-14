// Collision world. Three kinds of geometry:
//   1. Ground triangles (roads, ramps, bridges) in a uniform XZ grid  -> wheel raycasts.
//   2. Heightfields (terrain)                                          -> analytic raycasts.
//   3. Static solids: yaw-rotated boxes and vertical cylinders         -> car body collisions.
// Maps never touch this directly; the map kit registers geometry through ctx.collision (see maps/AGENTS.md).
import { surfaceId } from './Surfaces.js';

export const BOX = 0;
export const CIRCLE = 1;

export class CollisionWorld {
  constructor() {
    this._triPos = [];      // flat xyz list while building
    this._triSurf = [];
    this.heightfields = [];
    this.statics = [];
    this.finalized = false;
    this.bounds = { minX: -100, minZ: -100, maxX: 100, maxZ: 100 };
    this.killY = -60;
    this._stamp = 1;
  }

  // ---------------------------------------------------------------- building
  /** positions: flat array/Float32Array of xyz, indices optional. surface: key/id or per-triangle array. */
  addTriangles(positions, indices = null, surface = 'asphalt') {
    const triCount = indices ? indices.length / 3 : positions.length / 9;
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        const vi = indices ? indices[t * 3 + k] : t * 3 + k;
        this._triPos.push(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
      }
      this._triSurf.push(Array.isArray(surface) || ArrayBuffer.isView(surface) ? surfaceId(surface[t]) : surfaceId(surface));
    }
  }
  /** Adds the triangles of a THREE.BufferGeometry already transformed into world space. */
  addGeometry(geometry, surface = 'asphalt') {
    const pos = geometry.attributes.position.array;
    const idx = geometry.index ? geometry.index.array : null;
    this.addTriangles(pos, idx, surface);
  }
  /**
   * Heightfield: grid of (nx * nz) vertex heights starting at (x0, z0) with spacing `cell`.
   * Triangulation per cell (u along x, v along z): u + v <= 1 -> (00,10,01) else (11,01,10). The terrain
   * mesh in maps/kit/terrain.js uses the same split so physics and visuals match exactly.
   */
  addHeightfield({ x0, z0, cell, nx, nz, heights, surface = 'grass', surfaceGrid = null }) {
    const hf = { x0, z0, cell, nx, nz, heights, surf: surfaceId(surface), surfaceGrid, x1: x0 + cell * (nx - 1), z1: z0 + cell * (nz - 1) };
    this.heightfields.push(hf);
    return hf;
  }
  /** Box with half extents hx (local X) / hz (local Z), rotated by rotY exactly like THREE's object.rotation.y. */
  addBox({ x, z, y0 = -10, y1 = 50, hx, hz, rotY = 0, kind = 'wall', bounce = 0.15, friction = 0.35 }) {
    // internal convention: local x axis in world = (cos, sin) on (x, z); THREE rotY maps local X to (cos, -sin)
    this.statics.push({ type: BOX, x, z, hx, hz, cos: Math.cos(rotY), sin: -Math.sin(rotY), y0, y1, kind, bounce, friction, r: Math.hypot(hx, hz) });
  }
  addCylinder({ x, z, r, y0 = -10, y1 = 50, kind = 'pole', bounce = 0.2, friction = 0.3 }) {
    this.statics.push({ type: CIRCLE, x, z, r, y0, y1, kind, bounce, friction, hx: r, hz: r, cos: 1, sin: 0 });
  }
  /** Thin wall between two points (guardrails, barriers, building faces). */
  addWall(ax, az, bx, bz, { y0 = -10, y1 = 50, thickness = 0.4, kind = 'wall', bounce = 0.1, friction = 0.25 } = {}) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return;
    // box local axes: "x" axis along the wall, yaw measured like the vehicle heading (atan2(dx, dz)) rotated by 90 deg
    const yaw = Math.atan2(dz, dx);
    this.statics.push({ type: BOX, x: (ax + bx) / 2, z: (az + bz) / 2, hx: len / 2, hz: thickness / 2, cos: Math.cos(yaw), sin: Math.sin(yaw), y0, y1, kind, bounce, friction, r: len / 2 + thickness });
  }
  /** Walls along a polyline [[x,z],...]. */
  addWallPath(points, opts = {}) {
    for (let i = 0; i < points.length - 1; i++) this.addWall(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], opts);
    if (opts.closed && points.length > 2) { const a = points[points.length - 1], b = points[0]; this.addWall(a[0], a[1], b[0], b[1], opts); }
  }

  finalize() {
    // ---- triangles
    const pos = new Float32Array(this._triPos);
    const triCount = pos.length / 9;
    this.triPos = pos;
    this.triSurf = new Uint8Array(this._triSurf);
    this.triNorm = new Float32Array(triCount * 3);
    this.triStamp = new Uint32Array(triCount);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let t = 0; t < triCount; t++) {
      const o = t * 9;
      const e1x = pos[o + 3] - pos[o], e1y = pos[o + 4] - pos[o + 1], e1z = pos[o + 5] - pos[o + 2];
      const e2x = pos[o + 6] - pos[o], e2y = pos[o + 7] - pos[o + 1], e2z = pos[o + 8] - pos[o + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; } // ground faces up regardless of winding
      this.triNorm[t * 3] = nx; this.triNorm[t * 3 + 1] = ny; this.triNorm[t * 3 + 2] = nz;
      for (let k = 0; k < 3; k++) {
        const x = pos[o + k * 3], z = pos[o + k * 3 + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
    }
    for (const hf of this.heightfields) { minX = Math.min(minX, hf.x0); minZ = Math.min(minZ, hf.z0); maxX = Math.max(maxX, hf.x1); maxZ = Math.max(maxZ, hf.z1); }
    for (const s of this.statics) { minX = Math.min(minX, s.x - s.r); minZ = Math.min(minZ, s.z - s.r); maxX = Math.max(maxX, s.x + s.r); maxZ = Math.max(maxZ, s.z + s.r); }
    if (!isFinite(minX)) { minX = -100; minZ = -100; maxX = 100; maxZ = 100; }
    this.bounds = { minX, minZ, maxX, maxZ };
    let minY = Infinity;
    for (let t = 0; t < triCount; t++) minY = Math.min(minY, pos[t * 9 + 1], pos[t * 9 + 4], pos[t * 9 + 7]);
    for (const hf of this.heightfields) for (let i = 0; i < hf.heights.length; i += 7) minY = Math.min(minY, hf.heights[i]);
    this.killY = (isFinite(minY) ? minY : 0) - 40;

    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    this.triCell = Math.max(4, span / 1400);
    this.triGrid = buildGrid(triCount, minX, minZ, maxX, maxZ, this.triCell, (t, add) => {
      const o = t * 9;
      const x0 = Math.min(pos[o], pos[o + 3], pos[o + 6]), x1 = Math.max(pos[o], pos[o + 3], pos[o + 6]);
      const z0 = Math.min(pos[o + 2], pos[o + 5], pos[o + 8]), z1 = Math.max(pos[o + 2], pos[o + 5], pos[o + 8]);
      add(x0, z0, x1, z1);
    });
    // ---- statics
    this.staticStamp = new Uint32Array(this.statics.length);
    this.staticCell = 16;
    this.staticGrid = buildGrid(this.statics.length, minX, minZ, maxX, maxZ, this.staticCell, (i, add) => {
      const s = this.statics[i];
      add(s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r);
    });
    this._triPos = null; this._triSurf = null;
    this.finalized = true;
  }

  // ---------------------------------------------------------------- queries
  /**
   * Ray vs ground (triangles + heightfields). Direction must be normalized.
   * out: { dist, x, y, z, nx, ny, nz, surface }. Returns true on hit.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, out) {
    let best = maxDist;
    let hit = false;
    // triangles
    const g = this.triGrid;
    if (g && g.count) {
      const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
      const c0x = clampi(Math.floor((Math.min(ox, ex) - g.minX) / g.cell), 0, g.nx - 1);
      const c1x = clampi(Math.floor((Math.max(ox, ex) - g.minX) / g.cell), 0, g.nx - 1);
      const c0z = clampi(Math.floor((Math.min(oz, ez) - g.minZ) / g.cell), 0, g.nz - 1);
      const c1z = clampi(Math.floor((Math.max(oz, ez) - g.minZ) / g.cell), 0, g.nz - 1);
      if ((c1x - c0x + 1) * (c1z - c0z + 1) <= 64) {
        const stamp = ++this._stamp;
        const P = this.triPos;
        for (let cz = c0z; cz <= c1z; cz++) {
          for (let cx = c0x; cx <= c1x; cx++) {
            const cell = cz * g.nx + cx;
            for (let k = g.start[cell], e = g.start[cell + 1]; k < e; k++) {
              const t = g.items[k];
              if (this.triStamp[t] === stamp) continue;
              this.triStamp[t] = stamp;
              const o = t * 9;
              // Moller-Trumbore
              const e1x = P[o + 3] - P[o], e1y = P[o + 4] - P[o + 1], e1z = P[o + 5] - P[o + 2];
              const e2x = P[o + 6] - P[o], e2y = P[o + 7] - P[o + 1], e2z = P[o + 8] - P[o + 2];
              const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
              const det = e1x * px + e1y * py + e1z * pz;
              if (det > -1e-9 && det < 1e-9) continue;
              const inv = 1 / det;
              const tx = ox - P[o], ty = oy - P[o + 1], tz = oz - P[o + 2];
              const u = (tx * px + ty * py + tz * pz) * inv;
              if (u < 0 || u > 1) continue;
              const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
              const v = (dx * qx + dy * qy + dz * qz) * inv;
              if (v < 0 || u + v > 1) continue;
              const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
              if (d >= 0 && d < best) {
                best = d; hit = true;
                out.nx = this.triNorm[t * 3]; out.ny = this.triNorm[t * 3 + 1]; out.nz = this.triNorm[t * 3 + 2];
                out.surface = this.triSurf[t];
              }
            }
          }
        }
      }
    }
    // heightfields
    for (let i = 0; i < this.heightfields.length; i++) {
      const hf = this.heightfields[i];
      const d = this._rayHeightfield(hf, ox, oy, oz, dx, dy, dz, best, out);
      if (d >= 0 && d < best) { best = d; hit = true; }
    }
    if (hit) {
      out.dist = best;
      out.x = ox + dx * best; out.y = oy + dy * best; out.z = oz + dz * best;
    }
    return hit;
  }

  _hfHeight(hf, x, z, nOut) {
    const fx = (x - hf.x0) / hf.cell, fz = (z - hf.z0) / hf.cell;
    if (fx < 0 || fz < 0 || fx > hf.nx - 1 || fz > hf.nz - 1) return NaN;
    let ix = Math.floor(fx), iz = Math.floor(fz);
    if (ix >= hf.nx - 1) ix = hf.nx - 2;
    if (iz >= hf.nz - 1) iz = hf.nz - 2;
    const u = fx - ix, v = fz - iz;
    const H = hf.heights, nx = hf.nx;
    const h00 = H[iz * nx + ix], h10 = H[iz * nx + ix + 1], h01 = H[(iz + 1) * nx + ix], h11 = H[(iz + 1) * nx + ix + 1];
    let h, sx, sz;
    if (u + v <= 1) { sx = h10 - h00; sz = h01 - h00; h = h00 + sx * u + sz * v; }
    else { sx = h11 - h01; sz = h11 - h10; h = h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v); }
    if (nOut) {
      const c = hf.cell;
      let nnx = -sx / c, nny = 1, nnz = -sz / c;
      const l = Math.hypot(nnx, nny, nnz);
      nOut.nx = nnx / l; nOut.ny = nny / l; nOut.nz = nnz / l;
      nOut.surface = hf.surfaceGrid ? hf.surfaceGrid[iz * (hf.nx - 1) + ix] : hf.surf;
    }
    return h;
  }
  _rayHeightfield(hf, ox, oy, oz, dx, dy, dz, maxDist, out) {
    if (dx === 0 && dz === 0 && dy < 0) { // vertical fast path (spawning, props, heightAt)
      const h = this._hfHeight(hf, ox, oz, _tmpN);
      if (isNaN(h) || oy < h || oy - h > maxDist) return -1;
      out.nx = _tmpN.nx; out.ny = _tmpN.ny; out.nz = _tmpN.nz; out.surface = _tmpN.surface;
      return oy - h;
    }
    const steps = Math.max(1, Math.ceil(maxDist / (hf.cell * 0.5)));
    let t0 = 0;
    let h0 = this._hfHeight(hf, ox, oz);
    let g0 = isNaN(h0) ? NaN : oy - h0;
    if (g0 < 0) return -1; // origin under terrain: ignore (ray starts inside)
    for (let i = 1; i <= steps; i++) {
      const t1 = (maxDist * i) / steps;
      const x = ox + dx * t1, y = oy + dy * t1, z = oz + dz * t1;
      const h1 = this._hfHeight(hf, x, z);
      if (isNaN(h1)) { g0 = NaN; t0 = t1; continue; }
      const g1 = y - h1;
      if (g1 <= 0 && !isNaN(g0)) {
        let a = t0, b = t1;
        for (let k = 0; k < 10; k++) {
          const m = (a + b) * 0.5;
          const hm = this._hfHeight(hf, ox + dx * m, oz + dz * m);
          if (oy + dy * m - hm > 0) a = m; else b = m;
        }
        const t = (a + b) * 0.5;
        this._hfHeight(hf, ox + dx * t, oz + dz * t, out);
        return t;
      }
      g0 = g1; t0 = t1;
    }
    return -1;
  }

  /** Ground height below (x, z) starting the search at yFrom (defaults to high above everything). */
  heightAt(x, z, yFrom = 2000, out = _tmpHit) {
    if (this.raycast(x, yFrom, z, 0, -1, 0, yFrom + 1000, out)) return out.y;
    return NaN;
  }

  forEachStaticNear(minX, minZ, maxX, maxZ, fn) {
    const g = this.staticGrid;
    if (!g || !g.count) return;
    const c0x = clampi(Math.floor((minX - g.minX) / g.cell), 0, g.nx - 1), c1x = clampi(Math.floor((maxX - g.minX) / g.cell), 0, g.nx - 1);
    const c0z = clampi(Math.floor((minZ - g.minZ) / g.cell), 0, g.nz - 1), c1z = clampi(Math.floor((maxZ - g.minZ) / g.cell), 0, g.nz - 1);
    const stamp = ++this._stamp;
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const cell = cz * g.nx + cx;
      for (let k = g.start[cell], e = g.start[cell + 1]; k < e; k++) {
        const i = g.items[k];
        if (this.staticStamp[i] === stamp) continue;
        this.staticStamp[i] = stamp;
        fn(this.statics[i], i);
      }
    }
  }

  /** 2D segment vs static solids at height y. Returns fraction t in [0,1] of the first hit, or 1. */
  segmentStatics(ax, az, bx, bz, y = 1, pad = 0) {
    let best = 1;
    this.forEachStaticNear(Math.min(ax, bx) - pad, Math.min(az, bz) - pad, Math.max(ax, bx) + pad, Math.max(az, bz) + pad, (s) => {
      if (y < s.y0 || y > s.y1) return;
      const t = s.type === BOX ? segBox(ax, az, bx, bz, s, pad) : segCircle(ax, az, bx, bz, s.x, s.z, s.r + pad);
      if (t >= 0 && t < best) best = t;
    });
    return best;
  }
}

const _tmpHit = { dist: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, surface: 0 };
const _tmpN = { nx: 0, ny: 1, nz: 0, surface: 0 };
const clampi = (v, a, b) => (v < a ? a : v > b ? b : v);

function buildGrid(count, minX, minZ, maxX, maxZ, cell, forEachBounds) {
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell) + 1);
  const counts = new Uint32Array(nx * nz + 1);
  const visit = (pass, items, fill) => {
    for (let i = 0; i < count; i++) {
      forEachBounds(i, (x0, z0, x1, z1) => {
        const a = clampi(Math.floor((x0 - minX) / cell), 0, nx - 1), b = clampi(Math.floor((x1 - minX) / cell), 0, nx - 1);
        const c = clampi(Math.floor((z0 - minZ) / cell), 0, nz - 1), d = clampi(Math.floor((z1 - minZ) / cell), 0, nz - 1);
        for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) {
          const k = z * nx + x;
          if (pass === 0) counts[k]++; else items[fill[k]++] = i;
        }
      });
    }
  };
  visit(0);
  const start = new Uint32Array(nx * nz + 1);
  for (let i = 0; i < nx * nz; i++) start[i + 1] = start[i] + counts[i];
  const items = new Uint32Array(start[nx * nz]);
  const fill = start.slice(0, nx * nz);
  visit(1, items, fill);
  return { nx, nz, cell, minX, minZ, start, items, count };
}

function segCircle(ax, az, bx, bz, cx, cz, r) {
  const dx = bx - ax, dz = bz - az;
  const fx = ax - cx, fz = az - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
  if (c <= 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}
function segBox(ax, az, bx, bz, s, pad) {
  // transform into box local space (x' along box "x" axis)
  const lax = (ax - s.x) * s.cos + (az - s.z) * s.sin, laz = -(ax - s.x) * s.sin + (az - s.z) * s.cos;
  const lbx = (bx - s.x) * s.cos + (bz - s.z) * s.sin, lbz = -(bx - s.x) * s.sin + (bz - s.z) * s.cos;
  const hx = s.hx + pad, hz = s.hz + pad;
  let t0 = 0, t1 = 1;
  const dx = lbx - lax, dz = lbz - laz;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (clip(-dx, lax + hx) && clip(dx, hx - lax) && clip(-dz, laz + hz) && clip(dz, hz - laz)) return t0;
  return -1;
}
