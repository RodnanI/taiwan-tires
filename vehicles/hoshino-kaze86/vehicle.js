// Hoshino Kaze 86 (1986): light rear-drive hatch coupe, the touge drift starter. Model: body.js (exterior,
// pop-up headlamps animate with the lights) and cabin.js (80s interior); see vehicles/AGENTS.md "Body toolkit".
import { buildExterior } from './body.js';
import { buildCabin } from './cabin.js';
export default {
  id: 'hoshino-kaze86',
  name: 'Kaze 86',
  make: 'Hoshino',
  year: 1986,
  country: 'JP',
  price: 680000,
  starter: true,
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
        { id: 'split6', name: 'Split 6', price: 38000 }, { id: 'steelie', name: 'Steelie', price: 9000 }, { id: 'turbofan', name: 'Turbofan', price: 45000 },
        { id: 'eight', name: 'Classic 8-spoke', price: 40000 }] },
      spoiler: { name: 'Spoiler', zh: '尾翼', options: [{ id: 'none', name: 'None', price: 0 }, { id: 'lip', name: 'Hatch lip', price: 8000 }, { id: 'gt', name: 'GT wing', price: 26000 }] },
      tint: { name: 'Window tint', zh: '隔熱紙', options: [{ id: 'light', name: 'Light', price: 0 }, { id: 'dark', name: 'Dark', price: 6000 }] },
      livery: { name: 'Two-tone', zh: '雙色', options: [{ id: 'none', name: 'Single colour', price: 0 }, { id: 'panda', name: 'Panda (black lower)', price: 15000 }] },
    },
  },

  model: {
    build(ctx) {
      const { THREE, kit, interior } = ctx;
      const body = new THREE.Group();
      kit.wheels({ rimRatio: 0.585, lugs: 4, color: 0xc4c6ca, caliperColor: 0x34363a });
      const ex = buildExterior(ctx);
      body.add(ex.group);
      let eye = [0.37, 1.075, -0.36];
      if (interior) {
        const cab = buildCabin(ctx, ex);
        body.add(cab.group);
        eye = cab.eye;
      }
      return { body, animate: ex.animate, anchors: { cockpit: eye, hood: [0, 0.98, 0.64], bumper: [0, 0.55, 2.1] } };
    },
  },
};
