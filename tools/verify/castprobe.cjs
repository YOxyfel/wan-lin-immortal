// Everyone in the village against the lens, stepped at 30 frames a second on Watch's clock from T0 to T1 (Watch
// seconds): who comes within NEAR m of it while in the frame, and anyone in the frame who appears or vanishes.
// Usage: node castprobe.cjs T0 T1 [NEAR]   (under serve.cjs)
const { launch, site, offline } = require('./browser.cjs');
(async () => {
  const [T0, T1, NEAR = '3'] = process.argv.slice(2);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await offline(page);
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  await page.goto(site() + '/index.html?debug&warm=0&q=low', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__cf && window.__cf.engine && document.querySelector('#prologue').dataset.ready === 'true', null, { timeout: 1500000 });
  const FPS = 30;
  let prev = null, prevCam = null;
  for (let t = +T0 - 0.5; t <= +T1 + 1e-6; t += 1 / FPS) {
    const r = await page.evaluate(async ([t, dt]) => {
      const e = window.__cf.engine;
      const { watchT } = await import('/assets/cinderfall/score.js');
      const { memoryAt } = await import('/assets/cinderfall/timeline.js');
      let a = 0, b = 146;
      for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (watchT(m) < t) a = m; else b = m; }
      const u = (a + b) / 2;
      e.update(memoryAt(u), 1000 + t, dt);
      const W = e.world, C = W.cast, cam = e.debug.where().cam;
      const camera = e.camera; camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      const out = {};
      for (const c of C.all || []) {
        const p = c.root.position, d = Math.hypot(p.x - cam[0], p.y + 0.9 - cam[1], p.z - cam[2]);
        let inF = false;
        if (camera) {
          const v = { x: p.x, y: p.y + 0.9, z: p.z };
          const m = camera.matrixWorldInverse.elements, P = camera.projectionMatrix.elements;
          const vx = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12], vy = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13], vz = m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14];
          if (vz < -0.2) { const cx = (P[0] * vx + P[8] * vz) / -vz, cy = (P[5] * vy + P[9] * vz) / -vz; inF = Math.abs(cx) < 1.15 && Math.abs(cy) < 1.15; }
        }
        out[`${c.role}${c.index ?? ''}`] = [c.root.visible ? 1 : 0, inF ? 1 : 0, +d.toFixed(2), +p.x.toFixed(1), +p.z.toFixed(1)];
      }
      return { u: +u.toFixed(4), cam, out };
    }, [t, 1 / FPS]);
    if (t >= +T0 - 1e-6 && prev) {
      // (a cut: the lens jumped)
      const jump = prevCam && Math.hypot(r.cam[0] - prevCam[0], r.cam[1] - prevCam[1], r.cam[2] - prevCam[2]) > 1.5;
      const notes = [];
      for (const [k, v] of Object.entries(r.out)) {
        const q = prev[k];
        if (v[0] && v[1] && v[2] < +NEAR) notes.push(`${k} NEAR d${v[2]}`);
        if (q && !jump && q[1] && v[1] && q[0] !== v[0]) notes.push(`${k} ${v[0] ? 'APPEARS' : 'VANISHES'} d${v[2]} at ${v[3]},${v[4]}`);
      }
      if (notes.length || jump) console.log(t.toFixed(3), r.u, jump ? 'CUT' : '', notes.join(' | '));
    }
    prev = r.out; prevCam = r.cam;
  }
  console.log('done');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
