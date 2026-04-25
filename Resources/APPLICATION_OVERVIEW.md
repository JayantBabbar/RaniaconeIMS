# Raniacone Warehouse — Application Overview

A complete, feature-by-feature description of the Raniacone Inventory Management System (IMS). Written for product owners, new engineers joining the codebase, sales/demo team members, and prospective clients evaluating the platform.

> Companion document: see [USER_MANUAL.md](USER_MANUAL.md) for end-user instructions and glossary.

---

## 1. Executive Summary

Raniacone is a multi-tenant SaaS inventory management platform. A single hosted instance serves multiple **client companies** (tenants), each with their own users, items, warehouses, documents, and books — fully isolated. The Raniacone team itself runs the platform and provisions tenants.

The system is split into:

- **Auth service** (port 8000) — identity, JWT issuance, RBAC, tenant provisioning, currency catalog.
- **Inventory service** (port 8001) — items, locations, balances, movements, documents, counts, valuation, reservations, lots, serials, and the operational tables.
- **Frontend** (Next.js 14 App Router) — single SPA serving three audiences (super admin, tenant admin, employee) via two route groups (`(platform)` for super admin, `(dashboard)` for tenant admin and employee).

The system is designed for **physical-goods inventory**: SKUs with barcodes, units of measure, batch/lot/serial tracking, multi-location stock, FIFO valuation, document-driven movements (POs, SOs, Transfers), stock counts, and audit-grade traceability.

---

## 2. Audience & Roles (Three Tiers)

### Tier 1 — Platform Super Admin

A Raniacone employee. Manages the platform itself.

- Lives outside any tenant (`tenant_id = null` in the JWT).
- Lands at `/platform/overview` after sign-in.
- Has its own dark-themed sidebar with platform-wide navigation.
- Cannot perform day-to-day operations (receiving stock, posting documents) directly — those are tenant-scoped. To act inside a tenant, the super admin sends an `X-Acting-Tenant-Id` header which the backend honours for cross-tenant reads/writes on the auth service.

### Tier 2 — Tenant Administrator (Client Admin)

The power-user inside a customer company. Has every permission within their own tenant; zero permissions outside it.

- Lives inside a tenant (`tenant_id = <their tenant>` in the JWT).
- Lands at `/dashboard` after sign-in.
- Can manage users, roles, permissions, master data, documents, inventory, settings, integrations.
- Cannot see other tenants — the platform navigation is invisible to them.

### Tier 3 — Employee

A regular worker inside a tenant. Permissions are role-driven (RBAC).

- Same JWT shape as Tier 2 but with a narrower permission set.
- Sidebar items, action buttons, and detail-page features are gated by individual permissions like `inventory.items.write`, `auth.users.read`, etc.
- Two pre-seeded archetypes:
  - **Operator** — read everything in inventory, write movements/documents/counts.
  - **Viewer** — read-only across all inventory views.
- Custom roles can be created with any combination of granted permissions.

---

## 3. Architecture (High Level)

### Frontend stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 App Router (React 18, TypeScript strict) |
| Styling | Tailwind CSS with CSS-var-backed tokens (see `src/styles/theme.css`) |
| State | React Query v5 (TanStack Query) for server state; React state for local UI |
| Forms | `react-hook-form` + `zod` resolvers |
| Tables | In-house `useTableFilters` hook + table-toolkit components (search, sort, column filters, active-filter bar) |
| HTTP | Two `axios` instances (auth + inventory) sharing interceptors for bearer-token injection, single-flight refresh, and error normalisation |
| RBAC primitives | `<Can>`, `<RequireRead>`, `<ForbiddenState>` components driven by the `useAuth` hook |
| Branding | `useBranding()` hook reads from `BrandingProvider` — every brand-specific name, logo, support email is centralised |
| Toasts | Module-level emitter (`toast-emitter.ts`) so the api-client can surface network errors globally |
| Tests | Vitest + @testing-library/react + MSW (Mock Service Worker) — 59 unit/integration tests as of writing |

### Backend stack (referenced from FE perspective)

- FastAPI (Python) on two services.
- PostgreSQL with multi-tenant schemas — `auth.*` and `inventory.*`.
- RS256 JWT — 15-min access + 30-day refresh, single-flight refresh on 401.
- Standard error shape: `{ code, message, field_errors, request_id }`.

### Demo mode

`NEXT_PUBLIC_DEMO_MODE=true` swaps the axios adapter for an in-memory implementation backed by fixture data (`src/lib/demo/`). The whole app runs offline — useful for client demos, Vercel deployments without a backend, and local UX exploration. See [DEMO_USERS.md](DEMO_USERS.md) for the seeded login accounts.

---

## 4. Module-by-Module Deep Dive

### 4.1 Master Data

The reference data every other module depends on. Created and maintained by the tenant admin once; consumed everywhere else.

| Sub-module | What it is | Why it matters |
| --- | --- | --- |
| **Status Master** | Custom status values for items, parties, documents (e.g. "Active", "Discontinued", "On Hold"). | Lets a tenant tailor lifecycle vocabulary to their business without code changes. |
| **Number Series** | Auto-numbering rules for documents (PO-2026-0001, SO-2026-0001…). Each series has a prefix, padding length, peek/allocate semantics. | Prevents number collisions, gives finance teams the audit-friendly running numbers they expect. |
| **UoM Categories** | Groupings of compatible units (Length, Weight, Volume, Count). | A conversion only makes sense within a category — e.g. you can convert "kilogram" ↔ "gram" but not "kilogram" ↔ "litre". |
| **UoMs** | Individual units of measure (each, kg, gram, litre, box, carton…). Each belongs to a UoM Category. | Items are stocked in a base UoM but can be received/issued in any compatible UoM. |
| **UoM Conversions** | Conversion factors (1 box = 12 each; 1 kg = 1000 g). | Backend uses these to translate quantities between UoMs at posting time so the books always balance in the base unit. |
| **Brands** | Brand names tagged on items (Apple, Samsung, Generic, Local Vendor). | Reporting filter; helps catalog organisation. |
| **Categories** | Hierarchical product categories (Electronics > Phones > Smartphones). | Reporting + browse navigation; can drive default GL accounts when finance integration lands. |
| **Document Types** | The kinds of documents the tenant uses (PO, SO, TRN/Transfer, RTV/Return-to-Vendor, etc.). Each links to a number series. | Defines which documents can be posted and how they're numbered. |

### 4.2 Inventory

The operational core. Represents *physical reality* — what stock exists where, in what state.

#### Items

The catalog of SKUs. Every line in every document references an item.

- Fields: code, name, base UoM, brand, category, item type, batch-tracked flag, serial-tracked flag, active flag.
- Sub-resources: identifiers (barcodes, manufacturer SKUs, supplier SKUs), variants, alternative UoMs, lots, serials, reorder policies.
- **Batch-tracked** items have lot numbers with optional expiry dates (food, pharma, chemicals).
- **Serial-tracked** items have unique per-unit identifiers (laptops, equipment).
- An item can be both batch- and serial-tracked (rare, but supported — e.g. a serialised drug ampoule with a lot/expiry).

#### Lots

Per-item batches. Each lot has a number, expiry, status (in_stock, reserved, issued, returned, scrapped). Drives FEFO (First-Expired-First-Out) when posting issue movements.

#### Serials

Per-unit unique identifiers for serial-tracked items. Each serial has a status, current location, warranty start/end. Drives full traceability — a recall query is a `WHERE serial_number IN (...)` away.

#### Locations & Bins

Physical places stock can sit. Trees of locations (Warehouse > Zone > Aisle), each with optional bins (specific shelves, racks, cells). Movements happen between locations; balances are stored per location.

#### Stock Balances

The *ledger of truth* for what's on hand right now.

- `qty_on_hand` — physical count.
- `qty_reserved` — soft-held for open documents (sales orders awaiting picking).
- `qty_available` — `qty_on_hand − qty_reserved`. The number to trust for "can I commit more?"
- `value` — current monetary value at FIFO cost.

Balances update automatically when movements post; never edited directly.

#### Movements

Atomic stock changes. Every receive, ship, transfer, adjustment, count correction creates one or more movement rows. Movements are **immutable** — to undo, post the reverse. The Movements page is the audit log of physical stock.

Direction:
- **IN** — adds to on-hand. Creates a new FIFO valuation layer at the receipt cost.
- **OUT** — removes from on-hand. Consumes the oldest FIFO layers first.

The dedicated `/movements/new` page is for one-off adjustments and write-offs that don't flow through a document. Most movements are created automatically when documents post.

#### Reservations

Soft-holds against `qty_available`. Created when a sales order is approved but before stock physically leaves. Reservations expire or are released on document cancellation.

#### Valuation Layers

The FIFO ledger. Every IN movement creates a new layer at its receipt unit cost; every OUT movement consumes the oldest layers first. The COGS reported on a sales order is the sum of consumed layer costs, not a single average.

#### Low Stock Alerts

Items below their reorder threshold. The list is computed live from balances + reorder policies.

#### Attachments

Generic file attachments tied to any entity (item, document, location, party). Used for spec sheets, photos, supplier invoices, signed delivery notes.

### 4.3 Documents

The transactional module. Documents *cause* stock movements — they're the human-facing wrapper around them.

#### Lifecycle

`Draft → Submitted → Approved → Posted → (optionally) Cancelled`

Posting is the irreversible step that creates real stock movements and writes to the FIFO ledger. Cancellation creates *reversal* movements; nothing is ever deleted, the trail stays intact for audit.

#### Document types

| Type | Direction | Stock effect |
| --- | --- | --- |
| **Purchase Order (PO)** | Inbound | Creates IN movements at the supplier's invoice cost. |
| **Sales Order (SO)** | Outbound | Creates OUT movements consuming FIFO layers. |
| **Transfer (TRN)** | Internal | Creates paired OUT + IN movements between two locations. |

Each document has a header (number, date, party, status, posting date) and lines (item, UoM, quantity, unit cost, total).

### 4.4 Operations

#### Stock Counts

Periodic physical counts ("stocktakes"). Workflow:

1. Create a count session against a location.
2. Add lines (which items to count).
3. Floor staff record actual quantities.
4. System surfaces variances (counted ≠ system).
5. Admin reviews and clicks **Apply** — the system creates correction movements for every variance.

Counts are not destructive until applied. Unapplied counts can be edited or discarded.

#### Parties

The unified directory of customers, suppliers, and inter-company partners. A party can play multiple roles (a vendor that's also a customer). Each party has addresses, contacts, payment terms, default GL codes.

### 4.5 Admin (tenant-level)

#### Users

The list of accounts within this tenant. Tenant admin can:

- Invite new users.
- Activate / deactivate.
- Reset passwords (admin-initiated, no email needed — see "Admin password reset" below).
- Assign / revoke roles.

#### Roles

A role is a named bundle of permissions ("Operator", "Viewer", "Receiving Clerk"). System-seeded roles (admin, operator, viewer) ship with the platform; tenants can add more.

#### Permissions

The permission catalog is a read-only reference page showing every permission code (e.g. `inventory.items.write`), what it grants, and which roles include it.

#### Settings

| Sub-page | Purpose |
| --- | --- |
| **Custom Fields** | Extend items/parties/documents with tenant-specific fields (text, number, date, boolean, select, JSON). |
| **Imports** | Bulk-upload CSV/Excel for items, parties, balances, etc. (planned/partial). |
| **Integrations** | Outbound webhook destinations + third-party connector configs (Slack, Teams, ERP). |
| **Webhooks** | Per-event subscriptions tied to integrations. |
| **Module Configuration** | Per-module key/value settings (e.g. "FIFO costing method", "Allow negative balances"). |
| **Tenant Configuration** | Tenant-wide settings (timezone, base currency override, fiscal year). |
| **Workflows** | State machines for document approvals — define states, transitions, required permissions per transition. |

### 4.6 Platform (super admin only)

#### Platform Overview

Rollup KPIs across all tenants — count, status, recent signups, system health snapshot.

#### Tenants

The list of every customer. Super admin can:

- Provision a new tenant — name, code, base currency, plan (free/pro/enterprise), timezone.
- Activate / deactivate.
- Open a tenant's detail page to see its users.
- Reset any user's password (across any tenant) via `X-Acting-Tenant-Id`.
- Edit base settings.

#### Platform Users

Cross-tenant user directory. Lists every user in every tenant plus the super admins themselves. Super admin can invite a user against a target tenant from here, reset passwords, or remove users (with the `X-Acting-Tenant-Id` header, which the backend §4 25-apr update now honours).

#### Currencies

The shared ISO 4217 catalog (USD, EUR, INR, JPY, GBP…). Pre-seeded by migration — tenants can't add to it themselves. Read-only browser for the moment.

#### System Health

Live monitoring panel — auth service status, inventory service status, database reachability, average request latency, session uptime percentage, per-check breakdowns. Refreshes on a poll interval.

### 4.7 Account (per-user)

Every authenticated user has access to:

- **Change Password** — self-service password change. Requires the current password as a second factor. Different from the admin-initiated reset (which is one-sided).

---

## 5. End-to-End User Journeys

### Journey A — Provisioning a New Tenant (Super Admin)

**Persona:** Raniacone employee onboarding a new client called "Acme Trading Co."

1. Super admin signs in → lands at `/platform/overview`.
2. Sidebar → **Tenants** → click **+ New tenant**.
3. Fill in name (Acme Trading Co.), code (acme), base currency (USD), plan (Pro), timezone (America/New_York). Submit.
4. Sidebar → **Platform Users** (or click into the new tenant) → **Invite user** → fill in name + email + temporary password → submit. The new admin user is created in Acme.
5. Share the credentials securely with the client.
6. Client signs in for the first time → lands at `/dashboard` → goes to **Account → Change Password** → sets a private password.
7. From there the client tenant admin runs their own setup (master data, locations, items, users for their staff).

### Journey B — First-day Setup for a New Tenant Admin

**Persona:** Priya, the freshly-onboarded admin at Acme Trading Co.

1. Sign in → dashboard with empty KPIs.
2. **Master Data → Currencies** — confirm base currency is USD (set by super admin).
3. **Master Data → UoM Categories** — verify defaults (Count, Weight, Length, Volume).
4. **Master Data → UoMs** — add any custom units (e.g. "Box of 24").
5. **Master Data → UoM Conversions** — add factors (1 box = 24 each).
6. **Master Data → Brands & Categories** — populate Acme's product taxonomy.
7. **Locations** — define warehouses, zones, bins.
8. **Parties** — add the top 10 suppliers and top 20 customers.
9. **Items** — create the catalog (manual or via Imports).
10. **Admin → Users** — invite floor staff, assign Operator and Viewer roles.
11. **Settings → Number Series** — confirm or customise document numbering prefixes.
12. Done. The tenant is operationally ready.

### Journey C — Receiving Stock via a Purchase Order (Operator)

**Persona:** Arun, warehouse operator.

1. Sign in → dashboard → sees "Recent movements" feed.
2. Sidebar → **Documents → Purchase Orders** → click **+ New Purchase Order**.
3. Pick supplier (party), document date, expected delivery location.
4. Add lines: item, UoM, qty, unit cost.
5. Save as draft → review → click **Submit**.
6. (If workflow requires approval, an approver gets the next step.) Eventually status reaches **Approved**.
7. When the truck arrives: open the PO → click **Post**. Backend creates IN movements at the unit costs on the lines, balances update, FIFO layers are written.
8. The PO is now in **Posted** state. Going forward it's referenceable but immutable.

### Journey D — Issuing Stock via a Sales Order

Mirror of Journey C but outbound. Posting an SO consumes the oldest FIFO layers and decrements `qty_on_hand`. If `qty_available < line.quantity`, the post fails with `INSUFFICIENT_STOCK` and the operator sees a clear error.

### Journey E — Stock Count and Variance Correction

**Persona:** Priya (admin) running a quarter-end count.

1. **Operations → Stock Counts** → **+ New count**.
2. Pick location (Main Warehouse), date (today), notes.
3. Add lines (which items to count). Or add all items in that location with one click.
4. Print the count sheet (or use mobile to walk the floor with the count detail page).
5. Floor staff record actual quantities.
6. Priya reviews the **Variances** tab — items where counted ≠ on-hand.
7. If variances are reasonable: click **Apply**. System creates correction movements (IN for positive variances, OUT for negative). Balances now match physical reality.
8. If variances are suspicious: don't apply yet. Discard or fix individual lines and re-walk.

### Journey F — Resetting a User's Password (Admin-initiated)

**Persona:** Tenant admin (or super admin) — user has forgotten their password.

1. Tenant admin: **Admin → Users** → click the user → **Reset password** in the topbar.
2. Super admin: **Platform Users** → row action menu → **Reset password**.
3. Enter new password (8–128 chars), confirm, submit.
4. Backend replaces the password hash and revokes every refresh token for that user. They're signed out of every device.
5. Admin shares the new password securely. User logs in and immediately changes it via Account → Change Password.

---

## 6. Demo Mode

A standalone runtime that simulates the entire backend in browser memory.

- Activated by `NEXT_PUBLIC_DEMO_MODE=true` (`.env.local`).
- Shows an amber banner at the top of the page.
- Login uses fixed accounts (`admin@demo.com / demo123` etc. — see [DEMO_USERS.md](DEMO_USERS.md)).
- All mutations succeed but live in browser memory — refreshing the page resets the world.
- Used for: client demos, Vercel-hosted previews without a backend, UI exploration during development.

---

## 7. RBAC Reference (What Permissions Exist)

Permissions follow `<module>.<resource>.<action>` convention.

### Auth module (`auth.*`)

- `auth.users.read` / `auth.users.write` — see / manage users in your tenant
- `auth.roles.read` / `auth.roles.write` — see / manage roles and their permissions
- `auth.tenants.read` / `auth.tenants.write` — *super-admin-only* — manage tenants
- `auth.currencies.read` / `auth.currencies.write` — *super-admin-only*

### Inventory module (`inventory.*`)

- `inventory.items.read` / `.write`
- `inventory.lots.read` / `.write`
- `inventory.serials.read` / `.write`
- `inventory.locations.read` / `.write`
- `inventory.balances.read` (write is via movements, not direct)
- `inventory.movements.read` / `.write`
- `inventory.reservations.read` / `.write`
- `inventory.documents.read` / `.write` / `.post` / `.cancel` (post and cancel are separate so you can have an approver who can cancel but not post, etc.)
- `inventory.counts.read` / `.write` / `.apply` (apply is the irreversible commit)
- `inventory.parties.read` / `.write`
- `inventory.brands.read` / `.write`
- `inventory.categories.read` / `.write`
- `inventory.uoms.read` / `.write`
- `inventory.status_master.read` / `.write`
- `inventory.number_series.read` / `.write`
- `inventory.workflows.read` / `.write`
- `inventory.custom_fields.read` / `.write`
- `inventory.config.read` / `.write`
- `inventory.integrations.read` / `.write`

The full catalog can be browsed at `/admin/permissions` inside any tenant.

---

## 8. What's Built / What's Not

### Built and stable

- All 68 screens listed in the user manual.
- 3 user tiers with full RBAC enforcement.
- Multi-tenant data isolation.
- Demo mode against in-memory fixtures.
- 59 unit/integration tests + MSW-backed API mocks.
- Mobile-responsive frame (sidebar drawer, card layouts, touch targets, breadcrumb truncation).
- Admin-initiated password reset (frontend + backend).
- Super-admin cross-tenant impersonation via `X-Acting-Tenant-Id` for reads + writes.

### Partially built

- **Imports** — UI exists but bulk-upload CSV/Excel parsing is stub-level. End-to-end import is on the roadmap.
- **Workflows** — schema and editor UI exist; runtime enforcement at document posting time is partial. Currently only some document types respect workflows.
- **Integrations / Webhooks** — UI lets you configure them; outbound dispatch on event firing is wired for a subset of events.
- **Pagination** — list pages cap at 200 items per call (or 500 for tenants). Cursor-based pagination is implemented at the API level for some endpoints; client-side pagination UI is placeholder.

### Deferred / not yet built

- **Self-service "forgot password"** — deferred until SMTP infrastructure is in place. Until then, end users contact their admin who uses the admin-initiated reset.
- **GL / accounting integration** — out of scope for v1.
- **Mobile native app** — web is mobile-responsive; no native iOS/Android app planned.
- **Multi-currency on a single document** — every document is in the tenant's base currency.
- **Inter-tenant transfers** — each tenant is fully isolated; no built-in flow to move stock from tenant A to tenant B.
- **Forecasting / demand planning** — out of scope for v1.

---

## 9. Glossary (Brief)

For full plain-language definitions see [USER_MANUAL.md](USER_MANUAL.md) §3.

- **Tenant** — a customer company on the platform.
- **Tier** — user level (super admin / tenant admin / employee).
- **JWT** — signed token carrying the user's identity, tenant, and permission claims.
- **RBAC** — Role-Based Access Control.
- **UoM** — Unit of Measure.
- **SKU** — Stock-Keeping Unit, a single item code.
- **FIFO** — First-In-First-Out costing.
- **FEFO** — First-Expired-First-Out picking.
- **GL** — General Ledger (accounting term).
- **PO / SO / TRN** — Purchase Order / Sales Order / Transfer.
- **Lot / Batch** — a group of units of an item that share a manufacturing date / expiry / quality cohort.
- **Serial** — a unique identifier for a single unit.
- **Reservation** — soft-hold against available stock pending a document fulfilment.
- **Movement** — an atomic, immutable stock change row.
- **Valuation Layer** — a FIFO entry for a quantity at a unit cost.
- **Posting** — the irreversible action of writing a document's effects into the stock and valuation tables.
