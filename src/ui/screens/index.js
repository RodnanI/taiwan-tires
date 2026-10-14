// Screen registry. A screen is (ctx, params) => { el, camera?: 'cockpit'|'showroom'|'none', tabs?, onNav?, onEnter?, onExit?, onBack? }.
// Add a screen: create the file, register it here, open it with ctx.open('id', params). See src/ui/AGENTS.md.
import home from './home.js';
import drive from './drive.js';
import event from './event.js';
import garage from './garage.js';
import upgrades from './upgrades.js';
import tuning from './tuning.js';
import aitune from './aitune.js';
import paint from './paint.js';
import dealer from './dealer.js';
import settings from './settings.js';
import { profile, pause, results } from './misc.js';

export const SCREENS = { home, drive, event, garage, upgrades, tuning, aitune, paint, dealer, settings, profile, pause, results };
