// Map kit: everything a map.js `build(ctx)` gets as ctx.kit. See maps/AGENTS.md for the authoring guide.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Instancer, StaticBatcher } from './batch.js';
import { makeRoads } from './roads.js';
import { makeTerrain } from './terrain.js';
import { makeBuildings } from './buildings.js';
import { makeProps } from './props.js';
import { SignAtlas } from './signs.js';
import { rng, fbm, ridged, valueNoise, hashString } from '../../core/math.js';
import { noiseField, normalFromHeight } from '../../render/textures.js';

export function createMapKit({ root, world, M, lights, env, quality, seed = 1, batchChunk = 180 }) {
  const kit = {
    THREE, M, root, world, env, quality,
    detail: quality.detail ?? 1, vegetation: quality.vegetation ?? 1,
    texSize: { low: 256, medium: 512, high: 1024, ultra: 2048 }[quality.textures] || 512,
    rand: rng(seed),
    noise: { fbm, ridged, valueNoise, hash: hashString },
    nightMaterials: [],
    glows: [],
    animated: [],
    terrainRef: null,
    waterLevel: -Infinity,
  };
  kit.batch = new StaticBatcher(root, batchChunk);
  kit.inst = new Instancer(root);
  // instanced cells fade out with the preset's draw distance (forests stop at the fog)
  kit.cullScale = Math.min(1.8, Math.max(0.35, (quality.drawDistance ?? 1600) / 1600));
  kit.signs = new SignAtlas(M);
  kit.nightMaterials.push(kit.signs.material);
  // horizontal boards (road signs, tunnel names, shop fascias): created on first use
  let hsigns = null;
  Object.defineProperty(kit, 'hsigns', { get() { if (!hsigns) { hsigns = new SignAtlas(M, { cols: 4, rows: 16, slotW: 256, slotH: 64, horizontal: true }); kit.nightMaterials.push(hsigns.material); } return hsigns; } });

  kit.merge = (geos) => {
    const list = geos.map((g) => { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; });
    return mergeGeometries(list, false);
  };
  /** Static world-space geometry (batched). */
  kit.addStatic = (geometry, material, { cast = true, receive = true } = {}) => kit.batch.addGeometry(geometry, material, { cast, receive });
  /** Static mesh helper: kit.mesh(geo, mat, { pos, rot, scale, cast, receive }). Baked into the batcher. */
  kit.mesh = (geometry, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos); m.rotation.set(...rot);
    if (Array.isArray(scale)) m.scale.set(...scale); else m.scale.setScalar(scale);
    m.castShadow = cast; m.receiveShadow = receive;
    kit.batch.add(m);
    return m;
  };
  /** Dynamic / animated object added as-is. */
  kit.add = (obj) => { root.add(obj); return obj; };
  /** Called every frame with (dt, time) - for spinning signs, water etc. */
  kit.animate = (fn) => kit.animated.push(fn);
  kit.light = (v) => lights?.add(v);

  kit.collision = {
    box: (o) => world.addBox(o),
    cylinder: (o) => world.addCylinder(o),
    wall: (ax, az, bx, bz, o) => world.addWall(ax, az, bx, bz, o),
    wallPath: (pts, o) => world.addWallPath(pts, o),
    triangles: (geometry, surface = 'asphalt') => world.addGeometry(geometry, surface),
  };

  kit.terrain = (spec) => { kit.terrainRef = makeTerrain(kit, spec); return kit.terrainRef; };
  kit.rawGroundY = (x, z) => (kit.terrainRef ? kit.terrainRef.rawHeightAt(x, z) : 0);
  kit.groundY = (x, z, yHint) => (kit.terrainRef ? kit.terrainRef.heightAt(x, z) : (yHint != null ? yHint : 0));

  const roads = makeRoads(kit);
  kit.roads = roads.all;
  kit.road = (spec) => roads.road(spec);
  kit.junction = (spec) => roads.junction(spec);
  kit.sweep = roads.sweep;
  kit.roadMats = roads.mats;
  /** Paved pad (car park, quay, plaza): flattens the terrain to y and lays a polygon [[x, z], ...] of asphalt,
   *  concrete or gravel with collision. Call from build() (the terrain is meshed in finalize). */
  kit.pad = ({ poly, y, surface = 'asphalt', blend = 8, material = null }) => {
    kit.terrainRef?.flatten(poly, y, blend);
    const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))));
    g.rotateX(-Math.PI / 2);
    g.translate(0, y + 0.03, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
    const mat = material || (surface === 'concrete' ? roads.mats.concrete() : surface === 'gravel' || surface === 'dirt' ? M.textured('dirt', { repeat: 1 }) : roads.mats.asphalt());
    kit.addStatic(g, mat, { cast: false, receive: true });
    kit.collision.triangles(g, surface);
    return g;
  };
  const B = makeBuildings(kit);
  kit.building = B.building; kit.row = B.row; kit.skyline = B.skyline; kit.supertall = B.supertall;
  kit.props = makeProps(kit);

  /** Water plane at `level` (cars below it get reset). */
  kit.water = ({ level = 0, size = 4000, center = [0, 0], color = 0x0b2a33 } = {}) => {
    kit.waterLevel = Math.max(kit.waterLevel, level);
    const n = 256;
    const h = noiseField(n, 8, 3, 21);
    const nm = normalFromHeight(h, n, 2.5);
    nm.repeat.set(size / 30, size / 30);
    const mat = M.surface({ color, roughness: 0.06, metalness: 0.05, normalMap: M.normalMapsAllowed() ? nm : null, envMapIntensity: 1.2 });
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(center[0], level, center[1]);
    m.receiveShadow = true;
    m.name = 'water';
    root.add(m);
    kit.animate((dt, t) => { if (mat.normalMap) { mat.normalMap.offset.x = t * 0.004; mat.normalMap.offset.y = t * 0.0025; } });
    return m;
  };

  /** Phase 2 + GPU upload. Called by the loader after map.build(). */
  kit.finalize = () => {
    for (const r of roads.all) roads.decorate(r);
    kit.terrainRef?.build();
    kit.batch.finalize();
    kit.inst.finalize();
    // ground light pools under street lamps (cheap additive decals, visible at night)
    if (kit.glows.length) {
      const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: { night: { value: 1 } },
        vertexShader: `varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float night; varying vec2 vUv; varying vec3 vC; void main(){ float r = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.0) * 0.55 * night; gl_FragColor = vec4(vC * a, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
      });
      const im = new THREE.InstancedMesh(g, mat, kit.glows.length);
      const m4 = new THREE.Matrix4(), col = new THREE.Color();
      kit.glows.forEach(([x, y, z, c], i) => { m4.makeScale(16, 1, 16).setPosition(x, y + 0.06, z); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(c)); });
      im.renderOrder = 2;
      im.frustumCulled = false;
      root.add(im);
      kit.glowMesh = im;
    }
    world.finalize();
  };
  return kit;
}
