// Tenmaru RS-4 Type R (2006): turbo flat-four AWD rally saloon. Model: body.js (exterior) and cabin.js (interior);
// see vehicles/AGENTS.md "Body toolkit".
import { buildExterior } from './body.js';
import { buildCabin } from './cabin.js';
export default {
  id: 'tenmaru-rs4',
  name: 'RS-4 Type R',
  make: 'Tenmaru',
  year: 2006,
  country: 'JP',
  price: 1680000,
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
        { id: 'spoke5', name: '5-spoke gold', price: 0 }, { id: 'rays6', name: 'Forged 6-spoke', price: 52000 }, { id: 'twin5', name: 'Twin 5-spoke', price: 41000 },
        { id: 'split6', name: 'Split 6', price: 39000 }, { id: 'multi', name: '10-spoke', price: 44000 }, { id: 'mesh', name: 'Cross mesh', price: 48000 }] },
      wing: { name: 'Wing', zh: '尾翼', options: [{ id: 'stock', name: 'Factory tall wing', price: 0 }, { id: 'none', name: 'Delete', price: 3000 }, { id: 'gt', name: 'Carbon GT wing', price: 32000 }] },
      tint: { name: 'Window tint', zh: '隔熱紙', options: [{ id: 'light', name: 'Light', price: 0 }, { id: 'dark', name: 'Dark', price: 6000 }] },
      mudflaps: { name: 'Mud flaps', zh: '擋泥板', options: [{ id: 'on', name: 'Rally flaps', price: 0 }, { id: 'off', name: 'Removed', price: 0 }] },
      vortex: { name: 'Roof fins', zh: '車頂導流鰭', options: [{ id: 'on', name: 'Black vortex fins', price: 0 }, { id: 'body', name: 'Body colour fins', price: 4000 }, { id: 'off', name: 'Removed', price: 0 }] },
    },
  },

  model: {
    build(ctx) {
      const { THREE, kit, interior } = ctx;
      const body = new THREE.Group();
      kit.wheels({ rimRatio: 0.69, lugs: 5, color: 0xc9a54a, caliperColor: 0xc4161c });
      const ex = buildExterior(ctx);
      body.add(ex.group);
      let eye = [0.38, 1.165, 0.06];
      if (interior) {
        const cab = buildCabin(ctx, ex);
        body.add(cab.group);
        eye = cab.eye;
      }
      return { body, anchors: { cockpit: eye, hood: [0, 1.11, 1.02], bumper: [0, 0.5, 2.3] } };
    },
  },
};
