// PLACEHOLDER car (prototype geometry). Replace model.build with a detailed model; keep the specs block.
// Archetype: front-engine V8 grand tourer. Long hood, fastback, lazy torque that lights the rears anywhere.
export default {
  id: 'yushan-typhoon',
  name: 'Typhoon GT',
  make: 'Yushan',
  year: 2019,
  country: 'TW',
  price: 2950000,
  placeholder: true,
  tags: ['v8', 'gt', 'rwd', 'highway'],
  description: 'Five litres of naturally aspirated V8 from Taiwan\'s own fictional supercar maker. Fast on the expressway, sideways everywhere else.',

  specs: {
    mass: 1560,
    weightFront: 0.53,
    cgHeight: 0.49,
    wheelbase: 2.72,
    track: [1.6, 1.62],
    dimensions: [4.68, 1.89, 1.32],
    bodyOffsetZ: 0.02,
    clearance: 0.13,
    engine: {
      layout: 'V8', displacement: 5.0, aspiration: 'NA', idle: 750, redline: 7200, limiter: 7500, inertia: 0.24,
      torque: [[1000, 380], [2000, 440], [3000, 490], [4000, 525], [4800, 540], [5600, 530], [6400, 505], [7200, 460], [7600, 430]],
    },
    transmission: { gears: [3.01, 2.07, 1.43, 1.0, 0.84, 0.62], reverse: 3.28, final: 3.55, shiftTime: 0.16 },
    drivetrain: 'RWD',
    diff: { type: 'lsd', accel: 0.45, decel: 0.25, preload: 80 },
    steering: { lock: 35, ratio: 13, ackermann: 0.55, caster: 6.5 },
    suspension: {
      front: { spring: 46000, travel: [0.09, 0.11], camber: -1.4, toe: 0, arb: 26000, rollCenter: 0.06 },
      rear: { spring: 50000, travel: [0.09, 0.12], camber: -1.1, toe: 0.12, arb: 17000, rollCenter: 0.1 },
    },
    brakes: { torque: 7200, bias: 0.6, handbrake: 2100 },
    tires: { compound: 'sport', width: [255, 285], radius: [0.34, 0.345], pressure: [2.3, 2.3], wheelMass: 23 },
    aero: { cd: 0.33, area: 2.1, downforce: [0.08, 0.16] },
  },

  visual: {
    paint: { color: '#b3261e', finish: 'metallic' },
    paints: ['#b3261e', '#101113', '#d7d5cf', '#3f5a3a', '#c98c1f'],
    slots: {
      rims: { name: 'Rims', zh: '輪框', options: [
        { id: 'multi', name: '10-spoke forged', price: 0 }, { id: 'spoke5', name: '5-spoke', price: 30000 }, { id: 'turbofan', name: 'Turbofan', price: 52000 }, { id: 'mesh', name: 'Cross mesh', price: 50000 }] },
      spoiler: { name: 'Spoiler', zh: '尾翼', options: [{ id: 'ducktail', name: 'Ducktail', price: 0 }, { id: 'none', name: 'Smooth', price: 0 }, { id: 'swan', name: 'Swan-neck wing', price: 48000 }] },
      tint: { name: 'Window tint', zh: '隔熱紙', options: [{ id: 'dark', name: 'Dark', price: 0 }, { id: 'light', name: 'Light', price: 0 }] },
    },
  },

  model: {
    build({ THREE, kit, spec, visual, parts, interior }) {
      const { geo, ext, presets } = kit;
      const body = new THREE.Group();
      const R = spec.tires.radius[0], wb = spec.wheelbase;
      kit.wheels({ color: 0x2a2b2e, caliperColor: 0xd8b02a, rimRatio: 0.72 });
      body.add(kit.mesh(geo.shell({
        z0: -2.32, z1: 2.36,
        top: [[-2.32, 0.72], [-2.22, 0.92], [-1.96, 0.97], [-1.5, 0.96], [-1.0, 0.93], [0.5, 0.9], [1.4, 0.82], [2.1, 0.72], [2.36, 0.56]],
        bottom: [[-2.32, 0.3], [-2.06, 0.16], [2.02, 0.15], [2.36, 0.26]],
        halfWidth: [[-2.32, 0.84], [-2.0, 0.93], [-1.36, 0.945], [-0.4, 0.9], [0.4, 0.9], [1.36, 0.94], [2.0, 0.9], [2.36, 0.8]],
        shoulder: [[-2.3, 0.6], [-1.36, 0.5], [0, 0.6], [1.36, 0.52], [2.3, 0.6]], tumble: 0.1, roundTop: 2.8, roundBottom: 4,
        arches: [{ z: wb / 2, y: R, r: 0.41, depth: 0.15 }, { z: -wb / 2, y: R, r: 0.42, depth: 0.15 }],
        segZ: kit.seg(72), segU: kit.seg(14),
      }), kit.paint, { receive: true }));
      // hood power bulge + vents
      body.add(kit.mesh(geo.shell({ z0: 0.6, z1: 1.9, top: [[0.6, 0.94], [1.2, 0.93], [1.9, 0.84]], bottom: 0.8, halfWidth: [[0.6, 0.3], [1.9, 0.22]], shoulder: 0.3, roundTop: 2.4, segZ: 20, segU: 6 }), kit.paint));
      for (const s of [1, -1]) body.add(kit.mesh(geo.box(0.16, 0.012, 0.32), kit.mat.plastic(0x050505), { pos: [s * 0.48, 0.885, 1.35], rot: [0.08, 0, 0] }));
      const tint = visual.mods.tint === 'light' ? 0x1a2226 : 0x07090a;
      body.add(presets.cabin({ zA: 0.58, zRF: -0.08, zRR: -0.72, zC: -1.78, yBelt: 0.92, yRoof: 1.31, hwBelt: 0.82, hwRoof: 0.6, tint, bPillar: false }));
      for (const s of [1, -1]) {
        body.add(ext.headlight({ pos: [s * 0.66, 0.74, 2.24], size: [0.38, 0.08], shape: 'slim', yaw: s * 0.35, rake: 0.3 }));
        body.add(ext.taillight({ pos: [s * 0.62, 0.86, -2.3], size: [0.4, 0.07], shape: 'rect', reverse: false, yaw: -s * 0.15 }));
        body.add(ext.sideMirror({ pos: [0.86, 1.0, 0.45], side: s }));
        body.add(ext.wheelWell({ x: s * 0.78, z: wb / 2, y: R, radius: 0.4, width: 0.34 }));
        body.add(ext.wheelWell({ x: s * 0.78, z: -wb / 2, y: R, radius: 0.41, width: 0.36 }));
        body.add(ext.exhaust({ pos: [s * 0.55, 0.27, -2.31], radius: 0.042, count: 2, spacing: 0.1 }));
      }
      body.add(ext.grille({ pos: [0, 0.42, 2.34], size: [1.0, 0.24], rake: -0.35 }));
      body.add(ext.plate({ pos: [0, 0.58, -2.34], text: 'YS-0001' }));
      body.add(ext.wipers({ y: 0.93, z: 0.55, width: 1.2 }));
      const sp = visual.mods.spoiler || 'ducktail';
      if (sp === 'ducktail') body.add(ext.wing({ style: 'ducktail', z: -2.02, y: 0.97, width: 1.5, chord: 0.18 }));
      if (sp === 'swan' || (parts.rearAero && parts.rearAero !== 'stock')) body.add(ext.wing({ style: 'swan', z: -2.0, y: 0.95, width: 1.6, chord: 0.3, height: 0.3 }));
      if (parts.frontAero && parts.frontAero !== 'stock') body.add(ext.splitter({ z: 2.3, y: 0.15, width: 1.75 }));
      let eye = [0.38, 1.08, -0.45];
      if (interior) {
        const inn = presets.interior({ driverX: 0.38, floorY: 0.2, seatY: 0.22, seatZ: -0.45, dashZ: 0.42, dashY: 0.83, halfWidth: 0.74, seats: 'bucket', seatColor: 0x2c1a14, accent: 0xb3261e, trim: 0x151516, headUnit: { size: [0.26, 0.15], style: 'tablet', tilt: 10, pos: [0, 0.97, 0.52] }, cluster: { type: 'digital', maxSpeed: 320 }, wheel: { style: 'flatBottom' }, cage: parts.cage && parts.cage !== 'stock', roofY: 1.28, rearSeat: false, shifter: 'seq' });
        body.add(inn.group);
        eye = inn.eye;
      }
      return { body, anchors: { cockpit: eye, hood: [0, 1.04, 0.35], bumper: [0, 0.5, 2.4] } };
    },
  },
};
