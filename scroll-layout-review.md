# Living manuscript and fate passage

Updated locally on 2026-10-04. The previous panel-layout pass and this refinement are saved together.

- Panels vary in size and alternate around a clear gold-and-ink current. Captions sit beneath their own images, between fixed rollers.
- Margin artwork uses native vector bamboo, mountain washes, dry brush strokes, and deterministic scattered ink droplets. It travels with the parchment and stays outside the central current.
- The uncle memory clears before the first training panel's main reading position. The qi ends above the closing inscription.
- Three extra viewport lengths introduce an encounter written by fate. Centered sentences progress from parchment to dark ink and gold before the original forest reveal.
- Scene progress maps around the inserted passage so the village, uncle, training, and forest keep their original scrolling distances. Refresh, reverse scrolling, and Replay derive their state from the document position.
- Two forward threshold crossings trigger 380 ms damped ink impacts. Mobile movement is reduced; reduced-motion visitors receive the existing static narrative with the added story copy.

## Verification

Production Vite build and JavaScript syntax checks passed. The build retains the existing Three.js chunk-size warning.

Interactive browser checks at desktop and 390 x 844 confirmed the decorated manuscript, all three text beats, readable mobile text, and no horizontal document overflow. Refresh restored the final fate sentence. Forward scrolling reached a fully visible forest with the interlude hidden; reverse scrolling restored the fate passage. Replay reset the journey. No browser console errors were observed.

Screenshots are saved in the workspace at `website-qa/prologue-final/living-scenes/ink-scroll-desktop.jpg`, `ink-scroll-mobile.jpg`, `fate-desktop.jpg`, and `fate-mobile.jpg`.

The preview remains available at http://127.0.0.1:8013/. These updates have not been published to GitHub Pages.
