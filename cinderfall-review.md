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
