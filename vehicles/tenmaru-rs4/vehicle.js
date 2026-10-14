// PLACEHOLDER car (prototype geometry). Replace model.build with a detailed model; keep the specs block.
// Archetype: rally-bred turbo AWD sedan. Boxer rumble, huge traction, loves wet mountain roads.
export default {
  id: 'tenmaru-rs4',
  name: 'RS-4 Type R',
  make: 'Tenmaru',
  year: 2006,
  country: 'JP',
  price: 1680000,
  placeholder: true,
  tags: ['jdm', 'awd', 'turbo', 'rally'],
  description: 'Turbo flat-four, symmetrical AWD and a wing you can see from space. Point it at a wet hairpin and floor it.',

  specs: {
    mass: 1430,
    weightFront: 0.59,
    cgHeight: 0.52,
    wheelbase: 2.65,
    track: [1.53, 1.54],
    dimensions: [4.59, 1.8, 1.47],
    bodyOffsetZ: -0.02,
    clearance: 0.15,
    engine: {
      layout: 'F4', displacement: 2.0, aspiration: 'turbo', idle: 800, redline: 7000, limiter: 7300, inertia: 0.16,
      torque: [[1000, 150], [2000, 190], [3000, 215], [4000, 222], [5000, 220], [6000, 205], [7000, 180], [7500, 165]],
      boost: { max: 1.05, spool: [2400, 3800], lag: 0.75, type: 'turbo', eff: 0.88 },
    },
    transmission: { gears: [3.636, 2.235, 1.521, 1.137, 0.971, 0.756], reverse: 3.55, final: 3.9, shiftTime: 0.2 },
    drivetrain: 'AWD',
    awdSplit: 0.41,
    diff: { type: 'lsd', accel: 0.35, decel: 0.2, preload: 50 },
    diffFront: { type: 'open' },
    centerDiff: { type: 'viscous', viscous: 160 },
    steering: { lock: 34, ratio: 13.5, ackermann: 0.6, caster: 5.5 },
    suspension: {
      front: { spring: 36000, travel: [0.11, 0.13], camber: -1.2, toe: 0, arb: 18000 },
      rear: { spring: 32000, travel: [0.11, 0.14], camber: -1.0, toe: 0.15, arb: 13000 },
    },
    brakes: { torque: 5600, bias: 0.62, handbrake: 2200 },
    tires: { compound: 'sport', width: [245, 245], radius: [0.33, 0.33], pressure: [2.3, 2.2], wheelMass: 21 },
    aero: { cd: 0.33, area: 2.15, downforce: [0.05, 0.12] },
  },

  visual: {
    paint: { color: '#1d3f8a', finish: 'pearl' },
    paints: ['#1d3f8a', '#e7e5df', '#141518', '#8c9196', '#c8b12a'],
    slots: {
      rims: { name: 'Rims', zh: '輪框', options: [
        { id: 'spoke5', name: '5-spoke gold', price: 0 }, { id: 'split6', name: 'Split 6', price: 39000 }, { id: 'multi', name: '10-spoke', price: 44000 }, { id: 'mesh', name: 'Cross mesh', price: 48000 }] },
      wing: { name: 'Wing', zh: '尾翼', options: [{ id: 'stock', name: 'Factory tall wing', price: 0 }, { id: 'none', name: 'Delete', price: 3000 }, { id: 'gt', name: 'Carbon GT wing', price: 32000 }] },
      tint: { name: 'Window tint', zh: '隔熱紙', options: [{ id: 'light', name: 'Light', price: 0 }, { id: 'dark', name: 'Dark', price: 6000 }] },
    },
  },

  model: {
    build({ THREE, kit, spec, visual, parts, interior }) {
      const { geo, ext, presets } = kit;
      const body = new THREE.Group();
      const R = spec.tires.radius[0], wb = spec.wheelbase;
      kit.wheels({ color: 0xc9a54a, caliperColor: 0x1a1a1a }); // gold rims, black calipers
      body.add(kit.mesh(geo.shell({
        z0: -2.31, z1: 2.27,
        top: [[-2.31, 0.7], [-2.22, 0.94], [-1.96, 1.01], [-1.45, 1.02], [-1.0, 1.0], [0.8, 0.98], [1.6, 0.88], [2.14, 0.78], [2.27, 0.62]],
        bottom: [[-2.31, 0.32], [-2.02, 0.2], [1.92, 0.19], [2.27, 0.3]],
        halfWidth: [[-2.31, 0.8], [-2.02, 0.88], [-1.32, 0.9], [1.32, 0.9], [2.0, 0.87], [2.27, 0.78]],
        shoulder: 0.6, tumble: 0.07, roundTop: 3.1, roundBottom: 5,
        arches: [{ z: wb / 2, y: R, r: 0.4, depth: 0.14 }, { z: -wb / 2, y: R, r: 0.4, depth: 0.14 }],
        segZ: kit.seg(64), segU: kit.seg(12),
      }), kit.paint, { receive: true }));
      // hood scoop
      body.add(kit.mesh(geo.roundedBox(0.52, 0.06, 0.36, 0.025, 2), kit.paint, { pos: [0, 0.99, 1.15], rot: [0.06, 0, 0] }));
      body.add(kit.mesh(geo.box(0.44, 0.035, 0.02), kit.mat.plastic(0x060606), { pos: [0, 1.0, 1.335] }));
      const tint = visual.mods.tint === 'dark' ? 0x07090a : 0x182024;
      body.add(presets.cabin({ zA: 0.86, zRF: 0.2, zRR: -0.92, zC: -1.45, yBelt: 0.99, yRoof: 1.46, hwBelt: 0.84, hwRoof: 0.67, tint, pillarColor: 0x0f0f10 }));
      for (const s of [1, -1]) {
        body.add(ext.headlight({ pos: [s * 0.6, 0.78, 2.2], size: [0.36, 0.12], shape: 'slim', yaw: s * 0.25 }));
        body.add(ext.taillight({ pos: [s * 0.6, 0.86, -2.29], size: [0.36, 0.14], shape: 'rect', yaw: -s * 0.2 }));
        body.add(ext.sideMirror({ pos: [0.86, 1.06, 0.72], side: s }));
        body.add(ext.wheelWell({ x: s * 0.74, z: wb / 2, y: R, radius: 0.39, width: 0.33 }));
        body.add(ext.wheelWell({ x: s * 0.74, z: -wb / 2, y: R, radius: 0.39, width: 0.33 }));
        body.add(ext.exhaust({ pos: [s * 0.48, 0.27, -2.3], radius: 0.045 }));
      }
      body.add(ext.grille({ pos: [0, 0.45, 2.27], size: [0.9, 0.2], rake: -0.2 }));
      body.add(ext.plate({ pos: [0, 0.6, -2.33], text: 'RS-4421' }));
      body.add(ext.plate({ pos: [0, 0.42, 2.29], text: 'RS-4421', rear: false }));
      body.add(ext.wipers({ y: 1.01, z: 0.8, width: 1.15 }));
      const wing = visual.mods.wing || 'stock';
      if (wing === 'stock') body.add(ext.wing({ style: 'gt', z: -2.0, y: 1.02, width: 1.38, chord: 0.22, height: 0.2, color: kit.paint }));
      if (wing === 'gt' || (wing === 'none' && parts.rearAero && parts.rearAero !== 'stock')) body.add(ext.wing({ style: 'gt', z: -2.05, y: 1.02, width: 1.55, chord: 0.28, height: 0.27 }));
      if (parts.frontAero && parts.frontAero !== 'stock') body.add(ext.splitter({ z: 2.24, y: 0.17, width: 1.65 }));
      let eye = [0.38, 1.2, -0.25];
      if (interior) {
        const inn = presets.interior({ driverX: 0.38, floorY: 0.26, seatY: 0.3, seatZ: -0.3, dashZ: 0.62, dashY: 0.92, halfWidth: 0.72, seats: 'bucket', seatColor: 0x1b1b1d, accent: 0x2f5fb8, trim: 0x18181a, headUnit: { size: [0.22, 0.13], style: 'integrated', tilt: 12, pos: [0, 0.94, 0.72] }, cluster: { type: 'analog2', maxSpeed: 280 }, cage: parts.cage && parts.cage !== 'stock', roofY: 1.43, shifter: 'h' });
        body.add(inn.group);
        eye = inn.eye;
      }
      return { body, anchors: { cockpit: eye, hood: [0, 1.12, 0.6], bumper: [0, 0.55, 2.32] } };
    },
  },
};
