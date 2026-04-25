# Workflow — Viewer (Read-Only Stakeholder)

A workflow guide for users who need visibility into inventory but should never change anything. Auditors, finance, executives, external consultants, account managers.

> See also: [USER_MANUAL.md](USER_MANUAL.md) for screen-by-screen reference.

---

## Who you are

You're a stakeholder who needs to **see** what's happening in inventory without the risk of breaking anything. You might be:

- An **internal auditor** verifying counts and movements.
- A **finance team member** tracking inventory value and COGS.
- An **executive** wanting dashboards and trends.
- An **external consultant** brought in for an engagement.
- A **manager** doing oversight without operational responsibilities.

When you sign in, your JWT carries `tenant_id: <your tenant>`, `is_super_admin: false`, and a permission set that includes **every read permission** in inventory and zero write permissions.

You can browse, filter, sort, and export. You **cannot** create, edit, post, cancel, delete, or reset anything.

---

## What this guide covers

The lens you'll typically look through:

1. [Daily / weekly check-in routine](#workflow-1--daily-routine)
2. [Inventory valuation review (finance)](#workflow-2--inventory-valuation-review)
3. [Audit trail walkthrough](#workflow-3--audit-trail-walkthrough)
4. [Stock movement investigation](#workflow-4--stock-movement-investigation)
5. [Document review (open + posted)](#workflow-5--document-review)
6. [Stock count outcome review](#workflow-6--stock-count-outcome-review)
7. [Master data and configuration audit](#workflow-7--master-data-and-configuration-audit)
8. [Exporting data for analysis](#workflow-8--exporting-data-for-analysis)

---

## Workflow 1 — Daily routine

**Trigger:** Start of your day / week.

### Steps

1. **Sign in** → land at `/dashboard`.
2. Glance at the four KPI cards:
   - **Inventory value** — compare to your mental anchor / yesterday's number. Major drops are a flag.
   - **Items in stock** — distinct active SKUs.
   - **Draft documents** — count of unposted POs/SOs.
   - **Stock counts** — open count sessions.
3. Scroll to **Recent movements** — what's happening on the floor.
4. Sidebar → **Low Stock Alerts** — items below reorder threshold (raise to admin if critical).

### What you conclude in

- An at-a-glance pulse of the operation.
- A short list of things that look unusual to ask about.

---

## Workflow 2 — Inventory valuation review

**Trigger:** End-of-month close, finance review, or audit prep.

### Steps

1. Sidebar → **Stock Balances**.
2. Look at the **Inventory value** KPI card at top.
3. Sort the table by **Value** descending — see your highest-value SKUs first.
4. Check `qty_on_hand` × current FIFO unit cost roughly matches the displayed `value` for each row.
5. Sidebar → **Valuation Layers** — for any high-value item that looks off:
   - Filter by item.
   - See every FIFO layer (date created, qty remaining, unit cost).
   - Layers should be in chronological order; oldest layers should have the smallest remaining qty (because OUT movements consume oldest first).
6. Cross-reference with your accounting system's inventory asset balance.

### What you conclude in

- Confidence (or concern) that on-system inventory value matches the balance sheet.
- A list of variances to discuss with the admin.

### Common findings

| Finding | Likely explanation |
| --- | --- |
| FIFO unit costs all the same | Single supplier, single PO history. Normal. |
| One item has a huge value disparity | A PO was posted at a wrong unit cost. Worth flagging. |
| Negative inventory value | Should be impossible. If you see it, escalate immediately. |
| Stale layers (5+ years old) | Slow-moving inventory. Question whether this is dead stock. |

---

## Workflow 3 — Audit trail walkthrough

**Trigger:** You need to verify "who did what when" for a specific event — auditor request, internal investigation, dispute resolution.

### Steps

#### A. Find the affected entity

Depends on what you're investigating:

- **Stock disappearance** → Sidebar → **Movements**.
- **Document concern** → **Documents** (or `/documents/all`).
- **Count concern** → **Stock Counts**.
- **User access concern** → **Admin → Users** (read-only access shows you who exists, when created, last login).

#### B. Filter narrowly

Use the table toolkit:

- **Date range** filter on the date column.
- **Item / Party / Location filter** to scope to one entity.
- **User filter** if you know who you're investigating.
- Click each row to drill into details.

#### C. Cross-reference with documents

Each movement has a "source" — usually a document number. Click through to the document, see its full history.

For posted documents, the detail page shows:
- Document number, date, party.
- All lines with quantities and costs.
- Posting timestamp.
- Cancellation timestamp (if cancelled).

#### D. Check user audit (when available)

The audit log tracks all sensitive actions:
- Password resets (`ADMIN_RESET_PASSWORD`).
- Role assignments (`ROLE_ASSIGNED`, `ROLE_REVOKED`).
- User activations / deactivations.

UI access to the audit log is currently limited; you may need to ask the admin to extract specific entries from the database.

### What you conclude in

- A complete picture of who did what, when, and why.
- A documentable answer for the auditor request / investigation.

---

## Workflow 4 — Stock movement investigation

**Trigger:** Something looks wrong on a specific item. "We should have 100 of SKU-X but the system says 50."

### Steps

1. Sidebar → **Movements**.
2. **Filter** by `item_id = SKU-X`.
3. Sort by `posting_date` descending (newest first).
4. Walk through every movement:
   - Direction (IN / OUT)
   - Quantity
   - Source location (where it came from / went to)
   - Source description (which document or what manual reason)
   - The user who posted it
5. Sum: starting qty + Σ(IN qtys) − Σ(OUT qtys) should equal current `qty_on_hand`.
6. If the math is right, the system is correct — physical reality is wrong (run a count).
7. If the math is wrong, escalate immediately — it suggests a data integrity issue.

### What you conclude in

- One of three answers:
  - "Movements explain the qty — physical count is wrong." → Recommend a stock count.
  - "Movements don't explain the qty — system has an integrity issue." → Escalate to admin / Raniacone support.
  - "Movements show a manual write-off / adjustment without proper authorization." → Investigate the user who posted it.

---

## Workflow 5 — Document review

**Trigger:** Reviewing how the team is using POs/SOs/TRNs. Looking for patterns, anomalies, or specific documents.

### Steps

#### A. Open the right list

- All documents → `/documents/all`.
- POs only → `/documents/purchase-orders`.
- SOs only → `/documents/sales-orders`.
- Transfers → `/documents/transfers`.

#### B. Filter / sort

- Date range — typical: last 30 days.
- Status — Draft / Submitted / Approved / Posted / Cancelled.
- Party — drill into one supplier or customer.

#### C. Open individual documents

Click into any document to see:
- Header (number, date, party, status).
- Lines (each item, qty, unit cost).
- Posting / cancellation history.

You can use the **Print** button to generate a formatted version for offline review.

### What you conclude in

- An understanding of recent activity.
- A list of documents to discuss (e.g. "this PO has unusually high unit costs", "this SO was cancelled twice — why?").

---

## Workflow 6 — Stock count outcome review

**Trigger:** A count was applied. You want to verify the corrections were reasonable.

### Steps

1. Sidebar → **Stock Counts**.
2. Filter by Status = Applied (or Date range).
3. Open the count.
4. **Variances tab** — every variance that the count surfaced:
   - System on-hand → counted → variance.
5. **Movements** generated by the count: each variance produced an IN or OUT correction movement.
6. Click into individual variances. Look for:
   - Patterns (always positive variance for one item? always negative for another?).
   - Magnitude (small variances are normal; large ones suggest theft or process issues).

### What you conclude in

- Confidence in count accuracy.
- A short list of items with persistent variance to investigate (theft? process gap? bad receiving habits?).

### Red flags

- Same item shows a large negative variance every count → systematic loss. Investigate.
- Same item shows a large positive variance → either receiving isn't being posted, or count methodology is wrong.
- Counts being skipped → schedule was let slide.

---

## Workflow 7 — Master data and configuration audit

**Trigger:** Periodic governance review. "Are our master tables in good shape?"

### Steps

1. Sidebar → **Master Data**, walk each sub-page:
   - **UoM Categories** + **UoMs** + **UoM Conversions** — sanity check the conversion factors. A wrong factor anywhere causes silent costing errors.
   - **Brands** + **Categories** — looking for orphaned or duplicate entries.
   - **Number Series** — confirm prefixes and starting numbers are reasonable.
   - **Document Types** — each should be linked to a number series.
2. Sidebar → **Settings**:
   - **Tenant Configuration** — verify timezone and base currency.
   - **Module Configuration** — review each setting and its current value.
3. Sidebar → **Admin → Users** (read access only) — check active vs inactive users; flag anyone who shouldn't have access.
4. Sidebar → **Admin → Roles** — verify role definitions; flag overly-permissive custom roles.
5. Sidebar → **Admin → Permissions** — read-only reference; useful to understand what a role grants.

### What you conclude in

- A governance checklist with notes.
- Recommendations to admin (you can't make changes; you can suggest them).

---

## Workflow 8 — Exporting data for analysis

**Trigger:** You want to slice data outside the app — Excel pivot tables, Power BI dashboards, custom reports.

### Steps

The app currently has limited export functionality (varies per page):

- **Items** page → **Export** button at top right (downloads currently filtered list).
- Other pages → use browser print-to-PDF or screenshot for now.
- For full data extracts, ask the admin (they can request a database extract from Raniacone support if needed).

### What you conclude in

- Local CSV/PDF copies of the data for offline analysis.
- Clear understanding of what's available via the UI vs what needs an admin/support ticket.

---

## What you cannot do

You're read-only by design. Don't try to:

| You cannot | Why |
| --- | --- |
| Create / edit / delete items, parties, locations, master data | These are write actions; your role lacks the permission. |
| Post or cancel documents | Same. |
| Apply a stock count | Same. |
| Reset another user's password | Same. |
| Approve a document waiting on someone | Same. |

If you find yourself wanting to do any of the above, that's the cue to **flag it to your admin** rather than to ask for elevated permissions. Read-only is a feature, not a limitation — it's why your stakeholders trust you to investigate without risking damage.

---

## Common mistakes viewers make (and how to avoid)

| Mistake | Avoid by… |
| --- | --- |
| Treating draft documents as final | Always check the **Status** column. Drafts are intentions, not facts. |
| Misreading qty_available vs qty_on_hand | Read the Glossary. They mean very different things. Available is on-hand minus reservations. |
| Trusting a single number | Cross-check Balance vs Movements. If they don't reconcile, something's wrong. |
| Skipping the Variances tab on counts | Variances tell you the actual story of what's wrong. The applied count itself is just the resolution. |
| Forgetting the timezone | All dates display in the tenant's configured timezone. Don't compare dates across timezones manually. |

---

## Daily / weekly checklist

| Cadence | Action |
| --- | --- |
| Daily (skim) | Dashboard → KPI sanity check. Recent Movements for anything large or unusual. |
| Weekly | **Stock Balances** sorted by Value desc — top 20 items. **Documents** filter Status=Posted, last 7 days. |
| Monthly | Full **Valuation Layers** review for top 50 items. **Stock Counts** outcomes for the month. |
| Quarterly | Master data audit (Workflow 7). Reconcile inventory value with accounting. |

---

## Tips for new viewers

- **Learn the Glossary first** ([USER_MANUAL.md §3](USER_MANUAL.md#3-glossary--every-term-used-in-the-app)). The terms are precise — confusing "on hand" and "available" leads to wrong conclusions.
- **Always filter narrowly.** A page with 1000 rows is intimidating. Filter to 10–20 relevant rows and you'll think more clearly.
- **Use the breadcrumbs.** Click "Inventory" or "Documents" in the breadcrumb to bounce back up. Faster than the sidebar.
- **Bookmark frequent views.** If you always look at Posted POs from the last 30 days, save that URL with the filter applied — comes right back.
- **Build a relationship with the admin.** When you spot something concerning, flag it constructively. You're the second pair of eyes on operations; the admin needs you to surface issues they're too close to see.
