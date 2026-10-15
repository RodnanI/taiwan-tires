// Yangmingshan extras: the summit car park and its pavilion at the top of the Seven Star loop (the city lights
// spread out below it at night), and the sulphur vents on the flank of Qixing, steaming.
import * as THREE from 'three';
import { tileUV } from './atlas.js';
import { lin } from './geom.js';
import { palaceRoof } from './temple.js';
import { makeCanvas } from '../../../src/core/canvas.js';
import { canvasTexture } from '../../../src/render/textures.js';
import { VENTS } from '../geo.js';


export function buildMountain(kit, shared, r) {
  summit(kit, shared, r);
  vents(kit, shared, r);
}

function summit(kit, shared, r) {
  const loop = kit.roads.find((q) => q.id === 'qixing-loop');
  if (!loop) return;
  const R = loop.route, p0 = R.project(-897, -890), i = p0.i;
  // level with the lowest point of the road along the car park, so the road never drops below its edge
  let y = Infinity;
  for (let b = -16; b <= 16; b += 2) y = Math.min(y, R.pointAt(R.dist[i] + b).y - 0.04);
  // the car park on the outside of the bend, level with the road
  const side = R.nx(i) * (-930 - R.x[i]) + R.nz(i) * (-885 - R.z[i]) > 0 ? 1 : -1;
  const out = [R.nx(i) * side, R.nz(i) * side], t = [R.tx[i], R.tz[i]];
  const C = (a, b) => [R.x[i] + out[0] * a + t[0] * b, R.z[i] + out[1] * a + t[1] * b];
  const e0 = R.half[i] + loop.shoulder;
  kit.pad({ poly: [C(e0 - 0.5, -16), C(e0 + 30, -16), C(e0 + 30, 16), C(e0 - 0.5, 16)], y, surface: 'asphalt', blend: 10 });
  shared.mask.circle(...C(e0 + 15, 0), 24);
  const cars = [0xe8e8e4, 0x1c1d1f, 0x9aa1a6, 0xb02a24, 0x2c4f7e, 0xd8d2c4];
  for (let b = -13; b <= 13; b += 2.7) if (r() < 0.5) { const [x, z] = C(e0 + 26, b); kit.props.place('parkedCar', [x, y, z], Math.atan2(out[0], out[1]), 1, cars[Math.floor(r() * cars.length)]); }
  { const [x, z] = C(e0 + 4, -14); kit.props.place('vending', [x, y, z], Math.atan2(-out[0], -out[1])); }
  // pavilion at the edge: four red columns under a curled tile roof, benches inside
  const [px, pz] = C(e0 + 38, 0), B = shared.city.wallB, face = Math.atan2(out[0], out[1]);
  const py = kit.groundY(px, pz);
  kit.pad({ poly: [[px - 7, pz - 7], [px + 7, pz - 7], [px + 7, pz + 7], [px - 7, pz + 7]], y: py, surface: 'concrete', blend: 5 });
  for (const [u, v] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) {
    const x = px + u * Math.cos(face) + v * Math.sin(face), z = pz - u * Math.sin(face) + v * Math.cos(face);
    B.box(x, z, [1, 0], [0, -1], 0.25, 0.25, py, py + 3.6, tileUV('plain'), null, lin(0xb3261b));
    kit.collision.cylinder({ x, z, r: 0.3, y0: py - 1, y1: py + 3.6, kind: 'pillar' });
  }
  palaceRoof(B, { x: px, z: pz, y: py + 3.6, face, hw: 6.2, hd: 6.2, rise: 2.6, roof: 'green' });
  kit.props.place('bench', [px, py, pz + 1.5], face);
  kit.props.place('bench', [px, py, pz - 1.5], face + Math.PI);
  kit.light({ pos: [px, py + 3, pz], color: 0xffd8a0, intensity: 40, range: 16, nightOnly: true });
  shared.mask.circle(px, pz, 10);
}

/** Soft white puff for the steam sprites. */
function puffTexture() {
  const n = 64, c = makeCanvas(n, n), g = c.getContext('2d');
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(240,240,236,0.45)'); gr.addColorStop(1, 'rgba(230,230,226,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return canvasTexture(c, { repeat: false });
}

/** Sulphur vents: yellow rocks round a few holes, steam rising and thinning out. */
function vents(kit, shared, r) {
  const tex = puffTexture(), plane = new THREE.PlaneGeometry(1, 1);
  const puffs = [];
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2, d = r() * VENTS.r * 0.7;
    const x = VENTS.x + Math.cos(a) * d, z = VENTS.z + Math.sin(a) * d, y = kit.groundY(x, z);
    for (let q = 0; q < 6; q++) kit.props.place('rock', [x + (r() - 0.5) * 6, y - 0.4, z + (r() - 0.5) * 6], r() * 6, 0.6 + r() * 0.9, [0xe0d088, 0xd8c070, 0xc8c0a0][q % 3]);
    for (let q = 0; q < 5; q++) {
      // camera-facing quads (plain meshes: sprites misbehave in the post-processing passes)
      const m = new THREE.MeshBasicMaterial({ map: tex, color: 0xf4f4f0, transparent: true, depthWrite: false, opacity: 0.5, fog: true });
      const s = new THREE.Mesh(plane, m);
      s.renderOrder = 4; s.frustumCulled = false;
      kit.add(s);
      puffs.push({ s, x, y, z, t: q / 5, rate: 0.09 + r() * 0.05, drift: [(r() - 0.5) * 6, (r() - 0.5) * 6] });
    }
    shared.mask.circle(x, z, 4);
  }
  kit.animate((dt, time, camera) => {
    for (const p of puffs) {
      if (camera) p.s.quaternion.copy(camera.quaternion);
      p.t = (p.t + dt * p.rate) % 1;
      const k = p.t, size = 3 + k * 16;
      p.s.position.set(p.x + p.drift[0] * k, p.y + 1 + k * 26, p.z + p.drift[1] * k);
      p.s.scale.set(size, size, 1);
      p.s.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.15));
    }
  });
}
