# Phase 3 — Money: Accounts, Ledger, Payments, Employees

> **Status:** Living document. Updated as the FE prototype matures.
> **Last revised:** 2026-04-29
> **Origin:** derived from working FE prototype at `src/app/(dashboard)/money/*` + the party-ledger tab on `/parties/[id]?tab=ledger`.
> **Companion:** [INVOICE_BACKEND_SPEC.md](INVOICE_BACKEND_SPEC.md) (REQ-4) and [CHALLAN_BACKEND_SPEC.md](CHALLAN_BACKEND_SPEC.md) (REQ-5) — Phase 3 wires those into a real ledger.
> **Companion:** [CLIENT_NEEDS_GAP.md](CLIENT_NEEDS_GAP.md) §5, §10, §11.
> **For backend dev:** this is the contract. Build the API to satisfy it; FE will swap from demo adapter to real endpoints with zero further FE changes.

---

## 1. Overview

Phase 3 adds the **Money** module — collections, payments, multi-ledger UX, debtors/creditors, and the per-employee float that ties customer-paid-the-salesman flows back into payroll. It is the foundation §5 (Debtor module), §10 (Collections), and §11 (Ledger) from `clientneeds.txt` all share.

**Architectural call:** double-entry under the hood, multi-ledger UX on top. Every business event writes paired debit/credit rows to `ledger_entries` against `financial_accounts`. The UI presents these as separate "ledgers" by account type (Cash / Bank / Cheque-in-transit / GPay / per-Party / per-Employee), but storage is one table. This avoids the rewrite that a flat-transactions model would demand at Phase 3.5 (expenses, salary, P&L).

**The four sub-features ship together** because they're inseparable in the user's mind:

| Surface | Backed by | Key dependency |
| --- | --- | --- |
| §5 Debtors / Creditors | `financial_accounts` of type `party_receivable` / `party_payable` | Per-party `current_balance` |
| §10 Collections | `payments` table (direction='received') | Allocations against invoices |
| §11 Multi-ledger | `financial_accounts` + `ledger_entries` | Same |
| Employee float | `financial_accounts` of type `employee_float` | One per employee, set on the receipt when payee=employee |

**Status state machine** (mirrors invoices/challans):

```
draft  →  posted  →  cancelled
   \-----→ deleted (only from draft)
```

- **Draft** — fully editable. No ledger entries written. Can be deleted.
- **Posted** — locked. Ledger entries written. `current_balance` updated on every affected account. Can only be cancelled, never edited.
- **Cancelled** — paired reversal entries written (same group_id with sign-flipped). Original kept for audit.

---

## 2. Critical business rule — Employee Float

The headline mechanic of Phase 3. When a customer pays a salesman/driver via GPay/UPI personally, that money belongs to the company but sits in the employee's personal UPI. Two storage options:

### 2.1 Storage (the right call)

Each Employee gets an auto-created `financial_accounts` row of type `employee_float`. A receipt with `mode='gpay' AND payee_employee_id IS NOT NULL` posts:

```
Dr. employee_float[ramesh]      8500.00     ← Ramesh now "holds" company money
Cr. party_receivable[mehta]     8500.00     ← Mehta's invoice settles
```

### 2.2 UX on the salary screen (Phase 3.5)

```
Salary due:                       ₹50,000
Less: float Ramesh is holding   – ₹10,000
Net payable:                      ₹40,000
```

The settle entry on salary day is:

```
Dr. employee_payable[ramesh]   10000.00     ← we owed him 50K, now owe 40K net
Cr. employee_float[ramesh]     10000.00     ← float clears
```

(Salary is itself a separate entry not detailed here — Phase 3.5.)

### 2.3 Constraint

A receipt with `mode='gpay'` and `payee_employee_id` set must use that employee's float account as `account_id`. Server-side enforcement: validate `account_id` resolves to an `employee_float` account whose `employee_id` matches the receipt's `payee_employee_id`.

---

## 3. Database schema

### 3.1 `financial_accounts`

```sql
CREATE TYPE account_type AS ENUM (
  'cash_in_hand',
  'bank',
  'cheque_in_transit',
  'gpay',
  'party_receivable',
  'party_payable',
  'employee_float',
  'sales_income',
  'purchase_expense',
  'gst_output',
  'gst_input',
  'capital',
  'manual'
);

CREATE TABLE financial_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),

  type            account_type NOT NULL,
  code            TEXT NOT NULL,                      -- "CASH", "AR-CUS-001", "FLOAT-RAMESH"
  name            TEXT NOT NULL,

  -- Set for party_receivable / party_payable
  party_id        UUID REFERENCES parties(id),
  -- Set for employee_float
  employee_id     UUID REFERENCES employees(id),

  -- Bank-specific (visible on receipts)
  account_number  TEXT,
  ifsc            TEXT,

  -- Signed: positive = debit nature (asset/expense), negative = credit nature
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,

  is_system       BOOLEAN NOT NULL DEFAULT false,     -- auto-created, can rename only
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, code),

  -- Each party gets at most one receivable + one payable
  UNIQUE (tenant_id, type, party_id)
    DEFERRABLE INITIALLY IMMEDIATE,
  -- Each employee gets at most one float
  UNIQUE (tenant_id, type, employee_id)
    DEFERRABLE INITIALLY IMMEDIATE,

  CHECK ((type IN ('party_receivable','party_payable')) = (party_id IS NOT NULL)),
  CHECK ((type = 'employee_float') = (employee_id IS NOT NULL))
);

CREATE INDEX idx_accounts_tenant_type    ON financial_accounts(tenant_id, type);
CREATE INDEX idx_accounts_tenant_party   ON financial_accounts(tenant_id, party_id) WHERE party_id IS NOT NULL;
CREATE INDEX idx_accounts_tenant_emp     ON financial_accounts(tenant_id, employee_id) WHERE employee_id IS NOT NULL;
```

**System-account auto-creation:**
- On tenant provisioning: insert one each of `cash_in_hand`, `bank` (default), `cheque_in_transit`, `gpay`, `sales_income`, `gst_output`.
- On Party insert: insert `party_receivable` (and `party_payable` if `party_type IN ('supplier','both')`).
- On Employee insert: insert `employee_float` and store its id back on `employees.float_account_id`.

### 3.2 `ledger_entries`

```sql
CREATE TYPE ledger_source_type AS ENUM (
  'invoice',
  'challan',
  'payment',
  'cheque_deposit',
  'expense',
  'salary',
  'opening',
  'manual'
);

CREATE TABLE ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  account_id      UUID NOT NULL REFERENCES financial_accounts(id),

  entry_date      DATE NOT NULL,
  source_doc_type ledger_source_type NOT NULL,
  source_doc_id   UUID NOT NULL,                      -- FK by convention, no DB-level ref

  -- Exactly one of debit/credit non-zero per row
  debit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit          NUMERIC(15,2) NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit + credit) > 0),

  -- Denormalised at write time; validated periodically
  running_balance NUMERIC(15,2) NOT NULL,

  -- Group all rows of one journal voucher together. Reversals share
  -- the same group_id with sign-flipped amounts.
  group_id        UUID NOT NULL,

  remarks         TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_account_date ON ledger_entries(account_id, entry_date, created_at);
CREATE INDEX idx_ledger_tenant_date  ON ledger_entries(tenant_id, entry_date);
CREATE INDEX idx_ledger_group        ON ledger_entries(group_id);
CREATE INDEX idx_ledger_source       ON ledger_entries(source_doc_type, source_doc_id);
```

**Invariant:** for every `group_id`, `SUM(debit) = SUM(credit)`. Enforced at the service layer (transactional). Backend should ship a periodic check that flags drift.

**Rule:** ledger_entries are append-only. Reversals are new rows; never UPDATE/DELETE.

### 3.3 `payments`

```sql
CREATE TYPE payment_direction AS ENUM ('received','paid');
CREATE TYPE payment_mode      AS ENUM ('cash','bank','cheque','gpay');
CREATE TYPE payment_status    AS ENUM ('draft','posted','cancelled');

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),

  payment_number      TEXT NOT NULL,                  -- "RV/2026-04/0001" or "PV/2026-04/0001"
  payment_date        DATE NOT NULL,
  direction           payment_direction NOT NULL,

  party_id            UUID NOT NULL REFERENCES parties(id),
  amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  mode                payment_mode NOT NULL,

  -- Polymorphic detail blob — one of CashDetails | BankDetails |
  -- ChequeDetails | GPayDetails per src/types/index.ts.
  details             JSONB NOT NULL,

  -- The cash/bank/cheque/gpay/float account this hits.
  account_id          UUID NOT NULL REFERENCES financial_accounts(id),

  -- Set when mode='gpay' AND payee was an employee. account_id then
  -- must resolve to that employee's float account.
  payee_employee_id   UUID REFERENCES employees(id),

  status              payment_status NOT NULL DEFAULT 'draft',

  posting_date        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,

  remarks             TEXT,

  -- Sum of allocations applied so far. amount − allocated_amount = "on account".
  allocated_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,

  version             INT NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,

  UNIQUE (tenant_id, payment_number),
  CHECK (allocated_amount >= 0 AND allocated_amount <= amount)
);

CREATE INDEX idx_payments_tenant_direction_status ON payments(tenant_id, direction, status);
CREATE INDEX idx_payments_tenant_party            ON payments(tenant_id, party_id);
CREATE INDEX idx_payments_tenant_date             ON payments(tenant_id, payment_date DESC);
CREATE INDEX idx_payments_tenant_employee         ON payments(tenant_id, payee_employee_id) WHERE payee_employee_id IS NOT NULL;
-- For the /money/cheques view
CREATE INDEX idx_payments_cheque_pending          ON payments(tenant_id, payment_date)
  WHERE mode='cheque' AND status='posted' AND (details->>'cleared')::boolean = false;
```

### 3.4 `payment_allocations`

```sql
CREATE TABLE payment_allocations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id  UUID REFERENCES invoices(id),
  challan_id  UUID REFERENCES challans(id),
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),

  CHECK ((invoice_id IS NOT NULL)::int + (challan_id IS NOT NULL)::int = 1),
  -- Phase 3 v1: only invoice allocations are exercised by the FE.
  -- challan_id reserved for Phase 3.5 challan-direct settlement.

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX idx_alloc_invoice ON payment_allocations(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_alloc_challan ON payment_allocations(challan_id) WHERE challan_id IS NOT NULL;
```

**Server-side rule:** `SUM(payment_allocations.amount WHERE payment_id=X) = payments[X].allocated_amount`. Maintain in same transaction as the allocation insert/delete.

### 3.5 `employees`

```sql
CREATE TABLE employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),

  user_id             UUID REFERENCES users(id),       -- optional system login
  name                TEXT NOT NULL,
  role                TEXT NOT NULL,                    -- free-text job title, NOT RBAC
  monthly_salary      NUMERIC(15,2) NOT NULL CHECK (monthly_salary >= 0),
  phone               TEXT,
  email               TEXT,

  payment_account_id  UUID REFERENCES financial_accounts(id),

  joined_at           DATE NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,

  -- Auto-set to the matching employee_float account on insert
  float_account_id    UUID NOT NULL REFERENCES financial_accounts(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_tenant_active ON employees(tenant_id, is_active);
```

### 3.6 Required additions to existing tables

```sql
-- Already added by Phase 1; included here for reference.
-- ALTER TABLE parties ADD COLUMN opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Phase 3: parties get auto-created AR/AP accounts when inserted.
-- The opening_balance value lands as a single ledger_entry against
-- the AR or AP account, group_id=opening-<tenant>.
```

---

## 4. API contract

All routes on the **inventory service** (`:8001/api/v1`). All require `Authorization: Bearer <access>`. Multi-tenant via JWT `tid` (or `X-Acting-Tenant-Id` for super-admin overrides).

### 4.1 Accounts (Chart of Accounts)

```
GET    /accounts            ?type=...&party_id=...&employee_id=...&is_active=true|false
GET    /accounts/{id}
POST   /accounts            (only for type='manual'; system accounts auto-created)
PATCH  /accounts/{id}       Body: { name?, account_number?, ifsc?, is_active? }
DELETE /accounts/{id}       Only when is_system=false AND no ledger entries
```

**System account constraints:** PATCH may change `name`, `account_number`, `ifsc`, `is_active`. Other fields read-only. DELETE on system account → `409 SYSTEM_ACCOUNT`.

### 4.2 Ledger (read-only views)

```
GET /ledger/accounts/{id}    ?start_date=&end_date=&limit=&cursor=
  → LedgerEntry[] for one account, ordered by entry_date asc, created_at asc

GET /ledger/parties/{id}     ?start_date=&end_date=&limit=&cursor=
  → PartyLedgerRow[] (LedgerEntry + source_label) — joins to that
    party's receivable + payable accounts

GET /ledger/summary          (no params)
  → {
      cash_in_hand: "...",
      bank: "...",
      cheque_in_transit: "...",
      gpay: "...",
      total_receivable: "...",         // sum across all party_receivable
      total_payable:    "...",         // ABS(sum of party_payable)
      employee_float:   "...",         // sum across all employee_float
      as_of: "<ISO timestamp>"
    }
```

The summary endpoint must be cheap (single query summing `current_balance` grouped by `type`). FE polls it on the /money landing page.

### 4.3 Payments — list + detail

```
GET /payments
  ?direction=received|paid
  ?party_id=<uuid>
  ?mode=cash|bank|cheque|gpay
  ?status=draft|posted|cancelled
  ?cheque_in_transit=true       — convenience: mode='cheque' AND status='posted' AND details.cleared=false
  ?payee_employee_id=<uuid>
  ?start_date=YYYY-MM-DD &end_date=YYYY-MM-DD
  ?limit= &cursor=

GET /payments/{id}
```

### 4.4 Create draft payment

```
POST /payments
Body:
  {
    "payment_number": "RV/2026-04/0007",     // optional; allocate from number_series if absent
    "payment_date":   "2026-04-29",
    "direction":      "received",            // or "paid"
    "party_id":       "<uuid>",
    "amount":         "8500.00",
    "mode":           "gpay",
    "details": {                             // shape depends on mode
      "mode": "gpay",
      "transaction_ref": "UPI/RAMESH/2026-04-28-3344",
      "payer_upi": "greenfield@axisbank"
    },
    "account_id":         "<uuid>",          // see §4.4.1 below
    "payee_employee_id":  "<uuid>",          // required iff mode='gpay' AND paid to employee
    "remarks":            "..."
  }

Response 201 — Payment with status="draft", allocated_amount="0.00"
```

#### 4.4.1 `account_id` validation by mode

| mode | Allowed `account_id.type` | When `payee_employee_id` set |
| --- | --- | --- |
| `cash`   | `cash_in_hand` | n/a |
| `bank`   | `bank`         | n/a |
| `cheque` | `cheque_in_transit` | n/a |
| `gpay`   | `gpay` (company) OR `employee_float` (employee) | account must be the employee's float |

For `direction='paid'`:
- `cash` → `cash_in_hand`
- `bank` → `bank`
- `cheque` → `bank` (cheques drawn FROM our bank)
- `gpay` → `gpay`
- `payee_employee_id` not used (we don't pay vendors via the salesman's UPI)

Server returns `422 INVALID_ACCOUNT_FOR_MODE` on mismatch.

### 4.5 Update / delete a draft

```
PATCH  /payments/{id}                 Body: PaymentUpdate (any subset of fields)
DELETE /payments/{id}                 Only when status='draft'
```

### 4.6 Post

```
POST /payments/{id}/post
Body: {} (or empty)

Response 200 — Payment with status="posted", posting_date=now(), version+=1
```

Side effects (transactional — must all succeed or all roll back):

1. Generate one `group_id`.
2. Write paired `ledger_entries`:

   **Receipts** (`direction='received'`):
   ```
   Dr. account_id (cash/bank/cheque-transit/gpay/employee-float)   amount
   Cr. financial_account where type='party_receivable' AND party_id=...   amount
   ```

   **Payments** (`direction='paid'`):
   ```
   Dr. financial_account where type='party_payable' AND party_id=...   amount
   Cr. account_id (cash/bank/gpay)                                     amount
   ```

3. Update `current_balance` on both accounts (Dr add, Cr subtract for asset/expense; symmetric for liability/income).
4. Update `running_balance` on the entries.
5. Set `payment.status='posted'`, `posting_date=now()`, `version += 1`.

Idempotency: re-posting → `409 PAYMENT_NOT_DRAFT`.

### 4.7 Cancel

```
POST /payments/{id}/cancel
Body: { "reason": "Wrong amount entered" }

Response 200 — Payment with status="cancelled", cancelled_at=now(), version+=1
```

Side effects (transactional):

1. For each `ledger_entries` row with this payment's `group_id`:
   - Write a paired reversal row with the same group_id, swapped debit/credit.
2. Reverse the `current_balance` movement on both accounts.
3. Drop all `payment_allocations` for this payment (the invoices return to their pre-allocation balance).
4. Set `payment.status='cancelled'`, `cancelled_at=now()`, `cancellation_reason`, `version += 1`.

Idempotency: cancelling non-posted → `409 PAYMENT_NOT_POSTED`.

### 4.8 Allocations

```
GET    /payments/{id}/allocations              → PaymentAllocation[]
POST   /payments/{id}/allocations              Body: { invoice_id, amount }
DELETE /payments/{id}/allocations/{alloc_id}
```

**Validation on POST:**
- `payment.status` must be `'posted'`.
- `invoice.status` must be `'posted'`.
- `invoice.party_id` must equal `payment.party_id`.
- `payment.allocated_amount + amount ≤ payment.amount`.
- Allocating across an existing allocation total > invoice.grand_total → `409 OVER_ALLOCATED`.

After insert/delete: recompute `payment.allocated_amount = SUM(allocations)` in the same transaction.

### 4.9 Cheque Deposit (the cheque-clearing workflow)

```
POST /payments/{id}/deposit
Body:
  {
    "deposited_to_account_id": "<bank account id>",
    "deposit_date":            "2026-04-30"
  }

Response 200 — Payment with details.cleared=true, details.deposit_date set, version+=1
```

Validation:
- `payment.mode='cheque'`.
- `payment.status='posted'`.
- `details.cleared=false` (no double-deposit).
- `deposited_to_account_id.type='bank'`.

Side effects (transactional):

1. New `group_id`.
2. Write ledger entries:
   ```
   Dr. bank account                amount
   Cr. cheque_in_transit account   amount
   ```
   (`source_doc_type='cheque_deposit'`, `source_doc_id=payment.id`.)
3. Update `current_balance` on both accounts.
4. Patch `payment.details` to set `cleared=true`, `deposit_date`, `deposited_to_account_id`.

### 4.10 Employees

```
GET    /employees           ?is_active=true|false&limit=&cursor=
GET    /employees/{id}
POST   /employees           Body: { name, role, monthly_salary, phone?, email?, joined_at, user_id?, payment_account_id? }
PATCH  /employees/{id}      Body: any subset
DELETE /employees/{id}      Only when float_account.current_balance = 0 AND no posted payments reference them
```

**On POST:** in the same transaction, insert a `financial_accounts` row with `type='employee_float'`, `code='FLOAT-<UPPER(first-word-of-name)>-<short-uuid>'`, `name='Float — <employee.name>'`, `is_system=true`, `opening_balance=0`. Set `employees.float_account_id` to that account's id and return.

**On DELETE:** reject if the float has a non-zero balance or any active receipts reference the employee. Soft-delete (`is_active=false`) is the normal path.

---

## 5. Error codes (FE handles these specifically)

| HTTP | Code | When |
| --- | --- | --- |
| 422 | `INVALID_ACCOUNT_FOR_MODE` | account_id.type doesn't match payment.mode (see §4.4.1) |
| 422 | `EMPLOYEE_FLOAT_REQUIRED`  | mode='gpay' + payee_employee_id set, but account_id is not that employee's float |
| 422 | `OVER_ALLOCATED`           | Sum of allocations > payment.amount or > invoice remaining |
| 409 | `PAYMENT_NOT_DRAFT`        | Mutation attempted on non-draft |
| 409 | `PAYMENT_NOT_POSTED`       | Cancel/deposit attempted on non-posted |
| 409 | `CHEQUE_ALREADY_CLEARED`   | Deposit attempted on cleared cheque |
| 409 | `SYSTEM_ACCOUNT`           | Delete or restricted edit on a system account |
| 409 | `EMPLOYEE_HAS_FLOAT`       | Delete attempted while employee_float.current_balance ≠ 0 |
| 409 | `VERSION_MISMATCH`         | Optimistic-lock conflict on PATCH |
| 404 | `PAYMENT_NOT_FOUND` |
| 404 | `ACCOUNT_NOT_FOUND` |
| 404 | `EMPLOYEE_NOT_FOUND` |
| 403 | `PERMISSION_DENIED`        | Caller lacks required perm |

---

## 6. Permissions

| Code | Required for |
| --- | --- |
| `inventory.accounts.read`         | Chart of Accounts list/detail, account-ledger views |
| `inventory.accounts.write`        | Create/edit custom accounts, rename system accounts |
| `inventory.ledger.read`           | /money landing summary, per-party + per-account ledger views, /money/debtors |
| `inventory.payments.read`         | View receipts + payments + cheques |
| `inventory.payments.write`        | Create / edit drafts; cheque deposit |
| `inventory.payments.post`         | POST `/payments/{id}/post` |
| `inventory.payments.cancel`       | POST `/payments/{id}/cancel` |
| `inventory.employees.read`        | View employees |
| `inventory.employees.write`       | Create / edit employees |
| `inventory.parties.write_balance` | Edit party.opening_balance specifically (separate from parties.write — sensitive) |

Tenants can build any role mix from these. Examples seeded on the FE:

- **Cashier** — `payments.read + payments.write + payments.post + employees.read`
- **Finance Lead** — all the above
- **Auditor** — `accounts.read + ledger.read + payments.read + employees.read`

---

## 7. Cross-module wiring (the gotcha)

Phase 3 changes the side effects of two earlier modules. Both are small but **mandatory**:

### 7.1 Invoice POST (REQ-4)

When an invoice posts, in addition to the existing stock OUT movement creation, the invoice service must write ledger entries:

```
Dr. financial_account WHERE type='party_receivable' AND party_id=invoice.party_id    grand_total
Cr. financial_account WHERE type='sales_income'                                       subtotal
Cr. financial_account WHERE type='gst_output'                                         tax_total
```

`source_doc_type='invoice'`, `source_doc_id=invoice.id`, single `group_id` for all three.

### 7.2 Invoice CANCEL (REQ-4)

Reverse the above three entries (paired with sign-flip), same group_id strategy as Payment CANCEL.

### 7.3 The challan-linked-invoice case (REQ-5 invariant preserved)

If `invoice.challan_id IS NOT NULL`:
- Stock OUT was already created on challan post — DON'T create again. (This was already in REQ-5.)
- Ledger entries for the invoice ARE still created — the financial entry only happens on invoice post, never on challan post (challan doesn't write to the ledger).

So the cross-product behaves correctly: stock moves on challan post, ledger moves on invoice post, no double counting either way.

---

## 8. Tests the backend should ship

```
# Accounts + auto-creation
test_tenant_provisioning_creates_system_accounts
test_party_insert_creates_receivable_account
test_party_insert_creates_payable_account_when_supplier_or_both
test_employee_insert_creates_float_account_and_links_id
test_cannot_delete_system_account
test_can_rename_system_account_but_not_change_type

# Ledger invariants
test_every_group_id_balances_to_zero
test_running_balance_matches_recomputed_sum
test_ledger_entries_are_append_only

# Payments — happy paths
test_post_cash_receipt_writes_paired_entries
test_post_bank_receipt_lands_on_bank_account
test_post_cheque_receipt_lands_on_cheque_in_transit
test_post_gpay_to_company_lands_on_gpay
test_post_gpay_to_employee_lands_on_employee_float
test_post_payment_to_vendor_writes_paired_entries

# Allocation rules
test_allocate_against_open_invoice_reduces_invoice_balance
test_cannot_over_allocate
test_cannot_allocate_to_other_party_invoice
test_cancel_payment_drops_allocations_and_restores_invoice_balance

# Cheque clearing
test_deposit_writes_transit_to_bank_move
test_cannot_double_deposit
test_cannot_deposit_unposted_cheque

# State machine
test_cannot_modify_posted_payment
test_cannot_post_already_posted
test_cannot_cancel_draft_or_cancelled

# GPay-employee constraint
test_employee_gpay_must_use_their_float_account
test_employee_gpay_with_company_account_rejected

# Cross-module (REQ-4 wiring)
test_invoice_post_writes_ar_sales_gst_entries
test_invoice_cancel_reverses_ledger_entries_with_sign_flip
test_invoice_with_challan_skips_stock_but_writes_ledger

# Permissions
test_payments_read_requires_perm
test_payments_post_requires_separate_post_perm
test_super_admin_can_act_cross_tenant_via_x_acting_tenant_id
```

---

## 9. Out of scope for Phase 3 (deferred)

These are deliberately punted — the FE does not exercise them:

- **Expenses** module (Food / Petrol / Diesel / Labour / Capital). Adjacent but separable; Phase 3.5.
- **Salary auto-debit cron** + payslip generation. Phase 3.5; for now "Pay salary" is a manual `Payment` voucher.
- **Vendor bills (purchase invoices)** — symmetric to sales invoices but a fresh module. Phase 3.5.
- **Reports** (debt aging, sales/purchase/P&L). Phase 3.5; tiles + per-account journal cover v1.
- **Bulk operations** (bulk cheque deposit, bulk receipt entry).
- **Allocation against challans** (challan_id on payment_allocations is reserved but not exercised).
- **Period close** (locking ledger entries before a date).
- **Multi-currency journal entries** — INR only for Phase 3.

---

## 10. Frontend status

What's already built and waiting for backend (no further FE work blocks shipping):

| Surface | File | Behaviour today |
| --- | --- | --- |
| Money landing | `src/app/(dashboard)/money/page.tsx` | Tiles for all 7 balance types + recent receipts/payments feeds |
| Receipts list | `src/app/(dashboard)/money/receipts/page.tsx` | Filter by direction='received', shows employee-float receipts inline |
| Receipts new | `src/app/(dashboard)/money/receipts/new/page.tsx` | 4 mode-specific sections, payee picker (company / employee), allocation panel against open invoices |
| Receipt detail | `src/app/(dashboard)/money/receipts/[id]/page.tsx` | View, Post, Cancel — RBAC-gated |
| Payments list/new/detail | `src/app/(dashboard)/money/payments/*` | Symmetric to receipts; no employee-payee branch |
| Cheques | `src/app/(dashboard)/money/cheques/page.tsx` | Pending list + Deposit dialog |
| Accounts (Chart) | `src/app/(dashboard)/money/accounts/page.tsx` | Grouped by type, balance + Dr/Cr indicator, ledger drilldown |
| Per-account ledger | `src/app/(dashboard)/money/ledger/[accountId]/page.tsx` | Journal with running balance |
| Debtors / Creditors | `src/app/(dashboard)/money/debtors/page.tsx` | ?direction=payable flips view; sorted by largest outstanding |
| Employees | `src/app/(dashboard)/money/employees/page.tsx` | List + create dialog, Float column |
| Party detail Ledger tab | `src/app/(dashboard)/parties/[id]/page.tsx` | New tab; arrives via /money/debtors links |
| Party list balance column | `src/app/(dashboard)/parties/page.tsx` | New column shows Dr/Cr running balance |
| Sidebar Money group | `src/components/layout/sidebar.tsx` | New group with 7 entries, all gated |
| Demo adapter | `src/lib/demo/adapter.ts` | All read endpoints faithful; state-change endpoints flip status |
| Services | `src/services/{accounts,payments,employees,ledger}.service.ts` | All endpoints in §4 wired |

When the backend ships these endpoints with matching shapes, **no FE changes are required**.

---

## 11. Sequence to ship (suggested order)

1. **Migration** — `financial_accounts`, `ledger_entries`, `payments`, `payment_allocations`, `employees` tables.
2. **System-account auto-creation** — tenant provisioning hook + party/employee insert hooks.
3. **Number series seeding** — `RV` series for receipts, `PV` for payments, per tenant.
4. **Permission seeding** — insert the 10 new permission codes.
5. **Service layer** — `account_service.py`, `ledger_service.py`, `payment_service.py`, `employee_service.py`.
6. **Endpoints** — the 14 routes in §4.
7. **Cross-module wiring** — update `invoice_service.post()` + `invoice_service.cancel()` per §7. Existing tests cover the stock side; add ledger assertions.
8. **Tests** — §8.
9. **Smoke test integration** — extend `frontend/scripts/smoke-test-api.sh` with the full chain: create receipt → post → allocate → cheque deposit → cancel; verify summary endpoint reconciles.

After that, FE flips from demo adapter to real backend by setting `NEXT_PUBLIC_DEMO_MODE=false` in `.env.local` — nothing else changes.
