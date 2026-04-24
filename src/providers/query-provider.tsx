"use client";

import React, { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { toastEmitter } from "@/lib/toast-emitter";
import { isApiError } from "@/lib/api-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Any uncaught mutation error surfaces via the module-level toast
        // emitter. Pages that handle errors in their own `onError` can call
        // `event.preventDefault()`-style by supplying a custom `meta.silent`.
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.meta?.silent) return;
            if (mutation.options.onError) {
              // Page already handles it — don't double-toast.
              return;
            }
            toastEmitter.apiError(error);
          },
        }),
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silent) return;
            // Silently swallow 401/403 — those are handled by the axios
            // interceptor (refresh + redirect) or by RequireRead/ForbiddenState.
            if (isApiError(error)) {
              const silentCodes = [
                "TOKEN_EXPIRED",
                "AUTHENTICATION_REQUIRED",
                "INVALID_TOKEN",
                "INVALID_REFRESH_TOKEN",
                "PERMISSION_DENIED",
                "MODULE_NOT_SUBSCRIBED",
                "TENANT_REQUIRED",
              ];
              if (silentCodes.includes(error.code)) return;
              // Show only network / 5xx errors from queries — everything else
              // is typically a read-permission issue handled by the page.
              if (error.status >= 500 || error.code === "NETWORK_ERROR") {
                toastEmitter.apiError(error);
              }
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: (failureCount, err) => {
              // Don't retry auth / permission errors.
              if (isApiError(err)) {
                const noRetry = [
                  "TOKEN_EXPIRED",
                  "AUTHENTICATION_REQUIRED",
                  "INVALID_TOKEN",
                  "INVALID_REFRESH_TOKEN",
                  "PERMISSION_DENIED",
                  "MODULE_NOT_SUBSCRIBED",
                  "TENANT_REQUIRED",
                  "NOT_FOUND",
                ];
                if (noRetry.includes(err.code)) return false;
              }
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
