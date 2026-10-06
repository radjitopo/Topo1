import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');
const section = (start, end) => page.slice(page.indexOf(start), page.indexOf(end));
const constants = section('const HOUSE_LAYERS =', 'const pathParts =');
const preferences = section('function normalizedHouseTempo(', 'function storedVisualColors(');
const engine = section('function houseStocks(', 'function playMoveSound(');
const lifecycle = section('function playMoveSound(', 'function money(');
const normalizer = section('function normalizeVisualEvent(', 'function createVisualArt(');
const noise = section('function getSambaNoiseBuffer(', 'function playSambaSound(');

function runtime() {
  const nodes = [];
  const intervals = new Map();
  const timeouts = new Map();
  const saved = new Map();
  let nextTimer = 1;
  const ctx = { currentTime: 0, state: 'running', sampleRate: 48000 };
  const param = () => ({
    events: [],
    setValueAtTime(value, time) { this.record('set', value, time); },
    exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); this.record('exp', value, time); },
    linearRampToValueAtTime(value, time) { this.record('linear', value, time); },
    setTargetAtTime(value, time, constant) { assert.ok(constant > 0); this.record('target', value, time); },
    cancelScheduledValues(time) { assert.ok(Number.isFinite(time)); this.events.push(['cancel', time]); },
    record(method, value, time) { assert.ok(Number.isFinite(value) && Number.isFinite(time) && time >= 0); this.events.push([method, value, time]); }
  });
  function node(kind) {
    const n = { kind, connections: [], starts: [], stops: [], disconnected: false,
      gain: param(), frequency: param(), Q: param(), detune: param(), delayTime: param(),
      connect(to) { assert.ok(to); this.connections.push(to); },
      disconnect() { this.disconnected = true; },
      start(time) { assert.ok(time >= ctx.currentTime); this.starts.push(time); },
      stop(time) { assert.ok(Number.isFinite(time)); this.stops.push(time); }
    };
    nodes.push(n);
    return n;
  }
  ctx.createGain = () => node('gain');
  ctx.createAnalyser = () => Object.assign(node('analyser'), { getByteTimeDomainData: samples => samples.fill(128) });
  ctx.createOscillator = () => node('oscillator');
  ctx.createBufferSource = () => node('noise');
  ctx.createBiquadFilter = () => node('filter');
  ctx.createDelay = () => node('delay');
  ctx.createBuffer = (channels, length, sampleRate) => ({ sampleRate, getChannelData: () => new Float32Array(length) });
  const output = node('master');
  const r = { state: { soundPreset: 'house', audioReady: true, audioCtx: ctx, houseTempo: 124,
      houseLayers: { drums: true, bass: true, chords: true, lead: true }, housePaused: false, houseTransport: null,
      movements: {}, quotes: {}, previous: {}, market: 'tokyo', selected: ['tokyo'], soundTimers: [], soundPreviewTimers: [], soundPreviewResumeTimer: null, soundCycleTimer: null },
    detailTicker: null,
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    mixedStocks: () => r.state.selected.map(marketKey => ({ marketKey, ticker: 'ONE' })),
    selectedMarketKeys: () => r.state.selected,
    stockKey: (market, ticker) => `${market}:${ticker}`,
    visualIntensity: () => .18,
    setupAudioOutput: () => output,
    unlockAudio: () => true, render() {}, showToast() {}, clearVisualTimers() {}, paintVisualStock() {},
    soundSpacingMs: () => 10000, SOUND_CYCLE_MS: 10000, SOUND_STORAGE_KEY: 'sound', SOUND_PRESETS: { house: {}, classic: {} },
    setInterval: (fn, ms) => { const id = nextTimer++; intervals.set(id, { fn, ms }); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, ms) => { const id = nextTimer++; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    playClassicSound() { r.classicCalls++; }, classicCalls: 0
  };
  vm.createContext(r);
  vm.runInContext(`${constants} ${preferences} ${normalizer} ${noise} ${engine} ${lifecycle}`, r);
  const sources = () => nodes.filter(n => n.kind === 'oscillator' || n.kind === 'noise');
  function advance(time) {
    ctx.currentTime = time;
    for (const source of sources()) {
      if (!source.ended && source.stops.at(-1) <= time) { source.ended = true; source.onended?.(); }
    }
  }
  return { r, ctx, nodes, intervals, timeouts, saved, sources, advance };
}

test('four-on-the-floor beat and backbeat share one clock at every supported tempo', () => {
  const { r } = runtime();
  for (const tempo of [90, 124, 140]) {
    const bar = Array.from({ length: 16 }, (_, step) => r.houseStepNotes(step, { balance: 0, energy: .18, motif: 0 }, tempo));
    assert.deepEqual(bar.flatMap((notes, step) => notes.some(n => n.voice === 'kick') ? [step] : []), [0, 4, 8, 12]);
    assert.deepEqual(bar.flatMap((notes, step) => notes.some(n => n.voice === 'clap') ? [step] : []), [4, 12]);
    assert.deepEqual([...new Set(bar.flat().map(n => n.layer))].sort(), ['bass', 'chords', 'drums', 'lead']);
    for (const note of bar.flat()) assert.ok(note.duration > 0 && note.volume > 0 && note.volume < 1);
  }
});

test('rises open the sound and add detail; falls lower the bass; neutral markets keep playing', () => {
  const { r } = runtime();
  const profile = direction => r.houseProfileFromEvents([{ direction, intensity: .18, key: 'tokyo:ONE' }]);
  const song = direction => Array.from({ length: 64 }, (_, step) => r.houseStepNotes(step, profile(direction), 124)).flat();
  const up = song('up');
  const down = song('down');
  assert.ok(up.filter(n => n.voice === 'hat').length > down.filter(n => n.voice === 'hat').length);
  assert.ok(up.find(n => n.voice === 'bass').midi > down.find(n => n.voice === 'bass').midi);
  assert.ok(up.find(n => n.voice === 'chord').cutoff > down.find(n => n.voice === 'chord').cutoff);
  assert.ok(song('flat').length > 50);
  assert.ok(r.houseProfileFromEvents([{ direction: 'up', intensity: 1 }]).energy > r.houseProfileFromEvents([{ direction: 'up', intensity: .12 }]).energy);
});

test('one transport schedules all layers on the audio clock without duplicating loops or quote beeps', () => {
  const { r, intervals, sources, advance } = runtime();
  r.startMainSoundCycle();
  const first = r.state.houseTransport;
  r.startMainSoundCycle();
  assert.equal(r.state.houseTransport, first);
  assert.equal([...intervals.values()].filter(t => t.ms === 25).length, 1);
  for (let i = 1; i <= 320; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.ok(sources().length > 70);
  assert.ok(sources().some(source => source.kind === 'noise'));
  assert.ok(first.step > 60);
  assert.ok(first.sources.size < 20, 'ended voices must be released');
  const count = sources().length;
  r.playMoveSound('up', .2);
  assert.equal(sources().length, count);
});

test('each layer can be muted immediately and an empty mix schedules no sources', () => {
  const { r, ctx, sources, advance } = runtime();
  r.startHouseMusic();
  for (const key of ['drums', 'bass', 'chords', 'lead']) {
    r.toggleHouseLayer(key);
    assert.equal(r.state.houseLayers[key], false);
    assert.deepEqual([...r.state.houseTransport.layers[key].gain.events.at(-1)], ['target', 0, ctx.currentTime]);
  }
  const count = sources().length;
  for (let i = 1; i <= 80; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.equal(sources().length, count);
  r.toggleHouseLayer('lead');
  for (let i = 81; i <= 160; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.ok(sources().length > count);
  assert.ok(sources().slice(count).every(source => source.kind === 'oscillator' && source.type === 'triangle'));
});

test('pause, preset changes and market deselection stop queued notes and disconnect the graph', () => {
  const { r, ctx, intervals, timeouts, advance, sources } = runtime();
  r.startMainSoundCycle();
  advance(.3);
  r.scheduleHouseMusic();
  const old = r.state.houseTransport;
  r.toggleHousePlayback();
  assert.equal(r.state.houseTransport, null);
  assert.equal(r.state.housePaused, true);
  assert.equal([...intervals.values()].filter(t => t.ms === 25).length, 0);
  assert.ok([...old.sources].every(source => source.stops.at(-1) <= ctx.currentTime + .025));
  for (const [id, timer] of timeouts) if (timer.ms === 40) { timeouts.delete(id); timer.fn(); }
  assert.ok(old.graph.every(node => node.disconnected));
  r.toggleHousePlayback();
  assert.ok(r.state.houseTransport);
  r.selectSoundPreset('classic');
  assert.equal(r.state.houseTransport, null);
  r.playMoveSound('up');
  assert.equal(r.classicCalls, 1);
  r.selectSoundPreset('house');
  assert.ok(r.state.houseTransport);
  r.state.selected = [];
  r.restartMainSoundCycle();
  assert.equal(r.state.houseTransport, null);
  assert.equal(intervals.size, 0);
  assert.ok(sources().length > 0);
});

test('a delayed scheduler skips old beats rather than playing a burst, and suspended contexts stay silent', () => {
  const { r, ctx, sources, advance } = runtime();
  r.startHouseMusic();
  const before = sources().length;
  advance(18);
  r.scheduleHouseMusic();
  assert.ok(sources().length - before < 10);
  assert.ok(sources().slice(before).every(source => source.starts[0] >= 18));
  assert.ok(r.state.houseTransport.step > 120);
  ctx.state = 'suspended';
  const suspendedCount = sources().length;
  r.scheduleHouseMusic();
  assert.equal(sources().length, suspendedCount);
});

test('tempo and selected layers survive reload, sanitize saved values and do not unlock audio', () => {
  const { r, saved, sources } = runtime();
  r.setHouseTempo(132);
  r.toggleHouseLayer('chords');
  const restored = r.storedHouseSettings();
  assert.equal(restored.tempo, 132);
  assert.equal(restored.layers.chords, false);
  assert.equal(restored.layers.bass, true);
  assert.equal(sources().length, 0);
  saved.set('acoes-house-settings', '{"tempo":900,"layers":{"bass":false}}');
  assert.equal(r.storedHouseSettings().tempo, 140);
  assert.equal(r.storedHouseSettings().layers.bass, false);
  assert.equal(r.storedHouseSettings().layers.lead, true);
  saved.set('acoes-house-settings', 'null');
  assert.equal(r.storedHouseSettings().tempo, 124);
  assert.equal(r.normalizedHouseTempo('oops'), 124);
  r.state.audioReady = false;
  r.startHouseMusic();
  assert.equal(r.state.houseTransport, null);
});
