# Opening rebuild — 4 October 2026

Status: implemented locally; browser interaction QA and publication pending.

The opening uses a shared Three.js village, a new web skeleton built around static game meshes, physical UV dimensions, and real camera translation/rotation. The original game blend is unchanged. Daylight uses hemisphere fill and a shadowed sun. The attack changes the same world to low ambient light with eight flickering fire lights, animated flame shaders, rising smoke, and creature silhouettes. The camera moves through the street, arcs behind Wuhen, enters first person, pauses, turns 180 degrees, and returns around the front of his home before the existing blackout/uncle sequence.

UVs: box faces use actual dimensions; curved roofs use accumulated surface arc length; cylinders use circumference and height. Wood grain follows the longer face direction. Character source UVs are preserved. Static architecture is merged into 45 material batches.

Validation: production build passed. UV checks on 18 representative box faces have zero area-density error. Skeleton weights sum to one within 2.98e-8. Camera clearance passed at 333 sampled route positions. Reversing scroll produces the same camera position. Five exact-geometry scene snapshots were exported for offline inspection. Daylight, shoulder, and attack were rendered in Blender; these establish geometry/framing, not browser shader fidelity. Offline fire shapes are proxies, explicitly not the runtime flame effect.

Limitation: automatic approval review rejected browser preview access. No browser FPS, shader compilation, mobile framing, refresh/replay behavior, or end-to-end interaction success is claimed. Existing prior browser QA documents do not validate this rebuild. Browser access approval has been requested. Do not publish this revision as fully verified until browser QA is completed.

Local preview: http://127.0.0.1:8013/ . No paid media services or subscriptions were used.
