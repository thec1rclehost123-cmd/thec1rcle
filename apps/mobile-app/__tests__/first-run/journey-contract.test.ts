import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('complete first-run journey contract', () => {
  it('keeps the native splash and login video on a black surface', () => {
    const manifest = JSON.parse(source('app.json'));
    const login = source('app/(auth)/login.tsx');

    expect(manifest.expo.splash.backgroundColor).toBe('#000000');
    expect(manifest.expo.splash.image).toBe('./assets/splash-icon.png');
    expect(login).toContain("require('../../assets/background-video.mp4')");
    expect(login).not.toContain("require('../../assets/09f5dd049312a8bf3c50ea656e1a203b.jpg')");
  });

  it('releases the login video off-focus while keeping the branded video visible', () => {
    const login = source('app/(auth)/login.tsx');
    expect(login).toContain('useFocusEffect');
    expect(login).toContain('useIsFocused');
    expect(login).toContain('player.pause()');
    expect(login).toContain('{isFocused ? <LoginBackgroundVideo /> : null}');
  });

  it('restores canonical identity and city values when returning', () => {
    const identity = source('app/(first-run)/identity.tsx');
    const city = source('app/(first-run)/city.tsx');
    expect(identity).toContain('snapshot?.displayName');
    expect(identity).toContain('snapshot?.dateOfBirth');
    expect(city).toContain("useState(snapshot?.cityName ?? '')");
  });

  it('drops legacy taste ids before enabling or submitting preferences', () => {
    const tastes = source('app/(first-run)/tastes.tsx');
    expect(tastes).toContain('validTasteIds.has(taste)');
    expect(tastes).toContain('useFirstRunStore.setState({ error: null })');
  });

  it('advances from the server-returned stage without discarding back history', () => {
    for (const path of [
      'app/(first-run)/email-optional.tsx',
      'app/(first-run)/identity.tsx',
      'app/(first-run)/city.tsx',
      'app/(first-run)/tastes.tsx',
    ]) {
      const screen = source(path);
      expect(screen).toContain('firstRunRoute(nextStage)');
      expect(screen).toContain('router.push');
    }
  });

  it('clears auth and onboarding stacks at terminal transitions', () => {
    expect(source('app/(auth)/otp.tsx')).toContain('router.dismissAll()');
    expect(source('app/(first-run)/intent.tsx')).toContain('router.dismissAll()');
    expect(source('app/(first-run)/_layout.tsx')).toContain("currentStage === 'complete'");
    expect(source('store/firstRunStore.ts')).toContain(
      "request('/api/v1/users/me/onboarding/complete', 'POST', {})",
    );
  });

  it('serializes the optional-email prompt before accepting a decision', () => {
    const email = source('app/(first-run)/email-optional.tsx');
    expect(email).toContain('promptInitializing');
    expect(email).toContain('markEmailShown().finally');
    expect(email).toContain('disabled={loading || promptInitializing}');
  });
});
