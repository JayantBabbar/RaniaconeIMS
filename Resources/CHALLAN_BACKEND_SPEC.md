# Challan Module — Backend Specification

> **Status:** Living document. Updated as the FE prototype matures.
> **Last revised:** 2026-04-28
> **Origin:** derived from working FE prototype at `src/app/(dashboard)/challans/*`
> **Companion:** [INVOICE_BACKEND_SPEC.md](INVOICE_BACKEND_SPEC.md) — challans promote to invoices; the two specs are paired.
> **Companion:** [CLIENT_NEEDS_GAP.md](CLIENT_NEEDS_GAP.md) §Phase 2.5 (delivery flow)
> **For backend dev:** this is the contract. Build the API to satisfy it; FE will swap from demo adapter to real endpoints with zero further FE changes.

---

## 1. Overview

A **Delivery Challan** (also called a "DC" or "GRN-out" depending on the dialect) is the document that physically accompanies goods leaving the warehouse for a customer. It's distinct from an Invoice because:

| | Invoice | Challan |
| --- | --- | --- |
| Purpose | Tax/billing artefact | Movement-of-goods artefact |
| Has tax columns? | Yes (CGST/SGST/IGST) | No (no tax math) |
| Triggers stock OUT? | Yes (on Post) | Yes (on Post) |
| Triggers ledger? | Yes | No |
| Required by GST? | Yes for any taxable supply | Required when goods move before/without an invoice (§55, CGST Rules) |
| Carried in the truck? | Sometimes | Always — the e-Way Bill rides on the challan number |

The two-document workflow exists because Indian distribution rarely bills on the same trip:

1. Salesman/driver delivers a basket to a kirana shop on Monday.
2. Shopkeeper inspects, accepts, may swap or short-pick.
3. Final billable quantities are confirmed at end-of-day or end-of-week.
4. Invoice is then raised against those final quantities and the challan is marked **billed**.

So the system must let users:

- Print a challan with **no amounts** (delivery-only paper) or **with amounts** (challan-cum-bill style for cash sales).
- Convert / promote a posted challan to an invoice without re-typing lines.
- Prevent a challan being billed twice.
- Track route / vehicle / driver for fleet ops.

Status flow:

```
draft  →  posted  →  cancelled
   \-----→ deleted (only from draft)
```

- **Draft** — fully editable. No stock movement. Can be deleted.
- **Posted** — locked. Stock OUT movement created. Cannot be edited. **Can be promoted to invoice** if `is_billed=false`.
- **Cancelled** — reversal movement posted. Original kept for audit.

**Billing flag** (`is_billed`) is independent of `status`:
- Posted + unbilled → can be promoted to invoice.
- Posted + billed → linked to `invoice_id`; promoting again is forbidden.

---

## 2. Print modes

A challan supports two print modes the user picks at create-time (and can override on the print page):

| Mode | Shows amounts? | Use case |
| --- | --- | --- |
| `with_remarks` | Yes (qty + rate + line total) | Cash counter sales, challan-cum-bill, internal copy |
| `no_amount` | No (qty only) | Driver copy / customer's delivery copy when billing happens later |

The mode is persisted on the row so reprints are deterministic. The print page (`/challans/[id]/print`) reads the mode and conditionally hides the rate/total columns. Backend just stores the value; no other logic depends on it.

---

## 3. Routes (lightweight master-data)

A "route" is a pre-defined delivery beat (e.g. "Mumbai South", "Pune Industrial", "Delhi NCR"). It's optional metadata on a challan but used heavily for:

- Sorting the daily picklist
- Driver / vehicle assignment
- End-of-day reporting per route

Slim entity — name + code + active flag is enough. No GIS, no waypoints. We're not Google Maps.

```sql
CREATE TABLE routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  code        TEXT NOT NULL,                 -- e.g. "MUM-S"
  name        TEXT NOT NULL,                 -- "Mumbai South"
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
```

Two endpoints (list + detail) is sufficient for Phase 2.5; full CRUD can come when we build the dedicated routes admin page.

---

## 4. Database schema

### 4.1 `challans` (one row per challan header)

```sql
CREATE TABLE challans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),

  -- Identity
  challan_number       TEXT NOT NULL,                       -- e.g. "DC/2026-04/0001"
  challan_date         DATE NOT NULL,

  -- Counter-party
  party_id             UUID NOT NULL REFERENCES parties(id),

  -- Logistics
  route_id             UUID REFERENCES routes(id),
  source_location_id   UUID REFERENCES locations(id),       -- the warehouse goods leave from
  destination_address  TEXT,                                -- free-text override for one-off drops
  vehicle_number       TEXT,
  driver_name          TEXT,
  driver_phone         TEXT,

  -- State machine
  status               TEXT NOT NULL                        -- 'draft' | 'posted' | 'cancelled'
                       CHECK (status IN ('draft','posted','cancelled'))
                       DEFAULT 'draft',

  -- Billing linkage
  is_billed            BOOLEAN NOT NULL DEFAULT false,
  invoice_id           UUID REFERENCES invoices(id),         -- null until promoted

  -- Print
  print_mode           TEXT NOT NULL                        -- 'with_remarks' | 'no_amount'
                       CHECK (print_mode IN ('with_remarks','no_amount'))
                       DEFAULT 'no_amount',

  -- Cached totals (no tax — just qty/value rollups)
  subtotal             NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total          NUMERIC(15,2) NOT NULL DEFAULT 0,

  remarks              TEXT,

  -- Lifecycle
  posting_date         TIMESTAMPTZ,                          -- set on Post
  cancelled_at         TIMESTAMPTZ,
  cancellation_reason  TEXT,

  -- Audit / optimistic locking
  version              INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_by           UUID,

  UNIQUE (tenant_id, challan_number)
);

CREATE INDEX idx_challans_tenant_status   ON challans(tenant_id, status);
CREATE INDEX idx_challans_tenant_party    ON challans(tenant_id, party_id);
CREATE INDEX idx_challans_tenant_route    ON challans(tenant_id, route_id);
CREATE INDEX idx_challans_tenant_date     ON challans(tenant_id, challan_date DESC);
CREATE INDEX idx_challans_tenant_billed   ON challans(tenant_id, is_billed) WHERE status='posted';
CREATE INDEX idx_challans_invoice_id      ON challans(invoice_id) WHERE invoice_id IS NOT NULL;
```

### 4.2 `challan_lines` (one row per line)

```sql
CREATE TABLE challan_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id      UUID NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  line_number     INT  NOT NULL,                          -- 1-based, contiguous

  item_id         UUID NOT NULL REFERENCES items(id),
  description     TEXT,
  uom_id          UUID NOT NULL REFERENCES uoms(id),
  quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),

  -- Optional pricing snapshot (for with_remarks print mode and promote-to-invoice handoff)
  unit_price      NUMERIC(15,4),
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  line_total      NUMERIC(15,2) NOT NULL DEFAULT 0,       -- (qty * unit_price) - discount, NO tax

  -- Tax hint carried forward to invoice (NOT applied on the challan itself)
  rate_pct        NUMERIC(5,2),
  hsn_code        TEXT,

  -- Optional batch / serial linkage
  lot_id          UUID REFERENCES lots(id),
  serial_id       UUID REFERENCES serials(id),

  remarks         TEXT,

  UNIQUE (challan_id, line_number)
);
```

### 4.3 Required additions to existing tables

None. The challan module reuses everything — items, parties, locations, lots, serials, number_series. The new column on `invoices` referenced in INVOICE_BACKEND_SPEC.md §3.2 (`challan_id`) provides the back-link from invoice to its source challan.

DB-level safety:

```sql
-- Once a challan is billed, invoice_id must be set (and vice-versa).
ALTER TABLE challans ADD CONSTRAINT challans_billed_has_invoice
  CHECK (
    (is_billed = false AND invoice_id IS NULL)
    OR
    (is_billed = true  AND invoice_id IS NOT NULL)
  );

-- A given invoice can have at most one source challan (the M:N case can wait).
CREATE UNIQUE INDEX uq_invoices_challan_id
  ON invoices(challan_id)
  WHERE challan_id IS NOT NULL;
```

---

## 5. API contract

All routes on the **inventory service** (`:8001/api/v1`). All require `Authorization: Bearer <access>`. Multi-tenant scoping via the JWT `tid` claim (or `X-Acting-Tenant-Id` for super-admin overrides).

### 5.1 List challans

```
GET /challans
  ?limit=100               (default 50, max 200 — clamped at FE per CLAUDE.md)
  ?cursor=<opaque>
  ?party_id=<uuid>
  ?route_id=<uuid>
  ?status=draft|posted|cancelled
  ?is_billed=true|false
  ?start_date=YYYY-MM-DD
  ?end_date=YYYY-MM-DD

Response 200 — `Challan[]` (plain array; FE uses unwrapList)
```

`Challan` shape — see [`src/types/index.ts`](../src/types/index.ts).

### 5.2 Create draft

```
POST /challans
Body:
  {
    "challan_number":      "DC/2026-04/0001",   // optional; allocate from number_series if absent
    "challan_date":        "2026-04-26",
    "party_id":            "<uuid>",
    "route_id":            "<uuid>",            // optional
    "source_location_id":  "<uuid>",            // optional; falls back to tenant default
    "destination_address": "...",               // optional
    "vehicle_number":      "MH-12-AB-1234",     // optional
    "driver_name":         "...",               // optional
    "driver_phone":        "...",               // optional
    "print_mode":          "no_amount",         // 'with_remarks' | 'no_amount'; default 'no_amount'
    "remarks":             "..."
  }

Response 201 — `Challan` with status="draft", is_billed=false, zeroed totals.
```

Validation (server-side):

- `challan_number` unique per tenant if supplied
- `party_id` must exist in tenant and have `party_type IN ('customer','both')`
- `route_id` if supplied must belong to tenant and be active
- `source_location_id` if supplied must belong to tenant
- `print_mode` must be one of the allowed values
- `challan_date` ≤ today

### 5.3 Add a line

```
POST /challans/{challan_id}/lines
Body:
  {
    "item_id":      "<uuid>",
    "description":  "Laptop 14\" Pro",
    "uom_id":       "<uuid>",
    "quantity":     "2",
    "unit_price":   "850",                     // optional; required if print_mode='with_remarks'
    "discount_pct": "0",                       // optional, default "0"
    "rate_pct":     "18",                      // optional; carries forward on promote-to-invoice
    "hsn_code":     "8471",                    // optional; carries forward on promote-to-invoice
    "lot_id":       "<uuid>",                  // required if item.is_batch_tracked
    "serial_id":    "<uuid>",                  // required if item.is_serial_tracked
    "remarks":      "..."
  }

Response 201 — `ChallanLine`. `line_total` = (quantity × unit_price) × (1 − discount_pct/100), or 0 if unit_price absent.
```

Server-side responsibilities on every line write:

1. Validate the challan is in `status='draft'` (mutating posted challans is forbidden).
2. Recompute and update `challans.subtotal`, `challans.discount_total`, `challans.grand_total`.
3. Increment `challans.version`.

**Note:** the challan does NOT compute GST. Tax math only happens when (and if) the challan is promoted to an invoice. The `rate_pct` and `hsn_code` on the line are hints carried forward, not active tax fields.

### 5.4 Update / delete a line

```
PATCH /challans/{challan_id}/lines/{line_id}
DELETE /challans/{challan_id}/lines/{line_id}
```

Both require `status='draft'`. Both trigger header-total recomputation.

### 5.5 Post

```
POST /challans/{id}/post
Body: {} (or empty)

Response 200 — Challan with status="posted", posting_date=now(), version+=1
```

Side effects (transactional — must all succeed or all roll back):

1. For each line:
   a. Check `qty_available >= quantity` at `source_location_id` (or tenant-default location). Currently global pool — Phase 2.5 will add per-location selection for invoices and challans together.
   b. If insufficient, fail with `422 INSUFFICIENT_STOCK` and `field_errors[lines.{idx}.quantity]`.
   c. Create an OUT `movement` row referencing this challan (`reference_doc_type='challan'`, `reference_doc_id=challan_id`).
   d. Update `balances.qty_on_hand` and `qty_available`.
2. Set `challan.status='posted'`, `posting_date=now()`, `version += 1`.

Idempotency: re-posting a posted challan → `409 CHALLAN_NOT_DRAFT`.

**No ledger entries.** Challans are physical-movement only; the financial entry is created by the (eventual) invoice.

### 5.6 Cancel

```
POST /challans/{id}/cancel
Body:
  { "reason": "Goods returned undelivered — vehicle breakdown" }

Response 200 — Challan with status="cancelled", cancelled_at=now(), version+=1
```

Side effects (transactional):

1. **Forbid if `is_billed=true`.** Cancelling a billed challan would orphan the invoice. Caller must cancel the invoice first; only then can the challan be cancelled. Error: `409 CHALLAN_BILLED`.
2. For each OUT movement created on Post:
   a. Create a paired IN reversal movement with `reference_movement_id` pointing at the original.
   b. Restore `balances.qty_on_hand`.
3. Set `challan.status='cancelled'`, `cancelled_at=now()`, `cancellation_reason`, `version += 1`.

Idempotency: cancelling a non-posted challan → `409 CHALLAN_NOT_POSTED`.

### 5.7 Delete

```
DELETE /challans/{id}

Response 204
```

Only allowed on drafts. Cascading delete of `challan_lines`. Posted/cancelled → `409 CHALLAN_NOT_DRAFT`.

### 5.8 Promote to invoice (the headline action)

```
POST /challans/{id}/promote-to-invoice
Body:
  {
    "place_of_supply": "27",                   // required — drives GST split on the new invoice
    "due_date":        "2026-05-26",           // optional
    "invoice_number":  "INV/2026-04/0001",     // optional; allocate from number_series if absent
    "remarks":         "..."                   // optional; defaults to challan.remarks
  }

Response 201 — newly-created `Invoice` (status="draft", lines pre-populated)
```

Server-side responsibilities (transactional — must all succeed or all roll back):

1. **Validation:**
   a. Challan exists and `status='posted'` → else `409 CHALLAN_NOT_POSTED`.
   b. Challan `is_billed=false` → else `409 CHALLAN_ALREADY_BILLED`.
   c. `place_of_supply` is a known 2-digit state code → else `422 INVALID_PLACE_OF_SUPPLY`.
   d. Caller has BOTH `inventory.invoices.write` AND `inventory.challans.write` → else `403 PERMISSION_DENIED`.
2. **Create the invoice draft:**
   - `invoice_number` from body, or allocate via number_series.
   - `invoice_date = today`, `party_id = challan.party_id`, `place_of_supply` from body, `challan_id = <this challan's id>`.
   - Status `'draft'`, totals zeroed.
3. **Copy the lines** — for each `challan_lines` row, create a corresponding `invoice_lines` row:
   - `item_id`, `uom_id`, `quantity`, `unit_price`, `discount_pct` copied verbatim.
   - `description` copied (or fall back to item name).
   - `hsn_code` from `challan_lines.hsn_code` if set, else from `items.hsn_code`. If still null → `422 HSN_REQUIRED_FOR_INVOICE` with `field_errors[lines.{idx}.hsn_code]`.
   - `rate_pct` from `challan_lines.rate_pct` if set, else from `items.default_tax_rate_pct`. If still null → `422 RATE_REQUIRED_FOR_INVOICE`.
   - `cess_pct` defaults to "0".
   - GST math computed per the rules in INVOICE_BACKEND_SPEC.md §2 — header `place_of_supply` vs tenant `state_code` decides intra-/inter-state.
   - `lot_id` / `serial_id` carried forward.
4. **Mark the challan billed:** `challans.is_billed=true`, `challans.invoice_id=<new invoice id>`, `version += 1`.
5. **No new movements.** The OUT movement was already created on challan Post; the invoice will not double-post stock. (When the invoice itself is later Posted, the post handler must detect that `invoice.challan_id` is set and **skip** the stock OUT step — the goods already left on the challan. See INVOICE_BACKEND_SPEC.md §4.5 for the matching change.)

**Error matrix:**

| HTTP | Code | Trigger |
| --- | --- | --- |
| 409 | `CHALLAN_NOT_POSTED` | challan.status != 'posted' |
| 409 | `CHALLAN_ALREADY_BILLED` | challan.is_billed = true |
| 422 | `INVALID_PLACE_OF_SUPPLY` | place_of_supply not in INDIAN_STATES |
| 422 | `HSN_REQUIRED_FOR_INVOICE` | line has no hsn_code and item has no default |
| 422 | `RATE_REQUIRED_FOR_INVOICE` | line has no rate_pct and item has no default |

### 5.9 Routes — list + detail

```
GET /routes?is_active=true|false
GET /routes/{id}
```

Plain `Route[]` and `Route` respectively. POST/PATCH/DELETE for routes are **out of scope for Phase 2.5**; tenants seed via SQL until the routes admin page lands.

---

## 6. Error codes (FE handles these specifically)

| HTTP | Code | When |
| --- | --- | --- |
| 422 | `INSUFFICIENT_STOCK` | Post failed because available < requested. `field_errors[lines.0.quantity]: "only N available"` |
| 422 | `INVALID_PLACE_OF_SUPPLY` | Promote called with unknown 2-digit state code |
| 422 | `HSN_REQUIRED_FOR_INVOICE` | Promote: line has no HSN and item has no default |
| 422 | `RATE_REQUIRED_FOR_INVOICE` | Promote: line has no rate and item has no default |
| 409 | `CHALLAN_NOT_DRAFT` | Mutation attempted on non-draft |
| 409 | `CHALLAN_NOT_POSTED` | Cancel/Promote attempted on non-posted |
| 409 | `CHALLAN_ALREADY_BILLED` | Promote attempted on already-billed challan |
| 409 | `CHALLAN_BILLED` | Cancel attempted while is_billed=true (cancel the invoice first) |
| 409 | `VERSION_MISMATCH` | Optimistic-lock conflict on PATCH |
| 404 | `CHALLAN_NOT_FOUND` | |
| 403 | `PERMISSION_DENIED` | Caller lacks the required `inventory.challans.*` perm |

---

## 7. Permissions

Four new permission codes for challans, plus two for routes — all already seeded on the FE in `src/lib/demo/fixtures.ts`:

| Code | Required for |
| --- | --- |
| `inventory.challans.read` | GET list, GET detail, GET lines, view print page |
| `inventory.challans.write` | POST create, POST line, PATCH line, DELETE line, DELETE challan |
| `inventory.challans.post` | POST `/challans/{id}/post` |
| `inventory.challans.cancel` | POST `/challans/{id}/cancel` |
| `inventory.routes.read` | GET `/routes`, GET `/routes/{id}` |
| `inventory.routes.write` | (reserved for the future routes admin page; not used in Phase 2.5) |

**Promote** (`POST /challans/{id}/promote-to-invoice`) requires **both** `inventory.challans.write` AND `inventory.invoices.write` — it mutates both resources. The FE already gates the "Convert to invoice" action on this combination via `useCan().canAll([...])`.

Each is a separate gate so tenants can mix-and-match per role:

- **Driver / Dispatcher** — `challans.read + challans.write` (creates drafts, can't post)
- **Warehouse Lead** — challans all four + `routes.read`
- **Sales Lead** — challans all four + `invoices.write` (so they can promote)
- **Auditor / Viewer** — `read` only on both

The existing `/admin/roles/[id]` permission grid surfaces these automatically once the seed migration runs.

---

## 8. Number Series

Challan numbers come from the existing `number_series` master-data table when not supplied in the POST. Seed at least one series per tenant:

```sql
INSERT INTO number_series (tenant_id, code, entity, prefix, padding, current_value, start_value, ...)
VALUES (..., 'DC', 'challan', 'DC/2026-04/', 4, 0, 0, ...);
```

The series allocator is the same one as Invoices — transactional, increment-safe (`SELECT FOR UPDATE` on the row). FE already calls into the existing series infra; no new endpoint needed.

---

## 9. Tests the backend should ship

Mirror the FE smoke flow at the API level:

```
test_create_draft_challan_returns_zero_totals
test_add_line_recomputes_header_totals
test_post_creates_movements_and_decrements_balance
test_post_fails_with_insufficient_stock
test_cannot_modify_posted_challan
test_cannot_post_already_posted_challan
test_cannot_cancel_draft_or_cancelled_challan
test_cannot_cancel_billed_challan
test_cannot_delete_posted_challan
test_challan_number_unique_per_tenant
test_route_must_belong_to_tenant
test_print_mode_persisted_and_returned

# Promote-to-invoice round-trip
test_promote_creates_draft_invoice_with_copied_lines
test_promote_marks_challan_billed_and_links_invoice_id
test_promote_carries_hsn_and_rate_forward
test_promote_falls_back_to_item_default_hsn_and_rate
test_promote_fails_when_challan_not_posted
test_promote_fails_when_challan_already_billed
test_promote_fails_with_invalid_place_of_supply
test_promote_fails_when_line_has_no_hsn_or_default
test_promote_does_not_double_post_stock
test_invoice_post_skips_stock_out_when_challan_id_set

# Permissions
test_promote_requires_both_challans_write_and_invoices_write
test_super_admin_can_act_cross_tenant_via_x_acting_tenant_id
test_permission_denied_without_challans_read
```

---

## 10. Out of scope for Phase 2.5

Tracked here so they don't sneak in:

- **e-Way Bill generation** — Phase 4. Separate NIC integration. The challan number is the carrier; eWB schema fields (`eway_bill_number`, `eway_bill_valid_until`) already implied.
- **Multi-challan → single invoice** — current contract is 1 challan : 1 invoice. M:1 (consolidating a week of deliveries onto one bill) is a Phase 3 ask.
- **Partial billing** — billing only some lines of a challan and carrying the rest forward. Phase 3.
- **Per-line place-of-supply** — single POS per invoice still applies after promote.
- **Routes admin page** (full CRUD UI, route ↔ user assignment) — deferred.
- **Driver app / mobile dispatch** — separate frontend, not this repo.

---

## 11. Frontend status

What's already built and waiting for backend (no further FE work blocks shipping):

| Surface | File | Behaviour today |
| --- | --- | --- |
| List | `src/app/(dashboard)/challans/page.tsx` | Filters (status, billed, route), sort, RBAC-gated row actions, status + billed badges, "Convert to invoice" action |
| Create | `src/app/(dashboard)/challans/new/page.tsx` | Route picker, vehicle/driver fields, print-mode toggle, available-qty hint per line |
| Detail | `src/app/(dashboard)/challans/[id]/page.tsx` | View, Post, Cancel, **Convert to invoice** — all RBAC-gated; linked-invoice banner once promoted |
| Print | `src/app/(dashboard)/challans/[id]/print/page.tsx` | A4 layout, two modes (with_remarks / no_amount) toggleable on toolbar |
| Service | `src/services/challans.service.ts` | All endpoints in §5 wired (list, getById, create, update, delete, post, cancel, line CRUD, **promoteToInvoice**) |
| Routes service | same file | `routeService.list/getById` |
| Demo adapter | `src/lib/demo/adapter.ts` | All endpoints mocked; demo mode fully clickable |
| Sidebar | `src/components/layout/sidebar.tsx` | "Billing" group with Challans + Invoices entries (gated by their respective `read` perms) |
| Invoice picker | `src/app/(dashboard)/invoices/new/page.tsx` | Top-of-card "Source challan" dropdown — auto-fills customer + lines on pick, locks customer field |

When the backend ships these endpoints with matching shapes, **no FE changes are required**. The demo adapter stays intact so sales/preview keeps working without a backend.

---

## 12. Sequence to ship (suggested order)

1. **Migration** — `routes` table, `challans` + `challan_lines` tables, `invoices.challan_id` column + unique partial index.
2. **Number series seeding** — at least one `DC` series per tenant.
3. **Permission seeding** — insert the 4 new challan permission codes + 2 routes codes.
4. **Routes endpoints** — list + detail (read-only is fine for Phase 2.5).
5. **Service layer** — `challan_service.py`: create, list, get, line CRUD, post, cancel.
6. **Promote handler** — `challan_service.promote_to_invoice()`. Cross-module; touches both `challans` and `invoices` (and `invoice_lines`). Must be transactional.
7. **Invoice post handler tweak** — skip stock OUT when `invoice.challan_id IS NOT NULL`.
8. **Endpoints** — the 8 routes in §5 (challans 7 + routes 2; the routes detail endpoint is in §5.9).
9. **Tests** — §9.
10. **Smoke test integration** — extend `frontend/scripts/smoke-test-api.sh` with challan round-trip (create draft, add line, post, promote-to-invoice, post the invoice, verify movements were created exactly once, cancel the invoice, cancel the challan, verify reversals).

After that, FE flips from demo adapter to real backend by setting `NEXT_PUBLIC_DEMO_MODE=false` in `.env.local` — nothing else changes.
