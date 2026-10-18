# Cinderfall prologue: review notes

Updated 15 October 2026. Implemented locally, not published to the live site.

## What changed

The homepage prologue was rebuilt as a single real-time 3D world driven by native scroll (no scroll-jacking).
The low-poly test village was replaced with a procedurally modelled hamlet: terraced timber-and-plaster houses with
curved tile roofs, eave tiles, ridge ornaments, lattice windows, porches and balconies, signboards (藥 茶 鐵 包 酒 守),
the 烬落村 gate, lanterns, couplets, laundry, herb racks, chilli and corn strings, firewood, jars, a bun stall with
steam, a forge with sparks, the wish tree, well, shrine, bridge, fields, bamboo groves and a pine forest.
Wuhen is the painted back-view art, lit in the scene with a normal map, hair sway, fire rim light, 3D legs and a jointed waving forearm.

Continuity devices: the uncle waves from the same porch he is later trapped behind; the garrison leaves at dawn
("no one asked why"); the light that falls during the storm lands on the giant tree where the scroll is found six
years later; the dropped basket is still at the forest edge in the epilogue; the ruined street mirrors the morning walk.
Every hard cut between worlds hides under an ink flood that lifts.

## The flight (15 October 2026)

Between the mushrooms and the burning valley the camera now leaves him: up through the pine crowns and a well in a
sea of clouds into sunlight, where two cultivators (gold and violet) fight at lightning speed among immortal peaks;
they tear away, the camera dives through the bright cloud tops into the dark storm, where sparks crackle into being
and stream into a vortex under the cloud's base; the knot of light collapses into a great bolt the camera follows
down; it strikes beyond the western ridges (fireball, shockwave, a ring of billowing dust, embers, re-strikes), and a
line of light races home over the land ahead of the camera, back to him at the edge of the pines as day turns to night.

- Files: `sky.js` (sea of clouds as a raymarched surface, peaks, storm dive), `engine.js` (flight path and timing),
  `fighters.js`, `duel.js`, `charge.js`, `mega-bolt.js`, `impact.js`, `cloud-rush.js` (wisps past the lens),
  `ranges.js` / `atmosphere.js` (the light front on the land), `palettes.js`, `timeline.js`, `boot.js`.
- Scroll: the story follows the scroll on a critically damped spring (no jolts when the wheel starts or stops).
- Frame rate: when frames run long and the GPU is the bottleneck, the resolution steps down (and back up when there is
  room). `?res=fixed` turns this off.

## The valley, the bolt and his face (15 October 2026, second round)

- His face is never shown. The mushrooms are seen from behind him and off his right shoulder (the camera follows him
  in off the road and comes round as he squats); the close-up before he runs is now his left hand with the basket
  hooked on its fingers, the burning village beyond; the fingers open, the basket falls and tips, the caps spill,
  and he runs off toward the fire while the eye stays with the basket.
- The great bolt comes down a stone's throw from Cinderfall: on the slope west of the village, before him where he
  stands at the edge of the pines. The camera dives through the storm to the knot of the charge over the valley and
  falls with the leader down to him; it strikes as the camera lands behind him; the light runs over the fields at him
  and past him, embers flying; then a light rises out of the fire and arcs away west over the ridges (where he finds
  it six years later), the slope burns on through the night, and day turns to night. The village catches as the
  shock passes. Captions: "Something fell." / "Out of the fire, a light fled west."
- A real river (its own channel, banks, reeds, rocks, a fall in the west), a stone moon bridge, terraced paddies
  watered by a waterwheel, a farmstead with pens (pigs, goats, chickens, ducks), an ox at the plough, fishermen's huts
  and boats below the bridge.
- The main street: lantern strings across it, tall banners, market stalls (umbrellas, cloth, vegetables, pottery), a
  flagstone way, a south gate; the smith's stall of weapons, each with its aura (stronger on the legendary ones, which
  only he sees), where the walk stops to look.
- Everywhere: reeds, tall silvergrass and meadow grass (three heights), berries on the bushes, butterflies over the
  flower drifts, a roadside pavilion on the climb to the pines, the 古松 signpost and a boundary rope with its 禁 board
  at the edge of the pines, woodcutters' stumps, logs and a split pile.
- Smoothness: shader programs now compile without blocking (the loading screen waits for them; the forest's are compiled
  in its own light before the story gets there); lights never come and go with hidden groups (which recompiled every lit
  material mid-scroll); the forest beyond the ridges is built in stages that wait for pauses in the scrolling; his walk
  no longer drifts backwards while he stands at the edge of the pines.

## Verification

- Headless Chromium with software WebGL (SwiftShader): frames rendered across the whole story at 960×600, 1280×800
  and 390×844; real scroll from top to the demo section; Watch autoplay; wheel cancels Watch; sound toggle;
  `?motion=off` static story. No console errors.
- Production bundling checked with esbuild (three.js and the engine are code-split). The GitHub Pages workflow
  still builds with `npm run build` (Vite); assets are resolved from the page so Vite copies them as-is.
- Load per frame (high quality): about 1.4–2.3 M triangles and 150–600 draw calls depending on the shot.

## Not verified

- Real-GPU frame rate. SwiftShader is far slower than any GPU, so no frame-rate claim is made. Low quality
  (fewer grass blades, smaller shadow map, no MSAA) is chosen automatically on phones and coarse pointers, or with `?q=low`.
- Real phones (thermal, Safari WebGL2 behaviour). Phone framing was checked only in emulation.

## The sky turns, the chase, the blossom, the far forests (15 October 2026, third round)

- The mushrooms to the sky, as one continuous move: he squats and picks one, stands and holds it up before his eyes
  (by its stem in his fist, the cap upright: a real modelled mushroom, cap, gills, stem and a crumb of soil), turns
  it; something flickers in the sky; he turns round to it (the lens goes round behind him, never his face) and looks
  up, the mushroom forgotten at his chest. West-south-west and high over the valley the two cultivators are fighting
  low in the sky, gold and violet, every blow a flash on him and the pines; the birds burst out of the crowns and
  flee across the valley; the clouds wind in round the fight and a deck forms out from under it in three spiral arms,
  dark-bellied, lit at the rims, closing over the valley and putting out the sun, with the eye left open over the fight
  and its light pouring down the eye. The camera rises from behind him, over the pines and across the valley into the
  eye, up its walls after the two lights as they go up out of it, and out over the sea of clouds as the fight fills
  the sky.
  - `sky.js`: the gathering (`uVort`: the cloud wound round the eye, faster close in; the deck formed outward from it
    with spiral gaps that fill), the wide funnel-shaped eye (`uHole.w`), the light of the fight down the eye
    (`uBeam`), a deck that is dark from below at every quality (its whole thickness shades what is under it, not only
    the few hundred metres the light steps reach), the fight's broad glow kept to the eye (`uClashFar`), and the
    sky's jitter smoothed in the upsample so the painted pass never turns it into a pattern of cells.
  - `engine.js`: the staging (pick, raise, turn, look up), the shot round behind him, the flight keys into and up the
    eye, the fight low in the eye then up to the sea, flashes in the forming deck, the birds re-placed.
  - `hero.js` / `hero-pose.js`: something held up before the eyes (`raise`), looking up at the sky (`lookUp`).
- The chase after the light, rebuilt: as the camera comes down off the crag the storm breaks up westward and the night
  turns deep blue and silver under the moon (a palette of its own, `soulnight`), the fires only a red glow behind
  him; the light comes down out of the sky and leads him low over the fields, close enough to light his way: a pool
  of gold moving over the grass ahead of him (the grass bows away from it and catches the gold), a ribbon of its
  light winding back to him, fireflies risen out of the grass all round, the red of the fires on his back and hair.
  The camera runs with him, low and close behind his right shoulder, bobbing with the stride, until the light goes
  up and away into the white. The burning slope where the bolt fell is a ragged burn now, not a disc of flame, and
  the silvergrass plumes are real plumes (they showed as pale cards at night).
- The opening blossom: real petals (a cupped sheet that foreshortens and shades across itself as it tumbles; the
  sakura's outline with the notch in the tip; rose at the claw paling to white, veins; lit through from behind, a
  glint as they flip through the sun; in shade in the street and sun above the roofs), in twisting ropes of wind,
  and a few drifting right past the lens, big, soft and glowing.
- The forests far off: stands of different trees each with its own green (dark pine, blue-green fir, fresh broadleaf,
  bright new leaves) with groves of blossom, white pear and red maple among them; clearer air by day so the forests
  keep their colours far out and the ranges stand along the horizon.
- Polish elsewhere: the plunge through the storm keeps its form between flashes (more frequent flashes, a faint
  light in the cloud, shreds rushing past all the way down); the smoke thins while the crag is seen across the
  valley; the forest air is clearer (the trail, the old wood and the dell keep their greens and the far trees read);
  as the light goes up and away from him at the end of the chase his hand goes up after it.
- Checked: frames across the whole story at 640×360 and 960×540, a phone-sized viewport (390×844, low quality) for
  the new sequences, and the GPU-like NaN audit (pow of a negative base made NaN, as on D3D) over every changed scene:
  no broken pixels, no console errors. Not checked on a real GPU or phone.


## Round 4: the crossing, the six cuts, the way to the dell, the pillar of light

- The crossing from the chase into the forest, rebuilt as one move. The light that has been leading him over the
  fields checks, swells and goes: up off the field ahead of him (the grass thrown flat in a ring of gold where it
  leaves), a comet sweeping across the night sky with a ribbon of gold behind it, over the ridge he is running toward
  and down beyond it. The lens lets him go and falls back low over the slope, looking up after it; he runs on up the
  slope and stops, his hand up against the light, as the sky beyond the ridge takes fire: a dome of gold with slow
  rays standing behind the black ridge and its pines, beams of it through the trees, the cloud over it lit from
  beneath, a beat of gold over everything and a wind over the ridge. The light floods out from behind the ridge until
  the frame is white.
  - On the white page the gold thread is written out of a pale gold sun where the light went down, and the Forbidden
    Forest is painted in its wake in ink, bleeding out from the stroke: far peaks in pale washes with their feet in
    mist, stone pillars standing out of the mist, a ridge of firs, a near slope with an old pine leaning out over the
    void, birds going over (`ink.js`: a shan-shui painting drawn once into a texture, revealed by the bleed from the
    thread; on a tall screen the peaks stand higher and the pine rises from the foot of the page like a hanging
    scroll). "The Forbidden Forest." is written over its mist.
  - The eye goes into the painting where the thread went down into the trees; the page and the white part from there
    like mist (`post.js`: the white can part from a point outward), and under them is the forest itself in colour: a
    winter dawn (`arrive` palette), snow on the pines, long blue shadows, the stone towers in the haze, the gold
    thread going down beyond them, snow falling. The lens comes down through the pines to the clearing as he comes
    out of the trees and sinks down against the boulder. Nothing of the camp is there before he arrives (the first
    shelter and the fire ring appear with the first winter).
- The six cuts, rebuilt as the years themselves: after the first winter at the camp, the pale tree, wide, the camp
  past it; each winter a cut in close to the bark as his knife is drawn down it (the fist on the grip, the blade out
  of the bottom of it, the other palm braced on the trunk, chips of pale wood thrown out into the snow; never his
  face), then out again as he goes back round the tree to the camp while the year turns round it: the snow goes,
  spring rain and blossom, summer, the red of autumn, snow again, the camp growing past the tree (the snares, the
  target, the hut, his uncle's stone, his ghosts at their tasks between). Each cut is a little higher than the last
  (he was growing) and greys over the years; fresh ones are pale wood with a dark seam and the bark torn along their
  edges. The colour comes back as the cuts add up. After the sixth, he stays: the year turns round him to the sixth
  autumn, and his hand comes to rest on the six cuts. "Six years."
  - `forest.js`: the cuts (decals drawn down the bark as the knife goes, marked like figures so the ink keeps them),
    the knife, the chips (a pure function of the story position), the camera (wide / in close / the last), the
    stance; `hero-pose.js` / `hero.js`: carving (`carve`, `carveTarget`, `braceTarget`) and a palm laid flat
    (`palm`); `timeline.js`: `CUTS`, the seasons keyed round them.
- The way to the dell, as shots cut straight from one to the next (no more fading figure, no more racing lens): the
  turn from the tree and the empty snare; he walks away from the lens out of the woods he knows; over the ford, low by
  the water; low behind him down the bamboo; low behind him in the old wood, looking up the giants; close behind him
  as the motes thicken in the air and run on ahead; the rim; the slide. Clearer autumn air.
- The pillar of light, rebuilt as a strike in four shots. As the scroll opens all the way the sign on it blazes, its
  light goes up out of the page and he looks up after it (the lens draws back over his shoulder). Cut: high on the
  dell's side, the great tree across it, him kneeling small at its foot; the dell goes dim and the air stirs, the light
  gathers in the crown overhead (beams of it down through the leaves, the motes streaming up from the page into it); a
  thin thread of light runs down from it to him, and the pillar comes down after it, faster and faster, its head
  white-hot. The instant it lands the frame is struck into two tones (violet-black and white), then one blinding beat
  of gold, the frame shaken, a shock wave bending the image out from where it stands; its ring of light runs out over
  the whole floor of the dell with a low wall of light on it, light runs out over the ground behind it in cracks, a
  flare at its foot, the leaves torn up off the floor and shaken out of the crown, whirled round it and drifting down
  through it, lit gold. Cut: low across the dell, the pillar standing on him, two threads of light winding up round
  its foot. Cut: over his shoulder in its light, down into the page and the sign, the ink and the white coming back
  for the last page. The scroll beat is held (a slow stretch of scroll from the moment he looks up to after the ring),
  and the sound has a rising rush of air, a crack and a deep boom, then the bell.
  - `beam.js` (rebuilt: the thread, the head, the flare, the helix, the cracks, the ring wall, the gathering knot),
    `blast.js` (new: the leaves, a pure function of the story position), `forest.js` (the four shots, his look up,
    the wind on him), `engine.js` (the impact frame, the shock ring, the beams out of the crown, the gust), `timeline.js`
    (`gather`, `pilot`, `beam`, `beamDrop`, `beamRing`, `STRIKE_B`, the held beat, the lens), `audio.js`.
  - Fixed on the way: motes of gold came out pink under the painted pass (the qi motes now pull the scene alpha down
    like the other particles); the crystal's motes and the forest's light shafts wrote 2 into the scene alpha (plain
    additive blending), which the ink pass reads as flame; the pool of light at the pillar's foot grew with its ring
    and washed the last close-up white.
- Checked: frames across the crossing, the six cuts, the way to the dell and the pillar at 640×360 and 800×450, the
  strike also as a strip of 81 frames in story order at 480×270, a phone-sized viewport (390×844) for every new
  sequence, the built single-page preview scrolled through for errors, and the GPU-like NaN audit (pow of a negative
  base made NaN, as on D3D) over every changed scene: no broken pixels, no console errors. Not checked on a real GPU
  or phone.


## Round 5: the smith's stall, the bridge, the old road

- The smith's stall, rebuilt as a weapon-smith's showcase under the porch in front of the forge. Nothing floats or
  stands on its own any more; everything rests on or in something made to hold it.
  - On the left, an arms rack: a sill on carved feet, turned posts, a lower rail with sockets and an upper rail with
    rings, and a crest board of red lacquer framed in gold with its ends curled up into scrolls. Seven polearms stand
    in it (spears with horsehair tassels, a ji, the guandao with its crescent blade, a trident, a staff), each with its
    butt in a socket and its shaft through a ring. In front, a low bench carries a three-tier lacquered sword stand
    with three sheathed swords lying across its cradles, and a hooped tub holds staves and spears that lean the way
    they fall.
  - On the right, the sword wall: a lacquered panel in a wooden frame with a gold bead, under a carved 神兵 plaque.
    Swords, sabres and daggers lie across carved gilt pegs, with tassels hanging straight down, and the crimson sabre
    is at the head of the wall.
  - Before the wall, on a lacquered altar table with everted ends, horse-hoof legs and a red silk runner draped
    over it in folds, the legendary sword lies bare on the upper cradle of its own stand, its scabbard on the lower
    cradle, with a brass censer beside it. Beside that is a table under indigo cloth with a lined box of knives, two
    hand axes crossed on a stand, a dish of arrowheads and a whetstone.
  - The porch has shields on its end posts, a bow leaning against the right post, red banners with gold edges and
    swallow-tail hems hung from arms off the posts, a scalloped red valance along the beam with tassels at its points,
    and two lanterns either side of the way in.
  - Blades are polished steel and fittings are gilt (two new materials, `steel` and `gilt`), so they hold the sky even
    in the shade of the porch. A warm light lies on the wares while he comes up to the stall. The usual porch things
    (strings of chillies, jars, a basket, a bench, flower pots) no longer stand in the middle of the stall; the random
    draws are still made, so no other house changes.
  - The camera at the stall comes in close over his shoulder: the sword on its stand, with the wall of blades behind
    it.
  - Files: `weapons.js` (rebuilt), `world.js`, `materials.js`, `engine.js`.
- The bridge: the road bent at the bridge, so its line met the bridge 2.4 m to one side of the deck and he walked in
  through the parapet. The road now runs straight onto the bridge, up the middle of its steps and off again, easing
  back into its own line within a stone's throw of either end. The deck meets the road where it actually ends, at the
  road's own height, and his height over the deck is taken in the bridge's own frame (`layout.js`, `world.js`,
  `engine.js`).
- The old road: on the way to the bridge the camera is low behind his left shoulder with the fields opening out on
  the left. As he steps onto the bridge it swings round behind him, rises outside the right-hand parapet above the
  water, and looks back over his shoulder upstream at the river valley, the mill and the hills. Off the bridge it
  settles behind him again for the pines. It keeps clear of the shrine by the road and of the lanterns at the bridge's
  ends. The morning sun stays behind his left shoulder until he is off the bridge, so the valley is lit across instead
  of being a glare of haze (`engine.js`, `timeline.js`).
- Checked: the stall from the street, close on each display and through the beat as he stops at it, the old road and
  the bridge crossing (and the run home back over it at night) at 640×360 and 800×450, a phone-sized viewport
  (390×844), the built single-page preview, and the GPU-like NaN audit over the changed scenes: no broken pixels, no
  console errors. Not checked on a real GPU or phone.

## Round 5: smoothness, measured on a real GPU (16–17 October 2026)

The first measurements on real hardware (an RTX 4080 Super at 3440×1440, Chromium on Windows, driven from the browser
pane): the GPU spends 5–8 ms a frame across the whole story, so neither resolution nor the scenes' weight was the
problem. The lag was freezes: 7 s of them during load, then 0.1–0.6 s at a time at nearly every key moment the first
time through (the storm, the end of the chase, about 6 s in all over the forest). They are first-use costs: on
Windows the driver compiles a program again for each way it is first drawn, textures and buffers go up on their first
draw, and the forest was built in the pauses of the reading, so it ran the moment the reader stopped scrolling.
Running costs found on the way: the environment light was rebuilt about four times a second while the story moved,
each time into a new render target (every lit material then re-checked its shader) with a backdrop material that
was compiled, used once and deleted; the seal's brush strokes each carried an SVG turbulence filter re-run every
frame of the writing; the captions revealed through a CSS blur and an animated mask; the ink canvas was hidden and
shown around every drop and flood.

- Getting ready (`boot.js`, `engine.js` `warmUp`): a short loading screen while the valley is built and its programs
  compiled (an ink dot breathing where the first drop lands, animated by the compositor so it stays smooth while the
  page works, and a hairline of progress). Then the curtain lifts and the opening plays (the drop, the sign written,
  the title) with nothing heavy running. Then, under the finished title, the forest is built (its stages a frame
  apart) and every look the story takes is rehearsed: 96 positions from the timeline, each drawn twice a moment
  apart (so strikes and bursts have their shapes) at a small size (what is paid is per program, texture and buffer,
  not per pixel), with frustum culling off at ten of them so every mesh is uploaded, not only those in view, and a
  GPU fence every twelve positions and at the end, so nothing is still compiling when the story starts. The hint
  under the title reads PREPARING THE STORY over a line of progress until then; a reader who scrolls meanwhile is
  taken straight to where they are. The world canvas stays unseen until it is done. `?warm=0` skips the rehearsal,
  `?noforest` the forest.
- The environment light (`sky.js`): rebuilt in place, the generator's own steps into one render target, camera and
  backdrop kept for good (three 0.180.0, pinned). The bow in the hunt keeps its seven drawn shapes (`relic.js`).
- The seal (`ink.js` `writeGlyph`): for each stroke a map of where it is first reached is computed once, roughened
  once by the same turbulence, and the writing is a threshold of those maps (one cheap colour filter, only on the
  stroke being written; finished strokes are plain images). This also fixes the sign itself: each stroke's filter
  region had been taken from its centre line, which cut the strokes off, so the top bar of 玄 was never written and
  its dot was a sliver. Now the whole sign is written, with the brush's rough edge on the strokes and a clean outline.
- Captions and title (`cinderfall.css`): written in from the left with a clip and a fade, no filter and no mask.
- The ink canvas (`ink.js`): stays in the page; with nothing to draw it is cleared once and left.
- The frame-rate governor (`boot.js`): reads the GPU's own time (timer queries on one frame in four, the disjoint flag
  once a batch) and lowers the resolution only when that is over budget; stalls never count. Guessing from frame
  intervals, it had cut the resolution to 60% on a desktop whose GPU had ten milliseconds to spare.
- Checked headless (software GL): no console errors; no shader program created after the rehearsal anywhere in the
  story; the seal written stroke by stroke and whole at the end.

### Round 5, second pass: the shaders themselves (17 October 2026)

Measured again on the same desktop, the first version of the rehearsal took 66 s, in single blocking tasks of up to
15 s. Compiling each of the page's 375 shader programs again, alone and uncached, put a number on the cause: 80 s in
all, 0.39 s for each lit material (its fragment shader is about 90 KB: three writes out the lighting for every light in
the scene, 14 to 18 point lights here). That is the lag of a first read, wherever it falls. What made it so many:

- Light counts. Lit programs were compiled for 14, 16 and 18 point lights. The forest's camp fire and the scroll's
  glow live in the forest's group, so entering the forest changed the count and everything there was compiled again;
  and the forest's preparation compiled it group by group, which makes three count a group's own lights twice
  (18, a count that never happens: 49 programs, 21 s). Now two stand-in lights are in the scene from the start; once
  the forest exists its two lights are bound to them (`engine.js` `anchorLights`, synced before every frame, dark while
  their group is hidden), so the count never changes; and the forest is compiled with the whole scene, once.
- Duplicates. 69 programs had byte-for-byte the same code as another (22 s): each kind of tree and plant was keyed by
  its name (pine bark, maple bark, fern, bamboo…) though most differ only in uniforms, and each grass clump by its
  head colour (a uniform). Vegetation is now keyed by the code it generates (its transformation run over three's own
  shader template and hashed, `flora-core.js` `codeKey`), clumps by nothing (`decor.js`).
- Order. The valley's programs are started as soon as it is built and compile in the browser's threads while the
  opening plays (they are not asked about meanwhile: each question is a round trip to the GPU process). The rehearsal
  draws each position instead of asking three to compile "the scene" for it, which prepares every material, seen or
  not, for that position's light: 593 programs before, against the ~370 a read used.
- Checked headless (low quality): 13 point lights at every position from the opening to the strike, one light count in
  every program, 256 programs (252 distinct) for the whole story against ~370 before.

### Round 5, third pass: the opening is the loading screen (17 October 2026)

Measured in the browser pane on the same desktop (RTX 4080 Super, Chromium on Windows, a 144 Hz display), with each
step timed (`?trace`, `?prepstats`, `window.__cf.prep`; `?cold` makes every shader slightly different, so that no
cache in the browser or the driver knows any of them, as on a first visit).

- The opening plays while the story is prepared (`ritual.js`, `boot.js`). While the page loads, the ink dot breathes
  where the first drop will land. The drop falls and blooms while the valley's shaders compile in the browser's own
  threads. Then 玄 is written stroke by stroke at a brush's pace (slower into each turn and pressed there a moment),
  then the title, the stamp pressed, and the line under it. Each beat waits for its share of the preparation, and the
  preparation waits while a beat plays, so all of the freezing work (the forest's build, the rehearsal's first draws)
  falls in the still moments between beats, where it cannot be seen. When the work is ahead, the brush quickens. The
  line under the title reads PREPARING THE STORY over a line of progress until the hint takes its place. **Replay**
  plays the opening again, a little quicker. The bloom and the drops are placed and sized by each sign's own box, so
  the two agree on any screen. On phones the sign is a little smaller, inside its bloom.
- Found on the way: the shaders compiled ahead were compiled for the canvas, but the scene is drawn into the post
  pipeline's target, for which three uses no tone mapping and linear output, so they are different programs. All 133
  compiled ahead went unused, and the 161 the story draws were compiled during the rehearsal, each waited for on the
  page's thread (20 of the rehearsal's 23 s). They are now compiled for that target (`engine.js` `onTarget`): 165
  programs in all, 29 of them (shadow-pass variants, two late materials) made during the rehearsal.
- Lights: the story's point lights (eight fires, the house, his face, the crystal, the blade, the crag, the camp fire,
  the scroll) are no longer seen by three. Each frame the five (four on low quality) that light the view most, by
  three's own falloff at a few points along it, are copied into five pooled lights, which fade as they swap and are
  set at once at a cut (`engine.js` `syncPool`). Every lit program is compiled for five point lights instead of 13–16.
- Shading: world materials use a lighter direct light (normalised Blinn-Phong with Schlick Fresnel instead of GGX);
  the sky's image-based light is unchanged; the hero, the villagers, metals and the special materials keep three's own
  (`materials.js` `liteAll`). Side by side with the previous version at nine positions, the look is the same.
- A shader's first draw on Windows, measured alone after its link: 115–120 ms for the hero's skin (150 ms before, with
  16 lights), about 70 ms for a lit world material, a few ms for the rest; links take 0.2–0.75 s in the browser's
  threads. After one draw, the same code costs nothing again in that session.
- Result, first visit (`?cold`): ready at 31 s (59 s before); revisits about 25 s. In the first-visit run every beat
  of the opening played with no frame over 14 ms; in the other runs only two or three frames reached 21 ms, as the
  world first appears under the hint. The pauses between beats were 0.3–3.6 s. After that, a pass through the whole
  story created no program; the GPU's own time per frame at 1564×1272 was 3–10 ms.
- Also: a hidden page holds back image decodes, so the sign's maps no longer wait on them (`ink.js`); a finished
  stroke is shown by switching between two images rather than swapping one's source, which left it blank for a moment.

## Round 6: cinema (the launch, the shadow play, the bars, the clock)

Direction plan v2 (`cinderfall-direction.md`) came out of a stress test of plan v1 by four separate reviews (a director
and cinematographer, a donghua storyboard director, a real-time technical director, a muted first-time viewer timing
what can be read at scroll speed). This round builds its foundations and the first of the owner's three asks.

- **The story's own clock** (`timeline.js` `SLOWMO`, `boot.js`): slow motion is real now. In a slow-motion beat
  everything that moves by the clock (fire, rain, hair, sparks, flashes, the fight) slows with the camera; the grain on
  the lens stays on real time (`post.js` `uGrainT`).
- **Cues fired on crossing** (`engine.js` `cueAge`): flashes and flares that must last a set time fire when the story
  crosses them going forward and then run on the clock, so a reader who stops is never left on a lit frame and one who
  arrives by a jump never sees them.
- **Flash safety**: no strobe inside a lightning flash any more (the 12–14 Hz flicker is gone), and the dive's flashes
  at most about two and a half a second.
- **The cinema bars with frame breaks** (`post.js`, `timeline.js` `BARS`): drawn in the final pass, warm ink-black,
  thinner on a tall screen. What is marked in the scene alpha as breaking the frame (3 and up: lightning cores, the
  rain when it is tagged, `weather.js` `setTag`) passes over them, and the glow of the brightest things bleeds over
  their edges. Used at the launch (in through the held breath, gone in one frame at the breach) and the dive and strike.
- **The launch** (47.4–49.0, about two screens of scroll, `engine.js` `flightPath`): the forest holds its breath (the
  clock nearly stops; the caption now says so); the storm's eye breathes in and his hair lifts; the lens draws back
  behind the pine over the mushrooms, lifts with a look down at him, and bursts up through the edge of its crown with
  the flock that was perched in it (the bird burst moved here from 46.2). Up toward the eye, into its ragged mouth (one
  flash of lightning in the wall, fired on crossing), up the well along its wall, which is calmer and sheer while the
  eye climbs it (`sky.js` `uWell`), slate low down and lighter higher, the light inside the well lower
  (exposure 0.56 of the beat's). Rain all the way up, drawn out into streaks by the eye's own speed; small shreds of
  cloud whipping past the lens.
- **The shadow play** (`puppets.js`, `sky.js`): under the first sheet across the well, the lens nearly stops, and the
  war is first seen as two giant shadow puppets on the cloud screen lit from above: the gold cultivator with his sword,
  the masked one of Fen Tian Zong with his glaive (the sect's peaked hood, mantle and iron mask, the violet eye slit),
  each ringed by its own light, their cut-outs burning gold and violet. The glaive comes down on the sword; a flare
  where they meet (fired on crossing); the gold one is driven back; and the lens bursts up through them all. Drawn on
  a canvas at load (no images), jointed at the shoulder like real puppets, read once per pixel where the ray meets the
  screen, so they stay crisp however obliquely they are seen.
- **The breach** (48.468, `SILENCE`): out of the last, gold sheet the white becomes the white of the page; in the same
  frame the shake, rain, shreds, bars and roar stop, the clock slows to a sixth, the page's own furniture draws back,
  and the sea of clouds settles out of the white; the lens tilts down to the horizon, the fight high off to one side.
- **Phones**: the Watch and Skip buttons were hidden on phones by an older stylesheet rule; fixed.

## Round 7: the six winters and the walk out (17 October 2026)

- **The six winters, rebuilt** (`years.js`; 112.3–124.6, about 48 s in Watch). Each winter ends at the pale tree: he
  lays his left palm on his crown, brings it forward level until his fingertips meet the bark, and draws his knife
  across under them. The marks are his height, so they climb the bark as he grows (`MARK_AGE`, from 1.72 m to
  1.81 m): a ladder, the same close lens on it each year, seen from just below the palm so the mark is never hidden
  (a lens from behind his head could not see under the hand). The hero gained a measuring arm (`hero-pose.js`
  `measureArm`) and a level score with the knife held out of the thumb side (`carveArms` `'across'`).
- **Year one** is one slow pan across the camp from the boulder to the tree, a season to each thing he does: huddled
  by the fire in the snow; gathering the first green; shaping a bow from a stave stood upright before him; his first
  arrow, wide of the target (it stays in the ground for three years). The figures come and go as ink dissolves, never
  two of him solid at once. (Plan v2 asked for solid figures in the handscroll manner, but with one season for the
  whole scene several solid figures would all be in the same season; the dissolve is the medium's own join.) The
  archery target moved to the far side of the camp (`forest-set-terrain.js` `TARGET`, `RANGE`) so the arrow is seen
  from behind him; the drying rack moved out of the pan's way.
- **Years two to five**: a moment of the year and then the mark, cut from one to the next, faster each year (a hare
  in his snare by the stream; the roof beam carried to the hut as it goes up; the arrow into the heart of the target
  from where he missed; push-ups in the rain by the training post). Colour seeps back into the camp year by year.
- **Year six**: he walks across the camp he has built to the tree in real time while the whole year passes round him
  (snow, green, red), the sixth mark in the first frost, his palm laid flat on the six ("Six years."), and he turns
  for the way out.
- **The walk out as a stride-cut** (`forest.js` `STRETCH`; 125.9–130.45, about 15 s in Watch): the lens locked at his
  hip behind his right shoulder on a long lens (30°), his walk locked to the story; on the heel strike that ends a
  stretch the world cuts to the next while he walks on in the same place in the frame (the camp's woods, the ford
  with the water under his feet, the bamboo, the old wood and its giants), three strides to each, then two, then one,
  the sun coming round from behind him to low gold ahead. On the next heel strike nothing changes: a mote of gold
  crosses the lens, he stops and looks after it, and the lens leaves him for the first time, rising up the giant
  beside him as the qi begins. The mote is the only new shader program, rehearsed at 129.8.
- **Captions**: "Every winter, he measured himself against the tree."; the static story text matches.
- **His uncle at his door** (9.6–19.6, `engine.js` `MORNING_SHOTS`): the crane now comes down to the herb shop's porch,
  where the old man stands in the doorway with the basket (the dying uncle's own figure, standing: `hero-elder.js`
  `standPose`). Over the boy's shoulder, his face in the morning light, held for about three seconds (the only face
  the film holds on); close on their hands as the basket passes from his to the boy's, both on the handle for a
  moment; wider as he points up at the sun ("Home before dark."); the boy goes down into the street. His height has
  been marked on the door frame every year since he was small (eleven marks on the right-hand post), the rhyme of the
  marks he makes in the forest. The villager figure of the uncle on his bench appears only after the boy has gone.
- **The last words** (85.0–92.2): one locked setup over the boy's shoulder down onto his uncle's face, turned up to him
  on the floor, their hands between them; pushing in slowly while he speaks. As the old man's hand falls the story
  clock all but stops (the fire and the embers hang) and the tear lands where their hands met (`metrics.tearUV`).

## Round 8: the score (17 October 2026)

- **A score generated in the browser** (`score.js`, mixed in `audio.js`; plays only with the sound on). Nothing is
  recorded: a guzheng (each string a delay line plucked a seventh of the way along, tuned to within a cent, the left
  hand's presses, slides and vibrato, harmonics, tremolo, sweeps), a dizi with its membrane's buzz and a xiao, a choir
  (voices drawn through the formants of a, o and u for bass, tenor, alto and soprano, three singers a note across the
  stereo), taiko and war drums, an opera gong whose pitch falls (or rises, at the pillar), bells, drones, a hall.
- **Themes**: his uncle's, in D major pentatonic (the guzheng's own tuning). It is stated whole at the door over his
  face, ends open on the fifth, and is brought home only on the first page. The boy has his own tune on the dizi in
  the street; the dread is the one note outside the scale (G sharp, a tritone from home: the smith's iron, the pines,
  the burning, the crag); sorrow is the same notes centred on B (the gate, the night after). What fell from the sky
  has a motif of four harmonics: its light fleeing west, the mote, the dell, and at the pillar it meets his uncle's
  theme in the bells.
- **How it follows the scroll**: drones and pads follow the story position both ways; melodies start when the story
  crosses their cue and then play at their own tempo, so a reader can stop to read and the music breathes on (one
  melody at a time; one arriving as another ends waits for it); sounds locked to the picture fire as the story
  crosses them: the launch's drums at each stretch of the climb, the clash of blades on the shadow screen, the three
  sheets, then the music stops dead with everything else at the breach; every blow of the duel above the clouds (the
  engine reports them: `metrics.blowN`), heard muffled through the clouds from the ground, in full over the sea; the
  dive's roll accelerating into the strike under a swell drawn in toward it; a drum on each bolt into the ground on
  the run home; the years as a music box the scroll turns (the first year the whole theme, its last note the first
  mark; each mark after a string higher); a drum on every heel strike of the walk out, a new chord on each cut of the
  world, and on the missed beat, nothing but a bell.
- **The soundscape, brought up to the story**: the hunt's old cues at 129–131 (the bow, the boar, the ground giving
  way) played over the walk out and are gone; footsteps now fall on his own heel strikes (`metrics.step`) instead of
  the scroll's speed, leaves in the forest; the heartbeat at his uncle's side stops as the hand falls; the falling
  star and its impact have their sound where they now are (54.0, 54.42); the hum of what fell is in D; the streams
  run; no birds on the morning of the sixth autumn. Everything is scheduled on the audio clock (no timers), so the
  whole of it can be rendered offline.
- **Checked by rendering, not by ear**: the Watch path rendered offline (`_score-check.html`, not committed; an
  OfflineAudioContext stepped every 20 ms with the duel's blows from `duel.js` on the story clock): no clipping (a
  limiter at the end of the chain, peaks at about −1 dBFS at the strike and the pillar), quiet passages around −30 dB,
  the breach silent to −64 dB but for the one high A. The site with the sound on stepped through the morning, the
  launch, the duel and the walk out without an error. How it sounds has to be judged by listening.

## Round 9: the director's final cut, the dive's chase, the omen (18 October 2026)

- **Protected passages** (`timeline.js` `PROTECT`, `boot.js`): a flick of the wheel can no longer carry the story
  through the held breath and the launch, the dive and the strike, the burning, the last words, the six winters, the
  walk out or the call faster than three (four) times the Watch pace, nor through any held moment; the story plays on
  after the wheel stops until it is where the reader is. A reader who gets three screens ahead in one (two in a held
  moment or the burning) is caught up through a flood of ink from the middle of the page (a quarter of a second in,
  half a second lifting), and for a moment after that nothing is held back. Simulated at 60 fps: a flick of 1.2
  screens into the launch plays it out over 3.5 s; four flicks of 0.6 screens in a second play the whole launch at the
  cap; a fling of four screens is carried over it by the ink; a screen a second through the last words reads every line.
- **Impacts and flashes fired on crossing**: the strike's two-tone frame and the pillar's flash now fire when the
  story crosses them and run on the clock (a few frames), however fast they are crossed; the duel's blows throw
  lightning no more often than about three times a second (no strobe in a flurry).
- **The cinema bars at the crag and the call** (`BARS`): in as the masks are seen (the violet bolts break over them),
  gone as he runs after the light; in as the air begins to rise toward the light (the pillar's glow bleeds over them),
  gone as the page comes.
- **The dive's chase** (`engine.js` `SMASH`, `GOLD_FALL`): the duel stays in front of the lens until the violet one
  smashes the gold one down (52.47, an impact frame, the flare and its ring; the smash is the score's too); the violet
  one is torn away and fades; the lens tips over and chases the gold light down through the storm (its head and its
  trail falling, the cloud lit warm round it), the rain rising past the lens, the lightning reaching for it three times
  (violet, fired on crossing), until it goes into the knot of the charge, which becomes the bolt's leader. Inside the
  storm the exposure is held down and the light's glow in the cloud kept low, so the falling light and the lightning
  are what is seen, not a white haze.
- **The omen** (`forest.js` `OMEN`; the snare beat lengthened with a stretch, 124.7–125.9): a frost that morning; his
  prints pressed dark through it as he walks out to the snare, and once, from straight above, the frost, the trail of
  his prints and the empty loop — not one other track — under "No game near the camp that day. Not one track." The
  frost goes as he sets out on the walk.
- **Act 01 on a long lens** (`engine.js` `lng`, `timeline.js` `cam.fov`): down the street to the gate the lens follows
  from about five metres on 29° instead of 1.6 m on 50°, the lanterns and roofs stacking up beyond him, him a third of
  the frame; the street plays a fifth quicker (`STRETCHES`, either side of the held moment at the smith's).
- **The old road and the bridge on a long lens** (`engine.js` `ROAD_SHOT`): 32° from farther off; the mill, the river
  and the fields beyond him stack up behind him, him small in the corner of the land.
- **The smith's stall teaches the colour rule** (`fx.ink`): for one beat, while his eyes are on the blades, the world
  drains to ink and only their light stays gold.
- **"Something fell."** is big, centred and held (a held moment on its line, `PAUSES` 54.62).
- **No dolly zoom** (cut in plan v2): as the burning is revealed the lens holds still on a long lens from farther back
  while the ink climbs the world toward him, until the only colour left is the mushrooms in the basket in his hand
  (a colour reveal on the basket until his fingers open).
- **The run home is the morning rewound**: at the gate the lens is where it stood that morning as he went out under
  it, on the same long lens, looking out the same way; he comes at it out of the dark through the burning gate, the
  wolf at the gate snarling (a stretch gives it two seconds of Watch). The wolves' eyes are violet now (the sect's colour).
- **The door**: a wolf's sooty prints up the porch beside his way, over the sill and in toward the room, fainter as
  they go; at the door his eyes go down to them first (the held moment pushes in on the threshold), then up into the
  room to the man under the beam. The height marks on the door frame are one mesh now (as are the prints).
- **The soul's touch**: as his uncle's soul rises out of him its breath lifts the boy's hair, once.
- **Captions, readable under the scroll as well as in Watch** (`watch.js`, `timeline.js`): a line now fades in and out
  on the scroll axis (a sixth of a screen at most, a quarter of its span at most), the brush writing it in a little
  longer, so a short line like "Something fell." reaches full strength however its story is paced (it never did
  before). The lines that went by in a fifth of a screen are given scroll to be read in (stretches under them, longer
  holds on "Then the forest held its breath." and "Something fell."): every line but three now stays at full strength
  for about half a screen of scroll or more (the three: 0.38–0.45). Watch gives that scroll back where it was added only
  for reading, and slows instead while a line is up for as long as it takes to read it (at least 1.2 s and 60 ms a
  letter, written and at full strength). The captions and Watch's pace now live in one module that the score reads
  too, so the music box keeps time with Watch however it slows. The scroll is about 58 screens; Watch about 7 minutes.
- **Blood recognition** (滴血认主; `forest.js`, `scroll-crystal.js`, `hero.js`, `ink.js`): kneeling closer, he bows
  over the crystal and holds his right hand out over it, palm down; cut in close beside his hand: a drop of his blood
  gathers under his palm and falls, in the held moment, onto the crystal, which rings the sign's four notes and cracks
  from where it landed, his blood seeping into the seams like ink in water, red behind the gold running ahead; cut out
  as it breaks. The last drop of the film is his blood too: it falls where the first drop fell, blooms red, darkening
  to ink as it spreads, and the sign is written in gold inside it. (The tear and the last drop no longer fly up from
  below the page before they fall.)
- **The last line answers the title**: "Every life begins somewhere." … "His began here." (it was "His story has only
  begun.")

## Round 10: a fresh-eyes review, and what came of it (18 October 2026)

A reviewer who had not seen the work watched it as contact sheets (a frame every 6 seconds of Watch) and was asked for
the weakest moments. Its findings, and what was done about each:

- **"No wolf can be made out in any frame", so "Those were monsters" points at nothing.** Cut in on the wolf waiting
  inside the gate, from where he is running at it: its head, snarling, its breath at its fangs (`engine.js`
  `WOLF_IN`).
- **Entering the house had no establishing shot** (a dark void, then his back in colour with the head cut off). Now,
  from the prints at the sill, the cut is to the room from inside it, low beside his uncle's head: the old man's hand
  in front, the boy in the doorway beyond, the held moment on him; he comes in, the colour comes back into the room
  with him, and he runs to him; cut back behind him as he kneels (`REVERSE`).
- **The last words were one still for twenty-four seconds; the hand falling and the tear were tiny.** The locked
  setup stays (the plan's choice), but as the hand falls the film cuts in on the same line, close on their hands: the
  old man's slips out of the boy's and the tear falls onto them in the frozen moment (`HANDS_IN`; the tear lands where
  the hands are).
- **The dropped basket read as a blood splash, then as a ball with two figure-eights.** It is the last colour now
  (see below), it falls with its handle and its mouth toward the lens, and the caps that spill are mushrooms (a cap and
  a stem each).
- **"He followed the light west" was over an empty frame.** The line now sits on him running after the light, the
  fires behind him.
- **Captions white on white, grey on grey.** Every line has its own soft wash behind it (dark under light words, paper
  under ink words).
- **The smith's gift was a smear.** Cut in on the one blade that burns, while the world is ink and only its light is
  gold, the line on it (`SMITH_IN`).
- **The war: the lights never read as people.** A figure is drawn dark inside each light (flying head first, robe and
  sleeve streaming, the blade ahead); small, but there on a large screen. The inside of the storm in the dive is
  darker, so the falling light is what is seen.
- **The crag: dark lumps, no masks.** The sect's light now stands in front of them, toward the village, so the iron
  masks catch it.
- **"Floating red discs".** The cinnabar flung across the page is fewer, smaller drops drawn out along their throw.
- **The end: the gold strokes began outside the drop.** The sign is written once the bloom is wide enough to hold it.
- **The run home was a game camera.** Down the street it is the morning's long lens again, the burning street
  stacking up beyond him.

Not done from the review: more coverage of the last words, people (not lights) in the war, a reframed crag with the
village below, the crystal's establishing shot.

### Also in round 10

- **The untended bell** (`engine.js` `gateBell`, `ink.js` ripples, `audio.js`): an alarm bell now hangs under the gate's
  beam, still in the morning as he goes out under it. The night the village burns it swings by itself, nobody at its
  rope, and tolls at one end of each swing; the toll you hear is that bell's (it was a timer with nothing to see), and
  where the bell is in the frame each toll sends a ripple of ink out across the page.
- **The last colour** (the ink climbing the world): the colour that shows through the ink at the basket in his hand is
  now the size of the basket on the screen, however near or far (it was a small fixed spot), the mushrooms he picked
  are in it, and it is lit a little from within while it is the only colour left, so it reads as colour rather than
  as a dark stain.
- **Where it is slow, on your machine** (`boot.js`): `window.__cf.perf()` reports the frame time by story position;
  with `?perf` in the address the current frame time, GPU time and resolution show in a corner as it plays, with the
  slowest moments so far.


## Round 11: the burning seen, the crystal established, the walk in profile (18 October 2026)

The reviewer's frames in round 10 were 640×360, which is the phone layout (`max-width: 700px`): some of what it saw
was the phone layout on a short screen. Every check this round is at 800×450 (the desktop layout) unless it is a
phone check.

- **"Cinderfall was burning." is seen** (`engine.js` `BURN_IN`; `timeline.js` `BARS`, `inkKey`): it was over the back of
  his head and a murk of ink washes, the village a few sparks behind a black slab. Now, as the ink falls, the film cuts
  to what he sees: the village below on a long lens from the edge of the pines (17° closing to 16°), its roofs and its
  gate drawn in ink, its flames vermilion on them, letterboxed (the bars snap in with the cut, and the flames and
  embers go up over them); the ink climbs out of the village over the whole picture, a little lighter than elsewhere
  so the roofs are drawn, not drowned. The line is written in red on the paper below the village. Then a cut back to
  him, low at his side: the basket in his hand the last colour, the village burning beyond.
- **The black slab was the old pines' signpost** (`roadside.js`, `world.js`): its dark board, a hard-edged black block
  beside the line in the ink. It is not there the night he stands beside it.
- **A line keeps the hand it was written in** (`boot.js`): a caption no longer changes from light-on-dark to ink while
  it is up ("Cinderfall was burning." began white and turned red halfway; "Six years." the other way).
- **Over the cinema bars the header and the HUD are light on their black** whatever the picture between them.
- **Flames are never cut off by their cards** (`fx.js`): a flame's shape could run past the side of the card it is
  drawn on, which cut it off in a straight edge (the burning roofs read as glowing rectangles). It now fades out before
  the card's sides and top, however it wobbles.
- **Silver hair at night** (`hero-mat.js` `uHairAmb`, `engine.js`): his hair took so little of the night's light that
  it read as a dark blue mop. While the night is in colour (before the ink, and in the fields after the light) it takes
  three times the sky's light, and reads silver.
- **The crag** (`engine.js` `getChoreo`, `sect.js`): from the light over the roofs the eye stays on the crag (a dark
  pillar, the violet of the array on its crown) and narrows on it; then a cut to the crag itself, near enough for the
  masked ones to be people on the crown, and in on the leader (it was a minute-long flight in from a murk of smoke and
  embers). Their banners stand at the back corners of the crown now: over their shoulders, the village burning below,
  no pole splits the frame.
- **The last words** (`engine.js` `WORDS_WIDE`, `timeline.js` `inkKey`): one locked setup for twenty-four seconds read
  as a still. On "Forget this place. Forget me." the film cuts to the place: high over the two of them, the beam
  across him, the boy on his knees, their hands joined, the room fallen in round them; then back in on his face for
  the last line, and the hands as it falls. The house and the room are drawn a little lighter in the ink, so the
  porch, the door and the room are drawn, not lost in black.
- **The night in the fields is night** (`palettes.js` `soulnight`): it was lit like a blue day (vivid green grass).
  Darker sky light and exposure, less colour: the light he runs after is the warm thing in the dark.
- **The crystal, waiting** (`forest.js` `CRYSTAL_IN`, `TOUCH_IN`, `forest-set-wood.js`): under "What fell from the sky
  that night had waited for him." the film was on the tree, the crystal a glow at its foot. Now, on the line's second
  half, it cuts in low among the roots behind the crystal: the crystal in front of the lens, the rolled scroll inside it,
  his feet coming to it across the leaves (never his face: "hands are his face"); cut to behind him as he kneels. The
  blood insert's lens was among the crystal's points, which crossed the frame as glass sheets; it now looks down onto the
  crystal's face from over his left side, his hand held out over it. No leaves lie on it or close round it, where his
  blood falls (red on red would be lost), and the gold motes round him thin while it is close.
- **The walk out** (`forest.js` `strideShot`): the stride-cut was from behind his shoulder (the back of his head,
  centred: "a game walkthrough"). It is now well round to his side and behind him on a long lens, he in the right third
  walking across the frame, the way ahead open on the left, the world cutting behind him at each stride. (A full profile
  read best as a picture but showed his face, which in profile reads as an old man's: the film never shows it. 55° round
  from behind him: at 40° he walked away from the lens, at 72° his cheek began to show.)
- **A phone held on its side** (`cinderfall.css`): the phone layout sized the sign by the screen's width only, so on a
  short, wide screen the sign ran off the top of the page, the title under it off the bottom, and at the end "THE DEMO"
  printed over the sign and its line. Sized by the height too now: at 640×360 the sign, the title and the hint fit, and
  the last page's line sits clear above "THE DEMO".
- **The pillar is the bolt inverted** (`forest.js`, the plan's unfinished item): the pillar of light came down in a
  wide from high on the dell's side, where he could not be seen. It is framed now as the great bolt was framed the night
  it fell: low behind him, him small and kneeling at the foot of the frame, the great tree up the middle, a column of
  light down the middle of the frame onto him where the bolt was (silent, warm, everything rising).
- **The wolves' eyes are violet** (`wolf.js`): the village's wolves had orange eyes, the colour of the embers all round
  them, so in the ink, close on the wolf at the gate, they were two more sparks. Violet is the sect's colour and only
  theirs (the array on the crag, what is left in the ink): the beasts are theirs.
- **The 福 is not on his head** (`engine.js`, the morning's third setup): over his shoulder as the old man points at the
  sun, the red diamond on the door leaf sat on the crown of his head. The lens is a little to the right of him now, so
  it hangs on the door between them.
- **The forest's first morning is cold** (`palettes.js` `arrive`): it came in gold-pink, a postcard of a winter dawn.
  The sun is low, pale and cold through more mist; the shadows blue, less colour: the place is forbidding.
- **The bell's ripples are brushed rings** (`ink.js`): they were drawn circles, an even line all round. Each ring is
  broken now where the brush runs dry, heavier where it presses, and grows in from nothing instead of starting full.
- **The cinnabar drops are flecks** (`ink.js`): the biggest of them were red discs floating on the picture. No drop is
  big enough for that now: flecks and short throws.
- **The boy is black in the doorway** (`post.js` `uFigSil`, `engine.js` `REVERSE`): the cut to the room from inside it
  was meant to hold on him black in the doorway against the burning street, but the ink draws every figure on paper
  with its features, so his face was drawn there, and in colour, as he ran in, it was lit at the top of the frame. The
  film never shows it. For that held moment the ink fills the figures in black (him in the door, the old man's arm in
  front); as he comes in the lens tips down with him to the old man, so the colour coming back finds his legs, not his
  face.

## Round 12: the war, the cloud sea, the walk, Watch as the way in (18 October 2026)

The reviewer: the knife in his hand all through; movement that glides; Watch to be the proper way to see it, and better;
the clouds distorted the moment the lens is just above them; the figures clashing "a joke, not fitting the story at
all, underplaying its value"; the clashes sounding like a weaponsmith; the music happy or neutral over the burning.

- **The knife** (`forest.js`): the forest's knife was mounted on the hero the valley shares, and never hidden out of
  the forest, so it was in his fist through the village, the years and the dell. It is there only while he cuts a mark
  with it. The bow is on his back on the walk out, not in his hand, and set down before the dell.
- **The war is redesigned** (`war.js`, new; `engine.js`, `fighters.js`). It was two balls of light
  orbiting each other with a stick figure drawn inside each, for twelve seconds under one slow orbiting lens; before
  it, a shadow-puppet play on the sheet of cloud. Now, in 13 shots cut on its beats (18 s of Watch):
  the two hang facing each other over the sea, the far peaks between them, as a sword of light two hundred metres
  long forms over the gold one (out of a burst of gold light, a seam of white running up it); behind the masked one of
  Fen Tian Zong at his shoulder (hood, mantle, iron mask, glaive; violet motes of his qi), the gold one far off under the
  great sword; far below the gold one, small under it as it forms; side on, they streak at each other and meet (the
  frame struck into two tones, the shock bending the light); high and far, the shock thrown out from it, a shell of light
  racing out over the sea and tearing a ring out of it; the
  great sword swung down past us, throwing a crescent of light down the line; behind the masked one, the crescent
  coming at him, at us; he splits it on his glaive and its halves go past him either side and down into the sea behind,
  cutting two trenches through it; he rises with the glaive up and the storm answers it, three bolts down onto its head;
  the lightning comes down on the bell of light about the gold one, ringing over it, cracking it; over the gold one's
  shoulder, the lock, the mask lit by the light of it; from the far side, the light pressed out of the lock (gold one
  side, violet the other, veins of lightning over it, a white heart) swelling between them, the sea blown down under
  it; it bursts; the masked one thrown up over him, and coming down on him: the smash, and the dive the film had.
  Far off they are lights, as the film's cultivators always were; close to they are people (the villagers' bodies in
  their robes and the sect's garb, weapons in their fists, streamers in the wind of their flight). Never the gold one's
  face: from behind, below, at his shoulder.
- **Its sound** (`score.js`): every beat of it scored on Watch's clock with drums, the shock of the air (a sub boom
  falling away, the body of the blast, the crack of its front, the sky's rumble after) and swells drawn in toward each
  impact; never metal. The recorded clashes, the smash and thunder go in where they will be (`audio.js` bank).
- **The cloud sea from just above** (`sky.js`): each head of the baked sea had a step at its rim (an offset added to
  the cap), and the caps met in creases the texture's grid showed; from just above the sea the steps smeared into
  curtains hanging down the heads, and from higher up it was a lilac mountain range. The heads are continuous now,
  meeting in soft folds; a cloud sea's relief (rolling, not alpine); the towers' flanks no steeper than a heightfield
  holds, and shaded down their sides by their own billows in three dimensions; the sun's way into the cloud is soft
  (thin cloud lets light through), the shade pale. No tower rises inside the war's arena.
- **A cultivator seen close to is not a star** (`sky.js`, `fighters.js`): a fighter's glow in the sky fades as the lens
  comes near (it filled the frame with haze); far blows' rings no wider than 240 m. What the two wear and hold is
  marked as figure for the painted look (flattened with the world, the glaive's thin shaft turned green in the glare).
- **The walk, the run** (`timeline.js` `mcZ`, `engine.js`, `forest.js`): measured at Watch's 30 Hz. The walk keeps a
  walker's pace in every shot and cuts ahead between them (instant changes of scenery around him, his framing kept);
  the porch, the stall and the mushrooms reached at a walk. The run home was 5.6 m/s along z on a road that bends, 7-8
  m/s along the road, and one curve through each cut's key pair ran him at 10-15 m/s either side of it: each shot is
  its own curve now, the run measured along the road. In the forest the gait is driven by how far he actually moves;
  into the dell he waits at the rim while the story holds, then runs down the bank (it was a crouched slide, legs still,
  at 6 m/s).
- **The burning is not cheerful** (`score.js`): the burning, "Uncle." and the run home were in the village's festival
  tune; now a falling cry on the xiao, then a lament over a doom march.
- **Watch the film** (`index.html`, `boot.js`, `cinderfall.css`): the title's way in, a vermilion button: sound on, the
  whole screen on a desktop, the film from the top (queued if the story is still being prepared). While it plays the
  page is cinema: the header, the HUD and the cursor hide (a move of the mouse shows them a moment), each chapter's name
  shown as it begins. The war's caption is written in quicker so Watch never slows for it. On a short screen (a
  laptop's browser, a phone on its side) the sign, the lines and the button all fit the first screen, above the HUD.
- **Recorded music and sound** (`audio.js`, `assets/cinderfall/audio/manifest.json`): a player for the ten cues (each
  started and crossfaded on Watch's clock, the score's melody stepping back under it) and a bank of effects in place
  of the synthesised ones, both empty until the files are in.
