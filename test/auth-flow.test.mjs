import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Google is the primary account entry and email remains available', async () => {
  const [app, page] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
  ]);

  assert.match(app, /id="clerkGoogleAuth"/);
  assert.match(app, /Continuar com Google/);
  assert.match(app, /strategy: 'oauth_google'/);
  assert.match(app, /redirectUrl: '\/sso-callback'/);
  assert.match(app, /redirectUrlComplete: authReturn\(\)/);
  assert.match(app, /Receber código por e-mail/);
  assert.ok(
    app.indexOf('id="clerkGoogleAuth"') < app.indexOf('id="emailCodeStart"'),
    'Google must appear before the email-code form',
  );
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
