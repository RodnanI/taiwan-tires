// Hoshino Kaze 86 exterior: 1986 three-door hatch coupe. Wedge nose with pop-up lamps, slab sides with a waist
// crease, thin pillars, big glass hatch, black wraparound bumpers and a full-width tail lamp band.
// Everything is cut from one lofted surface (kit.body), so panels, glass and lenses sit flush by construction.
export function buildExterior(ctx) {
  const { THREE, kit, spec, visual, parts } = ctx;
  const B = kit.body, M = kit.M, sd = B.sd, mat = B.mat;
  const g = new THREE.Group();
  const mods = visual.mods || {};
  const R = spec.tires.radius[0], zAx = spec.wheelbase / 2;
  const zF = 1.985, zR = -2.06;
  const A = Math.abs;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ surface
  // corners: C0 floor centre, C1 floor edge, C2 rocker, C3 waist crease, C4 belt / fender top, C5 roof side, C6 top centre
  const st = (z, y0, x1, x2, y2, x3, y3, x4, y4, x5, y5, y6, r = {}) => ({ z, pts: [
    [0, y0, 0.05], [x1, y0, r.c1 ?? 0.03], [x2, y2, r.c2 ?? 0.03], [x3, y3, r.c3 ?? 0.012], [x4, y4, r.c4 ?? 0.011], [x5, y5, r.c5 ?? 0.04], [0, y6, r.c6 ?? 0.9]] });
  const stations = [
    st(zR, 0.31, 0.6, 0.72, 0.335, 0.765, 0.665, 0.755, 0.935, 0.66, 0.945, 0.952, { c5: 0.06, c2: 0.04 }),
    st(-2.04, 0.285, 0.66, 0.765, 0.312, 0.792, 0.666, 0.78, 0.944, 0.69, 0.956, 0.962, { c5: 0.05 }),
    st(-1.97, 0.25, 0.69, 0.778, 0.29, 0.803, 0.666, 0.789, 0.948, 0.703, 0.968, 0.982),
    st(-1.7, 0.2, 0.71, 0.785, 0.275, 0.81, 0.665, 0.792, 0.947, 0.69, 1.058, 1.075),
    st(-1.3, 0.175, 0.72, 0.787, 0.27, 0.812, 0.662, 0.793, 0.944, 0.668, 1.195, 1.215),
    st(-1.0, 0.17, 0.72, 0.788, 0.27, 0.812, 0.66, 0.792, 0.941, 0.64, 1.288, 1.31),
    st(-0.9, 0.17, 0.72, 0.788, 0.27, 0.812, 0.66, 0.792, 0.94, 0.632, 1.303, 1.327),
    st(-0.55, 0.17, 0.72, 0.788, 0.27, 0.812, 0.657, 0.79, 0.934, 0.622, 1.312, 1.335),
    st(-0.26, 0.17, 0.72, 0.788, 0.27, 0.812, 0.655, 0.789, 0.929, 0.622, 1.298, 1.318),
    st(-0.12, 0.17, 0.72, 0.788, 0.27, 0.812, 0.654, 0.789, 0.926, 0.628, 1.248, 1.268),
    st(0.15, 0.17, 0.72, 0.787, 0.27, 0.811, 0.652, 0.788, 0.918, 0.645, 1.08, 1.098),
    st(0.5, 0.171, 0.712, 0.786, 0.271, 0.81, 0.648, 0.787, 0.887, 0.662, 0.895, 0.905),
    st(0.62, 0.172, 0.71, 0.786, 0.272, 0.81, 0.647, 0.787, 0.869, 0.655, 0.866, 0.874, { c5: 0.07 }),
    st(0.95, 0.18, 0.7, 0.785, 0.28, 0.807, 0.643, 0.785, 0.826, 0.64, 0.834, 0.843, { c5: 0.1 }),
    st(1.45, 0.2, 0.69, 0.78, 0.3, 0.8, 0.635, 0.78, 0.766, 0.62, 0.77, 0.778, { c5: 0.12 }),
    st(1.8, 0.25, 0.66, 0.762, 0.33, 0.79, 0.625, 0.772, 0.704, 0.6, 0.707, 0.713, { c5: 0.12 }),
    st(1.94, 0.29, 0.62, 0.73, 0.35, 0.765, 0.618, 0.752, 0.664, 0.58, 0.667, 0.673, { c5: 0.1 }),
    st(zF, 0.33, 0.56, 0.68, 0.37, 0.72, 0.612, 0.71, 0.633, 0.55, 0.636, 0.641, { c5: 0.08 }),
  ];
  const arches = [{ z: zAx, y: R + 0.012, r: 0.334 }, { z: -zAx, y: R + 0.012, r: 0.34 }];
  const flare = (x, y, z) => {
    if (x < 0.55 || y < 0.15) return [0, 0];
    let d = 0;
    for (const a of arches) { const q = Math.hypot(z - a.z, y - a.y) - a.r; if (q > -0.06 && q < 0.13) d = Math.max(d, q < 0 ? 1 : Math.pow(1 - q / 0.13, 2)); }
    return [0.009 * d * smooth(0.55, 0.7, x), 0];
  };
  // AI and distant cars (no interior) use a lighter surface
  const S = B.loft(stations, {
    lod: ctx.interior ? 1 : 0.7,
    fillet: [2, 3, 4, 4, 4, 6, 6], seg: [5, 1, 10, 8, 10, 11], rows: 190, cluster: 0.25,
    capRear: { dome: 0.006, rings: 22 }, capFront: { dome: 0.014, rings: 22 }, displace: [flare],
  });
  const c4 = (z) => S.corner(4, z), c5 = (z) => S.corner(5, z);
  const beltY = (z) => c4(z)[1];
  const dC5 = (x, y, z) => { const c = c5(z); return Math.hypot(A(x) - c[0], y - c[1]); };
  const onTop = (x, y, z) => A(x) - c5(z)[0];
  const line = (z1, y1, z2, y2) => { const dz = z2 - z1, dy = y2 - y1, l = Math.hypot(dz, dy); return (z, y) => ((z - z1) * dy - (y - y1) * dz) / l; };

  let body = S.patch;
  const xi = 0.49;
  const archFn = (a, grow = 0) => (x, y, z) => Math.max(Math.hypot(z - a.z, y - a.y) - a.r - grow, xi - A(x));
  for (const a of arches) body = B.hole(body, archFn(a));

  // ------------------------------------------------------------------ glass openings
  const wsBase = (x) => 0.567 - 0.05 * (x / 0.66) ** 2;
  const zHead = (x) => -0.205 + 0.03 * (x / 0.62) ** 2;
  const fWS = (x, y, z) => Math.max(z - wsBase(A(x)), zHead(A(x)) - z, 0.033 - dC5(x, y, z), onTop(x, y, z));
  const zRoofR = (x) => -0.955 - 0.03 * (x / 0.62) ** 2;
  const zRGB = (x) => -1.937 + 0.02 * (x / 0.7) ** 2;
  const fRG = (x, y, z) => Math.max(z - zRoofR(A(x)), zRGB(A(x)) - z, 0.036 - dC5(x, y, z), onTop(x, y, z));
  const cLine = line(-1.46, 0.95, -1.06, 1.29);   // quarter window rear edge (C-pillar front)
  const upper = (x, y, z) => Math.max(-onTop(x, y, z), beltY(z) + 0.006 - y, 0.018 - dC5(x, y, z));
  const fFrame = (x, y, z) => Math.max(upper(x, y, z), -cLine(z, y), 0.5 - A(x), z - 0.575);
  let [ws, b1] = B.cut(body, fWS, { gap: 0.007 });
  let [rg, b2] = B.cut(b1, fRG, { gap: 0.007 });
  let [frame, b3] = B.cut(b2, fFrame, { gap: 0.004 });
  body = b3;
  // glass inside the black frame: door glass ahead of the B-pillar, fixed quarter light behind it
  const fDoorGlass = (x, y, z) => Math.max(beltY(z) + 0.02 - y, 0.04 - dC5(x, y, z), -0.645 - z);
  const fQGlass = (x, y, z) => Math.max(beltY(z) + 0.022 - y, 0.042 - dC5(x, y, z), z + 0.765, 0.016 - cLine(z, y));
  let [doorGlass, fr1] = B.cut(frame, fDoorGlass, { gap: 0.003 });
  let [qGlass, frameRest] = B.cut(fr1, fQGlass, { gap: 0.003 });
  // windscreen and hatch glass get a black ceramic frit border
  const fWSin = (x, y, z) => Math.max(z - wsBase(A(x)) + 0.032, zHead(A(x)) - z + 0.03, 0.068 - dC5(x, y, z));
  let [wsClear, wsFrit] = B.cut(ws, fWSin, { gap: 0, r: 0 });
  const fRGin = (x, y, z) => Math.max(z - zRoofR(A(x)) + 0.035, zRGB(A(x)) - z + 0.045, 0.07 - dC5(x, y, z));
  let [rgClear, rgFrit] = B.cut(rg, fRGin, { gap: 0, r: 0 });

  // ------------------------------------------------------------------ panels
  const hoodX = (z) => c4(z)[0] - 0.036;
  const fHood = (x, y, z) => Math.max(A(x) - hoodX(z), 0.628 - z, 0.622 - y);
  let [hood, p1] = B.cut(body, fHood);
  const lid = { x0: 0.405, x1: 0.695, z0: 1.715 };
  const fLid = (x, y, z) => Math.max(sd.box(A(x), z, (lid.x0 + lid.x1) / 2, 1.9, (lid.x1 - lid.x0) / 2, 0.185, 0.012), 0.625 - y);
  let [lids, hoodMain] = B.cut(hood, fLid);
  const fCowl = (x, y, z) => Math.max(z - 0.624, wsBase(A(x)) + 0.004 - z, A(x) - 0.69, onTop(x, y, z));
  let [cowl, p2] = B.cut(p1, fCowl, { gap: 0.003 });
  const fDoor = (x, y, z) => Math.max(z - 0.605, -0.655 - z, 0.296 - y, y - beltY(z) - 0.004, 0.55 - A(x));
  let [doors, p3] = B.cut(p2, fDoor);
  const fHatch = (x, y, z) => Math.max(z - zRGB(A(x)) - 0.004, 0.858 - y, onTop(x, y, z) + 0.004);
  let [hatch, p4] = B.cut(p3, fHatch);
  const fNose = (x, y, z) => Math.max(1.93 - z, 0.47 - y, A(x) - 0.62);
  let [nose, p5] = B.cut(p4, fNose);
  // tail lamp band on the rear face, split into lamps and the centre garnish
  const fBand = (x, y, z) => Math.max(sd.box(x, y, 0, 0.728, 0.775, 0.083, 0.012), z + 1.995);
  let [band, p6] = B.cut(p5, fBand, { gap: 0.003 });
  const fFuel = (x, y, z) => Math.max(sd.box(z, y, -1.64, 0.79, 0.056, 0.056, 0.014), 0.5 - x);
  let [fuel, rest] = B.cut(p6, fFuel, { gap: 0.003 });
  const [garnish, lampsRear] = B.cut(band, (x, y, z) => A(x) - 0.352, { gap: 0.004 });
  // grille slot in the nose panel
  const fSlot = (x, y, z) => sd.box(x, y, 0, 0.565, 0.3, 0.026, 0.012);
  nose = B.hole(nose, fSlot);
  {
    // slot backing plate and three thin slats
    const back = new THREE.Mesh(kit.geo.box(0.62, 0.07, 0.01), mat.cavity());
    back.position.set(0, 0.565, 1.93);
    g.add(back);
    const sl = [];
    for (const dy of [-0.014, 0, 0.014]) sl.push(kit.geo.place(kit.geo.roundedBox(0.6, 0.006, 0.03, 0.002, 1), [0, 0.565 + dy, 1.962]));
    g.add(new THREE.Mesh(kit.geo.merge(sl), mat.satinBlack()));
  }

  // finish panels: rolled edges, then paint splits (two-tone) cut across finished panels
  const fin = (p, o = {}) => B.merge([p, B.roll(p, { r: 0.0018, depth: 0.005, ...o })]);
  const nearArch = (x, y, z) => arches.some((a) => Math.abs(Math.hypot(z - a.z, y - a.y) - a.r) < 0.012 && A(x) > xi + 0.02);
  // edges around fixed glass roll into a black seal instead of showing paint from inside the car
  const nearGlass = (x, y, z) => A(fWS(x, y, z)) < 0.012 || A(fRG(x, y, z)) < 0.012;
  const [glassRoll, glassWall] = B.roll(rest, { r: 0.0018, depth: 0.006, only: nearGlass, splitWall: true });
  let paintPieces = [fin(hoodMain), fin(doors), fin(hatch), fin(fuel), fin(rest, { only: (x, y, z) => !nearArch(x, y, z) && !nearGlass(x, y, z) }), B.roll(rest, { r: 0.004, depth: 0.03, only: nearArch }), glassRoll];
  // the nose slot gets a deep black throat
  const noseF = B.merge([nose, B.roll(nose, { r: 0.0018, depth: 0.005, only: (x, y) => !(A(x) < 0.32 && y > 0.53 && y < 0.6) })]);
  const [slotRoll, slotWall] = B.roll(nose, { r: 0.003, depth: 0.05, only: (x, y) => A(x) < 0.32 && y > 0.53 && y < 0.6, splitWall: true });
  paintPieces.push(noseF, slotRoll);
  const twoTone = mods.livery === 'panda';
  const paint2 = twoTone ? M.paint('#141518', 'gloss') : null;
  let lower = [];
  if (twoTone) {
    const yLine = 0.47;
    const up = [], lo = [];
    for (const p of paintPieces) { const [a, b] = B.split(p, (x, y) => y - yLine); lo.push(a); up.push(b); }
    paintPieces = up; lower = lo;
  }
  const blackFrame = fin(frameRest, { depth: 0.004 });
  const cowlP = fin(cowl);
  g.add(B.assemble({
    paint: paintPieces,
    ...(twoTone ? { paint2: lower } : {}),
    satin: [blackFrame],
    blackPlastic: [B.projectUV(cowlP, 'y', 1), B.projectUV(fin(garnish), 'z', 1), B.projectUV(slotWall, 'z', 1)],
    frit: [wsFrit, rgFrit],
  }, { paint: kit.paint, paint2, satin: mat.satinBlack(), blackPlastic: mat.blackPlastic(), frit: mat.frit() }));
  // glass sits a few mm inside its opening
  const sink = (p, d) => B.offset(p, -d);
  const dark = mods.tint === 'dark';
  g.add(B.glass([sink(wsClear, 0.003)], { tint: 0x16201f, outer: 0.5, inner: 0.1 }));
  g.add(B.glass([sink(rgClear, 0.003), sink(doorGlass, 0.006), sink(qGlass, 0.005)], dark ? { tint: 0x050607, outer: 0.82, inner: 0.3 } : { tint: 0x16201f, outer: 0.5, inner: 0.1 }));
  // rubber seals around the fixed glass and the belt line
  const sealProfile = [[-0.006, -0.004], [-0.002, 0.0015], [0.003, 0.0022], [0.006, -0.003]];
  const seals = [B.bead(ws, sealProfile), B.bead(rg, sealProfile), B.bead(qGlass, [[-0.003, -0.004], [0, 0.001], [0.004, 0.0012], [0.006, -0.004]])];
  // belt seal: the strip between door skin and glass
  g.add(B.mesh([...(ctx.interior ? seals : []), glassWall], mat.rubber(), { name: 'seals' }));

  // ------------------------------------------------------------------ wheel wells
  for (const a of arches) g.add(B.mesh(B.wheelWell(S, { z: a.z, y: a.y, r: a.r + 0.004, xi, bottom: 0.15 }), mat.wellLiner(), { name: 'well' }));

  // ------------------------------------------------------------------ bumpers (swept along the plan outline)
  const plan = (wx, zEnd, zFace, rc, n = 9) => {
    // left side rear end -> corner -> centre -> mirrored (y = 0, the profile adds height)
    const pts = [];
    const sgn = Math.sign(zFace);
    pts.push([wx, 0, zEnd]);
    pts.push([wx, 0, zEnd + (zFace - sgn * rc - zEnd) * 0.5]);
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([wx - rc + Math.cos(a) * rc, 0, zFace - sgn * rc + sgn * Math.sin(a) * rc]); }
    pts.push([0.25, 0, zFace]);
    const right = pts.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]]);
    pts.push([0, 0, zFace]);
    return sgn > 0 ? pts.concat(right) : pts.concat(right).reverse();
  };
  const bumperProfile = (t, y0, y1, lip) => [
    [-0.02, y0 + 0.01], [t * 0.5, y0], [t * 0.92, y0 + 0.02], [t, y0 + 0.06], [t * 1.03, y1 - 0.075], [t * 1.08, y1 - 0.06],
    [t * 1.08, y1 - 0.035], [t * 1.0, y1 - 0.03], [t * 0.98, y1 - 0.012], [t * 0.7, y1], [-0.02, y1 + 0.002]].map((p) => [p[0], p[1] + (lip ? 0 : 0)]);
  const taper = (s) => smooth(0.0, 0.22, s) * smooth(1.0, 0.78, s);
  const fPath = plan(0.786, 1.53, 1.995, 0.17);
  let fb = B.sweep(fPath, (s) => bumperProfile(0.012 + 0.042 * taper(s), 0.255, 0.505), { sub: 3 });
  for (const a of arches) fb = B.hole(fb, archFn(a, 0.004), { r: 0 });
  const rPath = plan(0.79, -1.55, -2.072, 0.13);
  let rb = B.sweep(rPath, (s) => bumperProfile(0.012 + 0.052 * taper(s), 0.255, 0.52), { sub: 3 });
  for (const a of arches) rb = B.hole(rb, archFn(a, 0.004), { r: 0 });
  // front bumper lamps: long slim units in the wrap-around corners (u = path length, v = profile length)
  const uCorner = (() => { let L = 0; const P = B.smooth3(fPath, 3); for (let i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]); if (P[i][0] < 0.786 - 0.17 * 0.5 && P[i][2] > 1.9) return L; } return 0.5; })();
  const fbLampL = (x, y, z, u, v) => sd.box(u, y, uCorner - 0.02, 0.442, 0.2, 0.024, 0.01);
  const totalF = (() => { let L = 0; const P = B.smooth3(fPath, 3); for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return L; })();
  const fbLamp = (x, y, z, u, v) => Math.min(fbLampL(x, y, z, u, v), sd.box(totalF - u, y, uCorner - 0.02, 0.442, 0.2, 0.024, 0.01));
  let [fbLamps, fbRest] = B.cut(fb, fbLamp, { gap: 0.004 });
  // rear side reflectors: small red lenses in the bumper ends
  const totalR = (() => { let L = 0; const P = B.smooth3(rPath, 3); for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return L; })();
  const fRefl = (x, y, z, u) => Math.min(sd.box(u, y, 0.2, 0.43, 0.05, 0.016, 0.006), sd.box(totalR - u, y, 0.2, 0.43, 0.05, 0.016, 0.006));
  let [rRefl, rbRest] = B.cut(rb, fRefl, { gap: 0.003 });
  g.add(B.assemble({ bumper: { patches: [fbRest, rbRest], roll: { r: 0.0015, depth: 0.004 } } }, { bumper: mat.blackPlastic() }));
  g.add(B.mesh([B.offset(rRefl, -0.002)], mat.lensRed('lensOptic', 30), { name: 'lens' }));
  g.add(B.mesh([B.offset(rRefl, -0.008)], M.shared('car:reflRed', () => M.surface({ color: 0x5a0805, roughness: 0.3, metalness: 0.5 }))));
  // rubber rub strips along both bumpers
  const rib = (t, y) => [[t - 0.004, y - 0.011], [t + 0.006, y - 0.008], [t + 0.009, y], [t + 0.006, y + 0.008], [t - 0.004, y + 0.011]];
  g.add(B.mesh([
    B.sweep(fPath, (s) => rib((0.012 + 0.042 * taper(s)) * 1.05, 0.4), { sub: 3 }),
    B.sweep(rPath, (s) => rib((0.012 + 0.052 * taper(s)) * 1.05, 0.41), { sub: 3 }),
  ].map((p) => { let q = p; for (const a of arches) q = B.clip(q, (x, y, z) => -archFn(a, 0.006)(x, y, z)); return q; }), mat.rubber(), { name: 'rubStrip' }));
  // amber outer half, clear inner half
  const [fbAmber, fbClear] = B.split(fbLamps, (x) => 0.56 - A(x));
  g.add(B.mesh([B.offset(fbClear, -0.002)], mat.lensClear('lensRibs', 10), { name: 'lens' }));
  g.add(B.mesh([B.offset(fbAmber, -0.002)], mat.lensAmber('lensRibs', 10), { name: 'lens' }));
  const parkEm = B.emitter('head', 0x3a3326, 0.04);
  g.add(B.mesh([B.offset(fbClear, -0.014)], parkEm));
  g.add(B.mesh([B.offset(fbAmber, -0.014)], M.shared('em:amberIdle', () => M.surface({ color: 0x2a1505, emissive: 0xff7a10, emissiveIntensity: 0.05, roughness: 0.4 }))));

  // ------------------------------------------------------------------ tail lamps (lens cut flush from the body)
  const [tlRed, tlRest] = B.split(lampsRear, (x) => 0.505 - A(x));          // outer: tail / brake
  const [tlRev, tlAmb] = B.split(tlRest, (x) => A(x) - 0.43);               // inner: reverse, middle: indicator
  g.add(B.mesh([B.projectUV(tlRed, 'z', 1)], mat.lensRed('lensRibs', 9), { name: 'lens' }));
  g.add(B.mesh([B.projectUV(tlAmb, 'z', 1)], mat.lensAmber('lensRibs', 9), { name: 'lens' }));
  g.add(B.mesh([B.projectUV(tlRev, 'z', 1)], mat.lensClear('lensRibs', 9), { name: 'lens' }));
  const back = (p, d) => B.offset(p, -d);
  g.add(B.mesh([back(tlRed, 0.022)], B.emitter('brake', 0xff2414, 0.3)));
  g.add(B.mesh([back(tlRev, 0.022)], B.emitter('reverse', 0xf4f1ea, 0.02)));
  g.add(B.mesh([back(tlAmb, 0.022)], M.shared('em:amberIdle', () => M.surface({ color: 0x2a1505, emissive: 0xff7a10, emissiveIntensity: 0.05, roughness: 0.4 }))));
  // housings: walls from the lens edge back to the emitters
  g.add(B.mesh([B.skirt(lampsRear, [0, 0, 0.024])], mat.cavity()));

  // ------------------------------------------------------------------ pop-up headlamps
  // Each unit hinges at the lid's rear edge. Retracted, the lid is flush with the hood and the lamp faces down
  // inside the body; raised, the unit swings up so the lamp faces forward and the lid faces rearwards.
  const zLidF = 1.955;
  const hingeY = S.topAt(lid.z0, 0.55), frontY = S.topAt(zLidF, 0.55);
  const tilt = Math.atan2(hingeY - frontY, zLidF - lid.z0);
  const len = Math.hypot(zLidF - lid.z0, hingeY - frontY);
  const pop = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, hingeY, lid.z0);
    const inner = new THREE.Group();
    inner.position.set(0, -hingeY, -lid.z0);
    pivot.add(inner);
    const myLid = B.clip(lids, (x) => -x * side);
    inner.add(B.mesh([fin(myLid)], kit.paint, { name: 'popupLid' }));
    // box in the lid frame (local +z along the lid chord, -y into the body)
    const frameG = new THREE.Group();
    frameG.rotation.x = tilt;
    pivot.add(frameG);
    const xc = side * (lid.x0 + lid.x1) / 2, w = lid.x1 - lid.x0 - 0.014, hBox = 0.14, d0 = 0.014, L = len - 0.012;
    const yb = -d0 - hBox, cupH = 0.04;
    // body of the unit (stops above the lamp cup)
    const box = new THREE.Mesh(kit.geo.box(w, hBox - cupH, L), mat.satinBlack());
    box.position.set(xc, -d0 - (hBox - cupH) / 2, L / 2 + 0.003);
    frameG.add(box);
    const plate = new THREE.Mesh(kit.geo.roundedBox(w + 0.004, hBox + 0.006, 0.01, 0.004, 1), kit.paint);
    plate.position.set(xc, -d0 - hBox / 2 + 0.003, L + 0.004);
    frameG.add(plate);
    // lamp cup: black walls, glowing parabolic reflector, bulb, fluted lens (faces -y locally, forward when raised)
    const lensW = w - 0.036, lensL = L - 0.05, zc = L / 2 + 0.003;
    const walls = [];
    for (const [dx, dz, sx, sz] of [[0, -(lensL / 2 + 0.008), w, 0.016], [0, lensL / 2 + 0.008, w, 0.016], [-(lensW / 2 + 0.009), 0, 0.018, lensL], [lensW / 2 + 0.009, 0, 0.018, lensL]]) walls.push(kit.geo.place(kit.geo.box(sx, cupH, sz), [xc + dx, yb + cupH / 2, zc + dz]));
    frameG.add(new THREE.Mesh(kit.geo.merge(walls), mat.satinBlack()));
    const bowlG = kit.geo.latheZ([[0, -0.034], [0.25, -0.031], [0.5, -0.022], [0.75, -0.01], [1, 0]], 24);
    bowlG.rotateX(Math.PI / 2); // apex up inside the cup, opening faces -y
    bowlG.scale(lensW / 2, 1, lensL / 2);
    const bowl = new THREE.Mesh(bowlG, B.emitter('head', 0xfff4e2, 0.04));
    bowl.material.side = THREE.DoubleSide;
    bowl.position.set(xc, yb + 0.002, zc);
    frameG.add(bowl);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), B.emitter('head', 0xffffff, 0.04));
    bulb.position.set(xc, yb + 0.022, zc);
    frameG.add(bulb);
    const lensG = new THREE.PlaneGeometry(lensW, lensL); lensG.rotateX(Math.PI / 2);
    const lensM = new THREE.Mesh(lensG, mat.lensClear('lensFlutes', 4));
    lensM.position.set(xc, yb - 0.001, zc);
    frameG.add(lensM);
    const top = new THREE.Mesh(kit.geo.box(w, 0.004, L), mat.satinBlack());
    top.position.set(xc, yb + cupH - 0.002, zc);
    frameG.add(top);
    g.add(pivot);
    pop.push(pivot);
    kit._anchors.headlights.push([xc, hingeY + 0.11, lid.z0 + 0.16]);
  }
  // bucket under the openings (seen when the lamps are up)
  for (const side of [1, -1]) {
    const bk = new THREE.Mesh(kit.geo.box(lid.x1 - lid.x0 - 0.004, 0.2, zLidF + 0.01 - lid.z0), M.shared('car:cavityBack', () => M.surface({ color: 0x050505, roughness: 0.95, side: THREE.BackSide })));
    bk.position.set(side * (lid.x0 + lid.x1) / 2, (hingeY + frontY) / 2 - 0.115, (lid.z0 + zLidF) / 2);
    bk.rotation.x = tilt;
    g.add(bk);
  }
  const raised = -(Math.PI / 2 + tilt);
  let popT = 0;
  const animate = (dt, s) => {
    const target = s.lights ? 1 : 0;
    popT += Math.sign(target - popT) * Math.min(Math.abs(target - popT), dt / 0.55);
    const e = popT * popT * (3 - 2 * popT);
    for (const p of pop) p.rotation.x = e * raised;
  };

  // ------------------------------------------------------------------ underbody: everything below the floor edge is dark
  // (the floor was painted with the body; recolour it by drawing a dark skin just under it)
  {
    const fFloor = (x, y, z) => Math.max(A(x) - (S.corner(1, z)[0] - 0.005), y - S.corner(1, z)[1] - 0.012);
    let floor = B.clip(S.patch, fFloor);
    for (const a of arches) floor = B.clip(floor, (x, y, z) => -archFn(a, 0.01)(x, y, z));
    g.add(B.mesh([B.offset(floor, 0.0015)], mat.underbody(), { name: 'floor', shadow: false }));
    const ub = [];
    // exhaust: pipe from the front, muffler under the boot, tip at the right rear
    const pipe = [[-0.08, 0.2, 0.9], [-0.1, 0.19, 0.2], [-0.12, 0.19, -0.6], [-0.2, 0.2, -1.35], [-0.42, 0.22, -1.62], [-0.45, 0.235, -1.92], [-0.45, 0.24, -2.1]];
    ub.push(B.from(kit.geo.tube(pipe, 0.024, 48, 10)));
    const muff = B.from(kit.geo.roundedBox(0.34, 0.12, 0.42, 0.05, 2)); 
    g.add(B.mesh([B.warp(muff, (x, y, z) => [x - 0.36, y + 0.255, z - 1.72])], mat.darkMetal()));
    // fuel tank, rear axle housing and diff (live axle), front crossmember and sump, prop shaft
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(0.8, 0.2, 0.46, 0.05, 2)), (x, y, z) => [x + 0.08, y + 0.3, z - 0.85])], mat.underbody()));
    g.add(B.mesh([B.from(kit.geo.tube([[0.56, R, -zAx], [-0.56, R, -zAx]], 0.038, 8, 10))], mat.darkMetal()));
    g.add(B.mesh([B.warp(B.from(new THREE.SphereGeometry(0.12, 16, 12)), (x, y, z) => [x * 1.05, y * 0.95 + R, z * 0.9 - zAx + 0.02])], mat.darkMetal()));
    g.add(B.mesh([B.from(kit.geo.tube([[0, 0.26, 0.6], [0, 0.25, -0.4], [0, R + 0.02, -zAx + 0.12]], 0.035, 12, 10))], mat.darkMetal()));
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(1.0, 0.08, 0.12, 0.02, 1)), (x, y, z) => [x, y + 0.24, z + 1.48])], mat.darkMetal()));
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(0.36, 0.12, 0.5, 0.04, 2)), (x, y, z) => [x + 0.05, y + 0.26, z + 1.05])], mat.darkMetal()));
    g.add(B.mesh(ub, mat.darkMetal(), { name: 'exhaustPipe' }));
    // tip: angled cut chrome tip poking out under the bumper
    const tip = B.from(kit.geo.latheZ([[0.03, -0.1], [0.034, -0.08], [0.036, 0.0], [0.031, 0.004], [0.028, -0.06]], 20));
    const tipM = B.mesh([tip], mat.chrome(), { name: 'exhaustTip' });
    tipM.position.set(-0.45, 0.24, -2.09); tipM.rotation.y = Math.PI; tipM.material = mat.chrome();
    g.add(tipM);
    kit._anchors.exhaust.push([-0.45, 0.24, -2.1]);
  }

  // ------------------------------------------------------------------ mirrors (door-mounted, black, 80s wedge)
  for (const side of [1, -1]) {
    const m = new THREE.Group();
    const zb = 0.46, yb = 0.925;
    const xb = S.sideAt(zb, yb);
    // sail mount: a small triangular plate on the door frame corner
    const sail = B.sweep([[xb - 0.01, yb - 0.01, zb + 0.06], [xb - 0.006, yb + 0.02, zb - 0.02], [xb - 0.012, yb + 0.06, zb - 0.07]], [[-0.01, 0], [0.012, 0]], { sub: 2 });
    m.add(B.mesh([sail, B.flip(sail)], mat.satinBlack()));
    // head: rounded wedge, glass facing back
    const head = new THREE.Mesh(kit.geo.roundedBox(0.13, 0.085, 0.07, 0.022, 3), mat.satinBlack());
    head.position.set(xb + 0.085, yb + 0.06, zb - 0.02);
    head.rotation.y = -0.08;
    m.add(head);
    const glassM = new THREE.Mesh(new THREE.PlaneGeometry(0.112, 0.068), M.shared('car:mirrorGlass', () => M.surface({ color: 0xa8b0ba, roughness: 0.02, metalness: 1 })));
    glassM.position.set(xb + 0.085, yb + 0.06, zb - 0.056);
    glassM.rotation.y = Math.PI - 0.08;
    m.add(glassM);
    const stalk = new THREE.Mesh(kit.geo.roundedBox(0.06, 0.03, 0.035, 0.01, 1), mat.satinBlack());
    stalk.position.set(xb + 0.022, yb + 0.05, zb - 0.02);
    m.add(stalk);
    if (side < 0) m.scale.x = -1;
    g.add(m);
  }

  // ------------------------------------------------------------------ door handles (pull-up flaps) and locks
  for (const side of [1, -1]) {
    const zh = -0.47, yh = 0.815;
    const sp = S.sidePoint(zh, yh);
    const grp = new THREE.Group();
    const recess = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.045, 0.15, 0.006, 1), mat.cavity());
    recess.position.set(sp.p[0] - 0.004, yh, zh);
    const flap = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.03, 0.14, 0.006, 2), mat.satinBlack());
    flap.position.set(sp.p[0] + 0.002, yh + 0.004, zh);
    const lock = new THREE.Mesh(kit.geo.cylinderX(0.009, 0.01, 14), mat.chrome());
    lock.position.set(sp.p[0] + 0.001, yh, zh + 0.11);
    grp.add(recess, flap, lock);
    if (side < 0) grp.scale.x = -1;
    g.add(grp);
  }

  // ------------------------------------------------------------------ rain gutters along the roof edge
  {
    const pts = [];
    for (let z = 0.36; z >= -0.97; z -= 0.06) { const c = c5(z); pts.push([c[0] + 0.006, c[1] - 0.006, z]); }
    const gutter = B.sweep(pts, [[-0.004, -0.002], [0.004, -0.004], [0.007, 0.002], [0.004, 0.006], [-0.004, 0.004]], { sub: 3, upFn: () => [-0.6, 0.8, 0] });
    g.add(B.mesh([gutter, B.mirror(gutter)], mat.satinBlack(), { name: 'gutter' }));
  }

  // ------------------------------------------------------------------ wipers (parked along the windscreen base)
  {
    const wip = [];
    const blade = (px, len) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const x = px + (len * i) / 8; const z = wsBase(A(x)) - 0.035; pts.push([x, S.topAt(z, x) + 0.012, z]); }
      wip.push(B.sweep(pts, [[-0.006, -0.006], [0.006, -0.006], [0.004, 0.006], [-0.004, 0.006]], { sub: 2, profileClosed: true }));
      const a = pts[0], e = pts[8];
      wip.push(B.sweep([[px - 0.02, a[1] + 0.006, a[2] + 0.02], [px + len * 0.5, a[1] + 0.02, a[2] - 0.004], [px + len * 0.8, e[1] + 0.016, e[2]]], [[-0.005, 0], [0.005, 0], [0.005, 0.006], [-0.005, 0.006]], { sub: 3, profileClosed: true }));
      const piv = new THREE.Mesh(kit.geo.cylinderX(0.016, 0.03, 12), mat.satinBlack());
      piv.rotation.z = Math.PI / 2; piv.position.set(px - 0.02, a[1] + 0.004, a[2] + 0.03);
      g.add(piv);
    };
    blade(-0.53, 0.46); blade(0.0, 0.46);
    g.add(B.mesh(wip, mat.satinBlack(), { name: 'wipers' }));
    // rear wiper on the hatch glass
    const rp = [];
    for (let i = 0; i <= 6; i++) { const x = -0.05 + 0.36 * (i / 6); const z = zRGB(A(x)) + 0.06; rp.push([x, S.topAt(z, x) + 0.012, z]); }
    g.add(B.mesh([B.sweep(rp, [[-0.005, -0.005], [0.005, -0.005], [0.004, 0.005], [-0.004, 0.005]], { profileClosed: true })], mat.satinBlack()));
  }

  // ------------------------------------------------------------------ antenna (mast on the right A-pillar base)
  {
    const base = [-0.755, S.topAt(0.62, -0.755) - 0.005, 0.62];
    const mast = B.from(kit.geo.tube([base, [base[0] - 0.012, base[1] + 0.4, base[2] - 0.13]], 0.0025, 4, 6));
    g.add(B.mesh([mast], mat.chrome(), { name: 'antenna' }));
    const foot = new THREE.Mesh(kit.geo.cylinderZ(0.012, 0.02, 10), mat.satinBlack());
    foot.rotation.x = Math.PI / 2; foot.position.set(...base);
    g.add(foot);
  }

  // ------------------------------------------------------------------ plates, badges, lettering
  {
    const plateTxt = 'KZ-8686';
    const fp = kit.ext.plate({ pos: [0, 0.38, 2.058], text: plateTxt, rear: false });
    const rp = kit.ext.plate({ pos: [0, 0.395, -2.142], text: plateTxt, rear: true });
    g.add(fp, rp);
    // rear lettering on the garnish and the hatch
    const hoshinoTex = B.decalMat(B.textCanvas('H O S H I N O', { w: 1024, h: 128, size: 82, weight: 600, color: '#d7d9dc' }), { key: 'kz:hoshino', metalness: 0.6, roughness: 0.25 });
    const dm = B.decal(garnish, (x, y) => sd.box(x, y, 0, 0.728, 0.3, 0.03, 0), { axis: 'z', a0: 0.3, b0: 0.698, w: -0.6, h: 0.06, material: hoshinoTex });
    if (dm) g.add(dm);
    const kazeTex = B.decalMat(B.textCanvas('KAZE', { w: 512, h: 160, size: 120, weight: 800, italic: true, color: '#cfd2d6' }), { key: 'kz:kaze', metalness: 0.7, roughness: 0.22 });
    const dk = B.decal(hatch, (x, y, z) => Math.max(sd.box(x, y, 0.5, 0.885, 0.13, 0.04, 0), z + 1.98), { axis: 'z', a0: 0.63, b0: 0.845, w: -0.26, h: 0.08, material: kazeTex });
    if (dk) g.add(dk);
    const twinTex = B.decalMat(B.textCanvas('DOHC 16V', { w: 1024, h: 160, size: 112, weight: 700, color: '#141416' }), { key: 'kz:dohc' });
    for (const side of [1, -1]) {
      const dd = B.decal(rest, (x, y, z) => Math.max(sd.box(z, y, -1.76, 0.56, 0.17, 0.028, 0), -x * side + 0.5), { axis: 'x', a0: -1.59, b0: 0.532, w: -0.34, h: 0.056, flipU: side < 0, material: twinTex });
      if (dd) g.add(dd);
    }
    // star emblem over the grille slot
    const star = [];
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.011 : 0.026; star.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const starG = kit.geo.extrude(star, 0.006, { axis: 'z', bevel: 0.0015 });
    const em = new THREE.Mesh(starG, mat.chrome());
    em.position.set(0, 0.565, 1.995);
    g.add(em);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 6, 32), mat.chrome());
    ring.position.set(0, 0.565, 1.996);
    g.add(ring);
  }

  // ------------------------------------------------------------------ spoilers
  {
    const sp = mods.spoiler || 'none';
    const wantGT = sp === 'gt' || (sp === 'none' && parts.rearAero && parts.rearAero !== 'stock');
    if (sp === 'lip') {
      const pts = [];
      for (let i = 0; i <= 14; i++) { const x = -0.62 + 1.24 * (i / 14); const z = zRGB(A(x)) - 0.02; pts.push([x, S.topAt(z, x) - 0.004, z]); }
      g.add(B.mesh([B.sweep(pts, [[0.03, -0.004], [-0.035, -0.002], [-0.05, 0.03], [-0.04, 0.034], [0.03, 0.006]], { sub: 2 })], kit.paint, { name: 'spoiler' }));
    }
    if (wantGT) g.add(kit.ext.wing({ style: 'gt', z: -1.98, y: 0.93, width: 1.4, chord: 0.24, height: 0.22 }));
    if (parts.frontAero && parts.frontAero !== 'stock') {
      const pts = plan(0.77, 1.6, 2.03, 0.17).map((p) => [p[0], 0.245, p[2]]);
      g.add(B.mesh([B.sweep(pts, [[-0.05, 0.0], [0.045, 0.0], [0.055, 0.012], [-0.05, 0.016]], { sub: 3, profileClosed: true })], M.carbon(), { name: 'splitter' }));
    }
  }

  return { group: g, S, animate, arches, archFn, geo: { fWS, fRG, fDoorGlass, fQGlass, fFrame, beltY, c4, c5, dC5, onTop, wsBase, zHead, zRoofR, zRGB, cLine, hoodX } };
}
