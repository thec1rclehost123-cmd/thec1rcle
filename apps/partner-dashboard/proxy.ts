import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

/**
 * Request proxy hook for API tracing.
 *
 * Injects x-request-id for end-to-end tracing across partner dashboard API routes.
 */
export function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
