# Taiwan Tires: agent guide

Open-world racing and drifting game set in Taiwan. Plain JavaScript (ES modules) + three.js, bundled into
**one standalone HTML file** (`dist/taiwan-tires.html`). No framework, no image or audio files: every texture,
sign, sound and radio song is generated in code.

Read this file first, then only the `AGENTS.md` of the folder you are working in. Each one is written so you
do not need to read the source around it.

## Where to go

| Task | Read | Work in |
|---|---|---|
| Build or replace a car (model, interior, specs) | `vehicles/AGENTS.md` | `vehicles/<id>/vehicle.js` |
| Build or replace a map (roads, terrain, city, events) | `maps/AGENTS.md` | `maps/<id>/map.js` |
| Engine architecture, adding settings / screens / modes / parts | `src/AGENTS.md` | `src/` |
| Physics (tyres, suspension, drivetrain, collisions) | `src/physics/AGENTS.md` | `src/physics/` |
| Graphics presets, post FX, materials, lighting | `src/render/AGENTS.md` | `src/render/` |
| Menus (infotainment head unit), HUD | `src/ui/AGENTS.md` | `src/ui/` |
| Race / drift / time attack rules, AI drivers | `src/gameplay/AGENTS.md` | `src/gameplay/`, `src/ai/` |
| Parts, tune sliders, PI classes, AI tune | `src/tuning/AGENTS.md` | `src/tuning/` |
| Engine sound, sfx, radio | `src/audio/AGENTS.md` | `src/audio/` |
| Build, validate, test, screenshot tools | `tools/AGENTS.md` | `tools/` |
| What is done and what is next | `ROADMAP.md` | |

## Commands

```bash
npm install                 # once (three + esbuild only)
npm run build               # -> dist/taiwan-tires.html (open it directly, file:// works)
npm run dev                 # rebuild on change + serve http://localhost:8080
npm run validate            # build every car and map headless, check them (run after content changes)
npm test                    # physics / tuning / gameplay sanity checks (~6 s)
node tools/shot.mjs         # headless Chromium screenshots of menu + driving into tmp/shots/
```

Definition of done for any change: `npm run validate` and `npm test` pass, `npm run build` succeeds, and for
visual work you looked at a `tools/shot.mjs` screenshot. Commit `dist/taiwan-tires.html` with the source (the
file is the product).

## Ground rules

- **Units**: SI everywhere (metres, kg, seconds, Newtons, radians in code). Degrees only in authoring files
  where noted (`steering.lock`, `camber`, map `heading`). Money is NT$ (`credits`).
- **Axes**: world +X east, -Z north, +Y up. Vehicle-local +Z forward, +Y up, **+X is the car's left**.
  Taiwan drives on the right, so cars are left-hand drive: the driver sits at **+X**.
- **Content is data + a build function**. Vehicles and maps are auto-discovered from their folders by the
  build (`tools/content.mjs`). Folders starting with `_` are templates and are skipped.
- **No asset files.** Need a texture? Add a generator to `src/render/textures.js`. Need a sound? Synthesize
  it in `src/audio/`. The single-file constraint is a product requirement.
- **Systems talk through the event bus** (`game.events`, names listed in `src/AGENTS.md`), not by importing
  each other. Pure modules (`src/core/math.js`, `src/physics/*`, `src/tuning/*`, `VehicleSpec.js`,
  `MapDef.js`) must stay importable in Node (no DOM): the validator and tests run them headless.
- **Settings UI is generated from `src/core/Settings.js` SCHEMA.** Never hand-write a settings control.
- **Every interactive UI element has `data-focus`** so keyboard and gamepad navigation reach it.
- **Text in the game is bilingual**: English + Traditional Chinese (`zh`). Use Traditional, never Simplified.
- No trademarks: car makes are fictional (Hoshino, Tenmaru, Yushan...). Real places are fine.
- Style: match the file you are in. Comments explain why, not what. No em dashes in docs or UI text.

## Repository map

```
src/            engine (see src/AGENTS.md)
vehicles/       one folder per car: vehicle.js (specs + model builder)       -> vehicles/AGENTS.md
maps/           one folder per map: map.js (roads, terrain, events, build)   -> maps/AGENTS.md
tools/          build.mjs, content.mjs, validate.mjs, test.mjs, shot.mjs     -> tools/AGENTS.md
dist/           taiwan-tires.html, the shipped game (committed)
tmp/            screenshots and scratch output (git-ignored)
```

## Current state (phase 1 done)

All engine systems are in place and working. The three hero cars are finished, detailed models with full
interiors, built with the body toolkit (`kit.body`, see `vehicles/AGENTS.md`). The one map is still a
**placeholder** (`placeholder: true`): a compact test map (Kaohsiung Harbor) that exercises every system. The
remaining work is content: the three real maps (countryside, mountain, downtown Taipei), then more cars. See
`ROADMAP.md`.
