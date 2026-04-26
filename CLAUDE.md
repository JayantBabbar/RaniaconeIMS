# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from `frontend/`:

- `npm run dev` — Next.js dev server on :3000
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — `next lint` (ESLint, `next/core-web-vitals` config)
- `npm test` — Vitest, single run
- `npm run test:watch` / `npm run test:ui` — interactive
- `npm run test:coverage` — coverage run
- Run a single test: `npx vitest run path/to/file.test.ts` or filter by name with `-t "test name"`

There is no separate type-check script; rely on `next build` or invoke `npx tsc --noEmit` directly.

## Environment

`.env.local` keys (see `.env.demo.example`):

- `NEXT_PUBLIC_AUTH_API_URL` — auth service base, default `http://localhost:8000/api/v1`
- `NEXT_PUBLIC_INVENTORY_API_URL` — inventory service base, default `http://localhost:8001/api/v1`
- `NEXT_PUBLIC_DEMO_MODE=true` — swap axios HTTP adapter for `src/lib/demo/adapter.ts` (in-memory fixtures from `src/lib/demo/fixtures.ts`). Login uses fixed accounts (`admin@demo.com / demo123`, etc. — see `Resources/DEMO_USERS.md`). Mutations live in browser memory and reset on reload.

## Architecture

### Dual-service backend

The frontend talks to **two FastAPI services** with the same access token:

- **auth service** (`:8000`) — `/auth/*`, users, tenants, roles, permissions, currencies, modules, subscriptions
- **inventory service** (`:8001`) — items, parties, stock, documents, counts, lots, serials, workflows, integrations, configs (~175 routes)

`src/lib/api-client.ts` exports `api.auth` and `api.inventory` (`ServiceClient` instances around two axios clients). The flat `api.get/post/...` shim routes to inventory and is back-compat only — **new code should call `api.auth.*` / `api.inventory.*` explicitly**.

Endpoint URL constants live in `src/lib/api-constants.ts`. Domain services in `src/services/*.ts` are thin wrappers around the api client; pages use them via React Query, never call axios directly.

### Three-tier audience, two App Router groups

- `src/app/(platform)/...` — Tier 1 super admin (`isSuperAdmin === true`, `tenant_id === null`). Lands at `/platform/overview`. Layout redirects non-super-admins to `/dashboard`.
- `src/app/(dashboard)/...` — Tier 2 tenant admin + Tier 3 employee. Lands at `/dashboard`. Layout redirects super admins to `/platform/overview`.
- `src/app/login/`, `src/app/layout.tsx` — public + root.

Both group layouts gate on `useAuth()` and render their own sidebar (`Sidebar` vs `PlatformSidebar`). Super admins acting inside a tenant send an `X-Acting-Tenant-Id` header on inventory calls — handled at the service layer.

### Auth, tokens, refresh

`src/providers/auth-provider.tsx` is the session hub. On mount it decodes the stored access token's claims (`tid`, `sa`, `tz`, `mods`, `perms`) to seed state, then fetches `/auth/me`.

`api-client.ts` implements:

- **Single-flight refresh** — request interceptor proactively refreshes the access token if `exp` is within 30 s; response interceptor refreshes once on `401 TOKEN_EXPIRED` and retries the original request. Concurrent callers await the same in-flight promise. Refresh tokens **rotate on every use** — store the new pair, discard the old.
- **Hard auth failures** (`AUTHENTICATION_REQUIRED`, `INVALID_TOKEN`, `INVALID_REFRESH_TOKEN`, or a second 401 after retry) clear all auth localStorage and `window.location.href = "/login"`.
- **`limit` clamp** — list-endpoint `limit` param is clamped to ≤200 in the request interceptor (backend rejects above that with 422).
- **Network errors** (`status === 0`) surface a global toast via `src/lib/toast-emitter.ts`, which is decoupled from React so the api-client can fire toasts without circular deps.
- **Demo mode** swaps `instance.defaults.adapter = demoAdapter` so interceptors, error normalisation, and refresh all run unchanged behind in-memory fixtures.

### RBAC

Permission codes follow `<module>.<resource>.<action>` (e.g. `inventory.items.write`, `auth.users.read`). The full set lives in the JWT `perms` claim and in `useAuth()` as a `Set<string>`. Super admins bypass all checks.

Gate UI with the `<Can perm="..." />` / `<Can anyOf={[...]} />` component (`src/components/ui/can.tsx`), or the `useCan()` hook for non-JSX cases (e.g. building action-menu item arrays). Don't reimplement permission checks — always go through `useAuth.hasPermission` / `hasAnyPermission`.

Module subscriptions (`mods` claim) gate at the sidebar/page level; backend returns `403 MODULE_NOT_SUBSCRIBED` if a module isn't active for the tenant.

### Server state, forms, tables

- **React Query v5** for server state. Query keys live in `src/lib/query-keys.ts` — use the factory, don't inline keys.
- **react-hook-form + zod** for forms (`@hookform/resolvers`).
- **Tables** use `useTableFilters` (`src/hooks/useTableFilters.ts`) plus the `table-toolkit` components (search, sort, column filters, active-filter bar) — there's no shared TanStack Table abstraction, each list page composes the toolkit directly.

### Optimistic locking (If-Match)

Items, document headers, and inventory balances return a `version` field and an `ETag` header. PATCH / post / cancel **must** send `If-Match: <version>`. Use `client.patchWithEtag(url, data, etag)`. Missing → `428 PRECONDITION_REQUIRED`; mismatch → `409 VERSION_MISMATCH` (UX: toast + refetch).

### Error shape

Every API error normalises to `ApiError { status, code, message, fieldErrors, requestId, retryAfterSeconds? }`. Use `isApiError(e)` to narrow. Specific codes the UI handles: `INVALID_CREDENTIALS`, `INSUFFICIENT_STOCK`, `VERSION_MISMATCH`, `MODULE_NOT_SUBSCRIBED`, `RATE_LIMIT_EXCEEDED` (countdown via `retryAfterSeconds`), `NAIVE_DATETIME_NOT_ALLOWED`. For full list see `Resources/FRONTEND.md` §7.

### Datetime contract

Backend rejects naive datetimes — every datetime sent in a request body must include `Z` or a tz offset. Plain calendar dates (`document_date`, `posting_date`, `mfg_date`, `expiry_date`) are `YYYY-MM-DD` strings; render verbatim, **don't** `new Date()` them or they'll drift across timezones.

### Pagination

Cursor-based, opaque string. Treat `next_cursor` as a black box. Default `limit` 50, max 200 (clamped in the api client).

### Path alias

`@/*` → `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Testing

Vitest + jsdom + Testing Library + MSW (`src/test/setup.ts`, `src/test/msw.ts`).

- MSW runs with `onUnhandledRequest: "error"` — every request a test makes must have a handler. Add scenario-specific handlers via `server.use(...)` in the test.
- `src/test/render-helpers.tsx` provides `renderWithProviders` (wraps in a fresh `QueryClient`) and `buildUseAuthReturn({ permissions, isSuperAdmin, ... })` for stubbing `useAuth`. Tests typically `vi.mock("@/providers/auth-provider", ...)` at the top of the file and pass `buildUseAuthReturn(...)` into the mock.
- `makeAccessToken({...})` in `src/test/msw.ts` builds a base64url JWT with custom claims for token-flow tests.
- Coverage excludes `src/app/**/*.tsx` (page layouts are covered as integration); pure logic in `src/lib`, `src/hooks`, `src/services` is the unit-test target.

## Conventions

- Don't add a third axios instance, a third tenant tier, or another global state store; this app is intentionally just `useAuth` + React Query.
- Don't mutate `qty_on_hand`/`qty_reserved` directly — those flow from posted movements and document state machines on the backend.
- Movements and posted documents are **immutable** on the backend; never expose edit/delete UI for them.
- Brand-specific names/logos/support email come from `useBranding()` (`src/providers/branding-provider.tsx`, defaults in `src/config/branding.ts`) — don't hardcode "Raniacone".
- Theme tokens live in `src/styles/theme.css` (CSS vars) and are wired through Tailwind in `tailwind.config.ts`. Use semantic tokens, not raw hex.

## Reference docs

`Resources/` contains the long-form spec — read these when changing cross-cutting behavior:

- `FRONTEND.md` — full FE↔backend contract, every endpoint, every screen
- `APPLICATION_OVERVIEW.md` — product/domain explainer
- `USER_MANUAL.md`, `USER_FLOW.md`, `WORKFLOW_*.md` — per-role flows
- `DEMO_USERS.md` — demo-mode credentials

Backend source of truth lives outside this repo at `raniacone-dev/backend/documents/`. If `FRONTEND.md` and the backend docs disagree, backend wins.
