// Instanced prop catalog. kit.props.place(name, [x,y,z], rotY, scale, color) puts one; helpers below also add
// colliders / virtual lights. Add new props with define() - geometry is built once, drawn with instancing.
import * as THREE from 'three';
import { makeCanvas } from '../../core/canvas.js';
import { canvasTexture } from '../../render/textures.js';

export const PROP_NAMES = ['lampPole', 'lampArm', 'railPost', 'palm', 'tree', 'bush', 'cone', 'waterBarrier', 'container20', 'container40', 'scooter', 'pillar', 'mirror', 'trafficLight', 'vending', 'bollard', 'waterTank', 'acUnit', 'cage', 'crate', 'drum', 'bench', 'busStop', 'betelStand', 'powerPole',
  'betelPalm', 'banana', 'cedar', 'broadleaf', 'banyan', 'cherry', 'bamboo', 'silvergrass', 'shrub', 'rock', 'lantern', 'chevron', 'parkedCar', 'shrine', 'stall', 'umbrella'];

// bend a plane along its length (fronds, leaves): z drops with the square of the distance from the base
function frond(w, len, droop, segs = 3) {
  const g = new THREE.PlaneGeometry(w, len, 1, segs);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const t = p.getY(k) / len; p.setZ(k, -t * t * droop); p.setX(k, p.getX(k) * (1 - t * 0.55)); }
  return g;
}

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
    foliage: () => M.shared('foliage', () => M.surface({ color: 0xffffff, roughness: 0.82, side: THREE.DoubleSide })),
    foliageSolid: () => M.shared('foliageSolid', () => M.surface({ color: 0xffffff, roughness: 0.9 })),
    trunk: () => M.shared('trunk', () => M.surface({ color: 0xffffff, roughness: 0.95 })),
    rock: () => M.shared('rockProp', () => M.surface({ color: 0xffffff, roughness: 0.95, flatShading: true })),
    lanternRed: () => M.shared('lanternRed', () => { const m = M.surface({ color: 0x8a1410, emissive: 0xff3a1c, emissiveIntensity: 0.15, roughness: 0.6 }); m.userData.nightEmissive = [0.15, 2.8]; kit.nightMaterials.push(m); return m; }),
    chevron: () => M.shared('chevronSign', () => {
      const c = makeCanvas(64, 32), g = c.getContext('2d');
      g.fillStyle = '#f2c21b'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#111';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(8 + i * 18, 4); g.lineTo(20 + i * 18, 16); g.lineTo(8 + i * 18, 28); g.lineTo(14 + i * 18, 28); g.lineTo(26 + i * 18, 16); g.lineTo(14 + i * 18, 4); g.fill(); }
      const m = M.surface({ map: canvasTexture(c, { repeat: false }), emissive: 0xffffff, emissiveMap: canvasTexture(c, { repeat: false }), emissiveIntensity: 0.02, roughness: 0.5 });
      m.userData.nightEmissive = [0.02, 0.35]; kit.nightMaterials.push(m); return m;
    }),
    carBody: () => M.shared('parkedCarBody', () => M.surface({ color: 0xffffff, roughness: 0.35, metalness: 0.4 })),
    carGlass: () => M.shared('parkedCarGlass', () => M.surface({ color: 0x15191c, roughness: 0.1, metalness: 0.6 })),
    awning: () => M.shared('stallAwning', () => { const m = M.surface({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.7, side: THREE.DoubleSide }); m.userData.nightEmissive = [0.0, 0.45]; kit.nightMaterials.push(m); return m; }),
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
    // ---- vegetation (tint with the instance colour; the materials are white)
    betelPalm: () => {
      const trunk = new THREE.CylinderGeometry(0.09, 0.13, 12, 5, 1, true); trunk.translate(0, 6, 0);
      const shaft = new THREE.CylinderGeometry(0.13, 0.11, 1.4, 5, 1, true); shaft.translate(0, 12.6, 0);
      const fr = [];
      for (let i = 0; i < 7; i++) { const f = frond(0.55, 3.0, 1.5); f.rotateX(-0.55 - (i % 2) * 0.35); f.rotateY((i / 7) * Math.PI * 2); f.translate(0, 13.2, 0); fr.push(f); }
      return [P(trunk, M.shared('betelTrunk', () => M.surface({ color: 0x8f8a7c, roughness: 0.9 }))), P(kit.merge([shaft, ...fr]), mat.foliage())];
    },
    banana: () => {
      const stem = new THREE.CylinderGeometry(0.1, 0.16, 2.6, 5, 1, true); stem.translate(0, 1.3, 0);
      const lv = [];
      for (let i = 0; i < 7; i++) { const f = frond(0.9, 2.5, 1.2); f.rotateX(-0.75 - (i % 3) * 0.2); f.rotateY((i / 7) * Math.PI * 2 + 0.4); f.translate(0, 2.5, 0); lv.push(f); }
      return [P(stem, M.shared('bananaStem', () => M.surface({ color: 0x6f7d3e, roughness: 0.85 }))), P(kit.merge(lv), mat.foliage())];
    },
    cedar: () => {
      const trunk = new THREE.CylinderGeometry(0.14, 0.3, 4, 5, 1, true); trunk.translate(0, 2, 0);
      const c1 = new THREE.ConeGeometry(2.4, 6.5, 7, 1, true); c1.translate(0, 6, 0);
      const c2 = new THREE.ConeGeometry(1.8, 5, 7, 1, true); c2.translate(0, 9.4, 0);
      const c3 = new THREE.ConeGeometry(1.1, 4, 7, 1, true); c3.translate(0, 12.4, 0);
      return [P(trunk, mat.bark()), P(kit.merge([c1, c2, c3]), mat.foliage())];
    },
    broadleaf: () => {
      const trunk = new THREE.CylinderGeometry(0.16, 0.28, 3.4, 5, 1, true); trunk.translate(0, 1.7, 0);
      const a = new THREE.IcosahedronGeometry(2.4, 0); a.scale(1.15, 0.85, 1.1); a.translate(0, 4.6, 0);
      const b = new THREE.IcosahedronGeometry(1.8, 0); b.translate(1.3, 5.3, 0.5);
      const c = new THREE.IcosahedronGeometry(1.6, 0); c.translate(-1.1, 5.0, -0.7);
      return [P(trunk, mat.bark()), P(kit.merge([a, b, c]), mat.foliageSolid())];
    },
    banyan: () => {
      const trunk = new THREE.CylinderGeometry(0.5, 0.85, 3.6, 6, 1, true); trunk.translate(0, 1.8, 0);
      const roots = []; for (let i = 0; i < 6; i++) { const r = new THREE.BoxGeometry(0.07, 3.2, 0.07); const a = (i / 6) * Math.PI * 2; r.translate(Math.cos(a) * 2.6, 2.6, Math.sin(a) * 2.6); roots.push(r); }
      const crown = []; for (const [x, y, z, s] of [[0, 5.6, 0, 3.6], [2.6, 5.0, 0.8, 2.6], [-2.4, 5.1, -0.9, 2.7], [0.4, 5.2, 2.6, 2.4], [-0.5, 5.0, -2.6, 2.4]]) { const g = new THREE.IcosahedronGeometry(s, 0); g.scale(1.2, 0.6, 1.2); g.translate(x, y, z); crown.push(g); }
      return [P(kit.merge([trunk, ...roots]), mat.bark()), P(kit.merge(crown), mat.foliageSolid())];
    },
    cherry: () => {
      const trunk = new THREE.CylinderGeometry(0.12, 0.22, 2.6, 5, 1, true); trunk.translate(0, 1.3, 0);
      const a = new THREE.IcosahedronGeometry(1.9, 0); a.scale(1.2, 0.8, 1.2); a.translate(0, 3.6, 0);
      const b = new THREE.IcosahedronGeometry(1.3, 0); b.translate(1.1, 4.1, 0.3);
      return [P(trunk, M.shared('cherryBark', () => M.surface({ color: 0x4a3530, roughness: 0.9 }))), P(kit.merge([a, b]), M.shared('blossom', () => M.surface({ color: 0xf2b8c8, roughness: 0.8 })))];
    },
    bamboo: () => {
      const culms = [], leaves = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, r = 0.25 + (i % 3) * 0.12, h = 7 + (i % 4) * 0.8;
        const c = new THREE.CylinderGeometry(0.04, 0.055, h, 3, 1, true); c.translate(0, h / 2, 0); c.rotateZ(Math.cos(a) * 0.12); c.rotateX(Math.sin(a) * 0.12); c.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
        culms.push(c);
        const l = frond(1.2, 2.6, 0.8, 2); l.rotateX(-1.1); l.rotateY(a); l.translate(Math.cos(a) * (r + 0.7), h - 0.6, Math.sin(a) * (r + 0.7)); leaves.push(l);
      }
      return [P(kit.merge(culms), M.shared('bambooCulm', () => M.surface({ color: 0x7f9a4a, roughness: 0.6 }))), P(kit.merge(leaves), mat.foliage())];
    },
    silvergrass: () => {
      const blades = [];
      for (let i = 0; i < 5; i++) { const b = frond(0.22, 1.7, 0.55, 2); b.rotateX(-0.25 - (i % 2) * 0.2); b.rotateY((i / 5) * Math.PI * 2); blades.push(b); }
      return [P(kit.merge(blades), mat.foliage(), false)];
    },
    shrub: () => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(1.3, 0.75, 1.2); g.translate(0, 0.55, 0); return [P(g, mat.foliageSolid(), false)]; },
    rock: () => { const g = new THREE.DodecahedronGeometry(1, 0); g.scale(1.3, 0.7, 1); g.translate(0, 0.35, 0); return [P(g, mat.rock())]; },
    lantern: () => {
      const body = new THREE.CylinderGeometry(0.21, 0.21, 0.36, 6, 1, true);
      const top = new THREE.ConeGeometry(0.21, 0.12, 6, 1, true); top.rotateX(Math.PI); top.translate(0, -0.24, 0);
      const bot = new THREE.ConeGeometry(0.21, 0.12, 6, 1, true); bot.translate(0, 0.24, 0);
      return [P(kit.merge([body, top, bot]), mat.lanternRed(), false)];
    },
    chevron: () => {
      const post = new THREE.BoxGeometry(0.08, 1.3, 0.08); post.translate(0, 0.65, 0);
      const board = new THREE.PlaneGeometry(1.1, 0.55); board.translate(0, 1.55, 0.05);
      const back = board.clone(); back.rotateY(Math.PI);
      return [P(post, mat.pole(), false), P(kit.merge([board, back]), mat.chevron(), false)];
    },
    parkedCar: () => {
      const low = new THREE.BoxGeometry(1.72, 0.62, 4.3); low.translate(0, 0.62, 0);
      const cab = new THREE.BoxGeometry(1.46, 0.5, 2.1); cab.translate(0, 1.18, -0.15);
      const wheels = []; for (const [x, z] of [[0.8, 1.35], [-0.8, 1.35], [0.8, -1.35], [-0.8, -1.35]]) { const w = new THREE.CylinderGeometry(0.31, 0.31, 0.2, 6, 1, true); w.rotateZ(Math.PI / 2); w.translate(x, 0.31, z); wheels.push(w); }
      return [P(low, mat.carBody()), P(cab, mat.carGlass(), false), P(kit.merge(wheels), mat.dark(), false)];
    },
    shrine: () => {
      const base = new THREE.BoxGeometry(1.6, 0.5, 1.4); base.translate(0, 0.25, 0);
      const box = new THREE.BoxGeometry(1.2, 1.1, 1.0); box.translate(0, 1.05, 0);
      const roof = new THREE.CylinderGeometry(0.0, 1.1, 0.55, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1.25, 1, 1.1); roof.translate(0, 1.88, 0);
      return [P(kit.merge([base, box]), M.shared('shrineRed', () => M.surface({ color: 0xa32418, roughness: 0.6 }))), P(roof, M.shared('shrineRoof', () => M.surface({ color: 0xc9902a, roughness: 0.5, metalness: 0.2 })))];
    },
    stall: () => {
      const table = new THREE.BoxGeometry(2.4, 0.9, 1.2); table.translate(0, 0.45, 0);
      const poles = []; for (const [x, z] of [[1.15, 0.55], [-1.15, 0.55], [1.15, -0.55], [-1.15, -0.55]]) { const p = new THREE.BoxGeometry(0.05, 2.3, 0.05); p.translate(x, 1.15, z); poles.push(p); }
      const awn = new THREE.PlaneGeometry(2.8, 1.8); awn.rotateX(-Math.PI / 2 + 0.18); awn.translate(0, 2.35, 0.1);
      return [P(kit.merge([table, ...poles]), mat.pole()), P(awn, mat.awning(), false)];
    },
    umbrella: () => {
      const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 4); pole.translate(0, 1.15, 0);
      const top = new THREE.ConeGeometry(1.3, 0.45, 8, 1, true); top.translate(0, 2.35, 0);
      return [P(pole, mat.pole(), false), P(top, mat.awning(), false)];
    },
    powerPole: () => { const g = new THREE.CylinderGeometry(0.14, 0.2, 10, 8); g.translate(0, 5, 0); const c = new THREE.BoxGeometry(2.2, 0.12, 0.12); c.translate(0, 9.3, 0); return [P(kit.merge([g, c]), M.shared('wood', () => M.surface({ color: 0x6b5b4a, roughness: 0.95 })))]; },
  };
  // big sets of small things stop drawing beyond these distances (scaled by the preset's draw distance)
  const CULL = { betelPalm: 1100, banana: 500, cedar: 1300, broadleaf: 1100, banyan: 900, cherry: 800, bamboo: 700, silvergrass: 260, shrub: 380, rock: 700, lantern: 500, chevron: 420, parkedCar: 520, scooter: 300, stall: 500, umbrella: 400, acUnit: 380, cage: 380, waterTank: 900, bush: 450, railPost: 600, tunnelLamp: 650 };
  function ensure(name) {
    if (lazy.has(name)) return;
    const d = DEFS[name];
    if (!d) throw new Error(`unknown prop "${name}"`);
    inst.define(name, d(), { maxDistance: CULL[name] ?? Infinity });
    lazy.set(name, true);
  }
  // colliders for blocking props: [type, size]
  const COLLIDE = { betelPalm: ['c', 0.13], banana: ['c', 0.15], cedar: ['c', 0.3], broadleaf: ['c', 0.28], banyan: ['c', 0.85], cherry: ['c', 0.2], bamboo: ['c', 0.5], rock: ['b', 1.2, 0.9, 0.7], parkedCar: ['b', 0.86, 2.15, 1.4], shrine: ['b', 0.8, 0.7, 1.9], stall: ['b', 1.2, 0.6, 2.3], chevron: ['c', 0.06], lampPole: ['c', 0.18], palm: ['c', 0.3], tree: ['c', 0.35], container20: ['b', 1.22, 3.03, 2.6], container40: ['b', 1.22, 6.1, 2.6], waterBarrier: ['b', 0.9, 0.25, 0.8], pillar: ['b', 0.5, 0.5, 1], mirror: ['c', 0.08], trafficLight: ['c', 0.15], vending: ['b', 0.5, 0.4, 1.9], waterTank: null, bollard: ['c', 0.1], betelStand: ['b', 1.2, 1.0, 2.4], powerPole: ['c', 0.2], busStop: ['b', 2, 0.1, 2.6], crate: ['b', 0.6, 0.6, 1], drum: ['c', 0.3] };

  const props = {
    names: PROP_NAMES,
    define(name, parts, opts) { if (lazy.has(name)) return; DEFS[name] = () => parts; ensure(name); },
    has(name) { return lazy.has(name) || !!DEFS[name]; },
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
