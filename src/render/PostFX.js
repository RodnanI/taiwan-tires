// Post-processing chain. Scene renders into an HDR (half-float, optionally MSAA) target with a depth texture,
// then:  [GTAO] -> [wet SSR] -> [god rays] -> [motion blur] -> [DOF] -> [bloom] -> FINAL (tonemap/grade) -> [SMAA|FXAA]
// Custom passes are small ShaderMaterials on a FullScreenQuad; three.js passes are used where they are good.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';

const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// shared: view-space position from depth
const DEPTH_FN = /* glsl */`
uniform mat4 projInv;
vec3 viewPos(vec2 uv, float d){ vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = projInv * c; return v.xyz / v.w; }
`;

class ShaderPassX {
  constructor(material) { this.material = material; this.quad = new FullScreenQuad(material); this.enabled = true; this.needsSwap = true; this.renderToScreen = false; }
  setSize() {}
  render(renderer, write, read) {
    if (this.material.uniforms.tDiffuse) this.material.uniforms.tDiffuse.value = read.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : write);
    this.quad.render(renderer);
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}

/** Screen-space reflections for wet / glossy horizontal surfaces (roads, floors, puddles). */
export class WetSSRPass extends ShaderPassX {
  constructor(steps = 24) {
    super(new THREE.ShaderMaterial({
      defines: { STEPS: steps },
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, proj: { value: new THREE.Matrix4() }, projInv: { value: new THREE.Matrix4() },
        viewInv: { value: new THREE.Matrix4() }, view: { value: new THREE.Matrix4() }, wetness: { value: 0 }, dryGloss: { value: 0.12 }, intensity: { value: 1 }, resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform sampler2D tDiffuse; uniform sampler2D tDepth;
        uniform mat4 proj; uniform mat4 viewInv; uniform mat4 view; uniform float wetness; uniform float dryGloss; uniform float intensity; uniform vec2 resolution; uniform float time;
        ${DEPTH_FN}
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
        void main(){
          vec4 base = texture2D(tDiffuse, vUv);
          float d = texture2D(tDepth, vUv).x;
          if (d >= 0.99999) { gl_FragColor = base; return; }
          vec3 P = viewPos(vUv, d);
          vec3 N = normalize(cross(dFdx(P), dFdy(P)));
          if (dot(N, P) > 0.0) N = -N;
          vec3 Nw = (viewInv * vec4(N, 0.0)).xyz;
          float ground = smoothstep(0.86, 0.97, Nw.y);
          vec3 Pw = (viewInv * vec4(P, 1.0)).xyz;
          float puddle = smoothstep(0.55, 0.75, vnoise(Pw.xz * 0.12));
          float refl = ground * (dryGloss + wetness * (0.55 + 0.45 * puddle));
          if (refl < 0.01) { gl_FragColor = base; return; }
          // ripples / asphalt micro-normal
          float n1 = vnoise(Pw.xz * 3.0 + time * 0.4) - 0.5, n2 = vnoise(Pw.zx * 3.0 - time * 0.3) - 0.5;
          vec3 Nr = normalize(Nw + vec3(n1, 0.0, n2) * (0.06 + 0.1 * (1.0 - puddle)));
          N = normalize((view * vec4(Nr, 0.0)).xyz);
          vec3 V = normalize(P);
          vec3 R = normalize(reflect(V, N));
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
          vec3 hitCol = vec3(0.0); float hit = 0.0;
          float stepLen = 0.25 + 0.012 * length(P);
          vec3 ray = P;
          float jitter = h21(vUv * resolution + time);
          ray += R * stepLen * jitter;
          for (int i = 0; i < STEPS; i++) {
            ray += R * stepLen; stepLen *= 1.12;
            vec4 c = proj * vec4(ray, 1.0); vec2 uv = c.xy / c.w * 0.5 + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
            float sd = texture2D(tDepth, uv).x;
            vec3 sp = viewPos(uv, sd);
            float diff = sp.z - ray.z; // > 0 : scene surface in front of the ray
            if (diff > 0.0 && diff < stepLen * 2.5 + 0.3) {
              // refine
              vec3 a = ray - R * stepLen, b = ray;
              for (int k = 0; k < 5; k++) { vec3 m = (a + b) * 0.5; vec4 cc = proj * vec4(m, 1.0); vec2 u2 = cc.xy / cc.w * 0.5 + 0.5; float dd = viewPos(u2, texture2D(tDepth, u2).x).z - m.z; if (dd > 0.0) b = m; else a = m; }
              vec4 cc = proj * vec4(b, 1.0); vec2 u3 = cc.xy / cc.w * 0.5 + 0.5;
              vec2 edge = smoothstep(vec2(0.0), vec2(0.12), u3) * (1.0 - smoothstep(vec2(0.88), vec2(1.0), u3));
              hit = edge.x * edge.y * (1.0 - float(i) / float(STEPS));
              hitCol = texture2D(tDiffuse, u3).rgb;
              break;
            }
          }
          vec3 col = base.rgb * (1.0 - refl * 0.35 * wetness) + hitCol * hit * fres * refl * intensity * 2.0;
          gl_FragColor = vec4(col, base.a);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }
}

/** Camera motion blur by reprojection. Pixels nearer than minDepth (the car / cockpit) stay sharp. */
export class MotionBlurPass extends ShaderPassX {
  constructor(samples = 10) {
    super(new THREE.ShaderMaterial({
      defines: { SAMPLES: samples },
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, viewInv: { value: new THREE.Matrix4() },
        prevViewProj: { value: new THREE.Matrix4() }, strength: { value: 0.6 }, minDepth: { value: 6 }, maxLen: { value: 0.05 },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform mat4 viewInv; uniform mat4 prevViewProj;
        uniform float strength; uniform float minDepth; uniform float maxLen;
        ${DEPTH_FN}
        void main(){
          float d = texture2D(tDepth, vUv).x;
          vec3 P = viewPos(vUv, min(d, 0.99999));
          vec4 Pw = viewInv * vec4(P, 1.0);
          vec4 pc = prevViewProj * Pw; vec2 prevUv = pc.xy / pc.w * 0.5 + 0.5;
          vec2 vel = (vUv - prevUv) * strength;
          float near = smoothstep(minDepth, minDepth * 1.6 + 1.0, -P.z);
          vel *= near;
          float l = length(vel); if (l > maxLen) vel *= maxLen / l;
          vec4 acc = texture2D(tDiffuse, vUv); float w = 1.0;
          if (l > 0.0006) {
            for (int i = 1; i <= SAMPLES; i++) {
              float t = float(i) / float(SAMPLES) - 0.5;
              vec2 uv = vUv + vel * t;
              float sd = texture2D(tDepth, uv).x;
              float sw = smoothstep(minDepth, minDepth * 1.6 + 1.0, -viewPos(uv, min(sd, 0.99999)).z); // don't smear the car into the world
              acc += texture2D(tDiffuse, uv) * sw; w += sw;
            }
          }
          gl_FragColor = acc / w;
        }`,
      depthTest: false, depthWrite: false,
    }));
  }
}

/** Depth of field (menus / showroom): golden-angle bokeh gather around a focus distance. */
export class DofPass extends ShaderPassX {
  constructor(taps = 40) {
    super(new THREE.ShaderMaterial({
      defines: { TAPS: taps },
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, projInv: { value: new THREE.Matrix4() },
        focus: { value: 5 }, aperture: { value: 1 }, maxBlur: { value: 12 }, resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float focus; uniform float aperture;
        uniform float maxBlur; uniform vec2 resolution;
        ${DEPTH_FN}
        float coc(vec2 uv){
          float z = -viewPos(uv, min(texture2D(tDepth, uv).x, 0.99999)).z;
          return clamp(abs(z - focus) / max(z, 0.05) * aperture, 0.0, 1.0) * maxBlur; // circle of confusion in pixels
        }
        void main(){
          float c0 = coc(vUv);
          vec4 base = texture2D(tDiffuse, vUv);
          if (c0 < 0.5) { gl_FragColor = base; return; }
          vec2 px = 1.0 / resolution;
          vec3 acc = base.rgb; float w = 1.0;
          for (int i = 1; i < TAPS; i++) {
            float fi = float(i);
            float r = sqrt(fi / float(TAPS)) * c0;
            float a = fi * 2.39996;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px;
            float cs = coc(uv);
            float sw = smoothstep(r - 1.0, r + 1.0, cs + 0.5); // samples sharper than this radius don't bleed in
            acc += texture2D(tDiffuse, uv).rgb * sw; w += sw;
          }
          gl_FragColor = vec4(acc / w, base.a);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }
}

/** Screen-space light shafts from the sun/moon (sky pixels blurred towards the light). */
export class GodRaysPass extends ShaderPassX {
  constructor() {
    super(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, sunUv: { value: new THREE.Vector2(0.5, 0.5) }, intensity: { value: 0 }, color: { value: new THREE.Color(1, 0.9, 0.7) } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 sunUv; uniform float intensity; uniform vec3 color;
        void main(){
          vec4 base = texture2D(tDiffuse, vUv);
          if (intensity <= 0.001) { gl_FragColor = base; return; }
          vec2 dir = (sunUv - vUv) / 40.0; vec2 uv = vUv; float illum = 0.0; float decay = 1.0;
          for (int i = 0; i < 40; i++) {
            uv += dir;
            float sky = step(0.99995, texture2D(tDepth, clamp(uv, 0.0, 1.0)).x);
            vec3 c = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
            illum += sky * min(dot(c, vec3(0.33)), 4.0) * decay; decay *= 0.965;
          }
          gl_FragColor = vec4(base.rgb + color * illum / 40.0 * intensity, base.a);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }
}

/** Tone mapping + grading + lens effects. Writes display-referred sRGB. */
export class FinalPass extends ShaderPassX {
  constructor() {
    super(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, exposure: { value: 1 }, toneMode: { value: 1 }, saturation: { value: 1.05 }, contrast: { value: 1.04 },
        vignette: { value: 0.25 }, grain: { value: 0 }, ca: { value: 0 }, speed: { value: 0 }, streaks: { value: 0 }, time: { value: 0 },
        tint: { value: new THREE.Color(1, 1, 1) }, resolution: { value: new THREE.Vector2(1, 1) }, fade: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tDiffuse; uniform float exposure; uniform int toneMode; uniform float saturation; uniform float contrast;
        uniform float vignette; uniform float grain; uniform float ca; uniform float speed; uniform float streaks; uniform float time; uniform vec3 tint; uniform vec2 resolution; uniform float fade;
        vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 color){
          const mat3 i = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
          const mat3 o = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
          color = i * (color / 0.6); color = RRTAndODTFit(color); color = o * color; return clamp(color, 0.0, 1.0);
        }
        vec3 agxCurve(vec3 x){ vec3 x2 = x * x; vec3 x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
        vec3 agx(vec3 color){
          const mat3 inM = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859);
          const mat3 outM = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
          color = inM * max(color, vec3(1e-10));
          color = clamp(log2(color), -12.47393, 4.026069); color = (color + 12.47393) / 16.49999;
          color = agxCurve(color); color = outM * color;
          color = pow(max(vec3(0.0), color), vec3(2.2)); return clamp(color, 0.0, 1.0);
        }
        vec3 neutral(vec3 color){
          const float s = 0.8 - 0.04; const float d = 0.15;
          float x = min(color.r, min(color.g, color.b)); float off = x < 0.08 ? x - 6.25 * x * x : 0.04; color -= off;
          float peak = max(color.r, max(color.g, color.b)); if (peak < s) return color;
          float nd = 1.0 - s; float np = 1.0 - nd * nd / (peak + nd - s); color *= np / peak;
          float g = 1.0 - 1.0 / (d * (peak - np) + 1.0); return mix(color, vec3(np), g);
        }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
        void main(){
          vec2 d = vUv - 0.5; float r2 = dot(d, d);
          float caAmt = ca * (0.0015 + speed * 0.004) * r2 * 4.0;
          vec3 col = vec3(texture2D(tDiffuse, vUv - d * caAmt).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * caAmt).b);
          if (streaks > 0.001) {
            float k = streaks * smoothstep(0.04, 0.25, r2);
            vec3 acc = col; for (int i = 1; i <= 6; i++) acc += texture2D(tDiffuse, vUv - d * k * 0.035 * float(i)).rgb;
            col = acc / 7.0;
          }
          col *= exposure * tint;
          if (toneMode == 0) col = aces(col); else if (toneMode == 1) col = agx(col); else col = neutral(col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, saturation);
          col = (col - 0.18) * contrast + 0.18;
          col = clamp(col, 0.0, 1.0);
          col *= 1.0 - vignette * smoothstep(0.12, 0.65, r2 * 1.6);
          col = toSRGB(col);
          col += (hash(vUv * resolution) - 0.5) * grain;
          col = mix(col, vec3(0.0), fade);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }
}

/** Owns render targets and the ordered pass list. */
export class PostChain {
  constructor(renderer) {
    this.renderer = renderer;
    this.width = 1; this.height = 1;
    this.samples = 0;
    this.sceneRT = null; this.rtA = null; this.rtB = null; this.ldrRT = null;
    this.passes = {};
    this.prevViewProj = new THREE.Matrix4();
    this.hasPrev = false;
  }
  configure(q, scene, camera) {
    this.dispose();
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    this.width = size.x; this.height = size.y;
    this.samples = { msaa4: 4, msaa4smaa: 4, msaa8smaa: 8 }[q.antialias] || 0;
    const depthTexture = new THREE.DepthTexture(this.width, this.height);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, samples: this.samples, depthTexture, depthBuffer: true });
    this.rtA = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, depthBuffer: false });
    this.rtB = this.rtA.clone();
    this.ldrRT = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.UnsignedByteType, depthBuffer: false });
    const P = this.passes = {};
    if (q.ao && q.ao !== 'off') {
      const div = q.ao === 'low' ? 2 : 1;
      P.ao = new GTAOPass(scene, camera, Math.round(this.width / div), Math.round(this.height / div));
      P.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: q.ao === 'high' ? 16 : 10 });
      P.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: q.ao === 'high' ? 8 : 6, rings: 2, samples: q.ao === 'high' ? 16 : 10 });
      P.ao.blendIntensity = 0.85;
    }
    if (q.ssr && q.ssr !== 'off') P.ssr = new WetSSRPass({ low: 16, high: 28, ultra: 44 }[q.ssr] || 20);
    if (q.godRays) P.god = new GodRaysPass();
    if (q.motionBlur && q.motionBlur !== 'off') P.mb = new MotionBlurPass(q.motionBlur === 'high' ? 14 : 7);
    if (q.dof) P.dof = new DofPass(q.detail >= 1.4 ? 56 : 36);
    if (q.bloom && q.bloom !== 'off') {
      const div = q.bloom === 'low' ? 4 : 2;
      P.bloom = new UnrealBloomPass(new THREE.Vector2(this.width / div, this.height / div), q.bloom === 'low' ? 0.45 : 0.62, 0.55, 1.05);
    }
    P.final = new FinalPass();
    if (q.antialias === 'smaa' || q.antialias === 'msaa4smaa' || q.antialias === 'msaa8smaa') { P.aa = new SMAAPass(); P.aa.setSize(this.width, this.height); }
    else if (q.antialias === 'fxaa') { P.aa = new FXAAPass(); P.aa.setSize(this.width, this.height); }
    for (const p of Object.values(P)) p.setSize?.(this.width, this.height);
    if (P.bloom) P.bloom.setSize(this.width / (q.bloom === 'low' ? 4 : 2), this.height / (q.bloom === 'low' ? 4 : 2));
    this.q = q;
    this.hasPrev = false;
  }
  /** Render scene through the chain to the canvas. info: { exposure, toneMode, saturation, speed, minDepth, wetness, sun, time, fade, dof: { focus, aperture, maxBlur } } */
  render(scene, camera, info) {
    const r = this.renderer, P = this.passes, q = this.q;
    camera.updateMatrixWorld();
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    let read = this.sceneRT, write = this.rtA;
    const swap = () => { const t = read === this.sceneRT ? this.rtB : read; read = write; write = t; };
    const run = (pass) => {
      pass.render(r, write, read, info.dt || 0.016);
      if (pass.needsSwap !== false) swap();
    };
    const depth = this.sceneRT.depthTexture;
    if (P.ao) { P.ao.camera = camera; run(P.ao); }
    if (P.ssr && (info.wetness > 0.02 || q.ssr !== 'low')) {
      const u = P.ssr.material.uniforms;
      u.tDepth.value = depth; u.proj.value.copy(camera.projectionMatrix); u.projInv.value.copy(camera.projectionMatrixInverse); u.viewInv.value.copy(camera.matrixWorld); u.view.value.copy(camera.matrixWorldInverse);
      u.wetness.value = info.wetness || 0; u.dryGloss.value = info.dryGloss ?? 0.1; u.time.value = info.time || 0; u.resolution.value.set(this.width, this.height);
      run(P.ssr);
    }
    if (P.god && info.sun && info.sun.intensity > 0.01) {
      const u = P.god.material.uniforms;
      u.tDepth.value = depth; u.sunUv.value.copy(info.sun.uv); u.intensity.value = info.sun.intensity; u.color.value.copy(info.sun.color);
      run(P.god);
    }
    if (P.mb && this.hasPrev && info.motionBlur !== false) {
      const u = P.mb.material.uniforms;
      u.tDepth.value = depth; u.projInv.value.copy(camera.projectionMatrixInverse); u.viewInv.value.copy(camera.matrixWorld);
      u.prevViewProj.value.copy(this.prevViewProj); u.minDepth.value = info.minDepth ?? 6;
      u.strength.value = (q.motionBlur === 'high' ? 0.75 : 0.45) * (info.mbScale ?? 1);
      run(P.mb);
    }
    if (P.dof && info.dof) {
      const u = P.dof.material.uniforms;
      u.tDepth.value = depth; u.projInv.value.copy(camera.projectionMatrixInverse); u.resolution.value.set(this.width, this.height);
      u.focus.value = info.dof.focus; u.aperture.value = info.dof.aperture ?? 1; u.maxBlur.value = (info.dof.maxBlur ?? 10) * this.height / 1080;
      run(P.dof);
    }
    if (P.bloom) { P.bloom.strength = (q.bloom === 'low' ? 0.42 : 0.6) * (info.bloomScale ?? 1); run(P.bloom); }
    // final
    const fu = P.final.material.uniforms;
    fu.exposure.value = info.exposure ?? 1; fu.toneMode.value = info.toneMode ?? 1; fu.saturation.value = info.saturation ?? 1.05;
    fu.vignette.value = q.vignette ? 0.32 + (info.speed || 0) * 0.12 : 0; fu.grain.value = q.filmGrain ? 0.035 : 0; fu.ca.value = q.chromaticAberration ? 1 : 0;
    fu.speed.value = info.speed || 0; fu.streaks.value = q.speedEffects ? Math.max(0, (info.speed || 0) - 0.35) * 1.3 : 0; fu.time.value = (info.time || 0) % 100;
    fu.resolution.value.set(this.width, this.height); fu.fade.value = info.fade || 0;
    if (info.tint) fu.tint.value.copy(info.tint); else fu.tint.value.setRGB(1, 1, 1);
    if (P.aa) {
      P.final.renderToScreen = false;
      P.final.render(r, this.ldrRT, read);
      P.aa.renderToScreen = true;
      P.aa.render(r, null, this.ldrRT);
    } else {
      P.final.renderToScreen = true;
      P.final.render(r, null, read);
    }
    // for next frame's motion blur
    this.prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.hasPrev = true;
  }
  resetHistory() { this.hasPrev = false; }
  dispose() {
    for (const rt of [this.sceneRT, this.rtA, this.rtB, this.ldrRT]) rt?.dispose();
    for (const p of Object.values(this.passes)) p.dispose?.();
    this.passes = {};
  }
}
