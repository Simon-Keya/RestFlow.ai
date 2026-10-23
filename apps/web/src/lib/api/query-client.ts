import { QueryClient } from "@tanstack/react-query";
import { ApiError, toApiError } from "./errors";

function shouldRetry(failureCount: number, error: unknown) {
  const apiError = error instanceof ApiError ? error : toApiError(error);
  // Don't burn retries on errors a retry can't fix.
  if ([400, 401, 403, 404, 409, 422].includes(apiError.statusCode)) return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
