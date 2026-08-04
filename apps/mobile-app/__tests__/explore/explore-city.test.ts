import { resolveExploreBootstrapCity, shouldRunExploreBootstrap } from '@/lib/exploreCity';

describe('resolveExploreBootstrapCity', () => {
  it('applies a profile city that arrives after the screen initialized', () => {
    expect(resolveExploreBootstrapCity('Pune', 'all', false)).toBe('pune');
  });

  it('keeps an explicit session city selection', () => {
    expect(resolveExploreBootstrapCity('Pune', 'all', true)).toBe('all');
  });

  it('keeps the current filter when the profile has no city', () => {
    expect(resolveExploreBootstrapCity('', 'mumbai', false)).toBe('mumbai');
  });
});

describe('shouldRunExploreBootstrap', () => {
  it('does not fetch Explore data while the tab is preloaded but unfocused', () => {
    expect(shouldRunExploreBootstrap(false, 'user_1', 'user_1')).toBe(false);
  });

  it('waits for the authenticated user profile before bootstrapping', () => {
    expect(shouldRunExploreBootstrap(true, 'user_1', null)).toBe(false);
    expect(shouldRunExploreBootstrap(true, 'user_1', 'user_2')).toBe(false);
  });

  it('allows focused guest and profile-ready authenticated Explore sessions', () => {
    expect(shouldRunExploreBootstrap(true, null, null)).toBe(true);
    expect(shouldRunExploreBootstrap(true, 'user_1', 'user_1')).toBe(true);
  });
});
