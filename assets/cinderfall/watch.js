// Watch: the story playing by itself. Its pace, in scroll units a second, by story position; kept where the scroll
// was lengthened only for reading (timeline.js STRETCHES' fourth value: how much of the stretch Watch gives back);
// slowed while a line is up for as long as it takes to read it. Shared by the page (boot.js) and the score (score.js),
// so what the score lays on Watch's clock keeps time with it.
import { PACE, STRETCHES, sToU, uToS } from './timeline.js';
import { clamp } from './util.js';

// ---------------------------------------------------------------- one line at a time
export const CAPTIONS = [
  { a: 7.2, b: 11.4, pos: 'left', eyebrow: 'CINDERFALL HAMLET · THE LAST ORDINARY MORNING', text: 'Nothing ever<br>happened here.' },
  { a: 15.4, b: 19.0, pos: 'right', eyebrow: 'HIS UNCLE, FROM THE PORCH', text: '“Mushrooms by the old pines.<br><em>Home before dark.</em>”', small: true },
  { a: 21.4, b: 25.3, pos: 'left', eyebrow: 'JIANG WUHEN · FIFTEEN', text: 'Every face,<br>a name he knew.' },
  { a: 25.75, b: 27.95, pos: 'right', eyebrow: 'THE SMITH’S STALL', text: 'Iron, to anyone else.<br><em>Only he saw them burn.</em>', small: true },
  { a: 31.2, b: 35.4, pos: 'right', eyebrow: 'AT THE GATE', text: 'The garrison marched out at dawn.<br><em>No one asked why.</em>', small: true },
  { a: 37.4, b: 41.4, pos: 'left', eyebrow: 'THE OLD ROAD', text: 'Same road. Same pines.<br>Same quiet.' },
  { a: 43.2, b: 45.75, pos: 'right', eyebrow: 'THE EDGE OF THE PINES', text: 'Right where<br>they always were.', small: true },
  { a: 46.1, b: 47.38, pos: 'right', text: 'Then the forest<br>held its breath.', big: true },
  { a: 49.8, b: 52.4, pos: 'right', eyebrow: 'ABOVE THE CLOUDS', text: 'Something was at war.' },
  { a: 52.95, b: 54.3, pos: 'right', text: 'The sky gathered<br>its thunder.' },
  { a: 54.5, b: 55.35, pos: 'center', eyebrow: 'A STONE\'S THROW FROM CINDERFALL', text: 'Something fell.', big: true },
  { a: 55.45, b: 56.85, pos: 'right', eyebrow: 'WEST, OVER THE RIDGES', text: 'Out of the fire,<br>a light fled west.' },
  { a: 56.95, b: 58.3, pos: 'right', text: 'Day turned to night<br>in a single breath.', small: true },
  { a: 58.4, b: 61.3, pos: 'center', text: 'Then, below —' },
  { a: 61.95, b: 63.72, pos: 'center', eyebrow: 'THE MOMENT EVERYTHING CHANGED', text: 'Cinderfall<br>was burning.', big: true, red: true, ink: true, low: true },
  { a: 64.45, b: 66.45, pos: 'left', text: 'Uncle.', big: true },
  { a: 72.2, b: 75.6, pos: 'right', eyebrow: 'THE GATE STOOD UNGUARDED', text: 'Home. Get home.' },
  { a: 78.8, b: 81.8, pos: 'left', text: 'The door was<br>already open.' },
  { a: 85.0, b: 86.9, pos: 'words', eyebrow: 'HIS UNCLE’S LAST WORDS', text: '“Don’t avenge me.”' },
  { a: 87.1, b: 89.0, pos: 'words', eyebrow: 'HIS UNCLE’S LAST WORDS', text: '“Forget this place.<br>Forget me.”' },
  { a: 89.2, b: 91.6, pos: 'words', eyebrow: 'HIS UNCLE’S LAST WORDS', text: '“Live a good life.<br><em>A long one.</em>”' },
  { a: 95.2, b: 98.2, pos: 'left', eyebrow: 'AN UNANSWERED QUESTION', text: 'Avenge…?<br>Those were monsters.' },
  { a: 99.3, b: 102.6, pos: 'right', eyebrow: 'ON THE CRAG ABOVE CINDERFALL', text: 'Unless someone<br><em>sent them.</em>' },
  { a: 104.95, b: 106.75, pos: 'right', eyebrow: 'THAT NIGHT', text: 'He followed the light west,<br>until the fires were only a glow behind him.', small: true },
  { a: 108.95, b: 110.75, pos: 'center', eyebrow: 'BEYOND THE RIDGES, WHERE NO ONE WENT', text: 'The Forbidden Forest.', big: true },
  { a: 112.6, b: 113.45, pos: 'left', eyebrow: 'THE FIRST WINTER', text: 'It nearly killed him.' },
  { a: 113.5, b: 114.35, pos: 'right', text: 'As his uncle knew herbs,<br>he learned the forest.', small: true },
  { a: 114.45, b: 115.85, pos: 'left', text: 'Snares. A bow.<br>Patience.' },
  { a: 116.2, b: 117.45, pos: 'left', eyebrow: 'THE YEARS', text: 'Every winter, he measured<br>himself against the tree.' },
  { a: 123.0, b: 124.55, pos: 'center', text: 'Six years.', big: true },
  { a: 124.85, b: 126.65, pos: 'left', eyebrow: 'THE SIXTH AUTUMN', text: 'No game near the camp that day.<br><em>Not one track.</em>', small: true },
  { a: 126.85, b: 128.75, pos: 'left', text: 'So he went farther<br>than he ever had.' },
  { a: 129.3, b: 131.6, pos: 'left', eyebrow: 'THE OLD WOOD', text: 'The forest grew older.<br><em>The air began to glow.</em>', small: true },
  { a: 133.6, b: 135.9, pos: 'right', eyebrow: 'UNDER THE OLDEST TREE', text: 'What fell from the sky that night<br><em>had waited for him.</em>', small: true },
  { a: 139.58, b: 140.85, pos: 'left', text: 'Some paths<br>find you.', big: true },
  { a: 142.6, b: 146.0, pos: 'end', eyebrow: 'THE FIRST PAGE OF SOMETHING MORE', text: 'His began here.' },
];

const basePace = s => { let p = PACE[0][1]; for (const [a, v] of PACE) if (s >= a) p = v; return p; };
export const paceAt = s => { let p = basePace(s); for (const [a, ls, r, w = 0] of STRETCHES) if (w > 0 && s >= a && s < a + ls) p *= Math.pow(1 / r, w); return p; };
const plain = t => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// each line's span on the scroll axis and its fades there (a sixth of a screen at most, a quarter of the line's span
// at most, so even a short line is at full strength for a while however its story is paced), the brush writing it in
// a little longer than it fades in; and how much Watch slows while it is up (at least 1.2 s and 60 ms a letter written
// and at full strength)
export const CAPS = CAPTIONS.map(c => {
  const as = sToU(c.a), bs = sToU(c.b), f = Math.min(0.5, (bs - as) / 4), rv = Math.max(f * 1.6, 0.7);
  let t = 0;
  for (let x = as + Math.max(f, rv); x < bs - f; x += 0.02) t += 0.02 / paceAt(uToS(x));
  return { ...c, as, bs, f, rv, slow: clamp(t / (1.2 + 0.06 * plain(c.text).length), 0.22, 1) };
});
export const capPace = su => { let k = 1; for (const c of CAPS) if (su > c.as && su < c.bs) k = Math.min(k, c.slow); return k; };
// Watch's pace at a scroll position
export const watchPace = su => paceAt(uToS(su)) * capPace(su);
