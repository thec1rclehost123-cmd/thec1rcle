import { formatInr, formatPaiseInr } from '@/lib/money';

describe('INR display precision', () => {
  it('always displays paid rupee values to exact paise precision', () => {
    expect(formatInr(1087.42)).toBe('₹1,087.42');
    expect(formatInr(999)).toBe('₹999.00');
  });

  it('formats provider paise without whole-rupee rounding', () => {
    expect(formatPaiseInr(108742)).toBe('₹1,087.42');
  });

  it('keeps the intentional free label while supporting a numeric zero', () => {
    expect(formatInr(0)).toBe('Free');
    expect(formatInr(0, false)).toBe('₹0.00');
  });
});
