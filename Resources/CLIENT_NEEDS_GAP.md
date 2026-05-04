# Client Needs Gap Analysis — Distribution / Trade Vertical

> **Source document:** `raniacone-dev/documentation/clientneeds.txt`
> **Authored:** 2026-04-26 (frontend team)
> **Companion:** [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md), [FRONTEND.md](FRONTEND.md), [24apr_audit_report.txt](../24apr_audit_report.txt)
> **Methodology:** frontend-first prototype → derive backend API spec from working UI

---

## TL;DR

The first known production client of RaniacOne is a **mid-size Indian distribution business** (construction-materials trade — ACP panels, hardener, APP membrane, etc.). Their spec is a small-business operating system: inventory + GST invoicing + challan flow + payments + multi-account ledgers + expenses + reports.

**Current product matches roughly 30%** of their ask. Most of the missing 70% is **the billing + financial accounting side** — and it's NOT custom client work. These are standard features any general-purpose IMS / distribution suite ships (think Tally, Vyapar, Zoho Books, Marg ERP, Cin7, Sortly+QuickBooks combo). Building them moves RaniacOne from "warehouse engine" to "distribution OS" — a much bigger market.

**Build plan**: build the frontend first against mock fixtures, iterate with the client, then write the formal backend API specification *from the working UI* and hand to the backend team. This document is the kickoff artefact for that flow.

---

## Strategic context — why we're building all of it, not just what this client asked for

The product mandate is a **generic IMS for the general market**, not a one-off implementation for one distributor. So:

- Features the client **didn't ask for but the product already has** (multi-tenant, RBAC, FIFO, custom fields, audit log, workflows, lots/serials, optimistic locking) — **stay**. They're table-stakes for any future enterprise prospect.
- Features the client **did ask for that are genuinely standard** (invoicing, GST, challans, payments, AR ledger, expenses, reports) — **get built** as product features, not as customisations. They land in the trunk and serve every future client.
- Features the client asked for that are **niche to their workflow** (route-based sales, "Bill / No Bill" toggle, the specific cheque-deposit-tracking ledger, salary-auto-debit-on-1st) — **get evaluated case-by-case**. Some are useful generically (route-based sales = sales-territory module — good); some are local quirks ("Arpit Specific Thing" in the spec) we'd implement once the use-case is clear.

The point: **this client's spec becomes the kickstart for the IMS-for-distribution module of the product**, not a forked custom build.

---

## Build methodology — frontend-first

```
┌──────────────────────────────────────────────────────────────┐
│  1. Build FE screens with mock data                          │
│     - Extend src/lib/demo/fixtures.ts with new entities      │
│     - Mock the API surface in src/lib/demo/adapter.ts        │
│     - All flows fully clickable in demo mode                 │
│                                                               │
│  2. Iterate UX with the client                               │
│     - Click-throughs, screenshots, recorded walkthroughs     │
│     - Lock down field-by-field requirements                  │
│                                                               │
│  3. Derive backend API spec from the working FE              │
│     - Each new service file in src/services/ becomes a       │
│       formal API contract (route + payload + response)       │
│     - File the spec in raniacone-dev/changes_required.txt    │
│     - Backend builds against the spec                        │
│                                                               │
│  4. Swap mock adapter for real backend                       │
│     - Demo mode keeps the mocks for sales/preview            │
│     - Production hits the real endpoints                     │
└──────────────────────────────────────────────────────────────┘
```

**Why this order:**
- The backend dev has a documented track record of shipping documentation that describes work the code doesn't yet do (see `24apr_audit_report.txt`). Front-loading FE work creates a concrete, testable target — much harder to ship a stub against.
- The client iterates faster on UI clicks than on schema docs.
- The FE prototype doubles as the demo for sales (no separate Figma file goes stale).

---

## Section-by-section gap analysis

Legend:

- ✅ **Built** — works today, no work needed
- 🟡 **Partial** — adjacent primitives exist; needs targeted FE + BE work
- ❌ **Not built** — entire module to build

### §4 — Admin Dashboard

| Requirement | Status | Notes |
| --- | --- | --- |
| Today's Orders / Yesterday's Orders / Total Orders tiles | 🟡 | Dashboard has KPI cards but not these specific time-bucketed counters |
| Filters: Day / Week / Month / Year / Custom | ❌ | Dashboard is currently date-filter-less |

**FE work:** `/dashboard` gets a `<DateRangeFilter>` component and three new KPI tiles bound to filtered queries.
**BE work:** `GET /documents?from=...&to=...&type=...&group_by=day|week|...` (the count endpoint already filters by type and dates; needs aggregation).

### §5 — Debtors Module

| Requirement | Status | Notes |
| --- | --- | --- |
| Total pending amount | ❌ | No AR concept anywhere |
| Customer count with pending payments | ❌ | Same |
| Click-through to full debtor list | ❌ | |
| Payment entry: Cash / Cheque / Online | ❌ | No payments service |
| Cheque metadata: bank, amount, cheque #, deposit date | ❌ | |
| Online metadata: amount, payee, transaction id | ❌ | |

**New module entirely.** See *New Entities Needed → Payment, Receipt, PartyLedger* below.

### §6 — Inventory Management

| Requirement | Status | Notes |
| --- | --- | --- |
| Specific SKUs (Hardener / ACP / APP variants) | ✅ | Items + variants + brands + categories all exist |
| Batch numbers required on ACP | ✅ | Lots are first-class; can be flagged required per-item |
| Batch selection on document lines | ✅ | `DocumentLine.lot_id` exists |
| Opening stock view | 🟡 | Live `qty_on_hand` exists; "as-of-date" balance snapshot is not a built report |
| Field set: Date, Bill #, Batch #, Product Code, Product, Brand, Category, **Thickness (mm), Size (ft×ft)**, Stock, Cost Price, Vendor | 🟡 | Most fields exist. Thickness + Size are not first-class — they go into custom fields (already supported, just need to be tenant-defined) |

**FE work:** "As-of-date" balance report page (uses movements-up-to-date arithmetic). Custom-field setup screen for Thickness + Size on the Item entity (already supported, just needs a 5-minute config screen).
**BE work:** `GET /balances?as_of=YYYY-MM-DD` endpoint that re-computes from movement history.

### §7 — Inward Purchase

| Requirement | Status | Notes |
| --- | --- | --- |
| Add vendor + date + multiple products | ✅ | PO header + lines |
| Group under same order | ✅ | PO IS the group |
| Allow inward without cost price | 🟡 | `DocumentLine.unit_price` is currently required (string with no default). Backend tweak to allow `unit_price = "0"` or null on PO with a flag like `cost_unknown=true` |

**FE work:** PO form lets the user check "no cost yet" → unit price field is hidden, line total is 0.
**BE work:** Allow `unit_price = null` on PO lines; balance + valuation logic must handle zero-cost layers without breaking FIFO COGS.

### §8 — Outward Sales (Challan / Estimate)

| Requirement | Status | Notes |
| --- | --- | --- |
| Route-based customer selection | ❌ | No `Route` entity, no `route_id` on Party |
| Customer selection (after route) | 🟡 | Customer search exists; cascade on route doesn't |
| **Bill / No Bill** toggle | ❌ | Document doesn't differentiate "billed" from "estimate" |
| Save and Print modes (with-amount-in-remarks vs default-blank) | ❌ | No print template engine yet |
| Auto-populate fields on product code | 🟡 | Item lookup populates code/name/UoM; no cascading variant dropdowns |
| Variant fields become dropdowns | ❌ | Variants exist but the SO form doesn't expose variant-attribute pickers |
| Out-of-stock popup | 🟡 | Backend returns `INSUFFICIENT_STOCK` on Post; FE shows a toast, not a popup. UX gap. |
| Default sale price set in backend | ❌ | `Item` has no `default_sale_price` field |
| Duplicate-line prevention by parameter concat | ❌ | |

**FE work:** New SO form that does route → customer cascade, hosts variant-attribute dropdowns, blocks duplicates, shows OOS as a modal not a toast. Two print templates (with/without amount in remarks).
**BE work:** New entity `Route`, `Party.route_id` foreign key, `Item.default_sale_price`, `DocumentHeader.is_billed` boolean, `DocumentHeader.print_mode` enum.

### §9 — Invoices

| Requirement | Status | Notes |
| --- | --- | --- |
| Create from challan | ❌ | Neither challan nor invoice exists as a doc type |
| All fields editable except invoice number | ❌ | Moot until invoice exists |

**Major new module.** See *New Entities Needed → Invoice* below.

### §10 — Collections

| Requirement | Status | Notes |
| --- | --- | --- |
| Cash / GPay / Cheque entry | ❌ | No payments service |
| Ledger updates automatically | ❌ | No ledger to update |

**Depends on Payments + Ledgers being built.**

### §11 — Ledger

| Requirement | Status | Notes |
| --- | --- | --- |
| Cash Ledger (cash in hand) | ❌ | |
| Bank Ledger | ❌ | |
| Cheque Ledger (un-deposited cheques) | ❌ | |
| GPay Ledger | ❌ | |
| Personal view per party with balance | ❌ | `Party` has no running balance |
| Auto salary debit on 1st of month | ❌ | No payroll, no employee-as-financial-entity |
| Mark employee active/inactive | 🟡 | `User.is_active` exists but Users ≠ Employees as a payable entity |

**Major new module.** See *New Entities Needed → FinancialAccount, LedgerEntry, Employee, SalaryRule* below.

### §12 — Expenses

| Requirement | Status | Notes |
| --- | --- | --- |
| Categorised expense entry (Food / Drinks / Petrol / Diesel / Labour / Capital) | ❌ | No expense entity |

**New module.** Should treat expense categories as tenant-customisable (master data, not hard-coded enum) so other industries can adapt them.

### §13 — Customers / Vendors (Parties)

| Requirement | Status | Notes |
| --- | --- | --- |
| Name mandatory | ✅ | `Party.name` is required |
| GST registered Y/N → if Y, GSTIN compulsory | 🟡 | `Party.tax_id` exists but no `is_gst_registered` flag, no GSTIN regex validation |
| Description (customer) | ❌ | No `description` field on Party |
| Route (customer) | ❌ | No `route_id` field |
| Opening Balance | ❌ | No `opening_balance` field |

**Targeted Party schema additions** — small but important.

### §14 — Reports

| Requirement | Status | Notes |
| --- | --- | --- |
| Sales report | 🟡 | Documents list filtered by SO type exists; not a "report" with totals/comparisons/export |
| Purchase report | 🟡 | Same, for PO |
| Inventory report | 🟡 | Stock Balances page exists |
| Debt report | ❌ | No debt to report on |

**FE work:** A real `/reports` route group with parameterised report templates: period, group-by, drill-down, CSV/PDF export.
**BE work:** Aggregation endpoints that return summarised result sets, not raw row dumps.

### §15 — Database Tables

| Required table | Status |
| --- | --- |
| Orders (Sales) | ✅ via Documents (type=SO) |
| Purchases | ✅ via Documents (type=PO) |
| Customers | ✅ via Parties |
| Vendors | ✅ via Parties |
| Inventory | ✅ via Items + Balances |
| Ledger | ❌ |
| Expenses | ❌ |

---

## New entities needed

The schemas below are **draft sketches** for the FE-first implementation. The FE will build mock fixtures matching these shapes; the backend spec gets refined from the working FE.

### `Invoice` (extends `DocumentHeader`)

```ts
// New document_type code "INVOICE"; new sub-type for legal tax invoices
interface Invoice extends DocumentHeader {
  invoice_number: string;        // immutable once posted
  challan_id?: string;            // null if direct invoice; set if promoted from a challan
  is_gst_registered: boolean;     // copied from Party.is_gst_registered at creation
  place_of_supply: string;        // 2-digit state code
  invoice_date: string;           // YYYY-MM-DD
  due_date?: string;
  amount_in_words: string;        // for the printed invoice
  irn?: string;                   // e-Invoice IRN if registered (Phase 3)
  qr_code_data?: string;          // e-Invoice QR (Phase 3)
}

interface InvoiceLine extends DocumentLine {
  hsn_code: string;               // 4-8 digits
  rate_pct: string;               // GST %
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  taxable_value: string;          // unit_price × qty - discount, before tax
}
```

### `Challan` (delivery challan)

```ts
// New document_type code "CHALLAN"; affects stock (movement on post)
interface Challan extends DocumentHeader {
  challan_number: string;
  challan_date: string;
  customer_id: string;            // Party.id with party_type ∈ ('customer','both')
  route_id?: string;
  vehicle_number?: string;
  driver_name?: string;
  is_billed: boolean;             // Bill / No Bill toggle from §8
  print_mode: 'with_remarks' | 'no_amount';
  invoice_id?: string;            // null until promoted; FK once an Invoice is created from this
}

// Lines are standard DocumentLine; no tax fields (challan is not a tax doc)
```

### `Route` (sales territory)

```ts
interface Route {
  id: string;
  tenant_id: string;
  code: string;                   // e.g. "MUM-N", "PUNE-S"
  name: string;                   // e.g. "Mumbai North", "Pune South"
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Party gets:
// - route_id?: string
// - description?: string
// - opening_balance: string (decimal)
// - is_gst_registered: boolean
// - gstin?: string (validated 15-char regex when is_gst_registered=true)
```

### `Payment` + `PaymentMethod`

```ts
type PaymentMode = 'cash' | 'cheque' | 'gpay' | 'bank_transfer' | 'upi' | 'card';

interface Payment {
  id: string;
  tenant_id: string;
  payment_number: string;
  payment_date: string;
  party_id: string;               // who paid (customer settling) or who we paid (vendor)
  direction: 'received' | 'paid';
  amount: string;
  mode: PaymentMode;
  // Mode-specific metadata in a polymorphic JSONB blob — the FE renders different forms per mode
  details: ChequeDetails | GPayDetails | CashDetails | BankDetails;
  applied_against: PaymentAllocation[];   // which invoices/challans this settles
  remarks?: string;
  created_at: string;
}

interface ChequeDetails {
  mode: 'cheque';
  bank_name: string;
  cheque_number: string;
  cheque_date: string;
  deposit_date?: string;          // null until deposited; sets the cheque-ledger → bank-ledger move
  cleared: boolean;
}

interface GPayDetails {
  mode: 'gpay';
  payee: string;
  transaction_ref: string;
}

interface CashDetails { mode: 'cash'; }

interface BankDetails {
  mode: 'bank_transfer';
  source_account_id: string;
  reference: string;
}

interface PaymentAllocation {
  invoice_id?: string;
  challan_id?: string;
  amount: string;
}
```

### `FinancialAccount` + `LedgerEntry` (the multi-ledger system)

```ts
type AccountType =
  | 'cash_in_hand'
  | 'bank'
  | 'cheque_in_transit'    // un-deposited cheques received
  | 'gpay'
  | 'party_receivable'
  | 'party_payable'
  | 'expense'
  | 'income'
  | 'capital';

interface FinancialAccount {
  id: string;
  tenant_id: string;
  type: AccountType;
  code: string;
  name: string;
  party_id?: string;       // for party-receivable / party-payable, links the account to a Party
  opening_balance: string;
  current_balance: string; // de-normalised running balance
  is_active: boolean;
  created_at: string;
}

interface LedgerEntry {
  id: string;
  tenant_id: string;
  account_id: string;
  entry_date: string;
  source_doc_type: 'invoice' | 'challan' | 'payment' | 'expense' | 'salary' | 'opening' | 'manual';
  source_doc_id: string;
  debit: string;           // exactly one of debit/credit non-zero
  credit: string;
  running_balance: string; // de-normalised at write time, validated on read
  remarks?: string;
  created_at: string;
}
```

This is real double-entry bookkeeping but presented to the user as separate "ledgers" (cash / bank / cheque / gpay / per-party). UX is per-account; storage is double-entry.

### `Employee` + `SalaryRule` (for §11 salary auto-debit)

```ts
interface Employee {
  id: string;
  tenant_id: string;
  user_id?: string;        // optional link if they also have a system login
  name: string;
  role: string;            // free-text job title, NOT an RBAC role
  monthly_salary: string;
  payment_account_id?: string;    // which account their salary is paid from
  joined_at: string;
  is_active: boolean;
}

interface SalaryRule {
  id: string;
  employee_id: string;
  schedule: 'monthly_first' | 'monthly_last' | 'weekly' | 'custom';
  // On 1st of each month, a scheduled job reads active SalaryRules and writes
  // a LedgerEntry against each Employee's party_payable account.
}
```

### `Expense`

```ts
interface ExpenseCategory {
  id: string;
  tenant_id: string;
  code: string;            // e.g. "FOOD", "PETROL"
  name: string;            // e.g. "Food", "Petrol"
  is_capital: boolean;     // distinguishes capex from opex
  is_active: boolean;
}

interface Expense {
  id: string;
  tenant_id: string;
  expense_date: string;
  category_id: string;
  amount: string;
  paid_from_account_id: string;    // FinancialAccount (cash, bank, etc.)
  vendor_id?: string;              // optional Party
  description: string;
  attachment_id?: string;          // bill photo
  created_at: string;
}
```

### Existing entity additions

```ts
// Item — defaults for SO + GST
interface ItemAdditions {
  hsn_code?: string;
  default_sale_price?: string;     // pre-fills SO line
  default_tax_rate_pct?: string;   // GST %
}

// Party — GST + route + opening balance
interface PartyAdditions {
  is_gst_registered: boolean;
  gstin?: string;                  // validated 15-char when is_gst_registered=true
  description?: string;
  route_id?: string;
  opening_balance: string;
}

// DocumentHeader — Bill/NoBill + print mode (used by Challan especially)
interface DocumentHeaderAdditions {
  is_billed?: boolean;
  print_mode?: 'with_remarks' | 'no_amount';
}
```

---

## Phasing

Each phase is **frontend-first** — build mock-backed FE, iterate, then write the BE spec.

### Phase 1 — Lightweight Inventory + Customer hardening (1-2 sprints)

Unblock the inventory side cheaply. Everything in this phase has clear backend additions that are small.

- **Party schema additions:** `is_gst_registered`, `gstin` (validated), `description`, `route_id`, `opening_balance`
- **`Route` entity** + master-data screen
- **Item additions:** `hsn_code`, `default_sale_price`, `default_tax_rate_pct`
- **PO line: optional unit_price** (cost-unknown receiving)
- **As-of-date balance report**
- **Dashboard date-range filter + "Today's / Yesterday's Orders" tiles**
- **Custom fields preset:** ship a tenant-installable preset that adds `Thickness (mm)` + `Size (ft×ft)` to the Item entity so the client gets immediate value from the existing custom-fields system

**FE deliverables:** updated forms (Party create/edit, Item create/edit, PO create), new Route master-data page, updated Dashboard, new Reports → Stock as-of-date page.
**BE deliverables (after FE freeze):** schema migrations for the 3 entities, 1 new endpoint for as-of-date balances, validation regex for GSTIN.

### Phase 2 — Billing core (4-6 sprints)

The legally-required tax + dispatch documents.

- **`Challan` document type** with route, vehicle, driver, Bill/NoBill, two print modes
- **`Invoice` document type** with HSN, CGST/SGST/IGST split, place-of-supply, GST math
- **Challan-to-Invoice promotion flow**
- **PDF rendering** for both (server-side, via a templating service)
- **Number Series** wiring for invoice + challan numbers
- **Item-level GST defaults** flow into invoice lines
- **Two-column out-of-stock modal** replacing the current toast on SO post
- **Variant-attribute cascading dropdowns** on SO/Challan forms

**Out of scope for Phase 2 (deferred to Phase 4):**
- e-Invoice IRN/QR (NIC integration — separate beast)
- e-Way Bill (NIC integration)

**FE deliverables:** new document creation flows for Invoice + Challan, line-tax UI (CGST/SGST/IGST live calc), promote-from-challan modal, PDF preview.
**BE deliverables:** two new doc types, line-tax fields, GST math service (place-of-supply matrix: same-state → CGST+SGST, inter-state → IGST), PDF rendering service, number-series allocation.

### Phase 3 — Financial accounting (4-6 sprints)

The ledger + payments + expenses + debtors module.

- **`FinancialAccount` + `LedgerEntry`** double-entry storage
- **Multi-ledger UX**: separate views for cash / bank / cheque-pending / gpay / per-party
- **Payments module** (cash / cheque / gpay / bank / upi / card) with mode-specific forms
- **Cheque-deposit workflow** (cheque-in-transit → bank account on deposit)
- **Settlement allocation** (apply payment to invoice/challan, partial-pay support)
- **`Expense` + `ExpenseCategory`** module
- **`Employee` + `SalaryRule`** + scheduled job for monthly salary debit
- **Debtors view** (top of dashboard + dedicated page)
- **Personal ledger view** (per-party "you owe / they owe")
- **Reports — Debt aging, Sales, Purchase, Profit & loss summary**

**FE deliverables:** new top-level "Money" route group with Ledgers / Payments / Expenses / Reports / Debtors. Payment-mode-specific form components. Allocation modal.
**BE deliverables:** big — new schema for accounts, entries, payments, allocations, expenses, employees, salary rules, scheduled job runner.

### Phase 4 — e-Invoice + e-Way Bill integrations (2-4 sprints)

Government API integrations on top of the now-mature invoice/challan core.

- **NIC e-Invoice integration**: post invoice JSON, receive IRN + signed QR, store on the invoice
- **e-Way Bill generation**: post movement JSON, receive EWB number, store on the challan
- **Bulk operations**: cancel/regenerate IRN, EWB validity tracking

**Why last:** these need a stable invoice + challan first. Building them earlier means rebuilding when invoice schema changes.

---

## Open questions (for product / client / sales)

1. **Phase 2 e-Invoice scope.** The MVP can be "GST-correct printable PDF invoices" without the NIC e-Invoice integration. Do we need IRN-stamped invoices for Phase 2, or can we ship Phase 2 with PDF-only invoices and add IRN in Phase 4?
2. **The "Arpit Specific Thing" line on online payments** — what does this resolve to? Is it a UPI VPA capture? A specific gateway integration? Cannot scope without clarification.
3. **Multi-tenancy boundary on financial data.** Are ledgers strictly per-tenant (the right answer for SaaS), or does the client want consolidated multi-entity views (sometimes asked for by family-owned distributors with multiple GSTIN registrations)?
4. **Workflows on Invoice posting.** Should invoice posting go through the existing workflow engine (Draft → Approved → Posted) or be a single action? Big-business answer: workflow. Small-business answer: one-click. Both are reasonable; needs the client's call.
5. **Branch-level isolation.** This client has multiple warehouses/branches. RaniacOne has Locations (per-tenant). Are branches Locations, or a separate `Branch` entity that owns Locations? Affects data model and reporting.
6. **GST returns export.** Does the client need GSTR-1, GSTR-3B, GSTR-9 exports, or is "an Invoice register exported to CSV" enough for now? Real GSTR JSON exports are a separate feature class.
7. **POS / mobile.** The route-based sales workflow sounds like field salespeople closing orders. Is that done on a phone/tablet in the field? If yes, mobile-first design becomes Phase 1 scope, not "responsive afterwards."
8. **Multi-currency.** RaniacOne supports multiple currencies at the catalog level. This client appears INR-only. Multi-currency invoices add complexity (forex gain/loss accounting). Defer or scope?

---

## Action items — frontend team (post this document)

| # | Action | Owner | Phase | Effort |
| --- | --- | --- | --- | --- |
| 1 | Lock `.impeccable.md` design context for the new modules (forms-heavy, accounting-style) | FE | 1 | 0.5d |
| 2 | Extend `src/lib/demo/fixtures.ts` with the new entities (Route, Invoice, Challan, Payment, FinancialAccount, LedgerEntry, Expense, ExpenseCategory, Employee) | FE | 1 | 1-2d |
| 3 | Extend `src/lib/demo/adapter.ts` to mock the new endpoints | FE | 1 | 1-2d |
| 4 | Build Phase 1 FE screens (Route, Party additions, Item GST defaults, As-of-date balance, Dashboard filters) | FE | 1 | 5-8d |
| 5 | Have client click through Phase 1 in demo mode; capture feedback | FE+Sales | 1 | 1d |
| 6 | Write `raniacone-dev/changes_required.txt` REQ-N entries with full schemas + endpoint specs derived from working FE | FE | 1 | 1d |
| 7 | Hand to backend; FE swaps demo adapter for real endpoints when BE ships | FE+BE | 1 | depends on BE |
| 8 | Repeat for Phase 2 (Invoice + Challan) | FE | 2 | 3 weeks |
| 9 | Repeat for Phase 3 (Ledgers + Payments + Expenses + Debtors) | FE | 3 | 4 weeks |
| 10 | Repeat for Phase 4 (e-Invoice + e-Way Bill) | FE+BE | 4 | 2 weeks |

---

## What this document is NOT

- Not a feature list for the client to sign off on. The client gave us a needs document; this is **our** product team's interpretation of what to build.
- Not a final API specification. Schemas are drafts; the formal `changes_required.txt` per phase is the contract with the backend team.
- Not a freeze. New requirements that surface during FE prototyping (which is the *point* of front-loading the FE) update this document and the next phase's spec.

---

*Authored by the frontend team, 2026-04-26. Maintained as new requirements land. Companion to the per-phase REQ entries in `frontend/changes_required.txt` and `raniacone-dev/changes_required.txt` once those are filed.*
