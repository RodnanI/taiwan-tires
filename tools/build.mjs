// Bundles the whole game (engine + three.js + every vehicle and map) into ONE standalone HTML file.
//   node tools/build.mjs            -> dist/taiwan-tires.html (minified)
//   node tools/build.mjs --dev      -> unminified, with sourcemap comments stripped
//   node tools/build.mjs --watch --serve   -> rebuild on change, serve dist/ on http://localhost:8080
// Content discovery: every folder in vehicles/ containing vehicle.js and every folder in maps/ containing
// map.js is bundled automatically (folders starting with "_" are templates and are skipped).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { discoverContent } from './content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const DEV = args.has('--dev') || args.has('--watch');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'taiwan-tires.html');


// virtual:content -> { vehicles: [...defs], maps: [...defs] }
const contentPlugin = {
  name: 'content',
  setup(build) {
    build.onResolve({ filter: /^virtual:content$/ }, () => ({ path: 'content', namespace: 'tt-virtual' }));
    build.onLoad({ filter: /.*/, namespace: 'tt-virtual' }, () => {
      const { vehicles, maps } = discoverContent();
      const lines = [];
      vehicles.forEach((p, i) => lines.push(`import v${i} from ${JSON.stringify(p)};`));
      maps.forEach((p, i) => lines.push(`import m${i} from ${JSON.stringify(p)};`));
      lines.push(`export const vehicles = [${vehicles.map((_, i) => 'v' + i).join(',')}];`);
      lines.push(`export const maps = [${maps.map((_, i) => 'm' + i).join(',')}];`);
      return {
        contents: lines.join('\n'),
        resolveDir: ROOT,
        loader: 'js',
        watchDirs: [path.join(ROOT, 'vehicles'), path.join(ROOT, 'maps')],
      };
    });
  },
};

const htmlPlugin = {
  name: 'html-out',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) {
        console.error(`[build] failed with ${result.errors.length} error(s)`);
        return;
      }
      const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
      const template = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
      // Inline-script safety: a literal "</script" inside the bundle would terminate the tag.
      const safe = js.replace(/<\/script/gi, '<\\/script');
      const html = template.replace('<!--GAME_SCRIPT-->', () => `<script>\n${safe}\n</script>`);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(OUT_FILE, html);
      const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
      const { vehicles, maps } = discoverContent();
      console.log(`[build] ${path.relative(ROOT, OUT_FILE)}  ${kb} KB  (${vehicles.length} vehicles, ${maps.length} maps)  ${new Date().toLocaleTimeString()}`);
    });
  },
};

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const options = {
  absWorkingDir: ROOT,
  entryPoints: [path.join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2022'],
  minify: !DEV,
  legalComments: 'none',
  write: false,
  outdir: OUT_DIR,
  loader: { '.css': 'text', '.glsl': 'text', '.svg': 'text' },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __DEV__: DEV ? 'true' : 'false',
  },
  plugins: [contentPlugin, htmlPlugin],
  logLevel: 'warning',
};

if (args.has('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[build] watching src/, vehicles/, maps/ ...');
  if (args.has('--serve')) {
    const port = Number(process.env.PORT || 8080);
    http.createServer((req, res) => {
      const file = req.url === '/' ? OUT_FILE : path.join(OUT_DIR, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(OUT_DIR) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    }).listen(port, () => console.log(`[build] serving http://localhost:${port}/`));
  }
} else {
  const result = await esbuild.build(options);
  if (result.errors.length) process.exit(1);
}
