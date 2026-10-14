import { h, header, button, row, selector, slider, classBadge } from '../widgets.js';
import { EVENT_TYPES } from '../../maps/MapDef.js';
import { analyze } from '../../tuning/Performance.js';
import { fmtTime, fmtInt, fmtCredits } from '../../core/math.js';
import { settingDef } from '../../core/Settings.js';

const TIMES = [{ value: null, label: 'Map default' }, { value: 5.8, label: 'Dawn 05:48' }, { value: 9, label: 'Morning 09:00' }, { value: 12.5, label: 'Noon 12:30' }, { value: 17.7, label: 'Sunset 17:42' }, { value: 18.9, label: 'Dusk 18:54' }, { value: 21.5, label: 'Night 21:30' }, { value: 0.5, label: 'Midnight 00:30' }];
const WEATHER = [{ value: null, label: 'Map default' }, { value: 'clear', label: 'Clear' }, { value: 'overcast', label: 'Overcast' }, { value: 'rain', label: 'Rain' }, { value: 'fog', label: 'Fog' }];

export default function event({ game, open, back }, { mapId, eventId }) {
  const map = game.registry.map(mapId);
  const ev = map?.events.find((e) => e.id === eventId);
  if (!ev) return { el: h('div', {}, header('Event', '', '', back), h('p.notice', {}, 'Event not found.')) };
  const opts = { mapId, eventId, laps: ev.laps, aiCount: ev.ai, difficulty: game.settings.get('gameplay.difficulty'), time: null, weather: ev.weather };
  const car = game.profile.selectedCar();
  const v = game.menu.vehicleFor(car);
  const perf = v ? analyze(v.spec) : null;
  const rec = game.profile.getRecord(`${mapId}/${eventId}/${car.vehicleId}`);
  const t = EVENT_TYPES[ev.type];
  const info = h('div.panel', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    h('div.ev-type', {}, `${t.name} · ${t.zh}`),
    h('div', { style: { fontSize: '30px', fontWeight: 700 } }, ev.name, h('span.zh', { style: { color: 'var(--acc)', marginLeft: '12px', fontSize: '18px' } }, ev.nameZh)),
    h('p.notice', {}, ev.description || map.description),
    h('div.kv', {},
      h('span', {}, 'Map'), h('span', {}, `${map.name} ${map.nameZh}`),
      h('span', {}, 'Reward (1st)'), h('span', {}, fmtCredits(ev.rewards?.credits?.[0] || 0)),
      ev.type === 'drift' ? [h('span', {}, 'Targets'), h('span', {}, ev.targets.map(fmtInt).join(' / '))] : null,
      rec?.lap ? [h('span', {}, 'Your best lap'), h('span', {}, fmtTime(rec.lap))] : null,
      rec?.score ? [h('span', {}, 'Your best score'), h('span', {}, fmtInt(rec.score))] : null,
    ),
    h('div.set-group', {}, 'Your car 座駕'),
    h('div.row', {}, h('div.grow', {}, v ? `${v.def.make} ${v.def.name}` : '-'), perf ? classBadge(perf.pi) : null),
    button('Change car', () => open('garage', {}), { zh: '換車' }),
  );
  const controls = h('div.panel.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
  if (ev.type === 'circuit' || ev.type === 'timeattack') controls.append(row('Laps 圈數', slider(1, 20, 1, opts.laps, (x) => { opts.laps = x; })));
  if (t.ai > 0) {
    controls.append(row('Opponents 對手', slider(0, 11, 1, opts.aiCount, (x) => { opts.aiCount = x; })));
    controls.append(row('Difficulty 難度', selector(settingDef('gameplay.difficulty').options, opts.difficulty, (x) => { opts.difficulty = x; })));
  }
  controls.append(row('Time of day 時間', selector(TIMES, null, (x) => { opts.time = x; })));
  controls.append(row('Weather 天氣', selector(WEATHER, ev.weather, (x) => { opts.weather = x; })));
  const start = button('Start', () => game.startSession({ ...opts, eventId, mapId, laps: opts.laps }), { primary: true, zh: '開始' });
  start.dataset.autofocus = '';
  controls.append(h('div', { style: { height: '8px' } }), start);
  // laps override flows into the event via session options
  const el = h('div', {}, header(ev.name, ev.nameZh, `${map.name}`, back), h('div.split', {}, info, controls));
  return { el, camera: 'cockpit' };
}
