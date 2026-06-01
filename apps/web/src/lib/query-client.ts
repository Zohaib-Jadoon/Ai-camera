import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 30s — no re-fetch on every component mount (PERF-2)
      staleTime: 30_000,
      // Keep data in memory for 5 minutes after all observers unmount
      gcTime: 5 * 60_000,
      // Don't re-fetch just because the user switched browser tabs
      refetchOnWindowFocus: false,
      // Retry twice on transient network failures
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});
