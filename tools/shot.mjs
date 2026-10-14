// Headless browser check: loads dist/taiwan-tires.html in Chromium, reports console errors and saves
// screenshots of boot -> menu -> free roam -> event. Agents use this to see their work.
//   node tools/shot.mjs [--preset low] [--map kaohsiung-harbor] [--event harbor-circuit] [--car id] [--out dir] [--drive 4]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const preset = arg('preset', 'low');
const mapId = arg('map', null);
const eventId = arg('event', null);
const out = path.resolve(arg('out', path.join(ROOT, 'tmp', 'shots')));
const driveSec = Number(arg('drive', 4));
const W = Number(arg('w', 1280)), H = Number(arg('h', 720));
fs.mkdirSync(out, { recursive: true });

// software GL (SwiftShader) so it runs on machines without a GPU; Playwright finds its own Chromium
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { const t = `[${m.type()}] ${m.text()}`; logs.push(t); if (m.type() === 'error' || m.type() === 'warning') console.log(t); });
page.on('pageerror', (e) => { logs.push(`[pageerror] ${e.message}\n${e.stack}`); console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join('\n')); });
await page.addInitScript((p) => {
  localStorage.setItem('tt.settings.v1', JSON.stringify({ 'gfx.preset': p, 'display.fpsCounter': 'full' }));
}, preset);
const url = pathToFileURL(path.join(ROOT, 'dist', 'taiwan-tires.html')).href;
await page.goto(url);
await page.waitForTimeout(1500);
// apply the preset properly (the init script only stores the key)
await page.evaluate((p) => { window.TT?.settings.applyPreset(p); }, preset);
await page.screenshot({ path: path.join(out, '01-boot.png'), timeout: 180000 });
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(out, '02-menu.png'), timeout: 180000 });
const mid = mapId || (await page.evaluate(() => window.TT.registry.maps()[0]?.id));
console.log('loading map', mid, eventId || '(free roam)');
const t0 = Date.now();
await page.evaluate(([m, e]) => window.TT.startSession({ mapId: m, eventId: e }), [mid, eventId]);
await page.waitForFunction(() => window.TT.state === 'driving', null, { timeout: 120000 });
console.log('loaded in', Date.now() - t0, 'ms');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, '03-start.png'), timeout: 180000 });
// events start with a countdown; software rendering runs the game clock slowly, so wait for "go"
await page.waitForFunction(() => window.TT.session?.mode?.state !== 'countdown', null, { timeout: 120000 });
await page.keyboard.down('KeyW');
await page.waitForTimeout(driveSec * 1000);
await page.keyboard.down('KeyD');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyD');
await page.screenshot({ path: path.join(out, '04-driving.png'), timeout: 180000 });
await page.keyboard.down('Space');
await page.keyboard.down('KeyA');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, '05-drift.png'), timeout: 180000 });
await page.keyboard.up('Space'); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyW');
const info = await page.evaluate(() => { const s = window.TT.session; const t = s.player.physics.tel; const H = s.mode.hud(); return { mode: s.mode.state, position: H.position && `${H.position}/${H.of}`, speed: t.speed * 3.6, gear: t.gear, rpm: Math.round(t.rpm), fps: window.TT.loop.stats.fps, pos: s.player.physics.pos.toArray().map((v) => +v.toFixed(1)), calls: window.TT.renderer.stats.calls, tris: window.TT.renderer.stats.triangles }; });
console.log('state', JSON.stringify(info));
await page.keyboard.press('KeyC'); await page.keyboard.press('KeyC'); await page.keyboard.press('KeyC'); await page.keyboard.press('KeyC');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, '06-cockpit.png'), timeout: 180000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, '07-pause.png'), timeout: 180000 });
fs.writeFileSync(path.join(out, 'console.log'), logs.join('\n'));
const errors = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
console.log(`done: ${errors.length} error(s). screenshots in ${path.relative(ROOT, out)}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
