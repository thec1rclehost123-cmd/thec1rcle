jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
  fetchPublicVenues: jest.fn(),
}));

import { fetchPublicVenues } from '../../lib/api';
import { useVenuesStore } from '../../store/venuesStore';

const mockFetchPublicVenues = fetchPublicVenues as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('venuesStore discovery contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useVenuesStore.setState({
      venues: [],
      followedVenueIds: new Set(),
      followLoadingVenueIds: new Set(),
      loading: false,
      error: null,
    });
  });

  it('forwards the selected city to the bounded public venue request', async () => {
    mockFetchPublicVenues.mockResolvedValueOnce({
      items: [{ id: 'venue-pune', name: 'Pune Venue', city: 'Pune' }],
      venues: [{ id: 'venue-pune', name: 'Pune Venue', city: 'Pune' }],
    });

    await useVenuesStore.getState().fetchVenues({ city: 'Pune' });

    expect(mockFetchPublicVenues).toHaveBeenCalledWith({ city: 'Pune', limit: 100 });
    expect(useVenuesStore.getState().venues).toEqual([
      expect.objectContaining({ id: 'venue-pune', city: 'Pune' }),
    ]);
  });

  it('deduplicates the same city request while it is in flight', async () => {
    const pending = deferred<any>();
    mockFetchPublicVenues.mockReturnValueOnce(pending.promise);

    const first = useVenuesStore.getState().fetchVenues({ city: 'Pune' });
    const second = useVenuesStore.getState().fetchVenues({ city: 'Pune' });

    expect(second).toBe(first);
    expect(mockFetchPublicVenues).toHaveBeenCalledTimes(1);
    pending.resolve({ items: [], venues: [] });
    await first;
  });

  it('does not let a stale all-city response overwrite a newer city request', async () => {
    const allCities = deferred<any>();
    const pune = deferred<any>();
    mockFetchPublicVenues
      .mockReturnValueOnce(allCities.promise)
      .mockReturnValueOnce(pune.promise);

    const first = useVenuesStore.getState().fetchVenues();
    const second = useVenuesStore.getState().fetchVenues({ city: 'Pune' });

    pune.resolve({
      items: [{ id: 'venue-pune', city: 'Pune' }],
      venues: [{ id: 'venue-pune', city: 'Pune' }],
    });
    await second;
    allCities.resolve({
      items: [{ id: 'venue-delhi', city: 'Delhi' }],
      venues: [{ id: 'venue-delhi', city: 'Delhi' }],
    });
    await first;

    expect(useVenuesStore.getState().venues).toEqual([
      expect.objectContaining({ id: 'venue-pune', city: 'Pune' }),
    ]);
  });

  it('reuses a fresh city result but lets explicit refresh bypass the cache', async () => {
    mockFetchPublicVenues.mockResolvedValue({
      items: [{ id: 'venue-pune', city: 'Pune' }],
      venues: [{ id: 'venue-pune', city: 'Pune' }],
    });

    await useVenuesStore.getState().fetchVenues({ city: 'Pune' });
    await useVenuesStore.getState().fetchVenues({ city: 'Pune' });
    expect(mockFetchPublicVenues).toHaveBeenCalledTimes(1);

    await useVenuesStore.getState().fetchVenues({ city: 'Pune', force: true });
    expect(mockFetchPublicVenues).toHaveBeenCalledTimes(2);
  });
});
