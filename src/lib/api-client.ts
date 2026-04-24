import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import {
  AUTH_API_URL,
  INVENTORY_API_URL,
  AUTH,
} from "./api-constants";
import { demoAdapter } from "./demo/adapter";
import type { ErrorResponse } from "@/types";

export const DEMO_MODE =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// ═══════════════════════════════════════════════════════════════════
// Axios API Client — dual instances
//
// api.auth       → http://localhost:8000/api/v1  (auth service)
// api.inventory  → http://localhost:8001/api/v1  (inventory service)
//
// Both share:
//   • Bearer token injection from localStorage.access_token
//   • Error normalisation into { status, code, message, fieldErrors, requestId }
//   • Single-flight refresh loop on 401 TOKEN_EXPIRED
//   • Redirect to /login on hard auth failures
//
// Callers pick the right instance explicitly:
//   api.auth.post(AUTH.LOGIN, {...})
//   api.inventory.get("/items")
// ═══════════════════════════════════════════════════════════════════

// ── Token storage helpers (localStorage keys) ─────────────────────

const STORAGE_KEYS = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
  USER: "user_id",
  TENANT: "tenant_id",
  TENANT_NAME: "tenant_name",
  TZ: "user_tz",
  MODULES: "user_modules",
  PERMS: "user_permissions",
  IS_SUPER_ADMIN: "is_super_admin",
} as const;

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.ACCESS);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.REFRESH);
}

function clearAllAuthStorage() {
  if (typeof window === "undefined") return;
  for (const key of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(key);
  }
}

// ── Error type ────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
  requestId: string;
  /** Seconds the client should wait before retrying; only set on 429. */
  retryAfterSeconds?: number;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "status" in error
  );
}

function normalizeError(error: AxiosError<ErrorResponse>): ApiError {
  if (error.response) {
    const { status, data, headers } = error.response;
    const retryAfter = headers?.["retry-after"];
    return {
      status,
      code: data?.code || "UNKNOWN_ERROR",
      message: data?.message || "An unexpected error occurred",
      fieldErrors: data?.field_errors || {},
      requestId: data?.request_id || "",
      retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
    };
  }
  return {
    status: 0,
    code: "NETWORK_ERROR",
    message: "Unable to reach the server. Please check your connection.",
    fieldErrors: {},
    requestId: "",
  };
}

// ── Refresh single-flight ────────────────────────────────────────

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new access/refresh pair.
 * Single-flight: concurrent 401s (and proactive pre-flight refreshes)
 * all await the same promise. Returns the new access token on success;
 * null on failure (caller should treat null as "logged out").
 */
function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  // Holder lets the IIFE's `finally` compare by identity without the
  // TS "used before assigned" pitfall of referencing `wrapped` directly.
  const slot: { promise: Promise<string | null> | null } = { promise: null };

  const wrapped: Promise<string | null> = (async () => {
    try {
      // Raw axios call — bypass the interceptor to avoid recursion.
      // In demo mode, route through the in-memory adapter so refresh
      // works offline.
      const refreshAdapter = DEMO_MODE ? demoAdapter : undefined;
      const response = await axios.post<{
        access_token: string;
        refresh_token: string;
        user_id: string;
        tenant_id: string | null;
        is_super_admin: boolean;
        tz: string;
        modules: string[];
        access_expires_in: number;
      }>(`${AUTH_API_URL}${AUTH.REFRESH}`, { refresh_token: refreshToken }, {
        adapter: refreshAdapter,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.ACCESS, response.data.access_token);
        localStorage.setItem(STORAGE_KEYS.REFRESH, response.data.refresh_token);
      }
      return response.data.access_token;
    } catch {
      return null;
    } finally {
      // Clear only this flight's slot — guards against a race where a
      // fresh refresh starts before this `finally` runs.
      if (refreshInFlight === slot.promise) refreshInFlight = null;
    }
  })();

  slot.promise = wrapped;
  refreshInFlight = wrapped;
  return wrapped;
}

/**
 * Decode the JWT's `exp` claim (no signature check) and return true if
 * the token is expired or about to expire within `bufferSeconds`.
 * Used by the request interceptor to refresh proactively, so we never
 * fire a request that's guaranteed to 401.
 */
function isAccessTokenStale(token: string, bufferSeconds = 30): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    const claims = JSON.parse(json) as { exp?: number };
    if (typeof claims.exp !== "number") return false; // can't tell — trust it
    const now = Math.floor(Date.now() / 1000);
    return claims.exp <= now + bufferSeconds;
  } catch {
    return true;
  }
}

// ── Shared interceptor setup ─────────────────────────────────────

type PendingRequestConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
};

function installInterceptors(instance: AxiosInstance) {
  // Request: inject bearer token. If the stored access token is stale
  // (expired or expiring within 30s), await a single-flight refresh FIRST
  // so we never send a request we know will 401. This is async — axios
  // awaits async request interceptors natively.
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (!config.headers) return config;

      // Safety net: backend caps `limit` on list endpoints at 200. Clamp any
      // accidental larger value so we never send a guaranteed 422.
      if (config.params && typeof config.params === "object") {
        const params = config.params as Record<string, unknown>;
        if (typeof params.limit === "number" && params.limit > 200) {
          params.limit = 200;
        } else if (typeof params.limit === "string") {
          const n = Number(params.limit);
          if (!Number.isNaN(n) && n > 200) params.limit = 200;
        }
      }

      // Caller explicitly supplied Authorization — respect it.
      if (config.headers.Authorization) return config;

      // Skip auth on the refresh endpoint itself (avoids recursion; also
      // we use raw axios for /auth/refresh, so we shouldn't even get here).
      if (config.url?.includes(AUTH.REFRESH)) return config;

      let token = getAccessToken();
      if (token && isAccessTokenStale(token)) {
        const fresh = await refreshAccessToken();
        if (fresh) token = fresh;
        // else: fall through with the stale token; the response interceptor
        // will then trigger logout/redirect via hard-auth-fail path.
      }

      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response: normalise errors; refresh on TOKEN_EXPIRED; redirect on hard auth failures.
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ErrorResponse>) => {
      const apiError = normalizeError(error);
      const originalConfig = error.config as PendingRequestConfig | undefined;

      // Try to refresh once on stale access token.
      if (
        apiError.status === 401 &&
        apiError.code === "TOKEN_EXPIRED" &&
        originalConfig &&
        !originalConfig._retried
      ) {
        originalConfig._retried = true;
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          originalConfig.headers = originalConfig.headers ?? {};
          originalConfig.headers.Authorization = `Bearer ${newAccess}`;
          return instance.request(originalConfig);
        }
        // Refresh failed — fall through to logout.
      }

      // Hard auth failures → clear + redirect.
      const hardAuthFail =
        apiError.status === 401 &&
        ["AUTHENTICATION_REQUIRED", "INVALID_TOKEN", "INVALID_REFRESH_TOKEN"].includes(
          apiError.code,
        );

      if (hardAuthFail || (apiError.status === 401 && originalConfig?._retried)) {
        clearAllAuthStorage();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }

      // Surface network errors globally (they can't have a meaningful
      // per-page onError handler since the request never reached the server).
      if (apiError.status === 0 && apiError.code === "NETWORK_ERROR") {
        // Lazy-import to avoid a circular dep with the toast module.
        import("./toast-emitter").then(({ toastEmitter }) =>
          toastEmitter.error(
            "Can't reach the server",
            "Check your internet connection and try again.",
          ),
        );
      }

      return Promise.reject(apiError);
    },
  );
}

// ── Build the two instances ──────────────────────────────────────

function makeClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
  });
  if (DEMO_MODE) {
    // Swap the HTTP adapter for the in-memory fixture adapter.
    // Everything else (interceptors, error shape, refresh loop) runs
    // unchanged — the demo just lives behind axios.
    instance.defaults.adapter = demoAdapter;
  }
  installInterceptors(instance);
  return instance;
}

const authAxios = makeClient(AUTH_API_URL);
const inventoryAxios = makeClient(INVENTORY_API_URL);

// ── Thin typed wrapper around an axios instance ──────────────────

class ServiceClient {
  constructor(private client: AxiosInstance) {}

  async get<T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
    const response = await this.client.get<T>(url, { params, headers });
    return response.data;
  }

  async getWithHeaders<T>(
    url: string,
    params?: Record<string, unknown>,
  ): Promise<{ data: T; headers: Record<string, string> }> {
    const response = await this.client.get<T>(url, { params });
    return {
      data: response.data,
      headers: response.headers as Record<string, string>,
    };
  }

  async post<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this.client.post<T>(url, data, { headers });
    return response.data;
  }

  async put<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this.client.put<T>(url, data, { headers });
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this.client.patch<T>(url, data, { headers });
    return response.data;
  }

  async patchWithEtag<T>(url: string, data: unknown, etag: string): Promise<T> {
    return this.patch<T>(url, data, { "If-Match": etag });
  }

  async delete<T = void>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await this.client.delete<T>(url, { headers });
    return response.data;
  }

  /** Raw axios instance escape hatch — use sparingly. */
  getInstance(): AxiosInstance {
    return this.client;
  }
}

// ── Public surface ───────────────────────────────────────────────

const authClient = new ServiceClient(authAxios);
const inventoryClient = new ServiceClient(inventoryAxios);

/**
 * Dual-service api client.
 *
 *   api.auth        → auth service (:8000)
 *   api.inventory   → inventory service (:8001)
 *
 * The flat methods (`api.get`, `api.post`, …) are a BACK-COMPAT SHIM
 * that routes to the inventory service. Pre-split services use them
 * and will keep working. NEW code should call `api.auth.*` or
 * `api.inventory.*` explicitly. Once every service is migrated, drop
 * the shim (tracked in FRONTEND.md §15).
 */
export const api: ServiceClient & {
  auth: ServiceClient;
  inventory: ServiceClient;
} = Object.assign(inventoryClient, {
  auth: authClient,
  inventory: inventoryClient,
});
