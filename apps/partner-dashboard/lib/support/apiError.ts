type ApiErrorDetail = {
  path?: string;
  message?: string;
};

export function formatSupportApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;

  const response = payload as {
    error?: string | { message?: string; details?: ApiErrorDetail[] };
    message?: string;
  };
  const error = response.error;
  const message =
    typeof error === 'string'
      ? error
      : typeof error?.message === 'string'
        ? error.message
        : typeof response.message === 'string'
          ? response.message
          : fallback;
  const details = typeof error === 'object' && Array.isArray(error.details) ? error.details : [];
  const fieldErrors = details
    .filter((detail) => detail?.message)
    .map((detail) => `${detail.path || 'request'}: ${detail.message}`);

  return fieldErrors.length > 0 ? fieldErrors.join(' · ') : message;
}

export async function readSupportApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return formatSupportApiError(payload, fallback);
}
