// Instanced prop catalog. kit.props.place(name, [x,y,z], rotY, scale, color) puts one; helpers below also add
// colliders / virtual lights. Add new props with define() - geometry is built once, drawn with instancing.
import * as THREE from 'three';

export const PROP_NAMES = ['lampPole', 'lampArm', 'railPost', 'palm', 'tree', 'bush', 'cone', 'waterBarrier', 'container20', 'container40', 'scooter', 'pillar', 'mirror', 'trafficLight', 'vending', 'bollard', 'waterTank', 'acUnit', 'cage', 'crate', 'drum', 'bench', 'busStop', 'betelStand', 'powerPole'];

export function makeProps(kit) {
  const { M, inst } = kit;
  const mat = {
    pole: () => M.shared('pole', () => M.surface({ color: 0x6d7275, roughness: 0.5, metalness: 0.6 })),
    lampHead: () => M.shared('lampHead', () => { const m = M.surface({ color: 0x222222, emissive: 0xffd39a, emissiveIntensity: 0.1, roughness: 0.4 }); m.userData.nightEmissive = [0.1, 6]; kit.nightMaterials.push(m); return m; }),
    bark: () => M.shared('bark', () => M.surface({ color: 0x5a4636, roughness: 0.95 })),
    leaf: () => M.shared('leaf', () => M.surface({ color: 0x3f6b2f, roughness: 0.85, side: THREE.DoubleSide })),
    leafDark: () => M.shared('leafDark', () => M.surface({ color: 0x2c4f25, roughness: 0.9 })),
    orange: () => M.shared('cone', () => M.surface({ color: 0xe8541c, roughness: 0.6 })),
    white: () => M.shared('whitePaint', () => M.surface({ color: 0xe8e6df, roughness: 0.6 })),
    container: () => M.shared('container', () => { const m = M.textured('brushed', { repeat: 1, color: 0xffffff, roughness: 0.6, metalness: 0.3 }); return m; }),
    concrete: () => M.textured('concrete', { repeat: 1, roughness: 0.9 }),
    dark: () => M.shared('darkMetal', () => M.surface({ color: 0x1b1c1e, roughness: 0.5, metalness: 0.4 })),
    chrome: () => M.chrome(),
    glass: () => M.shared('propGlass', () => M.surface({ color: 0x9fb3c0, roughness: 0.05, metalness: 0.9 })),
    red: () => M.shared('redPaint', () => M.surface({ color: 0xc23a2a, roughness: 0.5 })),
    vend: () => M.shared('vend', () => { const m = M.surface({ color: 0xd8d6cf, emissive: 0xfff3dc, emissiveIntensity: 0.1, roughness: 0.4 }); m.userData.nightEmissive = [0.1, 0.8]; kit.nightMaterials.push(m); return m; }),
    neonGreen: () => M.shared('neonGreen', () => { const m = M.surface({ color: 0x0a3a14, emissive: 0x39ff6a, emissiveIntensity: 0.2 }); m.userData.nightEmissive = [0.2, 4]; kit.nightMaterials.push(m); return m; }),
    neonPink: () => M.shared('neonPink', () => { const m = M.surface({ color: 0x3a0a20, emissive: 0xff3e8a, emissiveIntensity: 0.2 }); m.userData.nightEmissive = [0.2, 4]; kit.nightMaterials.push(m); return m; }),
  };
  const P = (geometry, material, castShadow = true) => ({ geometry, material, castShadow });
  const lazy = new Map();
  // definitions are built on first use so unused props cost nothing
  const DEFS = {
    lampPole: () => { const pole = new THREE.CylinderGeometry(0.09, 0.14, 1, 8); pole.translate(0, 0.5, 0); return [P(pole, mat.pole())]; },
    lampArm: () => { const arm = new THREE.BoxGeometry(0.08, 0.08, 1); arm.translate(0, 0, 0.5); return [P(arm, mat.pole())]; },
    railPost: () => { const g = new THREE.BoxGeometry(0.1, 0.8, 0.1); g.translate(0, 0.4, 0); return [P(g, mat.pole(), false)]; },
    palm: () => {
      const trunk = new THREE.CylinderGeometry(0.16, 0.26, 7, 7); trunk.translate(0, 3.5, 0);
      const fronds = [];
      for (let i = 0; i < 8; i++) { const f = new THREE.PlaneGeometry(0.9, 3.6, 1, 3); f.translate(0, 1.8, 0); const p = f.attributes.position; for (let k = 0; k < p.count; k++) p.setZ(k, -Math.pow(p.getY(k) / 3.6, 2) * 1.4); f.rotateX(-1.0); f.rotateY((i / 8) * Math.PI * 2); f.translate(0, 7, 0); fronds.push(f); }
      return [P(trunk, mat.bark()), P(kit.merge(fronds), mat.leaf())];
    },
    tree: () => {
      const trunk = new THREE.CylinderGeometry(0.18, 0.3, 3.2, 7); trunk.translate(0, 1.6, 0);
      const c1 = new THREE.IcosahedronGeometry(2.4, 1); c1.translate(0, 4.4, 0);
      const c2 = new THREE.IcosahedronGeometry(1.8, 1); c2.translate(1.1, 5.4, 0.4);
      const c3 = new THREE.IcosahedronGeometry(1.6, 1); c3.translate(-1.0, 5.0, -0.6);
      return [P(trunk, mat.bark()), P(kit.merge([c1, c2, c3]), mat.leafDark())];
    },
    bush: () => { const g = new THREE.IcosahedronGeometry(0.9, 1); g.scale(1.3, 0.8, 1.3); g.translate(0, 0.5, 0); return [P(g, mat.leafDark(), false)]; },
    cone: () => { const c = new THREE.ConeGeometry(0.2, 0.7, 10); c.translate(0, 0.35, 0); const b = new THREE.BoxGeometry(0.42, 0.04, 0.42); b.translate(0, 0.02, 0); return [P(kit.merge([c, b]), mat.orange(), false)]; },
    waterBarrier: () => { const g = new THREE.BoxGeometry(1.8, 0.8, 0.5); g.translate(0, 0.4, 0); return [P(g, mat.red())]; },
    container20: () => { const g = new THREE.BoxGeometry(2.44, 2.59, 6.06); g.translate(0, 1.295, 0); return [P(g, mat.container())]; },
    container40: () => { const g = new THREE.BoxGeometry(2.44, 2.59, 12.19); g.translate(0, 1.295, 0); return [P(g, mat.container())]; },
    scooter: () => {
      const body = new THREE.BoxGeometry(0.36, 0.5, 1.2); body.translate(0, 0.55, 0);
      const seat = new THREE.BoxGeometry(0.3, 0.12, 0.6); seat.translate(0, 0.86, -0.2);
      const front = new THREE.BoxGeometry(0.3, 0.7, 0.2); front.translate(0, 0.75, 0.55);
      const w1 = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12); w1.rotateZ(Math.PI / 2); w1.translate(0, 0.22, 0.5);
      const w2 = w1.clone(); w2.translate(0, 0, -1.0);
      return [P(kit.merge([body, seat, front]), mat.white()), P(kit.merge([w1, w2]), mat.dark(), false)];
    },
    pillar: () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return [P(g, mat.concrete())]; },
    mirror: () => {
      const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6); pole.translate(0, 1.3, 0);
      const frame = new THREE.TorusGeometry(0.42, 0.06, 6, 20); frame.translate(0, 2.9, 0.05);
      const glass = new THREE.CircleGeometry(0.42, 20); glass.translate(0, 2.9, 0.06);
      return [P(pole, mat.orange()), P(frame, mat.orange()), P(glass, mat.glass(), false)];
    },
    trafficLight: () => {
      const pole = new THREE.CylinderGeometry(0.1, 0.12, 6, 8); pole.translate(0, 3, 0);
      const arm = new THREE.BoxGeometry(0.1, 0.1, 5); arm.translate(0, 5.8, 2.5);
      const box = new THREE.BoxGeometry(1.1, 0.4, 0.35); box.translate(0, 5.55, 4.6);
      return [P(kit.merge([pole, arm]), mat.pole()), P(box, mat.dark())];
    },
    vending: () => { const g = new THREE.BoxGeometry(1.0, 1.9, 0.8); g.translate(0, 0.95, 0); return [P(g, mat.vend())]; },
    bollard: () => { const g = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8); g.translate(0, 0.45, 0); return [P(g, mat.white(), false)]; },
    waterTank: () => {
      const t = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12); t.translate(0, 1.6, 0);
      const legs = []; for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) { const l = new THREE.BoxGeometry(0.08, 0.8, 0.08); l.translate(x, 0.4, z); legs.push(l); }
      return [P(t, mat.white()), P(kit.merge(legs), mat.pole())];
    },
    acUnit: () => { const g = new THREE.BoxGeometry(0.8, 0.55, 0.3); return [P(g, mat.white(), false)]; },
    cage: () => {
      const bars = [];
      for (let i = 0; i < 6; i++) { const b = new THREE.BoxGeometry(0.03, 1.5, 0.03); b.translate(-0.9 + i * 0.36, 0, 0.0); bars.push(b); }
      for (const y of [-0.74, 0.74]) { const b = new THREE.BoxGeometry(1.86, 0.04, 0.5); b.translate(0, y, -0.2); bars.push(b); }
      return [P(kit.merge(bars), mat.pole(), false)];
    },
    crate: () => { const g = new THREE.BoxGeometry(1.2, 1, 1.2); g.translate(0, 0.5, 0); return [P(g, M.shared('crate', () => M.surface({ color: 0x8a6a43, roughness: 0.9 })))]; },
    drum: () => { const g = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12); g.translate(0, 0.45, 0); return [P(g, mat.red())]; },
    bench: () => { const s = new THREE.BoxGeometry(1.6, 0.06, 0.4); s.translate(0, 0.45, 0); const l = new THREE.BoxGeometry(1.5, 0.45, 0.06); l.translate(0, 0.22, 0); return [P(kit.merge([s, l]), mat.pole())]; },
    busStop: () => {
      const roof = new THREE.BoxGeometry(4, 0.12, 1.6); roof.translate(0, 2.6, 0);
      const back = new THREE.BoxGeometry(4, 2.4, 0.06); back.translate(0, 1.3, -0.75);
      return [P(roof, mat.pole()), P(back, mat.glass(), false)];
    },
    betelStand: () => {
      const booth = new THREE.BoxGeometry(2.4, 2.4, 2); booth.translate(0, 1.2, 0);
      const strips = []; for (const y of [2.45, 0.05]) { const s = new THREE.BoxGeometry(2.5, 0.08, 2.1); s.translate(0, y, 0); strips.push(s); }
      const v = []; for (const x of [-1.22, 1.22]) { const s = new THREE.BoxGeometry(0.08, 2.4, 0.08); s.translate(x, 1.2, 1.02); v.push(s); }
      return [P(booth, mat.glass()), P(kit.merge(strips), mat.neonGreen(), false), P(kit.merge(v), mat.neonPink(), false)];
    },
    powerPole: () => { const g = new THREE.CylinderGeometry(0.14, 0.2, 10, 8); g.translate(0, 5, 0); const c = new THREE.BoxGeometry(2.2, 0.12, 0.12); c.translate(0, 9.3, 0); return [P(kit.merge([g, c]), M.shared('wood', () => M.surface({ color: 0x6b5b4a, roughness: 0.95 })))]; },
  };
  function ensure(name) {
    if (lazy.has(name)) return;
    const d = DEFS[name];
    if (!d) throw new Error(`unknown prop "${name}"`);
    inst.define(name, d());
    lazy.set(name, true);
  }
  // colliders for blocking props: [type, size]
  const COLLIDE = { lampPole: ['c', 0.18], palm: ['c', 0.3], tree: ['c', 0.35], container20: ['b', 1.22, 3.03, 2.6], container40: ['b', 1.22, 6.1, 2.6], waterBarrier: ['b', 0.9, 0.25, 0.8], pillar: ['b', 0.5, 0.5, 1], mirror: ['c', 0.08], trafficLight: ['c', 0.15], vending: ['b', 0.5, 0.4, 1.9], waterTank: null, bollard: ['c', 0.1], betelStand: ['b', 1.2, 1.0, 2.4], powerPole: ['c', 0.2], busStop: ['b', 2, 0.1, 2.6], crate: ['b', 0.6, 0.6, 1], drum: ['c', 0.3] };

  const props = {
    names: PROP_NAMES,
    define(name, parts, opts) { DEFS[name] = () => parts; ensure(name); },
    /** Place an instanced prop. scale: number | [x,y,z]. Adds a collider for blocking props. */
    place(name, pos, rotY = 0, scale = 1, color = null, { collide = true } = {}) {
      ensure(name);
      inst.add(name, pos, rotY, scale, color);
      const c = collide && COLLIDE[name];
      if (c) {
        const s = Array.isArray(scale) ? scale : [scale, scale, scale];
        if (c[0] === 'c') kit.collision.cylinder({ x: pos[0], z: pos[2], r: c[1] * s[0], y0: pos[1] - 1, y1: pos[1] + 6, kind: name });
        else kit.collision.box({ x: pos[0], z: pos[2], hx: c[1] * s[0], hz: c[2] * s[2], rotY, y0: pos[1] - 1, y1: pos[1] + c[3] * s[1], kind: name });
      }
    },
    /** Street lamp with a real (pooled) light at night. heading: direction the arm points (over the road). */
    streetLamp(pos, heading, { height = 8.5, arm = 2.2, color = 0xffc27a, intensity = 120, range = 34 } = {}) {
      ensure('lampPole'); ensure('lampArm');
      inst.add('lampPole', pos, 0, [1, height, 1]);
      const ax = Math.sin(heading), az = Math.cos(heading);
      inst.add('lampArm', [pos[0], pos[1] + height - 0.05, pos[2]], heading, [1, 1, arm]);
      const hx = pos[0] + ax * arm, hy = pos[1] + height - 0.15, hz = pos[2] + az * arm;
      if (!props._head) { const g = new THREE.BoxGeometry(0.5, 0.12, 0.9); inst.define('lampHead', [P(g, mat.lampHead(), false)]); props._head = true; }
      inst.add('lampHead', [hx, hy, hz], heading);
      kit.collision.cylinder({ x: pos[0], z: pos[2], r: 0.18, y0: pos[1] - 1, y1: pos[1] + height, kind: 'pole' });
      kit.light({ pos: [hx, hy - 0.4, hz], color, intensity, range, nightOnly: true });
      if (kit.glows) kit.glows.push([hx, kit.groundY(hx, hz, hy), hz, color]);
    },
    pillar(pos, rotY, h, w) { ensure('pillar'); inst.add('pillar', pos, rotY, [w, h, 1.4]); kit.collision.box({ x: pos[0], z: pos[2], hx: w / 2, hz: 0.7, rotY, y0: pos[1] - 1, y1: pos[1] + h, kind: 'pillar' }); },
    /** Container stack: count high, random colours. */
    containerStack(pos, rotY, { long = true, high = 2, colors = [0xb03a2e, 0x1f5f8b, 0x2e7d4f, 0xc58b26, 0x6b6e70, 0x8e3b62, 0xd9d4c7] } = {}) {
      const name = long ? 'container40' : 'container20';
      for (let k = 0; k < high; k++) props.place(name, [pos[0], pos[1] + k * 2.59, pos[2]], rotY, 1, colors[Math.floor(kit.rand() * colors.length)], { collide: false });
      const c = COLLIDE[name];
      kit.collision.box({ x: pos[0], z: pos[2], hx: c[1], hz: c[2], rotY, y0: pos[1], y1: pos[1] + high * 2.59, kind: 'container' });
    },
  };
  return props;
}
