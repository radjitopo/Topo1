import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [logo, mark, popCss, editorialCss, index, institutional, page] = await Promise.all(
  [
    '../logo-topo-v2.svg',
    '../topo-mark-v2.svg',
    '../pop-electric.css',
    '../editorial-clean.css',
    '../index.html',
    '../institutional.js',
    '../page.js',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
);
const compactPopCss = compactSource(popCss);
const compactEditorialCss = compactSource(editorialCss);

assert.match(logo, /<g fill="#0a0a0a">/, 'the master wordmark must be black');
assert.match(
  logo,
  /<circle cx="584" cy="123" r="18"\/>/,
  'the final point must be part of the wordmark',
);
assert.match(logo, /stroke="#fff"/, 'the final point must carry a white upward arrow');
assert.doesNotMatch(logo, /#ff5a45|#ff2d8d|#c7ff38/, 'the master logo must stay monochrome');
assert.match(mark, /<circle cx="50" cy="50" r="45" fill="#0a0a0a"\/>/);
assert.match(mark, /stroke="#fff"/);

assert.doesNotMatch(index, /class="logo"[^>]*>TOPO</, 'the header logo must never be typed text');
assert.equal(
  (index.match(/src="\/logo-topo-v2\.svg"/g) || []).length,
  2,
  'the header and footer must use the same master SVG',
);
assert.match(institutional, /class="logo"[^>]*><img src="\/logo-topo-v2\.svg"/);
assert.match(institutional, /class="siteFooterBrand"[^>]*><img src="\/logo-topo-v2\.svg"/);
assert.match(index, /href="\/topo-mark-v2\.svg"/);
assert.match(index, /https:\/\/somostopo\.com\.br\/og-topo-v2\.png/);
assert.match(institutional, /\/og-topo-v2\.png/);
assert.match(page, /\/topo-mark-v2\.svg/);
assert.match(page, /\/og-topo-v2\.png/);
for (const shell of [index, institutional, page]) {
  assert.doesNotMatch(shell, /(?:logo-topo|topo-mark)\.svg|og-topo\.png/);
}
assert.ok(index.includes('/pop-electric.css?v=20260825-12-seo'));
assert.ok(index.includes('/editorial-clean.css?v=20260825-7-no-home-flash'));
assert.ok(institutional.includes('/pop-electric.css?v=20260825-12-seo'));
assert.ok(institutional.includes('/editorial-clean.css?v=20260825-7-no-home-flash'));
assert.match(index, /name="theme-color" content="#fffdf8"/);
assert.match(
  compactPopCss,
  /--cream:#fffdf8;--paper:#ffffff;--ink:#151019;--muted:#68616f;--line:#151019;--violet:#151019;--violet-dark:#151019;--pink:#ff5a45;--mint:#c7ff38;--lilac:#eee8e2;--accent:#ff2d8d;--gold:#f5b800/,
  'the public shell must stay black and white with coral, lime, pink and gold accents',
);
assert.match(
  index,
  /class="brandSlogan">Tudo vira ranking\.<\/span>/,
  'the slogan must read as one continuous phrase below the master logo',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.siteFooterBrandimg,body\.legalShell\.siteFooterBrandimg\{filter:invert\(1\)/,
  'the monochrome logo must invert cleanly over the dark footer',
);

assert.match(
  compactPopCss,
  /\.popElectric\.logo\{[^}]*width:168px/,
  'the master logo needs one shared desktop size rule',
);
assert.match(
  compactPopCss,
  /\.popElectric\.brandBlock\{[^}]*width:168px[\s\S]*\.popElectric\.brandSlogan\{[^}]*width:100%[^}]*display:block/,
  'the slogan must stay compact instead of spreading its words across the logo width',
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

console.log('Branding test passed: the black TOPO wordmark and arrow point are consistent.');
