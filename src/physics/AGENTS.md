# Physics

Pure JavaScript, Node-safe (tests and the validator run it headless). One `VehiclePhysics` per car, stepped
at a fixed rate (`gameplay.physicsHz`, default 240 Hz) by the Session. About 5 to 9 microseconds per car
per step on a desktop CPU.

| File | Contents |
|---|---|
| `VehiclePhysics.js` | Rigid body (6 DOF), raycast suspension, wheels, engine, clutch, gearbox, diffs, assists, aero, collisions, snapshot/restore. |
| `Tire.js` | Tyre compounds and the combined-slip force model. |
| `World.js` | Collision world: triangle soup + heightfields (drivable), boxes/cylinders/walls (solid), broadphase grid, ray casts. |
| `Surfaces.js` | Surface types (grip, rolling resistance, roughness, dust, sound). |

## Conventions

Body frame: +Z forward, +Y up, +X left. `steer > 0` turns **left** (the input layer flips the sign for the
player). Slip ratio `kappa = (omega * R - vx) / max(|vx|, 1)`. Forces in Newtons, torques in Nm.

## Model in one page

- **Suspension**: one ray per wheel from the mount point (wheel centre at full bump) downwards; spring +
  bump/rebound dampers + bump stop + anti-roll bars between the wheels of an axle. Roll centre height moves
  where lateral forces act (jacking).
- **Tyres**: normalized combined slip (`s = hypot(kappa / peakSlip, tanAlpha / tanPeak)`), force rises as a
  sine to the peak then falls (gaussian) towards the sliding friction `slide * mu`. Load sensitivity
  `mu ~ (Fz / Fz0)^-0.16`. Compound, pressure and width scale `mu` and the peak positions; surfaces scale
  `mu` per compound affinity (`paved | loose | grass`); wetness lowers it.
- **Wheel spin**: implicit (linearized) per-wheel solve of drive torque, brake torque and tyre force, with a
  body-acceleration predictor so a driven wheel does not fight the chassis. Stable at 120 Hz and up.
- **Driveline**: engine torque curve x throttle (+ boost, nitrous) -> clutch (impulse-based lock / slip) ->
  gearbox (shift time = torque cut) -> differentials (`open`, `lsd` accel/decel/preload, `locked`,
  `viscous`), AWD centre diff with split.
- **Gearbox automation**: auto shift (thrust-optimal upshift at full throttle, early short-shift at part
  throttle, kickdown), auto clutch with launch slip limited by grip, auto reverse (hold brake at a
  standstill), rev matching, handbrake clutch (for drifting).
- **Assists**: ABS (per wheel), TCS (proportional throttle trim near peak slip), stability control (yaw
  brake). The counter-steer assist for keyboard and pads lives in `gameplay/Session.js` (it shapes the steer
  input, not the physics). Players pick levels in Settings > Assists.
- **Collisions**: body is an oriented box (2D SAT against statics and other cars, separate ground contact
  for the 8 corners). Impulses with friction and restitution per collider `kind`.
- **Aero**: drag `0.5 * rho * cd * A * v^2`, downforce per axle from CL front / rear.

## Interface

```js
const car = new VehiclePhysics(buildPhysicsParams(def, parts, tune), world);
car.reset(x, y, z, headingRad, speed);
car.controls = { throttle, brake, steer, handbrake, clutch, nitrous, hold };   // 0..1 (steer -1..1)
car.assists = { abs, tcs: 0|1|2, esc: 0|1|2, autoShift, autoClutch, revMatch, handbrakeClutch, autoReverse };
car.step(dt);
car.tel;   // speed, fwdSpeed, slipAngle, driftAngle, yawRate, latG, longG, rpm, gear, boost, onGround, wheelspin...
car.wheels[i];   // contact, Fz, fx, fy, slipRatio, slipAngle, omega, surface
car.snapshot() / car.restore(s);   // complete state: restore + same inputs = same motion (rewind)
car.setParams(params);             // live re-tune without resetting motion (tuning menu in a session)
```

`controls.hold` holds the car on the start line with full brakes **without** the brake pedal meaning
"reverse" (countdowns). `gripScale` (difficulty) and `powerScale` (rubber banding) exist for AI.

## World

```js
world.addTriangles(flatXYZ, indices, surface); world.addGeometry(bufferGeometry, surface);
world.addHeightfield({ x0, z0, cell, nx, nz, heights, surface }); world.addBox({ x, z, hx, hz, rotY, y0, y1, kind, bounce, friction });
world.addCylinder({ x, z, r, y0, y1 }); world.addWall(ax, az, bx, bz, opts); world.addWallPath(points, opts); world.finalize();
world.heightAt(x, z, yFrom); world.raycast(ox, oy, oz, dx, dy, dz, maxDist, out); world.segmentStatics(ax, az, bx, bz, y, pad)
```

## Known pitfalls (each one bit us once; `npm test` guards them)

- A driven front wheel dragged the car under acceleration until the wheel solve predicted body acceleration.
- Clamping longitudinal tyre force to the slip velocity of the wheel only, not the whole car, kills traction.
- Auto gearbox must decide from **ground-speed rpm**, or wheelspin flare makes it hunt gears.
- Brake held at a standstill selects reverse; anything that holds the car (countdown) must use `hold`.
- Snapshots must contain every integrator (suspension `x/xPrev`, clutch, shift timers, tel), or rewinds drift.
- CG height is body-relative; ride height offsets move the body, not the CG inside it.

## Testing

`npm test -- physics` (settle, 0-100, braking, launch straightness, cornering, drift, rewind, swaps).
For investigations write a scratch script that builds a flat `CollisionWorld` and steps a car (see
`tools/test.mjs` `flat()` / `car()` helpers).
