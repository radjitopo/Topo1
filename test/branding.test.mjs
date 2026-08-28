import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [logo, footerLogo, mark, popCss, editorialCss, index, institutional, page, app] =
  await Promise.all(
    [
      '../logo-topo-v4.svg',
      '../logo-topo-footer-v4.svg',
      '../topo-mark-v4.svg',
      '../pop-electric.css',
      '../editorial-clean.css',
      '../index.html',
      '../institutional.js',
      '../page.js',
      '../app.js',
    ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
  );
const compactPopCss = compactSource(popCss);
const compactEditorialCss = compactSource(editorialCss);
const compactApp = compactSource(app);

assert.match(logo, /id="wordmark" fill="#0a0a0a"/, 'the master wordmark must be black');
assert.match(
  logo,
  /id="mountain" fill="#0a0a0a" d="M832\.5 115 781 230h103Z"\/\>/,
  'a black half-height mountain triangle must follow the final O',
);
assert.doesNotMatch(
  logo,
  /(?:circle|ellipse|stroke=)/,
  'the logo must not bring back the old dot or arrow',
);
assert.match(footerLogo, /id="wordmark" fill="#fff"/, 'the dark footer needs a white wordmark');
assert.match(
  footerLogo,
  /id="mountain" fill="#fff"/,
  'the footer needs the reversed mountain triangle',
);
assert.match(mark, /<path fill="#0a0a0a" d="M50 9 5 91h90Z"\/\>/);
assert.doesNotMatch(mark, /(?:circle|stroke=)/);

assert.doesNotMatch(index, /class="logo"[^>]*>TOPO</, 'the header logo must never be typed text');
assert.equal(
  (index.match(/src="\/logo-topo-v4\.svg"/g) || []).length,
  1,
  'the header must use the black triangle wordmark',
);
assert.match(index, /class="siteFooterBrand"[^>]*><img src="\/logo-topo-footer-v4\.svg"/);
assert.match(institutional, /class="logo"[^>]*><img src="\/logo-topo-v4\.svg"/);
assert.match(institutional, /class="siteFooterBrand"[^>]*><img src="\/logo-topo-footer-v4\.svg"/);
assert.match(index, /href="\/topo-mark-v4\.svg"/);
assert.match(index, /https:\/\/somostopo\.com\.br\/og-topo-v2\.png/);
assert.match(institutional, /\/og-topo-v2\.png/);
assert.match(page, /\/topo-mark-v4\.svg/);
assert.match(page, /\/og-topo-v2\.png/);
for (const shell of [index, institutional, page]) {
  assert.doesNotMatch(shell, /(?:logo-topo|topo-mark)\.svg|og-topo\.png/);
}
assert.ok(index.includes('/pop-electric.css?v=20260826-13-compact-categories'));
assert.ok(index.includes('/editorial-clean.css?v=20260828-1-unified-account-hub'));
assert.ok(index.includes('/app.js?v=20260827-1-vip-area'));
assert.ok(institutional.includes('/pop-electric.css?v=20260826-13-compact-categories'));
assert.ok(institutional.includes('/editorial-clean.css?v=20260826-21-login-cta'));
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
  'the dedicated footer logo must keep its white reversed artwork unchanged',
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
  /body\.popElectric\.profilePage\.profileGameHero\{[^}]*margin:0028px[^}]*border:0[^}]*border-bottom:1pxsolidvar\(--clean-ink\)[^}]*background:var\(--clean-paper\)[^}]*box-shadow:none/,
  'the compact profile hero must remove the heavy black top strip',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.profilePage\.profileAvatarRing\{background:var\(--clean-lime\)/,
  'the smaller profile photo must use the brand lime ring',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.profilePage\.profileSettingsGrid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'name and photo controls must remain available in a dedicated profile settings area',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.profilePage\.profileSection\{[^}]*border:0[^}]*border-top:5pxsolidvar\(--clean-ink\)[^}]*border-radius:0[^}]*background:transparent[^}]*box-shadow:none/,
  'profile sections must use rules instead of bordered cards',
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
  compactEditorialCss,
  /@media\(min-width:981px\)and\(max-width:1440px\)[\s\S]*body\.popElectric\.wrap,body\.legalShell\.wrap\{width:min\(1100px,calc\(100%-40px\)\)[\s\S]*body\.popElectric\.topheader\{min-height:64px;height:64px/,
  'notebook screens need a narrower canvas and a shorter header',
);
assert.match(
  compactEditorialCss,
  /@media\(min-width:981px\)and\(max-width:1440px\)[\s\S]*body\.popElectric\.popHomeStats\{min-height:32px;padding:4px0[\s\S]*body\.popElectric\.editorialHomeLead\{margin-bottom:18px;padding:10px020px[\s\S]*body\.popElectric\.editorialHomeLead\.portalHeroLink\{grid-template-columns:minmax\(0,0\.92fr\)minmax\(0,1\.08fr\);gap:24px[\s\S]*body\.popElectric\.editorialHomeLead\.portalHeroCopy\{align-content:start;align-self:start;padding-top:0[\s\S]*font-size:clamp\(32px,2\.8vw,40px\)/,
  'the notebook hero must eliminate dead space, align from the top, and use a restrained headline scale',
);
assert.match(
  compactEditorialCss,
  /@media\(min-width:981px\)\{[\s\S]*body\.popElectric\.editorialHomeLead\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:24px[\s\S]*body\.popElectric\.editorialHomeLead\.portalHeroLink\{height:100%;grid-template-columns:minmax\(0,1fr\)minmax\(150px,0\.62fr\)[\s\S]*aspect-ratio:4\/3;max-height:190px[\s\S]*body\.popElectric\.editorialHomeLead\.portalHeroSecondary\{border-left:1pxsolidvar\(--clean-line\);padding-left:24px/,
  'desktop home must open with two compact rankings and smaller photos',
);
assert.match(
  compactEditorialCss,
  /@media\(max-width:980px\)\{body\.popElectric\.editorialHomeLead\.portalHeroSecondary\{display:none/,
  'mobile and tablet layouts must keep the original single featured ranking',
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
  'signed-in mobile users must keep a visible Meu Topo entry beside the bell',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.accountEnter\{[^}]*min-height:46px[^}]*background:var\(--clean-ink\)[^}]*color:#fff/,
  'signed-out visitors need a prominent editorial login call to action',
);
assert.match(
  compactApp,
  /document\.body\.classList\.toggle\('authPage',pageKind\(\)==='auth'\)/,
  'the sign-in route needs its own current-design scope',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.authPage\.authCard\{[^}]*border:0[^}]*border-top:6pxsolidvar\(--clean-ink\)[^}]*background:transparent/,
  'sign-in must use the flat editorial composition instead of the old bordered card',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.authPage\.clerkAuthMount\{[^}]*min-height:0[^}]*display:block/,
  'sign-in must not preserve the old empty 300px form area',
);
assert.match(
  compactEditorialCss,
  /body\.popElectric\.authPage\.primaryBtn\{[^}]*border-radius:0[^}]*background:var\(--clean-ink\)[^}]*color:#fff/,
  'the sign-in action must use the current black primary button',
);
assert.match(
  compactEditorialCss,
  /@media\(max-width:700px\)[\s\S]*body\.popElectric\.authPage\.authCard\{[^}]*display:block[^}]*border-top-width:4px[\s\S]*body\.popElectric\.authPage\.clerkAuthMount\{[^}]*min-height:0/,
  'the current sign-in composition must stack compactly on mobile',
);
assert.match(
  compactEditorialCss,
  /@media\(max-width:700px\)[\s\S]*body\.popElectric\.accountEnter\{[^}]*display:inline-flex[^}]*min-height:44px[^}]*font-size:13px/,
  'the login call to action must remain visible on phones',
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
  compactEditorialCss,
  /@media\(max-width:700px\)[\s\S]*body\.popElectric\.profilePage\.profileMetrics\{grid-template-columns:repeat\(auto-fit,minmax\(70px,1fr\)\)/,
  'profile metrics must stay in one compact row when space allows on phones',
);
assert.match(
  compactPopCss,
  /@media\(max-width:480px\)[\s\S]*\.popElectric\.moderationCounts\{[^}]*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[\s\S]*\.popElectric\.moderationCardh3\{[^}]*font-size:22px/,
  'moderation counts and cards must use the compact mobile composition',
);

console.log('Branding test passed: the black mountain triangle follows the TOPO wordmark.');
