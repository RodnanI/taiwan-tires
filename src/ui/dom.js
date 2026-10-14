// Tiny DOM helpers + line icons (no framework, no image files).
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
/** Append children, skipping null/false (Element.append would insert the text "null"). */
export function put(el, ...children) {
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c);
  return el;
}
/** Bilingual label: English + small Traditional Chinese. */
export const bi = (en, zh) => [en, zh ? h('span.zh', {}, ' ' + zh) : null];

const P = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  drive: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 6a3 3 0 100 6 3 3 0 000-6zM3.5 10.5l5.6 1M14.9 11.5l5.6-1M12 15v6',
  garage: 'M3 21V9l9-5 9 5v12M7 21v-7h10v7M7 17h10',
  dealer: 'M4 7h16l-1.5 9h-13zM8 7V5a4 4 0 018 0v2M9 11h6',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  radio: 'M4 9h16v11H4zM7 9l10-5M8 14a2 2 0 104 0 2 2 0 00-4 0M15 13h3M15 16h3',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  back: 'M15 5l-7 7 7 7',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  tune: 'M5 4v16M12 4v16M19 4v16M3 9h4M10 15h4M17 7h4',
  wrench: 'M14 6a4 4 0 00-5 5l-6 6 3 3 6-6a4 4 0 005-5l-2 2-3-1-1-3z',
  paint: 'M4 20c3 0 4-2 4-4a3 3 0 113 3c0 2-2 1-7 1zM12 13l8-9',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  play: 'M7 5l12 7-12 7z',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
};
export function icon(name, size = 24) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', P[name] || P.home);
  s.appendChild(p);
  return s;
}
