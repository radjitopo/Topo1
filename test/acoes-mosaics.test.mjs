import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');
const geometry = page.slice(page.indexOf('function buildVisualTiles('), page.indexOf('function resetVisualCanvas('));
const buildTiles = vm.runInNewContext(`const VISUAL_GRID_COLS = 27; const VISUAL_GRID_ROWS = 48; const DEFAULT_VISUAL_SIZE = 10; ${geometry}; buildVisualTiles;`);

function contains(tile, x, y) {
  const points = tile.points;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function area(tile) {
  if (tile.radius) return Math.PI * tile.radius ** 2;
  return Math.abs(tile.points.reduce((sum, p, i, points) => {
    const next = points[(i + 1) % points.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0)) / 2;
}

for (const shape of ['circle', 'star']) {
  test(`${shape} pieces stay separate and scale at sizes 1, 10 and 20`, () => {
    const standard = buildTiles(shape, 1080, 1920, 10);
    assert.ok(standard.length > 1200);
    const radius = tile => tile.radius || Math.max(...tile.points.map(p => Math.hypot(p[0] - tile.x, p[1] - tile.y)));
    const bucketSize = radius(standard[0]) * 2;
    const buckets = new Map();
    for (const tile of standard) {
      const r = radius(tile);
      assert.ok(Number.isFinite(tile.x) && Number.isFinite(tile.y) && r > 0);
      if (shape === 'star') {
        assert.equal(tile.points.length, 10);
        const distances = tile.points.map(p => Math.hypot(p[0] - tile.x, p[1] - tile.y));
        assert.equal(distances.filter(d => Math.abs(d - r) < 1e-7).length, 5);
        assert.equal(distances.filter(d => d < r / 2).length, 5);
      }
      const bx = Math.floor(tile.x / bucketSize);
      const by = Math.floor(tile.y / bucketSize);
      for (let x = bx - 1; x <= bx + 1; x++) {
        for (let y = by - 1; y <= by + 1; y++) {
          for (const neighbor of buckets.get(`${x},${y}`) || []) {
            assert.ok(Math.hypot(tile.x - neighbor.x, tile.y - neighbor.y) >= r + radius(neighbor) - 1e-7, `${shape} pieces overlap`);
          }
        }
      }
      const key = `${bx},${by}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(tile);
    }
    for (const size of [1, 20]) {
      const tiles = buildTiles(shape, 1080, 1920, size);
      assert.ok(Math.abs(area(tiles[0]) / area(standard[0]) - (size / 10) ** 2) < 1e-9);
      assert.ok(size === 1 ? tiles.length > standard.length * 90 : tiles.length < standard.length / 3);
    }
  });
}

// Bucket polygons by their bounds so even the 1-size mosaics can be sampled densely.
function coverage(tiles, xs, ys, shape) {
  const buckets = new Map();
  const cell = 40;
  for (const tile of tiles) {
    const px = tile.points.map(p => p[0]);
    const py = tile.points.map(p => p[1]);
    for (let x = Math.max(0, Math.floor(Math.min(...px) / cell)); x <= Math.min(26, Math.floor(Math.max(...px) / cell)); x++) {
      for (let y = Math.max(0, Math.floor(Math.min(...py) / cell)); y <= Math.min(47, Math.floor(Math.max(...py) / cell)); y++) {
        const key = `${x},${y}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(tile);
      }
    }
  }
  for (const x of xs) {
    for (const y of ys) {
      const nearby = buckets.get(`${Math.floor(x / cell)},${Math.floor(y / cell)}`) || [];
      assert.equal(nearby.filter(tile => contains(tile, x, y)).length, 1, `${shape} does not fit at ${x}, ${y}`);
    }
  }
}

for (const [shape, sides] of [['square', 4], ['triangle', 3], ['pentagon', 5], ['hexagon', 6]]) {
  test(`${shape} pieces are convex and fit across the entire Story without gaps or overlap`, () => {
    const tiles = buildTiles(shape, 1080, 1920);
    assert.ok(tiles.length >= 1296 && tiles.length < 1500);
    for (const tile of tiles) {
      assert.equal(tile.points.length, sides);
      let sign;
      for (let i = 0; i < sides; i++) {
        const a = tile.points[i];
        const b = tile.points[(i + 1) % sides];
        const c = tile.points[(i + 2) % sides];
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        assert.ok(Math.abs(cross) > 0.0001);
        sign ??= Math.sign(cross);
        assert.equal(Math.sign(cross), sign);
      }
    }
    const xs = [.173, 1079.831];
    const ys = [.193, 1919.827];
    for (let x = 11.927; x < 1080; x += 33.311) xs.push(x);
    for (let y = 7.173; y < 1920; y += 37.713) ys.push(y);
    coverage(tiles, xs, ys, shape);
  });

  test(`${shape} size 1 and 20 scale the pieces and still cover the Story`, () => {
    const standard = buildTiles(shape, 1080, 1920, 10);
    for (const size of [1, 20]) {
      const tiles = buildTiles(shape, 1080, 1920, size);
      assert.ok(Math.abs(area(tiles[0]) / area(standard[0]) - (size / 10) ** 2) < 1e-9);
      assert.ok(size === 1 ? tiles.length > standard.length * 90 : tiles.length < standard.length / 3);
      coverage(tiles, [.173, 11.927, 177.331, 540.713, 1001.927, 1079.831], [.193, 7.173, 449.713, 960.927, 1801.331, 1919.827], `${shape} size ${size}`);
    }
  });
}
