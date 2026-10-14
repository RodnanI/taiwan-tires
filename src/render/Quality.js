// Graphics quality presets, Potato -> Ultra++. Every key here is a setting "gfx.<key>" (see core/Settings.js).
// Renderer.applyQuality() reads the resolved values; nothing else should branch on the preset name.
export const QUALITY_LEVELS = ['potato', 'low', 'medium', 'high', 'ultra', 'ultraPlus', 'ultraPlusPlus'];
export const QUALITY_LABELS = {
  potato: 'Potato', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra', ultraPlus: 'Ultra+', ultraPlusPlus: 'Ultra++', custom: 'Custom',
};

// Option tables (value -> concrete parameters). Kept here so UI, docs and renderer agree.
export const SHADOW_OPTIONS = {
  off: null,
  blob: { blob: true },
  low: { size: 1024, distance: 60, radius: 1.5 },
  medium: { size: 2048, distance: 90, radius: 2 },
  high: { size: 2048, distance: 140, radius: 3 },
  ultra: { size: 4096, distance: 190, radius: 3.5 },
  extreme: { size: 4096, distance: 280, radius: 4 },
  insane: { size: 8192, distance: 320, radius: 5 },
};
export const REFLECTION_OPTIONS = {
  off: null,
  static: { cube: 0 },
  dynamic: { cube: 128, every: 4 },
  dynamicHigh: { cube: 256, every: 2 },
  dynamicMax: { cube: 512, every: 1 },
};
export const PARTICLE_OPTIONS = { off: 0, low: 600, medium: 1800, high: 4000, ultra: 8000 };
export const TEXTURE_SIZES = { low: 256, medium: 512, high: 1024, ultra: 2048 };

const P = (o) => o;
export const PRESETS = {
  potato: P({
    renderScale: 0.5, pixelRatioCap: 1, antialias: 'off', shadows: 'blob', ao: 'off', carReflections: 'off', ssr: 'off',
    bloom: 'off', motionBlur: 'off', dof: false, filmGrain: false, chromaticAberration: false, vignette: false, speedEffects: false,
    godRays: false, drawDistance: 350, detail: 0.3, vegetation: 0.15, particles: 'low', skidmarks: 300, dynamicLights: 0,
    anisotropy: 1, materials: 'basic', textures: 'low', weatherFx: 'low',
  }),
  low: P({
    renderScale: 0.75, pixelRatioCap: 1, antialias: 'fxaa', shadows: 'low', ao: 'off', carReflections: 'static', ssr: 'off',
    bloom: 'low', motionBlur: 'off', dof: false, filmGrain: false, chromaticAberration: false, vignette: true, speedEffects: false,
    godRays: false, drawDistance: 600, detail: 0.55, vegetation: 0.4, particles: 'low', skidmarks: 800, dynamicLights: 2,
    anisotropy: 2, materials: 'standard', textures: 'medium', weatherFx: 'low',
  }),
  medium: P({
    renderScale: 1, pixelRatioCap: 1, antialias: 'smaa', shadows: 'medium', ao: 'off', carReflections: 'static', ssr: 'off',
    bloom: 'low', motionBlur: 'low', dof: false, filmGrain: false, chromaticAberration: false, vignette: true, speedEffects: true,
    godRays: false, drawDistance: 1000, detail: 0.8, vegetation: 0.7, particles: 'medium', skidmarks: 2000, dynamicLights: 4,
    anisotropy: 4, materials: 'standard', textures: 'medium', weatherFx: 'high',
  }),
  high: P({
    renderScale: 1, pixelRatioCap: 1.5, antialias: 'smaa', shadows: 'high', ao: 'low', carReflections: 'dynamic', ssr: 'off',
    bloom: 'high', motionBlur: 'low', dof: false, filmGrain: false, chromaticAberration: false, vignette: true, speedEffects: true,
    godRays: false, drawDistance: 1600, detail: 1, vegetation: 1, particles: 'high', skidmarks: 4000, dynamicLights: 8,
    anisotropy: 8, materials: 'physical', textures: 'high', weatherFx: 'high',
  }),
  ultra: P({
    renderScale: 1, pixelRatioCap: 2, antialias: 'msaa4', shadows: 'ultra', ao: 'medium', carReflections: 'dynamicHigh', ssr: 'low',
    bloom: 'high', motionBlur: 'high', dof: true, filmGrain: true, chromaticAberration: true, vignette: true, speedEffects: true,
    godRays: true, drawDistance: 2500, detail: 1.2, vegetation: 1.2, particles: 'ultra', skidmarks: 6000, dynamicLights: 12,
    anisotropy: 16, materials: 'physical', textures: 'ultra', weatherFx: 'high',
  }),
  ultraPlus: P({
    renderScale: 1, pixelRatioCap: 2, antialias: 'msaa4smaa', shadows: 'extreme', ao: 'high', carReflections: 'dynamicMax', ssr: 'high',
    bloom: 'high', motionBlur: 'high', dof: true, filmGrain: true, chromaticAberration: true, vignette: true, speedEffects: true,
    godRays: true, drawDistance: 3500, detail: 1.4, vegetation: 1.4, particles: 'ultra', skidmarks: 8000, dynamicLights: 16,
    anisotropy: 16, materials: 'physical', textures: 'ultra', weatherFx: 'high',
  }),
  // Ultra++: supersampled (render scale > 1), 8K shadow map, full-res SSR/GTAO, per-frame 512px car reflections.
  ultraPlusPlus: P({
    renderScale: 1.35, pixelRatioCap: 3, antialias: 'msaa8smaa', shadows: 'insane', ao: 'high', carReflections: 'dynamicMax', ssr: 'ultra',
    bloom: 'high', motionBlur: 'high', dof: true, filmGrain: true, chromaticAberration: true, vignette: true, speedEffects: true,
    godRays: true, drawDistance: 4500, detail: 1.5, vegetation: 1.5, particles: 'ultra', skidmarks: 10000, dynamicLights: 24,
    anisotropy: 16, materials: 'physical', textures: 'ultra', weatherFx: 'high',
  }),
};

export const GFX_KEYS = Object.keys(PRESETS.high);

/** Best-guess starting preset from the hardware. Conservative: people can always go up. */
export function detectPreset(gl) {
  let gpu = '';
  try {
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch { /* ignore */ }
  const g = gpu.toLowerCase();
  const mobile = /android|iphone|ipad|mobile/i.test(globalThis.navigator?.userAgent || '');
  if (mobile) return 'low';
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return 'potato';
  if (/rtx\s?(30|40|50)|rx\s?(68|69|78|79|9\d)|apple m\d (max|ultra)|radeon pro w/.test(g)) return 'ultra';
  if (/rtx|gtx\s?1(07|08)|rx\s?(57|66|67|76)|apple m\d pro|arc a7/.test(g)) return 'high';
  if (/intel|uhd|iris|apple m\d|adreno|mali/.test(g)) return 'medium';
  return 'high';
}
