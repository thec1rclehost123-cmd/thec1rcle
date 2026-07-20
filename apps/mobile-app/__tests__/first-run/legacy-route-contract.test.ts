/* global __dirname */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = resolve(__dirname, '../../app');
const read = (path: string) => readFileSync(resolve(app, path), 'utf8');

describe('legacy first-run route retirement', () => {
  it.each([
    ['(auth)/signup.tsx', '/(auth)/login'],
    ['profile-setup.tsx', '/identity'],
    ['onboarding.tsx', '/'],
    ['permission.tsx', '/'],
    ['add-contact.tsx', '/'],
  ])('%s is redirect-only', (path, destination) => {
    const source = read(path);
    expect(source).toContain('Redirect');
    expect(source).toContain(destination);
  });

  it('promotes location and notification into real first-run experiences', () => {
    const location = read('location-permission.tsx');
    const notifications = read('notification-permission.tsx');

    expect(location).not.toContain('Redirect');
    expect(location).toContain('Use my location');
    expect(notifications).not.toContain('Redirect');
    expect(notifications).toContain('Turn on notifications');
  });

  it('guest auth prompts no longer route into legacy Signup', () => {
    const authSheet = readFileSync(resolve(__dirname, '../../components/ui/AuthSheet.tsx'), 'utf8');
    const guestPrompt = readFileSync(
      resolve(__dirname, '../../components/ui/GuestAuthPrompt.tsx'),
      'utf8',
    );
    expect(authSheet).not.toContain('/(auth)/signup');
    expect(guestPrompt).not.toContain('/(auth)/signup');
  });
});
