# RaniacOne Frontend Reference

> Single source of truth for the Next.js client. Every page, every API
> call, every payload, every response — as seen by the frontend.
>
> **Source of truth for backend:** `raniacone-dev/backend/documents/`
> (README.md, BACKEND.md, USER_FLOW.md, CHANGES.docx). This document is
> the **frontend's interpretation** of that spec — if the two disagree,
> the backend docs win and this file is stale.
>
> **Last aligned with backend:** 2026-04-23 (post auth-service split +
> RS256 JWT + refresh tokens + module subscriptions).

---

## Contents

1. [Architecture](#1-architecture)
2. [Services & base URLs](#2-services--base-urls)
3. [Authentication flow (end-to-end)](#3-authentication-flow-end-to-end)
4. [Token lifecycle & refresh](#4-token-lifecycle--refresh)
5. [Permissions & module subscriptions](#5-permissions--module-subscriptions)
6. [Datetime contract](#6-datetime-contract)
7. [Error handling](#7-error-handling)
8. [Optimistic locking (If-Match)](#8-optimistic-locking-if-match)
9. [Pagination](#9-pagination)
10. [Route map](#10-route-map)
11. [Page catalog](#11-page-catalog) — every screen + every API it hits
12. [Data model (TypeScript)](#12-data-model-typescript)
13. [UI primitives](#13-ui-primitives)
14. [State management](#14-state-management)
15. [Migration from old single-service backend](#15-migration-from-old-single-service-backend)
16. [Endpoint quick reference](#16-endpoint-quick-reference)

---

## 1. Architecture

Next.js 14 (App Router) + TypeScript + Tailwind. Hits **two FastAPI
services** living side-by-side:

```
                      ┌────────────────────────────┐
                      │   Next.js frontend         │
                      │   :3000                    │
                      └──────────┬─────────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            ▼                                         ▼
┌────────────────────────┐                ┌───────────────────────────┐
│  auth service          │                │  inventory service        │
│  :8000/api/v1          │                │  :8001/api/v1             │
│                        │                │                           │
│  /auth/*  users,       │                │  items, parties, stock,   │
│  tenants, currencies,  │                │  documents, counts, lots, │
│  roles, permissions,   │                │  serials, workflows,      │
│  modules, subscriptions│                │  integrations, configs,   │
│                        │                │  ~175 routes              │
└────────────────────────┘                └───────────────────────────┘
```

**Key rules:**
- Frontend talks to **both** services directly with the same access token.
- No `X-Tenant-Id` header — tenant is embedded in the JWT (`tid` claim).
  Super admins may override with `X-Acting-Tenant-Id` on inventory calls.
- JWT is signed RS256. The frontend never verifies it — it just presents
  it.

Repo layout (all paths from `frontend/`):

```
src/
├── app/                     Next.js App Router
│   ├── (platform)/          Tier 1 Super Admin routes
│   ├── (dashboard)/         Tier 2 Client Admin + Tier 3 Employee
│   ├── login/               public
│   └── layout.tsx
├── components/
│   ├── layout/              sidebar, platform-sidebar, topbar
│   └── ui/                  button, badge, dialog, form-elements,
│                            action-menu, shared (KPICard, Pill, etc.)
├── hooks/                   useDebouncedValue, etc.
├── lib/
│   ├── api-client.ts        axios wrapper (auth + inventory clients)
│   ├── api-constants.ts     endpoint URLs
│   ├── query-keys.ts        react-query keys
│   └── utils.ts             cn, formatDate, formatCurrency, …
├── providers/
│   ├── auth-provider.tsx    login/logout, session bootstrap, perms
│   └── query-provider.tsx   TanStack QueryClient
├── services/                one file per domain, thin around api-client
│   ├── auth.service.ts
│   ├── platform.service.ts  currencies + tenants (auth service)
│   ├── rbac.service.ts      users, roles, permissions
│   ├── items.service.ts
│   ├── stock.service.ts
│   ├── documents.service.ts
│   ├── counts.service.ts
│   ├── parties.service.ts
│   ├── locations.service.ts
│   ├── master-data.service.ts
│   ├── workflows.service.ts
│   └── settings.service.ts  tenant/module config, integrations,
│                            webhooks, imports, attachments,
│                            custom fields
├── styles/
└── types/index.ts           TypeScript model of backend schemas
```

---

## 2. Services & base URLs

Set in `.env.local`:

```
NEXT_PUBLIC_AUTH_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_INVENTORY_API_URL=http://localhost:8001/api/v1
```

The api client exposes **two axios instances** — `api.auth` and
`api.inventory` — so services pick the right host per call. Every
request in both goes through the same interceptor that injects the
access token and normalizes errors.

> **Migration note:** the old single `NEXT_PUBLIC_API_URL` is obsolete.
> Until the split lands in code (see §15), treat that as a TODO.

---

## 3. Authentication flow (end-to-end)

```
╔══════ /login page ══════════════════════════════════════════════════╗
║  email + password (no tenant code any more — email is globally      ║
║  unique)                                                            ║
║       │                                                             ║
║       ▼                                                             ║
║  POST :8000/api/v1/auth/login                                       ║
║  { email, password }                                                ║
║       │                                                             ║
║       ▼                                                             ║
║  200 { access_token, refresh_token, user_id, tenant_id | null,      ║
║         is_super_admin, tz, modules: [...], access_expires_in: 900 }║
╚═════════════════════════════════════════════════════════════════════╝
       │
       ▼
Persist { access_token, refresh_token, user_id, tenant_id, tz, modules }
  in localStorage. Decode access_token once to cache perms claim.
       │
       ├── is_super_admin=true  → redirect /platform/overview
       └── is_super_admin=false → redirect /dashboard
```

### Login request

```
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{ "email": "admin@meridian-pharma.com", "password": "Passw0rd!" }
```

### Login response (200)

```json
{
  "access_token":       "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token":      "<jti>.<random-b64>",
  "token_type":         "bearer",
  "access_expires_in":  900,
  "user_id":            "UUID",
  "tenant_id":          "UUID | null",
  "is_super_admin":     false,
  "tz":                 "Asia/Kolkata",
  "modules":            ["inventory"]
}
```

### Login errors

| HTTP | code | UX |
|------|------|----|
| 422 | `INVALID_CREDENTIALS` | Show "Email or password is incorrect." Do NOT distinguish wrong-email from wrong-password (prevents user enumeration). |
| 429 | `RATE_LIMIT_EXCEEDED` | Show countdown from `extra.retry_after_seconds`. |

### `/auth/me`

Page-load bootstrap — refetches the current user:

```
GET :8000/api/v1/auth/me
Authorization: Bearer <access>

→ 200 {
    id, tenant_id, email, full_name, timezone,
    is_active, is_super_admin, last_login_at,
    created_at, updated_at
  }
```

### Register (admin invite flow)

```
POST :8000/api/v1/auth/register
{ "email": "jane@…", "full_name": "…", "password": "…",
  "tenant_code": "meridian-pharma"        // OR "tenant_id": "UUID"
}
→ 201 User
```

Errors: `409 EMAIL_EXISTS`, `404 TENANT_NOT_FOUND`.

### Change password

```
POST :8000/api/v1/auth/change-password
Authorization: Bearer <access>
{ "current_password": "...", "new_password": "..." }
→ 204
```

Revokes every active refresh token for that user. Keep the current
access token until it expires naturally, or prompt re-login.

### Logout

```
POST :8000/api/v1/auth/logout
{ "refresh_token": "..." }
→ 204
```

Revokes only the presented refresh token. Then drop localStorage and
send the user to `/login`.

---

## 4. Token lifecycle & refresh

- **Access token**: ~15 min, RS256. Use on every API call as
  `Authorization: Bearer <access>`.
- **Refresh token**: ~30 days, opaque. Send to `/auth/refresh` to get a
  new pair. **The refresh token is rotated on every use** — old one is
  invalid after.

### Refresh request

```
POST :8000/api/v1/auth/refresh
{ "refresh_token": "..." }
→ 200 <same shape as login>
```

Store the **new** access_token AND the **new** refresh_token, discard
the old.

### Refresh errors

- `401 INVALID_REFRESH_TOKEN` — token unknown, expired, or already
  rotated. Clear everything and send to `/login`.

### Frontend auto-refresh loop

Implemented once in `api-client.ts` response interceptor:

```
on 401 with code == "TOKEN_EXPIRED":
    if already_refreshing: queue and wait
    try: POST /auth/refresh
    success → retry the original request with new access_token
    failure → call authService.logout(); router.push('/login')
```

Single-flight refresh (only one refresh in flight at a time, others
wait for it). Do **not** retry on `INVALID_TOKEN` /
`AUTHENTICATION_REQUIRED` — those mean the token is malformed, not
stale.

---

## 5. Permissions & module subscriptions

### Permission codes are module-prefixed

Old (pre-split): `items.read`, `roles.write`
New: `inventory.items.read`, `auth.roles.write`, `erp.ledger.post` (future)

The frontend stores the set of codes in the auth provider, read from
either:
- The JWT's `perms` claim (fast path), decoded once at login.
- Or `GET /roles/{id}/permissions` per role + `GET /permissions` catalog
  (fallback if JWT doesn't include perms).

Helpers:
```ts
const { hasPermission, hasAnyPermission } = useAuth();

hasPermission("inventory.items.write");     // boolean
hasAnyPermission("inventory.items.write",
                 "inventory.items.read");
```

Super admins bypass all checks (`isSuperAdmin === true`).

### Module subscriptions

Every login response includes `modules: ["inventory", ...]`. Use it to:

1. **Hide sidebar items** whose module isn't subscribed. Only super
   admins see everything.
2. **Gate feature pages** — if the user lands on a page whose module
   isn't in their list, show a "Feature not active for your workspace"
   panel with a CTA to contact the admin.
3. **Catch `403 MODULE_NOT_SUBSCRIBED`** at the API boundary — the
   backend rejects when a service's module code isn't in the JWT `mods`
   claim. Same UX as above.

Live fetch (for a settings page showing current subscription state):

```
GET :8000/api/v1/subscriptions/tenant/{tenant_id}?only_active=true
→ 200 [{ module_code, plan, status, activated_at, expires_at }]
```

---

## 6. Datetime contract

**DB is always UTC. Conversion happens at the API boundary.**

### Sending

Every datetime string sent in a request body **must** have a tz offset
or `Z`. Naive datetimes are rejected with `422 NAIVE_DATETIME_NOT_ALLOWED`.

```
OK:   "2026-04-20T10:30:00+05:30"
OK:   "2026-04-20T00:00:00Z"
BAD:  "2026-04-20T10:30:00"          → 422
```

Frontend helper (TODO / target shape):

```ts
// src/lib/utils.ts
export function toApiDateTime(date: Date): string {
  // Emits an ISO-8601 string with the user's local offset or Z.
  return date.toISOString();              // always UTC + Z — simplest
}
```

### Receiving

Datetimes come back in the viewer's tz (JWT `tz` claim). The frontend
can parse them with `new Date(...)` and render using `formatDate(...)`
in `utils.ts`.

### Plain dates

`document_date`, `posting_date`, `mfg_date`, `expiry_date` are
`YYYY-MM-DD` strings — calendar dates, no time. Render verbatim, don't
`new Date()` them (that will implicitly localise to UTC midnight and
drift across timezones).

---

## 7. Error handling

Every error response has the same shape:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "field_errors": { "email": "already registered" },
  "request_id": "trace-uuid"
}
```

### Codes the frontend handles

| HTTP | Code | UX |
|---|---|---|
| 401 | `AUTHENTICATION_REQUIRED` | Logout, redirect `/login` |
| 401 | `TOKEN_EXPIRED` | Auto-refresh loop; on failure → logout |
| 401 | `INVALID_TOKEN` | Logout immediately |
| 401 | `INVALID_REFRESH_TOKEN` | Logout immediately |
| 403 | `PERMISSION_DENIED` | Hide the action + show "you don't have access" toast |
| 403 | `MODULE_NOT_SUBSCRIBED` | Show "feature not active" panel |
| 404 | `*_NOT_FOUND` | Empty state or 404 page |
| 409 | `EMAIL_EXISTS` / `*_EXISTS` | Inline via `field_errors` |
| 409 | `VERSION_MISMATCH` | "Someone else edited this — reload" + refetch |
| 422 | `VALIDATION_ERROR` | Inline per-field via `field_errors` |
| 422 | `INVALID_CREDENTIALS` | "Email or password is incorrect" |
| 422 | `INSUFFICIENT_STOCK` | "Not enough stock to fulfil" |
| 422 | `NAIVE_DATETIME_NOT_ALLOWED` | Bug on client — fix the sender |
| 428 | `PRECONDITION_REQUIRED` | Reload resource, retry with If-Match |
| 429 | `RATE_LIMIT_EXCEEDED` | Countdown toast from `retry_after_seconds` |

Render `request_id` in the toast footer so ops can correlate with logs.

### Type in TypeScript

```ts
// src/lib/api-client.ts
export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
  requestId: string;
}
export function isApiError(e: unknown): e is ApiError { ... }
```

---

## 8. Optimistic locking (If-Match)

Applied to `items`, `document_headers`, `inventory_balances`.

- Response body includes `version: number`.
- Responses may also include `ETag: "<version>"` header.
- PATCH / post / cancel **require** `If-Match: <version>`.
- Missing header → `428 PRECONDITION_REQUIRED`.
- Version mismatch → `409 VERSION_MISMATCH`.

Frontend pattern:

```ts
// Fetch + cache the version
const { item, etag } = await itemService.getById(id);
// etag === `"3"`

// Edit, then PATCH with If-Match
await itemService.update(id, { name: "New" }, etag);
// → returns new item with version 4, update cache
// → on 409, show toast, refetch, abandon or re-apply edits
```

---

## 9. Pagination

Cursor-based, opaque string. Request:

```
GET /items?limit=50&cursor=<opaque>&sort=-created_at
```

Response:

```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "next_cursor": "eyJjcmVhdGVkX2F0Ijoi…",
    "has_more": true
  }
}
```

Pass `next_cursor` as the next request's `cursor` param. Treat it as a
black box — never parse. Default `limit` 50, max 200.

---

## 10. Route map

### Public
- `/login` — email + password sign-in (no tenant code)

### Tier 1 — Super Admin (`(platform)` group)
- `/platform/overview` — dashboard (tenants, currencies, system health summary)
- `/platform/tenants` — tenant list (S-08)
- `/platform/tenants/[id]` — tenant detail (S-10)
- `/platform/currencies` — currencies (S-06/S-07)
- `/platform/users` — cross-tenant user directory (S-11)
- `/platform/health` — live API + DB status (S-68)

### Tier 2 — Client Admin (`(dashboard)` group)
- `/dashboard` — KPI dashboard (S-42)
- `/items` — item list (S-26)
- `/items/new` — create item (S-27)
- `/items/[id]` — item detail + tabs (S-28…S-33)
- `/items/lots` — tenant-wide lot management (S-48)
- `/items/serials` — tenant-wide serial management (S-49)
- `/locations` — warehouses + zones + bins (S-19, S-20)
- `/parties` — supplier/customer list (S-21)
- `/parties/[id]` — party detail (S-22/S-23)
- `/balances` — stock balances explorer (S-45)
- `/movements` — movement history (S-43/S-44)
- `/movements/transfer` — 4-step transfer wizard (S-50)
- `/valuation` — FIFO valuation layers (S-46)
- `/reservations` — reservation list (S-47)
- `/alerts` — low stock alerts (S-51)
- `/counts` — stock count sessions (S-60)
- `/counts/[id]` — count entry + variance review (S-61–S-63)
- `/documents/[type]` — document list (S-53) — `type` is `purchase-orders`, `sales-orders`, `transfers`, etc.
- `/documents/[type]/new` — document create (S-54)
- `/documents/detail/[id]` — document view/edit/post/cancel (S-55–S-58)
- `/admin/users` — users (S-36)
- `/admin/users/[id]` — user detail + roles (S-37)
- `/admin/roles` — roles (S-34)
- `/admin/roles/[id]` — role detail / permission matrix (S-35)
- `/admin/permissions` — permissions reference (S-38)
- `/account/change-password` — self-serve password change
- `/settings` — hub
  - `/settings/workflows`, `/settings/workflows/[id]` — workflow builder (S-39/S-40)
  - `/settings/custom-fields` — custom field manager (S-41)
  - `/settings/tenant-config` — tenant key/value config (S-24)
  - `/settings/module-config` — module-scoped config (S-25)
  - `/settings/integrations` — integrations (S-64)
  - `/settings/webhooks` — webhooks (S-65)
  - `/settings/imports` — import jobs (S-67)
- `/master-data/{status-master, number-series, uom-categories, uoms, uom-conversions, brands, categories, document-types}` (S-12–S-18, S-52)

### Tier 3 — Employee (subset of Tier 2, gated by permissions)
Same route group. Sidebar items carry a `permission` string and auto-hide
when the user lacks it. Page-level guards use `hasPermission()`.

---

## 11. Page catalog

Every user-facing screen, with its API calls spelled out. API prefix
omitted for brevity; all paths are `http://localhost:8001/api/v1/…`
unless marked **[auth]** (→ `http://localhost:8000/api/v1/…`).

### 11.1 Login `/login`

| Action | API | Request | Response |
|---|---|---|---|
| Sign in | **[auth]** `POST /auth/login` | `{email, password}` | `{access_token, refresh_token, user_id, tenant_id?, is_super_admin, tz, modules, access_expires_in}` |
| Bootstrap user after login | **[auth]** `GET /auth/me` | — | `User` |

On success: store tokens, redirect based on `is_super_admin`.

### 11.2 Platform Overview `/platform/overview`

| Card | API | Purpose |
|---|---|---|
| Tenant count / recent tenants | **[auth]** `GET /tenants?limit=200` | Grid + recent table |
| Currency count | **[auth]** `GET /currencies?limit=200` | KPI |
| System health | **[inv]** `GET /health` | Green/red banner |

### 11.3 Tenants `/platform/tenants`

| Action | API | Payload |
|---|---|---|
| List | **[auth]** `GET /tenants?limit=200&status={active\|trialing\|suspended}` | — |
| Create | **[auth]** `POST /tenants` | `{name, code, base_currency_id, timezone, plan, status}` |
| Update | **[auth]** `PATCH /tenants/{id}` | partial |
| Delete | **[auth]** `DELETE /tenants/{id}` | — |

### 11.4 Tenant Detail `/platform/tenants/[id]`

| Action | API | Payload |
|---|---|---|
| Get | **[auth]** `GET /tenants/{id}` | — |
| List users in tenant | **[auth]** `GET /users` with `X-Acting-Tenant-Id: {id}` | super-admin override |
| Register first admin | **[auth]** `POST /auth/register` | `{email, full_name, password, tenant_id: {id}}` |
| Create/grant role | **[auth]** `POST /roles`, `POST /roles/{id}/permissions`, `POST /users/{uid}/roles` | see §11.18 |
| Subscribe to a module | **[auth]** `POST /subscriptions/tenant/{id}` | `{module_code, plan, expires_at?}` |

### 11.5 Currencies `/platform/currencies`

| Action | API | Payload |
|---|---|---|
| List | **[auth]** `GET /currencies?limit=200` | — |
| Create | **[auth]** `POST /currencies` | `{code, name, symbol, decimal_precision}` |
| Update | **[auth]** `PATCH /currencies/{id}` | partial |
| Delete | **[auth]** `DELETE /currencies/{id}` | — |

### 11.6 Platform Users `/platform/users`

Fans out `GET /users` once per tenant with `X-Acting-Tenant-Id` to build
a cross-tenant directory.

| Action | API | Payload |
|---|---|---|
| List per tenant | **[auth]** `GET /users` with `X-Acting-Tenant-Id: <tid>` | — |
| Invite Super Admin | **[auth]** `POST /auth/register` | no tenant — creates global super admin (if permitted) |
| Invite tenant admin | **[auth]** `POST /auth/register` | `{email, full_name, password, tenant_id}` or `tenant_code` |
| Remove | **[auth]** `DELETE /users/{id}` with `X-Acting-Tenant-Id` | — |

### 11.7 System Health `/platform/health`

Polls every 15s, draws latency sparkline.

| API | Response |
|---|---|
| **[inv]** `GET /health` | `{status: "ok", database: "ok", ...}` |
| **[auth]** `GET /tenants?limit=200` | for footprint stats |

### 11.8 Dashboard `/dashboard`

KPI cards + recent lists. Reads:

- `GET /balances?only_nonzero=true&limit=100` — for stock value summary
- `GET /movements?limit=20` — recent movements
- `GET /documents?limit=10` — recent docs
- `GET /items?is_active=true&limit=100` with a client-side fold over
  reorder policies to detect low stock

### 11.9 Items list `/items`

| Action | API | Notes |
|---|---|---|
| List | `GET /items?limit=50&cursor=…&category_id=…&brand_id=…&is_active=…&search=…` | cursor pagination |
| Delete | `DELETE /items/{id}` | — |

Row action menu: View, Edit, Delete.

### 11.10 Item create / detail `/items/new`, `/items/[id]`

Detail page is tabbed: General / Identifiers / Variants / UoMs /
Lots / Serials / Reorder Policies / Stock / Custom Fields /
Attachments.

| Action | API | Payload |
|---|---|---|
| Get | `GET /items/{id}` | returns `{item, etag}` |
| Create | `POST /items` | `{item_code, name, description?, category_id?, brand_id?, item_type, base_uom_id?, is_batch_tracked?, is_serial_tracked?, is_active?}` |
| Update | `PATCH /items/{id}` + `If-Match: {version}` | partial |
| Delete | `DELETE /items/{id}` | — |
| List identifiers | `GET /items/{id}/identifiers` | — |
| Add identifier | `POST /items/{id}/identifiers` | `{identifier_type, identifier_value}` |
| List variants | `GET /items/{id}/variants` | — |
| Add variant | `POST /items/{id}/variants` | `{variant_code, name}` |
| List UoMs | `GET /items/{id}/uoms` | — |
| Add UoM | `POST /items/{id}/uoms` | `{uom_id, conversion_factor, is_purchase?, is_sales?}` |
| List lots | `GET /items/{id}/lots?expiring_before=…` | — |
| Add lot | `POST /items/{id}/lots` | `{lot_number, mfg_date?, expiry_date?, received_qty}` |
| List serials | `GET /items/{id}/serials` | — |
| Add serial | `POST /items/{id}/serials` | `{serial_number, status?, lot_id?}` |
| List reorder policies | `GET /items/{id}/reorder-policies` | — |
| Add reorder policy | `POST /items/{id}/reorder-policies` | `{location_id, min_qty, max_qty?, reorder_point?, reorder_qty?}` |
| Stock for item | `GET /balances?item_id={id}` | shown on Stock tab |

### 11.11 Lots tenant-wide `/items/lots`

Fans out `GET /items/{id}/lots` for every batch-tracked item, then
filters locally by expiry window. Uses `POST /items/{id}/lots` from the
add-lot modal.

### 11.12 Serials tenant-wide `/items/serials`

Fans out `GET /items/{id}/serials`. Add via `POST /items/{id}/serials`.

### 11.13 Locations `/locations`

Tree view (warehouse → zone → bin). Bins are nested under locations.

| Action | API | Payload |
|---|---|---|
| List top-level | `GET /inventory-locations?parent_id=` (empty) | — |
| List children | `GET /inventory-locations?parent_id={id}` | — |
| Create | `POST /inventory-locations` | `{code, name, location_type, parent_id?, is_active?}` |
| Update | `PATCH /inventory-locations/{id}` | partial |
| Delete | `DELETE /inventory-locations/{id}` | — |
| List bins | `GET /inventory-locations/{id}/bins` | — |
| Create bin | `POST /inventory-locations/{id}/bins` | `{code, name, is_active?}` |

### 11.14 Parties `/parties`, `/parties/[id]`

| Action | API | Payload |
|---|---|---|
| List | `GET /parties?limit=200&party_type={supplier\|customer\|both}` | — |
| Get | `GET /parties/{id}` | — |
| Create | `POST /parties` | `{code, name, legal_name?, tax_id?, party_type, opening_balance?, currency_id?, is_active?}` |
| Update | `PATCH /parties/{id}` | partial |
| Delete | `DELETE /parties/{id}` | — |
| List addresses | `GET /parties/{id}/addresses` | — |
| Add address | `POST /parties/{id}/addresses` | `{label, line1, line2?, city, state?, country, postal_code?, …}` |
| Update address | `PATCH /parties/{id}/addresses/{aid}` | partial |
| List contacts | `GET /parties/{id}/contacts` | — |
| Add contact | `POST /parties/{id}/contacts` | `{name, email?, phone?, role?}` |

### 11.15 Stock balances `/balances`

| Action | API |
|---|---|
| List | `GET /balances?limit=200&item_id=…&location_id=…&lot_id=…&bin_id=…&only_nonzero=true` |
| Get one | `GET /balances/{id}` |

### 11.16 Movements `/movements`

| Action | API | Payload |
|---|---|---|
| List | `GET /movements?limit=200&item_id=…&location_id=…&direction={in\|out}&start_date=…&end_date=…` | cursor pagination |
| Get | `GET /movements/{id}` | — |
| Post IN/OUT | `POST /movements` | `{item_id, location_id, direction, quantity, uom_id, unit_cost?, posting_date?, bin_id?, lot_id?, serial_id?, reference_movement_id?, source?, document_id?}` |
| Post transfer | `POST /movements` | `{item_id, location_id, destination_location_id, direction: "transfer", quantity, uom_id, posting_date?}` → `{out_movement, in_movement}` |

### 11.17 Stock transfer wizard `/movements/transfer`

4 steps: Locations → Meta → Lines → Review. On submit, posts one
`POST /movements {direction: "transfer"}` per line.

### 11.18 Admin / RBAC

#### `/admin/users`

| Action | API | Payload |
|---|---|---|
| List | **[auth]** `GET /users?limit=100` | — |
| Get | **[auth]** `GET /users/{id}` | — |
| Create (invite) | **[auth]** `POST /auth/register` | `{email, full_name, password, tenant_id}` |
| Update | **[auth]** `PATCH /users/{id}` | partial |
| Delete | **[auth]** `DELETE /users/{id}` | — |
| List user's roles | **[auth]** `GET /users/{id}/roles` | — |
| Assign role | **[auth]** `POST /users/{id}/roles` | `{role_id}` |
| Unassign role | **[auth]** `DELETE /users/{id}/roles/{role_id}` | — |

#### `/admin/roles`, `/admin/roles/[id]`

| Action | API | Payload |
|---|---|---|
| List | **[auth]** `GET /roles` | — |
| Get | **[auth]** `GET /roles/{id}` | — |
| Create | **[auth]** `POST /roles` | `{code, name, is_system?}` |
| Update | **[auth]** `PATCH /roles/{id}` | `{name?}` |
| Delete | **[auth]** `DELETE /roles/{id}` | — |
| List role's permissions | **[auth]** `GET /roles/{id}/permissions` | — |
| Grant permission | **[auth]** `POST /roles/{id}/permissions` | `{permission_id}` |
| Revoke permission | **[auth]** `DELETE /roles/{id}/permissions/{perm_id}` | — |

#### `/admin/permissions`

Read-only grid of the catalog.

| API | Response |
|---|---|
| **[auth]** `GET /permissions?module=inventory` | `[{id, code, name, module}]` |

### 11.19 Documents `/documents/[type]`, `/documents/[type]/new`, `/documents/detail/[id]`

`[type]` is `purchase-orders`, `sales-orders`, `transfers`, etc. —
maps to a `document_type_id` fetched from `GET /document-types`.

| Action | API | Payload |
|---|---|---|
| List | `GET /documents?document_type_id=…&status_id=…&limit=50` | — |
| Get | `GET /documents/{id}` | returns `{document, etag}` |
| Create header | `POST /documents` | `{document_type_id, document_number, document_date, posting_date?, party_id?, source_location_id?, destination_location_id?, currency_id?, exchange_rate?, status_id?, remarks?}` |
| Update header | `PATCH /documents/{id}` + `If-Match` | partial |
| Add line | `POST /documents/{id}/lines` | `{line_number, item_id, uom_id, quantity, unit_price, discount_pct?, tax_amount?, lot_id?, serial_id?, bin_id?, remarks?}` |
| Update line | `PATCH /documents/{id}/lines/{lid}` | partial |
| Delete line | `DELETE /documents/{id}/lines/{lid}` | — |
| Post | `POST /documents/{id}/post` + `If-Match` | → creates movements, layers, balance updates |
| Cancel | `POST /documents/{id}/cancel` + `If-Match` | → reversal movements |

### 11.20 Counts `/counts`, `/counts/[id]`

| Action | API | Payload |
|---|---|---|
| List | `GET /counts?limit=100` | — |
| Get | `GET /counts/{id}` | — |
| Create | `POST /counts` | `{count_number, count_date, location_id, remarks?}` |
| Add line | `POST /counts/{id}/lines` | `{item_id, lot_id?, bin_id?}` → system_qty snapshotted |
| Update line | `PATCH /counts/{id}/lines/{lid}` | `{counted_qty}` → variance auto-computed |
| Apply | `POST /counts/{id}/apply` | creates adjustment movements |

### 11.21 Reservations `/reservations`

| Action | API | Payload |
|---|---|---|
| List | `GET /reservations?limit=200&item_id=…&location_id=…&status=…` | — |
| Create | `POST /reservations` | `{item_id, location_id, quantity, lot_id?, reference_doc_id?, reference_doc_line_id?, remarks?}` |
| Update | `PATCH /reservations/{id}` | `{status: "fulfilled" \| "cancelled"}` |
| Cancel | `DELETE /reservations/{id}` | — |

### 11.22 Valuation `/valuation`

Read-only.

| API | Params |
|---|---|
| `GET /valuation-layers` | `limit`, `cursor`, `item_id`, `location_id`, `only_active` |

### 11.23 Low stock alerts `/alerts`

Fans out `GET /items/{id}/reorder-policies` for each active item,
joins against `GET /balances?limit=1000`, computes shortfalls client-side.

### 11.24 Master data pages

All follow the list + create + inline-edit + delete pattern. Paths:

| Page | API root |
|---|---|
| `/master-data/status-master` | `/status-master` |
| `/master-data/number-series` | `/number-series` — plus `/number-series/{id}/peek`, `POST /number-series/{id}/allocate` |
| `/master-data/uom-categories` | `/uom-categories` |
| `/master-data/uoms` | `/uoms` |
| `/master-data/uom-conversions` | `/uom-conversions` |
| `/master-data/brands` | `/item-brands` |
| `/master-data/categories` | `/item-categories` (tree — parent_id) |
| `/master-data/document-types` | `/document-types` |

All CRUD uses `GET`, `POST`, `PATCH`, `DELETE` with the obvious shapes.

### 11.25 Settings sub-pages

#### `/settings/workflows`, `/settings/workflows/[id]`

| Action | API | Payload |
|---|---|---|
| List | `GET /workflows` | — |
| Get | `GET /workflows/{id}` | — |
| Create | `POST /workflows` | `{code, name, entity}` |
| Update | `PATCH /workflows/{id}` | partial |
| Delete | `DELETE /workflows/{id}` | — |
| List states | `GET /workflows/{id}/states` | — |
| Add state | `POST /workflows/{id}/states` | `{code, name, is_initial?, is_terminal?}` |
| Update state | `PATCH /workflows/{id}/states/{sid}` | partial |
| Add transition | `POST /workflows/{id}/transitions` | `{from_state_id, to_state_id, code, name}` |
| Delete transition | `DELETE /workflows/{id}/transitions/{tid}` | — |

#### `/settings/custom-fields`

| Action | API | Payload |
|---|---|---|
| List defs | `GET /custom-field-definitions?entity=…` | — |
| Create def | `POST /custom-field-definitions` | `{entity, code, label, field_type, options?, validation?, is_required?, sort_order?}` |
| Update def | `PATCH /custom-field-definitions/{id}` | partial |
| Delete def | `DELETE /custom-field-definitions/{id}` | — |
| Set value | `PUT /custom-fields/{entity}/{entity_id}/values` | `{field_definition_id, value}` |
| Delete value | `DELETE /custom-fields/{entity}/{entity_id}/values/{def_id}` | — |

#### `/settings/tenant-config`

**PUT-as-upsert**, not POST.

| Action | API | Payload |
|---|---|---|
| List | `GET /tenant-config?limit=200` | — |
| Get | `GET /tenant-config/{key}` | — |
| Upsert | `PUT /tenant-config/{key}` | `{value: <any JSON>}` |
| Delete | `DELETE /tenant-config/{key}` | — |

#### `/settings/module-config`

| Action | API | Payload |
|---|---|---|
| List | `GET /module-config?module=inventory` | — |
| Upsert | `PUT /module-config/{module}/{key}` | `{value}` |
| Delete | `DELETE /module-config/{module}/{key}` | — |

#### `/settings/integrations`, `/settings/webhooks`, `/settings/imports`

All standard CRUD on `/integrations`, `/webhooks`, `/imports`.

### 11.26 Change password `/account/change-password`

`POST /auth/change-password` on the **auth service**. See §3.

---

## 12. Data model (TypeScript)

Trimmed excerpts; full definitions in `src/types/index.ts`.

```ts
// Auth
interface LoginRequest  { email: string; password: string; }
interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  access_expires_in: number;      // seconds
  user_id: string;
  tenant_id: string | null;       // null for super admins
  is_super_admin: boolean;
  tz: string;                     // IANA tz, e.g. "Asia/Kolkata"
  modules: string[];              // subscribed module codes
}
interface RegisterRequest {
  email: string; full_name: string; password: string;
  tenant_code?: string; tenant_id?: string;   // one or the other
}

// Common
interface ErrorResponse {
  code: string; message: string;
  field_errors: Record<string, string>;
  request_id: string;
}
interface PaginationMeta {
  limit: number; next_cursor: string | null; has_more: boolean;
}
interface PaginatedResponse<T> {
  data: T[]; pagination: PaginationMeta;
}

// Domain (excerpt — see types/index.ts for all)
interface User     { id, tenant_id, email, full_name, timezone?,
                     is_active, is_super_admin, last_login_at?, ... }
interface Tenant   { id, name, code, status, base_currency_id,
                     timezone, plan, ... }
interface Currency { id, code, name, symbol, decimal_precision, ... }
interface Item     { id, tenant_id, item_code, name, description?,
                     category_id?, brand_id?, item_type, base_uom_id?,
                     is_batch_tracked, is_serial_tracked, is_active,
                     status_id?, version, ... }
interface Movement { id, tenant_id, document_id?, item_id, location_id,
                     direction: "in" | "out", quantity, uom_id,
                     base_quantity, unit_cost, total_cost,
                     posting_date, reference_movement_id?, ... }
interface DocumentHeader { id, document_type_id, document_number,
                           document_date, posting_date?, party_id?,
                           source_location_id?, destination_location_id?,
                           currency_id?, exchange_rate, status_id?,
                           remarks?, version, ... }
// Balances, Reservations, Lots, Serials, Party, Role, Permission,
// StatusMaster, NumberSeries — see types/index.ts.

// Client-side session state
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenantId: string | null;
  tenantName: string | null;
  isSuperAdmin: boolean;
  permissions: Set<string>;       // module-prefixed codes
  modules: string[];              // from JWT.mods
  tz: string;
}
```

---

## 13. UI primitives

Located in `src/components/ui/`:

| File | Exports |
|---|---|
| `button.tsx` | `Button` — kind = primary\|secondary\|ghost\|danger\|success\|dark |
| `badge.tsx` | `Badge`, `StatusBadge` — tones = gray\|green\|red\|amber\|blue\|neutral |
| `shared.tsx` | `Avatar`, `Pill`, `FilterChip`, `KPICard`, `EmptyState`, `Spinner`, `PageLoading` |
| `dialog.tsx` | `Dialog`, `ConfirmDialog` |
| `form-elements.tsx` | `Input`, `FormField`, `Checkbox`, `Select` |
| `toast.tsx` | `useToast()` hook |
| `action-menu.tsx` | `ActionMenu` — portaled Radix dropdown for table row actions |

Layout chrome in `src/components/layout/`:
- `sidebar.tsx` — client admin sidebar (NAVIGATION array drives it)
- `platform-sidebar.tsx` — super admin sidebar
- `topbar.tsx` — breadcrumbs + tenant + avatar menu

---

## 14. State management

- **Server state**: TanStack Query. Query keys centralized in
  `src/lib/query-keys.ts`. Every list/detail read is a `useQuery`;
  mutations use `useMutation` + `queryClient.invalidateQueries`.
- **Auth / session state**: `AuthProvider` (React context), hydrated
  on mount by decoding the JWT + fetching `/auth/me`.
- **Form state**: react-hook-form + Zod schemas (per page).
- **Transient UI state**: `useState` local to each component.

---

## 15. Migration from old single-service backend

The frontend in this repo was built against a single FastAPI monolith
on `:8001`. The 2026-04-23 backend rewrite split it into auth (:8000)
+ inventory (:8001). Below is the gap list between what the frontend
does today and what it **must** do to align. Each item is its own unit
of work.

### 15.1 Dual base URLs
- `src/lib/api-constants.ts` — add `AUTH_API_URL` + `INVENTORY_API_URL`
  env vars.
- `src/lib/api-client.ts` — create **two** axios instances and export
  `api.auth` and `api.inventory`. Keep the current `api.*` methods as a
  compatibility layer (inventory default) during transition.
- Every service file picks the correct host:
  - **auth service**: `auth.service.ts`, `platform.service.ts`,
    `rbac.service.ts` (all except `user.update/delete` that remain on
    the user API, which lives in auth).
  - **inventory service**: everything else.

### 15.2 Drop tenant_code from login
- `src/app/login/page.tsx` — remove the "Workspace Code" field; form
  becomes email + password only.
- `src/services/auth.service.ts` — `LoginRequest` loses `tenant_code`.
- `src/providers/auth-provider.tsx.login()` — no more `tenantName`
  fallback from workspace code; derive display name from
  `loginResponse.tenant_id` → `GET /tenants/{id}` for super admins, or
  from `user.tenant` embed.

### 15.3 Remove `X-Tenant-Id` header injection
- `src/lib/api-client.ts` interceptor — drop the block that sets
  `X-Tenant-Id` from localStorage. Tenant is in the JWT.
- Keep a helper for **super admin override**: callers who want to act
  on another tenant pass `{ "X-Acting-Tenant-Id": tenantId }` in the
  headers arg (only on inventory service calls; auth calls are already
  tenant-agnostic).
- `rbac.service.ts.userService.listByTenant` — rename arg-header to
  `X-Acting-Tenant-Id`.

### 15.4 Add refresh token flow
- `authService.login()` stores `refresh_token` alongside `access_token`.
- `api-client.ts` response interceptor: on 401 `TOKEN_EXPIRED`,
  single-flight refresh via `POST /auth/refresh`; retry once; on
  failure, logout.
- `authService.logout()` posts `/auth/logout` before clearing
  localStorage (best-effort; don't await).

### 15.5 JWT decode → permissions cache
- On login, decode the access token's payload (no signature check
  client-side) and extract `perms`, `mods`, `tz`, `sa`. Cache in
  AuthState. This removes the N+1 permission-fetch loop in
  `buildUserPermissions()`.

### 15.6 Module-prefixed permissions
- Any hardcoded `hasPermission("items.read")` becomes
  `hasPermission("inventory.items.read")`. Same for roles, tenants,
  users — prefix with `auth.` or `inventory.` as appropriate.
- Sidebar items with a `permission` prop update to the new codes.

### 15.7 Datetime inputs must carry TZ offsets
- Add `toApiDateTime(date: Date): string` helper in `utils.ts`.
- Every form that sends a datetime uses it. Audit `posting_date`
  inputs in document create, transfer wizard, stock count.

### 15.8 Health page key alignment
- `src/app/(platform)/platform/health/page.tsx` — the backend now
  returns `database` (per shared HealthResponse). The current code
  already falls through either `database` or `db`; simplify to just
  `database` once confirmed.

### 15.9 Module-subscription UX
- Login response includes `modules`. Sidebar filters nav items whose
  module isn't subscribed (non-super admins).
- 403 `MODULE_NOT_SUBSCRIBED` handler in api-client — navigate to a
  "Feature not active" page.

### 15.10 Routes moved to auth service
All these endpoints have moved from `:8001` to `:8000` — update
services:
- `POST /auth/register`, `POST /auth/login`, `POST /auth/change-password`
- `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` (new)
- All of `/users`, `/tenants`, `/currencies`, `/roles`, `/permissions`,
  `/users/{id}/roles`
- New: `/modules`, `/subscriptions/tenant/{tenant_id}`

The inventory service no longer serves any of these — calls there will
404.

---

## 16. Endpoint quick reference

### Auth service (`:8000/api/v1`)

```
POST   /auth/register                       create user under a tenant
POST   /auth/login                          email + password → tokens
POST   /auth/refresh                        rotate refresh token
POST   /auth/logout                         revoke refresh token
POST   /auth/change-password                revokes all refresh tokens
GET    /auth/me                             current user

       /users                               CRUD
       /users/{id}/roles                    list + assign + unassign

       /tenants                             CRUD
       /currencies                          CRUD

GET    /permissions?module=…                catalog
       /roles                               CRUD
       /roles/{id}/permissions              grant + revoke

GET    /modules                             module catalog
       /subscriptions/tenant/{tenant_id}    list + subscribe (POST)
DELETE /subscriptions/{id}                  unsubscribe

GET    /health
```

### Inventory service (`:8001/api/v1`)

```
/items                             CRUD + is_active filter
/items/{id}/identifiers             nested CRUD
/items/{id}/variants                nested CRUD
/items/{id}/uoms                    nested CRUD
/items/{id}/reorder-policies        nested CRUD
/items/{id}/lots                    POST + GET list
/items/{id}/serials                 POST + GET list
/lots/{id}                          read-only tenant-wide
/serials/{id}                       read-only tenant-wide

/item-brands                        CRUD
/item-categories                    CRUD (tree via parent_id)

/uom-categories                     CRUD
/uoms                               CRUD
/uom-conversions                    CRUD

/status-master                      CRUD
/number-series                      CRUD
/number-series/{id}/peek            GET — next number without alloc
/number-series/{id}/allocate        POST — bumps current_value

/parties                            CRUD
/parties/{id}/addresses             nested CRUD
/parties/{id}/contacts              nested CRUD

/inventory-locations                CRUD (tree via parent_id)
/inventory-locations/{id}/bins      nested CRUD

/documents                          list + create + get + patch + delete
/documents/{id}/lines               CRUD
/documents/{id}/post                + If-Match
/documents/{id}/cancel              + If-Match
/document-types                     CRUD

/movements                          list + get + create (in/out/transfer)
/balances                           read-only
/valuation-layers                   read-only
/reservations                       CRUD + PATCH status

/counts                             create + list + get
/counts/{id}/lines                  add + patch
/counts/{id}/apply                  POST — creates adjustments

/tenant-config                      list
/tenant-config/{key}                GET / PUT / DELETE  (upsert by key)
/module-config?module=…             list
/module-config/{module}/{key}       PUT / DELETE

/workflows                          CRUD
/workflows/{id}/states              CRUD
/workflows/{id}/transitions         CRUD

/custom-field-definitions           CRUD
/custom-fields/{entity}/{entity_id}/values   PUT / DELETE

/integrations                       CRUD
/webhooks                           CRUD
/attachments                        POST + GET /{id}
/imports                            POST + GET /{id}

/health
```

Always-current source: Swagger at `http://localhost:8000/docs` and
`http://localhost:8001/docs`.
