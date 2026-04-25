# Workflow — Platform Super Admin

A workflow guide for the Raniacone employee who manages the platform itself.

> See also: [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md) for technical context, [USER_MANUAL.md](USER_MANUAL.md) for screen-by-screen reference, [DEMO_USERS.md](DEMO_USERS.md) for the demo persona (`superadmin@demo.com`).

---

## Who you are

You're a Raniacone team member — sales engineer, customer success, on-call ops, or platform admin. You don't belong to any one customer's workspace. Your job is to **provision tenants, support them, and keep the platform healthy**.

When you sign in, your JWT carries `is_super_admin: true` and `tenant_id: null`. Every endpoint in the system recognises you as a platform-wide actor.

---

## What this guide covers

The five recurring workflows you actually do:

1. [Provisioning a new tenant from scratch](#workflow-1--provisioning-a-new-tenant)
2. [Onboarding a tenant's first admin user](#workflow-2--onboarding-the-first-tenant-admin)
3. [Helping a tenant who's locked out (password reset)](#workflow-3--password-reset-for-a-tenant-user)
4. [Cross-tenant directory & support queries](#workflow-4--cross-tenant-directory--support-queries)
5. [Platform health & operational triage](#workflow-5--platform-health--operational-triage)

---

## Workflow 1 — Provisioning a new tenant

**Trigger:** Sales closes a deal. You receive: company name, intended tenant code, base currency, plan tier, and the first admin's name + email.

### Steps

1. **Sign in** → you land on `/platform/overview`.
2. Sidebar → **Tenants** → top-right **+ New Tenant**.
3. Fill the provisioning form:
   - **Name** — the customer's display name (e.g. "Acme Trading Co.").
   - **Code** — short URL/header-safe slug (e.g. `acme`). Letters, digits, hyphens, underscores only. Cannot be changed later.
   - **Base currency** — pick from the ISO 4217 dropdown. The customer's books will be in this currency forever.
   - **Plan** — Free / Pro / Enterprise. Drives module subscriptions.
   - **Timezone** — IANA name (e.g. `America/New_York`). Their reports default to this timezone.
4. Click **Create**. The tenant is created. You're redirected to its detail page (`/platform/tenants/<id>`).
5. Verify the tenant card shows the right name, code, currency, and an **Active** status badge.

### What you conclude in

- A new row in `tenants` table.
- The tenant has zero users, zero items, zero anything else — just an empty workspace.
- An audit row recording you (the super admin) as the creator.
- The tenant cannot yet be used — no one can sign in. Continue to **Workflow 2** to onboard their first admin.

### Edge cases

| Situation | What to do |
| --- | --- |
| Code already in use | The form rejects with `DUPLICATE_CODE`. Pick a different code (add `-uk`, `-2026`, etc.). |
| Currency you need isn't in the list | Tenants pick from the platform-managed currency catalog. To add a new currency, go to **Currencies** → **+ New Currency** (yes, there's a button — but don't add custom currencies casually; use ISO codes only). |
| Customer wants to change base currency later | Not supported via UI. Open a backend ticket with the change request. Migrating valuation layers is non-trivial. |

---

## Workflow 2 — Onboarding the first tenant admin

**Trigger:** Workflow 1 just completed, or a customer tells you their existing admin left and they need a new one.

### Steps

1. From the tenant detail page (`/platform/tenants/<id>`), find the **Users in this tenant** card.
2. Click **+ Register first admin** (or use **Platform Users** sidebar → **+ Register Platform User** if you're already there).
3. In the modal:
   - **Mode** — pick "Tenant user" (not Super Admin, unless this person is also part of your team).
   - **Tenant** — pre-filled with the tenant you're inside; otherwise pick from the dropdown.
   - **Email** — the new admin's email.
   - **Full name** — their full name.
   - **Password** — a temporary one (8+ chars). They'll change it on first sign-in.
4. Submit. The user is created in that tenant.

### Granting them admin permissions

The user starts with zero roles. They need the system **Administrator** role assigned (which carries every permission).

The easy path: the user logs in, but they'll see empty pages because they have no permissions. So instead **you** assign the role for them:

- Currently, role-assignment for users in another tenant requires you to be acting in that tenant. Two options:
  - **Quick path** — sign in as super admin, hit `POST /users/<uid>/roles` with `X-Acting-Tenant-Id: <tid>` and body `{ "role_id": "<admin-role-id>" }` via curl/Postman. The backend §4 25-apr update lets this work.
  - **UI path** — the role-assignment screen for cross-tenant SPA flows isn't fully built yet. Until it is, the curl/Postman path is the documented workaround.

### What you conclude in

- A new user row with `tenant_id = <the tenant>`, an active flag, and a known temporary password.
- The user can sign in but sees nothing until they have the admin role assigned.
- An audit log entry showing you provisioned the user.

### Handover

Send the customer (via secure channel — password manager, encrypted email, in-person):

```
URL: https://app.raniacone.com    (or whatever your deployment URL is)
Email: priya@acme-trading.com
Temporary password: <the temp pwd>
First-time login: please go to avatar → Change password and set your own.
Documentation: <link to USER_MANUAL.md>
```

---

## Workflow 3 — Password reset for a tenant user

**Trigger:** A customer admin emails / Slacks you saying "I forgot my password" or "one of my employees is locked out and I can't log in to reset them."

### Path A — Reset from cross-tenant directory

Best when the customer told you the user's email but not which tenant.

1. Sidebar → **Platform Users**.
2. Use **Global search** at the top to find the user by name/email.
3. On the user's row, click the **⋯ action menu** at the right.
4. Click **Reset password**.
5. Modal opens. Enter a new password (8–128 chars), confirm.
6. Submit.
7. Toast confirms success.

### Path B — Reset from a specific tenant

Best when you're already on the tenant's detail page and want to reset one of its users.

1. **Platform → Tenants** → click the tenant.
2. Find the user in the **Users in this tenant** card.
3. Click the **⋯ action menu** → **Reset password**.
4. Same modal, same flow.

### What you conclude in

- The user's password hash is replaced.
- **Every active refresh token** for that user is revoked server-side. They're signed out of every device immediately.
- An audit row: `action = "ADMIN_RESET_PASSWORD"`, `changed_by = <your user id>`, `tenant_id = <target's tenant>`.
- A 204 response, no body. The frontend toast confirms.

### Handover

Share the new password with the customer through a **secure channel only**:

- Company password manager (1Password, Bitwarden) — preferred.
- Encrypted message (Signal, secure email) — acceptable.
- In-person — fine.
- **Never** plain email, plain Slack DM in an open workspace, or SMS.

Always tell them: "This is a temporary password. Sign in and immediately go to Account → Change Password to set one only you know."

---

## Workflow 4 — Cross-tenant directory & support queries

**Trigger:** Sales asks "how many users does Acme have?", or support asks "is this user actually a customer admin or just a viewer?", or auditing asks "show me every user added in the last 30 days across all tenants."

### Steps

1. Sidebar → **Platform Users**. The page calls `userService.listByTenant(t.id)` for every tenant in parallel and aggregates.
2. Use the table toolkit to slice:
   - **Global search** — name, email, tenant name.
   - **Per-column filter** on `Tenant` → multi-select to scope to specific customers.
   - **Per-column filter** on `Super admin` → boolean to find all super admins.
   - **Sort** by Created date → see most-recent additions.
   - **KPIs at top** — Total Users, Super Admins, Tenant Users, Active.
3. To export: not yet a button — use the table copy/screenshot for now.

### What you conclude in

- No mutations occur. This is a read-only view.
- Every API call carries `X-Acting-Tenant-Id` for the SPA → audit log records "platform user listing access" (auditable but non-destructive).

### Common queries you can answer from here

| Question | How |
| --- | --- |
| "How many active users does Acme have?" | Filter Tenant=Acme + Active=Yes → KPI card "Total" updates live. |
| "Has this email signed up anywhere?" | Global search the email. |
| "Which tenants don't have any users yet?" | Each tenant shows its user count in **Tenants** sidebar. Empty ones stand out. |
| "Are there orphaned users (tenant_id = null)?" | Backend §4 fix should prevent this; if any show up with no `_tenant`, file an issue. |

---

## Workflow 5 — Platform health & operational triage

**Trigger:** A customer reports the app is slow / down / showing errors. Or you're on-call and got an alert.

### Steps

1. Sidebar → **System Health**.
2. Check the four KPI cards at the top:
   - **API Status** — should be "OK". Down means the auth or inventory service isn't responding.
   - **Database** — should be "OK". Anything else means PostgreSQL is unreachable.
   - **Avg Latency** — should be < 200ms. > 1000ms is bad.
   - **Uptime (session)** — percentage of recent checks that passed.
3. Scroll to the **Per-check breakdown** — Auth Service, Inventory Service, individual probes. Any "down" status badge here narrows the failure.
4. Cross-reference with your infrastructure dashboards (Grafana, CloudWatch, whatever the team uses) — System Health is a quick first-look, not a replacement for proper observability.

### Triage steps based on what's red

| What's down | First thing to check |
| --- | --- |
| Auth service (:8000) | Is the `auth` container running? `docker compose ps`. Logs: `docker compose logs -f auth`. |
| Inventory service (:8001) | Same as above for `inventory`. |
| Database | Is Postgres up? Is the connection pool exhausted? Check `pg_stat_activity`. |
| Latency high but everything green | Check for slow queries, long-running migrations, or a noisy neighbour on the box. |

### What you conclude in

- No mutations from this page — read-only monitoring.
- If you confirm an outage: post in your team's incident channel, page on-call, follow your incident response runbook.
- If everything is green but the customer still reports issues: it's likely a per-tenant data problem. Pick up Workflow 4 to investigate their user / state.

---

## What you cannot (and should not) do

These are NOT super admin responsibilities — escalate to the right party instead.

| You cannot | Who can / what to do |
| --- | --- |
| Receive stock, post POs/SOs, run counts | Only tenant users. To "see what they see", reset a tenant admin's password and sign in as them with consent. |
| Change a tenant's base currency | Open a backend ticket. Currency migration is non-trivial because of FIFO valuation layers. |
| Bulk-delete a tenant's data | Use the **Delete tenant** action only after written confirmation from the customer and a backup. |
| Approve someone else's documents | Workflow approvals are tenant-internal. SPA shouldn't override tenant business processes. |
| See a user's actual current password | Passwords are bcrypt-hashed. You can only **set a new one** via the reset flow. |

---

## Daily / weekly checklist

| Cadence | Action |
| --- | --- |
| Daily (when on call) | Sign in → glance at System Health KPIs → confirm green. |
| Weekly | Skim **Tenants** for any in `inactive` status — investigate why. Skim **Platform Users** for any tenant_id=null orphans (shouldn't happen post §4 fix). |
| Per ticket | When a customer asks for help, do the workflow above; document what you did in the ticket; never share passwords through unsecured channels. |
| Per quarter | Audit super admin role assignments. Anyone who left the company should have their account deactivated. |

---

## Suggested learning path

1. Read [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md) §3 (architecture) and §4 (modules) — not all of it, just enough that you know what each tenant module is.
2. Sign in to demo mode (`superadmin@demo.com` / `demo123`) and run through Workflows 1–4 in a sandbox.
3. Bookmark [USER_MANUAL.md](USER_MANUAL.md) — when a customer asks "where's the X button?", you can answer from this doc instead of opening the app.
4. Familiarise yourself with the audit log schema (in `BACKEND.md` §10) — that's where you go when something weird happened and you need to figure out who did what.
