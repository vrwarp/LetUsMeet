import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorState from "./ErrorState";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback to render when a descendant throws. Defaults to <ErrorState>. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors in the React tree and shows a friendly fallback
 * instead of a white screen. Wraps the app's <RouterProvider> in main.tsx.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorState />;
    }
    return this.props.children;
  }
}
