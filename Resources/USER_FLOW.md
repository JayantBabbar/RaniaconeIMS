# RaniacOne — User Experience Guide

> A plain-language walk-through of every person who uses RaniacOne,
> what they see, and what they can do. Written for clients, onboarding
> staff, and the build team — **no code, no APIs**.
>
> For engineering detail, see `FRONTEND.md` in this folder.

---

## Contents

1. [What RaniacOne is](#1-what-raniacone-is)
2. [The four kinds of users](#2-the-four-kinds-of-users)
3. [Signing in](#3-signing-in)
4. [Service Provider Admin journey](#4-service-provider-admin-journey)
5. [Client Admin journey](#5-client-admin-journey)
6. [Warehouse Operator journey](#6-warehouse-operator-journey)
7. [Viewer journey](#7-viewer-journey)
8. [Core features explained](#8-core-features-explained)
9. [Working day in the life — end-to-end scenarios](#9-working-day-in-the-life--end-to-end-scenarios)
10. [Safety rails the system enforces](#10-safety-rails-the-system-enforces)
11. [What can go wrong & how we show it](#11-what-can-go-wrong--how-we-show-it)

---

## 1. What RaniacOne is

RaniacOne is an **inventory management platform**. It keeps track of
every item a company owns, where that item is, how much it cost,
who owes money for it, and who took it off the shelf.

Think of it as a single answer to questions like:

- "How many units of SKU-438 are in the Kolkata warehouse right now?"
- "What did those 500 tablets actually cost us, given we bought them in
  three different batches at different prices?"
- "Did anyone ship this order yet? If not, why not?"
- "Are we running low on anything we should reorder this week?"

The platform is **multi-tenant**: one installation serves many client
companies ("tenants"), and each tenant's data is isolated from every
other tenant's.

The platform is also **modular**. The first product module is
**Inventory**. Future modules (ERP, RAG, CRM) will plug into the same
shell without requiring a second login.

---

## 2. The four kinds of users

| Who | Typical title | What they do |
|---|---|---|
| **Service Provider Admin** | Raniac platform ops | Runs the platform itself. Creates customer workspaces (tenants), sets up currencies, subscribes tenants to product modules, troubleshoots across everyone. |
| **Client Admin** | Operations Head, IT Manager | Runs one customer workspace. Invites teammates, sets up warehouses, parties, catalogues, workflows. Has full power inside their own tenant. |
| **Warehouse Operator** | Warehouse staff, store clerk | Does the day-to-day: receives purchase orders, ships sales orders, moves stock, counts inventory. |
| **Viewer** | Finance, auditor, executive | Reads-only. Can see balances, reports, documents, but changes nothing. |

Service Provider Admin is a **platform-level role** — they exist outside
any one tenant. The other three are **tenant-level roles**, assignable
per workspace. A Client Admin can invent new custom roles too (e.g.
"Purchaser", "Shipping Supervisor") with exactly the permissions they
want.

---

## 3. Signing in

**One form, one result.** RaniacOne uses a single login page that takes
an email and password. No "workspace code" to remember — your email
tells us who you are and which workspace you belong to.

On successful login, we send you to the right place:

- **Service Provider Admins** → Platform Overview
- **Everyone else** → their workspace dashboard

Under the hood, we issue two short-lived security tokens so that even
if one leaks, the damage window is small. You don't need to do anything
— the app refreshes them silently in the background. You'll only be
bounced back to the login page if you've been idle for a **long** time
or you change your password elsewhere.

**Forgot password** and **self-service account settings** live under
the avatar menu in the top-right.

---

## 4. Service Provider Admin journey

A Service Provider Admin operates **above** tenants. Their sidebar is
distinct — dark theme, "Platform" label, no warehouse or inventory
links.

### What they see

- **Platform Overview** — tenant count (active / trialing / suspended),
  currency count, live API health banner, recent tenants grid.
- **Tenants** — list every customer workspace with its plan, status,
  timezone, currency, created date. Provision a new tenant with a
  modal form; edit or suspend existing ones.
- **Tenant Detail** — a deeper view of a single customer: their ID
  (copyable), configuration, current users, quick-actions to register
  the first admin, subscribe to modules.
- **Platform Users** — a cross-tenant directory of every user in the
  system. Filter by tenant, scope to "Super Admins only" or "Tenant
  Users only", invite a new super admin or a new tenant admin from one
  modal.
- **Currencies** — global catalog. USD, EUR, INR are seeded. Adding a
  currency makes it available to every tenant.
- **System Health** — live green/red banner, auto-refreshing every
  15 seconds. Latency sparkline, API status card, database status
  card, recent-check log, session uptime percentage.

### Typical first-day journey — onboarding a new customer

1. **Confirm everything is up** — glance at System Health.
2. **Add any missing currencies** needed by the customer.
3. **Provision the tenant** — name, workspace code, base currency,
   timezone, plan.
4. **Subscribe the tenant** to the Inventory module (and any others
   they're buying).
5. **Register the first admin** for that tenant from the tenant detail
   page — enter their email, name, set a temporary password.
6. **Hand off** — tell the new Client Admin their login email and the
   temporary password. They change it on first login.

They can always **"act as"** any tenant (via a hidden cross-tenant
override) for troubleshooting. All such actions are audit-logged.

---

## 5. Client Admin journey

A Client Admin owns everything inside their workspace. Full power, no
cross-tenant visibility.

### What they see

- **Dashboard** — KPI cards (stock value, low stock count, recent
  movements, recent documents, expiring lots), plus quick-links into
  the sections they use most.
- **Master Data** section — the reference data everything else hangs
  off:
  - **Status Master** — the labels for states like `draft`, `posted`,
    `cancelled`.
  - **Number Series** — how document numbers are generated (e.g.
    `PO-00001`, `SO-00042`).
  - **UoM Categories / UoMs / UoM Conversions** — unit of measure
    hierarchy (kg / g, box / piece).
  - **Brands**, **Categories** — item taxonomy.
  - **Document Types** — which documents you want (PO, SO, Transfer,
    Goods Receipt, etc.).
- **Inventory** section:
  - **Items** catalogue, with tabs for identifiers (barcodes),
    variants (size/colour), alternative UoMs, lots, serials, reorder
    policies, stock, custom fields, attachments.
  - **Lots** — every batch of a batch-tracked item (e.g.
    pharmaceuticals), with mfg/expiry dates. Flagged when expiring
    soon.
  - **Serials** — every unique unit of a serial-tracked item (e.g.
    laptops), grouped by status.
  - **Locations & Bins** — warehouses, zones inside them, bins inside
    those. Tree view.
  - **Stock Balances** — "how much of what is where, right now".
  - **Movements** — the append-only ledger of every IN and OUT.
  - **Reservations** — soft-holds placed against stock for open SOs.
  - **Valuation Layers** — FIFO cost tracking (every IN creates a
    "layer"; OUTs consume the oldest layer first).
  - **Low Stock Alerts** — items at or below their reorder point, with
    a one-click link to create a Purchase Order.
- **Documents** section — Purchase Orders, Sales Orders, Transfers,
  Goods Receipts, etc. Each has a list, a create form with a line
  editor, and a detail view with Post / Cancel / Print actions.
- **Stock Counts** — audit sessions where physical counts are
  reconciled against the system, with variance review before
  applying adjustments.
- **Parties** — suppliers and customers, each with addresses,
  contacts, tax IDs, and custom fields.
- **Admin** section:
  - **Users** — invite people, disable accounts, assign roles.
  - **Roles** — create roles and grant permission bundles via a grid.
  - **Permissions Reference** — read-only view of every permission
    the system offers, grouped by resource.
- **Settings** hub:
  - **Workflows** — visual state machines for documents.
  - **Custom Fields** — add your own fields to items, parties,
    documents, etc.
  - **Tenant Configuration** — workspace-wide key/value settings.
  - **Module Configuration** — per-module (e.g. inventory) key/value
    settings.
  - **Integrations / Webhooks / Imports** — outbound connections and
    bulk data jobs.

### Typical first-48-hours journey

1. **Change the temp password** handed to them by the Service Provider.
2. **Build master data**: UoMs → Brands → Categories → Locations + Bins
   → Parties → Document Types → Number Series → Status Master.
3. **Catalogue items** — one-by-one in the UI, or via a CSV import job.
4. **Configure workflows** — decide which states a PO / SO flows
   through, and who can trigger each transition.
5. **Invite teammates** with targeted roles — Operator, Viewer, or a
   custom role they define.
6. **Open the dashboard** — empty but ready. They're done.

### Typical day-to-day

- Morning dashboard scan — any low-stock alerts, any stuck documents.
- Review pending documents flagged for approval.
- Run reports — stock on hand, FIFO valuation, movement history.
- Handle exceptions — cancel a wrongly posted document, reconcile a
  counting variance, tweak a reorder policy.

---

## 6. Warehouse Operator journey

Operators are the heartbeat of the day. Their sidebar hides admin and
settings — they see only what they need to do the job.

### What they see

Just the operational parts:

- Dashboard (read-only KPIs)
- Items (read-only)
- Stock Balances (read-only)
- Movements (create + read)
- Documents (create + edit drafts + post when authorised)
- Stock Counts (create + record)
- Reservations (create + cancel)

### Persona A — Warehouse Operator (e.g. receives stock)

**Goal**: a pallet of 100 tablets just arrived at the dock; record it.

1. Open the Purchase Order that was raised earlier (filter by supplier
   or PO number).
2. Confirm the lines match the physical count. Edit any line
   quantities that differ.
3. Click **Post** — the system creates one IN movement per line, a
   FIFO valuation layer per line, and updates the balance. Stock is
   now live.

### Persona B — Purchaser / Procurement

**Goal**: the dashboard shows 12 items below reorder point; raise POs.

1. Open Low Stock Alerts. Sort by shortfall descending.
2. Click **Reorder** next to the top item — the PO create form opens,
   pre-filled with the supplier from the item's preferred-supplier
   field.
3. Add any other lines, review, save as Draft.
4. Submit for approval. A Client Admin or a permitted role approves
   and posts.

### Persona C — Inventory Counter

**Goal**: it's month-end; reconcile physical vs system counts.

1. Open Stock Counts, create a new session for the warehouse.
2. Add item lines — the system snapshots the current on-hand qty as
   `system_qty`.
3. Walk the shelves, type the `counted_qty` for each.
4. Variance column auto-fills. Review in the Variance tab.
5. Apply — the system creates IN or OUT adjustment movements for every
   non-zero variance, in one transaction.

### Stock transfer wizard

When the operator needs to move stock between warehouses:

1. **Step 1 — Locations**: pick source and destination.
2. **Step 2 — Meta**: posting date, notes.
3. **Step 3 — Lines**: add items + quantities. The wizard shows
   live on-hand at the source so they can't overship.
4. **Step 4 — Review**: confirm. On submit, the system posts paired
   OUT + IN movements atomically. Cost flows with the goods.

---

## 7. Viewer journey

Viewers only read. Typical use:

- Finance: checks stock valuation at month-end, exports to Excel.
- Auditor: browses document history, audit log.
- Executive: opens the dashboard, gets the top-level numbers.

Every create / update / delete button in the UI simply isn't rendered
for viewers — it's not there to click.

---

## 8. Core features explained

### 8.1 FIFO valuation

Every time stock comes IN, the system records **what it cost**. When
stock goes OUT, it consumes the oldest-still-available layer first.
The result: margin reports use the actual cost of the actual units
sold, not a running average.

Users see this on the **Valuation Layers** page — each item/location
shows how many layers exist, when each was created, its unit cost, and
how much remains.

### 8.2 Documents & states

Every PO, SO, Transfer, etc. is a **document** with a lifecycle:

- **Draft** — fully editable. Add/remove/modify lines.
- **Submitted** — locked for editing by the creator. Goes for approval.
- **Approved** — ready to post.
- **Posted** — live. Creates movements, layers, balance updates.
  Read-only from here on (except Cancel).
- **Cancelled** — posted documents can still be cancelled, which
  creates **reversal movements**. Nothing is deleted — the ledger stays
  immutable.

The exact states and transitions are **configurable per tenant** via
the Workflow builder.

### 8.3 Lot tracking

For items flagged as **batch-tracked** (medicines, perishables), every
receipt creates a new lot with its mfg / expiry date. Lots flow
through the system so that:

- You know exactly which batches are expiring when.
- You can recall a specific batch if needed.
- FIFO respects the lot boundaries — oldest lots are picked first.

### 8.4 Serial tracking

For items flagged as **serial-tracked** (laptops, phones, anything
uniquely identified), every unit is a row. Each has a status:
`in_stock` → `reserved` → `issued` → (optionally) `returned` or
`scrapped`. The system enforces that the same serial can't be in two
places.

### 8.5 Reservations

Before a Sales Order is shipped, its lines can **reserve** stock —
reducing the "available" count without yet moving the physical units.
Prevents overcommitting the same inventory to two customers. When the
SO posts, the reservation is released and a real OUT movement
replaces it.

### 8.6 Number series

Document numbers like `PO-00001` are generated, not typed. Each
document type has its own series with a prefix, a padding width, and
a current counter. You can **peek** the next number without consuming
it (useful for showing the user "this PO will be PO-00042"), or
**allocate** one atomically when the document is created.

### 8.7 Workflows

Documents can be routed through **custom workflows** — a state machine
with named transitions. Example for a PO:

```
Draft ──submit──▶ Submitted ──approve──▶ Approved ──post──▶ Posted
                      │
                    reject
                      ▼
                    Rejected
```

Each transition can be gated by a permission, so only authorised roles
can move documents between states.

### 8.8 Custom fields

Any entity (Item, Party, Location, Document Header, Document Line)
can be extended with custom fields — text, number, date, boolean,
select, or JSON. The Client Admin defines them in Settings; they
appear automatically in the relevant forms and detail views.

### 8.9 Integrations & webhooks

Outbound:
- **Integrations** — configure third-party connections (ERP, shipping
  providers, payment gateways) via saved credentials + config JSON.
- **Webhooks** — fire HTTP callbacks on defined events (e.g. "document
  posted") to external systems.

Inbound:
- **Imports** — CSV / Excel bulk uploads for items, parties, stock, etc.
  Each job shows its progress, success row count, error row count, and
  downloadable error report.

### 8.10 Audit trail

Every create, update, delete, post, cancel, and transition is recorded
in an audit log with: who, when, before-state, after-state, and the
request ID for tracing. The log is **immutable** — nothing is ever
edited once written.

### 8.11 Low stock alerts

For every reorder policy set on an item/location, the alerts page
shows whether the current available stock is at or below the reorder
point. Severity is either **Low** (below reorder but non-zero) or
**Critical** (zero or negative). One click from alert → "Create PO".

### 8.12 Timezones

The system stores everything in UTC internally. When it shows you a
datetime, it's already converted to **your** timezone (set by the
Client Admin at workspace level, optionally overridden per user).
Super Admins default to UTC.

Dates on documents (posting date, expiry date) are treated as
**calendar dates** — no conversion — because "April 20, 2026" means
the same thing everywhere.

---

## 9. Working day in the life — end-to-end scenarios

### Scenario A: A new hospital becomes a customer

1. The Service Provider Admin gets an email: "Meridian Hospital is
   ready."
2. They log in, open Platform Overview, confirm the system is healthy.
3. Currencies: INR is already there. No change needed.
4. Click **Provision Tenant** → "Meridian Hospital" / `meridian`, base
   currency INR, timezone Asia/Kolkata, plan Pro.
5. Subscribe Meridian to the **Inventory** module.
6. Open the new tenant detail, click **Register First Admin**, enter
   `admin@meridian-hospital.com` with a temp password.
7. Email the admin their credentials.

### Scenario B: The new Client Admin sets up

1. `admin@meridian-hospital.com` logs in, changes password.
2. Opens Settings → Master Data. Creates UoMs (tablet, bottle, box),
   a few brands (GSK, Cipla), categories (Tablets, Syrups, Devices).
3. Locations: creates "Main Warehouse" as a warehouse, then two zones
   ("Cold Storage", "General") inside it, then 6 bins per zone.
4. Parties: adds three suppliers (manufacturers) and three customers
   (downstream pharmacies).
5. Item master: uploads a CSV with 200 SKUs via the Imports feature.
   A couple of rows fail — downloads the error report, fixes the
   headers, re-uploads.
6. Document types: creates "Purchase Order", "Sales Order",
   "Warehouse Transfer", "Goods Receipt" with their own number series.
7. Workflows: builds a PO workflow — Draft → Submitted → Approved →
   Posted, with rejection loops.
8. Users: invites three teammates. Warehouse Operator role for two,
   Viewer role for the auditor.

### Scenario C: A normal Tuesday for the warehouse

- **8:30 AM** — Operator opens Dashboard. 4 low-stock alerts, 2 POs
  awaiting receipt.
- **9:00 AM** — A shipment of 500 tablets arrives. Operator opens the
  matching PO, tweaks one line (49 received, not 50), posts. Balance
  updates live.
- **10:30 AM** — Downstream pharmacy emails: "Send us 20 boxes of X."
  Operator creates an SO, adds the line, reserves the stock, leaves it
  in Draft for the Client Admin to approve.
- **11:00 AM** — Client Admin approves, operator posts. Stock goes out,
  FIFO picks the oldest batch, cost is computed automatically.
- **2:00 PM** — Operator notices Bin C3 looks thin. Opens a Stock
  Count session for Main Warehouse, records the actual counts, reviews
  variances (one line off by -3), applies. Three OUT adjustment
  movements book automatically.
- **4:00 PM** — Transfer 30 boxes from Main Warehouse to Branch.
  4-step wizard, confirm, post. Paired OUT + IN movements, cost flows
  to the new warehouse.
- **5:00 PM** — Client Admin glances at Valuation Layers for the
  day-end report. All looks right.

### Scenario D: A mistake, caught and corrected

- Operator posted a PO with the wrong supplier.
- They open the Document detail, click **Cancel** (If-Match guard
  prevents a concurrent change colliding).
- The system creates reversal movements — IN goes back OUT, layers
  are exhausted, balances decrement — all in one atomic transaction.
- They re-create the PO correctly, post it.
- Audit log shows the sequence: Posted → Cancelled (with reversal
  IDs) → Posted (new doc).

### Scenario E: A new product module launches

- Raniac releases the **ERP** module. Service Provider Admin sees it
  in the Modules catalog.
- They go to a tenant, subscribe them to ERP.
- The next time that tenant's admin logs in, a new **ERP** section
  appears in their sidebar. Their existing inventory workflow is
  untouched.
- Tenants who didn't subscribe continue as before — no upgrade pain,
  no "you have 30 days to opt in" banners.

---

## 10. Safety rails the system enforces

- **Tenant isolation** — no user can ever see another tenant's data.
  Enforced at the database layer, not just the UI.
- **Read-only ledger** — every stock movement is append-only. Cancels
  create reversal movements; nothing is deleted.
- **FIFO integrity** — concurrent sales can't double-consume the same
  layer. A row lock ensures only one OUT at a time per balance.
- **Optimistic locking** — if two users try to edit the same item at
  the same time, the second one gets "Someone else edited this —
  reload" instead of silently overwriting.
- **Audit everything** — every change is logged with actor, timestamp,
  before/after snapshot, and request ID.
- **Permission checks everywhere** — buttons aren't hidden only, the
  backend rejects the action too.
- **Rate-limited login** — 10 attempts per IP per 5 minutes to stop
  brute force.
- **Short-lived tokens** — access tokens expire in 15 minutes; even if
  one leaks, the damage window is small.
- **Datetime hygiene** — the UI always sends proper timezones; the
  server rejects ambiguous inputs.

---

## 11. What can go wrong & how we show it

Every error in RaniacOne shows three things: a clear message, an
inline hint if applicable, and a small request ID in the corner so
support can find it in logs instantly.

Common situations:

| What happens | What you see |
|---|---|
| Typo in password | "Email or password is incorrect." Try again. |
| Too many wrong tries | "Too many attempts — try again in 47 seconds." |
| Session finally expires | Silent: we refresh you in the background. If that fails, bounce to login. |
| Someone else edited the same item | "This item was updated by another user — refreshing…" We reload it for you. |
| Not enough stock for an SO | "Insufficient stock: 12 available, 20 requested." The post is blocked. |
| You click something you don't have access to | "You don't have permission to do this. Contact your admin." Button also hides once we know. |
| Your workspace isn't subscribed to that module | A big "Feature not available" panel with a "Contact your admin" CTA. |
| Server hiccup | "Unable to reach the server. Please check your connection." Tries again automatically. |

---

**End.** Questions? Talk to your RaniacOne admin, or for the engineers
on the build team, see `FRONTEND.md` next door.
