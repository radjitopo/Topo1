import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Clerk keeps its complete UI and OAuth callback inside SomosTopo', async () => {
  const [app, page] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
  ]);

  assert.match(app, /clerk\.mountSignIn\(mount,/);
  assert.match(app, /@clerk\/ui@1\/dist\/ui\.browser\.js/);
  assert.match(app, /@clerk\/localizations@3\.37\.8\/dist\/pt-BR\.mjs/);
  assert.match(app, /ui: \{ ClerkUI: window\.__internal_ClerkUICtor \}/);
  assert.match(app, /localization: ptBR/);
  assert.match(app, /clerkUiLocalizationReady = Boolean\(ptBR\)/);
  assert.match(app, /initClerk\(true\)/);
  assert.match(app, /routing: 'hash'/);
  assert.match(app, /withSignUp: true/);
  assert.match(app, /forceRedirectUrl: authReturn\(\)/);
  assert.match(app, /fallbackRedirectUrl: authReturn\(\)/);
  assert.match(app, /signInUrl: '\/entrar'/);
  assert.match(app, /signUpUrl: '\/entrar'/);
  assert.match(app, /signInForceRedirectUrl: authReturn\(\)/);
  assert.match(app, /signInFallbackRedirectUrl: authReturn\(\)/);
  assert.match(app, /signUpForceRedirectUrl: authReturn\(\)/);
  assert.match(app, /signUpFallbackRedirectUrl: authReturn\(\)/);
  assert.match(app, /renderClerkStart\(mount, clerk\)/);
  assert.match(
    app,
    /if \(!clerkUiLocalizationReady\) \{[\s\S]*renderClerkStart\(mount, clerk\);[\s\S]*return;/,
  );
  assert.match(app, /Continuar com Google/);
  assert.match(app, /Receber código por e-mail/);
  assert.match(app, /Entrar no TOPO/);
  assert.match(app, /transferable: true/);
  assert.match(app, /signIn\?\.isTransferable/);
  assert.match(app, /transferClerkSignUp\(clerk\)/);
  assert.match(app, /finishPendingClerkSignUp\(clerk, signUp\)/);
  assert.match(app, /signUp\?\.status === 'missing_requirements'/);
  assert.match(app, /missing\.includes\('password'\)/);
  assert.match(app, /clerk\.handleRedirectCallback\([\s\S]*async \(to\) =>/);
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
