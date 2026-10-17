// Opt-in procedural soundscape: wind, birdsong, footsteps, thunder, fire, a temple bell, wolves, a heartbeat,
// water in the forest, the bow, the boar, the ground giving way, and the hum of what fell from the sky.
import { band, smooth, clamp } from './util.js';
import { STRIKES } from './timeline.js';

export function createAudio() {
  let ctx = null, master, windGain, windFilter, fireGain, fireFilter, waterGain, waterFilter, riseGain, riseFilter, humGain, roarGain, roarFilter, on = false;
  let lastStep = 0, lastChirp = 0, lastBell = 0, lastBeat = 0, lastHowl = 0, lastU = 0;
  const noiseBuffer = () => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.15; }
    return b;
  };
  function loop(nb, rate, filterType, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start();
    return [g, f];
  }
  function start() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const nb = noiseBuffer();
    [windGain, windFilter] = loop(nb, 1, 'bandpass', 420, 0.6);
    [fireGain, fireFilter] = loop(nb, 1.7, 'lowpass', 900, 0.7);
    [waterGain, waterFilter] = loop(nb, 2.3, 'bandpass', 1800, 0.4);
    // the air drawn up into the light gathering over the dell, rising in pitch until the pillar falls
    [riseGain, riseFilter] = loop(nb, 1.3, 'bandpass', 300, 1.4);
    // the launch: the roar of the air going past, low, rising as the eye climbs
    [roarGain, roarFilter] = loop(nb, 0.8, 'lowpass', 140, 0.9);
    // a low chord that rises under the scroll
    humGain = ctx.createGain(); humGain.gain.value = 0; humGain.connect(master);
    for (const [f, a] of [[110, 0.5], [164.8, 0.3], [220, 0.22], [329.6, 0.12]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = a; o.connect(g).connect(humGain); o.start(); }
  }
  const env = (g, t, a, peak, d) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function tone(freq, type, peak, a, d, glide = 0, dest = master) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + a + d);
    env(g, t, a, peak, d);
    o.connect(g).connect(dest); o.start(t); o.stop(t + a + d + 0.05);
  }
  function burst(peak, dur, freq, q = 0.8, type = 'lowpass') {
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuffer(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, 0.01, peak, dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.1);
  }
  function chirp() { const f = 2400 + Math.random() * 2200; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) setTimeout(() => on && tone(f * (1 + Math.random() * 0.2), 'sine', 0.035, 0.01, 0.09, 1.4), i * 110); }
  function bell(k = 1) { [220, 440 * 1.19, 660 * 0.98, 880 * 1.33].forEach((f, i) => tone(f * k, 'sine', 0.06 / (i + 1), 0.005, 3.2 - i * 0.5)); }
  function howl(gain = 0.05) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
    o.frequency.setValueAtTime(340, t); o.frequency.linearRampToValueAtTime(560, t + 0.8); o.frequency.linearRampToValueAtTime(470, t + 2.6);
    lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg).connect(o.frequency);
    env(g, t, 0.5, gain, 2.4);
    o.connect(f).connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 3); lfo.stop(t + 3);
  }
  return {
    get on() { return on; },
    async toggle() {
      on = !on;
      if (on && !ctx) start();
      if (ctx) { await ctx.resume(); master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.3); }
      return on;
    },
    update(u, now, speed, wind) {
      if (!on || !ctx) { lastU = u; return; }
      const t = ctx.currentTime;
      const pass = (at) => lastU < at && u >= at && u - at < 1.5;
      // the dell: still air under the great tree; the crossing: wind in the white between the valley and the forest
      const hollow = band(132.6, 133.4, 140.8, 141.4, u) * 0.6;
      const cloud = band(105.6, 107, 109, 110.4, u);
      // (out over the sea of clouds, after the roar of the launch: silence for a moment, the wind gone with it)
      const hush = band(48.466, 48.468, 49.2, 49.7, u);
      windGain.gain.setTargetAtTime((0.025 + wind * 0.05 + cloud * 0.08) * (1 - hollow * 0.85) * (1 - hush), t, hush > 0.5 ? 0.012 : 0.4);
      // (and cut dead at the breach: the silence over the sea is total)
      const launch = band(47.5, 47.56, 48.466, 48.468, u);
      roarGain.gain.setTargetAtTime(0.16 * launch, t, launch > 0.01 ? 0.08 : 0.01);
      roarFilter.frequency.setTargetAtTime(110 + 520 * launch * smooth(47.5, 48.45, u), t, 0.2);
      windFilter.frequency.setTargetAtTime(300 + wind * 380 + cloud * 300, t, 0.5);
      const fire = band(55, 58, 104, 107.5, u) * (1 - band(84.5, 85.5, 91.6, 92.6, u) * 0.6);
      fireGain.gain.setTargetAtTime(fire * (0.05 + 0.03 * Math.sin(now * 0.013)), t, 0.2);
      if (fire > 0.1 && Math.random() < 0.18) burst(0.05 * fire, 0.05, 2800 + Math.random() * 3000, 1, 'highpass');
      const water = band(109, 111, 122.6, 123.4, u) + band(133, 134, 140.6, 141.2, u) * 0.6;
      waterGain.gain.setTargetAtTime(water * 0.03, t, 0.5);
      const riseK = smooth(139.16, 139.43, u) * (u < 139.44 ? 1 : 0);
      riseGain.gain.setTargetAtTime(0.11 * riseK * riseK, t, u < 139.44 ? 0.12 : 0.03);
      riseFilter.frequency.setTargetAtTime(260 + 2600 * riseK * riseK, t, 0.15);
      humGain.gain.setTargetAtTime(band(133.4, 136.5, 141.5, 143, u) * (0.03 + smooth(137.7, 140, u) * 0.05) + band(108.8, 109.4, 110.6, 111.6, u) * 0.025, t, 0.6);
      const birdsOn = u < 46.5 || (u > 114.4 && u < 129.4 && !(u > 119.4 && u < 120.4)) || (u > 133.5 && u < 140);
      if (birdsOn && now - lastChirp > 900 + Math.random() * 2500) { lastChirp = now; chirp(); }
      if (speed > 0.3 && hollow < 0.5 && now - lastStep > (speed > 3 ? 260 : 480)) { lastStep = now; burst(0.06, 0.06, 500 + Math.random() * 200); }
      for (const [at, s] of STRIKES) if (pass(at)) { burst(0.45 * s, 2.6, 160, 0.7); tone(48, 'sine', 0.3 * s, 0.02, 2.2, 0.6); }
      if (u > 61 && u < 76 && now - lastBell > 4200) { lastBell = now; bell(); }
      if (((u > 62 && u < 66) || (u > 97.5 && u < 103)) && now - lastHowl > 7000) { lastHowl = now; howl(u > 97 ? 0.03 : 0.05); }
      const beat = band(57, 58.5, 61.5, 62.5, u) + band(83, 84, 91.6, 92.4, u) + band(129.6, 129.9, 131.0, 131.4, u) * 1.4;
      if (beat > 0.2 && now - lastBeat > (u > 129 ? 520 : 850)) { lastBeat = now; tone(52, 'sine', 0.35 * Math.min(1, beat), 0.005, 0.18, 0.7); setTimeout(() => on && tone(48, 'sine', 0.22 * Math.min(1, beat), 0.005, 0.16, 0.7), 190); }
      // the launch: the burst out of the pines; a thud as the eye goes through each sheet of cloud; out into the sun
      if (pass(47.535)) { burst(0.3, 1.4, 90, 0.6); tone(38, 'sine', 0.3, 0.02, 1.6, 1.8); }
      for (const at of [48.21, 48.34, 48.45]) if (pass(at)) { burst(0.22, 0.5, 160, 0.6); tone(55, 'sine', 0.22, 0.004, 0.45, 0.7); }
      if (pass(48.6)) tone(1568, 'sine', 0.025, 0.9, 3.2, 1);
      // the star falls; the tear; the crossing
      if (pass(51.3)) { tone(1300, 'sine', 0.05, 0.4, 2.6, 0.35); burst(0.14, 3.2, 90, 0.6); }
      if (pass(92.05)) tone(1760, 'sine', 0.05, 0.003, 1.6, 0.98);
      if (pass(108.9)) bell(0.75);
      // the hunt
      if (pass(129.05)) { tone(180, 'triangle', 0.12, 0.002, 0.25, 0.6); burst(0.05, 0.12, 3000, 2, 'bandpass'); }
      if (pass(129.2)) { burst(0.12, 0.08, 4200, 3, 'bandpass'); tone(1900, 'square', 0.03, 0.001, 0.06, 0.5); }
      if (pass(129.5)) { tone(90, 'sawtooth', 0.08, 0.05, 0.7, 0.7); burst(0.08, 0.4, 300, 0.7); }
      if (u > 129.6 && u < 131.1 && Math.random() < 0.08) burst(0.07, 0.12, 180 + Math.random() * 80, 0.7);
      if (pass(131.05)) { burst(0.45, 2.0, 140, 0.6); burst(0.22, 1.2, 900, 0.5); }
      if (pass(132.4)) burst(0.3, 0.6, 220, 0.6);
      // the pillar strikes: a crack, the ground's boom under it, and the bell after
      if (pass(139.44)) { burst(0.3, 0.3, 3200, 0.7, 'highpass'); burst(0.55, 2.8, 110, 0.7); tone(40, 'sine', 0.5, 0.004, 3.2, 0.55); tone(80, 'triangle', 0.12, 0.004, 1.4, 0.5); }
      if (pass(139.52)) bell(1.5);
      if (pass(143.5)) bell(1);
      lastU = u;
    },
  };
}
