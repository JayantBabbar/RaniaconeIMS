"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { authService, decodeAccessToken } from "@/services/auth.service";
import type { User, AuthState, LoginRequest } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// AuthProvider — session state hub.
//
// On mount, if an access token exists:
//   1. decode it → seed perms/modules/tz/isSuperAdmin
//   2. fetch /auth/me → seed user
// On login, the auth service persists tokens; this provider decodes
// the fresh access token and updates state.
// ═══════════════════════════════════════════════════════════════════

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  isModuleSubscribed: (code: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  tenantId: null,
  tenantName: null,
  isSuperAdmin: false,
  permissions: new Set(),
  modules: [],
  tz: "UTC",
};

// ── State hydration from a decoded JWT + user row ────────────────

function stateFromToken(token: string, user: User | null, tenantName: string | null): AuthState {
  const claims = decodeAccessToken(token);
  return {
    isAuthenticated: true,
    isLoading: false,
    user,
    tenantId: claims?.tid ?? null,
    tenantName,
    isSuperAdmin: claims?.sa ?? false,
    permissions: new Set(claims?.perms ?? []),
    modules: claims?.mods ?? [],
    tz: claims?.tz ?? "UTC",
  };
}

// ── Provider ─────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const router = useRouter();

  // Bootstrap from storage on mount.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = authService.getAccessToken();
      if (!token) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      // Seed from the stored JWT right away so permission-gated chrome
      // can render without waiting on the /me round-trip.
      const tenantName = authService.getTenantName();
      setState(stateFromToken(token, null, tenantName));

      try {
        const user = await authService.me();
        if (cancelled) return;
        setState((s) => ({ ...s, user }));
      } catch {
        // Token invalid / expired-beyond-refresh — the interceptor already
        // redirected to /login and cleared storage.
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Login ──
  const login = useCallback(
    async (credentials: LoginRequest) => {
      const tokenResponse = await authService.login(credentials);
      const user = await authService.me();

      // Try to name the workspace. Super admins don't have one; tenant
      // users get a prettier string once we fetch the tenant row on
      // relevant pages. For now, fall back to "Platform" or the tenant_id.
      const tenantName = tokenResponse.is_super_admin
        ? "Platform"
        : authService.getTenantName() ?? null;

      setState(stateFromToken(tokenResponse.access_token, user, tenantName));

      if (tokenResponse.is_super_admin) {
        router.push("/platform/overview");
      } else {
        router.push("/dashboard");
      }
    },
    [router],
  );

  // ── Logout ──
  const logout = useCallback(async () => {
    await authService.logout();
    setState({ ...INITIAL_STATE, isLoading: false });
    router.push("/login");
  }, [router]);

  // ── Permission + module helpers ──
  const hasPermission = useCallback(
    (code: string): boolean => {
      if (state.isSuperAdmin) return true;
      return state.permissions.has(code);
    },
    [state.permissions, state.isSuperAdmin],
  );

  const hasAnyPermission = useCallback(
    (...codes: string[]): boolean => {
      if (state.isSuperAdmin) return true;
      return codes.some((c) => state.permissions.has(c));
    },
    [state.permissions, state.isSuperAdmin],
  );

  const isModuleSubscribed = useCallback(
    (code: string): boolean => {
      if (state.isSuperAdmin) return true;
      return state.modules.includes(code);
    },
    [state.modules, state.isSuperAdmin],
  );

  // ── Re-fetch the current user (e.g. after profile edit) ──
  const refreshUser = useCallback(async () => {
    try {
      const user = await authService.me();
      setState((s) => ({ ...s, user }));
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        isModuleSubscribed,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
