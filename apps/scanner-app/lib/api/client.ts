const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Lightweight fetch wrapper for all scanner API calls.
 * Attaches X-Scanner-Code header when a scannerCode is provided.
 * Throws on non-2xx responses with .status and .data attached.
 */
export async function scannerFetch(
  path: string,
  options: FetchOptions = {},
  scannerCode?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (scannerCode) {
    headers['x-scanner-code'] = scannerCode;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err: any = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
