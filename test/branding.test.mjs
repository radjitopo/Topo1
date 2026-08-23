import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const pages = await Promise.all([
  '../index.html',
  '../como-funciona.html',
  '../privacidade.html',
  '../termos.html'
].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

assert.match(css, /\.logo\{[^}]*color:#465e6d/, 'the TOPO wordmark must use the darker editorial blue');
assert.match(css, /\.logo::after\{[^}]*background:#c9562f/, 'the TOPO wordmark must keep the orange dot');
assert.match(css, /\.siteFooterBrand::after\{[^}]*background:#c9562f/, 'the footer must use the same brand signature');
assert.ok(pages.every((page) => page.includes('/style.css?v=20260823-11')), 'every public page must load the current brand stylesheet');

console.log('Branding test passed: darker blue wordmark and orange dot are consistent.');
