// Wheels: tyre + rim (several styles) + brake disc (all spin) and caliper (does not spin).
// Local frame: origin = hub centre, axle along +X, outer face towards +X (the runtime mirrors right-side wheels).
import * as THREE from 'three';
import { latheX, merge, place, box, cylinderX, extrude } from './geometry.js';

export const RIM_STYLES = {
  spoke5: { name: '5-spoke', zh: '五幅' },
  mesh: { name: 'Cross mesh', zh: '網狀' },
  multi: { name: '10-spoke', zh: '十幅' },
  dish: { name: 'Deep dish 4-hole', zh: '深唇' },
  turbofan: { name: 'Turbofan', zh: '渦扇' },
  steelie: { name: 'Steelie', zh: '鐵圈' },
  split6: { name: 'Split 6-spoke', zh: '六爪' },
};

/**
 * @param o { radius, width, rimRadius?, style, color, lipColor, caliperColor, detail }
 * @param M MaterialFactory
 * @returns { spin: Group, hub: Group }
 */
export function buildWheel(o, M) {
  const R = o.radius ?? 0.32, W = o.width ?? 0.225;
  const rr = o.rimRadius ?? R * 0.66;
  const seg = Math.max(12, Math.round(32 * (o.detail ?? 1)));
  const spin = new THREE.Group(); spin.name = 'wheel-spin';
  const hub = new THREE.Group(); hub.name = 'wheel-hub';
  // ---- tyre: rounded cross-section lathed around X
  const sw = Math.min(0.03, (R - rr) * 0.35);
  const half = W / 2;
  const profile = [
    [rr - 0.005, -half + 0.012], [rr + (R - rr) * 0.25, -half - 0.004], [R - sw, -half], [R - sw * 0.3, -half + sw * 0.5], [R, -half + sw],
    [R, half - sw], [R - sw * 0.3, half - sw * 0.5], [R - sw, half], [rr + (R - rr) * 0.25, half + 0.004], [rr - 0.005, half - 0.012],
  ];
  const tyre = new THREE.Mesh(latheX(profile.map(([r, x]) => [r, x]), seg + 8), M.rubber());
  tyre.castShadow = true;
  spin.add(tyre);
  // ---- rim barrel + lip
  const rimMat = M.surface({ color: o.color ?? 0xb9bbc0, roughness: 0.28, metalness: 0.85 });
  const lipMat = o.lipColor != null ? M.surface({ color: o.lipColor, roughness: 0.15, metalness: 1 }) : rimMat;
  const barrel = new THREE.Mesh(latheX([[rr * 0.94, -half + 0.01], [rr * 0.97, half - 0.02]], seg), M.metal(0x6c6e72, 0.5));
  barrel.material.side = THREE.DoubleSide;
  spin.add(barrel);
  const lipDepth = o.style === 'dish' ? 0.06 : 0.018;
  const lip = new THREE.Mesh(latheX([[rr * 0.9, half - lipDepth], [rr * 1.02, half - lipDepth + 0.004], [rr * 1.03, half - 0.006], [rr * 0.99, half]], seg), lipMat);
  spin.add(lip);
  // ---- face
  const faceX = half - lipDepth - 0.005;
  const style = RIM_STYLES[o.style] ? o.style : 'spoke5';
  const face = buildFace(style, rr * 0.95, faceX, lipDepth, seg);
  const faceMesh = new THREE.Mesh(face, rimMat);
  faceMesh.castShadow = true;
  spin.add(faceMesh);
  // centre cap + lug nuts
  const nuts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    nuts.push(place(cylinderX(0.009, 0.02, 6), [faceX - 0.004, Math.cos(a) * rr * 0.17, Math.sin(a) * rr * 0.17]));
  }
  spin.add(new THREE.Mesh(merge(nuts), M.chrome()));
  spin.add(new THREE.Mesh(latheX([[0, faceX + 0.006], [rr * 0.1, faceX + 0.004], [rr * 0.12, faceX - 0.01]], 16), M.plastic(0x101012, 0.3)));
  // ---- brake disc (spins) and caliper (static on hub)
  const discR = Math.min(rr * 0.82, R * 0.58);
  const disc = new THREE.Mesh(latheX([[discR * 0.45, -0.012], [discR, -0.012], [discR, 0.012], [discR * 0.45, 0.012]], seg), M.metal(0x8b8d91, 0.35));
  disc.position.x = -0.02;
  spin.add(disc);
  const cal = new THREE.Mesh(extrude([[-0.06, 0], [0.06, 0], [0.07, 0.035], [-0.07, 0.035]], 0.05, { axis: 'x', bevel: 0.006 }), M.surface({ color: o.caliperColor ?? 0xb8261f, roughness: 0.35, metalness: 0.2 }));
  cal.position.set(-0.02, discR - 0.03, 0);
  cal.rotation.x = -0.6; // sit behind the axle, upper rear quadrant
  hub.add(cal);
  return { spin, hub, radius: R, width: W };
}

function buildFace(style, r, x, depth, seg) {
  const parts = [];
  const hubR = r * 0.24;
  parts.push(latheX([[0, x], [hubR, x], [hubR * 1.1, x - 0.015]], seg)); // hub disc
  const spoke = (angle, w0, w1, r0, r1, concave = 0.02, thick = 0.018) => {
    // tapered spoke as a thin extruded quad in the (z, y) plane, rotated about X
    const g = extrude([[-w0 / 2, r0], [w0 / 2, r0], [w1 / 2, r1], [-w1 / 2, r1]], thick, { axis: 'x', bevel: 0.003, bevelSegments: 1 });
    // concavity: tilt spokes so their outer end sits deeper
    place(g, [x - thick / 2, 0, 0], [Math.PI / 2 - angle, 0, 0]);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i), zz = pos.getZ(i); const rr = Math.hypot(yy, zz); pos.setX(i, pos.getX(i) - concave * (rr / r)); }
    pos.needsUpdate = true; g.computeVertexNormals();
    return g;
  };
  switch (style) {
    case 'spoke5': for (let i = 0; i < 5; i++) parts.push(spoke((i / 5) * Math.PI * 2, r * 0.3, r * 0.22, hubR * 0.8, r * 0.98, 0.03)); break;
    case 'split6': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(spoke(a - 0.08, r * 0.11, r * 0.08, hubR * 0.9, r * 0.98, 0.035), spoke(a + 0.08, r * 0.11, r * 0.08, hubR * 0.9, r * 0.98, 0.035)); } break;
    case 'multi': for (let i = 0; i < 10; i++) parts.push(spoke((i / 10) * Math.PI * 2, r * 0.12, r * 0.09, hubR * 0.85, r * 0.98, 0.025)); break;
    case 'mesh':
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push(spoke(a + 0.35, r * 0.06, r * 0.05, hubR * 0.9, r * 0.98, 0.015, 0.012), spoke(a - 0.35, r * 0.06, r * 0.05, hubR * 0.9, r * 0.98, 0.015, 0.012)); }
      parts.push(latheX([[r * 0.9, x - 0.012], [r * 0.98, x - 0.012], [r * 0.98, x - 0.004], [r * 0.9, x - 0.004]], seg));
      break;
    case 'dish': {
      parts.push(latheX([[hubR, x - 0.005], [r * 0.98, x - depth + 0.01]], seg));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; parts.push(place(cylinderX(r * 0.12, 0.012, 14), [x - 0.02, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55])); }
      break;
    }
    case 'turbofan': {
      parts.push(latheX([[hubR, x], [r * 0.98, x - 0.02]], seg));
      for (let i = 0; i < 14; i++) { const v = box(0.006, r * 0.62, 0.04); v.rotateY(0.6); v.translate(0, r * 0.6, 0); parts.push(place(v, [x + 0.002, 0, 0], [(i / 14) * Math.PI * 2, 0, 0])); }
      break;
    }
    case 'steelie': {
      parts.push(latheX([[hubR, x], [r * 0.6, x - 0.01], [r * 0.7, x - 0.03], [r * 0.98, x - 0.035]], seg));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push(place(box(0.006, r * 0.08, r * 0.16), [x - 0.012, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62], [a, 0, 0])); }
      break;
    }
  }
  return merge(parts);
}
