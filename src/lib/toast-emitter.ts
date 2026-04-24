// ═══════════════════════════════════════════════════════════════════
// toast-emitter — module-level pub/sub for toasts.
//
// Lets non-React code (axios interceptors, QueryClient default handlers)
// trigger toasts without needing React context.
//
// Wire-up: ToastProvider subscribes on mount via subscribeToasts().
// Any call to toastEmitter.error(...) then reaches the visible toast UI.
// ═══════════════════════════════════════════════════════════════════

import { isApiError, type ApiError } from "./api-client";

export type ToastEmitType = "success" | "error" | "warning" | "info";

export interface ToastEmitPayload {
  type: ToastEmitType;
  message: string;
  description?: string;
  code?: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
}

type Listener = (t: ToastEmitPayload) => void;

const listeners = new Set<Listener>();

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(t: ToastEmitPayload) {
  Array.from(listeners).forEach((l) => l(t));
}

// ── Public surface ─────────────────────────────────────────────────

export const toastEmitter = {
  success(message: string, description?: string) {
    emit({ type: "success", message, description });
  },
  error(message: string, description?: string) {
    emit({ type: "error", message, description });
  },
  warning(message: string, description?: string) {
    emit({ type: "warning", message, description });
  },
  info(message: string, description?: string) {
    emit({ type: "info", message, description });
  },
  /**
   * Format an unknown error into a rich error toast. Accepts ApiError,
   * Error, or anything. Silent for codes that are handled elsewhere
   * (e.g. TOKEN_EXPIRED triggers a silent refresh loop).
   */
  apiError(err: unknown, fallback?: string) {
    // Silence errors the app handles without user interaction.
    if (isApiError(err)) {
      const e = err as ApiError;
      // Refresh loop handles these silently; redirect happens automatically.
      if (
        e.code === "TOKEN_EXPIRED" ||
        e.code === "AUTHENTICATION_REQUIRED" ||
        e.code === "INVALID_TOKEN" ||
        e.code === "INVALID_REFRESH_TOKEN"
      ) {
        return;
      }
      emit({
        type: "error",
        message: e.message || fallback || "Something went wrong",
        code: e.code,
        requestId: e.requestId || undefined,
        fieldErrors:
          Object.keys(e.fieldErrors || {}).length > 0 ? e.fieldErrors : undefined,
      });
      return;
    }
    if (err instanceof Error) {
      emit({ type: "error", message: err.message || fallback || "Something went wrong" });
      return;
    }
    emit({ type: "error", message: fallback || "Something went wrong" });
  },
};
