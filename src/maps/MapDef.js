// Map definition normalization + validation. Authoring format: maps/AGENTS.md.
export const EVENT_TYPES = {
  circuit: { name: 'Circuit race', zh: '繞圈賽', ai: 7, laps: 3 },
  sprint: { name: 'Sprint', zh: '衝刺賽', ai: 7, laps: 1 },
  drift: { name: 'Drift zone', zh: '甩尾賽', ai: 0, laps: 1 },
  timeattack: { name: 'Time attack', zh: '計時賽', ai: 0, laps: 3 },
  touge: { name: 'Touge battle', zh: '山道對決', ai: 1, laps: 1 },
};

export function normalizeMap(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object') return { def: null, problems: ['not an object'] };
  if (!raw.id || !/^[a-z0-9-]+$/.test(raw.id)) problems.push('id must be kebab-case');
  if (!raw.name) problems.push('missing name');
  const roads = (raw.roads || []).map((r, i) => ({ id: r.id || `road${i}`, ...r }));
  const roadIds = new Set(roads.map((r) => r.id));
  for (const r of roads) if (!Array.isArray(r.points) || r.points.length < 2) problems.push(`road ${r.id}: needs >= 2 points`);
  const events = (raw.events || []).map((e, i) => {
    const t = EVENT_TYPES[e.type] ? e.type : 'circuit';
    if (!EVENT_TYPES[e.type]) problems.push(`event ${e.id || i}: unknown type "${e.type}"`);
    if (typeof e.route === 'string' && !roadIds.has(e.route)) problems.push(`event ${e.id}: route "${e.route}" is not a road id`);
    return {
      id: e.id || `event${i}`, name: e.name || EVENT_TYPES[t].name, nameZh: e.nameZh || EVENT_TYPES[t].zh, type: t,
      route: e.route, reverse: !!e.reverse, startAt: e.startAt ?? 0, finishAt: e.finishAt ?? null,
      laps: t === 'circuit' || t === 'timeattack' ? e.laps ?? EVENT_TYPES[t].laps : 1,
      ai: e.ai ?? EVENT_TYPES[t].ai, rewards: e.rewards || { credits: [60000, 35000, 20000] },
      timeLimit: e.timeLimit ?? null, targets: e.targets || (t === 'drift' ? [20000, 50000, 90000] : null),
      time: e.time ?? null, weather: e.weather ?? null, description: e.description || '', difficulty: e.difficulty ?? 1,
      classLimit: e.classLimit ?? null,
    };
  });
  const def = {
    id: raw.id, name: raw.name || raw.id, nameZh: raw.nameZh || '', region: raw.region || '', description: raw.description || '',
    placeholder: !!raw.placeholder, hidden: !!raw.hidden, order: raw.order ?? 99,
    environment: { time: 21, timeScale: 0, weather: 'clear', fogDensity: 0.0008, cityGlow: 0.35, glowColor: '#c8926a', clouds: 0.3, ...(raw.environment || {}) },
    spawn: { pos: raw.spawn?.pos || [0, null, 0], heading: raw.spawn?.heading ?? 0 },
    terrain: raw.terrain || null, water: raw.water || null, roads, junctions: raw.junctions || [], events,
    build: typeof raw.build === 'function' ? raw.build : null,
    preview: raw.preview || { colors: ['#1d1a16', '#e39b3d'] },
    seed: raw.seed ?? 1,
    batchChunk: raw.batchChunk ?? 180,
    raw,
  };
  if (!events.length) problems.push('no events defined (free roam still works)');
  return { def, problems };
}
