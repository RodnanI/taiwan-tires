# Engine (`src/`): architecture

Read the root `AGENTS.md` first. Each subfolder with its own `AGENTS.md` has the details; this file is the map
and the cross-cutting rules.

## Folders

| Folder | Owns | Guide |
|---|---|---|
| `core/` | `Game` (state machine, owns every system), `Loop` (fixed step + render cap), `Settings`, `Profile` (save), `Registry` (content), `Events`, `Stats` (FPS counter), `math`, `storage`, `canvas` | this file |
| `physics/` | Rigid-body vehicles, tyres, surfaces, collision world | `physics/AGENTS.md` |
| `vehicles/` | Vehicle spec normalization, runtime `Vehicle` (physics + model + lights), model kit | `../vehicles/AGENTS.md` |
| `maps/` | Map normalization, loader, `Route`, map kit (roads, terrain, buildings, props, signs, batching) | `../maps/AGENTS.md` |
| `render/` | Renderer, quality presets, post FX, environment (sky, weather), materials, textures, lights, particles, skid marks, racing line | `render/AGENTS.md` |
| `camera/` | Driving cameras (chase, hood, bumper, cockpit), speed FOV, shake | `render/AGENTS.md` |
| `input/` | Keyboard + gamepad actions, bindings, menu navigation | this file |
| `gameplay/` | `Session` (one drive), modes (free roam, race, drift, time attack), race tracking, drift scoring | `gameplay/AGENTS.md` |
| `ai/` | AI driver, opponent selection | `gameplay/AGENTS.md` |
| `tuning/` | Parts catalogue, tune sliders, performance model + PI, AI tune, engine swaps | `tuning/AGENTS.md` |
| `audio/` | Procedural engine sound, sfx, radio | `audio/AGENTS.md` |
| `ui/` | Infotainment head unit (menus), menu 3D scene, HUD, widgets, screens | `ui/AGENTS.md` |

## Runtime flow

```
main.js -> Registry(vehicles, maps from virtual:content) -> Game
Game.state: boot -> menu <-> loading -> driving <-> paused -> results -> menu
Loop: fixedUpdate(dt = 1 / gameplay.physicsHz) N times per frame, then frame(dt, alpha) once
  menu:    MenuScene.update + render (car on a rooftop, head unit mapped onto its screen)
  driving: Session.fixedUpdate (input -> controls -> physics -> modes) / Session.frame (visuals, camera, HUD, audio)
```

- `window.TT` is the `Game` instance (debugging, tools/shot.mjs). `TT.startSession({ mapId, eventId })`,
  `TT.session.player.physics.tel`, `TT.settings.applyPreset('ultra')`.
- Physics runs at a fixed rate (240 Hz default) and renders interpolate between steps. A frame never runs
  more than 0.1 s of simulation (slow machines get slow motion instead of a spiral of death).

## Event bus (`game.events`)

Synchronous. `events.on(name, fn)` returns an unsubscribe function; `events.emit(name, payload)`.

| Event | Payload | Emitted by |
|---|---|---|
| `game:state` | `'menu' \| 'loading' \| 'driving' \| 'paused' \| 'results'` | Game |
| `settings:changed` | `{ key, value }` | Settings |
| `profile:changed`, `profile:credits`, `profile:garage`, `profile:car` | varies | Profile |
| `session:mode` | mode instance | Session |
| `session:finished` | results `{ kind, position, score, bestLap, rewards... }` | Session |
| `race:go`, `race:lap` | `{ lap, time, best }` | modes |
| `drift:bank`, `drift:fail` | `{ owner, points, mult, label }` / `{ owner, points, reason }` | DriftScorer |
| `player:reset`, `rewind` | | Session |
| `hud:toast` | `{ text, small }` | anyone |
| `nav` | `{ action: up/down/left/right/confirm/back/tabPrev/tabNext/menu/alt/alt2, repeat }` | Input (menu mode) |
| `input:gamepad` | `{ connected, id }` | Input |

## Adding things

**A setting.** Add one entry to `SCHEMA` in `core/Settings.js`:
`{ key: 'display.myThing', cat: 'display', group: 'HUD', label: 'My thing', zh: '...', type: 'toggle'|'enum'|'range', default, options?, min?, max?, step?, fmt?: 'pct'|'deg'|'m'|'x', desc? }`.
The settings screen renders it, it is saved, and `settings:changed` fires. Read it with
`game.settings.get(key)`. Graphics keys are `gfx.<key>` and must also exist in every preset in
`render/Quality.js` (`npm test` checks).

**A menu screen.** See `ui/AGENTS.md` (file in `ui/screens/`, register in `ui/screens/index.js`).

**A game mode.** Class in `gameplay/modes.js` extending the base `Mode` (`start()`, `fixedUpdate(dt)`, `update(dt)`,
`hud()`, `snapshot()/restore()`, `dispose()`), then map an event `type` to it in `MODES`, and add the type to `EVENT_TYPES` in
`maps/MapDef.js`. See `gameplay/AGENTS.md`.

**A part.** Add a level to a slot (or a new slot) in `tuning/Parts.js`: `lv(id, name, price, (spec) => mutate)`.
Mutate the working spec only (SI units). The performance model, PI, upgrade shop and AI tune pick it up.
See `tuning/AGENTS.md`.

**A texture / material.** Generator in `render/textures.js` (`GENERATORS.<key>(size)` returning
`{ map, normalMap?, roughnessMap? }`), use via `M.textured(key)`. No image files.

**A prop.** `src/maps/kit/props.js` catalogue entry (instanced, gets a collider entry if it blocks cars).

## Rules that keep it working

- Pure modules stay Node-safe (no `window`/`document` at import time): `core/math`, `core/Events`,
  `physics/*`, `tuning/*`, `vehicles/VehicleSpec`, `maps/MapDef`, `maps/Route`, `maps/MapLoader`, kits.
  Use `core/canvas.js` `makeCanvas` instead of `document.createElement('canvas')`.
- No allocations in per-step physics code (reuse module-level temporaries like `_v`).
- Save formats are versioned (`tt.profile.v1`, `tt.settings.v1`). Changing a stored shape means bumping the
  version or migrating in the constructor. Never rename shipped vehicle, map, event or part ids.
- Everything the player can do with a mouse must also work with keyboard and gamepad.
- Dispose GPU resources you create (`geometry.dispose()`, render targets) when a session or screen ends.
