// Canvas factory that works in browsers, workers and Node (validation runs content builders headless).
const noop = () => {};
function stubContext() {
  return new Proxy({}, {
    get: (t, k) => {
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      return t[k] ?? noop;
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
export const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

export function makeCanvas(w, h) {
  if (HAS_DOM) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const ctx = stubContext();
  return { width: w, height: h, getContext: () => ctx, isStub: true };
}

/** CJK-capable UI font stack (signs, plates, menus). */
export const FONT_CJK = '"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei","Heiti TC","Source Han Sans TC",sans-serif';
export const FONT_UI = 'Bahnschrift,"DIN Alternate","DIN Condensed","Barlow Condensed","Roboto Condensed","Arial Narrow",sans-serif';
