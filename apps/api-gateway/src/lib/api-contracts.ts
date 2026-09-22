import type { ZodError } from 'zod';
import type { ApiError, ApiErrorCode, FieldErrors, RequestId } from '@c1rcle/types';

export type { ApiError, ApiErrorCode, FieldErrors, RequestId } from '@c1rcle/types';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Array<{ path: string; message: string }> | Record<string, unknown> | null;
  requestId?: string;
}

export interface StandardErrorResponse {
  error: ApiErrorPayload;
}

export function buildErrorResponse(
  payload: ApiErrorPayload,
): StandardErrorResponse & { success: false } {
  const error: ApiErrorPayload = {
    code: payload.code,
    message: payload.message,
  };

  if (payload.details && (Array.isArray(payload.details) ? payload.details.length > 0 : true)) {
    error.details = payload.details;
  }

  if (payload.requestId) {
    error.requestId = payload.requestId;
  }

  return { success: false, error };
}

/**
 * Wraps a payload in the canonical success envelope.
 * All existing top-level fields from `data` are also spread at the root
 * for backward compatibility with clients that consumed the flat shape.
 */
export function buildSuccessResponse<T extends Record<string, unknown>>(
  data: T,
): { success: true; data: T } & T {
  return { success: true, data, ...data };
}

export function buildValidationDetails(
  issues: Array<{ path?: Array<string | number>; message: string }> = [],
) {
  return issues.map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.join('.') : '',
    message: issue.message,
  }));
}

/**
 * ─── V2 API error contract (additive layer) ──────────────────────────────────
 * New canonical error shape for `/api/v2`. V1 continues to use
 * `buildErrorResponse` + `details` verbatim (frozen, tested).
 */

/** Locked status → code table. Test-enforced in api-contracts.test.ts. */
export const V2_STATUS_CODE_TO_ERROR_CODE: Readonly<Record<number, ApiErrorCode>> = {
  400: 'validation',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
  429: 'rate_limited',
};

export function errorCodeForStatus(status: number): ApiErrorCode {
  const mapped = V2_STATUS_CODE_TO_ERROR_CODE[status];
  if (mapped) return mapped;
  return status >= 500 ? 'server' : 'unknown';
}

/** Flattens a zod error into `{ field: string[] }` — the V2 `fieldErrors` shape. */
export function zodToFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues ?? []) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Builds the V2 error body `{ code, message, fieldErrors?, requestId? }`.
 * The `status` mirrors the HTTP status so clients can branch on it if needed.
 */
export interface V2ErrorBody extends ApiError {
  status: number;
}

export function buildV2ErrorResponse(input: {
  status: number;
  message: string;
  code?: ApiErrorCode;
  requestId?: RequestId;
  fieldErrors?: FieldErrors;
  details?: unknown;
}): V2ErrorBody {
  const error: V2ErrorBody = {
    status: input.status,
    code: input.code ?? errorCodeForStatus(input.status),
    message: input.message,
  };
  if (input.requestId) error.requestId = input.requestId;
  if (input.fieldErrors && Object.keys(input.fieldErrors).length > 0) {
    error.fieldErrors = input.fieldErrors;
  }
  if (input.details !== undefined) error.details = input.details;
  return error;
}
