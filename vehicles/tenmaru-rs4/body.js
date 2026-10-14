// Tenmaru RS-4 Type R exterior: 2006 four-door rally homologation saloon. Pumped arches, scooped hood, swept
// projector headlamps over a big intercooler mouth, frameless doors, round-element tail lamps, tall wing and a
// roof vortex generator. Everything is cut from one lofted surface (kit.body).
export function buildExterior(ctx) {
  const { THREE, kit, spec, visual, parts } = ctx;
  const B = kit.body, M = kit.M, sd = B.sd, mat = B.mat;
  const g = new THREE.Group();
  const mods = visual.mods || {};
  const R = spec.tires.radius[0], zAx = spec.wheelbase / 2;
  const zF = 2.272, zR = -2.312;
  const A = Math.abs;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ surface
  // corners: C0 floor centre, C1 floor edge, C2 sill, C3 shoulder (widest), C4 belt / fender top, C5 roof side, C6 top centre
  const st = (z, y0, x1, x2, y2, x3, y3, x4, y4, x5, y5, y6, r = {}) => ({ z, pts: [
    [0, y0, 0.05], [x1, y0, r.c1 ?? 0.035], [x2, y2, r.c2 ?? 0.04], [x3, y3, r.c3 ?? 0.16], [x4, y4, r.c4 ?? 0.016], [x5, y5, r.c5 ?? 0.05], [0, y6, r.c6 ?? 1.0]] });
  const stations = [
    st(zR, 0.29, 0.52, 0.66, 0.31, 0.76, 0.56, 0.755, 0.9, 0.6, 0.935, 0.945, { c5: 0.08, c4: 0.03, c3: 0.07 }),
    st(-2.28, 0.26, 0.6, 0.74, 0.29, 0.815, 0.58, 0.8, 0.975, 0.64, 0.995, 1.0, { c5: 0.06, c3: 0.1 }),
    st(-2.2, 0.23, 0.66, 0.8, 0.28, 0.85, 0.62, 0.825, 1.02, 0.67, 1.035, 1.042),
    st(-1.95, 0.19, 0.7, 0.835, 0.275, 0.866, 0.68, 0.84, 1.042, 0.685, 1.052, 1.06),
    st(-1.6, 0.17, 0.72, 0.845, 0.28, 0.868, 0.7, 0.842, 1.05, 0.68, 1.062, 1.07),
    st(-1.42, 0.165, 0.72, 0.845, 0.28, 0.868, 0.71, 0.842, 1.05, 0.672, 1.075, 1.085),
    st(-1.15, 0.16, 0.72, 0.845, 0.28, 0.868, 0.72, 0.842, 1.046, 0.652, 1.23, 1.25),
    st(-0.85, 0.16, 0.72, 0.845, 0.28, 0.868, 0.725, 0.841, 1.04, 0.632, 1.395, 1.415),
    st(-0.7, 0.16, 0.72, 0.845, 0.28, 0.868, 0.725, 0.84, 1.036, 0.627, 1.43, 1.452),
    st(-0.3, 0.16, 0.72, 0.845, 0.28, 0.868, 0.725, 0.839, 1.03, 0.622, 1.44, 1.466),
    st(0.15, 0.16, 0.72, 0.845, 0.28, 0.867, 0.722, 0.838, 1.02, 0.627, 1.428, 1.455),
    st(0.3, 0.16, 0.72, 0.845, 0.28, 0.867, 0.72, 0.837, 1.016, 0.635, 1.398, 1.42),
    st(0.6, 0.162, 0.72, 0.845, 0.28, 0.867, 0.718, 0.836, 1.008, 0.66, 1.2, 1.215),
    st(0.9, 0.165, 0.72, 0.845, 0.28, 0.866, 0.715, 0.835, 0.998, 0.675, 1.008, 1.018),
    st(1.02, 0.167, 0.72, 0.845, 0.28, 0.866, 0.712, 0.834, 0.98, 0.665, 0.985, 0.994, { c5: 0.09 }),
    st(1.4, 0.175, 0.715, 0.843, 0.28, 0.865, 0.69, 0.83, 0.945, 0.64, 0.955, 0.965, { c5: 0.11 }),
    st(1.8, 0.19, 0.7, 0.832, 0.275, 0.862, 0.66, 0.82, 0.9, 0.62, 0.912, 0.92, { c5: 0.12 }),
    st(2.05, 0.21, 0.66, 0.8, 0.27, 0.84, 0.6, 0.79, 0.85, 0.6, 0.865, 0.872, { c5: 0.11, c3: 0.12 }),
    st(2.18, 0.225, 0.6, 0.745, 0.27, 0.8, 0.55, 0.755, 0.785, 0.55, 0.8, 0.806, { c5: 0.09, c3: 0.1 }),
    st(2.24, 0.235, 0.55, 0.705, 0.275, 0.765, 0.5, 0.72, 0.725, 0.52, 0.735, 0.74, { c3: 0.09 }),
    st(zF, 0.245, 0.5, 0.65, 0.28, 0.715, 0.46, 0.67, 0.665, 0.46, 0.675, 0.68, { c3: 0.08 }),
  ];
  const arches = [{ z: zAx, y: R + 0.015, r: 0.386 }, { z: -zAx, y: R + 0.015, r: 0.386 }];
  // box-flared arches: flat-topped bulge around each arch that fades out below the belt line
  const flare = (x, y, z) => {
    if (x < 0.6 || y < 0.12) return [0, 0];
    let d = 0;
    for (const a of arches) { const q = Math.hypot(z - a.z, y - a.y) - a.r; d = Math.max(d, q < 0.02 ? 1 : 1 - smooth(0.05, 0.24, q)); }
    return [0.034 * d * smooth(0.98, 0.8, y) * smooth(0.62, 0.76, x), 0];
  };
  const S = B.loft(stations, {
    fillet: [2, 3, 4, 6, 4, 6, 7], seg: [5, 1, 8, 8, 9, 12], rows: 200, cluster: 0.25,
    capRear: { dome: 0.01, rings: 22 }, capFront: { dome: 0.02, rings: 22 }, displace: [flare],
  });
  const c4 = (z) => S.corner(4, z), c5 = (z) => S.corner(5, z);
  const beltY = (z) => c4(z)[1];
  const dC5 = (x, y, z) => { const c = c5(z); return Math.hypot(A(x) - c[0], y - c[1]); };
  const onTop = (x, y, z) => A(x) - c5(z)[0];
  const line = (z1, y1, z2, y2) => { const dz = z2 - z1, dy = y2 - y1, l = Math.hypot(dz, dy); return (z, y) => ((z - z1) * dy - (y - y1) * dz) / l; };

  let body = S.patch;
  const xi = 0.56;
  const archFn = (a, grow = 0) => (x, y, z) => Math.max(Math.hypot(z - a.z, y - a.y) - a.r - grow, xi - A(x));
  for (const a of arches) body = B.hole(body, archFn(a));

  // ------------------------------------------------------------------ glass
  const wsBase = (x) => 0.93 - 0.045 * (x / 0.67) ** 2;
  const zHead = (x) => 0.305 + 0.025 * (x / 0.63) ** 2;
  const fWS = (x, y, z) => Math.max(z - wsBase(A(x)), zHead(A(x)) - z, 0.034 - dC5(x, y, z), onTop(x, y, z));
  const zRoofR = (x) => -0.79 - 0.03 * (x / 0.63) ** 2;
  const zRGB = (x) => -1.405 + 0.025 * (x / 0.67) ** 2;
  const fRG = (x, y, z) => Math.max(z - zRoofR(A(x)), zRGB(A(x)) - z, 0.04 - dC5(x, y, z), onTop(x, y, z));
  const cLine = line(-1.2, 1.05, -0.86, 1.38);
  const upper = (x, y, z) => Math.max(-onTop(x, y, z), beltY(z) + 0.006 - y, 0.016 - dC5(x, y, z));
  const fFrame = (x, y, z) => Math.max(upper(x, y, z), -cLine(z, y), 0.55 - A(x), z - 0.86);
  let [ws, b1] = B.cut(body, fWS, { gap: 0.007 });
  let [rg, b2] = B.cut(b1, fRG, { gap: 0.007 });
  let [frame, b3] = B.cut(b2, fFrame, { gap: 0.004 });
  body = b3;
  const gBelt = (y, z, k = 0.014) => beltY(z) + k - y;
  const fG1 = (x, y, z) => Math.max(gBelt(y, z), 0.032 - dC5(x, y, z), -0.085 - z);                  // front door
  const fG2 = (x, y, z) => Math.max(gBelt(y, z), 0.032 - dC5(x, y, z), z + 0.175, -0.905 - z);      // rear door
  const fG3 = (x, y, z) => Math.max(gBelt(y, z, 0.016), 0.036 - dC5(x, y, z), z + 0.94, 0.014 - cLine(z, y)); // quarter light
  let [glass1, fr1] = B.cut(frame, fG1, { gap: 0.003 });
  let [glass2, fr2] = B.cut(fr1, fG2, { gap: 0.003 });
  let [glass3, frameRest] = B.cut(fr2, fG3, { gap: 0.003 });
  const fWSin = (x, y, z) => Math.max(z - wsBase(A(x)) + 0.04, zHead(A(x)) - z + 0.045, 0.075 - dC5(x, y, z));
  let [wsClear, wsFrit] = B.cut(ws, fWSin, { gap: 0, r: 0 });
  const fRGin = (x, y, z) => Math.max(z - zRoofR(A(x)) + 0.04, zRGB(A(x)) - z + 0.04, 0.075 - dC5(x, y, z));
  let [rgClear, rgFrit] = B.cut(rg, fRGin, { gap: 0, r: 0 });

  // ------------------------------------------------------------------ lamps (cut first so panels end at their edges)
  const fHL = (x, y, z) => Math.max(sd.poly(A(x), y, [[0.375, 0.79], [0.56, 0.842], [0.77, 0.868], [0.845, 0.84], [0.84, 0.79], [0.62, 0.762], [0.4, 0.752]]) - 0.006, 1.92 - z);
  let [headL, b4] = B.cut(body, fHL, { gap: 0.004 });
  const fTL = (x, y, z) => Math.max(sd.poly(A(x), y, [[0.43, 0.812], [0.43, 0.958], [0.7, 0.99], [0.86, 0.972], [0.865, 0.83], [0.7, 0.805]]) - 0.006, z + 2.08);
  let [tailL, b5] = B.cut(b4, fTL, { gap: 0.004 });
  body = b5;

  // ------------------------------------------------------------------ panels
  const hoodX = (z) => c4(z)[0] - 0.03;
  const hoodFront = (x) => 2.115 - 0.13 * (x / 0.8) ** 2;
  const fHood = (x, y, z) => Math.max(A(x) - hoodX(z), 0.995 - z, z - hoodFront(A(x)), 0.8 - y);
  let [hood, p1] = B.cut(body, fHood);
  const fCowl = (x, y, z) => Math.max(z - 0.988, wsBase(A(x)) + 0.004 - z, A(x) - 0.7, onTop(x, y, z));
  let [cowl, p2] = B.cut(p1, fCowl, { gap: 0.003 });
  const fFB = (x, y, z) => Math.min(Math.max(y - 0.745, 1.72 - z), Math.max(A(x) - 0.39, 2.1 - z, y - 0.87));
  let [fBumper, p3] = B.cut(p2, fFB);
  const fD1 = (x, y, z) => Math.max(z - 0.87, -0.115 - z, 0.315 - y, y - beltY(z) - 0.004, 0.6 - A(x));
  let [door1, p4] = B.cut(p3, fD1);
  const fD2 = (x, y, z) => Math.max(z + 0.15, -1.02 - z, 0.315 - y, y - beltY(z) - 0.004, 0.6 - A(x), 0.44 - Math.hypot(z + zAx, y - arches[1].y));
  let [door2, p5] = B.cut(p4, fD2);
  const fTrunk = (x, y, z) => Math.max(z - zRGB(A(x)) - 0.006, onTop(x, y, z), 0.772 - y, A(x) - (0.41 + (c5(z)[0] - 0.41) * smooth(0.97, 1.03, y)));
  let [trunk, p6] = B.cut(p5, fTrunk);
  const fRB = (x, y, z) => Math.max(y - 0.768, z + 1.745);
  let [rBumper, p7] = B.cut(p6, fRB);
  const fFuel = (x, y, z) => Math.max(sd.box(z, y, -1.62, 0.885, 0.06, 0.055, 0.016), x + 0.6);
  let [fuel, rest] = B.cut(p7, fFuel, { gap: 0.003 });
  // bumper openings: big intercooler mouth, side intakes with fog lamps, upper grille
  const fMouth = (x, y, z) => Math.max(sd.poly(x, y, [[-0.47, 0.3], [0.47, 0.3], [0.4, 0.58], [-0.4, 0.58]]) - 0.03, 2.0 - z);
  const fSide = (x, y, z) => Math.max(sd.box(A(x), y, 0.645, 0.42, 0.105, 0.085, 0.035), 1.95 - z);
  const fUpper = (x, y, z) => Math.max(sd.box(x, y, 0, 0.802, 0.33, 0.034, 0.018), 2.05 - z);
  const fOpen = (x, y, z) => Math.min(fMouth(x, y, z), fSide(x, y, z), fUpper(x, y, z));
  fBumper = B.hole(fBumper, fOpen);
  const fExh = (x, y, z) => Math.max(sd.box(A(x), y, 0.48, 0.3, 0.06, 0.045, 0.03), z + 2.15);
  rBumper = B.hole(rBumper, fExh);
  // plate recess on the trunk face
  const fPlate = (x, y, z) => Math.max(sd.box(x, y, 0, 0.865, 0.175, 0.087, 0.015), z + 2.2);

  const fin = (p, o = {}) => B.merge([p, B.roll(p, { r: 0.0018, depth: 0.005, ...o })]);
  const nearArch = (x, y, z) => arches.some((a) => Math.abs(Math.hypot(z - a.z, y - a.y) - a.r) < 0.012 && A(x) > xi + 0.02);
  const nearGlass = (x, y, z) => A(fWS(x, y, z)) < 0.012 || A(fRG(x, y, z)) < 0.012;
  const nearOpen = (x, y, z) => A(fOpen(x, y, z)) < 0.012;
  const [glassRoll, glassWall] = B.roll(rest, { r: 0.0018, depth: 0.006, only: nearGlass, splitWall: true });
  const [openRoll, openWall] = B.roll(fBumper, { r: 0.004, depth: 0.07, only: nearOpen, splitWall: true });
  const [exRoll, exWall] = B.roll(rBumper, { r: 0.004, depth: 0.05, only: (x, y, z) => A(fExh(x, y, z)) < 0.012, splitWall: true });
  const paintPieces = [
    fin(hood), fin(door1), fin(door2), fin(trunk), fin(fuel),
    fin(fBumper, { only: (x, y, z) => !nearOpen(x, y, z) && !nearArch(x, y, z) }), openRoll,
    fin(rBumper, { only: (x, y, z) => A(fExh(x, y, z)) > 0.012 && !nearArch(x, y, z) }), exRoll,
    fin(rest, { only: (x, y, z) => !nearArch(x, y, z) && !nearGlass(x, y, z) }), glassRoll,
    B.roll(rest, { r: 0.005, depth: 0.035, only: nearArch }), B.roll(fBumper, { r: 0.005, depth: 0.035, only: nearArch }), B.roll(rBumper, { r: 0.005, depth: 0.035, only: nearArch }),
  ];
  g.add(B.assemble({
    paint: paintPieces,
    satin: [fin(frameRest, { depth: 0.004 })],
    blackPlastic: [B.projectUV(fin(cowl), 'y', 1), B.projectUV(openWall, 'z', 1), B.projectUV(exWall, 'z', 1)],
    frit: [wsFrit, rgFrit],
  }, { paint: kit.paint, satin: mat.satinBlack(), blackPlastic: mat.blackPlastic(), frit: mat.frit() }));
  const sink = (p, d) => B.offset(p, -d);
  g.add(B.glass([sink(wsClear, 0.003), sink(rgClear, 0.003), sink(glass1, 0.005), sink(glass2, 0.005), sink(glass3, 0.004)], { tint: 0x141c20, outer: 0.55, inner: 0.1 }));
  const sealP = [[-0.006, -0.004], [-0.002, 0.0015], [0.003, 0.0022], [0.006, -0.003]];
  g.add(B.mesh([B.bead(ws, sealP), B.bead(rg, sealP), B.bead(glass3, [[-0.003, -0.004], [0, 0.001], [0.004, 0.0012], [0.006, -0.004]]), glassWall], mat.rubber(), { name: 'seals' }));
  for (const a of arches) g.add(B.mesh(B.wheelWell(S, { z: a.z, y: a.y, r: a.r + 0.004, xi, bottom: 0.15 }), mat.wellLiner(), { name: 'well' }));

  // ------------------------------------------------------------------ grilles: mouth (intercooler + mesh), side intakes, upper grille
  {
    const mesh = M.shared('rs4:mesh', () => { const m = M.textured('grille', { repeat: 6, roughness: 0.5 }).clone(); m.transparent = false; return m; });
    const back = (pts, z, y0, y1) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const geo = new THREE.ShapeGeometry(sh); geo.translate(0, 0, z); return geo; };
    // mouth: honeycomb a few cm in, the intercooler core behind it
    const mouth = new THREE.Mesh(back([[-0.46, 0.31], [0.46, 0.31], [0.39, 0.57], [-0.39, 0.57]], 2.18), mesh);
    g.add(mouth);
    const core = new THREE.Mesh(kit.geo.box(0.86, 0.24, 0.06), M.shared('rs4:core', () => M.surface({ color: 0x3a3c40, roughness: 0.6, metalness: 0.7, map: (() => { const t = M.textured('brushed', { repeat: 1 }).map; return t; })() })));
    core.position.set(0, 0.44, 2.12);
    g.add(core);
    for (const sx of [1, -1]) {
      const sm = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.16, 0.01, 0.03, 2), mesh);
      sm.position.set(sx * 0.645, 0.42, 2.19 - (sx > 0 ? 0 : 0));
      g.add(sm);
      // fog lamp: round, chrome reflector, clear lens
      const fz = 2.2;
      const fog = new THREE.Group();
      fog.position.set(sx * 0.645, 0.4, fz);
      fog.add(new THREE.Mesh(kit.geo.latheZ([[0.048, -0.04], [0.05, 0.0], [0.046, 0.006]], 20), mat.satinBlack()));
      const fr = new THREE.Mesh(kit.geo.latheZ([[0.0, -0.035], [0.02, -0.03], [0.042, -0.012], [0.045, 0.0]], 20), B.emitter('fog', 0xfff0c8, 0.03));
      fr.material.side = THREE.DoubleSide;
      fog.add(fr);
      const fl = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), mat.lensClear('lensOptic', 3));
      fl.position.z = 0.004;
      fog.add(fl);
      g.add(fog);
    }
    const upper = new THREE.Mesh(kit.geo.roundedBox(0.66, 0.068, 0.01, 0.02, 2), mesh);
    upper.position.set(0, 0.802, 2.16);
    g.add(upper);
    // emblem: chrome ring with a bold T
    const emblem = (scale = 1) => {
      const e = new THREE.Group();
      e.add(new THREE.Mesh(new THREE.TorusGeometry(0.034 * scale, 0.004 * scale, 8, 32), mat.chrome()));
      const t = kit.geo.extrude([[-0.024, 0.012], [0.024, 0.012], [0.024, 0.004], [0.006, 0.004], [0.006, -0.026], [-0.006, -0.026], [-0.006, 0.004], [-0.024, 0.004]].map(([a, b]) => [a * scale, b * scale]), 0.004 * scale, { axis: 'z', bevel: 0.001 });
      e.add(new THREE.Mesh(t, mat.chrome()));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.031 * scale, 24), M.shared('rs4:emblemBlue', () => M.surface({ color: 0x1b3b86, roughness: 0.25, metalness: 0.3 })));
      disc.position.z = -0.002;
      e.add(disc);
      return e;
    };
    const fe = emblem(1); fe.position.set(0, 0.802, 2.172); g.add(fe);
    const re = emblem(0.9); re.position.set(0, 0.965, -2.245); re.rotation.y = Math.PI; g.add(re);
  }

  // ------------------------------------------------------------------ headlamps: clear lens over a black housing, two projectors and a reflector
  {
    const lens = headL;
    g.add(B.mesh([lens], mat.lensClear(null), { name: 'lens' }));
    const housing = B.offset(lens, -0.05);
    g.add(B.mesh([housing, B.skirt(lens, [0, 0, -0.05])], M.shared('rs4:hlHouse', () => M.surface({ color: 0x0e0f11, roughness: 0.35, metalness: 0.4 }))));
    for (const sx of [1, -1]) {
      const pr = (x, y, z, r) => {
        const p = new THREE.Group(); p.position.set(sx * x, y, z);
        p.add(new THREE.Mesh(kit.geo.latheZ([[r * 1.25, -0.03], [r * 1.25, 0.0], [r * 1.1, 0.006]], 24), mat.chrome()));
        const ln = new THREE.Mesh(kit.geo.latheZ([[0, 0.016], [r * 0.6, 0.012], [r, 0.0]], 24), M.shared('rs4:projLens', () => M.surface({ color: 0x1a1d22, roughness: 0.02, metalness: 0.6 })));
        p.add(ln);
        const em = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 20), B.emitter('head', 0xf4f6ff, 0.04)); em.position.z = 0.002;
        p.add(em);
        p.rotation.y = sx * 0.3;
        return p;
      };
      g.add(pr(0.5, 0.805, 2.15, 0.034), pr(0.63, 0.818, 2.105, 0.03));
      const refl = new THREE.Mesh(kit.geo.latheZ([[0, -0.025], [0.02, -0.022], [0.04, -0.01], [0.046, 0]], 20), mat.reflector());
      refl.position.set(sx * 0.76, 0.83, 2.0); refl.rotation.y = sx * 0.9;
      g.add(refl);
      const drl = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.008, 0.008, 0.003, 1), B.emitter('drl', 0xe8f0ff, 0.5));
      drl.position.set(sx * 0.58, 0.775, 2.13); drl.rotation.y = sx * 0.35;
      g.add(drl);
      const amber = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.03, 0.08, 0.004, 1), M.shared('em:amberIdle', () => M.surface({ color: 0x2a1505, emissive: 0xff7a10, emissiveIntensity: 0.05, roughness: 0.4 })));
      amber.position.set(sx * 0.835, 0.81, 1.97);
      g.add(amber);
      kit._anchors.headlights.push([sx * 0.56, 0.81, 2.17]);
    }
  }

  // ------------------------------------------------------------------ tail lamps: smoked red lens, two round elements per side, reverse lamp
  {
    g.add(B.mesh([B.projectUV(tailL, 'z', 1)], mat.lensRed('lensOptic', 14), { name: 'lens' }));
    const back = B.offset(tailL, -0.045);
    g.add(B.mesh([back, B.skirt(tailL, [0, 0, 0.045])], M.shared('rs4:tlHouse', () => M.surface({ color: 0x120607, roughness: 0.4, metalness: 0.3 }))));
    for (const sx of [1, -1]) {
      for (const [x, y, r] of [[0.53, 0.893, 0.058], [0.715, 0.9, 0.058]]) {
        const hit = B.project(tailL, 'z', sx * x, y, -2.4);
        if (!hit) continue;
        const el = new THREE.Group();
        el.position.set(hit.p[0] - hit.n[0] * 0.02, hit.p[1], hit.p[2] - hit.n[2] * 0.02);
        el.lookAt(el.position.x + hit.n[0], el.position.y, el.position.z + hit.n[2]);
        el.add(new THREE.Mesh(kit.geo.latheZ([[r, -0.02], [r, 0.0], [r * 0.88, 0.004], [r * 0.86, -0.01]], 28), mat.chrome()));
        const em = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 28), B.emitter('brake', 0xff2414, 0.3));
        em.position.z = -0.008;
        el.add(em);
        const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.25, r * 0.33, 24), B.emitter('brake', 0xff6a50, 0.3));
        ring.position.z = -0.006;
        el.add(ring);
        g.add(el);
      }
      const rev = new THREE.Mesh(kit.geo.roundedBox(0.075, 0.035, 0.006, 0.008, 1), B.emitter('reverse', 0xf4f1ea, 0.02));
      rev.position.set(sx * 0.48, 0.835, -2.26);
      g.add(rev);
    }
    // high-mount brake light on the wing blade is added with the wing
  }

  // ------------------------------------------------------------------ rear diffuser and bumper reflectors
  {
    const dp = B.planPath(0.7, -2.0, -2.33, 0.18).map((p) => [p[0], 0, p[2]]);
    const diff = B.sweep(dp, (s) => { const t = 0.012 + 0.02 * smooth(0.05, 0.25, s) * smooth(0.95, 0.75, s); return [[-0.05, 0.2], [t, 0.205], [t + 0.004, 0.24], [t - 0.004, 0.258], [-0.05, 0.262]]; }, { sub: 3 });
    g.add(B.mesh([B.projectUV(diff, 'z', 1)], mat.blackPlastic(), { name: 'diffuser' }));
    const fins = [];
    for (const x of [-0.24, -0.12, 0, 0.12, 0.24]) fins.push(kit.geo.place(kit.geo.roundedBox(0.008, 0.06, 0.16, 0.003, 1), [x, 0.21, -2.27]));
    g.add(new THREE.Mesh(kit.geo.merge(fins), mat.blackPlastic()));
    for (const sx of [1, -1]) {
      const hit = B.project(rBumper, 'z', sx * 0.69, 0.47, -2.4);
      if (!hit) continue;
      const r = new THREE.Mesh(kit.geo.roundedBox(0.09, 0.022, 0.006, 0.006, 1), mat.lensRed('lensOptic', 20));
      r.position.set(hit.p[0], hit.p[1], hit.p[2] - 0.002);
      r.lookAt(r.position.x + hit.n[0], r.position.y + hit.n[1], r.position.z + hit.n[2]);
      g.add(r);
    }
  }

  // ------------------------------------------------------------------ hood scoop (top-mount intercooler) and vents
  {
    const zs0 = 1.24, zs1 = 1.72;
    const scoopSt = [];
    for (let i = 0; i <= 6; i++) {
      const z = zs0 + (zs1 - zs0) * (i / 6), t = i / 6;
      const h = 0.012 + 0.058 * smooth(0, 0.75, t), w = 0.27 - 0.02 * t;
      const base = S.topAt(z, 0) - 0.01;
      scoopSt.push({ z, pts: [[0, base, 0.02], [w, base, 0.02], [w * 0.98, base + h * 0.6, 0.03], [w * 0.9, base + h, 0.04], [0, base + h + 0.004, 0.4]] });
    }
    const scoop = B.loft(scoopSt, { fillet: [2, 2, 3, 4, 4], seg: [3, 2, 2, 4], rows: 24, capRear: { dome: 0.0, rings: 2 }, capFront: false });
    let sp = B.clip(scoop.patch, (x, y, z) => z - zs1 + 0.004);
    g.add(B.mesh([sp, B.roll(sp, { r: 0.003, depth: 0.004 })], kit.paint, { name: 'scoop' }));
    // mouth: black mesh with the intercooler core showing through
    const mouthY0 = S.topAt(zs1, 0);
    const mm = new THREE.Mesh(kit.geo.roundedBox(0.5, 0.055, 0.008, 0.012, 1), M.shared('rs4:mesh', () => M.textured('grille', { repeat: 6, roughness: 0.5 })));
    mm.position.set(0, mouthY0 + 0.034, zs1 - 0.012);
    g.add(mm);
    // twin hood vents (heat extractors) towards the front
    for (const sx of [1, -1]) {
      const z = 1.82, x = sx * 0.42, y = S.topAt(z, x);
      const v = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.012, 0.14, 0.01, 2), M.shared('rs4:vent', () => M.textured('grille', { repeat: 3, roughness: 0.6, color: 0x555555 })));
      v.position.set(x, y + 0.002, z); v.rotation.x = 0.12;
      g.add(v);
    }
  }

  // ------------------------------------------------------------------ side skirts, mud flaps
  {
    const sk = [];
    for (let i = 0; i <= 12; i++) { const z = 0.92 - (1.85 * i) / 12; sk.push([S.sideAt(z, 0.32) + 0.004, 0, z]); }
    const skirtP = B.sweep(sk, [[-0.02, 0.24], [0.01, 0.24], [0.028, 0.27], [0.026, 0.33], [0.0, 0.345]], { sub: 2, capStart: true, capEnd: true });
    g.add(B.mesh([skirtP, B.mirror(skirtP)], kit.paint, { name: 'skirt' }));
    if ((mods.mudflaps ?? 'on') === 'on') {
      const fc = B.canvas(256, 256), fg = fc.getContext('2d');
      fg.fillStyle = '#c4161c'; fg.fillRect(0, 0, 256, 256);
      fg.fillStyle = '#f4f1ea'; fg.font = `800 54px ${B.fonts.ui}`; fg.textAlign = 'center'; fg.textBaseline = 'middle';
      fg.fillText('TENMARU', 128, 92); fg.font = `700 34px ${B.fonts.ui}`; fg.fillText('RALLY', 128, 150);
      const flapM = M.surface({ color: 0xffffff, map: B.tex(fc), roughness: 0.75, side: THREE.DoubleSide });
      for (const az of [zAx, -zAx]) for (const sx of [1, -1]) {
        const f = new THREE.Mesh(kit.geo.roundedBox(0.22, 0.26, 0.006, 0.012, 1), flapM);
        f.position.set(sx * 0.765, 0.2, az - 0.395);
        f.rotation.x = -0.06;
        g.add(f);
      }
    }
  }

  // ------------------------------------------------------------------ wing: two posts, cambered blade, LED stop light
  const wingStyle = mods.wing || 'stock';
  if (wingStyle === 'stock' || wingStyle === 'gt' || (wingStyle === 'none' && parts.rearAero && parts.rearAero !== 'stock')) {
    const big = wingStyle === 'gt' || wingStyle === 'none';
    const span = big ? 1.5 : 1.36, chord = big ? 0.27 : 0.21, hgt = big ? 0.27 : 0.21, zw = big ? -2.08 : -2.04;
    const yDeck = S.topAt(zw, 0.5);
    const foil = (s) => { const c = chord; return [[c * 0.5, 0.0], [c * 0.32, 0.016], [0, 0.024], [-c * 0.35, 0.02], [-c * 0.5, 0.008], [-c * 0.5, 0.0], [-c * 0.3, -0.006], [0, -0.008], [c * 0.3, -0.004]]; };
    const bladePath = [];
    for (let i = 0; i <= 12; i++) { const x = -span / 2 + (span * i) / 12; bladePath.push([x, yDeck + hgt + 0.012 * (1 - (x / (span / 2)) ** 2), zw]); }
    const blade = B.sweep(bladePath, foil, { sub: 2, profileClosed: true, capStart: true, capEnd: true, upFn: () => [0, 1, 0] });
    const bladeM = B.mesh([blade], big ? M.carbon() : kit.paint, { name: 'wing' });
    bladeM.rotation.x = 0;
    g.add(bladeM);
    for (const sx of [1, -1]) {
      const x = sx * 0.5;
      const post = B.sweep([[x, S.topAt(zw + 0.04, x) - 0.005, zw + 0.04], [x, yDeck + hgt * 0.5, zw + 0.01], [x, yDeck + hgt, zw - 0.01]], (s) => { const c = 0.12 - 0.04 * s; return [[-0.008, -c / 2], [0.008, -c / 2], [0.008, c / 2], [-0.008, c / 2]]; }, { sub: 3, profileClosed: true, upFn: () => [0, 0, 1] });
      g.add(B.mesh([post], big ? M.carbon() : kit.paint));
      if (big) { const ep = new THREE.Mesh(kit.geo.roundedBox(0.008, 0.16, chord + 0.08, 0.004, 1), M.carbon()); ep.position.set(sx * span / 2, yDeck + hgt, zw); g.add(ep); }
    }
    const led = new THREE.Mesh(kit.geo.roundedBox(0.3, 0.008, 0.006, 0.003, 1), B.emitter('brake', 0xff2018, 0.3));
    led.position.set(0, yDeck + hgt + 0.004, zw - chord * 0.5 - 0.002);
    g.add(led);
  }

  // ------------------------------------------------------------------ roof vortex generator
  if ((mods.vortex ?? 'on') === 'on') {
    const fins = [];
    for (let i = 0; i < 9; i++) {
      const x = -0.4 + (0.8 * i) / 8, z = zRoofR(A(x)) + 0.06, y = S.topAt(z, x);
      const f = kit.geo.extrude([[0, 0], [0.06, 0], [0.0, 0.026]], 0.004, { axis: 'x', bevel: 0.001 });
      kit.geo.place(f, [x, y - 0.002, z - 0.03], [0, (i % 2 ? 1 : -1) * 0.15, 0]);
      fins.push(f);
    }
    const bar = kit.geo.place(kit.geo.roundedBox(0.84, 0.006, 0.07, 0.003, 1), [0, S.topAt(zRoofR(0.2) + 0.05, 0) - 0.002, zRoofR(0.2) + 0.05]);
    g.add(new THREE.Mesh(kit.geo.merge([...fins, bar]), mods.vortexColor === 'body' ? kit.paint : mat.satinBlack()));
  }

  // ------------------------------------------------------------------ mirrors, handles, wipers, antenna
  for (const side of [1, -1]) {
    const z = 0.76, y = beltY(z) - 0.015, x = S.sideAt(z, y);
    g.add(B.doorMirror({ base: [x - 0.01, y, z], size: [0.2, 0.112, 0.1], side, out: 0.055, up: 0.045, indicator: true }));
    for (const zh of [0.02, -0.92]) {
      const yh = 0.92, xh = S.sideAt(zh, yh);
      const grp = new THREE.Group();
      const cup = new THREE.Mesh(kit.geo.roundedBox(0.012, 0.05, 0.14, 0.01, 2), mat.cavity()); cup.position.set(xh - 0.004, yh, zh);
      const hd = new THREE.Mesh(kit.geo.roundedBox(0.016, 0.03, 0.15, 0.012, 2), kit.paint); hd.position.set(xh + 0.006, yh + 0.004, zh);
      grp.add(cup, hd);
      if (side < 0) grp.scale.x = -1;
      g.add(grp);
    }
  }
  {
    const wip = [];
    const blade = (px, len) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const x = px + (len * i) / 8; const z = wsBase(A(x)) - 0.04; pts.push([x, S.topAt(z, x) + 0.012, z]); }
      wip.push(B.sweep(pts, [[-0.006, -0.006], [0.006, -0.006], [0.004, 0.006], [-0.004, 0.006]], { sub: 2, profileClosed: true }));
      const a = pts[0], e = pts[8];
      wip.push(B.sweep([[px - 0.02, a[1] + 0.006, a[2] + 0.025], [px + len * 0.5, a[1] + 0.02, a[2] - 0.004], [px + len * 0.8, e[1] + 0.016, e[2]]], [[-0.005, 0], [0.005, 0], [0.005, 0.006], [-0.005, 0.006]], { sub: 3, profileClosed: true }));
    };
    blade(-0.6, 0.52); blade(-0.02, 0.55);
    g.add(B.mesh(wip, mat.satinBlack(), { name: 'wipers' }));
    const az = zRoofR(0) - 0.05, ay = S.topAt(az, 0);
    g.add(B.mesh([B.from(kit.geo.tube([[0, ay, az], [0, ay + 0.12, az - 0.1]], 0.003, 4, 6))], mat.satinBlack(), { name: 'antenna' }));
  }

  // ------------------------------------------------------------------ underbody, exhaust (twin cannons), plates, lettering
  {
    const fFloor = (x, y, z) => Math.max(A(x) - (S.corner(1, z)[0] - 0.005), y - S.corner(1, z)[1] - 0.012);
    let floor = B.clip(S.patch, fFloor);
    for (const a of arches) floor = B.clip(floor, (x, y, z) => -archFn(a, 0.01)(x, y, z));
    g.add(B.mesh([B.offset(floor, 0.0015)], mat.underbody(), { name: 'floor', shadow: false }));
    const ub = [];
    for (const sx of [1, -1]) ub.push(B.from(kit.geo.tube([[sx * 0.12, 0.2, 0.6], [sx * 0.14, 0.19, -0.4], [sx * 0.3, 0.2, -1.5], [sx * 0.48, 0.26, -1.95], [sx * 0.48, 0.3, -2.2]], 0.03, 40, 10)));
    g.add(B.mesh(ub, mat.darkMetal(), { name: 'exhaustPipe' }));
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(1.0, 0.13, 0.3, 0.05, 2)), (x, y, z) => [x, y + 0.27, z - 1.95])], mat.darkMetal()));
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(0.7, 0.18, 0.5, 0.05, 2)), (x, y, z) => [x, y + 0.29, z - 0.9])], mat.underbody()));
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(0.5, 0.16, 0.6, 0.05, 2)), (x, y, z) => [x, y + 0.27, z + 1.35])], mat.darkMetal()));
    for (const sx of [1, -1]) {
      const tip = B.from(kit.geo.latheZ([[0.05, -0.12], [0.054, -0.1], [0.057, 0.0], [0.05, 0.006], [0.046, -0.08]], 24));
      const tm = B.mesh([tip], mat.chrome(), { name: 'exhaustTip' });
      tm.position.set(sx * 0.48, 0.3, -2.295); tm.rotation.y = Math.PI;
      g.add(tm);
      kit._anchors.exhaust.push([sx * 0.48, 0.3, -2.32]);
    }
    const plateTxt = 'RS-4421';
    g.add(kit.ext.plate({ pos: [0, 0.865, -2.268], text: plateTxt, rear: true }));
    g.add(kit.ext.plate({ pos: [0, 0.46, 2.235], text: plateTxt, rear: false }));
    const nameTex = B.decalMat(B.textCanvas('T E N M A R U', { w: 1024, h: 128, size: 80, weight: 700, color: '#d8dade' }), { key: 'rs4:name', metalness: 0.7, roughness: 0.22 });
    const dn = B.decal(trunk, (x, y, z) => Math.max(sd.box(x, y, 0, 0.96, 0.24, 0.022, 0), z + 2.2), { axis: 'z', a0: 0.24, b0: 0.938, w: -0.48, h: 0.044, material: nameTex });
    if (dn) g.add(dn);
    const typeTex = B.decalMat(B.textCanvas('RS-4  TYPE R', { w: 1024, h: 128, size: 92, weight: 800, italic: true, color: '#e9e9ea', stroke: '#c4161c', strokeWidth: 10 }), { key: 'rs4:type' });
    const dt = B.decal(trunk, (x, y, z) => Math.max(sd.box(x, y, -0.27, 0.8, 0.13, 0.016, 0), z + 2.2), { axis: 'z', a0: -0.14, b0: 0.784, w: -0.26, h: 0.032, material: typeTex });
    if (dt) g.add(dt);
    for (const side of [1, -1]) {
      const d = B.decal(rest, (x, y, z) => Math.max(sd.box(z, y, 1.05, 0.66, 0.1, 0.02, 0), -x * side + 0.6), { axis: 'x', a0: 1.15, b0: 0.64, w: -0.2, h: 0.04, flipU: side < 0, material: typeTex });
      if (d) g.add(d);
    }
  }
  if (parts.frontAero && parts.frontAero !== 'stock') {
    const pts = B.planPath(0.8, 1.75, 2.29, 0.2).map((p) => [p[0], 0.235, p[2]]);
    g.add(B.mesh([B.sweep(pts, [[-0.06, 0.0], [0.05, 0.0], [0.06, 0.012], [-0.06, 0.018]], { sub: 3, profileClosed: true })], M.carbon(), { name: 'splitter' }));
  }
  return { group: g, S, arches, archFn, geo: { fWS, fRG, fFrame, fG1, fG2, fG3, beltY, c4, c5, dC5, onTop, wsBase, zHead, zRoofR, zRGB, cLine, hoodX } };
}
