// Shop signs with Traditional Chinese text, drawn into shared atlases so thousands of signs cost one
// material (one draw call per chunk after batching). Lit signs glow at night (emissive map = sign).
import * as THREE from 'three';
import { makeCanvas, FONT_CJK } from '../../core/canvas.js';
import { canvasTexture } from '../../render/textures.js';
import { rng } from '../../core/math.js';

export const SHOP_NAMES = ['牛肉麵', '珍珠奶茶', '便當', '藥局', '檳榔', '早餐店', '機車行', '輪胎行', '汽車美容', '旅館', '卡拉OK', '當舖', '眼鏡行', '火鍋', '小吃', '鹽酥雞', '水果行', '五金行', '診所', '補習班', '麵包店', '咖啡', '電器行', '茶行', '鐘錶', '銀樓', '書局', '洗衣店', '理髮', '修車廠', '滷肉飯', '豆花', '夜市', '按摩', '網咖', '酒吧', '刺青', '飲料', '烤鴨', '鍋貼'];
const PALETTES = [
  ['#c8231d', '#fff6e0'], ['#f2c21b', '#b0130f'], ['#f4f1e8', '#1d4f9e'], ['#1d7a3e', '#fff8e6'], ['#111111', '#ffb52e'],
  ['#e8541c', '#ffffff'], ['#f7f7f2', '#d1201a'], ['#14336b', '#ffd34a'], ['#7a1630', '#ffe9b0'], ['#ffe14d', '#111111'],
];

export class SignAtlas {
  /** Vertical signs: cols x rows slots of slotW x slotH pixels. */
  constructor(M, { cols = 8, rows = 2, slotW = 128, slotH = 512, horizontal = false } = {}) {
    this.cols = cols; this.rows = rows; this.slotW = slotW; this.slotH = slotH; this.horizontal = horizontal;
    this.canvas = makeCanvas(cols * slotW, rows * slotH);
    this.g = this.canvas.getContext('2d');
    this.g.fillStyle = '#000'; this.g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.next = 0;
    this.texture = canvasTexture(this.canvas, { repeat: false });
    this.material = M.surface({ map: this.texture, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 0.05, roughness: 0.55 });
    this.material.userData.nightEmissive = [0.05, 1.35];
    this.cache = new Map();
  }
  /** Returns UV rect [u0, v0, u1, v1] for a sign with this text (reused when the same text+palette repeats). */
  slot(text, paletteIndex = 0) {
    const key = `${text}|${paletteIndex}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const i = this.next % (this.cols * this.rows);
    this.next++;
    const cx = (i % this.cols) * this.slotW, cy = Math.floor(i / this.cols) * this.slotH;
    const g = this.g, w = this.slotW, h = this.slotH;
    const [bg, fg] = PALETTES[paletteIndex % PALETTES.length];
    g.save();
    g.translate(cx, cy);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = w * 0.05; g.strokeRect(w * 0.06, w * 0.06, w - w * 0.12, h - w * 0.12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text];
    if (!this.horizontal) {
      const fs = Math.min(w * 0.68, (h * 0.86) / chars.length);
      g.font = `900 ${fs}px ${FONT_CJK}`;
      chars.forEach((c, k) => g.fillText(c, w / 2, h * 0.07 + fs * (k + 0.55) + (h * 0.86 - fs * chars.length) / 2));
    } else {
      const fs = Math.min(h * 0.7, (w * 0.88) / chars.length);
      g.font = `900 ${fs}px ${FONT_CJK}`;
      g.fillText(text, w / 2, h / 2);
    }
    g.restore();
    this.texture.needsUpdate = true;
    const W = this.canvas.width, H = this.canvas.height;
    // canvas y grows down, uv v grows up
    const rect = [cx / W, 1 - (cy + h) / H, (cx + w) / W, 1 - cy / H];
    this.cache.set(key, rect);
    return rect;
  }
  /** Box geometry for a sign of size [w, h, depth] using this slot on both big faces. */
  geometry(rect, w, h, depth = 0.25) {
    const g = new THREE.BoxGeometry(depth, h, w);
    const uv = g.attributes.uv;
    // faces: +x, -x, +y, -y, +z, -z (4 verts each). Map the slot on +x / -x faces (the readable sides)
    for (const face of [0, 1]) for (let k = 0; k < 4; k++) {
      const vi = face * 4 + k;
      const u = uv.getX(vi), v = uv.getY(vi);
      uv.setXY(vi, rect[0] + (rect[2] - rect[0]) * u, rect[1] + (rect[3] - rect[1]) * v);
    }
    for (let vi = 8; vi < 24; vi++) uv.setXY(vi, rect[0] + 0.001, rect[1] + 0.001); // edges: sign colour
    uv.needsUpdate = true;
    return g;
  }
}

export function pickSign(rand) {
  return { text: SHOP_NAMES[Math.floor(rand() * SHOP_NAMES.length)], palette: Math.floor(rand() * PALETTES.length) };
}
export { rng };
