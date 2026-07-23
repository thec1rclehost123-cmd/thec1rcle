import fs from 'node:fs';
import path from 'node:path';

describe('settings legal and account deletion access', () => {
  const settingsSource = fs.readFileSync(
    path.join(__dirname, '../../app/settings.tsx'),
    'utf8',
  );
  const accountSource = fs.readFileSync(
    path.join(__dirname, '../../app/settings/account.tsx'),
    'utf8',
  );

  it.each([
    ['Privacy Policy', 'https://thec1rcle.com/privacy'],
    ['Terms of Service', 'https://thec1rcle.com/terms'],
    ['Refund & Cancellation Policy', 'https://thec1rcle.com/refund'],
    ['Account Deletion', 'https://thec1rcle.com/account-deletion'],
  ])('exposes %s with the production public URL', (label, url) => {
    expect(settingsSource).toContain(label);
    expect(settingsSource).toContain(url);
  });

  it('retains the in-app Delete Account control', () => {
    expect(accountSource).toContain('title="Delete Account"');
    expect(accountSource).toContain('handleDeleteAccount');
  });
});
