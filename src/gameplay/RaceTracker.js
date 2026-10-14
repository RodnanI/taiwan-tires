// Progress along a route for one car: distance, laps, sectors, wrong-way, off-track. Anti-shortcut:
// a lap only counts if the car passed every checkpoint (every ~1/6 of the route) in order.
export class RaceTracker {
  constructor(route, { laps = 1, startS = 0 } = {}) {
    this.route = route;
    this.laps = laps;
    this.startS = startS;
    this.hint = -1;
    this.lap = 0;            // completed laps
    this.s = 0;              // distance along route (0..length)
    this.total = 0;          // total progress (lap * length + s) for ranking
    this.finished = false;
    this.finishTime = null;
    this.lapTimes = [];
    this.lapStart = 0;
    this.bestLap = null;
    this.cpCount = Math.max(3, Math.round(route.length / 250));
    this.nextCp = 1;
    this.wrongWay = 0;
    this.lateral = 0;
    this.offTrack = false;
    this.lastS = null;
    this.sector = 0;
    this.preStart = route.closed; // on the grid behind the line: progress counts as negative until it is crossed
  }
  snapshot() { return { h: this.hint, l: this.lap, s: this.s, t: this.total, f: this.finished, ft: this.finishTime, lt: [...this.lapTimes], ls: this.lapStart, b: this.bestLap, c: this.nextCp, ls2: this.lastS, ps: this.preStart }; }
  restore(o) { this.hint = o.h; this.lap = o.l; this.s = o.s; this.total = o.t; this.finished = o.f; this.finishTime = o.ft; this.lapTimes = o.lt; this.lapStart = o.ls; this.bestLap = o.b; this.nextCp = o.c; this.lastS = o.ls2; this.preStart = o.ps; }

  /** Returns events: { lap: true, lapTime } | { finish: true } | null */
  update(x, z, headingVec, time) {
    if (this.finished) return null;
    const R = this.route;
    const p = R.project(x, z, this.hint);
    this.hint = p.i;
    this.lateral = p.lateral;
    this.offTrack = Math.abs(p.lateral) > p.half + 25;
    // wrong way: heading opposite to route tangent while moving
    const dot = headingVec.x * R.tx[p.i] + headingVec.z * R.tz[p.i];
    this.wrongWay = dot < -0.5 ? this.wrongWay + 1 : 0;
    let s = p.s - (R.closed ? this.startS : 0);
    if (R.closed) s = ((s % R.length) + R.length) % R.length;
    let ev = null;
    if (this.lastS != null) {
      const cpLen = R.length / this.cpCount;
      // checkpoints in order
      const target = this.nextCp * cpLen;
      if (this.nextCp < this.cpCount && s >= target && s < target + cpLen * 0.8) this.nextCp++;
      if (R.closed) {
        // crossed the start line going forwards
        if (this.lastS > R.length * 0.75 && s < R.length * 0.25) {
          if (this.nextCp >= this.cpCount) {
            this.lap++;
            const lapTime = time - this.lapStart;
            this.lapTimes.push(lapTime);
            this.lapStart = time;
            if (this.bestLap == null || lapTime < this.bestLap) this.bestLap = lapTime;
            this.nextCp = 1;
            ev = { lap: true, lapTime };
            if (this.lap >= this.laps) { this.finished = true; this.finishTime = time; ev.finish = true; }
          } else if (this.lap === 0 && this.lapTimes.length === 0 && this.nextCp <= 1) {
            // rolling over the line at the start of the race: nothing
          }
        }
      } else if (s >= R.length - 6 && this.nextCp >= this.cpCount - 1) {
        this.finished = true; this.finishTime = time; this.lap = 1; this.lapTimes.push(time - this.lapStart);
        ev = { finish: true, lap: true, lapTime: time - this.lapStart };
      }
    }
    this.lastS = s;
    this.s = s;
    if (this.preStart && !(this.lap === 0 && s > R.length * 0.5)) this.preStart = false;
    this.total = this.preStart ? s - R.length : this.lap * R.length + s;
    this.sector = Math.min(2, Math.floor((s / R.length) * 3));
    return ev;
  }
  get progress() { return this.finished ? 1 : this.total / (this.route.length * this.laps); }
}
