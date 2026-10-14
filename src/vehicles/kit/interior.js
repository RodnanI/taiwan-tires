// Interior building blocks. Positions are vehicle-local ([x, y, z], +X = left, +Z = forward).
// Things the runtime animates are registered on the kit collector:
//   steeringWheel -> rotates about its local Z (column axis) by steer * lock * ratio
//   cluster       -> live gauges (CanvasTexture redrawn from telemetry)
//   headUnit      -> anchors.screen (the menu is mapped onto it) + in-game display canvas
import * as THREE from 'three';
import { roundedBox, tube, extrude, place, merge, latheZ, box, cylinderX, cylinderZ } from './geometry.js';
import { loftBody, sweep, warp, toGeometry, fromGeometry, mergePatches, split, clip, roll, offset } from './body.js';
import { getTextureSet } from '../../render/textures.js';
import { makeCanvas, FONT_UI } from '../../core/canvas.js';
import { canvasTexture } from '../../render/textures.js';

const D2R = Math.PI / 180;

export function makeInterior(kit) {
  const { M } = kit;
  const I = {};

  /** Bucket or stock seat. Returns Group. */
  I.seat = ({ pos = [0.38, 0.3, -0.3], width = 0.5, style = 'bucket', color = 0x1f1d1c, accent = null } = {}) => {
    const g = new THREE.Group();
    const mat = style === 'stock' ? M.fabric(color) : M.leather(color);
    const cushion = new THREE.Mesh(roundedBox(width, 0.12, 0.5, 0.05, 3), mat);
    cushion.position.set(0, 0.06, 0.05);
    const back = new THREE.Mesh(roundedBox(width * 0.92, 0.66, 0.11, 0.05, 3), mat);
    back.position.set(0, 0.42, -0.2); back.rotation.x = -0.22;
    g.add(cushion, back);
    if (style === 'bucket') {
      const bol = roundedBox(0.08, 0.5, 0.16, 0.035, 2);
      const l = new THREE.Mesh(bol, mat); l.position.set(width / 2 - 0.02, 0.38, -0.17); l.rotation.set(-0.22, 0, -0.12);
      const r = new THREE.Mesh(bol, mat); r.position.set(-width / 2 + 0.02, 0.38, -0.17); r.rotation.set(-0.22, 0, 0.12);
      const sb = roundedBox(0.07, 0.1, 0.42, 0.03, 2);
      const sl = new THREE.Mesh(sb, mat); sl.position.set(width / 2 - 0.03, 0.12, 0.05);
      const sr = new THREE.Mesh(sb, mat); sr.position.set(-width / 2 + 0.03, 0.12, 0.05);
      g.add(l, r, sl, sr);
      if (accent != null) { const st = new THREE.Mesh(roundedBox(0.06, 0.5, 0.115, 0.02, 1), M.leather(accent)); st.position.set(0, 0.42, -0.198); st.rotation.x = -0.22; g.add(st); }
    } else {
      const head = new THREE.Mesh(roundedBox(width * 0.5, 0.16, 0.1, 0.04, 2), mat);
      head.position.set(0, 0.86, -0.3); head.rotation.x = -0.2; g.add(head);
    }
    g.position.set(...pos);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  };

  /** Steering wheel. The returned group's local Z is the column axis (towards the driver = -Z of the car, tilted up). */
  I.steeringWheel = ({ pos = [0.38, 0.86, 0.38], radius = 0.185, tilt = 22, style = 'round', color = 0x161616, accent = null } = {}) => {
    const root = new THREE.Group();
    root.position.set(...pos);
    root.rotation.x = -tilt * D2R; // column tilt: top of the wheel leans away from the driver
    const wheel = new THREE.Group();
    root.add(wheel);
    const grip = M.leather(color);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.017, 12, Math.round(48 * kit.detail)), grip);
    if (style === 'flatBottom') { const p = rim.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -radius * 0.82) p.setY(i, -radius * 0.82 + (p.getY(i) + radius * 0.82) * 0.15); p.needsUpdate = true; rim.geometry.computeVertexNormals(); }
    wheel.add(rim);
    const spokeMat = M.plastic(0x1c1c1e, 0.45);
    const spokes = style === 'deep3' ? [0, 2.3, -2.3] : [Math.PI / 2, -Math.PI / 2, Math.PI];
    const sp = spokes.map((a) => place(box(radius * 0.92, 0.026, 0.018), [Math.cos(a) * radius * 0.48, Math.sin(a) * radius * 0.48, -0.01], [0, 0, a]));
    wheel.add(new THREE.Mesh(merge(sp), spokeMat));
    const hub = new THREE.Mesh(latheZ([[0, -0.05], [0.06, -0.05], [0.065, -0.01], [0.05, 0.02], [0, 0.025]], 24), spokeMat);
    wheel.add(hub);
    if (accent != null) { const mark = new THREE.Mesh(box(0.012, 0.035, 0.036), M.leather(accent)); mark.position.set(0, radius, 0); wheel.add(mark); }
    // column shroud
    const col = new THREE.Mesh(latheZ([[0.035, -0.25], [0.04, -0.06], [0.03, -0.04]], 16), M.plastic(0x121214, 0.6));
    col.position.z = 0;
    root.add(col);
    wheel.rotation.y = Math.PI; // face the driver (-Z)
    kit._steering = { object: wheel };
    return root;
  };

  /** Dashboard slab with a rounded top, spanning the cabin width. */
  I.dashboard = ({ width = 1.45, z = 0.55, y = 0.72, depth = 0.5, height = 0.24, color = 0x1a1a1c } = {}) => {
    const outline = [[-depth / 2, 0], [depth / 2 - 0.05, 0], [depth / 2, height * 0.6], [depth / 2 - 0.12, height], [-depth / 2 + 0.04, height * 0.92], [-depth / 2, height * 0.5]];
    const g = extrude(outline, width, { axis: 'x', bevel: 0.015, bevelSegments: 3 });
    const m = new THREE.Mesh(g, M.plastic(color, 0.75));
    m.position.set(0, y - height * 0.5, z);
    m.receiveShadow = true;
    return m;
  };

  /**
   * Gauge cluster with live needles. type: 'analog2' | 'digital'.
   * Registered for runtime updates (only redrawn when the cockpit is visible).
   */
  I.cluster = ({ pos = [0.38, 0.86, 0.6], size = [0.36, 0.13], tilt = 12, type = 'analog2', redline = 7000, maxRpm = 9000, maxSpeed = 260, accent = '#ff9a2e', hood = true, px = 512, glow = 1.25, glass = false, boost = false, theme = null } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.x = -tilt * D2R;
    const W = px, H = Math.round(px * (size[1] / size[0]));
    const canvas = makeCanvas(W, H);
    const tex = canvasTexture(canvas, { repeat: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), M.surface({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow, map: tex, roughness: 0.5 }));
    face.rotation.y = Math.PI; // faces the driver
    g.add(face);
    if (glass) {
      // cluster lens: a faint reflective sheet a few millimetres in front of the dials
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), M.shared('cluster:glass', () => { const m = M.surface({ color: 0x0a0c0e, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12 }); m.depthWrite = false; return m; }));
      gl.rotation.y = Math.PI; gl.position.z = -0.006;
      g.add(gl);
    }
    if (hood) {
      const h = new THREE.Mesh(extrude([[0, 0], [0.12, 0], [0.13, 0.04], [0.02, 0.06]], size[0] + 0.06, { axis: 'x', bevel: 0.01 }), M.plastic(0x141416, 0.7));
      h.position.set(0, size[1] / 2 - 0.01, -0.02);
      g.add(h);
    }
    const state = { canvas, tex, W, H, type, redline, maxRpm, maxSpeed, accent, last: -1, units: 'kmh', boost, theme };
    kit._gauges.push({ update: (tel, now, units) => drawCluster(state, tel, now, units) });
    drawCluster(state, { rpm: 0, speed: 0, gear: 1, boost: 0 }, 0, 'kmh', true);
    return g;
  };

  /**
   * Infotainment head unit. size = [w, h] of the visible screen in metres. The menu UI is mapped onto
   * exactly this rectangle (anchors.screen). style: 'tablet' (floating) | 'integrated' | 'doubleDin'.
   */
  I.headUnit = ({ pos = [0, 0.86, 0.62], size = [0.24, 0.14], tilt = 14, yaw = 0, style = 'tablet', bezel = 0.012 } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.set(-tilt * D2R, Math.PI + yaw * D2R, 0, 'YXZ');
    const [w, h] = size;
    const frame = new THREE.Mesh(roundedBox(w + bezel * 2, h + bezel * 2, style === 'doubleDin' ? 0.1 : 0.022, 0.008, 2), M.plastic(0x0d0d0f, 0.35));
    frame.position.z = -0.012;
    g.add(frame);
    const canvas = makeCanvas(512, Math.round(512 * h / w));
    const tex = canvasTexture(canvas, { repeat: false });
    const screenMat = M.surface({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, roughness: 0.08, metalness: 0.0 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.z = 0.0005;
    screen.name = 'headunit-screen';
    g.add(screen);
    if (style === 'tablet') {
      const stem = new THREE.Mesh(roundedBox(w * 0.3, 0.06, 0.05, 0.01, 1), M.plastic(0x111113, 0.5));
      stem.position.set(0, -h / 2 - 0.03, -0.03);
      g.add(stem);
    }
    kit._screen = { group: g, mesh: screen, width: w, height: h, canvas, texture: tex };
    return g;
  };

  I.shifter = ({ pos = [0.05, 0.5, 0.15], type = 'h' } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    const boot = new THREE.Mesh(latheZ([[0.06, 0], [0.04, 0.05], [0.015, 0.09]], 12), M.leather(0x151515));
    boot.rotation.x = -Math.PI / 2;
    const stick = new THREE.Mesh(tube([[0, 0.05, 0], [0, 0.16, -0.02]], 0.008, 8, 6), M.chrome());
    const knob = new THREE.Mesh(type === 'seq' ? roundedBox(0.035, 0.08, 0.045, 0.012, 2) : new THREE.SphereGeometry(0.026, 16, 12), type === 'seq' ? M.plastic(0x1a1a1a, 0.4) : M.surface({ color: 0x111111, roughness: 0.25, metalness: 0.3 }));
    knob.position.set(0, 0.18, -0.025);
    g.add(boot, stick, knob);
    return g;
  };

  I.pedals = ({ pos = [0.38, 0.22, 0.85] } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    const mat = M.metal(0x9a9ca0, 0.3);
    [[0.1, 0.07], [0, 0.07], [-0.1, 0.06]].forEach(([x, w]) => { const p = new THREE.Mesh(roundedBox(w, 0.09, 0.012, 0.004, 1), mat); p.position.set(x, 0, 0); p.rotation.x = -0.5; g.add(p); });
    return g;
  };

  /** Roll cage tubes following the cabin (A/B/C pillars + door bars). Provide cabin corner points. */
  I.rollCage = ({ halfWidth = 0.62, floorY = 0.25, roofY = 1.18, zFront = 0.55, zMid = -0.25, zRear = -0.9, color = 0xd8d3c5, radius = 0.02 } = {}) => {
    const mat = M.surface({ color, roughness: 0.45, metalness: 0.3 });
    const parts = [];
    for (const s of [1, -1]) {
      const x = s * halfWidth;
      parts.push(tube([[x, floorY, zFront], [x * 0.96, roofY - 0.08, zFront - 0.25], [x * 0.92, roofY - 0.02, zMid]], radius));
      parts.push(tube([[x * 0.92, roofY - 0.02, zMid], [x * 0.95, floorY, zMid + 0.02]], radius, 8));
      parts.push(tube([[x * 0.92, roofY - 0.03, zMid], [x * 0.95, floorY + 0.25, zRear]], radius, 8));
      parts.push(tube([[x, floorY + 0.12, zFront - 0.05], [x * 1.01, floorY + 0.38, zMid + 0.05]], radius, 6));
      parts.push(tube([[x, floorY + 0.38, zFront - 0.05], [x * 1.01, floorY + 0.14, zMid + 0.05]], radius, 6));
    }
    parts.push(tube([[halfWidth * 0.92, roofY - 0.02, zMid], [-halfWidth * 0.92, roofY - 0.02, zMid]], radius, 8));
    parts.push(tube([[halfWidth * 0.92, roofY - 0.02, zMid], [-halfWidth * 0.95, floorY + 0.1, zMid]], radius, 8));
    const m = new THREE.Mesh(merge(parts), mat);
    m.castShadow = true;
    return m;
  };

  I.rearViewMirror = ({ pos = [0, 1.1, 0.42] } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    const body = new THREE.Mesh(roundedBox(0.24, 0.07, 0.03, 0.015, 2), M.plastic(0x101012, 0.5));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.055), M.surface({ color: 0x8890a0, roughness: 0.02, metalness: 1 }));
    glass.position.z = -0.016; glass.rotation.y = Math.PI;
    g.add(body, glass);
    return g;
  };

  // ===================================================================================== detailed parts
  const segD = (n) => Math.max(2, Math.round(n * kit.detail));
  const loft = (st, o) => loftBody(st, { segFn: (n) => Math.max(1, n * kit.detail), ...o });
  /** Textured interior material (shared): key = texture generator, repeat in tiles per uv unit (metres on lofts with metric uv). */
  I.mat = (key, { color = 0xffffff, roughness = 0.85, repeat = 8, normalScale = 1, metalness = 0 } = {}) => M.shared(`int:${key}:${color}:${roughness}:${repeat}`, () => {
    const set = getTextureSet(key, M.texSize || 512);
    const c = (t) => { if (!t) return null; const x = t.clone(); x.needsUpdate = true; x.repeat.set(repeat, repeat); return x; };
    const m = M.surface({ color, roughness, metalness, map: c(set.map), normalMap: M.normalMapsAllowed() ? c(set.normalMap) : null });
    if (m.normalScale) m.normalScale.set(normalScale, normalScale);
    return m;
  });
  /** Metric uvs on a patch (planar projection on the dominant axis per triangle is overkill: one axis is enough). */
  const uvProject = (p, axis, scale = 1) => {
    const v = p.v, [a, b] = axis === 'x' ? [2, 1] : axis === 'y' ? [0, 2] : [0, 1];
    for (let i = 0; i < v.length; i += 8) { v[i + 6] = v[i + a] * scale; v[i + 7] = v[i + b] * scale; }
    return p;
  };
  const meshOf = (patches, mat, { shadow = true } = {}) => { const m = new THREE.Mesh(toGeometry(mergePatches([].concat(patches))), mat); m.castShadow = shadow; m.receiveShadow = true; return m; };

  /**
   * Lofted seat. Origin: centre of the cushion base (on the rails), +Z forward. Returns a Group.
   * o: { w, len, h (cushion top), back (height), recline (deg), bolster (cushion side bolster), backBolster,
   *      insert, side, piping (materials), headrest: 'separate' | 'integrated' | 'none', shell (back shell mat),
   *      harness (bool: slots in an integrated headrest) }
   */
  I.seat2 = (o = {}) => {
    const g = new THREE.Group();
    const w = o.w ?? 0.5, L = o.len ?? 0.5, h = o.h ?? 0.13, H = o.back ?? 0.62, rec = (o.recline ?? 17) * D2R;
    const bol = o.bolster ?? 0.04, bb = o.backBolster ?? 0.07;
    const insert = o.insert, side = o.side ?? insert, pip = o.piping ?? side;
    const hw = w / 2;
    // ---- cushion: half-sections [bottom centre, bottom edge, outer side, bolster crest, seam valley, top centre]
    const cs = (z, hz, bz, wz = 1) => ({ z, pts: [[0, 0.02, 0.02], [hw * wz - 0.03, 0.02, 0.02], [hw * wz, hz * 0.55, 0.03], [hw * wz - 0.035, hz + bz, 0.03], [hw * wz - 0.095, hz - 0.004, 0.018], [0, hz, 0.4]] });
    const cush = loft([cs(-L / 2, h + 0.01, bol * 0.6), cs(-L / 2 + 0.08, h, bol), cs(0, h - 0.005, bol * 1.1), cs(L / 2 - 0.1, h + 0.012, bol * 0.6), cs(L / 2 - 0.02, h + 0.004, bol * 0.25, 0.97)], {
      fillet: [2, 2, 4, 4, 3, 4], seg: [3, 2, 1, 2, 4], rows: 24, capRear: { dome: 0.01, rings: 4 }, capFront: { dome: 0.035, rings: 7 },
    }).patch;
    // insert (centre) vs bolsters, separated by a stitched seam
    const fIns = (x, y) => Math.max(Math.abs(x) - (hw - 0.1), h - 0.03 - y);
    let [cIns, cSide] = split(cush, fIns, 0.002);
    g.add(meshOf([uvProject(cIns, 'y', 1), roll(cIns, { r: 0.002, depth: 0.004 })], insert));
    g.add(meshOf([uvProject(cSide, 'y', 1), roll(cSide, { r: 0.002, depth: 0.004 })], side));
    // ---- backrest: lofted along its height in a local frame (x, t = forward, z = up), then reclined
    const bt = o.thick ?? 0.12;
    const bs = (z, bz, wz = 1, tz = 1) => ({ z, pts: [[0, -bt * 0.55 * tz, 0.03], [hw * wz - 0.04, -bt * 0.5 * tz, 0.04], [hw * wz, 0, 0.035], [hw * wz - 0.04, bz, 0.035], [hw * wz - 0.11, 0.012, 0.02], [0, 0.02, 0.5]] });
    const integrated = o.headrest === 'integrated';
    const topH = integrated ? H + 0.2 : H;
    const bst = [bs(0, bb * 0.7, 1, 1.1), bs(0.12, bb, 1.0), bs(0.3, bb * 1.1, 0.98), bs(H * 0.85, bb * 0.55, 0.92), bs(H, bb * 0.25, integrated ? 0.8 : 0.86, 0.9)];
    if (integrated) bst.push(bs(H + 0.1, bb * 0.35, 0.55, 0.85), bs(topH, bb * 0.2, 0.5, 0.8));
    let back = loft(bst, { fillet: [2, 3, 4, 4, 3, 4], seg: [4, 2, 1, 2, 5], rows: integrated ? 34 : 26, capRear: { dome: 0.005, rings: 3 }, capFront: { dome: 0.03, rings: 6 } }).patch;
    const zb = -L / 2 + 0.03, yb = h - 0.02;
    const cr = Math.cos(rec), sr = Math.sin(rec);
    const place2 = (x, t, z) => [x, yb + z * cr + t * sr, zb - z * sr + t * cr];
    const fBIns = (x, t, z) => Math.max(Math.abs(x) - (hw - 0.11), -t - 0.005, z - (integrated ? H - 0.02 : H - 0.04), 0.06 - z);
    let [bIns, bSide] = split(back, fBIns, 0.002);
    const toWorld = (p) => warp(p, (x, y, z) => place2(-x, y, z), false);
    const fixN = (p) => { // rotate normals with the recline (warp without renormal keeps the loft's normals)
      const v = p.v;
      for (let i = 0; i < v.length; i += 8) { const nx = v[i + 3], nt = v[i + 4], nz = v[i + 5]; v[i + 3] = -nx; v[i + 4] = nz * cr + nt * sr; v[i + 5] = -nz * sr + nt * cr; }
      return p;
    };
    const bI = fixN(toWorld(mergePatches([bIns, roll(bIns, { r: 0.002, depth: 0.004 })])));
    const bS = fixN(toWorld(mergePatches([bSide, roll(bSide, { r: 0.002, depth: 0.004 })])));
    g.add(meshOf([uvProject(bI, 'z', 1)], insert));
    g.add(meshOf([uvProject(bS, 'x', 1)], side));
    if (o.harness && integrated) {
      for (const sx of [1, -1]) { const slot = new THREE.Mesh(roundedBox(0.05, 0.012, 0.09, 0.005, 1), M.plastic(0x050505, 0.8)); const p = place2(sx * 0.085, 0.0, H + 0.02); slot.position.set(...p); slot.rotation.x = -rec + Math.PI / 2; g.add(slot); }
    }
    // separate headrest on two posts
    if (o.headrest === 'separate' || o.headrest == null) {
      const hr = loft([{ z: -0.12, pts: [[0, -0.05, 0.02], [0.12, -0.045, 0.04], [0.13, 0, 0.03], [0.12, 0.05, 0.04], [0, 0.055, 0.1]] }, { z: 0, pts: [[0, -0.055, 0.02], [0.13, -0.05, 0.045], [0.14, 0, 0.03], [0.13, 0.055, 0.045], [0, 0.06, 0.1]] }, { z: 0.11, pts: [[0, -0.045, 0.02], [0.11, -0.04, 0.04], [0.12, 0, 0.03], [0.11, 0.045, 0.04], [0, 0.05, 0.1]] }],
        { fillet: [2, 3, 3, 3, 3], seg: [2, 1, 1, 2], rows: 10, capRear: { dome: 0.02, rings: 4 }, capFront: { dome: 0.03, rings: 4 } }).patch;
      // local loft: x lateral, y = forward, z = up; place above the backrest top
      const hrW = warp(hr, (x, y, z) => place2(-x, y + 0.005, H + 0.17 + z), true);
      g.add(meshOf([hrW], side));
      for (const sx of [1, -1]) { const post = new THREE.Mesh(cylinderZ(0.0055, 0.16, 8), M.chrome()); const p = place2(sx * 0.07, -0.01, H + 0.04); post.position.set(...p); post.rotation.x = -rec + Math.PI / 2; g.add(post); }
    }
    // back shell (sport seats) and base: rails, side covers, recline lever
    if (o.shell) {
      const sh = offset(mergePatches([bSide]), 0.004);
      void sh;
    }
    const base = [];
    for (const sx of [1, -1]) base.push(place(roundedBox(0.03, 0.03, L * 0.9, 0.008, 1), [sx * (hw - 0.08), -0.005, 0.0]));
    base.push(place(roundedBox(w - 0.04, 0.05, L * 0.75, 0.015, 1), [0, 0.03, -0.02]));
    g.add(new THREE.Mesh(merge(base), M.plastic(0x0d0d0e, 0.6)));
    const cover = new THREE.Mesh(roundedBox(0.012, 0.09, 0.2, 0.006, 1), M.plastic(o.trim ?? 0x18181a, 0.55));
    cover.position.set(hw + 0.004, h * 0.45, -L / 2 + 0.1);
    const lever = new THREE.Mesh(roundedBox(0.012, 0.022, 0.1, 0.006, 1), M.plastic(0x101011, 0.4));
    lever.position.set(hw + 0.014, h * 0.55, -L / 2 + 0.1);
    lever.rotation.x = 0.25;
    g.add(cover, lever);
    void pip;
    g.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    if (o.pos) g.position.set(...o.pos);
    return g;
  };

  /**
   * Detailed steering wheel. Root at the hub centre, tilted (top away from the driver); the inner group spins
   * about its local Z (registered for the runtime). style: '80s3' | 'sport3' | 'flat'.
   * o: { pos, radius, tilt, grip (mat), spoke (mat), pad (mat), accent (mat or null), emblem (mesh fn), column (len) }
   */
  I.wheel2 = (o = {}) => {
    const root = new THREE.Group();
    root.position.set(...(o.pos ?? [0.37, 0.88, 0.1]));
    root.rotation.x = (o.tilt ?? 24) * D2R;
    const flipG = new THREE.Group(); flipG.rotation.y = Math.PI; // local +z faces the driver after the flip
    root.add(flipG);
    const wheel = new THREE.Group();
    flipG.add(wheel);
    const R = o.radius ?? 0.185, style = o.style ?? 'sport3';
    const grip = o.grip ?? M.leather(0x151515), spokeM = o.spoke ?? M.plastic(0x1a1a1c, 0.45), padM = o.pad ?? M.plastic(0x141416, 0.6);
    // rim: sweep around a circle (flattened at the bottom for 'flat'), thicker at 10 and 2 o'clock
    const n = Math.max(32, Math.round(72 * kit.detail));
    const path = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let x = Math.cos(a) * R, y = Math.sin(a) * R;
      if (style === 'flat' && y < -R * 0.8) y = -R * 0.8 + (y + R * 0.8) * 0.18;
      path.push([x, y, 0]);
    }
    const thick = (s) => { const a = s * Math.PI * 2; return 1 + 0.12 * Math.max(0, Math.cos(2 * (a - Math.PI / 2)) * (Math.sin(a) > 0 ? 1 : 0.2)); };
    const rimP = sweep(path, (s) => { const k = thick(s); const rr = 0.0145 * k, rz = 0.018 * k; const pts = []; for (let j = 0; j < 10; j++) { const t = (j / 10) * Math.PI * 2; pts.push([Math.cos(t) * rr, Math.sin(t) * rz]); } return pts; }, { closed: true, up: [0, 0, 1], profileClosed: true });
    wheel.add(meshOf([rimP], grip));
    if (o.accent) { const mk = new THREE.Mesh(roundedBox(0.014, 0.034, 0.038, 0.004, 1), o.accent); mk.position.set(0, R, 0); wheel.add(mk); }
    // spokes: swept flat ovals from the hub to the rim (dished: hub sits back)
    const dish = style === '80s3' ? 0.045 : style === 'flat' ? 0.012 : 0.03;
    const spokeAt = (a, w0, w1, t0 = 0.012) => {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; const r = 0.045 + (R - 0.05) * t; pts.push([Math.cos(a) * r, Math.sin(a) * r, -dish * (1 - t) ** 1.5]); }
      return sweep(pts, (s) => { const w = w0 + (w1 - w0) * s; return [[-w / 2, -t0 / 2], [w / 2, -t0 / 2], [w / 2 + 0.002, 0], [w / 2, t0 / 2], [-w / 2, t0 / 2], [-w / 2 - 0.002, 0]]; }, { up: [0, 0, 1], profileClosed: true, capStart: true, capEnd: true });
    };
    const spokes = [];
    if (style === '80s3') { spokes.push(spokeAt(0, 0.07, 0.05), spokeAt(Math.PI, 0.07, 0.05), spokeAt(-Math.PI / 2, 0.06, 0.04)); }
    else if (style === 'sport3') { spokes.push(spokeAt(0, 0.05, 0.03, 0.009), spokeAt(Math.PI, 0.05, 0.03, 0.009), spokeAt(-Math.PI / 2, 0.045, 0.028, 0.009)); }
    else { spokes.push(spokeAt(0.12, 0.06, 0.035), spokeAt(Math.PI - 0.12, 0.06, 0.035), spokeAt(-Math.PI / 2, 0.05, 0.03)); }
    wheel.add(meshOf(spokes, spokeM));
    // hub / horn pad
    if (style === '80s3') {
      const pad = loft([{ z: -0.02, pts: [[0, -0.065, 0.02], [0.1, -0.06, 0.03], [0.115, 0.0, 0.03], [0.1, 0.05, 0.03], [0, 0.058, 0.1]] }, { z: 0.035, pts: [[0, -0.06, 0.02], [0.095, -0.055, 0.03], [0.11, 0.0, 0.035], [0.095, 0.048, 0.035], [0, 0.055, 0.1]] }],
        { fillet: [2, 3, 4, 4, 3], seg: [3, 2, 2, 3], rows: 6, capRear: { dome: 0.0, rings: 3 }, capFront: { dome: 0.012, rings: 5 } }).patch;
      wheel.add(meshOf([pad], padM));
    } else if (style === 'sport3') {
      const hub = new THREE.Mesh(latheZ([[0.05, -0.04], [0.052, 0.0], [0.046, 0.012], [0.0, 0.016]], 28), padM);
      wheel.add(hub);
    } else {
      const pad = loft([{ z: -0.03, pts: [[0, -0.06, 0.02], [0.075, -0.05, 0.04], [0.085, 0.0, 0.03], [0.07, 0.05, 0.04], [0, 0.055, 0.1]] }, { z: 0.03, pts: [[0, -0.055, 0.02], [0.07, -0.045, 0.04], [0.08, 0.0, 0.03], [0.065, 0.048, 0.04], [0, 0.052, 0.1]] }],
        { fillet: [2, 3, 4, 4, 3], seg: [3, 2, 2, 3], rows: 6, capRear: { dome: 0.0, rings: 3 }, capFront: { dome: 0.01, rings: 5 } }).patch;
      wheel.add(meshOf([pad], padM));
      // spoke buttons and paddles (paddles fixed to the wheel)
      for (const sx of [1, -1]) {
        for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(roundedBox(0.012, 0.01, 0.004, 0.002, 1), M.plastic(0x2a2b2e, 0.3)); b.position.set(sx * (0.095 + k * 0.014), 0.01 - k * 0.004, 0.009); wheel.add(b); }
        const pdl = new THREE.Mesh(extrude([[0, -0.02], [0.06, -0.035], [0.075, 0.0], [0.06, 0.035], [0, 0.03]], 0.004, { axis: 'z', bevel: 0.0015 }), o.paddle ?? M.metal(0xb0b2b6, 0.25));
        pdl.position.set(sx * 0.13, 0.02, -0.03); pdl.scale.x = sx;
        wheel.add(pdl);
      }
    }
    if (o.emblem) { const e = o.emblem(); e.position.z = style === '80s3' ? 0.05 : style === 'flat' ? 0.042 : 0.018; wheel.add(e); }
    // column shroud and stalks (static, part of root, behind the wheel = local -z after the flip -> +z in root)
    const colLen = o.column ?? 0.26;
    const col = new THREE.Mesh(latheZ([[0.03, 0.0], [0.042, 0.04], [0.05, colLen * 0.5], [0.055, colLen]], 20), o.columnMat ?? M.plastic(0x18181a, 0.6));
    col.position.z = 0.03;
    root.add(col);
    for (const sx of [1, -1]) {
      const st = new THREE.Mesh(tube([[0, 0, 0], [sx * 0.08, 0.005, -0.01], [sx * 0.15, 0.02, -0.03]], 0.0065, 8, 6), M.plastic(0x101011, 0.45));
      st.position.set(sx * 0.04, 0.0, 0.07);
      root.add(st);
    }
    kit._steering = { object: wheel };
    root.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    return root;
  };

  /** Rectangular or round air vent with slats. o: { pos, size: [w, h], round, depth, rot: [rx, ry, rz], slats, bezel (mat) } */
  I.vent = (o = {}) => {
    const g = new THREE.Group();
    const [w, h] = o.size ?? [0.12, 0.05], d = o.depth ?? 0.04;
    const bez = o.bezel ?? M.plastic(0x141416, 0.4), dark = M.plastic(0x050505, 0.9);
    if (o.round) {
      const r = w / 2;
      g.add(new THREE.Mesh(latheZ([[r * 0.82, -d], [r * 0.82, 0.0], [r * 0.92, 0.004], [r * 1.04, 0.002], [r * 1.06, -0.004]], 24), bez));
      const back = new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 20), dark); back.position.z = -d; g.add(back);
      const sl = [];
      for (let i = -2; i <= 2; i++) sl.push(place(box(r * 1.5 * Math.sqrt(1 - (i / 3) ** 2), 0.003, d * 0.6), [0, i * r * 0.3, -d * 0.4], [0.3, 0, 0]));
      g.add(new THREE.Mesh(merge(sl), bez));
    } else {
      const frame = extrude([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], d, { axis: 'z', bevel: 0.004 });
      const rim = new THREE.Mesh(frame, bez); rim.position.z = -d / 2 + 0.002; rim.scale.set(1, 1, 1);
      // hollow look: dark recess in front of the frame block
      const rec = new THREE.Mesh(box(w - 0.012, h - 0.012, 0.004), dark); rec.position.z = 0.001;
      g.add(rim, rec);
      const sl = [];
      const ns = o.slats ?? Math.max(3, Math.round(h / 0.012));
      for (let i = 0; i < ns; i++) sl.push(place(box(w - 0.016, 0.0025, 0.016), [0, -h / 2 + 0.006 + (i + 0.5) * ((h - 0.012) / ns), 0.006], [-0.35, 0, 0]));
      sl.push(place(box(0.004, h - 0.014, 0.01), [w * 0.15, 0, 0.012]));
      g.add(new THREE.Mesh(merge(sl), M.plastic(0x1c1c1e, 0.45)));
    }
    if (o.pos) g.position.set(...o.pos);
    if (o.rot) g.rotation.set(...o.rot);
    return g;
  };
  /** Rotary knob (HVAC, radio). */
  I.knob = ({ pos, r = 0.018, len = 0.02, mat = null, rot = [0, 0, 0] } = {}) => {
    const k = new THREE.Mesh(latheZ([[r * 0.9, 0], [r, 0.002], [r, len * 0.8], [r * 0.85, len], [0, len]], 20), mat ?? M.plastic(0x1a1a1c, 0.4));
    k.position.set(...pos); k.rotation.set(...rot);
    return k;
  };
  /** Manual gearbox lever: gaiter, stick, knob with shift pattern. type: 'h' | 'seq' | 'short' */
  I.shifter2 = ({ pos = [0, 0.45, 0], type = 'h', knob = 'ball', gears = 5, lean = 0.12, boot = null, knobMat = null } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    const bootM = boot ?? M.leather(0x141414);
    const gaiter = new THREE.Mesh(latheZ([[0.07, 0], [0.06, 0.02], [0.035, 0.06], [0.018, 0.1], [0.012, 0.11]], 18), bootM);
    gaiter.rotation.x = -Math.PI / 2;
    g.add(gaiter);
    const top = type === 'short' ? 0.15 : 0.2;
    g.add(new THREE.Mesh(tube([[0, 0.1, 0], [0, top * 0.6, -lean * 0.06], [0, top, -lean * 0.12]], 0.008, 10, 8), M.chrome()));
    let k;
    if (knob === 'ball') k = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), knobMat ?? M.surface({ color: 0x111111, roughness: 0.3, metalness: 0.2 }));
    else if (knob === 'tall') k = new THREE.Mesh(latheZ([[0.012, -0.03], [0.02, -0.02], [0.022, 0.02], [0.016, 0.035], [0, 0.04]], 18), knobMat ?? M.leather(0x151515));
    else k = new THREE.Mesh(roundedBox(0.035, 0.07, 0.05, 0.012, 2), knobMat ?? M.plastic(0x1a1a1a, 0.4));
    if (knob === 'tall') k.rotation.x = -Math.PI / 2;
    k.position.set(0, top + 0.016, -lean * 0.12 - 0.004);
    g.add(k);
    if (type !== 'seq') {
      // engraved shift pattern on the knob top
      const c = makeCanvas(128, 128), gg = c.getContext('2d');
      gg.fillStyle = '#000'; gg.fillRect(0, 0, 128, 128);
      gg.strokeStyle = '#e8e2d0'; gg.lineWidth = 5; gg.fillStyle = '#e8e2d0'; gg.font = `700 22px ${FONT_UI}`; gg.textAlign = 'center';
      const cols = Math.ceil(gears / 2) + 1;
      gg.beginPath(); gg.moveTo(24, 64); gg.lineTo(104, 64);
      for (let i = 0; i < cols; i++) { const x = 24 + (80 * i) / (cols - 1); gg.moveTo(x, 34); gg.lineTo(x, 94); }
      gg.stroke();
      for (let i = 1; i <= gears; i++) { const col = Math.floor((i - 1) / 2), x = 24 + (80 * col) / (cols - 1); gg.fillText(String(i), x, i % 2 ? 26 : 118); }
      gg.fillText('R', 104, gears % 2 ? 26 : 118);
      const t = canvasTexture(c, { repeat: false });
      const lab = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), M.surface({ color: 0xffffff, map: t, roughness: 0.4, transparent: true, alphaTest: 0.3 }));
      lab.material.alphaMap = t;
      lab.rotation.x = -Math.PI / 2; lab.position.set(0, top + (knob === 'ball' ? 0.04 : 0.047), -lean * 0.12 - 0.004);
      g.add(lab);
    }
    return g;
  };
  /** Handbrake lever between the seats. */
  I.handbrake = ({ pos = [0, 0.42, -0.3], hydro = false, mat = null } = {}) => {
    const g = new THREE.Group(); g.position.set(...pos);
    if (hydro) {
      const lev = new THREE.Mesh(tube([[0, 0, 0.05], [0, 0.18, 0.0], [0, 0.32, -0.04]], 0.011, 12, 8), M.metal(0xb8babd, 0.25));
      const grip = new THREE.Mesh(cylinderZ(0.016, 0.1, 12), M.leather(0x101010)); grip.position.set(0, 0.3, -0.035); grip.rotation.x = -1.2;
      const base = new THREE.Mesh(roundedBox(0.06, 0.05, 0.12, 0.01, 1), M.metal(0x2a2b2e, 0.4)); base.position.set(0, 0.0, 0.05);
      g.add(lev, grip, base);
    } else {
      const lev = new THREE.Mesh(extrude([[0, 0], [0.26, 0.05], [0.28, 0.085], [0.0, 0.04]], 0.03, { axis: 'x', bevel: 0.006 }), mat ?? M.plastic(0x141416, 0.5));
      lev.rotation.y = Math.PI; lev.position.set(0, 0, 0.02);
      const btn = new THREE.Mesh(cylinderZ(0.008, 0.012, 10), M.chrome()); btn.position.set(0, 0.07, -0.275);
      g.add(lev, btn);
    }
    return g;
  };
  /** Pedal box: clutch, brake, throttle (organ or hanging). */
  I.pedals2 = ({ pos = [0.37, 0.3, 0.5], sport = false, clutch = true } = {}) => {
    const g = new THREE.Group(); g.position.set(...pos);
    const padM = sport ? M.metal(0xb6b8bc, 0.3) : M.rubber();
    const armM = M.metal(0x2a2b2e, 0.5);
    const list = clutch ? [[0.14, 0.075, 0.085], [0.025, 0.08, 0.085], [-0.1, 0.05, 0.11]] : [[0.05, 0.12, 0.085], [-0.1, 0.05, 0.11]];
    list.forEach(([x, w, hh], i) => {
      const last = i === list.length - 1;
      const pad = new THREE.Mesh(roundedBox(w, hh, 0.012, 0.006, 2), padM);
      pad.position.set(x, 0, 0); pad.rotation.x = -0.45;
      const arm = new THREE.Mesh(tube([[x, 0.02, 0.02], [x, 0.2, 0.09], [x, last ? 0.33 : 0.3, 0.12]], 0.007, 8, 6), armM);
      g.add(pad, arm);
      if (sport) { const ribs = []; for (let k = -2; k <= 2; k++) ribs.push(place(box(w * 0.8, 0.004, 0.003), [x, k * hh * 0.17, 0.007])); const rb = new THREE.Mesh(merge(ribs), M.rubber()); rb.rotation.x = -0.45; rb.position.y = 0; g.add(rb); }
    });
    const rest = new THREE.Mesh(roundedBox(0.07, 0.16, 0.012, 0.004, 1), sport ? padM : M.rubber());
    rest.position.set(0.27, -0.02, -0.02); rest.rotation.x = -0.6;
    g.add(rest);
    return g;
  };
  return I;
}

// ---- gauge drawing ---------------------------------------------------------------------------
function drawCluster(st, tel, now, units = 'kmh', force = false) {
  if (!force && now - st.last < 33) return;
  st.last = now;
  const g = st.canvas.getContext('2d');
  if (st.type === 'analog3') drawAnalog3(g, st, tel, units);
  else if (st.type === 'rally') drawRally(g, st, tel, units);
  else if (st.type === 'tft') drawTFT(g, st, tel, units);
  else drawClassic(g, st, tel, units);
  st.tex.needsUpdate = true;
}
const spd = (tel, units) => (units === 'mph' ? (tel.speed || 0) * 2.237 : (tel.speed || 0) * 3.6);
const maxSpd = (st, units) => (units === 'mph' ? Math.round(st.maxSpeed * 0.62 / 20) * 20 : st.maxSpeed);
/** Generic needle dial. o: { a0, a1 (radians), majors, minors, step, red (0..1 start), face, ink, needle, label, sub, numScale, numR } */
function dial2(g, cx, cy, r, f, o) {
  const a0 = o.a0 ?? Math.PI * 0.75, a1 = o.a1 ?? Math.PI * 2.25;
  if (o.face) { g.fillStyle = o.face; g.beginPath(); g.arc(cx, cy, r * 1.06, 0, Math.PI * 2); g.fill(); }
  if (o.ring) { g.strokeStyle = o.ring; g.lineWidth = r * 0.035; g.beginPath(); g.arc(cx, cy, r * 1.05, 0, Math.PI * 2); g.stroke(); }
  if (o.red != null && o.red < 1) { g.strokeStyle = o.redColor || '#d8321f'; g.lineWidth = r * 0.1; g.beginPath(); g.arc(cx, cy, r * 0.9, a0 + (a1 - a0) * o.red, a1); g.stroke(); }
  const maj = o.majors, mi = o.minors ?? 4;
  g.strokeStyle = o.ink; g.fillStyle = o.ink; g.lineCap = 'butt';
  for (let i = 0; i <= maj * mi; i++) {
    const a = a0 + (a1 - a0) * (i / (maj * mi));
    const big = i % mi === 0;
    g.lineWidth = r * (big ? 0.035 : 0.016);
    const r0 = r * (big ? 0.82 : 0.88);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97); g.stroke();
  }
  g.font = `${o.numWeight ?? 600} ${r * (o.numScale ?? 0.2)}px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i <= maj; i++) {
    if (o.every && i % o.every) continue;
    const a = a0 + (a1 - a0) * (i / maj);
    g.fillText(String(i * (o.step ?? 1)), cx + Math.cos(a) * r * (o.numR ?? 0.66), cy + Math.sin(a) * r * (o.numR ?? 0.66));
  }
  if (o.label) { g.font = `500 ${r * 0.11}px ${FONT_UI}`; g.fillStyle = o.sub || o.ink; g.fillText(o.label, cx, cy - r * 0.34); }
  const a = a0 + (a1 - a0) * Math.max(0, Math.min(1.02, f));
  g.lineCap = 'round';
  g.strokeStyle = o.needle; g.lineWidth = r * 0.045;
  g.beginPath(); g.moveTo(cx - Math.cos(a) * r * 0.16, cy - Math.sin(a) * r * 0.16); g.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93); g.stroke();
  if (o.tip) { g.strokeStyle = o.tip; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72); g.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93); g.stroke(); }
  g.fillStyle = o.cap || '#18181a'; g.beginPath(); g.arc(cx, cy, r * 0.11, 0, Math.PI * 2); g.fill();
  g.lineCap = 'butt'; g.textBaseline = 'alphabetic';
}
/** 1980s: small fuel/temp stack, big centre tach, speedo; warm white ink on black, orange needles. */
function drawAnalog3(g, st, tel, units) {
  const { W, H } = st;
  g.fillStyle = '#060607'; g.fillRect(0, 0, W, H);
  const ink = '#f1e7d2', needle = '#ff7a1a';
  const rT = H * 0.46, rS = H * 0.4, rs = H * 0.2;
  const cxT = W * 0.47, cxS = W * 0.8, cxL = W * 0.14, cy = H * 0.52;
  const maxR = st.maxRpm / 1000;
  dial2(g, cxT, cy, rT, (tel.rpm || 0) / st.maxRpm, { majors: maxR, minors: 5, red: st.redline / st.maxRpm, ink, needle, tip: '#ffffff', label: 'x1000r/min', numScale: 0.19, a0: Math.PI * 0.72, a1: Math.PI * 2.28 });
  const ms = maxSpd(st, units);
  dial2(g, cxS, cy, rS, spd(tel, units) / ms, { majors: ms / 20, minors: 2, ink, needle, tip: '#ffffff', label: units === 'mph' ? 'MPH' : 'km/h', every: 2, step: 20, numScale: 0.17, a0: Math.PI * 0.72, a1: Math.PI * 2.28 });
  // fuel and temperature (static, mid-tank and warm)
  const small = (cy2, f, l, r0) => {
    const a0 = Math.PI * 1.15, a1 = Math.PI * 1.85;
    g.strokeStyle = ink; g.lineWidth = 2;
    g.beginPath(); g.arc(cxL, cy2 + rs * 0.6, rs, a0, a1); g.stroke();
    g.font = `600 ${rs * 0.32}px ${FONT_UI}`; g.fillStyle = ink; g.textAlign = 'center';
    g.fillText(l[0], cxL + Math.cos(a0) * rs * 1.18, cy2 + rs * 0.6 + Math.sin(a0) * rs * 1.18);
    g.fillText(l[1], cxL + Math.cos(a1) * rs * 1.18, cy2 + rs * 0.6 + Math.sin(a1) * rs * 1.18);
    if (r0) { g.strokeStyle = '#d8321f'; g.lineWidth = 4; g.beginPath(); g.arc(cxL, cy2 + rs * 0.6, rs * 0.92, a1 - 0.12, a1); g.stroke(); }
    const a = a0 + (a1 - a0) * f;
    g.strokeStyle = needle; g.lineWidth = 3; g.beginPath(); g.moveTo(cxL, cy2 + rs * 0.6); g.lineTo(cxL + Math.cos(a) * rs * 1.02, cy2 + rs * 0.6 + Math.sin(a) * rs * 1.02); g.stroke();
  };
  small(H * 0.12, 0.72, ['E', 'F'], false);
  small(H * 0.56, 0.48, ['C', 'H'], true);
  // odometer drum and gear in the speedo / tach
  g.fillStyle = '#121214'; g.fillRect(cxS - rS * 0.38, cy + rS * 0.34, rS * 0.76, rS * 0.2);
  g.font = `600 ${rS * 0.16}px ${FONT_UI}`; g.fillStyle = ink; g.textAlign = 'center';
  g.fillText('086 412', cxS, cy + rS * 0.5);
  g.fillStyle = needle; g.font = `700 ${rT * 0.26}px ${FONT_UI}`;
  g.fillText(gearLabel(tel.gear), cxT, cy + rT * 0.62);
  // warning lamp row
  const lamps = ['#c0391b', '#d39a1a', '#3a9a3a', '#2f6fd0'];
  lamps.forEach((c, i) => { g.fillStyle = c + '55'; g.fillRect(W * 0.3 + i * W * 0.035, H * 0.93, W * 0.022, H * 0.04); });
}
/** Rally sedan: white-faced centre tach with red needle, speedo left, boost and temps right. */
function drawRally(g, st, tel, units) {
  const { W, H } = st;
  g.fillStyle = '#08090b'; g.fillRect(0, 0, W, H);
  const rT = H * 0.47, rS = H * 0.38, cy = H * 0.52;
  const cxT = W * 0.5, cxS = W * 0.2, cxB = W * 0.8;
  dial2(g, cxT, cy, rT, (tel.rpm || 0) / st.maxRpm, { face: '#e9e7e1', ring: '#9a9da3', majors: st.maxRpm / 1000, minors: 5, red: st.redline / st.maxRpm, ink: '#151515', needle: '#e0251b', label: 'x1000r/min', sub: '#555', numScale: 0.2, numWeight: 700, cap: '#202022' });
  // digital speed + gear inside the tach
  const s = Math.round(spd(tel, units));
  g.fillStyle = '#111316'; g.fillRect(cxT - rT * 0.32, cy + rT * 0.3, rT * 0.64, rT * 0.32);
  g.fillStyle = '#ff4b2b'; g.font = `700 ${rT * 0.24}px ${FONT_UI}`; g.textAlign = 'center';
  g.fillText(String(s), cxT, cy + rT * 0.54);
  g.fillStyle = '#ffffff'; g.font = `800 ${rT * 0.3}px ${FONT_UI}`; g.fillText(gearLabel(tel.gear), cxT, cy - rT * 0.06);
  const ms = maxSpd(st, units);
  dial2(g, cxS, cy, rS, spd(tel, units) / ms, { face: '#e9e7e1', ring: '#9a9da3', majors: ms / 20, minors: 2, ink: '#151515', needle: '#e0251b', label: units === 'mph' ? 'MPH' : 'km/h', every: 2, step: 20, numScale: 0.17, sub: '#555', cap: '#202022' });
  // boost gauge (bar), -1..+1.5
  const bmax = tel.boostMax || 1.2, b = Math.max(-0.6, Math.min(1.6, tel.boost || 0));
  dial2(g, cxB, cy, rS, (b + 1) / 2.6, { face: '#e9e7e1', ring: '#9a9da3', majors: 5, minors: 2, ink: '#151515', needle: '#e0251b', label: 'BOOST x100kPa', sub: '#555', numScale: 0.0001, cap: '#202022', a0: Math.PI * 0.8, a1: Math.PI * 2.2 });
  g.fillStyle = '#151515'; g.font = `700 ${rS * 0.17}px ${FONT_UI}`; g.textAlign = 'center';
  ['-1', '0', '+1'].forEach((t, i) => { const a = Math.PI * 0.8 + Math.PI * 1.4 * ([0, 1, 2][i] / 2.6); g.fillText(t, cxB + Math.cos(a) * rS * 0.62, cy + Math.sin(a) * rS * 0.62 + rS * 0.05); });
  void bmax;
}
/** Modern TFT: tach arc with segments, big speed, gear, info strip; colours from the accent. */
function drawTFT(g, st, tel, units) {
  const { W, H } = st, acc = st.accent;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#07080a'); grd.addColorStop(1, '#0d0f13');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const rpmF = Math.min(1, (tel.rpm || 0) / st.maxRpm), red = st.redline / st.maxRpm;
  // tach: a wide arc across the top
  const cx = W * 0.5, cy = H * 1.55, r = H * 1.32;
  const a0 = Math.PI * 1.32, a1 = Math.PI * 1.68;
  const segs = 64;
  for (let i = 0; i < segs; i++) {
    const t = i / segs, a = a0 + (a1 - a0) * t, b = a0 + (a1 - a0) * ((i + 0.8) / segs);
    g.strokeStyle = t < rpmF ? (t > red ? '#ff3b2a' : t > red - 0.12 ? '#ffd23a' : acc) : t > red ? '#3a1512' : '#1c1f24';
    g.lineWidth = H * 0.085;
    g.beginPath(); g.arc(cx, cy, r, a, b); g.stroke();
  }
  g.fillStyle = '#9aa0aa'; g.font = `600 ${H * 0.07}px ${FONT_UI}`; g.textAlign = 'center';
  const k = Math.ceil(st.maxRpm / 1000);
  for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * (i / k); g.fillText(String(i), cx + Math.cos(a) * (r - H * 0.13), cy + Math.sin(a) * (r - H * 0.13)); }
  // speed and gear
  g.fillStyle = '#f2f4f7'; g.font = `700 ${H * 0.36}px ${FONT_UI}`; g.textAlign = 'center';
  g.fillText(String(Math.round(spd(tel, units))), cx, H * 0.72);
  g.fillStyle = '#7d8590'; g.font = `600 ${H * 0.07}px ${FONT_UI}`; g.fillText(units === 'mph' ? 'MPH' : 'KM/H', cx, H * 0.82);
  g.fillStyle = acc; g.font = `800 ${H * 0.22}px ${FONT_UI}`; g.fillText(gearLabel(tel.gear), W * 0.3, H * 0.66);
  g.fillStyle = '#7d8590'; g.font = `600 ${H * 0.06}px ${FONT_UI}`; g.fillText('GEAR', W * 0.3, H * 0.75);
  // right block: oil / water bars
  const bar = (y, f, l) => { g.fillStyle = '#1c1f24'; g.fillRect(W * 0.66, y, W * 0.14, H * 0.03); g.fillStyle = acc; g.fillRect(W * 0.66, y, W * 0.14 * f, H * 0.03); g.fillStyle = '#7d8590'; g.textAlign = 'left'; g.fillText(l, W * 0.81, y + H * 0.03); };
  g.font = `600 ${H * 0.055}px ${FONT_UI}`;
  bar(H * 0.56, 0.62, 'OIL'); bar(H * 0.64, 0.55, 'H2O'); bar(H * 0.72, 0.8, 'FUEL');
  // bottom strip
  g.fillStyle = '#14171c'; g.fillRect(0, H * 0.88, W, H * 0.12);
  g.fillStyle = '#c9ced6'; g.font = `600 ${H * 0.06}px ${FONT_UI}`; g.textAlign = 'left';
  g.fillText('SPORT +', W * 0.04, H * 0.96);
  g.textAlign = 'right'; g.fillText('27°C   12 486 km', W * 0.96, H * 0.96);
  g.textAlign = 'center'; g.fillStyle = acc; g.fillText('●  LAUNCH READY', W * 0.5, H * 0.96);
}
function drawClassic(g, st, tel, units) {
  const { W, H } = st;
  g.fillStyle = '#050506'; g.fillRect(0, 0, W, H);
  const acc = st.accent;
  if (st.type === 'digital') {
    const rpmF = Math.min(1, (tel.rpm || 0) / st.maxRpm);
    const bars = 40;
    for (let i = 0; i < bars; i++) {
      const on = i / bars < rpmF;
      const red = i / bars > st.redline / st.maxRpm;
      g.fillStyle = on ? (red ? '#ff3b2a' : acc) : '#1d1d20';
      g.fillRect(20 + i * ((W - 40) / bars), 18, (W - 40) / bars - 3, H * 0.18);
    }
    g.fillStyle = '#efe9db'; g.font = `700 ${H * 0.42}px ${FONT_UI}`; g.textAlign = 'center';
    g.fillText(String(Math.round(units === 'mph' ? (tel.speed || 0) * 2.237 : (tel.speed || 0) * 3.6)), W * 0.5, H * 0.82);
    g.fillStyle = acc; g.font = `700 ${H * 0.36}px ${FONT_UI}`;
    g.fillText(gearLabel(tel.gear), W * 0.88, H * 0.82);
  } else {
    const r = Math.min(W * 0.24, H * 0.46);
    dial(g, W * 0.3, H * 0.52, r, (tel.rpm || 0) / st.maxRpm, Math.ceil(st.maxRpm / 1000), st.redline / st.maxRpm, acc, 'x1000');
    const sp = units === 'mph' ? (tel.speed || 0) * 2.237 : (tel.speed || 0) * 3.6;
    const maxS = units === 'mph' ? Math.round(st.maxSpeed * 0.62 / 20) * 20 : st.maxSpeed;
    dial(g, W * 0.7, H * 0.52, r, sp / maxS, maxS / 20, 2, acc, units === 'mph' ? 'mph' : 'km/h', 20);
    g.fillStyle = acc; g.font = `700 ${r * 0.42}px ${FONT_UI}`; g.textAlign = 'center';
    g.fillText(gearLabel(tel.gear), W * 0.3, H * 0.52 + r * 0.62);
    g.fillStyle = '#efe9db'; g.font = `600 ${r * 0.3}px ${FONT_UI}`;
    g.fillText(String(Math.round(sp)), W * 0.7, H * 0.52 + r * 0.62);
    if (tel.boost != null && tel.boostMax) {
      const bf = Math.max(0, Math.min(1, tel.boost / tel.boostMax));
      g.fillStyle = '#1d1d20'; g.fillRect(W * 0.46, H * 0.15, W * 0.08, H * 0.7);
      g.fillStyle = acc; g.fillRect(W * 0.46, H * 0.15 + H * 0.7 * (1 - bf), W * 0.08, H * 0.7 * bf);
    }
  }
}
function dial(g, cx, cy, r, f, majors, red, acc, label, step = 1) {
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  g.lineWidth = r * 0.04; g.strokeStyle = '#2a2a2e';
  g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
  if (red < 1) { g.strokeStyle = '#d6331f'; g.lineWidth = r * 0.08; g.beginPath(); g.arc(cx, cy, r * 0.94, a0 + (a1 - a0) * red, a1); g.stroke(); }
  g.fillStyle = '#d8d2c4'; g.font = `600 ${r * 0.17}px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i <= majors; i++) {
    const a = a0 + (a1 - a0) * (i / majors);
    g.strokeStyle = '#d8d2c4'; g.lineWidth = r * 0.03;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); g.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98); g.stroke();
    if (majors <= 16 || i % 2 === 0) g.fillText(String(i * step), cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
  }
  g.font = `500 ${r * 0.13}px ${FONT_UI}`; g.fillStyle = '#8d877b'; g.fillText(label, cx, cy - r * 0.32);
  const a = a0 + (a1 - a0) * Math.max(0, Math.min(1.02, f));
  g.strokeStyle = acc; g.lineWidth = r * 0.05; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12); g.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); g.stroke();
  g.fillStyle = '#1b1b1e'; g.beginPath(); g.arc(cx, cy, r * 0.09, 0, Math.PI * 2); g.fill();
  g.textBaseline = 'alphabetic';
}
const gearLabel = (g) => (g === -1 ? 'R' : g === 0 ? 'N' : String(g ?? 1));
