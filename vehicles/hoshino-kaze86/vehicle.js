// PLACEHOLDER car (prototype geometry). Replace model.build with a detailed model; keep the specs block.
// Archetype: 1980s light rear-drive hatch coupe. Cheap, rev-happy, the classic touge drift starter.
export default {
  id: 'hoshino-kaze86',
  name: 'Kaze 86',
  make: 'Hoshino',
  year: 1986,
  country: 'JP',
  price: 680000,
  starter: true,
  placeholder: true,
  tags: ['jdm', 'drift', 'lightweight', 'rwd'],
  description: 'Featherweight rear-drive hatch with a screaming 1.6 twin-cam. Low grip, perfect balance, endless lessons.',

  specs: {
    mass: 970,
    weightFront: 0.53,
    cgHeight: 0.47,
    wheelbase: 2.4,
    track: [1.355, 1.365],
    dimensions: [4.18, 1.625, 1.335],
    bodyOffsetZ: -0.045,
    clearance: 0.16,
    engine: {
      layout: 'I4', displacement: 1.6, aspiration: 'NA', idle: 900, redline: 7600, limiter: 7900, inertia: 0.12,
      torque: [[1000, 96], [2000, 112], [3000, 124], [4000, 134], [5000, 143], [5800, 147], [6600, 141], [7400, 128], [8000, 112]],
    },
    transmission: { gears: [3.587, 2.022, 1.384, 1.0, 0.861], reverse: 3.484, final: 4.3, shiftTime: 0.22 },
    drivetrain: 'RWD',
    diff: { type: 'lsd', accel: 0.2, decel: 0.1, preload: 30 },
    steering: { lock: 36, ratio: 16, ackermann: 0.65, caster: 5 },
    suspension: {
      front: { spring: 24000, travel: [0.1, 0.12], camber: -0.8, toe: 0, arb: 9000, rollCenter: 0.06 },
      rear: { spring: 22000, travel: [0.1, 0.13], camber: -0.3, toe: 0.1, arb: 4500, rollCenter: 0.12 },
    },
    brakes: { torque: 3600, bias: 0.64, handbrake: 1700 },
    tires: { compound: 'street', width: [185, 185], radius: [0.29, 0.29], pressure: [2.1, 2.1], wheelMass: 17 },
    aero: { cd: 0.34, area: 1.82, downforce: [-0.02, 0.0] },
  },

  visual: {
    paint: { color: '#e9e6dc', finish: 'gloss' },
    paints: ['#e9e6dc', '#c2312a', '#14161a', '#d9d2c0', '#2a3d5c'],
    slots: {
      rims: { name: 'Rims', zh: '輪框', options: [
        { id: 'spoke5', name: '5-spoke', price: 0 }, { id: 'mesh', name: 'Cross mesh', price: 42000 }, { id: 'dish', name: 'Deep dish', price: 36000 },
        { id: 'split6', name: 'Split 6', price: 38000 }, { id: 'steelie', name: 'Steelie', price: 9000 }, { id: 'turbofan', name: 'Turbofan', price: 45000 }] },
      spoiler: { name: 'Spoiler', zh: '尾翼', options: [{ id: 'none', name: 'None', price: 0 }, { id: 'lip', name: 'Hatch lip', price: 8000 }, { id: 'gt', name: 'GT wing', price: 26000 }] },
      tint: { name: 'Window tint', zh: '隔熱紙', options: [{ id: 'light', name: 'Light', price: 0 }, { id: 'dark', name: 'Dark', price: 6000 }] },
    },
  },

  model: {
    build({ THREE, kit, spec, visual, parts, interior }) {
      const { geo, ext, presets, M } = kit;
      const body = new THREE.Group();
      const R = spec.tires.radius[0], wb = spec.wheelbase;
      // ---- lower body shell
      const shellGeo = geo.shell({
        z0: -2.12, z1: 2.03,
        top: [[-2.12, 0.64], [-2.04, 0.84], [-1.75, 0.91], [-1.0, 0.92], [0, 0.9], [0.72, 0.86], [1.5, 0.78], [1.92, 0.7], [2.03, 0.58]],
        bottom: [[-2.12, 0.3], [-1.92, 0.19], [1.82, 0.17], [2.03, 0.3]],
        halfWidth: [[-2.12, 0.7], [-1.95, 0.79], [-1.2, 0.81], [1.2, 0.81], [1.86, 0.79], [2.03, 0.7]],
        shoulder: 0.64, tumble: 0.05, roundTop: 3.6, roundBottom: 5,
        arches: [{ z: wb / 2, y: R, r: 0.36, depth: 0.13 }, { z: -wb / 2, y: R, r: 0.37, depth: 0.13 }],
        segZ: kit.seg(64), segU: kit.seg(12),
      });
      body.add(kit.mesh(shellGeo, kit.paint, { receive: true }));
      // black 80s bumpers + side strip
      body.add(presets.trimBand({ z0: 1.93, z1: 2.07, y: 0.43, halfWidth: 0.78, height: 0.15 }));
      body.add(presets.trimBand({ z0: -2.16, z1: -2.02, y: 0.45, halfWidth: 0.77, height: 0.15 }));
      // cabin (hatchback: long rear glass)
      const tint = visual.mods.tint === 'dark' ? 0x07090a : 0x1a2226;
      body.add(presets.cabin({ zA: 0.72, zRF: 0.05, zRR: -0.85, zC: -1.8, yBelt: 0.9, yRoof: 1.33, hwBelt: 0.77, hwRoof: 0.6, tint, pillarColor: 0x111112 }));
      // lights, mirrors, plates, exhaust
      for (const s of [1, -1]) {
        body.add(ext.headlight({ pos: [s * 0.55, 0.64, 2.04], size: [0.32, 0.09], shape: 'rect' }));
        body.add(ext.taillight({ pos: [s * 0.52, 0.76, -2.13], size: [0.44, 0.13], shape: 'rect' }));
        body.add(ext.sideMirror({ pos: [0.79, 0.98, 0.6], side: s }));
        body.add(ext.wheelWell({ x: s * 0.66, z: wb / 2, y: R, radius: 0.35, width: 0.3 }));
        body.add(ext.wheelWell({ x: s * 0.66, z: -wb / 2, y: R, radius: 0.36, width: 0.3 }));
      }
      body.add(ext.grille({ pos: [0, 0.6, 2.035], size: [0.5, 0.07] }));
      body.add(ext.plate({ pos: [0, 0.46, -2.17], text: 'KZ-8686' }));
      body.add(ext.plate({ pos: [0, 0.43, 2.08], text: 'KZ-8686', rear: false }));
      body.add(ext.exhaust({ pos: [-0.42, 0.26, -2.12], radius: 0.035 }));
      body.add(ext.wipers({ y: 0.93, z: 0.66, width: 1.0 }));
      body.add(ext.antenna({ pos: [-0.6, 1.0, 0.7] }));
      // spoiler (cosmetic slot) or performance wing (parts)
      const wing = visual.mods.spoiler !== 'none' ? visual.mods.spoiler : (parts.rearAero && parts.rearAero !== 'stock' ? 'gt' : 'none');
      if (wing === 'lip') body.add(ext.wing({ style: 'lip', z: -1.78, y: 1.24, width: 1.1, chord: 0.2 }));
      if (wing === 'gt') body.add(ext.wing({ style: 'gt', z: -1.98, y: 0.92, width: 1.45, chord: 0.24, height: 0.24 }));
      if (parts.frontAero && parts.frontAero !== 'stock') body.add(ext.splitter({ z: 2.02, y: 0.18, width: 1.5 }));
      // interior
      let eye = [0.37, 1.1, -0.3];
      if (interior) {
        const inn = presets.interior({ driverX: 0.37, floorY: 0.24, seatY: 0.27, seatZ: -0.35, dashZ: 0.5, dashY: 0.84, halfWidth: 0.66, seats: parts.cage && parts.cage !== 'stock' ? 'bucket' : 'stock', seatColor: 0x2b2522, trim: 0x1c1a19, headUnit: { size: [0.18, 0.1], style: 'doubleDin', tilt: 4, pos: [0, 0.74, 0.58] }, cluster: { type: 'analog2', maxSpeed: 220 }, cage: parts.cage && parts.cage !== 'stock', roofY: 1.3 });
        body.add(inn.group);
        eye = inn.eye;
      }
      return {
        body,
        anchors: { cockpit: eye, hood: [0, 1.02, 0.45], bumper: [0, 0.55, 2.1], chase: [0, 1.6, -5.2] },
      };
    },
  },
};
