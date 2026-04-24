"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { isApiError, type ApiError } from "@/lib/api-client";
import { subscribeToasts } from "@/lib/toast-emitter";

// ═══════════════════════════════════════════════════════════════════
// Toast — success, error, warning, info notifications.
//
// Success / warning / info auto-dismiss after ~4s. Errors stay until
// the user closes them (so they can copy the request_id for support).
//
// Rich API errors have a dedicated `apiError(err)` helper that surfaces
// code, field errors, and request_id in a consistent layout.
// ═══════════════════════════════════════════════════════════════════

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  code?: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, description?: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  /**
   * Rich error from an API call. Accepts an `ApiError` OR any unknown
   * error (falls back gracefully). Pass an optional fallback message
   * used when the error shape is unrecognised.
   */
  apiError: (err: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastType, string> = {
  success: "border-l-status-green bg-white",
  error: "border-l-status-red bg-white",
  warning: "border-l-status-amber bg-white",
  info: "border-l-brand bg-white",
};

const toastIcons: Record<ToastType, string> = {
  success: "M20 6L9 17l-5-5",
  error: "M18 6L6 18M6 6l12 12",
  warning: "M12 9v4M12 17h.01",
  info: "M12 16v-4M12 8h.01",
};

const toastIconColors: Record<ToastType, string> = {
  success: "text-status-green",
  error: "text-status-red",
  warning: "text-status-amber",
  info: "text-brand",
};

const AUTO_DISMISS_MS = 4_000;

// Translate some common error codes into human-friendly action hints.
const FRIENDLY_HINTS: Record<string, string> = {
  VALIDATION_ERROR: "Check the highlighted fields and try again.",
  INVALID_CREDENTIALS: "Double-check your email and password.",
  PERMISSION_DENIED: "Ask your administrator to grant you access.",
  MODULE_NOT_SUBSCRIBED: "This feature isn't active for your workspace.",
  VERSION_MISMATCH: "Someone else updated this — reload and try again.",
  PRECONDITION_REQUIRED: "Reload the page and retry.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a moment.",
  NETWORK_ERROR: "Check your connection and try again.",
  TOKEN_EXPIRED: "Your session expired — refreshing…",
  AUTHENTICATION_REQUIRED: "Please sign in again.",
  TENANT_REQUIRED: "This call needs a tenant context — contact support.",
};

function errorToToast(err: unknown, fallback?: string): Omit<Toast, "id" | "type"> {
  if (isApiError(err)) {
    const e = err as ApiError;
    const hint = FRIENDLY_HINTS[e.code];
    return {
      message: e.message || fallback || "Something went wrong",
      description: hint,
      code: e.code,
      requestId: e.requestId || undefined,
      fieldErrors:
        Object.keys(e.fieldErrors || {}).length > 0 ? e.fieldErrors : undefined,
    };
  }
  if (err instanceof Error) {
    return { message: err.message || fallback || "Something went wrong" };
  }
  return { message: fallback || "Something went wrong" };
}

// ── Provider ────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...t }]);
    // Only auto-dismiss non-error toasts.
    if (t.type !== "error") {
      setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
    }
  }, [removeToast]);

  const value: ToastContextValue = {
    toast: (type, message, description) => push({ type, message, description }),
    success: (m, d) => push({ type: "success", message: m, description: d }),
    error: (m, d) => push({ type: "error", message: m, description: d }),
    warning: (m, d) => push({ type: "warning", message: m, description: d }),
    info: (m, d) => push({ type: "info", message: m, description: d }),
    apiError: (err, fallback) => push({ type: "error", ...errorToToast(err, fallback) }),
  };

  // Bridge the module-level toast emitter so axios interceptors and
  // QueryClient default handlers can surface toasts without React context.
  useEffect(() => {
    return subscribeToasts((payload) => push(payload));
  }, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Toast card ──────────────────────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyRequestId = () => {
    if (!toast.requestId) return;
    navigator.clipboard.writeText(toast.requestId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const fieldErrorEntries = toast.fieldErrors ? Object.entries(toast.fieldErrors) : [];

  return (
    <div
      role="status"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={cn(
        "border border-hairline border-l-[3px] rounded-md shadow-raised p-3",
        "animate-slide-in-right",
        toastStyles[toast.type],
      )}
    >
      <div className="flex items-start gap-2.5">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("mt-0.5 flex-shrink-0", toastIconColors[toast.type])}
          aria-hidden
        >
          <path d={toast.type === "error" || toast.type === "warning" ? "M12 2L2 22h20L12 2z" : "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"} />
          <path d={toastIcons[toast.type]} />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground leading-snug">
            {toast.message}
          </div>
          {toast.description && (
            <div className="mt-0.5 text-xs text-foreground-secondary leading-relaxed">
              {toast.description}
            </div>
          )}

          {fieldErrorEntries.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11.5px] text-status-red-text">
              {fieldErrorEntries.map(([field, msg]) => (
                <li key={field} className="flex gap-1">
                  <span className="font-medium">{field}:</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}

          {(toast.code || toast.requestId) && (
            <div className="mt-2 pt-2 border-t border-hairline-light flex items-center justify-between gap-2 text-[10.5px] text-foreground-muted">
              {toast.code && (
                <code className="font-mono font-medium truncate" title={toast.code}>
                  {toast.code}
                </code>
              )}
              {toast.requestId && (
                <button
                  onClick={copyRequestId}
                  className="font-mono hover:text-foreground-secondary transition-colors shrink-0"
                  title="Copy request ID for support"
                >
                  {copied ? "✓ copied" : `id: ${toast.requestId.slice(0, 8)}…`}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-foreground-muted hover:text-foreground-secondary flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
