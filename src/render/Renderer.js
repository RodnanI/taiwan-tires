// Owns the WebGL context, resolution/pixel ratio, the post chain and quality application.
import * as THREE from 'three';
import { PostChain } from './PostFX.js';
import { setTextureAnisotropy } from './textures.js';

const TONE = { aces: 0, agx: 1, neutral: 2 };
const TONE_THREE = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping };

export class Renderer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tt-canvas';
    container.appendChild(this.canvas);
    let gl = null;
    try {
      this.three = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false, preserveDrawingBuffer: false });
      gl = this.three.getContext();
    } catch (e) {
      this.error = e;
      throw new Error('WebGL2 is not available: ' + e.message);
    }
    this.gl = gl;
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.setClearColor(0x000000, 1);
    this.three.info.autoReset = false; // stats count every pass of the frame
    this.post = new PostChain(this.three);
    this.usePost = false;
    this.q = null;
    this.width = 1; this.height = 1;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }
  get maxAnisotropy() { return this.three.capabilities.getMaxAnisotropy(); }

  resize() {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth), h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.width = w; this.height = h;
    const q = this.q;
    const dpr = q ? Math.min(window.devicePixelRatio || 1, q.pixelRatioCap) * q.renderScale : Math.min(window.devicePixelRatio || 1, 1.5);
    this.three.setPixelRatio(dpr);
    this.three.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.needsPostConfig = true;
    for (const cb of this._resizeCbs || []) cb(w, h);
  }
  onResize(cb) { (this._resizeCbs ||= []).push(cb); }

  /** q = settings.gfx() */
  applyQuality(q) {
    this.q = q;
    setTextureAnisotropy(Math.min(q.anisotropy, this.maxAnisotropy));
    this.resize();
    this.usePost = q.antialias !== 'off' || q.bloom !== 'off' || q.ao !== 'off' || q.ssr !== 'off' || q.motionBlur !== 'off' || q.vignette || q.speedEffects || q.godRays;
    this.three.toneMapping = this.usePost ? THREE.NoToneMapping : TONE_THREE[q.toneMapping] ?? THREE.AgXToneMapping;
    this.three.toneMappingExposure = q.exposure ?? 1;
    this.needsPostConfig = true;
  }
  /** Force shader recompiles (needed after toggling shadows / tone mapping on existing materials). */
  refreshMaterials(scene) {
    scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((x) => { x.needsUpdate = true; });
    });
  }

  render(scene, camera, info = {}) {
    this.three.info.reset();
    if (this.usePost) {
      if (this.needsPostConfig || this.post._scene !== scene) {
        this.post.configure(this.q, scene, camera);
        this.post._scene = scene;
        this.needsPostConfig = false;
      }
      this.post.render(scene, camera, { ...info, exposure: (this.q.exposure ?? 1) * (info.exposure ?? 1), toneMode: TONE[this.q.toneMapping] ?? 1, saturation: this.q.saturation ?? 1.05 });
    } else {
      this.three.toneMappingExposure = (this.q?.exposure ?? 1) * (info.exposure ?? 1);
      this.three.setRenderTarget(null);
      this.three.render(scene, camera);
    }
  }
  get stats() {
    const r = this.three.info.render;
    return { calls: r.calls, triangles: r.triangles, programs: this.three.info.programs?.length || 0, textures: this.three.info.memory.textures, geometries: this.three.info.memory.geometries };
  }
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.post.dispose();
    this.three.dispose();
    this.canvas.remove();
  }
}
