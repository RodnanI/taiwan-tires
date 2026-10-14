# Tuning: parts, tune sliders, performance index, AI tune

Pure, Node-safe modules. Data flow:

```
def.specs --(installed parts, in APPLY_ORDER)--> working spec --(tune sliders)--> working spec
          --> specToParams() --> VehiclePhysics            (src/vehicles/VehicleSpec.js)
          --> analyze() --> metrics + PI + class            (Performance.js, ~1 ms)
```

A car in the profile is `{ uid, vehicleId, parts: { slotId: levelId }, tune: { key: value } | null, visual, owned, ownedVisual }`.
Missing part = `stock`, missing tune key = the spec default after parts.

| File | Contents |
|---|---|
| `Parts.js` | `PART_CATEGORIES`, `PART_SLOTS` (each slot has levels with `price` and `apply(spec)`), `APPLY_ORDER`, `partAllowed(def, slot, level)` (per-car `upgrades.exclude`, no swap to the same drivetrain). |
| `engines.js` | Engine swap catalogue (generic engines, no trademarks): torque curves, boost, mass, sound layout. |
| `Tune.js` | `TUNE_DEFS`, 36 sliders (`pressureF/R final gear1..8 camberF/R toeF/R caster arbF/R springF/R rideF/R bumpF/R reboundF/R aeroF/R brakeBias brakePressure diffAccel diffDecel diffFAccel awdSplit steerLock boost`), each `{ key, group, label, fmt, step, min(base, parts), max(base, parts), get(spec), set(spec, v), requires(parts) }`. |
| `Performance.js` | Analytic model: top speed, 0-60/100/200, quarter mile, braking 100-0, lateral g at 100 and 200 km/h, balance, drift score; PI 100-999 and classes D C B A S1 S2 X; `lapTime(route, metrics, spec)` estimator. |
| `AITune.js` | `AITuner`: genetic search over parts + tune, then hill-climb, under constraints. |

## Parts

```js
lv('sport', 'Sport cams', 36000, (s) => { mulTorque(s, 1.03); shiftBand(s, 1.04); s.sound.lope = 0.4; }, { desc: '...' })
```

`apply(s)` mutates the working spec in SI units (see `vehicles/AGENTS.md` for field meanings). Slots can
declare `requires: (parts, spec) => bool` (intercooler needs boost) and `order` (swaps apply first). Keep
effects physical: change torque, mass, grip, ratios, not abstract stats. The upgrade shop, PI, the AI tune
and opponent upgrading all pick up new levels automatically. `npm test -- performance` builds every level on
every car and fails on NaN.

Classes (PI ranges): D 100-500, C 501-600, B 601-700, A 701-800, S1 801-900, S2 901-998, X 999.
PI blends speed, acceleration, handling, braking and launch bars (`Performance.js`, bottom of `analyze`).
If you change the model, re-check that stock cars land where the roster expects (validator prints PI).

## AI tune

Goals (`GOALS`): `balanced` (best PI in class), `grip`, `drift`, `topspeed`, `accel`, `touge`, `street`,
`track` (minimise estimated lap time on a chosen event route; the route comes from the map definition via
`game.routeCache` without loading the map). Constraints: class cap, budget (parts already owned are free),
drivetrain (`keep`, `any`, `RWD`, `AWD`, `FWD`), tyres (`any`, street legal, drift only), engine swaps on/off,
aero on/off.

The tuner is a generator: `for (const step of tuner.run())` yields `{ progress, best, evals }` so the UI
can spread work over frames; the final value is `{ parts, tune, metrics, before, cost, lap, lapBefore,
notes, evals, goal }`. Fitness per goal is in `AITuner.fitness()`; a cost penalty stops it buying parts that
do nothing for the goal. `npm test -- "AI tune"` checks budget and class caps.
