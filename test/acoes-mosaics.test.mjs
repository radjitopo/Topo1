import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');
const geometry = page.slice(page.indexOf('function buildVisualTiles('), page.indexOf('function resetVisualCanvas('));
const buildTiles = vm.runInNewContext(`const VISUAL_GRID_COLS = 27; const VISUAL_GRID_ROWS = 48; ${geometry}; buildVisualTiles;`);

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
    for (const x of xs) {
      for (const y of ys) {
        assert.equal(tiles.filter(tile => contains(tile, x, y)).length, 1, `${shape} does not fit at ${x}, ${y}`);
      }
    }
  });
}
