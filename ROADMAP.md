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

## Phase 1: Three hero cars

Replace the placeholder models (keep or refine the specs). Each must meet the "definition of done" in
`vehicles/AGENTS.md` (detailed exterior, full interior, visible parts, strict validation).

| Car | Role | Notes |
|---|---|---|
| Hoshino Kaze 86 (1986) | D class RWD starter, the drift teacher | Light hatch, pop-up or slim lamps, analogue cluster. |
| Tenmaru RS-4 Type R (2006) | C class turbo flat-four AWD saloon | Mountain and rain hero, big wing, rally-flavoured interior. |
| Yushan Typhoon GT (2019) | B class 5.0 V8 front-engine GT, Taiwan's fictional supercar maker | Expressway top speed, sideways power, modern digital cockpit. |

## Phase 2: Maps

Each map: real-feeling Taiwanese places (no trademarks), at least five events, strict validation, and a
look checked at Low and Ultra. See `maps/AGENTS.md`.

**Formosa (done)** puts the three planned maps (countryside, mountain, downtown Taipei) into one connected
world, northern Taiwan compressed into 5 x 5 km:

- Taipei basin: seven by six avenues of tiled shophouses with qilou arcades, vertical signs and rooftop
  sheds, the Dunhua roundabout night circuit, the Civic Elevated on pillars, the Xinyi supertall and mall,
  the Longshan temple precinct, Da'an park, the university palm boulevard, the night market under the
  elevated, riverside car park, scooters on every sidewalk, signals, bus stops.
- Yangmingshan: the 3.7 km touge with a stacked hairpin wall, the Seven Star loop round the plateau,
  silvergrass, cedar, the sulphur vents, the summit pavilion, the Grand Hotel above the city.
- North coast: Tamsui and the Guandu red arch bridge, four lit tunnels, Yehliu's hoodoos, the Shimen wind
  farm, the fishing harbour (quay, breakwaters with tetrapods, squid boats, fish market, Mazu temple),
  lighthouses with sweeping beams, the Wanli cliff ledge.
- Jiufen: four hairpins up from the harbour to the lantern street, the teahouse, the Wuzhi ridge road to
  the summit loop.
- Paddy valley: 2800 fields from flooded to golden, farmhouses, betel palms, Dongshan creek with fords,
  the Wujie village temple, a gravel rally loop with a canal jump.

Further maps (the east coast cliffs of Highway 11, the central mountains, the south) can reuse the
Formosa builders in `maps/formosa/build/`.

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
- More cars (aim for 15 to 20 across classes), engine swap sounds per engine.

## Known limits (honest)

- WebGL has no hardware ray tracing; Ultra++ uses screen-space reflections and AO (off-screen objects do not
  reflect). WebGPU could change that later.
- AI follows the event route with a per-driver offset and a physics-based speed profile; it does not compute
  an optimal racing line. Routes must be drawn on a sensible line.
- Headless verification uses software rendering (1 to 6 fps), so tests check correctness, not performance.
  Measure performance in a real browser with the FPS counter (Settings > Display).
