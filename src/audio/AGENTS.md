# Audio

Web Audio only, everything synthesized (no audio files). The context starts on the first user gesture.

| File | Contents |
|---|---|
| `AudioSystem.js` | Graph `master -> compressor -> out` with `engine`, `sfx`, `music`, `ui` buses (volumes from Settings > Audio). Per-car engine voices, ambience layers (wind, road, gravel, tyre squeal, scrape, rain), one-shots (pops, BOV, shift clunk, impacts, UI clicks), horn. |
| `EngineSound.js` | Procedural engine per car: one 720-degree cycle of exhaust pulses with the layout's firing pattern rendered into a looping buffer, played back at rpm / 1200, through fixed body resonances, an rpm/load lowpass and a drive waveshaper. Layers: induction, turbo whistle and spool, supercharger whine, gear whine, BOV, overrun pops. Interior vs exterior mix in the cockpit camera; doppler for other cars. |
| `Radio.js` | Three generated stations (City Pop 88.1, Touge 155 eurobeat, Night Market 92.7 lo-fi) from chord progressions with a lookahead scheduler. `radio` key cycles stations. |

## How cars sound

The sound is derived from the vehicle spec, so new cars get a plausible voice for free:
`specs.engine.layout` picks the firing pattern (`I3 I4 I5 I6 F4 F6 V6 V8 V10 V12 R2 R3 EV`),
`displacement` the pitch and weight, `boost` adds the turbo or supercharger layers. Parts add character
through the working spec's `sound` block (`exhaust`, `pops`, `lope` for cams, `bov`, `whine`, `gearWhine`).
A vehicle file can override with `sound: { layout: 'V8' }` (for example a V8 swap sound on a car whose
specs say otherwise).

## Adding a sound

Prefer a function on `AudioSystem` that builds nodes on demand and connects to the right bus
(`this.buses.sfx`): see `pop()`, `bov()`, `impact()`, `horn()`. Use `tone()` and `envNoise()` helpers for
one-shots. Always route through a bus so the volume settings apply, and stop / disconnect sources when done.
Game code calls audio through `game.audio?.x()` (audio may be unavailable).
