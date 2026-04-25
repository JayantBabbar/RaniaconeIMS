# Workflow — Tenant Administrator

A workflow guide for the most senior user inside a customer workspace. You're the company's "owner" of the Raniacone tenant.

> See also: [USER_MANUAL.md](USER_MANUAL.md) for screen-by-screen reference, [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md) for technical depth.

---

## Who you are

You're the person inside your company who owns the Raniacone workspace. You configure it, invite users, control access, and step in when employees can't help themselves. You have **every permission** within your tenant.

When you sign in, your JWT carries `tenant_id: <your tenant>`, `is_super_admin: false`, and a permission set that includes everything (`auth.users.*`, `inventory.*`, etc.).

---

## What this guide covers

The workflows you actually do, in roughly the order you'll do them:

1. [First-day setup of your workspace](#workflow-1--first-day-setup)
2. [Inviting and managing employees](#workflow-2--inviting-and-managing-employees)
3. [Resetting an employee's password](#workflow-3--resetting-an-employees-password)
4. [Configuring document approval workflows](#workflow-4--configuring-document-workflows)
5. [Investigating discrepancies — the audit chain](#workflow-5--investigating-discrepancies)
6. [Maintaining master data over time](#workflow-6--maintaining-master-data)
7. [Handling departing employees](#workflow-7--handling-departing-employees)

---

## Workflow 1 — First-day setup

**Trigger:** You just received credentials for your new Raniacone workspace.

This is a one-time job. Once you're done, employees can sign in and do real work.

### Steps

1. **Sign in** with the temporary password from Raniacone.
2. **Change your password immediately**: avatar (top-right) → **Change password**. Set one only you know. Save.
3. **Verify Tenant Configuration** (Sidebar → **Settings → Tenant Configuration**):
   - Timezone — should match your operations.
   - Fiscal year start — for reporting.
4. **Confirm Module Configuration** (Sidebar → **Settings → Module Configuration**):
   - Costing method — FIFO is default. Don't change unless you understand the implications.
   - Allow negative balances — usually No.
   - Other knobs — read the help text on each.
5. **Set up Master Data** in this order (because each step depends on the previous):

   | Step | Where | What to do |
   | --- | --- | --- |
   | a | **Master Data → UoM Categories** | Verify defaults (Count, Weight, Length, Volume). Add any you need (e.g. "Time" for service items). |
   | b | **Master Data → UoMs** | Within each category, add the units you actually use. *Each*, *kilogram*, *gram*, *box*, *pallet*, etc. |
   | c | **Master Data → UoM Conversions** | Add factors. "1 box = 12 each" means you can receive a PO in boxes and the system breaks it down. |
   | d | **Master Data → Brands** | Add the brands you carry. |
   | e | **Master Data → Categories** | Build your product taxonomy (Electronics → Phones → Smartphones). |
   | f | **Master Data → Status Master** | Add custom statuses if your business uses them (e.g. "On Hold"). |
   | g | **Master Data → Number Series** | Verify the auto-numbering rules for documents (e.g. PO-2026-0001). Customise prefixes if needed. |
   | h | **Master Data → Document Types** | Confirm PO/SO/TRN are configured with their number series. Add custom types (e.g. "Internal Adjustment") if you need them. |

6. **Set up Locations** (Sidebar → **Locations**):
   - Add your warehouses, zones, and bins.
   - Build them as a tree — Main Warehouse > Zone A > Aisle 1 > Bin A1-001.
7. **Add Parties** (Sidebar → **Parties**):
   - Add your top suppliers (mark as Supplier).
   - Add your top customers (mark as Customer).
   - Each party has addresses + contacts — fill in primary ones at minimum.
8. **Add Items** (Sidebar → **Items**):
   - For a small catalog: click **+ New Item** for each.
   - For a large catalog: use **Imports** (currently a placeholder — fall back to creating a few key items manually for now).
   - Decide for each: batch-tracked? serial-tracked? base UoM? Once stock movements exist, base UoM becomes locked.

### What you conclude in

- A workspace with full master data, locations, parties, and a starter catalog.
- No stock yet — that comes from receiving your first PO.
- An audit trail of every record you created.

### Tip

Don't try to be perfect on day one. Get the framework in place (categories, UoMs, top suppliers, key items) and iterate as your team starts using it.

---

## Workflow 2 — Inviting and managing employees

**Trigger:** A new hire joins, or an existing employee needs different access.

### Inviting a new user

1. Sidebar → **Admin → Users** → **+ Invite User**.
2. Fill in:
   - Email (case-insensitive — backend lowercases).
   - Full name.
   - Temporary password (8+ chars).
3. Submit. The user is created in your tenant.

### Granting them a role

The user has zero permissions until you assign a role.

1. Click the new user's name → user detail page.
2. **Roles panel** → **+ Add** → pick from your role list.
3. Click the role to assign. It saves immediately.

Common assignments:
- **Operator** — warehouse staff who receive, ship, count, and post documents.
- **Viewer** — finance/audit/management who need read-only visibility.
- **Administrator** (only assign to your direct deputies — gives full permissions).

### Creating a custom role for a custom job

Default roles often won't fit perfectly. Example: a "Receiving Clerk" who can post POs but not cancel them.

1. Sidebar → **Admin → Roles** → **+ New Role**.
2. Name: "Receiving Clerk", code: `receiving_clerk`.
3. Save. The role exists with zero permissions.
4. Click into it. Tick:
   - `inventory.items.read`
   - `inventory.balances.read`
   - `inventory.movements.read` and `.write`
   - `inventory.documents.read` and `.write` and `.post`
   - `inventory.parties.read`
   - `inventory.locations.read`
   - All the UoM/Status/Number-Series read perms (so they can use them on documents)
5. Untick everything else. Save changes (they save on click).
6. Assign this role to relevant users.

### Handover to the new user

Send via secure channel:

```
URL: <your Raniacone URL>
Email: <their email>
Temporary password: <the one you set>
First action: avatar → Change password → set your own.
Documentation: <link to USER_MANUAL.md>
```

### What you conclude in

- A user with a known temporary password, scoped to your tenant, with the role(s) you granted.
- An audit row recording the user creation and role assignments.

---

## Workflow 3 — Resetting an employee's password

**Trigger:** "I forgot my password" / "I'm locked out".

The platform doesn't send password-reset emails. You handle this directly.

### Steps

1. Sidebar → **Admin → Users** → click the user.
2. Top-right of the page → **Reset password** button.
3. Modal opens. Enter a new password (8–128 chars). Confirm. Submit.
4. Success toast appears.

### What you conclude in

- The user's password is replaced.
- Every active session for that user is killed — they're signed out of every device.
- An audit row: `action = "ADMIN_RESET_PASSWORD"`, `changed_by = <you>`, `tenant_id = <yours>`.

### Handover

Tell the user:

> "Your new temporary password is `<the password>`. Please sign in immediately and go to Account → Change password to set one only you know. You'll need to sign in fresh on every device."

Share via password manager, encrypted message, or in-person — never plain email/Slack.

### Edge cases

| Situation | What to do |
| --- | --- |
| User is in another tenant | You can only reset users in your own tenant. Contact Raniacone (super admin) for help. |
| User is deactivated | Reactivate first (button next to Reset password), then reset. |
| Multiple failed reset attempts (password keeps "not working") | Verify the user is typing it correctly — copy/paste from a neutral text editor. Caps lock is the usual culprit. |

---

## Workflow 4 — Configuring document workflows

**Trigger:** You want approvals before documents post (e.g. "all POs over $10k need finance approval").

### Steps

1. Sidebar → **Settings → Workflows** → **+ New Workflow**.
2. Name and description.
3. Pick the **entity** the workflow applies to (Document Header, usually).
4. Define **states** — Draft, Submitted, Approved, Posted, Cancelled (or whatever your approval chain looks like).
5. Define **transitions** — for each state-to-state move, the permission required to perform it. E.g.:
   - Draft → Submitted: `inventory.documents.write`
   - Submitted → Approved: `inventory.documents.approve` (a custom permission you'd grant only to approvers)
   - Approved → Posted: `inventory.documents.post`
6. Save.

### Linking the workflow to a document type

Currently, workflow enforcement at posting time is partial — see [APPLICATION_OVERVIEW.md §8 "What's not built"](APPLICATION_OVERVIEW.md#8-whats-built--whats-not). For document types where it works, link the workflow at **Master Data → Document Types** → edit the doc type → **Workflow** field.

### What you conclude in

- Documents of that type now follow the state machine. They cannot skip states. Each transition requires the configured permission.
- An auditable history of who advanced each document through each state.

---

## Workflow 5 — Investigating discrepancies

**Trigger:** Stock count shows -50 of an item that should have plenty. Or the books don't match the warehouse.

### Steps to chase it down

1. **Start at Stock Balances** (Sidebar → **Stock Balances**).
   - Find the item + location row. Note `qty_on_hand`, `qty_reserved`, `qty_available`.
2. **Check Reservations** (Sidebar → **Reservations**). If qty_reserved is high, it means open documents (sales orders) are tying up stock — not actually missing.
3. **Check Movements** (Sidebar → **Movements** → filter by item + location).
   - Sort by date desc. Walk back through every movement.
   - Each row shows direction (IN/OUT), quantity, source (e.g. "PO-2026-0042" or "manual"), the user who posted it, and the timestamp.
   - Look for: a manual OUT movement that shouldn't exist, a missing IN movement, a wrong quantity, a duplicate.
4. **Check Documents** referenced in suspicious movements. Open each, see the line that caused it.
5. **Check Valuation Layers** (Sidebar → **Valuation Layers**) — confirms FIFO consumption matches expectation.
6. **Check the Audit Log** (in the database — backend feature, no UI yet) for the user actions on the affected records.

### What you conclude in

- Either: the issue is explained (and resolved by posting a correction movement or applying a count).
- Or: you've gathered enough evidence to escalate (to Raniacone support, to internal audit, to the employee involved).

### Common patterns

| Symptom | Likely cause |
| --- | --- |
| qty_on_hand is negative | Someone allowed a negative balance (Module Config), or a count was applied incorrectly. |
| qty_available is much lower than qty_on_hand | Lots of reservations from open documents. Cancel stale ones to release stock. |
| FIFO valuation looks wrong | Someone posted a PO with the wrong unit cost. Cancel the PO (creates reversals), repost with the right cost. Check before this becomes habit. |
| Item shows 0 on hand but the warehouse has stock | A previous count was wrong, or movements weren't posted when stock arrived. Run a fresh count. |

---

## Workflow 6 — Maintaining master data

**Trigger:** Your business changes. New supplier. New product line. New warehouse zone.

### Steps

This is bread-and-butter ongoing work. Routine examples:

| Change | Where | Action |
| --- | --- | --- |
| New supplier signed | **Parties** → **+ New Party** | Mark as Supplier. Add primary contact. Add address. |
| Discontinue an SKU | **Items** → click item → **Edit** | Set Active = No. (Don't delete — it stays on historical documents.) |
| Add a warehouse zone | **Locations** → click parent location → **+ Add child** | Tree grows automatically. |
| Custom field for items | **Settings → Custom Fields** → **+ Add Field** | Pick entity = Item, choose type, save. The field appears on every item from now on. |
| Renumber documents | **Master Data → Number Series** → edit | Change the prefix or padding. Existing docs keep their old numbers; new docs use the new format. |

### What you conclude in

- Master data evolves with your business. Each change is audited.
- Existing records keep their old references — historical integrity preserved.

---

## Workflow 7 — Handling departing employees

**Trigger:** An employee is leaving (quitting, fired, role change).

### Steps

1. Sidebar → **Admin → Users** → click the user.
2. Click **Deactivate** (top-right).
3. They lose access immediately. They cannot sign in. Their existing sessions are invalidated.
4. Their historical records (documents posted, movements, audit entries) stay intact.

### Decision: deactivate or delete?

- **Always deactivate.** Almost never delete.
- Deletion would need to cascade through all the documents/movements/audit rows that reference the user — which the system rightly refuses to do for integrity reasons.
- A deactivated user can be reactivated if they come back. A deleted user's data is gone.

### What you conclude in

- The user can no longer sign in.
- Their assigned documents in Draft state remain assigned to them but cannot be advanced (Submit / Approve / Post will fail because they can't sign in to do it). Reassign these to active users — open each doc, change the responsible user.

---

## What you cannot do

Things outside your scope, where you'd escalate to Raniacone (super admin):

| You cannot | Escalate to |
| --- | --- |
| See or manage other companies' tenants | Super admin (each tenant is isolated). |
| Change your base currency | Super admin → backend ticket. |
| Add new ISO 4217 currencies to the platform | Super admin. |
| Diagnose platform downtime | Raniacone support / on-call. |
| Get raw data export with all audit columns | Raniacone support — they have DB access. |

---

## Daily / weekly checklist

| Cadence | Action |
| --- | --- |
| Daily | Glance at **Dashboard** → confirm KPIs look reasonable. Check **Low Stock Alerts** — handle critical ones. |
| Weekly | Skim recent **Movements** for anything unusual. Review **Documents → Drafts** for stale unpost docs. |
| Monthly | Audit user list — anyone left? Any role assignments to revoke? Audit count variances trend. |
| Quarter-end | Run a comprehensive **Stock Count**. Apply corrections. Reconcile against accounting. |

---

## Working with your team

You're the gatekeeper. To keep operations smooth:

- **Document conventions** — write down your team's standards for SKU codes, document numbering, count cadences. Save them somewhere everyone can find.
- **Train new hires on the User Manual** — point them at [USER_MANUAL.md](USER_MANUAL.md). The glossary and the per-screen walkthroughs handle 90% of "how do I…" questions.
- **Set role assignments thoughtfully** — Operator can post and cancel documents. Viewer can't. If someone in finance asks for "edit access" think about whether they actually need a custom role with narrower permissions.
- **Avoid bottlenecks** — if you're the only approver on every workflow, vacations break things. Train at least one deputy.
