// In-game HUD: segmented VFD-style tachometer, rotating minimap, race/drift panels, countdown, prompts.
import { h, put } from './dom.js';
import { fmtTime, fmtInt, clamp, toDisplaySpeed, speedUnit } from '../core/math.js';
import { labelFor } from '../gameplay/DriftScorer.js';
import { FONT_UI } from '../core/canvas.js';

export class HUD {
  constructor(game) {
    this.game = game;
    const L = game.ui.layer('hud');
    this.el = h('div.hud');
    L.appendChild(this.el);
    this.tach = h('canvas', { width: 600, height: 600 });
    this.map = h('canvas', { width: 460, height: 460 });
    this.raceEl = h('div.hud-race');
    this.driftEl = h('div.hud-drift');
    this.totalEl = h('div.hud-total');
    this.centerEl = h('div.hud-center');
    this.promptEl = h('div.hud-prompt', { style: { display: 'none' } });
    this.bannerWrap = h('div');
    this.el.append(h('div.hud-tach', {}, this.tach), h('div.hud-map', {}, this.map), this.raceEl, this.driftEl, this.totalEl, this.centerEl, this.promptEl, this.bannerWrap, h('div.hud-rewind', {}, h('span', {}, '◀◀ REWIND 倒帶')));
    this.hide();
    this.lastCount = null;
    this.driftFlash = 0;
    const E = game.events;
    E.on('drift:bank', (e) => { if (e.owner === 'player') this.banner(`+${fmtInt(e.points)}`, `${e.label.en} ${e.label.zh}`); });
    E.on('drift:fail', (e) => { if (e.owner === 'player') { this.driftFlash = 1.2; this.failPts = e.points; } });
    E.on('race:lap', (e) => this.banner(`LAP ${e.lap} ${fmtTime(e.time)}`, e.best ? 'BEST LAP 最快圈' : ''));
    E.on('race:go', () => { this.go = 1.0; });
    E.on('rewind', (e) => this.el.classList.toggle('rewinding', e.on));
    E.on('player:reset', () => this.banner('RESET', '重置'));
    E.on('hud:toast', (e) => game.ui.toast(e.text, e));
    E.on('session:finished', (r) => this.banner(r.kind === 'race' ? `P${r.position}` : r.kind === 'drift' ? fmtInt(r.score) : fmtTime(r.bestLap), 'FINISH 完賽'));
    this._mapT = 0;
  }
  show() { this.el.style.display = ''; }
  hide() { this.el.style.display = 'none'; }
  banner(text, sub = '') {
    const b = h('div.hud-banner', {}, text, sub ? h('small', {}, sub) : null);
    this.bannerWrap.innerHTML = '';
    this.bannerWrap.appendChild(b);
  }

  update(session, dt) {
    const g = this.game;
    const visible = g.settings.get('display.hud') && (g.state === 'driving' || g.state === 'paused');
    this.el.style.display = visible ? '' : 'none';
    if (!visible) return;
    const ph = session.player.physics, t = ph.tel;
    const units = g.settings.get('display.units');
    const H = session.mode.hud();
    this.drawTach(ph, units);
    this._mapT -= dt;
    if (this._mapT <= 0) { this._mapT = 1 / 30; this.drawMap(session); }
    // race panel
    if (H.race) {
      this.raceEl.style.display = '';
      this.raceEl.innerHTML = '';
      if (H.position) this.raceEl.append(h('div.hud-pos', {}, String(H.position), h('small', {}, `/${H.of}`)));
      put(this.raceEl,
        h('div.hud-line', {}, h('i', {}, H.sprint ? 'STAGE' : 'LAP'), h('b', {}, H.sprint ? `${Math.round((H.progress || 0) * 100)}%` : `${H.lap} / ${H.laps}`)),
        h('div.hud-line', {}, h('i', {}, 'TIME'), h('b', {}, fmtTime(H.time))),
        !H.sprint ? h('div.hud-line', {}, h('i', {}, 'LAP'), h('b', {}, fmtTime(H.lapTime))) : null,
        H.bestLap ? h('div.hud-line', {}, h('i', {}, 'BEST'), h('b.best', {}, fmtTime(H.bestLap))) : null,
        H.record ? h('div.hud-line', {}, h('i', {}, 'RECORD'), h('b', {}, fmtTime(H.record))) : null,
        H.sprint ? h('div.hud-bar', {}, h('i', { style: { width: `${(H.progress || 0) * 100}%` } })) : null,
      );
    } else if (H.driftEvent) {
      this.raceEl.style.display = '';
      this.raceEl.innerHTML = '';
      put(this.raceEl, h('div.hud-line', {}, h('i', {}, 'TIME'), h('b', {}, fmtTime(H.timeLeft, false))), H.outOfZone ? h('div.hud-line', {}, h('b', { style: { color: 'var(--bad)' } }, 'OUT OF ZONE 區域外')) : null);
    } else this.raceEl.style.display = 'none';
    // drift panel
    const d = H.drift;
    if (d && (d.pending > 0 || this.driftFlash > 0)) {
      this.driftFlash = Math.max(0, this.driftFlash - dt);
      const fail = this.driftFlash > 0 && d.pending === 0;
      const pts = fail ? this.failPts : d.pending;
      const lab = labelFor(pts);
      this.driftEl.className = 'hud-drift' + (fail ? ' fail' : '');
      this.driftEl.style.opacity = '1';
      this.driftEl.innerHTML = '';
      this.driftEl.append(
        h('div.lbl', {}, fail ? 'CHAIN LOST' : lab.en, h('span.zh', {}, fail ? '失誤' : lab.zh)),
        h('div', {}, h('span.pts', {}, fmtInt(pts)), fail ? null : h('span.mult', {}, `×${d.mult.toFixed(1)}`)),
        h('div.angle', {}, h('i', { style: { left: `${clamp(d.angle / 90, 0, 1) * 100}%` } })),
        h('div.prox', {}, d.proximity > 0.3 ? 'PROXIMITY 貼牆' : ''),
      );
    } else this.driftEl.style.opacity = '0';
    // totals (drift events, free roam drift score)
    if (H.driftEvent) { this.totalEl.innerHTML = ''; this.totalEl.append(h('div.big', {}, fmtInt(H.score)), h('div.sub', {}, `TARGET ${fmtInt(H.targets?.[2] || 0)}`)); }
    else if (H.freeRoam) { this.totalEl.innerHTML = ''; this.totalEl.append(h('div.sub', {}, `DRIFT ${fmtInt(d?.total || 0)}`)); }
    else this.totalEl.innerHTML = '';
    // countdown / warnings
    let center = null;
    if (H.countdown != null) {
      const n = Math.ceil(H.countdown);
      if (n !== this.lastCount) { this.lastCount = n; g.audio?.ui(n > 0 ? 'beep' : 'go'); }
      center = n > 0 && n <= 3 ? h('div.hud-count', {}, String(n)) : null;
    } else if (this.go > 0) { this.go -= dt; center = h('div.hud-count.go', {}, 'GO', h('span.zh', {}, '出發')); if (this.lastCount !== 0) { this.lastCount = 0; } }
    else if (H.wrongWay) center = h('div.hud-warn', {}, 'WRONG WAY 逆向');
    const key = center ? center.textContent : '';
    if (key !== this._centerKey) { this._centerKey = key; this.centerEl.innerHTML = ''; if (center) this.centerEl.appendChild(center); }
    // free-roam event prompt
    if (H.prompt) {
      this.promptEl.style.display = '';
      const k = g.input.device === 'gamepad' ? 'A' : 'ENTER';
      this.promptEl.innerHTML = `${H.prompt.name} <span class="zh">${H.prompt.nameZh}</span><br>Press <kbd>${k}</kbd> to start`;
      if (g.input.keys.has('Enter') || g.input.keys.has('NumpadEnter') || (navigator.getGamepads?.()[0]?.buttons[0]?.pressed && t.speed < 1)) { if (!this._promptLatch) { this._promptLatch = true; g.switchEvent(H.prompt); } }
      else this._promptLatch = false;
    } else this.promptEl.style.display = 'none';
    // career stats
    g.profile.data.stats.distance += t.speed * dt;
    g.profile.statMax('topSpeed', t.speed * 3.6);
  }

  drawTach(ph, units) {
    const c = this.tach, g = c.getContext('2d');
    const W = c.width, cx = W / 2, cy = W / 2, R = W * 0.42;
    g.clearRect(0, 0, W, W);
    const e = ph.p.engine, rpm = ph.engine.rpm;
    const maxRpm = Math.ceil((e.limiter + 500) / 1000) * 1000;
    const a0 = Math.PI * 0.72, a1 = Math.PI * 2.28;
    const segs = 46;
    const acc = getComputedStyle(this.el).getPropertyValue('--acc').trim() || '#ff9a2e';
    // backing disc
    g.fillStyle = 'rgba(8,7,6,0.55)'; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.fill();
    const shiftRpm = ph.shiftUpRpm?.[Math.max(0, ph.gearbox.gear - 1)] ?? e.redline;
    const flash = rpm > Math.min(shiftRpm, e.redline) * 0.97 && ph.gearbox.gear > 0 && (performance.now() % 160 < 80);
    for (let i = 0; i < segs; i++) {
      const f0 = i / segs, f1 = (i + 0.72) / segs;
      const r0 = f0 * maxRpm;
      const on = r0 < rpm;
      const red = r0 >= e.redline;
      g.strokeStyle = on ? (red || flash ? '#ff4430' : acc) : red ? 'rgba(255,68,48,0.25)' : 'rgba(255,240,220,0.1)';
      g.lineWidth = W * 0.05;
      g.beginPath(); g.arc(cx, cy, R, a0 + (a1 - a0) * f0, a0 + (a1 - a0) * f1); g.stroke();
    }
    g.fillStyle = 'rgba(239,232,218,0.55)'; g.font = `600 ${W * 0.045}px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k <= maxRpm / 1000; k++) { const a = a0 + (a1 - a0) * (k * 1000 / maxRpm); g.fillText(String(k), cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8); }
    // gear
    const gear = ph.gearbox.gear;
    g.fillStyle = gear === -1 ? '#ff4430' : '#efe8da';
    g.font = `700 ${W * 0.24}px ${FONT_UI}`;
    g.fillText(gear === -1 ? 'R' : gear === 0 ? 'N' : String(gear), cx, cy - W * 0.03);
    // speed
    const spd = Math.round(toDisplaySpeed(ph.tel.speed, units));
    g.font = `600 ${W * 0.11}px ${FONT_UI}`; g.fillStyle = acc;
    g.fillText(String(spd), cx, cy + W * 0.17);
    g.font = `500 ${W * 0.04}px ${FONT_UI}`; g.fillStyle = 'rgba(239,232,218,0.55)';
    g.fillText(speedUnit(units), cx, cy + W * 0.25);
    // boost arc
    if (ph.p.engine.boost) {
      const bf = clamp(ph.engine.boost / ph.p.engine.boost.max, 0, 1);
      g.strokeStyle = 'rgba(255,240,220,0.12)'; g.lineWidth = W * 0.018;
      g.beginPath(); g.arc(cx, cy, R * 1.12, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
      g.strokeStyle = acc; g.beginPath(); g.arc(cx, cy, R * 1.12, Math.PI * 0.75 - Math.PI * 0.5 * bf, Math.PI * 0.75); g.stroke();
      g.font = `500 ${W * 0.035}px ${FONT_UI}`; g.fillStyle = 'rgba(239,232,218,0.55)'; g.fillText('BOOST', cx + R * 0.62, cy + R * 0.98);
    }
    // nitrous bar
    if (ph.p.nitrous) {
      const nf = clamp(ph.engine.nitrous, 0, 1);
      g.fillStyle = 'rgba(255,240,220,0.12)'; g.fillRect(cx - R * 0.5, cy + R * 1.0, R, W * 0.02);
      g.fillStyle = ph.engine.nitrousActive ? '#fff' : acc; g.fillRect(cx - R * 0.5, cy + R * 1.0, R * nf, W * 0.02);
      g.font = `500 ${W * 0.035}px ${FONT_UI}`; g.fillStyle = 'rgba(239,232,218,0.55)'; g.fillText('N₂O', cx - R * 0.62, cy + R * 1.01);
    }
    // manual hint
    if (!ph.assists.autoShift && rpm > shiftRpm * 0.98) { g.font = `700 ${W * 0.05}px ${FONT_UI}`; g.fillStyle = '#ff4430'; g.fillText('SHIFT', cx, cy - W * 0.21); }
  }

  drawMap(session) {
    const c = this.map, g = c.getContext('2d');
    const W = c.width;
    const mm = session.map.minimap;
    const ph = session.player.physics;
    const rotate = this.game.settings.get('display.minimapRotate');
    const zoom = 2.2 + clamp(ph.tel.speed / 60, 0, 1) * 1.2; // px per metre scaled
    const heading = Math.atan2(ph.fwd.x, ph.fwd.z);
    g.save();
    g.fillStyle = '#0b0a09'; g.fillRect(0, 0, W, W);
    g.translate(W / 2, W / 2);
    if (rotate) g.rotate(Math.PI + heading);
    const k = zoom / mm.scale;
    g.scale(k, k);
    g.translate(-(ph.pos.x - mm.minX) * mm.scale, -(ph.pos.z - mm.minZ) * mm.scale);
    g.globalAlpha = 0.95;
    g.drawImage(mm.canvas, 0, 0);
    // event route
    const R = session.route;
    if (R) {
      g.strokeStyle = getComputedStyle(this.el).getPropertyValue('--acc').trim() || '#ff9a2e';
      g.lineWidth = 3 / k; g.globalAlpha = 0.9;
      g.beginPath();
      for (let i = 0; i < R.n; i += 2) { const X = (R.x[i] - mm.minX) * mm.scale, Z = (R.z[i] - mm.minZ) * mm.scale; if (i) g.lineTo(X, Z); else g.moveTo(X, Z); }
      if (R.closed) g.closePath();
      g.stroke();
    }
    // other cars
    g.globalAlpha = 1;
    for (const v of session.vehicles) {
      if (v === session.player) continue;
      g.fillStyle = '#efe8da';
      g.beginPath(); g.arc((v.physics.pos.x - mm.minX) * mm.scale, (v.physics.pos.z - mm.minZ) * mm.scale, 5 / k, 0, Math.PI * 2); g.fill();
    }
    // event beacons (free roam)
    if (session.mode.beacons) for (const b of session.mode.beacons) { g.fillStyle = '#ffb02e'; g.fillRect((b.x - mm.minX) * mm.scale - 5 / k, (b.z - mm.minZ) * mm.scale - 5 / k, 10 / k, 10 / k); }
    g.restore();
    // player arrow (always pointing up when rotating)
    g.save();
    g.translate(W / 2, W / 2);
    if (!rotate) g.rotate(-heading + Math.PI);
    g.fillStyle = getComputedStyle(this.el).getPropertyValue('--acc').trim() || '#ff9a2e';
    g.beginPath(); g.moveTo(0, -14); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill();
    g.restore();
    // vignette ring
    const grd = g.createRadialGradient(W / 2, W / 2, W * 0.35, W / 2, W / 2, W * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = grd; g.fillRect(0, 0, W, W);
  }
}
