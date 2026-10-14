import { h, header, button, chip } from '../widgets.js';
import { EVENT_TYPES } from '../../maps/MapDef.js';
import { fmtTime, fmtInt } from '../../core/math.js';

export default function drive({ game, open, back }, params) {
  const maps = [...game.registry.maps()].sort((a, b) => a.order - b.order);
  let sel = params.mapId || maps[0]?.id;
  const left = h('div.list.scroll');
  const right = h('div.panel.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  const renderRight = () => {
    right.innerHTML = '';
    const m = game.registry.map(sel);
    if (!m) { right.append(h('p.notice', {}, 'No maps installed. Add one in maps/ (see maps/AGENTS.md).')); return; }
    const env = m.environment;
    right.append(
      h('div.row', {}, h('div.grow', {}, h('div', { style: { fontSize: '30px', fontWeight: 700, letterSpacing: '0.08em' } }, m.name.toUpperCase()), h('div.zh', { style: { color: 'var(--acc)', fontSize: '18px' } }, m.nameZh)), m.placeholder ? chip('test map', 'warn') : null),
      h('p.notice', {}, m.description),
      h('div.row', {}, chip(`${String(Math.floor(env.time)).padStart(2, '0')}:${String(Math.round((env.time % 1) * 60)).padStart(2, '0')}`), chip(env.weather), chip(m.region || 'Taiwan')),
      button('Free roam', () => game.startSession({ mapId: m.id }), { primary: true, zh: '自由駕駛' }),
      h('div.set-group', {}, 'Events 賽事'),
    );
    for (const ev of m.events) {
      const rec = game.profile.getRecord(`${m.id}/${ev.id}/${game.profile.selectedCar()?.vehicleId}`) || game.profile.getRecord(`${m.id}/${ev.id}`);
      const recTxt = ev.type === 'drift' ? (rec?.score ? `best ${fmtInt(rec.score)}` : '') : rec?.lap ? `best lap ${fmtTime(rec.lap)}` : rec?.time ? fmtTime(rec.time) : '';
      right.append(h('button.item', { data: { focus: '', key: 'ev:' + ev.id }, on: { click: () => open('event', { mapId: m.id, eventId: ev.id }) } },
        h('div', {}, h('div.ev-type', {}, `${EVENT_TYPES[ev.type].name} · ${EVENT_TYPES[ev.type].zh}`), h('div', { style: { fontSize: '20px', marginTop: '2px' } }, ev.name, h('span.zh', { style: { color: 'var(--dim)', marginLeft: '10px', fontSize: '15px' } }, ev.nameZh))),
        h('div.meta', {}, ev.laps > 1 ? `${ev.laps} laps` : ev.type === 'drift' ? `${ev.timeLimit || 90}s` : '', h('br'), recTxt)));
    }
  };
  for (const m of maps) {
    const b = h('button.card.map-card', { data: { focus: '', key: 'map:' + m.id }, on: { click: () => { sel = m.id; renderRight(); }, focus: () => {} } },
      h('span.zhbig', {}, m.nameZh), h('div.t', {}, m.name), h('div.s', {}, `${m.events.length} events · ${m.region}`));
    b.style.background = `linear-gradient(160deg, ${m.preview.colors[0]}, #0d0c0b)`;
    b.addEventListener('ttfocus', () => { if (sel !== m.id) { sel = m.id; renderRight(); } });
    left.append(b);
  }
  renderRight();
  const el = h('div', {}, header('Drive', '駕駛', 'Choose a map', back), h('div.split', { style: { gridTemplateColumns: '0.8fr 1.2fr' } }, left, right));
  return {
    el, camera: 'cockpit',
    onEnter() { const first = left.querySelector(`[data-key="map:${sel}"]`); if (first) first.dataset.autofocus = ''; },
  };
}
