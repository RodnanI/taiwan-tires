import { h, classBadge } from '../widgets.js';
import { analyze } from '../../tuning/Performance.js';

export default function home({ game, open }) {
  const car = game.profile.selectedCar();
  const v = game.menu.vehicleFor(car);
  const perf = v ? analyze(v.spec) : null;
  const maps = game.registry.maps();
  const events = maps.reduce((a, m) => a + m.events.length, 0);
  const tile = (id, en, zh, mark, desc, extra = null, big = false) => h(`button.tile${big ? '.big' : ''}`, { data: { focus: '', key: id }, on: { click: () => open(id, { uid: car?.uid }) } },
    h('span.mark', {}, mark), extra ? h('span.tile-meta', {}, extra) : null, h('b', {}, en), h('span.zh', {}, zh), desc ? h('p', {}, desc) : null);
  const el = h('div', {},
    h('div.home-grid', {},
      tile('drive', 'DRIVE', '駕駛', '駕', 'Free roam, races, drift zones and time attacks.', `${maps.length} MAP${maps.length === 1 ? '' : 'S'} · ${events} EVENTS`, true),
      tile('garage', 'GARAGE', '車庫', '車', v ? `${v.def.make} ${v.def.name}` : 'Your cars', perf ? classBadge(perf.pi) : null),
      tile('upgrades', 'UPGRADE', '改裝', '改', 'Engine, turbo, suspension, swaps.'),
      tile('aitune', 'AI TUNE', '調校', '調', 'Set a goal. The tuner searches thousands of builds.'),
      tile('settings', 'SETTINGS', '設定', '設', 'Graphics Potato → Ultra++, FPS, controls.'),
    ),
  );
  el.querySelector('[data-key="drive"]').dataset.autofocus = '';
  return { el, camera: 'cockpit' };
}
