// Input: keyboard + gamepads -> named actions. Driving axes get device-appropriate filtering
// (keyboard steering ramps, stick deadzones/linearity). Menus use the separate nav events.
import { ACTIONS } from './bindings.js';
import { clamp, approach } from '../core/math.js';

const NAV_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', NumpadEnter: 'confirm', Escape: 'back', Backspace: 'back', KeyQ: 'tabPrev', KeyE: 'tabNext', PageUp: 'tabPrev', PageDown: 'tabNext', Tab: 'tabNext' };

export class Input {
  constructor(settings, events) {
    this.settings = settings;
    this.events = events;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.analog = Object.fromEntries(Object.keys(ACTIONS).map((a) => [a, 0]));
    this.prevButtons = {};
    this.device = 'keyboard';
    this.mode = 'menu'; // 'menu' | 'drive'
    this.steer = 0; this.throttle = 0; this.brake = 0;
    this.listeners = [];
    this.rebinding = null;
    this.padPrev = new Map();
    this.navRepeat = { dir: null, t: 0 };
    const on = (t, e, f, o) => { t.addEventListener(e, f, o); this.listeners.push([t, e, f, o]); };
    on(window, 'keydown', (e) => this._key(e, true), { passive: false });
    on(window, 'keyup', (e) => this._key(e, false));
    on(window, 'blur', () => { this.keys.clear(); });
    on(window, 'gamepadconnected', (e) => { this.events.emit('input:gamepad', { connected: true, id: e.gamepad.id }); });
    on(window, 'gamepaddisconnected', (e) => { this.events.emit('input:gamepad', { connected: false, id: e.gamepad.id }); });
  }
  dispose() { for (const [t, e, f, o] of this.listeners) t.removeEventListener(e, f, o); }

  _key(e, down) {
    if (this.rebinding) {
      if (down) { e.preventDefault(); const r = this.rebinding; this.rebinding = null; r.resolve(e.code === 'Escape' ? null : { key: e.code }); }
      return;
    }
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (down) {
      // don't let the browser scroll / go back / close things while driving
      if (['Space', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) { if (this.mode === 'menu' && NAV_KEYS[e.code] && ['up', 'down', 'left', 'right'].includes(NAV_KEYS[e.code])) this.events.emit('nav', { action: NAV_KEYS[e.code], repeat: true }); return; }
      this.keys.add(e.code);
      this.pressedThisFrame.add(e.code);
      this.device = 'keyboard';
      if (this.mode === 'menu') {
        let nav = NAV_KEYS[e.code];
        if (!nav && e.code === 'KeyW') nav = 'up'; if (!nav && e.code === 'KeyS') nav = 'down';
        if (!nav && e.code === 'KeyA') nav = 'left'; if (!nav && e.code === 'KeyD') nav = 'right';
        if (!nav && e.code === 'Space') nav = 'confirm';
        if (nav) this.events.emit('nav', { action: nav });
      }
    } else this.keys.delete(e.code);
  }

  /** Await the next key / pad button for rebinding. Resolves { key } | { b } | { a, d } | null. */
  captureBinding(device) {
    return new Promise((resolve) => { this.rebinding = { device, resolve }; this._captureT = performance.now(); });
  }

  /** Poll gamepads + compute actions. Call once per rendered frame. */
  update(dt, speed = 0) {
    const s = this.settings;
    const keys = s.get('controls.keys'), pad = s.get('controls.pad');
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const gp = pads.find((p) => p.mapping === 'standard') || pads[0] || null;
    const dz = s.get('controls.deadzone'), tdz = s.get('controls.triggerDeadzone');
    const readPad = (b) => {
      if (!gp || !b) return 0;
      if (b.b != null) { const btn = gp.buttons[b.b]; if (!btn) return 0; const v = btn.value ?? (btn.pressed ? 1 : 0); return v > tdz ? (v - tdz) / (1 - tdz) : 0; }
      const v = (gp.axes[b.a] || 0) * (b.d || 1);
      return v > dz ? (v - dz) / (1 - dz) : 0;
    };
    // pad capture for rebinding
    if (this.rebinding && gp && performance.now() - this._captureT > 250) {
      gp.buttons.forEach((btn, i) => { if (btn.pressed && this.rebinding) { const r = this.rebinding; this.rebinding = null; r.resolve({ b: i }); } });
      gp.axes.forEach((v, i) => { if (Math.abs(v) > 0.7 && this.rebinding) { const r = this.rebinding; this.rebinding = null; r.resolve({ a: i, d: Math.sign(v) }); } });
    }
    let padActive = false;
    for (const a of Object.keys(ACTIONS)) {
      let v = 0;
      // a tap shorter than one frame still counts (pressedThisFrame), so low frame rates don't eat inputs
      for (const k of keys[a] || []) if (this.keys.has(k) || this.pressedThisFrame.has(k)) v = 1;
      let pv = 0;
      for (const b of pad[a] || []) pv = Math.max(pv, readPad(b));
      if (pv > 0.05) padActive = true;
      this.analog[a] = Math.max(v, pv);
      this.analog['_pad_' + a] = pv;
      this.analog['_key_' + a] = v;
    }
    if (padActive) this.device = 'gamepad';
    // edge-triggered buttons (keyboard + pad)
    this.pressed = {};
    for (const a of Object.keys(ACTIONS)) {
      const now = this.analog[a] > 0.5;
      const prev = this.prevButtons[a] || false;
      this.pressed[a] = now && !prev;
      this.prevButtons[a] = now;
    }
    // menu navigation from the pad (with repeat)
    if (gp && this.mode === 'menu') this._padNav(gp, dt);
    // ---- driving axes
    const sens = s.get('controls.steerSensitivity');
    const padSteer = this.analog._pad_steerRight - this.analog._pad_steerLeft;
    const keySteer = this.analog._key_steerRight - this.analog._key_steerLeft;
    const speedK = 1 - s.get('controls.speedSensitiveSteering') * clamp((speed - 8) / 45, 0, 1) * 0.62;
    let target;
    if (Math.abs(padSteer) > 0.001 || this.device === 'gamepad') {
      const lin = s.get('controls.steerLinearity');
      target = Math.sign(padSteer) * Math.pow(Math.min(1, Math.abs(padSteer) * sens), lin) * speedK;
      this.steer = approach(this.steer, target, dt * 8);
    } else {
      target = keySteer * speedK * Math.min(1, sens);
      const rate = s.get('controls.keyboardSteerSpeed') * (target === 0 || Math.sign(target) !== Math.sign(this.steer) ? 6.5 : 3.2);
      this.steer = approach(this.steer, target, dt * rate);
    }
    // keyboard pedals ramp slightly so binary keys feel less like switches
    const thrT = this.analog.throttle, brkT = this.analog.brake;
    // binary keys get a progressive throttle at low speed (like feeding in the pedal), quick at speed
    const thrRate = thrT > this.throttle ? (speed < 9 ? 2.6 : 7) : 12;
    this.throttle = this.analog._pad_throttle > 0.02 ? thrT : approach(this.throttle, thrT, dt * thrRate);
    this.brake = this.analog._pad_brake > 0.02 ? brkT : approach(this.brake, brkT, dt * (brkT > this.brake ? 9 : 14));
    // steering is "positive = left" in the physics; right input steers right
    this.steerOut = -this.steer;
    this.pressedThisFrame.clear();
  }
  _padNav(gp, dt) {
    const btn = (i) => gp.buttons[i]?.pressed;
    const dirs = { up: btn(12) || gp.axes[1] < -0.6, down: btn(13) || gp.axes[1] > 0.6, left: btn(14) || gp.axes[0] < -0.6, right: btn(15) || gp.axes[0] > 0.6 };
    let dir = null;
    for (const [d, on] of Object.entries(dirs)) if (on) dir = d;
    if (dir) {
      if (this.navRepeat.dir !== dir) { this.events.emit('nav', { action: dir }); this.navRepeat = { dir, t: 0.35 }; }
      else { this.navRepeat.t -= dt; if (this.navRepeat.t <= 0) { this.events.emit('nav', { action: dir, repeat: true }); this.navRepeat.t = 0.09; } }
    } else this.navRepeat.dir = null;
    const edges = { 0: 'confirm', 1: 'back', 4: 'tabPrev', 5: 'tabNext', 9: 'menu', 2: 'alt', 3: 'alt2' };
    for (const [i, act] of Object.entries(edges)) {
      const now = !!btn(+i), prev = this.padPrev.get(+i) || false;
      if (now && !prev) { this.device = 'gamepad'; this.events.emit('nav', { action: act }); }
      this.padPrev.set(+i, now);
    }
  }
  /** Gamepad rumble (0..1 strong/weak, ms). */
  rumble(strong, weak, ms = 120) {
    const k = this.settings.get('controls.vibration');
    if (!k || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    for (const gp of navigator.getGamepads()) {
      if (!gp?.vibrationActuator) continue;
      try { gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong * k, 0, 1), weakMagnitude: clamp(weak * k, 0, 1) }); } catch { /* unsupported */ }
    }
  }
}
