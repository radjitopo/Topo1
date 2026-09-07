import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderDiscoverPage } from '../page.js';

const root = new URL('../', import.meta.url);
const [template, appSource, cssSource, vercelConfig] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('editorial-clean.css', root), 'utf8'),
  readFile(new URL('vercel.json', root), 'utf8'),
]);

test('Descobrir is a distinct primary experience after TOPO LOCAL', () => {
  assert.match(
    template,
    /data-experience="local"[\s\S]*data-experience="discover" href="\/descobrir">DESCOBRIR<\/a>/,
  );
  assert.match(vercelConfig, /"src": "\/descobrir\/\?"/);
  assert.match(appSource, /experience = discover \? 'discover'/);
});

test('the home introduces editorial rankings after TOPO LOCAL', () => {
  assert.match(appSource, /\$\{popLocalCalloutHTML\(\)\}\$\{discoverHomeCalloutHTML\(\)\}/);
  assert.match(appSource, /RANKINGS PARA LER/);
  assert.match(appSource, /Histórias, contexto e informação — sem votação\./);
  assert.doesNotMatch(appSource, /MAIS PARA DESCOBRIR|PARA DESCOBRIR/);
});

test('the empty editorial page is crawl-safe and has no voting controls', () => {
  const html = renderDiscoverPage(template);
  assert.match(html, /<body class="popElectric homePage discoverPage">/);
  assert.match(html, /<h1 id="discover-page-title">Descobrir<\/h1>/);
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.match(html, /Os primeiros rankings editoriais chegam em breve\./);
  assert.doesNotMatch(html, /class="react|data-duel|votos/);
});

test('Descobrir has responsive desktop and mobile styling', () => {
  assert.match(cssSource, /\.discoverHomeCallout/);
  assert.match(cssSource, /\.discoverPageHero/);
  assert.match(
    cssSource,
    /@media \(max-width: 700px\)[\s\S]*\.discoverPrinciples[\s\S]*grid-template-columns: minmax\(0, 1fr\)/,
  );
  assert.match(cssSource, /localMode \.experienceInner \{[\s\S]*?flex-wrap: wrap/);
});
