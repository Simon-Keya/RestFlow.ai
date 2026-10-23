"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangle className="h-6 w-6 text-danger-600" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
