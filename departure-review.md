# Scroll departure and fate progression

Local refinement verified on 2026-10-04. Not published.

The uncle memory occupies its own first manuscript page above the training panels. The automatic departure closes the parchment and uses a fixed-step rigid-body simulation with wall collision impulses. The scroll is 0.734 metres long; gravity is 9.80665 m/s² along the shaft. The 4.2-second sequence replaces the previous 6.4-second departure. Its dimensions stay constant during flight.

Stone walls fade into complete black before any text or progress indicator appears. A 650 ms black hold precedes the two-second content fade. Each text passage has staggered row reveals, a reading hold, and a 1.5-second dissolve. Scrolling selects the next passage. The thin gold magic bar starts empty at twelve o'clock and draws clockwise from actual text reveal progress, reaching one third, two thirds, then full after the three passages. It has a glowing moving tip and no full decorative ring at entrance.

## Verification

- Vite production build passed; the existing Three.js chunk-size warning remains.
- Simulation check confirmed Earth gravity, 4200 ms duration, constant scale, and two dissipative wall impacts.
- Desktop browser inspection confirmed 0.3333, 0.6667, and 1.0000 indicator fill across the three text passages.
- Returning to the top rearmed and replayed the automatic fall. A screenshot at departure progress 0.3325 shows the rigid scroll in the textured shaft.
- At completion, browser state confirmed text opacity zero and indicator fill zero. The captured frame is black before the text reveal.
- No browser console errors were observed in the final check. Mobile was not rechecked in this refinement.

Screenshots: `../website-qa/prologue-final/living-scenes/earth-gravity-well.png`, `tunnel-full-black.png`, and `magic-progress-first.png`.
