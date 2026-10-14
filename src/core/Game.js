// Top-level orchestrator: owns every long-lived system and the state machine
//   boot -> menu <-> loading -> driving <-> paused -> results -> menu
import { Events } from './Events.js';
import { Settings } from './Settings.js';
import { Profile } from './Profile.js';
import { Loop } from './Loop.js';
import { Stats } from './Stats.js';
import { Renderer } from '../render/Renderer.js';
import { detectPreset } from '../render/Quality.js';
import { Input } from '../input/Input.js';
import { Session } from '../gameplay/Session.js';
import { previewRoute } from '../maps/MapLoader.js';
import { AudioSystem } from '../audio/AudioSystem.js';
import { UI } from '../ui/UI.js';
import { HUD } from '../ui/HUD.js';
import { MenuScene } from '../ui/MenuScene.js';

const ACCENTS = { amber: '#ff9a2e', vermilion: '#ff4a32', jade: '#3fd39a', ice: '#e8eef2' };

export class Game {
  constructor(root, registry) {
    this.root = root;
    this.registry = registry;
    this.state = 'boot';
    this.session = null;
  }

  async init() {
    this.events = new Events();
    this.settings = new Settings(this.events);
    this.profile = new Profile(this.events, this.registry);
    try {
      this.renderer = new Renderer(this.root);
    } catch (e) {
      this.root.innerHTML = `<div class="tt-fatal"><h1>WebGL2 unavailable</h1><p>${e.message}</p><p>Try another browser or enable hardware acceleration.</p></div>`;
      throw e;
    }
    if (this.settings.firstRun) this.settings.applyPreset(detectPreset(this.renderer.gl));
    this.input = new Input(this.settings, this.events);
    this.audio = new AudioSystem(this);
    this.loop = new Loop({ onFixed: (dt) => this.fixedUpdate(dt), onFrame: (dt, alpha) => this.frame(dt, alpha) });
    this.ui = new UI(this);
    this.hud = new HUD(this);
    this.stats = new Stats(this.ui.layer('stats'), this.settings, this.loop, this.renderer);
    this.menu = new MenuScene(this);
    this.applySettings();
    this.events.on('settings:changed', (e) => this.onSetting(e));
    this.renderer.onResize((w, h) => { this.session?.onResize(w, h); this.menu?.onResize(w, h); });
    this.events.on('session:finished', (r) => setTimeout(() => this.showResults(r), 2600));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'driving') this.pause(); this.audio.setHidden(document.hidden); });
    this.loop.start();
    this.ui.showBoot();
  }

  accentHex() { return ACCENTS[this.settings.get('display.uiAccent')] || ACCENTS.amber; }

  applySettings() {
    const s = this.settings;
    this.renderer.applyQuality(s.gfx());
    this.loop.setFpsCap(s.get('display.fpsCap'));
    this.loop.setFixedRate(Number(s.get('gameplay.physicsHz')) || 240);
    this.audio.applyVolumes();
    this.ui.applyTheme();
  }
  onSetting({ key }) {
    const s = this.settings;
    if (key === '*' || key.startsWith('gfx.')) {
      this.renderer.applyQuality(s.gfx());
      if (this.session) this.reapplyQualityToSession();
      this.menu?.applyQuality();
    }
    if (key === 'display.fpsCap' || key === '*') this.loop.setFpsCap(s.get('display.fpsCap'));
    if (key === 'gameplay.physicsHz') this.loop.setFixedRate(Number(s.get('gameplay.physicsHz')) || 240);
    if (key.startsWith('audio.') || key === '*') this.audio.applyVolumes();
    if (key === 'display.uiAccent' || key === '*' || key === 'display.menuStyle' || key === 'display.hudScale') this.ui.applyTheme();
    if (this.session && (key.startsWith('assist.') || key.startsWith('controls.'))) for (const v of [this.session.player]) this.session.applyAssists(v.physics);
  }
  reapplyQualityToSession() {
    const S = this.session, q = this.settings.gfx();
    S.q = q;
    S.env.applyQuality(q, this.renderer.three);
    S.lights.setPoolSize(q.dynamicLights);
    S.particles.setBudget(q.particles);
    S.skids.setBudget(q.skidmarks);
    S.rig.setFar(q.drawDistance);
    S.player.enableHeadlightLights(false);
    S.player.enableHeadlightLights(q.dynamicLights > 0, S.scene, q.shadows === 'insane' || q.shadows === 'extreme');
    this.renderer.refreshMaterials(S.scene);
  }

  // ------------------------------------------------------------------------------------ states
  setState(s) { this.state = s; this.input.mode = s === 'driving' ? 'drive' : 'menu'; this.events.emit('game:state', s); }

  /** Called from the boot screen (user gesture: unlocks audio). */
  async start() {
    await this.audio.unlock();
    this.setState('menu');
    this.menu.enter();
    this.ui.showMenu();
  }

  /** o: { mapId, eventId, time, weather, aiCount, difficulty } */
  /** Event route without loading the map (AI tune lap estimates). Cached; null if the road is built in code. */
  routeCache(map, event) {
    const key = `${map.id}/${event.id}`;
    this._routes ||= new Map();
    if (!this._routes.has(key)) {
      let r = null;
      try { r = previewRoute(map, event); } catch (e) { console.warn(`route preview ${key} failed`, e); }
      this._routes.set(key, r);
    }
    return this._routes.get(key);
  }
  async startSession(o) {
    if (this.session) this.endSession(false);
    this.setState('loading');
    this.menu.exit();
    this.ui.showLoading(o);
    const car = this.profile.selectedCar();
    const session = new Session(this, { ...o, car });
    try {
      await session.load((p, label) => this.ui.loadingProgress(p, label));
    } catch (e) {
      console.error(e);
      this.ui.toast(`Failed to load: ${e.message}`);
      session.dispose?.();
      this.setState('menu'); this.menu.enter(); this.ui.showMenu();
      return;
    }
    this.session = session;
    this.ui.showHUD();
    this.setState('driving');
    this.audio.sessionStarted(session);
  }
  async switchEvent(event) {
    if (!this.session) return;
    this.ui.closePause();
    await this.session.startMode(event);
    this.session.setPaused(false);
    this.ui.showHUD();
    this.setState('driving');
  }
  endSession(toMenu = true) {
    if (!this.session) return;
    this.audio.sessionEnded();
    this.session.dispose();
    this.session = null;
    if (toMenu) { this.setState('menu'); this.menu.enter(); this.ui.showMenu(); }
  }
  restartSession() {
    if (!this.session) return;
    const ev = this.session.event;
    this.switchEvent(ev);
  }
  pause() {
    if (this.state !== 'driving' || !this.session) return;
    this.session.setPaused(true);
    this.setState('paused');
    this.audio.setPaused(true);
    this.ui.showPause();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.session.setPaused(false);
    this.setState('driving');
    this.audio.setPaused(false);
    this.ui.closePause();
  }
  showResults(r) {
    if (!this.session) return;
    this.setState('results');
    this.ui.showResults(r);
  }

  // ------------------------------------------------------------------------------------ loop
  fixedUpdate(dt) {
    if (this.state === 'driving' || this.state === 'results') this.session?.fixedUpdate(dt);
  }
  frame(dt, alpha) {
    const speed = this.session?.player.physics.tel.speed || 0;
    this.input.update(dt, speed);
    if (this.state === 'driving' && this.input.pressed.pause) this.pause();
    else if (this.state === 'paused' && this.input.pressed.pause) this.resume();
    if (this.session && (this.state === 'driving' || this.state === 'paused' || this.state === 'results')) {
      this.session.update(dt, alpha);
      this.session.render(this.renderer);
    } else if (this.state === 'menu' || this.state === 'boot') {
      this.menu.update(dt);
      this.menu.render(this.renderer);
    }
    this.audio.update(dt);
    this.ui.update(dt);
    this.stats.update(dt, { physicsHz: this.loop.fixedHz });
  }
}
