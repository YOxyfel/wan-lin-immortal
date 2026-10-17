// The opening as the loading screen: the first drop, the sign written stroke by stroke and the title, each beat played
// once the story's preparation has got far enough, and only while nothing else runs.
//
// On Windows the browser prepares each shader the first time it is drawn, one at a time, and while it does nothing on
// the page moves, CSS animation included: it all goes through the same GPU process. Preparing the story is made of such
// moments. So the page and the work take turns. A beat plays with the page to itself (the GPU idle, the main thread
// free), and the work runs only between beats, while everything on screen is still: a freeze on a still screen cannot
// be seen. Each beat also waits for its share of the work (`at`, 0..1 of it), so the sign is written as the story is
// prepared: a fast machine writes it straight through, a slow one rests between strokes as a calligrapher would.
//
// beats: [{ id, dur (seconds), at (0..1) }] in the order they play.
export function createRitual(beats) {
  let f = 0, next = 0, playing = -1, speed = 1, quicken = true, chain = Promise.resolve();
  const t0 = beats.map(() => Infinity), t1 = beats.map(() => Infinity), len = beats.map(b => b.dur * 1000);
  const index = new Map(beats.map((b, i) => [b.id, i]));
  const listeners = [];
  // (a frame drawn; in a background tab, where none come, a moment instead)
  const frame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(go); setTimeout(go, 100); });
  async function playOne() {
    const i = next++;
    // (when the work is ahead, the brush quickens: a beat with others already waiting behind it plays a little faster)
    let waiting = 0;
    for (let j = i + 1; quicken && j < beats.length && f >= beats[j].at; j++) waiting++;
    len[i] = beats[i].dur * 1000 / (speed * (1 + 0.3 * Math.min(2, waiting)));
    // (it starts on a frame boundary, so its first frame shows it at its start)
    await frame();
    t0[i] = performance.now();
    playing = i;
    for (const fn of listeners) fn(beats[i].id, 'start');
    await new Promise(res => setTimeout(res, len[i]));
    // its last state drawn and on screen before the work comes back
    await frame(); await frame();
    t1[i] = performance.now();
    playing = -1;
    for (const fn of listeners) fn(beats[i].id, 'end');
  }
  const due = () => next < beats.length && f >= beats[next].at;
  const api = {
    get progress() { return f; },
    // the work has got this far (0..1; it never goes back)
    reach(v) { f = Math.max(f, Math.min(1, v)); },
    // is there a beat waiting for the screen?
    due() { return playing < 0 && due(); },
    // play every beat now due, one after the other; resolves once the last is over and on screen
    play() { chain = chain.then(async () => { while (due()) await playOne(); }); return chain; },
    // how far a beat has got at time `now` (performance.now() units): 0 before it starts, 1 once it is over
    at(id, now) {
      const i = index.get(id);
      if (i === undefined || !(now >= t0[i])) return 0;
      return Math.min(1, (now - t0[i]) / len[i]);
    },
    // seconds since a beat started (0 before)
    since(id, now) { const i = index.get(id); return i !== undefined && now >= t0[i] ? (now - t0[i]) / 1000 : 0; },
    started(id) { const i = index.get(id); return i !== undefined && t0[i] < Infinity; },
    get finished() { return next >= beats.length && playing < 0; },
    on(fn) { listeners.push(fn); },
    // all of it again, a little quicker, the work long done (the Replay button)
    replay(k = 1.5) {
      chain = chain.then(async () => {
        speed = k; quicken = false; next = 0; playing = -1;
        t0.fill(Infinity); t1.fill(Infinity);
        f = 1;
        while (due()) await playOne();
        speed = 1; quicken = true;
      });
      return chain;
    },
    // what happened when, for measuring: [id, start ms, end ms]
    get log() { return beats.map((b, i) => [b.id, Math.round(t0[i]), Math.round(t1[i])]); },
  };
  return api;
}
