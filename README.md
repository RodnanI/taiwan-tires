# Taiwan Tires 台灣輪胎

An open-world racing and drifting game set in Taiwan, in one HTML file. Night harbours, expressways on
pillars, shophouse streets with Traditional Chinese signs, a procedural engine note for every car, deep
tuning with an AI tuner, and menus that live on the car's own infotainment screen.

**Play:** open `dist/taiwan-tires.html` in a desktop browser with WebGL2 (Chrome, Edge, Firefox, Safari 16+).
No install, no server, no downloads: everything (cars, maps, textures, sounds, music) is generated in code.
Progress saves in the browser.

> Status: **foundation phase.** Every system works; the three cars and the map are placeholders (simple
> prototype models and a compact test map). Detailed cars with full interiors and the three real maps
> (countryside, mountains, downtown Taipei) are the next phases. See [ROADMAP.md](ROADMAP.md).

## What is in

- **Driving model**: 240 Hz rigid-body physics with raycast suspension, anti-roll bars, a combined-slip tyre
  model with load sensitivity, eight tyre compounds (street, sport, semi-slick, slick, drift, rally,
  off-road, drag), clutch, LSD / locked / viscous diffs, AWD split, turbo and supercharger boost, nitrous,
  aero downforce, twelve ground surfaces. Assists from full to none (ABS, TCS, stability, auto clutch).
- **Modes**: free roam with drift scoring, circuit and sprint races against up to 7 AI drivers, touge
  duels, drift zones, time attack against your ghost. Rewind, resets, rubber banding options.
- **Tuning**: 32 upgrade slots (engine internals, turbos, superchargers, engine swaps, drivetrain swaps
  RWD / AWD / FWD, tyre compounds and widths, aero, weight reduction, roll cage, steering angle kits) and up
  to 36 tune sliders unlocked by parts (pressures, final drive and every gear, camber, toe, caster, springs,
  bump and rebound damping, ride height, anti-roll bars, aero, brake bias and pressure, diffs, AWD split,
  steering lock, boost). A performance index (PI) puts every build in a class: D C B A S1 S2 X.
- **AI tune**: pick a goal (best in class, grip, drift, top speed, acceleration, touge, city streets, or the
  fastest lap on a specific route), a class limit, a budget and rules (drivetrain, tyres, swaps, aero); it
  evaluates around a thousand builds with the same tyre and drivetrain model the physics uses.
- **Speed feel**: velocity-led chase camera, FOV kick, speed-sensitive shake, road-surface rumble, camera
  motion blur, speed streaks, wind and tyre audio, gamepad rumble.
- **Menus as an infotainment system**: the UI is mapped onto the head unit screen of the car you sit in,
  with keyboard, mouse and gamepad navigation, bilingual (English / 繁體中文).
- **Graphics presets from Potato to Ultra++**, every option individually adjustable, FPS counter
  (off, FPS, FPS + frame time, full stats with frame graph), frame rate limit (VSync, 30 to 360, or unlimited),
  render scale.

### About Ultra++

Ultra++ is the most expensive path the renderer has: 1.35x supersampling, MSAA 8x + SMAA, 8K shadow maps,
full-resolution GTAO and screen-space reflections, per-frame 512 px reflection probes, depth of field, god
rays and motion blur. It is not hardware ray tracing (browsers do not expose it), so reflections are limited
to what is on screen. It needs a strong GPU.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Throttle / brake (and reverse) | W / S or arrows | RT / LT |
| Steer | A / D or arrows | Left stick |
| Handbrake | Space | A |
| Shift up / down (manual) | E / Q | B / X |
| Clutch | Left Shift | LB |
| Nitrous | F | RB |
| Camera / look back | C / B | View / R3 |
| Reset to road / rewind (hold) | R / Backspace | D-pad up / Y |
| Lights / horn / radio | L / H / M | D-pad down / L3 / D-pad left |
| Pause | Esc or P | Menu |

Menus: arrows or WASD to move, Enter / Space to select, Esc to go back, Q / E (LB / RB) to switch tabs.
Everything is rebindable in Settings > Controls.

## Development

```bash
npm install
npm run build        # dist/taiwan-tires.html
npm run dev          # watch + serve on http://localhost:8080
npm run validate     # build and check every car and map headless
npm test             # engine sanity checks
```

The project is written to be extended by AI agents: start at [AGENTS.md](AGENTS.md); every content folder
has its own guide ([vehicles/AGENTS.md](vehicles/AGENTS.md), [maps/AGENTS.md](maps/AGENTS.md)) and a working
template. Plain JavaScript and three.js, no framework.
