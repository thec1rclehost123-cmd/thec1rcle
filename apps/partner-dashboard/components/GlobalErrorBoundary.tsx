'use client';

import type { PropsWithChildren } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

export function GlobalErrorBoundary({ children }: PropsWithChildren) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
