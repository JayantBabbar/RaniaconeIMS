# Raniacone Warehouse — User Manual

A plain-language guide for everyone who uses the system: tenant admins, warehouse operators, viewers, and platform super admins.

> Companion document: [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md) is the technical/feature reference for engineers and product owners. This manual is the *user-facing* version.

---

## Contents

1. [Welcome & first sign-in](#1-welcome--first-sign-in)
2. [Navigation guide](#2-navigation-guide)
3. [Glossary — every term used in the app](#3-glossary--every-term-used-in-the-app)
4. [Screen-by-screen walkthrough](#4-screen-by-screen-walkthrough)
5. [Common tasks](#5-common-tasks-step-by-step)
6. [Mobile usage](#6-mobile-usage)
7. [Troubleshooting](#7-troubleshooting--faq)

---

## 1. Welcome & first sign-in

### What this app is for

Raniacone is your inventory management system. It tells you, in real time:

- What stock you own
- Where each item physically sits
- What's coming in (purchase orders) and going out (sales orders, transfers)
- How much it's worth (FIFO costing)
- Who did what, when (every action is auditable)

### Signing in

1. Go to your company's Raniacone URL (your admin will share it).
2. Enter your **email** and **password**. Both are case-sensitive.
3. Click **Sign in**.

If you're signing in for the very first time:
- Your admin will have given you a **temporary password**.
- After signing in, immediately go to **avatar (top-right) → Change password** and set one only you know.

### What you'll see depends on your role

The app shows different sections depending on whether you're a:

- **Platform Super Admin** — manages the platform itself, sees the dark "Platform" sidebar
- **Tenant Administrator** — full access inside one company workspace
- **Employee (Operator / Viewer / custom role)** — a narrower sidebar, fewer buttons

If you don't see something this manual mentions, you probably don't have permission for it. That's by design — talk to your admin if you think you need access.

### "Forgot password?"

The app does **not** send password-reset emails. If you forget your password:

1. Contact your administrator.
2. They'll set a new password for you (admin-initiated reset).
3. They'll share it with you securely.
4. Sign in with the new password and immediately change it via **avatar → Change password**.

---

## 2. Navigation guide

### The frame: what's where on the screen

Every page has the same layout:

```
┌──────────┬───────────────────────────────────────────┐
│          │  ☰   Inventory > Items                  🔔 👤│   ← TopBar
│          ├───────────────────────────────────────────┤
│ Sidebar  │                                           │
│  (links) │           Main content area               │
│          │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

**TopBar (top of every page):**

- **☰ hamburger** (mobile only) — opens the sidebar drawer.
- **Breadcrumbs** — path to the current page. Click any non-final crumb to jump back. The last crumb is the page you're on.
- **Right-side action buttons** — page-specific (e.g. "+ New item").
- **🔔 bell** — notifications (placeholder; not active yet).
- **👤 avatar** — opens a menu with **Change password** and **Sign out**.

**Sidebar (left side):** lists every section you have access to. Collapsible on desktop (button at the bottom). On mobile it slides in from the left when you tap ☰.

### Sidebar groups (tenant admin / employee view)

| Group | Sections inside |
| --- | --- |
| **Dashboard** | A single landing page with KPIs. |
| **Master Data** | Status Master, Number Series, UoM Categories, UoMs, UoM Conversions, Brands, Categories, Document Types. |
| **Inventory** | Items, Lots, Serials, Locations & Bins, Stock Balances, Movements, Reservations, Valuation Layers, Low Stock Alerts, Attachments. |
| **Documents** | Purchase Orders, Sales Orders, Transfers. |
| **Operations** | Stock Counts, Parties. |
| **Admin** | Users, Roles, Permissions, Settings. |

### Sidebar groups (super admin view)

| Group | Sections inside |
| --- | --- |
| (none) | Platform Overview |
| **Customers** | Tenants, Platform Users |
| **Platform Data** | Currencies |
| **Operations** | System Health |

---

## 3. Glossary — every term used in the app

These are the terms you'll encounter throughout. Skim once now; come back when something looks unfamiliar.

### People & Access

- **Tenant** — your company's workspace. Every record (item, document, user) belongs to exactly one tenant. Tenants don't share data.
- **Super Admin** — a Raniacone employee who can manage the platform itself. They don't usually appear inside customer workspaces.
- **Tenant Administrator** — the most senior user inside your tenant. Has every permission.
- **Operator** — a regular employee. Can record stock movements, post documents, perform counts. Can read most things, write the operational stuff. Cannot manage users or master data.
- **Viewer** — read-only across the inventory module. Used for stakeholders who need visibility without risk (auditors, finance, executives).
- **Role** — a named bundle of permissions. "Operator" is a role. You can create new ones with custom permissions.
- **Permission** — a single granular capability. Codes follow `<module>.<resource>.<action>` — e.g. `inventory.items.write` lets you create/edit items.
- **RBAC** — short for "Role-Based Access Control". The mechanism by which roles → permissions → user capabilities flow.

### Items & Catalog

- **Item / SKU** — a single product or material you stock. SKU stands for "Stock-Keeping Unit". An item has a unique code, name, and base unit.
- **Item Type** — categorisation of how an item behaves (Product, Service, Asset, Consumable, etc.). Doesn't affect costing logic but drives reports.
- **Brand** — the manufacturer or label. Items can optionally have a brand tag.
- **Category** — a hierarchical grouping (Electronics > Phones > Smartphones). For browsing and reporting.
- **Identifier** — alternative codes for the same item — barcode, supplier SKU, manufacturer part number. Multiple per item.
- **Variant** — child SKUs that share a parent item with attribute differences (size, colour). Each variant is its own item record but linked via parent_item_id.

### Units of Measure

- **UoM (Unit of Measure)** — the unit you measure an item in: each, kg, gram, litre, box, carton.
- **Base UoM** — the fundamental unit for an item. All inventory math happens in this unit. You pick this when creating the item.
- **UoM Category** — a group of compatible units. You can convert *within* a category (kg ↔ g) but not *across* (kg ✗ litre). Standard categories: Count, Weight, Length, Volume, Time.
- **UoM Conversion** — the factor between two UoMs in the same category. "1 box = 12 each", "1 kg = 1000 g". Multi-step conversions chain automatically.

### Stock & Tracking

- **Lot / Batch** — a group of units that share a manufacturing run, expiry date, or quality cohort. You enable lot-tracking on items where it matters (food, pharmaceuticals, chemicals).
- **Serial** — a unique identifier for a single unit. You enable serial-tracking on items where each unit must be traceable individually (laptops, equipment with warranties).
- **Lot expiry** — the date a lot becomes unusable. Drives FEFO picking and expiry alerts.
- **Status Master** — your list of allowed status values for items, parties, and documents. Lets you tailor lifecycle vocabulary.

### Locations

- **Location** — a physical place stock can sit: a warehouse, a zone within a warehouse, a third-party fulfilment site. Locations form a tree.
- **Bin** — a sub-location within a location. A specific shelf, rack, or cell. Optional but handy for large warehouses.
- **Address** — the postal address of a location.

### Money

- **Base currency** — the currency your tenant operates in. Set when your tenant was provisioned. All values stored and reported in this currency.
- **Currency** — an ISO 4217 code (USD, EUR, INR, GBP, JPY, etc.). The platform pre-seeds all standard currencies; super admin manages the catalog.
- **Unit cost** — the price you paid per unit on a receipt (PO line). Drives FIFO valuation.

### Costing & Valuation

- **FIFO (First-In-First-Out)** — costing method where the *oldest* receipt cost is consumed first when stock leaves. Default in this system.
- **FEFO (First-Expired-First-Out)** — picking strategy where the lot closest to expiry leaves first. Used for batch-tracked items.
- **Valuation layer** — a FIFO entry — a quantity at a unit cost, with a creation date. Each IN movement creates a new layer; each OUT movement consumes oldest layers first.
- **COGS (Cost of Goods Sold)** — the sum of valuation-layer costs consumed by an outbound movement. Reported on sales orders after posting.

### Stock movement & balance

- **Stock balance** — how much of an item is at a location right now. The ledger of truth.
- **On hand** — the physical quantity present.
- **Reserved** — soft-held for an open document. Subtracted from available.
- **Available** — `on hand − reserved`. The number to commit against when deciding "can I sell more?"
- **Movement** — a single atomic stock change. Immutable. Every receipt, issue, transfer, adjustment creates one or more.
- **Direction** — a movement is either **IN** (adds stock) or **OUT** (removes stock).
- **Reservation** — a placeholder claim on stock. When a sales order is approved, its quantities become reservations until the OUT movement is posted.

### Documents

- **Document** — the human-facing wrapper for a stock-affecting transaction. Most stock movements come from posting a document.
- **PO (Purchase Order)** — inbound. You're buying from a supplier. Posting it creates IN movements at the supplier's invoice cost.
- **SO (Sales Order)** — outbound. You're selling to a customer. Posting it creates OUT movements at FIFO cost.
- **TRN (Transfer)** — internal. Moving stock from one of your locations to another. Posting creates paired OUT (source) and IN (destination) movements at the same cost.
- **RTV (Return to Vendor)** — outbound to supplier. Posting reverses an earlier IN.
- **Document line** — a single item on the document. Each line has item, UoM, quantity, unit cost.
- **Header** — the top-level document record (number, date, party, status).
- **Status** — where the document is in its lifecycle (Draft, Submitted, Approved, Posted, Cancelled).
- **Posting** — the moment a document's stock effects become real. Irreversible. Cancellation creates *reversal* movements but the original document and movements stay in the audit trail.
- **Number series** — the auto-numbering rule for a document type (e.g. "PO-2026-0001"). Defined in master data.
- **Document type** — the category (PO, SO, TRN). Each type links to a number series.

### Parties (people you trade with)

- **Party** — the unified directory of customers and suppliers. A single party can play both roles (a vendor that's also a customer). Each party has addresses, contacts, payment terms.
- **Customer** — a party you sell to.
- **Supplier / Vendor** — a party you buy from.

### Counts & Adjustments

- **Stock count (stocktake / cycle count)** — a periodic physical inventory check. Floor staff walk the location and record actual quantities. The system surfaces variances vs the on-hand number.
- **Variance** — the difference between counted quantity and system on-hand quantity.
- **Apply** — the action that converts an approved count into correction movements. Irreversible — the counts page warns about this before you click.

### Operations & Workflows

- **Workflow** — a state machine for documents (or other entities). Defines states (Draft → Submitted → Approved → Posted) and which permissions are required to make each transition.
- **Custom field** — an extra attribute you define for items, parties, documents, etc. Six types: text, number, date, boolean, select (dropdown), JSON.
- **Reorder policy** — per-item rule that triggers a low-stock alert when quantity available falls below a threshold. Includes a reorder point and target reorder quantity.
- **Low Stock Alert** — an item flagged because its `qty_available` dropped below the reorder point.
- **Master Track** — informal term sometimes used to refer to the Master Data section as a whole. Equivalent to "the master tables" or "reference data".

### Settings

- **Tenant Configuration** — workspace-wide settings (timezone, fiscal year, default currency override).
- **Module Configuration** — per-module knobs (FIFO vs Average costing, allow negative stock, etc.).
- **Integration** — a connection to a third-party system (Slack, Teams, ERP, accounting software).
- **Webhook** — an outbound HTTP POST sent when a specific event fires. Configured per integration.
- **Import** — bulk-upload of records from a CSV/Excel file (items, parties, balances).

### Technical (you'll occasionally see these)

- **JWT** — the signed token your browser holds after login. Carries your user id, tenant, and permissions. Refreshed automatically every ~15 minutes.
- **API** — the service the frontend talks to. Two of them: auth (port 8000) and inventory (port 8001).
- **Demo mode** — a special build that simulates the backend in browser memory. Used for previews. You'll see an amber banner if it's active.

---

## 4. Screen-by-screen walkthrough

### 4.1 Dashboard (`/dashboard`)

Lands here after sign-in (tenant admin / employee).

**What it shows:**
- 4 KPI cards: Inventory value, Items in stock, Draft documents, Stock counts (clickable — each goes to its source page).
- "Recent movements" list — last 8 stock changes, with direction icon, item, location, qty, date.
- "Recent documents" list — last 8 documents, with number, date, status badge.
- "Quick actions" — buttons to create a new PO/SO/Count/Item.

**Buttons:**
- Each KPI card → clicks through to the relevant section.
- Each row in "Recent documents" → opens that document.
- Quick-action buttons → start the corresponding create flow.

### 4.2 Items (`/items`)

The catalog. Lists every product/material you stock.

**Columns:**
- **Code** — your internal SKU code. Unique per tenant.
- **Name** — human-readable name.
- **Category** — from Master Data → Categories.
- **Brand** — from Master Data → Brands.
- **Type** — Product / Service / Asset / Consumable.
- **Tracking** — badges showing Batch and/or Serial tracking.
- **Status** — Active or Inactive.
- **Actions menu** (three dots) — View / Edit / Delete.

**Top-right buttons:**
- **Import** — bulk-load items from CSV/Excel (currently a placeholder).
- **Export** — download the current filtered list.
- **+ New Item** — create one.

**Filters:**
- **Global search** — searches across code, name, category, brand simultaneously.
- **Per-column filters** — click the funnel icon next to any column header to filter just that column.
- **Multi-select** — checkboxes on the left let you select rows for bulk actions (export, delete).

### 4.3 Item detail (`/items/[id]`)

The full record for one item, with sub-tabs for everything that hangs off it.

**Sub-tabs:**
- **Overview** — basic info (code, name, brand, category, base UoM, flags).
- **Identifiers** — barcodes, supplier SKUs, manufacturer part numbers.
- **Variants** — child SKUs (size/colour variations).
- **UoMs** — alternative units this item can be received/issued in.
- **Lots** — batches of this item, if batch-tracked.
- **Serials** — unique units, if serial-tracked.
- **Reorder Policies** — low-stock thresholds.

**Buttons:**
- **Edit** — toggle the form to editable mode.
- **Save / Cancel** when in edit mode.
- **Delete** (in the action menu) — remove the item. Won't delete if it's referenced by past documents.

### 4.4 Lots (`/items/lots`)

Cross-item view of every batch in the system. Each row shows lot number, item, expiry, quantity, status (in_stock/reserved/issued/returned/scrapped), location.

**Why you'd come here:** to find expiring lots, count remaining quantities, or trace a recall.

### 4.5 Serials (`/items/serials`)

Cross-item view of every unique unit in the system. Each row shows serial number, item, status, current location, warranty period.

KPI strip at top: In Stock / Reserved / Issued / Retired counts.

### 4.6 Locations & Bins (`/locations`)

Tree view of physical stock locations.

**Buttons:**
- **+ New Location** — add a top-level location or a child.
- Per-location: **Edit**, **Add bin**, **Delete**.

**Special:**
- Each location can have a tree of bins inside it. Click a location to expand its bins panel.

### 4.7 Stock Balances (`/balances`)

The "what's where" view. One row per (item, location) combo.

**Columns:** Item, Location, On hand, Reserved, Available, Value.

**KPI cards:** Distinct items, Locations in use, Inventory value.

**Filter shortcut:** the **Only non-zero** toggle hides items where on-hand is zero (usually you want this on).

### 4.8 Movements (`/movements`)

Chronological log of every atomic stock change. Read-only — movements are never editable. To "fix" a wrong movement, post the reverse.

**Filters:** by item, location, direction, date range.

### 4.9 Movements / New (`/movements/new`)

Create a one-off direct movement. Used for adjustments and write-offs that don't flow through a document.

**Form:**
- **Direction** (IN / OUT) — two big tabs.
- **Item** — searchable select.
- **Location** — where the change happens.
- **Quantity** + **UoM** — how much.
- **Unit cost** — only for IN; what the receipt cost was. (FIFO: this becomes the new layer's cost.)
- **Lot** / **Serial** — required if the item is batch- or serial-tracked.
- **Posting date** — usually today.
- **Source** — free text (e.g. "manual adjustment", "stock count correction").

Hint at the top of the form when direction=OUT shows current `qty_available` so you don't ship more than you have.

### 4.10 Movements / Transfer (`/movements/transfer`)

A streamlined form for the common case "move N units from location A to location B". Internally creates paired OUT and IN movements.

### 4.11 Reservations (`/reservations`)

List of soft-holds against available stock. Each row: item, location, quantity, source document, status (active/released/fulfilled), expires_at.

### 4.12 Valuation Layers (`/valuation`)

The FIFO ledger. Each row: item, location, layer creation date, qty remaining, unit cost, total value.

**Why you'd come here:** to audit COGS calculations or understand exactly which layers were consumed by a sales order.

### 4.13 Low Stock Alerts (`/alerts`)

Items below their reorder threshold. Click an item to go to its detail and adjust the reorder policy.

### 4.14 Attachments (`/attachments`)

Cross-entity browser of every uploaded file.

### 4.15 Documents — list (`/documents/[type]`)

`type` can be `purchase-orders`, `sales-orders`, `transfers`, or `all`.

**Columns:** Number, Date, Type, Party, Status (Posted/Draft).

**Top-right:** **+ New {type}** button.

### 4.16 Document detail (`/documents/detail/[id]`)

The full document.

**Top section:** number, type, date, party, posting status, totals.

**Lines table:** one row per item line — item, UoM, qty, unit cost, total.

**Action buttons (depending on status):**
- **Save** (if Draft, after edits)
- **Submit** (Draft → Submitted)
- **Approve** (Submitted → Approved, if you have permission)
- **Post** (Approved → Posted) — irreversibly creates stock movements
- **Cancel** (any non-final state) — creates reversal movements if already posted
- **Print** — opens the print-optimised view at `/documents/detail/[id]/print`

### 4.17 Stock Counts — list (`/counts`)

Lists every count session.

**Top-right:** **+ New Count**.

### 4.18 Count detail (`/counts/[id]`)

Top section: count number, date, location, summary KPIs (Lines, Completed, Variances).

**Lines tab:** every item being counted. Each line has system on-hand and a "counted" input field. As floor staff fill in counts, the variance is computed live.

**Variances tab:** only the lines where counted ≠ system. Reviewed before applying.

**Apply button:** irreversible. Creates correction movements for every variance and marks the count as applied.

### 4.19 Parties (`/parties`)

Customers and suppliers in one list.

**Columns:** Code, Name, Roles (Customer / Supplier badges), Status, Created.

### 4.20 Party detail (`/parties/[id]`)

Sub-tabs:
- **Overview** — name, code, status, party group.
- **Addresses** — billing, shipping.
- **Contacts** — names, emails, phones.

### 4.21 Master Data screens

All follow the same pattern: list view with **+ New** button + edit/delete actions.

| Screen | What it manages |
| --- | --- |
| **Status Master** | Custom statuses (e.g. "On Hold", "Discontinued"). |
| **Number Series** | Auto-numbering rules for documents. |
| **UoM Categories** | Compatible-unit groupings. |
| **UoMs** | Individual units (each, kg, box…). |
| **UoM Conversions** | Factors between units. |
| **Brands** | Brand names. |
| **Categories** | Hierarchical product taxonomy. |
| **Document Types** | PO/SO/TRN/etc. and their number series. |

### 4.22 Admin → Users (`/admin/users`)

The user list inside your tenant.

**Columns:** Name, Email, Roles, Status (Active/Inactive), Last Login.

**Top-right:** **+ Invite User** opens a modal asking for email + name + temp password.

**Actions menu (per row):** View, Edit, Reset password, Activate/Deactivate, Delete.

### 4.23 User detail (`/admin/users/[id]`)

Top: avatar, name, email, status badges.

**Roles panel:** the user's currently-assigned roles. Add/remove from here.

**Topbar buttons:**
- **Reset password** — admin-initiated reset (described in §5.G).
- **Activate / Deactivate** — toggles `is_active`.

### 4.24 Admin → Roles (`/admin/roles`)

The roles configured for your tenant.

### 4.25 Role detail (`/admin/roles/[id]`)

A grid of every permission with a checkbox per role. Toggle a checkbox to grant or revoke. Changes save immediately.

### 4.26 Admin → Permissions (`/admin/permissions`)

Read-only reference. Browse the entire permission catalog grouped by module + resource. Permissions are colour-coded by action: blue (read), green (create), amber (update), red (delete).

### 4.27 Settings — sub-pages

Each settings sub-page is a list view + create/edit modals.

- **Custom Fields** — define extra fields per entity type.
- **Imports** — bulk-upload manager (placeholder).
- **Integrations** — third-party connectors.
- **Webhooks** — outbound HTTP-POST subscriptions per integration.
- **Module Configuration** — knobs per module.
- **Tenant Configuration** — workspace-wide settings.
- **Workflows** — state machines for documents.

### 4.28 Account → Change Password (`/account/change-password`)

Self-service password change. Requires current password + new password + confirm.

### 4.29 Platform → Overview (`/platform/overview`) — *super admin only*

Cross-tenant rollup KPIs.

### 4.30 Platform → Tenants (`/platform/tenants`) — *super admin only*

The list of every customer.

**Top-right:** **+ New Tenant** — full provisioning form.

**Per-row actions:** Open, Edit, Delete.

### 4.31 Platform → Tenant detail (`/platform/tenants/[id]`) — *super admin*

Tenant info card + "Users in this tenant" panel. Each user row has an action menu including **Reset password**.

### 4.32 Platform → Users (`/platform/users`) — *super admin only*

Cross-tenant user directory.

**Per-row action menu:** Open tenant, Reset password, Remove.

### 4.33 Platform → Currencies (`/platform/currencies`) — *super admin*

Read-only browser of the ISO 4217 catalog.

### 4.34 Platform → System Health (`/platform/health`) — *super admin*

Live monitoring dashboard.

---

## 5. Common tasks (step-by-step)

### A. Create a new item

1. Sidebar → **Items** → top-right **+ New Item**.
2. Fill in:
   - **Code** (must be unique).
   - **Name**.
   - **Base UoM** — pick from the dropdown. This is the unit all your stock for this item is measured in. **You cannot change it later** — pick carefully.
   - **Category**, **Brand** — optional but recommended.
   - **Item Type** — usually "Product".
   - **Batch tracked?** — tick if you need lot/expiry tracking.
   - **Serial tracked?** — tick if every unit has a unique ID.
3. **Save**. Item appears in the catalog and is now usable on documents.

### B. Receive stock via a Purchase Order

1. Sidebar → **Documents → Purchase Orders** → **+ New Purchase Order**.
2. Header:
   - **Supplier** (party).
   - **Document date** — usually today.
   - **Expected delivery location**.
3. **+ Add Line** for each item:
   - Item (search).
   - UoM (defaults to base UoM).
   - Quantity.
   - Unit cost (what the supplier is charging per unit).
4. **Save** as Draft.
5. Review. Click **Submit** when ready (may require approval depending on workflow).
6. When the truck arrives and you've checked the goods: open the PO → click **Post**.
7. Done. Stock balances updated; FIFO valuation layers written.

### C. Issue stock via a Sales Order

Same shape as B, but on `/documents/sales-orders/new`. On post, the system consumes oldest FIFO layers first and decrements `qty_on_hand`. If you've reserved insufficient stock, you'll get an `INSUFFICIENT_STOCK` error.

### D. Transfer stock between locations

1. Sidebar → **Movements → Transfer** (or **Documents → Transfers** for a multi-line transfer with audit trail).
2. Pick **From location** and **To location**.
3. Add items + quantities.
4. Submit/post.

### E. Run a stock count

1. Sidebar → **Stock Counts** → **+ New Count**.
2. Pick the location.
3. Add lines (the items to count). For a full-warehouse count, use the "Add all items" shortcut.
4. Print the count sheet (or use the count detail page on a tablet to walk the floor).
5. Floor staff fill in counted quantities.
6. Back at the desk, open the count → check the **Variances** tab.
7. If variances are reasonable: click **Apply**. The system creates correction movements.
8. If suspicious: don't apply. Edit individual lines or discard the count.

### F. Invite a new employee

1. Sidebar → **Admin → Users** → **+ Invite User**.
2. Fill in email, full name, a temporary password.
3. Submit. The user is created.
4. Click into the new user → **Roles panel → Add** → pick the role(s).
5. Share the credentials securely. Tell them to change the password on first sign-in.

### G. Reset a user's password (admin-initiated)

For tenant admins resetting a user in their own tenant:

1. Sidebar → **Admin → Users** → click the user.
2. Topbar → **Reset password**.
3. Enter new password (8+ chars), confirm, submit.
4. Toast confirms success. The user is signed out of every device immediately.
5. Share the new password securely. Tell them to change it via Account → Change password after sign-in.

For super admins resetting a user across tenants:

1. Sidebar → **Platform Users** (or open the user's tenant first via Platform → Tenants).
2. Find the user, click the row's action menu → **Reset password**.
3. Same modal, same flow.

### H. Provision a new tenant (super admin)

1. Sidebar → **Platform → Tenants** → **+ New Tenant**.
2. Fill in name, code, base currency, plan, timezone.
3. Submit. The tenant exists.
4. Open the tenant → **+ Register first admin** (or use Platform Users → Invite).
5. Fill in name, email, temporary password.
6. Submit. The first tenant admin is created.
7. Share the URL + credentials with the client.

### I. Create a custom role

1. Sidebar → **Admin → Roles** → **+ New Role**.
2. Name (e.g. "Receiving Clerk"), code (e.g. "receiving_clerk").
3. Save. The role is created with zero permissions.
4. Click into the new role.
5. Permissions grid: tick the permissions to grant (e.g. `inventory.movements.write`, `inventory.documents.write`, `inventory.documents.post` for someone who can receive but not cancel).
6. Toggles save on click.
7. Assign the role to users from their detail page.

### J. Define a custom field

1. Sidebar → **Settings → Custom Fields** → **+ Add Field**.
2. Pick the entity (Item, Party, Document Header, etc.).
3. Code (`shelf_life_days`, lowercase + underscores).
4. Label (`Shelf life (days)`).
5. Type — text / number / date / boolean / select / json.
6. If select: enter comma-separated choices.
7. Required? — yes/no.
8. Save. The field now appears on every record of that entity.

### K. Filter and sort a table

Almost every list page uses the same pattern:

- **Global search** at the top — searches all visible columns.
- **Funnel icon** next to a column header — opens a per-column filter (text contains, exact match, multi-select, boolean, etc.).
- **Column header** itself — click to sort. Click again to flip direction.
- **Active filter bar** appears below when any filter is on — click an X to clear individual filters, or **Clear all**.

---

## 6. Mobile usage

The whole app is responsive. On phones:

- **Sidebar collapses** into a drawer. Tap **☰** in the topbar to open it.
- **Tables** turn into card layouts on the most-used pages (Items, Documents, Balances). Other tables horizontal-scroll.
- **Breadcrumbs** show only the current page (full trail on tablet+).
- **Tenant name** is hidden in the topbar but available in the avatar menu.
- **Modals** slide up from the bottom on phones (bottom-sheet style).
- **Forms** stack two-column grids into one column.
- **Touch targets** are bumped to 36–40px for thumb accuracy.

For the demo URL, tap and pinch-zoom should never be needed.

---

## 7. Troubleshooting / FAQ

### General

**Q: I see an amber "Demo mode" banner. Is this real data?**
No. Demo mode runs entirely in your browser memory. Refreshing the page resets everything. This mode is for previews only.

**Q: I refreshed the page and got logged out.**
That's expected if your session cookie expired. Sign in again. If it happens repeatedly within minutes, your access token may not be refreshing — let your admin know.

**Q: The page is slow to load.**
First-time loads compile lots of JS. After that, navigation is fast. If it stays slow, check your network tab for failed requests; the backend may be down.

### Login & access

**Q: My password doesn't work.**
Triple-check (1) email is lowercase, (2) caps lock is off, (3) you're using the password your admin gave you, not an old one. After 5 wrong tries you're rate-limited for 15 minutes.

**Q: I get "AUTHENTICATION_REQUIRED" repeatedly.**
Your refresh token expired (default 30 days). Sign in again to get a fresh one.

**Q: I see a screen that says "You don't have access to this".**
You're missing a permission for that page. Click **Go back** and ask your admin if you should have access.

### Items / inventory

**Q: I can't change an item's base UoM.**
Correct — base UoM is locked once the item has any stock movement against it. Otherwise the FIFO valuation layers stop making sense.

**Q: I deleted an item but it's still showing in old documents.**
Documents preserve a snapshot of the item at the time of posting. Deleting the item doesn't rewrite history — that would break audit. Instead the deleted item shows as "—" or the historical name in old reports.

**Q: My on-hand says 5 but qty_available says 3. Where's the difference?**
2 units are reserved against an open document (probably a sales order awaiting picking). Go to **Reservations** to see which.

**Q: Why does posting a Sales Order fail with INSUFFICIENT_STOCK?**
You're trying to ship more than `qty_available`. Either reduce the quantity, post a receipt first, or release a reservation that's holding the stock.

### Documents

**Q: I posted a document by mistake. How do I undo it?**
Click **Cancel** on the document. The system creates *reversal* movements; nothing is deleted, but balances revert. The original posted document stays in the audit trail with status "Cancelled".

**Q: I can't post a document — the button is greyed out.**
Either (a) you don't have `inventory.documents.post` permission, or (b) the document isn't yet in "Approved" state, or (c) a workflow rule is blocking it.

**Q: My document shows "Draft" forever.**
Documents start as Draft. Click **Submit** to advance them. Then **Approve** (if you have the permission). Then **Post**. Some workflows require all four states; others let you skip directly from Draft to Posted.

### Counts

**Q: I clicked Apply on a count by mistake.**
Apply is irreversible. Counts that were applied created real correction movements. To undo, post a manual movement for each correction (the opposite direction). Don't take this lightly — get your admin involved.

**Q: My count's variance column is empty.**
Either you haven't entered any counted quantities yet, or the counted matches the system on-hand exactly. Both are fine.

### Master data

**Q: What's the difference between UoM Category and UoM?**
UoM is the actual unit (kg, gram, box). UoM Category is the group it belongs to (Weight, Count, etc.). You can only convert between UoMs in the same category. So set up Categories first, then UoMs inside them, then Conversions.

**Q: Can I delete a brand / category / status that's been used?**
You can, but the system warns you. Existing records that referenced the deleted master-data row will show "—" for that field. Consider marking it inactive instead.

**Q: I see "Master Track" in some old documents — what is it?**
Informal name for "Master Data". Same thing. The current sidebar uses "Master Data".

### Settings

**Q: I changed a Module Configuration value and nothing happened.**
Some settings only take effect on new records or after the next document post. If a setting needs the user to sign out/in to take effect, the page says so.

**Q: My webhook isn't firing.**
Check the integration is **active**, the webhook URL is reachable from the server, and the event you're subscribed to is one that's currently emitted (event coverage is partial — see the integrations docs).

### For super admins

**Q: I'm the super admin but I see "0 users" everywhere.**
Make sure the backend is on the latest version (auth service must honour `X-Acting-Tenant-Id`). If it isn't, the platform-admin user views silently return empty. See `documentation/24aprChanges/CHANGES_APPLIED.md` and `documentation/25aprChanges/`.

**Q: How do I impersonate a tenant admin to see what they see?**
Currently no one-click "log in as" feature. Closest equivalent: open a tenant in `/platform/tenants/[id]`, browse their users and config. For full impersonation, super admin can reset a tenant admin's password and log in as them, then reset it back when done. Don't do this in production without consent.

---

## Need more help?

- **Inside the app:** every page has a `(?)` icon next to non-obvious labels — hover for inline tooltips. Many fields also have a help text under them.
- **Engineering questions:** read [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md), [FRONTEND.md](FRONTEND.md), and [USER_FLOW.md](USER_FLOW.md) in this folder.
- **Demo accounts and roles:** see [DEMO_USERS.md](DEMO_USERS.md).
- **Bugs or feature requests:** contact your administrator, who can file an issue with Raniacone support.
