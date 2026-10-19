// Every frame of Watch between two story positions, as the film plays it (Watch's own clock, fps frames a second):
// the lens, where he is and which way his face looks, where his uncle's face looks, where the dog is, how white the
// page is. cutrules.py reads it and fails the film on bad cuts and bad motion.
// Usage (under serve.cjs): node cutscan.cjs U0 U1 OUT.json [fps] [url]
const { launch, site, offline } = require('./browser.cjs');
const fs = require('fs');
(async () => {
  const [u0, u1, out, fps = '30', url = site() + '/index.html?debug&warm=0&q=low'] = process.argv.slice(2);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  await offline(page);
  page.on('pageerror', e => console.log('[pageerror]', String(e)));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__cf && window.__cf.engine && document.querySelector('#prologue').dataset.ready === 'true', null, { timeout: 900000 });
  const frames = await page.evaluate(async ([u0, u1, fps]) => {
    const { watchT } = await import('/assets/cinderfall/score.js');
    const { memoryAt } = await import('/assets/cinderfall/timeline.js');
    const e = window.__cf.engine, d = e.debug, cam = e.camera, V = cam.position.constructor, I = e.post.ink;
    const inv = t => { let a = 0, b = 146; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (watchT(m) < t) a = m; else b = m; } return (a + b) / 2; };
    const t0 = watchT(u0), t1 = watchT(u1), dt = 1 / fps, rows = [];
    const r3 = a => a.map(v => +v.toFixed(3));
    const ndc = p => { const q = p.clone().project(cam); return [+q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3)]; };
    // (which way a figure's face looks: the head bone's forward, from its rig)
    const face = f => {
      if (!f || !f.rig || !f.group.visible) return null;
      const r = f.rig, i = r.idx.head, bp = r.bindPos[i];
      const a = r.pointOn(i, bp.clone(), new V()), b = r.pointOn(i, bp.clone().add(new V(0, 0, 0.3)), new V());
      f.group.updateMatrixWorld(true);
      f.group.localToWorld(a); f.group.localToWorld(b);
      return { p: a, f: b.sub(a).normalize() };
    };
    const dog = e.world.huang;
    for (let k = 8; k > 0; k--) e.update(memoryAt(inv(t0 - k * dt)), 1000 + t0 - k * dt, dt);
    for (let t = t0; t <= t1 + 1e-6; t += dt) {
      const u = inv(t), ur = memoryAt(u);
      e.update(ur, 1000 + t, dt);
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const dir = cam.getWorldDirection(new V());
      const h = d.hero, P = e.metrics.P ? e.metrics.P.clone() : null;
      const vis = !!(h && h.group.visible);
      const head = vis ? h.anchors.head() : null;
      const fh = vis ? face(h) : null;
      // (the nearest of him to the lens: head, chest, hips, feet)
      let near = null;
      if (vis) { const pts = [head, h.anchors.back(), h.anchors.hipL(), h.anchors.hipR(), P]; near = Math.min(...pts.map(p => p.distanceTo(cam.position))); }
      const el = d.elder, ev = !!(el && el.group.visible);
      const fe = ev ? face(el) : null;
      const dv = !!(dog && dog.root.visible);
      rows.push({ t: +t.toFixed(3), u: +u.toFixed(4), ur: +ur.toFixed(4), cam: r3(cam.position.toArray()), dir: r3(dir.toArray()), fov: +cam.fov.toFixed(2),
        P: P ? r3(P.toArray()) : null, vis, head: head ? ndc(head) : null, feet: P ? ndc(P) : null, yaw: h ? +h.group.rotation.y.toFixed(4) : null,
        hf: fh ? r3(fh.f.toArray()) : null, hp: fh ? r3(fh.p.toArray()) : null, near: near != null ? +near.toFixed(3) : null,
        ev, ef: fe ? r3(fe.f.toArray()) : null, ep: fe ? r3(fe.p.toArray()) : null, ehead: fe ? ndc(fe.p) : null,
        dv, dp: dv ? r3(dog.root.position.toArray()) : null, dndc: dv ? ndc(dog.root.position.clone().add(new V(0, 0.35, 0))) : null,
        white: +I.uWhite.value.toFixed(3), flash: +I.uFlash.value.toFixed(3) });
    }
    return rows;
  }, [+u0, +u1, +fps]);
  fs.writeFileSync(out, JSON.stringify(frames));
  console.log('frames', frames.length);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
