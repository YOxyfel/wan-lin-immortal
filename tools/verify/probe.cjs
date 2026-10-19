// Several moments of the film, each rendered once per debug variant, from one page load (dbgvar.cjs does one moment).
// Usage (under serve.cjs): node probe.cjs OUTPREFIX PLAN.json [W H]
// PLAN: [{ "T": watchSeconds, "name": "slab", "pre": 1, "variants": { "base": "", "noSmoke": "js" }, "report": "js returning a string" }]
// Each variant's js runs after the engine's update on every frame of the run-up and the rendered frame, given
// { u, S, rush, post, sky, camera, scene }; report runs once on the rendered frame (its string is printed); three
// itself is window.__THREE there (rays: new window.__THREE.Raycaster()).
// The run home's ground strikes are struck as the story crosses them (debug mode turns the scripted ones off).
// (A figure's gait is counted from the ground it covers, so each variant's run-up can leave him in another pose.)
const fs = require('fs');
const { launch, site, offline } = require('./browser.cjs');
(async () => {
  const [out, pf, W = '960', H = '540'] = process.argv.slice(2);
  const plan = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  await offline(page);
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  page.on('console', m => { const t = m.text(); if (t.startsWith('DBG')) console.log(t); });
  await page.goto(site() + '/index.html?q=high&warm=0&debug', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#prologue') && document.querySelector('#prologue').dataset.forest === 'true', null, { timeout: 2400000 });
  console.log('loaded');
  // (three itself, for the reports: rays and vectors)
  await page.evaluate(async () => { window.__THREE = await import('three'); });
  for (const m of plan) {
    for (const [name, js] of Object.entries(m.variants)) {
      const FPS = 30, t0 = +m.T, pre = m.pre ?? 1;
      await page.evaluate(() => { window.__lastU = null; });
      for (let t = t0 - pre; t <= t0 + 1e-6; t += 1 / FPS) {
        const last = t > t0 - 0.5 / FPS;
        const rep = await page.evaluate(async ([t, dt, last, js, report]) => {
          const e = window.__cf.engine;
          let said = null;
          const vf = js ? new Function('o', `const { u, S, rush, post, sky, camera, scene } = o; ${js}`) : null;
          const rf = last && report ? new Function('o', `const { u, S, rush, post, sky, camera, scene } = o; ${report}`) : null;
          e.debug.after = (vf || rf) ? (o => { if (vf) vf(o); if (rf) { try { said = String(rf(o)); } catch (err) { said = 'report error ' + err; } } }) : null;
          const { watchT } = await import('/assets/cinderfall/score.js');
          const { memoryAt, STRIKES } = await import('/assets/cinderfall/timeline.js');
          let a = 0, b = 146;
          for (let i = 0; i < 50; i++) { const mm = (a + b) / 2; if (watchT(mm) < t) a = mm; else b = mm; }
          const u = (a + b) / 2;
          const G = STRIKES.filter(x => x[3] === 2), lu = window.__lastU ?? u;
          G.forEach((x, i) => { if (lu < x[0] && u >= x[0]) e.debug.gstrike = [i, 0]; });
          window.__lastU = u;
          if (last) await window.__cf.frame(u, 1000 + t, dt);
          else e.update(memoryAt(u), 1000 + t, dt);
          e.debug.after = null;
          return last ? { u, said } : null;
        }, [t, 1 / FPS, last, js, m.report || '']);
        if (rep) {
          if (rep.said) console.log(`REPORT ${m.name}/${name} u${rep.u.toFixed(4)}: ${rep.said}`);
          await page.screenshot({ path: `${out}-${m.name}-${name}.jpg`, type: 'jpeg', quality: 90, timeout: 300000 });
          console.log('saved', m.name, name, 'u' + rep.u.toFixed(4));
        }
      }
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
