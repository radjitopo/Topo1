import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

const fixedTextSizes = [...css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((match) =>
  Number(match[1]),
);
assert.ok(
  fixedTextSizes.every((size) => size >= 8),
  'small labels and metadata must remain legible across the site',
);

assert.match(
  css,
  /\.categoryRankTitle h2\s*\{[^}]*font:\s*900 22px\/1\.1 Georgia[^}]*padding-bottom:\s*0\.14em/,
  'clamped ranking titles need enough line height and descender space',
);
assert.match(
  css,
  /\.homeName\s*\{[^}]*line-height:\s*1\.18/,
  'single-line ranking options must not clip low letters',
);

console.log('Typography test passed: clipped descenders remain visible in compact titles.');
