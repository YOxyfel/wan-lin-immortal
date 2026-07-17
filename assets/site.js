/* ===========================================================
   Wuhen & Xuan: Heaven Defying — shared site behaviour
   Nav, reveal-on-scroll, gallery rendering + lightbox
   =========================================================== */

/* ---------- Image catalogue (relative to site root) ---------- */
const IMAGES = {
  art: [
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

/* ---------- Helpers ---------- */
function src(file) { return encodeURI(file); }

/* ---------- Reveal on scroll (IntersectionObserver) ---------- */
let revealObserver = null;
function initReveal() {
  const reveals = document.querySelectorAll('.reveal:not(.active)');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('active'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -90px 0px' }
    );
  }
  reveals.forEach((el) => revealObserver.observe(el));
}

/* ---------- Navbar fade ---------- */
function initNav() {
  const nav = document.getElementById('navbar');
  const navBorder = document.getElementById('nav-border');
  if (!nav) return;
  const onScroll = () => {
    if (window.scrollY > 50) {
      nav.classList.add('bg-obsidian-900/95', 'backdrop-blur-md');
      navBorder && navBorder.classList.add('border-white/5');
    } else {
      nav.classList.remove('bg-obsidian-900/95', 'backdrop-blur-md');
      navBorder && navBorder.classList.remove('border-white/5');
    }
  };
  window.addEventListener('scroll', onScroll);
  onScroll();

  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => menu.classList.toggle('hidden-menu'));
    menu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => menu.classList.add('hidden-menu'))
    );
  }
}

/* ---------- Gallery rendering ---------- */
let LB_LIST = [];
function renderGalleries() {
  document.querySelectorAll('[data-gallery]').forEach((container) => {
    const key = container.getAttribute('data-gallery');
    const list = IMAGES[key] || [];
    container.innerHTML = list
      .map(
        (img, i) => `
        <figure class="gallery-item reveal" data-lb-key="${key}" data-lb-index="${i}">
          <img loading="lazy" decoding="async" src="${src(img.file)}" alt="${img.cap}" width="1024" height="1024">
          <figcaption class="cap"><span>${img.cap}</span></figcaption>
        </figure>`
      )
      .join('');
  });
  initLightbox();
  initReveal();
}

/* ---------- Lightbox ---------- */
let lbKey = null;
let lbIndex = 0;
function initLightbox() {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.innerHTML = `
      <span class="lb-close" aria-label="Close">&#10005;</span>
      <span class="lb-nav lb-prev" aria-label="Previous">&#8249;</span>
      <img alt="">
      <span class="lb-nav lb-next" aria-label="Next">&#8250;</span>
      <div class="lb-cap"></div>`;
    document.body.appendChild(lb);

    lb.querySelector('.lb-close').addEventListener('click', closeLb);
    lb.querySelector('.lb-prev').addEventListener('click', (e) => { e.stopPropagation(); stepLb(-1); });
    lb.querySelector('.lb-next').addEventListener('click', (e) => { e.stopPropagation(); stepLb(1); });
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') stepLb(-1);
      if (e.key === 'ArrowRight') stepLb(1);
    });
  }

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      lbKey = item.getAttribute('data-lb-key');
      lbIndex = parseInt(item.getAttribute('data-lb-index'), 10);
      LB_LIST = IMAGES[lbKey] || [];
      showLb();
    });
  });
}
function showLb() {
  const lb = document.getElementById('lightbox');
  const img = LB_LIST[lbIndex];
  if (!img) return;
  lb.querySelector('img').src = src(img.file);
  lb.querySelector('.lb-cap').textContent = img.cap;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  preloadLbNeighbors();
}
function preloadLbNeighbors() {
  if (!LB_LIST.length) return;
  [lbIndex - 1, lbIndex + 1].forEach((n) => {
    const img = LB_LIST[(n + LB_LIST.length) % LB_LIST.length];
    if (img) new Image().src = src(img.file);
  });
}
function stepLb(dir) {
  lbIndex = (lbIndex + dir + LB_LIST.length) % LB_LIST.length;
  showLb();
}
function closeLb() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  renderGalleries();
  initReveal();
});
window.addEventListener('load', initReveal);
