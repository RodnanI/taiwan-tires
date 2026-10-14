// The head unit: a 1280x720 DOM "screen" that is projection-mapped onto the car's real infotainment
// display in the 3D cockpit (CSS matrix3d homography), or shown flat (accessibility / small screens /
// in-game pause), or docked beside the car in showroom views. Owns the screen router and focus navigation.
import { h, icon } from './dom.js';
import { SCREENS } from './screens/index.js';
import { fmtCredits } from '../core/math.js';

export const HU_W = 1280, HU_H = 720;
// docked beside the car (showroom screens) the unit reflows to a narrower logical width so text stays readable
export const HU_SIDE_W = 880;

const DOCK = [
  { id: 'home', en: 'HOME', zh: '主頁', icon: 'home' },
  { id: 'drive', en: 'DRIVE', zh: '駕駛', icon: 'drive' },
  { id: 'garage', en: 'GARAGE', zh: '車庫', icon: 'garage' },
  { id: 'dealer', en: 'DEALER', zh: '車行', icon: 'dealer' },
  { id: 'settings', en: 'SETTINGS', zh: '設定', icon: 'settings' },
];

export class Infotainment {
  constructor(game, parent, { inGame = false } = {}) {
    this.game = game;
    this.inGame = inGame;
    this.wrap = h('div.hu-wrap');
    this.el = h('div.hu', { data: { mode: 'flat' } });
    this.status = h('div.hu-status');
    this.body = h('div.hu-body');
    this.dock = h('div.hu-dock');
    this.glare = h('div.hu-glare');
    this.el.append(this.status, this.body, this.dock, this.glare);
    this.wrap.appendChild(this.el);
    parent.appendChild(this.wrap);
    this.stack = [];
    this.focused = null;
    this.mode = 'flat';
    this.cameraMode = 'cockpit';
    this._statusT = 0;
    this.buildStatus();
    this.buildDock();
    this.el.addEventListener('pointermove', (e) => { const f = e.target.closest?.('[data-focus]'); if (f && this.el.contains(f)) this.setFocus(f, false); });
    this.offNav = game.events.on('nav', (e) => { if (this.visible) this.nav(e.action); });
    this.visible = false;
  }
  dispose() { this.offNav(); this.wrap.remove(); }

  buildStatus() {
    this.clockEl = h('span.clock');
    this.creditsEl = h('span.credits');
    this.carEl = h('span');
    this.status.append(h('span.logo', {}, h('span.zh', {}, '台灣輪胎'), 'TAIWAN TIRES'), this.carEl, this.clockEl, this.creditsEl);
  }
  buildDock() {
    this.dockBtns = DOCK.map((d) => {
      const b = h('button.dock-btn', { data: { focus: '', dock: d.id }, on: { click: () => this.open(d.id, {}, { root: true }) } }, icon(d.icon), d.en, h('span.zh', {}, d.zh));
      this.dock.appendChild(b);
      return b;
    });
    if (this.inGame) this.dock.style.display = 'none';
  }
  show() { this.visible = true; this.wrap.style.display = ''; }
  hide() { this.visible = false; this.wrap.style.display = 'none'; }

  // ------------------------------------------------------------------------------------ router
  get current() { return this.stack[this.stack.length - 1] || null; }
  ctx() { return { game: this.game, info: this, open: (id, p, o) => this.open(id, p, o), back: () => this.back(), refresh: () => this.refresh() }; }
  open(id, params = {}, { root = false, replace = false } = {}) {
    const make = SCREENS[id];
    if (!make) { console.warn('no screen', id); return; }
    this.game.audio?.ui('select');
    const prev = this.current;
    prev?.screen.onExit?.();
    if (root) this.stack = [];
    else if (replace) this.stack.pop();
    let screen;
    try { screen = make(this.ctx(), params); } catch (e) { console.error(`screen ${id} failed`, e); return; }
    this.stack.push({ id, params, screen });
    this.mount(screen, prev);
    screen.onEnter?.();
    const dockId = [...this.stack].reverse().find((e) => this.dockBtns.some((b) => b.dataset.dock === e.id))?.id;
    this.dockBtns.forEach((b) => b.classList.toggle('active', b.dataset.dock === dockId));
    this.game.menu?.setCameraMode?.(screen.camera || 'cockpit', screen);
    this.cameraMode = screen.camera || 'cockpit';
  }
  mount(screen, prev) {
    const old = this.body.firstElementChild;
    if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 170); }
    screen.el.classList.add('hu-screen');
    this.body.appendChild(screen.el);
    this.focusFirst();
  }
  back() {
    const cur = this.current;
    if (cur?.screen.onBack && cur.screen.onBack() === true) return;
    if (this.stack.length <= 1) { if (this.inGame) this.game.resume(); else if (cur?.id !== 'home') this.open('home', {}, { root: true }); return; }
    this.game.audio?.ui('back');
    cur.screen.onExit?.();
    this.stack.pop();
    const top = this.current;
    // rebuild the previous screen so it shows fresh data
    const screen = SCREENS[top.id](this.ctx(), top.params);
    top.screen = screen;
    this.mount(screen);
    screen.onEnter?.();
    this.game.menu?.setCameraMode?.(screen.camera || 'cockpit', screen);
    this.cameraMode = screen.camera || 'cockpit';
  }
  refresh() {
    const top = this.current;
    if (!top) return;
    const focusKey = this.focused?.dataset.key;
    const scrollers = [...top.screen.el.querySelectorAll('.scroll')].map((s) => s.scrollTop);
    const screen = SCREENS[top.id](this.ctx(), top.params);
    top.screen.onExit?.();
    top.screen = screen;
    screen.el.classList.add('hu-screen');
    screen.el.style.animation = 'none';
    this.body.innerHTML = '';
    this.body.appendChild(screen.el);
    [...screen.el.querySelectorAll('.scroll')].forEach((s, i) => { s.scrollTop = scrollers[i] || 0; });
    const again = focusKey ? screen.el.querySelector(`[data-key="${CSS.escape(focusKey)}"]`) : null;
    if (again) this.setFocus(again, false); else this.focusFirst();
    screen.onEnter?.();
  }

  // ------------------------------------------------------------------------------------ focus
  focusables() { return [...this.el.querySelectorAll('[data-focus]')].filter((e) => e.offsetParent !== null && !e.disabled && !e.closest('.out')); }
  focusFirst() {
    const preferred = this.body.querySelector('[data-autofocus]') || this.body.querySelector('[data-focus]');
    this.setFocus(preferred, false);
  }
  setFocus(el, scroll = true) {
    if (this.focused === el) return;
    this.focused?.classList.remove('focus');
    this.focused = el;
    if (!el) return;
    el.classList.add('focus');
    el.dispatchEvent(new CustomEvent('ttfocus'));
    if (scroll) this.scrollIntoView(el);
    this.game.audio?.ui('tick');
  }
  scrollIntoView(el) {
    const sc = el.closest('.scroll');
    if (!sc) return;
    const top = this.layoutRect(el, sc).y, bottom = top + el.offsetHeight;
    if (top < sc.scrollTop + 8) sc.scrollTop = top - 8;
    else if (bottom > sc.scrollTop + sc.clientHeight - 8) sc.scrollTop = bottom - sc.clientHeight + 8;
  }
  /** Position of el in untransformed layout space relative to `root` (default: the head unit). */
  layoutRect(el, root = this.el) {
    let x = 0, y = 0, e = el;
    while (e && e !== root) {
      x += e.offsetLeft; y += e.offsetTop;
      const p = e.offsetParent;
      for (let s = e.parentElement; s && s !== p && s !== root; s = s.parentElement) { x -= s.scrollLeft || 0; y -= s.scrollTop || 0; }
      if (p && p !== root) { x -= p.scrollLeft || 0; y -= p.scrollTop || 0; }
      e = p;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  move(dir) {
    const list = this.focusables();
    if (!this.focused || !list.includes(this.focused)) { this.setFocus(list[0]); return; }
    const a = this.layoutRect(this.focused);
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    let best = null, bd = Infinity;
    for (const el of list) {
      if (el === this.focused) continue;
      const b = this.layoutRect(el);
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      const dx = bx - ax, dy = by - ay;
      let primary, secondary;
      if (dir === 'up') { if (b.y + b.h > a.y + 4 && by >= ay) continue; primary = -dy; secondary = Math.abs(dx); }
      else if (dir === 'down') { if (b.y < a.y + a.h - 4 && by <= ay) continue; primary = dy; secondary = Math.abs(dx); }
      else if (dir === 'left') { if (bx >= ax - 2) continue; primary = -dx; secondary = Math.abs(dy); }
      else { if (bx <= ax + 2) continue; primary = dx; secondary = Math.abs(dy); }
      if (primary <= 0) continue;
      const score = primary + secondary * 2.2;
      if (score < bd) { bd = score; best = el; }
    }
    if (best) this.setFocus(best);
  }
  nav(action) {
    const cur = this.current?.screen;
    if (cur?.onNav && cur.onNav(action, this.focused) === true) return;
    const f = this.focused;
    switch (action) {
      case 'up': case 'down': this.move(action); break;
      case 'left': case 'right':
        if (f?.onAdjust) { f.onAdjust(action === 'left' ? -1 : 1); this.game.audio?.ui('tick'); }
        else this.move(action);
        break;
      case 'confirm':
        if (!f) { this.focusFirst(); break; }
        if (f.onConfirm) f.onConfirm(); else f.click();
        break;
      case 'back': this.back(); break;
      case 'tabPrev': cur?.tabs?.cycle(-1); break;
      case 'tabNext': cur?.tabs?.cycle(1); break;
      case 'menu': if (this.inGame) this.game.resume(); break;
    }
  }

  // ------------------------------------------------------------------------------------ placement
  /** Map onto a projected quad (CSS px): tl, tr, bl, br = [x, y]. */
  setQuad(tl, tr, bl, br) {
    const m = homography([0, 0, HU_W, 0, 0, HU_H, HU_W, HU_H], [...tl, ...tr, ...bl, ...br]);
    if (!m) return;
    this.el.style.width = '';
    this.sideFrac = 0;
    this.el.style.transform = `matrix3d(${m.join(',')})`;
    this.el.dataset.mode = 'cockpit';
    this.mode = 'cockpit';
  }
  setFlat(kind = 'center') {
    const W = window.innerWidth, H = window.innerHeight;
    let s, x, y;
    if (kind === 'side') {
      const margin = Math.max(16, W * 0.025);
      s = Math.min((W * 0.52) / HU_SIDE_W, (H * 0.88) / HU_H);
      x = W - HU_SIDE_W * s - margin; y = (H - HU_H * s) / 2;
      this.el.style.width = HU_SIDE_W + 'px';
      this.sideFrac = (HU_SIDE_W * s + margin) / W; // MenuScene frames the car in the remaining space
    } else {
      s = Math.min((W * 0.92) / HU_W, (H * 0.9) / HU_H, 1.25); x = (W - HU_W * s) / 2; y = (H - HU_H * s) / 2;
      this.el.style.width = ''; this.sideFrac = 0;
    }
    this.el.style.transform = `matrix3d(${s},0,0,0,0,${s},0,0,0,0,1,0,${x},${y},0,1)`;
    this.el.dataset.mode = 'flat';
    this.mode = kind === 'side' ? 'side' : 'flat';
  }
  /** Smoothly animate the next placement change (cockpit <-> side). */
  animatePlacement(ms = 650) {
    this.el.style.transition = `transform ${ms}ms cubic-bezier(.2,.7,.2,1)`;
    clearTimeout(this._animT);
    this._animT = setTimeout(() => { this.el.style.transition = ''; }, ms + 30);
  }
  get animating() { return !!this.el.style.transition; }

  update(dt) {
    this._statusT -= dt;
    if (this._statusT > 0) return;
    this._statusT = 0.5;
    const d = new Date();
    this.clockEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.creditsEl.textContent = fmtCredits(this.game.profile.credits);
    const car = this.game.profile.selectedCar();
    const def = car && this.game.registry.vehicle(car.vehicleId);
    this.carEl.textContent = def ? `${def.make} ${def.name}`.toUpperCase() : '';
  }
}

// ---- rect -> quad projective transform (CSS matrix3d) ------------------------------------------
function adj(m) { return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]]; }
function mul(a, b) { const c = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s; } return c; }
function mulv(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function basis(p) { const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1]; const v = mulv(adj(m), [p[6], p[7], 1]); return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
export function homography(src, dst) {
  const t = mul(basis(dst), adj(basis(src)));
  if (!isFinite(t[8]) || Math.abs(t[8]) < 1e-12) return null;
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  return [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]];
}
