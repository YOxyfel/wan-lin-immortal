# Checking the Cinderfall prologue

The prologue (`assets/cinderfall/`, played on `index.html`) is a film: every visual state is a function of the story
position `u` (0 → 145), and Watch plays it on its own clock (`watchT(u)` in `score.js`, about 8:12). Nothing here
judges it from still frames chosen by hand: the film is stepped on Watch's own clock, 30 frames a second, and checked
as it plays. These tools run with Node, Python 3 (Pillow) and Playwright's Chromium.

In the cloud container Chromium renders in software (SwiftShader, 2 cores): a page load to the forest takes 5–25
minutes and a frame a few seconds. Run the long jobs in the background. On a machine with a real GPU set `CF_GPU=1`
(and `CHROMIUM=/path/to/chrome` if Playwright's own is not installed); everything is many times faster.

Every browser tool runs under `serve.cjs`, which serves the repo for exactly as long as the command runs:

```bash
node tools/verify/serve.cjs 8081 node tools/verify/strip.cjs OUTDIR war 960 540 15 180.9 182.7
```

## The tools

| Tool | What it does |
| --- | --- |
| `serve.cjs PORT CMD …` | Serves the repo (with the pages' import map) while `CMD` runs; gives it `SITE`. |
| `strip.cjs OUT TAG W H FPS T0 T1 …` | Frames at the film's own speed between Watch times, on the story's own clock (slowed where `SLOWMO` slows it, so a blow's stop holds its impact frame as the film does); strikes the run home's ground bolts (debug mode turns scripted strikes off). |
| `sheet.py OUT.jpg COLS SCALE frames…` | Contact sheet, each frame labelled with `u` and its Watch time. |
| `cutscan.cjs U0 U1 OUT.json` + `cutrules.py OUT.json` | Every frame's lens, his place and face, the dog, the white of the page; then the cut rules (below). |
| `allcheck.sh TAG [PORT]` | `cutscan` + `cutrules` over every passage that has been cut-checked: the morning and walk, the fight, the run home. |
| `story.cjs URL` | The gate before a push: runs the whole story, reports shader programs created after loading (must be none) and page errors (must be none). |
| `dbgvar.cjs OUT T VARIANTS.json` | One moment rendered once per debug variant (hide a group, zero a uniform) to find what draws an artifact. |
| `probe.cjs OUT PLAN.json` | Several moments, each with its variants and a report (rays from the lens, what is near it), from one page load. |
| `castprobe.cjs T0 T1 [NEAR]` | Everyone in the village against the lens: near passes, and anyone who appears or vanishes in the frame. |
| `lensprobe.cjs T0 T1 [NEAR] [SHARE]` | The world against the lens: every moment a wall, beam or parapet comes within NEAR metres (2.5) over more than SHARE (0.12) of the frame, and what it is. In the ink such a thing is a flat card with a straight edge. |
| `boltlab/boltlab.cjs OUT u…` | The war's lightning alone, from the film's lens, with counts of self-crossings, reversals and straight runs. Fast. |
| `review-section.py NOTES.md` | Puts a round's notes into `cinderfall-review.md` as its last section. |

Watch time ↔ story position: `node -e "import('./assets/cinderfall/score.js').then(m => console.log(m.watchT(52.4)))"`.

## The cut rules (`cutrules.py`)

- No shot under 0.75 s (designed flashes allowed with `--allow U0:U1`).
- He never jumps along the road at a cut, unless the cut is inside a whiteout (the page white ≥ 0.85).
- A cut between two shots of him turns the lens 30° or more, or changes his size by half again.
- The lens never within 0.5 m of him; his face is never turned to the lens.
- He turns no faster than a person (body 180°/s, head 250°/s); his uncle's head likewise.
- Within a shot the lens never whips; the dog never jumps or appears mid-frame.

And by eye, on the strips: nothing pops in or out mid-shot; the lens never passes through geometry and nothing
renders as a flat pane or a smear across it; weapons do not flip; lightning reads as lightning (never wire, cable,
tubes, rods, loops or nets); at most 3 flashes a second, no strobing inside one (`cinderfall-direction.md`, house rules).

## Gotchas

- `?debug` turns the scripted strikes and the storm's own strikes off: `strip.cjs` strikes the ground bolts itself.
- A strip renders only the frames it keeps; a lone speck in a 4-a-second strip can be a cold render, not the film:
  check it against a denser strip before chasing it.
- The war's lightning lives in `war.js` (`BOLTS`, `BLOWS`) and is struck by `engine.js` with the lens of the shot it
  is struck in; `weather.js` draws it. The scene alpha marks what a pixel is for the ink and paint passes (`post.js`):
  solid 1, leaves 0.97, figures 1.1, flames and bolts above 1.25.
- Pacing is `STRETCHES` in `timeline.js`: slowing a passage lengthens Watch, so the music list's times move.
