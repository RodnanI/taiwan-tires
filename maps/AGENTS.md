# Maps: authoring guide

One folder per map: `maps/<id>/map.js`, default-exporting a plain object. Auto-discovered by the build.
`maps/_template/map.js` is a small working map with every feature commented (folders starting with `_` are
not loaded). `maps/kaohsiung-harbor/map.js` is the full test map (placeholder) and the best real example.

```bash
cp -r maps/_template maps/my-map              # then set id: 'my-map' (must equal the folder name)
npm run validate -- --only my-map             # builds it headless: spawn, routes, budgets
npm run build && node tools/shot.mjs --map my-map --event <eventId>
```

A map is **declarative data** (environment, terrain, roads, events) plus an optional **`build(ctx)`** that
places everything else (buildings, props, landmarks) with the map kit. Roads declared in data get surfaces,
markings, kerbs, walls, street lights, bridges and collision automatically, and the menus can read their
routes without loading the map (the AI tune uses this), so declare every raceable road in `roads`.

## World frame and scale

- 1 unit = 1 metre. **+X east, -Z north, +Y up.** Map `heading` values are degrees: 0 = facing south (+Z),
  90 = east (+X), 180 = north (-Z), 270 = west.
- Keep the playable area inside about 6 x 6 km (float precision and shadow cascades are tuned for it).
  The far plane follows the graphics preset (`drawDistance` 350 m on Potato to 4.5 km on Ultra++), so
  build distant silhouettes (`kit.skyline`, mountains as terrain) for anything players see from far away.

## Top-level fields

```js
export default {
  id: 'taipei-downtown', name: 'Taipei Downtown', nameZh: '台北市區', region: 'Taipei',
  description: '...', placeholder: false, order: 1, seed: 11,
  preview: { colors: ['#101418', '#e8a33c'] },          // menu card gradient stops
  environment: { time: 22, timeScale: 0, weather: 'clear', fogDensity: 0.0006, cityGlow: 0.4, glowColor: '#c8926a', clouds: 0.3 },
  spawn: { pos: [x, null, z], heading: 90 },            // y null = drop onto the ground there
  terrain: { ... },                                     // optional heightfield
  water: { level: -2.5, size: 6000, center: [0, 2000], color: 0x0a2129 }, // optional; below level = reset
  roads: [ ... ],
  junctions: [ ... ],
  events: [ ... ],
  build(ctx) { ... },
};
```

| Field | Notes |
|---|---|
| `environment.time` | Hour 0 to 24 at session start. `timeScale` = game hours per real hour (0 = frozen, 24 = one day per hour). Events can override with `time`. |
| `environment.weather` | `clear`, `overcast`, `rain` (wet roads, spray, SSR puddles), `fog`. |
| `environment.cityGlow`, `glowColor` | Light pollution on the night horizon (0 for countryside, 0.3 to 0.5 for cities). |
| `order` | Sort order in the map list. |
| `seed` | Seed for `kit.rand` so procedural placement is stable between loads. |

## Roads

```js
{ id: 'civic-blvd', name: 'Civic Boulevard', closed: false, width: 14, lanes: 4, markings: 'double-yellow',
  points: [[x, z], [x, y, z], [x, y, z, width]],     // control points; y omitted = follow the terrain
  shoulder: { width: 2, surface: 'concrete' },         // false = none
  curbs: true,                                          // kerbs on corners (race tracks); curbRadius: tightness threshold
  walls: { left: 'barrier', right: 'guardrail' },       // or one string, or [{ from: m, to: m, left, right }]
  wallOffset: 0.6,
  lights: { spacing: 32, side: 'both' | 'left' | 'right' | 'alternate', height: 8.5, color: 0xfff0d8, intensity: 120, range: 34 },
  banking: 0 | deg | 'auto', bridge: false, smoothY: true, smoothPasses: 6, step: 2, surface: 'asphalt', redCurb: false }
```

- Points are Catmull-Rom interpolated and resampled every `step` metres. Use enough points for curves
  (every 20 to 60 m); the spline does not overshoot much but sharp hairpins need 4 or more points.
- `closed: true` for circuits (last point connects to the first; do not repeat the first point).
- Elevation: `[x, y, z]` pins heights (bridges, ramps, mountain roads with exact grades). `smoothY` smooths
  the profile; set `smoothY: false` to keep pinned heights exact. Roads carve the terrain flat under them.
- `bridge: true` adds pillars down to the ground and an underside; walls should be `barrier` on bridges.
- `markings`: `center-dashed`, `center-solid`, `double-yellow`, `race` (white edge lines + start grid).
  Taiwanese urban roads: `double-yellow` centre, white lane lines; `redCurb: true` for red no-parking kerbs.
- Wall types: `guardrail`, `barrier` (concrete), `wall`, `tires`.
- Junctions: `{ pos: [x, z], radius: 12, surface: 'asphalt', shape: 'round' }` flattens a patch where roads
  meet and cuts markings and walls there.

## Events

```js
{ id: 'civic-sprint', type: 'sprint', name: 'Civic Sprint', nameZh: '市民衝刺', route: 'civic-blvd',
  ai: 7, laps: 1, reverse: false, startAt: 0, finishAt: null,
  time: 22.5, weather: 'rain', classLimit: 'A', difficulty: 1,
  rewards: { credits: [60000, 35000, 20000] }, description: '...' }
```

| type | Rules | Specific fields |
|---|---|---|
| `circuit` | Laps of a closed route vs AI. | `laps`, `ai` (opponents, default 7) |
| `sprint` | Point to point vs AI. | `startAt`, `finishAt` (metres along the road) |
| `touge` | One-on-one mountain duel (sprint rules, 1 AI by default). | |
| `drift` | Score inside a zone before time runs out. | `timeLimit` s, `targets` [bronze, silver, gold] points |
| `timeattack` | Solo laps against your best (ghost). | `laps` |

`route` is a road id (string) or an inline path `{ closed, width, points: [[x, z], ...] }` (use inline paths
for drift zones that are not roads). `reverse: true` runs a road backwards. The validator checks that every
route exists, that circuits are closed and that the start is on drivable ground.

## `build(ctx)` and the map kit

`build({ THREE, kit, quality, env, rand })` runs after terrain and roads exist, so `kit.groundY(x, z)` returns
road-aware heights. Everything you add is batched and instanced by the kit: do not add thousands of separate
meshes to the scene yourself.

| Kit call | What it does |
|---|---|
| `kit.mesh(geo, mat, { pos, rot, scale, cast, receive })` | Static mesh, merged into batches by material. |
| `kit.addStatic(geo, mat, { cast, receive })` | Same, for geometry already in world space. |
| `kit.add(object3d)` | Dynamic object (moves or animates): not batched. |
| `kit.animate((dt, time) => ...)` | Per-frame callback (rotating signs, flags, water). |
| `kit.light({ pos, color, intensity, range, nightOnly })` | Virtual light. Hundreds are fine: only the nearest N (graphics setting) become real lights. |
| `kit.collision.box({ x, z, hx, hz, rotY, y0, y1, kind })` | Solid block (buildings, walls, containers). |
| `kit.collision.cylinder({ x, z, r, y0, y1 })`, `.wall(ax, az, bx, bz, opts)`, `.wallPath(points, opts)` | Poles, thin walls, fences. |
| `kit.collision.triangles(geometry, surface)` | Make any geometry drivable (ramps, plazas, car parks). |
| `kit.groundY(x, z)`, `kit.rawGroundY(x, z)` | Ground height with and without road carving. |
| `kit.road(spec)`, `kit.junction(spec)` | Same as the data arrays (for generated roads; the menus can't preview these). |
| `kit.building({ x, z, w, d, rotY, style, floors, h, color, signs, qilou, rooftop })` | One building with collision. Styles: `shophouse`, `apartment`, `office`, `warehouse`. |
| `kit.row({ a, b, depth, side, style, minW, maxW, floors, seed })` | A street frontage of buildings along a->b. |
| `kit.skyline({ center, radius: [min, max], count, height: [min, max], seed, y })` | Cheap distant city silhouette (no collision). |
| `kit.supertall({ pos, height, segments, color })` | Stacked-pagoda landmark tower (Taipei 101 style silhouette). |
| `kit.props.place(name, [x, y, z], rotY, scale, color, { collide })` | Instanced prop with its collider. |
| `kit.props.streetLamp(pos, heading, opts)`, `kit.props.containerStack(pos, rotY, { long, high })` | Prop helpers. |
| `kit.props.define(name, parts)` | Register a custom instanced prop (parts = [{ geometry, material }]). |
| `kit.signs.slot(text, palette)` + `kit.signs.geometry(rect, w, h, depth)` | Traditional Chinese shop signs from a shared atlas (one draw call). Use `kit.signs.material`. |
| `kit.M` | Material factory: `M.surface({...})`, `M.textured(key, {...})` with keys from `src/render/textures.js` (`asphalt concrete grass dirt brushed`...), `M.shared(key, fn)`. |
| `kit.env.addWettable(material)` | Material gets darker and glossier in rain (roads already are). |
| `kit.nightMaterials.push(mat)` + `mat.userData.nightEmissive = [day, night]` | Emissive that switches on at night (windows, neon). |
| `kit.rand()`, `kit.noise.fbm / ridged / valueNoise` | Seeded randomness and noise. Never use `Math.random()` (maps must rebuild identically). |
| `kit.merge(geometries)` | Merge before `kit.mesh` when you build many small parts. |

Props catalogue (`kit.props.place` names): `palm tree bush cone waterBarrier scooter pillar mirror
trafficLight vending bollard waterTank acUnit cage crate drum bench busStop betelStand powerPole
lampPole lampArm railPost`. Add new ones in `src/maps/kit/props.js` (instanced, one draw call each).

## Terrain

```js
terrain: { size: [4000, 4000], center: [0, 0], cell: 4, surface: 'grass',
           height: { base: 0, amplitude: 120, scale: 0.0012, ridged: true, octaves: 5, seed: 3, plateau: null } }
           // or height: (x, z) => y.  scale = noise frequency per metre (0.0012 = features every ~800 m)
```

The heightfield is used for rendering and physics with the identical triangulation (no floating cars).
`cell` 4 m is the default; 2 m for detailed hills costs 4x memory. Colour follows slope and height.

## Surfaces

Collision triangles and terrain carry a surface id that changes grip, rolling resistance, dust and sound:
`asphalt concrete paint curb cobble dirt gravel grass sand metal wood puddle` (`src/physics/Surfaces.js`).
Tyre compounds react differently (rally tyres keep grip on dirt, slicks do not).

## Budgets (graphics preset High, detail 1)

| | Target | Hard limit |
|---|---|---|
| Objects after batching (validator "objects") | under 1500 | 2500 |
| Triangles in the whole map | under 3M | 5M |
| Colliders | no limit that matters (broadphase grid) | |
| Virtual lights | hundreds | |

Detail scales with `kit.detail` (0.3 Potato to 1.5 Ultra++) and `kit.vegetation`: multiply prop counts by
them for anything decorative.

## Making it feel like Taiwan

Shophouses (透天厝) with ground-floor qilou arcades (`qilou: true`), vertical shop signs in Traditional
Chinese, iron window cages, rooftop water tanks and sheds, scooters parked everywhere, betel nut stands,
power poles in the countryside, temples with curved ridges, rice paddies and banana trees in the south,
cliff roads with tunnels on the east coast, misty cedar forest and hairpins in the central mountains,
expressways on pillars through Taipei basin, Taipei 101 style tower on the skyline. Night is the default
mood for the city; dusk and rain are good for mountains.

## Definition of done for a detailed map

- Every raceable road in `roads` with walls where a real road would have them, lights, junctions.
- At least: two circuits or sprints, one touge or sprint with elevation, one drift zone, one time attack.
- `npm run validate -- --only <id> --strict` passes (spawn, routes, budgets).
- Screenshots at Low and Ultra from the spawn and from each event start look right; no floating or sunken
  props (use `kit.groundY`).
- Remove `placeholder: true`.
