# Cinderfall — direction plan v2 (stress-tested)

Plan v1 was reviewed by four independent passes: a director and cinematographer, a donghua storyboard director, a
real-time technical director, and a muted first-time viewer measuring what can actually be read at scroll speed. All
four worked from rendered frames of the current story and from the code. This is the plan that came out of it. It is
the working spec for the prologue; positions are story units `u` (see `assets/cinderfall/timeline.js`).

## What the stress test found

- v1 was a catalogue of techniques, not a point of view: it added spectacle and length where the story lacks setups,
  payoffs and a visual language.
- **The uncle is never established.** He waves from mostly off frame; his only clear view is as a ghost. Without him,
  every caption after u61 points at a stranger. (All four reviews; the single most important change.)
- **The lens is a game camera.** 46–50° vertical, 1.6 m behind his head, centred: that, more than anything, is what
  reads as "mundane".
- **The six winters are one knife close-up, six times.** Nothing accelerates; the ghost figures read as spirits right
  after a literal spirit; he never visibly grows.
- **The walk cuts between unrelated cameras**, and he walks on the spot when the reader stops scrolling.
- **The launch is far away.** The well's walls are 240–620 m off; the camera spends ~3.5 s inside formless haze (it
  flies through the ragged wall of the well); the sheets never read as layers.
- **The war is a centred dot.** Nothing on screen causes the fall, and nothing ties the killers to the sect.
- **Captions die under scroll.** Several lines get under a quarter of a screen at full opacity; "Something fell." is
  never fully visible. Holds sit just before their lines instead of on them.
- **Flash safety.** Lightning flashes ~3.7–4.8 times a second with a ~14 Hz flicker inside each: that fails the
  photosensitivity guidelines (WCAG 2.3.1, the Harding test).
- **Frame-length effects break under scrolling.** An impact frame that is a band of `u` is skipped by one wheel notch,
  or held forever by a reader who stops inside it.
- **Bug:** on phones the Watch and Skip buttons were hidden (an old stylesheet rule). Fixed.

## House rules

1. **Earth is long-lens and lateral; heaven is wide and vertical.** On the ground the camera follows from 4–6 m on a
   long lens (24–30° vertical), him in a third of the frame; wide shots put him small in a corner of empty paper.
   Nothing wider than 40° before the launch, so the lens opening up there *is* the leaving of the earth. Sideways
   movement is mortal life (the handscroll pans); vertical movement is fate (the launch, the dive, the bolt, the soul,
   the pillar).
2. **The painting's mounting.** On wide screens the earth is framed inside a paper mount (a letterbox drawn as the
   scroll's border). Over the sea of clouds the painting breaks out of it, and the frame never closes again.
3. **Colour is meaning.** Full colour: ordinary life. Ink: loss, memory, and his true sight. Gold: qi — what fell, the
   uncle's soul, the motes, the pillar (one family of light). Cinnabar: fire and blood. Violet: Fen Tian Zong only —
   the masked fighter, the banners, the wolves' eyes, the crag's lightning.
4. **Hands are his face.** His face is never shown, so hands carry the story: the basket handed over, the basket
   falling, the clasp and the tear, his palm on the six notches, his hands opening for the scroll, his blood on the
   crystal.
5. **Two kinds of join:** the cut on an action or a match (a footfall, a gesture, a shape), and ink (the drop, the
   wash, the brush). No wipe for its own sake; nothing that becomes a broken still when the reader stops.
6. **Effects live in the medium.** Speed is dry-brush "flying white" (飞白) streaks, not photographic blur; depth is
   ink density; grain is paper; impact is the two-tone ink frame. No lens flares, colour fringing or breathing
   vignette.
7. **Wind is the music.** For a muted viewer the score is visible: his hair and sash, leaves, petals, rain. Dead calm
   is dread; updrafts are fate. Every sound cue has a visible cause or effect (thunder: the flash, the shake a quarter
   second later, a pressure wave through rain and leaves).
8. **The scroll is the camera operator; the director keeps final cut.** Story speed is capped in protected passages
   (holds, captions, the launch, the montage, the walk), so a flick cannot skip them; a reader more than two screens
   ahead is carried forward by an ink wash. Impacts and flashes fire when the story crosses them and run on the real
   clock (2–3 frames). Real slow motion comes from the story clock (fire, rain, hair and flashes slow too).
9. **Safety.** At most 3 flashes a second anywhere, no strobing inside a flash, at most two impact frames a sequence;
   reduced motion gets the gentle version.
10. **Words only for what pictures can't carry.** Captions sit like a painting's inscriptions, in empty paper composed
    for them, each readable for at least 60% of a screen of scroll at full opacity (and at least 1.2 s + 70 ms a
    character in Watch), every hold on its line.

## The three asks, redesigned

### A. The launch through the clouds (46.95–49.6), and the dive back down
- **The held breath (46.95):** dead calm made visible. Petals and leaves stop in the air, his hair falls still. Caption:
  "Then the forest held its breath."
- **The inhale:** the storm's eye draws breath and everything rises: petals lift toward it, his hair lifts, the birds
  burst up out of the pines, and the camera launches with the flock, through the pine crowns (needles within metres of
  the lens), a half-second glance down at him small and looking up, then past the birds.
- **The lens opens once**, earth to sky. No pumping of the field of view at each layer (6° at most).
- **Up the eye's well, close to its wall:** billows streaming past at 20–60 m, shreds of cloud within 10 m. Five
  lights: the green canopy; a slate ceiling where the camera nearly stops for **the war's shadow-play** (two giant
  silhouettes, one masked, clashing on the backlit cloud like puppets on a paper screen); the punch: whiteout, flying-
  white rain, one lightning flash that shows the walls; pearl, then gold; **the breach.** Each layer hides the view
  for 2–3 frames only.
- **The breach:** paper-white; the mount falls away; shake, rain and streaks drop to zero in one frame; the story clock
  slows to about a sixth; one ice crystal hangs at the lens; the interface fades; total silence. The camera tilts down
  to the horizon: the sea of clouds, the war glinting off to one side, and straight down the well a single gold thread
  to a speck that is him — his sense torn out of him by the war.
- **Length:** about two screens of scroll (about 16 s in Watch), protected so a flick can't skip it.
- **The dive mirrors it:** the masked violet fighter smashes the gold one down; the camera tips over (one weightless
  beat), chases the falling gold light down through the storm with the rain rising past the lens and lightning reaching
  for it, and is reeled back to him on the bolt's leader. One hard cut to low behind him at the strike; the shockwave
  strips the cherry tree and throws its petals at the lens.

### B. The six winters (112.3–124.6, about 55 s in Watch)
- **Height notches.** Planted on the uncle's door frame in the morning, scorched in the fire. Each winter he cuts a notch
  at his own height on the tally tree: the count and his growth, with no face shown.
- **One handscroll pan a year.** A slow sideways pan through the camp, like unrolling a scroll, with him appearing
  several times along it (solid, never ghosts: the old scroll painters' way of showing one man at several moments).
  The season changes behind trunks, the rock and the hut as the lens passes them; each year the colour seeps back into
  a wider ring of the camp.
- **Year one (about 12 s), full length:** winter by a fire he can barely keep alive, snow on his back; spring, foraging
  — mushrooms in the same framing as the morning he lost everything; summer, the lean-to becomes a hut, a sapling bent
  into a bow; autumn, his first arrow misses; first snow, a push in on his hands, still shaking, cutting the first
  notch.
- **Years two to five:** each pan starts nearer the tree, so each year is shorter (and a little quicker): a hare in the
  snare; the roof beam raised; an arrow in the target's heart; a drawn bow held while time-lapse snow settles on his
  shoulders. Skill rises; each ends on one more notch.
- **Year six (about 10 s):** the scroll slows to real time. A slow pan across his back as he cuts the sixth notch, one
  long breath; his palm on the six, framed like the uncle's hand on the door frame; he ties his hair up — the man the
  uncle raised. "Six years."

### C. The walk out (124.6–131.5)
- **The omen, rhyming with the birds:** the frozen, empty snare; a top-down insert of unbroken frost with only his own
  prints; no birds. "Not one track. Not one bird."
- **The stride-cut:** the camera locked at his hip, rear three-quarter from his right, 3–4 m back, a long lens. His walk
  is locked to the scroll: the reader's scroll is his stride. On a heel strike the world swaps in one frame — it is
  still a cut, but *he* never jumps, the world does: the camp woods, the ford (the foot lands in water), bamboo, the
  mossy giants. Every four strides, then two, then one; the trees bigger each time while he stays the same size; the
  sun swinging from behind him (his shadow leading) to ahead of him (a gold silhouette): morning to late afternoon in
  a dozen steps.
- **The missed beat:** a footfall lands and nothing swaps. A gold mote crosses the lens; he stops; the camera unlocks for
  the first time and cranes up the giant's trunk as the air begins to glow.

## Act by act

**01 An ordinary morning**
- The bomb under the table: under "Nothing ever happened here.", a hairline violet flicker deep in the clouds and one
  masked watcher on the far crag, for a second viewing to find.
- **The uncle at his door** (the most important change): the crane lands at the herb shop; the uncle's face in sunlight,
  the only face the film holds on; the basket passes from his hands to the boy's (an insert, both hands on the handle);
  he points at the sun: "Home before dark." Planted here: the height notches, the unlit porch lantern, herbs drying.
- The street as one long-lens take, about a fifth shorter, the laundry sheet crossing the lens.
- The smith's stall teaches the colour rule: for one beat the world drains to ink and only the blades' qi stays gold.
- The gate framed for its rhyme: the garrison's backs marching away, the watchtower empty.
- The bridge on a long lens; at the pines the stillness gathers.

**02 The sky turns** (besides the launch and dive)
- The war made legible: the shadow-play; one close pass (a gold robe against the sect's iron mask); the last exchange
  locked to the scroll, ending with violet smashing gold down.
- What falls carries the scroll: its silhouette inside the fleeing light, 玄 flaring on it.
- "Something fell." big, centred and held.
- A quiet stretch (55.5–58.4): a locked wide, the boy small, night dragged across the sky as an ink wash, nothing else
  moving.

**03 Cinderfall burns**
- Instead of the dolly zoom: the camera holds still while the ink climbs the world toward him until the only colour
  left is the mushrooms in the basket; as it reaches his hand, his fingers open.
- The run home is the morning rewound: the same angles at the same landmarks, burning or empty. The gate framed exactly
  as in the morning, burning, violet-eyed wolves pouring through. One impact frame. The untended watchtower bell swings
  on its own; each toll is an ink ripple across the page.
- The door: the scorched notches, ash paw prints across the threshold, a creeping push in near silence.

**04 A final warning**
- The last words in one locked setup low by the uncle's head, his face the size it was in the morning, lit by fire; the
  boy is his hands. The tear falls in a frozen frame onto their clasped hands — the same drop as the opening.
- The soul's rise as one unbroken take: it is the uncle looking at the world. Colour returns as a visible wave; its
  updraft lifts the boy's hair once, the uncle's last touch.
- The crag: the leader's mask turns and finds the boy running below. "Unless someone sent them." needs no explaining:
  we have seen that mask in the war.
- He tears through the forest's boundary rope (planted at the edge of the pines) running after the light.

**05 The years between:** B above.

**06 What fell that night**
- C above; the dell as a slow crane up the ancient tree through its shafts of light.
- **Blood recognition (滴血认主):** his palm torn on the slide down into the dell (an insert); at the crystal his blood
  seeps into the cracks like ink in water and completes the 玄 the gold fighter left unfinished in the war.
- **The pillar is the bolt inverted:** framed exactly like the strike (behind him, same lens, same horizon), but silent,
  slow, warm, everything rising; the birds burst up with its ring.
- The last page: the third drop, in the same place and size as the first and the tear. "His began here." (answering
  the title's "Every life begins somewhere.")

## The score (generated in code)
- Opt-in, as now; the film must stand muted first. Every instrument is synthesized in the browser (no recordings): a
  plucked-string model for the guzheng, a breathy flute for the dizi and xiao, taiko and dagu drums, a gong, a low choir
  pad, wind.
- Driven by the scroll: layers follow the story position; accents fire when the story crosses them going forward.
- Themes: the uncle's theme (guzheng, pentatonic, simple) in the morning; dread as a single low drone and the bell; the
  war in drums and gong; the loss as a solo xiao with the uncle's theme broken; the years with the theme returning
  season by season; the call (choir and gold bells) at the pillar, the theme resolved.
- One total silence, at the breach over the sea of clouds.
- I can't hear it. I check levels, clipping and spectra by analysis; the owner's ears are the final pass.

## Cut from v1
The dolly zoom; the blade reflecting the street on fire (it spoils the reveal); the kite and the cart; lens flares,
colour fringing, the breathing vignette and per-beat letterbox bars; multi-angle coverage of the last words; the hard
cut from the mask; the gauntlet run; crystal shards hanging in slow motion; the closing pull up into the sky; the
"no hard cuts" rule; the scale ladder as a formula.

## Order of work
1. Foundations: the story clock; protected passages (speed cap and ink catch-up); impacts and flashes fired on
   crossing and the flash cap; the phone buttons. *Done.*
2. The launch and the dive (with the dive's chase). *Done.*
3. The six winters, and the height notches on the uncle's door frame. *Done.*
4. The walk out: the stride-cut, the omen's top-down insert of the frost. *Done.*
5. The heart: the uncle at the door, the hands, the last words, the morning rewound (the gate; the door, its prints).
   *Done, but for the untended bell.*
6. The war made legible: the shadow-play, the masked fighter, the fall, violet for the sect. *Done, but for the close
   pass and the scroll in the light.*
7. The lens pass over act 01, the street, the smith, the gate, the quiet stretch, the ink climbing. *Done, but for the
   bridge.*
8. The ending: the blood, 玄, the three drops, "His began here." *Done; the pillar not yet framed as the bolt.*
9. Captions and pacing: every line readable under the scroll (about half a screen at full strength) and in Watch.
   *Done.*
10. The score. *Done.*

Each step goes live once it is verified (headless renders of every changed beat, no shader compiled mid-story, frame
times on a real machine).

## Technical guardrails (from the technical review)
- No new shader program mid-story: new looks are rehearsed during the opening; new props reuse existing materials; no
  program-key changes at runtime (lights, defines, fog, side). At most a handful of new programs in total.
- Never shift `u`: length is added on the scroll axis (`STRETCHES`, `PAUSES`).
- Each new effect at most 0.5 ms GPU when on, 0.1 ms when off; the worst beat at most 12 ms on the reference GPU.
- Loading at most +2 s on a first visit.
- Every new pass has a low-quality path; the resolution governor must not step mid-launch.
