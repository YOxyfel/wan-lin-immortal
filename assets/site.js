/* ===========================================================
   Wan & Lin Immortal — shared site behaviour
   Nav, reveal-on-scroll, gallery rendering + lightbox
   =========================================================== */

/* ---------- Image catalogue (relative to site root) ---------- */
const IMAGES = {
  art: [
    { file: 'Images/Art/ArtSunset.png', cap: 'Twin Souls at the Cliff of Dusk' },
    { file: 'Images/Art/ArtSect.png', cap: 'The Lotus Sect, Adrift in Cloud' },
    { file: 'Images/Art/Art.png', cap: 'Key Vision' },
  ],
  mcs: [
    { file: 'Images/MCs/MC1.png', cap: 'The Unsealed Bloodline' },
    { file: 'Images/MCs/MC2.png', cap: 'Crimson Ascension' },
    { file: 'Images/MCs/MC3.png', cap: 'The Wanderer' },
    { file: 'Images/MCs/MC4.png', cap: 'Vow of Ash' },
    { file: 'Images/MCs/MC5.png', cap: 'The Quiet Storm' },
    { file: 'Images/MCs/image_0 (21).png', cap: 'Drifting Cultivator' },
    { file: 'Images/MCs/image_1 (10).png', cap: 'Heir of the Forgotten' },
    { file: 'Images/MCs/image_1 (8).png', cap: 'Eyes of the Old World' },
  ],
  clothing: [
    { file: 'Images/Clothing/image_1 (22).png', cap: 'Mortal Robes' },
  ],
  environment: [
    { file: 'Images/Environment/City.png', cap: 'The Lantern Quarter' },
    { file: 'Images/Environment/City2.png', cap: 'Market Under Snow' },
    { file: 'Images/Environment/City3.png', cap: 'The Old Capital' },
    { file: 'Images/Environment/Inn.png', cap: 'The Wayfarer\u2019s Inn' },
    { file: 'Images/Environment/Housing.png', cap: 'Village Dwellings' },
    { file: 'Images/Environment/Hill.png', cap: 'The Green Hills' },
    { file: 'Images/Environment/Mountain.png', cap: 'Peaks of the Immortals' },
    { file: 'Images/Environment/Environment1.png', cap: 'Borderland Path' },
    { file: 'Images/Environment/Environment2.png', cap: 'Misted Valley' },
    { file: 'Images/Environment/Environment3.png', cap: 'Forgotten Shrine' },
    { file: 'Images/Environment/Environment4.png', cap: 'River of Reeds' },
    { file: 'Images/Environment/image_0 (2).png', cap: 'Wandering Road' },
    { file: 'Images/Environment/image_0 (5).png', cap: 'Quiet Courtyard' },
    { file: 'Images/Environment/image_0 (7).png', cap: 'Cliffside Trail' },
    { file: 'Images/Environment/image_0 (9).png', cap: 'Dawn Over Tiles' },
    { file: 'Images/Environment/image_0 (10).png', cap: 'Lake of Mirrors' },
    { file: 'Images/Environment/image_0 (13).png', cap: 'Pavilion in Bloom' },
    { file: 'Images/Environment/image_0 (16).png', cap: 'Stone Bridge' },
    { file: 'Images/Environment/image_0 (22).png', cap: 'Terraced Slopes' },
    { file: 'Images/Environment/image_0 (23).png', cap: 'Bamboo Hollow' },
    { file: 'Images/Environment/image_0 (26).png', cap: 'Temple Steps' },
    { file: 'Images/Environment/image_1 (4).png', cap: 'Frosted Eaves' },
    { file: 'Images/Environment/image_1 (6).png', cap: 'Twilight Walk' },
    { file: 'Images/Environment/image_1 (7).png', cap: 'Lantern-lit Lane' },
    { file: 'Images/Environment/image_1 (15).png', cap: 'Cloud Terrace' },
    { file: 'Images/Environment/image_1 (20).png', cap: 'Mountain Gate' },
    { file: 'Images/Environment/image_1 (21).png', cap: 'Hidden Hamlet' },
    { file: 'Images/Environment/image_1 (23).png', cap: 'Snowfall Square' },
    { file: 'Images/Environment/image_1 (24).png', cap: 'Riverside Town' },
    { file: 'Images/Environment/image_1 (27).png', cap: 'The Long Wall' },
    { file: 'Images/Environment/image_1 (35).png', cap: 'Verdant Overlook' },
    { file: 'Images/Environment/image_1 (36).png', cap: 'Sunset Rooftops' },
  ],
  magic: [
    { file: 'Images/Magic/bigMagic.png', cap: 'Heaven-Spanning Array' },
    { file: 'Images/Magic/AscendantMagic.png', cap: 'Ascendant Rite' },
    { file: 'Images/Magic/MagicArray.png', cap: 'Sealing Array I' },
    { file: 'Images/Magic/MagicArray2.png', cap: 'Sealing Array II' },
    { file: 'Images/Magic/MagicArray3.png', cap: 'Sealing Array III' },
    { file: 'Images/Magic/MagicArray4.png', cap: 'Sealing Array IV' },
    { file: 'Images/Magic/MagicSphere.png', cap: 'Qi Condensation' },
    { file: 'Images/Magic/MagicLines.png', cap: 'Threads of Fate' },
    { file: 'Images/Magic/magicVoid.png', cap: 'Into the Void' },
    { file: 'Images/Magic/body.png', cap: 'Meridian Awakening' },
    { file: 'Images/Magic/DragonDog.png', cap: 'The Beast Within' },
    { file: 'Images/Magic/Swords.png', cap: 'Sword Intent' },
    { file: 'Images/Magic/SwordsFlying.png', cap: 'Flying Sword Art' },
    { file: 'Images/Magic/Soldier.png', cap: 'The Clean-Up Crew' },
    { file: 'Images/Magic/image_0 (2).png', cap: 'Spirit Flame' },
    { file: 'Images/Magic/image_0 (3).png', cap: 'Talisman Burst' },
    { file: 'Images/Magic/image_0 (4).png', cap: 'Lightning Coil' },
    { file: 'Images/Magic/image_0 (6).png', cap: 'Golden Sigil' },
    { file: 'Images/Magic/image_0 (8).png', cap: 'Astral Bloom' },
    { file: 'Images/Magic/image_0 (10).png', cap: 'Radiant Surge' },
    { file: 'Images/Magic/image_0 (11).png', cap: 'Frost Domain' },
    { file: 'Images/Magic/image_0 (15).png', cap: 'Ember Crown' },
    { file: 'Images/Magic/image_0 (17).png', cap: 'Phantom Step' },
    { file: 'Images/Magic/image_0 (18).png', cap: 'Soul Lantern' },
    { file: 'Images/Magic/image_0 (25).png', cap: 'Heaven\u2019s Decree' },
    { file: 'Images/Magic/image_1 (3).png', cap: 'Cinder Wing' },
    { file: 'Images/Magic/image_1 (4).png', cap: 'Jade Current' },
    { file: 'Images/Magic/image_1 (5).png', cap: 'Star Compass' },
    { file: 'Images/Magic/image_1 (7).png', cap: 'Blood Sigil' },
    { file: 'Images/Magic/image_1 (10).png', cap: 'Void Rupture' },
    { file: 'Images/Magic/image_1 (11).png', cap: 'Lotus Flame' },
    { file: 'Images/Magic/image_1 (12).png', cap: 'Mirror of Karma' },
    { file: 'Images/Magic/image_1 (13).png', cap: 'Thunder Glyph' },
    { file: 'Images/Magic/image_1 (18).png', cap: 'Celestial Tide' },
    { file: 'Images/Magic/image_1 (19).png', cap: 'Gilded Storm' },
    { file: 'Images/Magic/image_1 (21).png', cap: 'Spirit Severance' },
    { file: 'Images/Magic/image_1 (22).png', cap: 'Crimson Array' },
    { file: 'Images/Magic/image_1 (25).png', cap: 'Pale Moon Rite' },
    { file: 'Images/Magic/image_1 (26).png', cap: 'Ashen Vortex' },
    { file: 'Images/Magic/image_1 (28).png', cap: 'Dragon Seal' },
    { file: 'Images/Magic/image_1 (29).png', cap: 'Heaven\u2019s Eye' },
    { file: 'Images/Magic/image_1 (30).png', cap: 'Eternal Coil' },
  ],
};

/* ---------- Helpers ---------- */
function src(file) { return encodeURI(file); }

/* ---------- Reveal on scroll ---------- */
function runReveal() {
  const reveals = document.querySelectorAll('.reveal');
  const wh = window.innerHeight;
  reveals.forEach((el) => {
    if (el.getBoundingClientRect().top < wh - 90) el.classList.add('active');
  });
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
          <img loading="lazy" decoding="async" src="${src(img.file)}" alt="${img.cap}">
          <figcaption class="cap"><span>${img.cap}</span></figcaption>
        </figure>`
      )
      .join('');
  });
  initLightbox();
  runReveal();
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
window.addEventListener('scroll', runReveal);
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  renderGalleries();
  runReveal();
});
window.addEventListener('load', runReveal);
