import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Clerk starts Google OAuth inside SomosTopo and returns to its own callback', async () => {
  const [app, page] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
  ]);

  assert.match(app, /clerk\.client\.signUp\.authenticateWithRedirect/);
  assert.match(app, /strategy: 'oauth_google'/);
  assert.match(app, /new URL\('\/sso-callback', location\.origin\)/);
  assert.match(app, /redirectUrlComplete/);
  assert.match(app, /signInUrl: '\/entrar'/);
  assert.match(app, /signUpUrl: '\/entrar'/);
  assert.match(app, /signInForceRedirectUrl: authReturn\(\)/);
  assert.match(app, /signInFallbackRedirectUrl: authReturn\(\)/);
  assert.match(app, /signUpForceRedirectUrl: authReturn\(\)/);
  assert.match(app, /signUpFallbackRedirectUrl: authReturn\(\)/);
  assert.match(app, /renderClerkStart\(mount, clerk\)/);
  assert.match(app, /transferable: true/);
  assert.match(app, /signIn\?\.isTransferable/);
  assert.match(app, /transferClerkSignUp\(clerk\)/);
  assert.match(app, /finishPendingClerkSignUp\(clerk, signUp\)/);
  assert.match(app, /signUp\?\.status === 'missing_requirements'/);
  assert.match(app, /missing\.includes\('password'\)/);
  assert.match(app, /clerk\.handleRedirectCallback\([\s\S]*async \(to\) =>/);
  assert.doesNotMatch(app, /clerk\.mountSignIn/);
  assert.doesNotMatch(app, /clerk\.client\.signIn\.authenticateWithRedirect/);
  assert.doesNotMatch(app, /clerk\.buildSignInUrl/);
  assert.doesNotMatch(app, /@clerk\/ui/);
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
