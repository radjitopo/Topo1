import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [logo, mark, popCss, index, institutional] = await Promise.all(
  [
    '../logo-topo.svg',
    '../topo-mark.svg',
    '../pop-electric.css',
    '../index.html',
    '../institutional.js',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
);
const compactPopCss = compactSource(popCss);

assert.match(logo, /fill="#ff5a45"/, 'the master logo must keep the coral seal');
assert.match(logo, /fill="#ff2d8d"/, 'the master logo must keep the hot-pink signature');
assert.match(logo, /fill="#c7ff38"/, 'the last O must carry the lime signal');
assert.match(logo, /stroke="#151019"/, 'the upward signal must be drawn inside the last O');
assert.match(mark, /fill="#ff5a45"/);
assert.match(mark, /fill="#c7ff38"/);

assert.doesNotMatch(index, /class="logo"[^>]*>TOPO</, 'the header logo must never be typed text');
assert.equal(
  (index.match(/src="\/logo-topo\.svg"/g) || []).length,
  2,
  'the header and footer must use the same master SVG',
);
assert.match(institutional, /class="logo"[^>]*><img src="\/logo-topo\.svg"/);
assert.match(institutional, /class="siteFooterBrand"[^>]*><img src="\/logo-topo\.svg"/);
assert.ok(index.includes('/pop-electric.css?v=20260825-12-seo'));
assert.ok(institutional.includes('/pop-electric.css?v=20260825-12-seo'));
assert.match(index, /name="theme-color" content="#fffdf8"/);
assert.match(
  compactPopCss,
  /--cream:#fffdf8;--paper:#ffffff;--ink:#151019;--muted:#68616f;--line:#151019;--violet:#151019;--violet-dark:#151019;--pink:#ff5a45;--mint:#c7ff38;--lilac:#eee8e2;--accent:#ff2d8d;--gold:#f5b800/,
  'the public shell must stay black and white with coral, lime, pink and gold accents',
);
assert.match(
  index,
  /class="brandSlogan" aria-label="Tudo vira ranking\."><span>Tudo<\/span><span>vira<\/span><span>ranking\.<\/span><\/span>/,
  'the slogan must be a deliberate lockup directly below the master logo',
);

assert.match(
  compactPopCss,
  /\.popElectric\.logo\{[^}]*width:168px/,
  'the master logo needs one shared desktop size rule',
);
assert.match(
  compactPopCss,
  /\.popElectric\.brandBlock\{[^}]*width:168px[\s\S]*\.popElectric\.brandSlogan\{[^}]*width:100%[^}]*display:flex[^}]*justify-content:space-between/,
  'the slogan must span exactly the same visual width as the logo lockup',
);
assert.doesNotMatch(
  compactPopCss,
  /\.homePage\.logo\{/,
  'Home and ranking pages must not use different logo sizing rules',
);
assert.match(
  compactPopCss,
  /@media\(max-width:700px\)[\s\S]*grid-template-columns:116pxminmax\(0,1fr\)auto[\s\S]*\.popElectric\.homePage\.siteSearch[^}]*grid-column:2;grid-row:1/,
  'the mobile search must stay in the header row instead of colliding with the experience switch',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*grid-template-rows:autoauto[\s\S]*\.popElectric\.homePage\.siteSearch[^}]*grid-column:1\/-1;grid-row:2/,
  'compact phones need a dedicated full-width search row',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.categorySorts\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[^}]*overflow:visible/,
  'the four category filters must fit in a two-by-two mobile grid',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.categoryRankCard\{[^}]*display:flex;flex-direction:column[\s\S]*\.popElectric\.categoryRankTitleh2[^}]*-webkit-line-clamp:unset/,
  'compact cards must stack vertically and show their complete title',
);
assert.match(
  compactPopCss,
  /@media\(max-width:700px\)[\s\S]*\.popElectric\.accountLink:not\(\.accountEnter\)\{[^}]*display:inline-flex[^}]*font-size:11px/,
  'signed-in mobile users must keep a visible profile entry beside the bell',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.portalSectionHead\{[^}]*display:block[\s\S]*\.popElectric\.portalShuffle\{[^}]*width:max-content[^}]*min-height:36px[^}]*font-size:10px/,
  'the mobile shuffle control must stay compact below its section title',
);
assert.match(
  compactPopCss,
  /@media\(max-width:700px\)[\s\S]*\.popElectric\.popHomeLead\{[^}]*grid-template-columns:1fr[^}]*gap:13px[\s\S]*\.popElectric\.popHomeLead\.portalHeroLink\{[^}]*min-height:330px[\s\S]*\.popElectric\.popHomeLead\.portalSideColumn\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'the restored editorial lead must stack the main ranking before two compact supporting rankings',
);
assert.doesNotMatch(
  compactPopCss,
  /\.popHomeHero|\.popHomeActions|\.popHomePulse/,
  'the repeated explanatory hero must leave no dead visual rules behind',
);
assert.doesNotMatch(
  compactPopCss,
  /\.popElectricheader(?:,|\{)/,
  'global header sizing must never affect internal headers such as moderation',
);
assert.match(
  compactPopCss,
  /\.popElectric\.profileProgressTextstrong\{[^}]*color:var\(--cream\)/,
  'profile progress emphasis must remain readable over the near-black hero',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.profileMetrics\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'profile metrics must form a balanced two-by-two grid on phones',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.moderationCounts\{[^}]*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[\s\S]*\.popElectric\.moderationCardh3\{[^}]*font-size:22px/,
  'moderation counts and cards must use the compact mobile composition',
);

console.log('Branding test passed: the coral 4A seal is one SVG across every public shell.');
