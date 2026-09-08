import { initSpatialGate } from './spatial-gate.js';

export function initCinematic({ images, initLightbox }) {
  initSpatialGate();
  const archive = document.querySelector('[data-archive]');
  if (archive) {
    const filters = [...document.querySelectorAll('[data-filter]')];
    function render(filter) {
      const keys = filter === 'all' ? Object.keys(images) : [filter];
      const items = keys.flatMap(key => images[key].map((item, index) => ({ ...item, key, index })));
      archive.innerHTML = items.map(item => `<figure class="gallery-item" tabindex="0" role="button" aria-label="View ${item.cap}" data-lb-key="${item.key}" data-lb-index="${item.index}"><img src="${encodeURI(item.file)}" alt="${item.cap}" loading="lazy" decoding="async" width="1024" height="1024"><figcaption class="cap"><span>${item.cap}</span></figcaption></figure>`).join('');
      document.getElementById('archive-count').textContent = `${items.length} visions`;
      filters.forEach(button => {
        const selected = button.dataset.filter === filter;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      initLightbox();
    }
    filters.forEach(button => button.addEventListener('click', () => render(button.dataset.filter)));
    render('all');
  }

  // A slight scroll drift gives the panorama depth without capturing scroll input.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const panorama = document.querySelector('[data-drift]');
  if (panorama) {
    let frame = 0;
    const paint = () => {
      frame = 0;
      panorama.style.transform = motion.matches ? '' : `translate3d(0,${Math.min(scrollY * 0.14, 150)}px,0) scale(1.025)`;
    };
    const update = () => { if (!frame && scrollY < innerHeight * 1.5) frame = requestAnimationFrame(paint); };
    addEventListener('scroll', update, { passive: true });
    motion.addEventListener('change', paint);
    paint();
  }
}
