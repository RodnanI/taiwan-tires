# Gameplay: sessions, modes, AI

| File | Contents |
|---|---|
| `Session.js` | One drive: loads the map, spawns the player and AI, owns the scene, runs input -> controls -> physics -> mode each fixed step, cameras / particles / audio / HUD each frame, rewind history, resets, results. |
| `modes.js` | `FreeRoamMode`, `RaceMode` (circuit, sprint, touge), `DriftMode`, `TimeAttackMode` and the `MODES` table (event `type` -> class). |
| `RaceTracker.js` | Progress of one car along a route: laps, ordered checkpoints (anti-shortcut), wrong way, off track, grid slots behind the line count as negative progress. |
| `DriftScorer.js` | Drift points: angle x speed, chain multiplier, wall proximity bonus, banking after a grace period, fail on spin or crash. |
| `../ai/AIDriver.js` | AI driver: racing line + speed profile from its own car's physics, pure-pursuit steering, braking points, overtaking bias, avoidance. |
| `../ai/opponents.js` | Picks AI cars from the registry and upgrades them towards the player's PI. |

## Session lifecycle

`game.startSession({ mapId, eventId?, time?, weather?, aiCount?, difficulty? })` -> `Session.load()`
(map, environment, player, grid, AI, mode) -> `state = 'driving'` -> `fixedUpdate` / `frame` until the mode
finishes -> `session:finished` -> results screen. `game.endSession()` disposes everything.

Per fixed step (`Session.fixedUpdate`): read input (with counter-steer assist), latch shifts, run AI
controls, step every car's physics, collisions between cars, mode `fixedUpdate`, rewind history (10 Hz,
15 s), safety resets (upside down, under water, below `world.killY`).

## Modes

```js
class MyMode extends Mode {
  start() { /* place things, set this.state = 'countdown' for a standing start */ }
  fixedUpdate(dt) { /* rules at physics rate */ }
  update(dt) { /* per-frame visuals */ }
  hud() { return { race: true, position, of, lap, laps, time, lapTime, bestLap, drift, prompt }; }
  snapshot() { return {...}; }   restore(o) {...}      // rewind support
  dispose() {}
}
```

Register in `MODES` (`modes.js`) and add the type to `EVENT_TYPES` in `src/maps/MapDef.js` (name, zh,
default AI count, laps). The HUD only reads `hud()`, so new modes get a HUD by returning the same fields.

Countdowns: while `state === 'countdown'` the Session sets `controls.hold` (brakes on, clutch in) for every
car. Never hold cars with the brake pedal: holding brake at a standstill means "reverse" to the auto gearbox.

## AI

- Same physics and grip as the player. Difficulty (`gameplay.difficulty`: rookie 0.8, amateur 0.87, pro
  0.925, expert 0.965, legend 1.0) is the fraction of the car's real limit the AI drives at.
- Rubber banding (`gameplay.rubberBand`) nudges skill by at most 2.5 or 5 percent depending on the gap.
- Opponents are chosen and upgraded to roughly the player's PI (`opponents.js`), then the event class limit.
- AI uses the event route as its racing line (with a lateral bias per driver). Maps need clean routes:
  check them with the racing-line overlay (Settings > Display > Racing line).

## Drift scoring

Sliding = angle between 11 and 115 degrees above 6 m/s with forward motion. Points per second grow with
angle and speed, the multiplier grows with chain time, walls within 3.2 m add a proximity bonus. The chain
banks 1.6 s after the slide ends; spinning past 125 degrees or a hard impact loses it. Drift events only
score inside their zone (`route` with a width).
