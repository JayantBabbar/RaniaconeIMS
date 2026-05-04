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

  // Admin-initiated password reset (auth service §2 — 2026-04-24).
  // Real backend: 204 + revokes all refresh tokens. We don't actually
  // mutate anything in the fixtures — the demo just lets the click succeed.
  const rpwm = match(path, "/users/:id/reset-password");
  if (method === "POST" && rpwm) {
    const u = F.USERS.find((x) => x.id === rpwm.id);
    if (!u) throw fail(404, "USER_NOT_FOUND", "User not found");
    const np = (typeof body === "object" && body && "new_password" in body)
      ? String((body as { new_password?: unknown }).new_password ?? "")
      : "";
    if (np.length < 8 || np.length > 128) {
      throw fail(422, "VALIDATION_ERROR", "Password must be 8–128 characters", {
        new_password: "Must be between 8 and 128 characters",
      });
    }
    return delay(ok({}, 204));
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
  if (method === "GET" && path === "/uom-categories")  return delay(ok({ data: listFor(F.UOM_CATEGORIES),  pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/uoms")            return delay(ok({ data: listFor(F.UOMS),            pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/uom-conversions") return delay(ok({ data: listFor(F.UOM_CONVERSIONS), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/item-brands")     return delay(ok({ data: listFor(F.BRANDS),     pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/item-categories") return delay(ok({ data: listFor(F.CATEGORIES), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  if (method === "GET" && path === "/document-types")  return delay(ok(listFor(F.DOCUMENT_TYPES)));

  // ─── Locations + bins ─────────────────
  if (method === "GET" && path === "/inventory-locations") return delay(ok({ data: listFor(F.LOCATIONS), pagination: { limit: 500, next_cursor: null, has_more: false } }));
  const lbm = match(path, "/inventory-locations/:id/bins");
  if (method === "GET" && lbm) return delay(ok({ data: F.BINS[lbm.id] ?? [], pagination: { limit: 200, next_cursor: null, has_more: false } }));

  // ─── Parties ──────────────────────────
  if (method === "GET" && path === "/parties") return delay(ok({ data: listFor(F.PARTIES), pagination: { limit: 200, next_cursor: null, has_more: false } }));
  // POST /parties — persist a new party so it shows up in the list
  // and can be picked on docs immediately. Without this the form
  // submits, the page refetches /parties, but the new row was never
  // added to fixtures → user thinks save didn't work.
  if (method === "POST" && path === "/parties") {
    const reqBody = (typeof body === "object" && body) ? body as {
      code?: string; name?: string; legal_name?: string;
      tax_id?: string; party_type?: string; currency_id?: string;
      gstin?: string; state_code?: string; opening_balance?: string;
      is_gst_registered?: boolean; description?: string;
      route_id?: string; phone?: string; email?: string;
      is_active?: boolean;
    } : {};
    const newParty = {
      id: F.uid("party"),
      tenant_id: tid as string,
      code: (reqBody.code ?? "").trim(),
      name: (reqBody.name ?? "").trim(),
      legal_name: reqBody.legal_name ?? null,
      tax_id: reqBody.tax_id ?? null,
      party_type: reqBody.party_type ?? "customer",
      opening_balance: reqBody.opening_balance ?? "0.00",
      currency_id: reqBody.currency_id ?? "cur-inr",
      is_gst_registered: reqBody.is_gst_registered ?? !!reqBody.gstin,
      gstin: reqBody.gstin ?? null,
      state_code: reqBody.state_code ?? null,
      description: reqBody.description ?? null,
      route_id: reqBody.route_id ?? null,
      phone: reqBody.phone ?? null,
      email: reqBody.email ?? null,
      is_active: reqBody.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (F.PARTIES as Array<unknown>).push(newParty);
    return delay(ok(newParty, 201));
  }
  // PATCH / DELETE /parties/:id
  const partyMatch = match(path, "/parties/:id");
  if (partyMatch && (method === "PATCH" || method === "DELETE")) {
    const idx = F.PARTIES.findIndex((p) => p.id === partyMatch.id);
    if (idx < 0) throw fail(404, "PARTY_NOT_FOUND", "Party not found");
    if (method === "DELETE") {
      F.PARTIES.splice(idx, 1);
      return delay({ status: 204, statusText: "No Content", headers: {}, data: undefined as never, config: {} as never });
    }
    const reqBody = (typeof body === "object" && body) ? body as Record<string, unknown> : {};
    const ref = F.PARTIES[idx] as Record<string, unknown>;
    Object.assign(ref, reqBody, { updated_at: new Date().toISOString() });
    return delay(ok(ref));
  }
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
  if (method === "POST" && rpm2) {
    const reqBody = (typeof body === "object" && body) ? body as {
      location_id?: string; min_qty?: number; max_qty?: number;
      reorder_point?: number; reorder_qty?: number;
    } : {};
    const newPolicy = {
      id: F.uid("rp"),
      tenant_id: tid as string,
      item_id: rpm2.id,
      location_id: reqBody.location_id ?? "",
      min_qty: String(reqBody.min_qty ?? 0),
      max_qty: reqBody.max_qty != null ? String(reqBody.max_qty) : null,
      reorder_point: reqBody.reorder_point != null ? String(reqBody.reorder_point) : null,
      reorder_qty: reqBody.reorder_qty != null ? String(reqBody.reorder_qty) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!F.REORDER_POLICIES[rpm2.id]) F.REORDER_POLICIES[rpm2.id] = [];
    (F.REORDER_POLICIES[rpm2.id] as Array<unknown>).push(newPolicy);
    return delay(ok(newPolicy, 201));
  }
  // Per-policy edit / delete
  const rpm3 = match(path, "/items/:id/reorder-policies/:policyId");
  if (rpm3 && (method === "PATCH" || method === "DELETE")) {
    const list = (F.REORDER_POLICIES[rpm3.id] ?? []) as Array<{ id: string }>;
    const idx = list.findIndex((p) => p.id === rpm3.policyId);
    if (idx < 0) throw fail(404, "POLICY_NOT_FOUND", "Reorder policy not found");
    if (method === "DELETE") {
      list.splice(idx, 1);
      return delay({ status: 204, statusText: "No Content", headers: {}, data: undefined as never, config: {} as never });
    }
    // PATCH
    const reqBody = (typeof body === "object" && body) ? body as {
      min_qty?: number; max_qty?: number; reorder_point?: number; reorder_qty?: number;
    } : {};
    const updated = {
      ...list[idx],
      ...(reqBody.min_qty       != null ? { min_qty:       String(reqBody.min_qty) }       : {}),
      ...(reqBody.max_qty       != null ? { max_qty:       String(reqBody.max_qty) }       : {}),
      ...(reqBody.reorder_point != null ? { reorder_point: String(reqBody.reorder_point) } : {}),
      ...(reqBody.reorder_qty   != null ? { reorder_qty:   String(reqBody.reorder_qty) }   : {}),
      updated_at: new Date().toISOString(),
    };
    list[idx] = updated as typeof list[number];
    return delay(ok(updated));
  }
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
  // POST /documents — persist new draft documents (PO / GRN / SO / Transfer)
  // so the redirect to /documents/detail/[id] actually finds them. Without
  // this, the FE form's onSuccess redirect 404s and the user can't add lines.
  if (method === "POST" && path === "/documents") {
    const reqBody = (typeof body === "object" && body) ? body as {
      document_type_id?: string;
      document_number?: string;
      document_date?: string;
      party_id?: string | null;
      source_location_id?: string | null;
      destination_location_id?: string | null;
      currency_id?: string;
      exchange_rate?: string;
      remarks?: string;
      source_doc_id?: string | null;
    } : {};

    // Generate a document number from the relevant number series if the
    // caller didn't supply one. Falls back to a generic uid prefix.
    const docType = (F.DOCUMENT_TYPES as Array<{ id: string; code: string }>)
      .find((t) => t.id === reqBody.document_type_id);
    const typeCode = docType?.code ?? "DOC";
    let documentNumber = reqBody.document_number;
    if (!documentNumber) {
      // Find largest existing number for this type and add 1.
      const existingForType = (F.DOCUMENT_HEADERS as Array<{ document_type_id: string; document_number: string }>)
        .filter((d) => d.document_type_id === reqBody.document_type_id)
        .map((d) => Number(d.document_number.replace(/^[A-Z]+-?/i, "")) || 0);
      const next = (existingForType.length ? Math.max(...existingForType) : 0) + 1;
      documentNumber = `${typeCode}-${String(next).padStart(5, "0")}`;
    }

    const newDoc = {
      id: F.uid("doc"),
      tenant_id: tid as string,
      document_type_id: reqBody.document_type_id ?? "",
      document_number: documentNumber,
      document_date: reqBody.document_date ?? new Date().toISOString().slice(0, 10),
      posting_date: null,
      party_id: reqBody.party_id ?? null,
      source_location_id: reqBody.source_location_id ?? null,
      destination_location_id: reqBody.destination_location_id ?? null,
      currency_id: reqBody.currency_id ?? "cur-inr",
      exchange_rate: reqBody.exchange_rate ?? "1",
      status_id: "stat-draft",
      remarks: reqBody.remarks ?? "",
      source_doc_id: reqBody.source_doc_id ?? null,
      version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (F.DOCUMENT_HEADERS as Array<unknown>).push(newDoc);
    // Also seed an empty lines map so GET /documents/:id/lines doesn't 404.
    if (!F.DOCUMENT_LINES[newDoc.id]) F.DOCUMENT_LINES[newDoc.id] = [];
    return delay(ok(newDoc, 201));
  }
  const dm = match(path, "/documents/:id");
  if (method === "GET" && dm) {
    const d = F.DOCUMENT_HEADERS.find((x) => x.id === dm.id);
    return d ? delay(ok(d)) : (() => { throw fail(404, "NOT_FOUND", "Document not found"); })();
  }
  // POST /documents/:id/post  — flip a draft to posted in-memory so the
  // FE's queries pick up the change. Without an explicit handler this
  // would fall through to the generic write stub which doesn't mutate
  // F.DOCUMENT_HEADERS.
  const dpm = match(path, "/documents/:id/post");
  if (method === "POST" && dpm) {
    const idx = F.DOCUMENT_HEADERS.findIndex((d) => d.id === dpm.id);
    if (idx < 0) throw fail(404, "DOCUMENT_NOT_FOUND", "Document not found");
    const ref = F.DOCUMENT_HEADERS[idx] as { posting_date: string | null; status_id?: string; version?: number; updated_at?: string };
    if (ref.posting_date) throw fail(409, "DOCUMENT_NOT_DRAFT", "Document is already posted");
    ref.posting_date = new Date().toISOString();
    ref.status_id = "stat-posted";
    ref.version = (ref.version ?? 0) + 1;
    ref.updated_at = new Date().toISOString();
    return delay(ok(ref));
  }
  const dcm = match(path, "/documents/:id/cancel");
  if (method === "POST" && dcm) {
    const idx = F.DOCUMENT_HEADERS.findIndex((d) => d.id === dcm.id);
    if (idx < 0) throw fail(404, "DOCUMENT_NOT_FOUND", "Document not found");
    const ref = F.DOCUMENT_HEADERS[idx] as { status_id?: string; version?: number; updated_at?: string };
    ref.status_id = "stat-cancelled";
    ref.version = (ref.version ?? 0) + 1;
    ref.updated_at = new Date().toISOString();
    return delay(ok(ref));
  }
  const dlm = match(path, "/documents/:id/lines");
  if (method === "GET" && dlm) {
    return delay(ok({ data: F.DOCUMENT_LINES[dlm.id] ?? [], pagination: { limit: 200, next_cursor: null, has_more: false } }));
  }
  if (method === "POST" && dlm) {
    const reqBody = (typeof body === "object" && body) ? body as {
      item_id?: string; uom_id?: string; quantity?: string; unit_price?: string;
      line_number?: number; discount_pct?: string; lot_number?: string; remarks?: string;
      thickness_mm?: number; size_code?: string;
    } : {};

    // Phase 13 — if thickness + size are supplied but unit_price is
    // 0/empty, look up the active pricing rule and use it. This is a
    // demo convenience; the real backend will do the same on commit.
    let unitPriceResolved = reqBody.unit_price ?? "0";
    if (
      (!reqBody.unit_price || Number(reqBody.unit_price) === 0) &&
      reqBody.item_id && reqBody.thickness_mm && reqBody.size_code
    ) {
      const today = new Date().toISOString().slice(0, 10);
      const rule = (F.ITEM_PRICING_RULES as Array<{
        item_id: string; thickness_mm: number; size_code: string;
        sale_price: string; valid_from: string; valid_until: string | null;
      }>).find((r) =>
        r.item_id === reqBody.item_id &&
        r.thickness_mm === reqBody.thickness_mm &&
        r.size_code === reqBody.size_code &&
        r.valid_from <= today &&
        (r.valid_until === null || r.valid_until >= today),
      );
      if (rule) unitPriceResolved = rule.sale_price;
    }

    // Resolve lot_number → lot_id. If a Lot with the same number
    // already exists for this item, reuse it; otherwise create a new
    // one. Mirrors what the real backend should do on receive.
    let lotId: string | null = null;
    if (reqBody.lot_number && reqBody.item_id) {
      const itemLots = (F.LOTS[reqBody.item_id] ?? []) as Array<{ id: string; lot_number: string }>;
      const existing = itemLots.find((l) => l.lot_number === reqBody.lot_number);
      if (existing) {
        lotId = existing.id;
      } else {
        const newLot = {
          id: F.uid("lot"),
          tenant_id: tid as string,
          item_id: reqBody.item_id,
          lot_number: reqBody.lot_number,
          mfg_date: null, expiry_date: null,
          received_qty: reqBody.quantity ?? "0",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!F.LOTS[reqBody.item_id]) F.LOTS[reqBody.item_id] = [];
        (F.LOTS[reqBody.item_id] as Array<unknown>).push(newLot);
        lotId = newLot.id;
      }
    }

    const qty = Number(reqBody.quantity ?? 0);
    const price = Number(unitPriceResolved);
    const discount = Number(reqBody.discount_pct ?? 0);
    const lineTotal = (qty * price * (1 - discount / 100)).toFixed(2);

    const newLine = {
      id: F.uid("dl"),
      document_id: dlm.id,
      line_number: reqBody.line_number ?? ((F.DOCUMENT_LINES[dlm.id] ?? []).length + 1),
      item_id: reqBody.item_id ?? null,
      uom_id: reqBody.uom_id ?? null,
      quantity: reqBody.quantity ?? "0",
      unit_price: unitPriceResolved,
      discount_pct: reqBody.discount_pct ?? "0",
      tax_amount: "0",
      line_total: lineTotal,
      lot_id: lotId,
      serial_id: null,
      bin_id: null,
      remarks: reqBody.remarks ?? "",
      thickness_mm: reqBody.thickness_mm ?? null,
      size_code: reqBody.size_code ?? null,
    };
    if (!F.DOCUMENT_LINES[dlm.id]) F.DOCUMENT_LINES[dlm.id] = [];
    F.DOCUMENT_LINES[dlm.id].push(newLine);
    return delay(ok(newLine, 201));
  }

  // ─── Invoices ─────────────────────────
  // GET list — supports party_id + status filters (FE uses these
  // for the toolbar). Returns plain array (not envelope) per the
  // backend convention. The FE service layer uses unwrapList() so
  // either shape works regardless.
  if (method === "GET" && path === "/invoices") {
    const q = queryParams(url.search);
    let rows = listFor(F.INVOICES);
    if (q.party_id) rows = rows.filter((r) => r.party_id === q.party_id);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    return delay(ok(rows));
  }
  const ivm = match(path, "/invoices/:id");
  if (method === "GET" && ivm) {
    const inv = F.INVOICES.find((x) => x.id === ivm.id);
    return inv ? delay(ok(inv)) : (() => { throw fail(404, "INVOICE_NOT_FOUND", "Invoice not found"); })();
  }
  const ivlm = match(path, "/invoices/:id/lines");
  if (method === "GET" && ivlm) {
    return delay(ok(F.INVOICE_LINES[ivlm.id] ?? []));
  }
  const ivpm = match(path, "/invoices/:id/post");
  if (method === "POST" && ivpm) {
    // Demo "post" — flips status, sets posting_date. Real backend
    // would also create stock movements + ledger entries (Phase 3
    // wiring per PHASE3_BACKEND_SPEC.md):
    //
    //   Dr. party_receivable[party_id]    grand_total
    //   Cr. sales_income                  subtotal
    //   Cr. gst_output                    tax_total
    //
    // Skipped here because the demo balances are pre-baked in
    // fixtures.ts; mutating them would break list-shape tests.
    const inv = F.INVOICES.find((x) => x.id === ivpm.id);
    if (!inv) throw fail(404, "INVOICE_NOT_FOUND", "Invoice not found");
    if (inv.status !== "draft") {
      throw fail(409, "INVOICE_NOT_DRAFT", `Invoice is ${inv.status}; only drafts can be posted`);
    }
    return delay(ok({
      ...inv,
      status: "posted" as const,
      posting_date: new Date().toISOString(),
      version: inv.version + 1,
      updated_at: new Date().toISOString(),
    }));
  }
  const ivcm = match(path, "/invoices/:id/cancel");
  if (method === "POST" && ivcm) {
    const inv = F.INVOICES.find((x) => x.id === ivcm.id);
    if (!inv) throw fail(404, "INVOICE_NOT_FOUND", "Invoice not found");
    if (inv.status !== "posted") {
      throw fail(409, "INVOICE_NOT_POSTED", `Invoice is ${inv.status}; only posted invoices can be cancelled`);
    }
    const reason = (body && typeof body === "object" && "reason" in body)
      ? String((body as { reason?: unknown }).reason ?? "")
      : "";
    return delay(ok({
      ...inv,
      status: "cancelled" as const,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      version: inv.version + 1,
      updated_at: new Date().toISOString(),
    }));
  }

  // ─── Challans ──────────────────────────
  if (method === "GET" && path === "/challans") {
    const q = queryParams(url.search);
    let rows = listFor(F.CHALLANS);
    if (q.party_id)   rows = rows.filter((r) => r.party_id === q.party_id);
    if (q.status)     rows = rows.filter((r) => r.status === q.status);
    if (q.is_billed)  rows = rows.filter((r) => String(r.is_billed) === q.is_billed);
    return delay(ok(rows));
  }
  const chm = match(path, "/challans/:id");
  if (method === "GET" && chm) {
    const c = F.CHALLANS.find((x) => x.id === chm.id);
    return c ? delay(ok(c)) : (() => { throw fail(404, "CHALLAN_NOT_FOUND", "Challan not found"); })();
  }
  const chlm = match(path, "/challans/:id/lines");
  if (method === "GET" && chlm) {
    return delay(ok(F.CHALLAN_LINES[chlm.id] ?? []));
  }
  const chpm = match(path, "/challans/:id/post");
  if (method === "POST" && chpm) {
    const c = F.CHALLANS.find((x) => x.id === chpm.id);
    if (!c) throw fail(404, "CHALLAN_NOT_FOUND", "Challan not found");
    if (c.status !== "draft") throw fail(409, "CHALLAN_NOT_DRAFT", `Challan is ${c.status}`);
    return delay(ok({
      ...c,
      status: "posted" as const,
      posting_date: new Date().toISOString(),
      version: c.version + 1,
      updated_at: new Date().toISOString(),
    }));
  }
  const chcm = match(path, "/challans/:id/cancel");
  if (method === "POST" && chcm) {
    const c = F.CHALLANS.find((x) => x.id === chcm.id);
    if (!c) throw fail(404, "CHALLAN_NOT_FOUND", "Challan not found");
    if (c.status !== "posted") throw fail(409, "CHALLAN_NOT_POSTED", `Challan is ${c.status}`);
    const reason = (body && typeof body === "object" && "reason" in body)
      ? String((body as { reason?: unknown }).reason ?? "") : "";
    return delay(ok({
      ...c,
      status: "cancelled" as const,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      version: c.version + 1,
      updated_at: new Date().toISOString(),
    }));
  }
  const chprom = match(path, "/challans/:id/promote-to-invoice");
  if (method === "POST" && chprom) {
    // Promote — server-side this would create a real Invoice. For
    // the demo we just return a synthetic invoice stub the FE can
    // route to. The challan flips to is_billed=true with a fake
    // invoice_id so subsequent reads reflect the link.
    const c = F.CHALLANS.find((x) => x.id === chprom.id);
    if (!c) throw fail(404, "CHALLAN_NOT_FOUND", "Challan not found");
    if (c.status !== "posted") throw fail(409, "CHALLAN_NOT_POSTED", "Only posted challans can be promoted");
    if (c.is_billed) throw fail(409, "CHALLAN_ALREADY_BILLED", "This challan is already linked to an invoice");
    const newInvId = F.uid("inv");
    return delay(ok({
      challan: { ...c, is_billed: true, invoice_id: newInvId, version: c.version + 1, updated_at: new Date().toISOString() },
      invoice: {
        id: newInvId,
        invoice_number: `INV/PROMO-${Date.now().toString().slice(-5)}`,
        challan_id: c.id,
        status: "draft",
        party_id: c.party_id,
        invoice_date: new Date().toISOString().slice(0, 10),
      },
    }));
  }

  // ─── Routes ───────────────────────────
  if (method === "GET" && path === "/routes") return delay(ok(listFor(F.ROUTES)));
  const rtm = match(path, "/routes/:id");
  if (method === "GET" && rtm) {
    const r = F.ROUTES.find((x) => x.id === rtm.id);
    return r ? delay(ok(r)) : (() => { throw fail(404, "NOT_FOUND", "Route not found"); })();
  }

  // ─── Phase 3 — Money: Accounts, Ledger, Payments, Employees ───
  //
  // Read-side logic is faithful enough to drive the UI.
  // Write-side (create/update/delete) falls through to the generic
  // success-stub at the bottom — the FE flow doesn't depend on a
  // real persisted balance update because all balances are pre-baked
  // in fixtures.
  const query = queryParams(url.search);

  // ── Financial Accounts ──
  if (method === "GET" && path === "/accounts") {
    let rows = F.FINANCIAL_ACCOUNTS;
    if (query.type)        rows = rows.filter((a) => a.type === query.type);
    if (query.party_id)    rows = rows.filter((a) => a.party_id === query.party_id);
    if (query.employee_id) rows = rows.filter((a) => a.employee_id === query.employee_id);
    if (query.is_active != null) {
      const want = query.is_active === "true";
      rows = rows.filter((a) => a.is_active === want);
    }
    return delay(ok(rows));
  }
  const accm = match(path, "/accounts/:id");
  if (method === "GET" && accm) {
    const a = F.FINANCIAL_ACCOUNTS.find((x) => x.id === accm.id);
    return a ? delay(ok(a)) : (() => { throw fail(404, "ACCOUNT_NOT_FOUND", "Account not found"); })();
  }

  // ── Ledger ──
  const ledAccm = match(path, "/ledger/accounts/:id");
  if (method === "GET" && ledAccm) {
    const rows = F.LEDGER_ENTRIES
      .filter((e) => e.account_id === ledAccm.id)
      .sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : a.created_at < b.created_at ? -1 : 1));
    return delay(ok(rows));
  }
  const ledPartym = match(path, "/ledger/parties/:id");
  if (method === "GET" && ledPartym) {
    // Find the party's receivable + payable accounts, then return all
    // entries against either, with a derived `source_label`.
    const partyAccountIds = F.FINANCIAL_ACCOUNTS
      .filter((a) => a.party_id === ledPartym.id && (a.type === "party_receivable" || a.type === "party_payable"))
      .map((a) => a.id);
    const rows = F.LEDGER_ENTRIES
      .filter((e) => partyAccountIds.includes(e.account_id))
      .sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : a.created_at < b.created_at ? -1 : 1))
      .map((e) => ({
        ...e,
        source_label: deriveSourceLabel(e),
      }));
    return delay(ok(rows));
  }
  if (method === "GET" && path === "/ledger/summary") {
    const sumByType = (t: string) =>
      F.FINANCIAL_ACCOUNTS
        .filter((a) => a.type === t && a.is_active)
        .reduce((s, a) => s + Number(a.current_balance), 0)
        .toFixed(2);
    // Phase 3.5: sum of outstanding on posted vendor bills.
    const billsPending = F.VENDOR_BILLS
      .filter((b) => b.status === "posted")
      .reduce((s, b) => s + (Number(b.grand_total) - Number(b.allocated_amount)), 0)
      .toFixed(2);
    return delay(ok({
      cash_in_hand:      sumByType("cash_in_hand"),
      bank:              sumByType("bank"),
      cheque_in_transit: sumByType("cheque_in_transit"),
      gpay:              sumByType("gpay"),
      // Receivable/payable sums respect sign so net "you're owed" / "you owe".
      total_receivable:  sumByType("party_receivable"),
      total_payable:     Math.abs(Number(sumByType("party_payable"))).toFixed(2),
      employee_float:    sumByType("employee_float"),
      vendor_bills_pending: billsPending,
      as_of:             new Date().toISOString(),
    }));
  }

  // ── Payments (list + detail + state changes + allocations) ──
  if (method === "GET" && path === "/payments") {
    let rows = F.PAYMENTS;
    if (query.direction)         rows = rows.filter((p) => p.direction === query.direction);
    if (query.party_id)          rows = rows.filter((p) => p.party_id === query.party_id);
    if (query.mode)              rows = rows.filter((p) => p.mode === query.mode);
    if (query.status)            rows = rows.filter((p) => p.status === query.status);
    if (query.payee_employee_id) rows = rows.filter((p) => p.payee_employee_id === query.payee_employee_id);
    if (query.cheque_in_transit === "true") {
      rows = rows.filter((p) =>
        p.mode === "cheque" && p.status === "posted" &&
        (p.details as { cleared?: boolean }).cleared === false,
      );
    }
    return delay(ok(rows));
  }
  const paym = match(path, "/payments/:id");
  if (method === "GET" && paym) {
    const p = F.PAYMENTS.find((x) => x.id === paym.id);
    return p ? delay(ok(p)) : (() => { throw fail(404, "PAYMENT_NOT_FOUND", "Payment not found"); })();
  }
  const payAllocsm = match(path, "/payments/:id/allocations");
  if (method === "GET" && payAllocsm) {
    return delay(ok(F.PAYMENT_ALLOCATIONS.filter((a) => a.payment_id === payAllocsm.id)));
  }
  const paypm = match(path, "/payments/:id/post");
  if (method === "POST" && paypm) {
    const p = F.PAYMENTS.find((x) => x.id === paypm.id);
    if (!p) throw fail(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (p.status !== "draft") throw fail(409, "PAYMENT_NOT_DRAFT", "Only drafts can be posted");
    return delay(ok({ ...p, status: "posted", posting_date: new Date().toISOString(), version: p.version + 1, updated_at: new Date().toISOString() }));
  }
  const paycm = match(path, "/payments/:id/cancel");
  if (method === "POST" && paycm) {
    const p = F.PAYMENTS.find((x) => x.id === paycm.id);
    if (!p) throw fail(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (p.status !== "posted") throw fail(409, "PAYMENT_NOT_POSTED", "Only posted payments can be cancelled");
    return delay(ok({ ...p, status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: (typeof body === "object" && body && "reason" in body ? (body as { reason: string }).reason : null), version: p.version + 1, updated_at: new Date().toISOString() }));
  }
  const paydepm = match(path, "/payments/:id/deposit");
  if (method === "POST" && paydepm) {
    const p = F.PAYMENTS.find((x) => x.id === paydepm.id);
    if (!p) throw fail(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (p.mode !== "cheque") throw fail(409, "NOT_A_CHEQUE", "Only cheque payments can be deposited");
    if (p.status !== "posted") throw fail(409, "PAYMENT_NOT_POSTED", "Cheque must be posted before deposit");
    const details = p.details as { mode: "cheque"; cleared: boolean };
    if (details.cleared) throw fail(409, "CHEQUE_ALREADY_CLEARED", "Cheque already cleared");
    const reqBody = (typeof body === "object" && body) ? body as { deposited_to_account_id?: string; deposit_date?: string } : {};
    return delay(ok({
      ...p,
      details: {
        ...details,
        cleared: true,
        deposit_date: reqBody.deposit_date ?? new Date().toISOString().slice(0, 10),
        deposited_to_account_id: reqBody.deposited_to_account_id ?? "acc-bank-hdfc",
      },
      version: p.version + 1,
      updated_at: new Date().toISOString(),
    }));
  }

  // ── Employees ──
  if (method === "GET" && path === "/employees") {
    let rows = F.EMPLOYEES;
    if (query.is_active != null) {
      const want = query.is_active === "true";
      rows = rows.filter((e) => e.is_active === want);
    }
    return delay(ok(rows));
  }
  const empm = match(path, "/employees/:id");
  if (method === "GET" && empm) {
    const e = F.EMPLOYEES.find((x) => x.id === empm.id);
    return e ? delay(ok(e)) : (() => { throw fail(404, "EMPLOYEE_NOT_FOUND", "Employee not found"); })();
  }

  // ── Phase 3.5 — Vendor Bills ──
  if (method === "GET" && path === "/bills") {
    let rows = F.VENDOR_BILLS;
    if (query.party_id) rows = rows.filter((b) => b.party_id === query.party_id);
    if (query.status)   rows = rows.filter((b) => b.status === query.status);
    if (query.unpaid === "true") {
      rows = rows.filter((b) => b.status === "posted" && Number(b.allocated_amount) < Number(b.grand_total));
    }
    return delay(ok(rows));
  }
  const billm = match(path, "/bills/:id");
  if (method === "GET" && billm) {
    const b = F.VENDOR_BILLS.find((x) => x.id === billm.id);
    return b ? delay(ok(b)) : (() => { throw fail(404, "BILL_NOT_FOUND", "Vendor bill not found"); })();
  }
  const billLinesm = match(path, "/bills/:id/lines");
  if (method === "GET" && billLinesm) {
    return delay(ok(F.VENDOR_BILL_LINES[billLinesm.id] ?? []));
  }
  const billPostm = match(path, "/bills/:id/post");
  if (method === "POST" && billPostm) {
    // Demo "post" — flips status only. Real backend (per
    // PHASE3_5_BACKEND_SPEC.md) writes paired ledger entries:
    //   Dr. purchase_expense (or per-line override)   subtotal
    //   Dr. gst_input                                  tax_total
    //   Cr. party_payable[party_id]                    grand_total
    // No stock movement — that's the GRN flow's job.
    const b = F.VENDOR_BILLS.find((x) => x.id === billPostm.id);
    if (!b) throw fail(404, "BILL_NOT_FOUND", "Vendor bill not found");
    if (b.status !== "draft") throw fail(409, "BILL_NOT_DRAFT", `Bill is ${b.status}; only drafts can be posted`);
    return delay(ok({ ...b, status: "posted", posting_date: new Date().toISOString(), version: b.version + 1, updated_at: new Date().toISOString() }));
  }
  const billCancm = match(path, "/bills/:id/cancel");
  if (method === "POST" && billCancm) {
    const b = F.VENDOR_BILLS.find((x) => x.id === billCancm.id);
    if (!b) throw fail(404, "BILL_NOT_FOUND", "Vendor bill not found");
    if (b.status !== "posted") throw fail(409, "BILL_NOT_POSTED", `Bill is ${b.status}; only posted bills can be cancelled`);
    if (Number(b.allocated_amount) > 0) throw fail(409, "BILL_HAS_PAYMENTS", "Unallocate associated payments before cancelling");
    const reason = (typeof body === "object" && body && "reason" in body) ? String((body as { reason?: unknown }).reason ?? "") : "";
    return delay(ok({ ...b, status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason, version: b.version + 1, updated_at: new Date().toISOString() }));
  }

  // ── Phase 3.5 — Expense Categories + Expenses ──
  if (method === "GET" && path === "/expense-categories") {
    let rows = F.EXPENSE_CATEGORIES;
    if (query.is_active != null) {
      const want = query.is_active === "true";
      rows = rows.filter((c) => c.is_active === want);
    }
    return delay(ok(rows));
  }
  const ecatm = match(path, "/expense-categories/:id");
  if (method === "GET" && ecatm) {
    const c = F.EXPENSE_CATEGORIES.find((x) => x.id === ecatm.id);
    return c ? delay(ok(c)) : (() => { throw fail(404, "EXPENSE_CATEGORY_NOT_FOUND", "Category not found"); })();
  }

  if (method === "GET" && path === "/expenses") {
    let rows = F.EXPENSES_FX;
    if (query.category_id) rows = rows.filter((e) => e.category_id === query.category_id);
    if (query.status)      rows = rows.filter((e) => e.status === query.status);
    return delay(ok(rows));
  }
  const expm = match(path, "/expenses/:id");
  if (method === "GET" && expm) {
    const e = F.EXPENSES_FX.find((x) => x.id === expm.id);
    return e ? delay(ok(e)) : (() => { throw fail(404, "EXPENSE_NOT_FOUND", "Expense not found"); })();
  }
  const expPostm = match(path, "/expenses/:id/post");
  if (method === "POST" && expPostm) {
    const e = F.EXPENSES_FX.find((x) => x.id === expPostm.id);
    if (!e) throw fail(404, "EXPENSE_NOT_FOUND", "Expense not found");
    if (e.status !== "draft") throw fail(409, "EXPENSE_NOT_DRAFT", `Expense is ${e.status}`);
    return delay(ok({ ...e, status: "posted", posting_date: new Date().toISOString(), version: e.version + 1, updated_at: new Date().toISOString() }));
  }
  const expCancm = match(path, "/expenses/:id/cancel");
  if (method === "POST" && expCancm) {
    const e = F.EXPENSES_FX.find((x) => x.id === expCancm.id);
    if (!e) throw fail(404, "EXPENSE_NOT_FOUND", "Expense not found");
    if (e.status !== "posted") throw fail(409, "EXPENSE_NOT_POSTED", `Expense is ${e.status}`);
    const reason = (typeof body === "object" && body && "reason" in body) ? String((body as { reason?: unknown }).reason ?? "") : "";
    return delay(ok({ ...e, status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason, version: e.version + 1, updated_at: new Date().toISOString() }));
  }

  // ── Phase 3.5 — Salary ──
  if (method === "GET" && path === "/salary") {
    let rows = F.SALARY_ENTRIES;
    if (query.employee_id)  rows = rows.filter((s) => s.employee_id === query.employee_id);
    if (query.status)       rows = rows.filter((s) => s.status === query.status);
    if (query.period_month) rows = rows.filter((s) => s.period_month === query.period_month);
    return delay(ok(rows));
  }
  const salm = match(path, "/salary/:id");
  if (method === "GET" && salm) {
    const s = F.SALARY_ENTRIES.find((x) => x.id === salm.id);
    return s ? delay(ok(s)) : (() => { throw fail(404, "SALARY_NOT_FOUND", "Salary entry not found"); })();
  }
  const salPostm = match(path, "/salary/:id/post");
  if (method === "POST" && salPostm) {
    const s = F.SALARY_ENTRIES.find((x) => x.id === salPostm.id);
    if (!s) throw fail(404, "SALARY_NOT_FOUND", "Salary entry not found");
    if (s.status !== "draft") throw fail(409, "SALARY_NOT_DRAFT", `Entry is ${s.status}`);
    // Sanity: float_held should match the employee's current float balance
    const floatAcc = F.FINANCIAL_ACCOUNTS.find((a) => a.employee_id === s.employee_id && a.type === "employee_float");
    if (floatAcc && Number(floatAcc.current_balance).toFixed(2) !== Number(s.float_held).toFixed(2)) {
      throw fail(422, "SALARY_FLOAT_DRIFT", `Float held doesn't match current balance (${floatAcc.current_balance}); refresh and try again`);
    }
    return delay(ok({ ...s, status: "posted", posting_date: new Date().toISOString(), version: s.version + 1, updated_at: new Date().toISOString() }));
  }
  const salCancm = match(path, "/salary/:id/cancel");
  if (method === "POST" && salCancm) {
    const s = F.SALARY_ENTRIES.find((x) => x.id === salCancm.id);
    if (!s) throw fail(404, "SALARY_NOT_FOUND", "Salary entry not found");
    if (s.status !== "posted") throw fail(409, "SALARY_NOT_POSTED", `Entry is ${s.status}`);
    const reason = (typeof body === "object" && body && "reason" in body) ? String((body as { reason?: unknown }).reason ?? "") : "";
    return delay(ok({ ...s, status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason, version: s.version + 1, updated_at: new Date().toISOString() }));
  }

  // ── Phase 4 — Reports ──
  //
  // All read-only aggregations. We compute totals here so the FE can
  // render rows + totals straight out of the response (matches what
  // the real backend will return in production).
  if (method === "GET" && path === "/reports/sales-register") {
    const start = query.start_date as string | undefined;
    const end   = query.end_date as string | undefined;
    const partyId = query.party_id as string | undefined;
    const stateCode = query.state_code as string | undefined;
    const partyById = (id: string) =>
      (F.PARTIES as Array<{ id: string; name: string; state_code?: string }>).find((p) => p.id === id);

    const inRange = (d: string) =>
      (!start || d >= start) && (!end || d <= end);

    const rows = (F.INVOICES as Array<{
      id: string; invoice_number: string; invoice_date: string;
      party_id: string; subtotal: string; status: string;
    }>)
      .filter((inv) => inv.status !== "draft")  // posted + cancelled both shown
      .filter((inv) => inRange(inv.invoice_date))
      .filter((inv) => !partyId || inv.party_id === partyId)
      .map((inv) => {
        const party = partyById(inv.party_id);
        const lines = (F.INVOICE_LINES[inv.id] ?? []) as Array<{
          taxable_value: string; cgst_amount: string; sgst_amount: string;
          igst_amount: string; cess_amount: string;
        }>;
        const sumField = (f: keyof typeof lines[number]) =>
          lines.reduce((s, l) => s + Number(l[f]), 0).toFixed(2);
        const taxable = sumField("taxable_value");
        const cgst    = sumField("cgst_amount");
        const sgst    = sumField("sgst_amount");
        const igst    = sumField("igst_amount");
        const cess    = sumField("cess_amount");
        const grand   = (Number(taxable) + Number(cgst) + Number(sgst) + Number(igst) + Number(cess)).toFixed(2);
        return {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          party_id: inv.party_id,
          party_name: party?.name ?? "(unknown)",
          party_state_code: party?.state_code,
          taxable_value: taxable,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          cess_amount: cess,
          grand_total: grand,
          status: inv.status,
        };
      })
      .filter((r) => !stateCode || r.party_state_code === stateCode);

    const totals = {
      count: rows.length,
      taxable_value: rows.reduce((s, r) => s + Number(r.taxable_value), 0).toFixed(2),
      cgst_amount:   rows.reduce((s, r) => s + Number(r.cgst_amount),   0).toFixed(2),
      sgst_amount:   rows.reduce((s, r) => s + Number(r.sgst_amount),   0).toFixed(2),
      igst_amount:   rows.reduce((s, r) => s + Number(r.igst_amount),   0).toFixed(2),
      cess_amount:   rows.reduce((s, r) => s + Number(r.cess_amount),   0).toFixed(2),
      grand_total:   rows.reduce((s, r) => s + Number(r.grand_total),   0).toFixed(2),
    };
    return delay(ok({ rows, totals }));
  }

  if (method === "GET" && path === "/reports/purchase-register") {
    const start = query.start_date as string | undefined;
    const end   = query.end_date as string | undefined;
    const partyId = query.party_id as string | undefined;
    const stateCode = query.state_code as string | undefined;
    const partyById = (id: string) =>
      (F.PARTIES as Array<{ id: string; name: string; state_code?: string }>).find((p) => p.id === id);

    const inRange = (d: string) =>
      (!start || d >= start) && (!end || d <= end);

    const rows = (F.VENDOR_BILLS as Array<{
      id: string; bill_number: string; bill_date: string;
      party_id: string; status: string;
    }>)
      .filter((b) => b.status !== "draft")
      .filter((b) => inRange(b.bill_date))
      .filter((b) => !partyId || b.party_id === partyId)
      .map((b) => {
        const party = partyById(b.party_id);
        const lines = (F.VENDOR_BILL_LINES[b.id] ?? []) as Array<{
          taxable_value: string; cgst_amount: string; sgst_amount: string;
          igst_amount: string; cess_amount: string;
        }>;
        const sumField = (f: keyof typeof lines[number]) =>
          lines.reduce((s, l) => s + Number(l[f]), 0).toFixed(2);
        const taxable = sumField("taxable_value");
        const cgst    = sumField("cgst_amount");
        const sgst    = sumField("sgst_amount");
        const igst    = sumField("igst_amount");
        const cess    = sumField("cess_amount");
        const grand   = (Number(taxable) + Number(cgst) + Number(sgst) + Number(igst) + Number(cess)).toFixed(2);
        return {
          bill_id: b.id,
          bill_number: b.bill_number,
          bill_date: b.bill_date,
          party_id: b.party_id,
          party_name: party?.name ?? "(unknown)",
          party_state_code: party?.state_code,
          taxable_value: taxable,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          cess_amount: cess,
          grand_total: grand,
          status: b.status,
        };
      })
      .filter((r) => !stateCode || r.party_state_code === stateCode);

    const totals = {
      count: rows.length,
      taxable_value: rows.reduce((s, r) => s + Number(r.taxable_value), 0).toFixed(2),
      cgst_amount:   rows.reduce((s, r) => s + Number(r.cgst_amount),   0).toFixed(2),
      sgst_amount:   rows.reduce((s, r) => s + Number(r.sgst_amount),   0).toFixed(2),
      igst_amount:   rows.reduce((s, r) => s + Number(r.igst_amount),   0).toFixed(2),
      cess_amount:   rows.reduce((s, r) => s + Number(r.cess_amount),   0).toFixed(2),
      grand_total:   rows.reduce((s, r) => s + Number(r.grand_total),   0).toFixed(2),
    };
    return delay(ok({ rows, totals }));
  }

  if (method === "GET" && (path === "/reports/debtors-aging" || path === "/reports/creditors-aging")) {
    const isDebtors = path === "/reports/debtors-aging";
    const asOf = (query.as_of as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const filterPartyId = query.party_id as string | undefined;
    const partyById = (id: string) =>
      (F.PARTIES as Array<{ id: string; name: string }>).find((p) => p.id === id);

    const docs: Array<{ party_id: string; doc_date: string; outstanding: number }> = [];

    if (isDebtors) {
      // Outstanding = grand_total − allocated_amount on posted invoices.
      // We approximate "allocated" via PAYMENT_ALLOCATIONS + opening RC.
      // For demo simplicity, treat posted as fully outstanding minus
      // any allocations on file for that invoice id.
      for (const inv of F.INVOICES as Array<{
        id: string; invoice_date: string; party_id: string; status: string; grand_total: string;
      }>) {
        if (inv.status !== "posted") continue;
        const allocated = (F.PAYMENT_ALLOCATIONS as Array<{ invoice_id?: string; amount: string }>)
          .filter((a) => a.invoice_id === inv.id)
          .reduce((s, a) => s + Number(a.amount), 0);
        const outstanding = Number(inv.grand_total) - allocated;
        if (outstanding > 0.005) {
          docs.push({ party_id: inv.party_id, doc_date: inv.invoice_date, outstanding });
        }
      }
    } else {
      // Creditors: outstanding on posted vendor bills.
      for (const b of F.VENDOR_BILLS as Array<{
        id: string; bill_date: string; party_id: string; status: string;
        grand_total: string; allocated_amount: string;
      }>) {
        if (b.status !== "posted") continue;
        const outstanding = Number(b.grand_total) - Number(b.allocated_amount);
        if (outstanding > 0.005) {
          docs.push({ party_id: b.party_id, doc_date: b.bill_date, outstanding });
        }
      }
    }

    const daysBetween = (a: string, b: string) => {
      // Both YYYY-MM-DD; compute calendar-day delta without TZ drift.
      const [ay, am, ad] = a.split("-").map(Number);
      const [by, bm, bd] = b.split("-").map(Number);
      const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
      return Math.floor(ms / 86_400_000);
    };

    const byParty = new Map<string, {
      party_id: string; party_name: string;
      bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number;
      total: number; oldest_doc_date?: string;
    }>();

    for (const d of docs) {
      if (filterPartyId && d.party_id !== filterPartyId) continue;
      const days = daysBetween(d.doc_date, asOf);
      const row = byParty.get(d.party_id) ?? {
        party_id: d.party_id,
        party_name: partyById(d.party_id)?.name ?? "(unknown)",
        bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0,
        total: 0,
        oldest_doc_date: undefined as string | undefined,
      };
      if (days <= 30)       row.bucket_0_30 += d.outstanding;
      else if (days <= 60)  row.bucket_31_60 += d.outstanding;
      else if (days <= 90)  row.bucket_61_90 += d.outstanding;
      else                  row.bucket_90_plus += d.outstanding;
      row.total += d.outstanding;
      if (!row.oldest_doc_date || d.doc_date < row.oldest_doc_date) {
        row.oldest_doc_date = d.doc_date;
      }
      byParty.set(d.party_id, row);
    }

    const rows = Array.from(byParty.values())
      .sort((a, b) => b.total - a.total)
      .map((r) => ({
        party_id: r.party_id,
        party_name: r.party_name,
        bucket_0_30:   r.bucket_0_30.toFixed(2),
        bucket_31_60:  r.bucket_31_60.toFixed(2),
        bucket_61_90:  r.bucket_61_90.toFixed(2),
        bucket_90_plus: r.bucket_90_plus.toFixed(2),
        total: r.total.toFixed(2),
        oldest_doc_date: r.oldest_doc_date,
      }));

    const totals = {
      count: rows.length,
      bucket_0_30:    rows.reduce((s, r) => s + Number(r.bucket_0_30),    0).toFixed(2),
      bucket_31_60:   rows.reduce((s, r) => s + Number(r.bucket_31_60),   0).toFixed(2),
      bucket_61_90:   rows.reduce((s, r) => s + Number(r.bucket_61_90),   0).toFixed(2),
      bucket_90_plus: rows.reduce((s, r) => s + Number(r.bucket_90_plus), 0).toFixed(2),
      total:          rows.reduce((s, r) => s + Number(r.total),          0).toFixed(2),
    };

    return delay(ok({ as_of: asOf, rows, totals }));
  }

  if (method === "GET" && path === "/reports/profit-loss") {
    const start = (query.start_date as string | undefined) ?? "1900-01-01";
    const end   = (query.end_date   as string | undefined) ?? "9999-12-31";
    const inRange = (d: string) => d >= start && d <= end;

    // Revenue: subtotal on posted invoices in range (taxable_value;
    // GST excluded since it's a pass-through to govt, not revenue).
    const revenue = (F.INVOICES as Array<{
      invoice_date: string; status: string; subtotal: string;
    }>)
      .filter((i) => i.status === "posted" && inRange(i.invoice_date))
      .reduce((s, i) => s + Number(i.subtotal), 0);

    // COGS: in a real backend this comes from valuation_layers consumed
    // by stock-out moves on posted invoices. Demo uses a flat 60% of
    // revenue as a stand-in until valuation hooks are wired up.
    const cogs = revenue * 0.6;

    // Expenses by category, posted in range.
    const catById = (id: string) =>
      (F.EXPENSE_CATEGORIES as Array<{ id: string; name: string }>).find((c) => c.id === id);
    const expenseByCat = new Map<string, number>();
    for (const e of F.EXPENSES_FX as Array<{
      expense_date: string; status: string; amount: string; category_id: string;
    }>) {
      if (e.status !== "posted" || !inRange(e.expense_date)) continue;
      expenseByCat.set(e.category_id, (expenseByCat.get(e.category_id) ?? 0) + Number(e.amount));
    }
    const expenses = Array.from(expenseByCat.entries()).map(([cid, amt]) => ({
      category_id: cid,
      category_name: catById(cid)?.name ?? "(unknown)",
      amount: amt.toFixed(2),
    }));
    const expensesTotal = Array.from(expenseByCat.values()).reduce((s, v) => s + v, 0);

    // Salary: posted in range, gross side (the employer's cost of labour).
    const salaryTotal = (F.SALARY_ENTRIES as Array<{
      posting_date?: string; status: string; gross_salary: string;
    }>)
      .filter((s) => s.status === "posted" && s.posting_date && inRange(s.posting_date.slice(0, 10)))
      .reduce((s, e) => s + Number(e.gross_salary), 0);

    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - expensesTotal - salaryTotal;

    return delay(ok({
      start_date: start === "1900-01-01" ? null : start,
      end_date:   end   === "9999-12-31" ? null : end,
      revenue:        revenue.toFixed(2),
      cogs:           cogs.toFixed(2),
      gross_profit:   grossProfit.toFixed(2),
      expenses,
      expenses_total: expensesTotal.toFixed(2),
      salary_total:   salaryTotal.toFixed(2),
      net_profit:     netProfit.toFixed(2),
    }));
  }

  // ── Phase 13 — Item Dimensions + Pricing Rules ──
  if (method === "GET" && path === "/item-dimensions") {
    return delay(ok(F.ITEM_DIMENSIONS.filter((d) => d.tenant_id === tid && d.is_active)));
  }

  if (method === "GET" && path === "/pricing-rules") {
    let rows = (F.ITEM_PRICING_RULES as Array<{
      item_id: string; tenant_id: string; valid_until: string | null;
      valid_from: string;
    }>).filter((r) => r.tenant_id === tid);
    if (query.item_id)     rows = rows.filter((r) => r.item_id === query.item_id);
    if (query.active_only === "true") {
      rows = rows.filter((r) => r.valid_until === null);
    }
    // Newest first by valid_from desc.
    return delay(ok([...rows].sort((a, b) =>
      a.valid_from < b.valid_from ? 1 : a.valid_from > b.valid_from ? -1 : 0,
    )));
  }

  if (method === "GET" && path === "/pricing-rules/lookup") {
    const itemId = query.item_id as string | undefined;
    const thickness = Number(query.thickness_mm);
    const size = query.size_code as string | undefined;
    const asOf = (query.as_of as string | undefined) ?? new Date().toISOString().slice(0, 10);
    if (!itemId || !thickness || !size) {
      return delay(ok({ rule: null }));
    }
    const rule = (F.ITEM_PRICING_RULES as Array<{
      item_id: string; thickness_mm: number; size_code: string;
      valid_from: string; valid_until: string | null;
    }>).find((r) =>
      r.item_id === itemId &&
      r.thickness_mm === thickness &&
      r.size_code === size &&
      r.valid_from <= asOf &&
      (r.valid_until === null || r.valid_until >= asOf),
    );
    if (!rule) return delay(ok({ rule: null }));
    return delay(ok({
      rule,
      effective_label: rule.valid_until
        ? `Effective ${rule.valid_from} → ${rule.valid_until}`
        : `Effective since ${rule.valid_from}`,
    }));
  }

  if (method === "POST" && path === "/pricing-rules") {
    const reqBody = (typeof body === "object" && body) ? body as {
      item_id?: string; thickness_mm?: number; size_code?: string;
      sale_price?: string; valid_from?: string; notes?: string;
    } : {};
    if (!reqBody.item_id || !reqBody.thickness_mm || !reqBody.size_code || !reqBody.sale_price) {
      throw fail(400, "BAD_REQUEST", "item_id, thickness_mm, size_code, sale_price are required");
    }
    const validFrom = reqBody.valid_from ?? new Date().toISOString().slice(0, 10);

    // Close the prior active rule (same item × dimension) by setting
    // its valid_until to (validFrom − 1 day). This is the version
    // semantics: only one rule active per (item, dim) at any time.
    const priorIdx = (F.ITEM_PRICING_RULES as Array<{
      item_id: string; thickness_mm: number; size_code: string;
      valid_until: string | null;
    }>).findIndex((r) =>
      r.item_id === reqBody.item_id &&
      r.thickness_mm === reqBody.thickness_mm &&
      r.size_code === reqBody.size_code &&
      r.valid_until === null,
    );
    if (priorIdx >= 0) {
      const d = new Date(validFrom);
      d.setDate(d.getDate() - 1);
      (F.ITEM_PRICING_RULES[priorIdx] as { valid_until: string }).valid_until =
        d.toISOString().slice(0, 10);
    }

    const newRule = {
      id: F.uid("pr"),
      tenant_id: tid as string,
      item_id: reqBody.item_id,
      thickness_mm: reqBody.thickness_mm,
      size_code: reqBody.size_code,
      sale_price: reqBody.sale_price,
      valid_from: validFrom,
      valid_until: null,
      notes: reqBody.notes ?? null,
      created_at: new Date().toISOString(),
      created_by: user?.email ?? null,
    };
    (F.ITEM_PRICING_RULES as Array<unknown>).push(newRule);
    return delay(ok(newRule, 201));
  }

  // ── Pricing dimension options (thickness / size catalogues) ──
  // Tenant-scoped lists kept in fixtures so the UI can add or remove
  // entries. New combinations only become "real" once a pricing rule
  // is created against them.
  if (method === "GET" && path === "/pricing-dimension-options/thickness") {
    return delay(ok([...F.PRICING_THICKNESS_OPTIONS].sort((a, b) => a - b)));
  }
  if (method === "POST" && path === "/pricing-dimension-options/thickness") {
    const v = Number((body as { thickness_mm?: number | string })?.thickness_mm);
    if (!v || v <= 0) throw fail(400, "BAD_REQUEST", "thickness_mm must be a positive number");
    if (F.PRICING_THICKNESS_OPTIONS.includes(v)) {
      throw fail(409, "CONFLICT", `${v} mm is already in the list`);
    }
    F.PRICING_THICKNESS_OPTIONS.push(v);
    return delay(ok({ thickness_mm: v }, 201));
  }
  if (method === "DELETE" && /^\/pricing-dimension-options\/thickness\/\d+(\.\d+)?$/.test(path)) {
    const v = Number(path.split("/").pop());
    // Block delete if any pricing rule (active or historical) references this thickness.
    const inUse = (F.ITEM_PRICING_RULES as Array<{ thickness_mm: number; tenant_id: string }>)
      .some((r) => r.tenant_id === tid && r.thickness_mm === v);
    if (inUse) throw fail(409, "IN_USE", `Cannot remove ${v} mm — pricing rules reference it.`);
    const idx = F.PRICING_THICKNESS_OPTIONS.indexOf(v);
    if (idx < 0) throw fail(404, "NOT_FOUND", `${v} mm is not in the list`);
    F.PRICING_THICKNESS_OPTIONS.splice(idx, 1);
    return delay(ok({}, 204));
  }

  if (method === "GET" && path === "/pricing-dimension-options/size") {
    return delay(ok([...F.PRICING_SIZE_OPTIONS]));
  }
  if (method === "POST" && path === "/pricing-dimension-options/size") {
    const reqBody = (body ?? {}) as { code?: string; label?: string };
    const code = (reqBody.code ?? "").trim();
    const label = (reqBody.label ?? "").trim();
    if (!code) throw fail(400, "BAD_REQUEST", "code is required (e.g. 1220x2440)");
    if (F.PRICING_SIZE_OPTIONS.some((s) => s.code === code)) {
      throw fail(409, "CONFLICT", `${code} is already in the list`);
    }
    const row = { code, label: label || code };
    F.PRICING_SIZE_OPTIONS.push(row);
    return delay(ok(row, 201));
  }
  if (method === "DELETE" && /^\/pricing-dimension-options\/size\/[^/]+$/.test(path)) {
    const code = decodeURIComponent(path.split("/").pop() ?? "");
    const inUse = (F.ITEM_PRICING_RULES as Array<{ size_code: string; tenant_id: string }>)
      .some((r) => r.tenant_id === tid && r.size_code === code);
    if (inUse) throw fail(409, "IN_USE", `Cannot remove ${code} — pricing rules reference it.`);
    const idx = F.PRICING_SIZE_OPTIONS.findIndex((s) => s.code === code);
    if (idx < 0) throw fail(404, "NOT_FOUND", `${code} is not in the list`);
    F.PRICING_SIZE_OPTIONS.splice(idx, 1);
    return delay(ok({}, 204));
  }

  // ── Phase 8 — Cash flow statement ──
  if (method === "GET" && path === "/reports/cash-flow") {
    const start = (query.start_date as string | undefined) ?? "1900-01-01";
    const end   = (query.end_date   as string | undefined) ?? "9999-12-31";
    const inRange = (d: string) => d >= start && d <= end;

    // Cash account types whose balance counts as "cash on hand".
    const cashTypes = new Set(["cash_in_hand", "bank", "gpay"]);
    const cashAccounts = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; type: string; current_balance: string }>)
      .filter((a) => cashTypes.has(a.type));

    const cashAccountIds = new Set(cashAccounts.map((a) => a.id));

    // Sum of cash account balances *as of* a given date — derived
    // from ledger entries up to (and including) that date.
    const cashBalanceAt = (date: string): number => {
      let sum = 0;
      for (const e of F.LEDGER_ENTRIES as Array<{ account_id: string; entry_date: string; debit: string; credit: string }>) {
        if (!cashAccountIds.has(e.account_id)) continue;
        if (e.entry_date > date) continue;
        sum += Number(e.debit) - Number(e.credit);
      }
      return sum;
    };

    // Day before start_date for opening — but if start is "1900-01-01"
    // (no filter) opening is zero by convention.
    const openingDate = start === "1900-01-01"
      ? null
      : (() => {
          const d = new Date(start);
          d.setDate(d.getDate() - 1);
          return d.toISOString().slice(0, 10);
        })();
    const opening = openingDate ? cashBalanceAt(openingDate) : 0;
    const closing = cashBalanceAt(end);

    // Operating: receipts from customers (PAYMENTS direction=received).
    const receipts = (F.PAYMENTS as Array<{ direction: string; status: string; payment_date: string; amount: string }>)
      .filter((p) => p.direction === "received" && p.status === "posted" && inRange(p.payment_date))
      .reduce((s, p) => s + Number(p.amount), 0);

    // Operating: payments to vendors (PAYMENTS direction=paid + supplier party).
    const partyById = (id: string) => (F.PARTIES as Array<{ id: string; party_type: string }>).find((x) => x.id === id);
    const vendorPayments = (F.PAYMENTS as Array<{ direction: string; status: string; payment_date: string; amount: string; party_id?: string }>)
      .filter((p) => p.direction === "paid" && p.status === "posted" && inRange(p.payment_date))
      .filter((p) => {
        const party = p.party_id ? partyById(p.party_id) : null;
        return party && (
          party.party_type === "supplier" ||
          party.party_type === "vendor" ||
          party.party_type === "both"
        );
      })
      .reduce((s, p) => s + Number(p.amount), 0);

    // Operating: salary paid (net_paid on posted entries in range).
    const salaryPaid = (F.SALARY_ENTRIES as Array<{ status: string; posting_date?: string; net_paid: string }>)
      .filter((s) => s.status === "posted" && s.posting_date && inRange(s.posting_date.slice(0, 10)))
      .reduce((s, e) => s + Number(e.net_paid), 0);

    // Categorise expenses by capital flag.
    const expensesByCategory = new Map<string, boolean>(
      (F.EXPENSE_CATEGORIES as Array<{ id: string; is_capital: boolean }>).map((c) => [c.id, c.is_capital]),
    );
    const postedExpenses = (F.EXPENSES_FX as Array<{ status: string; expense_date: string; amount: string; category_id: string }>)
      .filter((e) => e.status === "posted" && inRange(e.expense_date));
    const operatingExpenses = postedExpenses
      .filter((e) => expensesByCategory.get(e.category_id) === false)
      .reduce((s, e) => s + Number(e.amount), 0);
    const capitalExpenses = postedExpenses
      .filter((e) => expensesByCategory.get(e.category_id) === true)
      .reduce((s, e) => s + Number(e.amount), 0);

    const operatingNet = receipts - vendorPayments - salaryPaid - operatingExpenses;
    const investingNet = -capitalExpenses;
    const netChange = operatingNet + investingNet;

    return delay(ok({
      start_date: start === "1900-01-01" ? null : start,
      end_date:   end   === "9999-12-31" ? null : end,
      opening_cash: opening.toFixed(2),
      operating: {
        receipts_from_customers: receipts.toFixed(2),
        payments_to_vendors:     vendorPayments.toFixed(2),
        salary_paid:             salaryPaid.toFixed(2),
        operating_expenses:      operatingExpenses.toFixed(2),
        net:                     operatingNet.toFixed(2),
      },
      investing: {
        capital_expenditure: capitalExpenses.toFixed(2),
        net:                 investingNet.toFixed(2),
      },
      net_change_in_cash: netChange.toFixed(2),
      closing_cash:       closing.toFixed(2),
      // Pre-flattened lines for table rendering.
      lines: [
        { label: "Receipts from customers",            amount: receipts.toFixed(2) },
        { label: "Payments to vendors",                amount: (-vendorPayments).toFixed(2) },
        { label: "Salary paid (net)",                  amount: (-salaryPaid).toFixed(2) },
        { label: "Operating expenses",                 amount: (-operatingExpenses).toFixed(2) },
        { label: "Net cash from operating activities", amount: operatingNet.toFixed(2) },
        { label: "Capital expenditure",                amount: (-capitalExpenses).toFixed(2) },
        { label: "Net cash from investing activities", amount: investingNet.toFixed(2) },
      ],
    }));
  }

  // ── Phase 10 — Sales order → Invoice promotion ──
  const sopromm = match(path, "/documents/:id/promote-to-invoice");
  if (method === "POST" && sopromm) {
    const doc = (F.DOCUMENT_HEADERS as Array<{
      id: string; document_number: string; document_type_id: string;
      party_id?: string; document_date: string; status: string;
      posting_date?: string;
    }>).find((d) => d.id === sopromm.id);
    if (!doc) throw fail(404, "DOCUMENT_NOT_FOUND", "Document not found");

    const docType = (F.DOCUMENT_TYPES as Array<{ id: string; code: string }>)
      .find((t) => t.id === doc.document_type_id);
    if (docType?.code !== "SO") {
      throw fail(409, "NOT_A_SALES_ORDER", "Only sales orders can be promoted to invoices");
    }
    if (!doc.posting_date) {
      throw fail(409, "DOCUMENT_NOT_POSTED", "Sales order must be posted before promotion");
    }
    if ((doc as { is_promoted?: boolean }).is_promoted) {
      throw fail(409, "ALREADY_PROMOTED", "This sales order has already been promoted to an invoice");
    }

    // Generate the invoice number from the next available sequence.
    const yearMonth = new Date().toISOString().slice(0, 7);
    const existingNumbers = (F.INVOICES as Array<{ invoice_number: string }>)
      .map((i) => Number(i.invoice_number.split("/").pop()) || 0);
    const nextSeq = (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1;
    const invoiceNumber = `INV/${yearMonth}/${String(nextSeq).padStart(4, "0")}`;
    const invoiceId = F.uid("inv");

    // Pull lines + compute GST splits per line based on the customer's state code.
    const docLines = (F.DOCUMENT_LINES?.[doc.id] ?? []) as Array<{
      item_id: string; uom_id: string; quantity: string; unit_price: string;
      line_number?: number; discount_pct?: string; remarks?: string;
    }>;
    const customer = doc.party_id
      ? (F.PARTIES as Array<{ id: string; state_code?: string }>).find((p) => p.id === doc.party_id)
      : null;
    const tenant = (F.TENANTS as Array<{ id: string; state_code?: string }>).find((t) => t.id === tid);
    const placeOfSupply = customer?.state_code ?? tenant?.state_code ?? "27";
    const isInterState = placeOfSupply !== (tenant?.state_code ?? "27");

    const itemById = (id: string) =>
      (F.ITEMS as Array<{ id: string; default_tax_rate_pct?: string; hsn_code?: string; name: string }>).find((it) => it.id === id);

    let subtotal = 0, taxTotal = 0;
    const newLines: unknown[] = [];
    docLines.forEach((dl, idx) => {
      const item = itemById(dl.item_id);
      const ratePct = Number(item?.default_tax_rate_pct ?? 0);
      const taxableValue = Number(dl.quantity) * Number(dl.unit_price)
        * (1 - Number(dl.discount_pct ?? 0) / 100);
      const totalTax = taxableValue * ratePct / 100;
      const cgst = isInterState ? 0 : totalTax / 2;
      const sgst = isInterState ? 0 : totalTax / 2;
      const igst = isInterState ? totalTax : 0;
      subtotal += taxableValue;
      taxTotal += totalTax;
      newLines.push({
        id: F.uid("il"),
        invoice_id: invoiceId,
        line_number: dl.line_number ?? idx + 1,
        item_id: dl.item_id,
        hsn_code: item?.hsn_code ?? "",
        description: item?.name ?? "",
        uom_id: dl.uom_id,
        quantity: dl.quantity,
        unit_price: dl.unit_price,
        discount_pct: dl.discount_pct ?? "0",
        rate_pct: String(ratePct),
        taxable_value: taxableValue.toFixed(2),
        cgst_amount: cgst.toFixed(2),
        sgst_amount: sgst.toFixed(2),
        igst_amount: igst.toFixed(2),
        cess_amount: "0.00",
        line_total: (taxableValue + totalTax).toFixed(2),
        lot_id: null, serial_id: null,
        remarks: dl.remarks ?? "",
      });
    });

    const grandTotal = subtotal + taxTotal;

    (F.INVOICES as Array<unknown>).push({
      id: invoiceId, tenant_id: tid as string,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      party_id: doc.party_id ?? null,
      place_of_supply: placeOfSupply,
      status: "draft",
      challan_id: null,
      source_doc_id: doc.id,
      irn: null, qr_code_data: null,
      subtotal: subtotal.toFixed(2),
      tax_total: taxTotal.toFixed(2),
      grand_total: grandTotal.toFixed(2),
      amount_in_words: "",
      remarks: `Promoted from sales order ${doc.document_number}`,
      posting_date: null, cancelled_at: null, cancellation_reason: null,
      version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!F.INVOICE_LINES[invoiceId]) F.INVOICE_LINES[invoiceId] = [];
    (F.INVOICE_LINES[invoiceId] as Array<unknown>).push(...newLines);

    // Flip the SO so it can't be re-promoted.
    (doc as { is_promoted?: boolean; invoice_id?: string }).is_promoted = true;
    (doc as { invoice_id?: string }).invoice_id = invoiceId;

    return delay(ok({ invoice_id: invoiceId, invoice_number: invoiceNumber }, 201));
  }

  // ── Phase 9 — Audit log ──
  if (method === "GET" && path === "/audit-log") {
    let rows = F.AUDIT_LOG_ENTRIES.filter((e) => e.tenant_id === tid);
    if (query.user_id)     rows = rows.filter((e) => e.user_id === query.user_id);
    if (query.entity_type) rows = rows.filter((e) => e.entity_type === query.entity_type);
    if (query.action) {
      const q = String(query.action);
      // Prefix match: "invoice." matches "invoice.post" + "invoice.cancel".
      rows = rows.filter((e) => e.action === q || (q.endsWith(".") && e.action.startsWith(q)));
    }
    if (query.start_date)  rows = rows.filter((e) => e.created_at >= String(query.start_date));
    if (query.end_date)    rows = rows.filter((e) => e.created_at.slice(0, 10) <= String(query.end_date));
    rows = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return delay(ok(rows));
  }

  // ── Phase 5 — GSTR-1 / GSTR-3B / Period close ──
  //
  // GSTR endpoints take YYYY-MM and return GSTN-portal-shaped JSON.
  // Period-close stores its single setting in tenant_config.
  if (method === "GET" && path === "/reports/gstr-1") {
    const period = (query.period as string | undefined) ?? new Date().toISOString().slice(0, 7);
    const periodPrefix = period;  // YYYY-MM
    const tenant = (F.TENANTS as Array<{ id: string; gstin?: string; state_code?: string }>)
      .find((t) => t.id === tid);
    const tenantState = tenant?.state_code ?? "27";
    const tenantGstin = tenant?.gstin ?? "";
    const fp = period.slice(5, 7) + period.slice(0, 4);  // MMYYYY

    const ddmmyyyy = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}-${m}-${y}`;
    };

    const partyById = (id: string) =>
      (F.PARTIES as Array<{ id: string; gstin?: string; is_gst_registered?: boolean; state_code?: string }>)
        .find((p) => p.id === id);

    const inPeriod = (d: string) => d.startsWith(periodPrefix);

    type Inv = { id: string; invoice_number: string; invoice_date: string;
      party_id: string; place_of_supply: string; status: string; grand_total: string };

    const periodInvoices = (F.INVOICES as Inv[])
      .filter((inv) => inv.status === "posted" && inPeriod(inv.invoice_date));

    const b2b: unknown[] = [];
    const b2cl: unknown[] = [];
    const b2csMap = new Map<string, {
      sply_ty: "INTRA" | "INTER"; pos: string; rt: string;
      txval: number; camt: number; samt: number; iamt: number; csamt: number;
    }>();

    for (const inv of periodInvoices) {
      const party = partyById(inv.party_id);
      const lines = (F.INVOICE_LINES[inv.id] ?? []) as Array<{
        line_number: number; rate_pct: string;
        taxable_value: string; cgst_amount: string; sgst_amount: string;
        igst_amount: string; cess_amount: string;
      }>;
      const isInter = inv.place_of_supply !== tenantState;

      if (party?.is_gst_registered && party.gstin) {
        // §4 B2B — registered, full per-invoice detail
        b2b.push({
          ctin: party.gstin,
          inum: inv.invoice_number,
          idt: ddmmyyyy(inv.invoice_date),
          val: inv.grand_total,
          pos: inv.place_of_supply,
          rchrg: "N",
          inv_typ: "R",
          itms: lines.map((l) => ({
            num: l.line_number,
            itm_det: {
              txval: l.taxable_value,
              rt:    l.rate_pct,
              camt:  l.cgst_amount,
              samt:  l.sgst_amount,
              iamt:  l.igst_amount,
              csamt: l.cess_amount,
            },
          })),
        });
      } else if (isInter && Number(inv.grand_total) > 250000) {
        // §5 B2CL — unregistered, inter-state, > ₹2.5L
        b2cl.push({
          inum: inv.invoice_number,
          idt:  ddmmyyyy(inv.invoice_date),
          val:  inv.grand_total,
          pos:  inv.place_of_supply,
          itms: lines.map((l) => ({
            num: l.line_number,
            itm_det: {
              txval: l.taxable_value,
              rt:    l.rate_pct,
              iamt:  l.igst_amount,
              csamt: l.cess_amount,
            },
          })),
        });
      } else {
        // §7 B2CS — aggregated by (sply_ty, pos, rt)
        for (const l of lines) {
          const sply: "INTRA" | "INTER" = isInter ? "INTER" : "INTRA";
          const key = `${sply}|${inv.place_of_supply}|${l.rate_pct}`;
          const cur = b2csMap.get(key) ?? {
            sply_ty: sply, pos: inv.place_of_supply, rt: l.rate_pct,
            txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0,
          };
          cur.txval += Number(l.taxable_value);
          cur.camt  += Number(l.cgst_amount);
          cur.samt  += Number(l.sgst_amount);
          cur.iamt  += Number(l.igst_amount);
          cur.csamt += Number(l.cess_amount);
          b2csMap.set(key, cur);
        }
      }
    }

    const b2cs = Array.from(b2csMap.values()).map((r) => ({
      sply_ty: r.sply_ty, pos: r.pos, rt: r.rt,
      txval: r.txval.toFixed(2),
      camt:  r.camt.toFixed(2),
      samt:  r.samt.toFixed(2),
      iamt:  r.iamt.toFixed(2),
      csamt: r.csamt.toFixed(2),
    }));

    // Roll-up summary across all three sections.
    const sumLines = (rows: typeof periodInvoices) =>
      rows.flatMap((r) => F.INVOICE_LINES[r.id] ?? []) as Array<{
        taxable_value: string; cgst_amount: string; sgst_amount: string;
        igst_amount: string; cess_amount: string;
      }>;
    const allLines = sumLines(periodInvoices);
    const sumOf = (f: keyof typeof allLines[number]) =>
      allLines.reduce((s, l) => s + Number(l[f]), 0).toFixed(2);
    const totTaxable = sumOf("taxable_value");
    const totCgst    = sumOf("cgst_amount");
    const totSgst    = sumOf("sgst_amount");
    const totIgst    = sumOf("igst_amount");
    const totCess    = sumOf("cess_amount");
    const grand = (Number(totTaxable) + Number(totCgst) + Number(totSgst) + Number(totIgst) + Number(totCess)).toFixed(2);

    return delay(ok({
      gstin: tenantGstin,
      fp,
      b2b,
      b2cl,
      b2cs,
      summary: {
        b2b_count:  b2b.length,
        b2cl_count: b2cl.length,
        b2cs_count: b2cs.length,
        total_taxable: totTaxable,
        total_cgst:    totCgst,
        total_sgst:    totSgst,
        total_igst:    totIgst,
        total_cess:    totCess,
        grand_total:   grand,
      },
    }));
  }

  if (method === "GET" && path === "/reports/gstr-3b") {
    const period = (query.period as string | undefined) ?? new Date().toISOString().slice(0, 7);
    const tenant = (F.TENANTS as Array<{ id: string; gstin?: string }>).find((t) => t.id === tid);
    const tenantGstin = tenant?.gstin ?? "";
    const retPeriod = period.slice(5, 7) + period.slice(0, 4);

    const inPeriod = (d: string) => d.startsWith(period);

    // §3.1(a) outward — sum across posted invoices in period.
    const outwardLines = (F.INVOICES as Array<{ id: string; status: string; invoice_date: string }>)
      .filter((i) => i.status === "posted" && inPeriod(i.invoice_date))
      .flatMap((i) => F.INVOICE_LINES[i.id] ?? []) as Array<{
        taxable_value: string; cgst_amount: string; sgst_amount: string;
        igst_amount: string; cess_amount: string;
      }>;
    const sum = (rows: typeof outwardLines, f: keyof typeof outwardLines[number]) =>
      rows.reduce((s, l) => s + Number(l[f]), 0).toFixed(2);

    const osup_det = {
      txval: sum(outwardLines, "taxable_value"),
      iamt:  sum(outwardLines, "igst_amount"),
      camt:  sum(outwardLines, "cgst_amount"),
      samt:  sum(outwardLines, "sgst_amount"),
      csamt: sum(outwardLines, "cess_amount"),
    };

    // §3.1(d) inward reverse-charge — not modelled in demo.
    const isup_rev = { txval: "0.00", iamt: "0.00", camt: "0.00", samt: "0.00", csamt: "0.00" };

    // §4 ITC — sum across posted vendor bills in period.
    const billLines = (F.VENDOR_BILLS as Array<{ id: string; status: string; bill_date: string }>)
      .filter((b) => b.status === "posted" && inPeriod(b.bill_date))
      .flatMap((b) => F.VENDOR_BILL_LINES[b.id] ?? []) as Array<{
        cgst_amount: string; sgst_amount: string;
        igst_amount: string; cess_amount: string;
      }>;
    const itc_avl = {
      iamt:  sum(billLines as never, "igst_amount" as never),
      camt:  sum(billLines as never, "cgst_amount" as never),
      samt:  sum(billLines as never, "sgst_amount" as never),
      csamt: sum(billLines as never, "cess_amount" as never),
    };

    return delay(ok({
      gstin: tenantGstin,
      ret_period: retPeriod,
      sup_details: { osup_det, isup_rev },
      itc_elg: {
        itc_avl,
        itc_net: { ...itc_avl },  // no reversals modelled
      },
    }));
  }

  // ── Phase 6 — Payroll batch + payslips ──
  if (method === "GET" && path === "/salary/batch") {
    const period = (query.period as string | undefined) ?? new Date().toISOString().slice(0, 7);
    const periodMonth = `${period}-01`;
    const employees = (F.EMPLOYEES as Array<{
      id: string; tenant_id: string; name: string; role?: string;
      monthly_salary: string; is_active: boolean; float_account_id?: string;
    }>).filter((e) => e.tenant_id === tid && e.is_active);

    const entries = employees.map((emp) => {
      const sal = (F.SALARY_ENTRIES as Array<{
        id: string; period_month: string; employee_id: string;
        gross_salary: string; float_held: string; net_paid: string; status: string;
      }>).find((s) => s.employee_id === emp.id && s.period_month === periodMonth);

      const floatAcc = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; current_balance: string }>)
        .find((a) => a.id === emp.float_account_id);
      const currentFloat = floatAcc?.current_balance ?? "0.00";

      return {
        salary_id:       sal?.id ?? null,
        employee_id:     emp.id,
        employee_name:   emp.name,
        employee_role:   emp.role,
        current_float:   currentFloat,
        gross_salary:    sal?.gross_salary,
        float_held:      sal?.float_held,
        net_paid:        sal?.net_paid,
        status:          sal?.status,
      };
    });

    const totals = {
      employee_count: entries.length,
      drafts:    entries.filter((e) => e.status === "draft").length,
      posted:    entries.filter((e) => e.status === "posted").length,
      cancelled: entries.filter((e) => e.status === "cancelled").length,
      total_gross: entries.reduce((s, e) => s + Number(e.gross_salary ?? 0), 0).toFixed(2),
      total_float: entries.reduce((s, e) => s + Number(e.float_held ?? 0), 0).toFixed(2),
      total_net:   entries.reduce((s, e) => s + Number(e.net_paid ?? 0), 0).toFixed(2),
    };

    return delay(ok({ period_month: periodMonth, entries, totals }));
  }

  if (method === "POST" && path === "/salary/batch/generate") {
    const reqBody = (typeof body === "object" && body) ? body as { period?: string } : {};
    const period = reqBody.period ?? new Date().toISOString().slice(0, 7);
    const periodMonth = `${period}-01`;

    const employees = (F.EMPLOYEES as Array<{
      id: string; tenant_id: string; name: string; monthly_salary: string;
      is_active: boolean; float_account_id?: string; payment_account_id: string;
    }>).filter((e) => e.tenant_id === tid && e.is_active);

    let createdCount = 0;
    for (const emp of employees) {
      const exists = (F.SALARY_ENTRIES as Array<{ employee_id: string; period_month: string }>)
        .some((s) => s.employee_id === emp.id && s.period_month === periodMonth);
      if (exists) continue;
      const floatAcc = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; current_balance: string }>)
        .find((a) => a.id === emp.float_account_id);
      const floatHeld = floatAcc?.current_balance ?? "0.00";
      const net = (Number(emp.monthly_salary) - Number(floatHeld)).toFixed(2);

      // Generate next salary number — find max trailing seq for current YYYY-MM.
      const ymPrefix = `SAL/${period}/`;
      const existing = (F.SALARY_ENTRIES as Array<{ salary_number: string }>)
        .filter((s) => s.salary_number.startsWith(ymPrefix))
        .map((s) => Number(s.salary_number.split("/").pop()) || 0);
      const nextSeq = (existing.length ? Math.max(...existing) : 0) + 1;
      const salaryNumber = `${ymPrefix}${String(nextSeq).padStart(4, "0")}`;

      F.SALARY_ENTRIES.push({
        id: F.uid("sal"),
        tenant_id: tid,
        salary_number: salaryNumber,
        period_month: periodMonth,
        employee_id: emp.id,
        gross_salary: Number(emp.monthly_salary).toFixed(2),
        float_held: floatHeld,
        net_paid: net,
        paid_from_account_id: emp.payment_account_id,
        status: "draft",
        posting_date: null,
        cancelled_at: null,
        cancellation_reason: null,
        version: 0,
        remarks: `Auto-generated by payroll batch (${period})`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        updated_by: null,
      });
      createdCount += 1;
    }

    // Re-run the GET handler shape to return the same summary.
    const refreshed = (F.EMPLOYEES as Array<{ id: string; tenant_id: string; name: string; role?: string; monthly_salary: string; is_active: boolean; float_account_id?: string }>)
      .filter((e) => e.tenant_id === tid && e.is_active)
      .map((emp) => {
        const sal = (F.SALARY_ENTRIES as Array<{ id: string; period_month: string; employee_id: string; gross_salary: string; float_held: string; net_paid: string; status: string }>)
          .find((s) => s.employee_id === emp.id && s.period_month === periodMonth);
        const floatAcc = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; current_balance: string }>)
          .find((a) => a.id === emp.float_account_id);
        return {
          salary_id: sal?.id ?? null, employee_id: emp.id, employee_name: emp.name,
          employee_role: emp.role, current_float: floatAcc?.current_balance ?? "0.00",
          gross_salary: sal?.gross_salary, float_held: sal?.float_held,
          net_paid: sal?.net_paid, status: sal?.status,
        };
      });
    const totals = {
      employee_count: refreshed.length,
      drafts:    refreshed.filter((e) => e.status === "draft").length,
      posted:    refreshed.filter((e) => e.status === "posted").length,
      cancelled: refreshed.filter((e) => e.status === "cancelled").length,
      total_gross: refreshed.reduce((s, e) => s + Number(e.gross_salary ?? 0), 0).toFixed(2),
      total_float: refreshed.reduce((s, e) => s + Number(e.float_held ?? 0), 0).toFixed(2),
      total_net:   refreshed.reduce((s, e) => s + Number(e.net_paid ?? 0), 0).toFixed(2),
    };
    return delay(ok({ period_month: periodMonth, entries: refreshed, totals, created: createdCount }, 201));
  }

  if (method === "POST" && path === "/salary/batch/post") {
    const reqBody = (typeof body === "object" && body) ? body as { period?: string } : {};
    const period = reqBody.period ?? new Date().toISOString().slice(0, 7);
    const periodMonth = `${period}-01`;

    const drafts = (F.SALARY_ENTRIES as Array<{
      id: string; period_month: string; employee_id: string; status: string;
      float_held: string;
    }>).filter((s) => s.period_month === periodMonth && s.status === "draft");

    // Per-entry float-drift validation. If ANY drifts, fail the batch
    // and surface the offenders so the user can refresh + retry.
    const drift_entries: Array<{ salary_id: string; employee_name: string; expected_float: string; actual_float: string }> = [];
    for (const s of drafts) {
      const emp = (F.EMPLOYEES as Array<{ id: string; name: string; float_account_id?: string }>)
        .find((e) => e.id === s.employee_id);
      const floatAcc = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; current_balance: string }>)
        .find((a) => a.id === emp?.float_account_id);
      const actual = Number(floatAcc?.current_balance ?? 0).toFixed(2);
      const expected = Number(s.float_held).toFixed(2);
      if (actual !== expected) {
        drift_entries.push({
          salary_id: s.id,
          employee_name: emp?.name ?? "(unknown)",
          expected_float: expected,
          actual_float: actual,
        });
      }
    }
    if (drift_entries.length > 0) {
      throw fail(422, "SALARY_BATCH_FLOAT_DRIFT",
        `${drift_entries.length} entr${drift_entries.length === 1 ? "y" : "ies"} ha${drift_entries.length === 1 ? "s" : "ve"} float drift; refresh and retry`,
        { drift_entries: JSON.stringify(drift_entries) });
    }

    // All clear — flip every draft to posted.
    let postedCount = 0;
    for (const s of drafts) {
      const idx = (F.SALARY_ENTRIES as Array<{ id: string }>).findIndex((x) => x.id === s.id);
      if (idx < 0) continue;
      const ref = F.SALARY_ENTRIES[idx] as { status: string; posting_date: string | null; version: number; updated_at: string };
      ref.status = "posted";
      ref.posting_date = new Date().toISOString();
      ref.version = ref.version + 1;
      ref.updated_at = new Date().toISOString();
      postedCount += 1;
    }
    return delay(ok({ posted_count: postedCount }, 200));
  }

  // Hydrated payslip view — joins SalaryEntry → Employee → Tenant.
  const paysm = match(path, "/salary/:id/payslip");
  if (method === "GET" && paysm) {
    const sal = (F.SALARY_ENTRIES as Array<{
      id: string; salary_number: string; period_month: string; posting_date?: string;
      status: string; gross_salary: string; float_held: string; net_paid: string;
      employee_id: string; paid_from_account_id: string;
    }>).find((s) => s.id === paysm.id);
    if (!sal) throw fail(404, "SALARY_NOT_FOUND", "Salary entry not found");
    const emp = (F.EMPLOYEES as Array<{
      id: string; name: string; role?: string;
    }>).find((e) => e.id === sal.employee_id);
    const tenant = (F.TENANTS as Array<{
      id: string; name: string; gstin?: string;
    }>).find((t) => t.id === tid);
    const acc = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; name: string }>)
      .find((a) => a.id === sal.paid_from_account_id);

    const inWords = (n: number): string => {
      if (n === 0) return "Zero rupees only";
      const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
        "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
      const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
      const twoDigit = (x: number): string => x < 20 ? ones[x] : `${tens[Math.floor(x/10)]}${x%10 ? "-"+ones[x%10] : ""}`;
      const threeDigit = (x: number): string => x >= 100 ? `${ones[Math.floor(x/100)]} hundred${x%100 ? " "+twoDigit(x%100) : ""}` : twoDigit(x);
      const i = Math.floor(n);
      const cr = Math.floor(i / 10000000);
      const lk = Math.floor((i % 10000000) / 100000);
      const th = Math.floor((i % 100000) / 1000);
      const rest = i % 1000;
      const parts: string[] = [];
      if (cr) parts.push(`${threeDigit(cr)} crore`);
      if (lk) parts.push(`${threeDigit(lk)} lakh`);
      if (th) parts.push(`${threeDigit(th)} thousand`);
      if (rest) parts.push(threeDigit(rest));
      const joined = parts.join(" ").trim() || "zero";
      return joined.charAt(0).toUpperCase() + joined.slice(1) + " rupees only";
    };

    return delay(ok({
      salary_id: sal.id,
      salary_number: sal.salary_number,
      period_month: sal.period_month,
      posting_date: sal.posting_date,
      status: sal.status,
      tenant_name: tenant?.name ?? "(unknown tenant)",
      tenant_gstin: tenant?.gstin,
      employee_id: sal.employee_id,
      employee_name: emp?.name ?? "(unknown employee)",
      employee_role: emp?.role,
      gross_salary: sal.gross_salary,
      float_held: sal.float_held,
      net_paid: sal.net_paid,
      paid_from_account_name: acc?.name ?? "(unknown account)",
      amount_in_words: inWords(Number(sal.net_paid)),
    }));
  }

  // ── Phase 7 — Bulk imports ──
  //
  // Schema-driven preview + commit. Schemas live alongside the
  // handler so the FE wizard, the template download, and the
  // validator stay in lockstep.

  type ImportColumnSpec = {
    key: string; label: string; required: boolean; help?: string;
    enum_values?: string[];
    /** Validate one cell value; return error message or null. */
    validate?: (value: unknown, row: Record<string, unknown>) => string | null;
  };

  const IMPORT_SCHEMAS: Record<string, { columns: ImportColumnSpec[]; uniqueKey?: string }> = {
    items: {
      uniqueKey: "item_code",
      columns: [
        { key: "item_code", label: "Item code", required: true, help: "SKU — must be unique within your tenant" },
        { key: "name", label: "Name", required: true },
        { key: "hsn_code", label: "HSN code", required: false, help: "4-8 digit GST classification code" },
        { key: "default_sale_price", label: "Sale price", required: true, help: "Pre-fills new invoice lines" },
        { key: "default_tax_rate_pct", label: "GST rate %", required: true, enum_values: ["0","3","5","12","18","28"] },
        { key: "base_uom", label: "Base UoM code", required: true, help: "e.g. EACH, KG, BOX — must exist in UoM master" },
        { key: "brand_code", label: "Brand code", required: false, help: "Empty if no brand; must exist in brand master" },
        { key: "category_code", label: "Category code", required: false, help: "Must exist in category master" },
        { key: "is_batch_tracked", label: "Batch tracked", required: false, enum_values: ["true","false","yes","no",""] },
        { key: "is_serial_tracked", label: "Serial tracked", required: false, enum_values: ["true","false","yes","no",""] },
      ],
    },
    parties: {
      uniqueKey: "code",
      columns: [
        { key: "code", label: "Party code", required: true, help: "e.g. CUS-001, SUP-002 — must be unique" },
        { key: "name", label: "Display name", required: true },
        { key: "legal_name", label: "Legal name", required: false },
        { key: "party_type", label: "Type", required: true, enum_values: ["customer","supplier","vendor","general_person","both"] },
        { key: "gstin", label: "GSTIN", required: false, help: "15-char GST registration number" },
        { key: "state_code", label: "State code", required: true, help: "2-digit Indian state code (e.g. 27 for Maharashtra)" },
        { key: "phone", label: "Phone", required: false },
        { key: "email", label: "Email", required: false },
        { key: "opening_balance", label: "Opening balance", required: false, help: "Current AR (positive) or AP (negative)" },
      ],
    },
    stock_balances: {
      columns: [
        { key: "item_code", label: "Item code", required: true, help: "Must already exist in items master" },
        { key: "location_code", label: "Location code", required: true, help: "Must already exist in locations master" },
        { key: "qty_on_hand", label: "Quantity on hand", required: true, help: "Initial physical count" },
        { key: "unit_cost", label: "Unit cost", required: true, help: "Used to seed valuation" },
      ],
    },
    opening_balances: {
      columns: [
        { key: "party_code", label: "Party code", required: true, help: "Must exist in parties master" },
        { key: "amount", label: "Opening amount", required: true, help: "Positive = customer owes us; Negative = we owe vendor" },
        { key: "as_of_date", label: "As-of date", required: true, help: "YYYY-MM-DD; typically last day of FY before go-live" },
        { key: "remarks", label: "Remarks", required: false },
      ],
    },
  };

  const csvEscape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

  const tplm = match(path, "/imports/template/:entity");
  if (method === "GET" && tplm) {
    const schema = IMPORT_SCHEMAS[tplm.entity];
    if (!schema) throw fail(404, "TEMPLATE_NOT_FOUND", `No template for "${tplm.entity}"`);
    // Header row + one example row pulled from the demo fixtures
    // when possible, so users can see what valid data looks like.
    const examples: Record<string, Record<string, string>> = {
      items:    { item_code: "EX-001", name: "Sample item", hsn_code: "8471", default_sale_price: "100", default_tax_rate_pct: "18", base_uom: "EACH", brand_code: "", category_code: "", is_batch_tracked: "false", is_serial_tracked: "false" },
      parties:  { code: "CUS-EX-001", name: "Sample customer", legal_name: "Sample Customer Ltd", party_type: "customer", gstin: "27AAAAA0001A1Z5", state_code: "27", phone: "+91 90000 00000", email: "billing@example.com", opening_balance: "0" },
      stock_balances:    { item_code: "LT-100", location_code: "MAIN", qty_on_hand: "10", unit_cost: "750.00" },
      opening_balances:  { party_code: "CUS-001", amount: "12500.00", as_of_date: "2026-04-01", remarks: "Carry-forward from previous system" },
    };
    const header = schema.columns.map((c) => c.key).join(",");
    const example = schema.columns.map((c) => csvEscape(examples[tplm.entity]?.[c.key] ?? "")).join(",");
    return delay({ status: 200, statusText: "OK", headers: { "content-type": "text/csv" }, data: header + "\n" + example + "\n", config: {} as never });
  }

  const validateRow = (entity: string, row: Record<string, unknown>, allRows: Array<Record<string, unknown>>, rowIdx: number): { valid: boolean; errors: Array<{ row_index: number; field?: string; message: string }> } => {
    const schema = IMPORT_SCHEMAS[entity];
    if (!schema) return { valid: false, errors: [{ row_index: rowIdx, message: "Unknown entity" }] };
    const errors: Array<{ row_index: number; field?: string; message: string }> = [];

    for (const col of schema.columns) {
      const v = row[col.key];
      const isEmpty = v === undefined || v === null || String(v).trim() === "";
      if (col.required && isEmpty) {
        errors.push({ row_index: rowIdx, field: col.key, message: `${col.label} is required` });
        continue;
      }
      if (!isEmpty && col.enum_values && !col.enum_values.includes(String(v).trim())) {
        errors.push({ row_index: rowIdx, field: col.key, message: `${col.label} must be one of: ${col.enum_values.filter(Boolean).join(", ")}` });
      }
    }

    // Entity-specific validators
    if (entity === "items") {
      const uom = String(row.base_uom ?? "").trim();
      if (uom) {
        const found = (F.UOMS as Array<{ code: string }>).some((u) => u.code.toUpperCase() === uom.toUpperCase());
        if (!found) errors.push({ row_index: rowIdx, field: "base_uom", message: `UoM "${uom}" not found in master` });
      }
      const brand = String(row.brand_code ?? "").trim();
      if (brand) {
        const found = (F.BRANDS as Array<{ code: string }>).some((b) => b.code.toUpperCase() === brand.toUpperCase());
        if (!found) errors.push({ row_index: rowIdx, field: "brand_code", message: `Brand "${brand}" not found` });
      }
      const sale = Number(row.default_sale_price);
      if (!isFinite(sale) || sale < 0) errors.push({ row_index: rowIdx, field: "default_sale_price", message: "Must be a non-negative number" });
    }
    if (entity === "parties") {
      const stateCode = String(row.state_code ?? "").trim();
      if (stateCode && !/^\d{2}$/.test(stateCode)) errors.push({ row_index: rowIdx, field: "state_code", message: "State code must be exactly 2 digits" });
      const gstin = String(row.gstin ?? "").trim();
      if (gstin && gstin.length !== 15) errors.push({ row_index: rowIdx, field: "gstin", message: "GSTIN must be 15 characters" });
    }
    if (entity === "stock_balances") {
      const itemCode = String(row.item_code ?? "").trim();
      if (itemCode) {
        const found = (F.ITEMS as Array<{ item_code: string }>).some((i) => i.item_code.toUpperCase() === itemCode.toUpperCase());
        if (!found) errors.push({ row_index: rowIdx, field: "item_code", message: `Item "${itemCode}" not found` });
      }
      const locCode = String(row.location_code ?? "").trim();
      if (locCode) {
        const found = (F.LOCATIONS as Array<{ code: string }>).some((l) => l.code.toUpperCase() === locCode.toUpperCase());
        if (!found) errors.push({ row_index: rowIdx, field: "location_code", message: `Location "${locCode}" not found` });
      }
      const qty = Number(row.qty_on_hand);
      if (!isFinite(qty) || qty < 0) errors.push({ row_index: rowIdx, field: "qty_on_hand", message: "Must be a non-negative number" });
    }
    if (entity === "opening_balances") {
      const partyCode = String(row.party_code ?? "").trim();
      if (partyCode) {
        const found = (F.PARTIES as Array<{ code: string }>).some((p) => p.code.toUpperCase() === partyCode.toUpperCase());
        if (!found) errors.push({ row_index: rowIdx, field: "party_code", message: `Party "${partyCode}" not found` });
      }
      const amt = Number(row.amount);
      if (!isFinite(amt)) errors.push({ row_index: rowIdx, field: "amount", message: "Must be a number" });
      const dt = String(row.as_of_date ?? "");
      if (dt && !/^\d{4}-\d{2}-\d{2}$/.test(dt)) errors.push({ row_index: rowIdx, field: "as_of_date", message: "Date must be YYYY-MM-DD" });
    }

    // Within-file uniqueness on the unique key.
    if (schema.uniqueKey) {
      const key = String(row[schema.uniqueKey] ?? "").trim().toUpperCase();
      if (key) {
        const dupCount = allRows.filter((r) => String(r[schema.uniqueKey!] ?? "").trim().toUpperCase() === key).length;
        if (dupCount > 1) errors.push({ row_index: rowIdx, field: schema.uniqueKey, message: `Duplicate ${schema.uniqueKey} in upload` });
      }
    }

    return { valid: errors.length === 0, errors };
  };

  if (method === "POST" && path === "/imports/preview") {
    const reqBody = (typeof body === "object" && body)
      ? body as { entity?: string; rows?: Array<Record<string, unknown>> }
      : {};
    const entity = reqBody.entity ?? "";
    const inputRows = Array.isArray(reqBody.rows) ? reqBody.rows : [];
    const schema = IMPORT_SCHEMAS[entity];
    if (!schema) throw fail(400, "INVALID_ENTITY", `Entity "${entity}" not importable`);

    const validatedRows: Array<Record<string, unknown> & { _valid: boolean; _errors?: Array<{ row_index: number; field?: string; message: string }> }> = [];
    const allErrors: Array<{ row_index: number; field?: string; message: string }> = [];

    for (let i = 0; i < inputRows.length; i++) {
      const row = inputRows[i];
      const idx = i + 1;
      const { valid, errors } = validateRow(entity, row, inputRows, idx);
      validatedRows.push({ ...row, _valid: valid, _errors: errors.length ? errors : undefined });
      if (errors.length) allErrors.push(...errors);
    }

    const validCount = validatedRows.filter((r) => r._valid).length;
    return delay(ok({
      entity,
      columns: schema.columns.map((c) => ({
        key: c.key, label: c.label, required: c.required,
        help: c.help, enum_values: c.enum_values,
      })),
      rows: validatedRows,
      total_rows: inputRows.length,
      valid_rows: validCount,
      error_rows: inputRows.length - validCount,
      errors: allErrors,
    }));
  }

  if (method === "POST" && path === "/imports/commit") {
    const reqBody = (typeof body === "object" && body)
      ? body as { entity?: string; rows?: Array<Record<string, unknown>>; file_name?: string }
      : {};
    const entity = reqBody.entity ?? "";
    const inputRows = Array.isArray(reqBody.rows) ? reqBody.rows : [];
    const schema = IMPORT_SCHEMAS[entity];
    if (!schema) throw fail(400, "INVALID_ENTITY", `Entity "${entity}" not importable`);

    let createdCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row_index: number; field?: string; message: string }> = [];

    for (let i = 0; i < inputRows.length; i++) {
      const row = inputRows[i];
      const idx = i + 1;
      const validation = validateRow(entity, row, inputRows, idx);
      if (!validation.valid) {
        skippedCount += 1;
        errors.push(...validation.errors);
        continue;
      }

      try {
        if (entity === "items") {
          (F.ITEMS as Array<unknown>).push({
            id: F.uid("item"), tenant_id: tid as string,
            item_code: String(row.item_code).trim(),
            name: String(row.name).trim(),
            description: "",
            category_id: null, brand_id: null,
            item_type: "goods",
            base_uom_id: (F.UOMS as Array<{ id: string; code: string }>).find((u) => u.code.toUpperCase() === String(row.base_uom).trim().toUpperCase())?.id ?? "uom-each",
            is_batch_tracked: ["true", "yes"].includes(String(row.is_batch_tracked ?? "").trim().toLowerCase()),
            is_serial_tracked: ["true", "yes"].includes(String(row.is_serial_tracked ?? "").trim().toLowerCase()),
            is_active: true,
            hsn_code: String(row.hsn_code ?? "").trim() || null,
            default_sale_price: String(row.default_sale_price),
            default_tax_rate_pct: String(row.default_tax_rate_pct),
            version: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (entity === "parties") {
          (F.PARTIES as Array<unknown>).push({
            id: F.uid("party"), tenant_id: tid as string,
            code: String(row.code).trim(),
            name: String(row.name).trim(),
            legal_name: String(row.legal_name ?? row.name).trim(),
            tax_id: String(row.gstin ?? "").trim(),
            party_type: String(row.party_type).trim(),
            opening_balance: String(row.opening_balance ?? "0"),
            currency_id: "cur-inr",
            is_gst_registered: !!String(row.gstin ?? "").trim(),
            gstin: String(row.gstin ?? "").trim() || null,
            state_code: String(row.state_code).trim(),
            description: "",
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never);
        } else if (entity === "stock_balances") {
          const item = (F.ITEMS as Array<{ id: string; item_code: string }>).find((it) => it.item_code.toUpperCase() === String(row.item_code).trim().toUpperCase());
          const loc = (F.LOCATIONS as Array<{ id: string; code: string }>).find((l) => l.code.toUpperCase() === String(row.location_code).trim().toUpperCase());
          if (!item || !loc) {
            skippedCount += 1;
            errors.push({ row_index: idx, message: "Item or location went missing between preview and commit" });
            continue;
          }
          const existing = (F.BALANCES as Array<{ item_id: string; location_id: string }>).findIndex(
            (b) => b.item_id === item.id && b.location_id === loc.id,
          );
          const qty = String(row.qty_on_hand);
          const value = (Number(qty) * Number(row.unit_cost)).toFixed(2);
          if (existing >= 0) {
            (F.BALANCES[existing] as { qty_on_hand: string; qty_available: string; value: string }).qty_on_hand = qty;
            (F.BALANCES[existing] as { qty_available: string }).qty_available = qty;
            (F.BALANCES[existing] as { value: string }).value = value;
          } else {
            (F.BALANCES as Array<unknown>).push({
              id: F.uid("bal"), tenant_id: tid as string,
              item_id: item.id, location_id: loc.id,
              bin_id: null, lot_id: null,
              qty_on_hand: qty, qty_reserved: "0", qty_available: qty,
              value, last_movement_id: null,
              version: 0, updated_at: new Date().toISOString(),
            } as never);
          }
        } else if (entity === "opening_balances") {
          // Opening balance entries — write a synthetic ledger row
          // pointing to the party's receivable/payable account.
          const party = (F.PARTIES as Array<{ id: string; code: string }>).find((p) => p.code.toUpperCase() === String(row.party_code).trim().toUpperCase());
          if (!party) { skippedCount += 1; continue; }
          const amt = Number(row.amount);
          const accType = amt >= 0 ? "party_receivable" : "party_payable";
          const acc = (F.FINANCIAL_ACCOUNTS as Array<{ id: string; party_id: string; type: string }>)
            .find((a) => a.party_id === party.id && a.type === accType);
          if (!acc) { skippedCount += 1; continue; }
          F.LEDGER_ENTRIES.push({
            id: F.uid("led"), tenant_id: tid as string,
            account_id: acc.id,
            entry_date: String(row.as_of_date),
            source_doc_type: "opening", source_doc_id: F.uid("op"),
            debit:  amt >= 0 ? Math.abs(amt).toFixed(2) : "0.00",
            credit: amt <  0 ? Math.abs(amt).toFixed(2) : "0.00",
            running_balance: amt.toFixed(2),
            group_id: F.uid("grp"),
            remarks: String(row.remarks ?? "Imported opening balance"),
            created_at: new Date().toISOString(),
          } as never);
        }
        createdCount += 1;
      } catch (e) {
        errors.push({ row_index: idx, message: (e as Error).message ?? "Unknown failure during commit" });
        skippedCount += 1;
      }
    }

    // Append a row to the IMPORTS audit list so the history table updates.
    const importId = F.uid("imp");
    (F.IMPORTS as Array<unknown>).push({
      id: importId, tenant_id: tid as string,
      entity, file_name: reqBody.file_name ?? `${entity}.csv`,
      status: errors.length === 0 ? "completed" : "completed_with_errors",
      total_rows: inputRows.length,
      success_rows: createdCount,
      error_rows: errors.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);

    return delay(ok({
      entity,
      total_rows: inputRows.length,
      created_count: createdCount,
      skipped_count: skippedCount,
      errors,
      import_id: importId,
    }, 201));
  }

  // Period-close — single setting per tenant, stored in tenant_config.
  if (method === "GET" && path === "/period-close") {
    const cfg = (F.TENANT_CONFIG as Array<{ tenant_id: string; key: string; value: unknown }>)
      .find((c) => c.tenant_id === tid && c.key === "period_close");
    const value = (cfg?.value ?? null) as { lock_before_date: string | null; locked_at?: string; locked_by?: string; reason?: string } | null;
    return delay(ok(value ?? { lock_before_date: null }));
  }
  if (method === "PUT" && path === "/period-close") {
    const reqBody = (typeof body === "object" && body)
      ? body as { lock_before_date?: string | null; reason?: string }
      : {};
    const newValue = {
      lock_before_date: reqBody.lock_before_date ?? null,
      locked_at: new Date().toISOString(),
      locked_by: user?.email ?? null,
      reason: reqBody.reason ?? null,
    };
    // Upsert into TENANT_CONFIG.
    const idx = (F.TENANT_CONFIG as Array<{ tenant_id: string; key: string }>)
      .findIndex((c) => c.tenant_id === tid && c.key === "period_close");
    if (idx >= 0) {
      (F.TENANT_CONFIG[idx] as { value: unknown }).value = newValue;
      (F.TENANT_CONFIG[idx] as { updated_at: string }).updated_at = new Date().toISOString();
    } else {
      F.TENANT_CONFIG.push({
        id: F.uid("tc"),
        tenant_id: tid,
        key: "period_close",
        value: newValue,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return delay(ok(newValue));
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

/** Plain-English label for a ledger entry's source doc. Used by the
 *  per-party ledger view so users can read "Invoice INV/2026-04/0002"
 *  instead of just "invoice / inv-2". */
function deriveSourceLabel(entry: { source_doc_type: string; source_doc_id: string }): string {
  const { source_doc_type: t, source_doc_id: id } = entry;
  if (t === "invoice") {
    const inv = (F.INVOICES as Array<{ id: string; invoice_number: string }>).find((x) => x.id === id);
    return inv ? `Invoice ${inv.invoice_number}` : `Invoice (${id})`;
  }
  if (t === "payment") {
    const p = (F.PAYMENTS as Array<{ id: string; payment_number: string; direction: string }>).find((x) => x.id === id);
    if (!p) return `Payment (${id})`;
    return p.direction === "received" ? `Receipt ${p.payment_number}` : `Payment ${p.payment_number}`;
  }
  if (t === "challan") {
    const c = (F.CHALLANS as Array<{ id: string; challan_number: string }>).find((x) => x.id === id);
    return c ? `Challan ${c.challan_number}` : `Challan (${id})`;
  }
  if (t === "vendor_bill") {
    const b = (F.VENDOR_BILLS as Array<{ id: string; bill_number: string }>).find((x) => x.id === id);
    return b ? `Bill ${b.bill_number}` : `Bill (${id})`;
  }
  if (t === "expense") {
    const e = (F.EXPENSES_FX as Array<{ id: string; expense_number: string }>).find((x) => x.id === id);
    return e ? `Expense ${e.expense_number}` : `Expense (${id})`;
  }
  if (t === "salary") {
    const s = (F.SALARY_ENTRIES as Array<{ id: string; salary_number: string }>).find((x) => x.id === id);
    return s ? `Salary ${s.salary_number}` : "Salary debit";
  }
  if (t === "opening")        return "Opening balance";
  if (t === "cheque_deposit") return "Cheque deposit";
  if (t === "manual")         return "Manual journal";
  return t;
}
