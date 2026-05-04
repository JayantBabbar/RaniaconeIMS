# Phase 13 — Item Dimensions + Versioned Pricing Rules (REQ-17) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-02 · FE prototype: complete

> Pairs with `frontend/src/services/pricing.service.ts`,
> `/master-data/item-pricing` page, and the dimension fields added
> to the document/invoice/challan line forms.

---

## §1 Overview

For Nova Bond's ACP catalog, the sale price isn't a single number per
item — it varies by **thickness** (2/3/4/5 mm) and **panel size**
(1220×2440, 1220×3050, 1220×3660). Mr. Arpit sets a price that holds
until he updates it; old invoices keep their original price.

This phase adds:
1. **`item_dimensions`** — fixed lookup of (thickness, size) combos
2. **`item_pricing_rules`** — versioned per-(item, dimension) prices
3. **Dimension fields on line documents** — invoice / challan / GRN /
   PO / transfer lines now carry `thickness_mm` and `size_code`
4. **Auto-lookup** — when Operator/Admin picks item + thickness + size
   on a line, the form fetches the active rule and pre-fills `unit_price`

| Endpoint | Purpose |
|---|---|
| `GET /item-dimensions` | List active dimension combinations |
| `GET /pricing-rules?item_id=&active_only=` | List rules (filterable) |
| `GET /pricing-rules/lookup?item_id=&thickness_mm=&size_code=&as_of=` | Active rule for the given combo + date |
| `POST /pricing-rules` | Create new rule (auto-closes prior active rule) |

---

## §2 Critical scope decisions

### 2.1 Single active rule per (item × thickness × size)

At any moment in time, exactly **one** `item_pricing_rules` row per
combination has `valid_until = NULL`. When `POST /pricing-rules`
creates a new rule, the prior active rule's `valid_until` is set to
`(new.valid_from − 1 day)` in the same transaction.

Why: ensures lookup is deterministic; no overlapping rules.

### 2.2 Lines snapshot their price

Existing `unit_price` on invoice/challan/document lines stores the
price *at the time the line was created*. Pricing rule changes do
NOT mutate historical lines.

So if Mr. Arpit raises NB-1101 + 3mm + 4×8 from ₹5,500 to ₹5,800
today, all invoices posted before today still show ₹5,500 per sheet.

### 2.3 Lookup contract

```
SELECT * FROM item_pricing_rules
WHERE tenant_id = :tenant
  AND item_id = :item
  AND thickness_mm = :thickness
  AND size_code = :size
  AND valid_from <= :as_of
  AND (valid_until IS NULL OR valid_until >= :as_of)
LIMIT 1
```

Returns NULL if no rule exists for the combo. The FE shows an amber
warning in that case — user can still proceed by typing a manual
unit_price.

### 2.4 Dimensions are tenant-scoped but rarely change

For Nova Bond: 12 fixed combos. For another tenant in another
industry: maybe none, maybe different combos. Backend should support
dimension creation but most installations seed once and forget.

### 2.5 Operator vs Admin visibility

Pricing rules contain sale prices, which are sensitive. The
`/master-data/item-pricing` page is gated on
`inventory.master_data.read` (Admin only). Operator never sees the
prices in this UI.

But — Operator DOES see `unit_price` on Sales Order / Challan lines
(per §8 of the client spec: "the operator sees sale price, not
cost"). The auto-lookup serves the Operator a number; they don't
need to know it's pulled from the rules table.

### 2.6 Cost vs sale price split

This phase is about **sale prices**. Cost prices are still a separate
concept and live on Vendor Bills (per Phase 12). The pricing rules
table here is sale-side only.

If later we add cost-side versioning, it'd be a separate
`item_cost_rules` table with the same versioning pattern, gated on
`inventory.cost.read`.

---

## §3 Database schema

```sql
CREATE TABLE item_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  thickness_mm INTEGER NOT NULL,
  size_code TEXT NOT NULL,           -- e.g. "1220x2440"
  label TEXT NOT NULL,                -- e.g. "2mm · 1220 × 2440 mm (4×8 ft)"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, thickness_mm, size_code)
);

CREATE TABLE item_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  item_id UUID NOT NULL REFERENCES items(id),
  thickness_mm INTEGER NOT NULL,
  size_code TEXT NOT NULL,
  sale_price NUMERIC(14,2) NOT NULL CHECK (sale_price >= 0),
  valid_from DATE NOT NULL,
  valid_until DATE,                   -- NULL = currently active
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Lookup index — most-frequent query
CREATE INDEX idx_pricing_rules_lookup
  ON item_pricing_rules (tenant_id, item_id, thickness_mm, size_code, valid_from DESC);

-- Constraint: at most one active rule per (item × thickness × size)
CREATE UNIQUE INDEX idx_pricing_rules_one_active
  ON item_pricing_rules (tenant_id, item_id, thickness_mm, size_code)
  WHERE valid_until IS NULL;
```

### Line table extensions

```sql
ALTER TABLE invoice_lines
  ADD COLUMN thickness_mm INTEGER,
  ADD COLUMN size_code TEXT;

ALTER TABLE challan_lines
  ADD COLUMN thickness_mm INTEGER,
  ADD COLUMN size_code TEXT;

ALTER TABLE document_lines
  ADD COLUMN thickness_mm INTEGER,
  ADD COLUMN size_code TEXT;

ALTER TABLE vendor_bill_lines
  ADD COLUMN thickness_mm INTEGER,
  ADD COLUMN size_code TEXT;
```

All four are nullable — pre-existing lines get NULL on migration. New
lines for ACP items will populate them; non-ACP items can leave them NULL.

---

## §4 API contract

### 4.1 GET `/item-dimensions`

Returns all active dimensions for the tenant. No pagination needed
(typical tenant has < 50 rows).

```json
[
  { "id":"...", "thickness_mm":2, "size_code":"1220x2440",
    "label":"2mm · 1220 × 2440 mm (4×8 ft)", "is_active":true,
    "created_at":"...", "updated_at":"..." }
]
```

### 4.2 GET `/pricing-rules?item_id=&active_only=true&limit=200`

Returns rules sorted newest `valid_from` first. `active_only=true`
filters to rules with `valid_until IS NULL` (the current price set).

### 4.3 GET `/pricing-rules/lookup`

Required query params: `item_id`, `thickness_mm`, `size_code`.
Optional: `as_of` (defaults to today, server-side).

Response:

```json
{
  "rule": {
    "id":"...","item_id":"item-nb-1101","thickness_mm":3,
    "size_code":"1220x2440","sale_price":"5800.00",
    "valid_from":"2026-03-03","valid_until":null,
    "notes":"Q4 list price","created_at":"...","created_by":"..."
  },
  "effective_label": "Effective since 2026-03-03"
}
```

If no rule exists, returns:

```json
{ "rule": null }
```

### 4.4 POST `/pricing-rules`

Body:

```json
{
  "item_id": "item-nb-1101",
  "thickness_mm": 3,
  "size_code": "1220x2440",
  "sale_price": "6100.00",
  "valid_from": "2026-05-15",
  "notes": "Raw material cost up 6%"
}
```

`valid_from` defaults to today server-side if omitted.

Behaviour:
1. Lock the (tenant, item, thickness, size) row group
2. Find the prior active rule (`valid_until IS NULL`)
3. If exists: set its `valid_until = new.valid_from − 1 day`
4. Insert the new rule with `valid_until = NULL`
5. Commit transaction
6. Return the new rule (201)

Error cases:
- `400 BAD_REQUEST` — missing required field, sale_price < 0, valid_from in future > 5 years
- `403 FORBIDDEN` — caller lacks `inventory.master_data.write`
- `409 CONFLICT` — race-rare; another rule was inserted with same valid_from. Caller retries.

### 4.5 Line POST integration (existing endpoints)

When the FE submits a line via `POST /documents/:id/lines`,
`POST /invoices/:id/lines`, or `POST /challans/:id/lines`:

- New optional fields in the body: `thickness_mm`, `size_code`
- Server stores them on the line
- If `unit_price` is missing/0 AND both dimensions are supplied,
  server runs the lookup (same logic as §4.3) and uses the returned
  rule's `sale_price` as the effective unit_price for that line
- The looked-up price is then SNAPSHOTTED on the line; later
  pricing rule changes don't affect this line

---

## §5 Permissions

Reuses existing master-data perms — no new codes:
- View pricing rules: `inventory.master_data.read` (Admin only)
- Create pricing rules: `inventory.master_data.write` (Admin only;
  add this perm to `permissions` table if it doesn't exist)

---

## §6 Tests

1. **Lookup happy path** — create rule, lookup returns it
2. **Lookup with no rule** — returns `{ rule: null }`, no 404
3. **Lookup with as_of in past** — returns the rule that was active
   then, even if now closed
4. **Versioning on POST** — new rule auto-closes prior; UNIQUE
   constraint on (item, thickness, size) WHERE valid_until IS NULL
   never violates
5. **Line snapshot integrity** — create line at ₹5,500 → update rule
   to ₹6,100 → re-fetch line → still ₹5,500
6. **Line auto-lookup** — submit line with thickness+size+no price →
   line saves with looked-up price, snapshotted

---

## §7 FE prototype status

| Path | Change |
|---|---|
| `lib/demo/fixtures.ts` | +12 dimensions, +18 sample pricing rules (NB-1101 across all 12 combos + 1 historical, NB-1502 across 6 combos) |
| `services/pricing.service.ts` | New: `listDimensions`, `list`, `lookup`, `create` |
| `lib/demo/adapter.ts` | New: GET /item-dimensions, GET/POST /pricing-rules, GET /pricing-rules/lookup with full versioning semantics |
| `lib/api-constants.ts` | New: `ITEM_DIMENSIONS`, `PRICING_RULES` |
| `types/index.ts` | New types: `ItemDimension`, `ItemPricingRule`, `ItemPricingLookupResponse`. Extended `DocumentLine`, `InvoiceLine`, `ChallanLine` with `thickness_mm` + `size_code` |
| `services/documents.service.ts` | `createLine` now accepts `thickness_mm`/`size_code` |
| `app/.../master-data/item-pricing/page.tsx` | New admin page: filterable table grouped by (item × dim), expandable history, Update-price modal |
| `app/.../documents/detail/[id]/page.tsx` | Line modal gains Thickness + Size dropdowns; auto-lookup populates unit_price; persists dimension snapshot |
| `components/layout/sidebar.tsx` | New "Item Pricing" entry under Master Data |

When backend lands:
1. Run the schema migrations (§3)
2. Backfill `item_dimensions` per tenant (script or seeder)
3. Implement endpoints (§4)
4. Set `NEXT_PUBLIC_DEMO_MODE=false` — FE works unchanged

---

## §8 Out of scope

- Bulk price upload (CSV) — defer; admin can use the modal repeatedly
- Multi-currency pricing — single-currency tenant for now
- Tier-based pricing (e.g. "customer A pays X, customer B pays Y") —
  bigger feature; defer until requested
- Cost-side versioning (item_cost_rules) — separate spec when needed
- Auto-recalculation of historical lines on price change — by design
  we DON'T do this; lines are snapshotted

---

## §9 Suggested ship sequence

1. Schema migrations (§3) — schema-only, low risk
2. Seed `item_dimensions` for Nova Bond (12 rows)
3. GET endpoints (`/item-dimensions`, `/pricing-rules`, `/pricing-rules/lookup`)
4. POST `/pricing-rules` with the version-close transaction
5. Wire dimension fields into existing line endpoints (invoice / challan / document / bill)
6. Auto-lookup on line POST (§4.5)
