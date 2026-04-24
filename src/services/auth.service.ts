import { api } from "@/lib/api-client";
import { AUTH } from "@/lib/api-constants";
import type {
  TokenResponse,
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
  User,
  AccessTokenPayload,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Auth Service — talks to the auth service at :8000
//
// Every endpoint here lives under /auth/* on the auth service. Inventory
// service has no auth endpoints any more.
// ═══════════════════════════════════════════════════════════════════

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

// ── Storage helpers ───────────────────────────────────────────────

function persistTokenResponse(resp: TokenResponse, perms?: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ACCESS, resp.access_token);
  localStorage.setItem(STORAGE_KEYS.REFRESH, resp.refresh_token);
  localStorage.setItem(STORAGE_KEYS.USER, resp.user_id);
  if (resp.tenant_id) localStorage.setItem(STORAGE_KEYS.TENANT, resp.tenant_id);
  else localStorage.removeItem(STORAGE_KEYS.TENANT);
  localStorage.setItem(STORAGE_KEYS.TZ, resp.tz);
  localStorage.setItem(STORAGE_KEYS.MODULES, JSON.stringify(resp.modules));
  localStorage.setItem(
    STORAGE_KEYS.IS_SUPER_ADMIN,
    resp.is_super_admin ? "1" : "0",
  );
  if (perms) {
    localStorage.setItem(STORAGE_KEYS.PERMS, JSON.stringify(perms));
  }
}

function clearAllAuthStorage() {
  if (typeof window === "undefined") return;
  for (const key of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(key);
  }
}

// ── JWT decode (no signature check — server verifies) ────────────

/**
 * Decode a JWT's payload segment. Does NOT verify the signature — the
 * backend does that. We only need the claims for client-side UX gating
 * (permissions, subscribed modules, tz).
 */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64 → utf-8.
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decodeURIComponent(escape(json))) as AccessTokenPayload;
  } catch {
    return null;
  }
}

// ── Service ──────────────────────────────────────────────────────

export const authService = {
  /**
   * Log in with email + password. Persists tokens + session metadata
   * to localStorage and returns the full token response.
   */
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const resp = await api.auth.post<TokenResponse>(AUTH.LOGIN, credentials);
    const claims = decodeAccessToken(resp.access_token);
    persistTokenResponse(resp, claims?.perms);
    return resp;
  },

  /**
   * Admin-invite flow: register a user under a specific tenant. Either
   * tenant_id or tenant_code must be supplied.
   */
  async register(data: RegisterRequest): Promise<User> {
    return api.auth.post<User>(AUTH.REGISTER, data);
  },

  /**
   * Change the current user's password. On success the backend revokes
   * every refresh token for this user — the caller should warn the user
   * and either log out or continue until the access token expires.
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.auth.post(AUTH.CHANGE_PASSWORD, data);
  },

  /**
   * Return the current user row (uses the stored access token).
   * Bootstrap call on page reload.
   */
  async me(): Promise<User> {
    return api.auth.get<User>(AUTH.ME);
  },

  /**
   * Logout — revokes the stored refresh token (best-effort), then
   * clears every auth key from localStorage. The caller is responsible
   * for redirecting to /login.
   */
  async logout(): Promise<void> {
    const refresh = this.getRefreshToken();
    if (refresh) {
      try {
        await api.auth.post(AUTH.LOGOUT, { refresh_token: refresh });
      } catch {
        // Best-effort — the session is going away either way.
      }
    }
    clearAllAuthStorage();
  },

  // ── Storage accessors ──────────────────────────────────────

  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS);
  },

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.ACCESS);
  },

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.REFRESH);
  },

  getUserId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.USER);
  },

  getTenantId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.TENANT);
  },

  getTenantName(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEYS.TENANT_NAME);
  },

  setTenantName(name: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.TENANT_NAME, name);
  },

  getStoredClaims(): {
    tz: string;
    modules: string[];
    permissions: string[];
    isSuperAdmin: boolean;
  } {
    if (typeof window === "undefined") {
      return { tz: "UTC", modules: [], permissions: [], isSuperAdmin: false };
    }
    const tz = localStorage.getItem(STORAGE_KEYS.TZ) || "UTC";
    const modulesRaw = localStorage.getItem(STORAGE_KEYS.MODULES);
    const permsRaw = localStorage.getItem(STORAGE_KEYS.PERMS);
    const saRaw = localStorage.getItem(STORAGE_KEYS.IS_SUPER_ADMIN);
    return {
      tz,
      modules: modulesRaw ? safeJsonArray(modulesRaw) : [],
      permissions: permsRaw ? safeJsonArray(permsRaw) : [],
      isSuperAdmin: saRaw === "1",
    };
  },
};

function safeJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
