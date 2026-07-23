import {
  resolveFirstRunActionBottomPadding,
  resolveFirstRunContentBottomInset,
} from '@/lib/firstRunLayout';

describe('first-run fixed action layout', () => {
  it('respects safe areas and the Android edge-to-edge navigation floor', () => {
    expect(resolveFirstRunActionBottomPadding(0, 'android')).toBe(36);
    expect(resolveFirstRunActionBottomPadding(48, 'android')).toBe(48);
    expect(resolveFirstRunActionBottomPadding(34, 'ios')).toBe(34);
    expect(resolveFirstRunActionBottomPadding(0, 'ios')).toBe(8);
  });

  it('reserves estimated CTA bounds before the first native layout measurement', () => {
    expect(
      resolveFirstRunContentBottomInset({
        measuredActionHeight: 0,
        safeAreaBottom: 0,
        platform: 'android',
        estimatedControlHeight: 56,
      }),
    ).toBe(120);
  });

  it('uses a taller measured action for large text without allowing content overlap', () => {
    expect(
      resolveFirstRunContentBottomInset({
        measuredActionHeight: 148,
        safeAreaBottom: 34,
        platform: 'ios',
        estimatedControlHeight: 56,
      }),
    ).toBe(164);
  });
});
