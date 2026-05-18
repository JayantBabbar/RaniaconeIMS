# RaniacOne IMS — Backend Handoff Document

> **Audience:** Backend team (raniacone-dev)
> **Authored by:** Frontend team
> **Last revised:** 2026-05-05
> **Purpose:** Single source of truth for **everything the backend needs to build** to catch up to the frontend.
> **Companion docs:** the per-phase specs in this folder (`INVOICE_BACKEND_SPEC.md`, `ESTIMATE_BACKEND_SPEC.md`, `PHASE3_…` through `PHASE13_BACKEND_SPEC.md`) are the line-by-line contract. **This document is the index that ties them together.**

---

## §1. How to read this

We have been building **frontend-first**. The full UI for invoicing, estimates, money/ledger, payments, expenses, salary, payroll-batch, reports, GSTR exports, period close, audit log, bulk imports, SO→invoice promotion, the cost/financials permission split, and versioned item pricing **already exists and is clickable** in demo mode (in-memory fixtures + adapter). What does **not** exist yet is the backend implementation for any of it.

Read in this order:

1. **§2 — Where the backend stands today.** Snapshot of what's already shipped on the inventory and auth services.
2. **§3 — What the frontend has added (the delta).** Each subsection is a 1-paragraph summary + pointer to the detailed phase spec.
3. **§4 — Build order.** Dependency graph + recommended sprint sequencing.
4. **§5 — Cross-cutting invariants.** Read these once; they apply to every new module.
5. **§6 — Phase index.** One-line status per phase with prereqs and spec-doc link.
6. **Appendices A–E** — flat reference tables (permissions, endpoints, tables, error codes, definition-of-done checklist).

If a detail in this doc disagrees with a phase spec, **the phase spec wins** — it is closer to the FE prototype.

---

## §2. Where the backend stands today

### §2.1 Auth service (`/api/v1`, port 8000)

**Built:**
- `/health` — status check (response key is `db`, not `database`)
- `/auth/*` — login, refresh (rotating refresh tokens), me
- `/users` — CRUD + reset-password (super-admin scope-strict via `X-Acting-Tenant-Id`)
- `/tenants` — CRUD + listing (accepts `?limit=` 1–500, default 100)
- `/currencies`, `/permissions`, `/roles`, `/modules`, `/subscriptions` — CRUD where applicable
- `/users/{id}/roles` — assignments

**JWT claims emitted:** `tid`, `sa`, `tz`, `mods` (subscribed module codes), `perms` (permission code list).

### §2.2 Inventory service (`/api/v1`, port 8001)

**Built — master data:**
- `/status-master`, `/number-series`, `/uom-categories`, `/uoms`, `/uom-conversions`
- `/item-brands`, `/item-categories`, `/items` (with optimistic locking via `version`/`If-Match`)
- `/parties` (vendors/customers, also with optimistic locking)
- `/inventory-locations`
- `/tenant-config`, `/module-config` (PUT-as-upsert, no POST)

**Built — stock:**
- `/items/{id}/lots` and `/lots`
- `/items/{id}/serials` and `/serials`
- `/movements`, `/balances`, `/valuation-layers`, `/reservations`

**Built — documents (header + lines):**
- `/document-types` (tenant-configurable, no fixed enum)
- `/documents` — CRUD + `POST /post` + `POST /cancel` (all under `If-Match`)
- `/documents/{id}/lines`

**Built — operational / cross-cutting:**
- `/counts` — stock counts (header + lines)
- `/workflows` — definitions, states, transitions (tenant-configurable state machine)
- `/custom-field-definitions`, `/custom-fields`
- `/integrations`, `/webhooks`, `/attachments`, `/imports`
- Audit log table exists and is being written to inline; **read API needs extension** (see §3.10).

### §2.3 Cross-cutting infrastructure that's already in place — do **not** reinvent

- **Optimistic locking with ETag / If-Match.** Every entity that supports edit-after-create already follows the contract: GET emits `version` field + `ETag` header; PATCH/POST(`/post`)/POST(`/cancel`) require `If-Match`; missing → `428 PRECONDITION_REQUIRED`; mismatch → `409 VERSION_MISMATCH`. **Reuse this for invoices, estimates, payments, bills, expenses, salary, ledger entries.**
- **Workflow engine.** Definitions/states/transitions exist. Posted documents trigger transitions via the existing engine. **Reuse for invoices/estimates/bills/payments/salary postings.**
- **Custom fields.** Definitions + values tables exist. Any new entity should plug in via the same definition mechanism.
- **Audit log.** Table exists. Writes are inline. **Action codes follow `<resource>.<verb>` dotted form** (e.g. `invoice.post`, `salary.batch.generate`, `period_close.set`). New phases must write to it on every state change — see §5.5.
- **Attachments / imports / integrations / webhooks.** Tables and route shells exist. Phase 7 (imports) extends `/imports` rather than replacing it.

### §2.4 What's **not** yet built (the seven big gaps)

These are the seven domains the backend has zero coverage on. Each maps to one or more phase specs in §3:

1. **Billing** — no `invoice` / `invoice_line` model, no GST math, no place-of-supply split logic, no e-Invoice scaffolding.
2. **Estimates** — no `estimate` / `estimate_line` / `route` model, no estimate-to-invoice promotion.
3. **Money / ledger** — no `financial_account`, no `ledger_entry`, no double-entry posting, no payment-allocation table, no employee model, no float mechanic.
4. **AP / expenses / salary** — no `vendor_bill`, `expense_category`, `expense`, `salary_entry`, no auto payable-account creation per employee.
5. **Reports** — no aggregations endpoint surface (Sales/Purchase register, Aging, P&L, Cash Flow).
6. **Compliance** — no GSTR-1/3B JSON shaping, no period-close lock semantics, no `accounting_period` model.
7. **Item pricing & dimensions** — no `item_dimensions` (thickness/size catalogues), no `item_pricing_rule` (versioned rules with auto-close), no line-level `thickness_mm` / `size_code` fields on document/invoice/estimate/bill lines.

---

## §3. The delta — what to build, by phase

Each subsection here is a **1-paragraph orientation + pointer to the detailed phase doc**. The phase docs already define payload shapes, route URLs, GST math examples, posting algorithms, and unit tests. Don't re-derive what's already specced.

### §3.1 Phase 2 — Invoices (REQ-4)

**Spec:** [`INVOICE_BACKEND_SPEC.md`](INVOICE_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-04-26

GST-compliant tax invoices distinct from generic documents. Carries CGST/SGST/IGST/Cess split per line, HSN/SAC, place-of-supply, customer state code. State machine `draft → posted → cancelled`. **Critical invariant** (also referenced in Phase 2.5): if `estimate_id` is set on the invoice, `POST /invoices/{id}/post` **must skip the stock-OUT movement** (the linked estimate already moved stock when it posted) — otherwise stock double-decrements. The GST math is canonical in [`frontend/src/lib/gst.ts`](../src/lib/gst.ts) and has 22 unit tests; backend's math must match to the rupee.

**New tables:** `invoices`, `invoice_lines`. **New permissions:** `inventory.invoices.{read,write,post,cancel}`.

### §3.2 Phase 2.5 — Estimates (REQ-5)

**Spec:** [`ESTIMATE_BACKEND_SPEC.md`](ESTIMATE_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-04-28

Delivery checklists (the Indian distribution two-doc workflow: estimate first to deliver, invoice later to bill). Posting a estimate triggers stock-OUT movements but **no ledger entries** (it's not a financial doc yet). Promote-to-invoice copies the estimate → draft invoice with GST computed at promotion time and links the two via `estimate_id` on the invoice; from then on, the invariant in §3.1 applies. Routes (sales-territory master data) belong here.

**New tables:** `estimates`, `estimate_lines`, `routes`. **New permissions:** `inventory.estimates.{read,write,post,cancel}`, `inventory.routes.{read,write}`.

### §3.3 Phase 3 — Money / Ledger / Payments (REQ-6)

**Spec:** [`PHASE3_BACKEND_SPEC.md`](PHASE3_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-04-29

Double-entry ledger with `financial_accounts` (assets/liabilities/income/expense + cash/bank/cheque/gpay sub-types) and `ledger_entries`. Auto-creates a receivable account per Customer, payable per Vendor, payable per Employee on first creation. Payments support `direction in (received, paid)` × `mode in (cash, bank, cheque, gpay)`. `payment_allocations` link receipts to invoices and bills (many-to-many). **Employee float mechanic:** when a salesman receives cash from a customer (mode=`gpay` to their personal UPI), the credit lands in the employee's payable_account and gets cleared on next salary post (gross − float = net paid). Posting an invoice writes the AR debit; posting a bill writes the AP credit.

**New tables:** `financial_accounts`, `ledger_entries`, `payments`, `payment_allocations`, `employees`. **New permissions:** `inventory.{accounts,ledger,payments,employees}.{read,write,post,cancel}` where applicable (~10 codes).

### §3.4 Phase 3.5 — AP completion (REQ-6 cont.)

**Spec:** [`PHASE3_5_BACKEND_SPEC.md`](PHASE3_5_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-04-29

Vendor Bills (financial doc, **no stock impact** — stock is GRN's job; see Phase 12 for how bills back-fill GRN cost). Expense Categories with auto-account creation (each category gets its own expense account). Expenses (cash spend tracker, posts straight to ledger). Salary Entries (gross − float = net; on post, employee's payable_account is settled and the cash/bank account decremented). `payment_allocations` extended with `bill_id` for vendor-side settlements.

**New tables:** `vendor_bills`, `vendor_bill_lines`, `expense_categories`, `expenses`, `salary_entries`. **New permissions:** `inventory.{bills,expense_categories,expenses,salary}.{read,write,post,cancel}` (~14 codes).

### §3.5 Phase 4 — Reports & statements

**Spec:** [`PHASE4_BACKEND_SPEC.md`](PHASE4_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-01

Read-only aggregations. **No new tables.** Five endpoints: Sales Register, Purchase Register, Debtors Aging (bucketed 0/1–30/31–60/61–90/90+), Creditors Aging (same buckets), P&L (revenue − COGS − expenses − salary). COGS sources from `valuation_layers` consumption on invoice-post; in demo mode it's a 60% stand-in.

**New tables:** none. **New permissions:** `inventory.reports.read` (1 code).

### §3.6 Phase 5 — Compliance close (GSTR + period close)

**Spec:** [`PHASE5_BACKEND_SPEC.md`](PHASE5_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-01

GSTR-1 export (B2B / B2CL / B2CS bucketing — B2CL is unregistered + inter-state + > ₹2.5L; B2CS is everything else, aggregated by state × rate). GSTR-3B export (summary return). Period close (`accounting_periods.lock_before_date` — once set, ledger writes against any date ≤ lock are blocked with `423 LOCKED` error code). All exports return GSTN-portal-shaped JSON ready for upload.

**New tables:** `accounting_periods`. **New permissions:** `inventory.period_close.{read,write}` (2 codes; GSTR endpoints reuse `reports.read`).

### §3.7 Phase 6 — Payroll automation

**Spec:** [`PHASE6_BACKEND_SPEC.md`](PHASE6_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-01

Cron-scheduled (1st of month, 02:00 IST) + on-demand batch generation: one `salary_entry` draft per active employee per month, idempotent (regenerating doesn't duplicate). Atomic bulk-post — if any entry's float drifts mid-batch, the whole batch fails (no partial post). Payslip endpoint returns hydrated read-only data with amount-in-words for printing.

**New tables:** none (extends `salary_entries`). **New permissions:** `inventory.salary.batch` (1 code, used in combination with `salary.post` for bulk post).

### §3.8 Phase 7 — Bulk imports

**Spec:** [`PHASE7_BACKEND_SPEC.md`](PHASE7_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-02

Two-step preview/commit on top of the **existing** `/imports` infrastructure (don't replace it; extend). Supports `items`, `parties`, `stock_balances`, `opening_balances`. Per-row validation; commit re-validates; opening-balance rows write directly to ledger and are rejected for any date ≤ the period-close lock. No rollback — partial success is allowed (failed rows stay flagged in the import batch).

**New tables:** none (extends existing imports table). **New permissions:** `inventory.imports.{read,write}` (2 codes).

### §3.9 Phase 8 — Cash flow statement

**Spec:** [`PHASE8_BACKEND_SPEC.md`](PHASE8_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-02

Direct-method cash flow (Opening cash + Operating[receipts − vendor pay − salary − opex] + Investing[capex] = Closing cash). Single endpoint, pure aggregation over `ledger_entries` filtered by cash/bank/gpay account types. Capex sources from expense categories with `is_capital=true`.

**New tables:** none. **New permissions:** none (reuses `reports.read`).

### §3.10 Phase 9 — Audit log viewer

**Spec:** [`PHASE9_BACKEND_SPEC.md`](PHASE9_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-02

Append-only, immutable log. Already being written to (table exists); needs **read API expansion** with filters (action, entity, date range, user) and pagination. Action codes follow `<resource>.<verb>` dotted form. Each entry stores before/after JSON snapshots, IP, and user-agent for forensics. **Never UPDATE / DELETE on this table** — phase-close attempts to modify history must fail at the DB constraint level.

**New tables:** none (extends existing). **New permissions:** `inventory.audit_log.read` (1 code).

### §3.11 Phase 10 — Sales Order → Invoice promotion

**Spec:** [`PHASE10_BACKEND_SPEC.md`](PHASE10_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-02

Posted SO promotes to a draft Invoice with GST computed at promotion time using the line's `default_tax_rate_pct` and the customer's state code (IGST vs CGST+SGST split per §3.1's rules). Source SO is marked `is_promoted=true`; bidirectional FK link. Stock OUT happens when the new invoice posts (not at promotion time).

**New tables:** none (uses existing `documents` + new `invoices`). **New permissions:** none (reuses `documents.read` + `invoices.write`).

### §3.12 Phase 12 — Cost & Financials visibility split + GRN↔Bill matching (REQ-16)

**Spec:** [`PHASE12_BACKEND_SPEC.md`](PHASE12_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-02

Two new permission gates that re-shape the entire UX for non-Admin tiers:

- `inventory.cost.read` hides cost columns/fields system-wide (movements `unit_cost`, balances "Value", line `unit_price`, `total_cost`).
- `inventory.financials.read` hides the entire `/money/*` and `/reports/*` and `/settings/period-close` and `/admin/audit-log` surfaces.

Plus the **two-stage cost flow**: Operator GRN posts with `unit_cost = NULL` and a `cost_pending=true` flag on the resulting `valuation_layer`. Admin's Vendor Bill posts and **back-fills** the matched GRN's valuation layer cost (FIFO match by item × bill date). Operator never enters or sees cost. Print mode on Estimates/Invoices toggles between `no_amount` (default for delivery copies) and `with_amount`.

**New tables:** none, but `valuation_layers` gains `cost_pending: bool`, `bill_id: nullable FK`. **New permissions:** `inventory.cost.read`, `inventory.financials.read` (2 codes; also depends on `master_data.read/write` from below).

### §3.13 Phase 13 — Item dimensions + versioned pricing rules

**Spec:** [`PHASE13_BACKEND_SPEC.md`](PHASE13_BACKEND_SPEC.md) · **Status:** FE complete in demo · **Updated:** 2026-05-02

Two new master-data tables:

- `item_dimensions` — tenant-scoped catalogues for `thickness_mm` (numeric list) and `size_code` (code + label). FE has CRUD for both. Removal blocked when any pricing rule references the value (`409 IN_USE`).
- `item_pricing_rules` — versioned rules per `(item_id, thickness_mm, size_code, valid_from)`. Posting a new rule **automatically closes the prior active rule** for the same key (sets its `valid_until` to the new rule's `valid_from − 1 day`). UNIQUE constraint guarantees only one active rule per key at any timestamp. Lookup endpoint accepts `as_of=YYYY-MM-DD` to retrieve the rule that was active on that date.

Lines on `documents`, `invoices`, `estimates`, `vendor_bills` gain `thickness_mm: numeric | null`, `size_code: text | null`. The line **snapshots** the rule's `unit_price` at creation time — later rule changes do not mutate history.

**New tables:** `item_dimensions`, `item_pricing_rules`. **New permissions:** none (reuses `master_data.read/write`).

### §3.14 The `master_data.read/write` permission split (cross-cuts Phases 12 + 13)

The FE already gates the **Master Data** sidebar group on `inventory.master_data.read`, but the underlying entity-level perms (brands/categories/uoms/etc.) stay granted to Operator so `/items` can still render brand and category names alongside an item. The backend should grant the new `master_data.read` to Admin only; entity-level reads stay broadly granted as today.

### §3.15 Phase 14 — Per-party pricing + Estimate→Invoice 2×/reverse-GST + GST on ItemCategory (2026-05-13)

**Spec:** `backend-bundle/PARTY_PRICING_BACKEND_SPEC.md` · **Estimate promote rule:** `backend-bundle/ESTIMATE_BACKEND_SPEC.md` §5.8 · **Status:** FE complete in demo · **Updated:** 2026-05-13

Three changes shipped together:

1. **Challan → Estimate rename.** Every challan identifier, perm code, FK column, route path, and error code renamed to estimate. Behavior unchanged from the rename itself.
2. **GST rate on `item_categories`.** New column `gst_rate_pct NUMERIC(5,2) NOT NULL DEFAULT '18'`. New items inherit it into `items.default_tax_rate_pct`.
3. **Per-party pricing — two new versioned tables.** `party_item_costs` (supplier→Arpit cost) and `party_item_sale_prices` (Arpit→customer sale, GST-inclusive). Lookup hot path on /bills/new, /invoices/new, /estimates/new.
4. **Estimate→Invoice doubling + reverse-GST.** Promote handler multiplies qty by `ESTIMATE_TO_INVOICE_QTY_MULTIPLIER` (=2 for Arpit) and reverse-GST's the customer-visible price into the taxable base. Stock invariant unchanged.

**New tables:** `party_item_costs`, `party_item_sale_prices`. **New columns:** `item_categories.gst_rate_pct`. **New permissions:** `inventory.party_costs.{read,write}`, `inventory.party_prices.{read,write}`.

---

## §4. Build order (dependency graph)

```
              ┌──── Phase 13 (Pricing rules + dimensions)
              │           depends on: items
Phase 2  ────►│
(Invoices)    └──── Phase 10 (SO → Invoice)
                          depends on: Phase 2
       ▲
       │ estimate_id FK
       │
Phase 2.5 ─── Phase 12 (Cost split + GRN↔Bill)
(Estimates)         depends on: Phase 3.5 (vendor bills)
                                  + valuation_layers (already built)

Phase 3 ────►  Phase 3.5 ────►  Phase 4 ────►  Phase 5
(Ledger /       (Bills /         (Reports)      (GSTR + period close)
 Payments /      Expenses /                            │
 Employees)      Salary)                               ▼
                    │                          Phase 7 (imports)
                    ▼                          Phase 8 (cash flow)
              Phase 6 (payroll                 Phase 9 (audit log)
              batch)
```

**Recommended sprint sequencing** (each "sprint" assumed ~2 weeks; adjust to your team):

| Sprint | Phases | Why |
|---|---|---|
| 1 | Phase 13 + Phase 2 + Phase 2.5 | Pricing/dimensions are self-contained and unblock invoice/estimate line shapes. Invoices + estimates together because the `estimate_id` invariant must be designed in from day one. |
| 2 | Phase 3 + Phase 3.5 | Ledger first; AP completion immediately after (employee model is shared). |
| 3 | Phase 12 | Cost/financials split + GRN↔Bill matching. Needs Phase 3.5 vendor bills to back-fill into. |
| 4 | Phase 4 + Phase 8 + Phase 10 | All three are read-only-ish and depend only on Phase 3/3.5. |
| 5 | Phase 5 + Phase 6 + Phase 7 + Phase 9 | Compliance close, payroll batch, imports, audit-log read API. Mostly independent of each other. |

**Anti-patterns to avoid:**
- Don't start Phase 5 (period close) before Phase 3 — there's nothing to lock.
- Don't start Phase 4 reports before Phase 3.5 — P&L and Cash Flow source from expenses/salary.
- Don't start Phase 6 payroll batch before Phase 3.5 single-entry salary works end-to-end.
- Don't start Phase 12 until vendor_bills exist (Phase 3.5).

---

## §5. Cross-cutting invariants — read once, applies everywhere

### §5.1 Optimistic locking (ETag / If-Match)

Every transactional entity introduced by these phases — `invoices`, `invoice_lines`, `estimates`, `payments`, `vendor_bills`, `expenses`, `salary_entries`, `ledger_entries` (where editable), `pricing_rules` — must follow the existing pattern:

- GET response includes a `version: int` field and an `ETag` response header.
- PATCH, `POST /post`, `POST /cancel` require `If-Match: <version>`.
- Missing → `428 PRECONDITION_REQUIRED` (code: `MISSING_IF_MATCH`).
- Mismatched → `409 VERSION_MISMATCH`.

Reuse the existing helper that does this for `/items`, `/parties`, `/documents`. Do **not** invent a new mechanism per resource.

### §5.2 Datetime contract

- All datetime fields in request bodies must be **timezone-aware**. Naive datetimes → reject with `422` and code `NAIVE_DATETIME_NOT_ALLOWED` (already implemented; preserve behavior).
- All "calendar date" fields (`document_date`, `posting_date`, `mfg_date`, `expiry_date`, `valid_from`, `valid_until`, `lock_before_date`) are `YYYY-MM-DD` strings — **never** datetime.
- The frontend deliberately renders these strings verbatim and never `new Date()`s them, to avoid timezone drift.

### §5.3 List response shapes

The frontend's `unwrapList()` helper already handles both shapes, but please **standardise toward the envelope** for every new list endpoint:

```json
{
  "data": [ ... ],
  "pagination": { "total": 123, "limit": 50, "next_cursor": "opaque" }
}
```

Currently inconsistent on the existing surface (most endpoints return a plain array; only items/brands/categories/parties/locations/uoms/status/numseries use the envelope). For consistency, **all new list endpoints** introduced by Phases 2–13 should use the envelope shape.

### §5.4 Pagination

Cursor-based, opaque string. Default `limit=50`, max `200` (FE clamps client-side; backend should enforce 422 above 200, matching existing behavior).

### §5.5 Audit log writes

Every state change must write to the audit log inline within the same transaction as the change. Action codes use dotted resource.verb form:

- `invoice.create`, `invoice.post`, `invoice.cancel`, `invoice.delete`
- `estimate.create`, `estimate.post`, `estimate.cancel`, `estimate.promote_to_invoice`
- `payment.create`, `payment.post`, `payment.cancel`, `payment.allocate`
- `bill.create`, `bill.post`, `bill.cancel`
- `expense.create`, `expense.post`
- `salary.create`, `salary.post`, `salary.batch.generate`, `salary.batch.post`
- `period_close.set`, `period_close.unset`
- `pricing_rule.create`, `pricing_rule.close`
- `dimension.add`, `dimension.remove`
- `import.preview`, `import.commit`

Each entry stores `before` and `after` JSON snapshots (for state changes) or just `payload` (for creates). IP and user-agent come from the request — already plumbed.

The audit log table is **append-only**. Period close attempts to modify history must fail at the DB constraint level — there should be no UPDATE or DELETE path to it.

### §5.6 Period-close interaction (the new hard gate)

Once `accounting_periods.lock_before_date` is set, any attempt to write a `ledger_entry`, post an `invoice`, post a `vendor_bill`, post an `expense`, post a `payment`, post a `salary_entry`, or commit an `opening_balance` import row with `posting_date <= lock_before_date` must fail with:

- HTTP `423 LOCKED`
- error code `PERIOD_LOCKED`
- error message `"Period closed through {lock_before_date}; cannot post on {posting_date}"`

This is enforced by the backend, not the frontend. The frontend already handles the response shape.

### §5.7 Permission code grammar

All new codes follow `<module>.<resource>.<action>`. Module is `inventory` for everything in §3 except where noted. Action is one of `read`, `write`, `post`, `cancel`, plus a few exceptions (`master_data`, `audit_log`, `period_close`, `cost`, `financials`, `salary.batch`).

The complete inventory is in **Appendix A**. Seed all codes via migration; the frontend reads them from the JWT `perms` claim.

### §5.8 Idempotency

POST endpoints that produce side effects (`/post`, `/cancel`, `/batch/generate`, `/batch/post`, `/imports/commit`) should accept an `X-Idempotency-Key` header and de-duplicate within a 24-hour window. The frontend will start sending it for batch endpoints; for single-entry posts this is currently advisory (the `If-Match` version already prevents accidental double-post).

### §5.9 Workflow engine integration

The existing `/workflows` engine runs alongside posted documents. New transactional entities (`invoice`, `estimate`, `bill`, `payment`, `salary_entry`) should be capable of attaching to a tenant-defined workflow. The entity's status drives the next allowed transition. This is **opt-in per tenant** — out of the box, the simple `draft → posted → cancelled` machine is sufficient.

### §5.10 The estimate↔invoice double-decrement invariant (CRITICAL)

**Stated again because this is the single most likely place for a production data bug:**

When `POST /invoices/{id}/post` runs, **check the invoice's `estimate_id`**:

- If `estimate_id IS NULL` → write stock-OUT movements as normal.
- If `estimate_id IS NOT NULL` → **skip stock movement creation entirely**. The linked estimate already moved stock when it posted.

Both cases write the AR ledger debit (financial side runs unconditionally).

Cancellation has the symmetric rule: cancelling an invoice with `estimate_id IS NOT NULL` reverses the ledger but **must not** reverse stock — only cancelling the underlying estimate reverses stock.

The invoice spec ([`INVOICE_BACKEND_SPEC.md`](INVOICE_BACKEND_SPEC.md)) states this; reproducing it here because it's the kind of detail a feature reviewer might miss in a 600-line phase spec.

---

## §6. Phase index

| Phase | Name | Spec | Status (FE) | Hard prereqs |
|---|---|---|---|---|
| 2 | Invoices | [`INVOICE_BACKEND_SPEC.md`](INVOICE_BACKEND_SPEC.md) | ✅ done | items, parties, number-series, gst.ts |
| 2.5 | Estimates + routes | [`ESTIMATE_BACKEND_SPEC.md`](ESTIMATE_BACKEND_SPEC.md) | ✅ done | items, parties, number-series |
| 3 | Money / ledger / payments / employees | [`PHASE3_BACKEND_SPEC.md`](PHASE3_BACKEND_SPEC.md) | ✅ done | parties |
| 3.5 | Bills / expenses / salary | [`PHASE3_5_BACKEND_SPEC.md`](PHASE3_5_BACKEND_SPEC.md) | ✅ done | Phase 3 |
| 4 | Reports / aging / P&L | [`PHASE4_BACKEND_SPEC.md`](PHASE4_BACKEND_SPEC.md) | ✅ done | Phases 2, 3, 3.5 |
| 5 | GSTR + period close | [`PHASE5_BACKEND_SPEC.md`](PHASE5_BACKEND_SPEC.md) | ✅ done | Phase 2, Phase 4 |
| 6 | Payroll batch | [`PHASE6_BACKEND_SPEC.md`](PHASE6_BACKEND_SPEC.md) | ✅ done | Phase 3.5 |
| 7 | Bulk imports | [`PHASE7_BACKEND_SPEC.md`](PHASE7_BACKEND_SPEC.md) | ✅ done | items, parties, ledger |
| 8 | Cash flow statement | [`PHASE8_BACKEND_SPEC.md`](PHASE8_BACKEND_SPEC.md) | ✅ done | Phase 3, 3.5 |
| 9 | Audit log viewer | [`PHASE9_BACKEND_SPEC.md`](PHASE9_BACKEND_SPEC.md) | ✅ done | audit_log table (built) |
| 10 | SO → Invoice promotion | [`PHASE10_BACKEND_SPEC.md`](PHASE10_BACKEND_SPEC.md) | ✅ done | Phase 2 |
| 12 | Cost/financials split + GRN↔Bill | [`PHASE12_BACKEND_SPEC.md`](PHASE12_BACKEND_SPEC.md) | ✅ done | Phase 3.5, valuation_layers |
| 13 | Dimensions + versioned pricing | [`PHASE13_BACKEND_SPEC.md`](PHASE13_BACKEND_SPEC.md) | ✅ done | items |

> **Phase 11 deliberately skipped** — was a UX-only refactor on the FE (sidebar grouping); no backend implications.

---

## Appendix A — Permission codes inventory

All new codes the backend must seed. Module is `inventory` unless noted.

| Code | Phase | Notes |
|---|---|---|
| `invoices.read` | 2 | |
| `invoices.write` | 2 | |
| `invoices.post` | 2 | |
| `invoices.cancel` | 2 | |
| `estimates.read` | 2.5 | |
| `estimates.write` | 2.5 | |
| `estimates.post` | 2.5 | |
| `estimates.cancel` | 2.5 | |
| `routes.read` | 2.5 | |
| `routes.write` | 2.5 | |
| `accounts.read` | 3 | financial accounts (chart of accounts) |
| `accounts.write` | 3 | |
| `ledger.read` | 3 | ledger entries |
| `payments.read` | 3 | |
| `payments.write` | 3 | |
| `payments.post` | 3 | |
| `payments.cancel` | 3 | |
| `employees.read` | 3 | |
| `employees.write` | 3 | |
| `bills.read` | 3.5 | vendor bills |
| `bills.write` | 3.5 | |
| `bills.post` | 3.5 | |
| `bills.cancel` | 3.5 | |
| `expense_categories.read` | 3.5 | |
| `expense_categories.write` | 3.5 | |
| `expenses.read` | 3.5 | |
| `expenses.write` | 3.5 | |
| `expenses.post` | 3.5 | |
| `expenses.cancel` | 3.5 | |
| `salary.read` | 3.5 | |
| `salary.write` | 3.5 | |
| `salary.post` | 3.5 | |
| `salary.cancel` | 3.5 | |
| `salary.batch` | 6 | combined with `salary.post` for bulk-post authority |
| `reports.read` | 4 | covers all `/reports/*` endpoints; cash flow (8) reuses |
| `period_close.read` | 5 | |
| `period_close.write` | 5 | |
| `imports.read` | 7 | extends existing imports route |
| `imports.write` | 7 | |
| `audit_log.read` | 9 | |
| `cost.read` | 12 | gates cost-price visibility |
| `financials.read` | 12 | gates `/money/*` + `/reports/*` |
| `master_data.read` | 12 | Admin-only; gates the "Master Data" sidebar group |
| `master_data.write` | 12 | |

**Granted-to defaults** (the FE seed has full per-role mapping; this is the summary):

- **Tier 1 (Super Admin):** all auth.* codes, no inventory.* codes (operates platform-only).
- **Tier 2 (Client Admin):** every code listed above.
- **Tier 3 (Operator):** items.read, lots.read, locations.read, balances.read, documents.read/write/post (GRN-side only), counts.*, parties.read, brands.read, categories.read, uoms.read. **Notably excluded:** `cost.read`, `financials.read`, anything starting with `bills.`, `payments.`, `expenses.`, `salary.`, `accounts.`, `ledger.`, `reports.`, `period_close.`, `audit_log.`, `master_data.`.

---

## Appendix B — Endpoint inventory (new routes)

Grouped by resource. All under `/api/v1`. All new list endpoints return the envelope shape per §5.3.

### Billing (Phase 2)
- `GET    /invoices` — list (filter by status, party, date range, place_of_supply)
- `POST   /invoices` — create draft
- `GET    /invoices/{id}` — read (returns version + ETag)
- `PATCH  /invoices/{id}` — edit draft (If-Match required)
- `DELETE /invoices/{id}` — delete (only `draft`)
- `POST   /invoices/{id}/post` — post (writes movements **only if `estimate_id IS NULL`**, writes ledger always)
- `POST   /invoices/{id}/cancel` — cancel (reverse ledger; reverse movements only if `estimate_id IS NULL`)
- `GET    /invoices/{id}/lines` / `POST` / `PATCH` / `DELETE` — line CRUD on draft

### Estimates (Phase 2.5)
- `GET / POST / GET{id} / PATCH / DELETE / POST{id}/post / POST{id}/cancel` — same shape as invoices, but no GST math
- `POST   /estimates/{id}/promote-to-invoice` — returns the new draft invoice id, sets `is_promoted=true`
- `GET / POST / PATCH / DELETE  /routes` — sales-territory master data CRUD

### Money / ledger (Phase 3)
- `GET / POST / PATCH  /financial-accounts`
- `GET   /ledger-entries` (filter by account, date range; never POST directly — entries come from posted documents)
- `GET / POST / PATCH / DELETE / POST{id}/post / POST{id}/cancel  /payments`
- `GET / POST / DELETE  /payment-allocations` (link payments to invoices/bills)
- `GET / POST / PATCH / DELETE  /employees`

### AP (Phase 3.5)
- `GET / POST / PATCH / DELETE / POST{id}/post / POST{id}/cancel  /vendor-bills`
- `GET / POST / PATCH / DELETE  /expense-categories`
- `GET / POST / PATCH / DELETE / POST{id}/post / POST{id}/cancel  /expenses`
- `GET / POST / PATCH / DELETE / POST{id}/post / POST{id}/cancel  /salary`

### Reports (Phases 4 + 8)
- `GET /reports/sales-register?from=&to=&party_id=`
- `GET /reports/purchase-register?from=&to=&party_id=`
- `GET /reports/debtors-aging?as_of=`
- `GET /reports/creditors-aging?as_of=`
- `GET /reports/profit-loss?from=&to=`
- `GET /reports/cash-flow?from=&to=` (Phase 8)

### GSTR + period close (Phase 5)
- `GET  /gstr/gstr-1?period=YYYY-MM`
- `GET  /gstr/gstr-3b?period=YYYY-MM`
- `GET  /accounting-periods` (list)
- `POST /accounting-periods/lock` — body `{ lock_before_date }`
- `DELETE /accounting-periods/lock` — unlock (write-perm; audit-logged)

### Payroll batch (Phase 6)
- `POST /salary/batch/generate?period=YYYY-MM` — idempotent
- `GET  /salary/batch?period=YYYY-MM` — list current batch
- `POST /salary/batch/post?period=YYYY-MM` — atomic bulk-post
- `GET  /salary/{id}/payslip` — hydrated read-only

### Imports (Phase 7) — extending existing `/imports`
- `GET  /imports/template/{type}` — CSV template (types: items, parties, stock_balances, opening_balances)
- `POST /imports/preview` — multipart CSV; returns row-level validation results
- `POST /imports/commit` — promotes preview to actual writes

### Audit log (Phase 9) — extending existing
- `GET /audit-log?action=&entity_type=&entity_id=&user_id=&from=&to=&cursor=&limit=`

### SO → Invoice promotion (Phase 10)
- `POST /documents/{id}/promote-to-invoice` (where document.type is sales_order and status is posted)

### Pricing & dimensions (Phase 13)
- `GET / POST / DELETE  /pricing-dimension-options/thickness`
- `GET / POST / DELETE  /pricing-dimension-options/size`
- `GET / POST / DELETE  /pricing-rules`
- `GET    /pricing-rules/lookup?item_id=&thickness_mm=&size_code=&as_of=YYYY-MM-DD`

### Cost split (Phase 12)
- No new routes, but **schema additions** on existing routes:
  - GRN line POST: `unit_cost` field becomes nullable; setting it requires `cost.read` (and ideally is forbidden on GRN type entirely — bills are the only entry point).
  - Vendor Bill line POST: writes `valuation_layers.unit_cost` and `cost_pending=false` for the matched GRN's layer.
  - `valuation_layers` GET: hide `unit_cost` from response when caller lacks `cost.read`.

---

## Appendix C — New tables / migrations

| Table | Phase | Key columns (high-level) |
|---|---|---|
| `invoices` | 2 | `id, tenant_id, number, party_id, place_of_supply, customer_state_code, document_date, posting_date, status, estimate_id (nullable FK), totals_*, version, created_*, updated_*` |
| `invoice_lines` | 2 | `id, invoice_id, item_id, hsn_sac, quantity, unit_price, discount_pct, taxable_value, cgst_amount, sgst_amount, igst_amount, cess_amount, line_total, thickness_mm, size_code` |
| `estimates` | 2.5 | `id, tenant_id, number, party_id, route_id, document_date, posting_date, status, is_promoted, version, ...` |
| `estimate_lines` | 2.5 | `id, estimate_id, item_id, lot_id, quantity, unit_price (optional), thickness_mm, size_code` |
| `routes` | 2.5 | `id, tenant_id, code, name, active` |
| `financial_accounts` | 3 | `id, tenant_id, code, name, type (asset/liability/income/expense), subtype (cash/bank/cheque/gpay/receivable/payable/...), party_id (nullable), employee_id (nullable), expense_category_id (nullable), is_capital, active` |
| `ledger_entries` | 3 | `id, tenant_id, account_id, posting_date, debit, credit, source_type, source_id, party_id, employee_id, narration, created_at` (immutable) |
| `payments` | 3 | `id, tenant_id, number, direction (received/paid), mode (cash/bank/cheque/gpay), party_id, employee_id, account_id, amount, posting_date, status, version, ...` |
| `payment_allocations` | 3 | `id, payment_id, invoice_id (nullable), bill_id (nullable), amount` (mutually exclusive FK) |
| `employees` | 3 | `id, tenant_id, party_id (nullable; if also a vendor), name, gross_salary, payable_account_id, active, ...` |
| `vendor_bills` | 3.5 | `id, tenant_id, number, party_id, document_date, posting_date, status, totals_*, grn_match_status, version, ...` |
| `vendor_bill_lines` | 3.5 | `id, bill_id, item_id, hsn_sac, quantity, unit_cost, taxable_value, cgst_amount, sgst_amount, igst_amount, cess_amount, line_total, matched_grn_line_id (nullable), thickness_mm, size_code` |
| `expense_categories` | 3.5 | `id, tenant_id, code, name, account_id, is_capital, active` |
| `expenses` | 3.5 | `id, tenant_id, category_id, account_id, amount, posting_date, status, narration, version, ...` |
| `salary_entries` | 3.5 | `id, tenant_id, employee_id, period (YYYY-MM), gross_salary, float_amount, net_amount, posting_date, status, version, batch_id (nullable, FK Phase 6), ...` |
| `accounting_periods` | 5 | `id, tenant_id, lock_before_date, locked_at, locked_by_user_id, locked_by_action_audit_id` (1 row per tenant; PUT-as-upsert) |
| `item_dimensions` | 13 | `id, tenant_id, dimension_type (thickness/size), value_numeric (nullable), value_code (nullable), value_label (nullable), active` |
| `item_pricing_rules` | 13 | `id, tenant_id, item_id, thickness_mm (nullable), size_code (nullable), unit_price, valid_from, valid_until (nullable), version, ...` plus partial-unique index on `(tenant_id, item_id, thickness_mm, size_code) WHERE valid_until IS NULL` |

**Existing tables that gain columns:**
- `valuation_layers` += `cost_pending: bool default false`, `bill_id: nullable FK vendor_bills`
- `documents`, `invoices`, `estimates`, `vendor_bills` (lines) += `thickness_mm: numeric null`, `size_code: text null`
- `documents` (sales_order rows) += `is_promoted: bool default false`
- `audit_log` (already exists) — confirm append-only constraint and add filter-friendly indexes on `(tenant_id, action)`, `(tenant_id, entity_type, entity_id)`, `(tenant_id, created_at)`

---

## Appendix D — Error codes inventory

The frontend already handles all of these via `ApiError { status, code, message, fieldErrors, requestId, retryAfterSeconds? }`. Codes the backend must emit:

| Code | HTTP | Meaning | Where |
|---|---|---|---|
| `MISSING_IF_MATCH` | 428 | If-Match header not provided on a write that requires it | All transactional writes |
| `VERSION_MISMATCH` | 409 | If-Match version doesn't match current row version | All transactional writes |
| `PERIOD_LOCKED` | 423 | Posting date ≤ accounting_periods.lock_before_date | Phase 5; cuts across all post/cancel/import routes |
| `INSUFFICIENT_STOCK` | 400 | Item/lot doesn't have enough qty_on_hand for the requested move | Stock-OUT on invoice/estimate post |
| `IN_USE` | 409 | Cannot delete because a child references this row | Pricing dimension delete; expense category delete; item delete |
| `INVALID_GST_SPLIT` | 422 | Place of supply requires CGST+SGST but request sent IGST (or vice-versa) | Invoice line write/post |
| `BILL_GRN_MISMATCH` | 422 | Vendor bill line item/qty doesn't match any cost-pending GRN line | Phase 12 bill post |
| `ESTIMATE_ALREADY_PROMOTED` | 409 | promote-to-invoice called on a estimate with `is_promoted=true` | Phase 2.5 |
| `BATCH_FLOAT_DRIFT` | 409 | Salary batch post — at least one entry's float changed since generate | Phase 6 |
| `MODULE_NOT_SUBSCRIBED` | 403 | Tenant lacks the module subscription (already implemented; preserve) | All inventory.* |
| `RATE_LIMIT_EXCEEDED` | 429 | (already implemented; preserve) | Auth + sensitive writes |
| `NAIVE_DATETIME_NOT_ALLOWED` | 422 | (already implemented; preserve) | Any datetime field in body |

---

## Appendix E — Definition of done (per phase)

A phase is "done" when **all** of the following are true. The frontend will not switch from demo adapter to the real endpoint until they are.

1. **Migrations** — all new tables and column additions applied; rollback tested.
2. **Routes** — all endpoints in Appendix B for the phase exist and are mounted under `/api/v1`.
3. **Permissions** — all codes in Appendix A for the phase seeded; granted-to defaults applied to existing roles.
4. **Optimistic locking** — every write endpoint enforces `If-Match` per §5.1.
5. **Audit log** — every state change writes per §5.5 with the correct dotted action code.
6. **Period close** — every applicable post/cancel/commit honours §5.6 with `423 PERIOD_LOCKED`.
7. **Datetime/date contract** — request validation rejects naive datetimes; date strings round-trip without timezone drift.
8. **List shape** — every list endpoint returns the envelope per §5.3.
9. **Pagination** — limit clamped to ≤200; cursor-based.
10. **OpenAPI** — schema published; FE will regenerate types from it.
11. **Tests** — unit + integration coverage for the happy path + the spec's worked examples (where applicable, e.g. all 22 GST math test cases for Phase 2).
12. **Smoke test** — phase-specific smoke script in `frontend/scripts/` updated and passing end-to-end against the new endpoints.

---

## §7. Open questions for the backend team

These are decisions the FE prototype made one way but is open to backend-driven changes:

1. **Pricing rule auto-close on overlap** — FE currently auto-closes the prior active rule when a new rule is posted. Acceptable? Or should the FE force the user to explicitly close-then-create? Phase 13 spec assumes auto-close.
2. **Float account naming** — FE stores employee floats in `<employee_name>:Payable`. Backend may want a dedicated `employee_float` subtype. Cosmetic; the FE doesn't depend on the subtype.
3. **GSTR-1 amendments** — FE doesn't currently surface amendment returns. Out of scope until Phase 14.
4. **Multi-currency** — currencies table exists but every line in §3 assumes INR. Multi-currency is a future phase; please ensure schema choices don't paint us into a corner (use `numeric(20,2)` not `int`).
5. **Soft delete vs hard delete** — drafts are currently hard-deleted. Backend may want soft-delete for audit trail; FE can adapt.
6. **Idempotency window** — §5.8 proposes 24 hours; backend may prefer 1 hour or 7 days. FE will honour whatever's chosen.
7. **List-shape standardisation** — §5.3 recommends standardising on the envelope. Backend may want to keep the existing inconsistency for back-compat. FE will honour either; just please commit.

---

## §8. What to ignore in earlier docs

A few things in the older phase docs are now stale; **disregard them**:

- **CLIENT_NEEDS_GAP.md** describes the strategic positioning and was written before any phase doc existed. Useful for context, not for implementation detail.
- Any "FE-side TODO" notes in phase docs predating 2026-05-01 — those are done.
- Mentions of `/transfers` and `/serials` in nav — both are intentionally hidden in the FE for now; backend can defer routes for them.
- `frontend/changes_required.txt` is the rolling FE→BE backlog; treat as a queue, not a spec.

---

## §9. Contacting the frontend team

When in doubt:

- **Spec disagreement** — the phase doc is authoritative over this handoff doc.
- **Phase doc disagreement with FE prototype** — the FE prototype is authoritative (we sometimes update behaviour faster than the spec).
- **Either kind of disagreement that blocks you** — file a `gh issue` on `raniacone/raniacone-dev-frontend` tagged `backend-handoff`, link the spec line and the FE file path. Someone on FE will respond.

End of handoff document.
