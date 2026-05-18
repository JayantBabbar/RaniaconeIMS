# RaniacOne IMS — Backend Implementation Bundle

> **For:** Backend team & their AI coding assistant
> **From:** Frontend team
> **Date:** 2026-05-05
> **Contains:** 1 master roadmap + 13 detailed phase specs

---

## What this bundle is

The frontend has been built **first**, against in-memory demo fixtures. The full UI for invoicing, estimates, money/ledger, payments, expenses, salary, payroll batch, reports, GSTR exports, period close, audit log, bulk imports, SO→invoice promotion, the cost/financials permission split, and versioned item pricing **already works end-to-end in the browser** — what's missing is the backend implementation.

This bundle is the complete contract for catching the backend up.

---

## How to read this — read order matters

### Step 1 — read this README (you're here).

### Step 2 — read `BACKEND_HANDOFF.md` start to finish.

It is the **single master entry point**. It contains:

- §2 — Snapshot of what the backend already has built (auth + inventory routes, optimistic locking, workflow engine, audit log table, etc.). **Don't rebuild things that already exist.**
- §3 — One-paragraph summary of every new domain to build, with a pointer to the detailed phase spec.
- §4 — Build order with a dependency graph and a 5-sprint sequencing recommendation.
- §5 — **Cross-cutting invariants that apply to every phase** (ETag/If-Match, datetime contract, list shapes, audit log writes, the period-close `423 LOCKED` gate, permission grammar, idempotency, the **estimate↔invoice double-decrement invariant**). **Read §5 before writing any code — it answers questions you'd otherwise re-ask 13 times.**
- §6 — Phase index table.
- Appendices A–E — flat reference tables: 40+ permission codes, every new endpoint by resource, every new database table with key columns, every error code with HTTP status, and a 12-point definition-of-done checklist per phase.

### Step 3 — for the phase you're implementing, read its phase spec.

Phase specs are in this same folder. They contain the **line-by-line detail** the master doc omits: payload shapes, GST math worked examples, posting algorithms, SQL constraint specs, unit test cases.

| When you're working on… | Read… |
|---|---|
| Invoices | `INVOICE_BACKEND_SPEC.md` (also `PHASE10_BACKEND_SPEC.md` for SO→invoice promotion) |
| Estimates + routes | `ESTIMATE_BACKEND_SPEC.md` |
| Money, ledger, payments, employees | `PHASE3_BACKEND_SPEC.md` |
| Vendor bills, expenses, salary | `PHASE3_5_BACKEND_SPEC.md` |
| Reports (sales reg, purchase reg, aging, P&L) | `PHASE4_BACKEND_SPEC.md` |
| GSTR-1 / GSTR-3B / period close | `PHASE5_BACKEND_SPEC.md` |
| Payroll batch | `PHASE6_BACKEND_SPEC.md` |
| Bulk imports | `PHASE7_BACKEND_SPEC.md` |
| Cash flow statement | `PHASE8_BACKEND_SPEC.md` |
| Audit log read API | `PHASE9_BACKEND_SPEC.md` |
| Cost/financials visibility split + GRN↔Bill matching | `PHASE12_BACKEND_SPEC.md` |
| Item dimensions + versioned pricing | `PHASE13_BACKEND_SPEC.md` |
| Per-party pricing + Estimate→Invoice 2× rule + GST on Category (2026-05-13) | `PARTY_PRICING_BACKEND_SPEC.md` + `ESTIMATE_BACKEND_SPEC.md` §5.8 |

> Phase 11 is **deliberately absent** — it was a frontend-only sidebar refactor with no backend implications.

---

## Recommended sprint sequencing

Per `BACKEND_HANDOFF.md` §4. Each sprint is self-contained: read the handoff, then **only the phase specs that sprint needs**.

| Sprint | Phases | Specs to load |
|---|---|---|
| 1 | Pricing/dimensions + Invoices + Estimates | `BACKEND_HANDOFF.md` + `PHASE13_BACKEND_SPEC.md` + `INVOICE_BACKEND_SPEC.md` + `ESTIMATE_BACKEND_SPEC.md` |
| 2 | Money/ledger + AP completion | `BACKEND_HANDOFF.md` + `PHASE3_BACKEND_SPEC.md` + `PHASE3_5_BACKEND_SPEC.md` |
| 3 | Cost/financials split + GRN↔Bill matching | `BACKEND_HANDOFF.md` + `PHASE12_BACKEND_SPEC.md` |
| 4 | Reports + cash flow + SO→invoice promotion | `BACKEND_HANDOFF.md` + `PHASE4_BACKEND_SPEC.md` + `PHASE8_BACKEND_SPEC.md` + `PHASE10_BACKEND_SPEC.md` |
| 5 | Compliance (GSTR + period close) + payroll batch + imports + audit log | `BACKEND_HANDOFF.md` + `PHASE5_BACKEND_SPEC.md` + `PHASE6_BACKEND_SPEC.md` + `PHASE7_BACKEND_SPEC.md` + `PHASE9_BACKEND_SPEC.md` |
| 6 | Per-party pricing + Estimate→Invoice 2× rule + GST on Category | `BACKEND_HANDOFF.md` + `PARTY_PRICING_BACKEND_SPEC.md` + `ESTIMATE_BACKEND_SPEC.md` |

**Anti-patterns to avoid** (also in handoff §4):
- Don't start Phase 5 (period close) before Phase 3 — there's nothing to lock.
- Don't start Phase 4 reports before Phase 3.5 — P&L sources from expenses/salary.
- Don't start Phase 6 before single-entry salary works end-to-end (Phase 3.5).
- Don't start Phase 12 until vendor_bills exist (Phase 3.5).

---

## If you're handing this to Claude Code (or another AI assistant)

Copy-paste prompt template for sprint 1, adapt for later sprints:

```
You are implementing the backend for the RaniacOne IMS, a multi-tenant
inventory management system for Indian distribution businesses.

Your task is Sprint 1: implement Phase 13 (item dimensions + versioned
pricing rules), Phase 2 (invoices), and Phase 2.5 (estimates + routes).

Read these files in order before writing any code:
  1. README.md (this folder)
  2. BACKEND_HANDOFF.md (master roadmap)
  3. PHASE13_BACKEND_SPEC.md
  4. INVOICE_BACKEND_SPEC.md
  5. ESTIMATE_BACKEND_SPEC.md

Hard rules:
  - The phase spec wins on disagreement with the handoff doc.
  - Do not rebuild what's already built — see handoff §2 for the snapshot.
  - Cross-cutting invariants (handoff §5) apply: ETag/If-Match,
    period-close gate, audit log writes, list-shape envelope.
  - The estimate↔invoice double-decrement invariant (handoff §5.10) is
    load-bearing — if you implement post() wrong, stock corrupts.
  - GST math must match the FE's gst.ts to the rupee.
  - All new permissions seeded via migration; see handoff Appendix A.

Backend stack: FastAPI + SQLAlchemy + Alembic + Postgres. Inventory
service is at packages/inventory/. Auth at packages/auth/. Match
the existing patterns from /items, /parties, /documents.
```

For later sprints, swap the file list and the "Your task is" line.

---

## When the spec and code disagree

Authority order, highest first:

1. **The frontend prototype** at `raniacone-warehouse/frontend/src/` — if a phase spec describes one thing but the FE does another, the FE is right (we sometimes update behavior faster than docs).
2. **The phase spec** — line-by-line contract.
3. **The handoff doc** — high-level roadmap.

If something blocks you, file a GitHub issue on `raniacone/raniacone-dev-frontend` tagged `backend-handoff` and link the spec line + the FE source path.

---

## What's in this bundle

```
backend-bundle/
├── README.md                       ← you are here
├── BACKEND_HANDOFF.md              ← master roadmap (read second)
├── INVOICE_BACKEND_SPEC.md         ← Phase 2
├── ESTIMATE_BACKEND_SPEC.md         ← Phase 2.5
├── PHASE3_BACKEND_SPEC.md          ← Money / ledger / payments / employees
├── PHASE3_5_BACKEND_SPEC.md        ← Bills / expenses / salary
├── PHASE4_BACKEND_SPEC.md          ← Reports / aging / P&L
├── PHASE5_BACKEND_SPEC.md          ← GSTR-1 / GSTR-3B / period close
├── PHASE6_BACKEND_SPEC.md          ← Payroll batch
├── PHASE7_BACKEND_SPEC.md          ← Bulk imports
├── PHASE8_BACKEND_SPEC.md          ← Cash flow statement
├── PHASE9_BACKEND_SPEC.md          ← Audit log read API
├── PHASE10_BACKEND_SPEC.md         ← SO → Invoice promotion
├── PHASE12_BACKEND_SPEC.md         ← Cost/financials split + GRN↔Bill matching
├── PHASE13_BACKEND_SPEC.md         ← Item dimensions + versioned pricing
└── PARTY_PRICING_BACKEND_SPEC.md   ← Per-party costs/prices + Estimate→Invoice 2× rule
```

That's it. No source code in this bundle (deliberately — the FE prototype lives in the FE repo; this bundle is the contract, not the implementation).

---

## Definition of done (per phase)

A phase is "done" — i.e. the FE will switch from demo adapter to your real endpoints — when **all 12 items in `BACKEND_HANDOFF.md` Appendix E** are true. Brief recap:

migrations applied · routes mounted · permissions seeded · ETag/If-Match enforced · audit-log writes wired · period-close gate respected · datetime/date contract honoured · list-envelope shape · pagination clamped · OpenAPI published · tests covering worked examples · phase smoke test passing

The smoke test scripts live at `frontend/scripts/smoke-test-api.sh` and `smoke-test-api-spa.sh`. Once your endpoints land, the FE team will run them against your dev environment and report back.

Good luck. Ship safely.
