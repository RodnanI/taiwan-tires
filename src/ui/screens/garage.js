import { h, header, button, classBadge, statBars, chip } from '../widgets.js';
import { analyze } from '../../tuning/Performance.js';
import { buildWorkingSpec, specSummary } from '../../vehicles/VehicleSpec.js';
import { fmtCredits } from '../../core/math.js';

export function perfPanel(def, config, after = null) {
  const m = analyze(buildWorkingSpec(def, config.parts, config.tune));
  const a = after ? analyze(buildWorkingSpec(def, after.parts, after.tune)) : null;
  const B = m.bars, A = a?.bars;
  return {
    m, a,
    el: h('div', { style: { display: 'grid', gap: '12px' } },
      h('div.row', {}, classBadge(m.pi), a && a.pi !== m.pi ? [h('span', { style: { color: 'var(--dim)' } }, '→'), classBadge(a.pi)] : null),
      statBars([
        { label: 'Speed', value: B.speed, after: A?.speed, text: `${(a || m).topSpeed} km/h` },
        { label: 'Accel', value: B.accel, after: A?.accel, text: `${((a || m).t100 ?? 0).toFixed(1)} s` },
        { label: 'Handling', value: B.handling, after: A?.handling, text: `${(a || m).latG.toFixed(2)} g` },
        { label: 'Braking', value: B.braking, after: A?.braking, text: `${(a || m).braking.toFixed(0)} m` },
        { label: 'Launch', value: B.launch, after: A?.launch, text: `${((a || m).t60 ?? 0).toFixed(1)} s` },
        { label: 'Drift', value: B.drift, after: A?.drift, text: (a || m).drift.toFixed(1) },
      ]),
    ),
  };
}

export default function garage({ game, open, back, refresh }) {
  const P = game.profile;
  let focusUid = P.selectedCar().uid;
  const list = h('div.list.scroll');
  const detail = h('div.panel.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  const show = (uid) => {
    focusUid = uid;
    const car = P.getCar(uid);
    const def = game.registry.vehicle(car.vehicleId);
    game.menu.preview({ def, config: car });
    const spec = buildWorkingSpec(def, car.parts, car.tune);
    const sum = specSummary(spec);
    const perf = perfPanel(def, car);
    detail.innerHTML = '';
    detail.append(
      h('div.row', {}, h('div.grow', {}, h('div', { style: { color: 'var(--dim)', letterSpacing: '0.2em', fontSize: '13px' } }, `${def.year || ''} ${def.make}`.toUpperCase()), h('div', { style: { fontSize: '30px', fontWeight: 700 } }, def.name)), def.placeholder ? chip('prototype', 'warn') : null),
      perf.el,
      h('div.kv', {}, h('span', {}, 'Engine'), h('span', {}, sum.engine), h('span', {}, 'Power'), h('span', {}, `${sum.hp} hp @ ${sum.powerRpm} rpm`), h('span', {}, 'Torque'), h('span', {}, `${sum.torque} Nm`),
        h('span', {}, 'Weight'), h('span', {}, `${sum.mass} kg · ${Math.round(sum.weightFront * 100)}% front`), h('span', {}, 'Drivetrain'), h('span', {}, `${sum.drivetrain} · ${sum.gears}-speed`), h('span', {}, 'Tyres'), h('span', {}, sum.compound)),
      h('div.row', { style: { flexWrap: 'wrap' } },
        P.data.selected === uid ? chip('selected', 'acc') : button('Select', () => { P.select(uid); refresh(); }, { primary: true, zh: '選擇' }),
        button('Upgrades', () => open('upgrades', { uid }), { zh: '改裝' }),
        button('Tuning', () => open('tuning', { uid }), { zh: '調校' }),
        button('AI tune', () => open('aitune', { uid }), { zh: 'AI調校' }),
        button('Paint & body', () => open('paint', { uid }), { zh: '烤漆' }),
        P.garage.length > 1 ? button(`Sell ${fmtCredits(Math.round(def.price * 0.6))}`, () => { P.sellCar(uid); focusUid = P.selectedCar().uid; refresh(); }, { danger: true }) : null),
    );
  };
  for (const car of P.garage) {
    const def = game.registry.vehicle(car.vehicleId);
    const pi = analyze(buildWorkingSpec(def, car.parts, car.tune)).pi;
    const it = h('button.item' + (P.data.selected === car.uid ? '.active' : ''), { data: { focus: '', key: 'car:' + car.uid }, on: { click: () => show(car.uid) } },
      h('div', {}, h('div', {}, `${def.make} ${def.name}`), h('div', { style: { color: 'var(--dim)', fontSize: '14px' } }, car.nickname || def.year)), h('div.meta', {}, classBadge(pi)));
    it.addEventListener('ttfocus', () => { if (focusUid !== car.uid) show(car.uid); });
    if (car.uid === focusUid) it.dataset.autofocus = '';
    list.append(it);
  }
  show(focusUid);
  const el = h('div', {}, header('Garage', '車庫', `${P.garage.length} car${P.garage.length === 1 ? '' : 's'}`, back), h('div.split', { style: { gridTemplateColumns: '0.75fr 1.25fr' } }, list, detail));
  return { el, camera: 'showroom' };
}
