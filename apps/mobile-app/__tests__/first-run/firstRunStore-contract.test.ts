import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../../store/firstRunStore.ts'), 'utf8');

describe('first-run canonical authority contract', () => {
  it('never falls back to local or legacy completion authority', () => {
    expect(source).not.toContain('AsyncStorage');
    expect(source).not.toContain('/api/v1/users/me/settings');
    expect(source).not.toContain('onboardingComplete: true');
    expect(source).not.toContain('basicSetupComplete');
    expect(source).toContain('requireCanonicalSnapshot');
  });

  it('persists both shown and skipped email prompt decisions through the onboarding API', () => {
    expect(source).toContain("status: 'shown'");
    expect(source).toContain("status: 'skipped'");
    expect(source.match(/\/api\/v1\/users\/me\/onboarding\/email-prompt/g)).toHaveLength(2);
  });
});
