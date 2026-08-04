jest.mock('../../lib/publicDetailRequests', () => ({
  fetchPublicVenuePage: jest.fn(),
}));

import { fetchPublicVenuePage } from '../../lib/publicDetailRequests';
import { useVenuePageStore } from '../../store/venuePageStore';

const mockFetchPublicVenuePage = fetchPublicVenuePage as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('venuePageStore keyed request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useVenuePageStore.getState().clearVenuePage();
  });

  it('keeps parallel venue pages isolated when responses settle out of order', async () => {
    const venueARequest = deferred<any>();
    const venueBRequest = deferred<any>();
    mockFetchPublicVenuePage
      .mockReturnValueOnce(venueARequest.promise)
      .mockReturnValueOnce(venueBRequest.promise);

    const venueA = useVenuePageStore.getState().fetchVenuePage('venue-a');
    const venueB = useVenuePageStore.getState().fetchVenuePage('venue-b');

    venueBRequest.resolve({ venue: { id: 'venue-b', name: 'Venue B' } });
    await venueB;
    venueARequest.resolve({ venue: { id: 'venue-a', name: 'Venue A' } });
    await venueA;

    expect(useVenuePageStore.getState().pages['venue-b'].venue).toMatchObject({
      id: 'venue-b',
      name: 'Venue B',
    });
    expect(useVenuePageStore.getState().pages['venue-a'].venue).toMatchObject({
      id: 'venue-a',
      name: 'Venue A',
    });
  });

  it('ignores a response after only its keyed page state is cleared', async () => {
    const request = deferred<any>();
    mockFetchPublicVenuePage.mockReturnValueOnce(request.promise);

    const pending = useVenuePageStore.getState().fetchVenuePage('venue-a');
    useVenuePageStore.getState().clearVenuePage('venue-a');
    request.resolve({ venue: { id: 'venue-a', name: 'Venue A' } });
    await pending;

    expect(useVenuePageStore.getState().pages['venue-a']).toBeUndefined();
  });
});
