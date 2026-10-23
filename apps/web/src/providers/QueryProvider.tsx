"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState (not useMemo) guarantees exactly one client for the lifetime of this provider,
  // even under React 19 strict-mode double-invoke.
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
