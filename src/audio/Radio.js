// Procedural radio: three stations generated live with a lookahead scheduler (no audio files).
// Stations are tiny "styles": tempo, chord progression, drum + bass + chord + lead pattern rules.
import { rng } from '../core/math.js';

export const STATIONS = {
  off: { name: 'Radio off', zh: '關閉' },
  citypop: { name: 'City Pop 88.1', zh: '城市流行', bpm: 106, swing: 0, key: 50, prog: [[5, 'maj7'], [4, 'm7'], [2, 'm7'], [7, '7sus']], chordVoice: 'ep', drums: 'pop' },
  eurobeat: { name: 'Touge 155', zh: '山道歐陸', bpm: 155, swing: 0, key: 45, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'M']], chordVoice: 'stab', drums: 'four', lead: true, octaveBass: true },
  lofi: { name: 'Night Market 92.7', zh: '夜市低傳真', bpm: 82, swing: 0.18, key: 53, prog: [[2, 'm9'], [7, '9'], [0, 'maj9'], [9, 'm7']], chordVoice: 'keys', drums: 'lofi', crackle: true },
};
const CH = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7sus': [0, 5, 7, 10], m: [0, 3, 7, 12], M: [0, 4, 7, 12], m9: [0, 3, 7, 10, 14], 9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14] };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.ctx = audio.ctx;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(audio.buses.music);
    this.station = audio.game.settings.get('audio.station') || 'citypop';
    this.context = 'menu';
    this.nextBeat = 0; this.beat = 0; this.bar = 0;
    this.rand = rng(Date.now() & 0xffff);
    this.timer = 0;
    this.crackle = null;
    audio.game.events.on('settings:changed', (e) => { if (e.key === 'audio.station') this.setStation(e.value); });
  }
  setContext(c) { this.context = c; }
  setStation(id) {
    this.station = STATIONS[id] ? id : 'off';
    this.nextBeat = 0;
    if (this.crackle) { try { this.crackle.stop(); } catch { /* noop */ } this.crackle = null; }
    this.audio.game.events.emit('radio:station', { id: this.station, ...STATIONS[this.station] });
  }
  cycle() {
    const ids = Object.keys(STATIONS);
    const i = ids.indexOf(this.station);
    const next = ids[(i + 1) % ids.length];
    this.audio.game.settings.set('audio.station', next);
    return next;
  }
  get enabled() {
    if (this.station === 'off') return false;
    if (this.context === 'drive' && !this.audio.game.settings.get('audio.radioInRace')) return false;
    return true;
  }
  update(dt) {
    if (!this.enabled) return;
    const st = STATIONS[this.station];
    const c = this.ctx, now = c.currentTime;
    if (st.crackle && !this.crackle) {
      const s = this.audio.noiseSource(); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
      const g = c.createGain(); g.gain.value = 0.012; s.connect(f); f.connect(g); g.connect(this.out); this.crackle = s;
    }
    const spb = 60 / st.bpm / 2; // eighth notes
    if (this.nextBeat < now) this.nextBeat = now + 0.05;
    while (this.nextBeat < now + 0.15) {
      this.step(st, this.beat, this.nextBeat, spb);
      this.beat++;
      this.nextBeat += spb * (st.swing && this.beat % 2 === 1 ? 1 + st.swing : st.swing && this.beat % 2 === 0 ? 1 - st.swing : 1);
    }
  }
  step(st, beat, t, spb) {
    const b8 = beat % 8;            // eighth in bar
    const bar = Math.floor(beat / 8);
    const [deg, q] = st.prog[bar % st.prog.length];
    const root = st.key + deg;
    // drums
    if (st.drums === 'four') {
      if (b8 % 2 === 0) this.kick(t, 0.9);
      if (b8 % 2 === 1) this.hat(t, 0.16, true);
      if (b8 === 2 || b8 === 6) this.snare(t, 0.45);
    } else if (st.drums === 'pop') {
      if (b8 === 0 || b8 === 5) this.kick(t, 0.8);
      if (b8 === 2 || b8 === 6) this.snare(t, 0.5);
      this.hat(t, b8 % 2 ? 0.07 : 0.11, false);
    } else {
      if (b8 === 0 || (b8 === 5 && this.rand() < 0.6)) this.kick(t, 0.65);
      if (b8 === 4) this.snare(t, 0.3, true);
      if (this.rand() < 0.8) this.hat(t, 0.05, false);
    }
    // bass
    if (st.octaveBass) this.bass(t, mtof(root - 12 + (b8 % 2 ? 12 : 0)), spb * 0.9, 0.32);
    else if (b8 === 0 || b8 === 3 || (b8 === 6 && this.rand() < 0.7)) this.bass(t, mtof(root - 12 + (b8 === 6 ? 7 : 0)), spb * 1.6, 0.3);
    // chords
    const notes = CH[q].map((n) => root + 12 + n);
    if (st.chordVoice === 'stab') { if (b8 === 1 || b8 === 4 || b8 === 7) notes.forEach((n) => this.saw(t, mtof(n), spb * 0.6, 0.035)); }
    else if (b8 === 0) notes.forEach((n, i) => this.keys(t + i * 0.012, mtof(n), spb * 7, st.chordVoice === 'ep' ? 0.05 : 0.04));
    // lead arpeggio (eurobeat)
    if (st.lead) {
      const arp = [0, 7, 12, 15, 12, 7, 3, 7];
      const m = root + 24 + arp[(b8 + bar * 3) % arp.length] - (q === 'M' ? 0 : 0);
      this.supersaw(t, mtof(m), spb * 0.85, 0.03);
    }
  }
  env(g, t, a, d, peak) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + a + d); }
  osc(type, f, t, dur, gain, filter = null) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = f;
    const g = c.createGain(); this.env(g, t, 0.005, dur, gain);
    if (filter) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); fl.connect(g); } else o.connect(g);
    g.connect(this.out); o.start(t); o.stop(t + dur + 0.1);
    return o;
  }
  kick(t, v) { const o = this.osc('sine', 150, t, 0.28, v); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); }
  snare(t, v, soft = false) { this.noiseHit(t, soft ? 0.12 : 0.16, soft ? 1800 : 2600, v); this.osc('triangle', 190, t, 0.08, v * 0.4); }
  hat(t, v, open) { this.noiseHit(t, open ? 0.12 : 0.035, 8000, v, 'highpass'); }
  noiseHit(t, dur, f, v, type = 'bandpass') {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.audio.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = 0.8;
    const g = c.createGain(); this.env(g, t, 0.002, dur, v);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  bass(t, f, dur, v) { this.osc('sawtooth', f, t, dur, v, 420); }
  keys(t, f, dur, v) { this.osc('triangle', f, t, dur, v, 2400); this.osc('sine', f * 2, t, dur * 0.5, v * 0.3); }
  saw(t, f, dur, v) { this.osc('sawtooth', f, t, dur, v, 3200); }
  supersaw(t, f, dur, v) { for (const d of [-9, 0, 9]) { const o = this.osc('sawtooth', f, t, dur, v, 5200); o.detune.value = d; } }
}
