'use client';

import { useState, type FormEvent } from 'react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { ApiError } from '@/lib/v2/api-client';
import {
  useCreateEvent,
  useCreateVenue,
  useEvents,
  useOrganizations,
  useVenues,
} from '@/lib/v2/hooks';

/**
 * V2 Studio — minimal smoke surface for the V2 partner slice.
 * Org switcher → venues list/create + events list/create, all through the
 * canonical `/api/v2` contract. Purpose here is proving the V2 flow and the
 * shared contract end-to-end, not replacing the V1 dashboards.
 */
export default function V2StudioPageClient() {
  const { loading: authLoading } = useDashboardAuth();

  const [activeOrgId, setActiveOrgId] = useState<string | undefined>(undefined);
  const [orgError, setOrgError] = useState<string | null>(null);

  const orgsQuery = useOrganizations();
  const venuesQuery = useVenues(activeOrgId);
  const eventsQuery = useEvents(activeOrgId);
  const createVenue = useCreateVenue(activeOrgId);
  const createEvent = useCreateEvent(activeOrgId);

  const [venueName, setVenueName] = useState('');
  const [venueSlug, setVenueSlug] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventVenueId, setEventVenueId] = useState('');
  const [eventStart, setEventStart] = useState('');

  const organizations = orgsQuery.data?.items ?? [];
  const effectiveOrgId = activeOrgId ?? organizations[0]?.id;

  function handleOrgSelect(next: string | undefined) {
    setActiveOrgId(next);
    setOrgError(null);
  }

  async function onSubmitVenue(event: FormEvent) {
    event.preventDefault();
    setOrgError(null);
    if (!effectiveOrgId) {
      setOrgError('No organization selected');
      return;
    }
    try {
      await createVenue.mutateAsync({ name: venueName.trim(), slug: venueSlug.trim() });
      setVenueName('');
      setVenueSlug('');
    } catch (error) {
      setOrgError(errorMessage(error));
    }
  }

  async function onSubmitEvent(event: FormEvent) {
    event.preventDefault();
    setOrgError(null);
    if (!effectiveOrgId) {
      setOrgError('No organization selected');
      return;
    }
    try {
      await createEvent.mutateAsync({
        venueId: eventVenueId,
        title: eventTitle.trim(),
        startAt: new Date(eventStart).toISOString(),
      });
      setEventTitle('');
      setEventVenueId('');
      setEventStart('');
    } catch (error) {
      setOrgError(errorMessage(error));
    }
  }

  if (authLoading) return <main className="p-8 text-sm text-gray-500">Loading V2 Studio…</main>;

  if (!effectiveOrgId && !orgsQuery.isLoading) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="mb-2 text-xl font-semibold">V2 Studio</h1>
        <p className="text-sm text-gray-500">
          {orgsQuery.error
            ? errorMessage(orgsQuery.error)
            : 'No organization memberships found for your account.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">V2 Studio</h1>
          <p className="text-sm text-gray-500">
            Partners slice — org → venues → events over /api/v2
          </p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-gray-500">Organization</span>
          <select
            className="rounded border px-3 py-1.5 text-sm"
            value={effectiveOrgId ?? ''}
            onChange={(e) => handleOrgSelect(e.target.value || undefined)}
            disabled={organizations.length === 0}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.role})
              </option>
            ))}
          </select>
        </label>
      </header>

      {orgError ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {orgError}
        </p>
      ) : null}
      {orgsQuery.isError ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load organizations: {errorMessage(orgsQuery.error)}
        </p>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        {/* Venues */}
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Venues</h2>
          {venuesQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : venuesQuery.error ? (
            <p className="text-sm text-red-600">{errorMessage(venuesQuery.error)}</p>
          ) : (
            <ul className="mb-4 space-y-1 text-sm">
              {venuesQuery.data?.items?.length ? (
                venuesQuery.data.items.map((venue) => (
                  <li
                    key={venue.id}
                    className="flex justify-between rounded bg-gray-50 px-3 py-1.5"
                  >
                    <span>{venue.name}</span>
                    <span className="text-gray-400">
                      {venue.slug} · {venue.status}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500">No venues yet.</li>
              )}
            </ul>
          )}
          <form onSubmit={onSubmitVenue} className="space-y-2 border-t pt-3">
            <input
              className="w-full rounded border px-3 py-1.5 text-sm"
              placeholder="Venue name"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              required
            />
            <input
              className="w-full rounded border px-3 py-1.5 text-sm"
              placeholder="slug-format"
              value={venueSlug}
              onChange={(e) => setVenueSlug(e.target.value)}
              required
              pattern="[a-z0-9][a-z0-9-]*"
            />
            <button
              type="submit"
              className="w-full rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={createVenue.isPending || !effectiveOrgId}
            >
              {createVenue.isPending ? 'Creating…' : 'Create venue'}
            </button>
          </form>
        </div>

        {/* Events */}
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Events</h2>
          {eventsQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : eventsQuery.error ? (
            <p className="text-sm text-red-600">{errorMessage(eventsQuery.error)}</p>
          ) : (
            <ul className="mb-4 space-y-1 text-sm">
              {eventsQuery.data?.items?.length ? (
                eventsQuery.data.items.map((event) => (
                  <li
                    key={event.id}
                    className="flex justify-between rounded bg-gray-50 px-3 py-1.5"
                  >
                    <span>{event.title}</span>
                    <span className="text-gray-400">
                      {event.status} · v{event.version}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500">No events yet.</li>
              )}
            </ul>
          )}
          <form onSubmit={onSubmitEvent} className="space-y-2 border-t pt-3">
            <input
              className="w-full rounded border px-3 py-1.5 text-sm"
              placeholder="Event title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              required
            />
            <select
              className="w-full rounded border px-3 py-1.5 text-sm"
              value={eventVenueId}
              onChange={(e) => setEventVenueId(e.target.value)}
              required
            >
              <option value="">Select venue…</option>
              {venuesQuery.data?.items?.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="w-full rounded border px-3 py-1.5 text-sm"
              value={eventStart}
              onChange={(e) => setEventStart(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={createEvent.isPending || !effectiveOrgId}
            >
              {createEvent.isPending ? 'Creating…' : 'Create event'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors) {
      const first = Object.entries(error.fieldErrors)[0];
      return first ? `${first[0]}: ${first[1][0]}` : error.message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
