// The score, generated in the browser. Every instrument is synthesized here (no recordings): a guzheng (plucked strings
// on a delay line, pressed and slid by the left hand, its harmonics, its tremolo and its sweeps), a dizi and a xiao
// (breath and a hollow tone), a choir (voices drawn through the vowels' formants), taiko and the war drums, an opera
// gong whose pitch falls, bells, and drones. It plays only with the sound (opt-in), mixed into audio.js.
//
// Three ways it follows the story:
//   layers   drones and pads whose loudness is a function of the story position, both ways;
//   phrases  melodies that start when the story crosses their cue going forward and then play on in real time at their
//            own tempo, so the reader can stop to read and the music breathes on (one melody at a time: a new one
//            waits for the last unless it must be heard, in which case the last gives way);
//   hits     sounds locked to the picture, fired as the story crosses them: the drums of the launch and the dive, the
//            blows of the duel (from the engine), the steps of the way out and its cuts, and the years as a music box
//            the scroll turns, the theme climbing with the marks on the tree.
// Silence is part of it: at the breach the music stops dead with everything else.
//
// The themes: his uncle's (D major pentatonic, the guzheng's own tuning) — stated whole at the door, it ends open, on
// the fifth, and is only brought home at the very end; the boy's own tune on the dizi; the dread, the one note outside
// the scale (G sharp, a tritone from home); sorrow as the same notes centred on B.
import { uToS, TOTAL_U, PACE } from './timeline.js';
import { band, smooth, clamp } from './util.js';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = (() => { const o = {}, n = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']; for (let m = 21; m <= 108; m++) o[n[m % 12] + (Math.floor(m / 12) - 1)] = m; return o; })();
const { D1, Gs1, B1, D2, E2, Fs2, Gs2, A2, B2, D3, E3, Fs3, Gs3, A3, B3, D4, E4, Fs4, Gs4, A4, B4, D5, E5, Fs5, Gs5, A5, B5, D6, E6 } = NOTE;
// the guzheng's twenty-one strings, D2 to D6
const ZHENG = [D2, E2, Fs2, A2, B2, D3, E3, Fs3, A3, B3, D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5, D6];
const strIdx = m => { let k = 0; for (let i = 0; i < ZHENG.length; i++) if (ZHENG[i] <= m) k = i; return k; };

// ---------------------------------------------------------------- the themes ([note, beats, ornament])
// (ornaments: 'p' pressed up a tone after the pluck, 'q' a semitone, 'v' the left hand's vibrato, 's' slid into from
// above, 'h' a harmonic, 'g' a grace note before it, 'f' falling away at its end. The left hand presses a string to
// the notes the open strings lack, as a player would: F sharp up a semitone to G, B or E up a tone to C sharp or F
// sharp; never to the G sharp of the dread unless the dread is meant.)
// his uncle's theme: the first half comes home to D; the second ends open, on A
const THEME_A = [[A4, 1], [B4, 0.5], [D5, 0.5], [B4, 1], [A4, 1, 'v'], [Fs4, 1.5, 'q'], [E4, 0.5], [D4, 2, 'v']];
const THEME_B = [[E4, 1], [Fs4, 0.5], [A4, 0.5], [B4, 1], [D5, 1, 'v'], [B4, 1], [A4, 0.5], [Fs4, 0.5], [A4, 2, 'v']];
// (and, at the very end, home: three, two, one)
const THEME_HOME = [[E4, 1], [Fs4, 0.5], [A4, 0.5], [B4, 1], [D5, 1, 'v'], [B4, 1], [A4, 0.5], [Fs4, 0.5], [E4, 1, 'p'], [D4, 3, 'v']];
// (the bass under them: [note, beat])
const BASS_A = [[D2, 0], [A2, 2], [D3, 3], [B2, 4], [A2, 5.5], [D2, 6]];
const BASS_B = [[A2, 0], [B2, 2], [D3, 3], [E2, 4], [A2, 6], [D3, 6.02]];
const BASS_HOME = [[A2, 0], [B2, 2], [D3, 3], [E2, 4], [A2, 6], [D2, 7], [A2, 7.02], [D3, 7.04]];
// the morning light on the hamlet, high on the strings
const MORNING = [[D5, 0.5], [A5, 0.5], [Fs5, 0.5], [A5, 0.5], [E5, 1, 'p'], [D5, 0.5], [B4, 0.5], [A4, 2, 'v']];
// the boy's own tune (the dizi): higher, quicker, rising where his uncle's settles
const DIZI_A = [[D5, 0.5], [E5, 0.5], [Fs5, 1, 'g'], [A5, 0.5], [Fs5, 0.5], [E5, 1], [D5, 0.5], [B4, 0.5], [D5, 0.5], [E5, 0.5], [A4, 2, 'v']];
const DIZI_B = [[A5, 1, 'g'], [B5, 0.5], [A5, 0.5], [Fs5, 1], [E5, 1, 'g'], [D5, 0.5], [E5, 0.5], [Fs5, 0.5], [E5, 0.5], [D5, 2, 'v']];
// the gate: the same notes centred on B (the garrison gone; no one asked why)
const GATE = [[B3, 2, 'v'], [D4, 1], [E4, 1], [Fs4, 2, 'q'], [E4, 1], [D4, 1], [B3, 2, 'v']];
const BASS_GATE = [[B2, 0], [Fs2, 4], [B2, 7]];
// the loss: his theme on the xiao, slow, and it breaks off
const BROKEN = [[A4, 1.5, 'g'], [B4, 0.75], [D5, 0.75], [B4, 1.5, 'v'], [A4, 2.5, 'v'], [Fs4, 2.2, 'f']];
// (a tune moved along the scale by k steps: one down centres it on B, the same contour, darker)
const PENTA = [];
for (let m = 26; m <= 100; m++) if ([2, 4, 6, 9, 11].includes(m % 12)) PENTA.push(m);
const shift = (notes, k) => notes.map(([m, b, o]) => { const i = PENTA.indexOf(m); return [i < 0 ? m : PENTA[i + k], b, o]; });
// what fell from the sky (its light fleeing west; the one that waited in the dell): harmonics falling and turning up
const XUAN = [A5, D5, B4, E5];
// "Live a good life": rising, and settling open
const LIVE = [[D4, 2, 'v'], [Fs4, 1], [A4, 1], [B4, 2, 'p'], [A4, 3, 'v']];
const BASS_LIVE = [[D2, 0], [B2, 4], [D2, 6], [A2, 6.02]];

// ---------------------------------------------------------------- the Watch path (boot.js plays the story at PACE)
// (the music box is composed in seconds of Watch and placed on the story through it)
const paceAt = s => { let p = PACE[0][1]; for (const [a, v] of PACE) if (s >= a) p = v; return p; };
// (made the first time it is asked for: only with the sound on)
let WATCH = null;
function watch() {
  if (WATCH) return WATCH;
  const us = [0], ts = [0], d = 0.01;
  let su = 0, t = 0;
  while (su < TOTAL_U) { const s = uToS(su); t += d / paceAt(s); su += d; us.push(uToS(su)); ts.push(t); }
  return (WATCH = { us, ts });
}
function lookup(xs, ys, x) {
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
  const k = xs[hi] > xs[lo] ? (x - xs[lo]) / (xs[hi] - xs[lo]) : 0;
  return ys[lo] + (ys[hi] - ys[lo]) * k;
}
export const watchT = u => lookup(watch().us, watch().ts, u);
export const watchU = t => lookup(watch().ts, watch().us, t);

// ---------------------------------------------------------------- the score
export function createScore(ctx, out) {
  // the bus: a gentle glue compressor, the mute (the breach), out
  const bus = ctx.createGain();
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.015; glue.release.value = 0.35;
  const mute = ctx.createGain();
  bus.connect(glue).connect(mute).connect(out);
  // a hall: noise falling away, a little pre-delay
  const verb = ctx.createConvolver();
  {
    const sr = ctx.sampleRate, len = Math.floor(sr * 3.2), b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1, k = i / len; lp += (w - lp) * (0.55 - 0.4 * k); d[i] = lp * Math.pow(1 - k, 2.2) * (i < sr * 0.004 ? i / (sr * 0.004) : 1); }
    }
    verb.buffer = b;
  }
  const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.022;
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  // (no low end into the hall: it would only muddy the strings' bass)
  const verbHP = ctx.createBiquadFilter(); verbHP.type = 'highpass'; verbHP.frequency.value = 220; verbHP.Q.value = 0.6;
  pre.connect(verbHP).connect(verb).connect(wet).connect(bus);
  // (a pan, where the browser has one)
  const panner = p => { if (!ctx.createStereoPanner) return ctx.createGain(); const x = ctx.createStereoPanner(); x.pan.value = p; return x; };
  function chain(dry, rev, pan, ...nodes) {
    const input = ctx.createGain();
    let n = input;
    for (const x of nodes) { n.connect(x); n = x; }
    const p = panner(pan); n.connect(p); n = p;
    const d = ctx.createGain(); d.gain.value = dry; n.connect(d).connect(bus);
    const s = ctx.createGain(); s.gain.value = rev; n.connect(s).connect(pre);
    return input;
  }
  const peq = (type, f, q, g) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; x.gain.value = g; return x; };
  // the instruments' rooms and bodies
  // (the strings a little to the left, the flutes to the right, the choir across the whole, drums and gong in the middle)
  const zhengIn = chain(1, 0.42, -0.18, peq('peaking', 210, 1.0, 3.5), peq('peaking', 2900, 0.8, 2.5), peq('highshelf', 9000, 0.7, -3));
  const fluteIn = chain(1, 0.62, 0.22, peq('peaking', 900, 0.9, 1.5));
  const choirIn = chain(0.72, 1.0, 0, peq('lowshelf', 160, 0.7, -4));
  const drumIn = chain(1, 0.3, 0, peq('lowshelf', 90, 0.7, 3));
  const metalIn = chain(0.9, 0.75, 0, peq('highshelf', 7000, 0.7, -2));
  const droneIn = chain(1, 0.45, 0);
  // the duel, heard from wherever the lens is: from the ground through the clouds, muffled; under the screen; in front
  const duelLP = ctx.createBiquadFilter(); duelLP.type = 'lowpass'; duelLP.frequency.value = 500; duelLP.Q.value = 0.6;
  const duelG = ctx.createGain(); duelG.gain.value = 0;
  duelLP.connect(duelG).connect(drumIn);

  const noise = (() => { const sr = ctx.sampleRate, b = ctx.createBuffer(1, sr * 2, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const env = (p, t, a, peak, hold, rel) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); if (hold > 0) p.setValueAtTime(Math.max(peak, 0.0002), t + a + hold); p.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const gainN = v => { const g = ctx.createGain(); g.gain.value = v; return g; };

  // ================================================================ the guzheng
  // Each string's sound is made once (a delay line with a one-zero loss filter) and played back at exactly its pitch.
  // The pluck: the string drawn aside by the nail a seventh of the way along (a triangle), the nail's own click (a
  // narrow pulse there) and a little grit. The loop's own delay is P + S samples. Every string is brought to the same
  // loudness over its first moments, the high ones a little under (the ear hears them louder).
  const strings = new Map();
  function stringBuf(m) {
    let s = strings.get(m);
    if (s) return s;
    // (the high strings at the full rate: the loop loses less of their brightness there)
    const sr = m < 62 ? Math.min(32000, ctx.sampleRate) : ctx.sampleRate, f = mtof(m);
    const S = m < 57 ? 0.5 : m < 69 ? 0.42 : 0.3;
    const P = Math.max(2, Math.floor(sr / f - S));
    const T60 = m < 50 ? 5 : m < 62 ? 4.3 : m < 74 ? 3.3 : 2.4;
    const dur = Math.min(T60 * 0.75, 4.2);
    const n = Math.floor(sr * dur), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), line = new Float32Array(P);
    const pos = 1 / 7, at = Math.max(1, Math.round(P * pos));
    let lp = 0;
    for (let i = 0; i < P; i++) {
      const x = i / P;
      lp += (Math.random() * 2 - 1 - lp) * 0.6;
      line[i] = (x < pos ? x / pos : (1 - x) / (1 - pos)) + (Math.abs(i - at) <= 1 ? (m < 57 ? 0.5 : 0.9) : 0) + 0.18 * lp;
    }
    let mean = 0; for (let i = 0; i < P; i++) mean += line[i]; mean /= P; for (let i = 0; i < P; i++) line[i] -= mean;
    const rho = Math.pow(0.001, (P + S) / (sr * T60));
    let k = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const a = line[k];
      d[i] = a;
      line[k] = rho * ((1 - S) * a + S * prev);
      prev = a;
      k = k + 1 === P ? 0 : k + 1;
    }
    // (loudness: the RMS of its first 0.3 s)
    let e = 0; const w = Math.min(n, Math.floor(sr * 0.3)); for (let i = 0; i < w; i++) e += d[i] * d[i];
    const norm = 0.3 * Math.pow(10, -Math.max(0, m - 62) * 0.12 / 20) / Math.sqrt(e / w + 1e-12);
    const fade = sr * 0.12;
    for (let i = 0; i < n; i++) d[i] = d[i] * norm * Math.min(1, (n - i) / fade);
    s = { buf: b, rate: f / (sr / (P + S)) };
    strings.set(m, s);
    return s;
  }
  // (made ahead, a few at a time, so the first sweep does not stall a frame)
  const toMake = [...new Set([...ZHENG, Gs4, Gs3])];
  (function makeSome() { for (let i = 0; i < 3 && toMake.length; i++) stringBuf(toMake.shift()); if (toMake.length) setTimeout(makeSome, 30); })();

  // one pluck. press: semitones the string is pressed up after it sounds (negative: slid down into it from above);
  // vib: the left hand's vibrato on the ringing note
  function pluck(t, m, { gain = 0.16, press = 0, pressAt = 0.2, pressTau = 0.06, release = 0, vib = 0, vibAt = 0.3, len = 0, dest = zhengIn } = {}) {
    const s = stringBuf(m), src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buf;
    const r0 = s.rate * (press < 0 ? Math.pow(2, -press / 12) : 1);
    src.playbackRate.setValueAtTime(r0, t);
    if (press > 0) {
      src.playbackRate.setTargetAtTime(s.rate * Math.pow(2, press / 12), t + pressAt, pressTau);
      if (release > 0) src.playbackRate.setTargetAtTime(s.rate, t + pressAt + release, pressTau);
    }
    if (press < 0) src.playbackRate.setTargetAtTime(s.rate, t + 0.015, 0.045);
    let end = t + s.buf.duration;
    if (vib > 0) {
      const lfo = osc('sine', 5.2 + Math.random() * 0.8), lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + vibAt);
      lg.gain.linearRampToValueAtTime(s.rate * (Math.pow(2, vib / 12) - 1), t + vibAt + 0.35);
      lfo.connect(lg).connect(src.playbackRate);
      lfo.start(t); lfo.stop(end);
    }
    g.gain.setValueAtTime(gain, t);
    if (len > 0) { g.gain.setTargetAtTime(0.0001, t + len, 0.08); end = Math.min(end, t + len + 0.6); }
    src.connect(g).connect(dest);
    src.start(t); src.stop(end);
  }
  // a harmonic: the string touched at its middle (an octave up, pure, bell-like)
  function harm(t, m, gain = 0.06, dest = zhengIn) {
    const f = mtof(m) * 2;
    for (const [r, a, d] of [[1, 1, 2.6], [2, 0.18, 1.2], [3, 0.05, 0.7]]) {
      const o = osc('sine', f * r), g = ctx.createGain();
      env(g.gain, t, 0.004, gain * a, 0, d);
      o.connect(g).connect(dest); o.start(t); o.stop(t + d + 0.1);
    }
  }
  // the sweep up (or down) the open strings with the nails
  function gliss(t, from, to, dur = 0.8, gain = 0.06, dest = zhengIn) {
    const a = strIdx(from), b = strIdx(to), n = Math.abs(b - a), dir = b > a ? 1 : -1;
    for (let i = 0; i <= n; i++) {
      const x = i / Math.max(1, n);
      pluck(t + dur * Math.pow(x, 1.35), ZHENG[a + dir * i], { gain: gain * (0.65 + 0.35 * x), dest });
    }
  }
  // the tremolo: one string plucked over and over, swelling and falling (softly: the nail's click taken off)
  const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 3200; soft.Q.value = 0.5; soft.connect(zhengIn);
  function tremolo(t, m, dur, gain = 0.07, dest = soft) {
    const n = Math.max(2, Math.floor(dur * 12.5));
    for (let i = 0; i < n; i++) pluck(t + i / 12.5 + (Math.random() - 0.5) * 0.008, m, { gain: gain * Math.sin(Math.PI * (i + 0.5) / n) * (0.85 + 0.3 * Math.random()), len: 0.11, dest });
  }
  // a phrase on the strings: the melody with its ornaments, the bass in the left hand
  function zhengLine(t, notes, beat, { gain = 0.16, bass = null, bassGain = 0.5, octave = 0, dest = zhengIn } = {}) {
    let x = t;
    for (const [m0, b, o = ''] of notes) {
      const m = m0 + octave, d = b * beat;
      if (o.includes('h')) harm(x, m - 12, gain * 0.5, dest);
      else pluck(x, m, {
        gain, dest,
        press: o.includes('p') ? 2 : o.includes('q') ? 1 : o.includes('s') ? -1 : 0, pressAt: Math.min(0.32, d * 0.45), release: /[pq]/.test(o) && d > 0.9 ? d * 0.5 : 0,
        vib: o.includes('v') ? 0.22 : 0, vibAt: Math.min(0.35, d * 0.3),
      });
      x += d;
    }
    if (bass) for (const [m, at] of bass) pluck(t + at * beat, m, { gain: gain * bassGain, dest });
    return x - t;
  }

  // ================================================================ the dizi (bright, a buzz from its membrane) and the xiao (dark)
  const shaper = (() => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(2.6 * x) / Math.tanh(2.6); } return c; })();
  function fluteLine(t, notes, beat, { gain = 0.06, xiao = false, octave = 0, dest = fluteIn } = {}) {
    const total = notes.reduce((a, n) => a + n[1], 0) * beat, end = t + total + 1.4;
    const o = osc('triangle', 440), o2 = osc('sine', 880), g2 = gainN(xiao ? 0.1 : 0.22);
    const lfo = osc('sine', xiao ? 4.4 : 5.3), lg = gainN(0), lg2 = gainN(0);
    const br = ctx.createBufferSource(); br.buffer = noise; br.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = xiao ? 1.2 : 2.2;
    const bg = gainN(xiao ? 0.55 : 0.22);
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = xiao ? 1700 : 4600; lpf.Q.value = 0.4;
    const vca = ctx.createGain(); vca.gain.value = 0;
    lfo.connect(lg).connect(o.frequency); lfo.connect(lg2).connect(o2.frequency);
    o.connect(lpf); o2.connect(g2).connect(lpf); br.connect(bf).connect(bg).connect(lpf);
    if (!xiao) {
      // (the membrane's buzz)
      const ws = ctx.createWaveShaper(); ws.curve = shaper;
      const bz = ctx.createBiquadFilter(); bz.type = 'bandpass'; bz.frequency.value = 2600; bz.Q.value = 1.4;
      const bzg = gainN(0.16);
      o.connect(ws).connect(bz).connect(bzg).connect(vca);
    }
    lpf.connect(vca); vca.connect(dest);
    let x = t;
    notes.forEach(([m0, b, orn = ''], i) => {
      const m = m0 + octave, f = mtof(m), d = b * beat;
      if (orn.includes('g') && i > 0) {
        // a grace note from the note above in the key (a finger lifted), a flick before the note
        const fu = mtof(m + ([6, 1].includes(m % 12) ? 1 : 2));
        o.frequency.setTargetAtTime(fu, x - 0.06, 0.008); o2.frequency.setTargetAtTime(fu * 2, x - 0.06, 0.008);
      }
      if (i === 0) { o.frequency.setValueAtTime(f, x); o2.frequency.setValueAtTime(f * 2, x); }
      else { o.frequency.setTargetAtTime(f, x, 0.022); o2.frequency.setTargetAtTime(f * 2, x, 0.022); }
      bf.frequency.setTargetAtTime(Math.min(9000, f * 2.1), x, 0.03);
      // (the breath: in at the first note, a little dip between notes, swelling into the long ones)
      if (i === 0) { vca.gain.setValueAtTime(0.0001, x); vca.gain.setTargetAtTime(gain, x, 0.05); }
      else { vca.gain.setTargetAtTime(gain * 0.55, x - 0.03, 0.012); vca.gain.setTargetAtTime(gain, x + 0.02, 0.04); }
      if (d > 1.2) vca.gain.setTargetAtTime(gain * 1.15, x + d * 0.4, d * 0.25);
      // (vibrato grows into the long notes)
      const depth = f * (xiao ? 0.009 : 0.0075) * clamp((d - 0.3) / 1.0);
      lg.gain.setTargetAtTime(0, x, 0.02); lg2.gain.setTargetAtTime(0, x, 0.02);
      lg.gain.setTargetAtTime(depth, x + Math.min(0.35, d * 0.35), 0.25); lg2.gain.setTargetAtTime(depth * 2, x + Math.min(0.35, d * 0.35), 0.25);
      if (orn.includes('f')) { o.frequency.setTargetAtTime(f * 0.94, x + d * 0.7, d * 0.3); vca.gain.setTargetAtTime(0.0001, x + d * 0.55, d * 0.25); }
      x += d;
    });
    vca.gain.setTargetAtTime(0.0001, x - 0.04, xiao ? 0.3 : 0.16);
    for (const s of [o, o2, lfo, br]) { s.start(t); s.stop(end); }
    return total;
  }

  // ================================================================ drums
  function drum(t, { gain = 0.35, pitch = 58, decay = 0.6, skin = 0.45, sub = 0, dest = drumIn } = {}) {
    gain *= 0.55;
    const o = osc('sine', pitch), g = ctx.createGain();
    o.frequency.setValueAtTime(pitch * 2.3, t); o.frequency.exponentialRampToValueAtTime(pitch, t + 0.055);
    env(g.gain, t, 0.002, gain, 0, decay);
    o.connect(g).connect(dest); o.start(t); o.stop(t + decay + 0.1);
    if (sub > 0) { const s = osc('sine', pitch * 0.5), sg = ctx.createGain(); s.frequency.setValueAtTime(pitch, t); s.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.12); env(sg.gain, t, 0.004, gain * sub, 0.05, decay * 1.6); s.connect(sg).connect(dest); s.start(t); s.stop(t + decay * 1.8 + 0.2); }
    if (skin > 0) {
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noise; f.type = 'lowpass'; f.frequency.value = 700 + pitch * 6;
      env(ng.gain, t, 0.001, gain * skin, 0, 0.07);
      n.connect(f).connect(ng).connect(dest); n.start(t, Math.random() * 1.5); n.stop(t + 0.15);
    }
  }
  // the metal: a clash of blades, a crash (inharmonic partials and a burst of bright noise)
  function clash(t, { gain = 0.07, f0 = 1150, dur = 1.1, dest = metalIn } = {}) {
    for (const [r, a] of [[1, 1], [1.37, 0.7], [1.83, 0.55], [2.41, 0.4], [3.17, 0.3], [4.09, 0.2]]) {
      const o = osc('sine', f0 * r * (1 + (Math.random() - 0.5) * 0.01)), g = ctx.createGain();
      env(g.gain, t, 0.001, gain * a * 0.5, 0, dur * (1.2 - r * 0.15));
      o.connect(g).connect(dest); o.start(t); o.stop(t + dur * 1.2 + 0.1);
    }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noise; f.type = 'highpass'; f.frequency.value = 3200;
    env(ng.gain, t, 0.001, gain * 0.9, 0, dur * 0.5);
    n.connect(f).connect(ng).connect(dest); n.start(t, Math.random()); n.stop(t + dur * 0.6);
  }
  // the gong (an opera gong falls in pitch as it rings; fall > 1 rises); swell: a bowed swell instead of a strike
  function gong(t, { gain = 0.2, f0 = 62, dur = 6.5, fall = 0.94, swell = 0, dest = metalIn } = {}) {
    gain *= 0.6;
    for (const [r, a, dk] of [[1, 1, 1], [1.47, 0.7, 0.85], [2.09, 0.55, 0.6], [2.56, 0.42, 0.5], [3.3, 0.3, 0.38], [4.21, 0.2, 0.28], [5.43, 0.13, 0.2]]) {
      const o = osc('sine', f0 * r), g = ctx.createGain();
      o.frequency.setValueAtTime(f0 * r, t); o.frequency.exponentialRampToValueAtTime(f0 * r * fall, t + 1.6 + swell);
      g.gain.setValueAtTime(0.0001, t);
      if (swell > 0) g.gain.exponentialRampToValueAtTime(gain * a, t + swell);
      else { g.gain.exponentialRampToValueAtTime(gain * a * 0.55, t + 0.008); g.gain.exponentialRampToValueAtTime(gain * a, t + 0.22); }
      g.gain.exponentialRampToValueAtTime(0.0001, t + swell + dur * dk);
      o.connect(g).connect(dest); o.start(t); o.stop(t + swell + dur * dk + 0.1);
    }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noise; n.loop = true; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7;
    env(ng.gain, t, 0.15 + swell, gain * 0.1, 0.2, dur * 0.35);
    n.connect(f).connect(ng).connect(dest); n.start(t); n.stop(t + swell + dur * 0.7);
  }
  // a bell
  function bell(t, m, gain = 0.04, dur = 4, dest = metalIn) {
    for (const [r, a, dk] of [[1, 1, 1], [2.0, 0.4, 0.6], [2.76, 0.22, 0.45], [4.07, 0.16, 0.3], [5.4, 0.08, 0.2]]) {
      const o = osc('sine', mtof(m) * r), g = ctx.createGain();
      env(g.gain, t, 0.002, gain * a, 0, dur * dk);
      o.connect(g).connect(dest); o.start(t); o.stop(t + dur * dk + 0.1);
    }
  }

  // ================================================================ the choir: voices drawn through the vowels' formants
  // (each sung note one wave whose harmonics follow the formants of a bass, tenor, alto or soprano singing a, o or u;
  // three singers to a note, each with a vibrato of their own; a breath under them)
  const FORM = {
    bass: { a: [[600, 0, 60], [1040, -7, 70], [2250, -9, 110], [2450, -9, 120], [2750, -20, 130]], o: [[400, 0, 40], [750, -11, 80], [2400, -21, 100], [2600, -20, 120], [2900, -40, 120]], u: [[250, 0, 60], [595, -20, 80], [2400, -32, 100], [2675, -28, 120], [2950, -36, 120]] },
    tenor: { a: [[650, 0, 80], [1080, -6, 90], [2650, -7, 120], [2900, -8, 130], [3250, -22, 140]], o: [[400, 0, 40], [800, -10, 80], [2600, -12, 100], [2800, -12, 120], [3000, -26, 120]], u: [[350, 0, 40], [600, -20, 60], [2700, -17, 100], [2900, -14, 120], [3300, -26, 120]] },
    alto: { a: [[800, 0, 80], [1150, -4, 90], [2800, -20, 120], [3500, -36, 130], [4950, -60, 140]], o: [[450, 0, 70], [800, -9, 80], [2830, -16, 100], [3500, -28, 130], [4950, -55, 135]], u: [[325, 0, 50], [700, -12, 60], [2530, -30, 170], [3500, -40, 180], [4950, -64, 200]] },
    soprano: { a: [[800, 0, 80], [1150, -6, 90], [2900, -32, 120], [3900, -20, 130], [4950, -50, 140]], o: [[450, 0, 70], [800, -11, 80], [2830, -22, 100], [3800, -22, 130], [4950, -50, 135]], u: [[325, 0, 50], [700, -16, 60], [2700, -35, 170], [3800, -40, 180], [4950, -60, 200]] },
  };
  const waves = new Map();
  function voiceWave(m, vowel) {
    const key = m + vowel;
    let w = waves.get(key);
    if (w) return w;
    const f0 = mtof(m), F = FORM[m < 50 ? 'bass' : m < 60 ? 'tenor' : m < 70 ? 'alto' : 'soprano'][vowel];
    const N = Math.max(2, Math.min(90, Math.floor(9500 / f0)));
    const re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let h = 1; h <= N; h++) {
      let a = 0;
      for (const [fc, db, bw] of F) { const x = (h * f0 - fc) / (bw * 0.5 + f0 * 0.18); a += Math.pow(10, db / 20) / (1 + x * x); }
      im[h] = a / Math.pow(h, 0.7);
    }
    w = ctx.createPeriodicWave(re, im);
    waves.set(key, w);
    return w;
  }
  // a chord sung: attack, held, released (seconds); held: it stays until stopped (the pads drive its loudness)
  function choir(t, ms, dur, { gain = 0.03, vowel = 'a', attack = 1.6, release = 2.6, dest = choirIn, held = false } = {}) {
    const g = ctx.createGain(), gL = panner(-0.55), gR = panner(0.55);
    gL.connect(g); gR.connect(g);
    const end = held ? Infinity : t + attack + dur + release;
    const nodes = [];
    for (const m of ms) {
      const w = voiceWave(m, vowel), f = mtof(m);
      for (const [dc, side] of [[-8, gL], [0, g], [7, gR]]) {
        const o = ctx.createOscillator(); o.setPeriodicWave(w); o.frequency.value = f * Math.pow(2, dc / 1200);
        const v = osc('sine', 4.4 + Math.random() * 1.4), vg = gainN(f * (0.0035 + Math.random() * 0.002));
        v.connect(vg).connect(o.frequency);
        o.connect(side);
        nodes.push(o, v);
      }
    }
    // (the breath of the singers)
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = vowel === 'a' ? 1100 : 750; nf.Q.value = 0.8;
    const ng = gainN(0.06); n.connect(nf).connect(ng).connect(g); nodes.push(n);
    const lvl = gain / Math.sqrt(ms.length * 3);
    if (!held) env(g.gain, t, attack, lvl, dur, release); else g.gain.value = 0;
    g.connect(dest);
    for (const x of nodes) { x.start(t); if (end < Infinity) x.stop(end + 0.1); }
    return { g, lvl, stop: when => { for (const x of nodes) x.stop(when); } };
  }

  // ================================================================ layers: drones, and pads that follow the story
  function drone(ms, type, cutoff) {
    const g = gainN(0), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.5;
    for (const [m, a] of ms) { const o = osc(type, mtof(m) * (1 + (Math.random() - 0.5) * 0.002)), og = gainN(a); o.connect(og).connect(f); o.start(); }
    f.connect(g).connect(droneIn);
    return g;
  }
  const DRONES = [
    // home: D and A, low and warm (the morning, the road; the last page)
    { g: drone([[D2, 0.5], [A2, 0.32], [D3, 0.12]], 'triangle', 480), lvl: 0.016, k: u => Math.max(smooth(1, 5, u) * (1 - smooth(42.5, 45, u)), smooth(141, 142.5, u)) },
    // the dread: low D against the tritone (the smith's iron; the pines; the night of the fire; the crag)
    { g: drone([[D1, 0.6], [Gs1, 0.38], [D2, 0.2], [Gs2, 0.08]], 'sawtooth', 170), lvl: 0.04, k: u => Math.max(0.35 * band(25.9, 26.4, 27.6, 28.4, u), band(44.4, 46.4, 47.42, 47.5, u), 0.8 * band(55.6, 57.6, 62.5, 64.5, u), 0.7 * band(97.6, 98.6, 102.8, 103.8, u)) },
    // sorrow: B and F sharp (the house; the night after)
    { g: drone([[B1, 0.5], [Fs2, 0.32], [B2, 0.16], [D3, 0.06]], 'triangle', 360), lvl: 0.028, k: u => Math.max(band(77.2, 79, 92.0, 93.5, u) * 0.8, band(94.8, 96, 103.5, 105.5, u)) },
    // the forest: an open fifth, higher (the years; the dell)
    { g: drone([[D3, 0.4], [A3, 0.3], [E4, 0.12]], 'sine', 900), lvl: 0.016, k: u => Math.max(band(108.3, 110, 124.4, 125.6, u), 0.9 * band(130.2, 132, 139.3, 139.44, u)) },
    // the gold: the air beginning to glow, high
    { g: drone([[A4, 0.3], [D5, 0.26], [E5, 0.2], [A5, 0.1]], 'sine', 6000), lvl: 0.012, k: u => smooth(129.8, 131.5, u) * (u < 139.44 ? 1 : 0) * (0.6 + 0.4 * smooth(136, 139.3, u)) },
  ];
  // pads: a sung chord whose loudness follows the story (made when needed, let go when not)
  const pad = (ms, vowel, gain, k, steps = null) => ({ ms, vowel, gain, k, steps, v: null, idle: 0, cur: null });
  const PADS = [
    // the launch: the choir rising with the eye, the chord stepping up at each sheet of cloud
    pad([D3, A3, D4], 'o', 0.07, u => smooth(47.47, 48.45, u) * (u < 48.466 ? 1 : 0), [[48.21, [E3, B3, E4]], [48.34, [Fs3, B3, Fs4]], [48.45, [A3, D4, A4]]]),
    // the way out: low voices under the walk, louder at each cut, the chord stepping with the world; gone on the missed
    // beat
    pad([D3, A3], 'o', 0.05, u => (u < 129.716 ? 1 : 0) * smooth(125.85, 126.2, u) * (0.45 + 0.55 * smooth(125.9, 129.7, u)), [[126.854, [E3, B3]], [127.808, [Fs3, B3]], [128.444, [A3, E4]], [129.08, [B3, Fs4]], [129.398, [D4, A4]]]),
    // the duel above the sea of clouds: low, held, under the blows
    pad([D3, A3, E4], 'o', 0.045, u => band(49.6, 50.4, 52.2, 52.7, u)),
    // the dive: the dread rising under the thunder gathering, until the strike
    pad([D2, Gs2, D3, Gs3], 'u', 0.07, u => Math.pow(smooth(52.6, 54.4, u), 1.4) * (u < 54.42 ? 1 : 0)),
    // the call: rising under the air drawn up into the light, until the pillar falls
    pad([D3, A3, D4, E4], 'a', 0.08, u => Math.pow(smooth(138.4, 139.43, u), 1.5) * (u < 139.44 ? 1 : 0)),
  ];

  // swells drawn in toward an impact: noise, its band rising as the story comes to it, cut dead on it
  function swell(u0, u1, gain, f0, f1) {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.value = f0;
    const g = gainN(0);
    n.connect(f).connect(g).connect(metalIn);
    let on = false;
    return (u, t) => {
      const k = u > u0 && u < u1 ? Math.pow((u - u0) / (u1 - u0), 2.2) : 0;
      if (k > 0 && !on) { n.start(t); on = true; }
      g.gain.setTargetAtTime(gain * k, t, k > 0 ? 0.05 : 0.004);
      f.frequency.setTargetAtTime(f0 + (f1 - f0) * k, t, 0.05);
    };
  }
  const SWELLS = [swell(53.7, 54.42, 0.05, 300, 4200)];

  // ================================================================ one melody at a time
  // (a phrase that comes while another is about to end waits for it; one that must be heard makes the other give way)
  const lead = { g: null, end: 0 };
  function claim(t, dur, must) {
    if (lead.g && lead.end > t + 0.3) {
      if (must) lead.g.gain.setTargetAtTime(0.0001, t, 0.12);
      else if (lead.end - t < 2.6) t = lead.end + 0.12;
      else return null;
    }
    const g = gainN(1);
    lead.g = g; lead.end = t + dur;
    return { g, t };
  }
  function cut(t, tau = 0.15) { if (lead.g && lead.end > t) { lead.g.gain.setTargetAtTime(0.0001, t, tau); lead.end = t; } }
  // (phrases start on the beat of whatever bed is playing)
  let grid = null;
  const onBeat = t => { if (!grid || grid.until < t) return t + 0.03; const h = grid.beat / 2; return grid.t0 + Math.ceil((t + 0.02 - grid.t0) / h) * h; };
  function zheng(t, notes, beat, opts = {}) {
    const dur = notes.reduce((a, n) => a + n[1], 0) * beat;
    const c = claim(onBeat(t), dur, opts.must);
    if (!c) return;
    c.g.connect(zhengIn);
    zhengLine(c.t, notes, beat, { ...opts, dest: c.g });
  }
  function flute(t, notes, beat, opts = {}) {
    const dur = notes.reduce((a, n) => a + n[1], 0) * beat;
    const c = claim(onBeat(t), dur, opts.must);
    if (!c) return;
    c.g.connect(fluteIn);
    fluteLine(c.t, notes, beat, { ...opts, dest: c.g });
  }
  function xuan(t, step = 0.3, gain = 0.035) { XUAN.forEach((m, i) => harm(t + i * step * (i === 3 ? 1.6 : 1), m - 12, gain * (i === 3 ? 1.2 : 1))); }
  function bells(t, notes, beat, gain = 0.03, octave = 12) {
    let x = t;
    for (const [m, b] of notes) { bell(x, m + octave, gain * (b >= 2 ? 1.2 : 1), 2.5 + b); x += b * beat; }
  }

  // ================================================================ beds: patterns in time, as loud as the story says
  const BEDS = [
    // the street and the road: the strings' bass, a chord to a bar (at the gate, the same strings round B)
    { band: [19.4, 20.6, 42.4, 44.2], beat: 0.72, fn(i, t, k, u) {
      const bar = Math.floor(i / 8), st = i % 8;
      const gate = u > 31 && u < 36.4, road = u >= 36.4;
      const prog = gate ? [[B2, Fs3], [Fs2, B2], [B2, Fs3], [E2, B2]] : road ? [[D2, A2], [A2, E3], [B2, Fs3], [A2, E3]] : [[D2, A2], [B2, Fs3], [E2, B2], [A2, E3]];
      const [r, f] = prog[bar % 4];
      if (st === 0) pluck(t, r, { gain: 0.1 * k, vib: 0.1, vibAt: 0.6 });
      if (st === 4 && !road) pluck(t, f, { gain: 0.06 * k });
      if (st === 6 && bar % 2 === 1 && !gate && !road) pluck(t, f + 12, { gain: 0.035 * k });
    } },
    // the run home: the war drums
    { band: [65.95, 66.25, 76.7, 77.25], beat: 0.4, fn(i, t, k) {
      const st = i % 16;
      const big = [0, 4, 8, 12, 14].includes(st), small = [2, 6, 7, 10, 13, 15].includes(st);
      if (big) drum(t, { gain: (st === 0 ? 0.32 : 0.24) * k, pitch: 52, decay: 0.5, sub: st === 0 ? 0.5 : 0 });
      else if (small) drum(t, { gain: 0.12 * k, pitch: 72, decay: 0.22, skin: 0.6 });
      if (st % 4 === 2) drum(t, { gain: 0.05 * k, pitch: 140, decay: 0.08, skin: 0.9 });
    } },
    // the chase west
    { band: [103.45, 103.8, 105.8, 106.4], beat: 0.42, fn(i, t, k) {
      const st = i % 16;
      if ([0, 6, 8, 14].includes(st)) drum(t, { gain: 0.24 * k, pitch: 54, decay: 0.45 });
      else if ([3, 4, 11, 12, 15].includes(st)) drum(t, { gain: 0.1 * k, pitch: 74, decay: 0.2, skin: 0.6 });
    } },
  ].map(b => ({ ...b, step: b.beat / 2, next: 0, i: 0, t0: 0 }));

  // ================================================================ the cues, on the story
  const EV = [];
  // (gap: the least time before the same cue can sound again, when the reader goes back over it)
  const at = (u, fn, gap = 4) => EV.push({ u, fn, gap, last: -1e9 });
  const B = 0.72;

  // ---- the title; I. an ordinary morning
  at(1.5, t => { harm(t, D4, 0.05); pluck(t, D2, { gain: 0.07, vib: 0.08, vibAt: 1 }); });
  at(5.2, t => { gliss(t, A2, A5, 1.1, 0.05); pluck(t, D2, { gain: 0.09 }); });
  at(7.4, t => zheng(t, MORNING, B * 1.05, { gain: 0.13, bass: [[D2, 0], [A2, 3]] }));
  at(12.6, t => { harm(t, D4, 0.07); pluck(t, D3, { gain: 0.07 }); });
  // his face; his words; the basket between their hands; he points at the sun
  at(13.4, t => zheng(t, [...THEME_A, ...THEME_B], 0.72, { gain: 0.16, bass: [...BASS_A, ...BASS_B.map(([m, b]) => [m, b + 8])], must: true }));
  at(16.75, t => harm(t, A4, 0.045));
  at(19.4, t => gliss(t, D4, D5, 0.45, 0.04));
  // ---- the street (the boy's own tune), the smith's iron, the gate, the old road
  at(21.4, t => flute(t, DIZI_A, B * 0.98, { gain: 0.065 }));
  at(26.3, t => { cut(t, 0.5); pluck(t, Fs4, { gain: 0.07, press: 2, pressAt: 0.5, pressTau: 0.35 }); bell(t + 0.6, Gs5, 0.012, 3); });
  at(28.5, t => flute(t, DIZI_B, B, { gain: 0.065 }));
  at(31.2, t => zheng(t, GATE, B * 1.04, { gain: 0.13, bass: BASS_GATE }));
  at(37.4, t => zheng(t, THEME_A, 0.8, { gain: 0.11, octave: 12 }));
  at(43.2, t => { pluck(t, B4, { gain: 0.08, press: 1, pressAt: 0.6, pressTau: 0.2 }); pluck(t + 1.5, Fs4, { gain: 0.055, vib: 0.2 }); });
  // ---- II. the sky turns: the forest holds its breath
  at(46.1, t => { cut(t, 0.4); gong(t, { gain: 0.06, f0: 74, dur: 7, fall: 0.97, swell: 1.4 }); choir(t, [D2, Gs2, D3], 2.6, { gain: 0.03, vowel: 'u', attack: 1.8, release: 1.2 }); });
  // the launch: lifting off, bursting up through the crown, the pulse of the climb up the well doubling, the roll under
  // the screen where the fight's shadows play to the clash of their blades; the three sheets; then nothing
  at(47.47, t => drum(t, { gain: 0.2, pitch: 50, decay: 0.9, sub: 0.6 }), 1);
  at(47.535, t => { drum(t, { gain: 0.42, pitch: 46, decay: 1.2, sub: 0.8 }); gong(t, { gain: 0.07, f0: 58, dur: 4, fall: 1.04 }); }, 1);
  for (let i = 1; i <= 8; i++) at(47.535 + i * 0.052, t => drum(t, { gain: 0.12 + i * 0.012, pitch: 60, decay: 0.3 }), 0.5);
  at(48.0, t => clash(t, { gain: 0.05, f0: 1500, dur: 0.6 }), 1);
  for (let i = 1; i <= 5; i++) at(47.95 + i * 0.024, t => drum(t, { gain: 0.16 + i * 0.015, pitch: 62, decay: 0.24 }), 0.5);
  for (let i = 0; i < 9; i++) at(48.08 + 0.072 * Math.pow(i / 9, 0.75), t => drum(t, { gain: 0.1 + i * 0.022, pitch: 66, decay: 0.18, skin: 0.6 }), 0.3);
  at(48.155, t => { clash(t, { gain: 0.11, f0: 1250, dur: 1.4 }); drum(t, { gain: 0.38, pitch: 48, decay: 0.8, sub: 0.6 }); }, 1);
  for (const [u, p] of [[48.21, 46], [48.34, 44], [48.45, 42]]) at(u, t => drum(t, { gain: 0.5, pitch: p, decay: 1.3, sub: 0.9 }), 1);
  // (after the silence: the sea of clouds, the sun, the gong barely touched)
  at(49.2, t => { gong(t, { gain: 0.05, f0: 74, dur: 9, fall: 0.99, swell: 2.2 }); choir(t + 0.3, [D4, A4, E5], 4.5, { gain: 0.04, vowel: 'a', attack: 3 }); bell(t + 1.4, A5, 0.022, 5); }, 6);
  // the dive: over the top (weightless), the thunder gathering, the star falling, the strike
  at(52.5, t => choir(t, [Fs4, A4, D5], 0.6, { gain: 0.03, vowel: 'o', attack: 0.35, release: 1.4 }));
  for (let i = 0; i < 16; i++) at(52.95 + 1.05 * Math.pow(i / 16, 0.62), t => drum(t, { gain: 0.16 + i * 0.02, pitch: 58 - i * 0.4, decay: 0.4, sub: 0.3 }), 0.5);
  for (let i = 0; i < 14; i++) at(54.0 + 0.41 * Math.pow(i / 14, 0.8), t => drum(t, { gain: 0.26 + i * 0.02, pitch: 64, decay: 0.22, skin: 0.6 }), 0.4);
  at(54.0, t => choir(t, [D3, Gs3, D4], 1.2, { gain: 0.04, vowel: 'u', attack: 1.2, release: 0.3 }), 2);
  at(54.42, t => { gong(t, { gain: 0.26, f0: 55, dur: 8, fall: 0.9 }); drum(t, { gain: 0.6, pitch: 40, decay: 1.8, sub: 1 }); choir(t + 0.05, [D3, A3, D4, Fs4], 3, { gain: 0.06, vowel: 'a', attack: 0.5, release: 3.5 }); }, 2);
  at(55.5, t => xuan(t, 0.24, 0.035));
  at(56.2, t => flute(t, [[Fs4, 2, 'v'], [E4, 1], [D4, 3, 'f']], B * 1.35, { gain: 0.065, xiao: true }));
  at(58.45, t => pluck(t, B2, { gain: 0.09, press: -1, vib: 0.12, vibAt: 0.7 }));
  // ---- III. Cinderfall burns; "Uncle."; the run home (each bolt into the ground beside the road a drum)
  at(61.7, t => { cut(t, 0.3); gong(t, { gain: 0.15, f0: 46, dur: 8, fall: 0.88 }); drum(t, { gain: 0.35, pitch: 42, decay: 1.4, sub: 0.8 }); choir(t + 0.1, [Gs2, D3, Gs3], 3, { gain: 0.04, vowel: 'u', attack: 1.4 }); }, 6);
  at(64.45, t => flute(t, [[A4, 1.5, 'g'], [B4, 0.75], [D5, 3, 'f']], B * 1.2, { gain: 0.07, xiao: true }));
  at(66.4, t => flute(t, shift([...THEME_A, ...THEME_B], -1), 0.36, { gain: 0.06, octave: 12 }));
  at(70.6, t => flute(t, shift([...THEME_B, ...THEME_A], -1), 0.34, { gain: 0.06, octave: 12 }));
  at(74.6, t => { tremolo(t, A4, 1.6, 0.06); tremolo(t + 1.6, D5, 1.8, 0.07); choir(t, [D4, A4, D5], 2.2, { gain: 0.03, vowel: 'a', attack: 1.2 }); });
  for (const u of [66.6, 68.3, 70.4, 72.6, 75.0]) at(u, t => drum(t, { gain: 0.4, pitch: 44, decay: 1.0, sub: 0.8 }), 1);
  // ---- the house; the open door
  at(79.0, t => pluck(t, B3, { gain: 0.08, press: -2, vib: 0.15, vibAt: 0.5 }));
  at(81.0, t => gong(t, { gain: 0.05, f0: 50, dur: 6, fall: 0.96, swell: 0.8 }));
  // ---- IV. a final warning: his last words; the hand falls (the music stops); the tear; the soul's light
  at(85.1, t => flute(t, BROKEN, B * 1.25, { gain: 0.07, xiao: true, must: true }), 8);
  at(88.6, t => zheng(t, LIVE, 0.94, { gain: 0.12, bass: BASS_LIVE, must: true }), 8);
  at(91.4, t => cut(t, 0.25), 1);
  at(92.05, t => bell(t, A5, 0.035, 5), 2);
  at(92.6, t => choir(t, [D4, A4, D5], 4.5, { gain: 0.05, vowel: 'a', attack: 2.5, release: 3 }), 6);
  at(94.4, t => bells(t, THEME_A, 0.62, 0.026), 6);
  // ---- the night: "Avenge…?"; the crag and the masks; the bolts; the chase west; the sky beyond the ridge on fire
  at(96.2, t => zheng(t, [[B2, 2, 'v'], [Fs3, 2], [B3, 4, 'v']], 1.0, { gain: 0.11 }));
  at(98.6, t => { choir(t, [Gs2, D3, Gs3], 3, { gain: 0.04, vowel: 'u', attack: 1.2 }); drum(t, { gain: 0.3, pitch: 42, decay: 1.4, sub: 0.7 }); drum(t + 1.6, { gain: 0.24, pitch: 42, decay: 1.4, sub: 0.7 }); }, 6);
  for (const u of [101.2, 102.3]) at(u, t => { drum(t, { gain: 0.32, pitch: 46, decay: 1.0, sub: 0.6 }); clash(t + 0.01, { gain: 0.03, f0: 900, dur: 0.8 }); }, 1);
  at(103.7, t => flute(t, shift(THEME_B, -1), 0.37, { gain: 0.06, octave: 12 }));
  at(107.42, t => { gliss(t, D3, D5, 0.9, 0.05); choir(t, [D4, A4, E5], 1.4, { gain: 0.035, vowel: 'o', attack: 0.8 }); });
  // ---- V. the years between: the forest painted; then a music box the scroll turns
  at(108.4, t => { gliss(t, D2, D6, 2.2, 0.045); choir(t + 0.4, [D4, A4, E5], 3, { gain: 0.04, vowel: 'o', attack: 2 }); }, 6);
  at(108.95, t => { pluck(t, D2, { gain: 0.1 }); harm(t + 0.05, D5, 0.04); });
  at(110.0, t => flute(t, [[D5, 2, 'v'], [B4, 1], [A4, 1], [Fs4, 2, 'v'], [E4, 2, 'f']], 1.0, { gain: 0.06, xiao: true }), 8);
  // (a melody laid along the story through the Watch path: its notes at the story positions they fall on in Watch)
  function box(u0, u1, notes, { gain = 0.13, bass = null } = {}) {
    const t0 = watchT(u0), t1 = watchT(u1), total = notes.reduce((a, n) => a + n[1], 0);
    let b = 0;
    for (const [m, nb, o = ''] of notes) {
      const tb = t0 + (b / total) * (t1 - t0), d = (nb / total) * (t1 - t0);
      at(watchU(tb), t => pluck(t, m, { gain, press: o.includes('p') ? 2 : o.includes('q') ? 1 : 0, pressAt: Math.min(0.3, d * 0.4), release: /[pq]/.test(o) ? d * 0.45 : 0, vib: o.includes('v') ? 0.2 : 0, vibAt: Math.min(0.35, d * 0.3) }), 0.12);
      b += nb;
    }
    if (bass) for (const [m, bb] of bass) at(watchU(t0 + (bb / total) * (t1 - t0)), t => pluck(t, m, { gain: gain * 0.6 }), 0.12);
  }
  // the first year: the whole theme, slowly, its last note the first mark on the tree
  box(112.95, 116.34, [...THEME_A, ...THEME_B.slice(0, -1)], { gain: 0.13, bass: [...BASS_A, [A2, 8], [B2, 10], [D3, 11], [E2, 12]] });
  // the years after, quicker: each a few notes climbing to its mark, each mark a string higher (A, B, D, E, F sharp, A)
  box(116.86, 117.94, [[D4, 1], [E4, 0.5], [Fs4, 0.5], [A4, 1]], { bass: [[D3, 0]] });
  box(118.3, 119.17, [[E4, 1], [Fs4, 0.5], [A4, 0.5], [B4, 1]], { bass: [[A2, 0]] });
  box(119.5, 120.16, [[Fs4, 0.5], [A4, 0.5], [B4, 0.5], [D5, 0.5]], { bass: [[B2, 0]] });
  box(120.45, 120.93, [[A4, 0.5], [B4, 0.5], [D5, 0.5], [E5, 0.5]], { bass: [[E3, 0]] });
  [[116.34, A4], [117.94, B4], [119.17, D5], [120.16, E5], [120.93, Fs5]].forEach(([u, m], i) => at(u, t => { pluck(t, m, { gain: 0.15, press: m % 12 === 6 ? 1 : 2, pressAt: 0.18, release: 0.45, vib: 0.22, vibAt: 0.75 }); pluck(t, [D2, D3, A2, B2, E2][i], { gain: 0.08 }); }, 1));
  // the sixth year: the walk to the tree through the seasons (the dizi, slowly, his uncle's theme); the sixth mark;
  // his palm on the six
  at(121.2, t => flute(t, THEME_A, 1.06, { gain: 0.065 }));
  for (const [u, m] of [[121.2, D2], [121.66, B2], [122.12, A2], [122.6, D3]]) at(u, t => pluck(t, m, { gain: 0.09, vib: 0.1, vibAt: 0.8 }), 1);
  at(122.95, t => { pluck(t, A5, { gain: 0.15, press: 2, pressAt: 0.2, release: 0.6, vib: 0.22, vibAt: 0.9 }); pluck(t, D3, { gain: 0.08 }); bell(t + 0.04, D6, 0.016, 4); }, 1);
  at(123.6, t => { tremolo(t, D5, 2.2, 0.05); choir(t, [D4, A4], 2.4, { gain: 0.03, vowel: 'o', attack: 1.2 }); }, 3);
  // ---- VI. what fell that night: no game; the way out as a stride-cut (a drum on each heel strike, a new chord on each
  // cut of the world, the cuts coming quicker); the missed beat: nothing, a mote of gold, the lens leaves him
  at(124.85, t => { pluck(t, Fs4, { gain: 0.07, vib: 0.18 }); pluck(t + 1.2, E4, { gain: 0.05 }); });
  {
    const U0 = 125.9, DU = 0.318, CUTS = [0, 3, 6, 8, 10, 11];
    const CH = [[D3, A3], [E3, B3], [Fs3, B3], [A3, E4], [B3, Fs4], [D4, A4]];
    for (let h = 0; h < 24; h++) {
      const ph = h / 2, ci = Number.isInteger(ph) ? CUTS.indexOf(ph) : -1;
      at(U0 + ph * DU, t => {
        if (ci >= 0) {
          drum(t, { gain: ci ? 0.34 : 0.2, pitch: 50, decay: 0.8, sub: ci ? 0.7 : 0.3 });
          for (const m of CH[ci]) pluck(t, m, { gain: 0.11, vib: 0.12, vibAt: 0.5 });
          if (ci) harm(t + 0.01, CH[ci][1], 0.03);
        } else drum(t, { gain: 0.07, pitch: h % 2 ? 84 : 90, decay: 0.16, skin: 0.7 });
      }, 0.12);
    }
    at(U0 + 12 * DU, t => { bell(t + 0.03, E6, 0.04, 4.5); harm(t + 0.05, A4, 0.025); }, 2);
  }
  at(129.9, t => choir(t, [D4, A4, E5], 3.5, { gain: 0.035, vowel: 'o', attack: 2.2 }), 6);
  at(130.5, t => tremolo(t, A4, 2.6, 0.045));
  at(130.62, t => flute(t, [[A5, 1.5, 'g'], [D5, 1], [B4, 1], [E5, 2.5, 'v']], 0.75, { gain: 0.05 }), 6);
  // the rim; the dell below; the slide down into it
  at(132.2, t => gliss(t, A3, A5, 1.2, 0.045), 3);
  at(132.35, t => gliss(t, A5, D4, 0.9, 0.035), 3);
  at(133.6, t => { choir(t, [D4, Fs4, A4, D5], 5, { gain: 0.045, vowel: 'a', attack: 3 }); xuan(t + 1.2, 0.55, 0.04); }, 6);
  at(136.4, t => { XUAN.forEach((m, i) => bell(t + i * 0.5, m + 12, 0.018, 3.2)); }, 4);
  at(137.4, t => { choir(t, [D4, A4, D5, E5], 4, { gain: 0.035, vowel: 'a', attack: 1.6 }); flute(t + 0.4, [[A4, 1.5, 'g'], [B4, 0.75], [D5, 0.75], [B4, 1.5, 'v'], [A4, 3, 'v']], 0.9, { gain: 0.06, xiao: true }); }, 6);
  at(139.16, t => cut(t, 0.5), 2);
  at(138.5, t => gliss(t, E3, E5, 1.6, 0.045), 3);
  // the air drawn up into the light: the strings, quicker and higher, until the pillar falls
  for (let i = 0; i < 18; i++) at(139.16 + 0.27 * Math.pow(i / 18, 0.75), t => pluck(t, [A4, B4, D5, E5, Fs5, A5][Math.floor(i / 3)], { gain: 0.05 + i * 0.004, len: 0.25 }), 0.1);
  // the pillar: the gong (rising), the drums, the choir, his uncle's theme in the bells brought home
  at(139.44, t => {
    gong(t, { gain: 0.3, f0: 52, dur: 10, fall: 1.05 }); drum(t, { gain: 0.6, pitch: 38, decay: 2, sub: 1 });
    choir(t + 0.02, [D3, A3, D4, Fs4, A4, D5], 5, { gain: 0.08, vowel: 'a', attack: 0.35, release: 4 });
    bells(t + 0.9, [[A5 - 12, 0.5], [D5 - 12, 0.5], [B4 - 12, 0.5], [E5 - 12, 1.5], ...THEME_A.slice(0, 5)], 0.58, 0.03);
  }, 8);
  // the first page: home
  at(141.1, t => { zheng(t, THEME_HOME, 0.78, { gain: 0.15, bass: BASS_HOME, must: true }); bell(t + 7.3, D5, 0.03, 7); }, 10);
  EV.sort((a, b) => a.u - b.u);

  // ================================================================ the duel's blows (from the engine)
  // kinds: 0 a blow, 1 one of a flurry, 2 the smash down, 3 into the cloud, 4 the lock grinding, 5 the lock bursting
  let lastBlowN = -1;
  function blow(t, kind, k) {
    const d = duelLP;
    if (kind === 1) { drum(t, { gain: 0.16 * k, pitch: 70, decay: 0.2, skin: 0.6, dest: d }); clash(t, { gain: 0.035 * k, f0: 1400 + Math.random() * 300, dur: 0.5, dest: d }); }
    else if (kind === 2) { drum(t, { gain: 0.42 * k, pitch: 44, decay: 1.1, sub: 0.8, dest: d }); clash(t, { gain: 0.08 * k, f0: 1000, dur: 1.2, dest: d }); gong(t, { gain: 0.08 * k, f0: 60, dur: 4, dest: d }); }
    else if (kind === 3) drum(t, { gain: 0.38 * k, pitch: 38, decay: 1.4, sub: 1, dest: d });
    else if (kind === 4) clash(t, { gain: 0.02 * k, f0: 700 + Math.random() * 200, dur: 0.4, dest: d });
    else if (kind === 5) { clash(t, { gain: 0.1 * k, f0: 1150, dur: 1.4, dest: d }); drum(t, { gain: 0.34 * k, pitch: 48, decay: 0.9, sub: 0.6, dest: d }); }
    else { drum(t, { gain: 0.3 * k, pitch: 54, decay: 0.6, sub: 0.4, dest: d }); clash(t, { gain: 0.06 * k, f0: 1200 + Math.random() * 200, dur: 0.9, dest: d }); }
  }

  // ================================================================ each frame
  let lastU = null, lastT = 0;
  return {
    // (the reader turned the sound on, or it was off for a while: nothing fires for what passed meanwhile)
    reset(u) {
      lastU = u; lastBlowN = -1;
      const t = ctx.currentTime + 0.05, sorrow = (u > 77 && u < 92) || (u > 94.6 && u < 106);
      harm(t, sorrow ? B3 : D4, 0.05); pluck(t, sorrow ? B2 : D2, { gain: 0.06 });
    },
    // (the instruments, for the offline check)
    _test: { pluck, harm, gliss, tremolo, zhengLine, fluteLine, drum, clash, gong, bell, choir, stringBuf },
    _events: () => EV.map(e => ({ u: e.u, src: e.fn.toString().replace(/\s+/g, ' ').slice(0, 110) })),
    update(u, t, x = {}) {
      if (lastU === null) lastU = u;
      const du = u - lastU, fdt = clamp(t - lastT, 0.001, 0.25);
      lastT = t;
      // ---- hits and phrases crossed going forward (a jump fires nothing; several in one frame are spread through it)
      if (du > 0 && du < 1.5) {
        const crossed = [];
        for (const e of EV) { if (e.u > u) break; if (e.u > lastU && t - e.last > e.gap) crossed.push(e); }
        const keep = crossed.length > 8 ? crossed.slice(-6) : crossed;
        const sp = keep.length > 1 ? clamp(fdt / keep.length, 0.03, 0.09) : 0;
        keep.forEach((e, j) => { e.last = t; e.fn(t + 0.015 + j * sp); });
      }
      lastU = u;
      // ---- the duel's blows (from the ground the fight is only far thunder through the clouds; under the screen,
      // muffled; in front of the lens, all of it)
      const duelK = (x.duelK ?? 0) * (u < 47.5 ? 0.5 : u < 48.46 ? 0.75 : smooth(49.3, 49.75, u)) * (1 - 0.6 * smooth(52.2, 52.8, u));
      if (x.blowN != null) {
        if (lastBlowN >= 0 && x.blowN > lastBlowN && x.blowN - lastBlowN < 4 && duelK > 0.05) blow(t + 0.01, x.blowKind ?? 0, duelK);
        lastBlowN = x.blowN;
      }
      const open = smooth(47.6, 48.0, u) * (1 - 0.8 * band(48.07, 48.1, 48.19, 48.21, u));
      duelLP.frequency.setTargetAtTime(380 + 11000 * open * open, t, 0.05);
      duelG.gain.setTargetAtTime(u > 44 && u < 53.5 ? 1 : 0, t, 0.2);
      // ---- layers
      for (const d of DRONES) d.g.gain.setTargetAtTime(d.lvl * d.k(u), t, 0.7);
      for (const p of PADS) {
        const k = p.k(u);
        if (k > 0.002 && !p.v) { p.cur = p.ms; p.v = choir(t, p.ms, 0, { gain: p.gain, vowel: p.vowel, held: true }); }
        if (!p.v) continue;
        // (a chord change: the next chord comes in under the last, which lets go)
        if (p.steps && k > 0.002) {
          let ch = p.ms;
          for (const [su, ms] of p.steps) if (u >= su) ch = ms;
          if (ch !== p.cur) { const old = p.v; old.g.gain.setTargetAtTime(0.0001, t, 0.06); old.stop(t + 0.6); p.cur = ch; p.v = choir(t, ch, 0, { gain: p.gain, vowel: p.vowel, held: true }); }
        }
        // (cut dead at the breach and on the missed beat)
        p.v.g.gain.setTargetAtTime(p.v.lvl * k, t, (u > 48.4 && u < 48.5) || (u > 129.69 && u < 129.76) ? 0.008 : 0.25);
        if (k <= 0.002) { p.idle += fdt; if (p.idle > 3) { p.v.stop(t + 0.1); p.v = null; p.idle = 0; } } else p.idle = 0;
      }
      for (const sw of SWELLS) sw(u, t);
      // ---- beds
      let g = null;
      for (const bd of BEDS) {
        const k = band(...bd.band, u);
        if (k <= 0.003) { bd.next = 0; continue; }
        if (!bd.next || bd.next < t - 0.12) { bd.next = t + 0.05; bd.i = 0; bd.t0 = bd.next; }
        while (bd.next < t + 0.22) { bd.fn(bd.i, bd.next, k, u); bd.i++; bd.next += bd.step; }
        g = { t0: bd.t0, beat: bd.beat, until: t + 0.5 };
      }
      grid = g;
      // ---- the breach: total silence (the music too), back as the sea of clouds opens
      const silent = u > 48.466 && u < 49.15;
      mute.gain.setTargetAtTime(silent ? 0 : 1, t, silent ? 0.004 : 0.25);
    },
  };
}
