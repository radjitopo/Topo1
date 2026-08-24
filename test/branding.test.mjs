import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const pages = await Promise.all(
  ['../index.html', '../institutional.js'].map((path) =>
    readFile(new URL(path, import.meta.url), 'utf8'),
  ),
);
const compactCss = compactSource(css);

assert.match(
  compactCss,
  /\.logo\{[^}]*color:#465e6d/,
  'the TOPO wordmark must use the darker editorial blue',
);
assert.match(
  compactCss,
  /\.logo::after\{[^}]*background:#c9562f/,
  'the TOPO wordmark must keep the orange dot',
);
assert.match(
  compactCss,
  /\.siteFooterBrand::after\{[^}]*background:#c9562f/,
  'the footer must use the same brand signature',
);
assert.doesNotMatch(
  compactCss,
  /\.homePage \.logo\{/,
  'the Home and ranking pages must share the same logo sizing rules',
);
assert.ok(
  pages.every((page) => page.includes('/style.css?v=20260824-2')),
  'every public page must load the current brand stylesheet',
);

console.log('Branding test passed: darker blue wordmark and orange dot are consistent.');
