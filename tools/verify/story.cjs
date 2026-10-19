// Headless run through the story (software GL). Reports console errors, shader programs created after loading,
// and optional screenshots. The gate before a push: "programs created during the story: none" and no page errors
// (an ERR_FAILED console line is the offline fonts, harmless). Usage (under serve.cjs): node story.cjs URL [--shots=dir] [--us=0,10,20] [--w=960] [--h=600]
const { launch, offline } = require('./browser.cjs');
const fs = require('fs');
const url = process.argv[2];
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const shots = arg('shots', null);
const W = +arg('w', 960), H = +arg('h', 600);
const us = arg('us', '0,2,5,8,12,20,26,35,46,47.5,50,53,54.5,56,58,60,62.5,64,66,70,78,79.5,81,83,86,90,91.6,93,96,100,104,108.3,109,110.6,113,116,120,124.5,128,131,134,137,139.4,141.5,143').split(',').map(Number);
(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [], errors = [];
  await offline(page);
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${t}`); });
  page.on('pageerror', e => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#prologue') && document.querySelector('#prologue').dataset.ready === 'true', null, { timeout: 2400000 }).catch(() => errors.push("never ready"));
  const tReady = (Date.now() - t0) / 1000; console.log('ready', tReady.toFixed(1));
  if (!/noforest/.test(url)) await page.waitForFunction(() => document.querySelector('#prologue').dataset.forest === 'true', null, { timeout: 2400000 }).catch(() => errors.push("forest not ready"));
  const tForest = (Date.now() - t0) / 1000;
  const progs0 = await page.evaluate(() => window.__cf.engine.renderer.info.programs.length);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const created = [];
  for (const u of us) {
    const before = await page.evaluate(() => window.__cf.engine.renderer.info.programs.length);
    const t = Date.now();
    await page.evaluate(async u => { await window.__cf.frame(u, 1, 0.016); await window.__cf.frame(u + 0.02, 1.5, 0.016); }, u);
    const after = await page.evaluate(() => window.__cf.engine.renderer.info.programs.length);
    if (after !== before) created.push(`u${u}: +${after - before} programs`);
    if (shots) await page.screenshot({ path: `${shots}/u${String(u).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 70, timeout: 300000 });
    console.log(`u${u} ${((Date.now() - t) / 1000).toFixed(1)}s${after !== before ? ` +${after - before} programs` : ''}${errors.length ? ` errors so far: ${errors.length}` : ''}`);
  }
  console.log('\nready after', tReady.toFixed(1), 's; forest after', tForest.toFixed(1), 's; programs at ready:', progs0);
  console.log('programs created during the story:', created.length ? created.join(', ') : 'none');
  console.log('page errors:', errors.length ? errors : 'none');
  console.log('console warnings/errors:', logs.length ? logs.slice(0, 20) : 'none');
  await browser.close();
})();
