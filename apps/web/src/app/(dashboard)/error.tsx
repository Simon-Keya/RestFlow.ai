"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardGroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-danger-500" aria-hidden />
      <div>
        <h1 className="font-display text-lg font-semibold text-ink">This section hit an error</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{error.message || "Try reloading — if it keeps happening, let your admin know."}</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
