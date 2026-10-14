# Vehicles: authoring guide

One folder per car: `vehicles/<id>/vehicle.js`, default-exporting a plain object. The build discovers it
automatically; nothing else needs registering. `vehicles/_template/vehicle.js` is a complete, commented
starting point (folders starting with `_` are not loaded).

```bash
cp -r vehicles/_template vehicles/my-car     # then set id: 'my-car' (must equal the folder name)
npm run validate -- --only my-car             # builds the model headless, checks it against the specs
npm run build && node tools/shot.mjs          # look at it in the game (tmp/shots/)
```

A vehicle file has two independent halves:

1. **`specs`**: physics data (SI units). Drives the simulation, the performance index (PI), the upgrade shop
   and the AI tune. No geometry.
2. **`model.build(ctx)`**: returns the 3D model (body + interior). Pure geometry: the runtime adds wheels,
   suspension motion, lights, gauges, steering animation and the menu screen.

You can replace either half without touching the other. The three hero cars (`hoshino-kaze86`, `tenmaru-rs4`,
`yushan-typhoon`) are finished, detailed models built with the **body toolkit** below; read one of them before
starting a new car. Each splits its model into `body.js` (exterior) and `cabin.js` (interior) next to
`vehicle.js`. The template still uses the quick prototype presets.

## Coordinate frame (get this right first)

- Units: metres. **+Z forward, +Y up, +X = the car's left.** Taiwan is left-hand drive: driver at **+X**.
- **Origin**: on the ground (tyre contact plane) at stock ride height, centred between the axles and the
  wheels. Front axle at `z = +wheelbase / 2`, rear at `-wheelbase / 2`, wheel centres at `y = tyre radius`.
- If the body is not centred on the wheelbase (long front overhang), keep the origin at the wheelbase centre
  and set `specs.bodyOffsetZ` to the body box centre (negative = body shifted back).
- `specs.dimensions` `[length, width, height]` must match the model (the validator checks it): it is the
  collision box. Width excludes mirrors.

## Metadata

| Field | Notes |
|---|---|
| `id` | kebab-case, equals the folder name. Saved in player profiles: **never rename a shipped car**. |
| `name`, `make`, `year`, `country` | Fictional makes only (no trademarks). `country` is a 2-letter code. |
| `price` | NT$. Dealer price; sell value is 60%. Rough scale: 500k (old hatch) to 12M (hypercar). |
| `starter` | `true` = given to new profiles (exactly one car should have it). |
| `placeholder` | `true` while the model is a prototype (shows a "prototype" chip in menus). Remove when done. |
| `hidden` | Not in the dealer (AI-only or unfinished). |
| `tags` | Free strings (`jdm`, `drift`, `kei`...). Not read by the engine yet; reserved for dealer filters. |
| `description` | One or two sentences for the dealer. |
| `upgrades.exclude` | Part restrictions: `['engineSwap', 'drivetrainSwap:FWD', 'induction:twinTurbo']` (slot or `slot:level`). |
| `sound` | Optional overrides for the procedural engine: `{ layout: 'I4' }` etc. Defaults come from `specs.engine`. |

## `specs` reference

Everything has a default (see `src/vehicles/VehicleSpec.js` `normalizeVehicle`), but real cars need real
numbers. Pairs `[front, rear]` accept a single number for both.

| Field | Unit | Default | Notes |
|---|---|---|---|
| `mass` | kg | 1300 | Curb weight with driver. |
| `weightFront` | 0..1 | 0.55 | Static front weight fraction. FR sports ~0.52, FF ~0.62, MR ~0.42. |
| `cgHeight` | m | 0.5 | CG above ground at stock ride height. Sports 0.45, hatch 0.5, SUV 0.65. |
| `wheelbase` | m | 2.55 | Axle to axle. |
| `track` | m `[f, r]` | 1.5 | Wheel centre to wheel centre across. |
| `dimensions` | m `[L, W, H]` | 4.4, 1.78, 1.35 | Collision box (body, no mirrors). |
| `bodyOffsetZ` | m | 0 | Body box centre relative to the wheelbase centre. |
| `clearance` | m | 0.13 | Underbody height (bottom of the collision box). |
| `inertiaScale` | x | 1 | Yaw/pitch inertia multiplier (mid-engine ~0.85, long heavy saloon ~1.1). |
| `engineLayout` | | `'front'` | `'front' \| 'mid' \| 'rear'` (engine swaps move weight towards this end). |
| `engine.layout` | | `'I4'` | `I3 I4 I5 I6 F4 F6 V6 V8 V10 V12 R2 R3 EV`. Drives the sound firing pattern. |
| `engine.displacement` | L | 2.0 | |
| `engine.aspiration` | | `'NA'` | `'NA' \| 'turbo' \| 'twinturbo' \| 'supercharger'` (label + sound). |
| `engine.torque` | `[[rpm, Nm]]` | | **Full-throttle torque at the crank, NA (without boost).** At least 3 points, last point at or past the limiter. |
| `engine.idle / redline / limiter` | rpm | 850 / 95% of last torque rpm / redline+250 | Limiter cuts fuel. |
| `engine.inertia` | kg m² | 0.15 | Flywheel + crank. Light race engine 0.08, big V8 0.25. Controls rev speed. |
| `engine.boost` | | null | `{ max: bar, spool: [startRpm, fullRpm], lag: s, type: 'turbo'\|'supercharger', eff }`. Torque multiplier = 1 + max * eff. |
| `transmission.gears` | ratios | 6-speed | Forward gears, first to last. |
| `transmission.reverse / final` | ratio | 3.4 / 4.1 | |
| `transmission.shiftTime` | s | 0.2 | Torque interruption per shift. |
| `drivetrain` | | `'RWD'` | `'RWD' \| 'FWD' \| 'AWD'`. |
| `awdSplit` | 0..1 | 0.4 | AWD front torque share. |
| `diff` | | open | Driven-axle diff (rear for RWD/AWD, front for FWD): `{ type: 'open'\|'lsd'\|'locked'\|'viscous', accel, decel, preload (Nm) }`. |
| `diffFront`, `centerDiff` | | | AWD only. Center default `{ type: 'viscous', viscous: 140 }`. |
| `steering` | | | `{ lock: deg at the wheels (36), ratio: steering-wheel ratio (14.5), ackermann: 0..1, caster: deg }`. |
| `suspension.front/rear` | | from ride frequency | `{ spring: N/m at the wheel, bump, rebound: Ns/m, travel: [bump, droop] m, arb: N/m, camber: deg, toe: deg, rollCenter: m }`. Defaults give 1.65/1.8 Hz. |
| `brakes` | | | `{ torque: total Nm (default mass * 3.9), bias: front share 0.64, handbrake: Nm }`. |
| `tires` | | | `{ compound, width: [mm, mm], radius: [m, m], pressure: [bar, bar], wheelMass: kg }`. Radius is the loaded rolling radius (0.28 to 0.36). |
| `aero` | | | `{ cd, area: m², downforce: [CL front, CL rear] }`. Negative = lift (most road cars ~ -0.05). |

Tyre compounds (`src/physics/Tire.js`): `street sport semiSlick slick drift rally offroad drag`. Stock cars use
`street` or `sport`; the shop sells the rest.

### Getting the numbers right

- Torque curve: take the real shape of a comparable engine. Peak power must come out right: the menu shows
  hp from the curve. Check with `npm run validate` (prints PI, top speed, 0-100, lateral g, and a physics
  drive test that must agree with the analytic model).
- Gearing: top speed should be reached at or a bit past peak power rpm in top gear (drag-limited). The
  validator's top speed tells you if the last gear is too short.
- Springs: start from the defaults (they derive from mass and weight split). Stiffer front than rear for
  stability, softer rear for drift cars.
- Plausibility targets (stock): 0-100 km/h 4 to 12 s, 100-0 braking 34 to 45 m, lateral grip 0.8 to 1.05 g.
- Class targets for the roster: the three hero cars should start in D, C and B (upgradeable to S1/S2/X).

## `model.build(ctx)` contract

```js
model: {
  build({ THREE, kit, spec, visual, parts, interior, detail, accent }) {
    const body = new THREE.Group();
    // ... add meshes ...
    return { body, anchors: { cockpit: [0.37, 1.1, -0.3], hood: [0, 1.02, 0.45], bumper: [0, 0.55, 2.1] } };
  },
},
```

| ctx | Meaning |
|---|---|
| `THREE` | three.js namespace (do not import three yourself). |
| `kit` | Model kit, below. One instance per build. |
| `spec` | The **working spec** (specs + installed parts + tune). Read `spec.wheelbase`, `spec.tires.radius[0]`, `spec.track`... |
| `visual` | `{ paint: { color, finish }, mods: { [slotId]: optionId } }` from the paint shop. |
| `parts` | Installed performance parts `{ slotId: levelId }`. Show them: wing when `parts.rearAero`, cage when `parts.cage`, wider arches when `parts.widthR`... |
| `interior` | `false` for AI and distant cars: skip the interior entirely (big triangle saving). |
| `detail` | 0.3 to 1.5 from the graphics preset. `kit.seg(n)` scales segment counts by it. |
| `accent` | UI accent colour (CSS string) for gauges and screens. |

Return value:

| Key | Required | Meaning |
|---|---|---|
| `body` | yes | `THREE.Object3D` with the whole car minus wheels. |
| `anchors.cockpit` | yes | Driver eye position `[x, y, z]` (`kit.presets.interior` returns it as `eye`). |
| `anchors.hood`, `anchors.bumper` | no | Hood and bumper camera positions. |
| `wheels` | no | Four custom wheels `[{ spin, hub? }]` (FL, FR, RL, RR, built for the left side, the runtime mirrors the right). Usually use `kit.wheels({...})` instead. |
| `steeringWheel` | no | Object to rotate for steering, if you did not use `kit.interior.steeringWheel` / `wheel2`. |
| `animate` | no | `(dt, state) => void`, called every rendered frame. `state`: `{ lights, brake, reverse, speed, steer, throttle, rpm, night }`. Pop-up lamps, active aero, wipers. Keep it allocation-free. |

The runtime registers automatically: headlights/brake/reverse/indicator lamps (from `kit.ext.headlight`,
`kit.ext.taillight` or any `kit.body.emitter(kind)` material), exhaust anchors (`kit.ext.exhaust` or pushes to
`kit._anchors.exhaust`, for flames), the steering wheel (`kit.interior.steeringWheel` / `wheel2`), live gauges
(`kit.interior.cluster`) and **the head unit screen** (`kit.interior.headUnit`, which also draws an in-game radio
display while driving).

### The head unit screen matters

The whole menu system is a car infotainment UI (1280x720 DOM) projection-mapped onto the screen rectangle
you create with `kit.interior.headUnit({ pos, size, tilt, style })`. Make it 16:9 (for example
`size: [0.24, 0.135]`) or the UI is stretched. It must be visible from the driver's eye and roughly face it.
Without a head unit the menu falls back to a flat screen (the validator warns).

## Kit reference (`ctx.kit`)

Materials (quality-aware, shared, never create raw three.js materials for common surfaces):
`kit.paint`, `kit.paint2` (second colour for two-tone parts; equals `kit.paint` until the paint shop gets a second picker), `kit.mat.glass(tint, opacity)`,
`kit.mat.chrome()`, `kit.mat.metal(color, roughness)`, `kit.mat.plastic(color, roughness)`,
`kit.mat.rubber()`, `kit.mat.carbon()`, `kit.mat.leather(color)`, `kit.mat.fabric(color)`,
`kit.mat.emissive(color, intensity)`, `kit.mat.surface({...})`, `kit.mat.textured(key, {...})`.

Helpers: `kit.mesh(geometry, material, { pos, rot, scale, shadow, receive, name })`, `kit.seg(n)`,
`kit.wheels({ style, rimRatio, color, caliperColor, widthScale, lugs, lipColor, finish, tyreBrand, whiteLetters })`
(override default wheels), `kit.buildWheel(opts)`. Wheels have moulded sidewall lettering (size code from the
spec), tread normals by compound, vented discs (cross-drilled from sport brakes up) and calipers that grow with
the brake upgrade; they are built once per axle and cloned.

Geometry (`kit.geo`, all return `BufferGeometry`):

| Function | Use |
|---|---|
| `shell({ z0, z1, top, bottom, halfWidth, shoulder, tumble, roundTop, roundBottom, arches, segZ, segU })` | Whole body from side/plan profiles. Fastest route to a believable car. |
| `loft(sections, { mirror, closed, capStart, capEnd, smoothZ, smoothU })` | Surface through cross-sections along Z. Fenders, bumpers, hoods, seats. |
| `extrude(outline, depth, { axis, bevel })` | Flat parts from an outline (`axis: 'x'` side profiles, `'z'`, `'y'`). |
| `latheX`, `latheZ`, `tube(points, radius)` | Round parts, pipes, cage tubes. |
| `roundedBox`, `box`, `cylinderX`, `cylinderZ` | Primitives. |
| `place(g, pos, rot, scale)`, `mirrorX(g)`, `symmetric(g)`, `merge(geos)`, `smoothPolyline` | Transform, mirror to the right side, merge to cut draw calls. |

Exterior (`kit.ext`): `headlight({ pos, size, shape: 'round'|'rect'|'slim'|'popup', yaw, rake })`,
`taillight({ pos, size, shape, reverse, yaw })`, `sideMirror({ pos, side, color })`,
`exhaust({ pos, radius, count, spacing, style })`, `plate({ pos, text, rear })` (Taiwan-style plate),
`wing({ z, y, width, chord, height, style: 'ducktail'|'gt'|'swan'|'lip', angle })`,
`splitter({ z, y, width, depth })`, `grille({ pos, size, rake })`, `wheelWell({ x, z, y, radius, width })`,
`wipers({ y, z, width })`, `antenna({ pos })`. Lights are placed for the left side (`pos[0] > 0`); call
again with `-x` for the right.

Interior (`kit.interior`): `seat`, `steeringWheel`, `dashboard`, `cluster`, `headUnit`, `shifter({ type: 'h'|'seq' })`,
`pedals`, `rollCage`, `rearViewMirror`, and the detailed parts used by the hero cars:

| Function | Use |
|---|---|
| `cluster({ pos, size, tilt, type, redline, maxRpm, maxSpeed, px, glow, glass, hood })` | Live gauges. `type`: `analog2`, `digital`, `analog3` (80s: fuel/temp stack, tach, speedo), `rally` (white dials, boost), `tft` (modern screen, accent colours). |
| `seat2({ pos, w, len, h, back, recline, bolster, backBolster, headrest: 'separate'\|'integrated'\|'none', harness, insert, side, trim })` | Lofted seat with stitched insert and bolsters. A wide one is a rear bench. |
| `wheel2({ pos, radius, tilt, style: '80s3'\|'sport3'\|'flat', grip, spoke, pad, accent, emblem, paddle, column })` | Steering wheel with a swept rim, spokes, horn pad, stalks; registers for steering. |
| `vent({ pos, size, round, rot, slats, bezel })`, `knob({ pos, r, len, rot, mat })` | Air vents and rotary knobs. |
| `shifter2({ pos, type: 'h'\|'seq'\|'short', knob: 'ball'\|'tall'\|'box', gears, lean, boot, knobMat })` | Gear lever with gaiter and an engraved shift pattern. |
| `handbrake({ pos, hydro })`, `pedals2({ pos, sport, clutch })` | Lever or hydraulic handbrake; pedal box (aluminium pads when `sport`). |
| `mat(textureKey, { color, roughness, repeat, normalScale })`, `leather(color, roughness)` | Shared textured trim materials: `grain`, `cloth80s`, `carpet`, `headliner`, `alcantara`, `perforated`, `quilted`, `speaker`. |

All take positions in vehicle space.

Presets (`kit.presets`, whole assemblies from a few numbers, good for prototypes):
`cabin({ zA, zRF, zRR, zC, yBelt, yRoof, hwBelt, hwRoof, tint })` greenhouse,
`interior({ driverX, floorY, seatY, seatZ, dashZ, dashY, halfWidth, cluster, headUnit, wheel, seats, cage, roofY })`
returns `{ group, eye }`, `trimBand({ z0, z1, y, halfWidth, height })` bumpers and strips.

## Body toolkit (`kit.body`)

How the hero cars are built (`src/vehicles/kit/body.js`). The idea: one smooth closed **surface** lofted
through a dozen or two cross-sections, then **cut** into real panels. Because every panel, glass pane and lamp
lens comes out of the same surface, they sit flush by construction; the cuts leave shut lines, and rolled
edges make the panels look pressed rather than sliced.

```js
const B = kit.body, sd = B.sd;
// 1. stations: rounded half-sections from the bottom centreline round to the top centreline (x >= 0),
//    the same corner count everywhere: [x, y, cornerSize]
const S = B.loft([{ z: -2.0, pts: [[0, 0.3, 0.05], [0.7, 0.3, 0.03], ...] }, ...], {
  fillet: [2, 3, 4, 4, 4, 6, 6], seg: [5, 1, 10, 8, 10, 11], rows: 190, displace: [flareFn],
  lod: ctx.interior ? 1 : 0.7,                         // lighter AI / distant cars
});
// 2. regions are signed functions (metres, <= 0 inside), usually from the surface's own corner traces
const onTop = (x, y, z) => Math.abs(x) - S.corner(5, z)[0];
let body = B.hole(S.patch, archFn);                     // wheel arches
let [ws, rest] = B.cut(body, windscreenFn, { gap: 0.007 });
let [hood, rest2] = B.cut(rest, hoodFn);               // default 4 mm shut line
// 3. finish: rolled edges, one mesh per material
g.add(B.assemble({ paint: { patches: [hood, rest2], roll: { r: 0.0018, depth: 0.005 } } }, { paint: kit.paint }));
g.add(B.glass([B.offset(ws, -0.003)], { tint: 0x16201f }));
```

| Function | Use |
|---|---|
| `loft(stations, opts)` | Closed surface `S`. `S.patch` (the mesh), `S.corner(k, z)` (corner k's [x, y] at z), `S.sideAt(z, y)`, `S.topAt(z, x)`, `S.sidePoint(z, y)` / `S.topPoint(z, x)` (point + normal). Corner coordinates are interpolated with a monotone cubic (no overshoot). `displace: [(x, y, z) => [dx, dy]]` adds flares, bulges, scallops. `capFront` / `capRear: { dome, rings, yc }`. |
| `cut(p, f, { gap, r })` / `split(p, f, half)` / `hole(p, f)` / `keep(p, f)` / `clip(p, f)` | Exact, crack-free cuts along `f = 0`. `f(x, y, z, u, v)` also gets the uv, so swept parts (bumpers) can be cut by path length. Pieces share one vertex pool. |
| `roll(p, { r, depth, only, splitWall })` | Rolled edge + return wall along open edges (`only(x, y, z)` filters; `splitWall` returns the wall separately, for dark insides of openings). `depth` can be a function. |
| `bead(p, profile)` | Seal / trim strip along open edges (window rubbers). |
| `sweep(path, profile, { closed, profileClosed, capStart, capEnd, sub, up, upFn, flip })` | Profile along a path: bumpers, wipers, gutters, rails, belts. `profile` may be `(s) => points` to taper. |
| `offset`, `flip`, `warp`, `mirror`, `projectUV`, `boxUV`, `skirt`, `capLoops`, `merge` | Move along normals, invert, deform, mirror to the right side, metric uvs, lamp housings, caps. |
| `assemble({ key: patches \| { patches, roll } }, { key: material })`, `mesh(patches, material)`, `from(geometry)` | Patches to meshes (merge everything that shares a material). |
| `glass(patches, { tint, outer, inner })` | Two-sided window: reflective tint outside, nearly clear from the cockpit. |
| `emitter(kind, color, base)` | Light material registered with the runtime: `head`, `brake`, `reverse`, `indicator`, `fog`, `drl`. |
| `mat.*` | Shared car materials: `blackPlastic` (grained), `satinBlack`, `glossBlack`, `rubber`, `chrome`, `brightMetal`, `darkMetal`, `cavity`, `underbody`, `reflector`, `frit`, `wellLiner`, lenses `lensClear/Red/Amber/Smoke(optic, repeat)` with `lensOptic` / `lensRibs` / `lensFlutes` normal maps. |
| `decal(patch, f, { axis, a0, b0, w, h, flipU, material })`, `textCanvas(text, opts)`, `decalMat(canvas, { key })` | Lettering and badges lying on the surface. Give shared ones a `key`. |
| `doorMirror({ base, size, side, out, up, indicator, capMat })`, `wheelWell(S, { z, y, r, xi })`, `planPath(...)`, `project(patch, axis, a, b)` | Modern mirrors, arch liners clipped to the body, U-shaped plan paths for bumpers, ray-cast a point onto a lens to seat lamp internals. |
| `trimShell(S, o)`, `floorPan(S, o)`, `dashSweep(half, prof)` | Cabin: door cards / pillar trims / headliner as the body surface pushed inwards (always fits), a carpeted floor pan, a dashboard swept across the car. |

Rules of thumb that the hero cars follow:
- Keep openings dark: cut wheel arches, grilles and vents with `roll(..., { splitWall: true })` and give the
  wall `mat.blackPlastic()`; glass edges roll into rubber (`glassWall`), not paint.
- Cut lamps from the surface before the panels so panel shut lines end at the lamp edges; seat projectors and
  LED strips with `B.project` on the lens.
- Everything that is not visible from outside (cabin, seals, floor details) should check `ctx.interior`.
- Canvas textures (badges, gauges, charms) go through `M.shared(key, ...)` or `decalMat({ key })` so rebuilds in
  the paint shop do not leak GPU textures.

## Visual customisation

```js
visual: {
  paint: { color: '#e9e6dc', finish: 'gloss' },        // gloss metallic pearl satin matte candy chrome
  paints: ['#e9e6dc', '#c2312a'],                     // factory colours shown first in the paint shop
  slots: {                                            // cosmetic options; the build reads visual.mods[slot]
    rims: { name: 'Rims', zh: '輪框', options: [{ id: 'spoke5', name: '5-spoke', price: 0 }, ...] },
    spoiler: { name: 'Spoiler', zh: '尾翼', options: [{ id: 'none', name: 'None', price: 0 }, ...] },
  },
},
```

`rims` is special: its option ids are rim styles (`spoke5 mesh multi dish turbofan steelie split6 rays6 eight
twin5 y5 aero`, see `src/vehicles/kit/wheels.js` `RIM_STYLES`) and the runtime builds them. Any other slot is
yours to interpret in `build()`. The first option of each slot is the default. The hero cars read `tint`
(side and rear glass only; the windscreen stays clear), `spoiler` / `wing`, `livery` (Kaze two-tone),
`mudflaps` / `vortex` (RS-4) and `roof` / `mirrors` (Typhoon).

## Budgets

| | Hero car (player, interior) | Without interior (AI) |
|---|---|---|
| Triangles at `detail` 1 | 150k to 450k | under 120k |
| Meshes | under 600 (merge static parts) | under 200 |

Share materials (`kit.mat.*` already does), merge geometry that shares a material, and scale tessellation
with `kit.seg()`. The validator reports both numbers, warns past the budgets and fails on broken geometry
(NaN positions or zero normals, which render black and can poison the HDR post chain).

## Definition of done for a detailed car

- Exterior: separate panels with shut lines, real lamp units (housing + lens + emitter), grilles with depth,
  mirrors, wipers, plates, exhaust, badges as geometry or canvas decals, underbody that does not show holes.
- Interior: dashboard with real shape, head unit (16:9), gauge cluster, steering wheel with spokes, seats with
  bolsters, door cards, centre console with shifter, pedals, rear-view mirror, headliner, pillars trim.
- Parts visible: rear wing / splitter from aero parts, roll cage, wider tyres, ride height from the tune.
- `npm run validate -- --only <id> --strict` passes. Screenshot exterior (garage) and cockpit (in game,
  camera key `C`) look right at Low and Ultra.
- Remove `placeholder: true`.
