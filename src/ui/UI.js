// UI manager: DOM layers over the canvas (stats, hud, menu head unit, overlays, toasts).
import css from './styles.css';
import { h } from './dom.js';
import { Infotainment } from './Infotainment.js';

const TIPS = [
  'Tap the handbrake to start a slide, then catch it with throttle and opposite lock.',
  'Hold the rewind button to undo a mistake. Racing purists can switch it off in Gameplay settings.',
  'AI Tune can target a single event route: it optimises the estimated lap time with the same tyre model the physics uses.',
  'Drift chains build a multiplier. Clipping close to walls adds a proximity bonus.',
  'Taiwan drives on the right. Most cars here are left-hand drive.',
  'Rain lowers grip on every compound. Slicks hate it, rally tyres shrug it off.',
  'Settings > Display lets you cap the frame rate, run it uncapped, and turn on the FPS counter.',
  'The racing line turns red where you need to brake from your current speed.',
];

export class UI {
  constructor(game) {
    this.game = game;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    this.root = h('div', { id: 'tt-ui' });
    game.root.appendChild(this.root);
    this.layers = {};
    for (const n of ['hud', 'menu', 'overlay', 'toast', 'stats']) { this.layers[n] = h('div.tt-layer', { data: { layer: n } }); this.root.appendChild(this.layers[n]); }
    this.toasts = h('div.toasts');
    this.layers.toast.appendChild(this.toasts);
    // drag area for orbiting the showroom car (behind the menu panel)
    this.dragArea = h('div', { style: { position: 'absolute', inset: '0' } });
    this.layers.menu.appendChild(this.dragArea);
    this.info = new Infotainment(game, this.layers.menu);
    this.info.hide();
    this.pauseInfo = null;
    this.mode = 'boot';
    game.events.on('profile:credits', (e) => { if (game.state === 'driving' && e.delta > 0 && e.reason !== 'drift') this.toast(`+NT$ ${Math.round(e.delta).toLocaleString('en-US')}`, { small: true }); });
    window.addEventListener('resize', () => { this.applyHudScale(); this.place(true); });
  }
  layer(name) { return this.layers[name]; }
  applyTheme() {
    const s = this.game.settings;
    this.root.dataset.accent = s.get('display.uiAccent');
    document.documentElement.dataset.accent = s.get('display.uiAccent');
    this.applyHudScale();
    this.place(true);
  }
  /** HUD size = user scale x viewport factor (designed at 1600x900; small windows shrink it so it never covers the road). */
  applyHudScale() {
    const k = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    this.root.style.setProperty('--hud-scale', this.game.settings.get('display.hudScale') * Math.max(0.5, Math.min(1.6, k)));
  }

  showBoot() {
    this.mode = 'boot';
    const ov = this.layers.overlay;
    ov.innerHTML = '';
    const btn = h('button.boot-btn', { data: { focus: '' } }, h('span', {}, 'ENGINE'), h('span', {}, 'START'), h('span', {}, '啟動'));
    const boot = h('div.boot', {}, h('div.boot-inner', {}, h('div.boot-zh', {}, '台灣輪胎'), h('div.boot-en', {}, 'TAIWAN TIRES'), btn, h('div.boot-hint', {}, 'CLICK, PRESS ENTER OR (A)')), h('div.boot-ver', {}, `v${typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'}`));
    ov.appendChild(boot);
    const go = () => {
      if (this.mode !== 'boot') return;
      this.mode = 'starting';
      off();
      boot.style.transition = 'opacity 0.7s'; boot.style.opacity = '0';
      setTimeout(() => { ov.innerHTML = ''; }, 700);
      this.game.start();
    };
    boot.addEventListener('click', go);
    const off = this.game.events.on('nav', (e) => { if (e.action === 'confirm') go(); });
    this._bootKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
    window.addEventListener('keydown', this._bootKey, { once: true });
  }

  showMenu() {
    this.mode = 'menu';
    this.layers.overlay.innerHTML = '';
    this.game.hud?.hide();
    this.closePause();
    this.info.show();
    if (!this.info.stack.length) {
      this.info.open('home', {}, { root: true });
      // head unit power-on animation
      const b = h('div.hu-boot', {}, h('b', {}, '台灣輪胎'), h('i', {}, 'TAIWAN TIRES'));
      this.info.el.appendChild(b);
      setTimeout(() => { b.style.opacity = '0'; setTimeout(() => b.remove(), 650); }, 900);
    } else this.info.refresh();
    if (!this._dragBound) { this.game.menu.bindDrag(this.dragArea); this._dragBound = true; }
    this.place(true);
  }

  showLoading(o) {
    this.mode = 'loading';
    this.info.hide();
    const map = this.game.registry.map(o.mapId);
    const ev = o.eventId ? map?.events.find((e) => e.id === o.eventId) : null;
    this.loadBar = h('i', { style: { width: '0%' } });
    this.loadLabel = h('div.ld-label', {}, 'Preparing');
    const ov = this.layers.overlay;
    ov.innerHTML = '';
    ov.appendChild(h('div.loading', {}, h('div.loading-inner', {},
      h('div.ld-zh', {}, map?.nameZh || ''), h('div.ld-en', {}, map?.name || ''), ev ? h('div.ld-ev', {}, `${ev.name} · ${ev.nameZh}`) : h('div.ld-ev', {}, 'Free roam · 自由駕駛'),
      h('div.progress', {}, this.loadBar), this.loadLabel, h('div.tip', {}, TIPS[Math.floor(Math.random() * TIPS.length)]))));
  }
  loadingProgress(p, label) { if (this.loadBar) this.loadBar.style.width = `${Math.round(p * 100)}%`; if (this.loadLabel) this.loadLabel.textContent = label; }

  showHUD() {
    this.mode = 'hud';
    this.layers.overlay.innerHTML = '';
    this.info.hide();
    this.closePause();
    this.game.hud.show();
  }
  ensurePauseInfo() {
    if (!this.pauseInfo) {
      this.pauseWrap = h('div.overlay');
      this.pauseInfo = new Infotainment(this.game, this.pauseWrap, { inGame: true });
    }
    if (!this.pauseWrap.parentNode) this.layers.overlay.appendChild(this.pauseWrap);
    this.pauseInfo.show();
    this.pauseInfo.setFlat('center');
    return this.pauseInfo;
  }
  showPause() { this.mode = 'pause'; const p = this.ensurePauseInfo(); p.open('pause', {}, { root: true }); }
  showResults(r) { this.mode = 'pause'; this.game.hud.hide(); const p = this.ensurePauseInfo(); p.open('results', { r }, { root: true }); }
  closePause() { if (this.pauseInfo) { this.pauseInfo.hide(); this.pauseWrap.remove(); } if (this.mode === 'pause') this.mode = 'hud'; }
  toast(text, { small = false } = {}) {
    const t = h('div.toast' + (small ? '.small' : ''), {}, text);
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 2800);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  /** Position the head unit for the current menu camera. */
  place(force = false) {
    if (this.mode !== 'menu' || !this.info.visible) return;
    const style = this.game.settings.get('display.menuStyle');
    const menu = this.game.menu;
    const cam = this.info.cameraMode;
    if (cam === 'showroom') { if (this.info.mode !== 'side' || force) this.info.setFlat('side'); this.dragArea.style.pointerEvents = 'auto'; return; }
    this.dragArea.style.pointerEvents = 'none';
    if (style === 'flat') { this.info.setFlat('center'); return; }
    if (menu.trans.t < 1) {
      // during camera moves aim the head unit at the final screen position once (CSS transition does the rest)
      if (!this._aimed) { this._aimed = true; const q = menu.finalQuad?.(); if (q) this.info.setQuad(q.tl, q.tr, q.bl, q.br); else this.info.setFlat('center'); }
      return;
    }
    this._aimed = false;
    if (this.info.animating && !force) return;
    const q = menu.screenQuad();
    if (q) this.info.setQuad(q.tl, q.tr, q.bl, q.br); else this.info.setFlat('center');
  }

  update(dt) {
    if (this.mode === 'menu') { this.info.update(dt); this.place(); }
    if (this.pauseInfo?.visible) this.pauseInfo.update(dt);
  }
}
