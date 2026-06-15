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
