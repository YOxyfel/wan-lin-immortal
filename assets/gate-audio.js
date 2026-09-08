/**
 * Optional, locally synthesized score. The sound button is the only place an
 * AudioContext may be created. start(progress) also resumes a paused sequence;
 * starting after the impact never repeats it, while start(0) arms a replay.
 */
export function createGateAudio(button) {
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const ease = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  const impactAt = .60;
  let context = null, compressor = null, noiseBuffer = null, graph = null;
  let enabled = false, active = false, destroyed = false, unavailable = false;
  let progress = 0, impactPlayed = false, operation = 0, idleSuspension = null;
  const groups = new Set();
  const cleanupTimers = new Set();

  function updateButton() {
    if (!button) return;
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', unavailable ? 'Cinematic sound unavailable' : enabled ? 'Mute cinematic sound' : 'Enable cinematic sound');
    button.dataset.sound = unavailable ? 'unavailable' : enabled ? 'on' : 'off';
    const label = button.querySelector('[data-sound-label]') || button;
    label.textContent = unavailable ? 'Sound unavailable' : enabled ? 'Sound on' : 'Sound off';
    button.disabled = unavailable;
  }

  function disposeGroup(group) {
    if (!groups.delete(group)) return;
    for (const source of group.sources) {
      try { source.stop(); } catch { /* A one-shot may already have ended. */ }
    }
    for (const node of group.nodes) node.disconnect();
    group.sources.clear();
    group.nodes.clear();
  }

  function suspendIfIdle() {
    const target = context;
    if (!target || destroyed || target.state === 'closed' || graph || groups.size || (active && enabled) || idleSuspension) return;
    // A stopped or muted timeline can have no graph at all. Suspending only
    // from a voice cleanup callback misses both of those lifecycle paths.
    idleSuspension = target.suspend().catch(() => {}).then(() => {
      idleSuspension = null;
      // A new start may arrive while suspension is still queued by the browser.
      if (target === context && active && enabled && !destroyed) activate();
    });
  }

  function retireGraph(immediate = false) {
    const group = graph;
    graph = null;
    if (!group || !context) { suspendIfIdle(); return; }
    if (immediate || context.state !== 'running') { disposeGroup(group); suspendIfIdle(); return; }
    const now = context.currentTime;
    const gain = group.output.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else { gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now); }
    gain.linearRampToValueAtTime(0, now + .12);
    for (const source of group.sources) {
      try { source.stop(now + .15); } catch { /* A one-shot may already have ended. */ }
    }
    const timer = setTimeout(() => {
      cleanupTimers.delete(timer);
      disposeGroup(group);
      suspendIfIdle();
    }, 180);
    cleanupTimers.add(timer);
  }

  function makeNoiseBuffer() {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 27091, smooth = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      smooth = .97 * smooth + .03 * ((seed / 2147483647) * 2 - 1);
      data[i] = smooth * 3;
    }
    return buffer;
  }

  function makeGraph() {
    if (!context || context.state !== 'running' || graph || !active || !enabled || destroyed) return;
    const group = { nodes: new Set(), sources: new Set(), output: context.createGain() };
    const node = value => { group.nodes.add(value); return value; };
    node(group.output).connect(compressor);
    group.output.gain.setValueAtTime(0, context.currentTime);
    group.output.gain.linearRampToValueAtTime(.3, context.currentTime + .28);
    group.node = node;
    group.source = value => {
      node(value);
      group.sources.add(value);
      value.onended = () => { group.sources.delete(value); value.disconnect(); };
      return value;
    };
    const tone = (frequency, pan) => {
      const oscillator = group.source(context.createOscillator());
      const gain = node(context.createGain());
      const panner = context.createStereoPanner ? node(context.createStereoPanner()) : null;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0;
      oscillator.connect(gain);
      if (panner) { gain.connect(panner); panner.pan.value = pan; panner.connect(group.output); }
      else gain.connect(group.output);
      oscillator.start();
      return { oscillator, gain, panner };
    };
    group.mortal = tone(82.4, -.3);
    group.immortal = tone(164.8, .3);
    group.halo = tone(330, 0);
    const wind = group.source(context.createBufferSource());
    const filter = node(context.createBiquadFilter());
    const windGain = node(context.createGain());
    wind.buffer = noiseBuffer;
    wind.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 360;
    filter.Q.value = .55;
    windGain.gain.value = 0;
    wind.connect(filter);
    filter.connect(windGain);
    windGain.connect(group.output);
    wind.start();
    group.wind = { filter, gain: windGain };
    groups.add(group);
    graph = group;
    shapeScore();
  }

  function shapeScore() {
    if (!graph || !context) return;
    const now = context.currentTime;
    const merge = ease(.16, .53, progress);
    const quiet = 1 - ease(.44, .54, progress);
    const build = .35 + ease(.025, .43, progress) * .65;
    const tail = ease(.71, .8, progress) * (1 - ease(.84, 1, progress));
    const set = (parameter, value) => parameter.setTargetAtTime(value, now, progress >= .44 && progress < impactAt ? .018 : .065);
    set(graph.mortal.oscillator.frequency, 82.4 + merge * 27.6);
    set(graph.immortal.oscillator.frequency, 164.8 - merge * 54.8);
    set(graph.halo.oscillator.frequency, 330 - merge * 110);
    set(graph.mortal.gain.gain, .17 * build * quiet + .025 * tail);
    set(graph.immortal.gain.gain, .11 * build * quiet + .018 * tail);
    set(graph.halo.gain.gain, .021 * build * quiet + .015 * tail);
    if (graph.mortal.panner) set(graph.mortal.panner.pan, -.3 * (1 - merge));
    if (graph.immortal.panner) set(graph.immortal.panner.pan, .3 * (1 - merge));
    set(graph.wind.filter.frequency, 240 + merge * 900);
    set(graph.wind.gain.gain, .095 * ease(.06, .44, progress) * quiet + .03 * tail);
  }

  function playImpact() {
    if (!graph || !context || context.state !== 'running') return;
    const group = graph, now = context.currentTime;
    const bass = group.source(context.createOscillator());
    const bassGain = group.node(context.createGain());
    bass.type = 'sine';
    bass.frequency.setValueAtTime(104, now);
    bass.frequency.exponentialRampToValueAtTime(39, now + .62);
    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(.46, now + .008);
    bassGain.gain.exponentialRampToValueAtTime(.001, now + .95);
    bass.connect(bassGain);
    bassGain.connect(group.output);
    bass.start(now);
    bass.stop(now + 1);
    const breath = group.source(context.createBufferSource());
    const filter = group.node(context.createBiquadFilter());
    const breathGain = group.node(context.createGain());
    breath.buffer = noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + .025);
    filter.frequency.exponentialRampToValueAtTime(170, now + .72);
    breathGain.gain.setValueAtTime(0, now);
    breathGain.gain.linearRampToValueAtTime(.29, now + .014);
    breathGain.gain.exponentialRampToValueAtTime(.001, now + .8);
    breath.connect(filter);
    filter.connect(breathGain);
    breathGain.connect(group.output);
    breath.start(now);
    breath.stop(now + .85);
  }

  async function activate() {
    const request = ++operation;
    if (!context || destroyed) return;
    try {
      await context.resume();
      if (request === operation && enabled && active && !destroyed) makeGraph();
    } catch { /* Browsers can suspend audio during a page lifecycle change. */ }
    finally { suspendIfIdle(); }
  }

  async function toggleSound() {
    if (destroyed || unavailable) return;
    enabled = !enabled;
    updateButton();
    if (!enabled) { ++operation; retireGraph(); return; }
    if (!context) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Audio unavailable');
        context = new AudioContextClass({ latencyHint: 'playback' });
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = .012;
        compressor.release.value = .25;
        compressor.connect(context.destination);
        noiseBuffer = makeNoiseBuffer();
      } catch {
        unavailable = true;
        enabled = false;
        context?.close().catch(() => {});
        context = null;
        updateButton();
        return;
      }
    }
    await activate();
  }

  function start(initialProgress = 0) {
    if (destroyed) return;
    ++operation;
    active = true;
    retireGraph();
    progress = clamp(initialProgress);
    impactPlayed = progress >= impactAt;
    if (enabled && context) activate();
  }

  function render(value) {
    if (!active || destroyed) return;
    const previous = progress;
    progress = clamp(value);
    shapeScore();
    if (!impactPlayed && previous < impactAt && progress >= impactAt) {
      impactPlayed = true;
      if (enabled) playImpact();
    }
  }

  function stop() {
    active = false;
    ++operation;
    retireGraph();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    active = false;
    enabled = false;
    ++operation;
    button?.removeEventListener('click', toggleSound);
    for (const timer of cleanupTimers) clearTimeout(timer);
    cleanupTimers.clear();
    for (const group of [...groups]) disposeGroup(group);
    graph = null;
    compressor?.disconnect();
    context?.close().catch(() => {});
    context = null;
    updateButton();
  }

  button?.addEventListener('click', toggleSound);
  updateButton();
  return { start, render, stop, destroy };
}
