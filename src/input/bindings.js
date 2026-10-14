// Input actions and their default bindings. Keyboard uses KeyboardEvent.code, gamepads use the W3C
// "standard" mapping (Xbox layout names below). Players can rebind in Settings > Controls.
export const ACTIONS = {
  throttle: { label: 'Throttle', zh: '油門', analog: true },
  brake: { label: 'Brake / Reverse', zh: '煞車', analog: true },
  steerLeft: { label: 'Steer left', zh: '左轉', analog: true },
  steerRight: { label: 'Steer right', zh: '右轉', analog: true },
  handbrake: { label: 'Handbrake', zh: '手煞車', analog: true },
  clutch: { label: 'Clutch', zh: '離合器', analog: true },
  shiftUp: { label: 'Shift up', zh: '升檔' },
  shiftDown: { label: 'Shift down', zh: '降檔' },
  nitrous: { label: 'Nitrous', zh: '氮氣' },
  camera: { label: 'Change camera', zh: '視角' },
  lookBack: { label: 'Look back', zh: '後視' },
  reset: { label: 'Reset to road', zh: '重置' },
  rewind: { label: 'Rewind (hold)', zh: '倒帶' },
  horn: { label: 'Horn', zh: '喇叭' },
  lights: { label: 'Headlights', zh: '大燈' },
  radio: { label: 'Next radio station', zh: '電台' },
  pause: { label: 'Pause / menu', zh: '暫停' },
};

export const DEFAULT_KEYS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  clutch: ['ShiftLeft'],
  shiftUp: ['KeyE'],
  shiftDown: ['KeyQ'],
  nitrous: ['KeyF'],
  camera: ['KeyC'],
  lookBack: ['KeyB'],
  reset: ['KeyR'],
  rewind: ['Backspace'],
  horn: ['KeyH'],
  lights: ['KeyL'],
  radio: ['KeyM'],
  pause: ['Escape', 'KeyP'],
};

// { b: buttonIndex } or { a: axisIndex, d: +1|-1 }
export const DEFAULT_PAD = {
  throttle: [{ b: 7 }],
  brake: [{ b: 6 }],
  steerLeft: [{ a: 0, d: -1 }],
  steerRight: [{ a: 0, d: 1 }],
  handbrake: [{ b: 0 }],
  clutch: [{ b: 4 }],
  shiftUp: [{ b: 1 }],
  shiftDown: [{ b: 2 }],
  nitrous: [{ b: 5 }],
  camera: [{ b: 8 }],
  lookBack: [{ b: 11 }],
  reset: [{ b: 12 }],
  rewind: [{ b: 3 }],
  horn: [{ b: 10 }],
  lights: [{ b: 13 }],
  radio: [{ b: 14 }],
  pause: [{ b: 9 }],
};

export const PAD_BUTTON_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];
export const PAD_AXIS_NAMES = ['Left X', 'Left Y', 'Right X', 'Right Y'];

export function keyLabel(code) {
  if (!code) return 'none';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Escape: 'Esc', Backspace: 'Bksp', Enter: 'Enter', Tab: 'Tab' };
  return map[code] || code;
}
export function padLabel(b) {
  if (!b) return 'none';
  if (b.b != null) return PAD_BUTTON_NAMES[b.b] || `B${b.b}`;
  return `${PAD_AXIS_NAMES[b.a] || 'Axis ' + b.a} ${b.d > 0 ? '+' : '−'}`;
}
