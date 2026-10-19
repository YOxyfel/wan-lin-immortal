// Opt-in sound: the score (score.js, generated in the browser) over a procedural soundscape — wind, birdsong, his
// footsteps (on his own heel strikes), thunder, fire, the alarm bell, wolves, a heartbeat, water in the forest, the roar
// of the launch, the falling star, the hum of what fell from the sky.
// Everything is scheduled on the audio clock (never on timers, which a busy frame makes late), so it can also be
// rendered offline: createAudio({ context }) with an OfflineAudioContext, then update() step by step.
import { band, smooth } from './util.js';
import { STRIKES, STAR } from './timeline.js';
import { createScore, watchT } from './score.js';

export function createAudio({ context = null } = {}) {
  let ctx = null, master, limiter, windGain, windFilter, fireGain, waterGain, riseGain, riseFilter, humGain, roarGain, roarFilter, score = null, on = false;
  let lastChirp = 0, lastBell = 0, lastBeat = 0, lastHowl = 0, lastU = 0, lastPhase = null, lastToll = null;
  const noiseBuffer = () => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.15; }
    return b;
  };
  let nb = null;
  function loop(rate, filterType, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start();
    return [g, f];
  }
  // ---------------------------------------------------------------- recorded sound (assets/cinderfall/audio/)
  // Loaded when the sound is first turned on, from manifest.json: { sfx: { name: [files] }, music: { M1: file, ... } }.
  // Where a recording is there it takes the place of the sound made here; where it is not, the made one plays.
  // (from the page, not the module: the build bundles the modules elsewhere and copies this folder as it is)
  const BASE = typeof document !== 'undefined' ? new URL('assets/cinderfall/audio/', document.baseURI).href : './audio/';
  const bank = {}, tracks = {};
  // (where each recording's sound begins: a decoder may leave the encoder's few ms of silence at the head, and a hit
  // must land on its frame; an ambience's loop points, [start, length] in seconds, from the manifest: the file is
  // periodic past both ends, so wherever the decoder puts its start the loop is seamless)
  const heads = new WeakMap();
  let loops = {}, loopPts = {};
  const headOf = b => {
    const d = b.getChannelData(0), d2 = b.numberOfChannels > 1 ? b.getChannelData(1) : d, n = Math.min(d.length, b.sampleRate);
    for (let i = 0; i < n; i++) if (Math.abs(d[i]) > 0.003 || Math.abs(d2[i]) > 0.003) return Math.max(0, i / b.sampleRate - 0.002);
    return 0;
  };
  async function loadBank() {
    let m = null;
    try { const r = await fetch(BASE + 'manifest.json', { cache: 'no-cache' }); if (r.ok) m = await r.json(); } catch {}
    if (!m || !ctx) return;
    loopPts = m.loops || {};
    const dec = async f => { try { const b = await (await fetch(BASE + f)).arrayBuffer(); return await ctx.decodeAudioData(b); } catch (e) { console.warn('sound', f, e); return null; } };
    await Promise.all(Object.entries(m.sfx || {}).map(async ([name, files]) => {
      const v = (await Promise.all([].concat(files).map(dec))).filter(Boolean);
      if (!v.length) return;
      if (!loopPts[name]) for (const b of v) heads.set(b, headOf(b));
      bank[name] = v;
    }));
    await Promise.all(Object.entries(m.music || {}).map(async ([id, f]) => { const b = await dec(f); if (b) tracks[id] = b; }));
  }
  const has = name => !!(bank[name] && bank[name].length);
  // one recording, at a time on the audio clock (a variant at random; rate for pitch; pan)
  function play(name, { gain = 1, rate = 1, at = ctx.currentTime, pan = 0, dest = master, off = 0 } = {}) {
    const v = bank[name];
    if (!v || !v.length) return false;
    const b = v[(Math.random() * v.length) | 0];
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    let n = src.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n = n.connect(p); }
    n.connect(dest); src.start(Math.max(at, ctx.currentTime), off + (heads.get(b) || 0));
    return true;
  }
  // a looped recording under a level (an ambience): made the first time it is asked for, silent until then
  function loopLevel(name) {
    if (loops[name] !== undefined) return loops[name];
    if (!has(name)) return null;
    const src = ctx.createBufferSource(); src.buffer = bank[name][0]; src.loop = true;
    const lp = loopPts[name];
    if (lp && lp[0] + lp[1] <= src.buffer.duration) { src.loopStart = lp[0]; src.loopEnd = lp[0] + lp[1]; }
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(master);
    src.start(ctx.currentTime, lp ? lp[0] + Math.random() * lp[1] : Math.random() * src.buffer.duration);
    return (loops[name] = g);
  }
  // the music: ten tracks, one to each scene (see the music list); in Watch each is laid where it falls in the film,
  // offset by how far into its scene the film is; read by scrolling, it starts with its scene and loops while the reader
  // stays there; the next scene's track crossfades in. While a track is laid under a scene the score's melody is
  // closed (its picture-locked hits play on). [id, from, to (story positions), seconds of fade in, of fade out]
  const CUES = [['M1', 0, 46.1, 2, 2.5], ['M2', 46.1, 48.466, 0.6, 0.02], ['M3', 49.2, 54.42, 0.4, 1.2], ['M4', 54.42, 61.7, 1.5, 1.2],
    ['M5', 61.7, 79.0, 0.2, 2.5], ['M6', 79.0, 91.4, 2, 0.35], ['M7a', 92.05, 98.6, 2.5, 1.5], ['M7', 92.05, 107.42, 2.5, 2.5], ['M7b', 98.6, 107.42, 1, 2.5],
    ['M8', 108.4, 124.85, 2.5, 2], ['M9', 124.85, 139.44, 2, 0.2], ['M10', 139.44, 145.5, 0.05, 4]];
  let watching = false, cueNow = null, cueSrc = null, cueGain = null;
  function cueAt(u) {
    for (const c of CUES) if (u >= c[1] && u < c[2] && tracks[c[0]]) {
      // (M7a/M7b, when both halves were sent, take the place of a single M7)
      if (c[0] === 'M7' && (tracks.M7a || tracks.M7b)) continue;
      return c;
    }
    return null;
  }
  function music(u, t) {
    const c = cueAt(u);
    if (c !== cueNow) {
      if (cueGain) { cueGain.gain.cancelScheduledValues(t); cueGain.gain.setTargetAtTime(0.0001, t, Math.max(0.01, (cueNow ? cueNow[4] : 1) / 3)); const s0 = cueSrc; setTimeout(() => { try { s0.stop(); } catch {} }, 9000); }
      cueNow = c; cueSrc = cueGain = null;
      if (c) {
        const buf = tracks[c[0]];
        cueSrc = ctx.createBufferSource(); cueSrc.buffer = buf; cueSrc.loop = true;
        cueGain = ctx.createGain(); cueGain.gain.value = 0.0001;
        cueSrc.connect(cueGain).connect(master);
        const off = watching ? Math.max(0, watchT(u) - watchT(c[1])) % buf.duration : 0;
        cueSrc.start(t, off);
        cueGain.gain.setTargetAtTime(0.85, t, Math.max(0.01, c[3] / 3));
      }
      if (score) score.melody(c ? 0 : 1, t);
    }
  }
  function start() {
    ctx = context || new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = context ? 0.9 : 0;
    // (a limiter at the end, so nothing that piles up can clip)
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4; limiter.knee.value = 4; limiter.ratio.value = 16; limiter.attack.value = 0.002; limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);
    nb = noiseBuffer();
    [windGain, windFilter] = loop(1, 'bandpass', 420, 0.6);
    [fireGain] = loop(1.7, 'lowpass', 900, 0.7);
    [waterGain] = loop(2.3, 'bandpass', 1800, 0.4);
    // the air drawn up into the light gathering over the dell, rising in pitch until the pillar falls
    [riseGain, riseFilter] = loop(1.3, 'bandpass', 300, 1.4);
    // the launch: the roar of the air going past, low, rising as the eye climbs
    [roarGain, roarFilter] = loop(0.8, 'lowpass', 140, 0.9);
    // the hum of what fell from the sky: D, low (the score's home)
    humGain = ctx.createGain(); humGain.gain.value = 0; humGain.connect(master);
    for (const [f, a] of [[73.42, 0.5], [110, 0.3], [146.83, 0.22], [220, 0.12]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = a; o.connect(g).connect(humGain); o.start(); }
    // the score
    score = createScore(ctx, master, { play: (n, o) => play(n, o), has });
    if (!context) loadBank();
  }
  const env = (g, t, a, peak, d) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function tone(freq, type, peak, a, d, glide = 0, at = ctx.currentTime) {
    const t = at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + a + d);
    env(g, t, a, peak, d);
    o.connect(g).connect(master); o.start(t); o.stop(t + a + d + 0.05);
  }
  function burst(peak, dur, freq, q = 0.8, type = 'lowpass', at = ctx.currentTime) {
    const t = at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nb; f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, 0.01, peak, dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 3); s.stop(t + dur + 0.1);
  }
  function chirp(t) { const f = 2400 + Math.random() * 2200, n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.2), 'sine', 0.035, 0.01, 0.09, 1.4, t + i * 0.11); }
  function bell(k = 1, t = ctx.currentTime) { [220, 440 * 1.19, 660 * 0.98, 880 * 1.33].forEach((f, i) => tone(f * k, 'sine', 0.06 / (i + 1), 0.005, 3.2 - i * 0.5, 0, t)); }
  function howl(gain = 0.05) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
    o.frequency.setValueAtTime(340, t); o.frequency.linearRampToValueAtTime(560, t + 0.8); o.frequency.linearRampToValueAtTime(470, t + 2.6);
    lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg).connect(o.frequency);
    env(g, t, 0.5, gain, 2.4);
    o.connect(f).connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 3); lfo.stop(t + 3);
  }
  // a footstep: the heel, then the foot rolling onto the ground (earth and stone in the valley, leaves in the forest)
  function step(t, k, run, u) {
    const forest = u > 108.3;
    if (play(forest ? 'step-leaves' : 'step-dirt', { gain: Math.min(1, 0.45 * k * (1 + run * 0.6)), rate: 0.9 + Math.random() * 0.2, at: t })) return;
    burst(0.05 * k * (1 + run * 0.6), 0.05, 380 + Math.random() * 160, 0.9, 'lowpass', t);
    burst(0.018 * k, 0.07, forest ? 2600 + Math.random() * 1400 : 1500 + Math.random() * 600, forest ? 1.2 : 2, 'bandpass', t + 0.012);
    if (forest && Math.random() < 0.5) burst(0.012 * k, 0.05, 4200 + Math.random() * 1800, 2, 'bandpass', t + 0.05);
  }
  return {
    get on() { return on; },
    async toggle() {
      on = !on;
      if (on && !ctx) start();
      if (ctx) { await ctx.resume(); master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.3); }
      if (on && score) { score.reset(lastU); lastPhase = null; cueNow = undefined; }
      return on;
    },
    // (for the offline check: start on the context given, sound on, the recordings decoded into it)
    async startOffline({ bank = true } = {}) { start(); on = true; if (bank) await loadBank(); },
    // Watch on or off: the music laid on the film's own clock, or following the reader
    setWatch(v) { watching = !!v; cueNow = undefined; },
    // u: story position; now: ms; speed: how fast the reader scrolls; wind; m: the engine's metrics
    update(u, now, speed, wind, m = {}) {
      if (!on || !ctx) { lastU = u; return; }
      const t = ctx.currentTime;
      const pass = (at) => lastU < at && u >= at && u - at < 1.5;
      // the dell: still air under the great tree; the crossing: wind in the white between the valley and the forest
      const hollow = band(132.6, 133.4, 140.8, 141.4, u) * 0.6;
      const cloud = band(105.6, 107, 109, 110.4, u);
      // (out over the sea of clouds, after the roar of the launch: silence for a moment, the wind gone with it)
      const hush = band(48.466, 48.468, 49.2, 49.7, u);
      // (recorded ambiences where they are there: the morning, high over the sea of clouds, the winters, the autumn)
      const amb = (name, k, tau = 0.6) => { const g = loopLevel(name); if (g) g.gain.setTargetAtTime(k, t, tau); return !!g; };
      const morningA = amb('morning-loop', 0.5 * band(0.5, 3, 44.2, 46.2, u));
      amb('high-wind-loop', 0.55 * band(49.0, 49.6, 52.3, 52.7, u) * (1 - hush), 0.3);
      amb('winter-loop', 0.5 * band(110.6, 111.4, 121.0, 121.6, u));
      amb('autumn-loop', 0.45 * band(121.2, 121.9, 132.9, 133.6, u) * (1 - hollow * 0.6));
      windGain.gain.setTargetAtTime((0.025 + wind * 0.05 + cloud * 0.08) * (1 - hollow * 0.85) * (1 - hush) * (morningA && u < 46 ? 0.5 : 1), t, hush > 0.5 ? 0.012 : 0.4);
      // (and cut dead at the breach: the silence over the sea is total)
      const launch = band(47.5, 47.56, 48.466, 48.468, u);
      roarGain.gain.setTargetAtTime(0.16 * launch, t, launch > 0.01 ? 0.08 : 0.01);
      roarFilter.frequency.setTargetAtTime(110 + 520 * launch * smooth(47.5, 48.45, u), t, 0.2);
      windFilter.frequency.setTargetAtTime(300 + wind * 380 + cloud * 300, t, 0.5);
      const fire = band(55, 58, 104, 107.5, u) * (1 - band(84.5, 85.5, 91.6, 92.6, u) * 0.6);
      const fireRec = amb('fire-loop', fire * 0.45 * (1 - band(79.4, 80.4, 91.6, 92.6, u) * 0.6), 0.3);
      fireGain.gain.setTargetAtTime(fire * (0.05 + 0.03 * Math.sin(now * 0.013)) * (fireRec ? 0.3 : 1), t, 0.2);
      if (fire > 0.1 && Math.random() < (fireRec ? 0.06 : 0.18)) burst(0.05 * fire, 0.05, 2800 + Math.random() * 3000, 1, 'highpass');
      // water: the forest's streams, the camp's; the dell
      const water = band(109, 111, 122.6, 123.4, u) + 0.8 * band(130.3, 130.6, 131.5, 131.8, u) + band(133, 134, 140.6, 141.2, u) * 0.6;
      waterGain.gain.setTargetAtTime(water * 0.03, t, 0.5);
      const riseK = smooth(139.16, 139.43, u) * (u < 139.44 ? 1 : 0);
      riseGain.gain.setTargetAtTime(0.11 * riseK * riseK, t, u < 139.44 ? 0.12 : 0.03);
      riseFilter.frequency.setTargetAtTime(260 + 2600 * riseK * riseK, t, 0.15);
      humGain.gain.setTargetAtTime(band(133.4, 136.5, 141.5, 143, u) * (0.016 + smooth(137.7, 140, u) * 0.026) + band(108.8, 109.4, 110.6, 111.6, u) * 0.016, t, 0.6);
      // (no birds in the winters, nor on the morning of the sixth autumn when there was not one track)
      const birdsOn = u < 46.5 || (u > 114.4 && u < 124.5 && !(u > 119.4 && u < 120.4)) || (u > 125.9 && u < 129.4) || (u > 133.5 && u < 140);
      const recBirds = (morningA && u < 46.2) || (u > 121.2 && u < 133.6 && !!loopLevel('autumn-loop'));
      if (birdsOn && !recBirds && now - lastChirp > 900 + Math.random() * 2500) { lastChirp = now; chirp(t); }
      // his footsteps, on his heel strikes
      const st = m.step;
      if (st && st.speed > 0.15 && st.near > 0.02 && hollow < 0.5) {
        if (lastPhase !== null) {
          const a = lastPhase * 2, b = st.phase * 2, d = ((st.phase - lastPhase) % 1 + 1) % 1;
          if (d < 0.3 && Math.floor(b + (b < a ? 2 : 0)) !== Math.floor(a)) step(t, Math.min(1, st.near * (0.5 + st.speed * 0.4)), st.run, u);
        }
        lastPhase = st.phase;
      } else lastPhase = null;
      for (const [at, s] of STRIKES) if (pass(at)) { if (!play('thunder', { gain: 0.65 * s, rate: 0.95 + Math.random() * 0.1, off: 0.25 })) { burst(0.45 * s, 2.6, 160, 0.7); tone(48, 'sine', 0.3 * s, 0.02, 2.2, 0.6); } }
      // the bell under the gate tolls by itself while the village burns: on the toll of the one that is seen swinging
      // (engine.js), or, with no picture to follow (the soundtrack's own render), every 4.2 s
      const toll = () => { if (!play('bell', { gain: 0.4 })) bell(); };
      if (m && m.bellToll != null) { if (m.bellToll !== lastToll) { if (lastToll != null && u > 61 && u < 78) toll(); lastToll = m.bellToll; } }
      else if (u > 61 && u < 76 && now - lastBell > 4200) { lastBell = now; toll(); }
      if (((u > 62 && u < 66) || (u > 97.5 && u < 103)) && now - lastHowl > 7000) { lastHowl = now; if (!play('wolf-howl', { gain: u > 97 ? 0.22 : 0.3, pan: Math.random() - 0.5 })) howl(u > 97 ? 0.03 : 0.05); }
      if (pass(72.86)) play('wolf-snarl', { gain: 0.45 });
      // the heartbeat: in the dark under the glow; at his uncle's side, stopping as the hand falls
      const beat = band(57, 58.5, 61.5, 62.5, u) + band(83, 84, 91.36, 91.42, u);
      if (beat > 0.2 && now - lastBeat > 850) { lastBeat = now; if (!play('heartbeat', { gain: 0.4 * Math.min(1, beat) })) { tone(52, 'sine', 0.26 * Math.min(1, beat), 0.005, 0.18, 0.7, t); tone(48, 'sine', 0.16 * Math.min(1, beat), 0.005, 0.16, 0.7, t + 0.19); } }
      // (a rooster, once, somewhere down the lanes, as the hamlet is first seen)
      if (pass(7.6)) play('rooster', { gain: 0.22, pan: -0.35 });
      // the launch: the burst out of the pines; a thud as the eye goes through each sheet of cloud; out into the sun
      if (pass(46.1)) play('hush', { gain: 0.6 });
      if (pass(47.535)) { if (!play('launch', { gain: 0.85 })) { burst(0.3, 1.4, 90, 0.6); tone(38, 'sine', 0.3, 0.02, 1.6, 1.8); } }
      for (const at of [48.21, 48.34, 48.45]) if (pass(at)) { if (!play('cloud-punch', { gain: 0.8, rate: 0.9 + Math.random() * 0.2 })) { burst(0.22, 0.5, 160, 0.6); tone(55, 'sine', 0.22, 0.004, 0.45, 0.7); } }
      // (the dive after the falling light)
      if (pass(52.5)) play('dive', { gain: 0.55 });
      if (pass(48.6)) tone(1760, 'sine', 0.022, 0.9, 3.2, 1);
      // the star: its fall, and where it comes down
      if (pass(STAR[0])) tone(1300, 'sine', 0.04, 0.08, 1.4, 0.35);
      if (pass(STAR[1])) { if (!play('strike', { gain: 1 })) { burst(0.4, 3.4, 90, 0.6); burst(0.12, 1.2, 600, 0.5); } }
      // the tear (the same note as the sun over the sea)
      if (pass(92.05)) { if (!play('shimmer', { gain: 0.35, rate: 1.1 })) tone(1760, 'sine', 0.05, 0.003, 1.6, 0.98); }
      // the soul rising; the masks' array on the crag
      if (pass(92.6)) play('shimmer', { gain: 0.45, rate: 0.85 });
      if (pass(98.6)) play('sect-pulse', { gain: 0.35 });
      // his blood on the crystal: it cracks
      if (pass(136.95)) play('crystal-crack', { gain: 0.75 });
      // the light gathering over the dell (its whine ending as the pillar falls)
      if (pass(139.27)) play('gather', { gain: 0.6 });
      // the last page: the drop of his blood blooming into ink
      if (pass(141.5)) play('ink', { gain: 0.6 });
      if (pass(108.9)) bell(0.75);
      // the slide down into the dell
      if (pass(132.35)) burst(0.3, 0.6, 220, 0.6);
      // the pillar strikes: a crack, the ground's boom under it, and the bell after
      if (pass(139.44)) { if (!play('pillar', { gain: 1, off: 0.09 })) { burst(0.3, 0.3, 3200, 0.7, 'highpass'); burst(0.55, 2.8, 110, 0.7); tone(40, 'sine', 0.5, 0.004, 3.2, 0.55); tone(80, 'triangle', 0.12, 0.004, 1.4, 0.5); } }
      if (pass(139.52)) bell(1.5);
      if (pass(143.9)) bell(1);
      if (score) score.update(u, t, m);
      music(u, t);
      lastU = u;
    },
  };
}
