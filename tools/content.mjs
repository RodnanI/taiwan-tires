// Content discovery shared by the build and the validator: every folder in vehicles/ with a vehicle.js and every
// folder in maps/ with a map.js. Folders starting with "_" (templates) or "." are skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Returns { vehicles: ['./vehicles/<id>/vehicle.js', ...], maps: ['./maps/<id>/map.js', ...] } relative to root. */
export function discoverContent(root = ROOT) {
  const scan = (dir, file) => {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .filter((d) => fs.existsSync(path.join(abs, d.name, file)))
      .map((d) => `./${dir}/${d.name}/${file}`)
      .sort();
  };
  return { vehicles: scan('vehicles', 'vehicle.js'), maps: scan('maps', 'map.js') };
}
