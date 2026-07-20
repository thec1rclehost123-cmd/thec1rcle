import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const designSystem = readFileSync(resolve(root, 'components/first-run/index.tsx'), 'utf8');
const screen = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('first-run design system contract', () => {
  it('defines one token contract for color, spacing, controls and motion', () => {
    expect(designSystem).toContain("background: '#000000'");
    expect(designSystem).toContain("accent: '#F44A22'");
    expect(designSystem).toContain('controlHeight: 56');
    expect(designSystem).toContain('spacing:');
    expect(designSystem).toContain('motion:');
  });

  it('provides shared fields, choices, actions, OTP and status states', () => {
    for (const component of [
      'FirstRunField',
      'FirstRunButton',
      'FirstRunTextAction',
      'FirstRunDivider',
      'FirstRunValueButton',
      'ChoiceTile',
      'FirstRunOtpInput',
      'FirstRunStatus',
    ]) {
      expect(designSystem).toContain(component);
    }
  });

  it('respects reduced-motion and safe-area behavior in the shared shell', () => {
    expect(designSystem).toContain('ReduceMotion.System');
    expect(designSystem).toContain("edges={['top', 'bottom']}");
    expect(designSystem).toContain('accessibilityRole="progressbar"');
  });

  it('keeps disabled footer actions visible and never backs out of an empty stack', () => {
    expect(designSystem).toContain('else if (router.canGoBack()) router.back()');
    expect(designSystem).toContain("else router.replace('/(auth)/login')");
    expect(designSystem).toContain('buttonTextDisabled');
    expect(designSystem).toContain('flexShrink: 0');
    expect(designSystem).not.toContain('buttonDisabled: { opacity:');
    expect(designSystem).not.toContain('style={({ pressed })');
  });

  it('keeps new first-run screens on shared interactive controls', () => {
    const city = screen('app/(first-run)/city.tsx');
    const identity = screen('app/(first-run)/identity.tsx');
    const email = screen('app/(first-run)/email-optional.tsx');
    const phone = screen('app/(auth)/phone.tsx');
    const otp = screen('app/(auth)/otp.tsx');

    expect(city).toContain('<FirstRunButton');
    expect(city).toContain('accessibilityRole="radio"');
    expect(city).toContain('<FirstRunDivider');
    expect(identity).toContain('<FirstRunField');
    expect(identity).toContain('<FirstRunValueButton');
    expect(email).toContain('<FirstRunTextAction');
    expect(phone).toContain('<FirstRunField');
    expect(otp).toContain('<FirstRunOtpInput');
    expect(email).not.toContain('<Pressable');
    expect(identity).not.toContain('<Pressable');
    expect(otp).not.toContain('<Pressable');
  });
});
