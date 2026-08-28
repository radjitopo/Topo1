import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Clerk renders its embedded sign-in-or-up flow inside SomosTopo', async () => {
  const [app, page] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
  ]);

  assert.match(app, /clerk\.mountSignIn\(mount,/);
  assert.match(app, /@clerk\/ui@1\/dist\/ui\.browser\.js/);
  assert.match(app, /ui: \{ ClerkUI: window\.__internal_ClerkUICtor \}/);
  assert.match(app, /initClerk\(true\)/);
  assert.match(app, /routing: 'hash'/);
  assert.match(app, /withSignUp: true/);
  assert.match(app, /forceRedirectUrl: authReturn\(\)/);
  assert.match(app, /fallbackRedirectUrl: authReturn\(\)/);
  assert.match(app, /signUpForceRedirectUrl: authReturn\(\)/);
  assert.match(app, /signUpFallbackRedirectUrl: authReturn\(\)/);
  assert.doesNotMatch(app, /signInForceRedirectUrl/);
  assert.match(page, /Google ou e-mail/);
});

test('OAuth callback keeps bot protection and existing email account reconciliation', async () => {
  const [app, api] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('api.js', root), 'utf8'),
  ]);

  assert.match(app, /location\.pathname === '\/sso-callback'/);
  assert.match(app, /clerk\.handleRedirectCallback/);
  assert.match(app, /clerkCallback[\s\S]*id="clerk-captcha"/);
  assert.match(api, /WHERE lower\(email\) = lower\(\$1\)/);
  assert.match(api, /INSERT INTO clerk_user_links/);
});
