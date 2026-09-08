import { initCinematic } from './cinematic.js';
/* ===========================================================
   Wuhen & Xuan: Heaven Defying — shared site behaviour
   Nav, reveal-on-scroll, gallery rendering + lightbox
   =========================================================== */

/* ---------- Image catalogue (relative to site root) ---------- */
const IMAGES = {
  art: [
    { file: 'Images/Art/WideIntro.webp', cap: 'Above the Mortal Realm' },
    { file: 'Images/Art/ArtSunset.webp', cap: 'Twin Souls at the Cliff of Dusk' },
    { file: 'Images/Art/ArtSect.webp', cap: 'The Lotus Sect, Adrift in Cloud' },
    { file: 'Images/Art/Art.webp', cap: 'Key Vision' },
  ],
  mcs: [
    { file: 'Images/MCs/MC1.webp', cap: 'The Unsealed Bloodline' },
    { file: 'Images/MCs/MC2.webp', cap: 'Crimson Ascension' },
    { file: 'Images/MCs/MC3.webp', cap: 'The Wanderer' },
    { file: 'Images/MCs/MC4.webp', cap: 'Vow of Ash' },
    { file: 'Images/MCs/MC5.webp', cap: 'The Quiet Storm' },
    { file: 'Images/MCs/image_0 (21).webp', cap: 'Drifting Cultivator' },
    { file: 'Images/MCs/image_1 (10).webp', cap: 'Heir of the Forgotten' },
    { file: 'Images/MCs/image_1 (8).webp', cap: 'Eyes of the Old World' },
  ],
  clothing: [
    { file: 'Images/Clothing/image_1 (22).webp', cap: 'Mortal Robes' },
  ],
  environment: [
    { file: 'Images/Environment/City.webp', cap: 'The Lantern Quarter' },
    { file: 'Images/Environment/City2.webp', cap: 'Market Under Snow' },
    { file: 'Images/Environment/City3.webp', cap: 'The Old Capital' },
    { file: 'Images/Environment/Inn.webp', cap: 'The Wayfarer\u2019s Inn' },
    { file: 'Images/Environment/Housing.webp', cap: 'Village Dwellings' },
    { file: 'Images/Environment/Hill.webp', cap: 'The Green Hills' },
    { file: 'Images/Environment/Mountain.webp', cap: 'Peaks of the Immortals' },
    { file: 'Images/Environment/Environment1.webp', cap: 'Borderland Path' },
    { file: 'Images/Environment/Environment2.webp', cap: 'Misted Valley' },
    { file: 'Images/Environment/Environment3.webp', cap: 'Forgotten Shrine' },
    { file: 'Images/Environment/Environment4.webp', cap: 'River of Reeds' },
    { file: 'Images/Environment/image_0 (2).webp', cap: 'Wandering Road' },
    { file: 'Images/Environment/image_0 (5).webp', cap: 'Quiet Courtyard' },
    { file: 'Images/Environment/image_0 (7).webp', cap: 'Cliffside Trail' },
    { file: 'Images/Environment/image_0 (9).webp', cap: 'Dawn Over Tiles' },
    { file: 'Images/Environment/image_0 (10).webp', cap: 'Lake of Mirrors' },
    { file: 'Images/Environment/image_0 (13).webp', cap: 'Pavilion in Bloom' },
    { file: 'Images/Environment/image_0 (16).webp', cap: 'Stone Bridge' },
    { file: 'Images/Environment/image_0 (22).webp', cap: 'Terraced Slopes' },
    { file: 'Images/Environment/image_0 (23).webp', cap: 'Bamboo Hollow' },
    { file: 'Images/Environment/image_0 (26).webp', cap: 'Temple Steps' },
    { file: 'Images/Environment/image_1 (4).webp', cap: 'Frosted Eaves' },
    { file: 'Images/Environment/image_1 (6).webp', cap: 'Twilight Walk' },
    { file: 'Images/Environment/image_1 (7).webp', cap: 'Lantern-lit Lane' },
    { file: 'Images/Environment/image_1 (15).webp', cap: 'Cloud Terrace' },
    { file: 'Images/Environment/image_1 (20).webp', cap: 'Mountain Gate' },
    { file: 'Images/Environment/image_1 (21).webp', cap: 'Hidden Hamlet' },
    { file: 'Images/Environment/image_1 (23).webp', cap: 'Snowfall Square' },
    { file: 'Images/Environment/image_1 (24).webp', cap: 'Riverside Town' },
    { file: 'Images/Environment/image_1 (27).webp', cap: 'The Long Wall' },
    { file: 'Images/Environment/image_1 (35).webp', cap: 'Verdant Overlook' },
    { file: 'Images/Environment/image_1 (36).webp', cap: 'Sunset Rooftops' },
  ],
  magic: [
    { file: 'Images/Magic/bigMagic.webp', cap: 'Heaven-Spanning Array' },
    { file: 'Images/Magic/AscendantMagic.webp', cap: 'Ascendant Rite' },
    { file: 'Images/Magic/MagicArray.webp', cap: 'Sealing Array I' },
    { file: 'Images/Magic/MagicArray2.webp', cap: 'Sealing Array II' },
    { file: 'Images/Magic/MagicArray3.webp', cap: 'Sealing Array III' },
    { file: 'Images/Magic/MagicArray4.webp', cap: 'Sealing Array IV' },
    { file: 'Images/Magic/MagicSphere.webp', cap: 'Qi Condensation' },
    { file: 'Images/Magic/MagicLines.webp', cap: 'Threads of Fate' },
    { file: 'Images/Magic/magicVoid.webp', cap: 'Into the Void' },
    { file: 'Images/Magic/body.webp', cap: 'Meridian Awakening' },
    { file: 'Images/Magic/DragonDog.webp', cap: 'The Beast Within' },
    { file: 'Images/Magic/Swords.webp', cap: 'Sword Intent' },
    { file: 'Images/Magic/SwordsFlying.webp', cap: 'Flying Sword Art' },
    { file: 'Images/Magic/Soldier.webp', cap: 'The Clean-Up Crew' },
    { file: 'Images/Magic/image_0 (2).webp', cap: 'Spirit Flame' },
    { file: 'Images/Magic/image_0 (3).webp', cap: 'Talisman Burst' },
    { file: 'Images/Magic/image_0 (4).webp', cap: 'Lightning Coil' },
    { file: 'Images/Magic/image_0 (6).webp', cap: 'Golden Sigil' },
    { file: 'Images/Magic/image_0 (8).webp', cap: 'Astral Bloom' },
    { file: 'Images/Magic/image_0 (10).webp', cap: 'Radiant Surge' },
    { file: 'Images/Magic/image_0 (11).webp', cap: 'Frost Domain' },
    { file: 'Images/Magic/image_0 (15).webp', cap: 'Ember Crown' },
    { file: 'Images/Magic/image_0 (17).webp', cap: 'Phantom Step' },
    { file: 'Images/Magic/image_0 (18).webp', cap: 'Soul Lantern' },
    { file: 'Images/Magic/image_0 (25).webp', cap: 'Heaven\u2019s Decree' },
    { file: 'Images/Magic/image_1 (3).webp', cap: 'Cinder Wing' },
    { file: 'Images/Magic/image_1 (4).webp', cap: 'Jade Current' },
    { file: 'Images/Magic/image_1 (5).webp', cap: 'Star Compass' },
    { file: 'Images/Magic/image_1 (7).webp', cap: 'Blood Sigil' },
    { file: 'Images/Magic/image_1 (10).webp', cap: 'Void Rupture' },
    { file: 'Images/Magic/image_1 (11).webp', cap: 'Lotus Flame' },
    { file: 'Images/Magic/image_1 (12).webp', cap: 'Mirror of Karma' },
    { file: 'Images/Magic/image_1 (13).webp', cap: 'Thunder Glyph' },
    { file: 'Images/Magic/image_1 (18).webp', cap: 'Celestial Tide' },
    { file: 'Images/Magic/image_1 (19).webp', cap: 'Gilded Storm' },
    { file: 'Images/Magic/image_1 (21).webp', cap: 'Spirit Severance' },
    { file: 'Images/Magic/image_1 (22).webp', cap: 'Crimson Array' },
    { file: 'Images/Magic/image_1 (25).webp', cap: 'Pale Moon Rite' },
    { file: 'Images/Magic/image_1 (26).webp', cap: 'Ashen Vortex' },
    { file: 'Images/Magic/image_1 (28).webp', cap: 'Dragon Seal' },
    { file: 'Images/Magic/image_1 (29).webp', cap: 'Heaven\u2019s Eye' },
    { file: 'Images/Magic/image_1 (30).webp', cap: 'Eternal Coil' },
  ],
};


/* ---------- Accessible navigation, reveal, and artwork viewer ---------- */
function src(file) { return encodeURI(file); }
let revealObserver;
function initReveal() {
  const elements = document.querySelectorAll('.reveal:not(.active)');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach(el => el.classList.add('active')); return;
  }
  revealObserver ||= new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('active'); revealObserver.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -35px 0px' });
  elements.forEach(el => revealObserver.observe(el));
}
function initNav() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;
  const setOpen = open => {
    menu.classList.toggle('hidden-menu', !open);
    menu.inert = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    toggle.querySelector('span').textContent = open ? '−' : '＋';
  };
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('#navbar')) setOpen(false); });
  matchMedia('(min-width:901px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
}
function renderGalleries() {
  document.querySelectorAll('[data-gallery]').forEach(container => {
    const key = container.dataset.gallery;
    container.innerHTML = (IMAGES[key] || []).map((img, i) => `<figure class="gallery-item reveal" tabindex="0" role="button" aria-label="View ${img.cap}" data-lb-key="${key}" data-lb-index="${i}"><img loading="lazy" decoding="async" src="${src(img.file)}" alt="${img.cap}" width="1024" height="1024"><figcaption class="cap"><span>${img.cap}</span></figcaption></figure>`).join('');
  });
  initLightbox(); initReveal();
}
let lbList = [], lbIndex = 0, returnFocus = null, previousOverflow = '';
const inertStates = new Map();
function initLightbox() {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Concept art viewer'); lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML = '<button type="button" class="lb-close" aria-label="Close artwork">×</button><button type="button" class="lb-nav lb-prev" aria-label="Previous artwork">‹</button><img alt=""><button type="button" class="lb-nav lb-next" aria-label="Next artwork">›</button><div class="lb-cap" aria-live="polite"></div>';
    document.body.append(lb);
    lb.querySelector('.lb-close').addEventListener('click', closeLb);
    lb.querySelector('.lb-prev').addEventListener('click', () => stepLb(-1));
    lb.querySelector('.lb-next').addEventListener('click', () => stepLb(1));
    lb.addEventListener('click', event => { if (event.target === lb) closeLb(); });
    document.addEventListener('keydown', event => {
      if (!lb.classList.contains('open')) return;
      if (['Escape','ArrowLeft','ArrowRight'].includes(event.key)) event.preventDefault();
      if (event.key === 'Escape') closeLb();
      if (event.key === 'ArrowLeft') stepLb(-1);
      if (event.key === 'ArrowRight') stepLb(1);
      if (event.key === 'Tab') {
        const controls = [...lb.querySelectorAll('button')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }
  document.querySelectorAll('.gallery-item:not([data-lb-bound])').forEach(item => {
    item.dataset.lbBound = 'true';
    const open = () => {
      lbList = IMAGES[item.dataset.lbKey] || [];
      lbIndex = Number(item.dataset.lbIndex);
      returnFocus = item;
      previousOverflow = document.body.style.overflow;
      showLb();
      for (const el of document.body.children) {
        if (el !== lb && !['SCRIPT','STYLE'].includes(el.tagName)) { inertStates.set(el, el.inert); el.inert = true; }
      }
      lb.querySelector('.lb-close').focus();
    };
    item.addEventListener('click', open);
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}
function showLb() {
  const lb = document.getElementById('lightbox'), img = lbList[lbIndex];
  if (!img) return;
  lb.querySelector('img').src = src(img.file);
  lb.querySelector('img').alt = img.cap;
  lb.querySelector('.lb-cap').textContent = `${img.cap} — ${lbIndex + 1} / ${lbList.length}`;
  lb.classList.add('open'); lb.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  [lbIndex - 1, lbIndex + 1].forEach(n => { new Image().src = src(lbList[(n + lbList.length) % lbList.length].file); });
}
function stepLb(direction) { lbIndex = (lbIndex + direction + lbList.length) % lbList.length; showLb(); }
function closeLb() {
  const lb = document.getElementById('lightbox');
  lb.classList.remove('open'); lb.setAttribute('aria-hidden','true');
  document.body.style.overflow = previousOverflow;
  for (const [el, state] of inertStates) el.inert = state;
  inertStates.clear(); returnFocus?.focus({ preventScroll: true });
}
function boot() { initNav(); renderGalleries(); initCinematic({ images: IMAGES, initLightbox }); initReveal(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
