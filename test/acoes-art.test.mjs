import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');
const section = (start, end) => page.slice(page.indexOf(start), page.indexOf(end));
const generators = section('function normalizeVisualEvent(', 'function buildVisualTiles(');
const geometry = section('function buildVisualTiles(', 'function resetVisualCanvas(');
const lifecycle = section('function resetVisualCanvas(', 'function syncVisualColors(');
const drawing = section('function visualColor(', 'function paintVisualStock(');
const silhouettes = section('const VISUAL_SILHOUETTES =', 'const VISUAL_SIZE_STORAGE_KEY =');
const silhouetteShapes = vm.runInNewContext(`${silhouettes}; VISUAL_SILHOUETTES;`);
const shapeLabels = vm.runInNewContext(`${page.match(/const VISUAL_SHAPES = .*?;/)[0]}; VISUAL_SHAPES;`);
const engine = vm.runInNewContext(`${generators}; ({createVisualArt,nextVisualArt,normalizeVisualEvent});`);
const modes = ['field', 'organism', 'engraving', 'pollock'];
const events = Array.from({ length: 180 }, (_, i) => ({ direction: ['up', 'flat', 'down'][i % 3], intensity: .12 + (i % 8) / 10, key: `tokyo:${i % 30}` }));
const plain = value => JSON.parse(JSON.stringify(value));

function commands(mode, input = events, size = 10, complexity = 5, seed = 47) {
  const art = engine.createVisualArt(mode, 1080, 1920, size, complexity, seed);
  return plain(input.map(event => engine.nextVisualArt(art, event)));
}

for (const mode of modes) {
  test(`${mode} replays exactly and responds to seed, movements, magnitude and complexity`, () => {
    const baseline = commands(mode);
    assert.deepEqual(commands(mode), baseline);
    assert.notDeepEqual(commands(mode, events, 10, 5, 48), baseline);
    assert.notDeepEqual(commands(mode, events.map(e => ({ ...e, direction: 'up' }))), commands(mode, events.map(e => ({ ...e, direction: 'down' }))));
    assert.notDeepEqual(commands(mode, events.map(e => ({ ...e, intensity: .12 }))), commands(mode, events.map(e => ({ ...e, intensity: 1 }))));
    assert.notDeepEqual(commands(mode, events, 10, 1), commands(mode, events, 10, 10));
  });

  test(`${mode} stays finite and inside the canvas across sizes and complexity limits`, () => {
    for (const size of [1, 10, 30]) {
      for (const complexity of [1, 10]) {
        const art = engine.createVisualArt(mode, 1080, 1920, size, complexity, 93);
        for (let i = 0; i < 600; i++) {
          for (const command of engine.nextVisualArt(art, events[i % events.length])) {
            assert.ok(command.alpha > 0 && command.alpha <= 1);
            for (const [x, y] of command.points || [[command.x, command.y]]) {
              assert.ok(Number.isFinite(x) && x >= 0 && x <= 1080);
              assert.ok(Number.isFinite(y) && y >= 0 && y <= 1920);
            }
            assert.ok(Number.isFinite(command.size || command.width) && (command.size || command.width) > 0);
          }
        }
        assert.equal(art.index, 600);
        assert.ok(art.branches.length <= 168);
      }
    }
  });
}

test('the styles create different compositions from identical market events', () => {
  const results = modes.map(mode => JSON.stringify(commands(mode)));
  assert.equal(new Set(results).size, modes.length);
});

test('rises grow more branches than falls and neutral quotes still draw', () => {
  const count = direction => {
    const art = engine.createVisualArt('organism', 1080, 1920, 10, 5, 93);
    for (let i = 0; i < 240; i++) engine.nextVisualArt(art, { direction, intensity: .8, key: String(i % 30) });
    return art.branches.length;
  };
  assert.ok(count('up') > count('down'));
  for (const mode of modes) assert.ok(commands(mode, events.map(e => ({ ...e, direction: 'flat' }))).flat().length > 180);
  assert.deepEqual(plain(engine.normalizeVisualEvent('up')), { direction: 'up', intensity: .18, key: '' });
});

function runtime(shape = 'square') {
  let balance = 0;
  const operations = [];
  const methods = ['fillRect', 'translate', 'rotate', 'scale', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'closePath', 'fill', 'stroke'];
  const ctx = { save() { balance++; operations.push(['save']); }, restore() { balance--; operations.push(['restore']); } };
  for (const name of methods) ctx[name] = (...args) => operations.push([name, ...args]);
  const context = {
    state: { visualStyle: 'standard', visualShape: shape, visualSize: 10, visualComplexity: 5, visualSeed: 37, visualColors: { up: '#18a957', flat: '#f0c928', down: '#e3483d' }, visualEvents: [] },
    marketCanvas: { width: 1080, height: 1920, getContext: () => ctx }, detailTicker: null,
    visualStatus: {}, visualComplete: { classList: { add() {}, remove() {} } },
    visualSilhouettePaths: Object.fromEntries(Object.keys(silhouetteShapes).map(shape => [shape, `${shape}-path`])), clearVisualTimers() {},
    VISUAL_GRID_COLS: 27, VISUAL_GRID_ROWS: 48, DEFAULT_VISUAL_SIZE: 10
  };
  vm.createContext(context);
  vm.runInContext(`${page.match(/const VISUAL_SHAPES = .*?;/)[0]} ${silhouettes} ${section('const VISUAL_STYLES =', 'const DEFAULT_SOUND_VOLUME =')} ${generators} ${geometry} ${lifecycle} ${drawing}`, context);
  context.resetVisualCanvas();
  return { context, operations, balance: () => balance };
}

test('switching styles preserves event history and reconstructs the original mosaic', () => {
  const { context: r, operations, balance } = runtime();
  for (let i = 0; i < 800; i++) r.paintVisualDirection(events[i % events.length]);
  const history = plain(r.state.visualEvents);
  const original = plain(operations);
  for (const mode of modes) {
    r.state.visualStyle = mode;
    r.state.visualSize = 30;
    r.repaintVisualCanvas();
    assert.deepEqual(plain(r.state.visualEvents), history);
    assert.equal(r.state.visualIndex, r.visualTotal());
    assert.equal(r.state.visualComplete, true);
    assert.equal(balance(), 0);
  }
  operations.length = 0;
  r.state.visualStyle = 'standard';
  r.state.visualSize = 10;
  r.repaintVisualCanvas();
  assert.deepEqual(plain(r.state.visualEvents), history);
  assert.equal(r.state.visualIndex, 800);
  assert.equal(r.state.visualComplete, false);
  assert.deepEqual(plain(operations), original);
});

test('all shapes render in every style with balanced canvas state and silhouette cutouts', () => {
  for (const shape of Object.keys(shapeLabels)) {
    const { context: r, operations, balance } = runtime(shape);
    for (const mode of ['standard', ...modes]) {
      operations.length = 0;
      r.state.visualStyle = mode;
      r.resetVisualCanvas();
      for (const event of events.slice(0, 60)) r.paintVisualDirection(event);
      assert.equal(r.state.visualIndex, 60);
      assert.equal(balance(), 0);
      if (mode !== 'standard') assert.ok(operations.some(op => op[0] === 'stroke'));
      if (silhouetteShapes[shape]) assert.ok(operations.some(op => op[0] === 'fill' && op[1] === `${shape}-path` && op[2] === silhouetteShapes[shape].rule), `${shape} does not render in ${mode}`);
    }
  }
});
