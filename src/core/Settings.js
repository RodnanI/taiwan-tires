// Settings schema + persistence. The Settings UI is generated from SCHEMA, so adding a setting here is
// enough for it to appear in the menu. Listen for changes with events.on('settings:changed', ({key, value})).
import { storage } from './storage.js';
import { PRESETS, QUALITY_LEVELS, QUALITY_LABELS, GFX_KEYS } from '../render/Quality.js';
import { DEFAULT_KEYS, DEFAULT_PAD } from '../input/bindings.js';

const STORAGE_KEY = 'tt.settings.v1';
const opt = (pairs) => pairs.map((p) => (Array.isArray(p) ? { value: p[0], label: p[1] } : { value: p, label: String(p) }));
const onOff = { type: 'toggle' };

// cat: tab in the settings screen. group: sub-heading inside the tab.
export const SCHEMA = [
  // ---- Graphics -----------------------------------------------------------------------------
  { key: 'gfx.preset', cat: 'graphics', group: 'Preset', label: 'Quality preset', zh: '畫質', type: 'enum', default: 'high',
    options: opt([...QUALITY_LEVELS.map((l) => [l, QUALITY_LABELS[l]]), ['custom', 'Custom']]),
    desc: 'Potato runs on anything. Ultra++ supersamples, uses an 8K shadow map, full-res SSR + GTAO and per-frame car reflections. Changing any option below switches to Custom.' },
  { key: 'gfx.renderScale', cat: 'graphics', group: 'Resolution', label: 'Render scale', type: 'range', min: 0.35, max: 2, step: 0.05, fmt: 'pct', desc: 'Internal resolution. Above 100% is supersampling.' },
  { key: 'gfx.pixelRatioCap', cat: 'graphics', group: 'Resolution', label: 'Max pixel density', type: 'enum', options: opt([[1, '1x'], [1.5, '1.5x'], [2, '2x (Retina)'], [3, 'Native']]) },
  { key: 'gfx.antialias', cat: 'graphics', group: 'Resolution', label: 'Anti-aliasing', type: 'enum',
    options: opt([['off', 'Off'], ['fxaa', 'FXAA'], ['smaa', 'SMAA'], ['msaa4', 'MSAA 4x'], ['msaa4smaa', 'MSAA 4x + SMAA'], ['msaa8smaa', 'MSAA 8x + SMAA']]) },
  { key: 'gfx.shadows', cat: 'graphics', group: 'Lighting', label: 'Shadows', type: 'enum',
    options: opt([['off', 'Off'], ['blob', 'Blob'], ['low', 'Low 1K'], ['medium', 'Medium 2K'], ['high', 'High 2K soft'], ['ultra', 'Ultra 4K'], ['extreme', 'Extreme 4K far'], ['insane', 'Insane 8K']]) },
  { key: 'gfx.ao', cat: 'graphics', group: 'Lighting', label: 'Ambient occlusion (GTAO)', type: 'enum', options: opt([['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]) },
  { key: 'gfx.dynamicLights', cat: 'graphics', group: 'Lighting', label: 'Dynamic lights', type: 'range', min: 0, max: 24, step: 1, desc: 'Real lights given to the nearest street lamps. The rest are faked.' },
  { key: 'gfx.godRays', cat: 'graphics', group: 'Lighting', label: 'Light shafts', ...onOff },
  { key: 'gfx.carReflections', cat: 'graphics', group: 'Reflections', label: 'Car reflections', type: 'enum',
    options: opt([['off', 'Off'], ['static', 'Static sky'], ['dynamic', 'Dynamic 128'], ['dynamicHigh', 'Dynamic 256'], ['dynamicMax', 'Dynamic every frame']]) },
  { key: 'gfx.ssr', cat: 'graphics', group: 'Reflections', label: 'Screen-space reflections', type: 'enum', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']]), desc: 'Wet-road and floor reflections.' },
  { key: 'gfx.materials', cat: 'graphics', group: 'Detail', label: 'Material quality', type: 'enum', options: opt([['basic', 'Basic'], ['standard', 'Standard PBR'], ['physical', 'Physical (clearcoat)']]), restart: true },
  { key: 'gfx.textures', cat: 'graphics', group: 'Detail', label: 'Texture quality', type: 'enum', options: opt([['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']]), restart: true },
  { key: 'gfx.anisotropy', cat: 'graphics', group: 'Detail', label: 'Texture filtering', type: 'enum', options: opt([[1, 'Bilinear'], [2, '2x AF'], [4, '4x AF'], [8, '8x AF'], [16, '16x AF']]), restart: true },
  { key: 'gfx.drawDistance', cat: 'graphics', group: 'Detail', label: 'Draw distance', type: 'range', min: 250, max: 4500, step: 50, fmt: 'm' },
  { key: 'gfx.detail', cat: 'graphics', group: 'Detail', label: 'World detail', type: 'range', min: 0.25, max: 1.5, step: 0.05, fmt: 'pct', restart: true },
  { key: 'gfx.vegetation', cat: 'graphics', group: 'Detail', label: 'Vegetation density', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: 'pct', restart: true },
  { key: 'gfx.particles', cat: 'graphics', group: 'Effects', label: 'Particles / tyre smoke', type: 'enum', options: opt([['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']]) },
  { key: 'gfx.skidmarks', cat: 'graphics', group: 'Effects', label: 'Skid marks', type: 'range', min: 0, max: 10000, step: 100, restart: true },
  { key: 'gfx.weatherFx', cat: 'graphics', group: 'Effects', label: 'Weather effects', type: 'enum', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High']]) },
  { key: 'gfx.bloom', cat: 'graphics', group: 'Post-processing', label: 'Bloom', type: 'enum', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High']]) },
  { key: 'gfx.motionBlur', cat: 'graphics', group: 'Post-processing', label: 'Motion blur', type: 'enum', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High']]) },
  { key: 'gfx.speedEffects', cat: 'graphics', group: 'Post-processing', label: 'Speed streaks', ...onOff },
  { key: 'gfx.dof', cat: 'graphics', group: 'Post-processing', label: 'Depth of field (menus/photo)', ...onOff },
  { key: 'gfx.vignette', cat: 'graphics', group: 'Post-processing', label: 'Vignette', ...onOff },
  { key: 'gfx.filmGrain', cat: 'graphics', group: 'Post-processing', label: 'Film grain', ...onOff },
  { key: 'gfx.chromaticAberration', cat: 'graphics', group: 'Post-processing', label: 'Chromatic aberration', ...onOff },
  { key: 'gfx.toneMapping', cat: 'graphics', group: 'Color', label: 'Tone mapping', type: 'enum', default: 'agx', options: opt([['aces', 'ACES Filmic'], ['agx', 'AgX'], ['neutral', 'Khronos Neutral']]) },
  { key: 'gfx.exposure', cat: 'graphics', group: 'Color', label: 'Exposure', type: 'range', min: 0.4, max: 2.5, step: 0.05, default: 1, fmt: 'x' },
  { key: 'gfx.saturation', cat: 'graphics', group: 'Color', label: 'Saturation', type: 'range', min: 0, max: 1.6, step: 0.05, default: 1.08, fmt: 'x' },

  // ---- Display ------------------------------------------------------------------------------
  { key: 'display.fpsCap', cat: 'display', group: 'Frame rate', label: 'Frame rate limit', zh: '幀率', type: 'enum', default: 'vsync',
    options: opt([['vsync', 'VSync (display)'], [30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90'], [120, '120'], [144, '144'], [165, '165'], [240, '240'], [360, '360'], [0, 'Unlimited']]),
    desc: 'Unlimited renders as fast as possible. Browsers still show frames at your monitor refresh rate.' },
  { key: 'display.fpsCounter', cat: 'display', group: 'Frame rate', label: 'FPS counter', type: 'enum', default: 'off',
    options: opt([['off', 'Off'], ['fps', 'FPS'], ['frametime', 'FPS + frame time'], ['full', 'Full stats']]) },
  { key: 'display.fpsCounterPos', cat: 'display', group: 'Frame rate', label: 'Counter position', type: 'enum', default: 'tr', options: opt([['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']]) },
  { key: 'display.fov', cat: 'display', group: 'Camera', label: 'Field of view', type: 'range', min: 50, max: 100, step: 1, default: 68, fmt: 'deg' },
  { key: 'display.cockpitFov', cat: 'display', group: 'Camera', label: 'Cockpit field of view', type: 'range', min: 45, max: 100, step: 1, default: 62, fmt: 'deg' },
  { key: 'display.speedFov', cat: 'display', group: 'Camera', label: 'Speed FOV boost', type: 'range', min: 0, max: 1.5, step: 0.05, default: 1, fmt: 'pct' },
  { key: 'display.cameraShake', cat: 'display', group: 'Camera', label: 'Camera shake', type: 'range', min: 0, max: 1.5, step: 0.05, default: 1, fmt: 'pct' },
  { key: 'display.defaultCamera', cat: 'display', group: 'Camera', label: 'Default camera', type: 'enum', default: 'chase', options: opt([['chase', 'Chase'], ['chaseFar', 'Chase far'], ['hood', 'Hood'], ['bumper', 'Bumper'], ['cockpit', 'Cockpit']]) },
  { key: 'display.units', cat: 'display', group: 'HUD', label: 'Speed units', type: 'enum', default: 'kmh', options: opt([['kmh', 'km/h'], ['mph', 'mph']]) },
  { key: 'display.hudScale', cat: 'display', group: 'HUD', label: 'HUD scale', type: 'range', min: 0.6, max: 1.5, step: 0.05, default: 1, fmt: 'pct' },
  { key: 'display.hud', cat: 'display', group: 'HUD', label: 'Show HUD', type: 'toggle', default: true },
  { key: 'display.minimapRotate', cat: 'display', group: 'HUD', label: 'Rotating minimap', type: 'toggle', default: true },
  { key: 'display.racingLine', cat: 'display', group: 'HUD', label: 'Racing line', type: 'enum', default: 'braking', options: opt([['off', 'Off'], ['braking', 'Braking zones only'], ['full', 'Full line']]) },
  { key: 'display.menuStyle', cat: 'display', group: 'Menus', label: 'Menu style', type: 'enum', default: 'cockpit', options: opt([['cockpit', 'In-car head unit (3D)'], ['flat', 'Flat (accessibility)']]) },
  { key: 'display.uiAccent', cat: 'display', group: 'Menus', label: 'Head unit illumination', type: 'enum', default: 'amber', options: opt([['amber', 'Amber'], ['vermilion', 'Temple red'], ['jade', 'Jade'], ['ice', 'White']]) },

  // ---- Audio --------------------------------------------------------------------------------
  { key: 'audio.master', cat: 'audio', group: 'Volume', label: 'Master', zh: '音量', type: 'range', min: 0, max: 1, step: 0.05, default: 0.8, fmt: 'pct' },
  { key: 'audio.engine', cat: 'audio', group: 'Volume', label: 'Engine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.85, fmt: 'pct' },
  { key: 'audio.sfx', cat: 'audio', group: 'Volume', label: 'Tyres & effects', type: 'range', min: 0, max: 1, step: 0.05, default: 0.8, fmt: 'pct' },
  { key: 'audio.music', cat: 'audio', group: 'Volume', label: 'Radio', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5, fmt: 'pct' },
  { key: 'audio.ui', cat: 'audio', group: 'Volume', label: 'Interface', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6, fmt: 'pct' },
  { key: 'audio.station', cat: 'audio', group: 'Radio', label: 'Station', zh: '電台', type: 'enum', default: 'citypop', options: opt([['off', 'Off'], ['citypop', 'City Pop 88.1'], ['eurobeat', 'Touge 155 (Eurobeat)'], ['lofi', 'Night Market 92.7 (Lo-fi)']]) },
  { key: 'audio.radioInRace', cat: 'audio', group: 'Radio', label: 'Radio while driving', type: 'toggle', default: true },
  { key: 'audio.muteUnfocused', cat: 'audio', group: 'Radio', label: 'Mute when tab hidden', type: 'toggle', default: true },

  // ---- Controls -----------------------------------------------------------------------------
  { key: 'controls.transmission', cat: 'controls', group: 'Driving', label: 'Transmission', zh: '變速箱', type: 'enum', default: 'auto', options: opt([['auto', 'Automatic'], ['manual', 'Manual'], ['manualClutch', 'Manual with clutch']]) },
  { key: 'controls.steerSensitivity', cat: 'controls', group: 'Steering', label: 'Steering sensitivity', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1, fmt: 'x' },
  { key: 'controls.steerLinearity', cat: 'controls', group: 'Steering', label: 'Stick linearity', type: 'range', min: 1, max: 3, step: 0.1, default: 1.4, fmt: 'x', desc: '1 = linear. Higher = finer control near center.' },
  { key: 'controls.keyboardSteerSpeed', cat: 'controls', group: 'Steering', label: 'Keyboard steer speed', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1, fmt: 'x' },
  { key: 'controls.speedSensitiveSteering', cat: 'controls', group: 'Steering', label: 'Speed-sensitive steering', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55, fmt: 'pct' },
  { key: 'controls.deadzone', cat: 'controls', group: 'Gamepad', label: 'Stick deadzone', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.08, fmt: 'pct' },
  { key: 'controls.triggerDeadzone', cat: 'controls', group: 'Gamepad', label: 'Trigger deadzone', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.04, fmt: 'pct' },
  { key: 'controls.vibration', cat: 'controls', group: 'Gamepad', label: 'Vibration', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7, fmt: 'pct' },
  { key: 'controls.keys', cat: 'controls', group: 'Bindings', label: 'Keyboard bindings', type: 'bindings', device: 'keyboard', default: DEFAULT_KEYS },
  { key: 'controls.pad', cat: 'controls', group: 'Bindings', label: 'Gamepad bindings', type: 'bindings', device: 'gamepad', default: DEFAULT_PAD },

  // ---- Gameplay / assists -------------------------------------------------------------------
  { key: 'assist.abs', cat: 'gameplay', group: 'Assists', label: 'ABS', type: 'toggle', default: true },
  { key: 'assist.tcs', cat: 'gameplay', group: 'Assists', label: 'Traction control', type: 'enum', default: 'low', desc: 'Turn off for drifting and burnouts.', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High']]) },
  { key: 'assist.stability', cat: 'gameplay', group: 'Assists', label: 'Stability control', type: 'enum', default: 'off', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High']]) },
  { key: 'assist.counterSteer', cat: 'gameplay', group: 'Assists', label: 'Counter-steer assist', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6, fmt: 'pct', desc: 'Helps catch slides, mostly for keyboard.' },
  { key: 'assist.handbrakeClutch', cat: 'gameplay', group: 'Assists', label: 'Handbrake disengages clutch', type: 'toggle', default: true },
  { key: 'assist.revMatch', cat: 'gameplay', group: 'Assists', label: 'Auto rev-match downshifts', type: 'toggle', default: true },
  { key: 'gameplay.difficulty', cat: 'gameplay', group: 'Opponents', label: 'AI difficulty', zh: '難度', type: 'enum', default: 'pro', options: opt([['rookie', 'Rookie'], ['amateur', 'Amateur'], ['pro', 'Pro'], ['expert', 'Expert'], ['legend', 'Legend']]) },
  { key: 'gameplay.rubberBand', cat: 'gameplay', group: 'Opponents', label: 'Catch-up (rubber band)', type: 'enum', default: 'low', options: opt([['off', 'Off'], ['low', 'Low'], ['high', 'High']]) },
  { key: 'gameplay.collisions', cat: 'gameplay', group: 'Opponents', label: 'Car collisions', type: 'enum', default: 'on', options: opt([['on', 'On'], ['ghostStart', 'Ghost first 10 s'], ['off', 'Ghost (off)']]) },
  { key: 'gameplay.rewind', cat: 'gameplay', group: 'World', label: 'Rewind', type: 'toggle', default: true },
  { key: 'gameplay.physicsHz', cat: 'gameplay', group: 'Simulation', label: 'Physics rate', type: 'enum', default: 240, options: opt([[120, '120 Hz'], [240, '240 Hz'], [360, '360 Hz'], [480, '480 Hz']]), desc: 'Higher is smoother and more stable but costs CPU.' },
];

const BY_KEY = new Map(SCHEMA.map((s) => [s.key, s]));
export const settingDef = (key) => BY_KEY.get(key);

function defaults() {
  const out = {};
  for (const s of SCHEMA) {
    if (s.default !== undefined) out[s.key] = structuredClone(s.default);
  }
  for (const k of GFX_KEYS) out['gfx.' + k] = PRESETS[out['gfx.preset']][k];
  return out;
}

export class Settings {
  constructor(events) {
    this.events = events;
    this.values = defaults();
    const stored = storage.get(STORAGE_KEY);
    this.firstRun = !stored;
    if (stored && typeof stored === 'object') {
      for (const [k, v] of Object.entries(stored)) if (BY_KEY.has(k) || k.startsWith('gfx.')) this.values[k] = v;
      // keep binding tables complete when new actions were added after the save
      for (const k of ['controls.keys', 'controls.pad']) this.values[k] = { ...BY_KEY.get(k).default, ...(this.values[k] || {}) };
    }
  }
  get(key) { return this.values[key]; }
  /** All gfx.* values resolved into a plain object for the renderer. */
  gfx() {
    const o = {};
    for (const k of GFX_KEYS) o[k] = this.values['gfx.' + k];
    o.toneMapping = this.values['gfx.toneMapping']; o.exposure = this.values['gfx.exposure']; o.saturation = this.values['gfx.saturation'];
    return o;
  }
  set(key, value, { silent = false, fromPreset = false } = {}) {
    const def = BY_KEY.get(key);
    if (def?.type === 'range') value = Math.min(def.max, Math.max(def.min, Number(value)));
    if (def?.type === 'enum') {
      const match = def.options.find((o) => String(o.value) === String(value));
      if (!match) return;
      value = match.value;
    }
    if (this.values[key] === value && def?.type !== 'bindings') return;
    this.values[key] = value;
    if (key === 'gfx.preset' && value !== 'custom') { this.applyPreset(value); return; }
    if (key.startsWith('gfx.') && GFX_KEYS.includes(key.slice(4)) && !fromPreset && this.values['gfx.preset'] !== 'custom') {
      this.values['gfx.preset'] = 'custom';
      this.events?.emit('settings:changed', { key: 'gfx.preset', value: 'custom' });
    }
    this.save();
    if (!silent) this.events?.emit('settings:changed', { key, value });
  }
  applyPreset(level) {
    const p = PRESETS[level];
    if (!p) return;
    this.values['gfx.preset'] = level;
    for (const k of GFX_KEYS) this.values['gfx.' + k] = p[k];
    this.save();
    this.events?.emit('settings:changed', { key: 'gfx.preset', value: level, preset: true });
  }
  resetCategory(cat) {
    const d = defaults();
    for (const s of SCHEMA) if (s.cat === cat && d[s.key] !== undefined) this.values[s.key] = structuredClone(d[s.key]);
    if (cat === 'graphics') { this.applyPreset(this.values['gfx.preset'] === 'custom' ? 'high' : this.values['gfx.preset']); return; }
    this.save();
    this.events?.emit('settings:changed', { key: '*', cat });
  }
  save() { storage.set(STORAGE_KEY, this.values); }
}
