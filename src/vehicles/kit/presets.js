// Presets: whole sub-assemblies from a handful of numbers. Good for prototypes and as a starting point;
// detailed cars should replace them with hand-built geometry (see vehicles/AGENTS.md).
import * as THREE from 'three';
import { shell, tube, roundedBox, box, extrude, place, merge } from './geometry.js';

export function makePresets(kit) {
  const { M } = kit;
  const P = {};

  /**
   * Greenhouse: tinted glass shell + painted roof + pillars.
   * zA/zC: windscreen and rear-screen bases at the belt line; zRF/zRR: roof front/rear edge.
   */
  P.cabin = ({ zA = 0.75, zC = -1.0, zRF = 0.15, zRR = -0.55, yBelt = 0.92, yRoof = 1.32, hwBelt = 0.8, hwRoof = 0.62, tint = 0x14191d, pillarColor = null, roofColor = null, bPillar = true } = {}) => {
    const g = new THREE.Group();
    const top = [[zC - 0.02, yBelt + 0.01], [zC + (zRR - zC) * 0.35, yBelt + (yRoof - yBelt) * 0.62], [zRR, yRoof - 0.012], [(zRR + zRF) / 2, yRoof], [zRF, yRoof - 0.012], [zRF + (zA - zRF) * 0.45, yBelt + (yRoof - yBelt) * 0.58], [zA + 0.02, yBelt + 0.01]];
    const half = [[zC, hwBelt * 0.96], [zRR, hwRoof * 1.08], [(zRR + zRF) / 2, hwRoof * 1.1], [zRF, hwRoof * 1.06], [zA, hwBelt * 0.95]];
    const glass = new THREE.Mesh(shell({ top, bottom: yBelt - 0.05, halfWidth: half, shoulder: 0.08, tumble: 0.22, roundTop: 2.6, roundBottom: 8, z0: zC - 0.02, z1: zA + 0.02, segZ: kit.seg(40), segU: kit.seg(10) }), M.glass(tint, 0.62));
    glass.renderOrder = 2;
    g.add(glass);
    const roofMat = roofColor != null ? M.paint(roofColor, 'gloss') : kit.paint;
    const roof = new THREE.Mesh(shell({ top: yRoof + 0.006, bottom: yRoof - 0.07, halfWidth: [[zRR + 0.04, hwRoof * 0.98], [zRF - 0.04, hwRoof * 0.96]], shoulder: 0.25, roundTop: 2.4, roundBottom: 3, z0: zRR + 0.02, z1: zRF - 0.02, segZ: kit.seg(16), segU: kit.seg(8) }), roofMat);
    roof.castShadow = true;
    g.add(roof);
    const pm = pillarColor != null ? M.paint(pillarColor, 'gloss') : kit.paint;
    const pillars = [];
    for (const s of [1, -1]) {
      pillars.push(tube([[s * hwBelt * 0.93, yBelt, zA], [s * hwRoof * 1.02, yBelt + (yRoof - yBelt) * 0.6, zRF + (zA - zRF) * 0.42], [s * hwRoof * 0.98, yRoof - 0.01, zRF + 0.02]], 0.028, 10, 6));
      pillars.push(tube([[s * hwBelt * 0.95, yBelt, zC + 0.05], [s * hwRoof * 1.03, yBelt + (yRoof - yBelt) * 0.6, zRR - (zRR - zC) * 0.35], [s * hwRoof * 0.98, yRoof - 0.01, zRR - 0.02]], 0.05, 10, 6));
      if (bPillar) pillars.push(tube([[s * hwBelt * 0.97, yBelt, (zRF + zRR) / 2 - 0.05], [s * hwRoof * 1.06, yRoof - 0.02, (zRF + zRR) / 2 - 0.1]], 0.025, 4, 6));
    }
    const pil = new THREE.Mesh(merge(pillars), pm);
    pil.castShadow = true;
    g.add(pil);
    return g;
  };

  /**
   * Complete driver-focused interior. driverX > 0 = left-hand drive (Taiwan default).
   * Returns { group, eye } where eye is the cockpit camera position.
   */
  P.interior = ({ driverX = 0.37, floorY = 0.24, seatY = 0.3, seatZ = -0.35, dashZ = 0.62, dashY = 0.86, halfWidth = 0.68, cluster = {}, headUnit = {}, wheel = {}, seats = 'bucket', trim = 0x1d1b1a, seatColor = 0x1c1a19, accent = null, rearSeat = true, shifter = 'h', cage = false, roofY = 1.25 } = {}) => {
    const I = kit.interior;
    const g = new THREE.Group();
    // floor + tunnel + door cards
    g.add(kit.mesh(box(halfWidth * 2, 0.02, 2.2), M.fabric(0x151515), { pos: [0, floorY, -0.2], shadow: false, receive: true }));
    g.add(kit.mesh(roundedBox(0.24, 0.2, 1.3, 0.05, 2), M.plastic(trim, 0.7), { pos: [0, floorY + 0.1, 0.05] }));
    for (const s of [1, -1]) g.add(kit.mesh(roundedBox(0.05, 0.5, 1.1, 0.02, 1), M.plastic(trim, 0.8), { pos: [s * (halfWidth - 0.02), floorY + 0.42, 0.05], shadow: false }));
    // seats
    g.add(I.seat({ pos: [driverX, seatY, seatZ], style: seats, color: seatColor, accent }));
    g.add(I.seat({ pos: [-driverX, seatY, seatZ], style: seats, color: seatColor, accent }));
    if (rearSeat) g.add(kit.mesh(roundedBox(halfWidth * 1.7, 0.42, 0.45, 0.06, 2), M.fabric(seatColor), { pos: [0, seatY + 0.18, seatZ - 0.75], shadow: false }));
    // dashboard + console
    g.add(I.dashboard({ width: halfWidth * 2 - 0.04, z: dashZ + 0.12, y: dashY - 0.06, depth: 0.55, height: 0.26, color: trim }));
    g.add(kit.mesh(roundedBox(0.26, 0.32, 0.4, 0.04, 2), M.plastic(trim, 0.6), { pos: [0, dashY - 0.3, dashZ - 0.05] }));
    // steering + gauges + screen
    const wheelPos = [driverX, dashY + 0.0, dashZ - 0.22];
    g.add(I.steeringWheel({ pos: wheel.pos || wheelPos, radius: wheel.radius ?? 0.18, tilt: wheel.tilt ?? 22, style: wheel.style || 'round', accent }));
    g.add(I.cluster({ pos: [driverX, dashY + 0.07, dashZ - 0.02], size: cluster.size || [0.34, 0.12], tilt: 14, type: cluster.type || 'analog2', redline: cluster.redline ?? kit.spec?.engine?.redline ?? 7000, maxRpm: cluster.maxRpm ?? Math.ceil(((kit.spec?.engine?.limiter ?? 7500) + 1000) / 1000) * 1000, maxSpeed: cluster.maxSpeed ?? 260, accent: kit.accent }));
    g.add(I.headUnit({ pos: headUnit.pos || [0, dashY + 0.06, dashZ + 0.02], size: headUnit.size || [0.26, 0.15], tilt: headUnit.tilt ?? 16, style: headUnit.style || 'integrated' }));
    g.add(I.shifter({ pos: [0, floorY + 0.22, dashZ - 0.55], type: shifter }));
    g.add(I.pedals({ pos: [driverX, floorY + 0.12, dashZ + 0.25] }));
    g.add(I.rearViewMirror({ pos: [0, roofY - 0.13, dashZ - 0.12] }));
    if (cage) g.add(I.rollCage({ halfWidth: halfWidth - 0.06, floorY, roofY: roofY - 0.04, zFront: dashZ + 0.05, zMid: seatZ - 0.3, zRear: seatZ - 1.0 }));
    const eye = [driverX, seatY + 0.78, seatZ + 0.05];
    return { group: g, eye };
  };

  /** Simple bumper/skirt band + lower intake to break up a smooth shell. */
  P.trimBand = ({ z0, z1, y, halfWidth, height = 0.06, color = 0x101012 }) => {
    const m = new THREE.Mesh(roundedBox(halfWidth * 2, height, Math.abs(z1 - z0), 0.02, 2), M.plastic(color, 0.6));
    m.position.set(0, y, (z0 + z1) / 2);
    return m;
  };
  return P;
}
