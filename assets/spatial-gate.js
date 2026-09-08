import { createRiftEffects } from './rift-effects.js';
import { createGateAudio } from './gate-audio.js';

/** A deliberate scroll starts one bounded cinematic. Skip and replay stay explicit. */
export function initSpatialGate() {
  const gate = document.querySelector('[data-spatial-gate]');
  if (!gate) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const front = gate.querySelector('.gate-front');
  const arrival = gate.querySelector('.gate-arrival');
  const skip = gate.querySelector('.gate-skip');
  const label = gate.querySelector('[data-gate-label]');
  const cue = gate.querySelector('.gate-scroll');
  const replay = gate.querySelector('.gate-replay');
  const status = gate.querySelector('[data-cinematic-status]');
  const stage = gate.querySelector('.gate-stage');
  const united = gate.querySelector('.gate-spirit--united');
  const sound = gate.querySelector('.gate-sound');
  const audio = createGateAudio(sound);
  const sessionKey = 'heaven-defying:awakening:v2';
  let revisited = false;
  try { revisited = sessionStorage.getItem(sessionKey) === 'seen'; } catch { /* Storage is optional. */ }
  let compact = revisited;
  let outgoingPosition = null;
  let chestBase = { x: 0, y: 0, centerY: 0, offsetY: 0 };
  let chest = { x: 0, y: 0 };
  let charge = 0;
  const canvas = gate.querySelector('.gate-effects');
  const root = document.documentElement;
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  const duration = 8400;
  let top = 0, travel = 1, threshold = 280, scrollFrame = 0;
  let currentProgress = 0, previousState = '', playback = 'armed';
  let effects = null, effectsFrame = 0, lastDraw = 0, inView = false;
  let cinematicFrame = 0, elapsed = 0, lastTick = null, startProgress = 0, runId = 0;
  let lock = null, userIntentUntil = 0, touchY = 0, prepared = false;

  // Eager images normally decode before the first scroll. A bounded wait keeps
  // slow or failed image requests from trapping someone in the opening.
  const artReady = Promise.race([
    Promise.allSettled([...gate.querySelectorAll('.gate-spirit')].map(img => img.decode())),
    new Promise(resolve => setTimeout(resolve, 1200)),
  ]);

  function animateEffects(time) {
    effectsFrame = 0;
    if (motion.matches) { syncEffects(); return; }
    if (!effects || !inView || document.hidden) return;
    if (time - lastDraw >= 1000 / 30) { effects.render(currentProgress, { chestX: chest.x, chestY: chest.y, charge }); lastDraw = time; }
    effectsFrame = requestAnimationFrame(animateEffects);
  }
  function syncEffects() {
    if (motion.matches) { effects?.destroy(); effects = null; userIntentUntil = 0; }
    else if (!effects && canvas) effects = createRiftEffects(canvas);
    const active = effects && inView && !document.hidden && !motion.matches;
    if (active && !effectsFrame) effectsFrame = requestAnimationFrame(animateEffects);
    if (!active && effectsFrame) { cancelAnimationFrame(effectsFrame); effectsFrame = 0; }
    if (canvas) canvas.dataset.active = String(Boolean(active));
  }
  function setPlayback(value) {
    playback = value;
    gate.dataset.playback = value;
    gate.classList.toggle('is-playing', value === 'playing');
  }
  function render(progress) {
    const p = motion.matches || compact ? 0 : clamp(progress);
    currentProgress = p;
    const title = 1 - ease(.025, .22, p);
    const realm = ease(.84, .99, p);
    const union = ease(.46, .57, p) * (1 - ease(.68, .80, p));
    const unionScale = .94 + ease(.47, .76, p) * .12;
    chest = { x: chestBase.x, y: chestBase.centerY + chestBase.offsetY * unionScale };
    const journey = compact ? 0 : clamp((scrollY - top - travel) / Math.max(1, innerHeight * 1.1));
    document.body.style.setProperty('--journey', journey.toFixed(4));
    const state = p < .16 ? 'closed' : p < .44 ? 'converging' : p < .69 ? 'united' : p < .88 ? 'light' : 'arrived';
    const values = {
      '--progress': p.toFixed(4),
      '--split': `${(ease(.12, .50, p) * 30 + ease(.64, .80, p) * 27).toFixed(3)}vw`,
      '--charge': charge,
      '--chest-x': `${chest.x}px`,
      '--chest-y': `${chest.y}px`,
      '--realm-depth': ease(.76, 1, p),
      '--journey': journey,
      '--title': title,
      '--title-lift': `${ease(0, .3, p) * 75}px`,
      '--seam': (.65 + ease(0, .2, p) * .35) * (1 - ease(.74, .86, p)),
      '--bloom': motion.matches ? 0 : ease(.645, .75, p) * (1 - ease(.80, .97, p)) * .9,
      '--radiance': 1 - ease(.74, .90, p),
      '--threshold-scale': 1 + ease(.18, .62, p) * .2 + ease(.64, .85, p) * .8,
      '--threshold-y': `${-ease(.2, .78, p) * 4}vh`,
      '--threshold-gain': 1 + ease(.51, .77, p) * .8,
      '--seam-gain': (1 + ease(.02, .22, p) * .75) * (1 - charge * .38),
      '--edge-fire': motion.matches ? 0 : ease(.035, .20, p) * (1 - ease(.60, .72, p)),
      '--flare': motion.matches ? 0 : ease(.64, .71, p) * (1 - ease(.74, .86, p)) * .85,
      '--flare-scale': .2 + ease(.3, .78, p) * 1.3,
      '--exposure': 1 - ease(.80, .97, p),
      '--realm-copy': realm,
      '--world-scale': 1.34 - ease(.76, 1, p) * .34 + journey * .045,
      '--spirit-alpha': ease(.16, .26, p) * (1 - ease(.45, .57, p)) * .95,
      '--spirit-cut': `${-15 + ease(.30, .555, p) * 130}%`,
      '--spirit-softness': `${ease(.34, .56, p) * 1.2}px`,
      '--spirit-distance': `${(1 - ease(.26, .55, p)) * 24}vw`,
      '--spirit-scale': 1 - ease(.24, .55, p) * .12,
      '--union-alpha': union,
      '--union-scale': unionScale,
      '--union-veil': ease(.18, .31, p) * (1 - ease(.68, .83, p)),
    };
    for (const [property, value] of Object.entries(values)) gate.style.setProperty(property, value);
    const frontHidden = title < .12 || playback === 'playing';
    const arrivalHidden = realm < .2 || playback === 'playing';
    const hideSkip = (!frontHidden && playback !== 'playing') || motion.matches;
    gate.classList.toggle('is-opening', !hideSkip);
    gate.classList.toggle('is-arrived', realm > .005);
    const focus = document.activeElement;
    if (!frontHidden) front.inert = false;
    if (!hideSkip) skip.inert = false;
    if ((frontHidden && front.contains(focus)) || (arrivalHidden && arrival.contains(focus))) {
      (hideSkip ? cue : skip).focus({ preventScroll: true });
    } else if (hideSkip && focus === skip) cue.focus({ preventScroll: true });
    front.inert = frontHidden;
    front.setAttribute('aria-hidden', String(frontHidden));
    arrival.inert = arrivalHidden;
    arrival.setAttribute('aria-hidden', String(arrivalHidden));
    skip.inert = hideSkip;
    skip.textContent = playback === 'playing' ? 'Skip cinematic' : p > .94 ? 'Continue the journey ↘' : 'Skip opening ↘';
    cue.querySelector('b').textContent = motion.matches ? 'DISCOVER THEIR PACT' : playback === 'complete' ? 'REPLAY THE AWAKENING' : 'SCROLL TO AWAKEN THE PACT';
    if (playback === 'playing') audio.render(p);
    gate.dataset.progress = p.toFixed(4);
    if (state !== previousState) {
      gate.dataset.state = state;
      label.textContent = { closed: 'THE FRACTURE', converging: 'TWO SOULS', united: 'ONE FATE', light: 'BEYOND THE VEIL', arrived: 'THE IMMORTAL REALM' }[state];
      previousState = state;
    }
  }

  function holdPage() {
    if (lock) return;
    const scrollbar = Math.max(0, innerWidth - root.clientWidth);
    const background = [...document.querySelectorAll('#navbar, main > *, .cinema-footer')].filter(el => el !== gate);
    lock = { overflow: root.style.overflowY, padding: root.style.paddingRight, background: background.map(el => [el, el.inert]) };
    if (scrollbar) root.style.paddingRight = `${parseFloat(getComputedStyle(root).paddingRight) + scrollbar}px`;
    root.style.overflowY = 'hidden';
    background.forEach(el => { el.inert = true; });
  }
  function releasePage() {
    if (!lock) return;
    root.style.overflowY = lock.overflow;
    root.style.paddingRight = lock.padding;
    lock.background.forEach(([el, inert]) => { el.inert = inert; });
    lock = null;
  }
  function stopClock() {
    runId += 1;
    if (cinematicFrame) cancelAnimationFrame(cinematicFrame);
    cinematicFrame = 0;
    lastTick = null;
    releasePage();
    audio.stop();
    charge = 0;
  }
  function finish({ focus = true, reduced = false } = {}) {
    stopClock();
    setPlayback('complete');
    try { sessionStorage.setItem(sessionKey, 'seen'); } catch { /* Navigation works without storage. */ }
    status.textContent = 'The passage is open.';
    measure(false);
    if (reduced || motion.matches) {
      render(0);
      document.getElementById('prologue').scrollIntoView({ behavior: 'instant' });
      if (focus) document.querySelector('#prologue a').focus({ preventScroll: true });
    } else {
      scrollTo({ top: top + travel, behavior: 'instant' });
      render(1);
      if (focus) arrival.querySelector('a').focus({ preventScroll: true });
    }
  }
  function tick(now) {
    cinematicFrame = 0;
    if (playback !== 'playing') return;
    if (motion.matches) { finish({ reduced: true }); return; }
    if (document.hidden) { lastTick = null; return; }
    if (lastTick !== null) elapsed += Math.min(now - lastTick, 80);
    lastTick = now;
    const time = clamp(elapsed / duration);
    // The pause belongs before release: charge, converge, hold, then cross over.
    charge = ease(0, .045, time) * (1 - ease(.075, .14, time));
    const beats = [[0,startProgress],[.09,.10],[.27,.30],[.47,.49],[.56,.58],[.67,.62],[.75,.72],[.90,.92],[1,1]];
    let p = 1;
    for (let i = 1; i < beats.length; i += 1) {
      if (time <= beats[i][0]) {
        const [a, from] = beats[i - 1], [b, to] = beats[i];
        p = from + (to - from) * ease(a, b, time);
        break;
      }
    }
    scrollTo({ top: top + travel * p, behavior: 'instant' });
    render(p);
    if (time >= 1) { finish(); return; }
    cinematicFrame = requestAnimationFrame(tick);
  }
  function start({ replaying = false, keyboard = false } = {}) {
    if (playback === 'playing' || motion.matches) return;
    if (compact) { compact = false; gate.classList.remove('is-revisited'); measure(false); }
    startProgress = replaying ? 0 : Math.min(.06, clamp((scrollY - top) / travel));
    elapsed = 0;
    prepared = false;
    lastTick = null;
    setPlayback('playing');
    holdPage();
    scrollTo({ top: top + travel * startProgress, behavior: 'instant' });
    render(startProgress);
    status.textContent = 'The awakening is playing. Press Escape or use Skip cinematic to continue.';
    if (keyboard) skip.focus({ preventScroll: true });
    const id = ++runId;
    artReady.then(() => {
      if (id !== runId || playback !== 'playing') return;
      prepared = true;
      if (!document.hidden && !cinematicFrame) { audio.start(currentProgress); cinematicFrame = requestAnimationFrame(tick); }
    });
  }
  function fromScroll() {
    scrollFrame = 0;
    if (playback === 'playing') return;
    const offset = scrollY - top;
    if (playback === 'armed' && !motion.matches && performance.now() < userIntentUntil && offset >= threshold && offset < travel * .85) { start(); return; }
    render(offset / travel);
  }
  function scheduleScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(fromScroll); }
  function measure(paint = true) {
    top = gate.getBoundingClientRect().top + scrollY;
    travel = Math.max(1, gate.offsetHeight - stage.offsetHeight);
    threshold = Math.max(180, Math.min(360, stage.offsetHeight * .32));
    gate.dataset.triggerDistance = threshold.toFixed(0);
    syncEffects();
    effects?.resize();
    if (united) {
      // Chest point in the original image; account for its centered CSS scale.
      const height = united.offsetHeight;
      chestBase = { x: stage.clientWidth * .5, centerY: united.offsetTop + height * .5, offsetY: height * .063 };
    }
    if (playback === 'playing' && motion.matches) { finish({ reduced: true }); return; }
    if (paint && playback !== 'playing') render((scrollY - top) / travel);
  }
  function noteIntent() { userIntentUntil = performance.now() + 1400; }
  function wouldTrigger(delta) {
    const offset = scrollY - top;
    return playback === 'armed' && !motion.matches && offset >= -1 && offset < threshold && offset + delta >= threshold;
  }
  addEventListener('wheel', event => {
    if (playback === 'playing') { event.preventDefault(); return; }
    if (motion.matches || event.ctrlKey || event.deltaY <= 0) return;
    noteIntent();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (wouldTrigger(delta)) { event.preventDefault(); start(); }
  }, { passive: false });
  addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY ?? 0; }, { passive: true });
  addEventListener('touchmove', event => {
    if (playback === 'playing') { event.preventDefault(); return; }
    if (!motion.matches && touchY - (event.touches[0]?.clientY ?? touchY) > 10) noteIntent();
  }, { passive: false });
  // Scrollbar drags count as intent; ordinary link clicks must not start a film.
  addEventListener('pointerdown', event => { if (!motion.matches && event.clientX >= root.clientWidth) noteIntent(); }, { passive: true });
  document.addEventListener('keydown', event => {
    if (playback === 'playing') {
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      else if (event.key === 'Tab') {
        event.preventDefault();
        const controls = [skip, sound].filter(el => el && !el.disabled && !el.hidden);
        const current = controls.indexOf(document.activeElement);
        const next = current < 0 ? 0 : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next].focus({ preventScroll: true });
      }
      else if (event.key === ' ' && event.target === sound) return;
      else if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) event.preventDefault();
      return;
    }
    if (event.target.closest('input,textarea,select,button,[contenteditable=true]')) return;
    if (!motion.matches && [' ', 'PageDown', 'ArrowDown'].includes(event.key)) {
      noteIntent();
      if (wouldTrigger(event.key === 'ArrowDown' ? 40 : innerHeight * .9)) { event.preventDefault(); start({ keyboard: true }); }
    }
  });
  cue.addEventListener('click', event => {
    if (motion.matches) return;
    event.preventDefault();
    start({ replaying: playback === 'complete', keyboard: true });
  });
  replay.addEventListener('click', () => start({ replaying: true, keyboard: true }));
  skip.addEventListener('click', event => {
    if (playback === 'playing') { event.preventDefault(); finish(); }
  });
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', () => measure(), { passive: true });
  addEventListener('pageshow', event => {
    if (event.persisted && playback === 'complete' && !compact) {
      let seen = false;
      try { seen = sessionStorage.getItem(sessionKey) === 'seen'; } catch { /* Optional. */ }
      if (seen) {
        const offset = outgoingPosition?.storyOffset ?? scrollY - top - travel;
        compact = true;
        gate.classList.add('is-revisited');
        measure(false);
        // Preserve a position in the story when the tall intro collapses.
        const destination = offset >= 0 ? top + offset : top;
        // BFCache restores persisted scroll after pageshow; use the outgoing
        // story position on the next frame, after the shorter intro is laid out.
        requestAnimationFrame(() => {
          scrollTo({ top: destination, behavior: 'instant' });
          measure();
        });
      }
    }
    measure();
  });
  addEventListener('pagehide', () => {
    outgoingPosition = { storyOffset: scrollY - top - travel };
    stopClock();
    setPlayback('complete');
  });
  addEventListener('hashchange', () => { userIntentUntil = 0; if (playback === 'playing') { stopClock(); setPlayback('complete'); fromScroll(); } });
  motion.addEventListener('change', () => { userIntentUntil = 0; measure(); });
  document.addEventListener('visibilitychange', () => {
    syncEffects();
    if (playback !== 'playing') return;
    if (document.hidden) { if (cinematicFrame) cancelAnimationFrame(cinematicFrame); cinematicFrame = 0; lastTick = null; audio.stop(); }
    else if (prepared && !cinematicFrame) { audio.start(currentProgress); cinematicFrame = requestAnimationFrame(tick); }
  });
  new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncEffects(); }).observe(stage);
  new ResizeObserver(() => measure()).observe(gate);
  gate.classList.add('is-enhanced');
  gate.classList.toggle('is-revisited', compact);
  setPlayback(compact ? 'complete' : 'armed');
  measure();
  united?.decode().then(() => measure()).catch(() => {});
}
