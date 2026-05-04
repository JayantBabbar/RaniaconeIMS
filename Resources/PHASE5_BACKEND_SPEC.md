# Phase 5 — Compliance close (REQ-9) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-01 · FE prototype: complete
Source of truth: paired with `frontend/src/services/gstr.service.ts`,
`frontend/src/services/period-close.service.ts`, the `/reports/gstr-1`
and `/reports/gstr-3b` pages, and `/settings/period-close`.

> **Status of paired FE work**: All 3 routes ship as a working
> prototype against in-memory fixtures (`src/lib/demo/adapter.ts`).

---

## §1 Overview

Phase 5 closes the compliance loop after Phase 4 by adding:

1. **GSTR-1 export** — JSON in GSTN-portal schema for monthly
   outward-supply filing (B2B, B2CL, B2CS).
2. **GSTR-3B export** — Monthly summary return JSON.
3. **Period close (ledger lock)** — Tenant-level `lock_before_date`
   that prevents edits to documents in filed periods.

| Route                          | Endpoint                       | Purpose                            |
|--------------------------------|--------------------------------|------------------------------------|
| `/reports/gstr-1`              | `GET /reports/gstr-1`          | GSTR-1 JSON for a filing month     |
| `/reports/gstr-3b`             | `GET /reports/gstr-3b`         | GSTR-3B summary JSON               |
| `/settings/period-close`       | `GET /period-close`            | Read current lock setting          |
| `/settings/period-close`       | `PUT /period-close`            | Set or clear the lock              |

GSTR-2A / 2B are explicitly **out of scope** — those are
auto-populated by the GST portal and consumed read-only.

---

## §2 Critical scope decisions

### 2.1 GSTR JSON shape mirrors GSTN portal schema exactly

We do NOT invent our own envelope around the GSTN data. The
`b2b`, `b2cl`, `b2cs` arrays use the exact field names and
casing from the GSTR-1 portal spec (`ctin`, `inum`, `idt`,
`itm_det`, `txval`, `rt`, `camt`, `samt`, `iamt`, `csamt`).

This means: a downloaded JSON from our `/reports/gstr-1`
endpoint can be uploaded directly to the GSTN portal (after CA
review). No transform layer.

We DO add a `summary` block on top of the GSTN schema for FE
preview rendering — this is additive and ignored by the portal.

### 2.2 B2B vs B2CL vs B2CS bucketing

For each posted invoice in the filing month:

```python
if party.is_gst_registered and party.gstin:
    bucket = "B2B"
elif inter_state and grand_total > 250000:
    bucket = "B2CL"
else:
    bucket = "B2CS"
```

`inter_state` = `invoice.place_of_supply != tenant.state_code`.

B2CS is **aggregated** by `(sply_ty, pos, rt)` — never
per-invoice. B2B and B2CL are per-invoice.

### 2.3 Date format DD-MM-YYYY

GSTN expects dates as `DD-MM-YYYY`, not ISO `YYYY-MM-DD`.
Convert at the boundary; never store dates in this format.

### 2.4 Filing period MMYYYY

`fp` (GSTR-1) and `ret_period` (GSTR-3B) are MMYYYY strings —
e.g. April 2026 → `"042026"`, NOT `"2026-04"` or `"04-2026"`.

### 2.5 Period close is a hard floor, not a soft warning

When `period_close.lock_before_date` is set:

```
For any document with posting_date ≤ lock_before_date:
  ANY mutation (POST /post, /cancel, PATCH, DELETE) returns
  423 LOCKED with message "Posting date is in a closed period"
```

This MUST be enforced server-side as a generic middleware on
every transactional resource, not per-route. Resources covered:
- invoices, invoice_lines
- challans, challan_lines
- vendor_bills, vendor_bill_lines
- payments, payment_allocations
- expenses
- salary_entries
- documents (POs/SOs/Transfers — though they don't post to ledger)
- counts (apply action)

### 2.6 Lock affects edits, not reads

Reading reports for a locked period MUST still work. Only
mutations are blocked.

### 2.7 Unlock is rare and audited

Setting `lock_before_date` to `null` (unlock) is allowed but
should fire an audit-log event. CA-period adjustments need
unlock → fix → re-lock; we accept that workflow.

---

## §3 Database schema

### 3.1 No new tables

Phase 5 stores its single setting in `tenant_config` under
`key = "period_close"` with the value:

```json
{
  "lock_before_date": "2026-04-30",
  "locked_at": "2026-05-01T11:30:00Z",
  "locked_by": "admin@example.com",
  "reason": "GSTR-3B filed for April 2026"
}
```

### 3.2 Index recommendation

If audit log becomes a separate table later:

```sql
CREATE INDEX idx_audit_log_period_close
  ON audit_log (tenant_id, action, created_at)
  WHERE action LIKE 'period_close.%';
```

---

## §4 API Contract

### 4.1 GSTR-1

```
GET /reports/gstr-1?period=YYYY-MM
```

Response (truncated for brevity — full B2B/B2CL/B2CS arrays):

```json
{
  "gstin": "27AAACA0001Z1Z5",
  "fp": "042026",
  "b2b": [
    {
      "ctin": "27CCCCC0003A1Z5",
      "inum": "INV/2026-04/0001",
      "idt": "22-04-2026",
      "val": "1298.00",
      "pos": "27",
      "rchrg": "N",
      "inv_typ": "R",
      "itms": [
        {
          "num": 1,
          "itm_det": {
            "txval": "900.00",
            "rt": "18",
            "camt": "81.00",
            "samt": "81.00",
            "iamt": "0.00",
            "csamt": "0.00"
          }
        }
      ]
    }
  ],
  "b2cl": [],
  "b2cs": [
    {
      "sply_ty": "INTRA",
      "pos": "27",
      "rt": "5",
      "txval": "5000.00",
      "camt": "125.00",
      "samt": "125.00",
      "iamt": "0.00",
      "csamt": "0.00"
    }
  ],
  "summary": {
    "b2b_count": 1,
    "b2cl_count": 0,
    "b2cs_count": 1,
    "total_taxable": "5900.00",
    "total_cgst": "206.00",
    "total_sgst": "206.00",
    "total_igst": "0.00",
    "total_cess": "0.00",
    "grand_total": "6312.00"
  }
}
```

### 4.2 GSTR-3B

```
GET /reports/gstr-3b?period=YYYY-MM
```

Response:

```json
{
  "gstin": "27AAACA0001Z1Z5",
  "ret_period": "042026",
  "sup_details": {
    "osup_det": {
      "txval": "5900.00",
      "iamt":  "0.00",
      "camt":  "206.00",
      "samt":  "206.00",
      "csamt": "0.00"
    },
    "isup_rev": {
      "txval": "0.00",
      "iamt":  "0.00",
      "camt":  "0.00",
      "samt":  "0.00",
      "csamt": "0.00"
    }
  },
  "itc_elg": {
    "itc_avl": {
      "iamt":  "0.00",
      "camt":  "3900.00",
      "samt":  "3900.00",
      "csamt": "0.00"
    },
    "itc_net": {
      "iamt":  "0.00",
      "camt":  "3900.00",
      "samt":  "3900.00",
      "csamt": "0.00"
    }
  }
}
```

`itc_avl.itc_net = itc_avl.itc_avl − reversals`. Demo doesn't
model reversals; production should subtract any reversed input
GST.

### 4.3 Period close — read

```
GET /period-close
```

Response (when locked):

```json
{
  "lock_before_date": "2026-04-30",
  "locked_at":  "2026-05-01T11:30:00.000Z",
  "locked_by":  "admin@example.com",
  "reason":     "GSTR-3B filed for April 2026"
}
```

Response (unlocked):

```json
{
  "lock_before_date": null
}
```

### 4.4 Period close — set/clear

```
PUT /period-close
Content-Type: application/json

{
  "lock_before_date": "2026-04-30",   // OR null to unlock
  "reason": "GSTR-3B filed for April 2026"
}
```

Returns the new state (same shape as §4.3). Backend MUST:
1. Set `locked_at = now()`, `locked_by = caller.email`.
2. Append an `audit_log` entry with `action = "period_close.set"`
   (or `"period_close.unlock"` when null).
3. Reject if caller lacks `inventory.period_close.write` (403).

---

## §5 Error codes

New code:

- `423 LOCKED` — mutation rejected because document's
  posting_date is on or before the period-close floor.
  Body: `{ "code": "PERIOD_LOCKED", "message": "Posting date 2026-04-15 is in a closed period (locked before 2026-04-30)", "lock_before_date": "2026-04-30" }`

Existing codes reused:
- `400 BAD_REQUEST` — malformed period or date
- `403 FORBIDDEN` — missing `inventory.reports.read` or `period_close.*`

---

## §6 Permissions

Two new codes (already seeded in FE demo fixtures):

```
inventory.period_close.read   — View period-close lock
inventory.period_close.write  — Set or clear period-close lock
```

GSTR endpoints reuse `inventory.reports.read` from Phase 4 —
no new gate.

---

## §7 Tests

1. **GSTR-1 bucket logic** — registered party → B2B; unregistered
   inter-state > ₹2.5L → B2CL; everything else → B2CS.
2. **GSTR-1 B2CS aggregation** — multiple invoices in same
   (sply_ty, pos, rt) collapse into one row.
3. **GSTR-1 cancelled invoices excluded** — only `posted` status
   contributes to the JSON.
4. **GSTR-3B math** — `osup_det.txval` matches sum of
   posted-invoice `subtotal` in period.
5. **Period close — 423 on edit** — attempting to PATCH a
   posted invoice with posting_date < lock_before_date returns
   423 LOCKED.
6. **Period close — 423 on cancel** — `POST /invoices/:id/cancel`
   returns 423 if posting_date is in locked period.
7. **Period close — reads OK** — `GET /reports/profit-loss`
   over a locked period returns 200 with data.
8. **Period close — boundary** — document with `posting_date == lock_before_date`
   IS locked (inclusive boundary).
9. **Period close — audit trail** — every PUT writes an
   audit_log entry with old + new values.

---

## §8 Out of scope (future phases)

- **GSTR-2A / 2B** — read-only feeds from GST portal; need
  GSTN API integration (Phase 7 with e-Invoice IRN).
- **GSTR-9 (annual)** — January 2027 filing; Phase 6 candidate.
- **GSTN API direct upload** — currently CA uploads our JSON to
  the portal. Direct upload requires GSP credentials.
- **Auto-lock on filing** — "lock period the day GSTR-3B is
  marked filed" automation. Manual for now.
- **Granular locks** — locking only invoices but not bills,
  etc. Not requested; current single-lock semantics is enough.
- **Re-open per-document** — "unlock just this one invoice for
  amendment". GSTN amendment returns are the right path; we
  shouldn't add a per-doc bypass.

---

## §9 FE prototype status

| Path                                          | Lines | Notes                              |
|-----------------------------------------------|-------|------------------------------------|
| `services/gstr.service.ts`                    | ~25   | Two methods                        |
| `services/period-close.service.ts`            | ~25   | get + set                          |
| `app/.../reports/gstr-1/page.tsx`             | ~150  | Section cards + summary table      |
| `app/.../reports/gstr-3b/page.tsx`            | ~155  | Two-section preview                |
| `app/.../settings/period-close/page.tsx`      | ~125  | Lock/unlock UI with confirmations  |
| `lib/demo/adapter.ts`                         | +220  | Three new request handlers         |
| `lib/api-constants.ts`                        | +12   | `REPORTS.GSTR_*` and `PERIOD_CLOSE`|
| `types/index.ts`                              | +130  | 5 GSTR types + PeriodCloseConfig   |
| `lib/demo/fixtures.ts`                        | +5    | 2 new permission codes             |
| `components/layout/sidebar.tsx`               | +5    | GSTR sub-items + Period close link |

When backend lands:
1. Set `NEXT_PUBLIC_DEMO_MODE=false`
2. FE hits real endpoints
3. All 3 routes work — no FE redeploy beyond env flip

The `423 LOCKED` handler in `api-client.ts` does not need a
new branch — the existing error normaliser already surfaces
it as `ApiError { status: 423, code: "PERIOD_LOCKED" }`. FE
mutation `onError` callbacks can react to `e.status === 423`
to show a "this period is closed" toast.

---

## §10 Suggested ship sequence

1. **Period close PUT/GET** — small, testable in isolation.
2. **Period close enforcement middleware** — the bigger lift;
   adds the 423 check on every mutation. Critical correctness.
3. **GSTR-3B endpoint** — simpler than GSTR-1 (no per-invoice
   bucketing). Get the response shape right first.
4. **GSTR-1 endpoint** — bucket logic + B2CS aggregation. Lock
   the bucket boundaries with tests (§7.1, §7.2).

Each is independently shippable. Period close should ship FIRST
because it's the most load-bearing for actual production use.
