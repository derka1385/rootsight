import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";

let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
          // A 4xx says the request itself is wrong, so retrying only delays
          // the message. 408 and 429 are the timing-related exceptions.
          retry: (failureCount, error) => {
            if (
              error instanceof ApiError &&
              error.status >= 400 &&
              error.status < 500 &&
              error.status !== 408 &&
              error.status !== 429
            ) {
              return false;
            }
            return failureCount < 3;
          },
        },
      },
    });
  }
  return client;
}
