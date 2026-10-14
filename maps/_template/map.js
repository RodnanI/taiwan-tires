// TEMPLATE: copy this folder to maps/<your-id>/ and set `id` to the folder name.
// Folders starting with "_" are never loaded, so this file is documentation that also builds and validates:
//   cp -r maps/_template maps/my-map && npm run validate -- --only my-map
// Full reference: maps/AGENTS.md. World: 1 unit = 1 m, +X east, -Z north, +Y up. Headings in degrees
// (0 = south/+Z, 90 = east/+X, 180 = north/-Z).
export default {
  id: 'template-town',
  name: 'Template Town',
  nameZh: '範例小鎮',
  region: 'Hsinchu',
  description: 'A hill loop around a small town: shows terrain, roads, a junction, events and the build kit.',
  placeholder: true,
  hidden: true,              // keep out of the map list while you work on it
  order: 50,
  seed: 4,                   // kit.rand() is seeded from this: placement is identical on every load
  preview: { colors: ['#14181a', '#d8a04a'] },

  environment: { time: 18.2, timeScale: 0, weather: 'clear', fogDensity: 0.0009, cityGlow: 0.15, glowColor: '#c8926a', clouds: 0.4 },
  spawn: { pos: [-150, null, 200], heading: 90 },   // y null = drop onto the ground; on the loop facing east

  // Rolling hills. Roads carve a flat bed into it automatically.
  terrain: { size: [1400, 1400], center: [0, 0], cell: 4, surface: 'grass', height: { base: 0, amplitude: 28, scale: 0.002, octaves: 4, seed: 4 } },

  roads: [
    {
      // closed circuit: last point connects back to the first (do not repeat it)
      id: 'hill-loop', name: 'Hill Loop', closed: true, width: 12, lanes: 2, markings: 'race', curbs: true,
      shoulder: { width: 1.5, surface: 'concrete' },
      points: [[-150, 200], [0, 210], [150, 190], [260, 120], [280, 0], [230, -130], [100, -190], [-40, -170], [-150, -100], [-250, -20], [-280, 100], [-240, 180]],
      walls: [{ from: 300, to: 700, right: 'guardrail' }],   // metres along the road
      lights: { spacing: 40, side: 'alternate', height: 9, intensity: 120, range: 36 },
    },
    {
      // open road with pinned heights (x, y, z): climbs onto a ridge, y values are kept exactly
      id: 'ridge-road', name: 'Ridge Road', closed: false, width: 9, lanes: 2, markings: 'double-yellow',
      walls: { left: 'guardrail', right: 'guardrail' }, smoothY: true, smoothPasses: 3,
      points: [[280, 0], [380, -20], [480, 18, -80], [560, 30, -180], [600, 36, -300], [580, 40, -420]], // [x, z] follows the terrain
    },
  ],
  junctions: [{ pos: [280, 0], radius: 12 }],             // where the ridge road leaves the loop

  events: [
    { id: 'template-circuit', type: 'circuit', name: 'Hill Loop', nameZh: '山丘環道', route: 'hill-loop', laps: 2, ai: 5, rewards: { credits: [40000, 24000, 12000] } },
    { id: 'template-sprint', type: 'sprint', name: 'Ridge Run', nameZh: '山脊衝刺', route: 'ridge-road', ai: 3, time: 6.5 },
    { id: 'template-drift', type: 'drift', name: 'Square Drift', nameZh: '廣場甩尾', timeLimit: 60, targets: [15000, 40000, 80000],
      route: { closed: true, width: 30, points: [[-60, 40], [60, 40], [80, 100], [-80, 100]] } },   // inline zone, not a road
    { id: 'template-ta', type: 'timeattack', name: 'Loop Time Attack', nameZh: '環道計時', route: 'hill-loop', laps: 3 },
  ],

  /** Runs after terrain and roads exist. Everything added here is batched / instanced by the kit. */
  build({ THREE, kit }) {
    const { props, M } = kit;
    const r = kit.rand;
    // a paved square for the drift zone: geometry + collision as concrete
    const plaza = new THREE.PlaneGeometry(200, 100, 20, 10);
    plaza.rotateX(-Math.PI / 2);
    plaza.translate(0, kit.groundY(0, 70) + 0.03, 70);
    const uv = plaza.attributes.uv; // tile the texture every 4 m instead of stretching it
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 50, uv.getY(i) * 25);
    const plazaMat = M.textured('concrete', { repeat: 1, color: 0xa29e96 });
    kit.addStatic(plaza, plazaMat, { cast: false });
    kit.collision.triangles(plaza, 'concrete');
    kit.env?.addWettable(plazaMat);
    for (const [x, z] of [[-40, 70], [0, 70], [40, 70]]) props.place('cone', [x, kit.groundY(x, z), z], r() * 6);

    // a street of shophouses north of the square (front edge a->b, buildings on the left side of a->b)
    kit.row({ a: [-120, 20], b: [120, 20], depth: 14, side: 1, style: 'shophouse', minW: 6, maxW: 10, floors: [3, 5], seed: 2 });
    kit.building({ x: 180, z: 60, w: 24, d: 18, rotY: Math.PI / 2, style: 'apartment', floors: 9 });

    // a custom lit sign on a pole: atlas slot + geometry, glows at night
    const rect = kit.signs.slot('範例小鎮', 2);
    kit.mesh(kit.signs.geometry(rect, 1.2, 4, 0.3), kit.signs.material, { pos: [-150, kit.groundY(-150, 215) + 5, 215] });
    props.place('pillar', [-150, kit.groundY(-150, 215), 215], 0, [0.4, 0.5, 0.4]);

    // scattered trees (scale counts by kit.vegetation so Potato stays fast)
    const trees = Math.round(160 * kit.vegetation);
    for (let i = 0; i < trees; i++) {
      const x = (r() - 0.5) * 1200, z = (r() - 0.5) * 1200;
      if (Math.hypot(x, z - 70) < 140) continue;            // keep the town clear
      props.place(r() < 0.5 ? 'tree' : 'palm', [x, kit.groundY(x, z) - 0.1, z], r() * 6, 0.8 + r() * 0.5, null, { collide: false });
    }
    // a point light that only exists at night (virtual: the light manager picks the nearest few)
    kit.light({ pos: [0, kit.groundY(0, 70) + 9, 70], color: 0xfff0d8, intensity: 160, range: 45 });
    // distant hills of light
    kit.skyline({ center: [0, -1600], radius: [100, 700], count: 40, height: [20, 70], seed: 9 });
  },
};
