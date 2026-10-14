// Hoshino Kaze 86 cabin: 1986 driver-focused interior. Trim panels (door cards, pillars, headliner) are the body
// surface pushed inwards, so they always fit the shell; everything else is lofted or swept.
// Left-hand drive: the driver sits at +X.
export function buildCabin(ctx, ex) {
  const { THREE, kit, parts, visual } = ctx;
  const B = kit.body, I = kit.interior, M = kit.M, sd = B.sd, mat = B.mat;
  const S = ex.S, geo = ex.geo;
  const A = Math.abs;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const g = new THREE.Group();
  g.name = 'cabin';
  const cage = parts.cage && parts.cage !== 'stock';
  const gutted = parts.weight === 'race';

  // ------------------------------------------------------------------ materials
  const dashMat = I.mat('grain', { color: 0x1f2022, roughness: 0.78, repeat: 24, normalScale: 0.5 });
  const dashLow = I.mat('grain', { color: 0x3b3d41, roughness: 0.7, repeat: 24, normalScale: 0.5 });
  const vinyl = I.mat('grain', { color: 0x46484c, roughness: 0.6, repeat: 30, normalScale: 0.7 });
  const pillarMat = I.mat('grain', { color: 0x3c3e42, roughness: 0.75, repeat: 30, normalScale: 0.4 });
  const cloth = I.mat('cloth80s', { color: 0xffffff, roughness: 0.95, repeat: 7 });
  const headliner = I.mat('headliner', { color: 0xc9c5bb, roughness: 0.9, repeat: 14 });
  const carpet = I.mat('carpet', { color: 0x2a2a2d, roughness: 1, repeat: 9 });
  const satin = mat.satinBlack(), chrome = mat.chrome();

  // ------------------------------------------------------------------ trim shell (door cards, pillars, roof lining)
  const thick = (x, y, z) => { const b = geo.beltY(z); return 0.024 + 0.05 * ss(b - 0.03, b - 0.2, y); };
  const gDoor = (x, y, z) => Math.max(geo.fFrame(x, y, z), geo.fDoorGlass(x, y, z));
  const gQ = (x, y, z) => Math.max(geo.fFrame(x, y, z), geo.fQGlass(x, y, z));
  const zFront = 0.6, zBack = -1.985, yLow = 0.255;
  let shell = B.clip(S.patch, (x, y, z) => Math.max(z - zFront, zBack - z, yLow - y));
  for (const a of ex.arches) shell = B.clip(shell, (x, y, z) => -ex.archFn(a, 0.01)(x, y, z));
  for (const f of [geo.fWS, geo.fRG, gDoor, gQ]) shell = B.clip(shell, (x, y, z) => -(f(x, y, z) + 0.008));
  // push the whole shell inwards, add returns at the glass openings only, then split it into trim materials
  const innerAll = B.flip(B.offset(shell, (x, y, z) => -thick(x, y, z)));
  const lipAll = B.roll(innerAll, { r: 0.003, depth: (x, y, z) => thick(x, y, z) + 0.002, only: (x, y, z) => A(z - zFront) > 0.02 && A(z - zBack) > 0.02 && y > yLow + 0.04 });
  const trim = B.merge([innerAll, lipAll]);
  let [lowerS, upperS] = B.split(trim, (x, y, z) => y - geo.beltY(z) - 0.012, 0);
  let [roofS, pillarS] = B.split(upperS, (x, y, z) => geo.onTop(x, y, z) + 0.01, 0);
  const fInsert = (x, y, z) => Math.max(sd.box(z, y, -0.06, 0.615, 0.5, 0.13, 0.03), 0.5 - A(x));
  let [cardIns, cardRest] = B.split(lowerS, fInsert, 0.003);
  for (const [k, p, m] of [['roof', roofS, headliner], ['pillar', pillarS, pillarMat], ['card', cardRest, vinyl], ['ins', cardIns, cloth]]) {
    g.add(B.mesh([B.projectUV(p, k === 'roof' ? 'y' : 'x', 1)], m, { name: `trim-${k}` }));
  }

  // ------------------------------------------------------------------ floor, tunnel, firewall, wheel tubs, boot
  {
    const nx = Math.max(16, Math.round(40 * kit.detail)), nz = Math.max(24, Math.round(64 * kit.detail));
    const x0 = -0.76, x1 = 0.76, z0 = -1.02, z1 = 0.66;
    const fy = (x, z) => {
      let y = 0.245 + 0.2 * ss(0.36, 0.62, z) + 0.2 * ss(0.6, 0.66, z);
      const t = Math.max(0, 1 - (A(x) / 0.15) ** 2);
      y += 0.14 * Math.sqrt(t) * (1 - 0.35 * ss(-0.75, -0.95, z)) * (1 - ss(0.5, 0.62, z));
      y += 0.11 * ss(-0.86, -0.97, z);
      return y;
    };
    const p = new B.Patch();
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * (i / nx), z = z0 + (z1 - z0) * (j / nz); p.add(x, fy(x, z), z, 0, 1, 0, x, z); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; p.tri(a, c, b); p.tri(b, c, d); }
    B.computeNormals(p);
    const floor = B.clip(p, (x, y, z) => A(x) - (S.sideAt(z, y + 0.06) - thick(x, y + 0.06, z) + 0.01));
    g.add(B.mesh([floor], gutted ? M.shared('kz:bareFloor', () => M.surface({ color: 0x6d6e70, roughness: 0.55, metalness: 0.4 })) : carpet, { name: 'floor', shadow: false }));
    // rear wheel tubs (carpeted humps over the arches)
    for (const sx of [1, -1]) {
      const tub = new THREE.Mesh(kit.geo.roundedBox(0.22, 0.42, 0.74, 0.08, 3), carpet);
      tub.position.set(sx * 0.62, 0.42, -1.2);
      g.add(tub);
    }
    // boot floor and parcel shelf (seen through the hatch glass)
    const boot = new THREE.Mesh(kit.geo.roundedBox(1.26, 0.04, 0.6, 0.01, 1), carpet);
    boot.position.set(0, 0.43, -1.7);
    g.add(boot);
    const shelfPts = [];
    for (let i = 0; i <= 10; i++) { const z = -1.44 - (0.48 * i) / 10; shelfPts.push([0, 0.935, z]); }
    const shelfW = (z) => S.sideAt(z, 0.95) - 0.04;
    const shelf = B.sweep(shelfPts, (s) => { const z = -1.44 - 0.48 * s, w = shelfW(z); return [[-w, -0.012], [w, -0.012], [w, 0.0], [-w, 0.0]]; }, { profileClosed: true, up: [0, 1, 0] });
    g.add(B.mesh([shelf], I.mat('carpet', { color: 0x1d1d1f, roughness: 1, repeat: 9 }), { name: 'parcelShelf' }));
  }

  // ------------------------------------------------------------------ dashboard
  const half = 0.76;
  const dashAt = (x) => {
    const ax = x;
    const zf = 0.585, yf = Math.min(0.87, S.topAt(zf, x) - 0.03);
    const a = [[0.66, 0.5], [0.47, 0.5], [0.36, 0.56], [0.3, 0.63], [0.275, 0.72], [0.262, 0.8], [0.262, 0.845], [0.275, 0.872], [0.31, 0.886], [0.4, 0.892], [0.49, 0.89], [zf, yf], [0.66, yf - 0.05]];
    const b = [[0.66, 0.5], [0.47, 0.5], [0.36, 0.56], [0.3, 0.63], [0.275, 0.72], [0.262, 0.792], [0.3, 0.8], [0.36, 0.806], [0.372, 0.82], [0.4, 0.94], [0.47, 0.94], [zf, yf], [0.66, yf - 0.05]];
    const w = ss(0.17, 0.205, ax) * ss(0.575, 0.54, ax);
    return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * w, p[1] + (b[i][1] - p[1]) * w]);
  };
  {
    const n = Math.max(30, Math.round(90 * kit.detail));
    const path = [];
    for (let i = 0; i <= n; i++) path.push([half - (2 * half * i) / n, 0, 0]);
    let dash = B.sweep(path, (s) => dashAt(half - 2 * half * s), { up: [0, 1, 0], flip: true });
    dash = B.clip(dash, (x, y, z) => A(x) - (S.sideAt(Math.min(z, 0.58), Math.max(y, 0.55)) - thick(x, y, z) - 0.006));
    // glovebox shut line on the passenger side
    const fGlove = (x, y, z) => Math.max(sd.box(x, y, -0.4, 0.69, 0.17, 0.065, 0.015), z - 0.32);
    let [glove, dashRest] = B.split(dash, fGlove, 0.003);
    let [dashLower, dashUpper] = B.split(dashRest, (x, y, z) => y - 0.79 + (z - 0.3) * 0.2, 0.0025);
    const finD = (p) => B.projectUV(B.merge([p, B.roll(p, { r: 0.002, depth: 0.006 })]), 'z', 1);
    g.add(B.mesh([finD(dashUpper)], dashMat, { name: 'dash' }));
    g.add(B.mesh([finD(dashLower), finD(glove)], dashLow, { name: 'dashLower' }));
    const latch = new THREE.Mesh(kit.geo.roundedBox(0.05, 0.014, 0.01, 0.004, 1), chrome);
    latch.position.set(-0.4, 0.73, 0.27);
    g.add(latch);
    // binnacle hood over the cluster
    const bin = [];
    for (let i = 0; i <= 16; i++) bin.push([0.565 - (0.39 * i) / 16, 0, 0]);
    const hoodProf = [[0.44, 0.885], [0.43, 0.945], [0.38, 0.978], [0.3, 0.986], [0.235, 0.976], [0.206, 0.954], [0.21, 0.94], [0.236, 0.95], [0.3, 0.962], [0.36, 0.955], [0.4, 0.935], [0.41, 0.885]];
    const binP = B.sweep(bin, hoodProf, { up: [0, 1, 0], profileClosed: true, capStart: true, capEnd: true, flip: true });
    g.add(B.mesh([binP], M.shared('kz:binnacle', () => M.surface({ color: 0x1b1c1e, roughness: 0.8 })), { name: 'binnacle' }));
    // cluster recess walls (dark) and the live gauges
    const rec = new THREE.Mesh(kit.geo.box(0.36, 0.15, 0.005), M.shared('kz:recess', () => M.surface({ color: 0x0b0b0c, roughness: 0.9 })));
    rec.position.set(0.37, 0.875, 0.385);
    g.add(rec);
    g.add(I.cluster({ pos: [0.37, 0.874, 0.374], size: [0.33, 0.118], tilt: 8, type: 'analog3', redline: ctx.spec.engine.redline, maxRpm: 9000, maxSpeed: 220, accent: kit.accent, hood: false, px: 768, glow: 1.1, glass: true }));
    // switch pods on the binnacle sides (80s satellite switches)
    for (const sx of [0.2, 0.54]) {
      const pod = new THREE.Mesh(kit.geo.roundedBox(0.05, 0.05, 0.04, 0.008, 2), M.shared('kz:pod', () => M.surface({ color: 0x18191b, roughness: 0.6 })));
      pod.position.set(sx, 0.86, 0.255);
      g.add(pod);
      for (let k = 0; k < 2; k++) { const sw = new THREE.Mesh(kit.geo.roundedBox(0.03, 0.012, 0.012, 0.003, 1), M.shared('kz:switch', () => M.surface({ color: 0x2b2c2f, roughness: 0.4 }))); sw.position.set(sx, 0.875 - k * 0.022, 0.232); g.add(sw); }
    }
    // dash-top speaker grilles and the windscreen demister slot
    const spkM = I.mat('speaker', { color: 0xffffff, roughness: 0.7, repeat: 6 });
    for (const sx of [1, -1]) {
      const sp = new THREE.Mesh(kit.geo.roundedBox(0.16, 0.004, 0.07, 0.012, 2), spkM);
      sp.position.set(sx * 0.56, 0.889, 0.47); sp.rotation.x = -0.03;
      g.add(sp);
    }
    const demist = new THREE.Mesh(kit.geo.roundedBox(0.7, 0.004, 0.022, 0.008, 2), M.shared('kz:recess', () => M.surface({ color: 0x0b0b0c, roughness: 0.9 })));
    demist.position.set(-0.05, 0.888, 0.53);
    g.add(demist);
    // outer vents (round, 80s) at both dash ends, square vents in the centre stack
    for (const sx of [1, -1]) g.add(I.vent({ pos: [sx * 0.635, 0.815, 0.268], size: [0.085, 0.085], round: true, rot: [0, sx * 0.25, 0] }));
  }

  // ------------------------------------------------------------------ centre stack, head unit, console
  {
    const st = [];
    for (let i = 0; i <= 8; i++) st.push([0.128 - (0.256 * i) / 8, 0, 0]);
    const prof = [[0.5, 0.46], [0.29, 0.46], [0.262, 0.52], [0.282, 0.85], [0.32, 0.875], [0.5, 0.875]];
    const stack = B.sweep(st, prof, { up: [0, 1, 0], profileClosed: true, capStart: true, capEnd: true, flip: true });
    g.add(B.mesh([stack], M.shared('kz:stack', () => M.surface({ color: 0x1c1d1f, roughness: 0.55 })), { name: 'stack' }));
    // stack face lean (bottom closer to the driver): screen and panels follow it
    const lean = Math.atan2(0.282 - 0.262, 0.85 - 0.52);
    const faceZ = (y) => 0.262 + (y - 0.52) * Math.tan(lean);
    // square vents above the radio
    for (const sx of [1, -1]) g.add(I.vent({ pos: [sx * 0.058, 0.818, 0.259], size: [0.094, 0.05], rot: [0, Math.PI, 0] }));
    // aftermarket double-DIN unit (the menu is projected onto its screen)
    g.add(I.headUnit({ pos: [0, 0.715, faceZ(0.715) - 0.01], size: [0.16, 0.09], tilt: lean / (Math.PI / 180) + 4, style: 'doubleDin', bezel: 0.009 }));
    // HVAC: three sliders on a lit strip and a fan knob
    const hvC = B.canvas(512, 128), hg = hvC.getContext('2d');
    hg.fillStyle = '#0c0c0d'; hg.fillRect(0, 0, 512, 128);
    hg.strokeStyle = '#3a3b3e'; hg.lineWidth = 3;
    for (let i = 0; i < 3; i++) { hg.beginPath(); hg.moveTo(40, 30 + i * 34); hg.lineTo(470, 30 + i * 34); hg.stroke(); }
    hg.fillStyle = '#e8b04a'; hg.font = `600 18px ${B.fonts.ui}`; hg.textAlign = 'left';
    ['TEMP  ❄ ─────── ♨', 'MODE  ▲  ▼  ⇣  ⌇', 'FAN   0  1  2  3  4'].forEach((t, i) => hg.fillText(t, 44, 22 + i * 34));
    const hvT = B.tex(hvC);
    const hv = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), M.surface({ color: 0xffffff, map: hvT, emissive: 0xffffff, emissiveMap: hvT, emissiveIntensity: 0.35, roughness: 0.4 }));
    hv.position.set(0, 0.6, faceZ(0.6) - 0.002); hv.rotation.set(-lean, Math.PI, 0);
    g.add(hv);
    for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.012, 0.014, 0.003, 1), M.shared('kz:slider', () => M.surface({ color: 0xbfc1c4, roughness: 0.3, metalness: 0.6 }))); k.position.set(0.06 - i * 0.045, 0.612 - i * 0.0085, faceZ(0.612) - 0.008); g.add(k); }
    g.add(I.knob({ pos: [0.0, 0.545, faceZ(0.545) - 0.002], r: 0.016, len: 0.018, rot: [Math.PI - lean, 0, 0] }));
    for (const sx of [1, -1]) { const lighter = new THREE.Mesh(kit.geo.cylinderZ(0.011, 0.01, 14), chrome); lighter.position.set(sx * 0.07, 0.535, faceZ(0.535) - 0.004); g.add(lighter); }
    // console on the tunnel: tray, shifter, handbrake
    const con = [];
    for (let i = 0; i <= 10; i++) con.push([0, 0, 0.3 - (0.92 * i) / 10]);
    const conP = B.sweep(con, (s) => { const top = 0.44 - 0.03 * s, w = 0.1 - 0.012 * s; return [[-w, 0.3], [-w, top - 0.02], [-w + 0.02, top], [w - 0.02, top], [w, top - 0.02], [w, 0.3]]; }, { up: [0, 1, 0], capEnd: true });
    g.add(B.mesh([conP], M.shared('kz:console', () => M.surface({ color: 0x1e1f21, roughness: 0.62 })), { name: 'console' }));
    g.add(I.shifter2({ pos: [0, 0.43, -0.02], gears: 5, knob: 'ball', lean: 0.18, boot: I.leather(0x161616, 0.65) }));
    g.add(I.handbrake({ pos: [0, 0.415, -0.36], hydro: parts.handbrake === 'hydro' }));
    const tray = new THREE.Mesh(kit.geo.roundedBox(0.12, 0.01, 0.1, 0.004, 1), M.shared('kz:tray', () => M.surface({ color: 0x0c0c0d, roughness: 0.9 })));
    tray.position.set(0, 0.442, 0.17);
    g.add(tray);
  }

  // ------------------------------------------------------------------ steering wheel and pedals
  const star = () => {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.008 : 0.019; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const m = new THREE.Mesh(kit.geo.extrude(pts, 0.003, { axis: 'z', bevel: 0.001 }), chrome);
    return m;
  };
  g.add(I.wheel2({ pos: [0.37, 0.858, 0.09], radius: 0.186, tilt: 23, style: '80s3', grip: M.shared('kz:grip', () => M.surface({ color: 0x161617, roughness: 0.55 })), spoke: M.shared('kz:spoke', () => M.surface({ color: 0x1f2022, roughness: 0.45, metalness: 0.2 })), pad: M.shared('kz:pad', () => M.surface({ color: 0x18191a, roughness: 0.7 })), emblem: star, column: 0.2 }));
  g.add(I.pedals2({ pos: [0.37, 0.36, 0.5], sport: !!(parts.suspension && parts.suspension !== 'stock') }));

  // ------------------------------------------------------------------ seats
  const seatOpts = cage
    ? { w: 0.52, len: 0.5, h: 0.12, back: 0.62, recline: 15, bolster: 0.07, backBolster: 0.12, headrest: 'integrated', harness: true, insert: I.mat('alcantara', { color: 0x1a1a1c, repeat: 6 }), side: I.leather(0x121213) }
    : { w: 0.5, len: 0.5, h: 0.125, back: 0.6, recline: 17, bolster: 0.035, backBolster: 0.07, headrest: 'separate', insert: cloth, side: vinyl };
  for (const sx of [1, -1]) {
    if (gutted && sx < 0 && !cage) continue;
    const seat = I.seat2({ ...seatOpts, pos: [sx * 0.37, 0.265, -0.38], trim: 0x3d3f43 });
    g.add(seat);
  }
  if (!gutted) {
    // rear bench: one wide low cushion and a reclined back (2+2)
    const rb = I.seat2({ w: 0.98, len: 0.42, h: 0.14, back: 0.52, recline: 26, bolster: 0.02, backBolster: 0.035, headrest: 'none', insert: cloth, side: vinyl, pos: [0, 0.3, -1.08] });
    g.add(rb);
  }
  // seatbelts hanging on the B-pillars, buckles beside the front seats
  for (const sx of [1, -1]) {
    const xb = S.sideAt(-0.72, 1.0) - 0.04;
    const belt = B.sweep([[sx * xb, 1.16, -0.73], [sx * (xb - 0.01), 0.8, -0.71], [sx * (xb - 0.02), 0.36, -0.68]], [[-0.024, 0], [0.024, 0], [0.024, 0.003], [-0.024, 0.003]], { sub: 3, profileClosed: true, upFn: () => [sx, 0, 0] });
    g.add(B.mesh([belt], M.shared('kz:belt', () => M.surface({ color: 0x1a1a1b, roughness: 0.9 }))));
    const buckle = new THREE.Mesh(kit.geo.roundedBox(0.03, 0.07, 0.025, 0.006, 1), satin);
    buckle.position.set(sx * 0.12, 0.42, -0.55); buckle.rotation.x = -0.3;
    g.add(buckle);
  }

  // ------------------------------------------------------------------ door hardware (built for the left door, mirrored)
  {
    const side = new THREE.Group();
    const xin = (z, y) => S.sideAt(z, y) - thick(0.7, y, z);
    const arm = [];
    for (let i = 0; i <= 10; i++) { const z = 0.3 - (0.78 * i) / 10; arm.push([xin(z, 0.6), 0.6, z]); }
    side.add(B.mesh([B.sweep(arm, (s) => { const k = 1 - 0.3 * ss(0.75, 1, s); return [[0.002, -0.035], [0.045 * k, -0.038], [0.062 * k, -0.012], [0.056 * k, 0.018], [0.02, 0.028], [0.002, 0.03]]; }, { sub: 2, capStart: true, capEnd: true, up: [0, 1, 0] })], vinyl, { name: 'armrest' }));
    // pull handle recess in the armrest
    const pull = new THREE.Mesh(kit.geo.roundedBox(0.03, 0.03, 0.12, 0.01, 2), satin);
    pull.position.set(xin(-0.25, 0.6) - 0.05, 0.585, -0.25);
    side.add(pull);
    // inner door handle (chrome lever in a black cup)
    const zh = 0.38, yh = 0.79;
    const cup = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.05, 0.11, 0.008, 2), satin);
    cup.position.set(xin(zh, yh) - 0.004, yh, zh);
    const lever = new THREE.Mesh(kit.geo.roundedBox(0.01, 0.016, 0.09, 0.005, 2), chrome);
    lever.position.set(xin(zh, yh) - 0.012, yh, zh - 0.005);
    side.add(cup, lever);
    // window crank
    const zc = 0.12, yc = 0.48, xc = xin(zc, yc);
    const base = new THREE.Mesh(kit.geo.cylinderX(0.022, 0.012, 16), satin); base.position.set(xc - 0.006, yc, zc);
    const crankArm = new THREE.Mesh(kit.geo.roundedBox(0.008, 0.012, 0.085, 0.004, 1), chrome); crankArm.position.set(xc - 0.016, yc - 0.012, zc - 0.03); crankArm.rotation.x = 0.4;
    const knobC = new THREE.Mesh(kit.geo.cylinderX(0.009, 0.04, 12), satin); knobC.position.set(xc - 0.035, yc - 0.03, zc - 0.068);
    side.add(base, crankArm, knobC);
    // speaker grille and map pocket
    const zs = 0.42, ys = 0.36, xs = xin(zs, ys);
    const spk = new THREE.Mesh(new THREE.CircleGeometry(0.062, 28), I.mat('speaker', { color: 0xffffff, roughness: 0.6, repeat: 3 }));
    spk.position.set(xs - 0.003, ys, zs); spk.rotation.y = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.063, 0.005, 6, 28), satin); ring.position.copy(spk.position); ring.rotation.y = -Math.PI / 2;
    side.add(spk, ring);
    const pocket = [];
    for (let i = 0; i <= 8; i++) { const z = 0.3 - (0.62 * i) / 8; pocket.push([xin(z, 0.33), 0.33, z]); }
    side.add(B.mesh([B.sweep(pocket, [[0.0, -0.05], [0.035, -0.05], [0.04, 0.03], [0.03, 0.04], [0.0, 0.0]], { capStart: true, capEnd: true, up: [0, 1, 0] })], vinyl));
    // door lock knob on the sill
    const lk = new THREE.Mesh(kit.geo.cylinderZ(0.005, 0.03, 8), chrome); lk.rotation.x = Math.PI / 2;
    lk.position.set(xin(-0.5, geo.beltY(-0.5)) - 0.012, geo.beltY(-0.5) + 0.008, -0.5);
    side.add(lk);
    g.add(side);
    const other = side.clone(); other.scale.x = -1; g.add(other);
  }

  // ------------------------------------------------------------------ roof: visors, mirror (with a temple charm), dome light, grab handle
  {
    const hz = geo.zHead(0) + 0.06;
    for (const sx of [1, -1]) {
      const vz = hz + 0.02, vx = sx * 0.37, vy = S.topAt(vz - 0.08, vx) - 0.04;
      const visor = new THREE.Mesh(kit.geo.roundedBox(0.33, 0.022, 0.155, 0.01, 2), headliner);
      visor.position.set(vx, vy, vz - 0.08);
      visor.rotation.x = -0.12;
      g.add(visor);
    }
    const my = S.topAt(hz, 0) - 0.03;
    const stalk = new THREE.Mesh(kit.geo.tube([[0, my + 0.01, hz + 0.01], [0, my - 0.03, hz], [0, my - 0.055, hz - 0.01]], 0.007, 6, 6), satin);
    const mirror = new THREE.Group();
    const mb = new THREE.Mesh(kit.geo.roundedBox(0.23, 0.062, 0.03, 0.014, 2), satin);
    const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.048), M.shared('car:mirrorGlass', () => M.surface({ color: 0xa8b0ba, roughness: 0.02, metalness: 1 })));
    mg.position.z = -0.0155; mg.rotation.y = Math.PI;
    mirror.add(mb, mg);
    mirror.position.set(0, my - 0.075, hz - 0.015);
    mirror.rotation.y = 0.18;
    g.add(stalk, mirror);
    // 平安 charm on a red string (a very Taiwanese mirror ornament)
    const charmC = B.canvas(128, 192), cg = charmC.getContext('2d');
    cg.fillStyle = '#b3151a'; cg.fillRect(0, 0, 128, 192);
    cg.strokeStyle = '#e7b74c'; cg.lineWidth = 6; cg.strokeRect(8, 8, 112, 176);
    cg.fillStyle = '#f0c25a'; cg.font = `700 52px ${B.fonts.cjk}`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.fillText('平', 64, 62); cg.fillText('安', 64, 128);
    const charmM = M.surface({ color: 0xffffff, map: B.tex(charmC), roughness: 0.7 });
    const charm = new THREE.Mesh(kit.geo.roundedBox(0.034, 0.05, 0.007, 0.003, 1), charmM);
    charm.position.set(-0.02, my - 0.2, hz - 0.03);
    charm.rotation.y = Math.PI + 0.3;
    const string = new THREE.Mesh(kit.geo.tube([[0, my - 0.06, hz - 0.012], [-0.012, my - 0.12, hz - 0.022], [-0.02, my - 0.175, hz - 0.03]], 0.0012, 6, 4), M.shared('kz:string', () => M.surface({ color: 0xc0141a, roughness: 0.8 })));
    const tassel = new THREE.Mesh(kit.geo.cylinderZ(0.004, 0.035, 6), M.shared('kz:string', () => M.surface({ color: 0xc0141a, roughness: 0.8 })));
    tassel.rotation.x = Math.PI / 2; tassel.position.set(-0.02, my - 0.243, hz - 0.03);
    g.add(charm, string, tassel);
    // dome light and passenger grab handle
    const dz = -0.62, dy = S.topAt(dz, 0) - 0.028;
    const dome = new THREE.Mesh(kit.geo.roundedBox(0.12, 0.012, 0.055, 0.005, 1), M.shared('kz:dome', () => M.surface({ color: 0xe9e4d6, roughness: 0.3, emissive: 0xfff1d6, emissiveIntensity: 0.05 })));
    dome.position.set(0, dy, dz);
    g.add(dome);
    const gx = -(S.corner(5, -0.3)[0] - 0.045), gy = S.corner(5, -0.3)[1] - 0.075;
    const grab = new THREE.Mesh(kit.geo.tube([[gx + 0.01, gy + 0.02, -0.18], [gx - 0.025, gy - 0.025, -0.24], [gx - 0.025, gy - 0.025, -0.36], [gx + 0.01, gy + 0.02, -0.42]], 0.011, 16, 8), satin);
    g.add(grab);
    // ETC tag on the windscreen behind the mirror
    const tz = hz + 0.1, tp = S.topPoint(tz, -0.06);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.035), M.shared('kz:etc', () => M.surface({ color: 0xf2f2ee, roughness: 0.6 })));
    tag.position.set(tp.p[0], tp.p[1] - 0.0045, tp.p[2]);
    tag.lookAt(tp.p[0] - tp.n[0], tp.p[1] - tp.n[1] - 0.0045, tp.p[2] - tp.n[2]);
    g.add(tag);
  }

  // ------------------------------------------------------------------ roll cage
  if (cage) {
    const tubes = [];
    const ix = (z, y) => S.sideAt(z, y) - thick(0.7, y, z) - 0.035;
    const roofY = (z, x) => S.topAt(z, x) - 0.06;
    const zH = -0.86;
    const hoop = [];
    for (let i = 0; i <= 8; i++) { const y = 0.28 + (0.92 * i) / 8; hoop.push([ix(zH, Math.min(y, 1.05)), Math.min(y, roofY(zH, 0.6)), zH]); }
    const top = [[ix(zH, 1.05), roofY(zH, 0.6), zH], [0, roofY(zH, 0) - 0.01, zH]];
    const left = hoop.concat([top[1]]);
    const full = left.concat(left.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]]));
    tubes.push(B.from(kit.geo.tube(full, 0.02, 64, 10)));
    for (const sx of [1, -1]) {
      // A-pillar bar: floor near the dash, up the pillar, back along the roof to the hoop
      const a = [[sx * ix(0.45, 0.3), 0.3, 0.45], [sx * ix(0.3, 0.75), 0.75, 0.32], [sx * (S.corner(5, 0.05)[0] - 0.06), S.corner(5, 0.05)[1] - 0.06, 0.05], [sx * (S.corner(5, -0.4)[0] - 0.07), roofY(-0.4, 0.55), -0.4], [sx * (S.corner(5, zH)[0] - 0.08), roofY(zH, 0.55), zH + 0.01]];
      tubes.push(B.from(kit.geo.tube(a, 0.019, 40, 10)));
      // door bar and rear stay
      tubes.push(B.from(kit.geo.tube([[sx * ix(0.4, 0.55), 0.55, 0.4], [sx * ix(-0.2, 0.62), 0.62, -0.2], [sx * ix(zH, 0.55), 0.55, zH]], 0.018, 24, 8)));
      tubes.push(B.from(kit.geo.tube([[sx * ix(zH, 1.0), roofY(zH, 0.55) - 0.02, zH], [sx * 0.55, 0.75, -1.4], [sx * 0.55, 0.62, -1.6]], 0.018, 24, 8)));
    }
    // diagonal in the main hoop
    tubes.push(B.from(kit.geo.tube([[ix(zH, 1.0) - 0.02, roofY(zH, 0.5) - 0.03, zH], [-ix(zH, 0.4) + 0.02, 0.32, zH]], 0.018, 16, 8)));
    g.add(B.mesh(tubes, M.shared('kz:cage', () => M.surface({ color: 0xd9d6cf, roughness: 0.4, metalness: 0.3 })), { name: 'cage' }));
  }
  return { group: g, eye: [0.37, 1.075, -0.36] };
}
