import type { z } from 'zod';
import {
  eventDtoSchema,
  organizationDtoSchema,
  venueDtoSchema,
  paginatedSchema,
} from '@c1rcle/types/client';
import { env } from '@/lib/env';

/**
 * ─── V2 partner api-client (T02 contract) ─────────────────────────────────────
 * The single typed transport for the V2 partner slice. Routes to `/api/v2`,
 * which Next rewrites to the gateway while `NEXT_PUBLIC_V2_ENABLED=true`.
 *
 * Response rules enforced here:
 *  - 2xx → runtime-validated against the canonical schema from
 *    `@c1rcle/types/client` (the frontend never redefines API shapes).
 *  - non-2xx → throws `ApiError` with the stable `{ status, code, message,
 *    requestId, fieldErrors? }` shape.
 *
 * Auth: `Authorization: Bearer <firebase idToken>` + `X-Organization-Id` for
 * the org scope of the call. The gateway never trusts the client org id for
 * authz — the id only selects which of the caller's memberships to act as.
 */

export const V2_ENABLED = env.NEXT_PUBLIC_V2_ENABLED === 'true';

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, readonly string[]>;
  readonly details?: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message || `Request failed with status ${body.status}`);
    this.name = 'ApiError';
    this.status = body.status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.fieldErrors = body.fieldErrors;
    this.details = body.details;
  }
}

interface V2RequestInit extends Omit<RequestInit, 'body'> {
  organizationId?: string;
  idempotencyKey?: string;
  token?: string;
  body?: unknown;
}

interface V2FetchOptions {
  orgId?: string;
  idempotencyKey?: string;
}

export async function apiFetch<T>(
  path: string,
  options?: V2FetchOptions,
  auth?: { token: string },
): Promise<T>;
export async function apiFetch<T>(
  path: string,
  options: V2FetchOptions & { method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown },
  auth?: { token: string },
): Promise<T>;
export async function apiFetch<T>(
  path: string,
  options: V2FetchOptions & { method?: string; body?: unknown } = {},
  auth?: { token: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-request-id':
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `req_${Date.now()}`,
  };

  if (options.orgId) headers['x-organization-id'] = options.orgId;
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  if (auth?.token) headers['authorization'] = `Bearer ${auth.token}`;

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    next: { revalidate: 0 },
  };
  if (options.body !== undefined && options.method !== 'GET') {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, init);
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const err =
      payload &&
      typeof payload === 'object' &&
      'status' in (payload as Record<string, unknown>) &&
      'code' in (payload as Record<string, unknown>)
        ? (payload as ApiErrorBody)
        : {
            status: response.status,
            code: 'unknown',
            message: `Request failed with status ${response.status}`,
          };
    throw new ApiError(err);
  }

  return payload as T;
}

/** Envelope types for the collection responses. */
const organizationsPaginated = paginatedSchema(organizationDtoSchema);
const venuesPaginated = paginatedSchema(venueDtoSchema);
const eventsPaginated = paginatedSchema(eventDtoSchema);

export type OrgListResponse = z.infer<typeof organizationsPaginated>;
export type VenueListResponse = z.infer<typeof venuesPaginated>;
export type EventListResponse = z.infer<typeof eventsPaginated>;

/** Validates payloads against the canonical schemas so a contract drift fails loud. */
export function validateEventDto(payload: unknown): z.infer<typeof eventDtoSchema> {
  const parsed = eventDtoSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      status: 502,
      code: 'invalid_response',
      message: `V2 /events response violated the canonical event schema: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    });
  }
  return parsed.data;
}

export function validateOrganizationDto(payload: unknown): z.infer<typeof organizationDtoSchema> {
  const parsed = organizationDtoSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      status: 502,
      code: 'invalid_response',
      message: `V2 /organizations response violated the contract: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
    });
  }
  return parsed.data;
}

export function validateVenueDto(payload: unknown): z.infer<typeof venueDtoSchema> {
  const parsed = venueDtoSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      status: 502,
      code: 'invalid_response',
      message: `V2 /venues response violated the contract: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
    });
  }
  return parsed.data;
}

/** All V2 partner calls go through the Next rewrite (present only while the flag is on). */
export const V2_BASE_URL = '/api/v2/partner';

export function v2ErrorFromRaw(error: unknown): ApiError | null {
  return error instanceof ApiError ? error : null;
}
