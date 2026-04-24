import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// ═══════════════════════════════════════════════════════════════════
// MSW server for integration tests.
//
// Expose `server` + factory helpers. Individual tests override handlers
// via `server.use(...)` for scenario-specific responses.
// ═══════════════════════════════════════════════════════════════════

export const AUTH_BASE = "http://localhost:8000/api/v1";
export const INV_BASE = "http://localhost:8001/api/v1";

// Build a JWT payload matching our AccessTokenPayload type.
// `jti` must vary across calls so the same-second-refresh case has unique ids.
let tokenSeq = 0;
export function makeAccessToken(
  overrides: Partial<{
    sub: string;
    tid: string | null;
    sa: boolean;
    tz: string;
    mods: string[];
    roles: string[];
    perms: string[];
    expIn: number; // seconds from now
  }> = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: "access",
    sub: overrides.sub ?? "user-1",
    tid: overrides.tid === undefined ? "tenant-1" : overrides.tid,
    sa: overrides.sa ?? false,
    tz: overrides.tz ?? "UTC",
    mods: overrides.mods ?? ["inventory"],
    roles: overrides.roles ?? ["admin"],
    perms: overrides.perms ?? ["inventory.items.read"],
    jti: `jti-${++tokenSeq}`,
    iat: now,
    exp: now + (overrides.expIn ?? 900),
  };
  const toB64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${toB64Url({ alg: "RS256", typ: "JWT" })}.${toB64Url(payload)}.sig`;
}

export function makeLoginResponse(
  overrides: Partial<{
    access_token: string;
    refresh_token: string;
    user_id: string;
    tenant_id: string | null;
    is_super_admin: boolean;
    tz: string;
    modules: string[];
  }> = {},
) {
  const access = overrides.access_token ?? makeAccessToken();
  return {
    access_token: access,
    refresh_token: overrides.refresh_token ?? `r-${Date.now()}`,
    token_type: "bearer" as const,
    access_expires_in: 900,
    user_id: overrides.user_id ?? "user-1",
    tenant_id: overrides.tenant_id === undefined ? "tenant-1" : overrides.tenant_id,
    is_super_admin: overrides.is_super_admin ?? false,
    tz: overrides.tz ?? "UTC",
    modules: overrides.modules ?? ["inventory"],
  };
}

// Default handlers — happy paths. Tests override specifics with server.use().
export const defaultHandlers = [
  http.post(`${AUTH_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.password === "wrong") {
      return HttpResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
          field_errors: {},
          request_id: "req-fail",
        },
        { status: 422 },
      );
    }
    return HttpResponse.json(makeLoginResponse());
  }),
  http.post(`${AUTH_BASE}/auth/refresh`, async () =>
    HttpResponse.json(makeLoginResponse()),
  ),
  http.post(`${AUTH_BASE}/auth/logout`, () =>
    HttpResponse.json({}, { status: 204 }),
  ),
  http.get(`${AUTH_BASE}/auth/me`, () =>
    HttpResponse.json({
      id: "user-1",
      tenant_id: "tenant-1",
      email: "test@example.com",
      full_name: "Test User",
      timezone: null,
      is_active: true,
      is_super_admin: false,
      last_login_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }),
  ),
];

export const server = setupServer(...defaultHandlers);
