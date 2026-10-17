// Cinderfall prologue: scroll → scroll position su → story position u (held moments stretch it) → world, ink overlay,
// captions, title and the last page.
import { TOTAL, TOTAL_U, uToS, sToU, inkCut, inkfx, fx, INK_CUTS, timeRate } from './timeline.js';
import { createInkOverlay, writeGlyph } from './ink.js';
import { GLYPHS } from './glyphs.js';
import { createAudio } from './audio.js';
import { createRitual } from './ritual.js';
import { clamp, lerp, smooth, band, easeInOut } from './util.js';

const $ = s => document.querySelector(s);
const root = $('#prologue'), stage = root.querySelector('.stage');
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('motion') === 'off';
const UNIT_VH = 30;  // scroll length of one story unit
root.style.height = `${TOTAL_U * UNIT_VH + 100}svh`;

const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

// ---------------------------------------------------------------- one line at a time
const CAPTIONS = [
  { a: 7.2, b: 11.4, pos: 'left', eyebrow: 'CINDERFALL HAMLET · THE LAST ORDINARY MORNING', text: 'Nothing ever<br>happened here.' },
  { a: 15.4, b: 19.0, pos: 'right', eyebrow: 'HIS UNCLE, FROM THE PORCH', text: '“Mushrooms by the old pines.<br><em>Home before dark.</em>”', small: true },
  { a: 21.4, b: 25.3, pos: 'left', eyebrow: 'JIANG WUHEN · FIFTEEN', text: 'Every face,<br>a name he knew.' },
  { a: 25.75, b: 27.95, pos: 'right', eyebrow: 'THE SMITH’S STALL', text: 'Iron, to anyone else.<br><em>Only he saw them burn.</em>', small: true },
  { a: 31.2, b: 35.4, pos: 'right', eyebrow: 'AT THE GATE', text: 'The garrison marched out at dawn.<br><em>No one asked why.</em>', small: true },
  { a: 37.4, b: 41.4, pos: 'left', eyebrow: 'THE OLD ROAD', text: 'Same road. Same pines.<br>Same quiet.' },
  { a: 43.2, b: 45.75, pos: 'right', eyebrow: 'THE EDGE OF THE PINES', text: 'Right where<br>they always were.', small: true },
  { a: 46.1, b: 47.38, pos: 'right', text: 'Then the forest<br>held its breath.', big: true },
  { a: 49.8, b: 52.4, pos: 'right', eyebrow: 'ABOVE THE CLOUDS', text: 'Something was at war.' },
  { a: 52.95, b: 54.3, pos: 'right', text: 'The sky gathered<br>its thunder.' },
  { a: 54.5, b: 55.35, pos: 'right', eyebrow: 'A STONE\'S THROW FROM CINDERFALL', text: 'Something fell.' },
  { a: 55.45, b: 56.85, pos: 'right', eyebrow: 'WEST, OVER THE RIDGES', text: 'Out of the fire,<br>a light fled west.' },
  { a: 56.95, b: 58.3, pos: 'right', text: 'Day turned to night<br>in a single breath.', small: true },
  { a: 58.4, b: 61.3, pos: 'center', text: 'Then, below —' },
  { a: 61.95, b: 64.25, pos: 'center', eyebrow: 'THE MOMENT EVERYTHING CHANGED', text: 'Cinderfall<br>was burning.', big: true, red: true },
  { a: 64.45, b: 66.45, pos: 'left', text: 'Uncle.', big: true },
  { a: 72.2, b: 75.6, pos: 'right', eyebrow: 'THE GATE STOOD UNGUARDED', text: 'Home. Get home.' },
  { a: 78.8, b: 81.8, pos: 'left', text: 'The door was<br>already open.' },
  { a: 85.0, b: 86.9, pos: 'words', eyebrow: 'HIS UNCLE’S LAST WORDS', text: '“Don’t avenge me.”' },
  { a: 87.1, b: 89.0, pos: 'words', eyebrow: 'HIS UNCLE’S LAST WORDS', text: '“Forget this place.<br>Forget me.”' },
  { a: 89.2, b: 91.6, pos: 'words', eyebrow: 'HIS UNCLE’S LAST WORDS', text: '“Live a good life.<br><em>A long one.</em>”' },
  { a: 95.2, b: 98.2, pos: 'left', eyebrow: 'AN UNANSWERED QUESTION', text: 'Avenge…?<br>Those were monsters.' },
  { a: 99.3, b: 102.6, pos: 'right', eyebrow: 'ON THE CRAG ABOVE CINDERFALL', text: 'Unless someone<br><em>sent them.</em>' },
  { a: 103.8, b: 105.5, pos: 'right', eyebrow: 'THAT NIGHT', text: 'He followed the light west,<br>until the fires were only a glow behind him.', small: true },
  { a: 108.95, b: 110.75, pos: 'center', eyebrow: 'BEYOND THE RIDGES, WHERE NO ONE WENT', text: 'The Forbidden Forest.', big: true },
  { a: 112.6, b: 114.4, pos: 'left', eyebrow: 'THE FIRST WINTER', text: 'It nearly killed him.' },
  { a: 114.75, b: 116.3, pos: 'right', eyebrow: 'THE YEARS', text: 'Every winter,<br>one cut in the bark.' },
  { a: 116.45, b: 117.95, pos: 'right', text: 'He learned the forest the way<br>his uncle had known herbs.', small: true },
  { a: 118.05, b: 119.55, pos: 'right', text: 'Snares. A bow.<br>Patience.' },
  { a: 123.0, b: 124.55, pos: 'center', text: 'Six years.', big: true },
  { a: 124.85, b: 126.65, pos: 'left', eyebrow: 'THE SIXTH AUTUMN', text: 'No game near the camp that day.<br><em>Not one track.</em>', small: true },
  { a: 126.85, b: 128.75, pos: 'right', text: 'So he went farther<br>than he ever had.' },
  { a: 129.3, b: 131.6, pos: 'left', eyebrow: 'THE OLD WOOD', text: 'The forest grew older.<br><em>The air began to glow.</em>', small: true },
  { a: 133.6, b: 135.9, pos: 'right', eyebrow: 'UNDER THE OLDEST TREE', text: 'What fell from the sky that night<br><em>had waited for him.</em>', small: true },
  { a: 139.58, b: 140.85, pos: 'left', text: 'Some paths<br>find you.', big: true },
  { a: 142.6, b: 146.0, pos: 'end', eyebrow: 'THE FIRST PAGE OF SOMETHING MORE', text: 'His story has only begun.' },
];
const CHAPTERS = [[0, '01 / AN ORDINARY MORNING'], [46.5, '02 / THE SKY TURNS'], [61.6, '03 / CINDERFALL BURNS'], [84.4, '04 / A FINAL WARNING'], [108.3, '05 / THE YEARS BETWEEN'], [124, '06 / WHAT FELL THAT NIGHT']];
// autoplay pace (units per second) by story position: slower where the story breathes
const PACE = [[0, 0.55], [4, 0.75], [10, 0.9], [15, 0.6], [19, 0.85], [31, 0.7], [36, 1.1], [42, 0.6], [46.5, 0.42], [49.4, 0.34], [56, 0.32], [61.5, 0.32], [66, 0.9], [77, 0.55], [80.6, 0.42], [84.6, 0.3], [92.4, 0.42], [98, 0.38], [103.5, 0.44], [107.6, 0.42], [112, 0.45], [124, 0.45], [127.4, 0.34], [129.4, 0.55], [131, 0.42], [133.4, 0.36], [136, 0.3], [141, 0.38], [145, 0.4]];
const paceAt = u => { let p = PACE[0][1]; for (const [a, v] of PACE) if (u >= a) p = v; return p; };
// where the screen is paper-light, so the HUD and captions switch to ink
// (the night after the soul gives the world back its colour, until the light floods it white, is dark)
const lightAt = u => u < 5.4 || (u > 62.6 && u < 94.6) || (u > 107.62 && u < 124.4) || u > 141.0;

// The brush's pace along one stroke of the sign: about 820 units of it a second along a straight, slowing into each
// turn (where the line bends by more than 60°) and pressing there a moment; a dot takes a moment however short.
// Returns the stroke's time in seconds and, for 0..1 of that time, how far along it the brush is (0..1 of its length).
function brushPace(pts, { speed = 820, press = 0.14, least = 0.36 } = {}) {
  const runs = [];
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1];
    if (i > 1) {
      const bx = pts[i - 1][0] - pts[i - 2][0], by = pts[i - 1][1] - pts[i - 2][1];
      if ((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)) < 0.5) { runs.push(run); run = 0; }
    }
    run += Math.hypot(ax, ay);
  }
  runs.push(run);
  const L = runs.reduce((a, b) => a + b, 0), parts = [];
  let at = 0;
  runs.forEach((r, j) => {
    if (j) parts.push({ s: press, a: at, b: at });
    parts.push({ s: Math.max(least / runs.length, r / speed), a: at, b: at + r / L });
    at += r / L;
  });
  const dur = parts.reduce((a, q) => a + q.s, 0);
  // (along a straight the brush sets off slowly, is quickest midway and slows again: speed 1 − 0.6 cos 2πx)
  const along = x => x - Math.sin(2 * Math.PI * x) * 0.6 / (2 * Math.PI);
  return { dur, at(p) { let t = clamp(p) * dur; for (const q of parts) { if (t <= q.s) return q.a + (q.b - q.a) * along(t / q.s); t -= q.s; } return 1; } };
}

async function boot() {
  root.dataset.ready = 'loading';
  // ---------------------------------------------------------------- DOM scaffolding
  const capWrap = el('div', 'cf-captions');
  stage.appendChild(capWrap);
  const caps = CAPTIONS.map(c => {
    const n = el('div', `cf-cap ${c.pos}${c.big ? ' big' : ''}${c.small ? ' small' : ''}${c.red ? ' red' : ''}`,
      `${c.eyebrow ? `<span class="eyebrow">${c.eyebrow}</span>` : ''}<p>${c.text}</p>`);
    capWrap.appendChild(n);
    return { ...c, n };
  });
  const hud = $('.hud'), chapter = $('#chapter'), meter = $('.meter');
  const title = $('.cf-title');
  const sealSvg = title.querySelector('svg.cf-seal');
  const XUAN = [
    [[390, 45], [430, 95], [455, 140]],
    [[30, 278], [500, 276], [930, 270]],
    [[440, 300], [300, 420], [140, 545], [350, 548], [545, 548]],
    [[690, 410], [520, 560], [300, 720], [110, 860], [400, 850], [770, 830]],
    [[660, 690], [780, 800], [870, 930]],
  ];
  const seal = writeGlyph(sealSvg, GLYPHS['玄'], XUAN, { color: '#efe6d2' });
  // the last page: the same sign, written again (its maps made later, while the screen is still)
  const end = el('div', 'cf-end', `<svg class="cf-seal" aria-hidden="true"></svg><span class="cf-stamp" aria-hidden="true"><i>江</i><i>無</i><i>痕</i></span><a class="cf-next" href="#demo">THE DEMO <span aria-hidden="true">↓</span></a>`);
  end.setAttribute('aria-hidden', 'true');
  stage.appendChild(end);
  const endSeal = writeGlyph(end.querySelector('svg'), GLYPHS['玄'], XUAN, { color: '#e2c27a', defer: true });
  const inkCanvas = $('#ink');
  let ink = null;
  try { ink = createInkOverlay(inkCanvas, new URL('Images/Cinderfall/noise.webp', document.baseURI).href); } catch (e) { console.warn('ink overlay unavailable', e); }
  const audio = createAudio();

  // ---------------------------------------------------------------- the opening, written while the story is prepared
  // (ritual.js: each beat waits for its share of the preparation, and the preparation waits while a beat plays)
  const pace = XUAN.map(pts => brushPace(pts));
  const DROP = 3.1;
  // how far the preparation has to be for each beat (0..1). The drop falls once the valley is built (0.1), while its
  // programs compile; the rest of the work (on a Windows desktop: the forest about a third of it, the rehearsal the
  // rest) is shared out evenly between the strokes and the title.
  const BEATS = [
    { id: 'drop', dur: DROP, at: 0.1 },
    ...pace.map((p, k) => ({ id: `s${k}`, dur: p.dur, at: [0.15, 0.25, 0.36, 0.47, 0.58][k] })),
    { id: 'title', dur: 1.7, at: 0.69 },
    { id: 'stamp', dur: 0.75, at: 0.8 },
    { id: 'sub', dur: 1.0, at: 0.9 },
    { id: 'hint', dur: 1.3, at: 1 },
  ];
  const ritual = createRitual(BEATS);
  let replaying = false;

  // ---------------------------------------------------------------- engine (three.js is code-split)
  let engine = null, ready = false, storyU = 0;
  const loading = $('#loading');
  // the ink overlay's own passes, drawn once: the flood, a drop and its splash, the splat, the crossing's stroke and painting
  function warmInk() {
    const base = { blots: [{ x: 0.5, y: 0.58, r: 0.1, a: 1 }], flood: 0, floodC: [0.5, 0.5], floodLift: 0, drop: [0.5, 0.58, 0, 0], splat: 0, splatSeed: 3, stroke: null, land: null };
    try {
      ink.render(1, { ...base, flood: 0.6, floodLift: 0.2 });
      ink.render(2, { ...base, drop: [0.5, 0.9, 0.022, 0] });
      ink.render(3, { ...base, drop: [0.5, 0.58, 0.03, 0.5] });
      ink.render(4, { ...base, splat: 0.7 });
      ink.render(5, { ...base, stroke: { progress: 0.5, width: 0.02, alpha: 1, tail: 0.3, pts: [[0.4, 0.58], [0.55, 0.9], [0.86, 0.86], [0.62, 0.5]] }, land: { reveal: 0.6, alpha: 1, clear: 0, zoom: 1.2, center: [0.62, 0.5], sun: [0.4, 0.58] } });
      ink.render(6, { ...base, blots: [] });
    } catch (e) { console.warn('ink rehearsal', e); }
  }
  // Getting ready: the opening is the loading screen. While the page loads, an ink dot breathes where the first drop
  // will land (animated by the compositor, so it keeps going while the valley is built). Then the drop falls and the ink
  // blooms while the valley's shader programs compile in the browser's own threads; then the sign is written stroke by
  // stroke and the title after it, each beat as soon as its share of the rest is done: the forest beyond the ridges
  // built, and every look the story takes rehearsed (drawn once, unseen), so the driver's own compiling and every
  // upload happen here and not on the way. Measured on a desktop GPU, doing these on the way froze the page for
  // 0.1–0.6 s at a time at nearly every key moment of a first read; done here, each freeze falls while the screen is
  // still, between beats. Until it is done the line under the title says so, over a line of progress; a reader who
  // scrolls meanwhile is taken straight to where they are once it is. `?noforest` skips the forest and `?warm=0` the
  // rehearsal (for debugging); `?prepstats` times each step (window.__cf.prep).
  const hint = title.querySelector('.cf-hint'), hintHTML = hint ? hint.innerHTML : '', WAIT_HTML = 'PREPARING THE STORY';
  let hintWait = null;
  // (--q: the line under the title; no transition, it moves in steps, between the still moments)
  const reach = v => { ritual.reach(v); root.style.setProperty('--q', ritual.progress.toFixed(3)); };
  // (a frame for the page between pieces of work; in a background tab, where no frames come, a moment instead)
  const nextFrame = () => new Promise(res => { let done = false; const go = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(go); setTimeout(go, 60); });
  const stats = params.has('prepstats') ? [] : null;
  // (?trace: every frame's interval and the browser's long frames, for measuring how smooth the opening plays)
  const trace = params.has('trace') ? { frames: [], long: [] } : null;
  if (trace) try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (trace.long.length < 4000) trace.long.push([Math.round(e.startTime), Math.round(e.duration), Math.round(e.blockingDuration || 0)]); }).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  const marks = [];
  const mark = name => marks.push([name, Math.round(performance.now())]);
  reach(0);
  // the ink's own shader, drawn once while nothing moves yet (its first draw is its compile)
  if (ink) warmInk();
  mark('boot');
  (async () => {
    const m = await import('./engine.js');
    mark('modules');
    reach(0.03);
    const e = await m.createEngine($('#world'));
    window.__cf.engine = e;
    mark('engine');
    // the sign's maps, and the filter that writes it, ready before anything moves
    await seal.prepare();
    seal.set(1e-4); await nextFrame(); await nextFrame(); seal.set(0);
    mark('seal');
    reach(0.1);
    // the first drop falls while the valley's programs compile in the browser's threads
    await ritual.play();
    mark('dropped');
    await e.compiled();
    mark('compiled');
    // (the last page's sign: its maps made now, while the screen is still)
    await endSeal.prepare();
    reach(0.15);
    await ritual.play();
    let built = false;
    if (!/[?&]noforest\b/.test(location.search)) {
      let stages = 0;
      await e.prepareForest({
        gate: async () => { stages++; reach(lerp(0.15, 0.42, Math.min(1, stages / 11))); await ritual.play(); },
        idle: async () => { mark('forest built'); reach(0.43); await ritual.play(); },
      });
      built = !!e.forest;
    }
    mark('forest');
    reach(0.45);
    await ritual.play();
    if (!/[?&]warm=0\b/.test(location.search)) await e.warmUp({ onProgress: k => reach(lerp(0.45, 0.99, k)), pause: ritual, stats });
    mark('rehearsed');
    engine = e;
    ready = true;
    su = target = autoU = uFromScroll(); suV = 0;
    root.dataset.ready = 'true';
    if (built) root.dataset.forest = 'true';
    addEventListener('resize', () => engine.resize());
    // the rest of the title, then the hint
    reach(1);
    await ritual.play();
    mark('done');
  })().catch(err => {
    console.error('Cinderfall failed to start', err);
    document.body.classList.add('failed', 'reduced-motion');
    root.dataset.ready = 'fallback';
  });

  // ---------------------------------------------------------------- scroll → u
  const scrollable = () => Math.max(1, root.offsetHeight - innerHeight);
  // su: position along the scroll (0..TOTAL_U); the story position u = uToS(su)
  const uFromScroll = () => clamp(-root.getBoundingClientRect().top / scrollable()) * TOTAL_U;
  const scrollToU = (su, behavior = 'auto') => scrollTo({ top: root.offsetTop + (su / TOTAL_U) * scrollable(), behavior });
  let su = uFromScroll(), suV = 0, target = su, last = performance.now();
  // the story's own clock (seconds): it runs slow in the slow-motion beats (timeline.js SLOWMO)
  let clock = 0;
  let autoplay = false, autoU = 0, forced = null, rendered = false;
  const watchBtn = $('#watch');
  const setAuto = on => { autoplay = on; autoU = target; watchBtn.textContent = on ? 'Pause' : 'Watch'; watchBtn.setAttribute('aria-pressed', String(on)); };
  watchBtn.addEventListener('click', () => setAuto(!autoplay));
  for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, e => { if (autoplay && (ev !== 'keydown' || ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key))) setAuto(false); }, { passive: true });
  $('#sound').addEventListener('click', async () => { const on = await audio.toggle(); $('#sound').textContent = on ? 'Sound on' : 'Sound off'; $('#sound').setAttribute('aria-pressed', String(on)); });
  // (the opening again, a little quicker; not while the story is still being prepared, when it is playing anyway)
  $('#replay').addEventListener('click', () => {
    setAuto(false); scrollToU(0); su = target = 0; suV = 0;
    if (ready && ritual.finished && !replaying) { replaying = true; ritual.replay(1.5).then(() => { replaying = false; }); }
  });
  for (const a of document.querySelectorAll('a[href="#demo"]')) a.addEventListener('click', () => setAuto(false));
  // codex dialog
  const codex = $('.codex');
  let modalY = 0, codexNav = false;
  $('#codex-open').addEventListener('click', () => { modalY = scrollY; codex.showModal(); document.body.style.overflow = 'hidden'; setAuto(false); });
  $('#codex-close').addEventListener('click', () => codex.close());
  codex.addEventListener('close', () => { document.body.style.overflow = ''; if (!codexNav) scrollTo(0, modalY); codexNav = false; });
  $('[data-close-link]')?.addEventListener('click', () => { codexNav = true; codex.close(); });

  // (debug/test hooks take story positions)
  window.__cf = {
    get u() { return uToS(su); },
    setU(v) { forced = v; su = target = sToU(v); suV = 0; scrollToU(su); },
    engine: null,
    // how the preparation went: when each step ended, each beat's start and end, and (with ?prepstats) each rehearsed
    // position's own cost
    get prep() { return { marks, stats, trace, beats: ritual.log }; },
    async frame(v, t = 1, dtF) { forced = v; su = target = sToU(v); suV = 0; frame(performance.now(), t, dtF); },
    // (the tempo map, for tools: scroll position ↔ story position)
    tempo: { uToS, sToU },
  };

  const op = (n, v) => { n.style.opacity = v.toFixed(3); n.style.visibility = v > 0.002 ? 'visible' : 'hidden'; };
  // where a sign sits on the screen, for the ink drawn under it: its centre (the overlay's uv, y up) and the bloom's
  // radius (in the overlay's units, the screen's shorter side 1), 0.64 of the sign's height; read again on a resize
  const endSvg = end.querySelector('svg');
  const sealBox = new Map();
  let boxW = 0, boxH = 0;
  function sealAt(svgEl) {
    if (boxW !== innerWidth || boxH !== innerHeight) { boxW = innerWidth; boxH = innerHeight; sealBox.clear(); }
    let b = sealBox.get(svgEl);
    if (!b) {
      const r = svgEl.getBoundingClientRect();
      b = r.height > 0 ? { x: (r.left + r.width / 2) / innerWidth, y: 1 - (r.top + r.height / 2) / innerHeight, r: 0.64 * r.height / Math.min(innerWidth, innerHeight) } : { x: 0.5, y: 0.58, r: 0.21 };
      sealBox.set(svgEl, b);
    }
    return b;
  }
  // (a custom property set only when it changes: between the opening's beats nothing on the page is touched)
  const vars = new WeakMap();
  const setVar = (n, name, v) => {
    const s = (+v).toFixed(4);
    let m = vars.get(n);
    if (!m) vars.set(n, m = {});
    if (m[name] !== s) { m[name] = s; n.style.setProperty(name, s); }
  };

  function frame(now, forceTime, forceDt) {
    const dt = forceDt ?? Math.min(0.08, (now - last) / 1000);
    last = now;
    const rect = root.getBoundingClientRect();
    const inView = rect.bottom > 0;
    if (forced == null) {
      if (autoplay && ready) {
        autoU = Math.min(TOTAL_U, autoU + paceAt(uToS(autoU)) * dt);
        scrollToU(autoU);
        target = autoU;
        if (autoU >= TOTAL_U) setAuto(false);
      } else target = uFromScroll();
      // the story follows the scroll on a critically damped spring: no jolt when the wheel turns or stops, the
      // camera's speed through the story always continuous (the exact step, so any frame time is stable)
      const w = Math.abs(target - su) > 8 ? 10 : 6.5;
      const x0 = su - target, B = suV + w * x0, e = Math.exp(-w * dt);
      su = target + (x0 + B * dt) * e;
      suV = (suV - w * B * dt) * e;
      if (Math.abs(su - target) < 0.0005 && Math.abs(suV) < 0.002) { su = target; suV = 0; }
    }
    // the story position (held moments run slow); forced test frames are given in story time
    // (while the loading screen is up the page shows the opening; scrolling meanwhile takes the reader straight there)
    const u = forced != null ? forced : ready ? uToS(su) : 0;
    root.dataset.u = u.toFixed(3);
    storyU = u;
    const rate = timeRate(u);
    clock += dt * rate;
    const time = forceTime ?? clock;
    // (the opening — the drop, the sign written, the title — beat by beat, as ritual.js plays them; each beat's own
    // time stays at its end once it is over, so between beats nothing moves)
    const td = ritual.at('drop', now) * DROP;
    const dropping = ritual.started('drop');
    if (dropping && td > 0.75 && !loading.classList.contains('loaded')) loading.classList.add('loaded');

    // ---------------------------------------------------------------- world
    rendered = !!(engine && inView);
    if (engine && inView) {
      // hold the cloud while the forest is still being built
      const hold = u > 107.9 && !engine.forest;
      engine.update(hold ? Math.min(u, 108.25) : u, time, dt * rate);
      renderTimed();
    }
    // ---------------------------------------------------------------- ink overlay
    if (ink) {
      const cut = inkCut(u);
      const blots = [];
      // opening: a single drop falls where the dot breathed, splashes and blooms (the sign is written into it; the
      // bloom is placed and sized by the sign's own box, so the two agree on any screen)
      const so = sealAt(sealSvg), dropT = clamp(td / 0.75);
      // (the bloom lifts with the flood that carries the title away and never comes back: its own lift, not the
      // cut's, which reads 0 again once the cut is over)
      const openLift = smooth(INK_CUTS[0][2], INK_CUTS[0][3], u);
      const opening = openLift < 0.999;
      const bloomR = opening ? (smooth(0.7, 2.9, td) * 0.905 + smooth(1.0, 3.1, td) * 0.095) * so.r : 0;
      let drop = [0.5, 0.58, 0, 0];
      if (opening && dropping && td < 0.75) drop = [so.x, lerp(1.15, so.y, dropT * dropT), 0.022, 0];
      else if (opening && dropping && td < 1.35) drop = [so.x, so.y, 0.03, clamp((td - 0.75) / 0.6)];
      if (opening && bloomR > 0) blots.push({ x: so.x, y: so.y, r: bloomR, a: 1 - openLift });
      // his hand falls: a tear, landing where their hands met
      if (u > 91.45 && u < 92.05) drop = [0.5, inkfx.drop(u), 0.018, 0];
      else if (u >= 92.05 && u < 92.65) drop = [0.5, 0.56, 0.026, inkfx.splash(u)];
      // the first page: the last drop, and the sign written in gold inside its bloom
      const endK = u > 140.9, se = endK ? sealAt(endSvg) : null;
      if (u > 140.95 && u < 141.55) drop = [se.x, lerp(se.y, 1.12, (inkfx.endDrop(u) - 0.58) / 0.54), 0.022, 0];
      else if (u >= 141.55 && u < 142.15) drop = [se.x, se.y, 0.03, inkfx.endSplash(u)];
      if (endK) blots.push({ x: se.x, y: se.y, r: (smooth(141.5, 142.6, u) * 0.905 + smooth(142, 145, u) * 0.095) * se.r, a: 1 });
      inkCanvas.style.opacity = (u > 61 && u < 67 ? inkfx.splatFade(u) : 1).toFixed(3);
      // the crossing: the light goes down beyond the ridge and floods the world white; out of where it went down the
      // gold thread is written across the page, and the Forbidden Forest is painted in ink in its wake; then the eye
      // goes into the painting, where the thread went down into the trees, and the page clears into the forest itself
      let stroke = null, land = null;
      if (u > 107.9 && u < 110.65) {
        const aspY = innerHeight / Math.min(innerWidth, innerHeight);
        const S = (engine && engine.metrics.crossUV) || [0.4, 0.58];
        const D = [0.62, 0.5 - 0.19 / aspY];
        stroke = { progress: smooth(107.98, 109.05, u), width: 0.02, alpha: smooth(107.95, 108.1, u) * (1 - smooth(110.05, 110.55, u)), tail: smooth(109.45, 110.35, u) * 0.85,
          pts: [S, [S[0] + 0.15, Math.min(0.95, S[1] + 0.36)], [D[0] + 0.24, D[1] + 0.36], D] };
        land = { reveal: smooth(108.1, 109.6, u), alpha: smooth(107.98, 108.2, u), clear: smooth(109.75, 110.55, u), zoom: 1 + 1.6 * Math.pow(smooth(109.5, 110.6, u), 1.4), center: D, sun: S };
      }
      ink.render(time, { blots, flood: cut.flood, floodC: [0.5, u < 9 ? so.y : cut.y], floodLift: cut.lift, drop, splat: u > 61.5 && u < 67 ? inkfx.splat(u) : 0, splatSeed: 3, stroke, land });
    }
    // ---------------------------------------------------------------- title and the last page
    const titleShow = u < 5.2 ? 1 - smooth(3.6, 4.9, u) : 0;
    op(title, titleShow);
    if (titleShow > 0) {
      // the sign, stroke by stroke at the brush's pace (or written on by the scroll, for a reader who goes on first)
      let written = 0;
      for (let k = 0; k < pace.length; k++) {
        const q = ritual.at(`s${k}`, now);
        if (q <= 0) break;
        const [a, b] = seal.bounds[k];
        written = a + (b - a) * pace[k].at(q);
      }
      seal.set(Math.max(written, smooth(0.2, 2.5, u)));
      // the title written in from the left, the line above it after; the stamp pressed; the line under it
      const byScroll = smooth(0.2, 2.6, u);
      const qt = ritual.at('title', now), qs = ritual.at('stamp', now);
      setVar(title, '--reveal', Math.max(easeInOut(qt), byScroll));
      setVar(title, '--eyebrow', Math.max(smooth(0.45, 1, qt), byScroll));
      // (pressed: down from a little above the paper, a touch past, back)
      const press = Math.max(qs, byScroll);
      setVar(title, '--stamp-s', press < 0.7 ? lerp(1.3, 0.97, Math.pow(press / 0.7, 1.6)) : lerp(0.97, 1, smooth(0.7, 1, press)));
      setVar(title, '--stamp-a', smooth(0, 0.3, press));
      setVar(title, '--sub', Math.max(smooth(0, 1, ritual.at('sub', now)), byScroll));
      // the line under the title: while the story is prepared it says so, over a line of progress (full once it is
      // ready); then, as the last beat, the hint
      const qh = ritual.at('hint', now), hs = ritual.started('hint');
      const wait = !replaying && (hs ? qh < 0.35 : true);
      if (hint && wait !== hintWait) { hintWait = wait; title.classList.toggle('waiting', wait); hint.innerHTML = wait ? WAIT_HTML : hintHTML; }
      setVar(title, '--hint', wait ? (hs ? 1 - qh / 0.35 : 1) : (hs ? smooth(0.35, 1, qh) : 0) * (1 - smooth(0.4, 1.4, u)));
    }
    const endShow = smooth(141.4, 141.8, u);
    op(end, endShow);
    if (endShow > 0) {
      endSeal.set(smooth(141.7, 143.6, u));
      end.style.setProperty('--reveal', String(smooth(143.4, 144.4, u)));
    }
    // ---------------------------------------------------------------- captions: the strongest one only
    const light = lightAt(u);
    let best = null, bestV = 0;
    for (const c of caps) { const v = band(c.a, c.a + 0.55, c.b - 0.6, c.b, u); if (v > bestV) { bestV = v; best = c; } }
    for (const c of caps) {
      const v = c === best ? bestV : 0;
      op(c.n, v);
      if (v > 0) {
        c.n.style.setProperty('--reveal', String(smooth(c.a, c.a + 1.1, u)));
        c.n.classList.toggle('ink', light);
      }
    }
    // ---------------------------------------------------------------- HUD
    let ch = CHAPTERS[0][1];
    for (const [a, name] of CHAPTERS) if (u >= a) ch = name;
    if (chapter.textContent !== ch) chapter.textContent = ch;
    meter.style.transform = `scaleX(${(su / TOTAL_U).toFixed(4)})`;
    const dark = !light;
    document.body.classList.toggle('cf-dark', dark && inView);
    hud.classList.toggle('dark', dark);
    $('.nav').classList.toggle('dark', dark && inView);
    // (the silence over the sea of clouds: everything on the page draws back but the picture; and the cinema bars'
    // height, for the captions that ride on the lower one)
    setVar(document.documentElement, '--cf-quiet', inView ? smooth(48.466, 48.47, u) * (1 - smooth(48.95, 49.3, u)) : 0);
    setVar(document.documentElement, '--cf-bar', engine && inView ? engine.metrics.bars || 0 : 0);
    audio.update(u, now, Math.abs(target - su) * 10, engine ? engine.metrics.wind ?? 0.5 : 0.4);
    if (forceTime == null) forced = null;
  }
  // ---------------------------------------------------------------- keep the frame rate
  // The world is drawn at a lower resolution, a step at a time, only when the GPU itself is the bottleneck: its own
  // time per frame is read through the timer-query extension where the browser offers one. (Guessed from frame
  // intervals, as before, the governor cut the resolution to 60% on a desktop whose GPU had ten milliseconds to spare:
  // a stalled frame, or a pane the app was throttling, looked like a slow one.) Without the extension the interval
  // heuristic remains, needing a plainly slow rate; stalls (frames over 80 ms) never count either way. Once a step up
  // has proved too much it stays put for a long while.
  const gov = { on: params.get('res') !== 'fixed', pr: 0, max: 0, min: 0, ema: 16.7, gpu: 8, cpu: 2, slow: 0, fast: 0, cool: 2, failAt: -1e9, upAt: -1e9 };
  let gl = null, tq = null, tqN = 0;
  const pendQ = [], doneQ = [];
  function timerOn() {
    if (!engine) return false;
    if (!gl) { gl = engine.renderer.getContext(); try { tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch { tq = null; } }
    return !!tq;
  }
  // (one frame in four is timed; results are read without waiting, and the GPU's disjoint flag — which costs a round
  // trip to the GPU process — once for a batch of them)
  function renderTimed() {
    if (!gov.on || !timerOn() || (tqN++ & 3) || pendQ.length > 8) { engine.render(); return; }
    const q = gl.createQuery();
    gl.beginQuery(tq.TIME_ELAPSED_EXT, q);
    engine.render();
    gl.endQuery(tq.TIME_ELAPSED_EXT);
    pendQ.push(q);
  }
  function readTimed() {
    while (pendQ.length && gl.getQueryParameter(pendQ[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pendQ.shift();
      doneQ.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    if (doneQ.length >= 6) {
      if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) for (const ms of doneQ) if (ms < 80) gov.gpu += (ms - gov.gpu) * 0.25;
      doneQ.length = 0;
    }
  }
  function setPR(pr) {
    gov.pr = pr; gov.slow = gov.fast = 0; gov.cool = 1.5; gov.ema = 16.7; gov.gpu = 8;
    engine.renderer.setPixelRatio(pr);
    engine.resize();
  }
  function govern(intervalMs, cpuMs) {
    if (!gov.on || !engine || !rendered || intervalMs > 80) return;
    if (!gov.max) { gov.max = gov.pr = engine.renderer.getPixelRatio(); gov.min = Math.max(0.6, gov.max * 0.5); }
    const dt = intervalMs / 1000;
    gov.ema += (intervalMs - gov.ema) * 0.08;
    gov.cpu += (cpuMs - gov.cpu) * 0.08;
    if ((gov.cool -= dt) > 0) return;
    const timed = !!tq;
    const slow = timed ? gov.gpu > 15 : (gov.ema > 28 && gov.cpu < gov.ema * 0.5);
    const fast = timed ? gov.gpu < 9 : gov.ema < 18.5;
    if (slow) gov.slow += dt; else gov.slow = Math.max(0, gov.slow - dt * 0.5);
    if (fast) gov.fast += dt; else gov.fast = 0;
    const now = performance.now();
    if (gov.slow > 1 && gov.pr > gov.min + 1e-3) {
      if (now - gov.upAt < 12000) gov.failAt = now;
      setPR(Math.max(gov.min, gov.pr * 0.8));
    } else if (gov.fast > 8 && gov.pr < gov.max - 1e-3 && now - gov.failAt > 45000) {
      gov.upAt = now;
      setPR(Math.min(gov.max, gov.pr / 0.8));
    }
  }
  const debug = params.has('debug');
  let lastLoop = performance.now();
  const loop = now => {
    requestAnimationFrame(loop);
    const iv = now - lastLoop;
    lastLoop = now;
    if (trace && trace.frames.length < 30000) trace.frames.push([Math.round(now), Math.round(iv * 10) / 10]);
    if (document.hidden || debug) return;
    const t0 = performance.now();
    frame(now);
    if (tq) readTimed();
    govern(iv, performance.now() - t0);
  };
  requestAnimationFrame(loop);
  addEventListener('pageshow', () => { su = target = uFromScroll(); last = performance.now(); });
}

if (reduced || !hasGL) {
  document.body.classList.add('reduced-motion');
  root.dataset.ready = reduced ? 'reduced' : 'fallback';
} else boot();
