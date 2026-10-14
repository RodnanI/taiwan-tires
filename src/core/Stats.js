// FPS counter / performance overlay (Settings > Display > FPS counter).
export class Stats {
  constructor(parent, settings, loop, renderer) {
    this.settings = settings; this.loop = loop; this.renderer = renderer;
    this.el = document.createElement('div');
    this.el.className = 'tt-stats';
    parent.appendChild(this.el);
    this.t = 0;
    this.history = new Float32Array(90);
    this.hi = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 90; this.canvas.height = 24;
    this.canvas.className = 'tt-stats-graph';
  }
  update(dt, extra = {}) {
    const mode = this.settings.get('display.fpsCounter');
    this.el.style.display = mode === 'off' ? 'none' : 'block';
    this.el.dataset.pos = this.settings.get('display.fpsCounterPos');
    if (mode === 'off') return;
    this.history[this.hi++ % 90] = dt * 1000;
    this.t += dt;
    if (this.t < 0.25) return;
    this.t = 0;
    const s = this.loop.stats;
    const cap = this.settings.get('display.fpsCap');
    const fpsCls = s.fps >= 55 ? 'good' : s.fps >= 30 ? 'ok' : 'bad';
    let html = `<b class="${fpsCls}">${Math.round(s.fps)}</b><i>FPS</i>`;
    if (mode !== 'fps') html += `<span>${s.frameMs.toFixed(1)} ms</span>`;
    if (mode === 'full') {
      const r = this.renderer.stats;
      html += `<div class="tt-stats-rows">
        <div><i>CPU sim</i>${s.simMs.toFixed(2)} ms <i>(${s.steps} steps)</i></div>
        <div><i>CPU frame</i>${s.renderMs.toFixed(2)} ms</div>
        <div><i>draws</i>${r.calls} <i>tris</i>${(r.triangles / 1000).toFixed(0)}k</div>
        <div><i>display</i>${s.refreshHz} Hz <i>cap</i>${cap === 'vsync' ? 'vsync' : cap === 0 ? 'none' : cap}</div>
        <div><i>render</i>${this.renderer.three.domElement.width}×${this.renderer.three.domElement.height}</div>
        ${extra.physicsHz ? `<div><i>physics</i>${extra.physicsHz} Hz</div>` : ''}
      </div>`;
    }
    this.el.innerHTML = html;
    if (mode !== 'fps') {
      const g = this.canvas.getContext('2d');
      g.clearRect(0, 0, 90, 24);
      for (let i = 0; i < 90; i++) {
        const v = this.history[(this.hi + i) % 90];
        const h = Math.min(24, v / 50 * 24);
        g.fillStyle = v > 33.4 ? '#ff4d3d' : v > 17.5 ? '#ffb02e' : '#49d18c';
        g.fillRect(i, 24 - h, 1, h);
      }
      this.el.appendChild(this.canvas);
    }
  }
}
