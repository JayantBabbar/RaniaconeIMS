# Phase 3.5 — AP completion: Vendor Bills, Expenses, Salary

> **Status:** Living document. Updated as the FE prototype matures.
> **Last revised:** 2026-04-29
> **Origin:** derived from working FE prototype at `src/app/(dashboard)/bills/*` + `src/app/(dashboard)/money/{expenses,salary}/*`.
> **Companion:** [PHASE3_BACKEND_SPEC.md](PHASE3_BACKEND_SPEC.md) (REQ-6) — Phase 3.5 extends the same `financial_accounts` + `ledger_entries` infra and reuses `payments` + `payment_allocations`.
> **For backend dev:** this is the contract. Build the API to satisfy it; FE will swap from demo adapter to real endpoints with zero further FE changes.

---

## 1. Overview

Phase 3.5 closes the AP side of the books and adds the operational expense + salary flows that every Indian distribution business needs to actually run. Three new entities, one extension to an existing one:

| Entity | Purpose | New endpoints |
| --- | --- | --- |
| `vendor_bills` (+ lines) | Enter the supplier's paper invoice — financial entry only, no stock movement | 7 |
| `expense_categories` | Tenant-customisable categories (Food, Petrol, Diesel, …) | 4 |
| `expenses` | Day-to-day spending: cash → cash/bank/gpay flow with category | 5 |
| `salary_entries` | Manual monthly salary voucher per employee — closes the float-as-deduction loop | 5 |
| `payment_allocations` (extend) | Add `bill_id` field so vendor payments can settle vendor bills | n/a |

**Status state machine** (mirrors invoices + payments):

```
draft  →  posted  →  cancelled
   \-----→ deleted (only from draft)
```

**Cross-module wiring:** vendor-bill post writes a 3-row ledger entry (Dr expense / Dr GST input / Cr AP). Expense post writes a 2-row entry (Dr expense_category / Cr cash-or-bank). Salary post writes a 3-row entry (Dr salary_expense / Cr employee_float / Cr paid_from). All three reuse the `ledger_entries` + `financial_accounts` infrastructure from REQ-6.

---

## 2. Critical scope decisions

### 2.1 Vendor bills are FINANCIAL ONLY — no stock movement

A `bill_post` does NOT create stock IN movements. Stock IN happens through the GRN/PO flow (existing `documents` module with `type='GRN'`). A vendor bill is just the financial entry against a paper invoice the supplier sent us — it never touches `balances` or `movements`.

This separates physical inventory (GRN) from financial accounting (bill). Tenants who don't track stock in this system can use bills standalone; tenants who do receive goods first via GRN, then enter the supplier's invoice as a bill when it arrives.

A future enhancement (Phase 4 candidate): link a bill to one or more GRN documents the same way invoice links to challan, so the bill can reuse the GRN's line data. **Out of scope for Phase 3.5.**

### 2.2 Expense categories own their own ledger account

Each `expense_category` row has a one-to-one `expense_account_id` pointing at a `financial_accounts` row of type `expense_category`. Server auto-creates the account on category insert.

This is more storage but pays off at report time — "How much did we spend on Petrol this quarter?" is one query against `ledger_entries WHERE account_id = X` instead of a cross-table aggregate by category. Reports come in Phase 4.

### 2.3 Salary closes the float loop

A salary_entry is the screen that consumes the `employee_float` balance. The form snapshots the float at draft time; server re-validates at post time and rejects with `SALARY_FLOAT_DRIFT` if the balance moved (e.g. another receipt posted to the same float between draft and post).

Net = gross − float_held. On post:
```
Dr. salary_expense                       gross_salary
Cr. employee_float[employee]             float_held       ← clears float
Cr. paid_from_account_id                 net_paid          ← cash leaves
```

Auto-debit cron + payslip generation deferred to Phase 4. For now this is a manual voucher per active employee per month.

---

## 3. Database schema

### 3.1 `vendor_bills`

```sql
CREATE TYPE vendor_bill_status AS ENUM ('draft','posted','cancelled');

CREATE TABLE vendor_bills (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id),

  bill_number              TEXT NOT NULL,                -- "VB/2026-04/0001"
  supplier_invoice_number  TEXT,                          -- the paper number from supplier
  bill_date                DATE NOT NULL,
  due_date                 DATE,

  party_id                 UUID NOT NULL REFERENCES parties(id),
  place_of_supply          CHAR(2) NOT NULL,              -- 2-digit state code

  status                   vendor_bill_status NOT NULL DEFAULT 'draft',

  -- Cached totals (recomputed on every line write)
  subtotal                 NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total                NUMERIC(15,2) NOT NULL DEFAULT 0,
  grand_total              NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Sum of payment_allocations.amount for this bill. Maintained
  -- in same txn as allocation insert/delete.
  allocated_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,

  remarks                  TEXT,

  posting_date             TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  cancellation_reason      TEXT,

  version                  INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID,
  updated_by               UUID,

  UNIQUE (tenant_id, bill_number),
  CHECK (allocated_amount >= 0 AND allocated_amount <= grand_total)
);

CREATE INDEX idx_bills_tenant_status ON vendor_bills(tenant_id, status);
CREATE INDEX idx_bills_tenant_party  ON vendor_bills(tenant_id, party_id);
CREATE INDEX idx_bills_tenant_date   ON vendor_bills(tenant_id, bill_date DESC);
-- For the "unpaid" filter
CREATE INDEX idx_bills_unpaid        ON vendor_bills(tenant_id) WHERE status='posted' AND allocated_amount < grand_total;
```

### 3.2 `vendor_bill_lines`

```sql
CREATE TABLE vendor_bill_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id             UUID NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,
  line_number         INT NOT NULL,

  -- Optional — bills can have free-text expense lines too
  item_id             UUID REFERENCES items(id),
  hsn_code            TEXT,
  description         TEXT NOT NULL,
  uom_id              UUID REFERENCES uoms(id),
  quantity            NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  discount_pct        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),

  -- Computed (same engine as InvoiceLine)
  rate_pct            NUMERIC(5,2) NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
  taxable_value       NUMERIC(15,2) NOT NULL,
  cgst_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  cess_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total          NUMERIC(15,2) NOT NULL,

  -- Override the default purchase_expense account on a per-line basis.
  -- Use case: one bill with two lines — one is "stock", another is
  -- "office supplies" — each goes to a different expense account.
  expense_account_id  UUID REFERENCES financial_accounts(id),

  remarks             TEXT,

  UNIQUE (bill_id, line_number)
);
```

### 3.3 `expense_categories`

```sql
CREATE TABLE expense_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  code                TEXT NOT NULL,              -- "FOOD", "PETROL"
  name                TEXT NOT NULL,
  is_capital          BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  -- Auto-set on insert; points at the category's expense_category account
  expense_account_id  UUID NOT NULL REFERENCES financial_accounts(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_expense_cat_tenant_active ON expense_categories(tenant_id, is_active);
```

### 3.4 `expenses`

```sql
CREATE TYPE expense_status AS ENUM ('draft','posted','cancelled');

CREATE TABLE expenses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),

  expense_number        TEXT NOT NULL,            -- "XV/2026-04/0001"
  expense_date          DATE NOT NULL,
  category_id           UUID NOT NULL REFERENCES expense_categories(id),
  amount                NUMERIC(15,2) NOT NULL CHECK (amount > 0),

  -- Cash, bank, or gpay account. Server enforces on POST.
  paid_from_account_id  UUID NOT NULL REFERENCES financial_accounts(id),

  -- Optional — useful for "fuel bill paid to BPCL"
  vendor_id             UUID REFERENCES parties(id),

  description           TEXT NOT NULL,
  attachment_id         UUID REFERENCES attachments(id),

  status                expense_status NOT NULL DEFAULT 'draft',
  posting_date          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,

  version               INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,

  UNIQUE (tenant_id, expense_number)
);

CREATE INDEX idx_expenses_tenant_status   ON expenses(tenant_id, status);
CREATE INDEX idx_expenses_tenant_category ON expenses(tenant_id, category_id);
CREATE INDEX idx_expenses_tenant_date     ON expenses(tenant_id, expense_date DESC);
```

### 3.5 `salary_entries`

```sql
CREATE TYPE salary_status AS ENUM ('draft','posted','cancelled');

CREATE TABLE salary_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),

  salary_number         TEXT NOT NULL,            -- "SAL/2026-04/0001"
  -- Always 1st of the month for grouping; server normalises
  period_month          DATE NOT NULL,
  employee_id           UUID NOT NULL REFERENCES employees(id),

  gross_salary          NUMERIC(15,2) NOT NULL CHECK (gross_salary > 0),
  -- Snapshot of employee_float at post time. Frozen here for audit;
  -- net_paid = gross_salary − float_held.
  float_held            NUMERIC(15,2) NOT NULL CHECK (float_held >= 0),
  net_paid              NUMERIC(15,2) NOT NULL CHECK (net_paid >= 0),
  paid_from_account_id  UUID NOT NULL REFERENCES financial_accounts(id),

  status                salary_status NOT NULL DEFAULT 'draft',
  posting_date          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,

  version               INT NOT NULL DEFAULT 0,
  remarks               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,

  UNIQUE (tenant_id, salary_number),
  -- One posted salary per (employee, period) — prevents accidental double-pay
  UNIQUE (tenant_id, employee_id, period_month) WHERE status='posted'
);

CREATE INDEX idx_salary_tenant_employee ON salary_entries(tenant_id, employee_id);
CREATE INDEX idx_salary_tenant_period   ON salary_entries(tenant_id, period_month DESC);
```

### 3.6 Required additions

```sql
-- Phase 3.5 extends payment_allocations to support vendor bills.
ALTER TABLE payment_allocations ADD COLUMN bill_id UUID REFERENCES vendor_bills(id);

-- The CHECK constraint must now allow exactly one of three FK columns
-- to be set. Drop and re-add:
ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_check;
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocations_check
  CHECK ((invoice_id IS NOT NULL)::int + (challan_id IS NOT NULL)::int + (bill_id IS NOT NULL)::int = 1);

CREATE INDEX idx_alloc_bill ON payment_allocations(bill_id) WHERE bill_id IS NOT NULL;

-- Employees get a payable_account_id (mirror of float_account_id).
ALTER TABLE employees ADD COLUMN payable_account_id UUID REFERENCES financial_accounts(id);
-- Backfill: for each existing employee, create an employee_payable
-- account and set the FK.
```

### 3.7 Auto-creation rules (extending Phase 3 rules)

- **Tenant provisioning** also creates: `purchase_expense`, `gst_input`, `salary_expense` accounts.
- **Employee insert** also creates an `employee_payable` account; store id on `employees.payable_account_id`.
- **ExpenseCategory insert** creates an `expense_category` account; store id on `expense_categories.expense_account_id`.

### 3.8 New `LedgerSourceType` values

The enum extends with `vendor_bill`, `expense`, `salary`. Existing values unchanged.

```sql
ALTER TYPE ledger_source_type ADD VALUE 'vendor_bill';
-- 'expense' and 'salary' were already in the Phase 3 enum.
```

---

## 4. API contract

All routes on the **inventory service** (`:8001/api/v1`). All require `Authorization: Bearer <access>`.

### 4.1 Vendor Bills

```
GET    /bills          ?party_id=&status=&unpaid=true&start_date=&end_date=
GET    /bills/{id}
POST   /bills          Body: VendorBillCreate
PATCH  /bills/{id}     Body: VendorBillUpdate (only when status='draft')
DELETE /bills/{id}     Only when status='draft'

GET    /bills/{id}/lines
POST   /bills/{id}/lines               Body: VendorBillLineCreate
PATCH  /bills/{id}/lines/{line_id}     Body: VendorBillLineUpdate
DELETE /bills/{id}/lines/{line_id}

POST   /bills/{id}/post                Body: {} — see §4.1.1
POST   /bills/{id}/cancel              Body: { reason } — see §4.1.2
```

#### 4.1.1 Post

Side effects (transactional):

1. Validate `status='draft'`; else `409 BILL_NOT_DRAFT`.
2. New `group_id`.
3. For each line, accumulate to debit accounts:
   - If `expense_account_id` set on the line, debit that account.
   - Otherwise debit the tenant's default `purchase_expense` account.
   - Sum: `subtotal` debited (split across accounts as above).
4. Debit `gst_input` account: `tax_total`.
5. Credit `party_payable` for `party_id`: `grand_total`.
6. Update `current_balance` on every affected account.
7. Set `bill.status='posted'`, `posting_date=now()`, `version += 1`.

#### 4.1.2 Cancel

1. Validate `status='posted'` (else `409 BILL_NOT_POSTED`) AND `allocated_amount = 0` (else `409 BILL_HAS_PAYMENTS` — caller must unallocate first).
2. Reverse all ledger entries with this bill's group_id (sign-flipped paired rows, same group_id).
3. Set `bill.status='cancelled'`, `cancelled_at=now()`, `cancellation_reason`, `version += 1`.

### 4.2 Expense Categories

```
GET    /expense-categories      ?is_active=
GET    /expense-categories/{id}
POST   /expense-categories      Body: { code, name, is_capital? }
PATCH  /expense-categories/{id} Body: { name?, is_capital?, is_active? }
DELETE /expense-categories/{id} Only when no posted expenses use this category
```

**On POST:** auto-create the matching `expense_category` financial account and store its id on the category row. `code` becomes "EXP-{code}" for the account.

### 4.3 Expenses

```
GET    /expenses        ?category_id=&status=&start_date=&end_date=
GET    /expenses/{id}
POST   /expenses        Body: ExpenseCreate
PATCH  /expenses/{id}   Only when status='draft'
DELETE /expenses/{id}   Only when status='draft'

POST   /expenses/{id}/post     — see §4.3.1
POST   /expenses/{id}/cancel
```

#### 4.3.1 Post

1. Validate `status='draft'`; else `409 EXPENSE_NOT_DRAFT`.
2. Validate `paid_from_account_id.type IN ('cash_in_hand','bank','gpay')`; else `422 INVALID_PAYMENT_ACCOUNT`.
3. New `group_id`.
4. Ledger entries:
   ```
   Dr. expense_category[category_id]    amount
   Cr. paid_from_account_id              amount
   ```
5. Update `current_balance` on both accounts.
6. Set `expense.status='posted'`, `posting_date=now()`, `version += 1`.

### 4.4 Salary

```
GET    /salary           ?employee_id=&status=&period_month=
GET    /salary/{id}
POST   /salary           Body: SalaryEntryCreate
PATCH  /salary/{id}      Only when status='draft'
DELETE /salary/{id}      Only when status='draft'

POST   /salary/{id}/post     — see §4.4.1
POST   /salary/{id}/cancel
```

#### 4.4.1 Post

1. Validate `status='draft'`; else `409 SALARY_NOT_DRAFT`.
2. **Re-validate float**: read `employee.float_account.current_balance`; if it doesn't equal `salary_entry.float_held` to the paisa, fail `422 SALARY_FLOAT_DRIFT`.
3. Validate `paid_from_account_id.type IN ('cash_in_hand','bank','gpay')`.
4. Validate uniqueness: no other posted salary_entry exists for `(employee_id, period_month)`; else `409 SALARY_PERIOD_DUPLICATE`.
5. New `group_id`.
6. Ledger entries:
   ```
   Dr. salary_expense                                gross_salary
   Cr. employee_float[employee_id]                   float_held       ← clears float
   Cr. paid_from_account_id                          net_paid          ← cash leaves
   ```
   (If `float_held = 0`, skip that row.)
7. Update `current_balance` on every affected account.
8. Set `salary.status='posted'`, `posting_date=now()`, `version += 1`.

### 4.5 Payment Allocations — extension

Existing `POST /payments/{id}/allocations` body now accepts `bill_id` instead of (or in addition to mutually-exclusive with) `invoice_id`:

```
POST /payments/{id}/allocations
Body: { bill_id: <uuid>, amount: "..." }   — for direction='paid'
   or { invoice_id: <uuid>, amount: "..." } — for direction='received'
```

Validations on `bill_id` allocation:
- `payment.status='posted'` AND `payment.direction='paid'`.
- `bill.status='posted'`.
- `bill.party_id = payment.party_id`.
- `payment.allocated_amount + amount ≤ payment.amount`.
- `bill.allocated_amount + amount ≤ bill.grand_total` (else `409 OVER_ALLOCATED`).

**On allocation insert:** in same txn:
1. Increment `payments.allocated_amount`.
2. Increment `vendor_bills.allocated_amount`.
3. Write paired ledger entries:
   ```
   Dr. party_payable[bill.party_id]    amount
   Cr. <some neutral wash account>     amount   — see note below
   ```

   **Implementation note:** the original payment's posting already debited party_payable on credit side and credited a cash/bank/gpay. So the allocation itself doesn't need new ledger entries — it's purely a pointer that ties the payment to the bill. The payment's existing ledger entries already settled the party_payable. **Skip new ledger entries on allocation; only update `allocated_amount` cached counters on both sides.**

   This matches how invoice-side allocations work in REQ-6 (no new ledger entries on allocation; the receipt's posting already handled it).

---

## 5. Error codes (FE handles these specifically)

| HTTP | Code | When |
| --- | --- | --- |
| 422 | `INVALID_PAYMENT_ACCOUNT`     | Expense's paid_from is not cash/bank/gpay |
| 422 | `SALARY_FLOAT_DRIFT`          | Salary float_held doesn't match current employee_float balance |
| 409 | `BILL_NOT_DRAFT`              | Mutation attempted on non-draft bill |
| 409 | `BILL_NOT_POSTED`             | Cancel attempted on non-posted bill |
| 409 | `BILL_HAS_PAYMENTS`           | Cancel attempted while allocated_amount > 0 |
| 409 | `EXPENSE_NOT_DRAFT`           | Mutation on non-draft expense |
| 409 | `EXPENSE_NOT_POSTED`          | Cancel on non-posted expense |
| 409 | `SALARY_NOT_DRAFT`            | Mutation on non-draft salary |
| 409 | `SALARY_NOT_POSTED`           | Cancel on non-posted salary |
| 409 | `SALARY_PERIOD_DUPLICATE`     | Already a posted salary for (employee, period) |
| 409 | `EXPENSE_CATEGORY_IN_USE`     | Category delete attempted while expenses reference it |
| 409 | `OVER_ALLOCATED`              | Sum of allocations > payment.amount or > bill.grand_total |
| 404 | `BILL_NOT_FOUND` |
| 404 | `EXPENSE_NOT_FOUND` |
| 404 | `EXPENSE_CATEGORY_NOT_FOUND` |
| 404 | `SALARY_NOT_FOUND` |
| 403 | `PERMISSION_DENIED`           | Caller lacks required perm |

---

## 6. Permissions

| Code | Required for |
| --- | --- |
| `inventory.bills.read`             | List/detail/print bills |
| `inventory.bills.write`            | Create/edit drafts |
| `inventory.bills.post`             | POST `/bills/{id}/post` |
| `inventory.bills.cancel`           | POST `/bills/{id}/cancel` |
| `inventory.expenses.read`          | List/detail expenses |
| `inventory.expenses.write`         | Create/edit drafts |
| `inventory.expenses.post`          | POST `/expenses/{id}/post` |
| `inventory.expenses.cancel`        | POST `/expenses/{id}/cancel` |
| `inventory.expense_categories.read`  | View categories |
| `inventory.expense_categories.write` | Edit categories |
| `inventory.salary.read`            | View salary entries |
| `inventory.salary.write`           | Create/edit drafts |
| `inventory.salary.post`            | POST `/salary/{id}/post` |
| `inventory.salary.cancel`          | POST `/salary/{id}/cancel` |

14 new codes total. All seeded on the FE in `src/lib/demo/fixtures.ts`. Tenants can build any role mix.

---

## 7. Tests the backend should ship

```
# Vendor Bills
test_create_draft_bill_returns_zero_totals
test_add_line_recomputes_header_totals
test_post_writes_three_row_ledger_entry
test_post_with_per_line_expense_account_override
test_cancel_reverses_ledger_entries_when_unallocated
test_cannot_cancel_bill_with_payments
test_cannot_modify_posted_bill
test_bill_unpaid_filter

# Expenses
test_post_writes_dr_category_cr_paid_from
test_post_rejects_paid_from_non_cash_account
test_cancel_reverses_entries

# Expense Categories
test_create_category_auto_creates_account
test_cannot_delete_category_with_expenses
test_rename_category_does_not_change_account_id

# Salary
test_post_writes_three_row_entry_with_float_clearance
test_post_skips_float_row_when_zero
test_post_rejects_when_float_drifts_between_draft_and_post
test_one_posted_salary_per_employee_per_period
test_cancel_restores_float

# Allocation extension
test_payment_can_allocate_against_bill
test_allocation_against_other_party_bill_rejected
test_over_allocate_bill_rejected
test_cancelling_payment_unallocates_bills

# Cross-module wiring
test_summary_endpoint_includes_vendor_bills_pending
test_super_admin_can_act_cross_tenant_via_x_acting_tenant_id
```

---

## 8. Out of scope for Phase 3.5

- **Salary auto-debit cron + payslip generation** — Phase 4. Needs scheduled-job runner.
- **Bill linked to GRN** — like invoice/challan, copy lines from a GRN. Phase 4.
- **Reports**: P&L summary, debt aging, expense-by-category. Phase 4.
- **Period close** (locking ledger entries before a date).
- **Multi-currency bills** — INR-only.
- **Reverse charge / RCM on inputs** — sub-feature of GST.

---

## 9. Frontend status

| Surface | File | Behaviour today |
| --- | --- | --- |
| Bills list | `src/app/(dashboard)/bills/page.tsx` | Filters, status + outstanding columns |
| Bills new | `src/app/(dashboard)/bills/new/page.tsx` | Mirror of invoice new; live GST math; multi-line |
| Bill detail | `src/app/(dashboard)/bills/[id]/page.tsx` | View, Post, Cancel; settlement panel; "Pay this" link |
| Expenses list | `src/app/(dashboard)/money/expenses/page.tsx` | Category, paid-from, vendor columns |
| Expenses new | `src/app/(dashboard)/money/expenses/new/page.tsx` | Category picker, paid-from = cash/bank/gpay only, optional vendor |
| Expense Categories | `src/app/(dashboard)/money/expenses/categories/page.tsx` | List + create; "Spent" rolling balance per category |
| Salary list | `src/app/(dashboard)/money/salary/page.tsx` | Period, gross, float, net columns |
| Salary new | `src/app/(dashboard)/money/salary/new/page.tsx` | Employee picker → auto-fills gross + float; net auto-computed; warning banner when float > 0 |
| Salary detail | `src/app/(dashboard)/money/salary/[id]/page.tsx` | View + post + cancel; pseudo-ledger preview |
| Payments new (extended) | `src/app/(dashboard)/money/payments/new/page.tsx` | Allocation panel against vendor's open bills (mirror of receipts→invoices) |
| Money landing | `src/app/(dashboard)/money/page.tsx` | New "Bills pending" tile |
| Sidebar | `src/components/layout/sidebar.tsx` | Bills entry under Billing; Expenses + Salary entries under Money |
| Demo adapter | `src/lib/demo/adapter.ts` | All read endpoints faithful; state-change endpoints flip status |
| Services | `src/services/{bills,expenses,salary}.service.ts` | All endpoints in §4 wired |
| Types | `src/types/index.ts` | New entities + extended `AccountType`, `LedgerSourceType`, `PaymentAllocation` |

When the backend ships these endpoints with matching shapes, **no FE changes are required**.

---

## 10. Sequence to ship (suggested order)

1. **Migration** — vendor_bills + lines, expense_categories, expenses, salary_entries; ALTER for payment_allocations.bill_id and employees.payable_account_id.
2. **System-account auto-creation extensions** — purchase_expense, gst_input, salary_expense per tenant; per-employee employee_payable; per-category expense_category.
3. **Number series seeding** — `VB`, `XV`, `SAL` series per tenant.
4. **Permission seeding** — 14 new codes.
5. **Service layer** — `vendor_bill_service.py`, `expense_service.py`, `expense_category_service.py`, `salary_service.py`.
6. **Endpoints** — the 21 routes in §4.
7. **Cross-module wiring** — extend `payment_service.allocate()` to handle `bill_id`. Extend `/ledger/summary` to include `vendor_bills_pending`.
8. **Tests** — §7.
9. **Smoke test integration** — extend `frontend/scripts/smoke-test-api.sh` with bill+expense+salary round-trips.

After that, FE flips from demo adapter to real backend by setting `NEXT_PUBLIC_DEMO_MODE=false` in `.env.local`.
