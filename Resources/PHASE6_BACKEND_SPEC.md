# Phase 6 — Payroll automation (REQ-10) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-01 · FE prototype: complete
Source of truth: paired with `frontend/src/services/payroll.service.ts`,
the `/money/salary/batch` page, and `/money/salary/[id]/payslip`.

> **Status of paired FE work**: All routes ship as a working
> prototype against in-memory fixtures (`src/lib/demo/adapter.ts`).

---

## §1 Overview

Phase 6 closes the salary loop opened in Phase 3.5. Instead of
the accountant clicking "New" once per employee, the system:

1. **Generates** draft salary entries for every active employee
   on the 1st of each month (cron-driven; manual trigger as
   override).
2. **Bulk-posts** all drafts on payday — one click.
3. **Generates** a printable payslip for any salary entry.

| Route                                  | Endpoint                          | Purpose                            |
|----------------------------------------|-----------------------------------|------------------------------------|
| `/money/salary/batch`                  | `GET  /salary/batch`              | List employees + their draft entry |
| (no route, button)                     | `POST /salary/batch/generate`     | Idempotent draft creation          |
| (no route, button)                     | `POST /salary/batch/post`         | Atomic bulk post                   |
| `/money/salary/[id]/payslip`           | `GET  /salary/{id}/payslip`       | Hydrated printable data            |

Cron registration (production):

```
0 2 1 * *  /usr/bin/payroll-batch-generate-all  # 02:00 IST, 1st of each month
```

The cron iterates active tenants and calls
`POST /salary/batch/generate { period: "<current_month>" }` for
each. The endpoint MUST be idempotent (safe to re-run on retry,
manual trigger, etc.).

---

## §2 Critical scope decisions

### 2.1 Batch generate is idempotent

If a draft already exists for `(employee_id, period_month)` we
skip — never create a duplicate. The DB constraint
`UNIQUE(tenant_id, employee_id, period_month)` already prevents
duplicates at the data layer; the endpoint just doesn't error
on re-run.

Response includes a `created` count distinct from
`entries.length` so the FE can show a friendly "already up-to-
date" toast vs "generated N drafts".

### 2.2 Bulk post is all-or-nothing

`POST /salary/batch/post { period }` posts every draft for the
period in **one transaction**. If any single entry has a
`SALARY_FLOAT_DRIFT` (the `float_held` snapshot doesn't match
current employee_float balance), the WHOLE batch rolls back and
the response lists the drifting entries.

Reason: silently posting some entries and not others would put
the books in a half-closed state nobody can reason about.

### 2.3 Cron + manual coexist

The cron triggers the same endpoint the UI button does. There's
no separate cron-only route; the same idempotency makes both
safe. Backend distinguishes by `caller.kind` (cron service
account vs human user) only for audit logging.

### 2.4 Float drift is per-entry, not aggregate

We re-validate each entry's `float_held` against the current
balance of that employee's `employee_float` account at post
time. We do NOT snapshot the whole table state at generate-time;
each entry is independent.

### 2.5 Payslip is server-generated data, FE-rendered HTML

The payslip endpoint returns a structured JSON payload (see
§4.4). The browser uses `window.print()` against a print
stylesheet to produce the PDF. We do NOT generate PDFs server-
side in Phase 6 — defer until volume justifies a PDF service.

### 2.6 `amount_in_words` is server-side

The Indian-English number-to-words rendering ("Forty-five
thousand only") is server-side because the canonical legal
phrasing should be consistent across CSV exports, payslip PDFs,
and the on-screen view. A util on backend produces this; FE
just renders the string.

---

## §3 Database schema

### 3.1 No new tables

The batch endpoints write to the existing `salary_entries`
table. The `version` field starts at 0 for new drafts; bumps
to 1 on bulk post.

### 3.2 Constraint to confirm

```sql
ALTER TABLE salary_entries
  ADD CONSTRAINT uk_salary_entries_emp_period
  UNIQUE (tenant_id, employee_id, period_month);
```

(Per Phase 3.5 spec — confirm this is in place; it's load-
bearing for batch idempotency.)

---

## §4 API Contract

### 4.1 GET `/salary/batch?period=YYYY-MM`

Lists all active employees with their draft entry for the
period (entries may be null for newly-hired employees who
don't have a draft yet — they'll appear after the next
generate run).

Permission: `inventory.salary.read`.

Response:

```json
{
  "period_month": "2026-04-01",
  "entries": [
    {
      "salary_id": "sal-1",
      "employee_id": "emp-1",
      "employee_name": "Ramesh Kumar",
      "employee_role": "Sales Executive — MUM-N",
      "current_float": "8500.00",
      "gross_salary": "45000.00",
      "float_held":   "8500.00",
      "net_paid":     "36500.00",
      "status":       "draft"
    },
    {
      "salary_id": null,
      "employee_id": "emp-2",
      "employee_name": "Priya Shah",
      "employee_role": "Sales Executive — PUNE",
      "current_float": "0.00"
    }
  ],
  "totals": {
    "employee_count": 2,
    "drafts": 1,
    "posted": 0,
    "cancelled": 0,
    "total_gross": "45000.00",
    "total_float": "8500.00",
    "total_net":   "36500.00"
  }
}
```

### 4.2 POST `/salary/batch/generate`

Body:
```json
{ "period": "2026-04" }
```

Permission: `inventory.salary.batch`.

Behaviour:
1. For each active employee in tenant, check if a salary entry
   exists for `(employee_id, period_month=YYYY-MM-01)`.
2. If not, create a `draft` with:
   - `gross_salary = employee.monthly_salary`
   - `float_held = current employee_float.current_balance`
   - `net_paid = gross − float_held`
   - `paid_from_account_id = employee.payment_account_id`
3. Return the same shape as §4.1, plus a top-level `created` count.

Response:

```json
{
  "period_month": "2026-04-01",
  "entries": [...],
  "totals": {...},
  "created": 1
}
```

### 4.3 POST `/salary/batch/post`

Body:
```json
{ "period": "2026-04" }
```

Permission: `inventory.salary.batch` AND `inventory.salary.post`.

Behaviour:
1. Open a single transaction.
2. For each draft entry in the period:
   - Re-read `employee_float.current_balance`.
   - Compare to the entry's `float_held`. If unequal → record
     drift; do NOT post any entries this run.
3. If any drifts, rollback and return 422 with `drift_entries`
   array; FE shows them in a banner so user can refresh and
   re-generate.
4. Otherwise, flip every draft to `posted`, set `posting_date =
   now()`, write all the ledger entries (Dr salary_expense,
   Cr employee_float, Cr paid_from_account), commit.

Success:

```json
{ "posted_count": 3 }
```

Drift failure (HTTP 422):

```json
{
  "code": "SALARY_BATCH_FLOAT_DRIFT",
  "message": "2 entries have float drift; refresh and retry",
  "field_errors": {
    "drift_entries": "[{\"salary_id\":\"sal-1\",\"employee_name\":\"Ramesh\",\"expected_float\":\"8500.00\",\"actual_float\":\"9200.00\"}, ...]"
  }
}
```

(JSON-stringified into `field_errors` to fit the existing
ApiError shape; FE parses it back.)

### 4.4 GET `/salary/{id}/payslip`

Returns hydrated data joined across SalaryEntry → Employee →
Tenant + the paid_from account name.

Permission: `inventory.salary.read`.

Response:

```json
{
  "salary_id": "sal-1",
  "salary_number": "SAL/2026-04/0001",
  "period_month": "2026-04-01",
  "posting_date": "2026-05-01T10:30:00Z",
  "status": "posted",

  "tenant_name": "Acme Distributors",
  "tenant_address": "...",
  "tenant_gstin": "27AAACA0001Z1Z5",

  "employee_id": "emp-1",
  "employee_name": "Ramesh Kumar",
  "employee_role": "Sales Executive — MUM-N",

  "gross_salary": "45000.00",
  "float_held":   "8500.00",
  "net_paid":     "36500.00",
  "paid_from_account_name": "HDFC Current Account",
  "amount_in_words": "Thirty-six thousand five hundred rupees only"
}
```

---

## §5 Error codes

New code:
- `422 SALARY_BATCH_FLOAT_DRIFT` — one or more entries' float
  snapshot differs from current balance. `field_errors.drift_entries`
  contains the JSON-stringified list.

Existing codes reused:
- `403 FORBIDDEN`
- `404 SALARY_NOT_FOUND` (payslip)
- `423 LOCKED` (period-close blocks bulk post if
  `posting_date <= lock_before_date`)

---

## §6 Permissions

Single new code (already seeded in FE demo fixtures):

```
inventory.salary.batch — Run payroll batch (generate + bulk post)
```

Distinct from the existing `inventory.salary.write` and
`inventory.salary.post`. Reasoning: a tenant might trust a
junior accountant to edit one entry but not let them blast the
whole month's payroll in a single click.

To run the bulk post, caller MUST have:
- `inventory.salary.batch` AND `inventory.salary.post`.

To run the bulk generate, caller MUST have:
- `inventory.salary.batch` AND `inventory.salary.write`.

---

## §7 Tests

1. **Idempotent generate** — re-running generate with no new
   active employees returns `created: 0`, no duplicates.
2. **Generate skips inactive employees** — `is_active = false`
   employees don't get a draft.
3. **Generate hire-mid-month** — employee created on the 15th
   of the period gets a draft with full month's salary
   (proration is OUT OF SCOPE for Phase 6; defer to Phase 7).
4. **Bulk post float drift** — modify one float account between
   generate and post; bulk post returns 422 and rolls back.
5. **Bulk post all clear** — post N drafts; verify N ledger
   group_ids written and N status flips committed atomically.
6. **Bulk post with period lock** — try to bulk post a period
   covered by `period_close.lock_before_date`; returns 423.
7. **Cron service account** — POST /salary/batch/generate as
   the cron service account works without a tenant header
   (cron iterates tenants explicitly).
8. **Payslip hydration** — `amount_in_words` is rendered
   correctly for ₹45,000 ("Forty-five thousand rupees only"),
   for fractional amounts, and for very large numbers.

---

## §8 Out of scope (Phase 7+)

- **Salary proration** — pay 50% if an employee is hired on the
  15th. Currently full-month, full-pay; tenant adjusts manually.
- **Bonus / advances / deductions** — extra line items on a
  salary entry. Currently single-line voucher only.
- **Tax deductions (TDS / PF / ESI)** — full statutory deductions
  package; needs separate compliance work.
- **PDF rendering server-side** — FE does `window.print()` for
  now; revisit when there's volume to justify.
- **Email/SMS payslip delivery** — auto-mail the payslip URL to
  the employee after posting. Needs notification infrastructure.
- **Payroll registers** — multi-month payroll register report.

---

## §9 FE prototype status

| Path                                              | Lines | Notes                              |
|---------------------------------------------------|-------|------------------------------------|
| `services/payroll.service.ts`                     | ~50   | Four methods                       |
| `app/.../money/salary/batch/page.tsx`             | ~210  | Batch grid + KPIs + actions        |
| `app/.../money/salary/[id]/payslip/page.tsx`      | ~135  | Print-optimised layout             |
| `app/.../money/salary/[id]/page.tsx`              | +5    | "Payslip" button in actions        |
| `lib/demo/adapter.ts`                             | +250  | 4 new request handlers             |
| `lib/api-constants.ts`                            | +5    | `SALARY.BATCH*` + `PAYSLIP`        |
| `types/index.ts`                                  | +90   | 4 new exported types               |
| `lib/demo/fixtures.ts`                            | +5    | 1 new permission code              |
| `components/layout/sidebar.tsx`                   | +2    | "Payroll batch" entry              |

When backend lands:
1. Set `NEXT_PUBLIC_DEMO_MODE=false`
2. Wire the cron job (`crontab` entry in §1)
3. FE works unchanged

---

## §10 Suggested ship sequence

1. **Payslip endpoint** — read-only, simplest. Unblocks the
   `/payslip` route and lets users print posted entries today.
2. **Batch GET** — read-only, second simplest. Powers the
   batch grid view.
3. **Batch generate** — the idempotent write. Sets the
   pattern; lock the idempotency contract in tests (§7.1).
4. **Batch post** — the all-or-nothing transaction. Ship LAST
   because it's the most load-bearing — drift handling and
   ledger writes need extra review.
5. **Cron registration** — only after all four endpoints are
   green in production. Cron should respect a feature flag so
   it can be disabled per-tenant during onboarding.

Each is independently shippable; the FE button calls the same
endpoint the cron does.
