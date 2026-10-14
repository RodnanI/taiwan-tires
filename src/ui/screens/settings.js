import { h, header, tabs, row, selector, slider, toggle, button } from '../widgets.js';
import { SCHEMA } from '../../core/Settings.js';
import { ACTIONS, keyLabel, padLabel } from '../../input/bindings.js';
import { detectPreset, QUALITY_LABELS } from '../../render/Quality.js';

const CATS = [
  { id: 'graphics', label: 'Graphics', zh: '畫面' }, { id: 'display', label: 'Display', zh: '顯示' }, { id: 'audio', label: 'Audio', zh: '音效' },
  { id: 'controls', label: 'Controls', zh: '操控' }, { id: 'gameplay', label: 'Gameplay', zh: '遊戲' },
];
const FMT = {
  pct: (v) => `${Math.round(v * 100)}%`, m: (v) => `${Math.round(v)} m`, deg: (v) => `${Math.round(v)}°`, x: (v) => `${(+v).toFixed(2)}×`,
};

export default function settings({ game, back, refresh }, params) {
  const S = game.settings;
  let cat = params.cat || 'graphics';
  const body = h('div.scroll', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '2px' } });
  const render = () => {
    body.innerHTML = '';
    let group = null;
    for (const def of SCHEMA.filter((d) => d.cat === cat)) {
      if (def.group !== group) { group = def.group; body.append(h('div.set-group', {}, group)); }
      const v = S.get(def.key);
      const label = [def.label, def.zh ? h('span.zh', { style: { color: 'var(--faint)', marginLeft: '8px', fontSize: '13px' } }, def.zh) : null];
      let control;
      if (def.type === 'enum') control = selector(def.options, v, (x) => { S.set(def.key, x); if (def.key === 'gfx.preset') { params.cat = cat; refresh(); } });
      else if (def.type === 'range') control = slider(def.min, def.max, def.step, v, (x) => S.set(def.key, x), FMT[def.fmt] || ((x) => String(+(+x).toFixed(2))));
      else if (def.type === 'toggle') control = toggle(!!v, (x) => S.set(def.key, x));
      else if (def.type === 'bindings') { bindings(body, def); continue; }
      body.append(row(label, control, { desc: def.desc || '', tag: def.restart ? 'reload' : '' }));
    }
    const actions = h('div.row', { style: { marginTop: '14px' } }, button('Reset this tab', () => { S.resetCategory(cat); params.cat = cat; refresh(); }, { zh: '重設' }));
    if (cat === 'graphics') actions.append(button(`Auto-detect (${QUALITY_LABELS[detectPreset(game.renderer.gl)]})`, () => { S.applyPreset(detectPreset(game.renderer.gl)); params.cat = cat; refresh(); }, { zh: '自動' }));
    if (cat === 'gameplay') actions.append(button('Reset profile', () => confirmReset(), { danger: true, zh: '重置存檔' }));
    body.append(actions);
    if (cat === 'graphics') body.append(h('p.notice', { style: { marginTop: '10px' } }, 'Honest note: Ultra++ is the most a browser can push (8K shadows, full-res SSR + GTAO, per-frame reflections, supersampling). It is not hardware ray tracing; WebGL has none.'));
  };
  const bindings = (parent, def) => {
    const map = S.get(def.key);
    for (const [action, meta] of Object.entries(ACTIONS)) {
      const slots = map[action] || [];
      const cells = [0, 1].map((i) => {
        const cell = h('div.key', { on: { click: async (e) => { e.stopPropagation(); await rebind(i, cell); } } }, def.device === 'keyboard' ? keyLabel(slots[i]) : padLabel(slots[i]));
        return cell;
      });
      const rebind = async (i, cell) => {
        cell.classList.add('wait'); cell.textContent = 'press…';
        const r = await game.input.captureBinding(def.device);
        const cur = structuredClone(S.get(def.key));
        const arr = cur[action] ? [...cur[action]] : [];
        if (r) arr[i] = def.device === 'keyboard' ? r.key : (r.b != null ? { b: r.b } : { a: r.a, d: r.d });
        else arr.splice(i, 1);
        cur[action] = arr.filter(Boolean);
        S.set(def.key, cur);
        params.cat = cat; refresh();
      };
      const r = h('div.set-row', { data: { focus: '', key: `bind:${def.device}:${action}` } }, h('div.lbl', {}, meta.label, h('span.zh', { style: { color: 'var(--faint)', marginLeft: '8px', fontSize: '13px' } }, meta.zh)), h('div.bind', {}, cells));
      r.onConfirm = () => rebind(0, cells[0]);
      parent.append(r);
    }
    parent.append(h('div.set-group', {}, def.device === 'keyboard' ? 'Gamepad' : ''));
  };
  const confirmReset = () => {
    const box = h('div.modal', {}, h('div.modal-box', {}, h('h2', {}, 'Reset profile?'), h('p.notice', {}, 'Credits, cars, upgrades and records will be wiped. Settings are kept.'),
      h('div.row', {}, button('Reset', () => { game.profile.reset(); box.remove(); game.ui.info.open('home', {}, { root: true }); }, { danger: true }), button('Cancel', () => box.remove()))));
    game.ui.info.el.appendChild(box);
    game.ui.info.focusFirst();
  };
  const tb = tabs(CATS, cat, (id) => { cat = id; render(); });
  render();
  const el = h('div', {}, header('Settings', '設定', '', back), tb, body);
  return { el, camera: 'cockpit', tabs: tb };
}
