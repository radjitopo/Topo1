import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

assert.match(
  css,
  /\.categoryRankTitle h2\{[^}]*font:900 22px\/1\.1 Georgia[^}]*padding-bottom:\.14em/,
  'clamped ranking titles need enough line height and descender space'
);
assert.match(
  css,
  /\.highlightTitle\{[^}]*line-height:1\.12[^}]*padding-bottom:\.1em/,
  'clamped highlight titles need enough descender space'
);
assert.match(
  css,
  /\.homeName\{[^}]*line-height:1\.18/,
  'single-line ranking options must not clip low letters'
);

console.log('Typography test passed: clipped descenders remain visible in compact titles.');
