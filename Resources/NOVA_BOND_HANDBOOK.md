# Nova Bond — Handbook

Last updated: 2026-05-05 *(refreshed after editable thickness/size catalogues, party-type expansion to 5 kinds, Employees moved under Parties, Raniac Technologies vendor seed, inline threshold editing, Serials/Transfers hidden, Movements pushed last)*

> Everything Mr. Arpit and his team need to know about the system.
> What it does, who does what, how the day flows, and what's
> actually been built — including features beyond his original
> brief that come "for free" with the platform.

---

## 1 · Who uses what

The system has two user personas at Nova Bond on day-1:

| Role | Who | What they see | What they don't see |
|---|---|---|---|
| **Admin** | Mr. Arpit (owner) | Everything — items, stock, GRNs, bills, invoices, money, reports, P&L, GSTR, master data, pricing rules | Nothing hidden |
| **Warehouse Operator** | Floor staff (1+ persons) | Items, stock, lots, locations, GRNs (no cost), Sales Orders, Challans (with sale price OK), Stock Counts, Parties | Bills, invoices, payments, expenses, salary, accounts, ledger, reports, audit log, valuation, **pricing config**, **master data master**, P&L — **anything money or admin-config related** |

Two more roles exist for the future:
- **Salesman** (field rep) — same as Operator + challan creation focus
- **Cashier** (front desk) — payments-only access, no cost visibility

Admin's view of the world is unrestricted; Operator's view is operations-only with **zero money on screen**.

---

## 2 · Operator's day — a story

It's 9:30 AM on a Monday. The warehouse operator logs in.

### 9:30 AM · Reviewing the morning

The dashboard greets him with **3 tiles**:
1. **Items in stock** — 39 SKUs across 4 locations
2. **Draft documents** — 4 GRNs / Challans pending
3. **Stock counts** — 2 open

He doesn't see "Inventory value" or "GRNs pending bill" — those are admin-only. He doesn't see Money / Reports / Master Data / Audit Log groups in the sidebar at all.

### 10:00 AM · Truck arrives at the dock

Kaizen Imports has delivered aluminum substrate. The operator unloads, counts: **200 sheets**. The supplier's packing slip shows batch number `K-2604-A`.

He opens **Purchases → Goods Receipts → + New Goods Receipt**.

The form asks: *"Receipt source?"* with two large cards:
- **Against a PO** — for planned shipments
- **Direct receipt (no PO)** — for phone deals or walk-ins

This was a deal Mr. Arpit did over a phone call yesterday — no PO. He clicks **Direct receipt (no PO)**.

| Field | What he enters |
|---|---|
| Vendor | Kaizen Imports (mandatory because no PO) |
| Date | (auto-filled today) |
| Remarks | "Aluminum substrate — Bright Silver line" |

He clicks **Create & edit lines**. The system auto-numbers it (`GRN-00001` for the first one).

### 10:05 AM · Adding the line

On the GRN detail page, **+ Add line**. The form shows:

| Field | What he enters |
|---|---|
| Item | NB-1101 Bright Silver |
| **Thickness** | 3 mm *(new — Phase 13)* |
| **Size** | 1220 × 2440 mm (4×8 ft) *(new — Phase 13)* |
| Quantity | 200 |
| UoM | SHEET *(or BUNDLE if shipped wholesale)* |
| Lot / batch number ⭐ | K-2604-A *(required because NB-1101 is batch-tracked)* |

**No "Unit cost" field. No "Discount %". No "Line total".** A small caption explains: *"Cost prices are recorded on the matching Vendor Bill posted by the office team."*

He saves and clicks **Post**. Stock rises: NB-1101 went from 138 → 338 sheets. Behind the scenes the system created Lot record `K-2604-A` with received_qty=200 — operator never had to visit `/items/lots/new` (that page is read-only by design).

### 11:00 AM · Customer comes by for a quick pickup

Greenfield Retail sent their truck for 5 sheets of NB-1101 (sample swatches for a project bid).

Operator opens **Sales → Challans → + New Challan**. Form fields:

| Field | What he enters |
|---|---|
| Customer | Greenfield Retail |
| Date | today |
| Vehicle # | MH 12 AB 4567 |
| Driver name | Suresh |
| Print mode | **No amounts** (default) — driver gets a clean copy |

Adds line: NB-1101 × 5 sheets, **3 mm + 1220×2440**. Because the dimensions are picked, the system **auto-fills `unit price` = ₹5,800** *(pulled from the active pricing rule — the "Q4 list price" effective since 3 March)*.

He posts the challan, hits **Print**. The printed challan shows products + qty in the remarks column, **no amounts** (per the saved print mode). Driver signs, leaves.

> **Plot twist**: Greenfield calls back: "Send me a priced version for our records."
> Operator opens the challan detail, clicks the **With amounts** chip in the Print mode toggle, hits Print again. Same data, with prices visible this time. Saved automatically.

### 12:30 PM · Quick stock count

Mr. Arpit asked for a count of the Premium Collection rack. Operator opens **Inventory → Stock Counts → New** at `loc-main`, selects items NB-1502 and NB-1602, enters counted qty. System computes variance. Operator applies the count → stock adjusts.

### 4:00 PM · End of day

Operator logs out. He has handled:
- 1 inward receipt (200 sheets · 1 lot recorded · no cost typed)
- 3 outbound challans (sale price auto-filled from pricing rules)
- 1 stock count

He never saw a single rupee of cost or P&L. He saw the *sale* price (auto-filled when he picked thickness + size); he didn't see what Nova Bond paid Kaizen, what margin it makes, or how much customers owe.

---

## 3 · Mr. Arpit's day — a story

### 6:00 PM · Reviewing the day

Mr. Arpit logs in at home. His dashboard has **4 tiles**:
1. **Inventory value** — ₹1.18 crore *(admin-only KPI)*
2. **Items in stock** — 39 SKUs
3. **Draft documents** — 1 (an estimate from this morning)
4. **GRNs pending bill** — **3** *(admin-only KPI flagged in red if > 0)*

The "GRNs pending bill" tile catches his eye. He clicks → goes to the Goods Receipts list. He sees three GRNs from last week (Kaizen × 2, Horizon × 1) with the **Direct** badge on each. He cross-references with his email: yes, all three suppliers have sent invoices.

### 6:15 PM · Posting the vendor bills (cost data finally enters)

Mr. Arpit opens **Purchases → Vendor Bills → + New Bill**.

| Field | What he enters |
|---|---|
| Vendor | Kaizen Imports |
| Bill # | KZ-2026-0512 (the supplier's number) |
| Bill date | 2026-04-29 |
| Place of supply | 27 (MH — intra-state) |

Adds 2 lines:
- NB-1101 × 200 sheets × ₹2,000 cost = ₹4,00,000 + 18% GST = ₹4,72,000
- (One more line for another item on the same bill)

He clicks **Post**. The system now:
1. Records the AP ledger entry: Cr Kaizen ₹4,72,000 (we owe them)
2. **Backfills cost** into the GRN's valuation layer: NB-1101 batch K-2604-A unit_cost = ₹2,000
3. Updates the FIFO valuation, balances.value column updates
4. P&L COGS line now reflects this purchase
5. Audit log records: `vendor_bill.post`, `valuation_layer.backfill`

Now COGS is correct. The "GRNs pending bill" KPI drops from 3 → 2.

### 6:45 PM · Adjusting prices

Aluminum prices have moved. Mr. Arpit goes to **Master Data → Item Pricing**, filters to NB-1101.

He sees the grid showing the current price for each thickness × size combination. He clicks **Update price** on the 3mm × 4×8 row → enters new price ₹6,100 → effective date 15 May → notes "Q1 raw material cost up 6%" → saves.

The system:
1. Closes the prior rule's `valid_until = 14 May`
2. Creates the new rule active 15 May → ongoing
3. **Old invoices keep their snapshotted ₹5,800** — version history preserved
4. New lines created on or after 15 May will auto-fill ₹6,100

He can see the prior price in the expanded history row beneath the active one.

> **Side note**: A new customer just asked about 6mm panels in a 4×16 ft size — combinations Nova Bond hasn't carried before. Mr. Arpit clicks **Manage dimensions** at the top of the page, types `6` under "Add a thickness" → Add, then enters `1220x4880` / "1220 × 4880 mm (4×16 ft)" under Sizes → Add. Both options are immediately available everywhere — pricing rules, GRNs, challans, invoices. Removing a thickness/size is blocked while any pricing rule references it, so history can't be orphaned by accident.

> **+ Add price rule** at the top right is the discoverable entry point for fresh combinations: it opens the modal with an item picker (so he can pick any item and create the very first rule for any thickness × size combo).

### 7:00 PM · Posting an invoice for Greenfield

Greenfield's earlier challan was for a sample shipment. Mr. Arpit decides to convert it to a tax invoice.

He opens the challan detail → clicks **Promote to invoice**. System:
1. Creates a draft invoice with `source_doc_id = <challan>`
2. Copies lines, computes GST splits (intra-state → CGST 9% + SGST 9%)
3. Sets `print_mode = with_amount` (tax invoice law requires amounts)
4. Redirects to invoice detail

Mr. Arpit reviews, hits **Post**. AR goes up: Greenfield owes us. Email/print → customer.

### 7:15 PM · Recording a payment

Greenfield paid ₹50,000 by GPay this afternoon. Mr. Arpit opens **Money → Receipts → + New Receipt**:

| Field | Value |
|---|---|
| Direction | Received |
| Customer | Greenfield Retail |
| Mode | GPay |
| Amount | ₹50,000 |
| Allocate to | (existing posted invoices) |

Posts. Greenfield's AR balance reduces. Cash flow updates.

### 7:30 PM · End-of-month: GSTR + P&L review

It's the last day of the month. Mr. Arpit:
1. Opens **Reports → Profit & Loss** → date range last month → reviews:
   - Revenue: ₹X
   - − COGS: ₹Y
   - − Operating expenses: ₹Z
   - − Salary: ₹W
   - = Net profit: ₹P
2. Opens **Reports → GSTR-1** → picks last month → downloads JSON → emails to CA
3. Opens **Reports → GSTR-3B** → picks last month → downloads JSON → emails to CA
4. Once CA confirms filings: **Admin → Period Close** → locks the month

After period close, no one (not even Mr. Arpit) can edit posted documents from that period. Audit-trail-protected.

### 8:00 PM · Salary day

It's the 1st of the next month — payroll day. Mr. Arpit:
1. Opens **Money → Payroll Batch**
2. Picks period → clicks **Generate drafts** → 4 employees get draft salaries auto-created with float deductions pre-filled
3. Reviews each entry — Ramesh has ₹8,500 customer-GPay float; system shows Net = Gross − Float = ₹36,500
4. Clicks **Post all drafts** → all 4 salary entries post; bank account debited; employee_float cleared
5. Each posted entry has a **Payslip** button — printable A4 document with breakdown + amount in words

### 8:30 PM · End of session

Mr. Arpit logs out. Today he handled:
- 3 vendor bills posted (cost data flowed in)
- 1 price update (with version history preserved)
- 1 invoice created from challan
- 1 receipt recorded
- 4 salaries posted via batch
- Period close after CA sign-off

The operator does the warehouse work; Mr. Arpit owns all the money decisions, pricing config, and analytics. Two roles, one shared database, completely separate visibility.

---

## 4 · Mr. Arpit's specific asks — what was built

These are the requirements from `clientneeds.txt`. Each marks how it landed.

### §4 — Admin Dashboard
> *Today's / Yesterday's / Total orders + Day/Week/Month filters*

| Built | What |
|---|---|
| ✅ | KPI tiles on `/dashboard` (Items in stock / Draft docs / Stock counts) |
| ✅ | "Inventory value" + "GRNs pending bill" tiles for Admin only |
| 🟡 | Specific Today/Yesterday/Total Orders KPIs not yet on dashboard — recent movements + recent documents lists are |
| ❌ | Day/Week/Month/Year/Custom date filter on dashboard — pending |

### §5 — Debtors Module
> *Total pending, customer count, payment entry by mode*

| Built | What |
|---|---|
| ✅ | `/money/debtors` — list of customers with outstanding (top of Money sidebar group, "first-thing-Arpit-checks" position) |
| ✅ | `/money/receipts/new` — Cash / Cheque / GPay / Bank entry forms |
| ✅ | Mode-specific fields: cheque (bank, cheque #, deposit date); UPI (transaction id) |
| ✅ | Allocation against multiple invoices |
| ✅ | `/reports/debtors-aging` — bucketed 0–30 / 31–60 / 61–90 / 90+ days |

### §6 — Inventory Management
> *Hardener / ACP / APP variants with batch numbers, opening stock, full field set with Cost Price visible to admin*

| Built | What |
|---|---|
| ✅ | 39 Nova Bond ACP items seeded with HSN, GST rate, batch tracking |
| ✅ | Lots first-class entity; required at GRN time for batch-tracked items; auto-created from line entry |
| ✅ | "Opening stock" via bulk-import (`/settings/imports/stock_balances`) |
| ✅ | Fields: Date, Bill #, Batch #, Product Code, Product, Brand, Category, Stock, Cost Price, Vendor — all on the system |
| ✅ | **Thickness (mm)** + **Size (ft×ft)** now first-class on every line form (Phase 13) |
| ✅ | UoMs expanded — 22 units across 5 categories (count / weight / length / area / volume) |

### §7 — Inward Purchase
> *"Without the cost price just the product and the stock"*

| Built | What |
|---|---|
| ✅ | GRN flow with NO cost field on the line form |
| ✅ | Two modes: PO-backed + Direct receipt |
| ✅ | Lot/batch capture mandatory for batch-tracked items |
| ✅ | Cost flows in via Vendor Bills (Admin-only) — backfill into FIFO layers |
| ✅ | Thickness + Size dropdowns added; persisted on the line for traceability |

### §8 — Outward Sales (Challan/Estimate)
> *Bill / No Bill toggle, two print modes, route-based customer selection*

| Built | What |
|---|---|
| ✅ | Challan creation with `print_mode` (no_amount / with_remarks) toggle on form AND detail page |
| ✅ | Print page renders with or without amounts based on mode |
| ✅ | Bill / No Bill flag (`is_billed` on challan) |
| ✅ | Routes (sales territories) modelled |
| 🟡 | Route-based cascading customer dropdown (Route → filter Customer list) — not on form yet |
| ✅ | Auto-populate item details on item code selection |
| ✅ | Auto-fill unit price from active pricing rule when thickness + size are picked (Phase 13) |
| ✅ | Out-of-stock detection at post time |

### §9 — Invoices
> *Create from challan, all fields editable except invoice number*

| Built | What |
|---|---|
| ✅ | Promote-to-invoice from challan |
| ✅ | Promote-to-invoice from sales order (Phase 10 — mirror of challan promotion) |
| ✅ | GST math computed at promotion (CGST+SGST vs IGST per state) |
| ✅ | Invoice number from NumberSeries (not editable) |
| ✅ | All other fields editable on the draft |

### §10 — Collections
> *Cash / GPay / Cheque entry, ledger updates automatically*

| Built | What |
|---|---|
| ✅ | All four modes (Cash, Bank, Cheque, GPay) on `/money/receipts/new` |
| ✅ | Posting writes ledger entries; account balances update |
| ✅ | Cheque-deposit flow (cheque_in_transit → bank on clear) |

### §11 — Ledger
> *Cash / Bank / Cheque / GPay / per-party views, auto salary debit on 1st*

| Built | What |
|---|---|
| ✅ | `/money/accounts` — chart of all financial accounts by type |
| ✅ | `/money/ledger/[accountId]` — per-account journal |
| ✅ | `/money/debtors` — per-party "you owe / they owe" |
| ✅ | `/money/cheques` — un-deposited cheques pending |
| ✅ | `/money/employees` — float ledger per employee |
| ✅ | Salary batch generation on the 1st (cron-ready endpoint built; cron itself is a backend wiring) |
| ✅ | Mark employee active/inactive |

### §12 — Expenses
> *Food / Drinks / Petrol / Diesel / Labour / Capital Expense*

| Built | What |
|---|---|
| ✅ | `/money/expenses/categories` — tenant-customisable category list |
| ✅ | 6 default categories pre-seeded matching spec |
| ✅ | `/money/expenses/new` — quick entry; one ledger account per category |

### §13 — Customers / Vendors
> *Name mandatory, GST conditional, Description + Route + Opening Balance for customers*

| Built | What |
|---|---|
| ✅ | Party form with name (req), GST registered (yes/no), GSTIN conditional |
| ✅ | Description field |
| ✅ | Opening Balance field |
| ✅ | Route field (linked to Routes master) |
| ✅ | **5 party types** — Customer, Supplier, Vendor (services/IT), General Person, Both. Filter dropdown + colour-coded badges everywhere |
| ✅ | **Employees nested under Parties** sidebar group (was under Money before) |
| ✅ | Raniac Technologies seeded as the first IT vendor (`VEN-IT-001`) — pattern for future service-vendor entries |

### §14 — Reports
> *Sales / Purchase / Inventory / Debt*

| Built | What |
|---|---|
| ✅ | `/reports/sales` (Sales register — foundation for GSTR-1) |
| ✅ | `/reports/purchases` (Purchase register — foundation for GSTR-2) |
| ✅ | `/balances` + `/valuation` (Inventory) |
| ✅ | `/reports/debtors-aging` + `/reports/creditors-aging` (Debt) |
| ✅ | `/reports/profit-loss` (P&L) |
| ✅ | `/reports/cash-flow` (Cash flow statement) |
| ✅ | `/reports/gstr-1` + `/reports/gstr-3b` (CA-ready JSON exports) |

### §15 — Database Tables
All listed tables (Orders, Purchases, Customers, Vendors, Inventory, Ledger, Expenses) are modelled as production-grade entities, not just spreadsheets. Plus 30+ supporting tables (lots, serials, valuation_layers, audit_log, item_dimensions, item_pricing_rules, etc.) for data integrity.

---

## 5 · Before vs After — comparison

This compares what existed when we started vs what's there now (after Phases 1–13 + Nova Bond data clean-up).

| Area | Before | After |
|---|---|---|
| **Item catalog** | 6 generic SKUs (Laptop, Headphones, Coffee, etc.) | **39 Nova Bond ACP items only** — legacy demo data purged. Brand = Nova Bond, no others. Categories = 7 NB collections, no others. |
| **GRN flow** | Did not exist as distinct flow; cost was always required on receipt | Distinct `/documents/goods-receipts` route; PO-backed or Direct mode; **NO cost field**; Thickness + Size + Lot capture required |
| **Vendor Bills** | Did not exist | Full bill module (`/bills/*`) with line-by-line GST math; Admin-only; backfills cost into GRN valuation layers |
| **Pricing model** | Single `default_sale_price` per item | **Versioned pricing rules** per (item × thickness × size). Old invoices keep snapshot; new lines auto-fill from active rule. Full version history visible in admin UI. |
| **Thickness / size catalogues** | Hardcoded — required a code change to add 6mm or a new sheet size | **Editable from UI** via Master Data → Item Pricing → "Manage dimensions". Add or remove thickness values + size codes; deletion blocked while any pricing rule references the option. |
| **Item detail page** | 10 tabs (General / Identifiers / Variants / UoMs / Lots / Serials / Stock / Reorder / Custom / Attachments) | **11 tabs** — added **Pricing tab** (read-only thickness×size grid with current prices) |
| **Lots** | Manual "Add Lot" button on `/items/lots` (could create orphan lots) | Read-only viewer. **Lots are born from GRN line entry only** — no manual creation path |
| **UoMs** | 6 units in 3 categories | **22 units in 5 categories** (count/weight/length/area/volume) — covers SHEET, BUNDLE, SQ.FT, MTR, MT, ROLL, DRUM, NOS, etc. + 12 conversion factors |
| **Challan print mode** | No print modes; always one layout with amounts | `no_amount` (default) / `with_remarks` toggle on form + detail + print page |
| **Operator visibility** | Saw all amounts everywhere | Sees ZERO money: no cost on GRN, no Value on balances, no cost on movements, no bills/payments/reports/master-data access |
| **Admin dashboard** | Generic KPIs | Plus "GRNs pending bill" indicator flagging unbilled receipts |
| **Permission model** | Single tier — admin or read-only | **Three new gates**: `cost.read` (cost surfaces) + `financials.read` (money/reports) + `master_data.read` (master data sidebar group). Operator role trimmed to physical-only. |
| **Sidebar** | Setup-data first (Master Data at top) | **Action-first**: Dashboard → Sales → Purchases → Money → Inventory → Parties → Reports → Master Data → Admin |
| **Reports** | None | Sales register, Purchase register, Debtors aging, Creditors aging, P&L, Cash flow, GSTR-1, GSTR-3B |
| **Money / ledger** | None | Full multi-account ledger (Cash/Bank/Cheque-pending/GPay/per-party/per-employee), payments, allocations, cheque deposits, expense tracking, salary batch |
| **Imports** | Stub history page | Wizard for Items / Parties / Stock balances / Opening balances with preview validation + commit |
| **Compliance** | None | GSTR-1 + GSTR-3B JSON exports, period close (ledger lock) |
| **Audit log** | None | Every critical action logged with before/after JSON; `/admin/audit-log` viewer |
| **Mobile responsive** | Partial | Tables scroll horizontally; sidebar drawer; topbar collapse |
| **Money pages spacing** | `max-w-7xl mx-auto` causing big margins on wide screens | Full-width `p-4 md:p-5 space-y-4` like Items/Balances pages |
| **Party types** | 3 (Customer / Supplier / Both) | **5** — added Vendor (services/IT) + General Person; colour-coded badges, filter dropdown, 5 distinct labels |
| **Employees** | Lived under Money group | **Moved into Parties group** (alongside Customers + Vendors) — they are people Nova Bond has a financial relationship with |
| **Inventory sidebar** | Movements pinned near top; Serials + Transfers always visible | **Movements moved to last** position; **Serials + Transfers hidden** from sidebar (Nova Bond doesn't track per-unit serials and runs a single warehouse). Code preserved — re-enable by un-commenting in `sidebar.tsx` if a tenant needs them. |
| **Item create form** | Showed "Enable serial-number tracking" checkbox | Checkbox **hidden** — Nova Bond catalog uses lots only. Re-enable by un-commenting in `items/new/page.tsx` |
| **Item detail tabs** | 11 tabs incl. dedicated **Serials** | Serials tab **hidden** for the same reason |
| **Low-stock thresholds** | Read-only on `/alerts` (set via Reorder tab on each item) | **Inline "Threshold" button per row** opens a quick-edit modal; updates the reorder policy in place |

---

## 6 · Complete feature catalog

Every feature in the system, regardless of whether Mr. Arpit asked. Some come "for free" with the platform (multi-tenant, RBAC, custom fields, etc.) — they're table-stakes for any future enterprise prospect even if Nova Bond doesn't directly need them.

### 6.1 Master Data (Inventory foundation — Admin-only sidebar group)

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Items (SKU master) | ✅ | 39 Nova Bond items only (legacy purged) |
| **Item Pricing (versioned)** | ✅ | **Phase 13** — per (item × thickness × size), with valid_from/valid_until and full history |
| Brands | ✅ | Nova Bond only |
| Categories (with parent/child) | ✅ | 7 Nova Bond collections only |
| UoMs | ✅ | 22 units across 5 categories |
| UoM categories | platform | count / weight / volume / length / area |
| UoM conversions | platform | 12 conversion factors seeded |
| HSN codes per item | ✅ | Required for GST |
| Batch tracking flag per item | ✅ | All NB items batch-tracked |
| Serial tracking flag per item | platform | Available; Nova Bond doesn't use |
| Custom fields on items | platform | Tenant can extend if needed |
| Default sale price (per-item) | ✅ | Now legacy field; pricing rules supersede |
| Default GST rate | ✅ | Per item |
| Locations + bins | ✅ | |
| Status master | platform | Document statuses |
| Number series | platform | Auto-numbering for PO/SO/GRN/Invoice/etc. |
| Routes (sales territories) | ✅ | |
| Document types | platform | |
| **Item Dimensions master** | ✅ | **Phase 13** — 12 (thickness × size) combinations seeded |
| **Thickness option catalogue** | ✅ | Editable from UI via "Manage dimensions" modal — add new mm values (e.g. 6, 10, 12); deletion blocked when in-use |
| **Size option catalogue** | ✅ | Editable from UI — add new size codes (e.g. `1220x4880`) with friendly labels; deletion blocked when in-use |

### 6.2 Stock & Inventory

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Stock balances per item × location × lot | ✅ | |
| Stock movements (audit trail) | platform | Every in/out logged |
| Reservations | platform | Soft-hold for open documents |
| FIFO valuation layers | platform | Behind the scenes; backfilled from Vendor Bills |
| Lots / batches | ✅ | Mandatory on GRN; auto-created from line entry |
| Serials | platform | Code intact; sidebar entry + item-detail tab + create-form checkbox **hidden** for Nova Bond |
| Stock counts (cycle counts) | ✅ | |
| Low-stock alerts | ✅ | `/alerts` page; **per-row inline Threshold edit** updates reorder policy in place |
| Stock transfers between locations | platform | Code intact; sidebar entry **hidden** for Nova Bond (single warehouse) |
| Valuation layers viewer | platform | Admin-only post Phase 12 (cost.read) |
| Item Pricing tab on item detail | ✅ | **Phase 13 update** — read-only price grid view |

### 6.3 Documents (transactional)

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Purchase Orders (PO) | ✅ | No cost field per spec §7 |
| **Goods Receipt Notes (GRN)** | ✅ | Phase 12 — Direct + PO-backed; no cost field; thickness/size/lot capture |
| Sales Orders (SO) | ✅ | |
| Stock Transfers | platform | |
| Document state machine (draft → posted → cancelled) | platform | |
| Document line editor with lot + dimension capture | ✅ | Mandatory lot for batch-tracked; thickness+size optional but auto-fill price when set |
| Optimistic locking (version + If-Match) | platform | Prevents lost-update conflicts |

### 6.4 Sales / Billing

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Challans (delivery notes) | ✅ | With print_mode toggle |
| Challan → Invoice promotion | ✅ | |
| SO → Invoice promotion | extension | Phase 10 — mirror of challan promote |
| Invoices (tax docs with GST) | ✅ | |
| GST math (CGST+SGST vs IGST) | ✅ | Auto from state code |
| Print modes (no_amount / with_remarks) | ✅ | Per spec §8; editable inline on detail page |
| Vendor Bills | ✅ | Admin-only post Phase 12 |
| Bill ↔ Payment allocation | ✅ | |
| **Auto-fill unit price from pricing rule** | ✅ | **Phase 13** — when thickness+size picked on a line |

### 6.5 Money & Ledger

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Multi-account ledger (Cash / Bank / Cheque pending / GPay) | ✅ | Per spec §11 |
| Per-party ledger (AR / AP) | ✅ | |
| Per-employee float ledger | ✅ | Customer-paid-salesman flow. Note: the **Employees list** sits under Parties group, but the float ledger is reached from the Money group (Money → Employees) |
| Receipts (incoming payments) | ✅ | Cash / Bank / Cheque / GPay |
| Payments (outgoing) | ✅ | |
| Cheque deposit workflow | ✅ | cheque_in_transit → bank on clear |
| Payment allocation (one payment → many invoices) | ✅ | |
| Expense entry with categories | ✅ | Per spec §12 |
| Expense categories master (tenant-customisable) | ✅ | |
| Capital vs operating expense flag | ✅ | |
| Salary entries (per employee, per month) | ✅ | |
| Salary batch generate (idempotent, cron-ready) | ✅ | Per spec §11 "auto on 1st" |
| Salary batch post (atomic) | ✅ | |
| Float deduction (gross − float = net) | ✅ | Closes the salesman-collection loop |
| Payslips (printable, A4 layout) | extension | |

### 6.6 Reports

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Sales register | ✅ | |
| Purchase register | ✅ | |
| Debtors aging | ✅ | |
| Creditors aging | extension | Mirror of debtors |
| P&L statement | extension | Cost data sourced from Vendor Bills (Phase 12) |
| Cash flow statement | extension | Direct method |
| Stock valuation | platform | |
| GSTR-1 JSON export | extension | |
| GSTR-3B JSON export | extension | |
| CSV export on every report | platform | |

### 6.7 Operations

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Bulk CSV imports (items / parties / stock / opening balances) | platform | Day-1 unblocker |
| Period close (ledger lock) | implied | After CA sign-off |
| Audit log viewer | platform | Every action recorded |
| Custom fields | platform | |
| Workflows | platform | |

### 6.8 Identity & access (RBAC permission model)

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Multi-tenant | platform | Multiple companies on one install |
| RBAC (role-based access control) | implied | "Other than admin..." |
| 3 default roles (Admin / Operator / Viewer) | extension | |
| Per-tenant role customisation | platform | |
| **Cost vs Financials vs Master Data permission split** | ✅ | **Phase 12 + post-Phase-13** — three independent gates |
| Module subscriptions | platform | |
| User invite + password reset | platform | |
| Optimistic JWT auth + refresh rotation | platform | |

### 6.9 UX foundation

| Feature | Required by Arpit? | Notes |
|---|---|---|
| Mobile-responsive layout | implied | Phase 11 |
| Daily-flow sidebar order | implied | Reorganised so action items are at top, setup data at bottom |
| Consistent page spacing | implied | Money pages now match Items/Balances `p-4 md:p-5 space-y-4` pattern |
| Dark mode tokens | platform | Theme system in place |
| Branding (logo, name, support email) | platform | Tenant-configurable |
| Demo mode (in-memory fixtures) | dev | Sales + design iteration |

### 6.10 Deferred (not built — spec'd for later)

| Feature | Why deferred |
|---|---|
| NIC e-Invoice / IRN integration | Needs GSP credentials + per-tenant API key + retry queue |
| NIC e-Way Bill auto-generation | Same infrastructure + transport details on challan |
| Direct GSTN portal upload | Needs GSP relationship; CSV/JSON download works as interim |
| GSTR-9 annual return | January 2027 filing; future |
| Trial balance / Balance sheet | Needs equity accounts modelled |
| Notifications / email (payslip-by-email, low-stock, payment reminders) | Needs notification infra |
| Production / manufacturing module | If Nova Bond starts producing in-house, becomes relevant |
| Multi-currency consolidation | Single-currency (INR) sufficient today |
| Cron-driven salary auto-debit | Endpoint built; cron wiring is a backend job |
| Server-side PDF rendering | Browser print works; PDF service when volume justifies |
| Cost-side versioning (item_cost_rules) | Pricing rules are sale-side; cost still lives on Vendor Bills |
| Tier-based pricing (per-customer price lists) | Single price list today |

---

## 7 · How to navigate the system

### Admin sidebar (Mr. Arpit) — by daily-flow priority

```
Dashboard
─────────────────
Sales              (Challans · Invoices · Sales Orders)
Purchases          (Goods Receipts · Vendor Bills · Purchase Orders)
Money              (Overview · Debtors · Receipts · Payments · Cheques ·
                    Expenses · Salary · Payroll Batch · Accounts)
Inventory          (Items · Stock Balances · Lots · Stock Counts ·
                    Locations & Bins · Low Stock Alerts · Reservations ·
                    Valuation Layers · Attachments · Movements)
Parties            (Customers & Vendors · Employees)
─────────────────
Reports            (Overview · Sales register · Purchase register ·
                    Debtors aging · Creditors aging · P&L · Cash flow ·
                    GSTR-1 · GSTR-3B)
─────────────────
Master Data        (Item Pricing · Brands · Categories · UoMs ·
                    UoM Categories · UoM Conversions · Document Types ·
                    Status Master · Number Series)
Admin              (Users · Roles · Permissions · Bulk imports ·
                    Period close · Audit log · Settings)
```

> **Hidden but kept in code** — Serials and Transfers nav entries are commented out in `sidebar.tsx`. Nova Bond's ACP is batch-tracked (lots, not serials) and runs a single warehouse, so neither surface is useful today. Un-comment to re-enable for a tenant that needs them.

### Operator sidebar (Warehouse staff) — auto-filtered by permissions

```
Dashboard
─────────────────
Sales              (Challans · Sales Orders — Invoices hidden)
Purchases          (Goods Receipts · Purchase Orders — Vendor Bills hidden)
Inventory          (Items · Stock Balances · Lots · Stock Counts ·
                    Locations & Bins · Low Stock Alerts · Reservations ·
                    Movements — Valuation Layers + Attachments hidden)
Parties            (Customers & Vendors — Employees hidden)
─────────────────
Admin              (Settings only — everything else hidden)
```

The difference: **Money, Reports, Bills, Invoices, Audit Log, Period Close, Valuation, Master Data, Bulk Imports, and all cost/amount columns disappear from the Operator's view.**

---

## 8 · Where to find the spec & code

### Backend specs (in `Resources/`)

For the backend dev to implement when ready:

- `PHASE3_BACKEND_SPEC.md` — Money / Ledger / Payments
- `PHASE3_5_BACKEND_SPEC.md` — Vendor Bills / Expenses / Salary
- `PHASE4_BACKEND_SPEC.md` — Reports core
- `PHASE5_BACKEND_SPEC.md` — GSTR + Period Close
- `PHASE6_BACKEND_SPEC.md` — Salary batch + Payslip
- `PHASE7_BACKEND_SPEC.md` — Bulk imports
- `PHASE8_BACKEND_SPEC.md` — Cash flow
- `PHASE9_BACKEND_SPEC.md` — Audit log
- `PHASE10_BACKEND_SPEC.md` — SO → Invoice promotion
- **`PHASE12_BACKEND_SPEC.md`** — Cost/Financials split + GRN→Bill matching ⭐
- **`PHASE13_BACKEND_SPEC.md`** — Item Dimensions + Versioned Pricing ⭐
- `INVOICE_BACKEND_SPEC.md`, `CHALLAN_BACKEND_SPEC.md` — earlier billing

### Source files (in `frontend/src/`)

- `lib/demo/fixtures.ts` — All seeded data (tenant, items, parties, ledgers, audit log, **22 UoMs, 18 pricing rules, 12 dimensions**)
- `lib/demo/adapter.ts` — Demo-mode API adapter (~2400 LOC)
- `services/*.ts` — One file per resource (items, bills, salary, reports, **pricing**, etc.)
- `app/(dashboard)/**/page.tsx` — All dashboard pages
- `components/ui/cost-mask.tsx` — The `<CostMask>` / `<FinancialsMask>` wrappers (Phase 12)

### Outstanding requests for backend

Open the file `frontend/changes_required.txt` for the running list of backend changes requested. **17 REQ entries** so far — each maps to a Phase spec.

---

## 9 · Recent changes since the first edition

> Newest at the top. Older Phase 12/13 entries kept for context.

### Editable thickness & size catalogues *(May 5)*
- Master Data → Item Pricing now has a **"Manage dimensions"** button + modal
- Add a thickness in mm (e.g. `6`, `10`, `12`) → instantly available on every line form, pricing rule, and report
- Add a size by code + label (e.g. `1220x4880` / "1220 × 4880 mm (4×16 ft)")
- Removal blocked while any pricing rule references the option (clear error toast — no orphaned history)
- Backed by new `/pricing-dimension-options/{thickness,size}` endpoints + `pricingService.{addThicknessOption,removeThicknessOption,addSizeOption,removeSizeOption}`
- Both consumers (Master Data Item Pricing page + the Pricing tab on item detail) now read from `useQuery` instead of hardcoded arrays — the matrix grid auto-grows when a new option is added

### Discoverable "Add price rule" *(May 5)*
- Primary **+ Add price rule** button in the page header AND in the empty-state action
- Modal supports an **item picker** when invoked without an item filter; locked to a fixed item when invoked from an existing row
- Title flips between "Add price rule" / "Add price for {item}" / "Update price — {item}" based on context
- Save button now disabled until both an item is picked and a positive sale price is entered

### Party types expanded — 3 → 5 *(May 4)*
- Added **Vendor** (services / IT) and **General Person** to the existing Customer / Supplier / Both
- 5 distinct colour-coded badges across `/parties` and party detail
- Filter dropdown extended; party form `party_type` select extended

### Employees moved under Parties *(May 4)*
- Sidebar entry relocated from Money → Parties group (employees are *people*, not money)
- Underlying URL `/money/employees` unchanged for back-compat
- Money group is now: Overview · Debtors · Receipts · Payments · Cheques · Expenses · Salary · Payroll Batch · Accounts (no Employees)
- Parties group is now: Customers & Vendors · Employees

### Raniac Technologies vendor seed *(May 4)*
- First IT vendor `VEN-IT-001` (Raniac Technologies) seeded in fixtures.PARTIES
- Pattern for Mr. Arpit to add other service vendors (CA firm, software vendors, etc.)

### Inline threshold edit on Low-Stock Alerts *(May 4)*
- "Threshold" button per row on `/alerts` opens a quick-edit modal
- Updates the reorder policy in place via `itemService.updateReorderPolicy`
- Item detail page also got full CRUD on the Reorder tab (was read-only)

### Serials & Transfers hidden *(May 4)*
- Serials nav entry, item-detail Serials tab, and item-create form's "Enable serial-number tracking" checkbox all **hidden** (commented, not deleted)
- Transfers nav entry hidden — Nova Bond runs a single warehouse
- Re-enable any of them by un-commenting the relevant block when a tenant grows into them

### Movements pushed to last *(May 4)*
- Within the Inventory group, **Movements** sits at the very bottom — it's a forensic / read-only audit trail, not a daily-flow surface

### Demo adapter persistence fixes *(May 3)*
- POST `/documents` now persists with auto-numbering (`GRN-00001`, `SO-00001`, etc.) — fixes "Add line" failing after creating a new GRN/SO
- POST/PATCH/DELETE `/parties` now persist — fixes Add Vendor form silently failing
- Lots de-dupe by `(item_id, lot_number)` so multiple GRNs against the same lot append rather than create duplicates

### Money pages spacing *(May 3)*
- All 11 list/dashboard Money pages re-padded to match Items/Balances
- Removed `max-w-7xl mx-auto` centering that caused big margins on wide screens
- Same fix later applied to Invoice + Bill detail pages

### UoM expansion *(May 2)*
- 6 → 22 UoMs across 5 categories (added Length + Area)
- 2 → 12 conversion factors

### Legacy data purge *(May 2)*
- All non-Nova Bond items, brands, categories, lots, serials, balances, attachments removed
- `/items` shows ONLY 39 NB-* items
- `/master-data/brands` shows ONLY Nova Bond
- Fixes empty-list confusion when filtering by a removed legacy entity

### Master Data tightening *(May 1)*
- All Master Data entries now require `inventory.master_data.read` (Admin-only)
- Operator never sees the Master Data sidebar group
- Underlying read perms (brands/categories/uoms) stay granted so item rows still render

### Sidebar reorganisation *(May 1)*
- Order changed from "setup-first" to "action-first"
- Documents + Billing groups dissolved; merged into Sales + Purchases
- Stock Counts moved from Operations into Inventory
- Master Data pushed from #2 to second-to-last
- Money group reordered with Debtors near top (most-checked-daily)

### GRN flow upgrades *(Apr 30)*
- "Direct receipt (no PO)" mode for phone-deal arrivals
- "Source PO" link on GRN list with "Direct" badge
- Lot/batch number capture mandatory at line entry for batch-tracked items
- Auto-create Lot record from GRN line (no manual `/items/lots/new` needed)
- Manual "Add Lot" button removed entirely from `/items/lots`

### Phase 13 — Item Dimensions + Versioned Pricing (REQ-17) *(Apr 29)*
- 12 thickness × size combinations seeded (4 mm × 3 sizes; now extensible from UI)
- Versioned pricing rules per (item × dimension) with `valid_from` / `valid_until`
- New admin page `/master-data/item-pricing` with grid view + history
- Line forms (GRN/SO/Challan) get Thickness + Size dropdowns + auto-fill unit price
- New "Pricing" tab on item detail page showing the price grid
- Old invoices keep snapshotted prices; rule changes only affect new lines

### Phase 12 — Cost & Financials split (REQ-16) *(Apr 28)*
- Three permission gates: `cost.read`, `financials.read`, `master_data.read`
- GRN form strips cost; Vendor Bills become Admin-only; cost back-fills via bill posting
- "GRNs pending bill" KPI flags unbilled receipts on Admin dashboard
- Operator now sees zero money on screen

### Print mode toggle *(Apr 28)*
- Inline 2-button toggle on Challan detail page (No amounts / With amounts)
- Saves immediately via PATCH on click

---

## 10 · One-line summary

**Mr. Arpit's brief asked for an Indian small-business OS where the warehouse operator only sees physical events and the owner sees everything financial. That's exactly what's built — plus a versioned pricing engine for thickness×size variants, a two-stage cost flow (Operator records receipt, Admin records bill), and 30+ platform features (RBAC, custom fields, audit log, multi-tenant) that come for free and are useful when Nova Bond grows or when this product is sold to a second client.**
