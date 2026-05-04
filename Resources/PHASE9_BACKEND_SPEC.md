# Phase 9 — Audit log viewer (REQ-13) — Backend Spec

Owner: Backend dev · Drafted: 2026-05-02 · FE prototype: complete

> Pairs with `frontend/src/services/audit-log.service.ts` and
> `/admin/audit-log` page.

---

## §1 Overview

Read-only view over the `audit_log` table that backend writes
synchronously on every critical action. The FE never writes audit
entries; entries are written by the action handler as part of the
same transaction so partial-write bugs can't lose audit info.

Single endpoint:

```
GET /audit-log
  ?user_id=<uuid>
  &action=<dotted-code-or-prefix>
  &entity_type=<table>
  &start_date=YYYY-MM-DD
  &end_date=YYYY-MM-DD
  &limit=<int>            (default 50, max 200)
```

Permission: `inventory.audit_log.read`.

---

## §2 Critical scope decisions

### 2.1 Append-only, immutable

`audit_log` rows are NEVER updated or deleted. The table has no
`UPDATE` or `DELETE` privileges granted to the application user
(enforce at PostgreSQL role level).

### 2.2 Written inline with the action

Audit entries live in the same transaction as the action they
record. If the action rolls back, the audit entry rolls back too.
This avoids the "half-audit-half-action" failure mode where
something happened but you can't prove it.

### 2.3 Action codes are dotted

`<resource>.<verb>` — examples:

```
invoice.post / invoice.cancel / invoice.create / invoice.update
vendor_bill.post / vendor_bill.cancel
challan.post / challan.cancel / challan.promote
payment.post / payment.cancel / payment.deposit
expense.post / expense.cancel
salary.post / salary.cancel / salary.batch.generate / salary.batch.post
period_close.set / period_close.unlock
import.commit
role.create / role.update / role.delete / role.permission_grant / role.permission_revoke
user.create / user.update / user.deactivate / user.password_reset
```

The FE filter accepts EXACT match OR a prefix ending in `.`
(e.g. `invoice.` matches all four invoice variants).

### 2.4 before/after JSON snapshots

For mutations, `before` is the old row; `after` is the new row.
For creates: `before = null`; for hard deletes: `after = null`.
For tenant-level actions (period close): both are domain-specific
JSON (see examples in §4).

Snapshots can be lossy on huge rows (truncate at 64 KB per side
to keep the table sane). Include a `_truncated: true` marker if
truncated.

### 2.5 IP + UA for forensics

Captured at request time from the load balancer headers
(`X-Forwarded-For`, `User-Agent`). Stored as plain strings.

---

## §3 Database schema

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  user_email TEXT,                  -- denormalised for fast list queries
  action TEXT NOT NULL,             -- dotted code
  entity_type TEXT,                 -- e.g. 'invoice'
  entity_id UUID,                   -- nullable for tenant-level
  before JSONB,
  after JSONB,
  remarks TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_created
  ON audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_action_prefix
  ON audit_log (tenant_id, action text_pattern_ops, created_at DESC);
CREATE INDEX idx_audit_log_entity
  ON audit_log (tenant_id, entity_type, entity_id);
```

Drop privileges to insert-only at the role level:

```sql
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
GRANT SELECT, INSERT ON audit_log TO app_role;
```

---

## §4 API Contract

Response (200) — list of entries newest-first:

```json
[
  {
    "id": "audit-...",
    "tenant_id": "tenant-...",
    "user_id": "user-...",
    "user_email": "admin@example.com",
    "action": "invoice.post",
    "entity_type": "invoice",
    "entity_id": "inv-2",
    "before": { "status": "draft" },
    "after":  { "status": "posted", "posting_date": "2026-04-21T10:30:00Z" },
    "remarks": null,
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/5.0",
    "created_at": "2026-04-21T10:30:00.000Z"
  },
  {
    "action": "period_close.set",
    "entity_type": null,
    "entity_id": null,
    "before": { "lock_before_date": null },
    "after":  { "lock_before_date": "2026-04-30", "reason": "GSTR-3B filed" },
    "...": "..."
  }
]
```

Filter contract:
- `action` — exact match if no trailing `.`; prefix match if it
  ends in `.` (e.g. `invoice.`).
- `start_date` / `end_date` — inclusive YYYY-MM-DD; compared
  against `created_at::date`.
- `limit` — clamped to ≤200.

---

## §5 Tests

1. Insert action → row visible via GET (same transaction commit).
2. Action rollback → no audit entry persists.
3. Filter by action prefix `invoice.` matches `invoice.post` AND
   `invoice.cancel`.
4. Date range filter inclusive on both ends.
5. UPDATE rejected at DB role level (assert privilege).
6. DELETE rejected at DB role level.
7. Cross-tenant isolation — caller in tenant A can't see tenant B's
   entries.

---

## §6 Out of scope

- Mutation of audit entries (by design)
- Real-time push to a SIEM (export-only for now)
- Per-row diff highlighting beyond before/after JSON
- Automatic retention / pruning (logs grow forever; revisit at scale)

---

## §7 FE prototype status

- `services/audit-log.service.ts` — single `list` method
- `app/(dashboard)/admin/audit-log/page.tsx` — filterable timeline
  with expandable before/after diff viewer
- `lib/demo/adapter.ts` — GET handler with prefix-match filter
- `lib/demo/fixtures.ts` — 6 sample entries spanning common actions
- `types/index.ts` — `AuditLogEntry`
- `lib/api-constants.ts` — `AUDIT_LOG.LIST`
- `components/layout/sidebar.tsx` — "Audit log" entry under Admin
- New permission: `inventory.audit_log.read`

When backend lands: set `NEXT_PUBLIC_DEMO_MODE=false`.
