export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getToken(user: any): Promise<string> {
  return user?.getIdToken ? user.getIdToken() : '';
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...fetchOptions, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || 'Request failed', res.status);
  }

  return res.json();
}

export function apiGet<T = any>(url: string, token: string): Promise<T> {
  return apiFetch<T>(url, { method: 'GET', token });
}

export function apiPost<T = any>(url: string, body: any, token: string): Promise<T> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body), token });
}

export function apiPatch<T = any>(url: string, body: any, token: string): Promise<T> {
  return apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body), token });
}
