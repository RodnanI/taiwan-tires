// Small geometry accumulator for the Formosa builders: quads and boxes with atlas UVs and vertex colours,
// flushed into the kit's static batcher in pieces small enough for per-chunk culling.
import * as THREE from 'three';

export class Builder {
  constructor(kit, material, { cast = true, receive = true } = {}) {
    this.kit = kit; this.material = material; this.cast = cast; this.receive = receive;
    this.reset();
  }
  reset() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get empty() { return this.idx.length === 0; }
  /** Quad p0 p1 p2 p3 (counter-clockwise seen from the front), uv rect [u0, v0, u1, v1], colour [r, g, b]. */
  quad(p0, p1, p2, p3, uv, c = WHITE) {
    const v = this.pos.length / 3;
    // normal from the diagonals: also right for triangles passed as quads with two corners equal (a zero
    // normal there turns into NaN in the shader and blacks out the whole frame through bloom)
    const ux = p2[0] - p0[0], uy = p2[1] - p0[1], uz = p2[2] - p0[2], wx = p3[0] - p1[0], wy = p3[1] - p1[1], wz = p3[2] - p1[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    for (const p of [p0, p1, p2, p3]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(c[0], c[1], c[2]); }
    this.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  /** Vertical wall quad from a to b (x, z), y0 -> y1, facing to the right of a->b... front = left side when looking from a to b. */
  wall(ax, az, bx, bz, y0, y1, uv, c) { this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], uv, c); }
  /** Axis-free box: centre, half extents along unit axes t (length) and n = [t.z, -t.x] (depth), height y0..y1. */
  box(cx, cz, t, n, hw, hd, y0, y1, uvSide, uvTop, c, cTop = c) {
    const P = (s, d, y) => [cx + t[0] * s + n[0] * d, y, cz + t[1] * s + n[1] * d];
    const a = P(-hw, -hd, 0), b = P(hw, -hd, 0), cc = P(hw, hd, 0), d = P(-hw, hd, 0);
    const up = (p, y) => [p[0], y, p[2]];
    this.quad(up(a, y0), up(b, y0), up(b, y1), up(a, y1), uvSide, c);      // -n face
    this.quad(up(b, y0), up(cc, y0), up(cc, y1), up(b, y1), uvSide, c);    // +t face
    this.quad(up(cc, y0), up(d, y0), up(d, y1), up(cc, y1), uvSide, c);   // +n face
    this.quad(up(d, y0), up(a, y0), up(a, y1), up(d, y1), uvSide, c);      // -t face
    if (uvTop) this.quad(up(a, y1), up(b, y1), up(cc, y1), up(d, y1), uvTop, cTop);
  }
  flush() {
    if (this.empty) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    this.kit.addStatic(g, this.material, { cast: this.cast, receive: this.receive });
    this.reset();
  }
}
const WHITE = [1, 1, 1];

/** sRGB hex -> linear [r, g, b] (vertex colours are linear). */
export function lin(hex) {
  const f = (k) => { const s = k / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}
export const mulC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
