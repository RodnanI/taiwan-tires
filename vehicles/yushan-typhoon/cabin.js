// Yushan Typhoon GT cabin: 2019 two-seat grand tourer. Black stitched dash with a carbon band and ambient light
// line, hooded TFT cluster, floating 16:9 screen, high console with the gear selector and start button,
// flat-bottomed wheel with paddles, quilted cognac sport seats. Left-hand drive: the driver sits at +X.
export function buildCabin(ctx, ex) {
  const { THREE, kit, parts } = ctx;
  const B = kit.body, I = kit.interior, M = kit.M, sd = B.sd, mat = B.mat;
  const S = ex.S, geo = ex.geo;
  const A = Math.abs;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const g = new THREE.Group();
  g.name = 'cabin';
  const cage = parts.cage && parts.cage !== 'stock';
  const DX = 0.38;
  const eye = [DX, 1.02, -0.45];

  // ------------------------------------------------------------------ materials
  const dashTop = I.mat('grain', { color: 0x151517, roughness: 0.7, repeat: 40, normalScale: 0.35 });
  const dashLow = I.mat('grain', { color: 0x1d1e20, roughness: 0.65, repeat: 40, normalScale: 0.35 });
  const cognac = I.leather(0x8a4a2a, 0.5);
  const quilt = I.mat('quilted', { color: 0x9a5532, roughness: 0.55, repeat: 9 });
  const black = I.leather(0x141416, 0.5);
  const alcBlack = I.mat('alcantara', { color: 0x19191b, roughness: 1, repeat: 10 });
  const carpet = I.mat('carpet', { color: 0x161618, roughness: 1, repeat: 9 });
  const alu = M.shared('ty:alu', () => M.surface({ color: 0xa9adb3, roughness: 0.28, metalness: 0.9 }));
  const satin = mat.glossBlack(), chrome = mat.chrome();
  const ambient = M.shared(`ty:ambient:${kit.accent}`, () => M.surface({ color: 0x000000, emissive: kit.accent, emissiveIntensity: 1.6, roughness: 0.4 }));

  // ------------------------------------------------------------------ trim shell
  const thick = (x, y, z) => { const b = geo.beltY(z); return 0.026 + 0.06 * ss(b - 0.03, b - 0.22, y); };
  const gl = (f) => (x, y, z) => Math.max(geo.fFrame(x, y, z), f(x, y, z));
  const fIns = (x, y, z) => Math.max(sd.box(z, y, -0.12, 0.66, 0.42, 0.09, 0.04), 0.6 - A(x));
  g.add(B.trimShell(S, {
    zFront: 0.44, zBack: -1.36, yLow: 0.22, arches: ex.arches, archFn: ex.archFn,
    holes: [geo.fWS, geo.fRG, gl(geo.fG1), gl(geo.fG2)], thick, belt: geo.beltY, onTop: geo.onTop,
    mats: { roof: alcBlack, pillar: alcBlack, card: black }, inserts: [{ f: fIns, mat: cognac }],
  }));
  // bulkhead and luggage shelf behind the seats
  {
    const bulk = new THREE.Mesh(kit.geo.box(1.5, 0.6, 0.02), carpet);
    bulk.position.set(0, 0.55, -1.32);
    g.add(bulk);
    const shelf = new THREE.Mesh(kit.geo.roundedBox(1.36, 0.02, 0.36, 0.01, 1), carpet);
    shelf.position.set(0, 0.86, -1.14);
    g.add(shelf);
    for (const sx of [1, -1]) { const rail = new THREE.Mesh(kit.geo.tube([[sx * 0.2, 0.87, -1.0], [sx * 0.2, 0.9, -1.04], [sx * 0.2, 0.9, -1.24], [sx * 0.2, 0.87, -1.28]], 0.006, 12, 6), alu); g.add(rail); }
  }
  // floor with a tall transmission tunnel (front-engine, rear transaxle)
  {
    const fy = (x, z) => {
      let y = 0.2 + 0.22 * ss(0.2, 0.44, z);
      const t = Math.max(0, 1 - (A(x) / 0.2) ** 2);
      y += 0.2 * Math.sqrt(t) * (1 - ss(0.3, 0.44, z));
      return y;
    };
    g.add(B.mesh([B.floorPan(S, { z0: -1.32, z1: 0.46, fy, margin: (y, z) => thick(0.8, y, z) - 0.01 })], carpet, { name: 'floor', shadow: false }));
  }

  // ------------------------------------------------------------------ dashboard: layered, carbon band with an ambient light line
  const half = 0.8;
  {
    const zf = 0.43;
    const dash = (x) => {
      const yf = Math.min(0.87, S.topAt(zf, x) - 0.03);
      const a = [[0.5, 0.48], [0.36, 0.48], [0.26, 0.54], [0.205, 0.62], [0.19, 0.7], [0.192, 0.745], [0.2, 0.79], [0.225, 0.83], [0.28, 0.852], [0.36, 0.862], [zf, yf], [0.5, yf - 0.06]];
      const b = [[0.5, 0.48], [0.36, 0.48], [0.26, 0.54], [0.205, 0.62], [0.19, 0.7], [0.215, 0.755], [0.25, 0.765], [0.268, 0.78], [0.28, 0.9], [0.36, 0.9], [zf, yf], [0.5, yf - 0.06]];
      const w = ss(DX - 0.19, DX - 0.155, x) * ss(DX + 0.19, DX + 0.155, x);
      return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * w, p[1] + (b[i][1] - p[1]) * w]);
    };
    const d = B.dashSweep(half, dash, { clipTo: (x, y, z) => A(x) - (S.sideAt(Math.min(z, 0.44), Math.max(y, 0.5)) - thick(x, y, z) - 0.006) });
    const fGlove = (x, y, z) => Math.max(sd.box(x, y, -0.42, 0.66, 0.17, 0.05, 0.015), z - 0.24);
    let [glove, d1] = B.split(d, fGlove, 0.003);
    // carbon band between the upper and lower dash
    const fBand = (x, y, z) => Math.max(A(y - 0.735) - 0.02, z - 0.3);
    let [band, d2] = B.split(d1, fBand, 0.002);
    let [low, top] = B.split(d2, (x, y, z) => y - 0.735, 0);
    const fin = (p) => B.projectUV(B.merge([p, B.roll(p, { r: 0.002, depth: 0.006 })]), 'z', 1);
    g.add(B.mesh([fin(top)], dashTop, { name: 'dash' }));
    g.add(B.mesh([fin(low), fin(glove)], dashLow, { name: 'dashLower' }));
    g.add(B.mesh([B.projectUV(band, 'z', 6)], M.carbon(), { name: 'dashCarbon' }));
    // ambient light line under the carbon band
    const amb = [];
    for (let i = 0; i <= 24; i++) { const x = 0.7 - (1.4 * i) / 24; if (A(x - DX) < 0.2) continue; amb.push([x, 0.712, 0.2]); }
    for (const run of [amb.filter((p) => p[0] > DX), amb.filter((p) => p[0] < DX)]) if (run.length > 1) g.add(B.mesh([B.sweep(run, [[-0.002, -0.002], [0.002, -0.002], [0.002, 0.002], [-0.002, 0.002]], { profileClosed: true })], ambient));
    // stitched seam along the dash top edge (contrast thread)
    const st = [];
    for (let i = 0; i <= 30; i++) { const x = 0.72 - (1.44 * i) / 30; if (A(x - DX) < 0.21) continue; st.push([x, 0.849, 0.268]); }
    const seamM = M.shared('ty:stitch', () => M.surface({ color: 0xb06a3a, roughness: 0.7 }));
    for (const run of [st.filter((p) => p[0] > DX), st.filter((p) => p[0] < DX)]) if (run.length > 1) g.add(B.mesh([B.sweep(run, [[-0.0012, -0.0012], [0.0012, -0.0012], [0.0012, 0.0012], [-0.0012, 0.0012]], { profileClosed: true })], seamM));
    // cluster hood and TFT
    const bin = [];
    for (let i = 0; i <= 16; i++) bin.push([DX + 0.19 - (0.38 * i) / 16, 0, 0]);
    const hoodP = [[0.33, 0.85], [0.32, 0.905], [0.28, 0.928], [0.22, 0.93], [0.185, 0.918], [0.172, 0.9], [0.176, 0.89], [0.2, 0.9], [0.24, 0.908], [0.29, 0.9], [0.31, 0.88], [0.31, 0.85]];
    g.add(B.mesh([B.sweep(bin, hoodP, { up: [0, 1, 0], profileClosed: true, capStart: true, capEnd: true, flip: true })], black, { name: 'binnacle' }));
    const rec = new THREE.Mesh(kit.geo.box(0.36, 0.14, 0.005), M.shared('ty:recess', () => M.surface({ color: 0x050506, roughness: 0.9 })));
    rec.position.set(DX, 0.835, 0.275); g.add(rec);
    g.add(I.cluster({ pos: [DX, 0.835, 0.265], size: [0.33, 0.12], tilt: 10, type: 'tft', redline: ctx.spec.engine.redline, maxRpm: 8000, maxSpeed: 320, accent: kit.accent, hood: false, px: 1024, glow: 1.0, glass: true }));
    // slim horizontal vents in the upper dash, round outer vents
    for (const sx of [1, -1]) g.add(I.vent({ pos: [sx * 0.7, 0.79, 0.2], size: [0.085, 0.085], round: true, rot: [0, sx * 0.35, 0], bezel: alu }));
    g.add(I.vent({ pos: [-0.36, 0.79, 0.2], size: [0.22, 0.03], rot: [0, Math.PI, 0], slats: 2 }));
  }

  // ------------------------------------------------------------------ floating screen, console
  {
    g.add(I.headUnit({ pos: [0, 0.94, 0.27], size: [0.27, 0.152], tilt: 9, style: 'tablet', bezel: 0.008 }));
    // console: rises from the tunnel to the dash, aluminium-edged carbon top
    const con = [];
    for (let i = 0; i <= 12; i++) con.push([0, 0, 0.3 - (1.15 * i) / 12]);
    const conP = B.sweep(con, (s) => { const top = 0.62 - 0.1 * ss(0.0, 0.45, s) + 0.02 * ss(0.75, 0.95, s), w = 0.13 - 0.015 * s; return [[-w, 0.38], [-w, top - 0.03], [-w + 0.03, top], [w - 0.03, top], [w, top - 0.03], [w, 0.38]]; }, { up: [0, 1, 0], capStart: true, capEnd: true });
    g.add(B.mesh([conP], black, { name: 'console' }));
    const plate = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.006, 0.5, 0.03, 2), M.carbon());
    plate.position.set(0, 0.525, -0.05); plate.rotation.x = 0.06;
    g.add(plate);
    g.add(I.shifter2({ pos: [0, 0.52, -0.06], type: 'seq', knob: 'tall', lean: 0.05, boot: black, knobMat: alu }));
    const start = new THREE.Mesh(kit.geo.cylinderZ(0.016, 0.01, 20), M.shared('ty:start', () => M.surface({ color: 0xb3261e, roughness: 0.3, emissive: 0x7a0f0a, emissiveIntensity: 0.4 })));
    start.rotation.x = Math.PI / 2 - 0.08; start.position.set(0.0, 0.535, 0.12);
    g.add(start);
    g.add(I.knob({ pos: [0.0, 0.535, -0.24], r: 0.024, len: 0.018, rot: [-Math.PI / 2, 0, 0], mat: alu }));
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(kit.geo.roundedBox(0.03, 0.006, 0.02, 0.003, 1), satin); b.position.set(-0.05 + i * 0.05, 0.532, 0.03); g.add(b); }
    const arm = new THREE.Mesh(kit.geo.roundedBox(0.22, 0.06, 0.34, 0.025, 3), cognac);
    arm.position.set(0, 0.6, -0.62); g.add(arm);
  }

  // ------------------------------------------------------------------ wheel with paddles, pedals
  const emblem = () => {
    const e = new THREE.Group();
    const peak = [[-0.02, -0.009], [-0.006, 0.008], [0.0, 0.002], [0.007, 0.012], [0.02, -0.009]];
    e.add(new THREE.Mesh(kit.geo.extrude(peak, 0.002, { axis: 'z', bevel: 0.0006 }), chrome));
    return e;
  };
  g.add(I.wheel2({ pos: [DX, 0.81, 0.0], radius: 0.178, tilt: 20, style: 'flat', grip: black, spoke: M.shared('ty:spoke', () => M.surface({ color: 0x1b1c1e, roughness: 0.4, metalness: 0.3 })), pad: black, accent: M.shared('ty:mark', () => I.leather(0xb3261e)), emblem, paddle: alu, column: 0.2 }));
  g.add(I.pedals2({ pos: [DX, 0.3, 0.36], sport: true, clutch: false }));

  // ------------------------------------------------------------------ seats: quilted cognac sport seats (buckets with the cage part)
  for (const sx of [1, -1]) {
    g.add(I.seat2({ w: 0.52, len: 0.52, h: 0.12, back: 0.6, recline: 19, bolster: 0.06, backBolster: 0.11, headrest: 'integrated', harness: !!cage, insert: quilt, side: cage ? alcBlack : cognac, trim: 0x151516, pos: [sx * DX, 0.215, -0.62] }));
    const xb = S.sideAt(-0.95, 1.05) - 0.05;
    const belt = B.sweep([[sx * xb, 1.12, -0.95], [sx * (xb - 0.01), 0.8, -0.93], [sx * (xb - 0.02), 0.32, -0.9]], [[-0.024, 0], [0.024, 0], [0.024, 0.003], [-0.024, 0.003]], { sub: 3, profileClosed: true, upFn: () => [sx, 0, 0] });
    g.add(B.mesh([belt], M.shared('ty:belt', () => M.surface({ color: 0x141416, roughness: 0.85 }))));
  }

  // ------------------------------------------------------------------ door cards: armrest, aluminium pull, carbon strip, ambient line, speaker
  {
    const side = new THREE.Group();
    const xin = (z, y) => S.sideAt(z, y) - thick(0.8, y, z);
    const arm = [];
    for (let i = 0; i <= 10; i++) { const z = 0.25 - (0.8 * i) / 10; arm.push([xin(z, 0.6), 0.6, z]); }
    side.add(B.mesh([B.sweep(arm, [[0.002, -0.04], [0.06, -0.045], [0.075, -0.012], [0.068, 0.02], [0.02, 0.032], [0.002, 0.034]], { sub: 2, capStart: true, capEnd: true, up: [0, 1, 0] })], cognac, { name: 'armrest' }));
    const pull = [];
    for (let i = 0; i <= 6; i++) { const z = 0.1 - (0.3 * i) / 6; pull.push([xin(z, 0.74) - 0.03, 0.74 - 0.08 * Math.sin((i / 6) * Math.PI), z]); }
    side.add(B.mesh([B.sweep(pull, [[-0.006, -0.008], [0.006, -0.008], [0.006, 0.008], [-0.006, 0.008]], { profileClosed: true, sub: 3 })], alu));
    const cs = [];
    for (let i = 0; i <= 10; i++) { const z = 0.3 - (0.85 * i) / 10; cs.push([xin(z, 0.79) - 0.003, 0.79, z]); }
    side.add(B.mesh([B.projectUV(B.sweep(cs, [[0, -0.014], [0.006, -0.014], [0.006, 0.014], [0, 0.014]], { profileClosed: true }), 'x', 6)], M.carbon()));
    const al = [];
    for (let i = 0; i <= 10; i++) { const z = 0.28 - (0.8 * i) / 10; al.push([xin(z, 0.765) - 0.004, 0.765, z]); }
    side.add(B.mesh([B.sweep(al, [[-0.0015, -0.0015], [0.0015, -0.0015], [0.0015, 0.0015], [-0.0015, 0.0015]], { profileClosed: true })], ambient));
    const zh = 0.18, yh = 0.82;
    const lev = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.016, 0.1, 0.006, 2), alu); lev.position.set(xin(zh, yh) - 0.012, yh, zh); side.add(lev);
    const spk = new THREE.Mesh(new THREE.CircleGeometry(0.065, 28), I.mat('speaker', { color: 0xffffff, roughness: 0.6, repeat: 3 }));
    spk.position.set(xin(0.25, 0.4) - 0.003, 0.4, 0.25); spk.rotation.y = -Math.PI / 2; side.add(spk);
    const spkR = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.004, 6, 28), alu); spkR.position.copy(spk.position); spkR.rotation.y = -Math.PI / 2; side.add(spkR);
    g.add(side);
    const other = side.clone(); other.scale.x = -1; g.add(other);
  }

  // ------------------------------------------------------------------ roof: mirror, visors, overhead console
  {
    const hz = geo.zHead(0) - 0.01;
    for (const sx of [1, -1]) {
      const visor = new THREE.Mesh(kit.geo.roundedBox(0.34, 0.02, 0.15, 0.012, 2), alcBlack);
      visor.position.set(sx * 0.36, S.topAt(hz - 0.09, sx * 0.36) - 0.035, hz - 0.09); visor.rotation.x = -0.08;
      g.add(visor);
    }
    const my = S.topAt(hz, 0) - 0.03;
    const mirror = new THREE.Group();
    mirror.add(new THREE.Mesh(kit.geo.roundedBox(0.24, 0.062, 0.03, 0.02, 3), satin));
    const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.048), M.shared('car:mirrorGlass', () => M.surface({ color: 0xa8b0ba, roughness: 0.02, metalness: 1 })));
    mg.position.z = -0.016; mg.rotation.y = Math.PI; mirror.add(mg);
    mirror.position.set(0, my - 0.07, hz - 0.03); mirror.rotation.y = 0.2;
    g.add(mirror, new THREE.Mesh(kit.geo.tube([[0, my + 0.01, hz + 0.01], [0, my - 0.04, hz - 0.02]], 0.006, 6, 6), satin));
    const oc = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.025, 0.12, 0.01, 2), satin);
    oc.position.set(0, S.topAt(hz - 0.14, 0) - 0.035, hz - 0.14); g.add(oc);
  }

  // ------------------------------------------------------------------ cage (bolt-in / welded)
  if (cage) {
    const tubes = [];
    const ix = (z, y) => S.sideAt(z, y) - thick(0.8, y, z) - 0.035;
    const roofY = (z, x) => S.topAt(z, x) - 0.055;
    const zH = -0.95;
    const hoop = [];
    for (let i = 0; i <= 8; i++) { const y = 0.24 + (0.95 * i) / 8; hoop.push([ix(zH, Math.min(y, 1.0)), Math.min(y, roofY(zH, 0.55)), zH]); }
    const left = hoop.concat([[0, roofY(zH, 0) - 0.01, zH]]);
    tubes.push(B.from(kit.geo.tube(left.concat(left.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]])), 0.021, 64, 10)));
    for (const sx of [1, -1]) {
      tubes.push(B.from(kit.geo.tube([[sx * ix(0.35, 0.25), 0.25, 0.35], [sx * ix(0.25, 0.75), 0.75, 0.25], [sx * (S.corner(5, -0.1)[0] - 0.06), S.corner(5, -0.1)[1] - 0.06, -0.1], [sx * (S.corner(5, -0.5)[0] - 0.07), roofY(-0.5, 0.5), -0.5], [sx * (S.corner(5, zH)[0] - 0.08), roofY(zH, 0.5), zH + 0.01]], 0.02, 40, 10)));
      tubes.push(B.from(kit.geo.tube([[sx * ix(0.3, 0.42), 0.42, 0.3], [sx * ix(-0.3, 0.6), 0.55, -0.3], [sx * ix(zH, 0.45), 0.45, zH]], 0.019, 24, 8)));
    }
    tubes.push(B.from(kit.geo.tube([[ix(zH, 0.95) - 0.02, roofY(zH, 0.5) - 0.03, zH], [-ix(zH, 0.4) + 0.02, 0.3, zH]], 0.019, 16, 8)));
    g.add(B.mesh(tubes, M.shared('ty:cage', () => M.surface({ color: 0x1a1a1c, roughness: 0.35, metalness: 0.5 })), { name: 'cage' }));
  }
  return { group: g, eye };
}
