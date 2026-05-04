// ═══════════════════════════════════════════════════════════
// API Constants — Single source of truth for all endpoints.
// Two services (auth on :8000, inventory on :8001) — the
// api-client picks the right host per call.
// ═══════════════════════════════════════════════════════════

export const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL || "http://localhost:8000/api/v1";

export const INVENTORY_API_URL =
  process.env.NEXT_PUBLIC_INVENTORY_API_URL || "http://localhost:8001/api/v1";

// ── Auth service (:8000) ──────────────────────────────────
export const AUTH = {
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  REFRESH: "/auth/refresh",
  LOGOUT: "/auth/logout",
  CHANGE_PASSWORD: "/auth/change-password",
  ME: "/auth/me",
} as const;

// ── Modules & subscriptions (auth service) ────────────────
export const MODULES = {
  LIST: "/modules",
} as const;

export const SUBSCRIPTIONS = {
  TENANT: (tenantId: string) => `/subscriptions/tenant/${tenantId}`,
  DETAIL: (id: string) => `/subscriptions/${id}`,
} as const;

// ── Platform Admin ────────────────────────────────────────
export const ADMIN = {
  CURRENCIES: "/currencies",
  CURRENCY: (id: string) => `/currencies/${id}`,
  TENANTS: "/tenants",
  TENANT: (id: string) => `/tenants/${id}`,
} as const;

// ── Users & RBAC ──────────────────────────────────────────
export const USERS = {
  LIST: "/users",
  DETAIL: (id: string) => `/users/${id}`,
  ROLES: (id: string) => `/users/${id}/roles`,
  ROLE: (userId: string, roleId: string) => `/users/${userId}/roles/${roleId}`,
  RESET_PASSWORD: (id: string) => `/users/${id}/reset-password`,
} as const;

export const PERMISSIONS = {
  LIST: "/permissions",
} as const;

export const ROLES = {
  LIST: "/roles",
  DETAIL: (id: string) => `/roles/${id}`,
  PERMISSIONS: (id: string) => `/roles/${id}/permissions`,
  PERMISSION: (roleId: string, permId: string) =>
    `/roles/${roleId}/permissions/${permId}`,
} as const;

// ── Master Data ───────────────────────────────────────────
export const STATUS_MASTER = {
  LIST: "/status-master",
  DETAIL: (id: string) => `/status-master/${id}`,
} as const;

export const NUMBER_SERIES = {
  LIST: "/number-series",
  DETAIL: (id: string) => `/number-series/${id}`,
  PEEK: (id: string) => `/number-series/${id}/peek`,
  ALLOCATE: (id: string) => `/number-series/${id}/allocate`,
} as const;

export const UOM_CATEGORIES = {
  LIST: "/uom-categories",
  DETAIL: (id: string) => `/uom-categories/${id}`,
} as const;

export const UOMS = {
  LIST: "/uoms",
  DETAIL: (id: string) => `/uoms/${id}`,
} as const;

export const UOM_CONVERSIONS = {
  LIST: "/uom-conversions",
  DETAIL: (id: string) => `/uom-conversions/${id}`,
} as const;

export const ITEM_BRANDS = {
  LIST: "/item-brands",
  DETAIL: (id: string) => `/item-brands/${id}`,
} as const;

export const ITEM_CATEGORIES = {
  LIST: "/item-categories",
  DETAIL: (id: string) => `/item-categories/${id}`,
} as const;

// ── Items ─────────────────────────────────────────────────
export const ITEMS = {
  LIST: "/items",
  DETAIL: (id: string) => `/items/${id}`,
  IDENTIFIERS: (id: string) => `/items/${id}/identifiers`,
  VARIANTS: (id: string) => `/items/${id}/variants`,
  UOMS: (id: string) => `/items/${id}/uoms`,
  LOTS: (id: string) => `/items/${id}/lots`,
  SERIALS: (id: string) => `/items/${id}/serials`,
  REORDER_POLICIES: (id: string) => `/items/${id}/reorder-policies`,
  REORDER_POLICY:   (itemId: string, policyId: string) =>
    `/items/${itemId}/reorder-policies/${policyId}`,
} as const;

// ── Parties ───────────────────────────────────────────────
export const PARTIES = {
  LIST: "/parties",
  DETAIL: (id: string) => `/parties/${id}`,
  ADDRESSES: (id: string) => `/parties/${id}/addresses`,
  CONTACTS: (id: string) => `/parties/${id}/contacts`,
} as const;

// ── Locations ─────────────────────────────────────────────
export const LOCATIONS = {
  LIST: "/inventory-locations",
  DETAIL: (id: string) => `/inventory-locations/${id}`,
  BINS: (id: string) => `/inventory-locations/${id}/bins`,
} as const;

// ── Stock ─────────────────────────────────────────────────
export const STOCK = {
  MOVEMENTS: "/movements",
  MOVEMENT: (id: string) => `/movements/${id}`,
  BALANCES: "/balances",
  BALANCE: (id: string) => `/balances/${id}`,
  VALUATION_LAYERS: "/valuation-layers",
  RESERVATIONS: "/reservations",
  RESERVATION: (id: string) => `/reservations/${id}`,
} as const;

// ── Invoices (tax invoices — distinct from generic Documents) ──
export const INVOICES = {
  LIST: "/invoices",
  DETAIL: (id: string) => `/invoices/${id}`,
  LINES: (id: string) => `/invoices/${id}/lines`,
  LINE: (invoiceId: string, lineId: string) =>
    `/invoices/${invoiceId}/lines/${lineId}`,
  POST: (id: string) => `/invoices/${id}/post`,
  CANCEL: (id: string) => `/invoices/${id}/cancel`,
} as const;

// ── Challans (delivery notes, no GST) ─────────────────────
export const CHALLANS = {
  LIST: "/challans",
  DETAIL: (id: string) => `/challans/${id}`,
  LINES: (id: string) => `/challans/${id}/lines`,
  LINE: (challanId: string, lineId: string) =>
    `/challans/${challanId}/lines/${lineId}`,
  POST: (id: string) => `/challans/${id}/post`,
  CANCEL: (id: string) => `/challans/${id}/cancel`,
  /** Promote a posted, unbilled challan into a tax invoice. The
   *  backend creates the Invoice with `challan_id` set, copies the
   *  lines (adding GST math), and flips the challan's
   *  `is_billed=true`, `invoice_id=<new id>`. */
  PROMOTE: (id: string) => `/challans/${id}/promote-to-invoice`,
} as const;

// ── Routes (sales territories) ────────────────────────────
export const ROUTES = {
  LIST: "/routes",
  DETAIL: (id: string) => `/routes/${id}`,
} as const;

// ── Phase 3: Money — Accounts, Ledger, Payments, Employees ─
//
// `accounts` — Chart of Accounts (FinancialAccount). System accounts
// (cash/bank/cheque/gpay/per-party/per-employee/sales/gst) are
// auto-created; only the name is editable.
//
// `ledger` — read-only views into the double-entry ledger. Every
// business event writes paired debit/credit rows. Per-account
// running balance is denormalised on FinancialAccount.current_balance.
//
// `payments` — receipts (direction='received') and payments
// (direction='paid'). One entity, one table; UI splits them into
// two routes. Post creates the ledger entries; Cancel reverses them.
//
// `cheques` — convenience filter over payments where mode='cheque'
// AND not yet deposited. The `deposit` action is the cheque-clearing
// workflow (cheque_in_transit → bank).
//
// `employees` — minimal employee record + auto-created
// employee_float account. Used by GPay receipts where the payee was
// the employee personally; the float gets net-settled at salary time.

export const ACCOUNTS = {
  LIST: "/accounts",
  DETAIL: (id: string) => `/accounts/${id}`,
} as const;

export const LEDGER = {
  /** Per-account ledger journal — every entry against one account
   *  with running balance, ordered by entry_date asc, created_at asc. */
  ACCOUNT: (accountId: string) => `/ledger/accounts/${accountId}`,
  /** Per-party ledger — convenience aggregation: filters
   *  ledger_entries to the party's receivable+payable accounts. */
  PARTY: (partyId: string) => `/ledger/parties/${partyId}`,
  /** Money landing-page tiles. Returns an aggregate object with
   *  cash/bank/cheque_pending/gpay/total_receivable/total_payable
   *  /employee_float. Cheap server-side rollup of current_balance. */
  SUMMARY: "/ledger/summary",
} as const;

export const PAYMENTS = {
  LIST: "/payments",
  DETAIL: (id: string) => `/payments/${id}`,
  POST: (id: string) => `/payments/${id}/post`,
  CANCEL: (id: string) => `/payments/${id}/cancel`,
  /** Allocations sub-resource: which invoices does this payment
   *  settle. Server enforces sum(allocations) ≤ payment.amount. */
  ALLOCATIONS: (id: string) => `/payments/${id}/allocations`,
  ALLOCATION: (paymentId: string, allocationId: string) =>
    `/payments/${paymentId}/allocations/${allocationId}`,
  /** Cheque-deposit action. Body: { deposited_to_account_id,
   *  deposit_date }. Server posts the cheque_in_transit → bank
   *  ledger move and flips details.cleared=true. */
  DEPOSIT: (id: string) => `/payments/${id}/deposit`,
} as const;

export const EMPLOYEES = {
  LIST: "/employees",
  DETAIL: (id: string) => `/employees/${id}`,
} as const;

// ── Phase 3.5: AP completion — Vendor Bills, Expenses, Salary ──
//
// `bills` — vendor bills (purchase invoices). Mirror of /invoices
// for the AP side; same draft → posted → cancelled state machine.
// Post writes paired ledger entries: Dr expense, Dr GST input,
// Cr party_payable. Stock IN is NOT triggered here — that flow
// goes through GRN/PO. A bill is a financial entry only.
//
// `expenses` — Food / Petrol / Diesel / Labour / Capital, etc.
// One-row vouchers (no lines). Each ExpenseCategory has its own
// auto-created expense_category account so reporting can roll up
// per category without scanning ledger_entries.
//
// `salary` — manual monthly salary voucher per employee. Net =
// gross − float held by employee. Posts: Dr salary_expense (gross),
// Cr employee_float (held), Cr paid_from_account (net).

export const BILLS = {
  LIST: "/bills",
  DETAIL: (id: string) => `/bills/${id}`,
  LINES: (id: string) => `/bills/${id}/lines`,
  LINE: (billId: string, lineId: string) =>
    `/bills/${billId}/lines/${lineId}`,
  POST: (id: string) => `/bills/${id}/post`,
  CANCEL: (id: string) => `/bills/${id}/cancel`,
} as const;

export const EXPENSE_CATEGORIES = {
  LIST: "/expense-categories",
  DETAIL: (id: string) => `/expense-categories/${id}`,
} as const;

export const EXPENSES = {
  LIST: "/expenses",
  DETAIL: (id: string) => `/expenses/${id}`,
  POST: (id: string) => `/expenses/${id}/post`,
  CANCEL: (id: string) => `/expenses/${id}/cancel`,
} as const;

export const SALARY = {
  LIST: "/salary",
  DETAIL: (id: string) => `/salary/${id}`,
  POST: (id: string) => `/salary/${id}/post`,
  CANCEL: (id: string) => `/salary/${id}/cancel`,
  /** Phase 6 — Payroll batch endpoints. The cron will hit BATCH_GENERATE
   *  on the 1st of each month at 02:00 IST in production. */
  BATCH:          "/salary/batch",            // GET ?period=YYYY-MM
  BATCH_GENERATE: "/salary/batch/generate",   // POST { period: "YYYY-MM" }
  BATCH_POST:     "/salary/batch/post",       // POST { period: "YYYY-MM" }
  PAYSLIP:        (id: string) => `/salary/${id}/payslip`,
} as const;

// ── Phase 13: Item Dimensions + Pricing Rules ────────────
//
// Dimensions are a static-ish lookup (Nova Bond's 12 thickness×size
// combos). Pricing rules are versioned per (item, dimension); the
// LOOKUP endpoint returns the active rule for a given (item, dim,
// as_of_date) — used by line forms to auto-fill unit_price.

export const ITEM_DIMENSIONS = {
  LIST: "/item-dimensions",
  DETAIL: (id: string) => `/item-dimensions/${id}`,
} as const;

export const PRICING_RULES = {
  LIST:   "/pricing-rules",
  DETAIL: (id: string) => `/pricing-rules/${id}`,
  /** GET /pricing-rules/lookup?item_id=&thickness_mm=&size_code=&as_of= */
  LOOKUP: "/pricing-rules/lookup",
} as const;

/** Tenant-level catalog of valid thickness values + size codes used for
 *  pricing rules and document line entry. Editable from the
 *  Master Data → Item Pricing page. */
export const PRICING_DIMENSION_OPTIONS = {
  THICKNESS: "/pricing-dimension-options/thickness",
  SIZE:      "/pricing-dimension-options/size",
} as const;

// ── Phase 4: Reports & Statements ─────────────────────────
//
// All read-only aggregations. The backend never mutates state on
// these endpoints. Filters arrive as query params; date params are
// `YYYY-MM-DD`. Aging reports take an `as_of` (defaults to today).

export const REPORTS = {
  SALES_REGISTER:    "/reports/sales-register",
  PURCHASE_REGISTER: "/reports/purchase-register",
  DEBTORS_AGING:     "/reports/debtors-aging",
  CREDITORS_AGING:   "/reports/creditors-aging",
  PROFIT_LOSS:       "/reports/profit-loss",
  GSTR_1:            "/reports/gstr-1",
  GSTR_3B:           "/reports/gstr-3b",
  /** Phase 8 — Direct-method cash flow statement. */
  CASH_FLOW:         "/reports/cash-flow",
} as const;

// ── Phase 9: Audit log ───────────────────────────────────
export const AUDIT_LOG = {
  LIST: "/audit-log",
} as const;

// ── Phase 5: Period close ────────────────────────────────
//
// Single tenant-level setting. Stored under tenant-config key
// "period_close" so it ages out via the same admin tools as
// other config. Editing requires `inventory.period_close.write`.
export const PERIOD_CLOSE = {
  GET: "/period-close",
  SET: "/period-close",   // PUT-as-upsert
} as const;

// ── Documents ─────────────────────────────────────────────
export const DOCUMENT_TYPES = {
  LIST: "/document-types",
  DETAIL: (id: string) => `/document-types/${id}`,
} as const;

export const DOCUMENTS = {
  LIST: "/documents",
  DETAIL: (id: string) => `/documents/${id}`,
  LINES: (id: string) => `/documents/${id}/lines`,
  LINE: (docId: string, lineId: string) =>
    `/documents/${docId}/lines/${lineId}`,
  POST: (id: string) => `/documents/${id}/post`,
  CANCEL: (id: string) => `/documents/${id}/cancel`,
  /** Phase 10 — promote a posted Sales Order to a tax Invoice.
   *  Mirror of the existing CHALLAN.PROMOTE route. */
  PROMOTE_TO_INVOICE: (id: string) => `/documents/${id}/promote-to-invoice`,
} as const;

// ── Stock Counts ──────────────────────────────────────────
export const COUNTS = {
  LIST: "/counts",
  DETAIL: (id: string) => `/counts/${id}`,
  LINES: (id: string) => `/counts/${id}/lines`,
  LINE: (countId: string, lineId: string) =>
    `/counts/${countId}/lines/${lineId}`,
  APPLY: (id: string) => `/counts/${id}/apply`,
} as const;

// ── Lots & Serials (tenant-wide) ──────────────────────────
export const LOTS = {
  DETAIL: (id: string) => `/lots/${id}`,
} as const;

export const SERIALS = {
  DETAIL: (id: string) => `/serials/${id}`,
} as const;

// ── Config ────────────────────────────────────────────────
export const CONFIG = {
  TENANT: "/tenant-config",
  TENANT_KEY: (key: string) => `/tenant-config/${key}`,
  MODULE: "/module-config",
  MODULE_KEY: (module: string, key: string) => `/module-config/${module}/${key}`,
} as const;

// ── Workflows ─────────────────────────────────────────────
export const WORKFLOWS = {
  LIST: "/workflows",
  DETAIL: (id: string) => `/workflows/${id}`,
  STATES: (id: string) => `/workflows/${id}/states`,
  STATE: (wfId: string, stateId: string) =>
    `/workflows/${wfId}/states/${stateId}`,
  TRANSITIONS: (id: string) => `/workflows/${id}/transitions`,
  TRANSITION: (wfId: string, transId: string) =>
    `/workflows/${wfId}/transitions/${transId}`,
} as const;

// ── Custom Fields ─────────────────────────────────────────
export const CUSTOM_FIELDS = {
  DEFINITIONS: "/custom-field-definitions",
  DEFINITION: (id: string) => `/custom-field-definitions/${id}`,
  VALUES: (entity: string, entityId: string) =>
    `/custom-fields/${entity}/${entityId}/values`,
} as const;

// ── Integrations ──────────────────────────────────────────
export const INTEGRATIONS = {
  LIST: "/integrations",
  DETAIL: (id: string) => `/integrations/${id}`,
} as const;

export const WEBHOOKS = {
  LIST: "/webhooks",
  DETAIL: (id: string) => `/webhooks/${id}`,
} as const;

export const ATTACHMENTS = {
  LIST: "/attachments",
  DETAIL: (id: string) => `/attachments/${id}`,
} as const;

export const IMPORTS = {
  LIST: "/imports",
  DETAIL: (id: string) => `/imports/${id}`,
  /** Phase 7 — bulk CSV imports. Preview validates without persisting;
   *  Commit actually creates the entities. Templates are static CSVs. */
  TEMPLATE: (entity: string) => `/imports/template/${entity}`,
  PREVIEW: "/imports/preview",
  COMMIT:  "/imports/commit",
} as const;

// ── Health ────────────────────────────────────────────────
export const HEALTH = "/health";
