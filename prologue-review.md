# Narrative rebuild — 3 October 2026

The homepage now follows one native-scroll timeline: sunlight and a walking civilian; shoulder camera and first person; the registered village redrawn as a burning ink landscape; a rush home and black transition; the uncle's final warning and the protagonist's unanswered question; a symbolic manuscript recording six years; discovery and first-person opening of the physical scroll; demo updates.

The environment and character are layered illustrations in Three.js. The manuscript and artifact use perspective transforms and independent clipping. This is a 2.5D illustrated prologue, not gameplay footage. The opening pan and brief shock are automatic; the remaining camera and scenes follow native scrolling. Push-ups use two illustrated poses; shelter fire and meditation have restrained movement. Scroll distance is 21 viewport heights, with reading pauses controlling the actual duration.

## Validation

- `npm run build` succeeds with the existing Three.js chunk-size advisory and outdated Browserslist advisory.
- Production build tested in local Edge at 1440 × 900 and 390 × 844; development preview also checked at 3440 × 1440.
- No JavaScript errors or failed asset requests in the production journey checks.
- Forward/reverse seeking, deep refresh, replay, shock completion while stopped, codex scroll lock, skip-to-demo, reduced-motion story and no-JavaScript story verified.
- Screenshot review corrected character scale, manuscript framing, phone face crop, navigation contrast and artifact clipping.
- Evidence: `../website-qa/prologue-final/production-report.json`, `report.json`, and corresponding screenshots.

## Media and sound

Artwork generated using the approved silver-haired civilian character reference; runtime images encoded as WebP. Walking uses one completed Higgsfield Genjutsu free motion-transfer generation. No subscription or trial was started. Four ElevenLabs voice takes used 376 generation credits and remain in the private local review, outside this repository's public build. Free ElevenLabs audio excludes commercial use. Public sound is opt-in procedural ambience, footsteps and shock. The local preview can audition the voice when the private review server at port 8012 is running.

The demo is still in development; the CTA opens an email notification request and does not imply a playable download exists. Existing world, characters, cultivation, story, gallery and privacy pages remain reachable.
