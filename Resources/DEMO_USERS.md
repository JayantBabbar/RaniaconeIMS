# Demo Users — Role Guide

The demo ships with four pre-seeded login accounts that cover every permission tier in the system. All accounts use the password **`demo123`**. This document explains who each persona is, what they can and cannot do, and which screens to visit to see their role in action.

> **Demo mode caveat:** any changes made during a demo session live in browser memory only. Refreshing the page resets the world to the seeded state. No data is sent to a backend.

---

## Quick reference

| Email | Password | Role | Tier | Scope |
| --- | --- | --- | --- | --- |
| `superadmin@demo.com` | `demo123` | Platform Super Admin | 1 | All tenants |
| `admin@demo.com` | `demo123` | Tenant Administrator | 2 | One tenant (Acme Trading Co.) |
| `ops@demo.com` | `demo123` | Warehouse Operator | 3 | One tenant, RBAC-restricted |
| `viewer@demo.com` | `demo123` | Viewer | 3 | One tenant, read-only |

---

## 1. `superadmin@demo.com` — Platform Super Admin

**Who:** Someone running the SaaS platform itself — typically the vendor's own ops/support team. Not an employee of any tenant company.

**What they see:** A completely different navigation tree. Signing in routes straight to **`/platform/overview`** instead of the regular dashboard. The left sidebar shows platform-wide sections:

- **Platform Overview** — tenant count, health, activity rollup
- **Tenants** — list of every customer on the platform (Acme Trading Co., Meridian Pharma, +1)
- **Users (Platform)** — cross-tenant user directory
- **Currencies** — the shared ISO 4217 catalog all tenants draw from
- **Health** — service uptime, DB connectivity, feature flags

**What they can do:**
- Create new tenants and provision their base currency + plan
- Activate/deactivate any tenant
- Impersonate any tenant by picking it from the tenant selector — the app then re-renders as if they were a Tier 2 admin inside that tenant
- View (but *not* directly edit) any tenant's business data — they must impersonate to do so
- Manage the global currency catalog

**What they cannot do:**
- Cannot perform day-to-day warehouse operations (receive stock, post documents) from their own account — those live at the tenant level. They have to impersonate first.

**Best demo flow:** log in → land on Platform Overview → open **Tenants** → click on Acme Trading Co. → show how they could drill into that tenant's configuration or impersonate an admin there.

---

## 2. `admin@demo.com` — Tenant Administrator (Priya Sharma)

**Who:** The power-user inside a customer company. In this demo they're tied to **Acme Trading Co.** Every permission within that tenant is granted; zero permissions outside it.

**What they see:** The full dashboard. Every menu item in the sidebar is visible and clickable — no grayed-out rows, no "forbidden" states.

**What they can do (everything inside Acme's walls):**
- **Master data:** create/edit items, categories, brands, units of measure, status codes, number series, document types
- **Inventory operations:** receive stock, issue stock, transfer between locations, post documents, cancel documents, apply counts, reserve stock
- **Catalog:** manage parties (customers + suppliers), warehouse locations, bins, lots, serials, reorder policies
- **Administration:** invite users, create/edit roles, assign permissions, configure modules, set tenant-wide preferences, manage integrations and webhooks, view audit log
- **Settings:** tenant config, module config, custom field definitions, workflows

**What they cannot do:**
- Cannot see other tenants. The platform navigation (Tenants / Platform Overview / Currencies management) is simply not in their sidebar.
- Cannot change their own tenant's plan tier or base currency — those are provisioned at the platform level.

**Best demo flow:** log in → show the rich dashboard with stock levels and alerts → go to **Items** → create one → go to **Documents → Purchase Orders** → create and post one → go to **Admin → Users** → show the full RBAC surface (add user, assign role).

---

## 3. `ops@demo.com` — Warehouse Operator (Arun Kumar)

**Who:** A floor-level employee inside Acme Trading Co. — the person actually moving stock around. Purpose of this persona: demonstrate **RBAC gating** on the same tenant as the admin. Side-by-side with admin@demo they prove the permission system isn't just cosmetic.

**What they see:** A narrower sidebar. Sections like **Admin**, **Settings → Roles**, **Settings → Integrations** simply aren't visible. Action buttons on pages they *can* visit (e.g., the "Create Category" button on Master Data → Categories) are hidden because they lack write permission there.

**What they can do:**
- Read everything within inventory (items, locations, balances, parties, documents, counts, lots, serials, reservations, valuation)
- Write the operational stuff:
  - Record stock **movements** (receive / issue / transfer)
  - Create, post, and cancel **documents** (POs, SOs, transfer orders)
  - Perform and apply **stock counts**
  - Create and manage **reservations**
  - Edit **lots** and **serials** (expiry dates, warranty attributes)

**What they cannot do:**
- Cannot touch master data, users, roles, or system settings. Those screens either don't appear in their nav, or appear as read-only with a "You don't have permission to modify this" notice where a create button would be.
- Cannot see the admin or settings sections.

**Best demo flow:** log in → compare the sidebar to what admin@ sees → go to **Movements → New** → record a receipt → go to **Master Data → Categories** and show the create button is *gone* → try navigating directly to `/admin/users` and hit the forbidden screen. This is where the security story lands.

---

## 4. `viewer@demo.com` — Viewer (Meera Iyer)

**Who:** A stakeholder who needs visibility but should never change anything — auditor, finance reviewer, external consultant, or a manager who just wants dashboards. Inside Acme Trading Co.

**What they see:** Every read-only screen in the inventory module. The sidebar shows the same operational sections as the operator, but every action button is hidden or disabled.

**What they can do:**
- Read-only access to *everything* operational: items, parties, locations, balances, documents, counts, lots, serials, valuation, movements, reservations
- Can open any detail page and see full records
- Can filter, sort, search, and export any table (the table toolkit is fully functional — it's a read operation)

**What they cannot do:**
- Cannot create, edit, or delete anything. Every "New", "Edit", and action-menu trash icon is hidden.
- Cannot post, cancel, or modify documents — the workflow buttons on a document detail page are not rendered.
- Cannot see admin/settings screens at all.

**Best demo flow:** log in → walk through the Dashboard → open a document → show the detail view is fully accessible → point out that the "Post" and "Cancel" buttons admin@ had are simply not there → go to **Valuation** to show financial read access without edit risk.

---

## Side-by-side comparison

| Capability | Super Admin | Admin | Operator | Viewer |
| --- | :---: | :---: | :---: | :---: |
| See platform-wide data | ✅ | — | — | — |
| Manage tenants / currencies | ✅ | — | — | — |
| Impersonate a tenant | ✅ | — | — | — |
| View inventory data | via impersonate | ✅ | ✅ | ✅ |
| Create / edit items | via impersonate | ✅ | — | — |
| Manage master data | via impersonate | ✅ | — | — |
| Record movements | via impersonate | ✅ | ✅ | — |
| Post / cancel documents | via impersonate | ✅ | ✅ | — |
| Perform stock counts | via impersonate | ✅ | ✅ | — |
| Manage users / roles | via impersonate | ✅ | — | — |
| Configure integrations / webhooks | via impersonate | ✅ | — | — |
| Edit tenant settings | via impersonate | ✅ | — | — |

---

## Suggested 10-minute demo script

1. **Open fresh tab → log in as `admin@demo.com`** *(2 min)* — tour the dashboard, show the rich populated data, click through Items → detail page, open a Purchase Order.
2. **Sign out → log in as `ops@demo.com`** *(3 min)* — note the narrower sidebar. Go to Movements → New and actually record a stock receipt. Try clicking the "New Category" button on Master Data → Categories (it isn't there). Navigate manually to `/admin/users` — get the forbidden page.
3. **Sign out → log in as `viewer@demo.com`** *(2 min)* — show the same pages with no action buttons. Everything is exportable and searchable but nothing is writable.
4. **Sign out → log in as `superadmin@demo.com`** *(3 min)* — totally different navigation. Show the Tenants list. Show the platform Overview. Show that the base currency catalog is managed here, not by tenants.

---

## FAQ

**Q: Can I change a demo user's password?**
No — they're hard-coded in `src/lib/demo/fixtures.ts` (`DEMO_PASSWORDS`). Changes made to a profile during a demo session won't affect the password.

**Q: What happens if I try to log in with `alumni@demo.com`?**
It fails with "Account is inactive". That account is seeded as deactivated specifically so the admin can demonstrate how deactivation works in the Users list.

**Q: Do changes persist between users?**
Only within the same browser tab, until reload. If you create an item as `admin@demo.com`, then sign out and back in as `viewer@demo.com`, the item will still be there — but only until you refresh.

**Q: Can I use custom emails?**
No. Only the four listed addresses + `alumni@demo.com` are recognized. Any other email returns "Invalid credentials".
