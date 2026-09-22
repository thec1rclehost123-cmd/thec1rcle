'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  eventDtoSchema,
  organizationDtoSchema,
  paginatedSchema,
  venueDtoSchema,
  type EventDto,
  type OrganizationDto,
  type VenueDto,
} from '@c1rcle/types/client';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import {
  ApiError,
  V2_BASE_URL,
  apiFetch,
  validateEventDto,
  validateOrganizationDto,
  validateVenueDto,
  type EventListResponse,
  type OrgListResponse,
  type VenueListResponse,
} from '@/lib/v2/api-client';

/**
 * ─── V2 partner slice — react-query hooks ─────────────────────────────────────
 * Follows the dashboard convention (DashboardAuthProvider + react-query).
 * Every call sends the Firebase id token + the selected org scope header;
 * the gateway authorizes server-side.
 */

const organizationsPaginated = paginatedSchema(organizationDtoSchema);
const venuesPaginated = paginatedSchema(venueDtoSchema);
const eventsPaginated = paginatedSchema(eventDtoSchema);

async function requireToken(user: unknown): Promise<string> {
  if (!user) throw new ApiError({ status: 401, code: 'unauthorized', message: 'Not signed in' });
  return (user as { getIdToken: () => Promise<string> }).getIdToken();
}

function useAuthToken() {
  const { user } = useDashboardAuth();
  return user as { getIdToken: () => Promise<string>; uid?: string } | null;
}

function parsePaginated<T>(
  schema: ReturnType<typeof paginatedSchema>,
  payload: unknown,
  path: string,
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      status: 502,
      code: 'invalid_response',
      message: `V2 ${path} response violated the contract: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
    });
  }
  return parsed.data as T;
}

/** Organizations the caller is a member of (drives the org switcher). */
export function useOrganizations(options: { enabled?: boolean } = {}) {
  const user = useAuthToken();
  const enabled = !!user && options.enabled !== false;
  return useQuery<OrgListResponse>({
    queryKey: ['v2', 'organizations'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = await requireToken(user);
      const payload = await apiFetch<unknown>(`${V2_BASE_URL}/organizations`, {}, { token });
      return parsePaginated<OrgListResponse>(organizationsPaginated, payload, '/organizations');
    },
  });
}

/** Venues of an organization. */
export function useVenues(organizationId: string | undefined, options: { enabled?: boolean } = {}) {
  const user = useAuthToken();
  const enabled = !!user && !!organizationId && options.enabled !== false;
  return useQuery<VenueListResponse>({
    queryKey: ['v2', 'venues', organizationId],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const token = await requireToken(user);
      const payload = await apiFetch<unknown>(
        `${V2_BASE_URL}/organizations/${organizationId}/venues`,
        { orgId: organizationId },
        { token },
      );
      return parsePaginated<VenueListResponse>(venuesPaginated, payload, '/venues');
    },
  });
}

/** Events of the active organization. */
export function useEvents(organizationId: string | undefined, options: { enabled?: boolean } = {}) {
  const user = useAuthToken();
  const enabled = !!user && !!organizationId && options.enabled !== false;
  return useQuery<EventListResponse>({
    queryKey: ['v2', 'events', organizationId],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const token = await requireToken(user);
      const payload = await apiFetch<unknown>(
        `${V2_BASE_URL}/events`,
        { orgId: organizationId },
        { token },
      );
      return parsePaginated<EventListResponse>(eventsPaginated, payload, '/events');
    },
  });
}

export interface CreateVenueInput {
  name: string;
  slug: string;
}

export interface CreateEventInput {
  venueId: string;
  title: string;
  summary?: string;
  description?: string;
  startAt: string;
  endAt?: string | null;
  tags?: string[];
}

/** Creates a venue under the active organization. */
export function useCreateVenue(organizationId: string | undefined) {
  const user = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation<VenueDto, ApiError, CreateVenueInput>({
    mutationFn: async (input) => {
      const token = await requireToken(user);
      const payload = await apiFetch<unknown>(
        `${V2_BASE_URL}/organizations/${organizationId}/venues`,
        { orgId: organizationId, method: 'POST', body: input },
        { token },
      );
      return validateVenueDto(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['v2', 'venues', organizationId] });
    },
  });
}

/** Creates an event under the active organization. */
export function useCreateEvent(organizationId: string | undefined) {
  const user = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation<EventDto, ApiError, CreateEventInput>({
    mutationFn: async (input) => {
      const token = await requireToken(user);
      const payload = await apiFetch<unknown>(
        `${V2_BASE_URL}/events`,
        { orgId: organizationId, method: 'POST', body: input },
        { token },
      );
      return validateEventDto(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['v2', 'events', organizationId] });
    },
  });
}

export type { OrganizationDto, VenueDto, EventDto };
