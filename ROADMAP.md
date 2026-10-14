# Roadmap

## Phase 0: Foundation (done)

Engine, menus and every gameplay system, proven with placeholder content.

- Build to a single standalone HTML file; content auto-discovered from `vehicles/` and `maps/`.
- Fixed-step vehicle physics (tyres, suspension, drivetrain, diffs, boost, nitrous, aero, assists,
  collisions, rewind), eight tyre compounds, twelve surfaces.
- Map kit: terrain, spline roads (markings, kerbs, walls, lights, bridges, junctions), Taiwanese buildings
  and streets, instanced props, sign atlases in Traditional Chinese, batching, virtual lights, water.
- Vehicle kit: body shells, lofts, lamps, mirrors, plates, wings, wheels (7 rim styles), complete interiors
  with live gauges, steering wheel and head unit.
- Rendering: presets Potato to Ultra++, HDR post chain (GTAO, wet SSR, god rays, motion blur, DOF, bloom,
  grading, SMAA/FXAA/MSAA), time of day, rain and wet roads, particles, skid marks, racing line.
- Modes: free roam drifting, circuit, sprint, touge, drift zone, time attack with ghost; AI drivers on the
  same physics; opponent selection by PI; difficulty and rubber banding.
- Tuning: 32 part slots incl. engine and drivetrain swaps, 36 tune sliders, PI and classes, AI tune with 8
  goals and constraints.
- Infotainment menu UI projection-mapped into the car, HUD, settings (graphics, display, FPS counter and
  cap, audio, controls with rebinding, assists, gameplay), profile and garage, dealer, paint shop.
- Procedural audio: engines per layout, turbo / supercharger / BOV / pops, tyres, wind, impacts, horn,
  three radio stations.
- Agent docs per folder, templates, `validate` and `test` tools, headless screenshot tool.

## Phase 1: Three hero cars (done)

Detailed models replace the placeholders (specs unchanged). Each meets the "definition of done" in
`vehicles/AGENTS.md`: panels with shut lines and rolled edges, lamp units with lenses and emitters, grilles
with depth, badges, underbody, full interiors with live clusters and a head unit, visible parts and strict
validation. They are built with the new body toolkit (`kit.body`: lofted surfaces cut into panels), lofted
seats, swept steering wheels, new cluster styles and a wheel kit with sidewall lettering and real brakes.

| Car | Role | Notes |
|---|---|---|
| Hoshino Kaze 86 (1986) | D class RWD starter, the drift teacher | Wedge hatch, animated pop-up lamps, wraparound bumpers, two-tone option; 80s cabin with tweed seats, binnacle, double-DIN, 平安 charm. |
| Tenmaru RS-4 Type R (2006) | C class turbo flat-four AWD saloon | Box flares, scoop, intercooler mouth, fog lamps, tall wing, vortex fins, mud flaps; rally cluster, alcantara buckets, boost pod. |
| Yushan Typhoon GT (2019) | B class 5.0 V8 front-engine GT, Taiwan's fictional supercar maker | Long hood with louvred vents, haunches, gills, LED light bar, ducktail, quad exhaust, carbon aero; TFT, floating screen, quilted cognac seats. |

Possible follow-ups: per-car LODs for very distant cars, opening doors and boot in the garage, working wipers
in rain (the `animate` hook exists), interior night lighting on the switchgear.

## Phase 2: Three maps

Each map: real-feeling Taiwanese places (no trademarks), at least five events, strict validation, and a
look checked at Low and Ultra. See `maps/AGENTS.md`.

| Map | Inspiration | Must have |
|---|---|---|
| Countryside | East Rift Valley and Provincial Highway 11 (Hualien / Taitung): rice paddies, betel palms, coastal cliffs, small towns, temples | Fast sweepers, a coastal sprint, gravel farm roads (rally tyres), a village drift zone. |
| Mountain | Central mountain passes (Hehuanshan / Yangmingshan style): hairpins, cedar forest, fog, tea terraces | Touge battles uphill and downhill, tunnels, guardrails, night and fog weather, viewpoint car park. |
| Downtown Taipei | Xinyi and Ximending at night: tower, neon, qilou arcades, elevated expressways, riverside roads | Circuit through the grid, expressway sprint on pillars, car park drift, time attack, dense signage. |

## Phase 3: A living world

- Traffic (cars, buses, swarms of scooters) with lanes from the road data. The `gameplay.traffic` setting was
  removed until this exists.
- Free-roam activities: speed traps, drift zones on public roads, danger signs (jumps), discoverable cars.
- Police chases (Need for Speed style) as an optional mode.

## Phase 4: Progression and polish

- Career / festival structure with reputation, unlockable events and car rewards.
- Photo mode (DOF is already in the post chain), replays from recorded inputs (physics is deterministic
  with snapshots), local leaderboards and ghost sharing as files.
- Second paint colour and livery decals in the paint shop (`kit.paint2` exists in the vehicle kit).
- More cars (aim for 15 to 20 across classes) on the body toolkit, engine swap sounds per engine.

## Known limits (honest)

- WebGL has no hardware ray tracing; Ultra++ uses screen-space reflections and AO (off-screen objects do not
  reflect). WebGPU could change that later.
- AI follows the event route with a per-driver offset and a physics-based speed profile; it does not compute
  an optimal racing line. Routes must be drawn on a sensible line.
- Headless verification uses software rendering (1 to 6 fps), so tests check correctness, not performance.
  Measure performance in a real browser with the FPS counter (Settings > Display).
