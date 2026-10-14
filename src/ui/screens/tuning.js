import { h, header, tabs, row, slider, button } from '../widgets.js';
import { TUNE_GROUPS, tuneSliders, formatTune } from '../../tuning/Tune.js';
import { buildWorkingSpec } from '../../vehicles/VehicleSpec.js';
import { perfPanel } from './garage.js';

export default function tuning({ game, back, refresh }, params) {
  const P = game.profile;
  const car = P.getCar(params.uid) || P.selectedCar();
  const def = game.registry.vehicle(car.vehicleId);
  const base = buildWorkingSpec(def, car.parts, null);
  const sliders = tuneSliders(base, car.parts);
  const groups = TUNE_GROUPS.filter((g) => sliders.some((s) => s.group === g.id));
  let group = params.group && groups.some((g) => g.id === params.group) ? params.group : groups[0]?.id;
  const tune = { ...(car.tune || {}) };
  const rowsCol = h('div.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
  const statsCol = h('div.panel.scroll');
  if (!params.inGame) game.menu.preview({ def, config: car });
  let saveT = null;
  const commit = () => {
    P.updateCar(car.uid, { tune: { ...tune } });
    statsCol.innerHTML = '';
    statsCol.append(perfPanel(def, { parts: car.parts, tune }).el);
    if (params.inGame && game.session) { clearTimeout(saveT); saveT = setTimeout(() => game.session.player.applyConfig({ tune: { ...tune } }, { rebuildModel: false }), 120); }
  };
  const renderRows = () => {
    rowsCol.innerHTML = '';
    if (!sliders.length) { rowsCol.append(h('p.notice', {}, 'Nothing adjustable yet. Install sport or race parts (suspension, gearbox, diff, aero) to unlock tuning.')); return; }
    for (const s of sliders.filter((x) => x.group === group)) {
      const val = tune[s.key] ?? s.base;
      const units = game.settings.get('display.units') === 'mph' ? 'imperial' : 'metric';
      rowsCol.append(row(s.label, slider(s.min, s.max, s.step, val, (v) => { tune[s.key] = v; commit(); }, (v) => formatTune(s.fmt, v, units))));
    }
  };
  const tb = tabs(groups.map((g) => ({ id: g.id, label: g.name, zh: g.zh })), group, (id) => { group = id; renderRows(); });
  renderRows();
  statsCol.append(perfPanel(def, { parts: car.parts, tune }).el);
  const resetBtn = button('Reset to default', () => { for (const s of sliders) delete tune[s.key]; commit(); params.group = group; refresh(); }, { zh: '重設' });
  const el = h('div', {}, header('Tuning', '調校', `${def.make} ${def.name}`, params.inGame ? null : back), tb,
    h('div', { style: { display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '14px', flex: 1, minHeight: 0 } }, rowsCol, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 } }, statsCol, resetBtn)));
  return { el, camera: 'showroom', tabs: tb, onExit() { clearTimeout(saveT); if (params.inGame && game.session) game.session.player.applyConfig({ tune: { ...tune } }, { rebuildModel: false }); } };
}
