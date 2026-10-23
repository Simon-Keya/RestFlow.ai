"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort boundary around the whole app. Feature-level errors should be caught by each
 * route's own `error.tsx` first — this only fires for things that happen outside the router's
 * reach (e.g. inside a provider).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-danger-500" aria-hidden />
          <div>
            <h1 className="font-display text-lg font-semibold text-ink">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </h1>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              The page hit an unexpected error. Reloading usually fixes it.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
