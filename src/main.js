// Entry point. Content (vehicles/*, maps/*) is injected by tools/build.mjs as virtual:content.
import { vehicles, maps } from 'virtual:content';
import { Registry } from './core/Registry.js';
import { Game } from './core/Game.js';

async function boot() {
  const root = document.getElementById('tt-root');
  const registry = new Registry({ vehicles, maps });
  const game = new Game(root, registry);
  window.TT = game; // handy for debugging in the console
  try {
    await game.init();
  } catch (e) {
    console.error('[boot] failed', e);
  }
}
boot();
