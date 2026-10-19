// The lens against the world: steps the film on Watch's clock between two Watch times (30 a second, nothing drawn)
// and, ten times a second, casts a grid of rays from the lens through its frame; prints every moment where the world
// comes within NEAR metres of the lens over more than a share of the frame (a wall, a beam, a parapet the lens is
// passing through or brushing), with what it is and how near.
// Usage (under serve.cjs): node lensprobe.cjs T0 T1 [NEAR=2.5] [SHARE=0.12]
// (in the ink a surface a metre or two from the lens is a flat black or grey card with a ruler-straight edge)
const { launch, site, offline } = require('./browser.cjs');
(async () => {
  const [T0, T1, NEAR = '2.5', SHARE = '0.12'] = process.argv.slice(2);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await offline(page);
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  await page.goto(site() + '/index.html?q=low&warm=0&debug', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#prologue') && document.querySelector('#prologue').dataset.forest === 'true', null, { timeout: 2400000 });
  await page.evaluate(async () => { window.__THREE = await import('three'); });
  const FPS = 30;
  let n = 0, flagged = 0;
  for (let t = +T0; t <= +T1 + 1e-6; t += 1 / FPS) {
    const probe = n++ % 3 === 0;
    const r = await page.evaluate(async ([t, dt, probe, near]) => {
      const e = window.__cf.engine;
      const { watchT } = await import('/assets/cinderfall/score.js');
      const { memoryAt } = await import('/assets/cinderfall/timeline.js');
      let a = 0, b = 146;
      for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (watchT(m) < t) a = m; else b = m; }
      const u = (a + b) / 2;
      e.update(memoryAt(u), 1000 + t, dt);
      if (!probe) return null;
      const T = window.__THREE, cam = e.camera || window.__cf.engine.camera, scene = e.scene;
      cam.updateMatrixWorld();
      const rc = new T.Raycaster(); rc.near = 0.02; rc.far = near; rc.params.Points.threshold = 0; rc.params.Line.threshold = 0;
      const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      const name = o => { const s = []; for (let p = o; p && p !== scene; p = p.parent) s.push(p.name || p.type); return s.slice(0, 3).join('<'); };
      let hit = 0, all = 0; const what = new Map();
      for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) {
        const x = -0.94 + 1.88 * i / 7, y = -0.9 + 1.8 * j / 4;
        rc.setFromCamera(new T.Vector2(x, y), cam);
        all++;
        // (the world only: not the ground, the water, the sky, nor anyone in it: people are castprobe's)
        const h = rc.intersectObjects(scene.children, true).find(h => vis(h.object) && !h.object.isSkinnedMesh && !/terrain|water|sky|rain|cloud/i.test(name(h.object)) && h.object.material && !h.object.material.transparent && !/hero|people|cast|wolf|dog/i.test(name(h.object) + ' ' + (h.object.material.name || '')));
        if (h) { hit++; const k = name(h.object); const w = what.get(k); if (!w || h.distance < w) what.set(k, h.distance); }
      }
      return { u, share: hit / all, what: [...what].map(([k, d]) => k + ' ' + d.toFixed(2)) };
    }, [t, 1 / FPS, probe, +NEAR]);
    if (r && r.share > +SHARE) { flagged++; console.log(`t ${t.toFixed(2)} u ${r.u.toFixed(3)}: ${(r.share * 100).toFixed(0)}% of the frame within ${NEAR} m: ${r.what.join(' | ')}`); }
  }
  console.log(`done: ${flagged} moments flagged`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
