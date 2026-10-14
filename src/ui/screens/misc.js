// Profile, in-game pause and results screens.
import { h, header, button, chip, statBars } from '../widgets.js';
import { fmtTime, fmtInt, fmtCredits } from '../../core/math.js';
import { EVENT_TYPES } from '../../maps/MapDef.js';

export function profile({ game, back }) {
  const P = game.profile, s = P.data.stats;
  const recs = Object.entries(P.data.records);
  const el = h('div', {}, header('Profile', '紀錄', fmtCredits(P.credits), back),
    h('div.split', {},
      h('div.panel', {}, h('h3', {}, 'Career'), h('div.kv', {},
        h('span', {}, 'Distance driven'), h('span', {}, `${(s.distance / 1000).toFixed(1)} km`), h('span', {}, 'Events'), h('span', {}, fmtInt(s.events || 0)),
        h('span', {}, 'Races / wins / podiums'), h('span', {}, `${s.races || 0} / ${s.wins || 0} / ${s.podiums || 0}`),
        h('span', {}, 'Drift points'), h('span', {}, fmtInt(s.driftPoints || 0)), h('span', {}, 'Best drift chain'), h('span', {}, fmtInt(s.bestDrift || 0)),
        h('span', {}, 'Top speed'), h('span', {}, `${Math.round(s.topSpeed || 0)} km/h`), h('span', {}, 'Cars owned'), h('span', {}, String(P.garage.length)))),
      h('div.panel.scroll', {}, h('h3', {}, 'Records'), recs.length ? h('div.kv', {}, recs.map(([k, r]) => [h('span', {}, k.split('/').slice(1, 2).join(' ')), h('span', {}, r.lap ? `lap ${fmtTime(r.lap)}` : r.time ? fmtTime(r.time) : r.score ? fmtInt(r.score) : '-')])) : h('p.notice', {}, 'No records yet. Go drive.'))));
  return { el, camera: 'cockpit' };
}

export function pause({ game, open }) {
  const S = game.session;
  const ev = S?.event;
  const map = S?.mapDef;
  const items = [
    button('Resume', () => game.resume(), { primary: true, zh: '繼續' }),
    ev ? button('Restart', () => game.restartSession(), { zh: '重新開始' }) : null,
    ev ? button('Leave event (free roam)', () => game.switchEvent(null), { zh: '自由駕駛' }) : null,
    button('Tune car', () => open('tuning', { uid: game.profile.selectedCar().uid, inGame: true }), { zh: '調校' }),
    button('Settings', () => open('settings', {}), { zh: '設定' }),
    button('Quit to garage', () => { game.ui.closePause(); game.endSession(true); }, { danger: true, zh: '離開' }),
  ].filter(Boolean);
  items[0].dataset.autofocus = '';
  const evList = map ? h('div.list.scroll', {}, map.events.map((e) => h('button.item', { data: { focus: '' }, on: { click: () => game.switchEvent({ ...e }) } }, h('div', {}, h('div.ev-type', {}, EVENT_TYPES[e.type].name), e.name), h('div.meta', {}, e.nameZh)))) : null;
  const el = h('div', {}, header('Paused', '暫停', map ? `${map.name} ${map.nameZh}${ev ? ' · ' + ev.name : ' · Free roam'}` : ''),
    h('div.split', {}, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, items), h('div.panel', { style: { display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 } }, h('h3', {}, 'Events on this map 本地賽事'), evList)));
  return { el, camera: 'none', onBack() { game.resume(); return true; } };
}

export function results({ game }, { r }) {
  const S = game.session;
  const kind = r.kind;
  let main;
  if (kind === 'race') {
    main = h('div.panel.scroll', {}, h('table.res-table', {}, r.rows.map((row, i) => h('tr' + (row.player ? '.me' : ''), {}, h('td', {}, String(i + 1)), h('td', {}, row.name), h('td', {}, row.car), h('td', { style: { textAlign: 'right' } }, fmtTime(row.time)), h('td', { style: { textAlign: 'right', color: 'var(--dim)' } }, row.best ? fmtTime(row.best) : '')))));
  } else if (kind === 'drift') {
    main = h('div.panel', { style: { display: 'grid', gap: '14px', alignContent: 'start' } }, h('div.res-big', {}, fmtInt(r.score)), h('div.stars', {}, [0, 1, 2].map((i) => h('i' + (i < r.stars ? '.on' : '')))),
      h('div.kv', {}, h('span', {}, 'Targets'), h('span', {}, r.targets.map(fmtInt).join(' / ')), h('span', {}, 'Best chain'), h('span', {}, fmtInt(r.best))));
  } else {
    main = h('div.panel', { style: { display: 'grid', gap: '10px', alignContent: 'start' } }, h('div.res-big', {}, fmtTime(r.bestLap)), h('div.notice', {}, 'best lap'),
      h('div.kv', {}, r.laps.map((l, i) => [h('span', {}, `Lap ${i + 1}`), h('span', { class: l === r.bestLap ? 'delta-pos' : '' }, fmtTime(l))]), r.previous?.lap ? [h('span', {}, 'Previous record'), h('span', {}, fmtTime(r.previous.lap))] : null));
  }
  const title = kind === 'race' ? `P${r.position} / ${r.of}` : kind === 'drift' ? `${r.stars} star${r.stars === 1 ? '' : 's'}` : 'Time attack';
  const side = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    h('div.panel', {}, h('h3', {}, 'Reward'), h('div', { style: { fontSize: '34px', color: 'var(--acc)' } }, fmtCredits(r.reward || 0)), r.improved && Object.keys(r.improved).length ? chip('new record', 'acc') : null),
    button('Continue (free roam)', () => game.switchEvent(null), { primary: true, zh: '繼續' }),
    button('Restart', () => game.restartSession(), { zh: '重來' }),
    button('Quit to garage', () => { game.ui.closePause(); game.endSession(true); }, { zh: '離開' }));
  side.children[1].dataset.autofocus = '';
  const el = h('div', {}, header(title, kind === 'race' ? '名次' : kind === 'drift' ? '甩尾' : '計時', r.event?.name || ''), h('div.split', {}, main, side));
  return { el, camera: 'none', onBack() { return true; } };
}
