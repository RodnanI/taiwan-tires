// Yushan Typhoon GT (2019): front-engine V8 grand tourer from Taiwan's fictional supercar maker. Model: body.js
// (exterior) and cabin.js (interior); see vehicles/AGENTS.md "Body toolkit".
import { buildExterior } from './body.js';
import { buildCabin } from './cabin.js';
export default {
  id: 'yushan-typhoon',
  name: 'Typhoon GT',
  make: 'Yushan',
  year: 2019,
  country: 'TW',
  price: 2950000,
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
        { id: 'multi', name: '10-spoke forged', price: 0 }, { id: 'y5', name: 'Y-spoke', price: 46000 }, { id: 'aero', name: 'Aero disc', price: 58000 },
        { id: 'spoke5', name: '5-spoke', price: 30000 }, { id: 'turbofan', name: 'Turbofan', price: 52000 }, { id: 'mesh', name: 'Cross mesh', price: 50000 }] },
      spoiler: { name: 'Spoiler', zh: '尾翼', options: [{ id: 'ducktail', name: 'Ducktail', price: 0 }, { id: 'none', name: 'Smooth', price: 0 }, { id: 'swan', name: 'Swan-neck wing', price: 48000 }] },
      tint: { name: 'Window tint', zh: '隔熱紙', options: [{ id: 'dark', name: 'Dark', price: 0 }, { id: 'light', name: 'Light', price: 0 }] },
      roof: { name: 'Roof', zh: '車頂', options: [{ id: 'body', name: 'Body colour', price: 0 }, { id: 'gloss', name: 'Gloss black', price: 12000 }, { id: 'carbon', name: 'Exposed carbon', price: 38000 }] },
      mirrors: { name: 'Mirror caps', zh: '後視鏡蓋', options: [{ id: 'body', name: 'Body colour', price: 0 }, { id: 'carbon', name: 'Carbon', price: 9000 }] },
    },
  },

  model: {
    build(ctx) {
      const { THREE, kit, interior } = ctx;
      const body = new THREE.Group();
      kit.wheels({ rimRatio: 0.74, lugs: 5, color: 0x2a2b2e, caliperColor: 0xd8b02a });
      const ex = buildExterior(ctx);
      body.add(ex.group);
      let eye = [0.38, 1.02, -0.45];
      if (interior) {
        const cab = buildCabin(ctx, ex);
        body.add(cab.group);
        eye = cab.eye;
      }
      return { body, anchors: { cockpit: eye, hood: [0, 0.99, 0.56], bumper: [0, 0.45, 2.4] } };
    },
  },
};
