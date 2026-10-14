// TEST MAP (foundation phase). A compact proving ground that exercises every system: circuit with kerbs and
// walls, an elevated expressway on pillars, an open container-yard drift zone, harbour water, gantry cranes,
// a Taiwanese shophouse street with signs, street lights and a distant skyline.
// World: +X east, -Z north, +Y up. Water lies south of the quay (z > 300).
export default {
  id: 'kaohsiung-harbor',
  name: 'Kaohsiung Harbor',
  nameZh: '高雄港',
  region: 'Kaohsiung',
  description: 'Container terminal proving ground. Night shifts, sodium lights, and a quay straight that ends in the sea if you miss the braking point.',
  placeholder: true,
  order: 0,
  seed: 7,
  preview: { colors: ['#0f1418', '#e39b3d'] },

  environment: { time: 21.5, timeScale: 0, weather: 'clear', fogDensity: 0.0006, cityGlow: 0.4, glowColor: '#c8926a', clouds: 0.3 },
  spawn: { pos: [-380, null, 255], heading: 90 },
  water: { level: -2.6, size: 6000, center: [0, 2200], color: 0x0a2129 },

  roads: [
    {
      id: 'harbor-loop', name: 'Harbor Loop', closed: true, width: 13, lanes: 2, markings: 'race', curbs: true, curbRadius: 160,
      shoulder: { width: 2, surface: 'concrete' },
      points: [
        [-420, 255], [-200, 255], [0, 255], [200, 255], [420, 255], [520, 240], [585, 180], [600, 90], [600, -40], [592, -140],
        [545, -190], [475, -172], [452, -112], [430, -40], [330, 0], [230, -40], [130, 10], [30, -30], [-100, -80], [-220, -170],
        [-330, -210], [-450, -200], [-530, -140], [-560, -40], [-560, 80], [-540, 180], [-490, 238],
      ],
      walls: [
        { from: 0, to: 900, right: 'barrier' },
        { from: 1150, to: 1560, left: 'tires', right: 'guardrail' },
        { from: 2600, to: 3400, left: 'guardrail' },
      ],
      lights: { spacing: 38, side: 'both', height: 10, intensity: 140, range: 38 },
    },
    {
      id: 'expressway', name: 'Harbor Expressway', closed: false, width: 15, lanes: 4, markings: 'double-yellow', bridge: true,
      shoulder: { width: 1.5, surface: 'concrete' }, smoothY: true, smoothPasses: 3,
      points: [
        [-760, 0.05, -120], [-760, 0.05, -200], [-752, 3, -280], [-720, 8, -332], [-640, 10, -352], [-300, 10, -352], [0, 10, -352],
        [300, 10, -352], [640, 10, -352], [722, 8, -332], [752, 3, -280], [760, 0.05, -200], [760, 0.05, -120],
      ],
      walls: { left: 'barrier', right: 'barrier' }, wallOffset: 0.3,
      lights: { spacing: 45, side: 'alternate', height: 9, intensity: 160, range: 40, color: 0xfff0d8 },
    },
    {
      id: 'gushan-street', name: 'Gushan Street', closed: false, width: 11, lanes: 2, markings: 'double-yellow', redCurb: true,
      shoulder: { width: 3.2, surface: 'concrete' },
      points: [[-640, -440], [-300, -440], [0, -440], [300, -440], [640, -440]],
      lights: { spacing: 30, side: 'both', height: 8, intensity: 110 },
    },
  ],

  events: [
    { id: 'harbor-circuit', type: 'circuit', name: 'Harbor Loop', nameZh: '港區環道', route: 'harbor-loop', laps: 3, ai: 7, rewards: { credits: [65000, 38000, 22000] }, description: 'Three laps of the container terminal. Mind the quay.' },
    { id: 'harbor-circuit-rev', type: 'circuit', name: 'Harbor Loop Reverse', nameZh: '港區環道（反向）', route: 'harbor-loop', reverse: true, laps: 2, ai: 5, rewards: { credits: [55000, 32000, 18000] } },
    { id: 'expressway-sprint', type: 'sprint', name: 'Expressway Sprint', nameZh: '快速道路衝刺', route: 'expressway', ai: 5, rewards: { credits: [50000, 30000, 16000] }, description: 'Up the ramp, flat out over the terminal, down the other side.' },
    { id: 'yard-drift', type: 'drift', name: 'Container Yard Drift', nameZh: '貨櫃場甩尾', timeLimit: 90, targets: [25000, 60000, 110000],
      route: { closed: true, width: 34, points: [[-330, 62], [-200, 48], [0, 52], [200, 48], [312, 72], [334, 140], [312, 212], [180, 224], [0, 220], [-200, 226], [-322, 210], [-346, 140]] },
      rewards: { credits: [45000, 28000, 15000] }, description: '90 seconds. Chain it around the stacks.' },
    { id: 'loop-timeattack', type: 'timeattack', name: 'Quay Time Attack', nameZh: '碼頭計時賽', route: 'harbor-loop', laps: 3, rewards: { credits: [30000, 18000, 9000] } },
  ],

  build({ THREE, kit }) {
    const { M, props } = kit;
    const r = kit.rand;
    // ---- concrete apron (the whole terminal is drivable)
    const apron = new THREE.PlaneGeometry(1640, 820, 41, 21);
    apron.rotateX(-Math.PI / 2);
    apron.translate(0, -0.06, -90);
    const apronMat = kit.M.textured('concrete', { repeat: 1, roughness: 0.92, color: 0x9d9a94 });
    const uv = apron.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 82, uv.getY(i) * 41);
    kit.addStatic(apron, apronMat, { cast: false, receive: true });
    kit.collision.triangles(apron, 'concrete');
    kit.env?.addWettable(apronMat);
    // quay edge: concrete lip + bollards (no wall: drive off and you swim)
    const lip = new THREE.BoxGeometry(1640, 3, 2); lip.translate(0, -1.55, 300.5);
    kit.addStatic(lip, kit.M.textured('concrete', { repeat: 1, color: 0x8d8a84 }), { cast: false });
    for (let x = -800; x <= 800; x += 18) props.place('bollard', [x, -0.06, 297], 0, [1.6, 0.6, 1.6], 0x2b2b2b);

    // ---- gantry cranes along the quay
    const craneMat = M.surface({ color: 0xc94b2a, roughness: 0.6, metalness: 0.3 });
    const craneWhite = M.surface({ color: 0xd9d6cf, roughness: 0.6, metalness: 0.3 });
    for (const cx of [-260, -60, 140, 340]) {
      const parts = [];
      for (const lx of [-9, 9]) for (const lz of [268, 296]) { const g = new THREE.BoxGeometry(1.4, 46, 1.4); g.translate(cx + lx, 23, lz); parts.push(g); kit.collision.box({ x: cx + lx, z: lz, hx: 0.8, hz: 0.8, y0: -1, y1: 46, kind: 'crane' }); }
      for (const lz of [268, 296]) { const g = new THREE.BoxGeometry(20, 2.2, 1.6); g.translate(cx, 45, lz); parts.push(g); }
      const boom = new THREE.BoxGeometry(3, 3, 120); boom.translate(cx, 48, 300); parts.push(boom);
      const back = new THREE.BoxGeometry(3, 3, 40); back.translate(cx, 48, 250); parts.push(back);
      kit.mesh(kit.merge(parts), craneMat);
      const cab = new THREE.BoxGeometry(5, 4, 6); cab.translate(cx, 44, 320);
      kit.mesh(cab, craneWhite);
      kit.light({ pos: [cx, 46, 300], color: 0xffe2b0, intensity: 260, range: 60 });
      kit.light({ pos: [cx, 46, 268], color: 0xffe2b0, intensity: 220, range: 55 });
    }

    // ---- container yard (drift zone): blocks inside the loop
    for (const bx of [-200, -80, 40, 160]) for (const bz of [100, 170]) {
      const high = 1 + Math.floor(r() * 3);
      for (let k = 0; k < 2; k++) props.containerStack([bx + k * 2.6, -0.06, bz], 0, { long: true, high });
      if (r() < 0.6) props.containerStack([bx + 2 * 2.6 + 0.2, -0.06, bz], 0, { long: false, high: 1 + Math.floor(r() * 2) });
    }
    // clipping cones
    for (const [x, z] of [[-270, 135], [-140, 135], [-20, 135], [100, 135], [222, 135], [280, 70], [280, 205], [-300, 205], [-300, 70]]) props.place('cone', [x, -0.06, z], r() * 6);
    // big stacks elsewhere
    for (let i = 0; i < 26; i++) {
      const x = -380 + (i % 13) * 62 + r() * 6, z = i < 13 ? -95 - r() * 8 : -150 - r() * 10;
      if (Math.abs(x - 30) < 40 || Math.abs(x + 100) < 30) continue;
      props.containerStack([x, -0.06, z + (i < 13 ? 30 : 10)], Math.PI / 2 + (r() - 0.5) * 0.06, { long: true, high: 2 + Math.floor(r() * 3) });
    }

    // ---- warehouses + depot north of the loop (under the expressway clearance)
    for (let x = -560; x <= 560; x += 90) {
      if (Math.abs(x) < 30) continue;
      kit.building({ x, z: -270, w: 60, d: 26, rotY: 0, style: 'warehouse', floors: 1, h: 7, signs: false });
    }
    // terminal office block
    kit.building({ x: -650, z: 230, w: 30, d: 22, rotY: Math.PI / 2, style: 'office', floors: 6 });

    // ---- Gushan Street: shophouses with qilou arcades, signs, scooters
    kit.row({ a: [-620, -447.2], b: [620, -447.2], depth: 18, side: 1, style: 'shophouse', minW: 7, maxW: 12, seed: 31, floors: [4, 8] });
    kit.row({ a: [-620, -432.8], b: [-120, -432.8], depth: 14, side: -1, style: ['shophouse', 'apartment'], minW: 8, maxW: 14, seed: 77 });
    kit.row({ a: [120, -432.8], b: [620, -432.8], depth: 14, side: -1, style: ['shophouse', 'apartment'], minW: 8, maxW: 14, seed: 91 });
    for (let x = -600; x <= 600; x += 3.2 + r() * 4) {
      if (r() < 0.62) props.place('scooter', [x, -0.02, -451.5 + r() * 0.8], Math.PI / 2 + (r() - 0.5) * 0.4, 1, [0xe8e6df, 0x1c1c1c, 0xc23a2a, 0x2f5d8a, 0xd9c36a][Math.floor(r() * 5)], { collide: false });
    }
    props.place('betelStand', [-90, -0.02, -428.5], Math.PI, 1);
    props.place('vending', [60, -0.02, -428.5], Math.PI, 1);
    props.place('vending', [61.2, -0.02, -428.5], Math.PI, 1);
    for (let x = -560; x <= 560; x += 46) props.place('palm', [x, -0.06, -428.0], r() * 6, 0.9 + r() * 0.3);
    props.place('busStop', [200, -0.02, -428.6], Math.PI, 1);

    // ---- palms and lamps around the apron edge, mirrors at the hairpin
    for (let z = -420; z <= 260; z += 40) { props.place('palm', [-700, -0.06, z], r() * 6, 1 + r() * 0.3); props.place('palm', [700, -0.06, z], r() * 6, 1 + r() * 0.3); }
    props.place('mirror', [522, -0.06, -206], Math.PI * 0.75);
    props.place('mirror', [612, -0.06, -150], -Math.PI / 2);
    for (const [x, z] of [[-420, 238], [-430, 238], [-440, 238]]) props.place('waterBarrier', [x, -0.06, z], 0, 1);

    // ---- distant Kaohsiung skyline + landmark tower
    kit.skyline({ center: [0, -1650], radius: [120, 950], count: 90, height: [25, 150], seed: 5 });
    kit.supertall({ pos: [380, 0, -1450], height: 340, segments: 7, color: 0x5a6f73 });
  },
};
