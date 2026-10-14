# Rendering

three.js r186, WebGL2. Everything is procedural (no image files). The graphics preset decides every cost;
nothing outside `Quality.js` / `Renderer.applyQuality()` may branch on the preset **name**, only on the
resolved values (`q.shadows`, `q.ssr`...).

| File | Contents |
|---|---|
| `Quality.js` | Presets Potato to Ultra++, option tables (shadows, reflections, particles, texture sizes), GPU-based preset detection. |
| `Renderer.js` | WebGL context, pixel ratio x render scale, post chain on/off, tone mapping, stats. |
| `PostFX.js` | HDR post chain: GTAO, wet SSR, god rays, motion blur, depth of field, bloom, final grade, SMAA / FXAA. |
| `Environment.js` | Sky shader, sun/moon path for Taiwan's latitude, time of day keyframes, fog, weather (rain, wetness), cube-map reflections, shadow camera. |
| `materials.js` | `MaterialFactory` (quality-aware: basic / standard / physical), paint finishes, shared material cache. |
| `textures.js` | Procedural texture generators (asphalt, concrete, grass, dirt, carbon, leather, tread, grille, brushed; car trim: grain, cloth80s, carpet, headliner, alcantara, perforated, quilted, speaker; lamp optics: lensOptic, lensRibs, lensFlutes). |
| `LightManager.js` | Virtual lights: maps register hundreds; the N most relevant become real point lights each frame. |
| `Particles.js` | Instanced billboards: tyre smoke, dust, sparks, backfire flames, rain spray. |
| `SkidMarks.js` | One ring buffer of road quads for all cars. |
| `RacingLineView.js` | Braking-aware racing line on the road (green / amber / red). |
| `../camera/CameraRig.js` | Driving cameras and speed feel (FOV kick, shake, velocity-led chase). |

## Presets

| Preset | Render scale | AA | Shadows | AO | Reflections | SSR | Post | Lights |
|---|---|---|---|---|---|---|---|---|
| Potato | 0.5 | off | blob | off | off | off | none (no post chain) | 0 |
| Low | 0.75 | FXAA | 1024 | off | static | off | bloom low, vignette | 2 |
| Medium | 1 | SMAA | 2048 | off | static | off | + motion blur low, speed FX | 4 |
| High | 1 (dpr 1.5) | SMAA | 2048 | GTAO half | dynamic 128 | off | bloom high | 8 |
| Ultra | 1 (dpr 2) | MSAA 4x | 4096 | GTAO | dynamic 256 | low (wet) | + DOF, god rays, CA, grain | 12 |
| Ultra+ | 1 (dpr 2) | MSAA 4x + SMAA | 4096 far | GTAO high | 512 every frame | high | all | 16 |
| Ultra++ | **1.35 supersampled** (dpr 3) | MSAA 8x + SMAA | 8192 | GTAO high | 512 every frame | ultra (44 steps) | all | 24 |

Every value is also an individual setting (`gfx.<key>`, "Custom" preset when edited).

**Honesty note on Ultra++.** It is not hardware ray tracing (WebGL has none). It is the most expensive
rasterized path this engine has: supersampling, 8K shadows, screen-space reflections and GTAO at full
resolution, per-frame dynamic cube maps. It looks very good and it will bring a high-end GPU to its knees,
but screen-space effects cannot show what is off-screen. If WebGPU ray queries become usable, the place to
add them is a new SSR/AO replacement pass in `PostFX.js` behind a new option value.

## Post chain order

`scene (HDR half-float, MSAA, depth texture) -> GTAO -> wet SSR -> god rays -> motion blur -> DOF -> bloom ->
final (tone map ACES/AgX/Neutral, exposure, saturation, vignette, speed streaks, CA, grain) -> SMAA/FXAA`.
Passes take `render(renderer, write, read)`; per-frame inputs come through the `info` object passed to
`Renderer.render(scene, camera, info)`: `{ speed, minDepth, wetness, dryGloss, sun, time, mbScale, dof: { focus, aperture, maxBlur }, exposure, fade, tint }`.

Motion blur is camera-only (reprojection with the previous view-projection) and masks pixels nearer than
`minDepth` so the player's car stays sharp.

## Materials and lighting rules

- Use the factory (`M.surface`, `M.textured`, `M.paint`, `M.glass`...): it downgrades to Lambert on Potato
  and upgrades to physical (clearcoat paint) on High+. Use `M.shared(key, fn)` for anything repeated.
- Emissives that switch on at night: `mat.userData.nightEmissive = [day, night]` and push to the kit's
  `nightMaterials`.
- Rain: materials registered with `env.addWettable(mat)` darken and gain gloss with `env.wetness`; SSR then
  reflects the city in them.
- Sun and moon follow Taiwan's latitude (about 23.5 N); time of day keyframes live at the top of
  `Environment.js` (zenith, horizon, sun colour/intensity, ambient, fog per hour).

## Checking your work

`node tools/shot.mjs --preset ultraPlusPlus --w 480 --h 270` compiles every shader path in headless Chromium
(software GL is slow: expect 1 to 6 fps). Shader compile errors appear as console errors and fail the run.
