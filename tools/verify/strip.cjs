// Frames of the film at its own speed: the story stepped at 30 frames a second on Watch's clock (so heads, springs,
// bolts and everything else move as they do when it plays, on the story's own clock), every n-th frame rendered and saved.
// Usage (under serve.cjs): node strip.cjs OUTDIR TAG W H CAPFPS T0 T1 [T0 T1 ...]   (spans in Watch seconds)
// Saves OUTDIR/u<u>-<TAG>.jpg (sheet.py labels them with their Watch time).
// Debug mode (?debug) turns the scripted strikes off: the run home's ground strikes are struck here as the story
// crosses them. Renders only the captured frames: one render after a run of updates can show a stray speck the film
// itself never draws (a cold first frame); judge a lone speck in a 4-a-second strip against a denser one.
const fs = require('fs');
const { launch, site, offline } = require('./browser.cjs');
(async () => {
  const [out, tag, W, H, capfps, ...ts] = process.argv.slice(2);
  const spans = [];
  for (let i = 0; i + 1 < ts.length; i += 2) spans.push([+ts[i], +ts[i + 1]]);
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  await offline(page);
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) console.log('[console]', m.text().slice(0, 300)); });
  await page.goto(site() + '/index.html?q=high&warm=0&debug', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#prologue') && document.querySelector('#prologue').dataset.forest === 'true', null, { timeout: 2400000 });
  const FPS = 30, every = Math.max(1, Math.round(FPS / +capfps));
  for (const [t0, t1] of spans) {
    // (a second of the film before the strip, so what moves is already moving)
    for (let t = t0 - 1; t <= t1 + 1e-6; t += 1 / FPS) {
      const cap = t >= t0 - 1e-6 && Math.round((t - t0) * FPS) % every === 0;
      const u = await page.evaluate(async ([t, dt, cap]) => {
        const { watchT } = await import('/assets/cinderfall/score.js');
        const { memoryAt, STRIKES, timeRate } = await import('/assets/cinderfall/timeline.js');
        let a = 0, b = 146;
        for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (watchT(m) < t) a = m; else b = m; }
        const u = (a + b) / 2;
        const G = STRIKES.filter(x => x[3] === 2), lu = window.__lastU ?? u;
        G.forEach((x, i) => { if (lu < x[0] && u >= x[0]) window.__cf.engine.debug.gstrike = [i, 0]; });
        window.__lastU = u;
        // (on the story's own clock, as boot.js runs it: slowed in the slow-motion beats, timeline.js SLOWMO; on Watch's,
        // a blow's stop held its impact frame and its sparks for their length in Watch seconds, not as the film does)
        const rate = timeRate(u), step = window.__clkT == null ? 0 : t - window.__clkT;
        window.__clk = window.__clkT == null ? 1000 + t : window.__clk + (step > 0 ? step * rate : 1);
        window.__clkT = t;
        if (cap) await window.__cf.frame(u, window.__clk, dt);
        else window.__cf.engine.update(memoryAt(u), window.__clk, dt * rate);
        return u;
      }, [t, 1 / FPS, cap]);
      if (cap) await page.screenshot({ path: `${out}/u${u.toFixed(4)}-${tag}.jpg`, type: 'jpeg', quality: 82, timeout: 300000 });
    }
    console.log('strip', t0, t1, 'done');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
