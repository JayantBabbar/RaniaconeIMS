# Party Pricing — Backend Specification (Phase 14)

> **Status:** Living document. Updated as the FE prototype matures.
> **Last revised:** 2026-05-13
> **Origin:** working FE prototype at `src/services/party-pricing.service.ts`, `src/lib/demo/adapter.ts` (the `/party-item-costs` + `/party-item-sale-prices` blocks), and `src/lib/demo/fixtures.ts` (`PARTY_ITEM_COSTS`, `PARTY_ITEM_SALE_PRICES`).
> **Companion:** [PHASE13_BACKEND_SPEC.md](PHASE13_BACKEND_SPEC.md) — uses the same `valid_from`/`valid_until` versioning pattern.

---

## 1. Overview

Two parallel master-data resources, both keyed on `(tenant, party, item)` and versioned in the same way:

| Resource | Scope | Consumer |
|---|---|---|
| `party_item_costs` | Per-supplier per-item cost lists. Existence of a row marks "this supplier carries this item." | `/bills/new` auto-fills `unit_price` from the active rule when admin picks a supplier + item. |
| `party_item_sale_prices` | Per-customer per-item sale prices (GST-inclusive). | `/invoices/new` and `/estimates/new` auto-fill the line's `unit_price` from the active rule. |

Both tables use the **same versioning pattern as `item_pricing_rules`** (Phase 13): creating a new row auto-closes the prior active row by setting its `valid_until = newRow.valid_from − 1 day`. The active row is the one with `valid_until IS NULL`.

This is the **first per-party pricing** in the system. The two tables are intentionally separate (not one `party_item_prices` table with a `kind` discriminator) — see the design rationale at the bottom of this spec.

---

## 2. Database schema

### 2.1 `party_item_costs`

```sql
CREATE TABLE party_item_costs (
  id                 UUID         PRIMARY KEY,
  tenant_id          UUID         NOT NULL REFERENCES tenants(id),
  party_id           UUID         NOT NULL REFERENCES parties(id),
  item_id            UUID         NOT NULL REFERENCES items(id),
  cost               NUMERIC(18,4) NOT NULL CHECK (cost >= 0),
  valid_from         DATE         NOT NULL,
  valid_until        DATE         NULL,
  notes              TEXT         NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by         UUID         NULL REFERENCES users(id),

  CONSTRAINT chk_valid_range CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT chk_party_is_supplier_or_both -- enforced in app layer; party_type can change so don't FK
    CHECK (true)
);

-- Lookup is hot: index covers active-row query
CREATE INDEX ix_party_item_costs_lookup
  ON party_item_costs (tenant_id, party_id, item_id, valid_from DESC);

-- At most one active row per (tenant, party, item)
CREATE UNIQUE INDEX ux_party_item_costs_active
  ON party_item_costs (tenant_id, party_id, item_id)
  WHERE valid_until IS NULL;
```

### 2.2 `party_item_sale_prices`

```sql
CREATE TABLE party_item_sale_prices (
  id                 UUID         PRIMARY KEY,
  tenant_id          UUID         NOT NULL REFERENCES tenants(id),
  party_id           UUID         NOT NULL REFERENCES parties(id),
  item_id            UUID         NOT NULL REFERENCES items(id),
  sale_price         NUMERIC(18,4) NOT NULL CHECK (sale_price >= 0),
  valid_from         DATE         NOT NULL,
  valid_until        DATE         NULL,
  notes              TEXT         NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by         UUID         NULL REFERENCES users(id),

  CONSTRAINT chk_valid_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX ix_party_item_sale_prices_lookup
  ON party_item_sale_prices (tenant_id, party_id, item_id, valid_from DESC);

CREATE UNIQUE INDEX ux_party_item_sale_prices_active
  ON party_item_sale_prices (tenant_id, party_id, item_id)
  WHERE valid_until IS NULL;
```

### 2.3 Migration notes

- **No backfill needed.** Existing customers without rows fall back to `Item.default_sale_price`. Existing supplier flows continue to require manual entry; rows can be added incrementally.
- **Cascade rules.** Hard `ON DELETE CASCADE` on `parties` and `items` is fine — if you delete a party or item, the pricing rows should go with them.
- **`sale_price` is GST-inclusive** (the customer-visible per-unit price). Invoice promotion uses `reverseGst()` to derive the taxable base — see ESTIMATE_BACKEND_SPEC.md §5.8.

---

## 3. API contract

All routes are tenant-scoped via `X-Acting-Tenant-Id` (mirrors the rest of the inventory service).

### 3.1 List

```
GET /party-item-costs?party_id=&item_id=&active_only=true&limit=200
GET /party-item-sale-prices?party_id=&item_id=&active_only=true&limit=200

200 → {
  "data": [ <PartyItemCost> | <PartyItemSalePrice> ],
  "pagination": { "limit": 200, "next_cursor": null, "has_more": false }
}
```

- `party_id` and `item_id` are independent filters; combine for the version-history view on a single (party, item) row.
- `active_only=true` filters to rows where `valid_until IS NULL`.
- No cursor pagination is needed yet (per-tenant row counts are small). Cap `limit` at 500.

### 3.2 Lookup (the hot path)

```
GET /party-item-costs/lookup?party_id=…&item_id=…&as_of=YYYY-MM-DD
GET /party-item-sale-prices/lookup?party_id=…&item_id=…&as_of=YYYY-MM-DD

200 → { "rule": <PartyItemCost>|<PartyItemSalePrice>|null }
```

- `as_of` defaults to today.
- Returns the **single row** where `valid_from <= as_of AND (valid_until IS NULL OR valid_until >= as_of)`. There can be at most one match per (tenant, party, item, as_of) — see §2 unique index.
- `null` rule means "no rule exists" → FE falls back to `Item.default_sale_price` (customer side) or shows nothing (supplier side).

### 3.3 Create (auto-close prior)

```
POST /party-item-costs
  { "party_id": …, "item_id": …, "cost": "4500.00", "valid_from": "2026-05-13", "notes": "Q4 contract" }

POST /party-item-sale-prices
  { "party_id": …, "item_id": …, "sale_price": "5400.00", "valid_from": "2026-05-13", "notes": "Bulk deal" }

201 → newly-created row (valid_until=null, version active)
```

Server-side (transactional):

1. Validate `party_id` exists, belongs to the tenant, and `party_type` is appropriate:
   - costs → `supplier | vendor | both`
   - sale_prices → `customer | both`
   - else → `400 PARTY_TYPE_MISMATCH`
2. Validate `cost`/`sale_price` is a positive number; `valid_from` defaults to today.
3. **Find the prior active row** for the same `(tenant_id, party_id, item_id)` (the one with `valid_until IS NULL`).
4. If found, set `prior.valid_until = newRow.valid_from − 1 day`.
5. Insert the new row with `valid_until=NULL`.
6. Both updates must be in a single transaction; the unique-active index in §2 makes this atomic.

### 3.4 No PATCH/DELETE

Rows are immutable once created — to "update" a price, post a new row (which auto-closes the prior). To "remove" a price, set a new row with `cost=0`/`sale_price=0` or implement a soft-close endpoint later. This matches Phase 13's pricing-rule semantics.

---

## 4. Permissions

Four new permission codes:

| Code | Description | Default grant |
|---|---|---|
| `inventory.party_costs.read` | View supplier item costs | Admin only (sensitive — same tier as `inventory.cost.read`) |
| `inventory.party_costs.write` | Edit supplier item costs | Admin only |
| `inventory.party_prices.read` | View customer item prices | All roles (operators need it to fill estimates) |
| `inventory.party_prices.write` | Edit customer item prices | Admin only |

Add to migration; grant to `role-admin` automatically. Operators (Tier 3) explicitly do **not** get `party_costs.read` — they record physical events without seeing cost data, per §7 of `clientneeds.txt`.

---

## 5. Integration points

### 5.1 Bill creation (`POST /bills` lines)

When admin picks an item on a bill line and the bill's `party_id` is known, FE calls `GET /party-item-costs/lookup` and pre-fills `unit_price = rule.cost`. Backend doesn't need to do anything beyond serving the lookup — but the **eventual GRN→Bill matching** in Phase 12 should also consult these rules for variance detection.

### 5.2 Invoice / Estimate creation

When admin picks an item on an invoice or estimate line and the doc's `party_id` is known, FE calls `GET /party-item-sale-prices/lookup` and pre-fills `unit_price = rule.sale_price`. Fallback chain: party-specific → `Item.default_sale_price` → manual entry.

### 5.3 Estimate → Invoice promotion (the load-bearing case)

Per ESTIMATE_BACKEND_SPEC.md §5.8, the estimate's `unit_price` is already the customer-visible per-unit price (sourced from the party rule if one exists). The promote handler runs `reverseGst()` against it to produce the invoice's taxable base. **No additional party-pricing lookup is needed during promotion** — the price was locked in at estimate-creation time.

---

## 6. Tests the backend should ship

Mirror the FE fixture scenario (`src/lib/demo/fixtures.ts` — search for `PARTY_ITEM_COSTS`):

1. **Carries detection** — Supplier A has rows for items X and Y; Supplier B has rows for X (cheaper) and Z. Lookup `(B, Y)` returns `{rule: null}` (B doesn't carry Y); lookup `(B, X)` returns B's cheaper row.
2. **Version auto-close** — Create a new cost for `(A, X)` at `valid_from=2026-05-13`. The prior active row's `valid_until` is set to `2026-05-12`. New row is the active one.
3. **As-of lookup** — Query `(A, X, as_of=2026-03-01)` returns the row that was active on that date; query without `as_of` returns the current active row.
4. **Party type guard** — POST a `party_item_costs` row for a customer-only party → `400 PARTY_TYPE_MISMATCH`. Same for `party_item_sale_prices` against a supplier-only party.
5. **Active-uniqueness** — Two concurrent POSTs for the same `(party, item)` with the same `valid_from`: second one's transaction should retry or fail with a clear DB-constraint error (the unique partial index in §2 will block it). FE handles `409`.
6. **Cascade on item delete** — Soft-delete an item; pricing rows for it should be hidden from lookups (or hard-delete cascade — pick one and stay consistent).

---

## 7. Definition of done

A phase is "done" when:

- [ ] Migrations applied: two tables + four indexes + four permission rows.
- [ ] Routes mounted: `GET/POST` for each resource + `GET /lookup`.
- [ ] OpenAPI updated.
- [ ] Permissions seeded; Admin role auto-grants all four.
- [ ] All six §6 tests pass.
- [ ] FE smoke test `frontend/scripts/smoke-test-api-spa.sh` passes (will be extended with party-pricing assertions).
- [ ] Audit log writes on POST: action `party_cost.create` / `party_price.create`, entity_type the resource name, before/after the row.

---

## 8. Design rationale — why two tables, not one

Considered: one `party_item_prices` table with a `kind` enum (`supplier_cost | customer_sale`).

Decision: **two tables.**

Reasons:
- Matches existing pattern (`bills` vs `invoices`, `party_receivable` vs `party_payable` ledger accounts).
- Stronger typing on the FE — no narrowing needed at every call site.
- Separate permissions evolve independently (cost data is more sensitive than sale-price data).
- Cost rows feed P&L; sale-price rows feed AR — the two halves don't share queries.

Cost: ~30% more route code. Worth it for the clarity. If you ever need to merge later (e.g. an audit query that touches both), do it via a view, not by collapsing tables.
