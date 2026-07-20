import {
  RAPID_DETAIL_INTENT_WINDOW_MS,
  collapseRapidDuplicateDetailIntent,
  getNativeDetailIntentKey,
  resetNativeDetailIntentDedupe,
} from '../../lib/nativeIntentDedupe';
import { redirectSystemPath } from '../../app/+native-intent';

describe('native detail intent dedupe', () => {
  beforeEach(() => {
    resetNativeDetailIntentDedupe();
  });

  it('collapses the same rapid host route across equivalent native path formats', () => {
    expect(collapseRapidDuplicateDetailIntent('c1rcle://host/demo-host-03', 1_000)).toBe(
      'c1rcle://host/demo-host-03',
    );
    expect(collapseRapidDuplicateDetailIntent('/host/demo-host-03', 1_100)).toBeNull();
  });

  it('collapses the same rapid venue route including app-prefixed universal paths', () => {
    expect(
      collapseRapidDuplicateDetailIntent('https://thec1rcle.com/app/venue/demo-venue-nowl', 2_000),
    ).toBe('https://thec1rcle.com/app/venue/demo-venue-nowl');
    expect(collapseRapidDuplicateDetailIntent('/venue/demo-venue-nowl', 2_050)).toBeNull();
  });

  it('allows different host and venue resources without delay', () => {
    expect(collapseRapidDuplicateDetailIntent('/host/host-a', 3_000)).toBe('/host/host-a');
    expect(collapseRapidDuplicateDetailIntent('/host/host-b', 3_001)).toBe('/host/host-b');
    expect(collapseRapidDuplicateDetailIntent('/venue/host-b', 3_002)).toBe('/venue/host-b');
  });

  it('allows the same resource again after the narrow window', () => {
    expect(collapseRapidDuplicateDetailIntent('/host/host-a', 4_000)).toBe('/host/host-a');
    expect(
      collapseRapidDuplicateDetailIntent('/host/host-a', 4_000 + RAPID_DETAIL_INTENT_WINDOW_MS + 1),
    ).toBe('/host/host-a');
  });

  it('never suppresses unrelated deep-link routes', () => {
    expect(collapseRapidDuplicateDetailIntent('/event/event-a', 5_000)).toBe('/event/event-a');
    expect(collapseRapidDuplicateDetailIntent('/event/event-a', 5_001)).toBe('/event/event-a');
  });

  it('keys encoded and decoded identifiers consistently', () => {
    expect(getNativeDetailIntentKey('/host/demo%2Dhost%2D03')).toBe('host:demo-host-03');
    expect(getNativeDetailIntentKey('/host/demo-host-03')).toBe('host:demo-host-03');
  });

  it('is wired through the Expo Router native-intent entry point', () => {
    expect(
      redirectSystemPath({ path: 'c1rcle://venue/demo-venue-nowl', initial: false }),
    ).toBe('c1rcle://venue/demo-venue-nowl');
    expect(
      redirectSystemPath({ path: 'c1rcle://venue/demo-venue-nowl', initial: false }),
    ).toBeNull();
  });
});
