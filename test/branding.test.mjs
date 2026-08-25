import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [logo, mark, popCss, index, institutional] = await Promise.all(
  ['../logo-topo.svg', '../topo-mark.svg', '../pop-electric.css', '../index.html', '../institutional.js'].map(
    (path) => readFile(new URL(path, import.meta.url), 'utf8'),
  ),
);
const compactPopCss = compactSource(popCss);

assert.match(logo, /fill="#4a0790"/, 'the beta master logo must keep the violet seal');
assert.match(logo, /fill="#ff2f87"/, 'the beta master logo must keep the pink signature');
assert.match(logo, /fill="#78f5ad"/, 'the last O must carry the mint signal');
assert.match(logo, /stroke="#26004f"/, 'the upward signal must be drawn inside the last O');
assert.match(mark, /fill="#4a0790"/);
assert.match(mark, /fill="#78f5ad"/);

assert.doesNotMatch(index, /class="logo"[^>]*>TOPO</, 'the header logo must never be typed text');
assert.equal(
  (index.match(/src="\/logo-topo\.svg"/g) || []).length,
  2,
  'the header and footer must use the same master SVG',
);
assert.match(institutional, /class="logo"[^>]*><img src="\/logo-topo\.svg"/);
assert.match(institutional, /class="siteFooterBrand"[^>]*><img src="\/logo-topo\.svg"/);
assert.ok(index.includes('/pop-electric.css?v=20260824-1'));
assert.ok(institutional.includes('/pop-electric.css?v=20260824-1'));

assert.match(
  compactPopCss,
  /\.popElectric\.logo\{[^}]*width:168px/,
  'the master logo needs one shared desktop size rule',
);
assert.doesNotMatch(
  compactPopCss,
  /\.homePage\.logo\{/,
  'Home and ranking pages must not use different logo sizing rules',
);

console.log('Branding test passed: the 4A beta seal is one SVG across every public shell.');
