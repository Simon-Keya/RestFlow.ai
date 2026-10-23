"use client";

import { QueryProvider } from "./QueryProvider";
import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./ToastProvider";
import { ToastViewport } from "@/components/feedback/ToastViewport";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";

/** Single composition root, mounted once in `app/layout.tsx`. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
          <ToastViewport />
        </ToastProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
