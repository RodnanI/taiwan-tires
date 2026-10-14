// Exterior details: lights (registered for the runtime), mirrors, exhausts (anchors for backfire), plates,
// wings, splitters, grilles, wheel wells. All positions vehicle-local; side = +1 (left) / -1 (right).
import * as THREE from 'three';
import { roundedBox, latheZ, extrude, place, merge, box, tube, cylinderX } from './geometry.js';
import { makeCanvas, FONT_UI, FONT_CJK } from '../../core/canvas.js';
import { canvasTexture } from '../../render/textures.js';

export function makeExterior(kit) {
  const { M } = kit;
  const E = {};
  const lightMat = (kind) => {
    const colors = { head: 0xfff4e0, brake: 0xff1a12, tail: 0xff1a12, reverse: 0xf2f2ff, indicator: 0xff8a10, fog: 0xfff0c0, drl: 0xeaf2ff };
    const m = M.lightLens(colors[kind] ?? 0xffffff, kind === 'brake' || kind === 'tail' ? 0.25 : 0.04);
    kit._lights[kind === 'tail' ? 'brake' : kind] = kit._lights[kind === 'tail' ? 'brake' : kind] || [];
    kit._lights[kind === 'tail' ? 'brake' : kind].push(m);
    return m;
  };

  /** Headlight unit. shape: 'round' | 'rect' | 'slim' | 'popup'. Registers a head-light anchor. */
  E.headlight = ({ pos = [0.62, 0.68, 2.1], size = [0.26, 0.11], shape = 'rect', yaw = 0, rake = 0 } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.set(rake, yaw, 0);
    const [w, h] = size;
    const housing = new THREE.Mesh(shape === 'round' ? latheZ([[0, -0.06], [h * 0.55, -0.06], [h * 0.55, 0]], 24) : roundedBox(w, h, 0.07, Math.min(w, h) * 0.3, 2), M.chrome());
    housing.position.z = -0.03;
    const lens = new THREE.Mesh(shape === 'round' ? new THREE.CircleGeometry(h * 0.5, 24) : new THREE.PlaneGeometry(w * 0.94, h * 0.86), lightMat('head'));
    lens.position.z = shape === 'round' ? 0.002 : 0.006;
    g.add(housing, lens);
    if (shape !== 'round') {
      const proj = new THREE.Mesh(latheZ([[0, 0], [h * 0.28, 0], [h * 0.3, -0.03]], 16), M.chrome());
      proj.position.set(w * 0.22 * Math.sign(pos[0] || 1), 0, 0.0);
      g.add(proj);
    }
    kit._anchors.headlights.push([pos[0], pos[1], pos[2] + 0.05]);
    return g;
  };
  /** Tail light: brake/tail lens (+ optional reverse and indicator segments). */
  E.taillight = ({ pos = [0.6, 0.78, -2.15], size = [0.3, 0.1], shape = 'rect', reverse = true, yaw = 0 } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.y = Math.PI + yaw;
    const [w, h] = size;
    const geo = shape === 'round' ? new THREE.CircleGeometry(h * 0.5, 24) : new THREE.PlaneGeometry(w * (reverse ? 0.68 : 1), h);
    const brake = new THREE.Mesh(geo, lightMat('brake'));
    brake.position.x = reverse && shape !== 'round' ? w * 0.16 * Math.sign(pos[0] || 1) * -1 : 0;
    const housing = new THREE.Mesh(roundedBox(w + 0.02, h + 0.02, 0.04, 0.01, 1), M.plastic(0x0b0b0c, 0.3));
    housing.position.z = -0.022;
    g.add(housing, brake);
    if (reverse && shape !== 'round') {
      const rev = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, h * 0.8), lightMat('reverse'));
      rev.position.set(-brake.position.x * 2.1, 0, 0.001);
      g.add(rev);
    }
    return g;
  };
  E.sideMirror = ({ pos = [0.92, 0.98, 0.55], side = 1, color = null } = {}) => {
    const g = new THREE.Group();
    g.position.set(pos[0] * side, pos[1], pos[2]);
    const body = new THREE.Mesh(roundedBox(0.16, 0.1, 0.07, 0.03, 2), color ?? kit.paint);
    body.position.set(0.06 * side, 0, 0);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), M.surface({ color: 0x9aa2ae, roughness: 0.02, metalness: 1 }));
    glass.position.set(0.06 * side, 0, -0.036); glass.rotation.y = Math.PI;
    const arm = new THREE.Mesh(box(0.06, 0.03, 0.04), M.plastic(0x111113));
    g.add(body, glass, arm);
    return g;
  };
  /** Exhaust tip(s). Registers exhaust anchors used for backfire flames and sound placement. */
  E.exhaust = ({ pos = [0.45, 0.3, -2.2], radius = 0.045, count = 1, spacing = 0.11, style = 'round' } = {}) => {
    const g = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const x = pos[0] + (i - (count - 1) / 2) * spacing;
      const tip = new THREE.Mesh(style === 'square' ? roundedBox(radius * 2.2, radius * 1.5, 0.14, 0.01, 1) : latheZ([[radius * 0.82, -0.14], [radius, -0.12], [radius * 1.06, 0], [radius * 0.92, 0.005]], 20), M.chrome());
      tip.position.set(x, pos[1], pos[2]);
      tip.material.side = THREE.DoubleSide;
      const inner = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.85, 16), M.plastic(0x050505, 0.9));
      inner.position.set(x, pos[1], pos[2] - 0.03); inner.rotation.y = Math.PI;
      g.add(tip, inner);
      kit._anchors.exhaust.push([x, pos[1], pos[2] - 0.02]);
    }
    return g;
  };
  /** Taiwan-style licence plate. */
  E.plate = ({ pos = [0, 0.45, -2.2], text = 'TTR-0886', rear = true } = {}) => {
    const c = makeCanvas(256, 128), g = c.getContext('2d');
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(4, 4, 248, 120);
    g.fillStyle = '#121212'; g.font = `600 18px ${FONT_CJK}`; g.textAlign = 'center'; g.fillText('臺灣 TAIWAN', 128, 28);
    g.font = `700 64px ${FONT_UI}`; g.fillText(text, 128, 102);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), M.surface({ map: canvasTexture(c, { repeat: false }), roughness: 0.5 }));
    m.position.set(...pos);
    if (rear) m.rotation.y = Math.PI;
    return m;
  };
  /** Rear wing. style: 'ducktail' | 'gt' | 'swan' | 'lip'. */
  E.wing = ({ z = -2.05, y = 1.05, width = 1.5, chord = 0.26, height = 0.22, style = 'gt', color = null, angle = 8 } = {}) => {
    const g = new THREE.Group();
    const mat = color ?? kit.paint;
    if (style === 'lip' || style === 'ducktail') {
      const lip = new THREE.Mesh(extrude([[0, 0], [chord * (style === 'lip' ? 0.4 : 0.8), 0.0], [chord * (style === 'lip' ? 0.45 : 0.9), 0.05], [0, 0.02]], width, { axis: 'x', bevel: 0.01 }), mat);
      lip.position.set(0, y, z); lip.rotation.x = Math.PI; lip.scale.z = -1;
      g.add(lip);
      return g;
    }
    const foil = extrude([[-chord / 2, 0], [-chord * 0.2, 0.025], [chord / 2, 0.012], [chord / 2, 0.0], [-chord * 0.2, -0.004]], width, { axis: 'x', bevel: 0.004 });
    const blade = new THREE.Mesh(foil, style === 'gt' ? M.carbon() : mat);
    blade.position.set(0, y + height, z); blade.rotation.x = angle * Math.PI / 180;
    const plateGeo = extrude([[-chord * 0.65, -0.08], [chord * 0.55, -0.06], [chord * 0.55, 0.12], [-chord * 0.65, 0.12]], 0.008, { axis: 'z', bevel: 0 });
    for (const s of [1, -1]) {
      const ep = new THREE.Mesh(plateGeo, M.carbon());
      ep.rotation.y = Math.PI / 2; ep.position.set(s * width / 2, y + height, z);
      g.add(ep);
      const upright = style === 'swan'
        ? new THREE.Mesh(tube([[s * width * 0.3, y, z - chord * 0.2], [s * width * 0.3, y + height * 0.9, z - chord * 0.5], [s * width * 0.3, y + height + 0.03, z - chord * 0.1]], 0.012, 12, 6), M.carbon())
        : new THREE.Mesh(box(0.012, height, chord * 0.5), M.carbon());
      if (style !== 'swan') upright.position.set(s * width * 0.32, y + height / 2, z);
      g.add(upright);
    }
    g.add(blade);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  };
  E.splitter = ({ z = 2.15, y = 0.12, width = 1.6, depth = 0.12 } = {}) => {
    const m = new THREE.Mesh(roundedBox(width, 0.02, depth, 0.008, 1), M.carbon());
    m.position.set(0, y, z);
    return m;
  };
  E.grille = ({ pos = [0, 0.5, 2.18], size = [0.7, 0.16], rake = 0 } = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), M.textured('grille', { repeat: 2, roughness: 0.5 }));
    m.position.set(...pos); m.rotation.x = rake;
    return m;
  };
  /** Dark wheel-well liner so wheel arches read as openings. */
  E.wheelWell = ({ x = 0.7, z = 1.25, y = 0.32, radius = 0.36, width = 0.3 } = {}) => {
    const g = new THREE.CylinderGeometry(radius, radius, width, 20, 1, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2); g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, M.shared('well', () => M.surface({ color: 0x050505, roughness: 1, side: THREE.BackSide })));
    m.position.set(x, y, z);
    return m;
  };
  E.wipers = ({ y = 0.95, z = 0.95, width = 1.2, angle = 0.15 } = {}) => {
    const parts = [-0.3, 0.25].map((x) => place(box(0.55, 0.012, 0.012), [x * width, y, z], [0, 0, angle]));
    return new THREE.Mesh(merge(parts), M.plastic(0x0a0a0a, 0.6));
  };
  E.antenna = ({ pos = [-0.5, 1.2, -0.6] } = {}) => new THREE.Mesh(place(cylinderX(0.003, 0.5, 4), pos, [0, 0, Math.PI / 2 - 0.4]), M.plastic(0x0a0a0a));
  return E;
}
