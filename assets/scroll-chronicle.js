/** Three acts, one native scroll. The camera is derived from position, so every
 * shot is reversible and survives refresh without a stored playback flag. */
export function initScrollChronicle() {
  const acts = [...document.querySelectorAll('[data-camera-act]')];
  if (!acts.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const rail = document.querySelector('.journey-rail');
  const links = [...rail.querySelectorAll('a')];
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  let frame = 0;

  function paint() {
    frame = 0;
    let current = 0;
    for (const [index, act] of acts.entries()) {
      const rect = act.getBoundingClientRect();
      const p = reduced.matches ? 0 : clamp(-rect.top / Math.max(1, rect.height - innerHeight));
      if (rect.top <= innerHeight * .5) current = index + 1;
      act.style.setProperty('--camera', p.toFixed(4));
      act.dataset.shot = p < .32 ? 'wide' : p < .68 ? 'close' : 'beyond';
      if (rect.bottom < 0 || rect.top > innerHeight * 1.5) continue;
      if (act.dataset.cameraAct === 'crimson') {
        act.style.setProperty('--realm-zoom', (1.03 + ease(.12, 1, p) * .55).toFixed(3));
        act.style.setProperty('--realm-y', `${-p * 12}vh`);
        act.style.setProperty('--realm-x', `${Math.sin(p * Math.PI) * -5}vw`);
        act.style.setProperty('--figure-zoom', (1 + ease(.05, .65, p) * 1.03 - ease(.68, 1, p) * .4).toFixed(3));
        act.style.setProperty('--figure-y', `${p * 19}vh`);
        act.style.setProperty('--title-alpha', (1 - ease(.2, .44, p)).toFixed(3));
        act.style.setProperty('--figure-alpha', (1 - ease(.68, .96, p)).toFixed(3));
        act.style.setProperty('--mist-x', `${-p * 16}vw`);
      } else {
        const enter = ease(0, .30, p);
        const portal = ease(.55, 1, p);
        act.style.setProperty('--scroll-zoom', (1 + enter * .14 + portal * 1.7).toFixed(3));
        act.style.setProperty('--scroll-turn', `${-7 + enter * 7}deg`);
        act.style.setProperty('--scroll-tilt', `${8 - enter * 8}deg`);
        act.style.setProperty('--scroll-swivel', `${-12 + enter * 12}deg`);
        act.style.setProperty('--scroll-pan', `${-portal * 12}vw`);
        act.style.setProperty('--traveller-zoom', (1 + enter * .28 + portal * .65).toFixed(3));
        act.style.setProperty('--traveller-y', `${enter * -3 + portal * 37}vh`);
        act.style.setProperty('--traveller-alpha', (1 - ease(.7, .93, p)).toFixed(3));
        act.style.setProperty('--portal-alpha', (ease(.2, .55, p) * (1 - ease(.78, 1, p))).toFixed(3));
        act.style.setProperty('--ink-title-alpha', (1 - ease(.18, .35, p)).toFixed(3));
        act.style.setProperty('--rocks-x', `${p * -23}vw`);
        act.style.setProperty('--rocks-y', `${p * 23}vh`);
      }
      act.querySelectorAll('[data-shot-copy]').forEach(copy => {
        const visible = reduced.matches || copy.dataset.shotCopy === act.dataset.shot;
        copy.inert = !visible;
        copy.setAttribute('aria-hidden', String(!visible));
      });
    }
    document.body.dataset.journeyAct = String(current);
    links.forEach((a, i) => {
      if (i === Math.min(current, 2)) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
    rail.hidden = Boolean(document.querySelector('.spatial-gate.is-playing'));
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', schedule);
  reduced.addEventListener('change', schedule);
  document.fonts.ready.then(schedule);
  document.body.classList.add('chronicle-ready');
  paint();

  // An optional ritual: holding adds anticipation; Enter provides a direct
  // keyboard equivalent. It never captures scroll or blocks the next scene.
  const ritual = document.querySelector('[data-ritual]');
  const ritualStage = ritual.closest('.scene-stage');
  const message = document.querySelector('[data-ritual-status]');
  let ritualFrame = 0, start = 0, accepted = false;
  function cancel() {
    cancelAnimationFrame(ritualFrame); ritualFrame = 0;
    if (!accepted) ritual.style.setProperty('--hold', 0);
  }
  function accept() {
    if (accepted) return;
    accepted = true; cancel();
    ritual.style.setProperty('--hold', 1);
    ritual.classList.add('is-accepted');
    ritual.querySelector('span').textContent = 'The pact is sealed';
    message.textContent = 'Your bloodline awakens. The Immortal awaits his resurrection.';
    ritualStage.classList.add('pact-sealed');
  }
  function charge(time) {
    const p = clamp((time - start) / 1100);
    ritual.style.setProperty('--hold', p);
    if (p === 1) accept(); else ritualFrame = requestAnimationFrame(charge);
  }
  ritual.addEventListener('pointerdown', event => {
    if (event.button !== 0 || accepted) return;
    start = performance.now();
    ritual.setPointerCapture(event.pointerId);
    ritualFrame = requestAnimationFrame(charge);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) ritual.addEventListener(type, cancel);
  ritual.addEventListener('click', event => { if (event.detail === 0 || reduced.matches) accept(); });
  ritual.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); accept(); }
  });
  addEventListener('scroll', cancel, { passive: true });
  document.addEventListener('visibilitychange', cancel);

  const codex = document.querySelector('#experience-codex');
  const openers = [...document.querySelectorAll('[data-open-codex]')];
  let returnFocus = null, overflow = '';
  const entries = {
    mortal: { title: 'THE MORTAL', label: '01 / AN EXTINCT BLOODLINE', text: 'Your village was ordered to burn. A dying uncle leaves you a scroll, a warning, and a lineage that should no longer exist.', image: 'Images/Cinematic/mortal-spirit.webp', link: 'characters.html#protagonist', cta: 'Follow the Mortal', tone: 'dark' },
    immortal: { title: 'THE IMMORTAL', label: '02 / THE FORBIDDEN MENTOR', text: 'He can awaken the power sleeping in your blood. The price is a promise: bring him back to life.', image: 'Images/Cinematic/immortal-spirit.webp', link: 'characters.html#immortal', cta: 'Meet the Immortal', tone: 'red' },
    realm: { title: 'THE REALM', label: '03 / BEYOND MORTAL DUST', text: 'Cloud-bound sects. Hidden shrines. A celestial trial. Every step beyond your ruined village brings you closer to the truth.', image: 'Images/Journey/ink-realm.webp', link: 'world.html', cta: 'Explore the world', tone: 'paper' },
  };
  const selectors = [...codex.querySelectorAll('[data-codex-entry]')];
  function select(key) {
    const entry = entries[key];
    codex.dataset.tone = entry.tone;
    codex.querySelector('.codex-title').textContent = entry.title;
    codex.querySelector('.codex-label').textContent = entry.label;
    codex.querySelector('.codex-description').textContent = entry.text;
    const art = codex.querySelector('.codex-art'); art.src = entry.image; art.alt = '';
    const link = codex.querySelector('.codex-detail'); link.href = entry.link; link.textContent = entry.cta;
    selectors.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.codexEntry === key)));
  }
  openers.forEach(button => button.addEventListener('click', () => {
    if (codex.open) return;
    returnFocus = button;
    overflow = document.documentElement.style.overflowY;
    document.documentElement.style.overflowY = 'hidden';
    select('mortal'); codex.showModal();
    codex.querySelector('[data-close-codex]').focus();
  }));
  codex.querySelector('[data-close-codex]').addEventListener('click', () => codex.close());
  codex.addEventListener('close', () => {
    document.documentElement.style.overflowY = overflow;
    returnFocus?.focus({ preventScroll: true });
  });
  selectors.forEach(button => button.addEventListener('click', () => select(button.dataset.codexEntry)));
}
