import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('personalized Explore authority contract', () => {
  it('loads only the versioned backend ranking contract', () => {
    const store = source('store/recommendationsStore.ts');
    expect(store).toContain('contract=v2&surface=explore');
    expect(store).toContain("modelVersion: 'explore-v2'");
    expect(store).not.toContain('scoreEvent');
    expect(store).not.toContain('TIME_OF_DAY_BOOSTS');
    expect(store).not.toContain('scoredEvents');
  });

  it('keeps a user-bound short-lived offline cache and rejects stale requests', () => {
    const store = source('store/recommendationsStore.ts');
    expect(store).toContain('cached.userId !== userId');
    expect(store).toContain('CACHE_TTL_MS');
    expect(store).toContain('requestGeneration');
    expect(store).toContain("responseState(cached, 'cache')");
  });

  it('uses personalized events as the hero without mixing selected cities', () => {
    const explore = source('app/(tabs)/explore.tsx');
    expect(explore).toContain('if (visibleRecommendations.length > 0)');
    expect(explore).toContain(
      'recommendations.filter((event) => eventMatchesCity(event, cityFilter))',
    );
    expect(explore).toContain('<ExploreFeaturedCarousel events={heroSlides}');
    expect(explore).toContain('<TopVenues city=');
  });

  it('updates canonical city and recommendations together', () => {
    const explore = source('app/(tabs)/explore.tsx');
    expect(explore).toContain("await saveCity(cityIdFromName(label), label, 'manual')");
    expect(explore).toContain('clearRecommendations()');
    expect(explore).toContain('loadServerRecommendations(user.uid, true)');
  });

  it('keeps recommendation diagnostics off Explore and moves tuning to Settings', () => {
    const explore = source('app/(tabs)/explore.tsx');
    const settings = source('app/settings.tsx');
    expect(explore).toContain('recommendationLoading');
    expect(explore).not.toContain('Showing your saved picks');
    expect(explore).not.toContain('Showing popular events for now');
    expect(explore).not.toContain('Your C1RCLE is taking shape');
    expect(explore).not.toContain('Tune your Explore');
    expect(settings).toContain('Tune Explore');
    expect(settings).toContain("pathname: '/tastes'");
  });

  it('restores floating attendee portraits in See All and a boxed checkout receipt', () => {
    const feed = source('app/events/feed.tsx');
    const checkout = source('app/checkout/index.tsx');
    expect(feed).toContain('AVATAR_POSITIONS');
    expect(feed).toContain('styles.floatingAvatar');
    expect(feed).toContain('guestlistUsers.slice(0, 4)');
    expect(checkout).toContain('<GlassCard delay={80} receipt>');
    expect(checkout).toContain('Order summary');
    expect(checkout).toContain('Platform fee');
    expect(checkout).toContain('Payment fee');
    expect(checkout).toContain('GST');
  });

  it('prefetches personalized results before leaving the final onboarding action', () => {
    const intent = source('app/(first-run)/intent.tsx');
    expect(intent).toContain('loadServerRecommendations(userId, true)');
    expect(intent.indexOf('loadServerRecommendations')).toBeLessThan(
      intent.indexOf("pathname: '/(tabs)/explore'"),
    );
  });
});
