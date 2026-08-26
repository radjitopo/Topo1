import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [logo, footerLogo, mark, popCss, editorialCss, index, institutional, page] =
  await Promise.all(
    [
      '../logo-topo-v3.svg',
      '../logo-topo-footer-v3.svg',
      '../topo-mark-v3.svg',
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
  /<ellipse cx="476" cy="82" rx="68" ry="64" fill="#73857c"\/>/,
  'the final O must be the sage upward-arrow symbol',
);
assert.doesNotMatch(logo, /cx="584"/, 'the arrow must not sit outside the wordmark');
assert.match(logo, /stroke="#fff"/, 'the final O must carry a white upward arrow');
assert.match(footerLogo, /<g fill="#fff">/, 'the dark footer needs a white wordmark');
assert.match(footerLogo, /fill="#73857c"/, 'the footer must preserve the sage final O');
assert.match(mark, /<circle cx="50" cy="50" r="45" fill="#73857c"\/>/);
assert.match(mark, /stroke="#fff"/);

assert.doesNotMatch(index, /class="logo"[^>]*>TOPO</, 'the header logo must never be typed text');
assert.equal(
  (index.match(/src="\/logo-topo-v3\.svg"/g) || []).length,
  1,
  'the header must use the sage integrated wordmark',
);
assert.match(index, /class="siteFooterBrand"[^>]*><img src="\/logo-topo-footer-v3\.svg"/);
assert.match(institutional, /class="logo"[^>]*><img src="\/logo-topo-v3\.svg"/);
assert.match(institutional, /class="siteFooterBrand"[^>]*><img src="\/logo-topo-footer-v3\.svg"/);
assert.match(index, /href="\/topo-mark-v3\.svg"/);
assert.match(index, /https:\/\/somostopo\.com\.br\/og-topo-v2\.png/);
assert.match(institutional, /\/og-topo-v2\.png/);
assert.match(page, /\/topo-mark-v3\.svg/);
assert.match(page, /\/og-topo-v2\.png/);
for (const shell of [index, institutional, page]) {
  assert.doesNotMatch(shell, /(?:logo-topo|topo-mark)\.svg|og-topo\.png/);
}
assert.ok(index.includes('/pop-electric.css?v=20260826-13-compact-categories'));
assert.ok(index.includes('/editorial-clean.css?v=20260826-18-related-cards'));
assert.ok(index.includes('/app.js?v=20260826-41-preview-navigation'));
assert.ok(institutional.includes('/pop-electric.css?v=20260826-13-compact-categories'));
assert.ok(institutional.includes('/editorial-clean.css?v=20260826-18-related-cards'));
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
  /body\.popElectric\.siteFooterBrandimg,body\.legalShell\.siteFooterBrandimg\{filter:none/,
  'the dedicated footer logo must keep its white and sage colors unchanged',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.rankingPage\.rankingContinuation\.relatedTitle\{font-size:15px;font-weight:800;line-height:1\.08;letter-spacing:-0\.025em/,
  'related ranking titles must use the current compact sans-serif treatment',
);

assert.match(
  compactEditorialCss,
  /body\.popElectric\.brandSlogan\{[^}]*70018px\/1Arial/,
  'the desktop slogan must visually span the wordmark width',
);
assert.match(
  compactEditorialCss,
  /@media\(max-width:700px\)[\s\S]*body\.popElectric\.brandSlogan\{font-size:12px/,
  'the enlarged slogan must remain proportional on mobile',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.moderationHero,body\.popElectric\.moderationAccessDenied\{[^}]*border-radius:0[^}]*background:var\(--clean-paper\)[^}]*box-shadow:none/,
  'moderation must use the clean editorial hero instead of the old neon panel',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.moderationSection\{[^}]*border:0[^}]*border-radius:0[^}]*background:transparent/,
  'moderation sections must be flat editorial groups',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.moderationCard,body\.popElectric\.moderationCard\.preparing\{[^}]*border:0[^}]*border-bottom:1pxsolidvar\(--clean-line\)[^}]*border-radius:0[^}]*box-shadow:none/,
  'moderation cards must be separated by rules instead of thick rounded boxes',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.suggestionStatus\{[^}]*border-radius:0[^}]*background:transparent/,
  'moderation status labels must use flat editorial tags',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric,body\.legalShell\{[^}]*--up:var\(--clean-sage\)[^}]*--down:var\(--clean-muted-red\)/,
  'positive and negative signals must use the muted editorial palette',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.rankingPage\.react\.up\{[^}]*border-color:var\(--clean-sage\)[^}]*color:var\(--clean-sage\)/,
  'positive vote buttons must use sage before selection',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.rankingPage\.react\.down\{[^}]*border-color:var\(--clean-muted-red\)[^}]*color:var\(--clean-muted-red\)/,
  'negative vote buttons must use muted red before selection',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.rankingPage\.react\.up:hover,[^{]*\.react\.up\.selected\{[^}]*background:var\(--clean-sage\)[^}]*color:var\(--clean-paper\)/,
  'selected positive votes must fill with sage',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.rankingPage\.react\.down:hover,[^{]*\.react\.down\.selected\{[^}]*background:var\(--clean-muted-red\)[^}]*color:var\(--clean-paper\)/,
  'selected negative votes must fill with muted red',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.profilePage\.profileGameHero\{[^}]*background:var\(--clean-soft\)[^}]*color:var\(--clean-ink\)[^}]*box-shadow:8px8px0var\(--clean-muted-red\)/,
  'the profile hero must replace neon colors with the muted editorial palette',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.profilePage\.profileAvatarRing\{background:conic-gradient\(from-90deg,var\(--clean-sage\)var\(--profile-progress\),var\(--clean-line\)0\)/,
  'profile progress must use the sage ring and preserve real progress',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.profilePage\.profileBadgesspan\{[^}]*border:1pxsolidvar\(--clean-sage\)[^}]*background:var\(--clean-sage-soft\)[^}]*color:var\(--clean-sage\)/,
  'profile badges must use soft sage instead of lime neon',
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
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.categorySorts\{[^}]*display:flex[^}]*overflow-x:auto[\s\S]*\.popElectric\.categorySortsbutton\{[^}]*min-height:34px[\s\S]*\.popElectric\.categoryShuffle\{[^}]*width:34px[^}]*max-width:34px/,
  'category controls must use one compact horizontal mobile strip',
);
assert.match(
  compactEditorialCss,
  /@media\(max-width:700px\)[\s\S]*body\.popElectric\.categoryLandingHead\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\)auto[^}]*padding:16px014px[\s\S]*body\.popElectric\.categoryLandingCount\{[^}]*flex-direction:column[^}]*margin:23px00/,
  'mobile category headers must keep the title and ranking count in one compact composition',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.categoryRankMedia,body\.popElectric\.searchRankList\.categoryRankMedia\{[^}]*height:190px[^}]*min-height:190px/,
  'ranking previews must use a shallow photo so the vote controls appear sooner',
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
  compactEditorialCss,
  /@media\(max-width:700px\)[\s\S]*body\.popElectric\.categoryRankGrid,body\.popElectric\.popHomeGrid,body\.popElectric\.searchRankList\{grid-template-columns:minmax\(0,1fr\)/,
  'votable ranking cards must use one readable column on mobile',
);
assert.doesNotMatch(
  compactEditorialCss,
  /categoryRankCard:hover\.categoryRankTitleh2\{[^}]*text-decoration:underline/,
  'touch cards must not leave a stuck underline after being tapped',
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

console.log('Branding test passed: the sage arrow is integrated into the final O.');
