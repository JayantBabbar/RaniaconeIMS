import type { AxiosAdapter, AxiosResponse } from "axios";
import * as F from "./fixtures";

// ═══════════════════════════════════════════════════════════════════
// Demo axios adapter — routes every request to an in-memory handler
// backed by fixture data. Lets the whole app run offline on Vercel.
//
// Supported routes are a superset of what the UI actually calls — when
// the client demos deeper features, we can add more. Unhandled routes
// return 404 with a friendly code.
// ═══════════════════════════════════════════════════════════════════

const LATENCY_MS = 120; // fake network latency — feels "real"

function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), LATENCY_MS));
}

function ok<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    // @ts-expect-error axios config is optional in our response shape
    config: {},
  };
}

function fail(status: number, code: string, message: string, fields: Record<string, string> = {}) {
  const err: any = new Error(message);
  err.isAxiosError = true;
  err.response = {
    status,
    statusText: "Error",
    headers: {},
    config: {},
    data: { code, message, field_errors: fields, request_id: F.uid("req") },
  };
  return err;
}

// ── Token helpers (demo JWTs — unsigned) ─────────────────────────

function b64(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildAccessToken(user: typeof F.USERS[number], roles: string[], perms: string[]): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: "access",
    sub: user.id,
    tid: user.tenant_id,
    sa: user.is_super_admin,
    tz: user.timezone || "UTC",
    mods: ["inventory"],
    roles,
    perms,
    jti: F.uid("jti"),
    iat: now,
    exp: now + 900,
  };
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

function permsFor(user: typeof F.USERS[number]): { roles: string[]; perms: string[] } {
  if (user.is_super_admin) {
    return { roles: ["super_admin"], perms: [] }; // sa bypasses checks
  }
  const userRoleLinks = F.USER_ROLES.filter((ur) => ur.user_id === user.id);
  const roleIds = userRoleLinks.map((r) => r.role_id);
  const roles = F.ROLES.filter((r) => roleIds.includes(r.id));
  const permIds = new Set(
    F.ROLE_PERMISSIONS.filter((rp) => roleIds.includes(rp.role_id)).map(
      (rp) => rp.permission_id,
    ),
  );
  const perms = F.PERMISSIONS.filter((p) => permIds.has(p.id)).map((p) => p.code);
  return { roles: roles.map((r) => r.code), perms };
}

// ── Current caller context ───────────────────────────────────────

function currentCaller(headers: Record<string, any>): {
  user: typeof F.USERS[number] | null;
  actingTenantId: string | null;
} {
  const auth = (headers.Authorization || headers.authorization || "") as string;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let user: typeof F.USERS[number] | null = null;
  if (token) {
    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      user = F.USERS.find((u) => u.id === payload.sub) || null;
    } catch {
      user = null;
    }
  }
  const actingTenantId =
    (headers["X-Acting-Tenant-Id"] as string) ||
    (headers["x-acting-tenant-id"] as string) ||
    null;
  return { user, actingTenantId };
}

function effectiveTenantId(
  user: typeof F.USERS[number] | null,
  actingTenantId: string | null,
): string | null {
  if (!user) return null;
  if (user.is_super_admin) return actingTenantId || F.DEMO_TENANT_ID;
  return user.tenant_id;
}

// ── URL matcher helpers ──────────────────────────────────────────

function match(url: string, pattern: string): Record<string, string> | null {
  const pathU = url.split("?")[0].replace(/\/+$/, "");
  const pathP = pattern.replace(/\/+$/, "");
  const u = pathU.split("/").filter(Boolean);
  const p = pathP.split("/").filter(Boolean);
  if (u.length !== p.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = u[i];
    else if (p[i] !== u[i]) return null;
  }
  return params;
}

function queryParams(url: string): Record<string, string> {
  const q = url.split("?")[1];
  if (!q) return {};
  const out: Record<string, string> = {};
  q.split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  });
  return out;
}

// ── The adapter itself ───────────────────────────────────────────

export const demoAdapter: AxiosAdapter = async (config) => {
  const method = (config.method || "get").toUpperCase();
  const url = new URL(config.url || "", config.baseURL || "http://localhost");
  const path = url.pathname.replace(/^\/api\/v1/, "");
  const body =
    typeof config.data === "string"
      ? safeParse(config.data)
      : (config.data ?? {});
  const headers = (config.headers || {}) as Record<string, any>;
  const { user, actingTenantId } = currentCaller(headers);
  const tid = effectiveTenantId(user, actingTenantId);

  // ─── Health ────────────────────────────
  if (method === "GET" && path === "/health") {
    return delay(ok({ status: "ok", database: "ok", version: "demo-1.0" }));
  }

  // ─── Auth ──────────────────────────────
  if (method === "POST" && path === "/auth/login") {
    const { email, password } = body as { email?: string; password?: string };
    const u = F.USERS.find((x) => x.email.toLowerCase() === (email || "").toLowerCase());
    const expected = F.DEMO_PASSWORDS[(email || "").toLowerCase()];
    if (!u || !expected || expected !== password) {
      throw fail(422, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }
    if (!u.is_active) {
      throw fail(422, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }
    const { roles, perms } = permsFor(u);
    const access = buildAccessToken(u, roles, perms);
    return delay(
      ok({
        access_token: access,
        refresh_token: `demo-refresh-${u.id}`,
        token_type: "bearer",
        access_expires_in: 900,
        user_id: u.id,
        tenant_id: u.tenant_id,
        is_super_admin: u.is_super_admin,
        tz: u.timezone || "UTC",
        modules: ["inventory"],
      }),
    );
  }
  if (method === "POST" && path === "/auth/refresh") {
    const rt = (body as any).refresh_token as string;
    const userId = rt?.replace(/^demo-refresh-/, "");
    const u = F.USERS.find((x) => x.id === userId);
    if (!u) throw fail(401, "INVALID_REFRESH_TOKEN", "Refresh token invalid");
    const { roles, perms } = permsFor(u);
    return delay(
      ok({
        access_token: buildAccessToken(u, roles, perms),
        refresh_token: `demo-refresh-${u.id}`,
        token_type: "bearer",
        access_expires_in: 900,
        user_id: u.id,
        tenant_id: u.tenant_id,
        is_super_admin: u.is_super_admin,
        tz: u.timezone || "UTC",
        modules: ["inventory"],
      }),
    );
  }
  if (method === "POST" && path === "/auth/logout") return delay(ok({}, 204));
  if (method === "POST" && path === "/auth/change-password") return delay(ok({}, 204));
  if (method === "GET" && path === "/auth/me") {
    if (!user) throw fail(401, "AUTHENTICATION_REQUIRED", "Please sign in");
    return delay(ok(user));
  }

  // Helper: tenant-scoped list over a fixture array.
  function listFor<T extends { tenant_id?: string | null }>(arr: T[]) {
    if (!user) throw fail(401, "AUTHENTICATION_REQUIRED", "Please sign in");
    if (user.is_super_admin) {
      return tid ? arr.filter((r) => r.tenant_id === tid) : arr;
    }
    return arr.filter((r) => r.tenant_id === user.tenant_id);
  }

  // ─── Tenants (auth service) ───────────
  if (method === "GET" && path === "/tenants") return delay(ok(F.TENANTS));
  const tm = match(path, "/tenants/:id");
  if (method === "GET" && tm) {
    const t = F.TENANTS.find((x) => x.id === tm.id);
    return t ? delay(ok(t)) : (() => { throw fail(404, "NOT_FOUND", "Tenant not found"); })();
  }

  // ─── Currencies ───────────────────────
  if (method === "GET" && path === "/currencies") return delay(ok(F.CURRENCIES));

  // ─── Users ────────────────────────────
  if (method === "GET" && path === "/users") {
    return delay(ok(listFor(F.USERS)));
  }
  const um = match(path, "/users/:id");
  if (method === "GET" && um) {
    const u = F.USERS.find((x) => x.id === um.id);
    return u ? delay(ok(u)) : (() => { throw fail(404, "NOT_FOUND", "User not found"); })();
  }

  // ─── Roles ────────────────────────────
  if (method === "GET" && path === "/roles") return delay(ok(listFor(F.ROLES)));
  const rm = match(path, "/roles/:id");
  if (method === "GET" && rm) {
    const r = F.ROLES.find((x) => x.id === rm.id);
    return r ? delay(ok(r)) : (() => { throw fail(404, "NOT_FOUND", "Role not found"); })();
  }
  const rpm = match(path, "/roles/:id/permissions");
  if (method === "GET" && rpm) {
    return delay(
      ok(F.ROLE_PERMISSIONS.filter((rp) => rp.role_id === rpm.id)),
    );
  }
  const urm = match(path, "/users/:id/roles");
  if (method === "GET" && urm) {
    return delay(ok(F.USER_ROLES.filter((ur) => ur.user_id === urm.id)));
  }

  // ─── Permissions catalog ──────────────
  if (method === "GET" && path === "/permissions") return delay(ok(F.PERMISSIONS));

  // ─── Modules + subscriptions ──────────
  if (method === "GET" && path === "/modules") return delay(ok(F.MODULES));
  const subm = match(path, "/subscriptions/tenant/:tid");
  if (method === "GET" && subm) {
    return delay(
      ok(F.SUBSCRIPTIONS.filter((s) => s.tenant_id === subm.tid)),
    );
  }

  // ─── Master data ──────────────────────
  if (method === "GET" && path === "/status-master")   return delay(ok(listFor(F.STATUS_MASTER)));
  if (method === "GET" && path === "/number-series")   return delay(ok(listFor(F.NUMBER_SERIES)));
  if (method === "GET" && path === "/uom-categories")  return delay(ok(listFor(F.UOM_CATEGORIES)));
  if (method === "GET" && path === "/uoms")            return delay(ok(listFor(F.UOMS)));
  if (method === "GET" && path === "/uom-conversions") return delay(ok(listFor(F.UOM_CONVERSIONS)));
  if (method === "GET" && path === "/item-brands")     return delay(ok({ data: listFor(F.BRANDS),     pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/item-categories") return delay(ok({ data: listFor(F.CATEGORIES), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/document-types")  return delay(ok(listFor(F.DOCUMENT_TYPES)));

  // ─── Locations + bins ─────────────────
  if (method === "GET" && path === "/inventory-locations") return delay(ok({ data: listFor(F.LOCATIONS), pagination: { limit: 500, next_cursor: null, has_more: false } }));
  const lbm = match(path, "/inventory-locations/:id/bins");
  if (method === "GET" && lbm) return delay(ok({ data: F.BINS[lbm.id] ?? [], pagination: { limit: 200, next_cursor: null, has_more: false } }));

  // ─── Parties ──────────────────────────
  if (method === "GET" && path === "/parties") return delay(ok({ data: listFor(F.PARTIES), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  const pm = match(path, "/parties/:id");
  if (method === "GET" && pm) {
    const p = F.PARTIES.find((x) => x.id === pm.id);
    return p ? delay(ok(p)) : (() => { throw fail(404, "NOT_FOUND", "Party not found"); })();
  }

  // ─── Items + sub-resources ────────────
  if (method === "GET" && path === "/items") {
    return delay(
      ok({
        data: listFor(F.ITEMS),
        pagination: { limit: 200, next_cursor: null, has_more: false },
      }),
    );
  }
  const im = match(path, "/items/:id");
  if (method === "GET" && im) {
    const it = F.ITEMS.find((x) => x.id === im.id);
    return it ? delay(ok(it)) : (() => { throw fail(404, "NOT_FOUND", "Item not found"); })();
  }
  const lm = match(path, "/items/:id/lots");
  if (method === "GET" && lm) return delay(ok(F.LOTS[lm.id] ?? []));
  const sm = match(path, "/items/:id/serials");
  if (method === "GET" && sm) return delay(ok(F.SERIALS[sm.id] ?? []));
  const rpm2 = match(path, "/items/:id/reorder-policies");
  if (method === "GET" && rpm2) return delay(ok(F.REORDER_POLICIES[rpm2.id] ?? []));
  // Identifiers / variants / item-uoms — return empty lists so the tabs render.
  if (
    method === "GET" &&
    (match(path, "/items/:id/identifiers") ||
      match(path, "/items/:id/variants") ||
      match(path, "/items/:id/uoms"))
  ) {
    return delay(ok([]));
  }

  // ─── Stock ────────────────────────────
  if (method === "GET" && path === "/balances")        return delay(ok(listFor(F.BALANCES)));
  if (method === "GET" && path === "/movements")       return delay(ok(listFor(F.MOVEMENTS)));
  if (method === "GET" && path === "/valuation-layers") return delay(ok(listFor(F.VALUATION_LAYERS)));
  if (method === "GET" && path === "/reservations")    return delay(ok(listFor(F.RESERVATIONS)));

  // ─── Documents ────────────────────────
  if (method === "GET" && path === "/documents") {
    const q = queryParams(url.search);
    let rows = listFor(F.DOCUMENT_HEADERS);
    if (q.document_type_id) rows = rows.filter((d) => d.document_type_id === q.document_type_id);
    return delay(ok({ data: rows, pagination: { limit: 200, next_cursor: null, has_more: false } }));
  }
  const dm = match(path, "/documents/:id");
  if (method === "GET" && dm) {
    const d = F.DOCUMENT_HEADERS.find((x) => x.id === dm.id);
    return d ? delay(ok(d)) : (() => { throw fail(404, "NOT_FOUND", "Document not found"); })();
  }
  const dlm = match(path, "/documents/:id/lines");
  if (method === "GET" && dlm) {
    return delay(ok({ data: F.DOCUMENT_LINES[dlm.id] ?? [], pagination: { limit: 200, next_cursor: null, has_more: false } }));
  }

  // ─── Counts ───────────────────────────
  if (method === "GET" && path === "/counts") return delay(ok(listFor(F.COUNTS)));
  const cm = match(path, "/counts/:id");
  if (method === "GET" && cm) {
    const c = F.COUNTS.find((x) => x.id === cm.id);
    return c ? delay(ok(c)) : (() => { throw fail(404, "NOT_FOUND", "Count not found"); })();
  }
  const clm = match(path, "/counts/:id/lines");
  if (method === "GET" && clm) return delay(ok(F.COUNT_LINES[clm.id] ?? []));

  // ─── Workflows / custom-fields / settings ──
  if (method === "GET" && path === "/workflows")                return delay(ok({ data: listFor(F.WORKFLOWS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/custom-field-definitions") return delay(ok({ data: listFor(F.CUSTOM_FIELDS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/integrations")             return delay(ok({ data: listFor(F.INTEGRATIONS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/webhooks")                 return delay(ok({ data: listFor(F.WEBHOOKS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/attachments")              return delay(ok({ data: listFor(F.ATTACHMENTS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/imports")                  return delay(ok({ data: listFor(F.IMPORTS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/tenant-config")            return delay(ok({ data: listFor(F.TENANT_CONFIG), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/module-config")            return delay(ok({ data: listFor(F.MODULE_CONFIG), pagination: { limit: 200, next_cursor: null, has_more: false } }));

  // ─── Writes — minimal stub that succeeds + mutates in-memory ─────
  //
  // Full create/update/delete simulation would be a lot of code. We
  // implement a generic "success, here's a fake object back" handler
  // so demo users can click buttons and see toasts, without persisting.
  // ────────────────────────────────────────
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return delay(
      ok(
        {
          id: F.uid("demo"),
          ...((typeof body === "object" && body) || {}),
          tenant_id: tid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        method === "POST" ? 201 : method === "DELETE" ? 204 : 200,
      ),
    );
  }

  throw fail(404, "NOT_FOUND", `Demo route not implemented: ${method} ${path}`);
};

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return {}; }
}
