import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('the complete Topo Local city page can be shared directly', async () => {
  const [app, css, index] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);

  assert.match(app, /data-share-local-city/);
  assert.match(app, /Compartilhar \$\{escapeHTML\(localCityShareLabel\(city\)\)\}/);
  assert.match(app, /city === 'Florianópolis' \? 'Floripa' : city/);
  assert.match(app, /topoLocal\.collectionPath\(city\)/);
  assert.match(app, /Veja e vote nos melhores lugares de \$\{city\} no TOPO\./);
  assert.match(app, /await navigator\.share\(data\)/);
  assert.match(app, /await navigator\.clipboard\.writeText\(url\)/);
  assert.match(app, /local && isAll \? localCityShareHTML\(\) : ''/);
  assert.match(css, /\.localCityShareButton/);
  assert.match(index, /mobile-duel-first-fold-local-city-share/);
  assert.match(index, /unexplored-rankings-first-local-city-share/);
});
