import { QueryClient } from "@tanstack/react-query";

// Configured client consumed by App.tsx. Memory-only (no persister)
// (spec 20 §1.3.2). Conservative defaults so refetch/retry don't queue badly
// behind the 30/min limiter (spec 20 §3.4, R6). Values are a starting point.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // preserves the old "~5-min" caching intent
      gcTime: 10 * 60_000,
      retry: 1, // conservative: avoid amplifying load behind the 30/min limiter
      refetchOnWindowFocus: false,
    },
  },
});
