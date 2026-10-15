// Facade atlas for the Formosa city: one canvas with every wall, window, shopfront, office and roof tile
// (one bay x one floor each) plus an emissive twin with the lit windows. Buildings map each quad to a tile, so
// the whole city draws with a handful of materials. Walls are drawn near white and tinted by vertex colour.
// Tiles are padded so mipmaps do not bleed between neighbours.
import * as THREE from 'three';
import { makeCanvas, FONT_CJK } from '../../../src/core/canvas.js';
import { canvasTexture } from '../../../src/render/textures.js';
import { rng } from '../../../src/core/math.js';

export const T = 128;               // tile size in px
export const COLS = 8, ROWS = 8;     // atlas grid
const PAD = 4;                       // inner padding (px) used by the UVs

// tile ids -> [col, row]
export const TILE = {
  // upper floors (residential)
  grille: [0, 0], grilleLit: [1, 0], ac: [2, 0], acLit: [3, 0], balcony: [4, 0], balconyLit: [5, 0], twin: [6, 0], twinLit: [7, 0],
  wall: [0, 1], brick: [1, 1], enclosed: [2, 1], enclosedLit: [3, 1], apt: [4, 1], aptLit: [5, 1], laundry: [6, 1], laundryLit: [7, 1],
  // offices and towers
  band: [0, 2], bandLit: [1, 2], grid: [2, 2], gridLit: [3, 2], curtain: [4, 2], curtainLit: [5, 2], fins: [6, 2], finsLit: [7, 2],
  // hotels, old town, misc upper
  hotel: [0, 3], hotelLit: [1, 3], shutters: [2, 3], shuttersLit: [3, 3], arch: [4, 3], archLit: [5, 3], vent: [6, 3], stair: [7, 3],
  // ground floors
  shop: [0, 4], shopB: [1, 4], closed: [2, 4], conv: [3, 4], eatery: [4, 4], arcade: [5, 4], lobby: [6, 4], garage: [7, 4],
  shopC: [0, 5], tea: [1, 5], scooterShop: [2, 5], pharmacy: [3, 5], closedB: [4, 5], gate: [5, 5], market: [6, 5], blank: [7, 5],
  // roofs and sheds
  roof: [0, 6], roofB: [1, 6], sheet: [2, 6], sheetB: [3, 6], gravel: [4, 6], solar: [5, 6], tileRoof: [6, 6], plain: [7, 6],
  // temples and screens: glazed tiles (tinted gold or green), a studded door, two lit advertising screens, stone paving
  glazed: [0, 7], door: [1, 7], screen: [2, 7], screenB: [3, 7], paving: [4, 7],
};
export const LIT = { grille: 'grilleLit', ac: 'acLit', balcony: 'balconyLit', twin: 'twinLit', enclosed: 'enclosedLit', apt: 'aptLit', laundry: 'laundryLit', band: 'bandLit', grid: 'gridLit', curtain: 'curtainLit', fins: 'finsLit', hotel: 'hotelLit', shutters: 'shuttersLit', arch: 'archLit' };

/** UV rect of a tile: [u0, v0, u1, v1] (v up). */
export function tileUV(name) {
  const [c, r] = TILE[name] || TILE.wall;
  const W = COLS * T, H = ROWS * T;
  return [(c * T + PAD) / W, 1 - (r * T + T - PAD) / H, (c * T + T - PAD) / W, 1 - (r * T + PAD) / H];
}

export function makeFacadeAtlas(M, nightList) {
  const W = COLS * T, H = ROWS * T;
  const c = makeCanvas(W, H), e = makeCanvas(W, H);
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const r = rng(77);
  const at = (name) => { const [cc, rr] = TILE[name]; return [cc * T, rr * T]; };
  const rect = (G, x, y, w, h, col) => { G.fillStyle = col; G.fillRect(x, y, w, h); };
  // small ceramic tiles: the Taiwanese facade signature
  const ceramic = (x, y, w, h, base = '#ebe7de', line = 'rgba(0,0,0,0.10)', s = 6) => {
    rect(g, x, y, w, h, base);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(x + r() * w, y + r() * h, s, s); }
    g.strokeStyle = line; g.lineWidth = 1;
    g.beginPath();
    for (let yy = y; yy <= y + h; yy += s) { g.moveTo(x, yy + 0.5); g.lineTo(x + w, yy + 0.5); }
    for (let xx = x; xx <= x + w; xx += s) { g.moveTo(xx + 0.5, y); g.lineTo(xx + 0.5, y + h); }
    g.stroke();
    // grime streaks under sills
    for (let i = 0; i < 3; i++) { const gx = x + r() * w; const gr = g.createLinearGradient(0, y + h * 0.55, 0, y + h); gr.addColorStop(0, 'rgba(60,55,45,0.12)'); gr.addColorStop(1, 'rgba(60,55,45,0)'); g.fillStyle = gr; g.fillRect(gx, y + h * 0.55, 3 + r() * 6, h * 0.45); }
  };
  const glass = (x, y, w, h, lit, warm = true) => {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, lit ? (warm ? '#6a5a44' : '#4f5d68') : '#2a3236'); gr.addColorStop(1, lit ? (warm ? '#3c3328' : '#2f3a42') : '#151a1d');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(200,215,225,0.16)'; g.fillRect(x, y, w, h * 0.3);
    if (lit) {
      const col = warm ? `rgb(${235 + r() * 20},${178 + r() * 30},${104 + r() * 30})` : `rgb(${180 + r() * 30},${206 + r() * 25},235)`;
      ge.fillStyle = col; ge.fillRect(x + 1, y + 1, w - 2, h - 2);
      // curtains / a figure of furniture breaking up the light
      ge.fillStyle = 'rgba(0,0,0,0.35)'; ge.fillRect(x + w * (0.1 + r() * 0.5), y + 1, w * (0.15 + r() * 0.2), h - 2);
    }
  };
  const frame = (x, y, w, h, col = '#a7adaf', lw = 3) => { g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); };
  const cage = (x, y, w, h) => {
    g.fillStyle = 'rgba(40,44,46,0.25)'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.strokeStyle = '#62686a'; g.lineWidth = 2;
    g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    g.beginPath(); for (let k = 1; k < 8; k++) { const xx = x - 3 + (w + 6) * k / 8; g.moveTo(xx, y - 3); g.lineTo(xx, y + h + 3); } g.stroke();
    g.beginPath(); g.moveTo(x - 3, y + h * 0.5); g.lineTo(x + w + 3, y + h * 0.5); g.stroke();
    // flower-pattern scrollwork that every 1980s grille has
    g.strokeStyle = 'rgba(98,104,106,0.8)'; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.25, 5, 0, Math.PI * 2); g.stroke();
  };
  const acBox = (x, y) => { rect(g, x, y, 34, 22, '#e6e6df'); g.strokeStyle = '#b6b6ae'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 33, 21); g.beginPath(); g.arc(x + 22, y + 11, 8, 0, Math.PI * 2); g.stroke(); rect(g, x + 3, y + 4, 10, 2, '#c4c4bc'); rect(g, x + 3, y + 8, 10, 2, '#c4c4bc'); };

  // ---- row 0-1: residential uppers
  const resid = (name, lit, kind) => {
    const [x, y] = at(name);
    ceramic(x, y, T, T, kind === 'brick' ? '#c98d6e' : '#ebe7de', kind === 'brick' ? 'rgba(80,30,20,0.18)' : 'rgba(0,0,0,0.10)', kind === 'brick' ? 8 : 6);
    if (kind === 'wall' || kind === 'brick') { rect(g, x, y + T - 6, T, 6, 'rgba(0,0,0,0.12)'); return; }
    if (kind === 'grille' || kind === 'ac') {
      glass(x + 26, y + 30, 76, 62, lit); frame(x + 26, y + 30, 76, 62); cage(x + 26, y + 30, 76, 62);
      if (kind === 'ac') acBox(x + 74, y + 96);
    } else if (kind === 'balcony' || kind === 'laundry') {
      glass(x + 20, y + 18, 88, 84, lit); frame(x + 20, y + 18, 88, 84, '#8f9596');
      rect(g, x + 8, y + 72, 112, 4, '#b0b5b5'); for (let k = 0; k < 12; k++) rect(g, x + 10 + k * 9.5, y + 74, 2, 34, '#9ea3a3');
      rect(g, x + 8, y + 104, 112, 6, '#d8d4cb');
      if (kind === 'laundry') { g.strokeStyle = '#777'; g.beginPath(); g.moveTo(x + 22, y + 40); g.lineTo(x + 106, y + 40); g.stroke(); for (let k = 0; k < 6; k++) { rect(g, x + 26 + k * 13 + r() * 3, y + 40, 9, 16 + r() * 12, ['#d34b3e', '#3d6fb0', '#f1f1ea', '#e0b13a', '#6aa06a', '#d07fb0'][k]); } }
    } else if (kind === 'twin') {
      for (const ox of [14, 70]) { glass(x + ox, y + 34, 44, 56, lit && ox === 14 || (lit && r() < 0.5)); frame(x + ox, y + 34, 44, 56); }
    } else if (kind === 'enclosed') {
      // balcony enclosed in aluminium and frosted glass: the classic Taipei add-on
      rect(g, x + 8, y + 14, 112, 96, '#b9bec0'); for (let k = 0; k < 4; k++) glass(x + 12 + k * 27, y + 18, 23, 54, lit && k % 2 === 0); rect(g, x + 8, y + 76, 112, 34, '#cfd3d2'); frame(x + 8, y + 14, 112, 96, '#8e9495', 2);
      acBox(x + 82, y + 82);
    } else if (kind === 'apt') {
      glass(x + 18, y + 24, 92, 66, lit, r() < 0.7); frame(x + 18, y + 24, 92, 66, '#9aa0a2');
      rect(g, x + 18, y + 56, 92, 3, '#9aa0a2'); rect(g, x + 63, y + 24, 3, 66, '#9aa0a2');
      rect(g, x + 10, y + 96, 108, 5, '#d6d2c8');
    }
  };
  resid('grille', false, 'grille'); resid('grilleLit', true, 'grille'); resid('ac', false, 'ac'); resid('acLit', true, 'ac');
  resid('balcony', false, 'balcony'); resid('balconyLit', true, 'balcony'); resid('twin', false, 'twin'); resid('twinLit', true, 'twin');
  resid('wall', false, 'wall'); resid('brick', false, 'brick'); resid('enclosed', false, 'enclosed'); resid('enclosedLit', true, 'enclosed');
  resid('apt', false, 'apt'); resid('aptLit', true, 'apt'); resid('laundry', false, 'laundry'); resid('laundryLit', true, 'laundry');

  // ---- row 2: offices and towers (glass is drawn mid grey so the vertex colour can tint it)
  const office = (name, lit, kind) => {
    const [x, y] = at(name);
    if (kind === 'band') { rect(g, x, y, T, T, '#d9d8d2'); glass(x, y + 26, T, 70, lit, false); rect(g, x, y + 96, T, 32, '#cfcdc6'); for (let k = 0; k < 4; k++) rect(g, x + k * 32, y + 26, 3, 70, '#8e959a'); }
    else if (kind === 'grid') { rect(g, x, y, T, T, '#c8c6bf'); for (let k = 0; k < 3; k++) { glass(x + 6 + k * 41, y + 12, 34, 96, lit && (k + (r() < 0.5 ? 1 : 0)) % 2 === 0, false); } }
    else if (kind === 'curtain') { glass(x, y, T, T, lit, false); g.strokeStyle = '#7d8b94'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * 32, y); g.lineTo(x + k * 32, y + T); g.stroke(); } g.beginPath(); g.moveTo(x, y + T - 2); g.lineTo(x + T, y + T - 2); g.stroke(); const sh = g.createLinearGradient(x, y, x + T, y + T); sh.addColorStop(0, 'rgba(180,210,230,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(x, y, T, T); }
    else if (kind === 'fins') { rect(g, x, y, T, T, '#bcb9b1'); glass(x + 8, y + 8, T - 16, T - 24, lit, r() < 0.5); for (let k = 0; k < 6; k++) rect(g, x + 4 + k * 23, y, 6, T, '#d8d5cd'); }
  };
  office('band', false, 'band'); office('bandLit', true, 'band'); office('grid', false, 'grid'); office('gridLit', true, 'grid');
  office('curtain', false, 'curtain'); office('curtainLit', true, 'curtain'); office('fins', false, 'fins'); office('finsLit', true, 'fins');

  // ---- row 3: hotels, old town
  const misc = (name, lit, kind) => {
    const [x, y] = at(name);
    if (kind === 'hotel') { ceramic(x, y, T, T, '#efe9dd'); glass(x + 20, y + 22, 88, 70, lit); frame(x + 20, y + 22, 88, 70, '#b9a27a', 4); rect(g, x + 14, y + 96, 100, 8, '#c9b48a'); }
    else if (kind === 'shutters') { ceramic(x, y, T, T, '#efe6d2'); glass(x + 34, y + 20, 60, 82, lit); rect(g, x + 14, y + 20, 18, 82, '#4c7a6a'); rect(g, x + 96, y + 20, 18, 82, '#4c7a6a'); for (let k = 0; k < 9; k++) { rect(g, x + 14, y + 24 + k * 9, 18, 2, '#3a5f52'); rect(g, x + 96, y + 24 + k * 9, 18, 2, '#3a5f52'); } }
    else if (kind === 'arch') { rect(g, x, y, T, T, '#cf9a7c'); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(90,40,25,${r() * 0.18})`; g.fillRect(x + r() * T, y + r() * T, 10, 5); } g.fillStyle = '#ece4d4'; g.beginPath(); g.moveTo(x + 22, y + 108); g.lineTo(x + 22, y + 52); g.arc(x + 64, y + 52, 42, Math.PI, 0); g.lineTo(x + 106, y + 108); g.fill(); glass(x + 30, y + 52, 68, 54, lit); g.fillStyle = lit ? '#8a7457' : '#2a3236'; g.beginPath(); g.arc(x + 64, y + 52, 34, Math.PI, 0); g.fill(); if (lit) { ge.fillStyle = '#f2c27e'; ge.beginPath(); ge.arc(x + 64, y + 52, 34, Math.PI, 0); ge.fill(); } }
    else if (kind === 'vent') { ceramic(x, y, T, T); for (let k = 0; k < 6; k++) rect(g, x + 24, y + 26 + k * 12, 80, 6, '#9ca1a2'); }
    else if (kind === 'stair') { ceramic(x, y, T, T); for (let k = 0; k < 5; k++) { rect(g, x + 50, y + 14 + k * 22, 28, 14, '#2a3236'); } }
  };
  misc('hotel', false, 'hotel'); misc('hotelLit', true, 'hotel'); misc('shutters', false, 'shutters'); misc('shuttersLit', true, 'shutters');
  misc('arch', false, 'arch'); misc('archLit', true, 'arch'); misc('vent', false, 'vent'); misc('stair', false, 'stair');

  // ---- rows 4-5: ground floors (lit at night in the emissive twin)
  const shop = (name, kind) => {
    const [x, y] = at(name);
    rect(g, x, y, T, T, '#bdb8ae');
    const interior = (col, emi) => { rect(g, x + 6, y + 30, T - 12, T - 34, col); ge.globalAlpha = 0.62; ge.fillStyle = emi; ge.fillRect(x + 6, y + 30, T - 12, T - 34); ge.globalAlpha = 1; };
    if (kind === 'shop' || kind === 'shopB' || kind === 'shopC' || kind === 'tea' || kind === 'pharmacy' || kind === 'scooterShop' || kind === 'market') {
      const warm = kind === 'shop' || kind === 'tea' || kind === 'market';
      interior(warm ? '#d9b88a' : '#d8dcd6', warm ? '#ffcf8f' : '#e8f2ff');
      // shelves and goods
      for (let k = 0; k < 3; k++) { rect(g, x + 10, y + 52 + k * 22, T - 20, 4, '#6c5a46'); for (let q = 0; q < 9; q++) rect(g, x + 12 + q * 12, y + 40 + k * 22, 8, 11, ['#c8433a', '#3f7ab5', '#e9c24c', '#5aa363', '#e6e1d6'][(q + k) % 5]); }
      if (kind === 'scooterShop') { g.fillStyle = '#222'; for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(x + 26 + q * 36, y + 112, 9, 0, Math.PI * 2); g.fill(); } }
      if (kind === 'pharmacy') { rect(g, x + 54, y + 38, 20, 6, '#2a9a54'); rect(g, x + 61, y + 31, 6, 20, '#2a9a54'); }
      if (kind === 'tea') { for (let q = 0; q < 4; q++) { rect(g, x + 14 + q * 28, y + 86, 18, 26, '#f4efe2'); rect(g, x + 14 + q * 28, y + 86, 18, 8, ['#8a5a2a', '#c4823a', '#3b2a1f', '#e3c08a'][q]); } }
      // rolling shutter box
      rect(g, x, y, T, 30, '#8d9093'); for (let k = 0; k < 6; k++) rect(g, x, y + 4 + k * 4.5, T, 1.5, '#7a7d80');
    } else if (kind === 'closed' || kind === 'closedB') {
      rect(g, x + 4, y + 8, T - 8, T - 8, kind === 'closed' ? '#9a9d9f' : '#7f8a8c'); for (let k = 0; k < 28; k++) rect(g, x + 4, y + 10 + k * 4.2, T - 8, 1.6, 'rgba(0,0,0,0.18)');
      g.fillStyle = 'rgba(30,30,30,0.35)'; g.font = `700 18px ${FONT_CJK}`; g.textAlign = 'center'; if (kind === 'closedB') g.fillText('停車', x + T / 2, y + 70);
    } else if (kind === 'conv') {
      // convenience store: bright, glass, a striped fascia (no brand)
      interior('#f2f4f0', '#ffffff'); rect(g, x, y, T, 12, '#1f8c6e'); rect(g, x, y + 12, T, 6, '#f08a24'); rect(g, x, y + 18, T, 6, '#d8352a'); rect(g, x, y + 24, T, 6, '#f4f4f0');
      for (let k = 0; k < 3; k++) rect(g, x + 8, y + 52 + k * 24, T - 16, 3, '#c9cdc8');
      g.strokeStyle = '#8c9396'; g.lineWidth = 3; g.strokeRect(x + 40, y + 50, 48, 76);
      ge.fillStyle = '#ffffff'; ge.fillRect(x, y, T, 30);
    } else if (kind === 'eatery') {
      interior('#c98d55', '#ffb36b'); for (let k = 0; k < 3; k++) { rect(g, x + 12 + k * 38, y + 92, 26, 8, '#7b5536'); rect(g, x + 16 + k * 38, y + 100, 3, 20, '#5a3d27'); }
      for (let k = 0; k < 4; k++) { rect(g, x + 14 + k * 28, y + 36, 20, 30, '#f5ecd6'); rect(g, x + 16 + k * 28, y + 40, 16, 3, '#c33'); }
      rect(g, x, y, T, 30, '#b8251c'); ge.fillStyle = '#ff6040'; ge.fillRect(x, y, T, 30);
    } else if (kind === 'arcade') {
      rect(g, x, y, T, T, '#4a4743'); interior('#6e6254', '#8a6c48'); rect(g, x, y, T, 24, '#d4cfc4');
    } else if (kind === 'lobby') {
      rect(g, x, y, T, T, '#2a3034'); interior('#b8b2a2', '#fff1d6'); for (let k = 0; k <= 4; k++) rect(g, x + k * 31, y + 30, 3, T - 30, '#8d969b'); rect(g, x, y, T, 30, '#3a4247');
    } else if (kind === 'garage') {
      rect(g, x + 10, y + 20, T - 20, T - 20, '#8e9292'); for (let k = 0; k < 14; k++) rect(g, x + 10, y + 22 + k * 7.5, T - 20, 2, 'rgba(0,0,0,0.2)');
    } else if (kind === 'gate') {
      rect(g, x, y, T, T, '#c9c3b6'); rect(g, x + 20, y + 30, T - 40, T - 30, '#3b3f40'); for (let k = 0; k < 10; k++) rect(g, x + 22 + k * 9, y + 30, 2, T - 30, '#6b7172');
    } else if (kind === 'blank') {
      ceramic(x, y, T, T, '#d9d4c9');
    }
  };
  for (const k of ['shop', 'shopB', 'closed', 'conv', 'eatery', 'arcade', 'lobby', 'garage', 'shopC', 'tea', 'scooterShop', 'pharmacy', 'closedB', 'gate', 'market', 'blank']) shop(k, k);

  // ---- row 6: roofs and sheet metal
  const roofT = (name, kind) => {
    const [x, y] = at(name);
    if (kind === 'roof' || kind === 'roofB') { rect(g, x, y, T, T, kind === 'roof' ? '#a7a39b' : '#8f8b84'); for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,38,34' : '230,228,220'},${r() * 0.12})`; g.fillRect(x + r() * T, y + r() * T, 4 + r() * 14, 4 + r() * 14); } }
    else if (kind === 'sheet' || kind === 'sheetB') { rect(g, x, y, T, T, kind === 'sheet' ? '#d6dbdc' : '#c9cbc6'); for (let k = 0; k < 16; k++) { rect(g, x + k * 8, y, 3, T, 'rgba(0,0,0,0.13)'); rect(g, x + k * 8 + 4, y, 1, T, 'rgba(255,255,255,0.18)'); } if (kind === 'sheetB') for (let k = 0; k < 20; k++) { g.fillStyle = `rgba(120,60,30,${r() * 0.2})`; g.fillRect(x + r() * T, y + r() * T, 6, 16); } }
    else if (kind === 'gravel') { rect(g, x, y, T, T, '#9a968c'); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.15})`; g.fillRect(x + r() * T, y + r() * T, 2, 2); } }
    else if (kind === 'solar') { rect(g, x, y, T, T, '#a8a49c'); for (let k = 0; k < 3; k++) for (let q = 0; q < 2; q++) { rect(g, x + 8 + q * 60, y + 8 + k * 40, 52, 34, '#1e2b44'); g.strokeStyle = '#8d9bb0'; g.lineWidth = 1; g.strokeRect(x + 8 + q * 60, y + 8 + k * 40, 52, 34); } }
    else if (kind === 'tileRoof') { rect(g, x, y, T, T, '#b4552e'); for (let k = 0; k < 16; k++) rect(g, x, y + k * 8, T, 2, 'rgba(60,20,10,0.35)'); for (let k = 0; k < 16; k++) rect(g, x + k * 8, y, 1, T, 'rgba(60,20,10,0.15)'); }
    else if (kind === 'plain') { rect(g, x, y, T, T, '#dedad1'); }
  };
  for (const k of ['roof', 'roofB', 'sheet', 'sheetB', 'gravel', 'solar', 'tileRoof', 'plain']) roofT(k, k);

  // ---- row 7: glazed roof tiles, temple door, screens, paving
  {
    let [x, y] = at('glazed');
    rect(g, x, y, T, T, '#f1ead8');
    for (let k = 0; k < 16; k++) { rect(g, x, y + k * 8 + 5, T, 3, 'rgba(90,70,30,0.32)'); }
    for (let k = 0; k < 16; k++) for (let q = 0; q < 16; q++) if ((k + q) % 2 === 0) rect(g, x + q * 8, y + k * 8, 1, 5, 'rgba(90,70,30,0.18)');
    [x, y] = at('door');
    rect(g, x, y, T, T, '#efe6d6');
    g.strokeStyle = 'rgba(70,30,20,0.55)'; g.lineWidth = 3; g.strokeRect(x + 8, y + 8, T / 2 - 12, T - 16); g.strokeRect(x + T / 2 + 4, y + 8, T / 2 - 12, T - 16);
    for (let k = 0; k < 6; k++) for (let q = 0; q < 3; q++) for (const ox of [16, T / 2 + 12]) { g.fillStyle = '#f6d47a'; g.beginPath(); g.arc(x + ox + q * 14, y + 20 + k * 17, 3, 0, Math.PI * 2); g.fill(); }
    const screen = (name, seed) => {
      const [sx, sy] = at(name);
      const pal = seed ? ['#ff3e8a', '#2ad1ff', '#ffe14d', '#ffffff'] : ['#ff7a1a', '#36ff8a', '#3a7aff', '#ffffff'];
      for (const G of [g, ge]) {
        G.fillStyle = '#05060a'; G.fillRect(sx, sy, T, T);
        for (let k = 0; k < 7; k++) { G.fillStyle = pal[k % pal.length]; const w = 12 + r() * 50, h = 8 + r() * 30; G.globalAlpha = 0.85; G.fillRect(sx + 6 + r() * (T - w - 12), sy + 6 + r() * (T - h - 12), w, h); }
        G.globalAlpha = 1;
        G.fillStyle = pal[3]; G.font = `bold 34px ${FONT_CJK}`; G.textAlign = 'center'; G.textBaseline = 'middle';
        G.fillText(seed ? '新上市' : '大特價', sx + T / 2, sy + T / 2);
      }
    };
    screen('screen', 0); screen('screenB', 1);
    [x, y] = at('paving');
    rect(g, x, y, T, T, '#d9d4c8');
    for (let k = 0; k < 4; k++) for (let q = 0; q < 4; q++) { g.strokeStyle = 'rgba(80,70,60,0.25)'; g.lineWidth = 2; g.strokeRect(x + q * 32 + (k % 2) * 16, y + k * 32, 32, 32); }
  }

  // pad: copy each tile's edge pixels outward is costly on a stub canvas; tiles already fill their cell fully
  const map = canvasTexture(c, { repeat: false }), emi = canvasTexture(e, { repeat: false });
  map.anisotropy = emi.anisotropy = 8;
  // matte walls: keep the local reflection cube (bright shopfronts) from washing every facade at night
  const mat = M.surface({ map, emissive: 0xffffff, emissiveMap: emi, emissiveIntensity: 0, vertexColors: true, roughness: 0.82, metalness: 0.02, envMapIntensity: 0.25 });
  mat.userData.nightEmissive = [0, 0.85];
  nightList.push(mat);
  return { mat, map, emi };
}
