// Procedural textures (no image files: the game ships as one HTML file). Generated once per key+size and cached.
// Each generator returns { map, normalMap?, roughnessMap?, emissiveMap? } of THREE.CanvasTextures.
import * as THREE from 'three';
import { makeCanvas, FONT_UI } from '../core/canvas.js';
import { valueNoise, rng, hash2 } from '../core/math.js';

const cache = new Map();
let anisotropy = 4;
export function setTextureAnisotropy(a) { anisotropy = a; }

function tex(canvas, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// periodic value noise: lattice coordinates wrap at `p`, so the texture tiles exactly
function pnoise(x, y, p, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const o = seed * 7919;
  const a = hash2(x0 + o, y0), b = hash2(x1 + o, y0), c = hash2(x0 + o, y1), d = hash2(x1 + o, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Tileable fractal value-noise field in [0,1] of size n x n. scale = lattice cells across the tile. */
function noiseField(n, scale, octaves, seed = 0) {
  const out = new Float32Array(n * n);
  const base = Math.max(1, Math.round(scale));
  let norm = 0;
  for (let o = 0, amp = 0.5; o < octaves; o++, amp *= 0.5) norm += amp;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let sum = 0, amp = 0.5, p = base;
    for (let o = 0; o < octaves; o++) { sum += amp * pnoise((x / n) * p, (y / n) * p, p, seed + o); amp *= 0.5; p *= 2; }
    out[y * n + x] = sum / norm;
  }
  return out;
}
function normalFromHeight(h, n, strength) {
  const c = makeCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + ((x - 1 + n) % n)], r = h[y * n + ((x + 1) % n)];
    const t = h[((y - 1 + n) % n) * n + x], b = h[((y + 1) % n) * n + x];
    let nx = (l - r) * strength, ny = (t - b) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * n + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}
function fromField(n, fn) {
  const c = makeCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    const [r, gg, b] = fn(x, y);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const GENERATORS = {
  asphalt(n) {
    const h = noiseField(n, 7, 4, 1);
    const fine = noiseField(n, 48, 2, 2);
    const r = rng(11);
    const col = fromField(n, (x, y) => {
      const v = 34 + h[y * n + x] * 22 + fine[y * n + x] * 26 + (r() < 0.02 ? 25 : 0);
      return [v, v, v * 1.02];
    });
    const rough = fromField(n, (x, y) => { const v = 205 + h[y * n + x] * 45 - fine[y * n + x] * 22; return [v, v, v]; });
    const hh = new Float32Array(n * n); for (let i = 0; i < hh.length; i++) hh[i] = fine[i] * 0.7 + h[i] * 0.3;
    // gentle normals: strong ones read as water ripples under headlights
    return { map: tex(col), roughnessMap: tex(rough, { srgb: false }), normalMap: normalFromHeight(hh, n, 1.6) };
  },
  concrete(n) {
    const h = noiseField(n, 5, 4, 3), f = noiseField(n, 40, 2, 4);
    const col = fromField(n, (x, y) => { const v = 118 + h[y * n + x] * 40 + f[y * n + x] * 18; return [v, v * 0.99, v * 0.96]; });
    const g = col.getContext('2d');
    g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = Math.max(1, n / 256);
    g.beginPath(); g.moveTo(0, 1); g.lineTo(n, 1); g.moveTo(1, 0); g.lineTo(1, n); g.stroke();
    return { map: tex(col), normalMap: normalFromHeight(f, n, 0.8) };
  },
  grass(n) {
    const h = noiseField(n, 6, 4, 5), f = noiseField(n, 60, 2, 6);
    const col = fromField(n, (x, y) => { const a = h[y * n + x], b = f[y * n + x]; return [48 + a * 30 + b * 20, 74 + a * 40 + b * 30, 30 + a * 14]; });
    return { map: tex(col), normalMap: normalFromHeight(f, n, 1.6) };
  },
  dirt(n) {
    const h = noiseField(n, 6, 5, 7), f = noiseField(n, 50, 2, 8);
    const col = fromField(n, (x, y) => { const a = h[y * n + x], b = f[y * n + x]; return [98 + a * 50 + b * 25, 78 + a * 38 + b * 20, 56 + a * 26 + b * 14]; });
    return { map: tex(col), normalMap: normalFromHeight(f, n, 5) };
  },
  /** Neutral ground detail (near white): terrains tint it with vertex colours per region. */
  ground(n) {
    const h = noiseField(n, 6, 4, 13), f = noiseField(n, 48, 2, 14), g = noiseField(n, 160, 1, 15);
    const col = fromField(n, (x, y) => { const k = y * n + x; const v = 222 + (h[k] - 0.5) * 40 + (f[k] - 0.5) * 46 + (g[k] - 0.5) * 30; return [v, v * 0.995, v * 0.985]; });
    return { map: tex(col), normalMap: normalFromHeight(f, n, 1.4) };
  },
  carbon(n) {
    const c = makeCanvas(n, n), g = c.getContext('2d');
    const cell = n / 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const horiz = (x + y) % 4 < 2;
      const grd = horiz ? g.createLinearGradient(x * cell, y * cell, x * cell, (y + 1) * cell) : g.createLinearGradient(x * cell, y * cell, (x + 1) * cell, y * cell);
      grd.addColorStop(0, '#0b0b0d'); grd.addColorStop(0.5, '#2a2b30'); grd.addColorStop(1, '#0b0b0d');
      g.fillStyle = grd; g.fillRect(x * cell, y * cell, cell, cell);
    }
    return { map: tex(c) };
  },
  leather(n) {
    const f = noiseField(n, 90, 2, 9);
    const col = fromField(n, (x, y) => { const v = 200 + f[y * n + x] * 55; return [v, v, v]; });
    return { map: tex(col), normalMap: normalFromHeight(f, n, 6) };
  },
  tread(n) {
    const c = makeCanvas(n, n), g = c.getContext('2d');
    g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, n, n);
    g.fillStyle = '#0d0d0e';
    for (let i = 0; i < 16; i++) { const y = (i / 16) * n; g.fillRect(n * 0.18, y, n * 0.06, n / 40); g.fillRect(n * 0.76, y + n / 32, n * 0.06, n / 40); }
    g.fillRect(n * 0.4, 0, n * 0.03, n); g.fillRect(n * 0.57, 0, n * 0.03, n);
    return { map: tex(c) };
  },
  sidewall(n) {
    const c = makeCanvas(n, n), g = c.getContext('2d');
    g.fillStyle = '#1a1a1c'; g.fillRect(0, 0, n, n);
    g.translate(n / 2, n / 2);
    g.fillStyle = '#dad6cc'; g.font = `700 ${Math.round(n / 14)}px ${FONT_UI}`; g.textAlign = 'center';
    const words = ['FORMOSA', 'RACING', 'FORMOSA', 'RACING'];
    words.forEach((w, i) => { g.save(); g.rotate((i / words.length) * Math.PI * 2); g.fillText(w, 0, -n * 0.39); g.restore(); });
    return { map: tex(c, { repeat: false }) };
  },
  grille(n) {
    const c = makeCanvas(n, n), g = c.getContext('2d');
    g.fillStyle = '#060606'; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#2b2c2f'; g.lineWidth = n / 64;
    const s = n / 12;
    for (let y = -1; y < 14; y++) for (let x = -1; x < 14; x++) {
      const cx = x * s + (y % 2) * s / 2, cy = y * s * 0.86;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5); }
      g.closePath(); g.stroke();
    }
    return { map: tex(c) };
  },
  // lamp lens optics (normal maps): pillow cells, horizontal ribs, vertical flutes
  lensOptic(n) {
    const h = new Float32Array(n * n), cells = 16;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = ((x / n) * cells) % 1, v = ((y / n) * cells) % 1;
      h[y * n + x] = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
    }
    const c = makeCanvas(n, n); c.getContext('2d').fillStyle = '#fff'; c.getContext('2d').fillRect(0, 0, n, n);
    return { map: tex(c), normalMap: normalFromHeight(h, n, 5) };
  },
  lensRibs(n) {
    const h = new Float32Array(n * n), ribs = 24;
    for (let y = 0; y < n; y++) { const v = ((y / n) * ribs) % 1; const k = Math.sin(v * Math.PI); for (let x = 0; x < n; x++) h[y * n + x] = k; }
    const c = makeCanvas(n, n); c.getContext('2d').fillStyle = '#fff'; c.getContext('2d').fillRect(0, 0, n, n);
    return { map: tex(c), normalMap: normalFromHeight(h, n, 6) };
  },
  lensFlutes(n) {
    const h = new Float32Array(n * n), fl = 20;
    for (let x = 0; x < n; x++) { const u = ((x / n) * fl) % 1; const k = Math.sin(u * Math.PI); for (let y = 0; y < n; y++) h[y * n + x] = k; }
    const c = makeCanvas(n, n); c.getContext('2d').fillStyle = '#fff'; c.getContext('2d').fillRect(0, 0, n, n);
    return { map: tex(c), normalMap: normalFromHeight(h, n, 4) };
  },
  // fine moulded-plastic / vinyl grain (bumpers, dashboards, door cards)
  grain(n) {
    const f = noiseField(n, 64, 3, 21);
    const c = fromField(n, (x, y) => { const v = 225 + f[y * n + x] * 30; return [v, v, v]; });
    return { map: tex(c), normalMap: normalFromHeight(f, n, 3.5) };
  },
  // ---- interior fabrics and trims (map colours are multiplied by the material colour: use white for patterned ones)
  cloth80s(n) {
    // charcoal tweed with thin warm pinstripes every few millimetres
    const f = noiseField(n, 128, 2, 31), w = noiseField(n, 256, 1, 32);
    const c = fromField(n, (x, y) => {
      const k = 52 + f[y * n + x] * 26 + ((x + y) % 4 < 2 ? 6 : -4);
      const stripe = (y % (n / 8)) < n / 160 ? 1 : (y % (n / 8)) > n / 16 && (y % (n / 8)) < n / 16 + n / 256 ? 0.6 : 0;
      return [k + stripe * 150, k + stripe * 72, k * 1.04 + stripe * 24];
    });
    return { map: tex(c), normalMap: normalFromHeight(w, n, 4) };
  },
  carpet(n) {
    const f = noiseField(n, 160, 2, 33);
    const c = fromField(n, (x, y) => { const v = 175 + f[y * n + x] * 80; return [v, v, v]; });
    return { map: tex(c), normalMap: normalFromHeight(f, n, 7) };
  },
  headliner(n) {
    // light perforated vinyl: tiny dots on a soft grain
    const f = noiseField(n, 48, 3, 34);
    const step = Math.max(4, Math.round(n / 64));
    const c = fromField(n, (x, y) => { const hole = (x % step) < step * 0.28 && (y % step) < step * 0.28; const v = hole ? 150 : 228 + f[y * n + x] * 20; return [v, v, v * 0.98]; });
    const h = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = ((x % step) < step * 0.28 && (y % step) < step * 0.28) ? 0 : 1;
    return { map: tex(c), normalMap: normalFromHeight(h, n, 1.2) };
  },
  alcantara(n) {
    const f = noiseField(n, 200, 2, 35), g2 = noiseField(n, 20, 2, 36);
    const c = fromField(n, (x, y) => { const v = 200 + f[y * n + x] * 30 + g2[y * n + x] * 25; return [v, v, v]; });
    return { map: tex(c), normalMap: normalFromHeight(f, n, 1.5) };
  },
  perforated(n) {
    // leather with a perforation grid (seat centres)
    const f = noiseField(n, 90, 2, 37);
    const step = Math.max(6, Math.round(n / 40));
    const c = fromField(n, (x, y) => { const dx = (x % step) - step / 2, dy = (y % step) - step / 2; const hole = dx * dx + dy * dy < (step * 0.16) ** 2; const v = hole ? 40 : 205 + f[y * n + x] * 45; return [v, v, v]; });
    return { map: tex(c), normalMap: normalFromHeight(f, n, 6) };
  },
  quilted(n) {
    // diamond quilting with stitch lines (luxury seat centres)
    const f = noiseField(n, 90, 2, 38);
    const h = new Float32Array(n * n);
    const k = 4;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = ((x + y) / n) * k, v = ((x - y + n) / n) * k;
      const du = Math.abs((u % 1) - 0.5), dv = Math.abs((v % 1) - 0.5);
      h[y * n + x] = Math.min(1, Math.min(0.5 - du, 0.5 - dv) * 6) * 0.9 + f[y * n + x] * 0.1;
    }
    const c = fromField(n, (x, y) => { const v = 150 + h[y * n + x] * 80 + f[y * n + x] * 20; return [v, v, v]; });
    return { map: tex(c), normalMap: normalFromHeight(h, n, 5) };
  },
  speaker(n) {
    // speaker grille: dense hole pattern
    const step = Math.max(4, Math.round(n / 48));
    const c = fromField(n, (x, y) => { const dx = (x % step) - step / 2, dy = ((y + (Math.floor(x / step) % 2) * step / 2) % step) - step / 2; const hole = dx * dx + dy * dy < (step * 0.3) ** 2; const v = hole ? 10 : 70; return [v, v, v]; });
    return { map: tex(c) };
  },
  brushed(n) {
    const c = fromField(n, (x, y) => { const v = 150 + hash2(y, 3) * 60 + valueNoise(x / 40, y) * 20; return [v, v, v]; });
    return { map: tex(c) };
  },
};

/** Get (and cache) a procedural texture set. size is rounded to a power of two. */
export function getTextureSet(key, size = 512) {
  const n = 1 << Math.round(Math.log2(Math.max(32, size)));
  const k = `${key}@${n}`;
  if (!cache.has(k)) {
    const gen = GENERATORS[key];
    if (!gen) throw new Error(`unknown texture "${key}"`);
    cache.set(k, gen(n));
  }
  return cache.get(k);
}
export function registerTexture(key, generator) { GENERATORS[key] = generator; }
export const textureKeys = () => Object.keys(GENERATORS);
export { tex as canvasTexture, noiseField, fromField, normalFromHeight };
