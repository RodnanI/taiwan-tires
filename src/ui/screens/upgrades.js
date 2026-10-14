import { h, header, tabs, chip, classBadge } from '../widgets.js';
import { PART_CATEGORIES, PART_SLOTS, partAllowed, partLevel } from '../../tuning/Parts.js';
import { perfPanel } from './garage.js';
import { buildWorkingSpec } from '../../vehicles/VehicleSpec.js';
import { analyze } from '../../tuning/Performance.js';
import { fmtCredits } from '../../core/math.js';

export default function upgrades({ game, back, refresh }, params) {
  const P = game.profile;
  const car = P.getCar(params.uid) || P.selectedCar();
  const def = game.registry.vehicle(car.vehicleId);
  let cat = params.cat || PART_CATEGORIES[0].id;
  let slotId = params.slot || null;
  const slotsCol = h('div.list.scroll');
  const levelsCol = h('div.list.scroll');
  const statsCol = h('div.panel.scroll');
  game.menu.preview({ def, config: car });
  const preview = (slot, level) => {
    const after = { parts: { ...car.parts, [slot]: level }, tune: car.tune };
    if (level === 'stock') delete after.parts[slot];
    statsCol.innerHTML = '';
    statsCol.append(perfPanel(def, car, after).el);
  };
  const renderLevels = () => {
    levelsCol.innerHTML = '';
    const slot = PART_SLOTS.find((s) => s.id === slotId);
    if (!slot) { levelsCol.append(h('p.notice', {}, 'Pick a part on the left.')); return; }
    const base = buildWorkingSpec(def, car.parts, null);
    if (slot.requires && !slot.requires(car.parts, base)) { levelsCol.append(h('p.notice', {}, 'Requires forced induction.')); return; }
    for (const l of slot.levels) {
      if (!partAllowed(def, slot.id, l.id)) continue;
      const installed = (car.parts[slot.id] || 'stock') === l.id;
      const owned = l.id === 'stock' || (car.owned?.[slot.id] || []).includes(l.id);
      const it = h('button.item' + (installed ? '.active' : ''), { data: { focus: '', key: `lvl:${l.id}` }, on: { click: () => {
        const r = P.installPart(car.uid, slot.id, l.id, l.price);
        if (!r.ok) { game.ui.toast(r.reason === 'credits' ? 'Not enough credits' : 'Cannot install'); game.audio?.ui('error'); return; }
        game.audio?.ui(r.cost ? 'buy' : 'confirm');
        refreshKeep();
      } } },
        h('div', {}, h('div', {}, l.name), l.desc ? h('div', { style: { color: 'var(--faint)', fontSize: '13px' } }, l.desc) : null),
        h('div.meta', {}, installed ? chip('installed', 'acc') : owned ? chip('owned') : fmtCredits(l.price)));
      it.addEventListener('ttfocus', () => preview(slot.id, l.id));
      it.addEventListener('mouseenter', () => preview(slot.id, l.id));
      levelsCol.append(it);
    }
  };
  const renderSlots = () => {
    slotsCol.innerHTML = '';
    for (const slot of PART_SLOTS.filter((s) => s.cat === cat)) {
      if (!slot.levels.some((l) => l.id !== 'stock' && partAllowed(def, slot.id, l.id))) continue;
      const cur = partLevel(slot.id, car.parts[slot.id]);
      const it = h('button.item' + (slot.id === slotId ? '.active' : ''), { data: { focus: '', key: `slot:${slot.id}` }, on: { click: () => { slotId = slot.id; renderLevels(); game.ui.info?.focusFirstIn?.(levelsCol); } } },
        h('div', {}, slot.name, h('span.zh', { style: { color: 'var(--faint)', marginLeft: '8px', fontSize: '13px' } }, slot.zh)), h('div.meta', {}, cur?.id === 'stock' ? '' : cur?.name));
      it.addEventListener('ttfocus', () => { if (slotId !== slot.id) { slotId = slot.id; renderLevels(); } });
      slotsCol.append(it);
    }
    if (!slotId || !PART_SLOTS.find((s) => s.id === slotId && s.cat === cat)) slotId = PART_SLOTS.find((s) => s.cat === cat)?.id;
    renderLevels();
  };
  const refreshKeep = () => { params.cat = cat; params.slot = slotId; refresh(); };
  const tb = tabs(PART_CATEGORIES.map((c) => ({ id: c.id, label: c.name, zh: c.zh })), cat, (id) => { cat = id; slotId = null; renderSlots(); });
  renderSlots();
  statsCol.append(perfPanel(def, car).el);
  const pi = analyze(buildWorkingSpec(def, car.parts, car.tune)).pi;
  const el = h('div', {}, header('Upgrades', '改裝', `${def.make} ${def.name}`, back), h('div.row', {}, tb, classBadge(pi)),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: '14px', flex: 1, minHeight: 0 } }, slotsCol, levelsCol, statsCol));
  return { el, camera: 'showroom', tabs: tb };
}
