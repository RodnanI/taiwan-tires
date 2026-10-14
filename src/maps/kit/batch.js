// Draw-call reducers for big procedural maps.
//  Instancer:     same geometry+material placed many times -> one InstancedMesh per (geometry, material).
//  StaticBatcher: unique static meshes -> merged per (material, chunk) so the GPU gets few large draws
//                 while frustum culling still works per chunk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

export class Instancer {
  constructor(root) { this.root = root; this.types = new Map(); }
  /** Define a prop type made of parts [{ geometry, material, castShadow }]. */
  define(name, parts, { castShadow = true, receiveShadow = false, maxDistance = Infinity } = {}) {
    if (!this.types.has(name)) this.types.set(name, { parts, castShadow, receiveShadow, maxDistance, matrices: [], colors: [] });
    return name;
  }
  has(name) { return this.types.has(name); }
  /** Place an instance. rot = rotation.y (radians) or [x,y,z]. scale = number or [x,y,z]. color optional (instance tint). */
  add(name, pos, rot = 0, scale = 1, color = null) {
    const t = this.types.get(name);
    if (!t) throw new Error(`Instancer: unknown prop type "${name}"`);
    _p.set(pos[0], pos[1], pos[2]);
    if (Array.isArray(rot)) _e.set(rot[0], rot[1], rot[2]); else _e.set(0, rot, 0);
    _q.setFromEuler(_e);
    if (Array.isArray(scale)) _s.set(scale[0], scale[1], scale[2]); else _s.setScalar(scale);
    t.matrices.push(_m.compose(_p, _q, _s).clone());
    t.colors.push(color);
  }
  finalize() {
    const out = [];
    for (const [name, t] of this.types) {
      if (!t.matrices.length) continue;
      for (const part of t.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, t.matrices.length);
        t.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        if (t.colors.some(Boolean)) t.colors.forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c ?? 0xffffff)));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = part.castShadow ?? t.castShadow;
        mesh.receiveShadow = t.receiveShadow;
        mesh.name = `inst:${name}`;
        mesh.computeBoundingSphere();
        this.root.add(mesh);
        out.push(mesh);
      }
    }
    return out;
  }
}

export class StaticBatcher {
  constructor(root, chunk = 160) { this.root = root; this.chunk = chunk; this.groups = new Map(); }
  /** Add a mesh (its world transform is baked). Meshes sharing a material get merged per chunk. */
  add(mesh) {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    const key = `${mesh.material.uuid}|${Math.floor(c.x / this.chunk)}|${Math.floor(c.z / this.chunk)}|${mesh.castShadow ? 1 : 0}|${mesh.receiveShadow ? 1 : 0}`;
    if (!this.groups.has(key)) this.groups.set(key, { material: mesh.material, geos: [], cast: mesh.castShadow, receive: mesh.receiveShadow });
    this.groups.get(key).geos.push(normalizeAttrs(g));
  }
  /** Add a raw world-space geometry with a material. */
  addGeometry(geometry, material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material); m.castShadow = cast; m.receiveShadow = receive; this.add(m);
  }
  finalize() {
    const out = [];
    for (const g of this.groups.values()) {
      const indexed = g.geos.filter((x) => x.index), plain = g.geos.filter((x) => !x.index);
      const lists = [indexed, plain.length ? plain : []].filter((l) => l.length);
      for (const list of lists) {
        const merged = mergeGeometries(list, false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, g.material);
        mesh.castShadow = g.cast; mesh.receiveShadow = g.receive;
        mesh.matrixAutoUpdate = false;
        this.root.add(mesh);
        out.push(mesh);
      }
      g.geos.forEach((x) => x.dispose());
    }
    this.groups.clear();
    return out;
  }
}

function normalizeAttrs(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.color) {
    const c = new Float32Array(g.attributes.position.count * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}
