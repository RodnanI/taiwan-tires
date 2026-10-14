import { h, header, tabs, row, selector, slider, chip } from '../widgets.js';
import { PAINT_FINISHES } from '../../render/materials.js';
import { RIM_STYLES } from '../../vehicles/kit/index.js';
import { fmtCredits } from '../../core/math.js';

// Taiwan-flavoured palette (name, Traditional Chinese, colour)
export const PALETTE = [
  ['Jade Mountain White', '玉山白', '#e9e6dc'], ['Taipei Grey', '台北灰', '#8d9093'], ['Typhoon Silver', '颱風銀', '#b9bcc0'], ['Night Market Black', '夜市黑', '#121315'],
  ['Temple Red', '廟宇紅', '#b3261e'], ['Lantern Red', '燈籠紅', '#d8321f'], ['Night Market Orange', '夜市橘', '#e8691c'], ['Taxi Yellow', '計程車黃', '#f2c21b'],
  ['Mango Ice', '芒果冰', '#f5a524'], ['Betel Green', '檳榔綠', '#2f7d3a'], ['Tea Garden Green', '茶園綠', '#5a7a3c'], ['Oolong Brown', '烏龍棕', '#6b4a2f'],
  ['Taroko Marble', '太魯閣石', '#c9c4b6'], ['Kenting Sea', '墾丁海', '#1f7f8c'], ['Sun Moon Lake', '日月潭', '#2a5d77'], ['Alishan Mist', '阿里山霧', '#9fb2b0'],
  ['Bubble Tea', '珍奶', '#c8a27a'], ['Lotus Pink', '蓮花粉', '#d98c9a'], ['Neon Pink', '霓虹粉', '#ff3e8a'], ['Scooter Mint', '機車薄荷', '#8fd3b7'],
  ['Kaohsiung Rust', '高雄鏽', '#8c3b22'], ['Gold Leaf', '金箔', '#c79a2c'], ['Plum Blossom', '梅花', '#7a2a44'], ['Midnight Navy', '午夜藍', '#1b2840'],
];
const SMOKE = [['White', '#ececec'], ['Black', '#2a2a2a'], ['Temple red', '#d8321f'], ['Amber', '#ff9a2e'], ['Taxi yellow', '#f2c21b'], ['Betel green', '#3fd36a'], ['Neon pink', '#ff3e8a'], ['Sea teal', '#28b5c5']];

export default function paint({ game, back, refresh }, params) {
  const P = game.profile;
  const car = P.getCar(params.uid) || P.selectedCar();
  const def = game.registry.vehicle(car.vehicleId);
  let tab = params.tab || 'paint';
  const body = h('div.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 } });
  const apply = () => { P.updateCar(car.uid, { visual: car.visual }); game.menu.preview({ def, config: car }, { paintOnly: true }); };
  const hex2hsl = (hex) => { const c = parseInt(hex.slice(1), 16); let r = (c >> 16 & 255) / 255, g = (c >> 8 & 255) / 255, b = (c & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; } return [hh * 360, s * 100, l * 100]; };
  const hsl2hex = (H, S, L) => { S /= 100; L /= 100; const k = (n) => (n + H / 30) % 12; const a = S * Math.min(L, 1 - L); const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
  const render = () => {
    body.innerHTML = '';
    const vis = car.visual;
    if (tab === 'paint') {
      const sw = h('div.swatches');
      for (const [n, zh, c] of PALETTE) {
        const b = h('div.sw' + (vis.paint.color === c ? '.active' : ''), { data: { focus: '', key: 'sw:' + c }, title: `${n} ${zh}`, style: { background: c }, on: { click: () => { vis.paint = { ...vis.paint, color: c }; apply(); refreshKeep(); } } });
        b.addEventListener('ttfocus', () => { label.textContent = `${n} · ${zh}`; });
        sw.append(b);
      }
      const label = h('div.notice', {}, PALETTE.find((p) => p[2] === vis.paint.color)?.slice(0, 2).join(' · ') || 'Custom colour');
      let [H, S, L] = hex2hsl(vis.paint.color);
      const setC = () => { vis.paint = { ...vis.paint, color: hsl2hex(H, S, L) }; apply(); };
      body.append(sw, label,
        row('Finish 塗裝', selector(Object.entries(PAINT_FINISHES).map(([k, f]) => ({ value: k, label: f.name })), vis.paint.finish, (v) => { vis.paint = { ...vis.paint, finish: v }; apply(); })),
        row('Hue', slider(0, 359, 1, Math.round(H), (v) => { H = v; setC(); })),
        row('Saturation', slider(0, 100, 1, Math.round(S), (v) => { S = v; setC(); })),
        row('Lightness', slider(4, 96, 1, Math.round(L), (v) => { L = v; setC(); })),
      );
    } else if (tab === 'smoke') {
      const sw = h('div.swatches');
      for (const [n, c] of SMOKE) {
        const rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
        const active = JSON.stringify(vis.smoke || [0.92, 0.92, 0.92]) === JSON.stringify(rgb);
        sw.append(h('div.sw' + (active ? '.active' : ''), { data: { focus: '' }, title: n, style: { background: c }, on: { click: () => { vis.smoke = rgb; apply(); refreshKeep(); } } }));
      }
      body.append(h('p.notice', {}, 'Tyre smoke colour. Visible in every mode.'), sw);
    } else {
      // visual slots (rims + model-defined parts)
      const slots = { ...(def.visual.slots || {}) };
      if (!slots.rims) slots.rims = { name: 'Rims', zh: '輪框', options: Object.entries(RIM_STYLES).map(([id, r]) => ({ id, name: r.name, price: 30000 })) };
      const showSlots = tab === 'wheels' ? { rims: slots.rims } : Object.fromEntries(Object.entries(slots).filter(([k]) => k !== 'rims'));
      if (!Object.keys(showSlots).length) body.append(h('p.notice', {}, 'This car has no body options yet. Vehicle authors add them under visual.slots (see vehicles/AGENTS.md).'));
      for (const [slotId, slot] of Object.entries(showSlots)) {
        body.append(h('div.set-group', {}, `${slot.name} ${slot.zh || ''}`));
        const cur = vis.mods?.[slotId] || slot.options[0]?.id;
        for (const opt of slot.options) {
          const owned = !opt.price || (car.ownedVisual?.[slotId] || []).includes(opt.id);
          body.append(h('button.item' + (cur === opt.id ? '.active' : ''), { data: { focus: '', key: `${slotId}:${opt.id}` }, on: { click: () => {
            const r = P.setVisualMod(car.uid, slotId, opt.id, opt.price);
            if (!r.ok) { game.ui.toast('Not enough credits'); game.audio?.ui('error'); return; }
            Object.assign(car, P.getCar(car.uid));
            game.menu.preview({ def, config: car });
            refreshKeep();
          } } }, opt.name, h('div.meta', {}, cur === opt.id ? chip('fitted', 'acc') : owned ? chip('owned') : fmtCredits(opt.price))));
        }
      }
    }
  };
  const refreshKeep = () => { params.tab = tab; refresh(); };
  const tb = tabs([{ id: 'paint', label: 'Paint', zh: '烤漆' }, { id: 'wheels', label: 'Wheels', zh: '輪框' }, { id: 'body', label: 'Body', zh: '車身' }, { id: 'smoke', label: 'Tyre smoke', zh: '胎煙' }], tab, (id) => { tab = id; render(); });
  render();
  game.menu.preview({ def, config: car });
  const el = h('div', {}, header('Paint & body', '烤漆', `${def.make} ${def.name}`, back), tb, body);
  return { el, camera: 'showroom', tabs: tb };
}
