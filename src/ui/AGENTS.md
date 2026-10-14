# UI: infotainment head unit, menu scene, HUD

The menus are not a menu overlay: they are the **car's infotainment system**. A 1280x720 DOM "screen" is
projection-mapped (CSS `matrix3d` homography) onto the head unit rectangle of the selected car's real 3D
dashboard, filmed by the menu camera from the driver's seat. Showroom screens (garage, paint, upgrades)
move the camera outside the car and dock the same head unit at the side of the view.

| File | Contents |
|---|---|
| `Infotainment.js` | The head unit: status bar, screen router (stack), dock, focus navigation, placement (`cockpit` / `flat` / `side`). |
| `MenuScene.js` | 3D scene behind the menus: selected car on a rooftop car park above a night city; cockpit and showroom cameras, transitions, depth of field. |
| `UI.js` | DOM layers (stats, HUD, menu, overlays, toasts), boot screen, placement each frame, HUD scale. |
| `HUD.js` | In-game HUD: segmented tachometer + speed, rotating minimap, race / drift panels, countdown, banners. |
| `widgets.js` | Reusable controls (button, selector, slider, toggle, row, tabs, statBars, classBadge, chip, progress, header). |
| `dom.js` | `h(tag, props, ...children)`, `put(el, ...children)` (skips null), `icon(name)`, `bi(en, zh)`. |
| `screens/*.js` | One file per screen. Registry in `screens/index.js`. |
| `styles.css` | All styles (inlined into the HTML by the build). Theme tokens at the top. |

## Screens

```js
// screens/myscreen.js
import { h, header, row, toggle, button } from '../widgets.js';
export default function myscreen({ game, open, back, refresh, info }, params) {
  const el = h('div', {}, header('My screen', '我的畫面', 'subtitle', back), /* content */);
  return { el, camera: 'cockpit' };   // 'cockpit' (inside the car) | 'showroom' (outside, docked) | 'none'
}
```

Register it in `screens/index.js`, open it with `open('myscreen', params)` (`{ root: true }` resets the
stack, `{ replace: true }` swaps the top). Optional hooks on the returned object: `onEnter`, `onExit`,
`onBack()` (return true to swallow back), `onNav(action, focusedEl)` (return true when handled), `tabs` (the
`tabs()` widget, so Q / E / bumpers cycle it). `refresh()` re-renders
the current screen with the same params (use after state changes instead of patching DOM by hand).

Navigation: every focusable element has `data-focus` (widgets add it). Arrow keys / WASD / d-pad move focus
spatially (nearest element in that direction), Enter / Space / A confirm, Esc / Backspace / B go back,
Q / E / LB / RB switch tabs. `data-autofocus` picks the initial focus. Elements fire a `ttfocus` event when
focused (used for live previews: garage list previews the car on focus). Mouse works everywhere too.

Rules:
- Bilingual labels: English + Traditional Chinese (`zh`), Chinese smaller and dimmer.
- The screen is 1280x720 CSS pixels whatever the window size: design for that canvas, keep text at 15 px or
  larger, and keep everything reachable within the visible screen (use `.scroll` panels for long lists).
- Never `element.append(maybeNull)`: it inserts the text "null". Use `put()` or `h()` (both skip null).
- No inline colours: use the CSS tokens so the accent setting (amber, vermilion, jade, ice) works.

## Design language

A real head unit at night, not a website:
- Warm black glass (`--bg`, `--glass`), hairline separators (`--line`), one illumination colour (`--acc`,
  amber by default like an 80s VFD). No blue/purple gradients, no glassmorphism blur, no drop-shadow cards.
- Condensed DIN-style type (`--font`), generous letter spacing on small caps labels, big numerals.
- Large tiles with a huge faint Chinese character as texture (駕, 車, 改...) instead of icons or photos.
- Motion is short and mechanical (120 to 220 ms, ease-out); focus is a solid accent outline plus a soft glow.
- Glare and a subtle scanline on the glass; the screen is lit, so it stays readable when the cabin is dark.

## Placement (how the screen gets onto the dashboard)

`MenuScene.screenQuad()` projects the 4 corners of the car's `anchors.screen` (from
`kit.interior.headUnit`) to window pixels each frame; `Infotainment.setQuad()` computes the homography.
If the projected screen is too small to read (narrow windows) or the setting `display.menuStyle` is
`flat`, it falls back to a centred flat screen. Camera framing for the cockpit is in
`MenuScene.cockpitPose()` (the head unit fills about 80 percent of the view, the dash and windscreen frame it).

## HUD

`HUD.update(dt, session)` reads `session.mode.hud()` (race position, laps, drift chain...) and the player's
telemetry. Sizes use `calc(... * var(--s))`, where `--s` is the user HUD scale times a viewport factor
(designed at 1600x900). Toggle elements with the `display.*` settings; add new HUD panels as DOM in
`HUD.js` and keep per-frame work to text updates (rebuild DOM only when the content changes shape).
