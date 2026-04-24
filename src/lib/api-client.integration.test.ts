import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server, AUTH_BASE, INV_BASE, makeLoginResponse, makeAccessToken } from "@/test/msw";
import { api, isApiError } from "./api-client";

beforeEach(() => {
  // Force-logged-in state. Tests that exercise unauthenticated paths
  // explicitly clear localStorage inside the test.
  localStorage.setItem("access_token", makeAccessToken());
  localStorage.setItem("refresh_token", "r-initial");
});

describe("api.get — response normalization and error shape", () => {
  it("returns parsed body on 200", async () => {
    server.use(
      http.get(`${INV_BASE}/items`, () =>
        HttpResponse.json([{ id: "1", name: "Widget" }]),
      ),
    );
    const res = await api.inventory.get<Array<{ id: string }>>("/items");
    expect(res).toEqual([{ id: "1", name: "Widget" }]);
  });

  it("wraps a 4xx with code + message + field_errors + request_id", async () => {
    server.use(
      http.post(`${INV_BASE}/items`, () =>
        HttpResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Bad input",
            field_errors: { name: "required" },
            request_id: "trace-abc",
          },
          { status: 422 },
        ),
      ),
    );
    try {
      await api.inventory.post("/items", {});
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (!isApiError(err)) return;
      expect(err.status).toBe(422);
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.fieldErrors).toEqual({ name: "required" });
      expect(err.requestId).toBe("trace-abc");
    }
  });
});

describe("limit-clamp safety net", () => {
  it("clamps limit > 200 to 200 before the request leaves the client", async () => {
    let seenLimit: string | null = null;
    server.use(
      http.get(`${INV_BASE}/items`, ({ request }) => {
        const url = new URL(request.url);
        seenLimit = url.searchParams.get("limit");
        return HttpResponse.json([]);
      }),
    );
    await api.inventory.get("/items", { limit: 500 });
    expect(seenLimit).toBe("200");
  });

  it("passes limit <= 200 unchanged", async () => {
    let seenLimit: string | null = null;
    server.use(
      http.get(`${INV_BASE}/items`, ({ request }) => {
        const url = new URL(request.url);
        seenLimit = url.searchParams.get("limit");
        return HttpResponse.json([]);
      }),
    );
    await api.inventory.get("/items", { limit: 50 });
    expect(seenLimit).toBe("50");
  });
});

describe("dual base URLs", () => {
  it("api.auth routes to the auth service", async () => {
    let saw: string | null = null;
    server.use(
      http.get(`${AUTH_BASE}/permissions`, ({ request }) => {
        saw = new URL(request.url).origin;
        return HttpResponse.json([]);
      }),
    );
    await api.auth.get("/permissions");
    expect(saw).toBe("http://localhost:8000");
  });

  it("api.inventory routes to the inventory service", async () => {
    let saw: string | null = null;
    server.use(
      http.get(`${INV_BASE}/items`, ({ request }) => {
        saw = new URL(request.url).origin;
        return HttpResponse.json([]);
      }),
    );
    await api.inventory.get("/items");
    expect(saw).toBe("http://localhost:8001");
  });
});

describe("refresh-on-401 flow", () => {
  it("transparently refreshes a stale access token and retries", async () => {
    // 1) First access token is expired (exp in the past) so the request
    //    interceptor will pre-emptively refresh.
    const staleToken = makeAccessToken({ expIn: -60 });
    localStorage.setItem("access_token", staleToken);

    let refreshCalls = 0;
    let itemsAuthHeader: string | null = null;
    server.use(
      http.post(`${AUTH_BASE}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(
          makeLoginResponse({ access_token: makeAccessToken({ expIn: 900 }) }),
        );
      }),
      http.get(`${INV_BASE}/items`, ({ request }) => {
        itemsAuthHeader = request.headers.get("Authorization");
        return HttpResponse.json([{ id: "x" }]);
      }),
    );

    const res = await api.inventory.get<Array<{ id: string }>>("/items");
    expect(res).toEqual([{ id: "x" }]);
    expect(refreshCalls).toBe(1);
    expect(itemsAuthHeader).toBeTruthy();
    // The retry must carry the FRESH token, not the stale one.
    expect(itemsAuthHeader!.startsWith("Bearer ")).toBe(true);
    expect(itemsAuthHeader).not.toContain(staleToken);
  });

  it("coalesces N parallel requests into a single refresh", async () => {
    const staleToken = makeAccessToken({ expIn: -60 });
    localStorage.setItem("access_token", staleToken);

    let refreshCalls = 0;
    server.use(
      http.post(`${AUTH_BASE}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(
          makeLoginResponse({ access_token: makeAccessToken({ expIn: 900 }) }),
        );
      }),
      http.get(`${INV_BASE}/items`, () => HttpResponse.json([])),
      http.get(`${INV_BASE}/balances`, () => HttpResponse.json([])),
      http.get(`${INV_BASE}/parties`, () => HttpResponse.json([])),
    );

    await Promise.all([
      api.inventory.get("/items"),
      api.inventory.get("/balances"),
      api.inventory.get("/parties"),
    ]);
    expect(refreshCalls).toBe(1);
  });
});
