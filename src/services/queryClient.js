import { QueryClient } from '@tanstack/react-query';

// Central QueryClient with sensible defaults for a TV app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep results fresh for 5 minutes; avoid noisy refetches on focus/reconnect
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

export default queryClient;


