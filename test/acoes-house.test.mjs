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
const visualNotes = section('function isSonicVisualStyle(', 'function drawSonicComposition(');
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
  ctx.createWaveShaper = () => node('shaper');
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
    soundSpacingMs: () => 10000, SOUND_CYCLE_MS: 10000, SOUND_STORAGE_KEY: 'sound', SOUND_PRESETS: { house: {}, techno: {}, hardtechno: {}, drumandbass: {}, classic: {} },
    setInterval: (fn, ms) => { const id = nextTimer++; intervals.set(id, { fn, ms }); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, ms) => { const id = nextTimer++; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout: id => timeouts.delete(id),
    playClassicSound() { r.classicCalls++; }, classicCalls: 0
  };
  vm.createContext(r);
  vm.runInContext(`${constants} ${preferences} ${normalizer} ${visualNotes} ${noise} ${engine} ${lifecycle}`, r);
  const sources = () => nodes.filter(n => n.kind === 'oscillator' || n.kind === 'noise');
  function advance(time) {
    ctx.currentTime = time;
    for (const source of sources()) {
      if (!source.ended && source.stops.at(-1) <= time) { source.ended = true; source.onended?.(); }
    }
  }
  return { r, ctx, nodes, intervals, timeouts, saved, sources, advance };
}

test('sonic artwork receives audible notes at playback time and ignores muted layers',()=>{
  for(const genre of ['house','techno','hardtechno','drumandbass']){
    const {r,ctx,advance} = runtime();
    r.state.soundPreset = genre;
    r.state.visualStyle = 'topography';
    r.state.visualArt = {random:()=>.5,index:0};
    r.initializeSonicVisualArt(r.state.visualArt,10);
    r.state.visualSoundEvents = [];
    let renders = 0;
    r.requestSonicVisualFrame = ()=>{ renders++; };
    r.state.houseLayers = {drums:true,bass:false,chords:false,lead:false};
    const originalPitch = r.state.visualArt.sound.pitch;
    const originalBass = r.state.visualArt.sound.bass;
    r.startHouseMusic();
    assert.equal(r.state.visualArt.sound.notes,0,'look-ahead scheduling must not advance the image early');
    advance(.05); r.scheduleHouseMusic();
    assert.ok(r.state.visualArt.sound.notes>0);
    assert.ok(renders>0);
    assert.ok(r.state.visualSoundEvents.every(event=>event.layer==='drums'));
    assert.equal(r.state.visualArt.sound.pitch,originalPitch);
    assert.equal(r.state.visualArt.sound.bass,originalBass);
    const count = r.state.visualArt.sound.notes;
    r.toggleHouseLayer('drums');
    advance(.45); r.scheduleHouseMusic();
    assert.equal(r.state.visualArt.sound.notes,count);
  }
});

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

test('even small moves have distinct ascending high and descending low phrases in every chord and tempo', () => {
  const { r } = runtime();
  for (const tempo of [90, 124, 140]) for (let bar = 0; bar < 4; bar++) {
    const phrase = direction => Array.from({ length: 4 }, (_, phase) => r.houseResponseNotes(bar * 16 + phase, { direction, intensity: .12 }, tempo)).flat();
    const up = phrase('up').filter(n => n.layer === 'lead');
    const down = phrase('down').filter(n => n.layer === 'lead');
    assert.ok(up.every((n, i) => i === 0 || n.midi > up[i - 1].midi));
    assert.ok(down.every((n, i) => i === 0 || n.midi < down[i - 1].midi));
    assert.ok(Math.min(...up.map(n => n.midi)) >= Math.max(...down.map(n => n.midi)) + 5);
    assert.ok(up[0].cutoff > down[0].cutoff * 4);
    assert.ok(up.every(n => n.waveform === 'triangle' && n.volume > .045 * 2.5));
    assert.ok(down.every(n => n.waveform === 'sawtooth' && n.volume > .045 * 2.5));
    assert.equal(phrase('up').filter(n => n.layer === 'bass').length, 2);
    assert.equal(r.houseResponseNotes(bar * 16, { direction: 'flat' }, tempo).length, 0);
  }
});

test('one rise or fall among thirty neutral stocks gets a full response instead of disappearing into their average', () => {
  for (const direction of ['up', 'down']) {
    const { r, sources, advance, timeouts } = runtime();
    r.mixedStocks = () => Array.from({ length: 31 }, (_, i) => ({ marketKey: 'tokyo', ticker: `STOCK${i}` }));
    r.visualIntensity = () => .12;
    r.state.movements['tokyo:STOCK0'] = direction;
    assert.ok(Math.abs(r.houseMarketProfile().balance) < .04);
    r.startHouseMusic();
    const event = { direction, intensity: .12, key: 'tokyo:STOCK0', ticker: 'STOCK0' };
    r.scheduleMainSounds();
    for (const timer of timeouts.values()) timer.fn();
    assert.equal(r.state.houseTransport.pendingMovements.length, 1);
    assert.equal(r.state.houseTransport.pendingMovements[0].intensity, .12);
    for (let i = 1; i <= 38; i++) { advance(i / 40); r.scheduleHouseMusic(); }
    assert.equal(r.state.houseTransport.lastMovement.direction, direction);
    assert.equal(r.state.houseTransport.lastMovement.ticker, 'STOCK0');
    const start = .035 + 60 / 124;
    const leadTimes = Array.from({ length: 4 }, (_, i) => start + i * 60 / 124 / 4);
    const tones = leadTimes.map((time, i) => {
      const source = sources().find(s => s.kind === 'oscillator' && Math.abs(s.starts[0] - time) < .00001 && s.frequency.events[0][1] === 440 * 2 ** ((r.houseResponseNotes(4 + i, event, 124)[0].midi - 69) / 12));
      assert.ok(source, `missing ${direction} phrase note ${i}`);
      assert.equal(source.type, direction === 'up' ? 'triangle' : 'sawtooth');
      return source.frequency.events[0][1];
    });
    assert.ok(tones.every((frequency, i) => i === 0 || (direction === 'up' ? frequency > tones[i - 1] : frequency < tones[i - 1])));
  }
});

test('adjacent opposite movements keep separate phrases on successive beats', () => {
  const { r, advance } = runtime();
  r.startHouseMusic();
  r.queueHouseMovement({ direction: 'up', ticker: 'UP' });
  r.queueHouseMovement({ direction: 'down', ticker: 'DOWN' });
  for (let i = 1; i <= 24; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.equal(r.state.houseTransport.lastMovement.direction, 'up');
  for (let i = 25; i <= 44; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.equal(r.state.houseTransport.lastMovement.direction, 'down');
});

test('comparison buttons use the same phrases, take priority and leave quotes, movements and drawings untouched', () => {
  const { r, advance, intervals } = runtime();
  r.state.quotes['tokyo:ONE'] = { price: 100 };
  r.state.movements['tokyo:ONE'] = 'flat';
  const before = JSON.stringify({ quotes: r.state.quotes, movements: r.state.movements });
  r.previewHouseMovement('up');
  r.queueHouseMovement({ direction: 'down', ticker: 'REAL' });
  assert.equal(r.state.houseTransport.pendingMovements.length, 1);
  assert.equal(r.state.houseTransport.pendingMovements[0].example, true);
  for (let i = 1; i <= 24; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.equal(r.state.houseTransport.lastMovement.direction, 'up');
  assert.equal(r.state.houseTransport.response.endStep, 20);
  r.previewHouseMovement('down');
  for (let i = 25; i <= 44; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.equal(r.state.houseTransport.lastMovement.direction, 'down');
  assert.equal(r.state.houseTransport.lastMovement.example, true);
  assert.equal(JSON.stringify({ quotes: r.state.quotes, movements: r.state.movements }), before);
  assert.equal([...intervals.values()].filter(t => t.ms === 25).length, 1);
  r.toggleHousePlayback();
  assert.equal(r.state.houseTransport, null);
  r.previewHouseMovement('up');
  assert.equal(r.state.housePaused, false);
  assert.equal(r.state.houseTransport.pendingMovements[0].direction, 'up');
});

test('crowded markets cannot build a stale backlog and a fresh comparison survives a delayed clock', () => {
  const { r, advance } = runtime();
  r.startHouseMusic();
  for (let i = 0; i < 100; i++) r.queueHouseMovement({ direction: i % 2 ? 'up' : 'down', ticker: String(i) });
  assert.equal(r.state.houseTransport.pendingMovements.length, 4);
  advance(18);
  r.previewHouseMovement('down');
  for (let i = 720; i <= 744; i++) { advance(i / 40); r.scheduleHouseMusic(); }
  assert.equal(r.state.houseTransport.lastMovement.direction, 'down');
  assert.equal(r.state.houseTransport.lastMovement.example, true);
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
  assert.equal(first.pendingMovements.at(-1).direction, 'up');
});

test('each layer can be muted immediately and an empty mix schedules no sources', () => {
  const { r, ctx, sources, advance } = runtime();
  r.startHouseMusic();
  for (const key of ['drums', 'bass', 'chords', 'lead']) {
    r.toggleHouseLayer(key);
    assert.equal(r.state.houseLayers[key], false);
    assert.deepEqual([...r.state.houseTransport.layers[key].gain.events.at(-1)], ['target', 0, ctx.currentTime]);
  }
  r.queueHouseMovement({ direction: 'down' });
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
  r.queueHouseMovement({ direction: 'up' });
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

const genres = ['house', 'techno', 'hardtechno', 'drumandbass'];
const defaults = { house: 124, techno: 134, hardtechno: 155, drumandbass: 172 };

test('four genres have distinct rhythms and instruments, including a broken Drum & Bass beat', () => {
  const { r } = runtime();
  const signatures = new Set();
  for (const genre of genres) {
    const bars = Array.from({ length: 64 }, (_, step) => r.houseStepNotes(step, { balance: 0, energy: .18, motif: 0 }, defaults[genre], genre));
    signatures.add(JSON.stringify(bars.map(notes => notes.map(({ voice, midi, waveform, drive }) => ({ voice, midi, waveform, drive })))));
    assert.deepEqual([...new Set(bars.flat().map(n => n.layer))].sort(), ['bass', 'chords', 'drums', 'lead']);
    const kicks = bars.slice(0, 16).flatMap((notes, phase) => notes.some(n => n.voice === 'kick') ? [phase] : []);
    assert.deepEqual(kicks, genre === 'drumandbass' ? [0, 6, 10] : [0, 4, 8, 12]);
    if (genre === 'drumandbass') {
      assert.deepEqual(bars.slice(16, 32).flatMap((notes, phase) => notes.some(n => n.voice === 'kick') ? [phase] : []), [0, 3, 10, 14]);
      assert.deepEqual(bars.slice(0, 16).flatMap((notes, phase) => notes.some(n => n.voice === 'snare') ? [phase] : []), [4, 12]);
    }
    assert.equal(bars.flat().some(n => n.drive > 0), genre === 'hardtechno');
    for (const note of bars.flat()) assert.ok(note.duration > 0 && note.volume > 0 && note.volume < 1);
  }
  assert.equal(signatures.size, 4, 'genre changes must change patterns and timbres, not just speed');
});

test('small rises and falls remain clearly separated in every genre and at its tempo limits', () => {
  const { r } = runtime();
  for (const genre of genres) for (const tempo of [r.normalizedHouseTempo(0, genre), r.normalizedHouseTempo(999, genre)]) for (let bar = 0; bar < 4; bar++) {
    const phrase = direction => Array.from({ length: 4 }, (_, phase) => r.houseResponseNotes(bar * 16 + phase, { direction, intensity: .12 }, tempo, genre)).flat().filter(n => n.layer === 'lead');
    const up = phrase('up');
    const down = phrase('down');
    assert.ok(up.every((n, i) => i === 0 || n.midi > up[i - 1].midi));
    assert.ok(down.every((n, i) => i === 0 || n.midi < down[i - 1].midi));
    assert.ok(Math.min(...up.map(n => n.midi)) >= Math.max(...down.map(n => n.midi)) + 5);
    assert.ok(up.every(n => n.volume > .11 && n.cutoff > down[0].cutoff * 4));
    assert.notEqual(up[0].waveform, down[0].waveform);
  }
});

test('switching genres preserves separate tempos, migrates House settings and keeps the selected mix', () => {
  const { r, saved, intervals } = runtime();
  saved.set('acoes-house-settings', '{"tempo":132,"layers":{"lead":false}}');
  assert.equal(r.storedHouseSettings().tempo, 132);
  assert.equal(r.storedHouseSettings('hardtechno').tempo, 155);
  r.state.houseTempo = 132;
  r.state.houseLayers.lead = false;
  const tempos = { house: 132, techno: 145, hardtechno: 170, drumandbass: 184 };
  for (const genre of genres) {
    r.selectSoundPreset(genre);
    assert.equal(r.state.houseTempo, genre === 'house' ? 132 : defaults[genre]);
    r.setHouseTempo(tempos[genre]);
    assert.equal(r.state.houseTransport.genre, genre);
    assert.equal([...intervals.values()].filter(timer => timer.ms === 25).length, 1);
  }
  for (const genre of genres) {
    r.selectSoundPreset(genre);
    assert.equal(r.state.houseTempo, tempos[genre]);
    assert.equal(r.storedHouseSettings(genre).tempo, tempos[genre]);
    assert.equal(r.storedHouseSettings(genre).layers.lead, false);
  }
  const restored = JSON.parse(saved.get('acoes-house-settings'));
  assert.deepEqual(restored.tempos, tempos);
  saved.set('acoes-house-settings', '{"tempos":{"techno":999,"hardtechno":-5,"drumandbass":"bad"}}');
  assert.equal(r.storedHouseSettings('techno').tempo, 160);
  assert.equal(r.storedHouseSettings('hardtechno').tempo, 130);
  assert.equal(r.storedHouseSettings('drumandbass').tempo, 172);
});

test('every genre produces audio, supports comparisons and releases notes, distortion and effects when stopped', () => {
  for (const genre of genres) {
    const { r, advance, intervals, timeouts, sources, nodes } = runtime();
    r.selectSoundPreset(genre);
    const transport = r.state.houseTransport;
    r.previewHouseMovement('down');
    for (let i = 1; i <= 240; i++) { advance(i / 40); r.scheduleHouseMusic(); }
    assert.ok(sources().length > 50);
    assert.equal(transport.lastMovement.direction, 'down');
    assert.equal(transport.lastMovement.example, true);
    assert.ok(transport.sources.size < 30, `${genre} must release completed voices`);
    assert.equal(nodes.some(node => node.kind === 'shaper'), genre === 'hardtechno');
    for (const node of nodes.filter(node => node.kind === 'shaper')) {
      assert.equal(node.oversample, '2x');
      assert.ok(node.curve.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
      assert.ok(Math.abs(node.curve[511] + node.curve[512]) < .000001);
    }
    r.toggleHousePlayback();
    assert.equal(r.state.houseTransport, null);
    assert.equal([...intervals.values()].filter(timer => timer.ms === 25).length, 0);
    advance(6.05);
    assert.equal(transport.sources.size, 0);
    assert.ok(nodes.filter(node => node.kind === 'shaper').every(node => node.disconnected));
    for (const timer of timeouts.values()) if (timer.ms === 40) timer.fn();
    assert.ok(transport.graph.every(node => node.disconnected));
  }
});

test('mixing and delayed clocks work in every genre, including the fastest supported tempo', () => {
  for (const genre of genres) {
    const { r, advance, sources } = runtime();
    r.selectSoundPreset(genre);
    r.setHouseTempo(999);
    for (const layer of ['drums', 'bass', 'chords', 'lead']) r.toggleHouseLayer(layer);
    r.previewHouseMovement('up');
    const count = sources().length;
    for (let i = 1; i <= 100; i++) { advance(i / 40); r.scheduleHouseMusic(); }
    assert.equal(sources().length, count, 'a muted mix must stay silent during comparisons');
    r.toggleHouseLayer('drums');
    advance(20);
    r.scheduleHouseMusic();
    assert.ok(sources().length - count < 10, 'a delayed clock must skip missed beats');
    assert.ok(sources().slice(count).every(source => source.starts[0] >= 20));
  }
});


test('market influence defaults to 80%, stays between 0–100 and persists across electronic genres', () => {
  const { r, saved } = runtime();
  assert.match(page, /id="houseInfluence"[^>]*min="0" max="100" step="5" value="80"/);
  assert.equal(r.storedHouseSettings().influence, 80);
  assert.equal(r.normalizedHouseInfluence(-100), 0);
  assert.equal(r.normalizedHouseInfluence(999), 100);
  assert.equal(r.normalizedHouseInfluence('invalid'), 80);
  r.setHouseInfluence(35);
  assert.equal(r.state.houseInfluence, 35);
  assert.equal(JSON.parse(saved.get('acoes-house-settings')).influence, 35);
  for (const genre of genres) assert.equal(r.storedHouseSettings(genre).influence, 35);
  r.setHouseInfluence(0);
  assert.equal(r.storedHouseSettings().influence, 0);
  r.setHouseInfluence(80);
  assert.equal(r.storedHouseSettings().influence, 80);
});

test('all electronic genres emphasize direction, strength and high market influence', () => {
  const { r } = runtime();
  for (const genre of genres) for (const direction of ['up', 'down']) {
    const phrase = (strength, influence) => Array.from({length:4},(_,i)=>
      r.houseResponseNotes(i,{direction,intensity:strength},defaults[genre],genre,influence)
    ).flat();
    const soft = phrase(.12,80).filter(n=>n.layer==='lead');
    const strong = phrase(1,80).filter(n=>n.layer==='lead');
    assert.ok(soft.length===4 && strong.length===4);
    assert.ok(soft.every(n=>n.market && n.volume>.11));
    assert.ok(strong.every(n=>n.volume>soft[0].volume));
    assert.ok(Math.abs(strong[3].midi-strong[0].midi)>Math.abs(soft[3].midi-soft[0].midi));
    assert.ok(soft.every((n,i)=>i===0 || (direction==='up' ? n.midi>soft[i-1].midi : n.midi<soft[i-1].midi)));
    assert.ok(phrase(.8,100)[0].volume>phrase(.8,20)[0].volume);
    assert.equal(phrase(.8,0).length,0,'0% must not play extra market phrases');
    const quiet=phrase(.8,20)[0].volume;
    assert.ok(quiet<phrase(.8,80)[0].volume*.55,'20% is intentionally more subtle');
  }
});

test('small real price changes are amplified only for the electronic sound, without inventing market direction', () => {
  const { r } = runtime();
  const stock={marketKey:'tokyo',ticker:'ONE'};
  assert.equal(r.marketSoundIntensity(stock), .18);
  r.state.previous['tokyo:ONE']=100;
  r.state.quotes['tokyo:ONE']={ok:true,price:100.1};
  assert.ok(r.marketSoundIntensity(stock)>.4);
  r.state.quotes['tokyo:ONE'].price=100.0001;
  assert.ok(r.marketSoundIntensity(stock)>=.12);
  r.state.quotes['tokyo:ONE'].price=101;
  assert.equal(r.marketSoundIntensity(stock),1);
});

test('market events duck backing music and play on a dedicated bus', () => {
  const { r, advance } = runtime();
  r.state.houseInfluence=80;
  r.startHouseMusic();
  const transport=r.state.houseTransport;
  assert.ok(transport.marketBus.connections.includes(transport.output));
  assert.ok(transport.bed.connections.includes(transport.output));
  assert.ok(transport.marketLayers.lead.connections.includes(transport.marketBus));
  assert.ok(transport.duck.connections.includes(transport.bed));
  r.queueHouseMovement({direction:'up',intensity:.7});
  for(let i=1;i<=27;i++){advance(i/40);r.scheduleHouseMusic();}
  assert.equal(transport.lastMovement.direction,'up');
  assert.ok(transport.bed.gain.events.some(e=>e[0]==='linear' && e[1]<.5));
  assert.ok(transport.bed.gain.events.some(e=>e[0]==='linear' && e[1]===1));
  r.toggleHouseLayer('lead');
  assert.equal(transport.marketLayers.lead.gain.events.at(-1)[1],0);
});

test('0% influence keeps the original electronic rhythm without adding melodic market events', () => {
  const { r, sources, advance }=runtime();
  r.setHouseInfluence(0);
  r.startHouseMusic();
  r.queueHouseMovement({direction:'down',intensity:1});
  assert.equal(r.state.houseTransport.pendingMovements.length,0);
  for(let i=1;i<=90;i++){advance(i/40);r.scheduleHouseMusic();}
  assert.ok(sources().length>20,'background rhythm must keep playing');
  assert.equal(r.state.houseTransport.bed.gain.events.filter(e=>e[0]==='linear').length,0);
});
