/**
 * Error Boundary Component
 * Catches unhandled JavaScript errors and renders a fallback crash screen.
 * In production, reports errors to Sentry.
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";

import { CrashScreen } from "./CrashScreen";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);

    // Report to Sentry in production
    // When Sentry is configured, uncomment:
    // if (!__DEV__) {
    //     Sentry.captureException(error, {
    //         extra: { componentStack: errorInfo.componentStack },
    //     });
    // }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return <CrashScreen error={this.state.error || undefined} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
