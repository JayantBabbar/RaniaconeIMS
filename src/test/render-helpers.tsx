import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import type { AuthState } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Test render helpers.
//
// Pattern: tests `vi.mock("@/providers/auth-provider", ...)` at the top
// of their file and use `mockAuth({...})` to dial in permissions. This
// helper then wraps the UI with a QueryClient (so hooks that use it
// don't blow up) and renders.
// ═══════════════════════════════════════════════════════════════════

interface AuthStub {
  permissions?: string[];
  modules?: string[];
  isSuperAdmin?: boolean;
  tenantId?: string | null;
  userId?: string;
  isAuthenticated?: boolean;
  isLoading?: boolean;
}

export function buildAuthState(stub: AuthStub = {}): AuthState {
  return {
    isAuthenticated: stub.isAuthenticated ?? true,
    isLoading: stub.isLoading ?? false,
    user: {
      id: stub.userId || "user-1",
      tenant_id: stub.tenantId ?? "tenant-1",
      email: "test@example.com",
      full_name: "Test User",
      is_active: true,
      is_super_admin: stub.isSuperAdmin ?? false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    tenantId: stub.tenantId ?? "tenant-1",
    tenantName: "Test Tenant",
    isSuperAdmin: stub.isSuperAdmin ?? false,
    permissions: new Set(stub.permissions ?? []),
    modules: stub.modules ?? ["inventory"],
    tz: "UTC",
  };
}

/**
 * Build a fake useAuth return value. Pass its output into the mocked
 * `useAuth` implementation from your test file's vi.mock block.
 */
export function buildUseAuthReturn(stub: AuthStub = {}) {
  const state = buildAuthState(stub);
  return {
    ...state,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    refreshUser: vi.fn(async () => {}),
    hasPermission: (code: string) =>
      state.isSuperAdmin || state.permissions.has(code),
    hasAnyPermission: (...codes: string[]) =>
      state.isSuperAdmin || codes.some((c) => state.permissions.has(c)),
    isModuleSubscribed: (code: string) =>
      state.isSuperAdmin || state.modules.includes(code),
  };
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

/**
 * Render a component wrapped in a fresh QueryClient. Does NOT provide
 * AuthProvider — tests should mock @/providers/auth-provider via vi.mock
 * if the tree under test uses useAuth().
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {},
) {
  const qc =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}
