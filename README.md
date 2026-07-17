# Wuhen & Xuan: Heaven Defying

A promotional website for **Wuhen & Xuan: Heaven Defying**, a dark-fantasy *xianxia* cultivation action-RPG. A devastating "random" monster attack on a remote village hides a chilling political conspiracy — armed with an ancient scroll holding a trapped Immortal, you must survive the mortal realm, unlock your hidden bloodline, and uncover who ordered the death of your family.

A production by **Oxyfel Games**.

**Live site:** https://yoxyfel.github.io/wan-lin-immortal/

---

## Pages

| Page | Description |
| --- | --- |
| `index.html` | Home — hero, prologue, the scroll trial, character & world previews, demo CTA |
| `world.html` | The mortal realm and the cloud-borne sects — full environment gallery |
| `characters.html` | The protagonist, the trapped Immortal, the uncle, and the Clean-Up Crew |
| `cultivation.html` | The path from mortal flesh to Qi Condensation — the arts & arrays gallery |
| `story.html` | A cinematic, **beat-by-beat** walkthrough of the demo (scroll-snap + auto-play) |
| `gallery.html` | The complete concept-art archive |
| `privacy.html` | Privacy policy — no cookies, no tracking |

## Features

- Cinematic dark-xianxia design (obsidian / imperial-gold / jade / cinnabar palette, Cinzel + Cormorant fonts).
- Scroll-driven reveal animations, a click-to-zoom lightbox, and a self-playing story experience.
- All artwork is local, organized by category under `Images/` (Art, MCs, Environment, Magic, Clothing).
- Responsive layout with a mobile menu.

## Tech

- Static HTML, styled with [Tailwind CSS](https://tailwindcss.com/) (via CDN).
- Shared `assets/site.css` and `assets/site.js` (gallery rendering, lightbox, nav).
- [Vite](https://vitejs.dev/) as the local dev server (hot reload).

## Local development

```bash
npm install   # one-time, installs Vite
npm run dev   # start the dev server at http://localhost:8000
```

Other scripts:

```bash
npm run build     # bundle the site into dist/
npm run preview   # serve the built dist/ locally
```

> A local server is required (don't open the HTML files directly via `file://`) because galleries and the story page load images/scripts through relative paths.

## Deployment

The site is published with **GitHub Pages** (deploy from the `main` branch root). A `.nojekyll`
file is included so Pages serves every asset as-is — several image filenames contain spaces and
parentheses that Jekyll would otherwise mishandle.

To publish changes, just push to `main`:

```bash
git add -A
git commit -m "your message"
git push
```

## Project structure

```
.
├── index.html / world.html / characters.html / cultivation.html / story.html / gallery.html
├── assets/
│   ├── site.css        # shared styles
│   └── site.js         # nav, reveals, gallery + lightbox, image catalogue
├── Images/
│   ├── Art/  MCs/  Environment/  Magic/  Clothing/
├── package.json / vite.config.js
└── .nojekyll
```

---

*Concept art and game design are works in progress for the vertical-slice demo.*
