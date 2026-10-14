// Interior building blocks. Positions are vehicle-local ([x, y, z], +X = left, +Z = forward).
// Things the runtime animates are registered on the kit collector:
//   steeringWheel -> rotates about its local Z (column axis) by steer * lock * ratio
//   cluster       -> live gauges (CanvasTexture redrawn from telemetry)
//   headUnit      -> anchors.screen (the menu is mapped onto it) + in-game display canvas
import * as THREE from 'three';
import { roundedBox, tube, extrude, place, merge, latheZ, box } from './geometry.js';
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
  I.cluster = ({ pos = [0.38, 0.86, 0.6], size = [0.36, 0.13], tilt = 12, type = 'analog2', redline = 7000, maxRpm = 9000, maxSpeed = 260, accent = '#ff9a2e', hood = true } = {}) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.x = -tilt * D2R;
    const W = 512, H = Math.round(512 * (size[1] / size[0]));
    const canvas = makeCanvas(W, H);
    const tex = canvasTexture(canvas, { repeat: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), M.surface({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.25, map: tex, roughness: 0.5 }));
    face.rotation.y = Math.PI; // faces the driver
    g.add(face);
    if (hood) {
      const h = new THREE.Mesh(extrude([[0, 0], [0.12, 0], [0.13, 0.04], [0.02, 0.06]], size[0] + 0.06, { axis: 'x', bevel: 0.01 }), M.plastic(0x141416, 0.7));
      h.position.set(0, size[1] / 2 - 0.01, -0.02);
      g.add(h);
    }
    const state = { canvas, tex, W, H, type, redline, maxRpm, maxSpeed, accent, last: -1, units: 'kmh' };
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

  return I;
}

// ---- gauge drawing ---------------------------------------------------------------------------
function drawCluster(st, tel, now, units = 'kmh', force = false) {
  if (!force && now - st.last < 33) return;
  st.last = now;
  const g = st.canvas.getContext('2d');
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
  st.tex.needsUpdate = true;
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
