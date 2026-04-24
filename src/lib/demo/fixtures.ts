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
    name: "Acme Trading Co.",
    code: "acme",
    status: "active",
    base_currency_id: "cur-usd",
    timezone: "America/New_York",
    plan: "pro",
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
const INVENTORY_OPS_WRITE = PERMISSIONS.filter((p) =>
  ["inventory.movements.write", "inventory.documents.write", "inventory.documents.post",
   "inventory.documents.cancel", "inventory.counts.write", "inventory.counts.apply",
   "inventory.reservations.write", "inventory.lots.write", "inventory.serials.write"].includes(p.code),
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

grant("role-admin",    PERMISSIONS.map((p) => p.code));
grant("role-operator", [...ALL_READ_PERMS.filter((c) => c.startsWith("inventory.")), ...INVENTORY_OPS_WRITE]);
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
  { id: "uomc-ea", tenant_id: TENANTS[0].id, code: "count", name: "Count",  created_at: iso(120), updated_at: iso(120) },
  { id: "uomc-wt", tenant_id: TENANTS[0].id, code: "weight", name: "Weight", created_at: iso(120), updated_at: iso(120) },
  { id: "uomc-vol", tenant_id: TENANTS[0].id, code: "volume", name: "Volume", created_at: iso(120), updated_at: iso(120) },
];

export const UOMS = [
  { id: "uom-each", tenant_id: TENANTS[0].id, code: "EA",   name: "Each",      symbol: "ea", uom_category_id: "uomc-ea", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-box",  tenant_id: TENANTS[0].id, code: "BOX",  name: "Box",       symbol: "box", uom_category_id: "uomc-ea", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-kg",   tenant_id: TENANTS[0].id, code: "KG",   name: "Kilogram",  symbol: "kg", uom_category_id: "uomc-wt", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-g",    tenant_id: TENANTS[0].id, code: "G",    name: "Gram",      symbol: "g", uom_category_id: "uomc-wt", created_at: iso(120), updated_at: iso(120) },
  { id: "uom-lt",   tenant_id: TENANTS[0].id, code: "L",    name: "Litre",     symbol: "L", uom_category_id: "uomc-vol", created_at: iso(120), updated_at: iso(120) },
];

export const UOM_CONVERSIONS = [
  { id: "conv-1", tenant_id: TENANTS[0].id, from_uom_id: "uom-kg",  to_uom_id: "uom-g",   factor: "1000", created_at: iso(120), updated_at: iso(120) },
  { id: "conv-2", tenant_id: TENANTS[0].id, from_uom_id: "uom-box", to_uom_id: "uom-each", factor: "24",   created_at: iso(120), updated_at: iso(120) },
];

export const BRANDS = [
  { id: "brand-acme",  tenant_id: TENANTS[0].id, code: "ACME",  name: "Acme Industries", created_at: iso(100), updated_at: iso(100) },
  { id: "brand-nova",  tenant_id: TENANTS[0].id, code: "NOVA",  name: "Nova Electronics", created_at: iso(100), updated_at: iso(100) },
  { id: "brand-pure",  tenant_id: TENANTS[0].id, code: "PURE",  name: "Pure Organics",    created_at: iso(100), updated_at: iso(100) },
];

export const CATEGORIES = [
  { id: "cat-elec", tenant_id: TENANTS[0].id, code: "ELEC", name: "Electronics",                          created_at: iso(100), updated_at: iso(100) },
  { id: "cat-food", tenant_id: TENANTS[0].id, code: "FOOD", name: "Food & Beverage",                      created_at: iso(100), updated_at: iso(100) },
  { id: "cat-apparel", tenant_id: TENANTS[0].id, code: "APRL", name: "Apparel",                           created_at: iso(100), updated_at: iso(100) },
  { id: "cat-elec-audio", tenant_id: TENANTS[0].id, code: "AUD", name: "Audio", parent_id: "cat-elec",    created_at: iso(100), updated_at: iso(100) },
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
  { id: "party-1", tenant_id: TENANTS[0].id, code: "SUP-001", name: "Kaizen Imports", legal_name: "Kaizen Imports Pvt Ltd", tax_id: "29AAAAA0001A1Z5", party_type: "supplier", opening_balance: "0", currency_id: "cur-usd", is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-2", tenant_id: TENANTS[0].id, code: "SUP-002", name: "Horizon Traders", legal_name: "Horizon Traders Ltd", tax_id: "29BBBBB0002A1Z5", party_type: "supplier", opening_balance: "0", currency_id: "cur-usd", is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-3", tenant_id: TENANTS[0].id, code: "CUS-001", name: "Greenfield Retail", legal_name: "Greenfield Retail Corp", tax_id: "29CCCCC0003A1Z5", party_type: "customer", opening_balance: "0", currency_id: "cur-usd", is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-4", tenant_id: TENANTS[0].id, code: "CUS-002", name: "Metro Chain Stores", legal_name: "Metro Chain Stores LLC", tax_id: "29DDDDD0004A1Z5", party_type: "customer", opening_balance: "0", currency_id: "cur-usd", is_active: true, created_at: iso(100), updated_at: iso(100) },
  { id: "party-5", tenant_id: TENANTS[0].id, code: "BOTH-01", name: "Unity Distributors", legal_name: "Unity Distributors Inc", tax_id: "29EEEEE0005A1Z5", party_type: "both", opening_balance: "0", currency_id: "cur-usd", is_active: true, created_at: iso(100), updated_at: iso(100) },
];

// ── Items ──────────────────────────────────────────────────────

export const ITEMS = [
  { id: "item-1", tenant_id: TENANTS[0].id, item_code: "LT-100", name: "Laptop 14\" Pro",     description: "Business laptop", category_id: "cat-elec", brand_id: "brand-nova", item_type: "goods", base_uom_id: "uom-each", is_batch_tracked: false, is_serial_tracked: true,  is_active: true, version: 0, created_at: iso(90), updated_at: iso(5) },
  { id: "item-2", tenant_id: TENANTS[0].id, item_code: "HP-200", name: "Wireless Headphones", description: "Noise cancelling",  category_id: "cat-elec-audio", brand_id: "brand-nova", item_type: "goods", base_uom_id: "uom-each", is_batch_tracked: false, is_serial_tracked: false, is_active: true, version: 0, created_at: iso(80), updated_at: iso(3) },
  { id: "item-3", tenant_id: TENANTS[0].id, item_code: "CO-300", name: "Organic Coffee Beans", description: "Fair-trade Arabica", category_id: "cat-food", brand_id: "brand-pure", item_type: "goods", base_uom_id: "uom-kg",   is_batch_tracked: true,  is_serial_tracked: false, is_active: true, version: 0, created_at: iso(70), updated_at: iso(1) },
  { id: "item-4", tenant_id: TENANTS[0].id, item_code: "TS-400", name: "Cotton T-Shirt",       description: "Unisex plain",       category_id: "cat-apparel", brand_id: "brand-acme", item_type: "goods", base_uom_id: "uom-each", is_batch_tracked: false, is_serial_tracked: false, is_active: true, version: 0, created_at: iso(50), updated_at: iso(10) },
  { id: "item-5", tenant_id: TENANTS[0].id, item_code: "WB-500", name: "Aluminum Water Bottle", description: "750ml",             category_id: "cat-apparel", brand_id: "brand-acme", item_type: "goods", base_uom_id: "uom-each", is_batch_tracked: false, is_serial_tracked: false, is_active: true, version: 0, created_at: iso(40), updated_at: iso(20) },
  { id: "item-6", tenant_id: TENANTS[0].id, item_code: "SL-600", name: "Solar Power Bank",    description: "10000mAh",           category_id: "cat-elec", brand_id: "brand-nova", item_type: "goods", base_uom_id: "uom-each", is_batch_tracked: false, is_serial_tracked: false, is_active: false, version: 0, created_at: iso(30), updated_at: iso(15) },
];

// ── Balances ──────────────────────────────────────────────────

export const BALANCES = [
  { id: "bal-1", tenant_id: TENANTS[0].id, item_id: "item-1", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "42",  qty_reserved: "5",  qty_available: "37",  value: "35700.00", last_movement_id: null, version: 0, updated_at: iso(1) },
  { id: "bal-2", tenant_id: TENANTS[0].id, item_id: "item-2", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "128", qty_reserved: "0",  qty_available: "128", value: "15360.00", last_movement_id: null, version: 0, updated_at: iso(1) },
  { id: "bal-3", tenant_id: TENANTS[0].id, item_id: "item-3", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "80",  qty_reserved: "10", qty_available: "70",  value: "1600.00",  last_movement_id: null, version: 0, updated_at: iso(2) },
  { id: "bal-4", tenant_id: TENANTS[0].id, item_id: "item-4", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "450", qty_reserved: "50", qty_available: "400", value: "2700.00",  last_movement_id: null, version: 0, updated_at: iso(3) },
  { id: "bal-5", tenant_id: TENANTS[0].id, item_id: "item-5", location_id: "loc-main", bin_id: null, lot_id: null, qty_on_hand: "200", qty_reserved: "0",  qty_available: "200", value: "3600.00",  last_movement_id: null, version: 0, updated_at: iso(5) },
  { id: "bal-6", tenant_id: TENANTS[0].id, item_id: "item-1", location_id: "loc-branch", bin_id: null, lot_id: null, qty_on_hand: "8",   qty_reserved: "0",  qty_available: "8",   value: "6800.00",  last_movement_id: null, version: 0, updated_at: iso(10) },
  { id: "bal-7", tenant_id: TENANTS[0].id, item_id: "item-4", location_id: "loc-branch", bin_id: null, lot_id: null, qty_on_hand: "12",  qty_reserved: "0",  qty_available: "12",  value: "72.00",    last_movement_id: null, version: 0, updated_at: iso(10) },
];

// ── Movements (recent ledger) ────────────────────────────────

export const MOVEMENTS = [
  { id: "mv-1", tenant_id: TENANTS[0].id, document_id: "doc-po-1", item_id: "item-1", location_id: "loc-main", bin_id: null, lot_id: null, serial_id: null, direction: "in",  quantity: "50", uom_id: "uom-each", base_quantity: "50", unit_cost: "850",  total_cost: "42500", posting_date: iso(30), reference_movement_id: null, source: "PO-00001", created_at: iso(30) },
  { id: "mv-2", tenant_id: TENANTS[0].id, document_id: "doc-po-2", item_id: "item-2", location_id: "loc-main", bin_id: null, lot_id: null, serial_id: null, direction: "in",  quantity: "200", uom_id: "uom-each", base_quantity: "200", unit_cost: "120",  total_cost: "24000", posting_date: iso(25), reference_movement_id: null, source: "PO-00002", created_at: iso(25) },
  { id: "mv-3", tenant_id: TENANTS[0].id, document_id: "doc-so-1", item_id: "item-2", location_id: "loc-main", bin_id: null, lot_id: null, serial_id: null, direction: "out", quantity: "72", uom_id: "uom-each", base_quantity: "72", unit_cost: "120",  total_cost: "8640",  posting_date: iso(5),  reference_movement_id: null, source: "SO-00003", created_at: iso(5) },
  { id: "mv-4", tenant_id: TENANTS[0].id, document_id: "doc-trn-1", item_id: "item-1", location_id: "loc-main",   bin_id: null, lot_id: null, serial_id: null, direction: "out", quantity: "8", uom_id: "uom-each", base_quantity: "8", unit_cost: "850",  total_cost: "6800", posting_date: iso(10), reference_movement_id: null, source: "TR-00001", created_at: iso(10) },
  { id: "mv-5", tenant_id: TENANTS[0].id, document_id: "doc-trn-1", item_id: "item-1", location_id: "loc-branch", bin_id: null, lot_id: null, serial_id: null, direction: "in",  quantity: "8", uom_id: "uom-each", base_quantity: "8", unit_cost: "850",  total_cost: "6800", posting_date: iso(10), reference_movement_id: "mv-4", source: "TR-00001", created_at: iso(10) },
];

// ── Valuation layers ────────────────────────────────────────

export const VALUATION_LAYERS = [
  { id: "vl-1", tenant_id: TENANTS[0].id, item_id: "item-1", location_id: "loc-main", lot_id: null, movement_id: "mv-1", layer_date: iso(30), qty_original: "50",  qty_remaining: "42",  unit_cost: "850",  total_cost: "42500", currency_id: "cur-usd", exhausted: false, created_at: iso(30) },
  { id: "vl-2", tenant_id: TENANTS[0].id, item_id: "item-2", location_id: "loc-main", lot_id: null, movement_id: "mv-2", layer_date: iso(25), qty_original: "200", qty_remaining: "128", unit_cost: "120",  total_cost: "24000", currency_id: "cur-usd", exhausted: false, created_at: iso(25) },
  { id: "vl-3", tenant_id: TENANTS[0].id, item_id: "item-3", location_id: "loc-main", lot_id: null, movement_id: "mv-6", layer_date: iso(20), qty_original: "100", qty_remaining: "80",  unit_cost: "20",   total_cost: "2000",  currency_id: "cur-usd", exhausted: false, created_at: iso(20) },
];

// ── Reservations ──────────────────────────────────────────

export const RESERVATIONS = [
  { id: "res-1", tenant_id: TENANTS[0].id, item_id: "item-1", location_id: "loc-main", lot_id: null, quantity: "5",  status: "active",    reference_doc_id: null, reference_doc_line_id: null, remarks: "Reserved for Metro Chain SO", created_at: iso(2), updated_at: iso(2) },
  { id: "res-2", tenant_id: TENANTS[0].id, item_id: "item-3", location_id: "loc-main", lot_id: null, quantity: "10", status: "active",    reference_doc_id: null, reference_doc_line_id: null, remarks: "",                             created_at: iso(1), updated_at: iso(1) },
  { id: "res-3", tenant_id: TENANTS[0].id, item_id: "item-4", location_id: "loc-main", lot_id: null, quantity: "50", status: "fulfilled", reference_doc_id: null, reference_doc_line_id: null, remarks: "",                             created_at: iso(7), updated_at: iso(4) },
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
  "doc-po-1": [
    { id: "dl-1a", document_id: "doc-po-1", line_number: 1, item_id: "item-1", uom_id: "uom-each", quantity: "50", unit_price: "850", discount_pct: "0", tax_amount: "0", line_total: "42500", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
  ],
  "doc-po-2": [
    { id: "dl-2a", document_id: "doc-po-2", line_number: 1, item_id: "item-2", uom_id: "uom-each", quantity: "200", unit_price: "120", discount_pct: "0", tax_amount: "0", line_total: "24000", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
  ],
  "doc-po-3": [
    { id: "dl-3a", document_id: "doc-po-3", line_number: 1, item_id: "item-3", uom_id: "uom-kg", quantity: "100", unit_price: "20", discount_pct: "0", tax_amount: "0", line_total: "2000", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
    { id: "dl-3b", document_id: "doc-po-3", line_number: 2, item_id: "item-5", uom_id: "uom-each", quantity: "500", unit_price: "18", discount_pct: "0", tax_amount: "0", line_total: "9000", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
  ],
  "doc-so-1": [
    { id: "dl-so1a", document_id: "doc-so-1", line_number: 1, item_id: "item-2", uom_id: "uom-each", quantity: "72", unit_price: "180", discount_pct: "0", tax_amount: "0", line_total: "12960", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
  ],
  "doc-trn-1": [
    { id: "dl-tr1a", document_id: "doc-trn-1", line_number: 1, item_id: "item-1", uom_id: "uom-each", quantity: "8", unit_price: "0", discount_pct: "0", tax_amount: "0", line_total: "0", lot_id: null, serial_id: null, bin_id: null, remarks: "" },
  ],
};

// ── Counts ───────────────────────────────────────────────

export const COUNTS = [
  { id: "cnt-1", tenant_id: TENANTS[0].id, count_number: "CNT-001", count_date: "2026-04-10", location_id: "loc-main", remarks: "Quarterly count", created_at: iso(14), updated_at: iso(14) },
  { id: "cnt-2", tenant_id: TENANTS[0].id, count_number: "CNT-002", count_date: "2026-04-22", location_id: "loc-branch", remarks: "", created_at: iso(2),  updated_at: iso(2) },
];

export const COUNT_LINES: Record<string, any[]> = {
  "cnt-1": [
    { id: "cl-1", count_id: "cnt-1", item_id: "item-1", system_qty: "42", counted_qty: "40", variance_qty: "-2", remarks: "2 units missing" },
    { id: "cl-2", count_id: "cnt-1", item_id: "item-2", system_qty: "128", counted_qty: "128", variance_qty: "0", remarks: "" },
  ],
  "cnt-2": [],
};

// ── Lots + Serials ────────────────────────────────────────

export const LOTS: Record<string, any[]> = {
  "item-3": [
    { id: "lot-1", tenant_id: TENANTS[0].id, item_id: "item-3", lot_number: "LOT-A-2026", mfg_date: "2026-01-15", expiry_date: "2027-01-15", received_qty: "100", created_at: iso(90), updated_at: iso(90) },
    { id: "lot-2", tenant_id: TENANTS[0].id, item_id: "item-3", lot_number: "LOT-B-2026", mfg_date: "2026-02-20", expiry_date: "2027-02-20", received_qty: "50",  created_at: iso(60), updated_at: iso(60) },
  ],
};

export const SERIALS: Record<string, any[]> = {
  "item-1": Array.from({ length: 6 }).map((_, i) => ({
    id: `ser-${i + 1}`,
    tenant_id: TENANTS[0].id,
    item_id: "item-1",
    serial_number: `SN-LT100-${(1000 + i).toString()}`,
    status: i < 4 ? "in_stock" : i === 4 ? "issued" : "reserved",
    lot_id: null,
    created_at: iso(30),
    updated_at: iso(30 - i),
  })),
};

// ── Reorder policies ───────────────────────────────────

export const REORDER_POLICIES: Record<string, any[]> = {
  "item-1": [{ id: "rp-1", tenant_id: TENANTS[0].id, item_id: "item-1", location_id: "loc-main", min_qty: "10", max_qty: "100", reorder_point: "15", reorder_qty: "30", created_at: iso(60), updated_at: iso(60) }],
  "item-3": [{ id: "rp-2", tenant_id: TENANTS[0].id, item_id: "item-3", location_id: "loc-main", min_qty: "50", max_qty: "300", reorder_point: "75", reorder_qty: "100", created_at: iso(60), updated_at: iso(60) }],
};

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
  { id: "att-2", tenant_id: TENANTS[0].id, entity: "item", entity_id: "item-1", file_name: "spec-sheet-LT100.pdf", file_path: "#", mime_type: "application/pdf", file_size: 132_048, created_at: iso(80), created_by: null },
];

export const IMPORTS = [
  { id: "imp-1", tenant_id: TENANTS[0].id, entity: "items", file_name: "items-catalog-q1.csv", status: "completed", total_rows: 250, success_rows: 248, error_rows: 2, errors: null, created_at: iso(45), created_by: null },
];

// Tenant / module config
export const TENANT_CONFIG: Array<any> = [
  { id: "tc-1", tenant_id: TENANTS[0].id, key: "fiscal_year_start_month", value: 4, created_at: iso(100), updated_at: iso(100) },
];

export const MODULE_CONFIG: Array<any> = [
  { id: "mc-1", tenant_id: TENANTS[0].id, module: "inventory", key: "default_costing_method", value: "FIFO", created_at: iso(100), updated_at: iso(100) },
];
