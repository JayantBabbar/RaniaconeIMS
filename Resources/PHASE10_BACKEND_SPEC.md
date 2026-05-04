# Phase 10 — Sales order → Invoice promotion (REQ-14) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-02 · FE prototype: complete

> Pairs with `frontend/src/services/documents.service.ts`
> (`promoteToInvoice`) and the "Promote to invoice" button on
> `/documents/detail/[id]`.

---

## §1 Overview

Mirror of the existing Challan → Invoice promotion (Phase 2),
on the sales-order side. After a customer confirms an SO, this
turns it into a tax invoice with one click — preserving the link
in both directions for audit + reordering.

Single endpoint:

```
POST /documents/{id}/promote-to-invoice
```

Permission: `inventory.documents.read` AND `inventory.invoices.write`.

---

## §2 Critical scope decisions

### 2.1 Only posted SOs are promotable

- `status = posted` (or `posting_date IS NOT NULL`)
- `document_type.code = 'SO'`
- `is_promoted = false` (or NULL — never been promoted)

Returns 409 with a specific code on each precondition failure.

### 2.2 Idempotency via `is_promoted` flag

Once promoted, the SO is locked from further promotion. Backend
sets `is_promoted = true` and `invoice_id = <new>` atomically with
the invoice creation.

Cancelling the resulting invoice does NOT auto-flip the SO back —
that's a separate manual workflow (cancel + create new SO if you
want to re-issue).

### 2.3 GST math computed at promotion time

The SO has `unit_price` per line but no GST split. At promotion:
1. For each line: look up `item.default_tax_rate_pct`.
2. Compute `taxable_value = qty × unit_price × (1 - discount_pct/100)`.
3. Place-of-supply = customer's `state_code`. If different from
   tenant's `state_code` → IGST; otherwise CGST + SGST split equally.
4. Sum line totals into invoice header `subtotal` + `tax_total`.

### 2.4 No stock movement at promotion

The SO's reservations stay as reservations until the resulting
invoice is posted (which then converts reservations to stock-out
movements). The promotion itself doesn't move stock.

This mirrors the challan-promote behaviour — challan already
created the stock-out; invoice-from-challan skips its own.

For SO-promote, the stock-out happens when the new invoice is
posted (just like a fresh invoice). Reservations get released by
the invoice's post handler if `source_doc_id` references a posted
SO with reservations.

### 2.5 Source link both ways

- Invoice gets `source_doc_id = <SO id>` (existing column on
  invoices table; reuse).
- SO gets `is_promoted = true` and `invoice_id = <new id>`.

### 2.6 Invoice number uses the standard NumberSeries

Pull from the `INV` number series via the standard allocator —
don't synthesize directly. New invoice lands as a draft (status =
draft) so the user can review GST math before posting.

---

## §3 Database schema

Two existing tables get one new column each:

```sql
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_doc_id UUID REFERENCES documents(id);
```

Index for the back-link query:

```sql
CREATE INDEX IF NOT EXISTS idx_invoices_source_doc
  ON invoices (source_doc_id) WHERE source_doc_id IS NOT NULL;
```

---

## §4 API Contract

### 4.1 Request

```
POST /documents/{id}/promote-to-invoice
```

No body required.

### 4.2 Success (201)

```json
{
  "invoice_id":     "<new uuid>",
  "invoice_number": "INV/2026-05/0042"
}
```

The FE redirects to `/invoices/{invoice_id}` so the user can review
GST math and Post when ready.

### 4.3 Errors

- `404 DOCUMENT_NOT_FOUND` — id not in tenant scope
- `409 NOT_A_SALES_ORDER` — document_type code is not "SO"
- `409 DOCUMENT_NOT_POSTED` — SO is still draft
- `409 ALREADY_PROMOTED` — `is_promoted = true`
- `403 FORBIDDEN` — caller lacks invoices.write

### 4.4 Audit trail (Phase 9)

Backend writes one audit entry per promotion:

```json
{
  "action": "challan.promote",  // pattern reused; consider "sales_order.promote"
  "entity_type": "document",
  "entity_id": "<so id>",
  "before": { "is_promoted": false },
  "after":  { "is_promoted": true, "invoice_id": "<new>" }
}
```

(If we want a distinct action code, use `sales_order.promote` — FE
doesn't care, treat it consistently with challan.promote.)

---

## §5 Tests

1. Posted SO → 201 with valid invoice_id; SO is_promoted flips.
2. Draft SO → 409 DOCUMENT_NOT_POSTED.
3. Already-promoted SO → 409 ALREADY_PROMOTED.
4. PO (not SO) → 409 NOT_A_SALES_ORDER.
5. GST line math: line with rate_pct=18, intra-state → CGST+SGST equally.
6. GST line math: line with rate_pct=18, inter-state → IGST only.
7. Discount applied correctly to taxable_value.
8. Invoice header subtotal + tax_total = sum of lines.
9. Audit entry written + visible via /audit-log.
10. Concurrent calls: only one wins (UNIQUE constraint or row-lock).

---

## §6 Out of scope (Phase 11+)

- Partial promotion (some SO lines → invoice, rest stay as SO)
- Multi-SO → single invoice consolidation
- Cancel-and-re-promote workflow

---

## §7 FE prototype status

- `services/documents.service.ts` — `promoteToInvoice` method
- `app/(dashboard)/documents/detail/[id]/page.tsx` — "Promote to
  invoice" button (only when posted SO + not already promoted)
- `lib/demo/adapter.ts` — handler creates draft invoice, copies
  lines with computed GST math, flips SO `is_promoted`
- `lib/api-constants.ts` — `DOCUMENTS.PROMOTE_TO_INVOICE`

When backend lands: set `NEXT_PUBLIC_DEMO_MODE=false`.
