# Phase 8 — Cash flow statement (REQ-12) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-02 · FE prototype: complete

> Pairs with `frontend/src/services/reports.service.ts` (`cashFlow`)
> and `/reports/cash-flow` page.

---

## §1 Overview

Direct-method cash flow statement over a date range. Cash inflows
and outflows grouped by activity (operating / investing). Closing
cash = Opening cash + Net change.

Single endpoint:

```
GET /reports/cash-flow?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

Permission: `inventory.reports.read` (reused from Phase 4).

---

## §2 Critical scope decisions

### 2.1 Direct method, not indirect

Cash inflows + outflows by category. We don't reconcile from net
profit (indirect method) because most SMB users find direct more
intuitive: "where did my cash actually go this month?"

### 2.2 "Cash" = cash + bank + gpay account balances

Cheque-in-transit is excluded — only cleared cheques count toward
cash. The balance is computed from `ledger_entries` against
accounts of types `cash_in_hand`, `bank`, `gpay`.

### 2.3 Operating activities (inclusive)

- Receipts from customers — `payments.direction = received` AND
  `status = posted` AND `payment_date IN [start, end]`
- Payments to vendors — `payments.direction = paid` AND `status =
  posted` AND linked to a party with `party_type IN ('supplier','both')`
- Salary paid (net) — `salary_entries.status = posted` AND
  `posting_date IN [start, end]`, sum `net_paid`
- Operating expenses — `expenses.status = posted` AND `expense_date
  IN [start, end]` AND category `is_capital = false`

### 2.4 Investing activities

- Capital expenditure — `expenses.status = posted` AND
  `expense_date IN [start, end]` AND category `is_capital = true`

### 2.5 Financing activities — out of scope

We don't model loans, equity injections, or owner draws yet. When
those land, this section gets added without breaking the existing
response shape.

### 2.6 Opening cash = balance up to (start_date − 1)

Computed from ledger entries with `entry_date <= (start_date − 1)`
on the cash account set. If `start_date` is omitted, opening = 0.

### 2.7 Closing cash = balance up to end_date

Computed the same way against `entry_date <= end_date`.

---

## §3 Database schema

No new tables. Pure aggregation over existing `ledger_entries`,
`payments`, `expenses`, `salary_entries`, `expense_categories`,
`financial_accounts`, `parties`.

Index recommendation — confirm these exist:

```sql
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_date
  ON ledger_entries (account_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_payments_direction_date
  ON payments (direction, payment_date) WHERE status = 'posted';

CREATE INDEX IF NOT EXISTS idx_expenses_date_category
  ON expenses (expense_date, category_id) WHERE status = 'posted';
```

---

## §4 API Contract

```
GET /reports/cash-flow
  ?start_date=YYYY-MM-DD     (optional; defaults to first of current month)
  &end_date=YYYY-MM-DD       (optional; defaults to today)
```

Response (200):

```json
{
  "start_date": "2026-04-01",
  "end_date":   "2026-04-30",
  "opening_cash": "67500.00",
  "operating": {
    "receipts_from_customers": "85250.00",
    "payments_to_vendors":     "0.00",
    "salary_paid":             "0.00",
    "operating_expenses":      "1500.00",
    "net":                     "83750.00"
  },
  "investing": {
    "capital_expenditure": "0.00",
    "net":                 "0.00"
  },
  "net_change_in_cash": "83750.00",
  "closing_cash":       "151250.00",
  "lines": [
    { "label": "Receipts from customers",            "amount": "85250.00" },
    { "label": "Payments to vendors",                "amount": "-0.00" },
    { "label": "Salary paid (net)",                  "amount": "-0.00" },
    { "label": "Operating expenses",                 "amount": "-1500.00" },
    { "label": "Net cash from operating activities", "amount": "83750.00" },
    { "label": "Capital expenditure",                "amount": "-0.00" },
    { "label": "Net cash from investing activities", "amount": "0.00" }
  ]
}
```

`lines` is a pre-flattened convenience array for FE/PDF rendering
in either order.

---

## §5 Tests

1. Empty range → all zeros, valid response.
2. Receipts in range → contributes to `operating.receipts_from_customers`.
3. Capital expense → contributes to `investing.capital_expenditure`,
   NOT to `operating.operating_expenses`.
4. Cancelled payment → excluded from receipts.
5. Opening + Net = Closing — invariant; assert per-test.
6. Cheque-in-transit (uncleared) excluded from both opening and
   closing balance.

---

## §6 Out of scope

- Financing activities (loans, equity, draws)
- Indirect method (start with net profit, adjust for non-cash)
- Multi-currency consolidation
- Per-account drill-down on each line

---

## §7 FE prototype status

- `services/reports.service.ts` — `cashFlow` method added
- `app/(dashboard)/reports/cash-flow/page.tsx` — date range +
  table layout + CSV export
- `lib/demo/adapter.ts` — handler computes from existing fixtures
- `lib/api-constants.ts` — `REPORTS.CASH_FLOW`
- `types/index.ts` — `CashFlowResponse`, `CashFlowLineItem`
- `components/layout/sidebar.tsx` — new "Cash flow" entry under Reports
- `app/(dashboard)/reports/page.tsx` — landing tile added

When backend lands: set `NEXT_PUBLIC_DEMO_MODE=false`. No FE changes.
