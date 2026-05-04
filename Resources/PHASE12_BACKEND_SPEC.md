# Phase 12 — Cost & Financials visibility split + GRN↔Bill matching (REQ-16)

Owner: Backend dev · Drafted: 2026-05-02 · FE prototype: complete
Source of truth: paired with `frontend/src/lib/demo/fixtures.ts`
(permission seeds), `src/components/ui/cost-mask.tsx`, and the
two-stage GRN → Vendor Bill flow described in `clientneeds.txt §7`.

---

## §1 Why this exists

Nova Bond's owner Mr. Arpit is the only person allowed to see cost
prices, margins, money, payments, or analytics. Everyone else
(warehouse Operator, field Salesman, future Cashier) operates on a
**no-money UI**: items, qty, lots, locations only.

The client spec is explicit:

> §7 Inward Purchase: *"Basically, the inventory information but
> **without the cost price** just the product and the stock."*

> §8 Outward Sales: *"**There is no amount column** instead it will
> be remarks column"* — default print mode is no amounts; optional
> "with-remarks" mode includes amounts on the printout for the customer.

This phase implements that visibility split AND the two-stage data
model that makes it work — cost enters via Vendor Bills (Admin), not
GRNs (Operator).

---

## §2 New permission codes

```
inventory.cost.read       — gates cost-price visibility
inventory.financials.read — gates money / payments / reports / analytics
```

### What `inventory.cost.read` gates

| Surface | Behaviour without the perm |
|---|---|
| Vendor Bills module (`/bills/*`) | Whole route forbidden |
| Valuation page (`/valuation`) | Whole route forbidden |
| `/movements` `unit_cost` + `total_cost` columns | Hidden |
| `/balances` "Value" column + "Inventory value" KPI | Hidden |
| Document line table — `unit_price` + `line_total` columns | Masked (•••) |
| Vendor bill line form `unit_cost` field | Form forbidden via route gate |
| COGS row on `/reports/profit-loss` | (Reports gated by financials.read anyway) |
| GRN line form | NEVER shows cost — by document-type rule, not perm |

### What `inventory.financials.read` gates

| Surface | Behaviour without the perm |
|---|---|
| Whole `/money/*` (payments, ledger, accounts, cheques, expenses, salary, debtors) | Forbidden |
| Whole `/reports/*` (P&L, cash flow, registers, GSTR, aging) | Forbidden |
| `/settings/period-close` | Forbidden |
| `/admin/audit-log` | Forbidden |

### Why two perms not one

Allows finer role splits later (e.g. a Cashier with `financials.read`
but not `cost.read`, or an Inventory Manager with `cost.read` but not
`financials.read`). For Nova Bond's day-1 setup, only Admin gets both;
Operator gets neither.

---

## §3 Updated default role bundles

### Administrator (`role-admin`)
ALL permissions including both new gates. No change in scope.

### Warehouse Operator (`role-operator`) — TRIMMED
**No longer includes**:
- `inventory.bills.read` + .write/.post/.cancel
- `inventory.invoices.read` + .write/.post/.cancel
- `inventory.payments.*`
- `inventory.expenses.*` + expense_categories
- `inventory.salary.*`
- `inventory.accounts.*`
- `inventory.ledger.read`
- `inventory.employees.*`
- `inventory.reports.read`
- `inventory.period_close.*`
- `inventory.audit_log.read`
- `inventory.cost.read` (new)
- `inventory.financials.read` (new)

**Still includes** (inventory + documents + sale-side):
- `inventory.items.read`, `inventory.balances.read`
- `inventory.brands.read`, `inventory.categories.read`
- `inventory.locations.read`, `inventory.parties.read`
- `inventory.lots.read`, `inventory.serials.read`
- `inventory.uoms.read`, `inventory.status_master.read`, `inventory.number_series.read`
- `inventory.documents.read/write/post/cancel` (PO, GRN, Transfer, SO)
- `inventory.movements.read/write`
- `inventory.counts.read/write/apply`
- `inventory.reservations.read/write`
- `inventory.lots.write`, `inventory.serials.write`
- `inventory.challans.read/write/post/cancel`
- `inventory.imports.read/write` (operator can do bulk imports)

### Viewer (`role-viewer`) — unchanged
All read perms (including the new ones — viewer is meant for auditors).

---

## §4 GRN line form — spec change

**Per clientneeds.txt §7**, the GRN line form MUST NOT include cost:

```python
# Backend pydantic shape
class GRNLineCreate(BaseModel):
    item_id: UUID
    uom_id: UUID
    quantity: Decimal
    lot_number: str | None = None  # required if item.is_batch_tracked
    bin_id: UUID | None = None
    remarks: str | None = None
    # NO unit_cost, NO discount_pct, NO line_total
```

Same for PO line form (§7). For Transfer line form (no monetary concept).

Cost lands on the line **only after** the matching Vendor Bill posts
and writes through to the FIFO valuation layer.

---

## §5 GRN ↔ Vendor Bill matching contract

This is the load-bearing change for cost flowing through correctly.

### 5.1 GRN posting

When a GRN posts:
1. For each line, write a `stock_movement` with `direction='in'`,
   `quantity`, `lot_id`. **`unit_cost = NULL`** (cost-pending).
2. Write a `valuation_layer` with `qty_original = quantity`,
   `unit_cost = NULL`, `cost_pending = TRUE`.
3. Update `balances.qty_on_hand`. **Do NOT update `balances.value`**
   (it's NULL until the bill backfills cost).

### 5.2 Vendor Bill posting — match + backfill

When a Vendor Bill posts:
1. For each bill line `(item_id, qty, unit_cost)`:
   a. Find the oldest *posted* GRN line from the same `party_id` for
      the same `item_id` with `cost_pending = TRUE` and remaining
      qty ≥ bill line qty.
   b. **Backfill** the matched GRN line's `valuation_layer.unit_cost`
      = bill line `unit_cost`. Set `cost_pending = FALSE`.
   c. Update `balances.value += qty × unit_cost`.
   d. Write the AP ledger entries (Dr expense + Dr GST input + Cr AP).
2. If no matching GRN found → still post the bill (admin may have
   forgotten the GRN). Surface a soft warning in the bill detail UI:
   *"This bill has no matching GRN. Stock was not received via this bill."*
3. If multiple bills could match the same GRN → FIFO-by-bill-date.

### 5.3 Cost-pending visibility

While a GRN's valuation layer is `cost_pending = TRUE`:
- COGS calculations on `/reports/profit-loss` SHOULD use the
  per-item average cost from prior layers as a proxy. Surface a
  banner: *"3 GRNs have unmatched cost — P&L is approximate"*.
- `balances.value` remains `NULL` for those layers — `/balances`
  Value column shows "(pending)" for affected rows.

### 5.4 Pending bills KPI on dashboard

```
GET /dashboard/pending-bills-count
```
Returns:
```json
{ "pending_grns": 3, "estimated_value": "...optional..." }
```

`pending_grns` = count of distinct GRNs with at least one
`cost_pending` valuation layer, in the current period (current month
or fiscal year, tenant-configurable).

This is the data behind the KPI tile shown on the Admin's dashboard
(operator never sees the tile because `useCanSeeCost()` returns false).

---

## §6 Print mode for Challan / Invoice

Per §8, customer-facing prints can include amounts even when the
Operator's UI hides them. Implemented as a per-document setting:

```sql
ALTER TABLE challans   ADD COLUMN print_mode TEXT NOT NULL DEFAULT 'no_amount';
ALTER TABLE invoices   ADD COLUMN print_mode TEXT NOT NULL DEFAULT 'with_amount';
-- enum: 'no_amount' | 'with_amount'
```

Print template renders amounts iff `print_mode = 'with_amount'`. The
operator can flip the toggle without their own UI exposing the
amounts in the form.

---

## §7 Schema impact

**No new tables.** Two altered columns:

```sql
ALTER TABLE valuation_layers
  ADD COLUMN cost_pending BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE balances
  ALTER COLUMN value DROP NOT NULL;  -- allow NULL when all layers pending
```

(If your `valuation_layers.unit_cost` is currently NOT NULL, drop
that constraint too.)

Two new permission rows seeded:

```sql
INSERT INTO permissions (code, name, module) VALUES
  ('inventory.cost.read',       'View cost prices and stock value',  'inventory'),
  ('inventory.financials.read', 'View payments, ledger, and reports','inventory');
```

Granted to `role-admin` only. Operator role bundle update required
(remove the perms listed in §3).

---

## §8 Tests

1. **Operator can't open `/bills`** — 403/forbidden state
2. **Operator can post a GRN with no cost field** — line saves with
   `unit_cost = NULL`, layer `cost_pending = TRUE`
3. **Bill posts → backfills GRN layer** — pick GRN with cost_pending,
   post matching bill, verify layer.unit_cost = bill line cost,
   cost_pending = FALSE, balances.value updated
4. **Bill with no matching GRN** — posts cleanly, soft warning in
   response payload
5. **Multiple GRNs from same vendor** — bill matches the OLDEST first
6. **Operator does not see Inventory value KPI** — dashboard renders
   only 3 KPI tiles, not 4
7. **Pending-bills count** — `/dashboard/pending-bills-count` returns
   correct integer; updates when bill posts
8. **`unit_cost` column on /movements masked for operator** — even
   though the row exists with NULL while pending and a value when
   filled, the operator's GET /movements response can still include
   the field; FE just doesn't render the column

---

## §9 Out of scope

- **Per-line GRN→Bill linkage** — current matching is by
  (vendor, item, qty); a future enhancement could let admin manually
  pick which GRN line a bill line backfills (rare edge case)
- **Server-side field masking** — backend still returns full row data;
  FE handles the visual masking. If later we want server-enforced
  field-level redaction (defense-in-depth), add a query param like
  `?perm_check=true` that nulls cost fields per the caller's perms.

---

## §10 FE prototype status

| Path | Change |
|---|---|
| `lib/demo/fixtures.ts` | +2 perms, trimmed Operator bundle, trimmed read-perm grants |
| `components/ui/cost-mask.tsx` | New: `<CostMask>`, `<FinancialsMask>`, hooks |
| `app/.../documents/detail/[id]/page.tsx` | Strips price fields from PO/GRN/Transfer line form; masks line_total in line table |
| `app/.../balances/page.tsx` | Hides Value column + Inventory value KPI for non-Admin |
| `app/.../movements/page.tsx` | Hides unit_cost + total_cost columns for non-Admin |
| `app/.../valuation/page.tsx` | Route gate changed `balances.read` → `cost.read` |
| `components/layout/sidebar.tsx` | Sidebar Valuation entry gated by cost.read |
| `app/.../dashboard/page.tsx` | New "GRNs pending bill" KPI for Admin (replaces Stock counts tile) |

When backend lands:
1. Run the schema migration (§7)
2. Seed the 2 new permission rows
3. Update existing tenants' Operator role to drop the perms listed in §3
4. Implement the GRN-post + Bill-post hooks (§5.1, §5.2)
5. Add `GET /dashboard/pending-bills-count`

FE works against the demo adapter today; flipping `NEXT_PUBLIC_DEMO_MODE=false`
will pick up the real endpoints with no FE redeploy beyond the env flip.

---

## §11 Suggested ship sequence

1. Add the 2 permission codes; trim Operator bundle (config-only change)
2. Add `cost_pending` column on valuation_layers; allow NULL on
   `balances.value`
3. Update GRN-line creation to allow `unit_cost = NULL`
4. Implement Bill-post backfill logic (§5.2) — most load-bearing
5. `GET /dashboard/pending-bills-count` endpoint
6. Print-mode columns on challans/invoices; render templates respect them

Each step is independently shippable; nothing breaks existing data
because new columns default to safe values.
