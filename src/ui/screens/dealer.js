import { h, header, button, chip, classBadge } from '../widgets.js';
import { perfPanel } from './garage.js';
import { analyze } from '../../tuning/Performance.js';
import { buildWorkingSpec, specSummary } from '../../vehicles/VehicleSpec.js';
import { fmtCredits } from '../../core/math.js';

export default function dealer({ game, back, open }, params) {
  const P = game.profile;
  const defs = [...game.registry.vehicles()].sort((a, b) => a.price - b.price);
  let sel = params.id || defs[0]?.id;
  const list = h('div.list.scroll');
  const detail = h('div.panel.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  const show = (id) => {
    sel = id;
    const def = game.registry.vehicle(id);
    const config = { parts: {}, tune: null, visual: { paint: { ...def.visual.paint }, mods: {} } };
    game.menu.preview({ def, config });
    const sum = specSummary(buildWorkingSpec(def, {}, null));
    const owned = P.garage.filter((c) => c.vehicleId === id).length;
    detail.innerHTML = '';
    detail.append(
      h('div.row', {}, h('div.grow', {}, h('div', { style: { color: 'var(--dim)', letterSpacing: '0.2em', fontSize: '13px' } }, `${def.year || ''} ${def.make} · ${def.country}`.toUpperCase()), h('div', { style: { fontSize: '30px', fontWeight: 700 } }, def.name)), def.placeholder ? chip('prototype', 'warn') : null),
      h('p.notice', {}, def.description),
      perfPanel(def, config).el,
      h('div.kv', {}, h('span', {}, 'Engine'), h('span', {}, `${sum.engine} · ${sum.hp} hp`), h('span', {}, 'Weight'), h('span', {}, `${sum.mass} kg`), h('span', {}, 'Drivetrain'), h('span', {}, sum.drivetrain), h('span', {}, 'Owned'), h('span', {}, String(owned))),
      h('div.row', {}, h('div', { style: { fontSize: '28px', color: 'var(--acc)' } }, fmtCredits(def.price)), h('div.grow'),
        button(P.credits >= def.price ? 'Buy' : 'Not enough credits', () => {
          if (!P.spend(def.price, 'buy car')) { game.audio?.ui('error'); return; }
          const car = P.addCar(def.id);
          P.select(car.uid);
          game.audio?.ui('buy');
          game.ui.toast(`${def.make} ${def.name} added to your garage`);
          open('garage', {});
        }, { primary: true, disabled: P.credits < def.price, zh: '購買' })),
    );
  };
  for (const def of defs) {
    const pi = analyze(buildWorkingSpec(def, {}, null)).pi;
    const owned = P.garage.some((c) => c.vehicleId === def.id);
    const it = h('button.item' + (owned ? '.owned' : ''), { data: { focus: '', key: 'v:' + def.id }, on: { click: () => show(def.id) } },
      h('div', {}, h('div', {}, `${def.make} ${def.name}`), h('div', { style: { color: 'var(--dim)', fontSize: '14px' } }, fmtCredits(def.price))), h('div.meta', {}, owned ? h('span.tag', {}, 'OWNED') : null, ' ', classBadge(pi)));
    it.addEventListener('ttfocus', () => { if (sel !== def.id) show(def.id); });
    if (def.id === sel) it.dataset.autofocus = '';
    list.append(it);
  }
  if (sel) show(sel);
  const el = h('div', {}, header('Dealer', '車行', `${defs.length} models`, back), h('div.split', { style: { gridTemplateColumns: '0.75fr 1.25fr' } }, list, detail));
  return { el, camera: 'showroom' };
}
