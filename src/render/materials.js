// Quality-aware material factory shared by vehicle and map kits.
//   basic    -> MeshLambertMaterial (cheapest, no PBR)
//   standard -> MeshStandardMaterial
//   physical -> MeshPhysicalMaterial where it matters (car paint clearcoat, glass)
// Shared materials are cached per factory; paint materials are per car instance.
import * as THREE from 'three';
import { getTextureSet } from './textures.js';

export const PAINT_FINISHES = {
  gloss: { name: 'Gloss', roughness: 0.22, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04 },
  metallic: { name: 'Metallic', roughness: 0.34, metalness: 0.62, clearcoat: 1, clearcoatRoughness: 0.05 },
  pearl: { name: 'Pearl', roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.75 },
  satin: { name: 'Satin', roughness: 0.48, metalness: 0.25, clearcoat: 0.35, clearcoatRoughness: 0.35 },
  matte: { name: 'Matte', roughness: 0.72, metalness: 0.05, clearcoat: 0, clearcoatRoughness: 1 },
  candy: { name: 'Candy', roughness: 0.18, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.02 },
  chrome: { name: 'Chrome', roughness: 0.06, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.02 },
};

export class MaterialFactory {
  constructor(quality = {}) {
    this.q = { materials: 'standard', textures: 'medium', ...quality };
    this.cache = new Map();
    this.texSize = { low: 256, medium: 512, high: 1024, ultra: 2048 }[this.q.textures] || 512;
  }
  get basic() { return this.q.materials === 'basic'; }
  get physical() { return this.q.materials === 'physical'; }

  /** Generic lit surface. opts: color, roughness, metalness, map, normalMap, emissive, emissiveIntensity, side, transparent, opacity, vertexColors, envMapIntensity */
  surface(opts = {}) {
    const o = { ...opts };
    if (this.basic) {
      const m = new THREE.MeshLambertMaterial({
        color: o.color ?? 0xffffff, map: o.map || null, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
        emissiveMap: o.emissiveMap || null, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1, vertexColors: !!o.vertexColors,
      });
      return m;
    }
    const P = o.physical && this.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    delete o.physical;
    const m = new P({ roughness: 0.7, metalness: 0, ...o });
    if (!this.normalMapsAllowed() && m.normalMap) m.normalMap = null;
    return m;
  }
  normalMapsAllowed() { return this.q.textures !== 'low'; }
  /** Cached shared material by key. */
  shared(key, make) {
    if (!this.cache.has(key)) this.cache.set(key, make());
    return this.cache.get(key);
  }
  textured(key, { repeat = 1, color = 0xffffff, roughness = 0.85, metalness = 0, normalScale = 1 } = {}) {
    return this.shared(`tex:${key}:${repeat}:${color}:${roughness}`, () => {
      const set = getTextureSet(key, this.texSize);
      const clone = (t) => { if (!t) return null; const c = t.clone(); c.needsUpdate = true; c.repeat.set(repeat, repeat); return c; };
      const m = this.surface({ color, roughness, metalness, map: clone(set.map), normalMap: this.normalMapsAllowed() ? clone(set.normalMap) : null, roughnessMap: clone(set.roughnessMap) });
      if (m.normalScale) m.normalScale.set(normalScale, normalScale);
      return m;
    });
  }

  // ---- vehicle materials --------------------------------------------------------------------
  paint(color = '#c8c2b4', finish = 'gloss') {
    const m = this.basic ? new THREE.MeshLambertMaterial({ color }) : this.physical ? new THREE.MeshPhysicalMaterial({ color }) : new THREE.MeshStandardMaterial({ color });
    m.userData.isPaint = true;
    this.setPaint(m, color, finish);
    return m;
  }
  setPaint(m, color, finish = 'gloss') {
    m.color.set(color);
    m.userData.finish = finish;
    const f = PAINT_FINISHES[finish] || PAINT_FINISHES.gloss;
    if (m.isMeshStandardMaterial) {
      m.roughness = f.roughness; m.metalness = f.metalness;
      if (m.isMeshPhysicalMaterial) {
        m.clearcoat = f.clearcoat; m.clearcoatRoughness = f.clearcoatRoughness;
        m.iridescence = f.iridescence || 0; m.iridescenceIOR = 1.6;
      } else if (f.clearcoat > 0.5) { m.roughness *= 0.6; }
    }
    m.needsUpdate = true;
  }
  glass(tint = 0x1a2024, opacity = 0.45) {
    return this.shared(`glass:${tint}:${opacity}`, () => {
      if (this.basic) return new THREE.MeshLambertMaterial({ color: tint, transparent: true, opacity: Math.min(0.85, opacity + 0.25) });
      const m = new (this.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color: tint, roughness: 0.04, metalness: 0.2, transparent: true, opacity, envMapIntensity: 1.4 });
      if (m.isMeshPhysicalMaterial) { m.clearcoat = 1; m.clearcoatRoughness = 0; }
      m.depthWrite = false;
      return m;
    });
  }
  chrome() { return this.shared('chrome', () => this.surface({ color: 0xdedede, roughness: 0.08, metalness: 1 })); }
  metal(color = 0x8a8c90, roughness = 0.4) { return this.shared(`metal:${color}:${roughness}`, () => this.surface({ color, roughness, metalness: 0.9 })); }
  plastic(color = 0x141416, roughness = 0.55) { return this.shared(`plastic:${color}:${roughness}`, () => this.surface({ color, roughness, metalness: 0 })); }
  rubber() { return this.shared('rubber', () => this.surface({ color: 0x18181a, roughness: 0.92, metalness: 0 })); }
  carbon() { return this.shared('carbon', () => { const t = getTextureSet('carbon', 256).map.clone(); t.needsUpdate = true; t.repeat.set(4, 4); return this.surface({ color: 0xffffff, map: t, roughness: 0.3, metalness: 0.4, physical: true }); }); }
  leather(color = 0x2a2522) { return this.shared(`leather:${color}`, () => { const s = getTextureSet('leather', 256); const m = this.surface({ color, roughness: 0.62, normalMap: s.normalMap?.clone() || null }); if (m.normalMap) { m.normalMap.needsUpdate = true; m.normalMap.repeat.set(6, 6); } return m; }); }
  fabric(color = 0x2d2d33) { return this.shared(`fabric:${color}`, () => this.surface({ color, roughness: 0.95 })); }
  emissive(color = 0xffffff, intensity = 2) { return this.shared(`em:${color}:${intensity}`, () => this.surface({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })); }
  /** Unshared light lens material (the vehicle runtime animates emissiveIntensity). */
  lightLens(color = 0xffffff, base = 0.05) {
    const m = this.surface({ color: 0x0a0a0a, emissive: color, emissiveIntensity: base, roughness: 0.15, metalness: 0.1 });
    m.userData.lightBase = base;
    return m;
  }
}
