// Yushan Typhoon GT exterior: 2019 front-engine V8 grand tourer. Long hood between raised fender crowns with a
// central power bulge, slim LED lamps with a peak-shaped light signature, wide layered grille, fender gills,
// sculpted door scallop, big rear haunches, fastback roof, full-width rear light bar, ducktail and quad exhaust.
export function buildExterior(ctx) {
  const { THREE, kit, spec, visual, parts } = ctx;
  const B = kit.body, M = kit.M, sd = B.sd, mat = B.mat;
  const g = new THREE.Group();
  const mods = visual.mods || {};
  const zAx = spec.wheelbase / 2;
  const Rf = spec.tires.radius[0], Rr = spec.tires.radius[1];
  const zF = 2.358, zR = -2.318;
  const A = Math.abs;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const spoiler = mods.spoiler || 'ducktail';

  // ------------------------------------------------------------------ surface
  // corners: C0 floor centre, C1 floor edge, C2 sill, C3 waist (widest), C4 shoulder / fender crown, C5 roof side / hood valley, C6 top centre
  const st = (z, y0, x1, x2, y2, x3, y3, x4, y4, x5, y5, y6, r = {}) => ({ z, pts: [
    [0, y0, 0.05], [x1, y0, r.c1 ?? 0.04], [x2, y2, r.c2 ?? 0.03], [x3, y3, r.c3 ?? 0.2], [x4, y4, r.c4 ?? 0.03], [x5, y5, r.c5 ?? 0.06], [0, y6, r.c6 ?? 1.2]] });
  const stations = [
    st(zR, 0.24, 0.55, 0.72, 0.25, 0.82, 0.55, 0.8, 0.92, 0.62, 0.958, 0.962, { c5: 0.07, c3: 0.12, c4: 0.04 }),
    st(-2.27, 0.22, 0.65, 0.82, 0.24, 0.885, 0.56, 0.862, 0.955, 0.68, 0.99, 0.995, { c5: 0.05, c3: 0.15 }),
    st(-2.15, 0.19, 0.7, 0.86, 0.235, 0.905, 0.58, 0.875, 0.962, 0.7, 0.984, 0.99),
    st(-1.9, 0.16, 0.72, 0.875, 0.23, 0.91, 0.6, 0.88, 0.956, 0.69, 0.978, 0.988),
    st(-1.72, 0.15, 0.72, 0.878, 0.23, 0.912, 0.61, 0.882, 0.95, 0.67, 0.99, 1.002),
    st(-1.45, 0.145, 0.72, 0.88, 0.23, 0.912, 0.62, 0.883, 0.944, 0.645, 1.07, 1.088),
    st(-1.1, 0.14, 0.72, 0.882, 0.23, 0.912, 0.62, 0.882, 0.934, 0.625, 1.178, 1.2),
    st(-0.8, 0.14, 0.72, 0.882, 0.23, 0.912, 0.62, 0.88, 0.924, 0.61, 1.258, 1.284),
    st(-0.58, 0.14, 0.72, 0.882, 0.23, 0.912, 0.618, 0.878, 0.914, 0.605, 1.282, 1.306),
    st(-0.38, 0.14, 0.72, 0.882, 0.23, 0.912, 0.615, 0.876, 0.906, 0.612, 1.268, 1.292),
    st(-0.15, 0.14, 0.72, 0.882, 0.23, 0.911, 0.612, 0.875, 0.898, 0.63, 1.2, 1.222),
    st(0.15, 0.14, 0.72, 0.881, 0.23, 0.91, 0.608, 0.874, 0.888, 0.655, 1.03, 1.048),
    st(0.45, 0.142, 0.72, 0.88, 0.232, 0.909, 0.605, 0.872, 0.876, 0.665, 0.875, 0.884, { c5: 0.07 }),
    st(0.62, 0.145, 0.72, 0.879, 0.233, 0.908, 0.6, 0.868, 0.866, 0.62, 0.858, 0.872, { c5: 0.12 }),
    st(1.0, 0.15, 0.72, 0.875, 0.235, 0.905, 0.59, 0.84, 0.858, 0.56, 0.84, 0.862, { c5: 0.16, c4: 0.05 }),
    st(1.5, 0.155, 0.71, 0.87, 0.24, 0.9, 0.57, 0.83, 0.832, 0.54, 0.808, 0.832, { c5: 0.16, c4: 0.06 }),
    st(1.9, 0.165, 0.7, 0.855, 0.24, 0.885, 0.54, 0.815, 0.792, 0.53, 0.772, 0.796, { c5: 0.15, c4: 0.07 }),
    st(2.15, 0.17, 0.66, 0.82, 0.21, 0.87, 0.48, 0.8, 0.745, 0.55, 0.742, 0.758, { c5: 0.12, c4: 0.07, c3: 0.15 }),
    st(2.28, 0.185, 0.6, 0.76, 0.215, 0.82, 0.45, 0.75, 0.7, 0.55, 0.708, 0.72, { c5: 0.1, c4: 0.06, c3: 0.12 }),
    st(zF, 0.2, 0.52, 0.66, 0.22, 0.72, 0.42, 0.66, 0.64, 0.48, 0.655, 0.662, { c5: 0.08, c4: 0.05, c3: 0.1 }),
  ];
  const arches = [{ z: zAx, y: Rf + 0.016, r: 0.386 }, { z: -zAx, y: Rr + 0.016, r: 0.396 }];
  const displace = [
    // front fender flare
    (x, y, z) => {
      if (x < 0.62 || y < 0.12 || z < 0.6) return [0, 0];
      const a = arches[0], q = Math.hypot(z - a.z, y - a.y) - a.r;
      const d = q < 0.02 ? 1 : 1 - smooth(0.04, 0.2, q);
      return [0.026 * d * smooth(0.86, 0.66, y) * smooth(0.62, 0.78, x), 0];
    },
    // rear haunch: broad bulge above and behind the rear wheel
    (x, y, z) => {
      if (x < 0.6 || y < 0.12 || z > -0.5) return [0, 0];
      const a = arches[1], q = Math.hypot(z - a.z, y - a.y) - a.r;
      const band = q < 0.02 ? 1 : 1 - smooth(0.04, 0.34, q);
      const along = smooth(-0.62, -1.0, z) * smooth(-2.32, -2.0, z);
      return [0.052 * band * along * smooth(0.97, 0.7, y) * smooth(0.6, 0.78, x), 0];
    },
    // door scallop: a soft concave band along the lower door between the wheels
    (x, y, z) => {
      if (x < 0.7) return [0, 0];
      const b = Math.exp(-(((y - 0.43) / 0.09) ** 2));
      const along = smooth(1.0, 0.75, z) * smooth(-0.95, -0.7, z);
      return [-0.018 * b * along, 0];
    },
    // hood power bulge
    (x, y, z) => {
      if (z < 0.5 || z > 2.2 || x > 0.42) return [0, 0];
      const b = Math.exp(-((x / 0.24) ** 4));
      return [0, 0.026 * b * smooth(0.5, 0.85, z) * smooth(2.2, 1.75, z) * smooth(0.6, 0.9, y)];
    },
    // ducktail: the deck lip kicks up
    (x, y, z) => {
      if (spoiler !== 'ducktail' || z > -1.95 || y < 0.9) return [0, 0];
      return [0, 0.03 * smooth(-1.95, -2.25, z) * smooth(0.9, 0.98, y) * smooth(0.8, 0.5, x)];
    },
  ];
  // AI and distant cars (no interior) use a lighter surface
  const S = B.loft(stations, {
    lod: ctx.interior ? 1 : 0.7,
    fillet: [2, 3, 4, 6, 5, 7, 8], seg: [5, 1, 8, 9, 10, 13], rows: 210, cluster: 0.25,
    capRear: { dome: 0.012, rings: 22, yc: 0.55 }, capFront: { dome: 0.025, rings: 22, yc: 0.42 }, displace,
  });
  const c4 = (z) => S.corner(4, z), c5 = (z) => S.corner(5, z);
  const beltY = (z) => c4(z)[1];
  const dC5 = (x, y, z) => { const c = c5(z); return Math.hypot(A(x) - c[0], y - c[1]); };
  const onTop = (x, y, z) => A(x) - c5(z)[0];
  const line = (z1, y1, z2, y2) => { const dz = z2 - z1, dy = y2 - y1, l = Math.hypot(dz, dy); return (z, y) => ((z - z1) * dy - (y - y1) * dz) / l; };

  let body = S.patch;
  const xiF = 0.6, xiR = 0.63;
  const archFn = (a, grow = 0) => (x, y, z) => Math.max(Math.hypot(z - a.z, y - a.y) - a.r - grow, (a.z > 0 ? xiF : xiR) - A(x));
  for (const a of arches) body = B.hole(body, archFn(a));

  // ------------------------------------------------------------------ glass
  const wsBase = (x) => 0.462 - 0.05 * (x / 0.67) ** 2;
  const zHead = (x) => -0.3 + 0.03 * (x / 0.615) ** 2;
  const fWS = (x, y, z) => Math.max(z - wsBase(A(x)), zHead(A(x)) - z, 0.034 - dC5(x, y, z), onTop(x, y, z));
  const zRoofR = (x) => -0.74 - 0.03 * (x / 0.61) ** 2;
  const zRGB = (x) => -1.7 + 0.025 * (x / 0.67) ** 2;
  const fRG = (x, y, z) => Math.max(z - zRoofR(A(x)), zRGB(A(x)) - z, 0.042 - dC5(x, y, z), onTop(x, y, z));
  const cLine = line(-1.38, 0.95, -0.8, 1.24);
  const upper = (x, y, z) => Math.max(-onTop(x, y, z), beltY(z) + 0.006 - y, 0.016 - dC5(x, y, z));
  const fFrame = (x, y, z) => Math.max(upper(x, y, z), -cLine(z, y), 0.6 - A(x), z - 0.4);
  let [ws, b1] = B.cut(body, fWS, { gap: 0.007 });
  let [rg, b2] = B.cut(b1, fRG, { gap: 0.007 });
  let [frame, b3] = B.cut(b2, fFrame, { gap: 0.004 });
  body = b3;
  const fG1 = (x, y, z) => Math.max(beltY(z) + 0.014 - y, 0.03 - dC5(x, y, z), -0.6 - z);
  const fG2 = (x, y, z) => Math.max(beltY(z) + 0.016 - y, 0.034 - dC5(x, y, z), z + 0.64, 0.013 - cLine(z, y));
  let [glass1, fr1] = B.cut(frame, fG1, { gap: 0.003 });
  let [glass2, frameRest] = B.cut(fr1, fG2, { gap: 0.003 });
  const fWSin = (x, y, z) => Math.max(z - wsBase(A(x)) + 0.045, zHead(A(x)) - z + 0.05, 0.08 - dC5(x, y, z));
  let [wsClear, wsFrit] = B.cut(ws, fWSin, { gap: 0, r: 0 });
  const fRGin = (x, y, z) => Math.max(z - zRoofR(A(x)) + 0.04, zRGB(A(x)) - z + 0.04, 0.08 - dC5(x, y, z));
  let [rgClear, rgFrit] = B.cut(rg, fRGin, { gap: 0, r: 0 });

  // ------------------------------------------------------------------ lamps
  const fHL = (x, y, z) => Math.max(sd.poly(A(x), y, [[0.44, 0.69], [0.62, 0.722], [0.81, 0.758], [0.872, 0.744], [0.862, 0.708], [0.7, 0.677], [0.47, 0.655]]) - 0.006, 1.97 - z);
  let [headL, b4] = B.cut(body, fHL, { gap: 0.004 });
  // full-width bar on the upright rear face, blended into the outer clusters
  const fBar = (x, y, z) => Math.max(sd.smin(sd.box(x, y, 0, 0.858, 0.7, 0.012, 0.006), sd.poly(A(x), y, [[0.6, 0.846], [0.87, 0.83], [0.885, 0.87], [0.83, 0.9], [0.6, 0.876]]) - 0.004, 0.03), z + 2.1);
  let [tailL, b5] = B.cut(b4, fBar, { gap: 0.003 });
  body = b5;

  // ------------------------------------------------------------------ panels
  const hoodX = (z) => c4(z)[0] - 0.05;
  const hoodFront = (x) => 2.2 - 0.12 * (x / 0.75) ** 2;
  const fHood = (x, y, z) => Math.max(A(x) - hoodX(z), 0.5 - z, z - hoodFront(A(x)), 0.68 - y);
  let [hood, p1] = B.cut(body, fHood);
  const fVent = (x, y, z) => sd.poly(A(x), z, [[0.35, 1.44], [0.49, 1.48], [0.5, 1.86], [0.36, 1.83]]) - 0.012;
  hood = B.hole(hood, fVent);
  const fCowl = (x, y, z) => Math.max(z - 0.495, wsBase(A(x)) + 0.004 - z, A(x) - 0.68, onTop(x, y, z));
  let [cowl, p2] = B.cut(p1, fCowl, { gap: 0.003 });
  const fFB = (x, y, z) => Math.max(y - 0.69, 1.78 - z);
  let [fBumper, p3] = B.cut(p2, fFB);
  const fDoor = (x, y, z) => Math.max(z - 0.4, -0.62 - z, 0.27 - y, y - beltY(z) - 0.004, 0.62 - A(x));
  let [door, p4] = B.cut(p3, fDoor);
  const fBoot = (x, y, z) => Math.max(z - zRGB(A(x)) - 0.006, onTop(x, y, z), 0.66 - y, A(x) - (0.62 + (c5(z)[0] - 0.62) * smooth(0.93, 0.99, y)));
  let [boot, p5] = B.cut(p4, fBoot);
  const fRB = (x, y, z) => Math.max(y - 0.64, z + 1.82);
  let [rBumper, p6] = B.cut(p5, fRB);
  const fFuel = (x, y, z) => Math.max(sd.box(z, y, -1.86, 0.84, 0.06, 0.056, 0.02), 0.6 - x);
  let [fuel, rest] = B.cut(p6, fFuel, { gap: 0.003 });
  // openings: layered grille, side intakes, fender gills
  const fGrille = (x, y, z) => Math.max(sd.poly(x, y, [[-0.47, 0.625], [0.47, 0.625], [0.565, 0.31], [-0.565, 0.31]]) - 0.035, 2.1 - z);
  const fSideIn = (x, y, z) => Math.max(sd.poly(A(x), y, [[0.66, 0.27], [0.86, 0.29], [0.85, 0.4], [0.7, 0.38]]) - 0.02, 2.05 - z);
  const fOpen = (x, y, z) => Math.min(fGrille(x, y, z), fSideIn(x, y, z));
  fBumper = B.hole(fBumper, fOpen);
  const fGill = (x, y, z) => Math.max(sd.poly(z, y, [[0.84, 0.5], [0.96, 0.5], [1.02, 0.66], [0.9, 0.66]]) - 0.012, 0.6 - A(x));
  rest = B.hole(rest, fGill);
  const fExh = (x, y, z) => Math.max(Math.min(sd.box(A(x), y, 0.44, 0.29, 0.12, 0.05, 0.03), 1), z + 2.2);
  rBumper = B.hole(rBumper, fExh);

  const fin = (p, o = {}) => B.merge([p, B.roll(p, { r: 0.0018, depth: 0.005, ...o })]);
  const nearArch = (x, y, z) => arches.some((a) => Math.abs(Math.hypot(z - a.z, y - a.y) - a.r) < 0.012 && A(x) > 0.62);
  const nearGlass = (x, y, z) => A(fWS(x, y, z)) < 0.012 || A(fRG(x, y, z)) < 0.012;
  const nearOpen = (x, y, z) => A(fOpen(x, y, z)) < 0.012;
  const nearGill = (x, y, z) => A(fGill(x, y, z)) < 0.012;
  const [glassRoll, glassWall] = B.roll(rest, { r: 0.0018, depth: 0.006, only: nearGlass, splitWall: true });
  const [openRoll, openWall] = B.roll(fBumper, { r: 0.004, depth: 0.08, only: nearOpen, splitWall: true });
  const [gillRoll, gillWall] = B.roll(rest, { r: 0.003, depth: 0.04, only: nearGill, splitWall: true });
  const [exRoll, exWall] = B.roll(rBumper, { r: 0.004, depth: 0.05, only: (x, y, z) => A(fExh(x, y, z)) < 0.012, splitWall: true });
  // optional contrast roof (gloss black or carbon) cut from the roof panel area
  const roofStyle = mods.roof || 'body';
  let roofPanel = null;
  if (roofStyle !== 'body') {
    const fRoof = (x, y, z) => Math.max(z - zHead(A(x)) + 0.004, zRoofR(A(x)) - z + 0.004, onTop(x, y, z) + 0.02);
    [roofPanel, rest] = B.cut(rest, fRoof, { gap: 0.0, r: 0 });
  }
  const nearVent = (x, y, z) => A(fVent(x, y, z)) < 0.012;
  const [ventRoll, ventWall] = B.roll(hood, { r: 0.003, depth: 0.05, only: nearVent, splitWall: true });
  const paintPieces = [
    fin(hood, { only: (x, y, z) => !nearVent(x, y, z) }), ventRoll, fin(door), fin(boot), fin(fuel),
    fin(fBumper, { only: (x, y, z) => !nearOpen(x, y, z) && !nearArch(x, y, z) }), openRoll,
    fin(rBumper, { only: (x, y, z) => A(fExh(x, y, z)) > 0.012 && !nearArch(x, y, z) }), exRoll,
    fin(rest, { only: (x, y, z) => !nearArch(x, y, z) && !nearGlass(x, y, z) && !nearGill(x, y, z) }), glassRoll, gillRoll,
    B.roll(rest, { r: 0.005, depth: 0.035, only: nearArch }), B.roll(fBumper, { r: 0.005, depth: 0.035, only: nearArch }), B.roll(rBumper, { r: 0.005, depth: 0.035, only: nearArch }),
  ];
  g.add(B.assemble({
    paint: paintPieces,
    satin: [fin(frameRest, { depth: 0.004 })],
    gloss: [B.projectUV(fin(cowl), 'y', 1)],
    blackPlastic: [B.projectUV(openWall, 'z', 1), B.projectUV(exWall, 'z', 1), B.projectUV(gillWall, 'x', 1), B.projectUV(ventWall, 'y', 1)],
    frit: [wsFrit, rgFrit],
    ...(roofPanel ? { roof: [roofStyle === 'carbon' ? B.projectUV(roofPanel, 'y', 3) : roofPanel] } : {}),
  }, { paint: kit.paint, satin: mat.glossBlack(), gloss: mat.blackPlastic(), blackPlastic: mat.blackPlastic(), frit: mat.frit(), roof: roofStyle === 'carbon' ? M.carbon() : mat.glossBlack() }));
  const sink = (p, d) => B.offset(p, -d);
  const dark = (mods.tint || 'dark') === 'dark';
  g.add(B.glass([sink(wsClear, 0.003)], { tint: 0x111618, outer: 0.55, inner: 0.1 }));
  g.add(B.glass([sink(rgClear, 0.003), sink(glass1, 0.005), sink(glass2, 0.004)], dark ? { tint: 0x050607, outer: 0.8, inner: 0.28 } : { tint: 0x111618, outer: 0.55, inner: 0.1 }));
  const sealP = [[-0.006, -0.004], [-0.002, 0.0012], [0.003, 0.0018], [0.006, -0.003]];
  g.add(B.mesh([...(ctx.interior ? [B.bead(ws, sealP), B.bead(rg, sealP), B.bead(glass2, [[-0.003, -0.004], [0, 0.001], [0.004, 0.0012], [0.006, -0.004]])] : []), glassWall], mat.rubber(), { name: 'seals' }));
  for (const a of arches) g.add(B.mesh(B.wheelWell(S, { z: a.z, y: a.y, r: a.r + 0.004, xi: a.z > 0 ? xiF : xiR, bottom: 0.13 }), mat.wellLiner(), { name: 'well' }));

  // ------------------------------------------------------------------ grille: layered horizontal vanes, emblem; side intake meshes; gill strakes
  {
    const vanes = [];
    for (let i = 0; i < 6; i++) {
      const y = 0.345 + i * 0.052, w = 0.555 - (y - 0.31) * 0.3;
      vanes.push(kit.geo.place(kit.geo.roundedBox(w * 2 - 0.06, 0.012, 0.05, 0.004, 1), [0, y, 2.255 + (y - 0.31) * 0.12], [-0.25, 0, 0]));
    }
    g.add(new THREE.Mesh(kit.geo.merge(vanes), mat.glossBlack()));
    const edge = new THREE.Mesh(kit.geo.merge(vanes.map((v) => kit.geo.place(v.clone(), [0, 0, 0.026], [0, 0, 0], [1, 0.25, 0.1]))), mat.chrome());
    g.add(edge);
    const back = new THREE.Mesh(kit.geo.box(1.15, 0.34, 0.01), mat.cavity());
    back.position.set(0, 0.47, 2.2);
    g.add(back);
    // emblem: a mountain peak (玉山) in a shield, chrome on black
    const peak = [[-0.04, -0.018], [-0.012, 0.016], [0.0, 0.004], [0.014, 0.024], [0.04, -0.018]];
    const em = new THREE.Group();
    em.add(new THREE.Mesh(kit.geo.extrude([[-0.05, -0.03], [0.05, -0.03], [0.054, 0.02], [0.0, 0.042], [-0.054, 0.02]], 0.006, { axis: 'z', bevel: 0.0015 }), mat.glossBlack()));
    const pk = new THREE.Mesh(kit.geo.extrude(peak, 0.004, { axis: 'z', bevel: 0.001 }), mat.chrome()); pk.position.z = 0.005;
    em.add(pk);
    em.position.set(0, 0.6, 2.318);
    g.add(em);
    const emR = em.clone(); emR.position.set(0, 0.79, -2.33); emR.rotation.y = Math.PI; g.add(emR);
    const meshM = M.shared('ty:mesh', () => M.textured('grille', { repeat: 5, roughness: 0.45 }));
    for (const sx of [1, -1]) {
      const sm = new THREE.Mesh(kit.geo.roundedBox(0.2, 0.11, 0.01, 0.02, 1), meshM);
      sm.position.set(sx * 0.76, 0.335, 2.25); sm.rotation.y = sx * 0.35;
      g.add(sm);
      // fender gill: two chrome strakes across the opening
      const gl = new THREE.Group();
      for (const dy of [0.545, 0.61]) { const s2 = new THREE.Mesh(kit.geo.roundedBox(0.008, 0.012, 0.13, 0.004, 1), mat.chrome()); s2.position.set(S.sideAt(0.93, dy) - 0.006, dy, 0.93 + (dy - 0.58) * 0.35); s2.rotation.x = -0.35; gl.add(s2); }
      if (sx < 0) gl.scale.x = -1;
      g.add(gl);
    }
  }

  // ------------------------------------------------------------------ headlamps: smoked housing, three LED projectors, peak-shaped DRL
  {
    g.add(B.mesh([headL], mat.lensClear(null), { name: 'lens' }));
    g.add(B.mesh([B.offset(headL, -0.04), B.skirt(headL, [0, 0, -0.04])], M.shared('ty:hlHouse', () => M.surface({ color: 0x0b0c0e, roughness: 0.3, metalness: 0.5 }))));
    for (const sx of [1, -1]) {
      for (const [x, y] of [[0.53, 0.695], [0.61, 0.708], [0.69, 0.722]]) {
        const hit = B.project(headL, 'z', sx * x, y, 3);
        if (!hit) continue;
        const pr = new THREE.Group();
        pr.position.set(hit.p[0] - hit.n[0] * 0.03, hit.p[1] - 0.004, hit.p[2] - hit.n[2] * 0.03);
        pr.add(new THREE.Mesh(kit.geo.roundedBox(0.05, 0.024, 0.03, 0.006, 1), mat.darkMetal()));
        const em = new THREE.Mesh(kit.geo.roundedBox(0.036, 0.014, 0.004, 0.003, 1), B.emitter('head', 0xf2f6ff, 0.04));
        em.position.z = 0.016;
        pr.add(em);
        pr.lookAt(pr.position.x + hit.n[0], pr.position.y, pr.position.z + hit.n[2]);
        g.add(pr);
      }
      // DRL: a thin light line along the upper edge with a rising "peak" at the outer end
      const drlPts = [];
      for (const [x, y] of [[0.47, 0.672], [0.6, 0.698], [0.72, 0.722], [0.78, 0.745], [0.82, 0.73], [0.85, 0.722]]) {
        const hit = B.project(headL, 'z', sx * x, y, 3);
        if (hit) drlPts.push([hit.p[0] - hit.n[0] * 0.012, hit.p[1], hit.p[2] - hit.n[2] * 0.012]);
      }
      if (drlPts.length > 2) g.add(B.mesh([B.sweep(drlPts, [[-0.0035, -0.0035], [0.0035, -0.0035], [0.0035, 0.0035], [-0.0035, 0.0035]], { sub: 4, profileClosed: true })], B.emitter('drl', 0xe8f4ff, 0.6)));
      kit._anchors.headlights.push([sx * 0.62, 0.71, 2.25]);
    }
  }

  // ------------------------------------------------------------------ rear light bar: red bar, LED segments, reverse lamps in the clusters
  {
    g.add(B.mesh([B.projectUV(tailL, 'z', 1)], mat.lensRed('lensOptic', 30), { name: 'lens' }));
    const backP = B.offset(tailL, -0.02);
    g.add(B.mesh([backP, B.skirt(tailL, [0, 0, 0.02])], M.shared('ty:tlHouse', () => M.surface({ color: 0x140506, roughness: 0.35, metalness: 0.3 }))));
    g.add(B.mesh([B.offset(tailL, -0.012)], B.emitter('brake', 0xff1f14, 0.35)));
    for (const sx of [1, -1]) {
      const hit = B.project(tailL, 'z', sx * 0.76, 0.86, -3);
      if (!hit) continue;
      const rev = new THREE.Mesh(kit.geo.roundedBox(0.1, 0.012, 0.004, 0.004, 1), B.emitter('reverse', 0xf6f3ec, 0.02));
      rev.position.set(hit.p[0], hit.p[1] - 0.015, hit.p[2] + 0.004);
      rev.lookAt(rev.position.x + hit.n[0], rev.position.y, rev.position.z + hit.n[2]);
      g.add(rev);
    }
  }

  // ------------------------------------------------------------------ hood vents, splitter, diffuser and quad exhaust, side blades
  {
    for (const sx of [1, -1]) {
      // louvres inside the hood vents, angled to pull air out of the engine bay
      const vg = [];
      for (let i = 0; i < 7; i++) {
        const z = 1.49 + i * 0.05, x0 = 0.355 + (z - 1.44) * 0.03, x1 = 0.49 + (z - 1.48) * 0.025, x = sx * (x0 + x1) / 2, y = S.topAt(z, x) - 0.012;
        vg.push(kit.geo.place(kit.geo.roundedBox(x1 - x0 - 0.01, 0.005, 0.045, 0.002, 1), [x, y, z], [0.55, 0, 0]));
      }
      g.add(new THREE.Mesh(kit.geo.merge(vg), mat.glossBlack()));
      const rec = new THREE.Mesh(kit.geo.box(0.16, 0.004, 0.44), mat.cavity());
      rec.position.set(sx * 0.425, S.topAt(1.65, 0.425) - 0.05, 1.65);
      g.add(rec);
    }
    const sp = B.planPath(0.82, 1.92, 2.385, 0.25).map((p) => [p[0], 0.19, p[2]]);
    g.add(B.mesh([B.projectUV(B.sweep(sp, [[-0.08, 0.0], [0.035, 0.0], [0.05, 0.012], [-0.08, 0.02]], { sub: 3, profileClosed: true }), 'y', 3)], M.carbon(), { name: 'splitter' }));
    const dp = B.planPath(0.72, -2.0, -2.34, 0.2).map((p) => [p[0], 0, p[2]]);
    const diff = B.sweep(dp, (s) => { const t = 0.012 + 0.02 * smooth(0.05, 0.25, s) * smooth(0.95, 0.75, s); return [[-0.06, 0.17], [t, 0.175], [t + 0.004, 0.22], [t - 0.004, 0.24], [-0.06, 0.245]]; }, { sub: 3 });
    g.add(B.mesh([B.projectUV(diff, 'z', 3)], M.carbon(), { name: 'diffuser' }));
    const fins = [];
    for (const x of [-0.24, -0.08, 0.08, 0.24]) fins.push(kit.geo.place(kit.geo.roundedBox(0.008, 0.08, 0.3, 0.003, 1), [x, 0.19, -2.2]));
    g.add(new THREE.Mesh(kit.geo.merge(fins), M.carbon()));
    for (const sx of [1, -1]) for (const dx of [-0.065, 0.065]) {
      const x = sx * (0.44 + dx);
      const tip = B.from(kit.geo.latheZ([[0.04, -0.12], [0.044, -0.1], [0.046, 0.0], [0.04, 0.006], [0.036, -0.08]], 24));
      const tm = B.mesh([tip], M.shared('ty:tip', () => M.surface({ color: 0x2c2d30, roughness: 0.25, metalness: 1 })), { name: 'exhaustTip' });
      tm.position.set(x, 0.29, -2.3); tm.rotation.y = Math.PI;
      g.add(tm);
      kit._anchors.exhaust.push([x, 0.29, -2.33]);
    }
    // carbon side blades along the sills
    const sk = [];
    for (let i = 0; i <= 12; i++) { const z = 0.94 - (1.85 * i) / 12; sk.push([S.sideAt(z, 0.26) + 0.004, 0, z]); }
    const blade = B.sweep(sk, [[-0.02, 0.2], [0.02, 0.2], [0.034, 0.212], [0.0, 0.25]], { sub: 2, capStart: true, capEnd: true });
    g.add(B.mesh([B.projectUV(blade, 'x', 3), B.projectUV(B.mirror(blade), 'x', 3)], M.carbon(), { name: 'sideBlade' }));
  }

  // ------------------------------------------------------------------ swan-neck wing (option or race aero)
  if (spoiler === 'swan' || (parts.rearAero && parts.rearAero !== 'stock')) {
    const span = 1.5, chord = 0.28, zw = -2.02, yw = 1.2;
    const foil = [[chord * 0.5, 0.0], [chord * 0.3, 0.018], [0, 0.026], [-chord * 0.35, 0.02], [-chord * 0.5, 0.006], [-chord * 0.5, 0.0], [-chord * 0.3, -0.008], [0, -0.01], [chord * 0.3, -0.005]];
    const path = [];
    for (let i = 0; i <= 12; i++) { const x = -span / 2 + (span * i) / 12; path.push([x, yw - 0.02 * (x / (span / 2)) ** 2, zw]); }
    g.add(B.mesh([B.projectUV(B.sweep(path, foil, { sub: 2, profileClosed: true, capStart: true, capEnd: true }), 'y', 3)], M.carbon(), { name: 'wing' }));
    for (const sx of [1, -1]) {
      const x = sx * 0.38, yDeck = S.topAt(zw + 0.08, x);
      const neck = B.sweep([[x, yDeck - 0.005, zw + 0.1], [x, yDeck + 0.1, zw + 0.06], [x, yw + 0.09, zw + 0.0], [x, yw + 0.03, zw - 0.06]], (s) => [[-0.006, -0.05 + 0.02 * s], [0.006, -0.05 + 0.02 * s], [0.006, 0.05 - 0.02 * s], [-0.006, 0.05 - 0.02 * s]], { sub: 4, profileClosed: true, upFn: () => [0, 0, 1] });
      g.add(B.mesh([neck], mat.glossBlack()));
      const ep = new THREE.Mesh(kit.geo.roundedBox(0.008, 0.14, chord + 0.06, 0.004, 1), M.carbon()); ep.position.set(sx * span / 2, yw + 0.02, zw); g.add(ep);
    }
  }

  // ------------------------------------------------------------------ mirrors, flush handles, wipers, antenna fin
  for (const side of [1, -1]) {
    const z = 0.32, y = beltY(z) - 0.01, x = S.sideAt(z, y);
    g.add(B.doorMirror({ base: [x - 0.012, y, z], size: [0.21, 0.1, 0.095], side, out: 0.065, up: 0.045, indicator: true, capMat: mods.mirrors === 'carbon' ? M.carbon() : kit.paint, stalkMat: mat.glossBlack() }));
    const zh = -0.45, yh = 0.82, xh = S.sideAt(zh, yh);
    const hg = new THREE.Group();
    const flap = new THREE.Mesh(kit.geo.roundedBox(0.008, 0.026, 0.16, 0.012, 2), kit.paint); flap.position.set(xh + 0.001, yh, zh);
    const ring = new THREE.Mesh(kit.geo.roundedBox(0.004, 0.034, 0.168, 0.015, 2), mat.glossBlack()); ring.position.set(xh - 0.002, yh, zh);
    hg.add(ring, flap);
    if (side < 0) hg.scale.x = -1;
    g.add(hg);
  }
  {
    const wip = [];
    const blade = (px, len) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const x = px + (len * i) / 8; const z = wsBase(A(x)) - 0.045; pts.push([x, S.topAt(z, x) + 0.012, z]); }
      wip.push(B.sweep(pts, [[-0.006, -0.006], [0.006, -0.006], [0.004, 0.006], [-0.004, 0.006]], { sub: 2, profileClosed: true }));
      const a = pts[0], e = pts[8];
      wip.push(B.sweep([[px - 0.02, a[1] + 0.006, a[2] + 0.025], [px + len * 0.5, a[1] + 0.02, a[2] - 0.004], [px + len * 0.8, e[1] + 0.016, e[2]]], [[-0.005, 0], [0.005, 0], [0.005, 0.006], [-0.005, 0.006]], { sub: 3, profileClosed: true }));
    };
    blade(-0.6, 0.56); blade(0.0, 0.56);
    g.add(B.mesh(wip, mat.satinBlack(), { name: 'wipers' }));
    const fz = zRoofR(0) + 0.08, fy = S.topAt(fz, 0);
    const fin2 = kit.geo.extrude([[0, 0], [0.11, 0], [0.025, 0.036], [0.0, 0.032]], 0.026, { axis: 'x', bevel: 0.004 });
    const finM = new THREE.Mesh(fin2, roofStyle === 'body' ? kit.paint : mat.glossBlack());
    finM.position.set(0, fy - 0.003, fz - 0.06);
    g.add(finM);
  }

  // ------------------------------------------------------------------ underbody, plates, lettering
  {
    const fFloor = (x, y, z) => Math.max(A(x) - (S.corner(1, z)[0] - 0.005), y - S.corner(1, z)[1] - 0.012);
    let floor = B.clip(S.patch, fFloor);
    for (const a of arches) floor = B.clip(floor, (x, y, z) => -archFn(a, 0.01)(x, y, z));
    g.add(B.mesh([B.offset(floor, 0.0015)], mat.underbody(), { name: 'floor', shadow: false }));
    const ub = [];
    for (const sx of [1, -1]) ub.push(B.from(kit.geo.tube([[sx * 0.18, 0.18, 1.1], [sx * 0.16, 0.17, -0.2], [sx * 0.24, 0.18, -1.5], [sx * 0.44, 0.24, -1.95], [sx * 0.44, 0.28, -2.2]], 0.034, 40, 10)));
    g.add(B.mesh(ub, mat.darkMetal(), { name: 'exhaustPipe' }));
    g.add(B.mesh([B.warp(B.from(kit.geo.roundedBox(1.0, 0.13, 0.32, 0.05, 2)), (x, y, z) => [x, y + 0.26, z - 2.0])], mat.darkMetal()));
    const plateTxt = 'YS-0001';
    g.add(kit.ext.plate({ pos: [0, 0.6, -2.315], text: plateTxt, rear: true }));
    g.add(kit.ext.plate({ pos: [0, 0.255, 2.33], text: plateTxt, rear: false }));
    const nameTex = B.decalMat(B.textCanvas('Y U S H A N', { w: 1024, h: 128, size: 78, weight: 600, color: '#dcdde0' }), { key: 'ty:name', metalness: 0.7, roughness: 0.2 });
    const dn = B.decal(boot, (x, y, z) => Math.max(sd.box(x, y, 0, 0.745, 0.22, 0.02, 0), z + 2.25), { axis: 'z', a0: 0.22, b0: 0.725, w: -0.44, h: 0.04, material: nameTex });
    if (dn) g.add(dn);
    const v8Tex = B.decalMat(B.textCanvas('TYPHOON  V8', { w: 1024, h: 128, size: 80, weight: 700, color: '#dcdde0' }), { key: 'ty:v8', metalness: 0.7, roughness: 0.22 });
    for (const side of [1, -1]) {
      const d = B.decal(rest, (x, y, z) => Math.max(sd.box(z, y, 0.87, 0.47, 0.09, 0.012, 0), -x * side + 0.6), { axis: 'x', a0: 0.96, b0: 0.458, w: -0.18, h: 0.024, flipU: side < 0, material: v8Tex });
      if (d) g.add(d);
    }
    const tw = B.decalMat(B.textCanvas('玉山', { w: 256, h: 128, size: 92, weight: 700, color: '#e3e4e6', font: B.fonts.cjk }), { key: 'ty:yushan', metalness: 0.7, roughness: 0.22 });
    const dy2 = B.decal(boot, (x, y, z) => Math.max(sd.box(x, y, -0.5, 0.745, 0.05, 0.022, 0), z + 2.25), { axis: 'z', a0: -0.45, b0: 0.722, w: -0.1, h: 0.046, material: tw });
    if (dy2) g.add(dy2);
  }
  return { group: g, S, arches, archFn, geo: { fWS, fRG, fFrame, fG1, fG2, beltY, c4, c5, dC5, onTop, wsBase, zHead, zRoofR, zRGB, cLine, hoodX } };
}
