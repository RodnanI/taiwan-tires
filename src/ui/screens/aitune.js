import { put } from '../dom.js';
import { h, header, row, selector, slider, toggle, button, progress, classBadge } from '../widgets.js';
import { AITuner, GOALS } from '../../tuning/AITune.js';
import { CLASSES } from '../../tuning/Performance.js';
import { partLevel } from '../../tuning/Parts.js';
import { fmtCredits, fmtTime } from '../../core/math.js';
import { perfPanel } from './garage.js';

export default function aitune({ game, back, refresh }, params) {
  const P = game.profile;
  const car = P.getCar(params.uid) || P.selectedCar();
  const def = game.registry.vehicle(car.vehicleId);
  game.menu.preview({ def, config: car });
  const o = params.opts || { goal: 'balanced', cls: 'A', budget: Math.min(P.credits, 600000), drivetrain: 'keep', tires: 'any', allowSwap: false, allowAero: true, route: null };
  params.opts = o;
  // routes available for "specific route"
  const routes = [];
  for (const m of game.registry.maps()) for (const e of m.events) routes.push({ value: `${m.id}/${e.id}`, label: `${m.name}: ${e.name}` });
  const left = h('div.panel.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
  const right = h('div.panel.scroll', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  const goalDesc = h('p.notice', {}, GOALS[o.goal].desc);
  left.append(
    row('Goal 目標', selector(Object.entries(GOALS).map(([k, g]) => ({ value: k, label: `${g.name} ${g.zh}` })), o.goal, (v) => { o.goal = v; goalDesc.textContent = GOALS[v].desc; })),
    goalDesc,
    row('Class limit 級距', selector([{ value: null, label: 'No limit' }, ...CLASSES.map((c) => ({ value: c.id, label: `${c.id} (≤ ${c.max})` }))], o.cls, (v) => { o.cls = v; })),
    row('Budget 預算', slider(0, 3000000, 10000, o.budget, (v) => { o.budget = v; }, (v) => fmtCredits(v))),
    row('Drivetrain 驅動', selector([{ value: 'keep', label: 'Keep' }, { value: 'any', label: 'Any' }, { value: 'RWD', label: 'RWD' }, { value: 'AWD', label: 'AWD' }, { value: 'FWD', label: 'FWD' }], o.drivetrain, (v) => { o.drivetrain = v; })),
    row('Tyres 輪胎', selector([{ value: 'any', label: 'Any compound' }, { value: 'street', label: 'Street legal' }, { value: 'drift', label: 'Drift only' }], o.tires, (v) => { o.tires = v; })),
    row('Engine swaps 換引擎', toggle(o.allowSwap, (v) => { o.allowSwap = v; })),
    row('Aero parts 空力', toggle(o.allowAero, (v) => { o.allowAero = v; })),
    row('Route (for "Specific route")', selector([{ value: null, label: 'None' }, ...routes], o.route, (v) => { o.route = v; })),
  );
  const runBtn = button('Run AI tune', () => run(), { primary: true, zh: '開始調校' });
  runBtn.dataset.autofocus = '';
  left.append(h('div', { style: { height: '8px' } }), runBtn);
  right.append(h('h3', {}, 'Current build'), perfPanel(def, car).el, h('p.notice', {}, 'The tuner evaluates ~1000 combinations of parts and settings with the same tyre and drivetrain model the physics uses, then hill-climbs the best one. Parts you already own are free.'));
  let running = false;
  function run() {
    if (running) return;
    running = true;
    const cls = CLASSES.find((c) => c.id === o.cls);
    let route = null;
    if (o.route) { const [mid, eid] = o.route.split('/'); const m = game.registry.map(mid); route = null; o._routeMap = m; o._routeEvent = m?.events.find((e) => e.id === eid); }
    if (o.goal === 'track' && o._routeEvent) route = routeForPreview(game, o._routeMap, o._routeEvent);
    const tuner = new AITuner(def, car, { goal: o.goal === 'track' && !route ? 'balanced' : o.goal, classMax: cls ? cls.max : null, budget: o.budget, drivetrain: o.drivetrain, tires: o.tires, allowSwap: o.allowSwap, allowAero: o.allowAero, route });
    const it = tuner.run();
    right.innerHTML = '';
    const bar = progress(0), label = h('div.notice', {}, 'Searching…');
    right.append(h('h3', {}, 'AI tune running 調校中'), bar, label);
    const step = () => {
      const t0 = performance.now();
      let s;
      while (performance.now() - t0 < 14) {
        s = it.next();
        if (s.done) { running = false; show(s.value); return; }
        bar.set(s.value.progress);
        label.textContent = `${s.value.evals} builds evaluated · best PI ${s.value.best.m.pi}`;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function show(r) {
    right.innerHTML = '';
    const after = { parts: r.parts, tune: r.tune };
    const changed = Object.entries(r.parts).filter(([k, v]) => (car.parts[k] || 'stock') !== v).concat(Object.keys(car.parts).filter((k) => !r.parts[k]).map((k) => [k, 'stock']));
    put(right,
      h('h3', {}, `Result · ${GOALS[r.goal].name}`),
      h('div.row', {}, classBadge(r.before.pi), h('span', {}, '→'), classBadge(r.metrics.pi), h('div.grow'), h('b', { style: { color: 'var(--acc)' } }, fmtCredits(r.cost))),
      perfPanel(def, car, after).el,
      r.lap ? h('div.kv', {}, h('span', {}, 'Est. lap time'), h('span', {}, `${fmtTime(r.lapBefore)} → ${fmtTime(r.lap)}`)) : null,
      h('div', { style: { display: 'grid', gap: '6px' } }, r.notes.map((n) => h('div.notice', {}, '· ' + n))),
      h('div.row', {},
        button(r.cost > P.credits ? 'Not enough credits' : `Apply ${fmtCredits(r.cost)}`, () => apply(r, changed), { primary: true, disabled: r.cost > P.credits, zh: '套用' }),
        button('Discard', () => refresh(), { zh: '放棄' })),
    );
    game.audio?.ui('confirm');
    game.ui.info?.focusFirst();
  }
  function apply(r, changed) {
    if (!P.spend(r.cost, 'ai tune')) return;
    const c = P.getCar(car.uid);
    c.owned ||= {};
    for (const [slot, lvl] of Object.entries(r.parts)) if (lvl !== 'stock' && !(c.owned[slot] || []).includes(lvl)) (c.owned[slot] ||= []).push(lvl);
    P.updateCar(car.uid, { parts: { ...r.parts }, tune: { ...r.tune } });
    game.ui.toast(`AI tune applied: ${changed.length} part change${changed.length === 1 ? '' : 's'}`);
    game.audio?.ui('buy');
    back();
  }
  const el = h('div', {}, header('AI Tune', 'AI調校', `${def.make} ${def.name}`, back), h('div.split', {}, left, right));
  return { el, camera: 'showroom' };
}

/** Route geometry for lap estimates without loading the whole map: uses road control points. */
function routeForPreview(game, map, ev) {
  if (!map || !ev) return null;
  return game.routeCache?.(map, ev) || null;
}
export { partLevel };
