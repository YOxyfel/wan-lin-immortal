// The bolt lab: the war's lightning alone (war.js BOLTS and the blows' bolts), as the lens of the film's shot at each
// story position sees it, over a plain sky, with numbers for what the eye objects to (a stroke crossing itself,
// doubling back, running ruler-straight). Fast: no world, no post. Add &dbg=1 to the page to list every stroke.
// Usage (under serve.cjs): node boltlab.cjs OUTPREFIX u1[:bg] u2[:bg] ...   (bg: a hex sky colour, no #)
const { launch, site, offline } = require('../browser.cjs');
(async () => {
  const [out, ...us] = process.argv.slice(2);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await offline(page);
  page.on('console', m => { const t = m.text(); if (t.startsWith('LAB')) console.log(t); });
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  for (const a of us) {
    const [u, bg] = a.split(':');
    await page.goto(site() + `/tools/verify/boltlab/lab.html?u=${u}` + (bg ? `&bg=%23${bg}` : ''), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
    await page.screenshot({ path: `${out}-u${u}.png` });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
