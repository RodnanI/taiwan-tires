// Occupancy mask (4 m cells) for placing scenery: roads, buildings and plazas are marked so trees, rocks and
// houses keep clear of them, and a distance-to-road field lets vegetation thicken along the roads players see.
import { BOUNDS } from '../geo.js';

export class Mask {
  constructor(cell = 4) {
    this.cell = cell;
    this.x0 = BOUNDS.x0; this.z0 = BOUNDS.z0;
    this.nx = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / cell) + 1; this.nz = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / cell) + 1;
    this.occ = new Uint8Array(this.nx * this.nz);
    this.roadDist = new Uint8Array(this.nx * this.nz).fill(255); // metres to the nearest road edge, capped
  }
  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i;
  }
  free(x, z) { const k = this.idx(x, z); return k >= 0 && !this.occ[k]; }
  nearRoad(x, z) { const k = this.idx(x, z); return k < 0 ? 255 : this.roadDist[k]; }
  /** Mark every road: occupied out to the shoulder + pad, distance field out to 120 m. */
  markRoads(kit, pad = 2) {
    const c = this.cell;
    for (const r of kit.roads) {
      const R = r.route;
      for (let i = 0; i < R.n; i += 2) {
        const w = R.half[i] + r.shoulder + pad, reach = w + 120;
        const i0 = Math.max(0, Math.floor((R.x[i] - reach - this.x0) / c)), i1 = Math.min(this.nx - 1, Math.ceil((R.x[i] + reach - this.x0) / c));
        const j0 = Math.max(0, Math.floor((R.z[i] - reach - this.z0) / c)), j1 = Math.min(this.nz - 1, Math.ceil((R.z[i] + reach - this.z0) / c));
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
          const d = Math.hypot(this.x0 + ii * c - R.x[i], this.z0 + j * c - R.z[i]) - w;
          const k = j * this.nx + ii;
          if (d < 0) this.occ[k] = 1;
          const dd = Math.max(0, Math.min(254, d));
          if (dd < this.roadDist[k]) this.roadDist[k] = dd;
        }
      }
    }
  }
  /** Mark the cells overlapping the rectangle (the same cells idx() returns for points inside it). */
  rect(x0, z0, x1, z1) {
    const c = this.cell;
    for (let j = Math.max(0, Math.floor((z0 - this.z0) / c)); j <= Math.min(this.nz - 1, Math.floor((z1 - this.z0) / c)); j++)
      for (let i = Math.max(0, Math.floor((x0 - this.x0) / c)); i <= Math.min(this.nx - 1, Math.floor((x1 - this.x0) / c)); i++) this.occ[j * this.nx + i] = 1;
  }
  circle(x, z, r) {
    const c = this.cell;
    for (let j = Math.max(0, Math.floor((z - r - this.z0) / c)); j <= Math.min(this.nz - 1, Math.ceil((z + r - this.z0) / c)); j++)
      for (let i = Math.max(0, Math.floor((x - r - this.x0) / c)); i <= Math.min(this.nx - 1, Math.ceil((x + r - this.x0) / c)); i++)
        if (Math.hypot(this.x0 + i * c - x, this.z0 + j * c - z) < r) this.occ[j * this.nx + i] = 1;
  }
  /** Oriented box footprint (x, z centre, half sizes along the rotated axes). */
  box(x, z, hx, hz, rot = 0) {
    const r = Math.hypot(hx, hz), c = Math.cos(rot), s = Math.sin(rot), cell = this.cell;
    for (let j = Math.max(0, Math.floor((z - r - this.z0) / cell)); j <= Math.min(this.nz - 1, Math.ceil((z + r - this.z0) / cell)); j++)
      for (let i = Math.max(0, Math.floor((x - r - this.x0) / cell)); i <= Math.min(this.nx - 1, Math.ceil((x + r - this.x0) / cell)); i++) {
        const dx = this.x0 + i * cell - x, dz = this.z0 + j * cell - z;
        if (Math.abs(dx * c - dz * s) < hx && Math.abs(dx * s + dz * c) < hz) this.occ[j * this.nx + i] = 1;
      }
  }
  /** Mark every static collider of a kind (buildings, containers) from the collision world. */
  markStatics(kit, kinds = ['building', 'container', 'wall']) {
    for (const s of kit.world.statics) {
      if (!kinds.includes(s.kind)) continue;
      if (s.type === 0) this.box(s.x, s.z, s.hx + 1, s.hz + 1, -Math.atan2(s.sin, s.cos));
      else this.circle(s.x, s.z, s.r + 1);
    }
  }
}
