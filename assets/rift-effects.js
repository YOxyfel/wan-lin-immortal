/**
 * Transparent energy, in the same plane as the spirit echoes. The caller owns
 * the clock and visibility policy; this renderer never moves the portraits.
 */
export function createRiftEffects(canvas, { reducedMotion = false } = {}) {
  let context = null;
  try { context = canvas?.getContext('2d', { alpha: true }); } catch { /* Optional enhancement. */ }
  if (!context) return { render() {}, resize() {}, destroy() {} };

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = (from, to, value) => {
    const t = clamp((value - from) / (to - from));
    return t * t * (3 - 2 * t);
  };
  const fract = value => value - Math.floor(value);
  const mix = (a, b, t) => a + (b - a) * t;
  let seed = 19383;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Fixed phases keep the geometry calm and reproducible when the page resizes.
  const particles = Array.from({ length: 48 }, (_, index) => ({
    side: index % 2 ? 1 : -1,
    x: .08 + random() * .82,
    y: random(),
    phase: random(),
    depth: .25 + random() * .75,
    speed: .12 + random() * .12,
    brightness: .35 + random() * .65,
  }));
  const strands = Array.from({ length: 12 }, (_, index) => ({
    side: index % 2 ? 1 : -1,
    level: Math.floor(index / 2),
    phase: random(),
    bend: .75 + random() * .3,
  }));
  // One seeded burst, sampled by progress rather than elapsed time. Replays
  // reuse the same streaks and the effect cannot flash repeatedly while held.
  const fragments = Array.from({ length: 40 }, (_, index) => ({
    angle: index / 40 * Math.PI * 2 + (random() - .5) * .12,
    reach: .60 + random() * .40,
    length: .045 + random() * .075,
    width: .6 + random() * 1.2,
    brightness: .48 + random() * .52,
  }));
  let width = 0;
  let height = 0;
  let count = 48;
  let strandCount = 12;
  let disposed = false;
  const epoch = performance.now();

  function resize() {
    if (disposed) return;
    width = Math.max(1, canvas.clientWidth || canvas.getBoundingClientRect().width || 1);
    height = Math.max(1, canvas.clientHeight || canvas.getBoundingClientRect().height || 1);
    const density = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    count = width < 700 ? 24 : 48;
    strandCount = width < 700 ? 8 : 12;
  }

  function point(path, t) {
    const u = 1 - t;
    return {
      x: u * u * u * path[0].x + 3 * u * u * t * path[1].x
        + 3 * u * t * t * path[2].x + t * t * t * path[3].x,
      y: u * u * u * path[0].y + 3 * u * u * t * path[1].y
        + 3 * u * t * t * path[2].y + t * t * t * path[3].y,
    };
  }

  function trace(path, start = 0, end = 1) {
    const first = point(path, start);
    context.beginPath();
    context.moveTo(first.x, first.y);
    if (start === 0 && end === 1) {
      context.bezierCurveTo(path[1].x, path[1].y, path[2].x, path[2].y, path[3].x, path[3].y);
    } else {
      for (let step = 1; step <= 12; step += 1) {
        const next = point(path, mix(start, end, step / 12));
        context.lineTo(next.x, next.y);
      }
    }
    context.stroke();
  }

  function halo(x, y, radius, strength, inner, middle) {
    if (strength < .003 || radius <= 0) return;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(.18, middle);
    gradient.addColorStop(1, 'rgba(255, 179, 95, 0)');
    context.fillStyle = gradient;
    context.globalAlpha = strength;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // chestX/chestY are canvas-local CSS pixels; the caller can measure the united
  // image so the energy remains attached to its chest at every viewport size.
  function render(progress = 0, frame = {}) {
    if (disposed) return;
    context.clearRect(0, 0, width, height);
    if (reducedMotion || width <= 1 || height <= 1) return;

    const p = clamp(Number(progress) || 0);
    if (p >= 1) return;
    const charge = clamp(Number(frame.charge) || 0);
    const cx = Number.isFinite(frame.chestX) ? frame.chestX : width * .5;
    const cy = Number.isFinite(frame.chestY) ? frame.chestY : height * .48;
    const t = (performance.now() - epoch) * .001;
    const gathering = ease(.22, .60, p);
    const streamEnergy = ease(.24, .33, p) * (1 - ease(.57, .605, p));
    const edgeEnergy = (.09 + .19 * ease(.02, .18, p) + charge * .19)
      * (1 - ease(.25, .42, p));
    const ambientEnergy = (1 - ease(.18, .38, p)) * .32;
    const halfGap = width * (ease(.12, .50, p) * .30 + ease(.60, .76, p) * .27);
    const scale = Math.min(width, height);
    context.globalCompositeOperation = 'screen';
    context.lineCap = 'round';

    // A quiet inward drift precedes the break. These motes disappear as the
    // recognizable red/gold streams take over, leaving the merge uncluttered.
    for (let i = 0; i < count; i += 1) {
      const particle = particles[i];
      const { side, depth, phase, brightness } = particle;
      const life = fract(phase + t * particle.speed);
      const breath = Math.sin(life * Math.PI);
      if (i % 3 === 0 && ambientEnergy > .005) {
        const originalX = side < 0 ? width * (.04 + particle.x * .48) : width * (.96 - particle.x * .48);
        const pull = charge * .46 + ease(.04, .20, p) * .16;
        const x = mix(originalX, cx, pull);
        const y = fract(particle.y - t * (.003 + depth * .004)) * height;
        context.globalAlpha = ambientEnergy * brightness * (.25 + breath * .75);
        context.strokeStyle = side < 0 ? '#bd5b45' : '#d6ae6e';
        context.lineWidth = .55 + depth * .55;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - side * charge * 8, y - 1 - depth * 3);
        context.stroke();
      }
      if (edgeEnergy <= .005) continue;
      const edgeY = fract(particle.y + t * .009) * height;
      const edgeX = width * .5 + side * halfGap;
      const reach = Math.min(width * .055, 70) * depth;
      const x = edgeX + side * (1 - life) * reach;
      context.globalAlpha = edgeEnergy * brightness * breath;
      context.strokeStyle = side < 0 ? '#e17b57' : '#e6bf77';
      context.lineWidth = .5 + depth * .65;
      context.beginPath();
      context.moveTo(x + side * (2 + charge * 8), edgeY + 2);
      context.lineTo(x, edgeY);
      context.stroke();
    }

    // Each ribbon starts along an eroding spirit edge, bends around the body,
    // and lands at the same chest point. Traveling tips carry the eye inward.
    if (streamEnergy > .003) {
      for (let i = 0; i < strandCount; i += 1) {
        const strand = strands[i];
        const { side, level, phase, bend } = strand;
        const spread = strandCount / 2 - 1;
        const offset = mix(-.22, .26, level / spread) * height * (1 - .86 * ease(.42, .60, p));
        const reach = width * mix(.28, .015, gathering * gathering);
        const curl = Math.sin(t * .38 + phase * 6.28) * scale * .009;
        const path = [
          { x: cx + side * reach, y: cy + offset },
          { x: cx + side * reach * .75, y: cy + offset * 1.07 + curl },
          { x: cx - side * reach * .10 * bend, y: cy + offset * .16 - scale * .045 * bend },
          { x: cx, y: cy },
        ];
        const tint = side < 0 ? '220, 68, 47' : '237, 181, 78';
        const gradient = context.createLinearGradient(path[0].x, path[0].y, cx, cy);
        gradient.addColorStop(0, `rgba(${tint}, 0)`);
        gradient.addColorStop(.18, `rgba(${tint}, .48)`);
        gradient.addColorStop(.65, `rgba(${tint}, .9)`);
        gradient.addColorStop(1, 'rgba(255, 247, 217, .9)');
        context.strokeStyle = gradient;
        context.globalAlpha = streamEnergy * .13;
        context.lineWidth = 4 + scale * .004;
        trace(path);
        context.globalAlpha = streamEnergy * .48;
        context.lineWidth = .65;
        trace(path);

        const life = fract(phase + t * .30);
        const travel = 1 - Math.pow(1 - life, 1.32);
        const alpha = streamEnergy * Math.pow(Math.sin(life * Math.PI), .55);
        context.globalAlpha = alpha;
        context.lineWidth = 1.1;
        trace(path, Math.max(0, travel - .10), travel);
        const tip = point(path, travel);
        halo(tip.x, tip.y, 6 + scale * .003, alpha * .55,
          '#fff4d1', `rgba(${tint}, .6)`);
      }
    }

    // The held core breaks only once. A fast front and trailing red/gold
    // fragments supply the impact; the united figure remains visible behind it.
    const core = ease(.45, .58, p) * (1 - ease(.77, .87, p));
    const release = clamp((p - .60) / .20);
    if (core > .003) {
      halo(cx, cy, scale * .046, core * .64,
        '#ffffee', 'rgba(255, 201, 116, .56)');
      halo(cx, cy, Math.max(3, scale * .008), core * .88,
        '#ffffff', 'rgba(255, 245, 203, .75)');
    }
    if (release > 0 && release < 1) {
      const attack = ease(0, .025, release);
      const envelope = attack * Math.pow(1 - release, 1.7);
      const travel = 1 - Math.pow(1 - release, 3);
      const reach = Math.hypot(width, height) * .58;
      const radius = mix(scale * .016, reach, travel);
      const flash = attack * (1 - ease(.04, .34, release));
      halo(cx, cy, scale * mix(.085, .30, travel), flash * .92,
        '#fffffa', 'rgba(255, 219, 157, .72)');

      const gradient = context.createLinearGradient(cx - radius, cy, cx + radius, cy);
      gradient.addColorStop(0, 'rgba(238, 75, 50, .85)');
      gradient.addColorStop(.5, 'rgba(255, 249, 224, 1)');
      gradient.addColorStop(1, 'rgba(248, 192, 81, .85)');
      context.strokeStyle = gradient;
      context.globalAlpha = envelope * .18;
      context.lineWidth = mix(15, 2, travel);
      context.beginPath();
      context.ellipse(cx, cy, radius, radius * .70, 0, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = envelope * .82;
      context.lineWidth = mix(2.3, .6, travel);
      context.stroke();

      const fragmentCount = width < 700 ? 24 : fragments.length;
      for (let i = 0; i < fragmentCount; i += 1) {
        // Spread the phone subset around the entire burst rather than one side.
        const fragment = fragments[Math.floor(i * fragments.length / fragmentCount)];
        const dx = Math.cos(fragment.angle);
        const dy = Math.sin(fragment.angle);
        const head = radius * fragment.reach;
        const tail = Math.max(scale * .012, head - reach * fragment.length * (1 - release));
        const x = cx + dx * head;
        const y = cy + dy * head * .85;
        const tx = cx + dx * tail;
        const ty = cy + dy * tail * .85;
        const tint = dx < 0 ? '239, 82, 54' : '255, 194, 88';
        const trail = context.createLinearGradient(tx, ty, x, y);
        trail.addColorStop(0, `rgba(${tint}, 0)`);
        trail.addColorStop(.5, `rgba(${tint}, .75)`);
        trail.addColorStop(1, 'rgba(255, 248, 220, 1)');
        context.strokeStyle = trail;
        context.globalAlpha = envelope * fragment.brightness * .92;
        context.lineWidth = fragment.width;
        context.beginPath();
        context.moveTo(tx, ty);
        context.lineTo(x, y);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function destroy() {
    if (disposed) return;
    context.clearRect(0, 0, width, height);
    disposed = true;
  }

  resize();
  return { render, resize, destroy };
}
