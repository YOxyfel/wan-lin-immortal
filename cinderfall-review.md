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
