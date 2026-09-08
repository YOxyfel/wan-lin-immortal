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
- Scroll-triggered awakening: a spatial gate opens, red/gold spirits merge, and a layered realm leads into the story.
- Optional cinematic sound, Skip/Replay, reduced-motion support, and session-aware return navigation.
- Paced story chapters and scroll-driven reveals.
- Filterable 87-image art archive with keyboard-operated lightbox and focus management.
- Nine-chapter concept-art prologue with manual and automatic playback.
- All artwork is local, organized by category under `Images/` (Art, MCs, Environment, Magic, Clothing).
- Responsive layout with a mobile menu.

## Tech

- Static HTML with locally compiled Tailwind CSS and a shared cinematic visual system.
- Shared `assets/cinematic.css`, `assets/site.js`, and `assets/cinematic.js` (responsive layout, navigation, archive, lightbox, and motion).
- `assets/story-cinema.css` gives the nine-chapter prologue its cinematic layout.
- `assets/spatial-gate.js`, `assets/rift-effects.js`, and `assets/gate-audio.js` drive the homepage awakening; imagery remains local.
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

## Cinematic redesign verification

The September 2026 redesign preserves existing routes, lore, art, credits, contact address, and the PC demo's in-development status. The interactive prologue is labeled as concept-art storytelling with spoilers, not gameplay footage.

Verified at 1440×960 and 390×844: all eight pages, local asset loading, horizontal overflow, main landmarks, in-page anchors, FAQ, mobile navigation, gallery categories, lightbox keyboard controls/focus return, and story playback. The story also supports scrolling through complete chapters at 844×390. `npm run build` bundles the shared JavaScript and CSS and retains the dynamically selected gallery/story artwork in the static output.

The awakening was also verified at 320×568 and 667×375, including touch entry, keyboard Sound/Skip/Replay, reduced-motion interruption, session returns, and browser Back restoration. Sound starts disabled and requires explicit activation.
