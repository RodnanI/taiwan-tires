// Reusable head-unit widgets. Every interactive element gets [data-focus] so the spatial focus system
// (Infotainment.js) can drive it with keyboard / gamepad; `onAdjust(dir)` handles left/right on it.
import { h, icon, bi } from './dom.js';
import { classFor } from '../tuning/Performance.js';

export function button(label, onClick, { primary = false, danger = false, zh = '', disabled = false, cls = '' } = {}) {
  const b = h(`button.btn${primary ? '.primary' : ''}${danger ? '.danger' : ''}${cls ? '.' + cls : ''}`, { data: { focus: '' }, disabled, on: { click: () => onClick?.() } }, label, zh ? h('span.zh', {}, zh) : null);
  return b;
}
export function backButton(onClick) {
  return h('button.back-btn', { data: { focus: '' }, on: { click: onClick }, title: 'Back' }, icon('back'));
}
export function header(en, zh, sub = '', onBack = null) {
  return h('div.scr-head', {}, onBack ? backButton(onBack) : null, h('div.scr-title', {}, en, zh ? h('span.zh', {}, zh) : null), sub ? h('div.scr-sub', {}, sub) : null);
}

/** Enum selector  < value >  */
export function selector(options, value, onChange) {
  let i = Math.max(0, options.findIndex((o) => String(o.value) === String(value)));
  const val = h('div.val', {}, options[i]?.label ?? '');
  const set = (d) => { i = (i + d + options.length) % options.length; val.textContent = options[i].label; onChange(options[i].value); };
  const el = h('div.sel', {}, h('button', { on: { click: (e) => { e.stopPropagation(); set(-1); } } }, icon('left')), val, h('button', { on: { click: (e) => { e.stopPropagation(); set(1); } } }, icon('right')));
  el.adjust = set;
  el.setValue = (v) => { const k = options.findIndex((o) => String(o.value) === String(v)); if (k >= 0) { i = k; val.textContent = options[i].label; } };
  return el;
}
/** Range slider with numeric label. fmt(v) -> string */
export function slider(min, max, step, value, onChange, fmt = (v) => String(v)) {
  const fill = h('div.fill'), knob = h('div.knob'), val = h('div.val');
  const track = h('div.track', {}, fill, knob);
  let v = value;
  const render = () => { const t = (v - min) / (max - min || 1); fill.style.width = `${t * 100}%`; knob.style.left = `${t * 100}%`; val.textContent = fmt(v); };
  const set = (nv, fire = true) => { nv = Math.min(max, Math.max(min, Math.round(nv / step) * step)); nv = +nv.toFixed(6); if (nv !== v) { v = nv; render(); if (fire) onChange(v); } };
  const fromEvent = (e) => { const r = track.getBoundingClientRect(); set(min + (max - min) * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))); };
  track.addEventListener('pointerdown', (e) => { e.stopPropagation(); track.setPointerCapture(e.pointerId); fromEvent(e); const mv = (ev) => fromEvent(ev); track.addEventListener('pointermove', mv); track.addEventListener('pointerup', () => track.removeEventListener('pointermove', mv), { once: true }); });
  render();
  const el = h('div.slider', {}, track, val);
  el.adjust = (d) => set(v + d * step * (Math.abs(max - min) / step > 60 ? 2 : 1));
  el.setValue = (nv) => { v = nv; render(); };
  return el;
}
export function toggle(value, onChange) {
  const el = h('div.toggle' + (value ? '.on' : ''));
  let v = value;
  el.flip = () => { v = !v; el.classList.toggle('on', v); onChange(v); };
  el.addEventListener('click', (e) => { e.stopPropagation(); el.flip(); });
  el.adjust = () => el.flip();
  return el;
}
/** Settings row: label + control; whole row is focusable, left/right adjusts, confirm activates. */
export function row(label, control, { desc = '', tag = '', onConfirm = null } = {}) {
  const r = h('div.set-row', { data: { focus: '' } }, h('div.lbl', {}, label, tag ? h('span.tag', {}, tag) : null, desc ? h('small', {}, desc) : null), control);
  r.onAdjust = (d) => control.adjust?.(d);
  r.onConfirm = onConfirm || (() => control.flip?.() ?? control.adjust?.(1));
  r.addEventListener('click', () => { if (control.flip) control.flip(); });
  return r;
}
export function tabs(items, active, onSelect) {
  const el = h('div.tabs');
  const btns = items.map((it) => {
    const b = h('button.tab' + (it.id === active ? '.active' : ''), { data: { focus: '' }, on: { click: () => select(it.id) } }, it.label, it.zh ? h('span.zh', { style: { marginLeft: '6px', fontSize: '12px', color: 'var(--faint)' } }, it.zh) : null);
    b.dataset.tab = it.id;
    return b;
  });
  btns.forEach((b) => el.appendChild(b));
  el.appendChild(h('span.tab-hint', {}, 'Q / E · LB / RB'));
  function select(id) { active = id; btns.forEach((b) => b.classList.toggle('active', b.dataset.tab === id)); onSelect(id); }
  el.cycle = (d) => { const i = items.findIndex((x) => x.id === active); select(items[(i + d + items.length) % items.length].id); };
  return el;
}
export function classBadge(pi) {
  const c = classFor(pi);
  return h('span.cls', {}, h('span.c', { style: { background: c.color } }, c.id), h('span.n', {}, String(pi)));
}
/** Stat bars: [{ label, value 0..10, after (optional 0..10), text }] */
export function statBars(list) {
  return h('div.stats', {}, list.map((s) => {
    const bar = h('div.bar');
    const base = Math.min(s.value, s.after ?? s.value);
    bar.appendChild(h('i', { style: { width: `${base * 10}%` } }));
    if (s.after != null && Math.abs(s.after - s.value) > 0.02) {
      const up = s.after > s.value;
      bar.appendChild(h('i', { class: up ? 'delta-up' : 'delta-down', style: { left: `${base * 10}%`, width: `${Math.abs(s.after - s.value) * 10}%` } }));
    }
    return h('div.stat', {}, h('span', {}, s.label), bar, h('span.v', {}, s.text ?? (s.after ?? s.value).toFixed(1)));
  }));
}
export function progress(frac) { const i = h('i', { style: { width: `${frac * 100}%` } }); const el = h('div.progress', {}, i); el.set = (f) => { i.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; }; return el; }
export function chip(text, cls = '') { return h('span.chip' + (cls ? '.' + cls : ''), {}, text); }
export { h, icon, bi };
