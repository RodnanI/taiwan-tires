// Wheels: tyre (moulded sidewall lettering, tread), rim (barrel, lip, face per style, lug nuts, centre cap, valve)
// and brakes (vented disc spins with the wheel, caliper stays on the hub).
// Local frame: origin = hub centre, axle along +X, outer face towards +X (the runtime mirrors right-side wheels).
import * as THREE from 'three';
import { latheX, merge, place, box, cylinderX, extrude } from './geometry.js';
import { makeCanvas, FONT_UI } from '../../core/canvas.js';
import { canvasTexture, getTextureSet } from '../../render/textures.js';

export const RIM_STYLES = {
  spoke5: { name: '5-spoke', zh: '五幅' },
  mesh: { name: 'Cross mesh', zh: '網狀' },
  multi: { name: '10-spoke', zh: '十幅' },
  dish: { name: 'Deep dish 4-hole', zh: '深唇' },
  turbofan: { name: 'Turbofan', zh: '渦扇' },
  steelie: { name: 'Steelie', zh: '鐵圈' },
  split6: { name: 'Split 6-spoke', zh: '六爪' },
  rays6: { name: 'Forged 6-spoke', zh: '鍛造六幅' },
  eight: { name: 'Classic 8-spoke', zh: '經典八幅' },
  twin5: { name: 'Twin 5-spoke', zh: '雙五幅' },
  y5: { name: 'Y-spoke', zh: 'Y 幅' },
  aero: { name: 'Aero disc', zh: '導流盤' },
};

const texCache = new Map();
/** Sidewall lettering: brand on two sides, size code between (planar uv over the sidewall disc). */
function sidewallTexture(sizeText, brand = 'FORMOSA', model = 'SPORT') {
  const key = `${sizeText}|${brand}|${model}`;
  if (texCache.has(key)) return texCache.get(key);
  const n = 1024, c = makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = '#7f7f7f'; g.fillRect(0, 0, n, n);
  g.translate(n / 2, n / 2);
  const ring = (text, a0, r, size, weight = 700) => {
    g.font = `${weight} ${size}px ${FONT_UI}`; g.fillStyle = '#ffffff';
    const w = g.measureText ? g.measureText(text).width : text.length * size * 0.6;
    const span = w / r;
    let a = a0 - span / 2;
    for (const ch of text) {
      const cw = (g.measureText ? g.measureText(ch).width : size * 0.6) / r;
      g.save(); g.rotate(a + cw / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, -r); g.restore();
      a += cw;
    }
  };
  ring(brand, 0, n * 0.425, n * 0.052, 800);
  ring(brand, Math.PI, n * 0.425, n * 0.052, 800);
  ring(model, Math.PI / 2, n * 0.425, n * 0.03, 700);
  ring(sizeText, -Math.PI / 2, n * 0.425, n * 0.032, 700);
  ring('TUBELESS  ·  RADIAL', Math.PI * 0.22, n * 0.4, n * 0.018, 600);
  ring('MADE IN TAIWAN', Math.PI * 1.22, n * 0.4, n * 0.018, 600);
  const t = canvasTexture(c, { repeat: false, srgb: true });
  texCache.set(key, t);
  return t;
}
/** Tread pattern normal map: circumferential grooves, shoulder blocks and sipes. */
function treadTexture(kind = 'sport') {
  const key = `tread:${kind}`;
  if (texCache.has(key)) return texCache.get(key);
  const n = 256, c = makeCanvas(n, n), g = c.getContext('2d');
  // height map drawn as grey, converted to a normal map by hand
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
  g.fillStyle = '#000000';
  // u = across the tread (0..1), v = around
  const grooves = kind === 'slick' ? [] : [0.3, 0.5, 0.7];
  for (const x of grooves) g.fillRect(x * n - n * 0.022, 0, n * 0.044, n);
  if (kind !== 'slick') {
    for (let i = 0; i < 8; i++) {
      const y = (i / 8) * n;
      g.fillRect(0, y, n * 0.18, n * 0.025);                 // shoulder slots
      g.fillRect(n * 0.82, y + n / 16, n * 0.18, n * 0.025);
      g.save(); g.translate(n * 0.4, y + n / 32); g.rotate(0.5); g.fillRect(-n * 0.06, -1, n * 0.12, 2.2); g.restore();
      g.save(); g.translate(n * 0.6, y + n / 32 + n / 16); g.rotate(-0.5); g.fillRect(-n * 0.06, -1, n * 0.12, 2.2); g.restore();
    }
  }
  let img = null;
  try { img = g.getImageData(0, 0, n, n); } catch { img = null; }
  const out = makeCanvas(n, n), go = out.getContext('2d');
  if (img && img.data && img.data.length === n * n * 4) {
    const h = (x, y) => img.data[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
    const od = go.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * 2.2, dy = (h(x, y - 1) - h(x, y + 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      od.data[i] = (dx / l * 0.5 + 0.5) * 255; od.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; od.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
    }
    go.putImageData(od, 0, 0);
  }
  const t = canvasTexture(out, { repeat: true, srgb: false });
  texCache.set(key, t);
  return t;
}

/** Lathe with custom uvs: profile [[r, x], ...], uvFn(r, x, angle, i) -> [u, v]. Faces outwards for a CCW profile. */
function lathe(profile, seg, uvFn = null) {
  const pos = [], uv = [], idx = [];
  const m = profile.length;
  for (let s = 0; s <= seg; s++) {
    const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < m; i++) {
      const [r, x] = profile[i];
      pos.push(x, ca * r, sa * r);
      const q = uvFn ? uvFn(r, x, a, i, s / seg) : [s / seg, i / (m - 1)];
      uv.push(q[0], q[1]);
    }
  }
  for (let s = 0; s < seg; s++) for (let i = 0; i < m - 1; i++) {
    const a = s * m + i, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * @param o { radius, width, rimRadius?, style, color, lipColor, caliperColor, detail, front, brake (0..3 upgrade
 *            level), lugs (4 | 5), tyreBrand, compound }
 * @param M MaterialFactory
 * @returns { spin: Group, hub: Group }
 */
export function buildWheel(o, M) {
  const R = o.radius ?? 0.32, W = o.width ?? 0.225;
  const rr = o.rimRadius ?? R * 0.66;
  const detail = o.detail ?? 1;
  const seg = Math.max(16, Math.round(48 * detail));
  const spin = new THREE.Group(); spin.name = 'wheel-spin';
  const hub = new THREE.Group(); hub.name = 'wheel-hub';
  const half = W / 2;
  const style = RIM_STYLES[o.style] ? o.style : 'spoke5';

  // ---- tyre: tread band + two sidewalls (separate uvs: tread texture vs moulded lettering)
  const h = R - rr;
  const bw = half * 0.88;                     // bead seat half width (rim flange)
  const sw = half * 1.0;                      // sidewall bulge half width
  const prof = [];                            // inner bead -> outer bead over the crown, [r, x]
  const sideL = [[rr - 0.004, -bw], [rr + h * 0.12, -bw - 0.006], [rr + h * 0.42, -sw], [rr + h * 0.72, -sw + 0.003], [R - h * 0.12, -half * 0.97], [R - h * 0.035, -half * 0.9]];
  const crown = [[R - 0.006, -half * 0.84], [R, -half * 0.74], [R + 0.002, 0], [R, half * 0.74], [R - 0.006, half * 0.84]];
  const sideR = sideL.map(([r, x]) => [r, -x]).reverse();
  const treadKind = o.compound === 'slick' || o.compound === 'drag' ? 'slick' : o.compound === 'offroad' || o.compound === 'rally' ? 'rally' : 'sport';
  // tread band
  const tread = lathe([[R - h * 0.035, -half * 0.9], ...crown, [R - h * 0.035, half * 0.9]], seg + 8, (r, x, a, i, f) => [(x / W) + 0.5, f * Math.round((2 * Math.PI * R) / (W * 0.9))]);
  const treadMat = M.shared(`tyre:tread:${treadKind}`, () => {
    const m = M.surface({ color: 0x1b1b1d, roughness: 0.88, normalMap: M.normalMapsAllowed() ? treadTexture(treadKind) : null });
    if (m.normalScale) m.normalScale.set(1.2, 1.2);
    return m;
  });
  const tyre = new THREE.Mesh(tread, treadMat);
  tyre.castShadow = true;
  spin.add(tyre);
  // sidewalls with lettering (white raised letters for the 'whiteLetter' option, grey moulded otherwise)
  const aspect = Math.round((h / W) * 20) * 5;
  const rimIn = Math.round((rr * 2) / 0.0254);
  const sizeText = `${Math.round(W * 1000 / 5) * 5}/${aspect} R${rimIn}`;
  const swTex = sidewallTexture(sizeText, o.tyreBrand ?? 'FORMOSA', o.tyreModel ?? (treadKind === 'slick' ? 'RACE SLICK' : 'SPORT  R1'));
  const letterGrey = o.whiteLetters ? 0xd9d6cc : 0x2a2a2c;
  const swMat = M.shared(`tyre:side:${sizeText}:${o.tyreBrand}:${o.whiteLetters ? 1 : 0}`, () => {
    // map is a letter mask: mix rubber (black) and letter colour via colour * map (grey base 0x7f -> rubber tone)
    const m = M.surface({ color: 0xffffff, map: swTex, roughness: 0.82 });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 tm = texture2D( map, vMapUv );
          float letter = smoothstep( 0.6, 0.9, tm.r );
          diffuseColor.rgb = mix( vec3( 0.022, 0.022, 0.024 ), vec3( ${((letterGrey >> 16) & 255) / 255 * 0.55}, ${((letterGrey >> 8) & 255) / 255 * 0.55}, ${(letterGrey & 255) / 255 * 0.55} ), letter );
        #endif`);
    };
    m.customProgramCacheKey = () => `sidewall:${letterGrey}`;
    return m;
  });
  for (const sgn of [1, -1]) {
    const pts = sgn > 0 ? sideR : sideL.slice();
    const g = lathe(sgn > 0 ? pts : pts, seg + 8, (r, x, a) => [0.5 + (Math.cos(a) * r) / (2 * R) * (sgn > 0 ? 1 : -1), 0.5 + (Math.sin(a) * r) / (2 * R)]);
    if (sgn < 0) { /* inner sidewall: same winding direction as the band (profile runs bead -> crown) */ }
    const sm = new THREE.Mesh(g, swMat);
    sm.castShadow = true;
    spin.add(sm);
  }

  // ---- rim
  const rimMat = M.shared(`rim:${o.color ?? 0xb9bbc0}:${o.finish || 'std'}`, () => M.surface({ color: o.color ?? 0xb9bbc0, roughness: o.finish === 'matte' ? 0.55 : 0.26, metalness: 0.85, physical: true }));
  const lipMat = o.lipColor != null ? M.surface({ color: o.lipColor, roughness: 0.12, metalness: 1 }) : style === 'dish' ? M.surface({ color: 0xe2e2e2, roughness: 0.1, metalness: 1 }) : rimMat;
  const dishDepth = style === 'dish' ? Math.min(0.075, half * 0.6) : style === 'rays6' || style === 'eight' ? 0.03 : 0.016;
  const faceX = half - dishDepth - 0.012;
  // barrel (inside, seen between the spokes) and flanges
  const barrel = new THREE.Mesh(lathe([[rr * 0.985, half * 0.82], [rr * 0.95, half * 0.7], [rr * 0.93, faceX - 0.02], [rr * 0.93, -half * 0.6], [rr * 0.96, -half * 0.8], [rr * 1.02, -bw - 0.004]], seg), M.shared('rim:barrel', () => M.surface({ color: 0x77797d, roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide })));
  spin.add(barrel);
  const lip = new THREE.Mesh(lathe([[rr * 0.9, faceX + 0.004], [rr * 0.94, half - dishDepth + 0.002], [rr * 0.975, half - 0.01], [rr * 1.04, half - 0.004], [rr * 1.055, half - 0.012], [rr * 1.02, bw]].reverse(), seg), lipMat);
  spin.add(lip);
  const lugs = o.lugs ?? 5;
  const pcd = Math.max(0.05, rr * 0.27);
  const face = buildFace(style, rr * 0.93, faceX, dishDepth, seg, detail, pcd);
  face.computeBoundingBox();
  const faceInner = face.boundingBox.min.x;
  const faceMesh = new THREE.Mesh(face, rimMat);
  faceMesh.castShadow = true;
  spin.add(faceMesh);
  // lug nuts (hex with a chamfer), centre cap with emblem, valve stem
  const nuts = [];
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2 + Math.PI / lugs;
    const n = new THREE.CylinderGeometry(0.0085, 0.0095, 0.018, 6);
    n.rotateZ(Math.PI / 2);
    nuts.push(place(n, [faceX - 0.002, Math.cos(a) * pcd, Math.sin(a) * pcd]));
    const tip = new THREE.CylinderGeometry(0.004, 0.0075, 0.006, 6); tip.rotateZ(-Math.PI / 2);
    nuts.push(place(tip, [faceX + 0.009, Math.cos(a) * pcd, Math.sin(a) * pcd]));
  }
  spin.add(new THREE.Mesh(merge(nuts), M.chrome()));
  const capR = rr * 0.15;
  spin.add(new THREE.Mesh(latheX([[0, faceX + 0.012], [capR * 0.7, faceX + 0.011], [capR, faceX + 0.004], [capR * 1.04, faceX - 0.008]], 24), M.shared('rim:cap', () => M.surface({ color: 0x141416, roughness: 0.25, metalness: 0.4 }))));
  const emb = new THREE.Mesh(new THREE.CircleGeometry(capR * 0.55, 20), M.chrome());
  emb.rotation.y = Math.PI / 2; emb.position.x = faceX + 0.0125;
  spin.add(emb);
  const valve = new THREE.Mesh(cylinderX(0.0035, 0.022, 8), M.shared('rim:valve', () => M.surface({ color: 0x111111, roughness: 0.6 })));
  valve.position.set(faceX - 0.004, rr * 0.86, 0); valve.rotation.z = -0.5;
  spin.add(valve);

  // ---- brakes: vented disc (spins) + caliper (static)
  const lvl = o.brake ?? 0;
  const front = o.front !== false;
  const discR = Math.min(rr * 0.93 - 0.04, R * 0.6) * (front ? 1 : 0.94) * (0.92 + lvl * 0.027);
  const th = front ? 0.012 : 0.009;
  const outerH = 0.028 + lvl * 0.004, innerH = 0.024;
  // the static caliper must clear the spinning spokes: disc as far out as the face allows, never past mid barrel
  const discX = Math.max(-half * 0.45, Math.min(half * 0.1, faceInner - 0.008 - (th / 2 + 0.01 + outerH + 0.005)));
  const rotorMat = M.shared(`rim:rotor:${lvl >= 2 ? 'drilled' : 'plain'}`, () => {
    const m = M.surface({ color: 0x8f9195, roughness: 0.32, metalness: 0.9, map: rotorTexture(lvl >= 2) });
    return m;
  });
  const plates = [];
  for (const dx of [-th * 0.5 - 0.006, th * 0.5 + 0.006]) {
    plates.push(place(latheX([[discR * 0.58, -th / 2], [discR, -th / 2], [discR, th / 2], [discR * 0.58, th / 2]], seg), [discX + dx, 0, 0]));
  }
  const disc = new THREE.Mesh(merge(plates), rotorMat);
  spin.add(disc);
  const vanes = [];
  const nv = Math.max(12, Math.round(30 * detail));
  for (let i = 0; i < nv; i++) { const a = (i / nv) * Math.PI * 2; vanes.push(place(box(0.012, discR * 0.38, 0.005), [discX, Math.cos(a) * discR * 0.79, Math.sin(a) * discR * 0.79], [a + 0.22, 0, 0])); }
  const hat = latheX([[discR * 0.6, discX - th], [discR * 0.48, discX - th], [discR * 0.42, discX + 0.02], [discR * 0.42, faceX - 0.004], [0, faceX - 0.004]], seg);
  spin.add(new THREE.Mesh(merge([...vanes, hat]), M.shared('rim:hat', () => M.surface({ color: 0x4a4b4e, roughness: 0.5, metalness: 0.7 }))));
  // caliper: a curved block hugging the disc edge (rear upper quadrant), pistons bulge on the outside
  const cScale = 1 + lvl * 0.14;
  const calMat = M.shared(`rim:cal:${o.caliperColor ?? 0xb8261f}`, () => M.surface({ color: o.caliperColor ?? 0xb8261f, roughness: 0.34, metalness: 0.15, physical: true }));
  const cal = new THREE.Group();
  const arc = (lvl >= 2 ? 0.9 : 0.62) * cScale;
  const calR0 = discR * 0.66, calR1 = discR + 0.016;
  const body = [];
  const ns = 10;
  const pts = [];
  for (let i = 0; i <= ns; i++) { const a = -arc / 2 + (i / ns) * arc; pts.push([Math.cos(a) * calR1, Math.sin(a) * calR1]); }
  for (let i = ns; i >= 0; i--) { const a = -arc / 2 * 0.86 + (i / ns) * arc * 0.86; pts.push([Math.cos(a) * calR0, Math.sin(a) * calR0]); }
  const outline = pts.map(([y, z]) => [z, y]);
  const outer = extrude(outline, outerH, { axis: 'x', bevel: 0.005, bevelSegments: 2 });
  body.push(place(outer, [discX + th / 2 + 0.006 + outerH / 2 + 0.004, 0, 0]));
  const innerP = extrude(outline, innerH, { axis: 'x', bevel: 0.004, bevelSegments: 1 });
  body.push(place(innerP, [discX - th / 2 - 0.006 - innerH / 2 - 0.004, 0, 0]));
  // bridge over the disc edge
  const bridge = [];
  for (let i = 0; i <= ns; i++) { const a = -arc / 2 + (i / ns) * arc; bridge.push([Math.cos(a) * (calR1 + 0.012), Math.sin(a) * (calR1 + 0.012)]); }
  for (let i = ns; i >= 0; i--) { const a = -arc / 2 + (i / ns) * arc; bridge.push([Math.cos(a) * (calR1 - 0.004), Math.sin(a) * (calR1 - 0.004)]); }
  body.push(place(extrude(bridge.map(([y, z]) => [z, y]), th + 0.012 + outerH + innerH, { axis: 'x', bevel: 0.004, bevelSegments: 1 }), [discX + (outerH - innerH) / 2, 0, 0]));
  cal.add(new THREE.Mesh(merge(body), calMat));
  cal.rotation.x = -0.55 + (front ? 0 : Math.PI * 0.08); // upper rear quadrant
  cal.children.forEach((c) => { c.castShadow = true; });
  hub.add(cal);
  return { spin, hub, radius: R, width: W };
}

/** Rotor face: concentric machining marks, optional cross-drilling (dark holes). */
function rotorTexture(drilled) {
  const key = `rotor:${drilled}`;
  if (texCache.has(key)) return texCache.get(key);
  const n = 512, c = makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = '#b8babd'; g.fillRect(0, 0, n, n);
  g.translate(n / 2, n / 2);
  for (let r = n * 0.29; r < n * 0.5; r += 2) { g.strokeStyle = `rgba(${90 + ((r * 7) % 40)},${92 + ((r * 7) % 40)},${96 + ((r * 7) % 40)},0.5)`; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  if (drilled) {
    g.fillStyle = '#121212';
    for (let i = 0; i < 36; i++) for (let k = 0; k < 3; k++) {
      const a = (i / 36) * Math.PI * 2 + k * 0.05, r = n * (0.34 + k * 0.045);
      g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, n * 0.009, 0, Math.PI * 2); g.fill();
    }
  }
  const t = canvasTexture(c, { repeat: false });
  texCache.set(key, t);
  return t;
}

function buildFace(style, r, x, depth, seg, detail, pcd = 0.05) {
  const parts = [];
  const hubR = Math.max(r * 0.26, pcd + 0.016);
  // hub disc with a raised ring around the lug circle
  parts.push(latheX([[0, x + 0.002], [hubR * 0.62, x + 0.003], [hubR * 0.75, x + 0.006], [hubR * 0.95, x + 0.004], [hubR * 1.1, x - 0.012]], seg));
  /**
   * Spoke from r0 to r1 at angle a: tapered (w0 -> w1), bevelled, dished (outer end deeper by `concave`),
   * thick (along x). curve bends it tangentially (twisted / directional designs).
   */
  const spoke = (a, w0, w1, r0, r1, concave = 0.02, thick = 0.02, curve = 0) => {
    const n = 6, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([-(w0 + (w1 - w0) * t) / 2 + curve * Math.sin(t * Math.PI) * r, r0 + (r1 - r0) * t]); }
    for (let i = n; i >= 0; i--) { const t = i / n; pts.push([(w0 + (w1 - w0) * t) / 2 + curve * Math.sin(t * Math.PI) * r, r0 + (r1 - r0) * t]); }
    const g = extrude(pts, thick, { axis: 'x', bevel: Math.min(0.004, w1 * 0.25), bevelSegments: 2, curveSegments: 1 });
    place(g, [x - thick / 2, 0, 0], [Math.PI / 2 - a, 0, 0]);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i), zz = pos.getZ(i); const rr = Math.hypot(yy, zz); pos.setX(i, pos.getX(i) - concave * Math.max(0, (rr - r0) / (r1 - r0)) ** 1.3); }
    pos.needsUpdate = true; g.computeVertexNormals();
    return g;
  };
  const outerRing = (w, d = 0.012, inset = 0) => latheX([[r * (0.995 - w), x - depth * 0.2 - inset], [r * 0.995, x - depth * 0.2 - inset], [r * 0.995, x - depth * 0.2 - inset - d], [r * (0.995 - w), x - depth * 0.2 - inset - d]], seg);
  switch (style) {
    case 'spoke5': for (let i = 0; i < 5; i++) parts.push(spoke((i / 5) * Math.PI * 2, r * 0.32, r * 0.2, hubR * 0.85, r * 0.99, 0.03, 0.024)); break;
    case 'split6': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(spoke(a - 0.09, r * 0.12, r * 0.075, hubR * 0.9, r * 0.99, 0.035), spoke(a + 0.09, r * 0.12, r * 0.075, hubR * 0.9, r * 0.99, 0.035)); } break;
    case 'multi': for (let i = 0; i < 10; i++) parts.push(spoke((i / 10) * Math.PI * 2, r * 0.13, r * 0.085, hubR * 0.85, r * 0.99, 0.028, 0.02)); break;
    case 'rays6': for (let i = 0; i < 6; i++) parts.push(spoke((i / 6) * Math.PI * 2, r * 0.17, r * 0.1, hubR * 0.85, r * 0.99, depth * 0.9, 0.018)); parts.push(outerRing(0.06, 0.01)); break;
    case 'eight': for (let i = 0; i < 8; i++) parts.push(spoke((i / 8) * Math.PI * 2, r * 0.2, r * 0.13, hubR * 0.85, r * 0.94, depth * 0.85, 0.022)); parts.push(outerRing(0.09, 0.014)); break;
    case 'twin5': for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(spoke(a - 0.13, r * 0.11, r * 0.07, hubR * 0.9, r * 0.99, 0.03, 0.02, 0.02), spoke(a + 0.13, r * 0.11, r * 0.07, hubR * 0.9, r * 0.99, 0.03, 0.02, -0.02)); } break;
    case 'y5': for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(spoke(a, r * 0.2, r * 0.13, hubR * 0.85, r * 0.6, 0.012, 0.024)); parts.push(spoke(a - 0.2, r * 0.1, r * 0.08, r * 0.52, r * 0.99, 0.03, 0.02), spoke(a + 0.2, r * 0.1, r * 0.08, r * 0.52, r * 0.99, 0.03, 0.02)); } break;
    case 'mesh':
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push(spoke(a + 0.32, r * 0.06, r * 0.05, hubR * 0.9, r * 0.99, 0.018, 0.012), spoke(a - 0.32, r * 0.06, r * 0.05, hubR * 0.9, r * 0.99, 0.018, 0.012)); }
      parts.push(outerRing(0.08, 0.008));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push(place(cylinderX(0.0045, 0.008, 6), [x - 0.012, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9])); }
      break;
    case 'dish': {
      parts.push(latheX([[hubR, x - 0.004], [r * 0.6, x - depth * 0.45], [r * 0.98, x - depth + 0.012]], seg));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; parts.push(place(latheX([[r * 0.12, -0.004], [r * 0.13, 0.004]], 16), [x - depth * 0.42, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5])); }
      break;
    }
    case 'turbofan': {
      parts.push(latheX([[hubR, x], [r * 0.98, x - 0.02]], seg));
      const nb = 16;
      for (let i = 0; i < nb; i++) { const v = box(0.007, r * 0.62, 0.042); v.rotateY(0.55); v.translate(0, r * 0.6, 0); parts.push(place(v, [x + 0.003, 0, 0], [(i / nb) * Math.PI * 2, 0, 0])); }
      break;
    }
    case 'aero': {
      parts.push(latheX([[hubR, x + 0.002], [r * 0.55, x - 0.004], [r * 0.85, x - 0.012], [r * 0.99, x - 0.02]], seg));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(spoke(a + 0.6, r * 0.05, r * 0.08, r * 0.45, r * 0.95, 0.0, 0.006, 0.05)); }
      break;
    }
    case 'steelie': {
      parts.push(latheX([[hubR, x], [r * 0.58, x - 0.01], [r * 0.66, x - 0.026], [r * 0.72, x - 0.03], [r * 0.99, x - 0.036]], seg));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push(place(latheX([[r * 0.06, -0.003], [r * 0.065, 0.003]], 12), [x - 0.028, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66], [0, 0, 0], [1, 1, 1.7])); }
      break;
    }
  }
  return merge(parts);
}
