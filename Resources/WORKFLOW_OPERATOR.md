# Workflow — Warehouse Operator

A workflow guide for the floor-level employee who actually moves stock around. You're the person doing the receiving, shipping, transferring, and counting.

> See also: [USER_MANUAL.md](USER_MANUAL.md) for screen-by-screen reference, [WORKFLOW_TENANT_ADMIN.md](WORKFLOW_TENANT_ADMIN.md) for what your admin handles.

---

## Who you are

You're a warehouse operator, receiving clerk, shipping clerk, or stockkeeper. You're the human bridge between physical stock and the system that tracks it. **Every receipt, every shipment, every transfer, every count goes through you** (or a colleague with the same role).

When you sign in, your JWT carries `tenant_id: <your tenant>`, `is_super_admin: false`, and a permission set that **reads everything in inventory and writes the operational stuff** — movements, documents, counts, reservations, lots, serials.

You **cannot** manage users, edit master data, or change settings. That's the admin's job.

---

## What this guide covers

The workflows you actually do, in roughly priority order:

1. [Daily routine — what to check first](#workflow-1--daily-routine)
2. [Receiving stock from a supplier](#workflow-2--receiving-stock-via-purchase-order)
3. [Shipping stock to a customer](#workflow-3--shipping-stock-via-sales-order)
4. [Transferring stock between locations](#workflow-4--transferring-stock-between-locations)
5. [One-off adjustments and corrections](#workflow-5--one-off-stock-adjustments)
6. [Running a stock count](#workflow-6--running-a-stock-count)
7. [Reservations — when stock is held but not yet shipped](#workflow-7--reservations)
8. [Working with lots and serials](#workflow-8--lots-and-serials)
9. [Cancelling a posted document](#workflow-9--cancelling-a-posted-document)

---

## Workflow 1 — Daily routine

**Trigger:** Start of your shift.

### Steps

1. **Sign in** → you land at `/dashboard`.
2. Glance at the four KPI cards:
   - **Inventory value** — should be close to yesterday's.
   - **Items in stock** — count of distinct SKUs with non-zero balances.
   - **Draft documents** — open POs and SOs you might need to post.
   - **Stock counts** — open count sessions.
3. Scroll to **Recent movements** — see what's happened on your shift / overnight.
4. Sidebar → **Documents → Purchase Orders** — look for **Approved** POs awaiting receiving.
5. Sidebar → **Documents → Sales Orders** — look for **Approved** SOs awaiting picking.
6. Sidebar → **Low Stock Alerts** — items below their reorder point. Flag to admin.

### What you conclude in

- A mental map of what's coming in and going out today.
- A prioritised work list.

---

## Workflow 2 — Receiving stock via Purchase Order

**Trigger:** A truck arrives with goods. The driver hands you a delivery note referencing a PO number.

### Steps

#### A. Find the PO

1. Sidebar → **Documents → Purchase Orders**.
2. Search by PO number (top search bar) or filter by Party=<supplier>.
3. Click into the PO. Status should be **Approved** (admin or you have already approved it). If it's still Draft or Submitted, talk to your admin.

#### B. Verify physical stock matches the PO

Walk through the lines:

- For each line, count what's actually on the pallet.
- Note discrepancies (short-shipped? wrong SKU? damaged?).

#### C. Adjust the PO if needed

If the physical receipt doesn't match the PO lines:

- For under-shipment: edit the line quantity down, save.
- For over-shipment: never accept. Refuse the excess or split into a new PO with the supplier's sign-off.
- For wrong items: don't post. Talk to admin/buyer.
- For damaged goods: receive at zero quantity, raise an RTV (return to vendor) document.

#### D. Post the PO

1. Once lines match physical reality, click **Post** at the top.
2. The system creates IN movements for every line at the line's unit cost.
3. **Stock balances update immediately**. FIFO valuation layers are written.
4. Toast confirms success.
5. PO status flips to **Posted**. Posting date = now.

#### E. Put-away

1. Move the physical stock to its assigned location/bin.
2. If the put-away location differs from the PO's destination location, post a follow-up Transfer (Workflow 4).

### What you conclude in

- New rows in `movements` (one per PO line, direction=IN).
- New rows in `valuation_layers` (FIFO entries at unit cost).
- Updated `stock_balances` for the relevant (item, location) pairs.
- The PO is now in **Posted** state, immutable.
- An audit row recording you as the poster.

### Edge cases

| Situation | What to do |
| --- | --- |
| You posted at the wrong unit cost | Open the PO → click **Cancel**. System creates reversal OUT movements and refunds the FIFO layers. Then create a new PO with the correct cost and post that. |
| You forgot to add a line | Cancel the existing PO, recreate with all lines. Or post a manual IN movement for the missing line via **Movements → New** (less clean). |
| Item is batch-tracked and the PO line doesn't have a lot number | The Post action will prompt for a lot number. Enter it. The system creates the lot record. |

---

## Workflow 3 — Shipping stock via Sales Order

**Trigger:** A sales order is approved and your shift includes "pick and ship today".

### Steps

#### A. Find the SO

1. Sidebar → **Documents → Sales Orders**.
2. Filter by Status = Approved.
3. Open the SO.

#### B. Pick the stock

1. The SO lines tell you item, quantity, and source location.
2. Walk to each location and pick the requested quantity.
3. For batch-tracked items: pick the lot closest to expiry first (FEFO). The system surfaces the recommended lot.
4. For serial-tracked items: scan or enter the serial numbers being shipped.

#### C. Verify reservations

1. Before posting, glance at the **Reservations** sidebar. There should be a reservation for each line you're shipping (auto-created when the SO was approved).
2. Reservations decrement `qty_available` so other documents can't grab the same stock.

#### D. Post the SO

1. Click **Post**.
2. The system creates OUT movements consuming oldest FIFO layers first.
3. **Stock balances update**. Reservations are released (converted into actual OUT movements).
4. COGS is computed and recorded against the SO.
5. SO status flips to **Posted**.

#### E. Pack and dispatch

Pack the goods, hand to the courier, attach the delivery note (you can print the SO at `/documents/detail/[id]/print`).

### What you conclude in

- New rows in `movements` (direction=OUT).
- Consumed `valuation_layers` updated with reduced remaining quantity.
- Updated `stock_balances` (decremented on_hand and available).
- Reservations released.
- The SO is in **Posted** state with a non-null `posting_date`.

### Edge cases

| Situation | What to do |
| --- | --- |
| `INSUFFICIENT_STOCK` error on Post | `qty_available < line.quantity`. Either reduce the line quantity, ask admin to release stale reservations, or escalate to fulfill in a partial shipment. |
| Wrong item picked but already posted | Cancel the SO (creates reversal IN movements). Repick correctly and create a new SO. |
| Customer wants to receive on a future date | Set the SO's `expected_delivery_date` field but post when actually shipped, not before. |

---

## Workflow 4 — Transferring stock between locations

**Trigger:** A customer service agent says "we need 10 units of SKU-X moved from Warehouse A to Warehouse B". Or rebalancing.

### Quick path — one-off

1. Sidebar → **Movements → Transfer**.
2. Pick **From location** and **To location**.
3. Pick the item and quantity.
4. Submit. The system creates paired OUT (from A) and IN (to B) movements at the same unit cost.

### Document path — multi-line, audited

1. Sidebar → **Documents → Transfers** → **+ New Transfer**.
2. Header: source location, destination location, date.
3. Add lines: items, qtys.
4. Save as Draft → Submit → Approve → Post (depending on workflow).
5. Posting creates OUT and IN movements.

### What you conclude in

- For each line: one OUT movement at source location, one IN movement at destination location, both at the same unit cost.
- Stock balances updated at both locations.
- For document path: an auditable transfer document referenceable later.

### Tip

Use the **Document path** for any transfer above ~5 lines or anything that needs sign-off. Use **Quick path** for small ad-hoc moves.

---

## Workflow 5 — One-off stock adjustments

**Trigger:** Damaged goods. Spillage. Found stock that wasn't on the system. Write-off.

These are stock changes that don't flow through a PO/SO/TRN. Use sparingly — every adjustment is a finger-pointing risk if not justified.

### Steps

1. Sidebar → **Movements → New**.
2. Pick **Direction**:
   - **IN** — adding stock that wasn't there (found inventory, returned damage-free, mistake correction).
   - **OUT** — removing stock that's gone (write-off, damage, theft, sample given out).
3. Item, location.
4. Quantity, UoM.
5. Unit cost (only for IN — typically use the FIFO layer cost shown next to the item).
6. **Source** field — write a clear reason: "damaged in transit", "found in zone B during recount", "sample to ABC client". This is what auditors will read.
7. Lot/Serial if the item is tracked.
8. Submit.

### What you conclude in

- A movement row with your user id, the source description, and the timestamp.
- Updated balance and FIFO layer.
- A clear audit trail an inspector can follow.

### When to escalate instead

- Anything > a few units of value: get admin sign-off first.
- Anything that looks like theft or systematic error: don't write it off — log it, escalate, investigate.

---

## Workflow 6 — Running a stock count

**Trigger:** Cycle count schedule. Quarter-end. Suspicion of inaccuracy.

### Steps

#### A. Set up the count

1. Sidebar → **Stock Counts** → **+ New Count**.
2. Pick the **Location** (e.g. "Main Warehouse").
3. **Date** = today.
4. **Notes** = optional context ("Q1 cycle count").
5. Save as Draft.

#### B. Add lines

1. In the count detail page, **+ Add lines**.
2. Either pick specific items, or use **Add all items in this location** for a comprehensive count.

#### C. Walk the floor

Two options:

- **Print and clipboard** — print the count sheet via the print button. Take it to the floor. Write counted quantities. Come back, type into the system.
- **Mobile / tablet** — open the count detail page on a tablet. Walk and type counts into each line as you go.

#### D. Review variances

1. Click the **Variances** tab. This filters to lines where counted ≠ system on-hand.
2. For each variance:
   - Re-walk to confirm physical count is right.
   - If still a variance, leave it as is.

#### E. Apply (when confident)

1. Click **Apply**.
2. **Read the warning carefully.** Apply is irreversible.
3. Confirm.
4. The system creates correction movements for every variance:
   - Counted > system → IN movement (positive variance, "found stock").
   - Counted < system → OUT movement (negative variance, "missing stock").
5. Movements are tagged with source = "count adjustment" and the count number.

### What you conclude in

- Stock balances now match physical reality.
- A permanent record of the count, the variances found, and the corrections made.
- Anyone reviewing later can answer "what did this count find and what did we change?"

### When NOT to apply

- Variances are huge and unexplained — investigate before applying.
- Counted quantities are uncertain (someone walked too fast).
- You suspect data entry errors in the count sheet.

In any of these cases: don't apply. Discard the count or correct the lines and re-walk.

---

## Workflow 7 — Reservations

**Trigger:** Either you're investigating "why is qty_available so low?" or you need to manually hold stock.

### When reservations are created automatically

- Approving a Sales Order auto-creates reservations for each line, decrementing `qty_available` so no one else can claim that stock.
- Reservations are released when the SO is posted (turns into actual OUT movements) or cancelled (frees the stock again).

### When you'd interact manually

Rarely. The Reservations page is mostly observational — see what's holding stock.

To manually create a reservation:
1. Sidebar → **Reservations** → **+ New Reservation**.
2. Item, location, quantity, source ("special hold for VIP customer X").
3. Save.

### What you conclude in

- A reservation row decrementing `qty_available`. The stock is still on hand but not "available" to other documents.

---

## Workflow 8 — Lots and serials

**Trigger:** You're handling batch-tracked or serial-tracked items.

### Lots (batches)

When receiving a batch-tracked item:
1. The PO line will require a **Lot number** field on post.
2. Enter the manufacturer's lot/batch number from the package.
3. Enter the **Expiry date** (if applicable).
4. Submit. The system creates a `lots` row.

When shipping a batch-tracked item:
1. The system suggests the lot closest to expiry (FEFO).
2. Confirm or override with a different lot if needed.
3. Post.

To browse all lots: Sidebar → **Lots**. Filter by item, expiry, status.

### Serials

When receiving a serial-tracked item:
1. The PO line requires you to enter a **serial number per unit**.
2. For 10 units, you'll enter 10 serial numbers.
3. Each serial gets a `serials` row with status = `in_stock`, location = receiving location.

When shipping a serial-tracked item:
1. Pick the specific serial(s) being shipped.
2. Each serial's status moves through `reserved` → `issued`.

To browse all serials: Sidebar → **Serials**. Filter by item, status, location.

### What you conclude in

- Per-batch or per-unit traceability. If a recall happens later, "show me everywhere this lot went" is a single filter.

---

## Workflow 9 — Cancelling a posted document

**Trigger:** A document was posted in error, or upstream conditions changed (customer cancelled, supplier returned).

### Steps

1. Open the document (PO/SO/TRN).
2. Verify it's in **Posted** state.
3. Click **Cancel**.
4. Read the warning. Confirm.
5. The system creates **reversal movements** — for every line, an opposing-direction movement is posted.
6. Stock balances revert. Valuation layers are unwound (reversal of FIFO consumption).
7. Document status becomes **Cancelled**. Original lines and movements remain in the audit trail.

### What you conclude in

- Stock state matches what it would have been if the document had never been posted.
- A complete audit trail showing: original document posted, then cancelled, with both sets of movements visible.

### When NOT to cancel

- Cancellation is for genuine errors. If the customer wants to *return* what they bought (which is a separate transaction), use an RTV/Return document instead — that's a new document, not a cancellation.

---

## What you cannot do (and where to escalate)

| You cannot | Escalate to |
| --- | --- |
| Add or edit items | Tenant admin (master data is locked to admin). |
| Change UoM categories or conversions | Admin. |
| Add new parties (suppliers/customers) | Admin (or a custom role with `inventory.parties.write`). |
| Edit a posted document directly | Cancel + recreate. |
| Reset another user's password | Admin. |
| See platform-wide data | Super admin only. |
| Approve a document if you're not the approver | Whoever has `inventory.documents.post`/`.approve`. |

---

## End-of-shift habits

1. Make sure every receipt is posted (no Drafts left from the day).
2. Make sure every shipment is posted (no half-completed picks).
3. Glance at **Recent movements** — confirm everything you did is there.
4. If something looks wrong, flag it before you leave so the next shift / admin can investigate.

---

## Tips that experienced operators learn

- **Trust the system, verify the system.** When the system says qty_available = 5, that's the source of truth. If your eyes say 6, run a count rather than assuming the system is wrong.
- **Post promptly.** Letting documents sit in Draft for days creates reconciliation pain later.
- **Write good source descriptions** on manual movements. Future-you will thank present-you.
- **Use the table filters.** Don't scroll through 200 movements looking for one. Filter by item or date and find it instantly.
- **Get comfortable with the print page** for documents — it's the cleanest format to give to drivers, customers, or auditors.
- **Master the keyboard shortcuts** in tables: arrow keys to navigate rows, Enter to open, `/` to focus search.
