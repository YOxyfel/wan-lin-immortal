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
- Optional cinematic sound, Skip/Replay, reduced-motion support, and automatic replay after refreshing or returning to the top.
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

The awakening was also verified at 320×568 and 667×375, including touch entry, keyboard Sound/Skip/Replay, reduced-motion interruption, refresh, return-to-top replay, and browser Back restoration. Sound starts disabled and requires explicit activation.

## Cinderfall prologue (October 2026)

The homepage opens with **Cinderfall**: one continuous, scroll-driven 3D story built with Three.js. Everything in the
valley is generated in code, with no external 3D assets or paid image services: the timber houses with curved tile
roofs, the props, the pines and bamboo, villagers, Ashen Wolves, the sky, the storm and the fire.

Story beats (scroll position `u`, 0 → 140, see `assets/cinderfall/timeline.js`):

| u | Beat |
| --- | --- |
| 0–10 | An ink drop blooms on rice paper, 玄 is brush-written, the valley is drawn in ink and bleeds into colour |
| 10–36 | Morning in Cinderfall Hamlet, over Wuhen's shoulder: the uncle waves from his herb shop, neighbours greet him, the garrison marches out early |
| 36–46 | The old road: fields, the shrine, the bridge, the mushrooms at the edge of the pines |
| 46–56 | The sky turns: black clouds out of a clear sky, gold and violet lights at war above them, lightning, a light falls into the forest |
| 56–66 | He turns. Dolly zoom on the village in flames, cinnabar ink |
| 66–86 | He runs back through the same street, now burning, to his uncle's door: a hand under the fallen beam |
| 86–96 | The painted close-up and the uncle's last words |
| 96–117 | Six years in ink (the manuscript) |
| 117–133 | Six years later: the ruined street at dawn, the old road, the forest, the oldest roots |
| 133–140 | The scroll. "His story has only begun." → demo |

Code (`assets/cinderfall/`):

- `boot.js`: scroll → `u`, captions, title calligraphy, manuscript, HUD, **Watch** autoplay, sound, fallbacks
- `ritual.js`: the opening as the loading screen (the drop, the sign stroke by stroke, the title), taking turns with
  the story's preparation so every freeze of it falls on a still screen
- `timeline.js`: every keyframe (camera modes, light, sky, fire, ink cuts); edit pacing here
- `engine.js`: renderer, lights, camera director, cast and wolf behaviour, effects binding
- `layout.js`: the road, terrain height, house placements; `world.js` assembles the valley
- `architecture.js`, `props.js`, `vegetation.js`, `terrain.js`, `sky.js`, `people.js`, `beasts.js`, `fx.js`
- `materials.js`: shared materials; every surface can char, glow, collapse (burning night) and break (ruins)
- `post.js`: bloom, grade, ink-sketch / watercolour transitions, painted plates; `ink.js`: the ink overlay
- `audio.js`: opt-in procedural sound; `life.js`: the animated manuscript panels

Assets (`Images/Cinderfall/`) are regenerated with `python tools/gen_textures.py`, `python tools/prepare_wuhen.py`
(Wuhen's over-the-shoulder card from `Images/Prologue/shoulder.png`) and `python tools/glyphs.py` (calligraphy
outlines from Noto Serif CJK, SIL Open Font License). Debug: `?debug=1` pauses the loop and `window.__cf.frame(u)`
renders any story position; `?q=low|high` forces quality; `?motion=off` shows the static story; `?res=fixed` turns off
the resolution governor; `?warm=0` skips the rehearsal during the opening (every look of the story drawn once, unseen,
so nothing is compiled or uploaded mid-story) and `?noforest` the forest build; `?prepstats` times each rehearsed
position on its own, `?trace` records every frame of the opening (both read from `window.__cf.prep`) and `?cold` makes
every shader new, as on a first visit.

The earlier prologue scripts (`assets/prologue*.js`, `village-scene.js`) are no longer loaded by `index.html`.
A copy of the previous homepage is in `../website-before-cinderfall/`. See `cinderfall-review.md` for verification notes.
