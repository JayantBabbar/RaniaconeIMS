# Phase 4 — Reports & Statements (REQ-8) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-01 · FE prototype: complete
Source of truth: paired with `frontend/src/services/reports.service.ts`
and the `/reports/*` pages under `src/app/(dashboard)/reports/`.

> **Status of paired FE work**: All 6 routes ship as a working
> prototype against in-memory fixtures (`src/lib/demo/adapter.ts`).
> Backend should match the response shapes exactly so we can flip
> `NEXT_PUBLIC_DEMO_MODE=false` and have the UI work unchanged.

---

## §1 Overview

Phase 4 adds the **read-only reporting layer** over everything
shipped in Phases 1–3.5. It does *not* introduce new transactional
state. Every report is a server-side aggregation; the FE never
re-totals rows.

Six routes. One backend module (`reports/`). Five endpoints.

| Route                             | Endpoint                          | Purpose                                          |
|-----------------------------------|-----------------------------------|--------------------------------------------------|
| `/reports`                        | (none — landing page)             | Tile grid linking to the others                  |
| `/reports/sales`                  | `GET /reports/sales-register`     | Sales register (foundation for GSTR-1)           |
| `/reports/purchases`              | `GET /reports/purchase-register`  | Purchase register (foundation for GSTR-2)        |
| `/reports/debtors-aging`          | `GET /reports/debtors-aging`      | Open receivables bucketed                        |
| `/reports/creditors-aging`        | `GET /reports/creditors-aging`    | Open payables bucketed                           |
| `/reports/profit-loss`            | `GET /reports/profit-loss`        | Date-range income statement                      |

---

## §2 Critical scope decisions

### 2.1 Reports are pure aggregations — no new tables

We do *not* materialise reports into a `reports/` table. Every
endpoint runs a SQL aggregation against existing tables on each
call. Caching can come later (see §8).

### 2.2 Server returns rows AND totals

Every register/aging response is `{ rows: [...], totals: {...} }`.
The FE renders both straight from the response. Reasoning: keeps
PDF/CSV output and on-screen output bit-identical, and avoids the
"FE re-summed and disagreed with backend" class of bug.

### 2.3 Bucket boundaries on aging are inclusive at lower edge

`days_past_due ≤ 30 → bucket_0_30`
`30 < days_past_due ≤ 60 → bucket_31_60`
`60 < days_past_due ≤ 90 → bucket_61_90`
`days_past_due > 90 → bucket_90_plus`

`days_past_due = (as_of - doc_date)` in calendar days, computed in
UTC to avoid timezone drift across midnight.

### 2.4 Cancelled docs included in registers, excluded from aging

Sales/purchase registers show `posted` AND `cancelled` rows so the
audit trail is complete. Aging only considers `posted` documents
with `outstanding > 0` (where `outstanding = grand_total − allocated_amount`).

### 2.5 Revenue is taxable_value, not grand_total

P&L revenue is the sum of `subtotal` (taxable_value) on posted
invoices in the date range. GST is excluded because it's a pass-
through to the government — not the business's revenue.

### 2.6 Salary in P&L uses gross_salary, not net_paid

The float-clearing entries (`Cr employee_float`) settle internally.
The actual cost-of-labour is `gross_salary`. Net is what reaches
the employee's pocket but is not the employer's expense.

### 2.7 COGS sourcing

Initial implementation: sum of `valuation_layer.consumed_cost`
on stock-out movements caused by **posted** invoices (and only
those without `challan_id`, since challan-promoted invoices reuse
the challan's stock-out — never double-count).

The FE prototype currently uses `revenue × 0.6` as a stand-in for
demo numbers; backend MUST replace this with the real valuation
sum. The FE makes this constraint visible in a yellow "demo only"
banner under the P&L table.

---

## §3 No new database schema

Phase 4 introduces zero tables and zero columns. All queries run
against:

- `invoices`, `invoice_lines`
- `vendor_bills`, `vendor_bill_lines`
- `payment_allocations`
- `expenses`, `expense_categories`
- `salary_entries`
- `parties`
- `valuation_layers` (for COGS in P&L)
- `stock_movements` (for COGS in P&L)

Indexes already in place (`invoices.invoice_date`,
`vendor_bills.bill_date`, `expenses.expense_date`,
`salary_entries.posting_date`) cover the date-range filters.

---

## §4 API Contract

All endpoints are `GET`, no body, all params via query string.
All require `inventory.reports.read`. None require module
subscription beyond the parent `inventory` module.

### 4.1 Sales register

```
GET /reports/sales-register
  ?start_date=YYYY-MM-DD       (optional, defaults to first of current month)
  &end_date=YYYY-MM-DD         (optional, defaults to today)
  &party_id=<uuid>             (optional)
  &state_code=<2-digit>        (optional, GST state code)
```

Response:

```json
{
  "rows": [
    {
      "invoice_id":      "<uuid>",
      "invoice_number":  "INV/2026-04/0002",
      "invoice_date":    "2026-04-15",
      "party_id":        "<uuid>",
      "party_name":      "Metro Chain Stores",
      "party_state_code": "07",
      "taxable_value":   "1700.00",
      "cgst_amount":     "0.00",
      "sgst_amount":     "0.00",
      "igst_amount":     "306.00",
      "cess_amount":     "0.00",
      "grand_total":     "2006.00",
      "status":          "posted"
    }
  ],
  "totals": {
    "count":         1,
    "taxable_value": "1700.00",
    "cgst_amount":   "0.00",
    "sgst_amount":   "0.00",
    "igst_amount":   "306.00",
    "cess_amount":   "0.00",
    "grand_total":   "2006.00"
  }
}
```

Tax splits come from sum-aggregating `invoice_lines` per invoice
(do NOT split `tax_total` proportionally — line-level CGST/SGST/IGST
columns are authoritative).

### 4.2 Purchase register

Mirror of §4.1 with the same query params and `vendor_bills` /
`vendor_bill_lines` as the source. Field renames:
`invoice_*` → `bill_*`. Response shape otherwise identical.

### 4.3 Debtors aging

```
GET /reports/debtors-aging
  ?as_of=YYYY-MM-DD            (optional, defaults to today)
  &party_id=<uuid>             (optional, single-party drill-down)
```

Response:

```json
{
  "as_of": "2026-04-30",
  "rows": [
    {
      "party_id":        "<uuid>",
      "party_name":      "Greenfield Retail",
      "bucket_0_30":     "1200.00",
      "bucket_31_60":    "0.00",
      "bucket_61_90":    "0.00",
      "bucket_90_plus":  "0.00",
      "total":           "1200.00",
      "oldest_doc_date": "2026-04-15"
    }
  ],
  "totals": {
    "count":           1,
    "bucket_0_30":     "1200.00",
    "bucket_31_60":    "0.00",
    "bucket_61_90":    "0.00",
    "bucket_90_plus":  "0.00",
    "total":           "1200.00"
  }
}
```

For each posted invoice with `grand_total − allocated_amount > 0`:
1. Compute `days = (as_of − invoice_date)` in UTC calendar days.
2. Drop the residual into the appropriate bucket (see §2.3).
3. Group by `party_id`; sum buckets and total.
4. Order rows by `total DESC` so the biggest debtor is on top.
5. `oldest_doc_date` = MIN(invoice_date) across that party's
   open invoices.

### 4.4 Creditors aging

Mirror of §4.3 against `vendor_bills` (using `bill_date` and
`vendor_bills.allocated_amount`). Response shape identical.

### 4.5 Profit & loss

```
GET /reports/profit-loss
  ?start_date=YYYY-MM-DD       (REQUIRED)
  &end_date=YYYY-MM-DD         (REQUIRED)
```

Response:

```json
{
  "start_date":     "2026-04-01",
  "end_date":       "2026-04-30",
  "revenue":        "1700.00",
  "cogs":           "1020.00",
  "gross_profit":   "680.00",
  "expenses": [
    {
      "category_id":   "ecat-petrol",
      "category_name": "Petrol",
      "amount":        "1500.00"
    }
  ],
  "expenses_total": "1500.00",
  "salary_total":   "0.00",
  "net_profit":     "-820.00"
}
```

Sourcing:
- `revenue` — SUM(`invoices.subtotal`) WHERE status='posted' AND
  invoice_date in [start, end]
- `cogs` — SUM(`valuation_layers.consumed_cost`) on stock-out
  moves caused by posted invoices in range (excluding invoices
  with `challan_id` — challan-promoted ones reuse the challan's
  stock-out)
- `expenses[]` — SUM(`expenses.amount`) GROUP BY `category_id`
  WHERE status='posted' AND expense_date in [start, end]
- `salary_total` — SUM(`salary_entries.gross_salary`) WHERE
  status='posted' AND posting_date in [start, end]

`gross_profit = revenue − cogs`
`net_profit   = gross_profit − expenses_total − salary_total`

`net_profit` may be negative; FE renders that case in red as
"Net loss" automatically.

---

## §5 Error codes

Phase 4 endpoints reuse existing error codes:

- `400 BAD_REQUEST` — missing required date on P&L, malformed date
- `403 FORBIDDEN` — caller lacks `inventory.reports.read`
- `403 MODULE_NOT_SUBSCRIBED` — tenant not subscribed to `inventory`

No new codes.

---

## §6 Permissions

Single new code, **already seeded** in FE demo fixtures:

```
inventory.reports.read    — View financial reports
```

We deliberately did NOT split per-report (e.g. separate
`inventory.reports.pl.read`). All five reports ride a single gate
because:
1. They're all read-only.
2. Tenants who want stricter control can hide reports from a role
   by simply not granting `inventory.reports.read`.
3. Per-report gating adds complexity without solving an actual
   user need we've heard.

If P&L turns out to be sensitive enough to warrant its own gate
later, we can split without breaking anything (additive).

---

## §7 Tests

Backend test coverage targets:

1. **Sales register** — date range filter narrows correctly;
   party + state filters compose; line-aggregation matches
   `subtotal` + `tax_total` to within a paisa per invoice.
2. **Purchase register** — same as sales but on bills.
3. **Aging** — fixed `as_of` date; verify a doc that lands exactly
   on day 30 falls in `bucket_0_30` (inclusive lower edge); a doc
   on day 31 lands in `bucket_31_60`.
4. **Aging exclusion** — fully-allocated doc disappears from rows
   even when `posted`.
5. **P&L revenue exclusion** — challan-promoted invoice's
   stock-out is NOT double-counted in COGS (this is the most
   load-bearing invariant — a regression here destroys the P&L).
6. **P&L empty range** — date range with no transactional data
   returns zeros, not 500.
7. **Permissions** — every endpoint returns 403 for a user without
   `inventory.reports.read`.

---

## §8 Out of scope (Phase 5 candidates)

- **GSTR-1 / GSTR-2 / GSTR-3B JSON exports** — needs CA-confirmed
  schema; sales/purchase register data is the input.
- **Cash flow statement** — needs opening balances modelled per-
  account (currently only `current_balance` denormalised).
- **Trial balance / balance sheet** — needs equity accounts in
  the chart; we deferred those in Phase 3.
- **Server-side caching** — current per-call aggregation is fine
  up to ~10k transactional rows per tenant. Add Redis caching
  with invalidation-on-post when we hit scaling pressure.
- **PDF rendering** — CSV export is shipped; PDF needs a server
  template engine (jinja+wkhtmltopdf or similar).
- **Email scheduling** — "email me a weekly P&L" is in the same
  bucket as Phase 4 cron-driven salary; defer together.

---

## §9 FE prototype status — what to copy

Frontend ships **complete and working** against demo fixtures:

| Path                               | Lines | Notes                                 |
|------------------------------------|-------|---------------------------------------|
| `services/reports.service.ts`      | ~50   | Five methods, one per endpoint        |
| `app/.../reports/page.tsx`         | ~115  | Tile grid landing                     |
| `app/.../reports/sales/page.tsx`   | ~170  | Filters + table + totals + CSV export |
| `app/.../reports/purchases/page.tsx` | ~170 | Mirror of sales                       |
| `app/.../reports/debtors-aging/page.tsx` | ~140 | Bucket table + CSV export         |
| `app/.../reports/creditors-aging/page.tsx` | ~140 | Mirror of debtors                |
| `app/.../reports/profit-loss/page.tsx` | ~150 | Income-statement layout + CSV     |
| `lib/demo/adapter.ts`              | +260  | Five new request handlers             |
| `lib/api-constants.ts`             | +10   | `REPORTS.*` constants                 |
| `types/index.ts`                   | +110  | 9 new exported types                  |

When backend ships:
1. Set `NEXT_PUBLIC_DEMO_MODE=false`
2. FE hits real endpoints
3. All 6 routes work — no FE redeploy needed beyond the env flip

---

## §10 Suggested ship sequence

1. **Sales register endpoint** — anchor pattern; everything else
   mirrors. Get review on the rows+totals shape.
2. **Purchase register** — copy of sales; should be a fast PR.
3. **Debtors aging** — bucket math is the only new logic; lock
   the boundary semantics in tests (§7.3).
4. **Creditors aging** — copy of debtors.
5. **P&L** — heaviest because of COGS sourcing. Land *after* the
   four above so the simpler reports are unblocked first.

Each is independently shippable; no cross-endpoint coupling.
