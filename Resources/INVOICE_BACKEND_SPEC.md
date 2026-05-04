# Invoice Module — Backend Specification

> **Status:** Living document. Updated as the FE prototype matures.
> **Last revised:** 2026-04-26
> **Origin:** derived from working FE prototype at `src/app/(dashboard)/invoices/*`
> **Companion:** [CLIENT_NEEDS_GAP.md](CLIENT_NEEDS_GAP.md) §Phase 2
> **For backend dev:** this is the contract. Build the API to satisfy it; FE will swap from demo adapter to real endpoints with zero further FE changes.

---

## 1. Overview

The Invoice module adds **GST-compliant tax invoices** to the IMS. An invoice is **distinct from a generic Document** (PO/SO/Transfer) because it carries:

- Per-line GST split (CGST + SGST + IGST + Cess)
- HSN/SAC classification
- Place-of-supply (drives the split)
- Future: e-Invoice IRN + signed QR (Phase 4 — out of scope here)

Status flow:

```
draft  →  posted  →  cancelled
   \-----→ deleted (only from draft)
```

- **Draft** — fully editable. No stock movement. No ledger entry. Can be deleted.
- **Posted** — locked. Stock OUT movements created. Ledger entries written. Cannot be edited.
- **Cancelled** — reversal movements posted. Original kept for audit. Cannot be re-edited.

---

## 2. GST Logic — explained

This is the math the backend must implement and the FE has already implemented in [`src/lib/gst.ts`](../src/lib/gst.ts) (with 22 unit tests). Both sides must agree exactly to the rupee.

### 2.1 The three components

| Tax      | Stands for     | Levied by                                                 |
| -------- | -------------- | --------------------------------------------------------- |
| **CGST** | Central GST    | Central government                                        |
| **SGST** | State GST      | State government (where supply is delivered)              |
| **IGST** | Integrated GST | Central, then split between origin and destination states |

### 2.2 The split rule (place-of-supply)

```
seller_state == place_of_supply  →  intra-state  →  CGST + SGST
seller_state != place_of_supply  →  inter-state  →  IGST
```

The full GST rate is split **half to CGST, half to SGST** for intra-state. The full rate goes to **IGST** for inter-state. **It's never both** — you don't ever charge CGST + SGST + IGST on the same line.

### 2.3 Place of supply — quick rules

For **goods**, place of supply is generally:

- The location where movement of goods terminates for delivery to the recipient (the buyer's delivery state).
- For ex-factory pickups: where the goods actually go, not where they were picked up.
- For B2C with no specific delivery: the supplier's location.

Place of supply is **always a 2-digit state code** (see `INDIAN_STATES` in `src/lib/gst.ts`). The FE captures it on the invoice header; the backend stores it on the invoice record.

### 2.4 Worked examples

**Example A — intra-state (Maharashtra seller → Maharashtra buyer)**

```
unit_price = 100, quantity = 10, discount_pct = 0, rate_pct = 18%
seller_state = "27", place_of_supply = "27"

taxable_value = 100 × 10 = 1000.00
total_tax     = 1000 × 0.18 = 180.00
intra-state   → split 50/50:
  cgst_amount = 90.00     (9% of taxable)
  sgst_amount = 90.00     (9% of taxable)
  igst_amount = 0.00
line_total    = 1000 + 180 = 1180.00
```

**Example B — inter-state (Maharashtra seller → Delhi buyer)**

```
unit_price = 200, quantity = 5, rate_pct = 18%
seller_state = "27", place_of_supply = "07"

taxable_value = 200 × 5 = 1000.00
total_tax     = 1000 × 0.18 = 180.00
inter-state   → all to IGST:
  cgst_amount = 0.00
  sgst_amount = 0.00
  igst_amount = 180.00
line_total    = 1000 + 180 = 1180.00
```

**Example C — with discount**

```
unit_price = 100, quantity = 10, discount_pct = 10%, rate_pct = 18%, intra-state

gross         = 100 × 10 = 1000
discount      = 1000 × 0.10 = 100
taxable_value = 1000 − 100 = 900       ← discount applied BEFORE tax
total_tax     = 900 × 0.18 = 162
cgst_amount   = 81.00
sgst_amount   = 81.00
line_total    = 900 + 162 = 1062.00
```

**Example D — with cess (e.g. tobacco, automobile)**

```
unit_price = 1000, quantity = 1, rate_pct = 28%, cess_pct = 12%, intra-state

taxable_value = 1000
total_tax     = 1000 × 0.28 = 280  → cgst 140 + sgst 140
cess_amount   = 1000 × 0.12 = 120
line_total    = 1000 + 280 + 120 = 1400.00
```

### 2.5 Rounding rule

Round each line's individual tax amounts **to 2 decimal places** before summing. This matches GSTN guidance and what the FE produces. Don't round at the invoice level by computing `total_tax = subtotal × avg_rate` — that loses paise on mixed-rate invoices.

### 2.6 Mixed-rate / mixed-state invoices

A single invoice can have lines at different rates (one line at 5%, another at 18%) and even with different place-of-supply per-line in some edge cases (e.g. ex-factory + delivered combos). For Phase 2 we lock place-of-supply at the **header** level (one POS per invoice) — backend must validate this constraint.

### 2.7 Rate validation

The standard rates in India are: **0, 0.25, 3, 5, 12, 18, 28**. Backend should accept any non-negative number (rare notifications introduce non-standard rates) but warn on rates outside the standard set. Validation: `0 <= rate_pct <= 100`.

### 2.8 GSTIN validation

15-character GSTIN format:

```
2 digits  state code        e.g. "27"
10 chars  PAN                e.g. "AAACA0001Z"
1  digit  entity code        e.g. "1"
1  char   "Z" (literal)
1  char   checksum (alphanumeric)
```

Regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$`

Backend should validate structure on Party.gstin when `is_gst_registered=true`. Checksum verification is optional (NIC's tool does it; we don't have to duplicate).

### 2.9 HSN/SAC validation

4, 6, or 8 digits. Regex: `^[0-9]{4}([0-9]{2}([0-9]{2})?)?$`. Required on every invoice line for GST-registered tenants; optional for unregistered.

---

## 3. Database schema

### 3.1 Tables

**`invoices`** (one row per invoice header)

```sql
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),

  -- Identity
  invoice_number      TEXT NOT NULL,                       -- e.g. "INV/2026-04/0001"
  invoice_date        DATE NOT NULL,
  due_date            DATE,

  -- Counter-party
  party_id            UUID NOT NULL REFERENCES parties(id),
  place_of_supply     CHAR(2) NOT NULL,                    -- 2-digit state code

  -- State machine
  status              TEXT NOT NULL                        -- 'draft' | 'posted' | 'cancelled'
                      CHECK (status IN ('draft','posted','cancelled'))
                      DEFAULT 'draft',

  -- Linkage (Phase 2.5)
  challan_id          UUID REFERENCES challans(id),         -- null for direct invoices

  -- e-Invoice (Phase 4)
  irn                 TEXT,
  qr_code_data        TEXT,

  -- Cached totals (populated by service after every line write)
  subtotal            NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total         NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_in_words     TEXT,

  -- Notes
  remarks             TEXT,

  -- Lifecycle
  posting_date        TIMESTAMPTZ,                          -- set on Post
  cancelled_at        TIMESTAMPTZ,                          -- set on Cancel
  cancellation_reason TEXT,

  -- Audit / optimistic locking
  version             INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,

  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_tenant_party  ON invoices(tenant_id, party_id);
CREATE INDEX idx_invoices_tenant_date   ON invoices(tenant_id, invoice_date DESC);
```

**`invoice_lines`** (one row per line)

```sql
CREATE TABLE invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number     INT NOT NULL,                              -- 1-based, contiguous

  -- What's being sold
  item_id         UUID NOT NULL REFERENCES items(id),
  hsn_code        TEXT NOT NULL,
  description     TEXT,
  uom_id          UUID NOT NULL REFERENCES uoms(id),
  quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),

  -- Pricing
  unit_price      NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),

  -- Tax (computed by service; persisted for audit immutability)
  rate_pct        NUMERIC(5,2)  NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
  taxable_value   NUMERIC(15,2) NOT NULL,
  cgst_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  cess_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total      NUMERIC(15,2) NOT NULL,

  -- Optional batch / serial linkage
  lot_id          UUID REFERENCES lots(id),
  serial_id       UUID REFERENCES serials(id),

  remarks         TEXT,

  UNIQUE (invoice_id, line_number)
);
```

### 3.2 Required additions to existing tables

```sql
ALTER TABLE items ADD COLUMN hsn_code             TEXT;
ALTER TABLE items ADD COLUMN default_sale_price   NUMERIC(15,4);
ALTER TABLE items ADD COLUMN default_tax_rate_pct NUMERIC(5,2);

ALTER TABLE parties ADD COLUMN is_gst_registered BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE parties ADD COLUMN gstin             TEXT;
ALTER TABLE parties ADD COLUMN state_code        CHAR(2);
ALTER TABLE parties ADD COLUMN description       TEXT;

ALTER TABLE tenants ADD COLUMN state_code CHAR(2);
ALTER TABLE tenants ADD COLUMN gstin      TEXT;
```

DB constraint to enforce GSTIN format when registered:

```sql
ALTER TABLE parties ADD CONSTRAINT parties_gstin_when_registered
  CHECK (
    is_gst_registered = false
    OR (gstin IS NOT NULL AND gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$')
  );
```

---

## 4. API contract

All routes on the **inventory service** (`:8001/api/v1`). All require an `Authorization: Bearer <access>` header. Multi-tenant scoping via the JWT's `tid` claim (or `X-Acting-Tenant-Id` for super-admin overrides).

### 4.1 List invoices

```
GET /invoices
  ?limit=100               (default 50, max 200 — clamped at FE per CLAUDE.md)
  ?cursor=<opaque>
  ?party_id=<uuid>
  ?status=draft|posted|cancelled
  ?start_date=YYYY-MM-DD
  ?end_date=YYYY-MM-DD

Response 200 — `Invoice[]` (plain array; FE uses unwrapList)
```

`Invoice` shape — see [`src/types/index.ts`](../src/types/index.ts).

### 4.2 Create draft

```
POST /invoices
Body:
  {
    "invoice_number": "INV/2026-04/0001",   // optional; allocate from number_series if absent
    "invoice_date":   "2026-04-26",
    "due_date":       "2026-05-26",          // optional
    "party_id":       "<uuid>",
    "place_of_supply":"27",
    "challan_id":     "<uuid>",              // optional, for promote-from-challan flow
    "remarks":        "..."
  }

Response 201 — `Invoice` with status="draft" and zeroed totals.
```

Validation (server-side):

- `invoice_number` unique per tenant if supplied
- `party_id` must exist in tenant and have `party_type IN ('customer','both')`
- `place_of_supply` must be a known state code
- `invoice_date` ≤ today

### 4.3 Add a line

```
POST /invoices/{invoice_id}/lines
Body:
  {
    "item_id":      "<uuid>",
    "hsn_code":     "8471",
    "description":  "Laptop 14\" Pro",
    "uom_id":       "<uuid>",
    "quantity":     "2",
    "unit_price":   "850",
    "discount_pct": "0",
    "rate_pct":     "18",
    "cess_pct":     "0",                     // optional, default "0"
    "lot_id":       "<uuid>",                // required if item.is_batch_tracked
    "serial_id":    "<uuid>",                // required if item.is_serial_tracked
    "remarks":      "..."
  }

Response 201 — `InvoiceLine` with computed `taxable_value`, `cgst/sgst/igst/cess_amount`, `line_total`.
```

Server-side responsibilities on every line write:

1. Validate the invoice is in `status='draft'` (mutating posted invoices is forbidden).
2. Look up tenant `state_code`. If null, fail with `422 TENANT_STATE_REQUIRED`.
3. Compute the GST split using the formula in §2.
4. Persist the computed values (NOT just the rate — store the actual amounts so audits don't recompute).
5. Recompute and update `invoices.subtotal`, `invoices.tax_total`, `invoices.grand_total`, `invoices.amount_in_words`.
6. Increment `invoices.version`.

### 4.4 Update / delete a line

```
PATCH /invoices/{invoice_id}/lines/{line_id}
DELETE /invoices/{invoice_id}/lines/{line_id}
```

Both require `status='draft'`. Both trigger header-total recomputation.

### 4.5 Post

```
POST /invoices/{id}/post
Body: {} (or empty)

Response 200 — Invoice with status="posted", posting_date=now(), version+=1
```

Side effects (transactional — must all succeed or all roll back):

1. For each line:
   a. Check `qty_available >= quantity` at the line's location (currently global pool — Phase 2.5 will add per-location selection).
   b. If insufficient, fail with `422 INSUFFICIENT_STOCK` and `field_errors[lines.{idx}.quantity]`.
   c. Create an OUT `movement` row referencing this invoice.
   d. Update `balances.qty_on_hand` and `qty_available`.
2. Write a `ledger_entry` (Phase 3 — schema TBD; for now the ledger module is out of scope).
3. Set `invoice.status='posted'`, `posting_date=now()`, `version += 1`.
4. Optionally: trigger e-Invoice IRN generation (Phase 4) — out of scope.

Idempotency: re-posting a posted invoice → `409 INVOICE_NOT_DRAFT`.

### 4.6 Cancel

```
POST /invoices/{id}/cancel
Body:
  { "reason": "Wrong unit price — reissued as INV/2026-04/0004" }

Response 200 — Invoice with status="cancelled", cancelled_at=now(), version+=1
```

Side effects (transactional):

1. For each OUT movement created on Post:
   a. Create a paired IN reversal movement with `reference_movement_id` pointing at the original.
   b. Restore `balances.qty_on_hand`.
2. Reverse all ledger entries created on Post.
3. Set `invoice.status='cancelled'`, `cancelled_at=now()`, `cancellation_reason`, `version += 1`.

Idempotency: cancelling a non-posted invoice → `409 INVOICE_NOT_POSTED`.

### 4.7 Delete

```
DELETE /invoices/{id}

Response 204
```

Only allowed on drafts. Cascading delete of `invoice_lines`. Posted/cancelled → `409 INVOICE_NOT_DRAFT`.

---

## 5. Error codes (FE handles these specifically)

| HTTP | Code                      | When                                                                                            |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| 422  | `INSUFFICIENT_STOCK`      | Post failed because available < requested. `field_errors[lines.0.quantity]: "only N available"` |
| 422  | `INVALID_GSTIN`           | Party GSTIN failed regex when `is_gst_registered=true`                                          |
| 422  | `INVALID_HSN`             | HSN failed regex (4/6/8 digits)                                                                 |
| 422  | `INVALID_PLACE_OF_SUPPLY` | Unknown 2-digit state code                                                                      |
| 422  | `TENANT_STATE_REQUIRED`   | Tenant.state_code is null; cannot compute place-of-supply matrix                                |
| 409  | `INVOICE_NOT_DRAFT`       | Mutation attempted on non-draft                                                                 |
| 409  | `INVOICE_NOT_POSTED`      | Cancel attempted on non-posted                                                                  |
| 409  | `VERSION_MISMATCH`        | Optimistic-lock conflict on PATCH                                                               |
| 404  | `INVOICE_NOT_FOUND`       |                                                                                                 |
| 403  | `PERMISSION_DENIED`       | Caller lacks the required `inventory.invoices.*` perm                                           |

---

## 6. Permissions

Four new permission codes, already seeded on the FE in `src/lib/demo/fixtures.ts`:

| Code                        | Required for                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `inventory.invoices.read`   | GET list, GET detail, GET lines, view print page                |
| `inventory.invoices.write`  | POST create, POST line, PATCH line, DELETE line, DELETE invoice |
| `inventory.invoices.post`   | POST `/invoices/{id}/post`                                      |
| `inventory.invoices.cancel` | POST `/invoices/{id}/cancel`                                    |

Each is a separate gate so tenants can mix-and-match per role:

- **Sales Clerk** — `read + write` (creates drafts but can't post)
- **Billing Lead** — all four
- **Auditor / Viewer** — `read` only

The existing `/admin/roles/[id]` permission grid surfaces these automatically once the seed migration runs.

---

## 7. Number Series

Invoice numbers come from the existing `number_series` master-data table when not supplied in the POST. Seed at least one series per tenant:

```sql
INSERT INTO number_series (tenant_id, code, entity, prefix, padding, current_value, start_value, ...)
VALUES (..., 'INV', 'invoice', 'INV/2026-04/', 4, 0, 0, ...);
```

The series allocator must be transactional and increment-safe (`SELECT FOR UPDATE` on the row). FE already calls into the existing series infra; no new endpoint needed.

---

## 8. Tests the backend should ship

Mirror the FE's GST math suite at the API level — every example in §2.4 should be a backend integration test. Plus:

```
test_create_draft_invoice_returns_zero_totals
test_add_line_recomputes_header_totals
test_intra_state_line_gets_cgst_sgst_split
test_inter_state_line_gets_igst_only
test_discount_applied_before_tax
test_cess_added_on_top_of_gst
test_post_creates_movements_and_decrements_balance
test_post_fails_with_insufficient_stock
test_cancel_creates_reversal_movements
test_cancel_restores_balance
test_cannot_modify_posted_invoice
test_cannot_post_already_posted_invoice
test_cannot_cancel_draft_or_cancelled_invoice
test_cannot_delete_posted_invoice
test_invoice_number_unique_per_tenant
test_gstin_format_enforced_when_registered
test_hsn_format_validated_on_line
test_place_of_supply_must_be_known_state
test_super_admin_can_act_cross_tenant_via_x_acting_tenant_id
test_permission_denied_without_invoices_read
```

---

## 9. Out of scope for Phase 2

Tracked here so they don't sneak in:

- **e-Invoice IRN / QR generation** — Phase 4. NIC API integration. Schema fields exist; service stubbed.
- **e-Way Bill generation** — Phase 4. Separate NIC integration.
- **Bill of Supply** (composition-scheme sellers, exempt goods) — schema flag needed, deferred.
- **Per-line place-of-supply** — single-POS-per-invoice in Phase 2; per-line in a future iteration.
- **Multi-currency invoices** — INR-only for Phase 2.
- **Reverse charge** — sub-feature of GST not modelled here.
- **Composite vs mixed supply rules** — outside Phase 2.

---

## 10. Frontend status

What's already built and waiting for backend (no further FE work blocks shipping):

| Surface      | File                                               | Behaviour today                                                           |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------------------- |
| List         | `src/app/(dashboard)/invoices/page.tsx`            | Filters, sort, RBAC-gated row actions, status badges                      |
| Create       | `src/app/(dashboard)/invoices/new/page.tsx`        | Live GST math, available-qty hint per line, save-as-draft / save-and-post |
| Detail       | `src/app/(dashboard)/invoices/[id]/page.tsx`       | View, Post, Cancel — all RBAC-gated                                       |
| Print        | `src/app/(dashboard)/invoices/[id]/print/page.tsx` | A4 layout, conditional CGST+SGST vs IGST columns                          |
| Service      | `src/services/invoices.service.ts`                 | All endpoints in §4 wired, returns typed responses                        |
| GST math     | `src/lib/gst.ts` (+ 22 tests)                      | Single source of truth — backend should match exactly                     |
| Demo adapter | `src/lib/demo/adapter.ts`                          | All endpoints mocked; demo mode fully clickable                           |

When the backend ships these endpoints with matching shapes, **no FE changes are required**. The demo adapter stays intact so sales/preview keeps working without a backend.

---

## 11. Sequence to ship (suggested order)

1. **Migration** — schema additions to `items`, `parties`, `tenants` + new `invoices` and `invoice_lines` tables.
2. **Number series seeding** — at least one `INV` series per tenant.
3. **Permission seeding** — insert the 4 new permission codes.
4. **Service layer** — `invoice_service.py`: create, list, get, line CRUD, post, cancel.
5. **GST math module** — port the exact logic from `src/lib/gst.ts`. Same test cases.
6. **Endpoints** — the 7 routes in §4.
7. **Tests** — §8.
8. **Smoke test integration** — extend `frontend/scripts/smoke-test-api.sh` with invoice round-trip (create draft, add line, post, verify movements, cancel, verify reversal).

After that, FE flips from demo adapter to real backend by setting `NEXT_PUBLIC_DEMO_MODE=false` in `.env.local` — nothing else changes.
