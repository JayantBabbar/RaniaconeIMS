import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, AUTH_BASE, makeLoginResponse } from "@/test/msw";
import { authService } from "./auth.service";

describe("authService.login", () => {
  it("persists access + refresh + session metadata on success", async () => {
    const resp = await authService.login({
      email: "test@example.com",
      password: "ok",
    });
    expect(resp.access_token).toBeTruthy();
    expect(resp.refresh_token).toBeTruthy();
    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.getAccessToken()).toBe(resp.access_token);
    expect(authService.getRefreshToken()).toBe(resp.refresh_token);
    expect(authService.getUserId()).toBe(resp.user_id);

    const claims = authService.getStoredClaims();
    expect(claims.tz).toBe("UTC");
    expect(claims.modules).toEqual(["inventory"]);
    expect(claims.isSuperAdmin).toBe(false);
    expect(claims.permissions).toContain("inventory.items.read");
  });

  it("rejects with ApiError on 422 INVALID_CREDENTIALS and does not persist anything", async () => {
    await expect(
      authService.login({ email: "nope@example.com", password: "wrong" }),
    ).rejects.toMatchObject({
      status: 422,
      code: "INVALID_CREDENTIALS",
    });
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getRefreshToken()).toBeNull();
  });
});

describe("authService.logout", () => {
  it("posts to /auth/logout with the refresh token then clears storage", async () => {
    let seenRefresh: string | null = null;
    server.use(
      http.post(`${AUTH_BASE}/auth/logout`, async ({ request }) => {
        const body = (await request.json()) as { refresh_token: string };
        seenRefresh = body.refresh_token;
        return HttpResponse.json({}, { status: 204 });
      }),
    );

    await authService.login({ email: "test@example.com", password: "ok" });
    const refresh = authService.getRefreshToken();

    await authService.logout();
    expect(seenRefresh).toBe(refresh);
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getRefreshToken()).toBeNull();
    expect(authService.getUserId()).toBeNull();
  });

  it("clears storage even when the server logout call fails", async () => {
    server.use(
      http.post(`${AUTH_BASE}/auth/logout`, () =>
        HttpResponse.json({ code: "X" }, { status: 500 }),
      ),
    );

    await authService.login({ email: "test@example.com", password: "ok" });
    await authService.logout();
    expect(authService.isAuthenticated()).toBe(false);
  });
});

describe("authService.me", () => {
  it("returns the current user", async () => {
    await authService.login({ email: "test@example.com", password: "ok" });
    const me = await authService.me();
    expect(me.email).toBe("test@example.com");
    expect(me.is_super_admin).toBe(false);
  });
});

describe("authService.changePassword", () => {
  it("posts current + new password to the change-password endpoint", async () => {
    let seen: { current_password?: string; new_password?: string } | null = null;
    server.use(
      http.post(`${AUTH_BASE}/auth/change-password`, async ({ request }) => {
        seen = (await request.json()) as typeof seen;
        return HttpResponse.json({}, { status: 204 });
      }),
    );
    await authService.login({ email: "test@example.com", password: "ok" });
    await authService.changePassword({
      current_password: "ok",
      new_password: "Newer1Pass!",
    });
    expect(seen).toEqual({
      current_password: "ok",
      new_password: "Newer1Pass!",
    });
  });

  it("throws ApiError on INVALID_CREDENTIALS", async () => {
    server.use(
      http.post(`${AUTH_BASE}/auth/change-password`, () =>
        HttpResponse.json(
          {
            code: "INVALID_CREDENTIALS",
            message: "Wrong current password",
            field_errors: {},
            request_id: "r",
          },
          { status: 422 },
        ),
      ),
    );
    await authService.login({ email: "test@example.com", password: "ok" });
    await expect(
      authService.changePassword({
        current_password: "bad",
        new_password: "Newer1Pass!",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

describe("authService storage accessors", () => {
  it("setTenantName / getTenantName persist through localStorage", () => {
    authService.setTenantName("Acme");
    expect(authService.getTenantName()).toBe("Acme");
  });

  it("getStoredClaims returns safe defaults when nothing is stored", () => {
    const c = authService.getStoredClaims();
    expect(c.tz).toBe("UTC");
    expect(c.modules).toEqual([]);
    expect(c.permissions).toEqual([]);
    expect(c.isSuperAdmin).toBe(false);
  });

  it("persists login response shape for super admins (tenant_id=null)", async () => {
    server.use(
      http.post(`${AUTH_BASE}/auth/login`, () =>
        HttpResponse.json(
          makeLoginResponse({ tenant_id: null, is_super_admin: true }),
        ),
      ),
    );
    await authService.login({ email: "sa@example.com", password: "ok" });
    expect(authService.getTenantId()).toBeNull();
    expect(authService.getStoredClaims().isSuperAdmin).toBe(true);
    expect(localStorage.getItem("is_super_admin")).toBe("1");
  });
});
