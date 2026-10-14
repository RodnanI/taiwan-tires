// TEMPLATE: copy this folder to vehicles/<your-id>/ and set `id` to the folder name.
// Folders starting with "_" are never loaded, so this file is documentation that also builds and validates:
//   cp -r vehicles/_template vehicles/my-car && npm run validate -- --only my-car
// Full field reference: vehicles/AGENTS.md. Units are SI. Vehicle space: +Z forward, +Y up, +X = car's LEFT
// (driver side, Taiwan is left-hand drive). Origin: on the ground, centred between the axles and the wheels.
export default {
  id: 'template-coupe',
  name: 'Template Coupe',
  make: 'Hoshino',            // fictional makes only
  year: 1999,
  country: 'JP',
  price: 900000,              // NT$
  placeholder: true,          // remove once the model is detailed
  hidden: true,               // keep out of the dealer while you work on it
  tags: ['template'],
  description: 'Front-engine rear-drive coupe used as the starting point for new cars.',

  // ---------------------------------------------------------------- physics (no geometry here)
  specs: {
    mass: 1240,               // kg with driver
    weightFront: 0.53,
    cgHeight: 0.48,           // m above ground
    wheelbase: 2.52,
    track: [1.48, 1.47],      // [front, rear] wheel centre to wheel centre
    dimensions: [4.42, 1.73, 1.3], // collision box [length, width (no mirrors), height]
    bodyOffsetZ: -0.05,       // body box centre vs wheelbase centre
    clearance: 0.13,
    engine: {
      layout: 'I6', displacement: 2.5, aspiration: 'NA', idle: 850, redline: 7200, limiter: 7500, inertia: 0.15,
      // full-throttle crank torque without boost, [rpm, Nm]; last point at or past the limiter
      torque: [[1000, 180], [2500, 225], [4000, 250], [5000, 256], [6000, 246], [7000, 222], [7600, 200]],
    },
    transmission: { gears: [3.6, 2.13, 1.45, 1.1, 0.88], reverse: 3.4, final: 4.1, shiftTime: 0.2 },
    drivetrain: 'RWD',
    diff: { type: 'lsd', accel: 0.3, decel: 0.15, preload: 50 },
    steering: { lock: 36, ratio: 15, ackermann: 0.6, caster: 6 },
    suspension: {
      // leave spring/bump/rebound/arb out to get defaults from mass and weight split (1.65 / 1.8 Hz)
      front: { travel: [0.1, 0.12], camber: -1.0, toe: 0, rollCenter: 0.07 },
      rear: { travel: [0.1, 0.13], camber: -0.6, toe: 0.1, rollCenter: 0.11 },
    },
    brakes: { torque: 4800, bias: 0.64, handbrake: 2000 },
    tires: { compound: 'sport', width: [215, 225], radius: [0.31, 0.31], pressure: [2.2, 2.2], wheelMass: 19 },
    aero: { cd: 0.32, area: 1.95, downforce: [-0.03, 0.01] },
  },

  // optional: forbid parts for this car ('slot' or 'slot:level')
  upgrades: { exclude: [] },

  // ---------------------------------------------------------------- paint shop options
  visual: {
    paint: { color: '#2f3d4a', finish: 'metallic' },  // gloss metallic pearl satin matte candy chrome
    paints: ['#2f3d4a', '#d9d6cf', '#8c1d1d', '#111214'],
    slots: {
      rims: { name: 'Rims', zh: '輪框', options: [{ id: 'split6', name: 'Split 6', price: 0 }, { id: 'spoke5', name: '5-spoke', price: 30000 }, { id: 'mesh', name: 'Cross mesh', price: 42000 }] },
      spoiler: { name: 'Spoiler', zh: '尾翼', options: [{ id: 'none', name: 'None', price: 0 }, { id: 'ducktail', name: 'Ducktail', price: 18000 }] },
    },
  },

  // ---------------------------------------------------------------- 3D model
  model: {
    /**
     * ctx: { THREE, kit, spec (working spec incl. parts), visual { paint, mods }, parts, interior (bool), detail, accent }
     * Build everything EXCEPT wheels (the runtime builds and animates them from spec + visual.mods.rims).
     * Return { body, anchors: { cockpit, hood?, bumper? } }.
     */
    build({ THREE, kit, spec, visual, parts, interior }) {
      const { geo, ext, presets } = kit;
      const body = new THREE.Group();
      const R = spec.tires.radius[0], wb = spec.wheelbase, L = spec.dimensions[0];
      const zF = L / 2 + spec.bodyOffsetZ, zR = -L / 2 + spec.bodyOffsetZ; // bumper faces

      // Body shell from profiles. top/bottom: centreline heights along z; halfWidth: plan view.
      // Replace with lofted panels (geo.loft) for a detailed car; keep the arches where the wheels are.
      const shell = geo.shell({
        z0: zR, z1: zF,
        top: [[zR, 0.62], [zR + 0.12, 0.8], [zR + 0.5, 0.86], [-0.6, 0.88], [0.6, 0.84], [1.4, 0.76], [zF - 0.12, 0.66], [zF, 0.54]],
        bottom: [[zR, 0.32], [zR + 0.25, 0.18], [zF - 0.3, 0.16], [zF, 0.3]],
        halfWidth: [[zR, 0.74], [zR + 0.25, 0.85], [-1.0, 0.86], [1.0, 0.86], [zF - 0.25, 0.84], [zF, 0.74]],
        shoulder: 0.62, tumble: 0.06, roundTop: 3.4, roundBottom: 5,
        arches: [{ z: wb / 2, y: R, r: R + 0.05, depth: 0.12 }, { z: -wb / 2, y: R, r: R + 0.05, depth: 0.12 }],
        segZ: kit.seg(64), segU: kit.seg(12),
      });
      body.add(kit.mesh(shell, kit.paint, { receive: true }));
      body.add(presets.trimBand({ z0: zF - 0.12, z1: zF + 0.03, y: 0.4, halfWidth: 0.82, height: 0.16 }));
      body.add(presets.trimBand({ z0: zR - 0.03, z1: zR + 0.12, y: 0.42, halfWidth: 0.82, height: 0.16 }));

      // Greenhouse: windscreen base zA, roof front/rear zRF/zRR, rear screen base zC.
      const tint = visual.mods?.tint === 'dark' ? 0x07090a : 0x172026;
      body.add(presets.cabin({ zA: 0.85, zRF: 0.1, zRR: -0.75, zC: -1.45, yBelt: 0.88, yRoof: 1.3, hwBelt: 0.8, hwRoof: 0.62, tint }));

      // Lamps register themselves (headlight anchors for real spot lights, brake/reverse materials).
      for (const s of [1, -1]) {
        body.add(ext.headlight({ pos: [s * 0.6, 0.62, zF - 0.02], size: [0.3, 0.1], shape: 'slim' }));
        body.add(ext.taillight({ pos: [s * 0.58, 0.72, zR + 0.01], size: [0.36, 0.11], shape: 'rect' }));
        body.add(ext.sideMirror({ pos: [0.84, 0.95, 0.7], side: s }));
        body.add(ext.wheelWell({ x: s * 0.68, z: wb / 2, y: R, radius: R + 0.04, width: 0.3 }));
        body.add(ext.wheelWell({ x: s * 0.68, z: -wb / 2, y: R, radius: R + 0.04, width: 0.3 }));
      }
      body.add(ext.grille({ pos: [0, 0.48, zF], size: [0.6, 0.12] }));
      body.add(ext.plate({ pos: [0, 0.45, zR - 0.03], text: 'TMP-1999' }));
      body.add(ext.plate({ pos: [0, 0.38, zF + 0.03], text: 'TMP-1999', rear: false }));
      body.add(ext.exhaust({ pos: [-0.45, 0.25, zR + 0.02], radius: 0.04, count: 2, spacing: 0.1 })); // anchors for flames
      body.add(ext.wipers({ y: 0.9, z: 0.82, width: 1.05 }));

      // Cosmetic slot from the paint shop, then performance parts that should be visible.
      if (visual.mods?.spoiler === 'ducktail') body.add(ext.wing({ style: 'ducktail', z: zR + 0.2, y: 0.86, width: 1.3, chord: 0.22 }));
      else if (parts.rearAero && parts.rearAero !== 'stock') body.add(ext.wing({ style: 'gt', z: zR + 0.12, y: 0.9, width: 1.45, chord: 0.25, height: 0.24 }));
      if (parts.frontAero && parts.frontAero !== 'stock') body.add(ext.splitter({ z: zF - 0.02, y: 0.16, width: 1.55 }));

      // Interior: skipped for AI / distant cars (interior === false).
      let eye = [0.37, 1.08, -0.35];
      if (interior) {
        const inn = presets.interior({
          driverX: 0.37, floorY: 0.24, seatY: 0.28, seatZ: -0.4, dashZ: 0.55, dashY: 0.82, halfWidth: 0.7, roofY: 1.27,
          seats: parts.cage && parts.cage !== 'stock' ? 'bucket' : 'stock', cage: parts.cage && parts.cage !== 'stock',
          cluster: { type: 'analog2', maxSpeed: 260 },
          // 16:9 screen: the menu UI (1280x720) is mapped onto exactly this rectangle
          headUnit: { size: [0.22, 0.124], style: 'integrated', tilt: 10, pos: [0, 0.76, 0.6] },
        });
        body.add(inn.group);
        eye = inn.eye;
      }
      return { body, anchors: { cockpit: eye, hood: [0, 1.0, 0.5], bumper: [0, 0.5, zF + 0.05] } };
    },
  },
};
