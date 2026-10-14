// Frame scheduler: fixed-timestep simulation + variable-rate rendering with an FPS cap.
//   fpsCap = 'vsync'  -> requestAnimationFrame (presents at display refresh)
//   fpsCap = N        -> paced to N fps (rAF when N <= refresh, MessageChannel scheduler above refresh)
//   fpsCap = 0        -> unlimited: MessageChannel scheduler, renders as fast as the CPU/GPU allow.
// Honest note: browsers still present frames at the display refresh rate. Unlimited / above-refresh caps
// raise the simulated + rendered frame count (lower input latency, higher measured FPS) like an uncapped
// game without vsync, but the extra frames are never all shown.
export class Loop {
  constructor({ onFixed, onFrame, fixedHz = 240 }) {
    this.onFixed = onFixed;
    this.onFrame = onFrame;
    this.setFixedRate(fixedHz);
    this.fpsCap = 'vsync';
    this.timeScale = 1;
    this.simPaused = false;
    this.running = false;
    this.maxSteps = 24;
    this.acc = 0;
    this.last = 0;
    this.nextDeadline = 0;
    this.refreshHz = 60;
    this._rafDeltas = [];
    this._probeLast = 0;
    this.stats = { fps: 0, frameMs: 0, simMs: 0, renderMs: 0, steps: 0, refreshHz: 60, frames: 0 };
    this._fpsFrames = 0; this._fpsTime = 0; this._simAcc = 0; this._renderAcc = 0; this._frameAcc = 0;
    const ch = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
    if (ch) { ch.port1.onmessage = () => this._tick(); this._post = () => ch.port2.postMessage(0); }
    else this._post = () => setTimeout(() => this._tick(), 0);
    this._rafTick = (t) => this._tick(t);
    this._probe = (t) => {
      if (this._probeLast) {
        const d = t - this._probeLast;
        if (d > 2 && d < 100) { this._rafDeltas.push(d); if (this._rafDeltas.length > 40) this._rafDeltas.shift(); }
        if (this._rafDeltas.length >= 10 && (this.stats.frames & 31) === 0) {
          const s = [...this._rafDeltas].sort((a, b) => a - b);
          this.refreshHz = Math.round(1000 / s[s.length >> 1]);
          this.stats.refreshHz = this.refreshHz;
        }
      }
      this._probeLast = t;
      if (this.running) requestAnimationFrame(this._probe);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.running) { this.last = performance.now(); this.acc = 0; this._schedule(); }
      });
    }
  }
  setFixedRate(hz) { this.fixedHz = hz; this.fixedDt = 1 / hz; }
  setFpsCap(cap) { this.fpsCap = cap; this.nextDeadline = performance.now(); }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.nextDeadline = this.last;
    requestAnimationFrame(this._probe);
    this._schedule();
  }
  stop() { this.running = false; }

  _usesRaf() {
    const cap = this.fpsCap;
    return cap === 'vsync' || (cap > 0 && cap <= this.refreshHz + 2);
  }
  _schedule() {
    if (!this.running) return;
    if (typeof document !== 'undefined' && document.hidden) { requestAnimationFrame(this._rafTick); return; }
    if (this._usesRaf()) { requestAnimationFrame(this._rafTick); return; }
    if (this.fpsCap > 0) {
      const wait = this.nextDeadline - performance.now();
      if (wait > 4) { setTimeout(() => this._tick(), wait - 2); return; }
    }
    this._post();
  }
  _tick() {
    if (!this.running) return;
    const now = performance.now();
    const cap = this.fpsCap;
    if (cap !== 'vsync' && cap > 0) {
      const interval = 1000 / cap;
      const tolerance = this._usesRaf() ? (1000 / this.refreshHz) * 0.5 : 0.2;
      if (now < this.nextDeadline - tolerance) { this._schedule(); return; }
      this.nextDeadline += interval;
      if (this.nextDeadline < now - interval) this.nextDeadline = now + interval;
    }
    this._frame(now);
    this._schedule();
  }
  _frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25; // tab switch / breakpoint: never simulate a huge jump
    const scaled = dt * this.timeScale;
    const t0 = performance.now();
    let steps = 0;
    if (!this.simPaused) {
      this.acc += scaled;
      while (this.acc >= this.fixedDt && steps < this.maxSteps) {
        this.onFixed(this.fixedDt);
        this.acc -= this.fixedDt;
        steps++;
      }
      if (steps >= this.maxSteps) this.acc = 0; // too slow: drop time instead of spiralling
    }
    const t1 = performance.now();
    const alpha = this.simPaused ? 1 : this.acc / this.fixedDt;
    this.onFrame(dt, alpha, scaled);
    const t2 = performance.now();
    // stats (averaged over ~0.5 s windows)
    const s = this.stats;
    s.frames++; s.steps = steps;
    this._fpsFrames++; this._fpsTime += dt; this._simAcc += t1 - t0; this._renderAcc += t2 - t1; this._frameAcc += dt * 1000;
    if (this._fpsTime >= 0.5) {
      s.fps = this._fpsFrames / this._fpsTime;
      s.frameMs = this._frameAcc / this._fpsFrames;
      s.simMs = this._simAcc / this._fpsFrames;
      s.renderMs = this._renderAcc / this._fpsFrames;
      this._fpsFrames = 0; this._fpsTime = 0; this._simAcc = 0; this._renderAcc = 0; this._frameAcc = 0;
    }
  }
}
