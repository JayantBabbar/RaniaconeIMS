// ═══════════════════════════════════════════════════════════════════
// Demo fixtures — realistic seed data for a live clickable demo.
//
// Scope: enough to make every page in the app look populated and let
// the client click through basic flows (create an item, post a
// document, browse balances, see RBAC behavior across personas).
//
// Data is mutated in place by the mock adapter — refresh the page to
// reset. There's no persistence.
// ═══════════════════════════════════════════════════════════════════

// ── Stable UUID-like helpers ─────────────────────────────────────

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  // Stable-enough "uuid" for demo purposes.
  return `${prefix}-${seq.toString(36).padStart(6, "0")}-${Date.now().toString(36)}`;
}

const now = () => new Date().toISOString();
const iso = (daysAgo = 0) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();

// ── Tenants ──────────────────────────────────────────────────────

export const TENANTS = [
  {
    id: "tenant-demo-1",
    name: "Nova Bond Industries",
    code: "novabond",
    status: "active",
    base_currency_id: "cur-inr",
    timezone: "Asia/Kolkata",
    plan: "pro",
    // Nova Bond is an Aluminum Composite Panel (ACP) manufacturer based
    // in Maharashtra. State 27 drives GST place-of-supply math — sales
    // within MH are intra-state (CGST+SGST), sales elsewhere are
    // inter-state (IGST). See src/lib/gst.ts.
    state_code: "27",
    gstin: "27AAACN0042Z1Z3",
    created_at: iso(120),
    updated_at: iso(5),
  },
  {
    id: "tenant-demo-2",
    name: "Meridian Pharma",
    code: "meridian",
    status: "active",
    base_currency_id: "cur-inr",
    timezone: "Asia/Kolkata",
    plan: "enterprise",
    created_at: iso(90),
    updated_at: iso(2),
  },
  {
    id: "tenant-demo-3",
    name: "Bluewave Retail",
    code: "bluewave",
    status: "trialing",
    base_currency_id: "cur-eur",
    timezone: "Europe/London",
    plan: "trial",
    created_at: iso(14),
    updated_at: iso(14),
  },
];

export const DEMO_TENANT_ID = TENANTS[0].id;

// ── Currencies ───────────────────────────────────────────────────

export const CURRENCIES = [
  { id: "cur-usd", code: "USD", name: "US Dollar",         symbol: "$",  decimal_precision: 2, created_at: iso(200), updated_at: iso(200) },
  { id: "cur-eur", code: "EUR", name: "Euro",              symbol: "€",  decimal_precision: 2, created_at: iso(200), updated_at: iso(200) },
  { id: "cur-gbp", code: "GBP", name: "British Pound",     symbol: "£",  decimal_precision: 2, created_at: iso(200), updated_at: iso(200) },
  { id: "cur-inr", code: "INR", name: "Indian Rupee",      symbol: "₹",  decimal_precision: 2, created_at: iso(200), updated_at: iso(200) },
  { id: "cur-jpy", code: "JPY", name: "Japanese Yen",      symbol: "¥",  decimal_precision: 0, created_at: iso(200), updated_at: iso(200) },
];

// ── Modules + subscriptions ─────────────────────────────────────

export const MODULES = [
  { id: "mod-inv", code: "inventory", name: "Inventory Management", description: "Items, stock, documents", is_active: true, created_at: iso(300), updated_at: iso(300) },
  { id: "mod-erp", code: "erp",       name: "ERP (coming soon)",    description: "GL, AR, AP",               is_active: false, created_at: iso(300), updated_at: iso(300) },
  { id: "mod-rag", code: "rag",       name: "RAG (coming soon)",    description: "Doc search assistant",     is_active: false, created_at: iso(300), updated_at: iso(300) },
];

export const SUBSCRIPTIONS = [
  {
    id: "sub-1",
    tenant_id: TENANTS[0].id,
    module_id: MODULES[0].id,
    module_code: "inventory",
    module_name: "Inventory Management",
    plan: "pro",
    status: "active",
    activated_at: iso(120),
    expires_at: null,
    created_at: iso(120),
    updated_at: iso(120),
  },
  {
    id: "sub-2",
    tenant_id: TENANTS[1].id,
    module_id: MODULES[0].id,
    module_code: "inventory",
    module_name: "Inventory Management",
    plan: "enterprise",
    status: "active",
    activated_at: iso(90),
    expires_at: null,
    created_at: iso(90),
    updated_at: iso(90),
  },
];

// ── Permissions catalogue ───────────────────────────────────────

const permDefs: Array<[string, string, string]> = [
  // [code, name, module]
  ["auth.users.read", "View users", "auth"],
  ["auth.users.write", "Edit users", "auth"],
  ["auth.roles.read", "View roles", "auth"],
  ["auth.roles.write", "Edit roles", "auth"],
  ["auth.tenants.read", "View tenants", "auth"],
  ["auth.tenants.write", "Edit tenants", "auth"],
  ["auth.currencies.read", "View currencies", "auth"],
  ["auth.currencies.write", "Edit currencies", "auth"],
  ["auth.modules.read", "View modules", "auth"],
  ["auth.modules.write", "Manage modules", "auth"],

  ["inventory.items.read", "View items", "inventory"],
  ["inventory.items.write", "Create/edit items", "inventory"],
  ["inventory.brands.read", "View brands", "inventory"],
  ["inventory.brands.write", "Edit brands", "inventory"],
  ["inventory.categories.read", "View categories", "inventory"],
  ["inventory.categories.write", "Edit categories", "inventory"],
  ["inventory.uoms.read", "View units", "inventory"],
  ["inventory.uoms.write", "Edit units", "inventory"],
  ["inventory.locations.read", "View locations", "inventory"],
  ["inventory.locations.write", "Edit locations", "inventory"],
  ["inventory.bins.read", "View bins", "inventory"],
  ["inventory.bins.write", "Edit bins", "inventory"],
  ["inventory.parties.read", "View parties", "inventory"],
  ["inventory.parties.write", "Edit parties", "inventory"],
  ["inventory.balances.read", "View balances", "inventory"],
  ["inventory.movements.read", "View movements", "inventory"],
  ["inventory.movements.write", "Post movements", "inventory"],
  ["inventory.reservations.read", "View reservations", "inventory"],
  ["inventory.reservations.write", "Manage reservations", "inventory"],
  ["inventory.documents.read", "View documents", "inventory"],
  ["inventory.documents.write", "Create/edit documents", "inventory"],
  ["inventory.documents.post", "Post documents", "inventory"],
  ["inventory.documents.cancel", "Cancel documents", "inventory"],
  ["inventory.counts.read", "View counts", "inventory"],
  ["inventory.counts.write", "Edit counts", "inventory"],
  ["inventory.counts.apply", "Apply counts", "inventory"],
  ["inventory.lots.read", "View lots", "inventory"],
  ["inventory.lots.write", "Edit lots", "inventory"],
  ["inventory.serials.read", "View serials", "inventory"],
  ["inventory.serials.write", "Edit serials", "inventory"],
  ["inventory.workflows.read", "View workflows", "inventory"],
  ["inventory.workflows.write", "Edit workflows", "inventory"],
  ["inventory.custom_fields.read", "View custom fields", "inventory"],
  ["inventory.custom_fields.write", "Edit custom fields", "inventory"],
  ["inventory.integrations.read", "View integrations", "inventory"],
  ["inventory.integrations.write", "Edit integrations", "inventory"],
  ["inventory.number_series.read", "View number series", "inventory"],
  ["inventory.number_series.write", "Edit number series", "inventory"],
  ["inventory.status_master.read", "View statuses", "inventory"],
  ["inventory.status_master.write", "Edit statuses", "inventory"],
  ["inventory.reorder_policies.read", "View reorder policies", "inventory"],
  ["inventory.reorder_policies.write", "Edit reorder policies", "inventory"],
  ["inventory.config.read", "View config", "inventory"],
  ["inventory.config.write", "Edit config", "inventory"],

  // Invoices — tax-document permissions, distinct from generic
  // documents. Tenants can grant ops staff invoice creation without
  // letting them post (lock) or cancel posted invoices.
  ["inventory.invoices.read",   "View invoices",          "inventory"],
  ["inventory.invoices.write",  "Create/edit invoices",   "inventory"],
  ["inventory.invoices.post",   "Post (lock) invoices",   "inventory"],
  ["inventory.invoices.cancel", "Cancel posted invoices", "inventory"],

  // Challans — delivery notes for outbound goods. Distinct from
  // invoices because challans are dispatch artefacts (route, vehicle,
  // driver, Bill/NoBill toggle, two print modes), not tax documents.
  // Same 4-action split so role design can mirror invoices.
  ["inventory.challans.read",   "View challans",          "inventory"],
  ["inventory.challans.write",  "Create/edit challans",   "inventory"],
  ["inventory.challans.post",   "Post (dispatch) challans", "inventory"],
  ["inventory.challans.cancel", "Cancel posted challans", "inventory"],

  // Routes — sales-territory master data (Phase 1 prereq). Read-only
  // for ops; write for admin.
  ["inventory.routes.read",     "View sales routes",      "inventory"],
  ["inventory.routes.write",    "Edit sales routes",      "inventory"],

  // Phase 3 — Money / Accounting. Five resource families, each with
  // their own read/write split so per-tenant role customisation can
  // grant a "Cashier" only payments + employees-read, while a
  // "Finance Lead" gets the full bundle including Chart of Accounts.
  ["inventory.accounts.read",   "View chart of accounts", "inventory"],
  ["inventory.accounts.write",  "Edit accounts",          "inventory"],
  ["inventory.ledger.read",     "View ledger",            "inventory"],
  ["inventory.payments.read",   "View receipts/payments", "inventory"],
  ["inventory.payments.write",  "Create receipts/payments","inventory"],
  ["inventory.payments.post",   "Post (lock) receipts/payments", "inventory"],
  ["inventory.payments.cancel", "Cancel posted receipts/payments", "inventory"],
  ["inventory.employees.read",  "View employees",         "inventory"],
  ["inventory.employees.write", "Edit employees",         "inventory"],
  // Editing a party's opening balance changes their ledger root —
  // sensitive enough to warrant its own gate distinct from parties.write.
  ["inventory.parties.write_balance", "Edit party opening balance", "inventory"],

  // Phase 3.5 — AP completion (Vendor Bills, Expenses, Salary).
  // Same 4-action split (read/write/post/cancel) as invoices and
  // payments so role design can mirror the AR side.
  ["inventory.bills.read",   "View vendor bills",          "inventory"],
  ["inventory.bills.write",  "Create/edit vendor bills",   "inventory"],
  ["inventory.bills.post",   "Post (lock) vendor bills",   "inventory"],
  ["inventory.bills.cancel", "Cancel posted vendor bills", "inventory"],

  ["inventory.expenses.read",   "View expenses",                  "inventory"],
  ["inventory.expenses.write",  "Create/edit expenses",           "inventory"],
  ["inventory.expenses.post",   "Post (lock) expenses",           "inventory"],
  ["inventory.expenses.cancel", "Cancel posted expenses",         "inventory"],
  ["inventory.expense_categories.read",  "View expense categories", "inventory"],
  ["inventory.expense_categories.write", "Edit expense categories", "inventory"],

  ["inventory.salary.read",   "View salary entries",          "inventory"],
  ["inventory.salary.write",  "Create/edit salary entries",   "inventory"],
  ["inventory.salary.post",   "Post (lock) salary entries",   "inventory"],
  ["inventory.salary.cancel", "Cancel posted salary entries", "inventory"],

  // Phase 4 — Reports. Reports are entirely read-only; we still gate
  // them so a tenant can hide P&L from a junior cashier role even
  // when other read perms are granted.
  ["inventory.reports.read",  "View financial reports",       "inventory"],

  // Phase 5 — Period close (ledger lock). Read = view current lock
  // date; Write = move/clear the lock. Splitting these gates lets a
  // tenant give the accountant write but everyone else read-only.
  ["inventory.period_close.read",  "View period-close lock", "inventory"],
  ["inventory.period_close.write", "Set or clear period-close lock", "inventory"],

  // Phase 6 — Payroll batch. The bulk-generate and bulk-post operations
  // need their own gate (a tenant might trust a junior accountant with
  // per-entry edits but not let them blast a whole month's payroll).
  ["inventory.salary.batch", "Run payroll batch (generate + bulk post)", "inventory"],

  // Phase 7 — Bulk imports. Read = view import history; write = run
  // imports. Importing items / parties bypasses the per-entity create
  // path, so it gets its own gate distinct from the per-entity write
  // permissions.
  ["inventory.imports.read",  "View import history",        "inventory"],
  ["inventory.imports.write", "Run bulk CSV imports",       "inventory"],

  // Phase 9 — Audit log viewer. Read-only by design; entries are
  // written by the backend as a side effect of other actions, never
  // directly by the user.
  ["inventory.audit_log.read", "View audit log", "inventory"],

  // Phase 12 — Cost & financial visibility split (Nova Bond client req).
  //
  // The owner (Mr. Arpit) is the only role who sees costs / margins /
  // money. Operator + Salesman get a "no money on screen" UI:
  //
  //   inventory.cost.read       — gates: unit_cost field on bills, line_total
  //                               column on PO/GRN tables, "Value" column on
  //                               /balances, /valuation page, /movements
  //                               unit_cost/total_cost columns, vendor bills
  //                               module entirely, COGS line on P&L,
  //                               purchase register cost totals
  //   inventory.financials.read — gates: /money/* (payments, ledger, accounts,
  //                               cheques, expenses, salary, debtors), all
  //                               /reports/*, period-close, audit-log diff
  //                               amounts
  //
  // Operator role bundle below is trimmed: no bills.write/post/cancel, and
  // neither cost.read nor financials.read is granted.
  ["inventory.cost.read",       "View cost prices and stock value", "inventory"],
  ["inventory.financials.read", "View payments, ledger, and reports", "inventory"],

  // Master-data sidebar gate — Operator never edits brands / categories /
  // UoMs / number series / status master / document types, so the entire
  // Master Data sidebar group is hidden from them. Admin only.
  ["inventory.master_data.read", "View Master Data (brands / categories / UoMs / etc.)", "inventory"],
];

export const PERMISSIONS = permDefs.map(([code, name, module], i) => ({
  id: `perm-${i.toString(36).padStart(3, "0")}`,
  code,
  name,
  module,
  description: name,
  created_at: iso(300),
  updated_at: iso(300),
}));

// Convenience: permission codes split by .write vs .read
const ALL_READ_PERMS = PERMISSIONS.filter((p) => p.code.endsWith(".read")).map(
  (p) => p.code,
);
// Phase 12: Operator bundle is now strictly the warehouse-side write
// permissions — no money-touching operations. Bills, invoices, payments,
// expenses, salary, accounts, employees are all reserved for Admin.
//
// Reasoning: per Mr. Arpit's brief (§7 of clientneeds.txt), the operator
// records physical events (goods received, stock counted) without seeing
// or entering any cost/price. Cost data flows in via the vendor-bill
// stage which belongs to Admin, not Operator.
const INVENTORY_OPS_WRITE = PERMISSIONS.filter((p) =>
  [
    "inventory.movements.write",
    "inventory.documents.write",  "inventory.documents.post",  "inventory.documents.cancel",
    "inventory.challans.write",   "inventory.challans.post",   "inventory.challans.cancel",
    "inventory.counts.write",     "inventory.counts.apply",
    "inventory.reservations.write",
    "inventory.lots.write",       "inventory.serials.write",
  ].includes(p.code),
).map((p) => p.code);

// ── Roles + role_permissions ────────────────────────────────────

export const ROLES = [
  { id: "role-admin",    tenant_id: TENANTS[0].id, code: "admin",    name: "Administrator",     is_system: true,  created_at: iso(120), updated_at: iso(120) },
  { id: "role-operator", tenant_id: TENANTS[0].id, code: "operator", name: "Warehouse Operator", is_system: true, created_at: iso(120), updated_at: iso(120) },
  { id: "role-viewer",   tenant_id: TENANTS[0].id, code: "viewer",   name: "Viewer",            is_system: true,  created_at: iso(120), updated_at: iso(120) },
];

export const ROLE_PERMISSIONS: Array<{
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}> = [];

function grant(roleId: string, codes: string[]) {
  codes.forEach((code) => {
    const perm = PERMISSIONS.find((p) => p.code === code);
    if (!perm) return;
    ROLE_PERMISSIONS.push({
      id: uid("rp"),
      role_id: roleId,
      permission_id: perm.id,
      created_at: iso(120),
    });
  });
}

// Phase 12: Operator does NOT get cost.read or financials.read —
// those gate cost-price visibility, money pages, and reports. They
// also lose the bills/invoices/payments/expenses/salary/audit_log
// reads since those routes are admin-only too.
const COST_AND_FINANCIAL_READS = new Set([
  "inventory.cost.read",
  "inventory.financials.read",
  "inventory.bills.read",
  "inventory.invoices.read",
  "inventory.payments.read",
  "inventory.expenses.read",
  "inventory.expense_categories.read",
  "inventory.salary.read",
  "inventory.accounts.read",
  "inventory.ledger.read",
  "inventory.employees.read",
  "inventory.reports.read",
  "inventory.period_close.read",
  "inventory.audit_log.read",
  "inventory.parties.write_balance",
  // Master Data is admin-managed; Operator can't see the Master Data
  // sidebar group, but underlying read perms (brands/categories/uoms
  // etc.) stay granted so /items can render brand + category names.
  "inventory.master_data.read",
]);

grant("role-admin",    PERMISSIONS.map((p) => p.code));
grant("role-operator", [
  ...ALL_READ_PERMS.filter((c) => c.startsWith("inventory.") && !COST_AND_FINANCIAL_READS.has(c)),
  ...INVENTORY_OPS_WRITE,
]);
grant("role-viewer",   ALL_READ_PERMS);

// ── Users + user_roles ──────────────────────────────────────────

export const USERS = [
  {
    id: "user-super",
    tenant_id: null,
    email: "superadmin@demo.com",
    full_name: "Platform Super Admin",
    timezone: null,
    is_active: true,
    is_super_admin: true,
    last_login_at: iso(1),
    created_at: iso(300),
    updated_at: iso(300),
  },
  {
    id: "user-admin",
    tenant_id: TENANTS[0].id,
    email: "admin@demo.com",
    full_name: "Priya Sharma",
    timezone: "America/New_York",
    is_active: true,
    is_super_admin: false,
    last_login_at: iso(0),
    created_at: iso(120),
    updated_at: iso(0),
  },
  {
    id: "user-ops",
    tenant_id: TENANTS[0].id,
    email: "ops@demo.com",
    full_name: "Arun Kumar",
    timezone: "America/New_York",
    is_active: true,
    is_super_admin: false,
    last_login_at: iso(2),
    created_at: iso(120),
    updated_at: iso(120),
  },
  {
    id: "user-viewer",
    tenant_id: TENANTS[0].id,
    email: "viewer@demo.com",
    full_name: "Meera Iyer",
    timezone: "America/New_York",
    is_active: true,
    is_super_admin: false,
    last_login_at: iso(7),
    created_at: iso(120),
    updated_at: iso(120),
  },
  // Example inactive user for the viewer to scroll past
  {
    id: "user-alumni",
    tenant_id: TENANTS[0].id,
    email: "alumni@demo.com",
    full_name: "Former Employee",
    timezone: "America/New_York",
    is_active: false,
    is_super_admin: false,
    last_login_at: iso(90),
    created_at: iso(200),
    updated_at: iso(60),
  },
];

export const USER_ROLES: Array<{
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
}> = [
  { id: "ur-1", user_id: "user-admin",  role_id: "role-admin",    created_at: iso(120) },
  { id: "ur-2", user_id: "user-ops",    role_id: "role-operator", created_at: iso(120) },
  { id: "ur-3", user_id: "user-viewer", role_id: "role-viewer",   created_at: iso(120) },
];

// Password lookup (demo-only plaintext — never ship to prod).
export const DEMO_PASSWORDS: Record<string, string> = {
  "superadmin@demo.com": "demo123",
  "admin@demo.com": "demo123",
  "ops@demo.com": "demo123",
  "viewer@demo.com": "demo123",
};

// ── Master data ─────────────────────────────────────────────────

export const UOM_CATEGORIES = [
  { id: "uomc-ea",     tenant_id: TENANTS[0].id, code: "count",  name: "Count",  created_at: iso(120), updated_at: iso(120) },
  { id: "uomc-wt",     tenant_id: TENANTS[0].id, code: "weight", name: "Weight", created_at: iso(120), updated_at: iso(120) },
  { id: "uomc-vol",    tenant_id: TENANTS[0].id, code: "volume", name: "Volume", created_at: iso(120), updated_at: iso(120) },
  // Length + Area added for Nova Bond — accessories sold per-meter,
  // panels often quoted per sq.ft for cut/custom orders.
  { id: "uomc-length", tenant_id: TENANTS[0].id, code: "length", name: "Length", created_at: iso(120), updated_at: iso(120) },
  { id: "uomc-area",   tenant_id: TENANTS[0].id, code: "area",   name: "Area",   created_at: iso(120), updated_at: iso(120) },
];

export const UOMS = [
  // ─── Count (whole-unit) UoMs ────────────────────────────────
  // Nova Bond ACP panels are sold by the sheet. Each sheet is one
  // standard 1220mm × 2440mm / 3050mm / 3660mm aluminum composite panel.
  { id: "uom-sheet",   tenant_id: TENANTS[0].id, code: "SHEET",  name: "Sheet",        symbol: "sheet",  uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-bundle",  tenant_id: TENANTS[0].id, code: "BUNDLE", name: "Bundle",       symbol: "bundle", uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-pcs",     tenant_id: TENANTS[0].id, code: "PCS",    name: "Pieces",       symbol: "pcs",    uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-nos",     tenant_id: TENANTS[0].id, code: "NOS",    name: "Numbers",      symbol: "nos",    uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-each",    tenant_id: TENANTS[0].id, code: "EA",     name: "Each",         symbol: "ea",     uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-box",     tenant_id: TENANTS[0].id, code: "BOX",    name: "Box",          symbol: "box",    uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-pack",    tenant_id: TENANTS[0].id, code: "PACK",   name: "Pack",         symbol: "pack",   uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-set",     tenant_id: TENANTS[0].id, code: "SET",    name: "Set",          symbol: "set",    uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-roll",    tenant_id: TENANTS[0].id, code: "ROLL",   name: "Roll",         symbol: "roll",   uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-drum",    tenant_id: TENANTS[0].id, code: "DRUM",   name: "Drum",         symbol: "drum",   uom_category_id: "uomc-ea",     created_at: iso(120), updated_at: iso(120) },

  // ─── Weight UoMs ────────────────────────────────────────────
  // For raw aluminum coil + coating chemicals.
  { id: "uom-mt",      tenant_id: TENANTS[0].id, code: "MT",     name: "Metric Ton",   symbol: "MT",     uom_category_id: "uomc-wt",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-kg",      tenant_id: TENANTS[0].id, code: "KG",     name: "Kilogram",     symbol: "kg",     uom_category_id: "uomc-wt",     created_at: iso(120), updated_at: iso(120) },
  { id: "uom-g",       tenant_id: TENANTS[0].id, code: "G",      name: "Gram",         symbol: "g",      uom_category_id: "uomc-wt",     created_at: iso(120), updated_at: iso(120) },

  // ─── Length UoMs ────────────────────────────────────────────
  // For trims, profiles, fasteners-by-length, raw coil length.
  { id: "uom-mtr",     tenant_id: TENANTS[0].id, code: "MTR",    name: "Meter",        symbol: "m",      uom_category_id: "uomc-length", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-cm",      tenant_id: TENANTS[0].id, code: "CM",     name: "Centimeter",   symbol: "cm",     uom_category_id: "uomc-length", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-mm",      tenant_id: TENANTS[0].id, code: "MM",     name: "Millimeter",   symbol: "mm",     uom_category_id: "uomc-length", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-ft",      tenant_id: TENANTS[0].id, code: "FT",     name: "Foot",         symbol: "ft",     uom_category_id: "uomc-length", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-inch",    tenant_id: TENANTS[0].id, code: "INCH",   name: "Inch",         symbol: "in",     uom_category_id: "uomc-length", created_at: iso(120), updated_at: iso(120) },

  // ─── Area UoMs ──────────────────────────────────────────────
  // Used when a customer asks for cut panels priced per sq.ft.
  { id: "uom-sqft",    tenant_id: TENANTS[0].id, code: "SQFT",   name: "Square Foot",  symbol: "sq.ft",  uom_category_id: "uomc-area",   created_at: iso(120), updated_at: iso(120) },
  { id: "uom-sqm",     tenant_id: TENANTS[0].id, code: "SQM",    name: "Square Meter", symbol: "sq.m",   uom_category_id: "uomc-area",   created_at: iso(120), updated_at: iso(120) },

  // ─── Volume UoMs ────────────────────────────────────────────
  // For liquid coatings / adhesives / cleaning solvents.
  { id: "uom-lt",      tenant_id: TENANTS[0].id, code: "L",      name: "Litre",        symbol: "L",      uom_category_id: "uomc-vol",    created_at: iso(120), updated_at: iso(120) },
  { id: "uom-ml",      tenant_id: TENANTS[0].id, code: "ML",     name: "Millilitre",   symbol: "ml",     uom_category_id: "uomc-vol",    created_at: iso(120), updated_at: iso(120) },
];

// Conversion factors. Read as: 1 [from_uom] = factor [to_uom].
// Backend uses these for stock-balance roll-ups when an item allows
// transactions in alternative UoMs.
export const UOM_CONVERSIONS = [
  // Count
  { id: "conv-bundle-sheet", tenant_id: TENANTS[0].id, from_uom_id: "uom-bundle", to_uom_id: "uom-sheet", factor: "10",     created_at: iso(120), updated_at: iso(120) },
  { id: "conv-box-each",     tenant_id: TENANTS[0].id, from_uom_id: "uom-box",    to_uom_id: "uom-each",  factor: "24",     created_at: iso(120), updated_at: iso(120) },
  { id: "conv-pcs-each",     tenant_id: TENANTS[0].id, from_uom_id: "uom-pcs",    to_uom_id: "uom-each",  factor: "1",      created_at: iso(120), updated_at: iso(120) },
  { id: "conv-nos-each",     tenant_id: TENANTS[0].id, from_uom_id: "uom-nos",    to_uom_id: "uom-each",  factor: "1",      created_at: iso(120), updated_at: iso(120) },
  // Weight
  { id: "conv-mt-kg",        tenant_id: TENANTS[0].id, from_uom_id: "uom-mt",     to_uom_id: "uom-kg",    factor: "1000",   created_at: iso(120), updated_at: iso(120) },
  { id: "conv-kg-g",         tenant_id: TENANTS[0].id, from_uom_id: "uom-kg",     to_uom_id: "uom-g",     factor: "1000",   created_at: iso(120), updated_at: iso(120) },
  // Length
  { id: "conv-mtr-cm",       tenant_id: TENANTS[0].id, from_uom_id: "uom-mtr",    to_uom_id: "uom-cm",    factor: "100",    created_at: iso(120), updated_at: iso(120) },
  { id: "conv-mtr-mm",       tenant_id: TENANTS[0].id, from_uom_id: "uom-mtr",    to_uom_id: "uom-mm",    factor: "1000",   created_at: iso(120), updated_at: iso(120) },
  { id: "conv-mtr-ft",       tenant_id: TENANTS[0].id, from_uom_id: "uom-mtr",    to_uom_id: "uom-ft",    factor: "3.28084", created_at: iso(120), updated_at: iso(120) },
  { id: "conv-ft-inch",      tenant_id: TENANTS[0].id, from_uom_id: "uom-ft",     to_uom_id: "uom-inch",  factor: "12",     created_at: iso(120), updated_at: iso(120) },
  // Area
  { id: "conv-sqm-sqft",     tenant_id: TENANTS[0].id, from_uom_id: "uom-sqm",    to_uom_id: "uom-sqft",  factor: "10.7639", created_at: iso(120), updated_at: iso(120) },
  // Volume
  { id: "conv-lt-ml",        tenant_id: TENANTS[0].id, from_uom_id: "uom-lt",     to_uom_id: "uom-ml",    factor: "1000",   created_at: iso(120), updated_at: iso(120) },
];

export const BRANDS = [
  // Nova Bond is the only brand for this tenant — primary in-house brand
  // for the ACP product line. All 39 NB-* product codes belong to this
  // brand; collection differentiation is captured via category
  // (Wooden / Stone / Metallic / etc.).
  { id: "brand-novabond", tenant_id: TENANTS[0].id, code: "NOVABOND", name: "Nova Bond", created_at: iso(120), updated_at: iso(120) },
];

export const CATEGORIES = [
  // Nova Bond ACP collections — each NB-* product code maps to exactly
  // one collection (the marketing/finish bucket). Pricing tier roughly
  // tracks the collection: Solid/Gloss low → Premium/Neo Bond high.
  { id: "cat-nb-wooden",    tenant_id: TENANTS[0].id, code: "NB-WOOD",   name: "Wooden Collection",      created_at: iso(120), updated_at: iso(120) },
  { id: "cat-nb-stone",     tenant_id: TENANTS[0].id, code: "NB-STONE",  name: "Stone Collection",       created_at: iso(120), updated_at: iso(120) },
  { id: "cat-nb-premium",   tenant_id: TENANTS[0].id, code: "NB-PREM",   name: "Premium Collection",     created_at: iso(120), updated_at: iso(120) },
  { id: "cat-nb-metallic",  tenant_id: TENANTS[0].id, code: "NB-METAL",  name: "Metallic Collection",    created_at: iso(120), updated_at: iso(120) },
  { id: "cat-nb-solid",     tenant_id: TENANTS[0].id, code: "NB-SOLID",  name: "Solid Color Collection", created_at: iso(120), updated_at: iso(120) },
  { id: "cat-nb-gloss",     tenant_id: TENANTS[0].id, code: "NB-GLOSS",  name: "High Gloss Collection",  created_at: iso(120), updated_at: iso(120) },
  { id: "cat-nb-neo",       tenant_id: TENANTS[0].id, code: "NB-NEO",    name: "Neo Bond Collection",    created_at: iso(120), updated_at: iso(120) },
];

export const STATUS_MASTER = [
  { id: "stat-draft",     tenant_id: TENANTS[0].id, code: "draft",     label: "Draft",     category: "document", entity: "document", created_at: iso(100), updated_at: iso(100) },
  { id: "stat-submitted", tenant_id: TENANTS[0].id, code: "submitted", label: "Submitted", category: "document", entity: "document", created_at: iso(100), updated_at: iso(100) },
  { id: "stat-posted",    tenant_id: TENANTS[0].id, code: "posted",    label: "Posted",    category: "document", entity: "document", created_at: iso(100), updated_at: iso(100) },
  { id: "stat-cancelled", tenant_id: TENANTS[0].id, code: "cancelled", label: "Cancelled", category: "document", entity: "document", created_at: iso(100), updated_at: iso(100) },
];

export const NUMBER_SERIES = [
  { id: "ns-po",  tenant_id: TENANTS[0].id, code: "PO",  entity: "purchase_order", prefix: "PO-", suffix: "", padding: 5, current_value: 12, start_value: 1, created_at: iso(100), updated_at: iso(100) },
  { id: "ns-so",  tenant_id: TENANTS[0].id, code: "SO",  entity: "sales_order",    prefix: "SO-", suffix: "", padding: 5, current_value: 8,  start_value: 1, created_at: iso(100), updated_at: iso(100) },
  { id: "ns-trn", tenant_id: TENANTS[0].id, code: "TRN", entity: "transfer",       prefix: "TR-", suffix: "", padding: 5, current_value: 3,  start_value: 1, created_at: iso(100), updated_at: iso(100) },
];

export const DOCUMENT_TYPES = [
  { id: "dt-po",     tenant_id: TENANTS[0].id, code: "PO",       name: "Purchase Order", direction: "in",       module: "inventory", affects_stock: true,  created_at: iso(100), updated_at: iso(100) },
  { id: "dt-so",     tenant_id: TENANTS[0].id, code: "SO",       name: "Sales Order",    direction: "out",      module: "inventory", affects_stock: true,  created_at: iso(100), updated_at: iso(100) },
  { id: "dt-trn",    tenant_id: TENANTS[0].id, code: "TRN",      name: "Transfer",        direction: "transfer", module: "inventory", affects_stock: true,  created_at: iso(100), updated_at: iso(100) },
  { id: "dt-grn",    tenant_id: TENANTS[0].id, code: "GRN",      name: "Goods Receipt",   direction: "in",       module: "inventory", affects_stock: true,  created_at: iso(100), updated_at: iso(100) },
];

// ── Locations ──────────────────────────────────────────────────

export const LOCATIONS: Array<any> = [
  { id: "loc-main",    tenant_id: TENANTS[0].id, code: "WH-MAIN",  name: "Main Warehouse", location_type: "warehouse", parent_id: null, is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "loc-branch",  tenant_id: TENANTS[0].id, code: "WH-BRCH",  name: "Branch Warehouse", location_type: "warehouse", parent_id: null, is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "loc-zone-a",  tenant_id: TENANTS[0].id, code: "A",        name: "Zone A", location_type: "zone", parent_id: "loc-main", is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "loc-zone-b",  tenant_id: TENANTS[0].id, code: "B",        name: "Zone B", location_type: "zone", parent_id: "loc-main", is_active: true, created_at: iso(100), updated_at: iso(100) },
];

export const BINS: Record<string, any[]> = {
  "loc-zone-a": [
    { id: "bin-a1", tenant_id: TENANTS[0].id, location_id: "loc-zone-a", code: "A-01", name: "Aisle 1", is_active: true, created_at: iso(100), updated_at: iso(100) },
    { id: "bin-a2", tenant_id: TENANTS[0].id, location_id: "loc-zone-a", code: "A-02", name: "Aisle 2", is_active: true, created_at: iso(100), updated_at: iso(100) },
  ],
};

// ── Parties ─────────────────────────────────────────────────────

export const PARTIES = [
  // Opening balances are signed from the tenant's perspective:
  //  - customer with positive opening_balance => they owe us at start of books
  //  - supplier with positive opening_balance => we owe them at start of books
  // Demo data is set up so the /money/debtors view has interesting rows.
  { id: "party-1", tenant_id: TENANTS[0].id, code: "SUP-001", name: "Kaizen Imports",     legal_name: "Kaizen Imports Pvt Ltd",   tax_id: "27AAAAA0001A1Z5", party_type: "supplier", opening_balance: "45000.00", currency_id: "cur-usd", is_gst_registered: true,  gstin: "27AAAAA0001A1Z5", state_code: "27", description: "Primary electronics importer",         is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-2", tenant_id: TENANTS[0].id, code: "SUP-002", name: "Horizon Traders",    legal_name: "Horizon Traders Ltd",      tax_id: "29BBBBB0002A1Z5", party_type: "supplier", opening_balance: "0",        currency_id: "cur-usd", is_gst_registered: true,  gstin: "29BBBBB0002A1Z5", state_code: "29", description: "Karnataka-based, 30-day terms",         is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-3", tenant_id: TENANTS[0].id, code: "CUS-001", name: "Greenfield Retail",  legal_name: "Greenfield Retail Corp",   tax_id: "27CCCCC0003A1Z5", party_type: "customer", opening_balance: "12500.00", currency_id: "cur-usd", is_gst_registered: true,  gstin: "27CCCCC0003A1Z5", state_code: "27", description: "Mumbai retail chain — route MUM-N",     is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-4", tenant_id: TENANTS[0].id, code: "CUS-002", name: "Metro Chain Stores", legal_name: "Metro Chain Stores Pvt Ltd", tax_id: "07DDDDD0004A1Z5", party_type: "customer", opening_balance: "8750.00",  currency_id: "cur-usd", is_gst_registered: true,  gstin: "07DDDDD0004A1Z5", state_code: "07", description: "Delhi NCR — inter-state, IGST applies", is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-5", tenant_id: TENANTS[0].id, code: "BOTH-01", name: "Unity Distributors", legal_name: "Unity Distributors Inc",   tax_id: "29EEEEE0005A1Z5", party_type: "both",     opening_balance: "0",        currency_id: "cur-usd", is_gst_registered: false,                            state_code: "29", description: "Unregistered, B2C only",                  is_active: true, created_at: iso(100), updated_at: iso(100) },

  // ─── Service vendors (party_type='vendor') ───────────────────
  // Distinguished from suppliers: these sell *services* / one-off
  // items rather than the regular goods supply chain. Show up in
  // the same vendor pickers (payments / bills / expenses) but
  // tagged differently so reports can split goods-spend from
  // services-spend.
  { id: "party-vendor-raniac", tenant_id: TENANTS[0].id, code: "VEN-IT-001", name: "Raniac Technologies", legal_name: "Raniac Technologies Pvt Ltd", tax_id: "", party_type: "vendor", opening_balance: "0", currency_id: "cur-inr", is_gst_registered: true, gstin: "27AAACR1234F1Z9", state_code: "27", description: "IT services — IMS/ERP software, hosting, support", is_active: true, created_at: iso(120), updated_at: iso(120) },
];

// ── Items ──────────────────────────────────────────────────────

export const ITEMS = [
  // ─── Nova Bond ACP catalog (39 items) ────────────────────────────
  // Each item is one product code (colour / finish). Thickness (2/3/4/5mm)
  // and panel size (1220×2440 / 3050 / 3660) are line-level attributes
  // captured on the invoice/PO line description rather than as separate
  // SKUs. HSN 76061200 = Aluminum, plates/sheets/strip, rectangular,
  // thickness > 0.2mm. GST 18% standard for ACP.
  // is_batch_tracked=true so each production lot can be traced (matches
  // the 10-year warranty + IAF/CE/ARAI/ISO/DMBC certification model).

  // Wooden Collection (7) — premium tier, ₹6,800–7,800
  { id: "item-nb-1802", tenant_id: TENANTS[0].id, item_code: "NB-1802", name: "Burn Walnut",        description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7200", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1807", tenant_id: TENANTS[0].id, item_code: "NB-1807", name: "Alstonia Wood",      description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6900", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1808", tenant_id: TENANTS[0].id, item_code: "NB-1808", name: "Ebony",              description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7400", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1811", tenant_id: TENANTS[0].id, item_code: "NB-1811", name: "Parlato",            description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7100", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1813", tenant_id: TENANTS[0].id, item_code: "NB-1813", name: "Burma Teak",         description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7600", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1814", tenant_id: TENANTS[0].id, item_code: "NB-1814", name: "Italian Wood",       description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7800", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1816", tenant_id: TENANTS[0].id, item_code: "NB-1816", name: "Sapeli",             description: "ACP — Wooden Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-wooden",   brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7300", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },

  // Stone Collection (2) — ₹6,800–7,200
  { id: "item-nb-1701", tenant_id: TENANTS[0].id, item_code: "NB-1701", name: "Graphite Stone",     description: "ACP — Stone Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-stone",    brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6900", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1702", tenant_id: TENANTS[0].id, item_code: "NB-1702", name: "Alaska Stone",       description: "ACP — Stone Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-stone",    brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "7100", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },

  // Premium Collection (2) — top tier, ₹8,500–9,200
  { id: "item-nb-1602", tenant_id: TENANTS[0].id, item_code: "NB-1602", name: "Galaxy White",       description: "ACP — Premium Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-premium",  brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "8500", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1502", tenant_id: TENANTS[0].id, item_code: "NB-1502", name: "Mirror Gold",        description: "ACP — Premium Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-premium",  brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "9200", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },

  // Metallic Collection (10) — ₹5,500–6,500
  { id: "item-nb-1101", tenant_id: TENANTS[0].id, item_code: "NB-1101", name: "Bright Silver",      description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "5800", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1102", tenant_id: TENANTS[0].id, item_code: "NB-1102", name: "Metallic Silver",    description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "5900", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1103", tenant_id: TENANTS[0].id, item_code: "NB-1103", name: "Champagne Silver",   description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6100", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1104", tenant_id: TENANTS[0].id, item_code: "NB-1104", name: "Champagne Gold",     description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6300", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1105", tenant_id: TENANTS[0].id, item_code: "NB-1105", name: "Penny Copper",       description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6200", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1106", tenant_id: TENANTS[0].id, item_code: "NB-1106", name: "Black Silver",       description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "5950", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1108", tenant_id: TENANTS[0].id, item_code: "NB-1108", name: "Rich Gold",          description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6400", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1112", tenant_id: TENANTS[0].id, item_code: "NB-1112", name: "Rose Metallic Bronze", description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6500", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1113", tenant_id: TENANTS[0].id, item_code: "NB-1113", name: "Metallic Blue",      description: "ACP — Metallic Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-metallic", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "6000", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },

  // Solid Color Collection (12) — entry tier, ₹3,800–4,500
  { id: "item-nb-1201", tenant_id: TENANTS[0].id, item_code: "NB-1201", name: "Pure White",         description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "3800", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1202", tenant_id: TENANTS[0].id, item_code: "NB-1202", name: "Off White",          description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "3850", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1204", tenant_id: TENANTS[0].id, item_code: "NB-1204", name: "Slate Grey",         description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4000", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1205", tenant_id: TENANTS[0].id, item_code: "NB-1205", name: "Black",              description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4100", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1206", tenant_id: TENANTS[0].id, item_code: "NB-1206", name: "Bright Red",         description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4300", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1207", tenant_id: TENANTS[0].id, item_code: "NB-1207", name: "Choco Brown",        description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4150", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1208", tenant_id: TENANTS[0].id, item_code: "NB-1208", name: "Traffic Yellow",     description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4400", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1210", tenant_id: TENANTS[0].id, item_code: "NB-1210", name: "Orange",             description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4350", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1211", tenant_id: TENANTS[0].id, item_code: "NB-1211", name: "Lemon Yellow",       description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4250", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1212", tenant_id: TENANTS[0].id, item_code: "NB-1212", name: "Oppo Green",         description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4200", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1213", tenant_id: TENANTS[0].id, item_code: "NB-1213", name: "Samsung Blue",       description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4500", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1215", tenant_id: TENANTS[0].id, item_code: "NB-1215", name: "Lake Blue",          description: "ACP — Solid Color Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-solid", brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4400", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },

  // High Gloss Collection (3) — ₹4,800–5,200
  { id: "item-nb-1301", tenant_id: TENANTS[0].id, item_code: "NB-1301", name: "High Gloss White",   description: "ACP — High Gloss Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-gloss",  brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "4800", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1302", tenant_id: TENANTS[0].id, item_code: "NB-1302", name: "High Gloss Red",     description: "ACP — High Gloss Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-gloss",  brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "5100", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-1303", tenant_id: TENANTS[0].id, item_code: "NB-1303", name: "High Gloss Black",   description: "ACP — High Gloss Collection · 2/3/4/5mm · 1220×2440/3050/3660mm", category_id: "cat-nb-gloss",  brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "5200", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },

  // Neo Bond Collection (5) — sub-line, premium-priced finishes ₹9,200–10,000
  { id: "item-nb-101",  tenant_id: TENANTS[0].id, item_code: "NB-101",  name: "Bright Silver (Neo)", description: "ACP — Neo Bond Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-neo",     brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "9500", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-301",  tenant_id: TENANTS[0].id, item_code: "NB-301",  name: "Gloss White (Neo)",   description: "ACP — Neo Bond Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-neo",     brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "9200", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-202",  tenant_id: TENANTS[0].id, item_code: "NB-202",  name: "Off White (Neo)",     description: "ACP — Neo Bond Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-neo",     brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "9300", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-201",  tenant_id: TENANTS[0].id, item_code: "NB-201",  name: "Pure White (Neo)",    description: "ACP — Neo Bond Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-neo",     brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "9400", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
  { id: "item-nb-106",  tenant_id: TENANTS[0].id, item_code: "NB-106",  name: "Black Silver (Neo)",  description: "ACP — Neo Bond Collection · 2/3/4/5mm · 1220×2440/3050/3660mm",  category_id: "cat-nb-neo",     brand_id: "brand-novabond", item_type: "goods", base_uom_id: "uom-sheet", is_batch_tracked: true,  is_serial_tracked: false, is_active: true, hsn_code: "76061200", default_sale_price: "10000", default_tax_rate_pct: "18", version: 0, created_at: iso(120), updated_at: iso(120) },
];

// ── Balances ──────────────────────────────────────────────────

export const BALANCES = [
  // Nova Bond is the only tenant — only NB-* item balances exist.

  // ─── Nova Bond ACP stock at main warehouse ────────────────────────
  // Realistic opening stock per SKU. Cost basis = ~70% of sale price
  // (typical ACP wholesale margin); value column reflects qty × cost.

  // Wooden Collection (cost ~₹4,830–5,460)
  { id: "bal-nb-1802", tenant_id: TENANTS[0].id, item_id: "item-nb-1802", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "85",  qty_reserved: "12", qty_available: "73",  value: "428400.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1807", tenant_id: TENANTS[0].id, item_id: "item-nb-1807", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "62",  qty_reserved: "0",  qty_available: "62",  value: "299460.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1808", tenant_id: TENANTS[0].id, item_id: "item-nb-1808", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "94",  qty_reserved: "8",  qty_available: "86",  value: "486920.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1811", tenant_id: TENANTS[0].id, item_id: "item-nb-1811", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "48",  qty_reserved: "0",  qty_available: "48",  value: "238560.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1813", tenant_id: TENANTS[0].id, item_id: "item-nb-1813", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "115", qty_reserved: "20", qty_available: "95",  value: "611800.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1814", tenant_id: TENANTS[0].id, item_id: "item-nb-1814", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "73",  qty_reserved: "5",  qty_available: "68",  value: "398580.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1816", tenant_id: TENANTS[0].id, item_id: "item-nb-1816", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "57",  qty_reserved: "0",  qty_available: "57",  value: "291270.00", last_movement_id: null, version: 0, updated_at: iso(120) },

  // Stone Collection
  { id: "bal-nb-1701", tenant_id: TENANTS[0].id, item_id: "item-nb-1701", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "68",  qty_reserved: "4",  qty_available: "64",  value: "328440.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1702", tenant_id: TENANTS[0].id, item_id: "item-nb-1702", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "52",  qty_reserved: "0",  qty_available: "52",  value: "258440.00", last_movement_id: null, version: 0, updated_at: iso(120) },

  // Premium Collection
  { id: "bal-nb-1602", tenant_id: TENANTS[0].id, item_id: "item-nb-1602", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "32",  qty_reserved: "2",  qty_available: "30",  value: "190400.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1502", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "28",  qty_reserved: "0",  qty_available: "28",  value: "180320.00", last_movement_id: null, version: 0, updated_at: iso(120) },

  // Metallic Collection (cost ~₹3,900–4,550)
  { id: "bal-nb-1101", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "138", qty_reserved: "18", qty_available: "120", value: "560280.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1102", tenant_id: TENANTS[0].id, item_id: "item-nb-1102", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "124", qty_reserved: "0",  qty_available: "124", value: "511880.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1103", tenant_id: TENANTS[0].id, item_id: "item-nb-1103", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "92",  qty_reserved: "10", qty_available: "82",  value: "393040.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1104", tenant_id: TENANTS[0].id, item_id: "item-nb-1104", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "105", qty_reserved: "0",  qty_available: "105", value: "463050.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1105", tenant_id: TENANTS[0].id, item_id: "item-nb-1105", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "76",  qty_reserved: "6",  qty_available: "70",  value: "330200.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1106", tenant_id: TENANTS[0].id, item_id: "item-nb-1106", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "88",  qty_reserved: "0",  qty_available: "88",  value: "366520.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1108", tenant_id: TENANTS[0].id, item_id: "item-nb-1108", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "64",  qty_reserved: "0",  qty_available: "64",  value: "286720.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1112", tenant_id: TENANTS[0].id, item_id: "item-nb-1112", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "41",  qty_reserved: "0",  qty_available: "41",  value: "186550.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1113", tenant_id: TENANTS[0].id, item_id: "item-nb-1113", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "47",  qty_reserved: "5",  qty_available: "42",  value: "197400.00", last_movement_id: null, version: 0, updated_at: iso(120) },

  // Solid Color Collection (highest volume — entry tier)
  { id: "bal-nb-1201", tenant_id: TENANTS[0].id, item_id: "item-nb-1201", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "245", qty_reserved: "30", qty_available: "215", value: "651700.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1202", tenant_id: TENANTS[0].id, item_id: "item-nb-1202", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "198", qty_reserved: "12", qty_available: "186", value: "533610.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1204", tenant_id: TENANTS[0].id, item_id: "item-nb-1204", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "176", qty_reserved: "0",  qty_available: "176", value: "492800.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1205", tenant_id: TENANTS[0].id, item_id: "item-nb-1205", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "220", qty_reserved: "25", qty_available: "195", value: "631400.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1206", tenant_id: TENANTS[0].id, item_id: "item-nb-1206", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "85",  qty_reserved: "0",  qty_available: "85",  value: "256275.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1207", tenant_id: TENANTS[0].id, item_id: "item-nb-1207", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "112", qty_reserved: "8",  qty_available: "104", value: "325360.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1208", tenant_id: TENANTS[0].id, item_id: "item-nb-1208", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "52",  qty_reserved: "0",  qty_available: "52",  value: "160160.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1210", tenant_id: TENANTS[0].id, item_id: "item-nb-1210", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "61",  qty_reserved: "0",  qty_available: "61",  value: "185745.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1211", tenant_id: TENANTS[0].id, item_id: "item-nb-1211", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "44",  qty_reserved: "0",  qty_available: "44",  value: "131120.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1212", tenant_id: TENANTS[0].id, item_id: "item-nb-1212", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "58",  qty_reserved: "0",  qty_available: "58",  value: "170520.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1213", tenant_id: TENANTS[0].id, item_id: "item-nb-1213", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "97",  qty_reserved: "5",  qty_available: "92",  value: "305550.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1215", tenant_id: TENANTS[0].id, item_id: "item-nb-1215", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "73",  qty_reserved: "0",  qty_available: "73",  value: "224840.00", last_movement_id: null, version: 0, updated_at: iso(120) },

  // High Gloss Collection
  { id: "bal-nb-1301", tenant_id: TENANTS[0].id, item_id: "item-nb-1301", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "108", qty_reserved: "12", qty_available: "96",  value: "362880.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1302", tenant_id: TENANTS[0].id, item_id: "item-nb-1302", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "65",  qty_reserved: "0",  qty_available: "65",  value: "232050.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-1303", tenant_id: TENANTS[0].id, item_id: "item-nb-1303", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "82",  qty_reserved: "10", qty_available: "72",  value: "298480.00", last_movement_id: null, version: 0, updated_at: iso(120) },

  // Neo Bond Collection (premium sub-line — lower volume)
  { id: "bal-nb-101",  tenant_id: TENANTS[0].id, item_id: "item-nb-101",  location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "38",  qty_reserved: "4",  qty_available: "34",  value: "252700.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-301",  tenant_id: TENANTS[0].id, item_id: "item-nb-301",  location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "42",  qty_reserved: "0",  qty_available: "42",  value: "270480.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-202",  tenant_id: TENANTS[0].id, item_id: "item-nb-202",  location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "31",  qty_reserved: "0",  qty_available: "31",  value: "201810.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-201",  tenant_id: TENANTS[0].id, item_id: "item-nb-201",  location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "45",  qty_reserved: "5",  qty_available: "40",  value: "295650.00", last_movement_id: null, version: 0, updated_at: iso(120) },
  { id: "bal-nb-106",  tenant_id: TENANTS[0].id, item_id: "item-nb-106",  location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "26",  qty_reserved: "0",  qty_available: "26",  value: "182000.00", last_movement_id: null, version: 0, updated_at: iso(120) },
];

// ── Movements (recent ledger) ────────────────────────────────

export const MOVEMENTS = [
  { id: "mv-1", tenant_id: TENANTS[0].id, document_id: "doc-po-1", item_id: "item-nb-1502", location_id: "loc-main", bin_id: null, lot_id: null, serial_id: null, direction: "in",  quantity: "50", uom_id: "uom-sheet", base_quantity: "50", unit_cost: "850",  total_cost: "42500", posting_date: iso(30), reference_movement_id: null, source: "PO-00001", created_at: iso(30) },
  { id: "mv-2", tenant_id: TENANTS[0].id, document_id: "doc-po-2", item_id: "item-nb-1101", location_id: "loc-main", bin_id: null, lot_id: null, serial_id: null, direction: "in",  quantity: "200", uom_id: "uom-sheet", base_quantity: "200", unit_cost: "120",  total_cost: "24000", posting_date: iso(25), reference_movement_id: null, source: "PO-00002", created_at: iso(25) },
  { id: "mv-3", tenant_id: TENANTS[0].id, document_id: "doc-so-1", item_id: "item-nb-1101", location_id: "loc-main", bin_id: null, lot_id: null, serial_id: null, direction: "out", quantity: "72", uom_id: "uom-sheet", base_quantity: "72", unit_cost: "120",  total_cost: "8640",  posting_date: iso(5),  reference_movement_id: null, source: "SO-00003", created_at: iso(5) },
  { id: "mv-4", tenant_id: TENANTS[0].id, document_id: "doc-trn-1", item_id: "item-nb-1502", location_id: "loc-main",   bin_id: null, lot_id: null, serial_id: null, direction: "out", quantity: "8", uom_id: "uom-sheet", base_quantity: "8", unit_cost: "850",  total_cost: "6800", posting_date: iso(10), reference_movement_id: null, source: "TR-00001", created_at: iso(10) },
  { id: "mv-5", tenant_id: TENANTS[0].id, document_id: "doc-trn-1", item_id: "item-nb-1502", location_id: "loc-branch", bin_id: null, lot_id: null, serial_id: null, direction: "in",  quantity: "8", uom_id: "uom-sheet", base_quantity: "8", unit_cost: "850",  total_cost: "6800", posting_date: iso(10), reference_movement_id: "mv-4", source: "TR-00001", created_at: iso(10) },
];

// ── Valuation layers ────────────────────────────────────────

export const VALUATION_LAYERS = [
  { id: "vl-1", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", location_id: "loc-main", lot_id: null, movement_id: "mv-1", layer_date: iso(30), qty_original: "50",  qty_remaining: "42",  unit_cost: "850",  total_cost: "42500", currency_id: "cur-inr", exhausted: false, created_at: iso(30) },
  { id: "vl-2", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", location_id: "loc-main", lot_id: null, movement_id: "mv-2", layer_date: iso(25), qty_original: "200", qty_remaining: "128", unit_cost: "120",  total_cost: "24000", currency_id: "cur-inr", exhausted: false, created_at: iso(25) },
  { id: "vl-3", tenant_id: TENANTS[0].id, item_id: "item-nb-1213", location_id: "loc-main", lot_id: null, movement_id: "mv-6", layer_date: iso(20), qty_original: "100", qty_remaining: "80",  unit_cost: "20",   total_cost: "2000",  currency_id: "cur-inr", exhausted: false, created_at: iso(20) },
];

// ── Reservations ──────────────────────────────────────────

export const RESERVATIONS = [
  { id: "res-1", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", location_id: "loc-main", lot_id: null, quantity: "5",  status: "active",    reference_doc_id: null, reference_doc_line_id: null, remarks: "Reserved for Metro Chain SO — NB-1502 Mirror Gold", created_at: iso(2), updated_at: iso(2) },
  { id: "res-2", tenant_id: TENANTS[0].id, item_id: "item-nb-1213", location_id: "loc-main", lot_id: null, quantity: "10", status: "active",    reference_doc_id: null, reference_doc_line_id: null, remarks: "Reserved — NB-1213 Samsung Blue",                  created_at: iso(1), updated_at: iso(1) },
  { id: "res-3", tenant_id: TENANTS[0].id, item_id: "item-nb-1201", location_id: "loc-main", lot_id: null, quantity: "50", status: "fulfilled", reference_doc_id: null, reference_doc_line_id: null, remarks: "Fulfilled — NB-1201 Pure White bulk order",        created_at: iso(7), updated_at: iso(4) },
];

// ── Documents ──────────────────────────────────────────────

export const DOCUMENT_HEADERS: Array<any> = [
  { id: "doc-po-1",  tenant_id: TENANTS[0].id, document_type_id: "dt-po",  document_number: "PO-00001", document_date: "2026-03-01", posting_date: iso(30), party_id: "party-1",   source_location_id: null, destination_location_id: "loc-main", currency_id: "cur-usd", exchange_rate: "1", status_id: "stat-posted", remarks: "Initial stock buy", version: 1, created_at: iso(35), updated_at: iso(30) },
  { id: "doc-po-2",  tenant_id: TENANTS[0].id, document_type_id: "dt-po",  document_number: "PO-00002", document_date: "2026-03-10", posting_date: iso(25), party_id: "party-2",   source_location_id: null, destination_location_id: "loc-main", currency_id: "cur-usd", exchange_rate: "1", status_id: "stat-posted", remarks: "",                version: 1, created_at: iso(28), updated_at: iso(25) },
  { id: "doc-po-3",  tenant_id: TENANTS[0].id, document_type_id: "dt-po",  document_number: "PO-00003", document_date: "2026-04-20", posting_date: null,     party_id: "party-1",   source_location_id: null, destination_location_id: "loc-main", currency_id: "cur-usd", exchange_rate: "1", status_id: "stat-draft",  remarks: "Awaiting approval", version: 0, created_at: iso(4),  updated_at: iso(4) },
  { id: "doc-so-1",  tenant_id: TENANTS[0].id, document_type_id: "dt-so",  document_number: "SO-00001", document_date: "2026-04-18", posting_date: iso(5),   party_id: "party-3",   source_location_id: "loc-main", destination_location_id: null, currency_id: "cur-usd", exchange_rate: "1", status_id: "stat-posted", remarks: "",                version: 1, created_at: iso(6),  updated_at: iso(5) },
  { id: "doc-so-2",  tenant_id: TENANTS[0].id, document_type_id: "dt-so",  document_number: "SO-00002", document_date: "2026-04-22", posting_date: null,     party_id: "party-4",   source_location_id: "loc-main", destination_location_id: null, currency_id: "cur-usd", exchange_rate: "1", status_id: "stat-draft",  remarks: "",                version: 0, created_at: iso(2),  updated_at: iso(2) },
  { id: "doc-trn-1", tenant_id: TENANTS[0].id, document_type_id: "dt-trn", document_number: "TR-00001", document_date: "2026-04-14", posting_date: iso(10), party_id: null,        source_location_id: "loc-main", destination_location_id: "loc-branch", currency_id: "cur-usd", exchange_rate: "1", status_id: "stat-posted", remarks: "Rebalance",        version: 1, created_at: iso(12), updated_at: iso(10) },
];

export const DOCUMENT_LINES: Record<string, any[]> = {
  // All lines reference NB-* items only.
  "doc-po-1": [
    { id: "dl-1a", document_id: "doc-po-1", line_number: 1, item_id: "item-nb-1502", uom_id: "uom-sheet", quantity: "50", unit_price: "850", discount_pct: "0", tax_amount: "0", line_total: "42500", lot_id: null, serial_id: null, bin_id: null, remarks: "Substrate for NB-1502 Mirror Gold line" },
  ],
  "doc-po-2": [
    { id: "dl-2a", document_id: "doc-po-2", line_number: 1, item_id: "item-nb-1101", uom_id: "uom-sheet", quantity: "200", unit_price: "120", discount_pct: "0", tax_amount: "0", line_total: "24000", lot_id: null, serial_id: null, bin_id: null, remarks: "Substrate for NB-1101 Bright Silver line" },
  ],
  "doc-po-3": [
    { id: "dl-3a", document_id: "doc-po-3", line_number: 1, item_id: "item-nb-1213", uom_id: "uom-sheet", quantity: "100", unit_price: "20",  discount_pct: "0", tax_amount: "0", line_total: "2000", lot_id: null, serial_id: null, bin_id: null, remarks: "Substrate for NB-1213 Samsung Blue line" },
    { id: "dl-3b", document_id: "doc-po-3", line_number: 2, item_id: "item-nb-1205", uom_id: "uom-sheet", quantity: "500", unit_price: "18",  discount_pct: "0", tax_amount: "0", line_total: "9000", lot_id: null, serial_id: null, bin_id: null, remarks: "Substrate for NB-1205 Black line" },
  ],
  "doc-so-1": [
    { id: "dl-so1a", document_id: "doc-so-1", line_number: 1, item_id: "item-nb-1101", uom_id: "uom-sheet", quantity: "72", unit_price: "180", discount_pct: "0", tax_amount: "0", line_total: "12960", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
  ],
  "doc-trn-1": [
    { id: "dl-tr1a", document_id: "doc-trn-1", line_number: 1, item_id: "item-nb-1502", uom_id: "uom-sheet", quantity: "8", unit_price: "0", discount_pct: "0", tax_amount: "0", line_total: "0", lot_id: null, serial_id: null, bin_id: null, remarks: "Inter-warehouse rebalance" },
  ],
};

// ── Invoices ────────────────────────────────────────────
//
// Three demo invoices showcasing the full state machine and
// place-of-supply math:
//   inv-1  draft, intra-state (Acme MH → Greenfield MH)  — CGST+SGST
//   inv-2  posted, inter-state (Acme MH → Metro DL)      — IGST
//   inv-3  cancelled, intra-state                        — shows reversal trail
// Math is pre-computed (no live re-derivation needed in adapter).
//
// Tenant state_code = "27" (Maharashtra). All invoice math assumes
// that as the seller's place of business.

export const INVOICES = [
  {
    id: "inv-1",
    tenant_id: TENANTS[0].id,
    invoice_number: "INV/2026-04/0001",
    invoice_date: "2026-04-22",
    due_date: "2026-05-22",
    party_id: "party-3",          // Greenfield Retail (MH 27)
    place_of_supply: "27",
    status: "draft",
    challan_id: null,
    irn: null,
    qr_code_data: null,
    subtotal: "1100.00",
    tax_total: "198.00",
    grand_total: "1298.00",
    amount_in_words: "One Thousand Two Hundred Ninety Eight Rupees",
    remarks: "Initial order — net-30 terms",
    posting_date: null,
    cancelled_at: null,
    cancellation_reason: null,
    version: 0,
    created_at: iso(4),
    updated_at: iso(2),
    created_by: "user-admin",
    updated_by: "user-admin",
  },
  {
    id: "inv-2",
    tenant_id: TENANTS[0].id,
    invoice_number: "INV/2026-04/0002",
    invoice_date: "2026-04-15",
    due_date: "2026-05-15",
    party_id: "party-4",          // Metro Chain (DL 07) — inter-state
    place_of_supply: "07",
    status: "posted",
    challan_id: null,
    irn: null,
    qr_code_data: null,
    subtotal: "1700.00",
    tax_total: "306.00",
    grand_total: "2006.00",
    amount_in_words: "Two Thousand Six Rupees",
    remarks: "",
    posting_date: iso(11),
    cancelled_at: null,
    cancellation_reason: null,
    version: 1,
    created_at: iso(12),
    updated_at: iso(11),
    created_by: "user-admin",
    updated_by: "user-admin",
  },
  {
    id: "inv-3",
    tenant_id: TENANTS[0].id,
    invoice_number: "INV/2026-04/0003",
    invoice_date: "2026-04-08",
    due_date: "2026-05-08",
    party_id: "party-3",
    place_of_supply: "27",
    status: "cancelled",
    challan_id: null,
    irn: null,
    qr_code_data: null,
    subtotal: "270.00",
    tax_total: "32.40",
    grand_total: "302.40",
    amount_in_words: "Three Hundred Two Rupees and Forty Paise",
    remarks: "Cancelled — wrong line price",
    posting_date: iso(20),
    cancelled_at: iso(18),
    cancellation_reason: "Wrong unit price — replaced by INV/2026-04/0004",
    version: 2,
    created_at: iso(21),
    updated_at: iso(18),
    created_by: "user-admin",
    updated_by: "user-admin",
  },
];

export const INVOICE_LINES: Record<string, unknown[]> = {
  // Note: monetary amounts (qty, unit_price, taxable_value, GST, line_total)
  // are preserved verbatim from the pre-Nova-Bond demo so the linked
  // payments / allocations / ledger entries / account balances still
  // reconcile. Item references + descriptions swapped to NB SKUs;
  // narrative is "promotional sample shipments at heavily discounted
  // unit pricing" — explains why ₹180/sheet sample appears against an
  // item with ₹5,800 default sale price.
  "inv-1": [
    { id: "il-1a", invoice_id: "inv-1", line_number: 1, item_id: "item-nb-1101", hsn_code: "76061200", description: "NB-1101 Bright Silver — Metallic Collection · 2mm sample sheet", uom_id: "uom-sheet", quantity: "5",  unit_price: "180", discount_pct: "0", rate_pct: "18", taxable_value:  "900.00", cgst_amount:  "81.00", sgst_amount:  "81.00", igst_amount: "0.00", cess_amount: "0.00", line_total: "1062.00", lot_id: null, serial_id: null, remarks: "Promotional sample swatch" },
    { id: "il-1b", invoice_id: "inv-1", line_number: 2, item_id: "item-nb-1205", hsn_code: "76061200", description: "NB-1205 Black — Solid Color Collection · 2mm clearance",          uom_id: "uom-sheet", quantity: "10", unit_price:  "20", discount_pct: "0", rate_pct: "18", taxable_value:  "200.00", cgst_amount:  "18.00", sgst_amount:  "18.00", igst_amount: "0.00", cess_amount: "0.00", line_total:  "236.00", lot_id: null, serial_id: null, remarks: "Edge-damaged stock — clearance" },
  ],
  "inv-2": [
    { id: "il-2a", invoice_id: "inv-2", line_number: 1, item_id: "item-nb-1502", hsn_code: "76061200", description: "NB-1502 Mirror Gold — Premium Collection · 4mm",                  uom_id: "uom-sheet", quantity: "2",  unit_price: "850", discount_pct: "0", rate_pct: "18", taxable_value: "1700.00", cgst_amount:   "0.00", sgst_amount:   "0.00", igst_amount: "306.00", cess_amount: "0.00", line_total: "2006.00", lot_id: null, serial_id: null, remarks: "Bulk-deal pricing for repeat customer" },
  ],
  "inv-3": [
    { id: "il-3a", invoice_id: "inv-3", line_number: 1, item_id: "item-nb-1201", hsn_code: "76061200", description: "NB-1201 Pure White — Solid Color Collection · 2mm seconds",       uom_id: "uom-sheet", quantity: "30", unit_price:   "9", discount_pct: "0", rate_pct: "12", taxable_value:  "270.00", cgst_amount:  "16.20", sgst_amount:  "16.20", igst_amount: "0.00", cess_amount: "0.00", line_total:  "302.40", lot_id: null, serial_id: null, remarks: "Cancelled — wrong unit price keyed in" },
  ],
};

// ── Routes ──────────────────────────────────────────────
//
// Demo sales territories — five common Indian distribution routes.
// Tenants in production add their own. Routes drive cascading
// customer pickers on Challan/SO/Invoice forms (Phase 1 polish).

export const ROUTES = [
  { id: "route-mum-n", tenant_id: TENANTS[0].id, code: "MUM-N",   name: "Mumbai North",     is_active: true,  created_at: iso(120), updated_at: iso(120) },
  { id: "route-mum-s", tenant_id: TENANTS[0].id, code: "MUM-S",   name: "Mumbai South",     is_active: true,  created_at: iso(120), updated_at: iso(120) },
  { id: "route-pune",  tenant_id: TENANTS[0].id, code: "PUNE",    name: "Pune metro",       is_active: true,  created_at: iso(120), updated_at: iso(120) },
  { id: "route-blr-c", tenant_id: TENANTS[0].id, code: "BLR-C",   name: "Bengaluru Central", is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "route-del-n", tenant_id: TENANTS[0].id, code: "DEL-N",   name: "Delhi NCR (north)", is_active: true, created_at: iso(120), updated_at: iso(120) },
];

// ── Challans ────────────────────────────────────────────
//
// Three demo challans showing the full state machine:
//   ch-1  draft, no route assigned yet                    (editable)
//   ch-2  posted, with route + vehicle + driver           (in-flight)
//   ch-3  posted + billed (linked to invoice inv-2)       (closed)
//
// is_billed flips when the user picks the challan in the Source-
// Challan dropdown on a new Invoice. The link is bi-directional:
// challan.invoice_id <-> invoice.challan_id.

export const CHALLANS = [
  {
    id: "ch-1",
    tenant_id: TENANTS[0].id,
    challan_number: "DC/2026-04/0011",
    challan_date: "2026-04-25",
    party_id: "party-3",                  // Greenfield Retail (MH)
    route_id: null,
    source_location_id: "loc-main",
    destination_address: "Greenfield Retail, Andheri W, Mumbai 400058",
    vehicle_number: null,
    driver_name: null,
    driver_phone: null,
    status: "draft",
    is_billed: false,
    print_mode: "no_amount",
    invoice_id: null,
    subtotal: "1100.00",
    discount_total: "0.00",
    grand_total: "1100.00",
    remarks: "Driver TBD — courier dispatch tomorrow morning",
    posting_date: null,
    cancelled_at: null,
    cancellation_reason: null,
    version: 0,
    created_at: iso(1),
    updated_at: iso(1),
    created_by: "user-admin",
    updated_by: "user-admin",
  },
  {
    id: "ch-2",
    tenant_id: TENANTS[0].id,
    challan_number: "DC/2026-04/0009",
    challan_date: "2026-04-22",
    party_id: "party-3",
    route_id: "route-mum-n",
    source_location_id: "loc-main",
    destination_address: "Greenfield Retail, Bandra W, Mumbai 400050",
    vehicle_number: "MH-12-AB-3491",
    driver_name: "Sandeep Patil",
    driver_phone: "+91 98220 11223",
    status: "posted",
    is_billed: false,
    print_mode: "no_amount",
    invoice_id: null,
    subtotal: "900.00",
    discount_total: "0.00",
    grand_total: "900.00",
    remarks: "",
    posting_date: iso(4),
    cancelled_at: null,
    cancellation_reason: null,
    version: 1,
    created_at: iso(5),
    updated_at: iso(4),
    created_by: "user-admin",
    updated_by: "user-admin",
  },
  {
    id: "ch-3",
    tenant_id: TENANTS[0].id,
    challan_number: "DC/2026-04/0006",
    challan_date: "2026-04-14",
    party_id: "party-4",                   // Metro Chain (Delhi — inter-state)
    route_id: "route-del-n",
    source_location_id: "loc-main",
    destination_address: "Metro Chain Stores, Connaught Place, New Delhi 110001",
    vehicle_number: "DL-1C-XY-7700",
    driver_name: "Rajesh Kumar",
    driver_phone: "+91 98100 88777",
    status: "posted",
    is_billed: true,                       // promoted to inv-2
    print_mode: "with_remarks",
    invoice_id: "inv-2",
    subtotal: "1700.00",
    discount_total: "0.00",
    grand_total: "1700.00",
    remarks: "Inter-state — IGST applies on the linked invoice",
    posting_date: iso(13),
    cancelled_at: null,
    cancellation_reason: null,
    version: 2,
    created_at: iso(14),
    updated_at: iso(11),
    created_by: "user-admin",
    updated_by: "user-admin",
  },
];

export const CHALLAN_LINES: Record<string, unknown[]> = {
  "ch-1": [
    { id: "cl-1a", challan_id: "ch-1", line_number: 1, item_id: "item-nb-1101", description: "NB-1101 Bright Silver — Metallic Collection · 2mm sample sheet", uom_id: "uom-sheet", quantity:  "5", unit_price: "180", discount_pct: "0", line_total:  "900.00", lot_id: null, serial_id: null, remarks: "" },
    { id: "cl-1b", challan_id: "ch-1", line_number: 2, item_id: "item-nb-1205", description: "NB-1205 Black — Solid Color Collection · 2mm clearance",          uom_id: "uom-sheet", quantity: "10", unit_price:  "20", discount_pct: "0", line_total:  "200.00", lot_id: null, serial_id: null, remarks: "" },
  ],
  "ch-2": [
    { id: "cl-2a", challan_id: "ch-2", line_number: 1, item_id: "item-nb-1101", description: "NB-1101 Bright Silver — Metallic Collection · 2mm sample sheet", uom_id: "uom-sheet", quantity:  "5", unit_price: "180", discount_pct: "0", line_total:  "900.00", lot_id: null, serial_id: null, remarks: "" },
  ],
  "ch-3": [
    { id: "cl-3a", challan_id: "ch-3", line_number: 1, item_id: "item-nb-1502", description: "NB-1502 Mirror Gold — Premium Collection · 4mm",                  uom_id: "uom-sheet", quantity:  "2", unit_price: "850", discount_pct: "0", line_total: "1700.00", lot_id: null, serial_id: null, remarks: "" },
  ],
};

// ── Counts ───────────────────────────────────────────────

export const COUNTS = [
  { id: "cnt-1", tenant_id: TENANTS[0].id, count_number: "CNT-001", count_date: "2026-04-10", location_id: "loc-main", remarks: "Quarterly count", created_at: iso(14), updated_at: iso(14) },
  { id: "cnt-2", tenant_id: TENANTS[0].id, count_number: "CNT-002", count_date: "2026-04-22", location_id: "loc-branch", remarks: "", created_at: iso(2),  updated_at: iso(2) },
];

export const COUNT_LINES: Record<string, any[]> = {
  "cnt-1": [
    { id: "cl-1", count_id: "cnt-1", item_id: "item-nb-1502", system_qty: "42",  counted_qty: "40",  variance_qty: "-2", remarks: "2 sheets missing — possible damage during transit" },
    { id: "cl-2", count_id: "cnt-1", item_id: "item-nb-1101", system_qty: "128", counted_qty: "128", variance_qty: "0",  remarks: "" },
  ],
  "cnt-2": [],
};

// ── Lots + Serials ────────────────────────────────────────

// ── Lots ──────────────────────────────────────────────
//
// Empty by design: lots are created at GRN time when batch-tracked
// items are received. New tenants start with no lots — they emerge
// as goods physically arrive. See /documents/goods-receipts/new.
export const LOTS: Record<string, any[]> = {};

// ── Serials ───────────────────────────────────────────
//
// Empty by design: Nova Bond's NB-* items are batch-tracked, not
// serial-tracked. Serials are reserved for future high-value SKUs
// where individual unit tracking is required.
export const SERIALS: Record<string, any[]> = {};

// ── Reorder policies ───────────────────────────────────
//
// Empty by design: Mr. Arpit will set reorder thresholds per item
// once he's calibrated his typical consumption. They appear here
// as he configures them via the items detail page.
export const REORDER_POLICIES: Record<string, any[]> = {};

// ── Workflows, custom fields, integrations (minimal) ──

export const WORKFLOWS = [
  { id: "wf-po", tenant_id: TENANTS[0].id, code: "po-standard", name: "Purchase Order Standard", entity: "document", is_active: true, created_at: iso(100), updated_at: iso(100) },
];

export const CUSTOM_FIELDS = [
  { id: "cf-1", tenant_id: TENANTS[0].id, entity: "item",  parent_field_id: null, code: "shelf_life_days", label: "Shelf Life (days)", field_type: "number", options: null, validation: null, is_required: false, sort_order: 0, created_at: iso(60), updated_at: iso(60) },
  { id: "cf-2", tenant_id: TENANTS[0].id, entity: "party", parent_field_id: null, code: "credit_rating",   label: "Credit Rating",     field_type: "select", options: { choices: ["A", "B", "C"] }, validation: null, is_required: false, sort_order: 0, created_at: iso(60), updated_at: iso(60) },
];

export const INTEGRATIONS = [
  { id: "int-1", tenant_id: TENANTS[0].id, name: "Shopify",  provider: "shopify",  config: {}, is_active: true,  created_at: iso(60), updated_at: iso(60) },
  { id: "int-2", tenant_id: TENANTS[0].id, name: "QuickBooks", provider: "quickbooks", config: {}, is_active: false, created_at: iso(60), updated_at: iso(60) },
];

export const WEBHOOKS = [
  { id: "wh-1", tenant_id: TENANTS[0].id, integration_id: "int-1", event_type: "document.posted", url: "https://example.com/hooks/shopify", secret: null, is_active: true, created_at: iso(60), updated_at: iso(60) },
];

export const ATTACHMENTS = [
  { id: "att-1", tenant_id: TENANTS[0].id, entity: "document_header", entity_id: "doc-po-1", file_name: "invoice-kaizen-2026-03-01.pdf", file_path: "#", mime_type: "application/pdf", file_size: 254_832, created_at: iso(30), created_by: null },
];

export const IMPORTS = [
  { id: "imp-1", tenant_id: TENANTS[0].id, entity: "items", file_name: "items-catalog-q1.csv", status: "completed", total_rows: 250, success_rows: 248, error_rows: 2, errors: null, created_at: iso(45), created_by: null },
];

// Tenant / module config
export const TENANT_CONFIG: Array<any> = [
  { id: "tc-1", tenant_id: TENANTS[0].id, key: "fiscal_year_start_month", value: 4, created_at: iso(100), updated_at: iso(100) },
];

// ── Phase 13 — Item Dimensions + Pricing Rules ────────────
//
// 12 standard ACP panel dimension combinations: 4 thicknesses × 3 sizes.
// These are the FIXED set Nova Bond manufactures; tenants in another
// industry would seed different combos (or none, if their items don't
// vary by dimension).
export const ITEM_DIMENSIONS: Array<any> = [
  // Thickness 2mm
  { id: "dim-2-1220x2440", tenant_id: TENANTS[0].id, thickness_mm: 2, size_code: "1220x2440", label: "2mm · 1220 × 2440 mm (4×8 ft)",  is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-2-1220x3050", tenant_id: TENANTS[0].id, thickness_mm: 2, size_code: "1220x3050", label: "2mm · 1220 × 3050 mm (4×10 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-2-1220x3660", tenant_id: TENANTS[0].id, thickness_mm: 2, size_code: "1220x3660", label: "2mm · 1220 × 3660 mm (4×12 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  // Thickness 3mm
  { id: "dim-3-1220x2440", tenant_id: TENANTS[0].id, thickness_mm: 3, size_code: "1220x2440", label: "3mm · 1220 × 2440 mm (4×8 ft)",  is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-3-1220x3050", tenant_id: TENANTS[0].id, thickness_mm: 3, size_code: "1220x3050", label: "3mm · 1220 × 3050 mm (4×10 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-3-1220x3660", tenant_id: TENANTS[0].id, thickness_mm: 3, size_code: "1220x3660", label: "3mm · 1220 × 3660 mm (4×12 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  // Thickness 4mm
  { id: "dim-4-1220x2440", tenant_id: TENANTS[0].id, thickness_mm: 4, size_code: "1220x2440", label: "4mm · 1220 × 2440 mm (4×8 ft)",  is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-4-1220x3050", tenant_id: TENANTS[0].id, thickness_mm: 4, size_code: "1220x3050", label: "4mm · 1220 × 3050 mm (4×10 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-4-1220x3660", tenant_id: TENANTS[0].id, thickness_mm: 4, size_code: "1220x3660", label: "4mm · 1220 × 3660 mm (4×12 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  // Thickness 5mm
  { id: "dim-5-1220x2440", tenant_id: TENANTS[0].id, thickness_mm: 5, size_code: "1220x2440", label: "5mm · 1220 × 2440 mm (4×8 ft)",  is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-5-1220x3050", tenant_id: TENANTS[0].id, thickness_mm: 5, size_code: "1220x3050", label: "5mm · 1220 × 3050 mm (4×10 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
  { id: "dim-5-1220x3660", tenant_id: TENANTS[0].id, thickness_mm: 5, size_code: "1220x3660", label: "5mm · 1220 × 3660 mm (4×12 ft)", is_active: true, created_at: iso(120), updated_at: iso(120) },
];

// Sample pricing rules for two demo items (NB-1101 Bright Silver,
// NB-1502 Mirror Gold). Each item has a current rule per dimension
// with sample prices. NB-1101 also has one historical rule (closed
// 60 days ago) so the version-history UI has something to show.
//
// Pricing pattern: 3mm = base, 2mm = ~80%, 4mm = ~125%, 5mm = ~155%.
// Larger sizes scale linearly with area: 1220×3050 = ~125% of 4×8,
// 1220×3660 = ~150% of 4×8.
export const ITEM_PRICING_RULES: Array<any> = [
  // ─── NB-1101 Bright Silver — current rules (valid_from 60 days ago, valid_until null) ───
  // Base: 3mm 4×8 = ₹5,800 (matches default_sale_price on the item)
  { id: "pr-1101-3-2440", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 3, size_code: "1220x2440", sale_price: "5800.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-3-3050", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 3, size_code: "1220x3050", sale_price: "7250.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-3-3660", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 3, size_code: "1220x3660", sale_price: "8700.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-2-2440", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 2, size_code: "1220x2440", sale_price: "4640.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-2-3050", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 2, size_code: "1220x3050", sale_price: "5800.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-2-3660", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 2, size_code: "1220x3660", sale_price: "6960.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-4-2440", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 4, size_code: "1220x2440", sale_price: "7250.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-4-3050", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 4, size_code: "1220x3050", sale_price: "9060.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-4-3660", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 4, size_code: "1220x3660", sale_price: "10870.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",               created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-5-2440", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 5, size_code: "1220x2440", sale_price: "8990.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",                created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-5-3050", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 5, size_code: "1220x3050", sale_price: "11240.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",               created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1101-5-3660", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 5, size_code: "1220x3660", sale_price: "13490.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",               created_at: iso(60), created_by: "user-admin" },

  // ─── NB-1101 historical rule — closed when Q4 prices kicked in ───
  // Single example so the version-history UI shows real data.
  { id: "pr-1101-3-2440-prev", tenant_id: TENANTS[0].id, item_id: "item-nb-1101", thickness_mm: 3, size_code: "1220x2440", sale_price: "5500.00", valid_from: "2026-01-01", valid_until: "2026-03-02", notes: "Q3 list price",   created_at: iso(150), created_by: "user-admin" },

  // ─── NB-1502 Mirror Gold — current rules (premium tier ~₹9,200 base) ───
  { id: "pr-1502-3-2440", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", thickness_mm: 3, size_code: "1220x2440", sale_price: "9200.00",  valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",               created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1502-3-3050", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", thickness_mm: 3, size_code: "1220x3050", sale_price: "11500.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",              created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1502-3-3660", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", thickness_mm: 3, size_code: "1220x3660", sale_price: "13800.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",              created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1502-4-2440", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", thickness_mm: 4, size_code: "1220x2440", sale_price: "11500.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",              created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1502-4-3050", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", thickness_mm: 4, size_code: "1220x3050", sale_price: "14375.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",              created_at: iso(60), created_by: "user-admin" },
  { id: "pr-1502-4-3660", tenant_id: TENANTS[0].id, item_id: "item-nb-1502", thickness_mm: 4, size_code: "1220x3660", sale_price: "17250.00", valid_from: "2026-03-03", valid_until: null, notes: "Q4 list price",              created_at: iso(60), created_by: "user-admin" },
];

// ── Audit log (Phase 9) ───────────────────────────────────
//
// Sample entries that demonstrate the breadth of actions backend
// will audit. Real backend writes these on every critical action;
// demo seeds a handful so the viewer page shows real-looking data.
export const AUDIT_LOG_ENTRIES: Array<any> = [
  {
    id: "audit-1", tenant_id: TENANTS[0].id,
    user_id: "user-admin", user_email: "admin@meridian-pharma.com",
    action: "invoice.post", entity_type: "invoice", entity_id: "inv-2",
    before: { status: "draft" }, after: { status: "posted", posting_date: iso(11) },
    remarks: null,
    created_at: iso(11), ip_address: "203.0.113.42", user_agent: "Mozilla/5.0",
  },
  {
    id: "audit-2", tenant_id: TENANTS[0].id,
    user_id: "user-admin", user_email: "admin@meridian-pharma.com",
    action: "invoice.cancel", entity_type: "invoice", entity_id: "inv-3",
    before: { status: "posted" }, after: { status: "cancelled" },
    remarks: "Wrong unit price — replaced by INV/2026-04/0004",
    created_at: iso(18), ip_address: "203.0.113.42", user_agent: "Mozilla/5.0",
  },
  {
    id: "audit-3", tenant_id: TENANTS[0].id,
    user_id: "user-admin", user_email: "admin@meridian-pharma.com",
    action: "payment.post", entity_type: "payment", entity_id: "pay-1",
    before: { status: "draft" }, after: { status: "posted" },
    remarks: null,
    created_at: iso(9), ip_address: "203.0.113.42", user_agent: "Mozilla/5.0",
  },
  {
    id: "audit-4", tenant_id: TENANTS[0].id,
    user_id: "user-admin", user_email: "admin@meridian-pharma.com",
    action: "vendor_bill.post", entity_type: "vendor_bill", entity_id: "bill-1",
    before: { status: "draft" }, after: { status: "posted" },
    remarks: null,
    created_at: iso(7), ip_address: "203.0.113.42", user_agent: "Mozilla/5.0",
  },
  {
    id: "audit-5", tenant_id: TENANTS[0].id,
    user_id: "user-admin", user_email: "admin@meridian-pharma.com",
    action: "expense.post", entity_type: "expense", entity_id: "expense-1",
    before: { status: "draft" }, after: { status: "posted" },
    remarks: null,
    created_at: iso(2), ip_address: "203.0.113.42", user_agent: "Mozilla/5.0",
  },
  {
    id: "audit-6", tenant_id: TENANTS[0].id,
    user_id: "user-admin", user_email: "admin@meridian-pharma.com",
    action: "role.permission_grant", entity_type: "role", entity_id: "role-cashier",
    before: { permissions: ["inventory.payments.read"] },
    after: { permissions: ["inventory.payments.read", "inventory.payments.write"] },
    remarks: null,
    created_at: iso(15), ip_address: "203.0.113.42", user_agent: "Mozilla/5.0",
  },
];

export const MODULE_CONFIG: Array<any> = [
  { id: "mc-1", tenant_id: TENANTS[0].id, module: "inventory", key: "default_costing_method", value: "FIFO", created_at: iso(100), updated_at: iso(100) },
];

// ═══════════════════════════════════════════════════════════════════
// Phase 3 — Money: Employees, Financial Accounts, Ledger, Payments
//
// Layout:
//  1. Employees (auto-seeds an employee_float account each)
//  2. FinancialAccounts: 5 system + 1 per party + 1 per employee + 1 sales_income + 1 gst_output
//  3. LedgerEntries: opening-balance entries to materialise the
//     opening_balance values on parties + sample receipts
//  4. Payments: a few sample receipts in different modes + one paid-vendor
//  5. PaymentAllocations: applied against existing demo invoices
//
// All `current_balance` values are pre-computed below to match what the
// adapter would produce on POST. Don't edit one without re-running the
// math; tests in src/services/list-shape.integration.test.ts assert that
// the totals reconcile.
// ═══════════════════════════════════════════════════════════════════

// ── Employees ──────────────────────────────────────────────
export const EMPLOYEES: Array<any> = [
  { id: "emp-1", tenant_id: TENANTS[0].id, user_id: null, name: "Ramesh Kumar",   role: "Sales Executive — MUM-N", monthly_salary: "45000.00", phone: "+91 98200 11111", email: "ramesh@example.com",   payment_account_id: "acc-bank-hdfc", joined_at: "2024-06-01", is_active: true,  float_account_id: "acc-float-emp-1", payable_account_id: "acc-emp-payable-1", created_at: iso(300), updated_at: iso(2) },
  { id: "emp-2", tenant_id: TENANTS[0].id, user_id: null, name: "Priya Shah",     role: "Sales Executive — PUNE", monthly_salary: "42000.00", phone: "+91 98200 22222", email: "priya@example.com",    payment_account_id: "acc-bank-hdfc", joined_at: "2025-01-15", is_active: true,  float_account_id: "acc-float-emp-2", payable_account_id: "acc-emp-payable-2", created_at: iso(200), updated_at: iso(2) },
  { id: "emp-3", tenant_id: TENANTS[0].id, user_id: null, name: "Suresh Patel",   role: "Driver / Dispatcher",     monthly_salary: "28000.00", phone: "+91 98200 33333", email: null,                   payment_account_id: "acc-cash",      joined_at: "2024-09-10", is_active: true,  float_account_id: "acc-float-emp-3", payable_account_id: "acc-emp-payable-3", created_at: iso(250), updated_at: iso(2) },
  { id: "emp-4", tenant_id: TENANTS[0].id, user_id: null, name: "Anita Verma",    role: "Accountant",              monthly_salary: "55000.00", phone: "+91 98200 44444", email: "anita@example.com",    payment_account_id: "acc-bank-hdfc", joined_at: "2024-03-20", is_active: false, float_account_id: "acc-float-emp-4", payable_account_id: "acc-emp-payable-4", created_at: iso(350), updated_at: iso(20) },
];

// ── Financial Accounts (Chart of Accounts) ─────────────────
//
// Codes follow these conventions:
//   CASH, BANK-<short>, CHQ-TRANSIT, GPAY  → company-wide cash equivalents
//   AR-<party_code>                        → per-party receivable
//   AP-<party_code>                        → per-party payable
//   FLOAT-<emp_short>                      → per-employee float
//   SALES, GST-OUT                         → income + GST liability
//
// `current_balance` is signed; positive = debit nature (asset/expense),
// negative = credit nature (liability/income/equity). The UX shows
// the absolute value with a "Dr"/"Cr" suffix.
export const FINANCIAL_ACCOUNTS: Array<any> = [
  // System accounts (one per type)
  // current_balance: opening 25000 + pay-1 cash receipt 12500 = 37500, then expense-1 petrol 1500 = 36000
  { id: "acc-cash",        tenant_id: TENANTS[0].id, type: "cash_in_hand",     code: "CASH",        name: "Cash in Hand",            party_id: null,    employee_id: null, account_number: null,        ifsc: null,         opening_balance: "25000.00",   current_balance: "36000.00",  is_system: true, is_active: true, created_at: iso(300), updated_at: iso(2) },
  { id: "acc-bank-hdfc",   tenant_id: TENANTS[0].id, type: "bank",             code: "BANK-HDFC",   name: "HDFC Current Account",     party_id: null,    employee_id: null, account_number: "0000xx4521", ifsc: "HDFC0001234", opening_balance: "450000.00",  current_balance: "500000.00", is_system: true, is_active: true, created_at: iso(300), updated_at: iso(1) },
  { id: "acc-chq-transit", tenant_id: TENANTS[0].id, type: "cheque_in_transit", code: "CHQ-TRANSIT", name: "Cheques in Transit",       party_id: null,    employee_id: null, account_number: null,        ifsc: null,         opening_balance: "0.00",       current_balance: "8750.00",   is_system: true, is_active: true, created_at: iso(300), updated_at: iso(1) },
  { id: "acc-gpay",        tenant_id: TENANTS[0].id, type: "gpay",             code: "GPAY",        name: "Company GPay Collection",  party_id: null,    employee_id: null, account_number: "company@upi", ifsc: null,        opening_balance: "0.00",       current_balance: "5500.00",   is_system: true, is_active: true, created_at: iso(300), updated_at: iso(1) },
  { id: "acc-sales",       tenant_id: TENANTS[0].id, type: "sales_income",     code: "SALES",       name: "Sales Income",             party_id: null,    employee_id: null, account_number: null,        ifsc: null,         opening_balance: "0.00",       current_balance: "-71250.00", is_system: true, is_active: true, created_at: iso(300), updated_at: iso(2) },
  { id: "acc-gst-out",     tenant_id: TENANTS[0].id, type: "gst_output",       code: "GST-OUT",     name: "GST Output (Liability)",   party_id: null,    employee_id: null, account_number: null,        ifsc: null,         opening_balance: "0.00",       current_balance: "-12825.00", is_system: true, is_active: true, created_at: iso(300), updated_at: iso(2) },

  // Per-party receivables / payables (auto-created with party)
  { id: "acc-ar-party-3",  tenant_id: TENANTS[0].id, type: "party_receivable", code: "AR-CUS-001",  name: "AR — Greenfield Retail",   party_id: "party-3", employee_id: null, account_number: null,      ifsc: null,         opening_balance: "12500.00",   current_balance: "11325.00",  is_system: true, is_active: true, created_at: iso(100), updated_at: iso(1) },
  { id: "acc-ar-party-4",  tenant_id: TENANTS[0].id, type: "party_receivable", code: "AR-CUS-002",  name: "AR — Metro Chain Stores",  party_id: "party-4", employee_id: null, account_number: null,      ifsc: null,         opening_balance: "8750.00",    current_balance: "8750.00",   is_system: true, is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "acc-ar-party-5",  tenant_id: TENANTS[0].id, type: "party_receivable", code: "AR-BOTH-01",  name: "AR — Unity Distributors",  party_id: "party-5", employee_id: null, account_number: null,      ifsc: null,         opening_balance: "0.00",       current_balance: "0.00",      is_system: true, is_active: true, created_at: iso(100), updated_at: iso(100) },
  // current_balance: opening -45000 + bill-1 (60000+7800 GST = 67800 credit) = -112800
  { id: "acc-ap-party-1",  tenant_id: TENANTS[0].id, type: "party_payable",    code: "AP-SUP-001",  name: "AP — Kaizen Imports",      party_id: "party-1", employee_id: null, account_number: null,      ifsc: null,         opening_balance: "-45000.00",  current_balance: "-112800.00", is_system: true, is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "acc-ap-party-2",  tenant_id: TENANTS[0].id, type: "party_payable",    code: "AP-SUP-002",  name: "AP — Horizon Traders",     party_id: "party-2", employee_id: null, account_number: null,      ifsc: null,         opening_balance: "0.00",       current_balance: "0.00",      is_system: true, is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "acc-ap-party-5",  tenant_id: TENANTS[0].id, type: "party_payable",    code: "AP-BOTH-01",  name: "AP — Unity Distributors",  party_id: "party-5", employee_id: null, account_number: null,      ifsc: null,         opening_balance: "0.00",       current_balance: "0.00",      is_system: true, is_active: true, created_at: iso(100), updated_at: iso(100) },

  // Per-employee float accounts
  { id: "acc-float-emp-1", tenant_id: TENANTS[0].id, type: "employee_float",   code: "FLOAT-RAMESH",  name: "Float — Ramesh Kumar",    party_id: null, employee_id: "emp-1", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "8500.00", is_system: true, is_active: true,  created_at: iso(300), updated_at: iso(1) },
  { id: "acc-float-emp-2", tenant_id: TENANTS[0].id, type: "employee_float",   code: "FLOAT-PRIYA",   name: "Float — Priya Shah",      party_id: null, employee_id: "emp-2", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true,  created_at: iso(200), updated_at: iso(200) },
  { id: "acc-float-emp-3", tenant_id: TENANTS[0].id, type: "employee_float",   code: "FLOAT-SURESH",  name: "Float — Suresh Patel",    party_id: null, employee_id: "emp-3", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true,  created_at: iso(250), updated_at: iso(250) },
  { id: "acc-float-emp-4", tenant_id: TENANTS[0].id, type: "employee_float",   code: "FLOAT-ANITA",   name: "Float — Anita Verma",     party_id: null, employee_id: "emp-4", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: false, created_at: iso(350), updated_at: iso(20) },

  // ── Phase 3.5: AP completion ──
  // Per-employee payable accounts (auto-created with employee, accrues on salary post)
  { id: "acc-emp-payable-1", tenant_id: TENANTS[0].id, type: "employee_payable", code: "EMPPAY-RAMESH",  name: "Salary payable — Ramesh Kumar",   party_id: null, employee_id: "emp-1", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00", is_system: true, is_active: true,  created_at: iso(300), updated_at: iso(300) },
  { id: "acc-emp-payable-2", tenant_id: TENANTS[0].id, type: "employee_payable", code: "EMPPAY-PRIYA",   name: "Salary payable — Priya Shah",     party_id: null, employee_id: "emp-2", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00", is_system: true, is_active: true,  created_at: iso(200), updated_at: iso(200) },
  { id: "acc-emp-payable-3", tenant_id: TENANTS[0].id, type: "employee_payable", code: "EMPPAY-SURESH",  name: "Salary payable — Suresh Patel",   party_id: null, employee_id: "emp-3", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00", is_system: true, is_active: true,  created_at: iso(250), updated_at: iso(250) },
  { id: "acc-emp-payable-4", tenant_id: TENANTS[0].id, type: "employee_payable", code: "EMPPAY-ANITA",   name: "Salary payable — Anita Verma",    party_id: null, employee_id: "emp-4", account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00", is_system: true, is_active: false, created_at: iso(350), updated_at: iso(350) },

  // Generic purchase + GST input + salary expense accounts (one per tenant)
  { id: "acc-purchase-expense", tenant_id: TENANTS[0].id, type: "purchase_expense", code: "PURCHASES",     name: "Purchases (cost of goods)",       party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "60000.00", is_system: true, is_active: true, created_at: iso(300), updated_at: iso(8) },
  { id: "acc-gst-input",        tenant_id: TENANTS[0].id, type: "gst_input",        code: "GST-IN",        name: "GST Input (Asset)",               party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "7800.00",  is_system: true, is_active: true, created_at: iso(300), updated_at: iso(8) },
  { id: "acc-salary-expense",   tenant_id: TENANTS[0].id, type: "salary_expense",   code: "SALARY-EXP",    name: "Salary Expense",                  party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",     is_system: true, is_active: true, created_at: iso(300), updated_at: iso(300) },

  // Per-category expense accounts (one per ExpenseCategory)
  { id: "acc-exp-food",    tenant_id: TENANTS[0].id, type: "expense_category", code: "EXP-FOOD",    name: "Food & refreshments",     party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true, created_at: iso(280), updated_at: iso(280) },
  { id: "acc-exp-petrol",  tenant_id: TENANTS[0].id, type: "expense_category", code: "EXP-PETROL",  name: "Petrol",                  party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "1500.00", is_system: true, is_active: true, created_at: iso(280), updated_at: iso(2) },
  { id: "acc-exp-diesel",  tenant_id: TENANTS[0].id, type: "expense_category", code: "EXP-DIESEL",  name: "Diesel",                  party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true, created_at: iso(280), updated_at: iso(280) },
  { id: "acc-exp-labour",  tenant_id: TENANTS[0].id, type: "expense_category", code: "EXP-LABOUR",  name: "Daily wages / Labour",    party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true, created_at: iso(280), updated_at: iso(280) },
  { id: "acc-exp-capital", tenant_id: TENANTS[0].id, type: "expense_category", code: "EXP-CAPITAL", name: "Capital expenditure",     party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true, created_at: iso(280), updated_at: iso(280) },
  { id: "acc-exp-travel",  tenant_id: TENANTS[0].id, type: "expense_category", code: "EXP-TRAVEL",  name: "Travel & lodging",        party_id: null, employee_id: null, account_number: null, ifsc: null, opening_balance: "0.00", current_balance: "0.00",    is_system: true, is_active: true, created_at: iso(280), updated_at: iso(280) },
];

// ── Expense Categories (master data) ───────────────────────
//
// Auto-linked to acc-exp-* accounts above. Tenants seed these from
// a default set on provisioning; the FE allows full CRUD via
// /money/expenses/categories. Each category's `expense_account_id`
// points at its dedicated ledger so reports can roll up cleanly.
export const EXPENSE_CATEGORIES: Array<any> = [
  { id: "ecat-food",    tenant_id: TENANTS[0].id, code: "FOOD",    name: "Food & refreshments",  is_capital: false, is_active: true, expense_account_id: "acc-exp-food",    created_at: iso(280), updated_at: iso(280) },
  { id: "ecat-petrol",  tenant_id: TENANTS[0].id, code: "PETROL",  name: "Petrol",               is_capital: false, is_active: true, expense_account_id: "acc-exp-petrol",  created_at: iso(280), updated_at: iso(280) },
  { id: "ecat-diesel",  tenant_id: TENANTS[0].id, code: "DIESEL",  name: "Diesel",               is_capital: false, is_active: true, expense_account_id: "acc-exp-diesel",  created_at: iso(280), updated_at: iso(280) },
  { id: "ecat-labour",  tenant_id: TENANTS[0].id, code: "LABOUR",  name: "Daily wages / Labour", is_capital: false, is_active: true, expense_account_id: "acc-exp-labour",  created_at: iso(280), updated_at: iso(280) },
  { id: "ecat-capital", tenant_id: TENANTS[0].id, code: "CAPITAL", name: "Capital expenditure",  is_capital: true,  is_active: true, expense_account_id: "acc-exp-capital", created_at: iso(280), updated_at: iso(280) },
  { id: "ecat-travel",  tenant_id: TENANTS[0].id, code: "TRAVEL",  name: "Travel & lodging",     is_capital: false, is_active: true, expense_account_id: "acc-exp-travel",  created_at: iso(280), updated_at: iso(280) },
];

// ── Vendor Bills ───────────────────────────────────────────
export const VENDOR_BILLS: Array<any> = [
  // bill-1: Kaizen, posted, 60000 + 7800 GST = 67800; unpaid (allocated_amount=0).
  // Demonstrates the AP-side flow: paper bill came in, we entered it,
  // posting created Dr purchase + Dr GST input + Cr AP-Kaizen entries.
  {
    id: "bill-1", tenant_id: TENANTS[0].id,
    bill_number: "VB/2026-04/0001",
    supplier_invoice_number: "KZ-INV-2026-0421",
    bill_date: "2026-04-21",
    due_date: "2026-05-21",
    party_id: "party-1",
    place_of_supply: "27",
    status: "posted",
    subtotal: "60000.00",
    tax_total: "7800.00",
    grand_total: "67800.00",
    allocated_amount: "0.00",
    remarks: "Q2 raw aluminum substrate — Bright Silver + Pure White production runs",
    posting_date: iso(7),
    cancelled_at: null, cancellation_reason: null,
    version: 1,
    created_at: iso(8), updated_at: iso(7), created_by: null, updated_by: null,
  },
];

export const VENDOR_BILL_LINES: Record<string, unknown[]> = {
  "bill-1": [
    { id: "vbl-1a", bill_id: "bill-1", line_number: 1, item_id: "item-nb-1502", hsn_code: "76061200", description: "Aluminum substrate for NB-1502 Mirror Gold line",         uom_id: "uom-sheet", quantity: "50", unit_price: "1000", discount_pct: "0", rate_pct: "13",     taxable_value: "50000.00", cgst_amount: "3250.00", sgst_amount: "3250.00", igst_amount: "0.00", cess_amount: "0.00", line_total: "56500.00", expense_account_id: null, remarks: null },
    { id: "vbl-1b", bill_id: "bill-1", line_number: 2, item_id: "item-nb-1101", hsn_code: "76061200", description: "Aluminum substrate for NB-1101 Bright Silver line",      uom_id: "uom-sheet", quantity: "100", unit_price: "100",  discount_pct: "0", rate_pct: "13",     taxable_value: "10000.00", cgst_amount:  "650.00", sgst_amount:  "650.00", igst_amount: "0.00", cess_amount: "0.00", line_total: "11300.00", expense_account_id: null, remarks: null },
  ],
};

// ── Expenses ───────────────────────────────────────────────
export const EXPENSES_FX: Array<any> = [
  // expense-1: Petrol, 1500, posted, paid from cash. Demonstrates the
  // expense-category flow: Dr expense_category[Petrol], Cr cash.
  {
    id: "expense-1", tenant_id: TENANTS[0].id,
    expense_number: "XV/2026-04/0001",
    expense_date: "2026-04-26",
    category_id: "ecat-petrol",
    amount: "1500.00",
    paid_from_account_id: "acc-cash",
    vendor_id: null,
    description: "Vehicle fuel — MUM-N route, week of Apr 22",
    attachment_id: null,
    status: "posted",
    posting_date: iso(2),
    cancelled_at: null, cancellation_reason: null,
    version: 1,
    created_at: iso(2), updated_at: iso(2), created_by: null, updated_by: null,
  },
];

// ── Salary Entries ─────────────────────────────────────────
//
// One demo entry: draft, Ramesh, period 2026-04. He's holding 8500
// of customer GPay (acc-float-emp-1.current_balance), so net payable
// will be 45000 − 8500 = 36500 once the user posts it.
export const SALARY_ENTRIES: Array<any> = [
  {
    id: "sal-1", tenant_id: TENANTS[0].id,
    salary_number: "SAL/2026-04/0001",
    period_month: "2026-04-01",
    employee_id: "emp-1",
    gross_salary: "45000.00",
    float_held: "8500.00",
    net_paid: "36500.00",
    paid_from_account_id: "acc-bank-hdfc",
    status: "draft",
    posting_date: null,
    cancelled_at: null, cancellation_reason: null,
    version: 0,
    remarks: "April salary — net of float Ramesh is holding",
    created_at: iso(0), updated_at: iso(0), created_by: null, updated_by: null,
  },
];

// ── Ledger Entries ─────────────────────────────────────────
//
// Group ids: opening-* for opening balances, inv-*-post for invoice
// posts, pay-*-post for receipts. Each row is one debit XOR credit;
// each business event has a matching paired row(s). running_balance
// is signed (debit nature positive).
export const LEDGER_ENTRIES: Array<any> = [
  // ── Opening balances (group_id="opening-1") ──
  { id: "led-001", tenant_id: TENANTS[0].id, account_id: "acc-cash",        entry_date: "2026-04-01", source_doc_type: "opening", source_doc_id: "opening-1", debit: "25000.00",  credit: "0.00",     running_balance: "25000.00",  group_id: "opening-1", remarks: "Opening cash balance",                            created_at: iso(28) },
  { id: "led-002", tenant_id: TENANTS[0].id, account_id: "acc-bank-hdfc",   entry_date: "2026-04-01", source_doc_type: "opening", source_doc_id: "opening-1", debit: "450000.00", credit: "0.00",     running_balance: "450000.00", group_id: "opening-1", remarks: "Opening bank balance",                            created_at: iso(28) },
  { id: "led-003", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-01", source_doc_type: "opening", source_doc_id: "opening-1", debit: "12500.00",  credit: "0.00",     running_balance: "12500.00",  group_id: "opening-1", remarks: "Opening receivable — Greenfield Retail",         created_at: iso(28) },
  { id: "led-004", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-4",  entry_date: "2026-04-01", source_doc_type: "opening", source_doc_id: "opening-1", debit: "8750.00",   credit: "0.00",     running_balance: "8750.00",   group_id: "opening-1", remarks: "Opening receivable — Metro Chain Stores",        created_at: iso(28) },
  { id: "led-005", tenant_id: TENANTS[0].id, account_id: "acc-ap-party-1",  entry_date: "2026-04-01", source_doc_type: "opening", source_doc_id: "opening-1", debit: "0.00",      credit: "45000.00", running_balance: "-45000.00", group_id: "opening-1", remarks: "Opening payable — Kaizen Imports",               created_at: iso(28) },

  // ── Invoice inv-2 posted (group_id="inv-2-post"). Inter-state IGST.
  // Greenfield: amount 71250 + GST 12825 = 84075. Hits AR, sales, GST output.
  // (Sums set so demo numbers reconcile with /money/debtors and /ledger/summary.)
  { id: "led-010", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-15", source_doc_type: "invoice", source_doc_id: "inv-2",     debit: "84075.00",  credit: "0.00",     running_balance: "96575.00",  group_id: "inv-2-post", remarks: "Invoice INV/2026-04/0002 — Greenfield Retail",   created_at: iso(13) },
  { id: "led-011", tenant_id: TENANTS[0].id, account_id: "acc-sales",       entry_date: "2026-04-15", source_doc_type: "invoice", source_doc_id: "inv-2",     debit: "0.00",      credit: "71250.00", running_balance: "-71250.00", group_id: "inv-2-post", remarks: "Sales — INV/2026-04/0002",                       created_at: iso(13) },
  { id: "led-012", tenant_id: TENANTS[0].id, account_id: "acc-gst-out",     entry_date: "2026-04-15", source_doc_type: "invoice", source_doc_id: "inv-2",     debit: "0.00",      credit: "12825.00", running_balance: "-12825.00", group_id: "inv-2-post", remarks: "GST output — INV/2026-04/0002",                  created_at: iso(13) },

  // ── Receipt pay-1 (cash receipt of 12500 from Greenfield) ──
  { id: "led-020", tenant_id: TENANTS[0].id, account_id: "acc-cash",        entry_date: "2026-04-22", source_doc_type: "payment", source_doc_id: "pay-1",     debit: "12500.00",  credit: "0.00",     running_balance: "37500.00",  group_id: "pay-1-post", remarks: "Receipt RV/2026-04/0001 — Greenfield (cash)",     created_at: iso(6) },
  { id: "led-021", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-22", source_doc_type: "payment", source_doc_id: "pay-1",     debit: "0.00",      credit: "12500.00", running_balance: "84075.00",  group_id: "pay-1-post", remarks: "Settled by RV/2026-04/0001",                      created_at: iso(6) },

  // ── Receipt pay-2 (bank transfer 50000 from Greenfield to HDFC) ──
  { id: "led-030", tenant_id: TENANTS[0].id, account_id: "acc-bank-hdfc",   entry_date: "2026-04-23", source_doc_type: "payment", source_doc_id: "pay-2",     debit: "50000.00",  credit: "0.00",     running_balance: "500000.00", group_id: "pay-2-post", remarks: "Receipt RV/2026-04/0002 — Greenfield (bank)",     created_at: iso(5) },
  { id: "led-031", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-23", source_doc_type: "payment", source_doc_id: "pay-2",     debit: "0.00",      credit: "50000.00", running_balance: "34075.00",  group_id: "pay-2-post", remarks: "Settled by RV/2026-04/0002",                      created_at: iso(5) },

  // ── Receipt pay-3 (cheque 8750 from Greenfield, in transit) ──
  { id: "led-040", tenant_id: TENANTS[0].id, account_id: "acc-chq-transit", entry_date: "2026-04-25", source_doc_type: "payment", source_doc_id: "pay-3",     debit: "8750.00",   credit: "0.00",     running_balance: "8750.00",   group_id: "pay-3-post", remarks: "Receipt RV/2026-04/0003 — Greenfield (cheque #224511)", created_at: iso(3) },
  { id: "led-041", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-25", source_doc_type: "payment", source_doc_id: "pay-3",     debit: "0.00",      credit: "8750.00",  running_balance: "25325.00",  group_id: "pay-3-post", remarks: "Settled by RV/2026-04/0003 (cheque pending clearance)", created_at: iso(3) },

  // ── Receipt pay-4 (gpay 5500 from Greenfield to company GPay) ──
  { id: "led-050", tenant_id: TENANTS[0].id, account_id: "acc-gpay",        entry_date: "2026-04-27", source_doc_type: "payment", source_doc_id: "pay-4",     debit: "5500.00",   credit: "0.00",     running_balance: "5500.00",   group_id: "pay-4-post", remarks: "Receipt RV/2026-04/0004 — Greenfield (GPay)",     created_at: iso(1) },
  { id: "led-051", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-27", source_doc_type: "payment", source_doc_id: "pay-4",     debit: "0.00",      credit: "5500.00",  running_balance: "19825.00",  group_id: "pay-4-post", remarks: "Settled by RV/2026-04/0004",                      created_at: iso(1) },

  // ── Receipt pay-5 (gpay 8500 from Greenfield to Ramesh's float — employee held money) ──
  { id: "led-060", tenant_id: TENANTS[0].id, account_id: "acc-float-emp-1", entry_date: "2026-04-28", source_doc_type: "payment", source_doc_id: "pay-5",     debit: "8500.00",   credit: "0.00",     running_balance: "8500.00",   group_id: "pay-5-post", remarks: "Receipt RV/2026-04/0005 — Greenfield (GPay → Ramesh personal UPI)", created_at: iso(1) },
  { id: "led-061", tenant_id: TENANTS[0].id, account_id: "acc-ar-party-3",  entry_date: "2026-04-28", source_doc_type: "payment", source_doc_id: "pay-5",     debit: "0.00",      credit: "8500.00",  running_balance: "11325.00",  group_id: "pay-5-post", remarks: "Settled by RV/2026-04/0005 (held by Ramesh until salary)", created_at: iso(1) },

  // ── Phase 3.5 — Vendor Bill bill-1 posted (group_id="bill-1-post") ──
  // Dr purchases 60000, Dr GST input 7800, Cr AP-Kaizen 67800.
  { id: "led-070", tenant_id: TENANTS[0].id, account_id: "acc-purchase-expense", entry_date: "2026-04-21", source_doc_type: "vendor_bill", source_doc_id: "bill-1", debit: "60000.00", credit: "0.00",    running_balance: "60000.00",  group_id: "bill-1-post", remarks: "Bill VB/2026-04/0001 — Kaizen Imports (Q2 imports)",   created_at: iso(7) },
  { id: "led-071", tenant_id: TENANTS[0].id, account_id: "acc-gst-input",        entry_date: "2026-04-21", source_doc_type: "vendor_bill", source_doc_id: "bill-1", debit: "7800.00",  credit: "0.00",    running_balance: "7800.00",   group_id: "bill-1-post", remarks: "GST input — VB/2026-04/0001",                            created_at: iso(7) },
  { id: "led-072", tenant_id: TENANTS[0].id, account_id: "acc-ap-party-1",       entry_date: "2026-04-21", source_doc_type: "vendor_bill", source_doc_id: "bill-1", debit: "0.00",     credit: "67800.00", running_balance: "-112800.00", group_id: "bill-1-post", remarks: "Bill VB/2026-04/0001 — Kaizen Imports",                  created_at: iso(7) },

  // ── Phase 3.5 — Expense expense-1 posted (group_id="expense-1-post") ──
  // Dr Petrol 1500, Cr Cash 1500.
  { id: "led-080", tenant_id: TENANTS[0].id, account_id: "acc-exp-petrol", entry_date: "2026-04-26", source_doc_type: "expense", source_doc_id: "expense-1", debit: "1500.00", credit: "0.00",    running_balance: "1500.00",  group_id: "expense-1-post", remarks: "Petrol expense — MUM-N route", created_at: iso(2) },
  { id: "led-081", tenant_id: TENANTS[0].id, account_id: "acc-cash",       entry_date: "2026-04-26", source_doc_type: "expense", source_doc_id: "expense-1", debit: "0.00",    credit: "1500.00", running_balance: "36000.00", group_id: "expense-1-post", remarks: "Petrol expense — MUM-N route", created_at: iso(2) },
];

// ── Payments (receipts + paid-out) ─────────────────────────
//
// pay-1..5 are receipts. Demo invoice inv-2 (Greenfield Retail,
// 84075 total) is being progressively settled across 4 modes.
// pay-6 is a vendor payment (we paid Kaizen via bank transfer).
export const PAYMENTS: Array<any> = [
  {
    id: "pay-1", tenant_id: TENANTS[0].id,
    payment_number: "RV/2026-04/0001", payment_date: "2026-04-22",
    direction: "received", party_id: "party-3",
    amount: "12500.00", mode: "cash",
    details: { mode: "cash" },
    account_id: "acc-cash",
    payee_employee_id: null,
    status: "posted",
    posting_date: iso(6),
    cancelled_at: null, cancellation_reason: null,
    remarks: "Cash drop from Greenfield",
    allocated_amount: "12500.00",
    version: 1,
    created_at: iso(6), updated_at: iso(6), created_by: null, updated_by: null,
  },
  {
    id: "pay-2", tenant_id: TENANTS[0].id,
    payment_number: "RV/2026-04/0002", payment_date: "2026-04-23",
    direction: "received", party_id: "party-3",
    amount: "50000.00", mode: "bank",
    details: { mode: "bank", reference: "NEFT/HDFC0001/2026-04-23/884521", counterparty_bank: "HDFC Bank" },
    account_id: "acc-bank-hdfc",
    payee_employee_id: null,
    status: "posted",
    posting_date: iso(5),
    cancelled_at: null, cancellation_reason: null,
    remarks: "",
    allocated_amount: "50000.00",
    version: 1,
    created_at: iso(5), updated_at: iso(5), created_by: null, updated_by: null,
  },
  {
    id: "pay-3", tenant_id: TENANTS[0].id,
    payment_number: "RV/2026-04/0003", payment_date: "2026-04-25",
    direction: "received", party_id: "party-3",
    amount: "8750.00", mode: "cheque",
    details: { mode: "cheque", bank_name: "ICICI Bank", cheque_number: "224511", cheque_date: "2026-04-25", deposit_date: null, deposited_to_account_id: null, cleared: false },
    account_id: "acc-chq-transit",
    payee_employee_id: null,
    status: "posted",
    posting_date: iso(3),
    cancelled_at: null, cancellation_reason: null,
    remarks: "PDC — present after 28 Apr",
    allocated_amount: "8750.00",
    version: 1,
    created_at: iso(3), updated_at: iso(3), created_by: null, updated_by: null,
  },
  {
    id: "pay-4", tenant_id: TENANTS[0].id,
    payment_number: "RV/2026-04/0004", payment_date: "2026-04-27",
    direction: "received", party_id: "party-3",
    amount: "5500.00", mode: "gpay",
    details: { mode: "gpay", transaction_ref: "UPI/884521/2026-04-27", payer_upi: "greenfield@axisbank" },
    account_id: "acc-gpay",
    payee_employee_id: null,
    status: "posted",
    posting_date: iso(1),
    cancelled_at: null, cancellation_reason: null,
    remarks: "",
    allocated_amount: "5500.00",
    version: 1,
    created_at: iso(1), updated_at: iso(1), created_by: null, updated_by: null,
  },
  {
    id: "pay-5", tenant_id: TENANTS[0].id,
    payment_number: "RV/2026-04/0005", payment_date: "2026-04-28",
    direction: "received", party_id: "party-3",
    amount: "8500.00", mode: "gpay",
    details: { mode: "gpay", transaction_ref: "UPI/RAMESH/2026-04-28-3344", payer_upi: "greenfield@axisbank" },
    // GPay-to-employee path: account_id is the employee's float, NOT acc-gpay.
    account_id: "acc-float-emp-1",
    payee_employee_id: "emp-1",
    status: "posted",
    posting_date: iso(1),
    cancelled_at: null, cancellation_reason: null,
    remarks: "Customer paid Ramesh personally; deduct from his salary",
    // Out of 8500 received, 7325 goes against inv-2 (the remainder
    // needed to settle it). 1175 sits as "on account" credit on
    // Greenfield's ledger until the next invoice can absorb it.
    allocated_amount: "7325.00",
    version: 1,
    created_at: iso(1), updated_at: iso(1), created_by: null, updated_by: null,
  },
  {
    id: "pay-6", tenant_id: TENANTS[0].id,
    payment_number: "PV/2026-04/0001", payment_date: "2026-04-20",
    direction: "paid", party_id: "party-1",
    amount: "0.00", mode: "bank",                  // draft — not yet posted
    details: { mode: "bank", reference: "", counterparty_bank: "" },
    account_id: "acc-bank-hdfc",
    payee_employee_id: null,
    status: "draft",
    posting_date: null,
    cancelled_at: null, cancellation_reason: null,
    remarks: "Drafting payment for Kaizen",
    allocated_amount: "0.00",
    version: 0,
    created_at: iso(8), updated_at: iso(8), created_by: null, updated_by: null,
  },
];

// ── Payment Allocations ────────────────────────────────────
// All 5 receipts apply against inv-2 (Greenfield's posted invoice).
// 12500 + 50000 + 8750 + 5500 + 8500 = 85250; inv-2 total is 84075;
// so 1175 is "on account" (over-payment). UI treats negative
// outstanding as customer credit.
export const PAYMENT_ALLOCATIONS: Array<any> = [
  { id: "alloc-1", payment_id: "pay-1", invoice_id: "inv-2", challan_id: null, amount: "12500.00" },
  { id: "alloc-2", payment_id: "pay-2", invoice_id: "inv-2", challan_id: null, amount: "50000.00" },
  { id: "alloc-3", payment_id: "pay-3", invoice_id: "inv-2", challan_id: null, amount: "8750.00" },
  { id: "alloc-4", payment_id: "pay-4", invoice_id: "inv-2", challan_id: null, amount: "5500.00" },
  { id: "alloc-5", payment_id: "pay-5", invoice_id: "inv-2", challan_id: null, amount: "7325.00" },
  // pay-5 is over-applied above to keep numbers clean; remainder
  // 1175.00 is "unallocated" — see allocated_amount on pay-5.
];
