// Tenmaru RS-4 Type R cabin: 2006 rally saloon. Hooded triple-dial cluster with boost, alcantara buckets with
// harness slots, three-spoke wheel with a blue top marker, short shifter with the centre-diff dial, aluminium
// pedals, an aftermarket boost pod on the A-pillar. Left-hand drive: the driver sits at +X.
export function buildCabin(ctx, ex) {
  const { THREE, kit, parts } = ctx;
  const B = kit.body, I = kit.interior, M = kit.M, sd = B.sd, mat = B.mat;
  const S = ex.S, geo = ex.geo;
  const A = Math.abs;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const g = new THREE.Group();
  g.name = 'cabin';
  const cage = parts.cage && parts.cage !== 'stock';
  const gutted = parts.weight === 'race';
  const DX = 0.38;                       // driver centreline
  const eye = [DX, 1.165, 0.06];

  // ------------------------------------------------------------------ materials
  const dashTop = I.mat('grain', { color: 0x1c1d1f, roughness: 0.8, repeat: 24, normalScale: 0.5 });
  const dashLow = I.mat('grain', { color: 0x2c2e31, roughness: 0.72, repeat: 24, normalScale: 0.5 });
  const silver = M.shared('rs4:silver', () => M.surface({ color: 0x8c9096, roughness: 0.35, metalness: 0.75 }));
  const vinyl = I.mat('grain', { color: 0x26282b, roughness: 0.62, repeat: 30, normalScale: 0.6 });
  const alc = I.mat('alcantara', { color: 0x2b3446, roughness: 1, repeat: 10 });
  const alcGrey = I.mat('alcantara', { color: 0x2a2b2e, roughness: 1, repeat: 10 });
  const headliner = I.mat('headliner', { color: 0x55575b, roughness: 0.92, repeat: 14 });
  const carpet = I.mat('carpet', { color: 0x1e1f21, roughness: 1, repeat: 9 });
  const satin = mat.satinBlack(), chrome = mat.chrome();
  const blueLeather = I.leather(0x2350b8);

  // ------------------------------------------------------------------ trim shell (4 doors)
  const thick = (x, y, z) => { const b = geo.beltY(z); return 0.026 + 0.055 * ss(b - 0.03, b - 0.22, y); };
  const gl = (f) => (x, y, z) => Math.max(geo.fFrame(x, y, z), f(x, y, z));
  const fIns = (x, y, z) => Math.max(Math.min(sd.box(z, y, 0.36, 0.78, 0.4, 0.1, 0.03), sd.box(z, y, -0.6, 0.79, 0.3, 0.09, 0.03)), 0.55 - A(x));
  g.add(B.trimShell(S, {
    zFront: 0.97, zBack: -1.43, yLow: 0.27, arches: ex.arches, archFn: ex.archFn,
    holes: [geo.fWS, geo.fRG, gl(geo.fG1), gl(geo.fG2), gl(geo.fG3)], thick, belt: geo.beltY, onTop: geo.onTop,
    mats: { roof: headliner, pillar: I.mat('grain', { color: 0x2f3134, roughness: 0.75, repeat: 30, normalScale: 0.4 }), card: vinyl },
    inserts: [{ f: fIns, mat: alcGrey }],
  }));
  // rear bulkhead behind the rear seat (the boot is closed off) and the parcel shelf
  {
    const bulk = new THREE.Mesh(kit.geo.box(1.4, 0.7, 0.02), carpet);
    bulk.position.set(0, 0.72, -1.36);
    g.add(bulk);
    const shelfPts = [];
    for (let i = 0; i <= 8; i++) shelfPts.push([0, 0, -1.08 - (0.34 * i) / 8]);
    const shelf = B.sweep(shelfPts, (s) => { const z = -1.08 - 0.34 * s, y = 1.055 + 0.0 * s, w = S.sideAt(z, y) - 0.05; return [[-w, y - 0.012], [w, y - 0.012], [w, y], [-w, y]]; }, { profileClosed: true, up: [0, 1, 0] });
    g.add(B.mesh([shelf], I.mat('carpet', { color: 0x161718, roughness: 1, repeat: 9 }), { name: 'parcelShelf' }));
    const spk = I.mat('speaker', { color: 0xffffff, roughness: 0.7, repeat: 4 });
    for (const sx of [1, -1]) { const sp = new THREE.Mesh(kit.geo.roundedBox(0.18, 0.004, 0.12, 0.03, 2), spk); sp.position.set(sx * 0.42, 1.058, -1.25); g.add(sp); }
  }

  // ------------------------------------------------------------------ floor and tunnel
  {
    const fy = (x, z) => {
      let y = 0.27 + 0.2 * ss(0.72, 0.98, z);
      const t = Math.max(0, 1 - (A(x) / 0.16) ** 2);
      y += 0.13 * Math.sqrt(t) * (1 - ss(0.88, 0.98, z));
      y += 0.1 * ss(-0.5, -0.6, z);
      return y;
    };
    const floor = B.floorPan(S, { z0: -1.0, z1: 1.0, fy, margin: (y, z) => thick(0.8, y, z) - 0.01 });
    g.add(B.mesh([floor], gutted ? M.shared('rs4:bareFloor', () => M.surface({ color: 0x5b5d61, roughness: 0.55, metalness: 0.4 })) : carpet, { name: 'floor', shadow: false }));
  }

  // ------------------------------------------------------------------ dashboard
  const half = 0.78;
  {
    const zf = 0.94;
    const dash = (x) => {
      const yf = Math.min(0.985, S.topAt(zf, x) - 0.03);
      const a = [[1.05, 0.6], [0.83, 0.6], [0.72, 0.65], [0.665, 0.72], [0.648, 0.8], [0.646, 0.86], [0.655, 0.905], [0.69, 0.94], [0.76, 0.962], [0.86, 0.972], [zf, yf], [1.02, yf - 0.06]];
      const b = [[1.05, 0.6], [0.83, 0.6], [0.72, 0.65], [0.665, 0.72], [0.648, 0.8], [0.68, 0.875], [0.73, 0.88], [0.745, 0.9], [0.76, 1.045], [0.86, 1.045], [zf, Math.max(yf, 1.0)], [1.02, yf - 0.06]];
      const w = ss(DX - 0.2, DX - 0.165, x) * ss(DX + 0.2, DX + 0.165, x);
      return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * w, p[1] + (b[i][1] - p[1]) * w]);
    };
    let d = B.dashSweep(half, dash, { clipTo: (x, y, z) => A(x) - (S.sideAt(Math.min(z, 0.95), Math.max(y, 0.62)) - thick(x, y, z) - 0.006) });
    const fGlove = (x, y, z) => Math.max(sd.box(x, y, -0.42, 0.79, 0.17, 0.06, 0.015), z - 0.7);
    let [glove, d1] = B.split(d, fGlove, 0.003);
    let [low, top] = B.split(d1, (x, y, z) => y - 0.86 + (z - 0.66) * 0.3, 0.0025);
    // carbon-look strip across the passenger side
    let [strip, low2] = B.split(low, (x, y, z) => Math.max(y - 0.85, 0.8 - y, x + 0.12), 0.002);
    const fin = (p) => B.projectUV(B.merge([p, B.roll(p, { r: 0.002, depth: 0.006 })]), 'z', 1);
    g.add(B.mesh([fin(top)], dashTop, { name: 'dash' }));
    g.add(B.mesh([fin(low2), fin(glove)], dashLow, { name: 'dashLower' }));
    g.add(B.mesh([B.projectUV(strip, 'z', 8)], M.carbon(), { name: 'dashCarbon' }));
    const latch = new THREE.Mesh(kit.geo.roundedBox(0.06, 0.014, 0.01, 0.004, 1), silver); latch.position.set(-0.42, 0.835, 0.66); g.add(latch);
    // cluster binnacle and dials
    const bin = [];
    for (let i = 0; i <= 16; i++) bin.push([DX + 0.2 - (0.4 * i) / 16, 0, 0]);
    const hood = [[0.82, 0.985], [0.81, 1.045], [0.76, 1.073], [0.69, 1.077], [0.635, 1.065], [0.615, 1.043], [0.62, 1.03], [0.645, 1.041], [0.69, 1.053], [0.75, 1.05], [0.79, 1.03], [0.8, 0.985]];
    g.add(B.mesh([B.sweep(bin, hood, { up: [0, 1, 0], profileClosed: true, capStart: true, capEnd: true, flip: true })], M.shared('rs4:binnacle', () => M.surface({ color: 0x18191b, roughness: 0.82 })), { name: 'binnacle' }));
    const rec = new THREE.Mesh(kit.geo.box(0.38, 0.15, 0.005), M.shared('rs4:recess', () => M.surface({ color: 0x0a0a0b, roughness: 0.9 })));
    rec.position.set(DX, 0.98, 0.765); g.add(rec);
    g.add(I.cluster({ pos: [DX, 0.978, 0.752], size: [0.34, 0.12], tilt: 10, type: 'rally', redline: ctx.spec.engine.redline, maxRpm: 9000, maxSpeed: 280, accent: kit.accent, hood: false, px: 768, glow: 0.24, glass: true }));
    // vents: round at the ends, rectangular pair above the head unit
    for (const sx of [1, -1]) g.add(I.vent({ pos: [sx * 0.66, 0.9, 0.66], size: [0.09, 0.09], round: true, rot: [0, sx * 0.3, 0] }));
    for (const sx of [1, -1]) g.add(I.vent({ pos: [sx * 0.06, 0.885, 0.632], size: [0.1, 0.045], rot: [0, Math.PI, 0] }));
  }

  // ------------------------------------------------------------------ centre stack, head unit, climate, console
  {
    const st = [];
    for (let i = 0; i <= 8; i++) st.push([0.135 - (0.27 * i) / 8, 0, 0]);
    const prof = [[0.95, 0.56], [0.66, 0.56], [0.622, 0.62], [0.636, 0.918], [0.69, 0.94], [0.95, 0.94]];
    g.add(B.mesh([B.sweep(st, prof, { up: [0, 1, 0], profileClosed: true, capStart: true, capEnd: true, flip: true })], silver, { name: 'stack' }));
    const lean = Math.atan2(0.636 - 0.622, 0.918 - 0.62);
    const faceZ = (y) => 0.622 + (y - 0.62) * Math.tan(lean);
    g.add(I.headUnit({ pos: [0, 0.79, faceZ(0.79) - 0.004], size: [0.2, 0.1125], tilt: lean / (Math.PI / 180) + 2, style: 'integrated', bezel: 0.008 }));
    for (let i = -1; i <= 1; i++) g.add(I.knob({ pos: [i * 0.075, 0.672, faceZ(0.672) - 0.004], r: 0.025, len: 0.02, rot: [Math.PI - lean, 0, 0], mat: M.shared('rs4:knob', () => M.surface({ color: 0x1b1c1e, roughness: 0.4 })) }));
    const haz = new THREE.Mesh(kit.geo.roundedBox(0.03, 0.02, 0.012, 0.004, 1), M.shared('rs4:hazard', () => M.surface({ color: 0xa8241a, roughness: 0.4 })));
    haz.position.set(0, 0.717, faceZ(0.717) - 0.005); g.add(haz);
    // console: shifter, centre-diff dial, cup holders, handbrake, armrest box
    const con = [];
    for (let i = 0; i <= 10; i++) con.push([0, 0, 0.68 - (1.12 * i) / 10]);
    const conP = B.sweep(con, (s) => { const top = 0.535 - 0.02 * s + 0.08 * ss(0.78, 0.86, s), w = 0.11 - 0.01 * s; return [[-w, 0.36], [-w, top - 0.02], [-w + 0.02, top], [w - 0.02, top], [w, top - 0.02], [w, 0.36]]; }, { up: [0, 1, 0], capEnd: true });
    g.add(B.mesh([conP], M.shared('rs4:console', () => M.surface({ color: 0x1c1d1f, roughness: 0.6 })), { name: 'console' }));
    g.add(I.shifter2({ pos: [0, 0.53, 0.36], gears: 6, knob: 'ball', type: 'short', lean: 0.1, knobMat: silver }));
    const dccd = I.knob({ pos: [0.07, 0.537, 0.47], r: 0.016, len: 0.014, rot: [-Math.PI / 2, 0, 0], mat: silver });
    g.add(dccd);
    for (const dz of [0.17, 0.25]) { const cup = new THREE.Mesh(kit.geo.cylinderZ(0.035, 0.012, 20), M.shared('rs4:cup', () => M.surface({ color: 0x080809, roughness: 0.8 }))); cup.rotation.x = Math.PI / 2; cup.position.set(0, 0.528, dz); g.add(cup); }
    g.add(I.handbrake({ pos: [0, 0.525, 0.04], hydro: parts.handbrake === 'hydro' }));
    const arm = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.06, 0.3, 0.025, 3), alcGrey);
    arm.position.set(0, 0.6, -0.27); g.add(arm);
  }

  // ------------------------------------------------------------------ wheel, pedals, boost pod
  const emblem = () => {
    const e = new THREE.Group();
    e.add(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0022, 6, 24), chrome));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.015, 20), M.shared('rs4:emblemBlue', () => M.surface({ color: 0x1b3b86, roughness: 0.25, metalness: 0.3 })));
    e.add(disc);
    return e;
  };
  g.add(I.wheel2({ pos: [DX, 0.935, 0.47], radius: 0.183, tilt: 24, style: 'sport3', grip: I.leather(0x141414, 0.45), spoke: silver, pad: M.shared('rs4:hub', () => M.surface({ color: 0x151517, roughness: 0.5 })), accent: blueLeather, emblem, column: 0.2 }));
  g.add(I.pedals2({ pos: [DX, 0.43, 0.86], sport: true }));
  {
    const pod = new THREE.Group();
    const px = S.corner(5, 0.82)[0] - 0.07, py = geo.beltY(0.82) + 0.075;
    pod.position.set(px, py, 0.8);
    pod.lookAt(eye[0], eye[1], eye[2]);
    pod.add(new THREE.Mesh(kit.geo.latheZ([[0.034, -0.05], [0.034, 0.0], [0.03, 0.004]], 20), satin));
    const podM = M.shared('rs4:boostPod', () => {
      const fc = B.canvas(256, 256), fg = fc.getContext('2d');
      fg.fillStyle = '#0a0a0b'; fg.beginPath(); fg.arc(128, 128, 126, 0, Math.PI * 2); fg.fill();
      fg.strokeStyle = '#e8e6e0'; fg.lineWidth = 6; fg.fillStyle = '#e8e6e0'; fg.font = `700 26px ${B.fonts.ui}`; fg.textAlign = 'center';
      for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5; fg.beginPath(); fg.moveTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); fg.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); fg.stroke(); }
      fg.fillText('BOOST', 128, 180); fg.fillStyle = '#e0251b'; fg.fillRect(124, 60, 8, 70);
      const t = B.tex(fc);
      return M.surface({ color: 0xffffff, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.4 });
    });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), podM);
    face.position.z = 0.002;
    pod.add(face);
    g.add(pod);
  }

  // ------------------------------------------------------------------ seats: alcantara buckets with harness slots, rear bench
  for (const sx of [1, -1]) {
    if (gutted && sx < 0 && !cage) continue;
    g.add(I.seat2({ w: 0.52, len: 0.5, h: 0.13, back: 0.6, recline: 15, bolster: 0.07, backBolster: 0.13, headrest: 'integrated', harness: true, insert: alc, side: I.leather(0x161618, 0.55), trim: 0x1d1e20, pos: [sx * DX, 0.315, -0.02] }));
  }
  if (!gutted) g.add(I.seat2({ w: 1.24, len: 0.46, h: 0.15, back: 0.56, recline: 24, bolster: 0.025, backBolster: 0.04, headrest: 'none', insert: alcGrey, side: vinyl, pos: [0, 0.34, -0.82] }));
  for (const sx of [1, -1]) {
    // blue belts hanging on the B-pillars
    const xb = S.sideAt(-0.15, 1.1) - 0.045;
    const belt = B.sweep([[sx * xb, 1.27, -0.15], [sx * (xb - 0.01), 0.9, -0.14], [sx * (xb - 0.02), 0.42, -0.12]], [[-0.024, 0], [0.024, 0], [0.024, 0.003], [-0.024, 0.003]], { sub: 3, profileClosed: true, upFn: () => [sx, 0, 0] });
    g.add(B.mesh([belt], M.shared('rs4:belt', () => M.surface({ color: 0x1d3f9a, roughness: 0.85 }))));
  }

  // ------------------------------------------------------------------ door hardware: front and rear doors, both sides
  {
    const side = new THREE.Group();
    const xin = (z, y) => S.sideAt(z, y) - thick(0.8, y, z);
    for (const [z0, z1, front] of [[0.78, -0.08, true], [-0.2, -0.85, false]]) {
      const ya = 0.7;
      const arm = [];
      for (let i = 0; i <= 8; i++) { const z = z0 - ((z0 - z1) * i) / 8; arm.push([xin(z, ya), ya, z]); }
      side.add(B.mesh([B.sweep(arm, [[0.002, -0.04], [0.055, -0.045], [0.07, -0.015], [0.065, 0.02], [0.02, 0.03], [0.002, 0.032]], { sub: 2, capStart: true, capEnd: true, up: [0, 1, 0] })], vinyl, { name: 'armrest' }));
      // window switches on the armrest
      const sw = new THREE.Mesh(kit.geo.roundedBox(0.04, 0.01, front ? 0.09 : 0.04, 0.004, 1), satin);
      sw.position.set(xin(z0 - 0.25, ya) - 0.05, ya + 0.03, z0 - 0.25); side.add(sw);
      const zh = z0 - 0.08, yh = 0.86;
      const cup = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.045, 0.1, 0.008, 2), satin); cup.position.set(xin(zh, yh) - 0.004, yh, zh);
      const lev = new THREE.Mesh(kit.geo.roundedBox(0.01, 0.014, 0.085, 0.005, 2), chrome); lev.position.set(xin(zh, yh) - 0.012, yh, zh - 0.005);
      side.add(cup, lev);
      const zs = z0 - 0.1, ys = 0.45;
      const spk = new THREE.Mesh(new THREE.CircleGeometry(0.07, 28), I.mat('speaker', { color: 0xffffff, roughness: 0.6, repeat: 3 }));
      spk.position.set(xin(zs, ys) - 0.003, ys, zs); spk.rotation.y = -Math.PI / 2; side.add(spk);
    }
    g.add(side);
    const other = side.clone(); other.scale.x = -1; g.add(other);
  }

  // ------------------------------------------------------------------ roof: visors, mirror, map light, grab handles
  {
    const hz = geo.zHead(0) - 0.02;
    for (const sx of [1, -1]) {
      const visor = new THREE.Mesh(kit.geo.roundedBox(0.34, 0.022, 0.16, 0.012, 2), headliner);
      visor.position.set(sx * 0.37, S.topAt(hz - 0.1, sx * 0.37) - 0.04, hz - 0.1); visor.rotation.x = -0.1;
      g.add(visor);
    }
    const my = S.topAt(hz, 0) - 0.032;
    const mirror = new THREE.Group();
    mirror.add(new THREE.Mesh(kit.geo.roundedBox(0.25, 0.068, 0.032, 0.016, 2), satin));
    const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.052), M.shared('car:mirrorGlass', () => M.surface({ color: 0xa8b0ba, roughness: 0.02, metalness: 1 })));
    mg.position.z = -0.017; mg.rotation.y = Math.PI; mirror.add(mg);
    mirror.position.set(0, my - 0.08, hz - 0.03); mirror.rotation.y = 0.2;
    g.add(mirror, new THREE.Mesh(kit.geo.tube([[0, my + 0.01, hz + 0.01], [0, my - 0.045, hz - 0.02]], 0.007, 6, 6), satin));
    const ml = new THREE.Mesh(kit.geo.roundedBox(0.14, 0.02, 0.07, 0.008, 2), M.shared('rs4:map', () => M.surface({ color: 0x2a2b2e, roughness: 0.5 })));
    ml.position.set(0, S.topAt(hz - 0.12, 0) - 0.04, hz - 0.12); g.add(ml);
    for (const sx of [1, -1]) {
      const gx = sx * (S.corner(5, -0.5)[0] - 0.05), gy = S.corner(5, -0.5)[1] - 0.08;
      g.add(new THREE.Mesh(kit.geo.tube([[gx, gy + 0.02, -0.38], [gx - sx * 0.03, gy - 0.025, -0.44], [gx - sx * 0.03, gy - 0.025, -0.56], [gx, gy + 0.02, -0.62]], 0.011, 16, 8), satin));
    }
  }

  // ------------------------------------------------------------------ roll cage (welded: front hoop, door bars, harness bar)
  if (cage) {
    const tubes = [];
    const ix = (z, y) => S.sideAt(z, y) - thick(0.8, y, z) - 0.035;
    const roofY = (z, x) => S.topAt(z, x) - 0.06;
    const zH = -0.2;
    const hoop = [];
    for (let i = 0; i <= 8; i++) { const y = 0.3 + (1.0 * i) / 8; hoop.push([ix(zH, Math.min(y, 1.15)), Math.min(y, roofY(zH, 0.6)), zH]); }
    const left = hoop.concat([[0, roofY(zH, 0) - 0.01, zH]]);
    tubes.push(B.from(kit.geo.tube(left.concat(left.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]])), 0.021, 64, 10)));
    for (const sx of [1, -1]) {
      const a = [[sx * ix(0.85, 0.32), 0.32, 0.85], [sx * ix(0.7, 0.8), 0.8, 0.7], [sx * (S.corner(5, 0.4)[0] - 0.06), S.corner(5, 0.4)[1] - 0.06, 0.4], [sx * (S.corner(5, 0.05)[0] - 0.07), roofY(0.05, 0.55), 0.05], [sx * (S.corner(5, zH)[0] - 0.08), roofY(zH, 0.55), zH + 0.01]];
      tubes.push(B.from(kit.geo.tube(a, 0.02, 40, 10)));
      tubes.push(B.from(kit.geo.tube([[sx * ix(0.8, 0.45), 0.45, 0.8], [sx * ix(0.3, 0.75), 0.7, 0.3], [sx * ix(zH, 0.5), 0.5, zH]], 0.019, 24, 8)));
      tubes.push(B.from(kit.geo.tube([[sx * ix(zH, 1.1), roofY(zH, 0.55) - 0.02, zH], [sx * 0.6, 0.85, -0.95], [sx * 0.62, 0.65, -1.25]], 0.019, 24, 8)));
    }
    tubes.push(B.from(kit.geo.tube([[ix(zH, 0.75), 0.75, zH], [-ix(zH, 0.75), 0.75, zH]], 0.019, 12, 8)));
    tubes.push(B.from(kit.geo.tube([[ix(zH, 1.1) - 0.02, roofY(zH, 0.5) - 0.03, zH], [-ix(zH, 0.4) + 0.02, 0.34, zH]], 0.019, 16, 8)));
    g.add(B.mesh(tubes, M.shared('rs4:cage', () => M.surface({ color: 0x1c3f96, roughness: 0.38, metalness: 0.35 })), { name: 'cage' }));
  }
  return { group: g, eye };
}
