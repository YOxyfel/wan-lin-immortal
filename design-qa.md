# Continuous journey — visual and motion QA

Target: the selected Inkbound Chronicle / Crimson Ascension / Living Scroll art
directions, revised on 2026-10-03 to require real 3D architecture, direct scroll
control, no collision/fused character, and a continuous spatial/printed journey.
This is a redesign; the three original poster panels specify palette and subject,
not three page sections or a requirement to reproduce the rejected fusion art.

Evidence: local production build under `/wan-lin-immortal/`; desktop and phone
captures, combined source/implementation board, uninterrupted forward/reverse
video, interaction report and sustained runtime report in the workspace's
`website-qa/continuous-journey` folder. Source poster crops and implementation
shots were normalized onto the same comparison board. They are different camera
compositions by design, so no claim of pixel-identical fidelity is made.

## Findings fixed and recaptured

- P1: scene width collapsed because its progress state matched the meter selector.
  Scoped the meter selector and added a full-width assertion at every tested seek.
- P2: architecture showed through dark portrait pixels. Made the portraits opaque,
  corrected draw ordering and cleared architecture behind the initial composition.
- P2: opening portraits were cropped out on phones. Authored a smaller correctly
  proportioned portrait composition with the title below it.
- P2: paper conversion overcolored the whole scene and the Immortal. Constrained
  vermilion to saturated red pixels within the projected celestial disc.
- P2: foreground rock crossed paper copy. Restaged it above the text region.
- P2: reduced-motion change and explicit reload raced. Applied the quiet path
  directly on preference change; retained refresh only when returning to motion.

## Required visual surfaces

- Typography: existing Cinzel/Cormorant families, one opening title and restrained
  chapter copy; captions clear during complex passage and transfer frames.
- Layout: full-size persistent stage; no independent sticky act boundaries;
  dedicated phone opening; Codex and story actions stay accessible.
- Color: charcoal/ivory/vermilion with restrained brass; no global bloom or white
  veil. Paper branding and text have explicit dark colors.
- Image quality: original character identity retained, no third-body replacement;
  modeled close surfaces with a generated stone detail texture. Distant illustrated
  atmosphere is not used as the camera's approached surface. Existing raster detail
  remains a practical ceiling on very large displays.
- Content: existing lore, story/cultivation/gallery routes, contact, FAQ and demo
  development status preserved. No compulsory ritual or sound.

## Motion and function

One reversible camera path opens the gate, crosses actual architecture, changes
perspective and transfers the same rendered world onto a rotating scroll. Separate
near rocks remain spatial across its edge. Both transfer endpoints match the
spatial camera pose. Native input settles quickly and no automatic opening clock
or page lock remains. Direct seeking and refresh generate the required print image.

Production interaction checks cover irregular seeking, refresh, top return, Codex,
keyboard Home, repeated traversal and framing at 1440×960, 390×844, 667×375 and
3440×1440. All required routes load. Missing model, JavaScript-disabled and reduced
motion paths retain readable story content. Touch Codex entry works in emulation.

A 65-second desktop pass used an RTX 4080 SUPER through Edge/ANGLE: median frame
interval 6.9 ms, 95th percentile 7 ms; one interval exceeded 50 ms. This is a
desktop observation, not a phone performance claim. Real-phone thermal/performance
testing remains unverified. Further sculptural and surface detail is a P3 refinement;
the 3D architecture deliberately uses a restrained silhouette.

final result: passed
