// One moment of the film (Watch seconds), stepped to on Watch's clock, saved once per debug variant: a JSON file of
// { name: "js run after the engine's update, given { u, S, rush, post, sky, camera, scene }" } ("" = as it is).
// Hiding things one at a time finds what draws an artifact. console.log('DBG ...') lines are printed.
// Usage (under serve.cjs): node dbgvar.cjs OUTPREFIX T VARIANTS.json [W H]
const fs = require('fs');
const { launch, site, offline } = require('./browser.cjs');
(async () => {
  const [out, T, vf, W = '960', H = '540'] = process.argv.slice(2);
  const variants = JSON.parse(fs.readFileSync(vf, 'utf8'));
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  await offline(page);
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  page.on('console', m => { const t = m.text(); if (t.startsWith('DBG')) console.log(t); });
  await page.goto(site() + '/index.html?q=high&warm=0&debug', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#prologue') && document.querySelector('#prologue').dataset.forest === 'true', null, { timeout: 2400000 });
  for (const [name, js] of Object.entries(variants)) {
    const FPS = 30, t0 = +T;
    for (let t = t0 - 1; t <= t0 + 1e-6; t += 1 / FPS) {
      const last = t > t0 - 0.5 / FPS;
      await page.evaluate(async ([t, dt, last, js]) => {
        const e = window.__cf.engine;
        e.debug.after = js ? new Function('o', `const { u, S, rush, post, sky, camera, scene } = o; ${js}`) : null;
        const { watchT } = await import('/assets/cinderfall/score.js');
        const { memoryAt } = await import('/assets/cinderfall/timeline.js');
        let a = 0, b = 146;
        for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (watchT(m) < t) a = m; else b = m; }
        const u = (a + b) / 2;
        if (last) await window.__cf.frame(u, 1000 + t, dt);
        else e.update(memoryAt(u), 1000 + t, dt);
      }, [t, 1 / FPS, last, js]);
    }
    await page.screenshot({ path: `${out}-${name}.jpg`, type: 'jpeg', quality: 90 });
    console.log('saved', name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
