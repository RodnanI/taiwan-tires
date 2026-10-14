// Vehicle model kit: everything a vehicle.js `model.build(ctx)` gets as ctx.kit.
// One kit instance per build: it collects lights, gauges, the steering wheel and anchors so authors only
// have to build geometry. See vehicles/AGENTS.md for the full contract and examples.
import * as THREE from 'three';
import * as geo from './geometry.js';
import { buildWheel, RIM_STYLES } from './wheels.js';
import { makeInterior } from './interior.js';
import { makeExterior } from './exterior.js';
import { makePresets } from './presets.js';
import { makeBodyKit } from './body.js';

export { RIM_STYLES };

export function createVehicleKit({ M, spec, visual, detail = 1, accent = '#ff9a2e' }) {
  const kit = {
    THREE, M, spec, detail, accent,
    geo,
    _lights: { head: [], brake: [], reverse: [], indicator: [], fog: [], drl: [] },
    _gauges: [],
    _steering: null,
    _screen: null,
    _anchors: { exhaust: [], headlights: [] },
    _wheelOverride: null,
    /** Scale a segment count by the detail setting. */
    seg: (n) => Math.max(4, Math.round(n * detail)),
    /** Add a mesh helper: mesh(geometry, material, { pos, rot, shadow }) */
    mesh(geometry, material, { pos, rot, scale, shadow = true, receive = false, name } = {}) {
      const m = new THREE.Mesh(geometry, material);
      if (pos) m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      if (scale) m.scale.set(...scale);
      m.castShadow = shadow; m.receiveShadow = receive;
      if (name) m.name = name;
      return m;
    },
    /** The car's paint material (colour + finish are driven by the paint shop). */
    paint: null,
    /** Secondary paint (two-tone, mirrors, wing) - follows visual.paint2 if set, else the main paint. */
    paint2: null,
    /** Wheels: call to override the default wheels (built from spec + visual.mods.rims). */
    wheels(opts) { kit._wheelOverride = opts; },
    // front and rear pairs share their build (the runtime asks once per wheel)
    buildWheel: (o) => {
      const key = JSON.stringify(o);
      const c = (kit._wheelCache ||= new Map()).get(key);
      if (c) return { ...c, spin: c.spin.clone(), hub: c.hub.clone() };
      const w = buildWheel({ detail, ...o }, M);
      kit._wheelCache.set(key, w);
      return w;
    },
  };
  kit.paint = M.paint(visual?.paint?.color, visual?.paint?.finish);
  kit.paint2 = visual?.paint2 ? M.paint(visual.paint2.color, visual.paint2.finish) : kit.paint;
  kit.mat = {
    paint: () => kit.paint, paint2: () => kit.paint2,
    glass: (tint, opacity) => M.glass(tint, opacity), chrome: () => M.chrome(), metal: (c, r) => M.metal(c, r),
    plastic: (c, r) => M.plastic(c, r), rubber: () => M.rubber(), carbon: () => M.carbon(), leather: (c) => M.leather(c),
    fabric: (c) => M.fabric(c), emissive: (c, i) => M.emissive(c, i), surface: (o) => M.surface(o), textured: (k, o) => M.textured(k, o),
  };
  kit.interior = makeInterior(kit);
  kit.ext = makeExterior(kit);
  kit.presets = makePresets(kit);
  kit.body = makeBodyKit(kit);
  return kit;
}

/** After build(): resolve anchors (screen corners etc.) in vehicle-local space. */
export function finalizeKit(kit, root, returned = {}) {
  root.updateMatrixWorld(true);
  const anchors = { ...kit._anchors, ...(returned.anchors || {}) };
  if (kit._screen && !anchors.screen) {
    const { mesh, width: w, height: h } = kit._screen;
    const corner = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld);
    const tl = corner(-w / 2, h / 2), tr = corner(w / 2, h / 2), bl = corner(-w / 2, -h / 2), br = corner(w / 2, -h / 2);
    anchors.screen = { tl: tl.toArray(), tr: tr.toArray(), bl: bl.toArray(), br: br.toArray(), width: w, height: h, mesh, canvas: kit._screen.canvas, texture: kit._screen.texture };
  }
  return {
    anchors,
    lights: kit._lights,
    gauges: kit._gauges,
    steering: returned.steeringWheel ? { object: returned.steeringWheel } : kit._steering,
  };
}
