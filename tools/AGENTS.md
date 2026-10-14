# Tools

Node 18+ scripts. All are safe to run any time; none modify source files.

| Command | Script | What it does |
|---|---|---|
| `npm run build` | `build.mjs` | esbuild bundles `src/main.js` + three.js + every vehicle and map into `dist/taiwan-tires.html` (CSS, JS inlined; about 1.2 MB). `--dev` unminified. |
| `npm run dev` | `build.mjs --watch --serve` | Rebuild on change, serve on http://localhost:8080 (`PORT` env to change). |
| `npm run validate` | `validate.mjs` | Builds every car (with and without interior) and every map headless and checks them: spec problems, model vs physics box, origin on the ground, head unit / steering wheel / lights / exhaust present, triangle and mesh budgets, PI and a real 0-100 / braking drive test, map spawn (a car dropped there must land), event routes (exist, closed circuits, start on ground, menu preview matches the loaded map). `--only <text>`, `--strict` (warnings fail), `--no-physics`. |
| `npm test` | `test.mjs` | Engine sanity: tyre curves, settle / launch / brake / cornering / drift per car, start-line hold, auto reverse, rewind determinism, drivetrain and tyre swaps, every part on every car, AI tune constraints, settings and presets, race tracker (laps, grid, shortcuts), drift scorer. Filter by group name: `npm test -- physics`. |
| `node tools/shot.mjs` | `shot.mjs` | Headless Chromium (software GL) opens `dist/taiwan-tires.html`, screenshots boot, menu, start, driving, drift, camera, pause into `tmp/shots/`, prints console errors (exit 1 on any). `--preset`, `--map`, `--event`, `--drive <s>`, `--w`, `--h`, `--out`. |
| | `content.mjs` | Content discovery shared by build and validate (`vehicles/*/vehicle.js`, `maps/*/map.js`, skips `_*`). |

Notes:
- `shot.mjs` needs Playwright and Chromium (preinstalled in the cloud container; locally `npx playwright
  install chromium`). Software rendering runs at 1 to 6 fps, so game time runs slower than real time: the
  script waits for countdowns. Use small viewports (`--w 480 --h 270`) for Ultra / Ultra++ shader checks.
- The validator imports content modules directly, so a syntax error in a vehicle or map shows up there with
  a file name before the build hides it in a bundle.
- Keep scratch scripts out of the repo (use a temp folder); add a check to `test.mjs` instead when a bug is
  worth guarding.
