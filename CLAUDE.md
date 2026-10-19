# Working on this repo

The promotional site for *Wuhen & Xuan: Heaven Defying* (static pages built with Vite, deployed to GitHub Pages from
`main`). Most of the work is **Cinderfall**, the scroll-driven three.js prologue on `index.html`: an 8-minute film
whose every frame is a pure function of the story position `u` (0 → 145), played either by scrolling or by Watch, which
plays it on its own clock (`watchT(u)`, `assets/cinderfall/score.js`).

## Where things are (`assets/cinderfall/`)

- `timeline.js`: the story on one axis: pacing (`PACE`, `PAUSES`, `STRETCHES`, `SLOWMO`), cinema bars, scripted
  lightning (`STRIKES`), captions' and effects' curves. Slowing a passage here lengthens Watch.
- `engine.js`: builds the world and runs each frame: the camera and its shots, the effects, the post passes' uniforms.
- `war.js`: the fight above the clouds: the two fighters' paths, its shots (`SHOTS`), blows (`BLOWS`), bolts (`BOLTS`),
  the great sword, the crescent, the bells, the storm's blade.
- `weather.js` (lightning ribbons, ground strikes, rain), `fighters.js` (the two far lights and their trails),
  `sky.js` (sky and cloud deck), `post.js` (composite: ink, the painted look, bloom, bars), `village-life.js` (the
  villagers), `walk.js` / `walkcam.js` (the walk out), `score.js` (the generated score and its cues), `audio.js`
  (recorded effects and music slots).
- `cinderfall-direction.md`: the house rules (colour is meaning, two kinds of join, at most 3 flashes a second…).
- `cinderfall-review.md`: what each round of review found and what was done, newest last.

## How it is written

- Every visual state is a function of `u`; what runs on the clock (a bolt's flicker, a burst) is keyed to the moment
  the story crossed its cue (`cueAge`). Never key a look to real time alone, or it breaks under scrolling.
- Comments say why a thing is as it is and, in brackets, what it was before and why that was wrong
  ("(…: from behind it stood up off his head as a horn)"). Keep them, and write new ones the same way: they are the
  record of every problem already solved.
- The scene alpha marks what each pixel is for the ink and paint passes: solid 1, leaves 0.97, figures 1.1, flames and
  bolts above 1.25.

## Checking and shipping

- The film is never judged from a few stills: `tools/verify/` steps it on Watch's clock and checks the cut rules
  (`tools/verify/README.md`). A change to anything on screen is checked on frame strips at the film's own speed and by
  a reviewer who has not seen the work being made.
- Before a push: `story.cjs` reports "programs created during the story: none" and no page errors (an `ERR_FAILED`
  line is the offline fonts); `allcheck.sh` reports 0 FAIL; the round's notes go into `cinderfall-review.md`.
- Push the working branch to `main` (`git push origin <branch>:main`); the Pages workflow builds and deploys
  (`gh run watch`). If pacing changed, the Watch times in the music list (a Claude doc) change too.
- Commit messages describe what the viewer now sees, and what was wrong before.

## Care

- Never a bare `git stash` (other sessions share the stash); guard `rm` of a variable path (`"${D:?}"`).
- The cloud container's network is an allowlist: do not route around it; ask for files instead.
- ElevenLabs generations cost the owner's credits: never repeat one to retry.
