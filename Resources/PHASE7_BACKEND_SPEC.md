# Phase 7 — Bulk CSV imports (REQ-11) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-02 · FE prototype: complete
Source of truth: paired with `frontend/src/services/imports.service.ts`,
the `/settings/imports` landing, and `/settings/imports/[type]` wizard.

> **Status of paired FE work**: Routes ship as a working prototype
> against in-memory fixtures (`src/lib/demo/adapter.ts`).

---

## §1 Overview

Phase 7 unblocks **going live** by letting tenants bulk-load
the data their previous system already had. Without this, every
day-1 tenant has to enter items, parties, opening stock and
opening balances one row at a time — a non-starter for any
business with more than ~50 SKUs.

| Route                                | Endpoint                        | Purpose                            |
|--------------------------------------|---------------------------------|------------------------------------|
| `/settings/imports`                  | `GET /imports`                  | History (already exists)           |
| `/settings/imports/[type]`           | `GET /imports/template/{type}`  | Download CSV template              |
| `/settings/imports/[type]`           | `POST /imports/preview`         | Validate without persisting        |
| `/settings/imports/[type]`           | `POST /imports/commit`          | Actually create entities           |

Importable entities (Phase 7 launch set):

- `items` — SKU master
- `parties` — customers + suppliers
- `stock_balances` — opening qty_on_hand per item per location
- `opening_balances` — carry-forward AR/AP per party

Future imports (deferred): challans, invoices, payments,
journal entries — none are blocking for go-live.

---

## §2 Critical scope decisions

### 2.1 Two-step preview/commit, not one-shot

Imports always go through `POST /imports/preview` first. The
preview response carries per-row validation; user fixes the CSV
and re-uploads. Only valid rows reach `POST /imports/commit`.

Reason: dependency errors ("brand 'Acme' doesn't exist") and
duplicate keys are far better caught BEFORE any state changes.
Otherwise users get a half-imported list and a panicked support
ticket.

### 2.2 Validation runs server-side, not client

The FE has a tiny CSV parser for upload only. All validation
(required-field checks, enum matching, foreign-key existence,
within-file uniqueness) lives on the backend so we can't drift
between FE and DB rules.

### 2.3 Commit re-validates as last line of defence

Even though preview blessed a row, `commit` runs the same
validator again. Reasons:
- Time gap between preview and commit (user might have changed
  something else in the system).
- Defends against tampered payloads.
- Surfaces unique-violation errors that only the DB knows about.

Re-validation failures land in `errors[]`; they don't roll back
the whole import — partial success is allowed.

### 2.4 Templates are static + drift-locked

The `GET /imports/template/{entity}` endpoint returns the CSV
header row + one example row. The header MUST match the keys the
validator + commit expect; one source of truth in code.

### 2.5 Within-file uniqueness checked at preview

For entities with a unique key (`items.item_code`, `parties.code`),
the preview validator flags duplicates within the SAME upload —
not just against existing DB rows. Two rows with the same
`item_code` get the same error on both rows.

### 2.6 Imports are per-tenant; super admin must use X-Acting-Tenant-Id

All four endpoints respect the standard tenant scoping. Super
admins importing on behalf of a client tenant MUST send the
`X-Acting-Tenant-Id` header.

### 2.7 Numbers and booleans are strings

CSV values are inherently strings. The validator coerces:
- `default_sale_price` / `qty_on_hand` / `amount` — `Number(s)` then validate finite + range
- `is_batch_tracked` / `is_serial_tracked` — accept `"true"`/`"false"`/`"yes"`/`"no"` (case-insensitive)
- Empty string = NULL for optional fields

Reject obvious fat-finger errors (`"Y"` for boolean, `"₹100"` for
price) at the validator level rather than silently coercing.

### 2.8 Period-close interaction (opening_balances only)

`opening_balances` writes synthetic ledger entries dated
`as_of_date`. If `as_of_date <= period_close.lock_before_date`,
the row is rejected with `423 LOCKED` per Phase 5 middleware
semantics. Backend MUST hook the period-close check into the
opening-balances commit path.

---

## §3 Database schema

### 3.1 No new tables

Phase 7 reuses existing entity tables (`items`, `parties`,
`balances`, `ledger_entries`) and the existing `imports` audit
table for history.

### 3.2 Imports audit shape

Existing `imports` table needs the `completed_with_errors`
status added to its enum:

```sql
ALTER TABLE imports
  ADD CONSTRAINT chk_imports_status
  CHECK (status IN ('pending','processing','completed','completed_with_errors','failed'));
```

(FE already extended its TS union — see `settings.service.ts`.)

---

## §4 API Contract

All endpoints require `inventory.imports.write` (preview + commit)
or `inventory.imports.read` (history). Body limits: 5 MB per
upload (~50,000 rows for typical schemas). Larger uploads should
be split into chunks.

### 4.1 GET `/imports/template/{entity}`

Returns plain CSV (Content-Type: `text/csv`), with header row + 1
example data row.

Example for `items`:

```csv
item_code,name,hsn_code,default_sale_price,default_tax_rate_pct,base_uom,brand_code,category_code,is_batch_tracked,is_serial_tracked
EX-001,Sample item,8471,100,18,EACH,,,false,false
```

### 4.2 POST `/imports/preview`

Body:

```json
{
  "entity": "items",
  "rows": [
    {
      "item_code": "LT-200",
      "name": "Laptop 16\" Pro",
      "hsn_code": "8471",
      "default_sale_price": "950",
      "default_tax_rate_pct": "18",
      "base_uom": "EACH",
      "brand_code": "NOVA",
      "category_code": "ELEC",
      "is_batch_tracked": "false",
      "is_serial_tracked": "true"
    }
  ]
}
```

Response (200):

```json
{
  "entity": "items",
  "columns": [
    {"key":"item_code","label":"Item code","required":true,"help":"SKU — must be unique within your tenant"},
    ...
  ],
  "rows": [
    {
      "item_code":"LT-200",
      "name":"Laptop 16\" Pro",
      ...
      "_valid": true
    },
    {
      "item_code":"LT-201",
      "name":"",
      ...
      "_valid": false,
      "_errors": [
        {"row_index":2,"field":"name","message":"Name is required"}
      ]
    }
  ],
  "total_rows": 2,
  "valid_rows": 1,
  "error_rows": 1,
  "errors": [
    {"row_index":2,"field":"name","message":"Name is required"}
  ]
}
```

### 4.3 POST `/imports/commit`

Body:

```json
{
  "entity": "items",
  "rows": [...],            // ONLY valid rows from preview
  "file_name": "items_apr2026.csv"
}
```

Response (201):

```json
{
  "entity": "items",
  "total_rows": 17,
  "created_count": 14,
  "skipped_count": 3,
  "errors": [
    {"row_index":5,"field":"item_code","message":"item_code already exists"}
  ],
  "import_id": "imp-..."
}
```

`import_id` references a row in the existing `imports` audit
table, viewable in the history list.

### 4.4 Per-entity column schemas

#### items
| Column                  | Required | Notes                                                |
|-------------------------|----------|------------------------------------------------------|
| `item_code`             | yes      | Unique within tenant                                 |
| `name`                  | yes      |                                                      |
| `hsn_code`              | no       | 4–8 digit GST classification                         |
| `default_sale_price`    | yes      | Non-negative number                                  |
| `default_tax_rate_pct`  | yes      | One of: 0, 3, 5, 12, 18, 28                          |
| `base_uom`              | yes      | UoM code; must exist in master                       |
| `brand_code`            | no       | Must exist in brand master if provided               |
| `category_code`         | no       | Must exist in category master if provided            |
| `is_batch_tracked`      | no       | `true`/`false`/`yes`/`no`                            |
| `is_serial_tracked`     | no       | `true`/`false`/`yes`/`no`                            |

#### parties
| Column            | Required | Notes                                                  |
|-------------------|----------|--------------------------------------------------------|
| `code`            | yes      | Unique within tenant (e.g. CUS-001)                    |
| `name`            | yes      |                                                        |
| `legal_name`      | no       |                                                        |
| `party_type`      | yes      | One of: customer, supplier, both                       |
| `gstin`           | no       | 15 chars exactly if provided                           |
| `state_code`      | yes      | Exactly 2 digits                                       |
| `phone`           | no       |                                                        |
| `email`           | no       |                                                        |
| `opening_balance` | no       | Number; positive = AR, negative = AP                   |

#### stock_balances
| Column          | Required | Notes                                |
|-----------------|----------|--------------------------------------|
| `item_code`     | yes      | Must exist in items master           |
| `location_code` | yes      | Must exist in locations master       |
| `qty_on_hand`   | yes      | Non-negative number                  |
| `unit_cost`     | yes      | Non-negative number; seeds valuation |

Idempotency: re-uploading overwrites existing balance for that
`(item, location)` pair rather than creating duplicates.

#### opening_balances
| Column        | Required | Notes                                    |
|---------------|----------|------------------------------------------|
| `party_code`  | yes      | Must exist in parties master             |
| `amount`      | yes      | Number; positive = AR, negative = AP     |
| `as_of_date`  | yes      | YYYY-MM-DD; checked against period-close |
| `remarks`     | no       |                                          |

Writes one synthetic ledger entry per row against the party's
`party_receivable` or `party_payable` account.

---

## §5 Error codes

Reused codes:
- `400 INVALID_ENTITY` — entity not in launch set
- `400 BAD_REQUEST` — malformed body, file too large
- `403 FORBIDDEN` — caller lacks `inventory.imports.write` (or `.read` for history)
- `423 LOCKED` — opening-balance row is in a closed period
  (per Phase 5 middleware)

No new error codes. Per-row issues are non-fatal — they appear
in `errors[]` rather than as HTTP errors.

---

## §6 Permissions

Two new codes (already seeded in FE demo fixtures):

```
inventory.imports.read   — View import history
inventory.imports.write  — Run bulk CSV imports
```

Distinct from per-entity write permissions because importing
items / parties / opening balances bypasses the per-entity
create UI; tenants want a separate gate.

---

## §7 Tests

1. **Template round-trip** — download template, upload it
   verbatim, preview shows the example as valid (should pass
   if templates have realistic data).
2. **Required-field error** — missing `name` on items returns a
   row-level error with `field: "name"`.
3. **Enum mismatch** — `party_type: "vendor"` (instead of `supplier`)
   returns a row-level error pointing at the enum.
4. **FK existence** — `brand_code: "DOES_NOT_EXIST"` returns an
   error with the right message.
5. **Within-file dup** — two rows with same `item_code` return
   errors on BOTH rows.
6. **Commit skips invalid** — preview flags rows 2 + 4 as bad;
   commit only persists rows 1, 3, 5 + 6.
7. **Commit re-validates** — race: A creates an item with code
   `LT-200`; B's commit (which preview blessed) hits unique
   violation, returns 201 with that row in `errors[]`.
8. **Stock balance idempotent** — re-uploading the same
   `(item, location)` row overwrites rather than duplicates.
9. **Opening balance writes ledger** — committing a row creates
   exactly one entry against the right account with the right sign.
10. **Period-close blocks opening balance** — try to import
    `as_of_date: "2026-04-15"` when locked-before is `2026-04-30`;
    that row reports a 423 in `errors[]` and is skipped.
11. **Audit trail** — every commit (success or with errors)
    creates a row in `imports` table.

---

## §8 Out of scope (deferred)

- **Excel (.xlsx) uploads** — CSV only for Phase 7. Tenants who
  use Excel can save-as-CSV.
- **Background job processing** — current path is synchronous;
  works fine up to ~5MB / 50K rows. Add a `pending → processing →
  completed` state machine if uploads start blocking the request
  thread.
- **Update mode** (vs insert-only) — Phase 7 inserts only; can't
  bulk-edit existing items via CSV. Add `mode: "upsert"` later.
- **Rollback / undo** — once committed, partial rollbacks need
  manual ledger reversal. We accept this; users who care should
  preview carefully.
- **Real-time progress for large files** — skip until job
  processing exists.
- **Custom field columns** — items may have tenant-defined custom
  fields; importer ignores them in Phase 7.

---

## §9 FE prototype status

| Path                                                | Lines | Notes                          |
|-----------------------------------------------------|-------|--------------------------------|
| `services/imports.service.ts`                       | ~60   | 3 methods                      |
| `app/.../settings/imports/page.tsx`                 | ~140  | Tile grid + history table      |
| `app/.../settings/imports/[type]/page.tsx`          | ~330  | 3-step wizard                  |
| `lib/demo/adapter.ts`                               | +280  | Schemas + validate + commit    |
| `lib/api-constants.ts`                              | +5    | `IMPORTS.TEMPLATE/PREVIEW/COMMIT` |
| `types/index.ts`                                    | +60   | 5 new exported types           |
| `lib/demo/fixtures.ts`                              | +5    | 2 new permission codes         |
| `services/settings.service.ts`                      | +1    | Status union extended          |
| `components/layout/sidebar.tsx`                     | +2    | "Bulk imports" entry           |

When backend lands:
1. Set `NEXT_PUBLIC_DEMO_MODE=false`
2. FE hits real endpoints
3. All 5 import paths work — no FE redeploy beyond env flip

---

## §10 Suggested ship sequence

1. **Template endpoint** — pure read-only; sets the column-schema
   contract that every other endpoint depends on.
2. **Preview endpoint** — validation logic; lock the validator
   semantics in tests (§7.1–§7.5).
3. **Items commit** — start with the most common entity. Land,
   ship, validate the 7-step pattern.
4. **Parties commit** — copy of items pattern.
5. **Stock balances commit** — adds idempotent upsert logic.
6. **Opening balances commit** — most complex (writes to ledger;
   period-close interaction). Ship LAST.

Each entity is independently shippable. Recommended: ship items
+ parties first; stock and opening balances can follow in a
separate PR since they're typically loaded once at go-live.
