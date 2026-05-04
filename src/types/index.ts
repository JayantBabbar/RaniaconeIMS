// ═══════════════════════════════════════════════════════════
// RaniacOne — TypeScript Types
// Mirrors FastAPI Pydantic schemas exactly.
// ═══════════════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  access_expires_in: number;
  user_id: string;
  tenant_id: string | null;      // null for super admins
  is_super_admin: boolean;
  tz: string;                     // IANA tz, e.g. "Asia/Kolkata"
  modules: string[];              // subscribed module codes
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
  // Either tenant_id OR tenant_code must be supplied (admin-invite flow).
  tenant_id?: string;
  tenant_code?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/** Shape of the access-token JWT payload after decoding. */
export interface AccessTokenPayload {
  typ: "access";
  sub: string;               // user id
  tid: string | null;        // tenant id (null for super admins)
  sa: boolean;               // super admin flag
  tz: string;                // viewer timezone
  mods: string[];            // subscribed modules
  roles: string[];           // role codes
  perms: string[];           // permission codes (module-prefixed)
  jti: string;
  iat: number;
  exp: number;
}

// ── Common ────────────────────────────────────────────────
export interface ErrorResponse {
  code: string;
  message: string;
  field_errors: Record<string, string>;
  request_id: string;
}

export interface PaginationMeta {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ── Tenant ────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: "active" | "trialing" | "suspended";
  base_currency_id: string;
  timezone: string;
  plan: string;
  /** Optional ISO 3166-2 state code for the seller's place of business.
   *  Drives GST place-of-supply math (same-state → CGST+SGST, else IGST).
   *  Two-digit numeric for India (e.g. "27" Maharashtra, "29" Karnataka,
   *  "07" Delhi). Tenants outside India can leave this unset. */
  state_code?: string;
  /** Optional GSTIN of the tenant itself (15-char). */
  gstin?: string;
  created_at: string;
  updated_at: string;
}

// ── Currency ──────────────────────────────────────────────
export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_precision: number;
  created_at: string;
  updated_at: string;
}

// ── User ──────────────────────────────────────────────────
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// ── RBAC ──────────────────────────────────────────────────
export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
}

// ── Items ─────────────────────────────────────────────────
export interface Item {
  id: string;
  tenant_id: string;
  item_code: string;
  name: string;
  description?: string;
  category_id?: string;
  brand_id?: string;
  item_type: string;
  base_uom_id?: string;
  is_batch_tracked: boolean;
  is_serial_tracked: boolean;
  is_active: boolean;
  status_id?: string;
  /** HSN/SAC code for tax classification (4–8 digits). Required on
   *  invoice lines for GST-registered tenants; optional otherwise. */
  hsn_code?: string;
  /** Default sale price; pre-fills SO/Invoice line `unit_price`. */
  default_sale_price?: string;
  /** Default GST rate as a percentage (e.g. "5", "12", "18", "28").
   *  Pre-fills invoice line `rate_pct`. */
  default_tax_rate_pct?: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ItemCategory {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemBrand {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// ── Inventory ─────────────────────────────────────────────
export interface InventoryLocation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  location_type: string;
  parent_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Balance {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  bin_id?: string;
  lot_id?: string;
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
  value: string;
  last_movement_id?: string;
  version: number;
  updated_at: string;
}

export interface Movement {
  id: string;
  tenant_id: string;
  document_id?: string;
  item_id: string;
  location_id: string;
  bin_id?: string;
  lot_id?: string;
  serial_id?: string;
  direction: "in" | "out";
  quantity: string;
  uom_id: string;
  base_quantity: string;
  unit_cost: string;
  total_cost: string;
  posting_date: string;
  reference_movement_id?: string;
  source?: string;
  created_at: string;
  created_by?: string;
}

// ── Documents ─────────────────────────────────────────────
export interface DocumentHeader {
  id: string;
  tenant_id: string;
  document_type_id: string;
  document_number: string;
  document_date: string;
  posting_date?: string;
  party_id?: string;
  source_location_id?: string;
  destination_location_id?: string;
  currency_id?: string;
  exchange_rate: string;
  status_id?: string;
  remarks?: string;
  /** Phase 10 / GRN — link to a parent document. For SO→Invoice
   *  promotion + PO→GRN receipt. NULL on direct GRNs (phone-deal
   *  receipts where no PO was raised first). */
  source_doc_id?: string | null;
  /** Set on a posted SO once promoted to an invoice. */
  is_promoted?: boolean;
  invoice_id?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface DocumentLine {
  id: string;
  document_id: string;
  line_number: number;
  item_id: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  tax_amount: string;
  line_total: string;
  lot_id?: string;
  serial_id?: string;
  bin_id?: string;
  remarks?: string;
  /** Phase 13 — dimension snapshot at line creation. NULL for items
   *  whose price doesn't vary by dimension (rare for Nova Bond's ACP
   *  catalog where every NB-* line should have both). */
  thickness_mm?: number | null;
  size_code?: string | null;
}

export interface DocumentType {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  direction: "in" | "out" | "transfer" | "internal";
  module: string;
  affects_stock: boolean;
  created_at: string;
  updated_at: string;
}

// ── Stock Count ───────────────────────────────────────────
export interface StockCount {
  id: string;
  tenant_id: string;
  count_number: string;
  count_date: string;
  location_id: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CountLine {
  id: string;
  count_id: string;
  item_id: string;
  lot_id?: string;
  bin_id?: string;
  system_qty: string;
  counted_qty?: string;
  variance_qty?: string;
  remarks?: string;
}

// ── Parties ───────────────────────────────────────────────

/** Party-type vocabulary.
 *
 *  - `customer`        — buys from us
 *  - `supplier`        — sells goods to us (raw materials, finished goods)
 *  - `vendor`          — sells services/one-off goods (transport, repair,
 *                        IT, etc.) — distinguished from supplier so Mr. Arpit
 *                        can separate goods-vendors from service-vendors in
 *                        reports and ledger views
 *  - `general_person`  — neither customer nor supplier; freelancers,
 *                        consultants, referrals, government contacts, etc.
 *  - `both`            — customer AND supplier (rare but valid)
 */
export type PartyType =
  | "customer"
  | "supplier"
  | "vendor"
  | "general_person"
  | "both";

export interface Party {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  party_type?: PartyType;
  opening_balance?: string;
  currency_id?: string;
  /** Whether this party is GST-registered. If true, `gstin` is
   *  required and gets validated as a 15-character GSTIN. */
  is_gst_registered?: boolean;
  /** 15-character GSTIN. Validated when `is_gst_registered === true`. */
  gstin?: string;
  /** ISO state code (2-digit numeric for India, e.g. "27"=Maharashtra,
   *  "29"=Karnataka, "07"=Delhi). Drives place-of-supply on invoices. */
  state_code?: string;
  /** Free-text descriptor (route notes, account-manager assignment,
   *  etc.). Surfaces in customer detail. */
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Status Master ─────────────────────────────────────────
export interface StatusMaster {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  category: string;
  entity: string;
  created_at: string;
  updated_at: string;
}

// ── Number Series ─────────────────────────────────────────
export interface NumberSeries {
  id: string;
  tenant_id: string;
  code?: string;
  entity: string;
  prefix?: string;
  suffix?: string;
  padding: number;
  current_value: number;
  start_value: number;
  created_at: string;
  updated_at: string;
}

// ── Invoices ──────────────────────────────────────────────
//
// An Invoice is a tax document — distinct from a generic Document
// (PO/SO/Transfer) because it carries GST line splits, HSN codes,
// place-of-supply, and (eventually) e-Invoice IRN/QR. The line
// schema is invoice-specific, not a reuse of DocumentLine.
//
// Status flow:  draft → posted → (optionally) cancelled
//   draft     — fully editable, no movements created, can be deleted
//   posted    — locked; stock OUT movements created; ledger debited
//   cancelled — reversal movements posted; original kept for audit

export type InvoiceStatus = "draft" | "posted" | "cancelled";

/** Per-line GST split. Computed from rate_pct + place-of-supply,
 *  but stored on the line so audits don't recompute. */
export interface GstSplit {
  /** Percentage (e.g. "5", "12", "18", "28"). */
  rate_pct: string;
  /** Taxable value = (unit_price × quantity) − discount. */
  taxable_value: string;
  /** Same-state: half the rate goes to CGST, half to SGST.
   *  Inter-state: zero here, full rate goes to igst_amount. */
  cgst_amount: string;
  sgst_amount: string;
  /** Inter-state: full rate. Same-state: zero. */
  igst_amount: string;
  /** Compensation cess for select goods (tobacco, automobiles, etc.).
   *  Defaults to "0.00" — set per-line when applicable. */
  cess_amount: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  invoice_date: string;          // YYYY-MM-DD
  due_date?: string;
  party_id: string;              // customer
  /** 2-digit state code where the supply is delivered.
   *  Determines CGST+SGST (same-state as seller) vs IGST. */
  place_of_supply: string;
  status: InvoiceStatus;
  /** Promoted from a challan? Null for direct invoices. */
  challan_id?: string;
  /** e-Invoice IRN — set after NIC integration (Phase 4). */
  irn?: string;
  qr_code_data?: string;
  /** Sub-total of all lines' taxable_value. */
  subtotal: string;
  /** Sum of all lines' cgst+sgst+igst+cess. */
  tax_total: string;
  /** subtotal + tax_total. */
  grand_total: string;
  /** Indian rupees-to-words rendering for the printed invoice. */
  amount_in_words?: string;
  remarks?: string;
  posting_date?: string;         // ISO datetime, set on Post
  cancelled_at?: string;
  cancellation_reason?: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  line_number: number;
  item_id: string;
  hsn_code: string;
  description?: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  /** Cached snapshot of GST split for this line. */
  rate_pct: string;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  /** Line grand total = taxable_value + all taxes. */
  line_total: string;
  lot_id?: string;
  serial_id?: string;
  remarks?: string;
  /** Phase 13 — dimension snapshot. */
  thickness_mm?: number | null;
  size_code?: string | null;
}

// ── Routes ────────────────────────────────────────────────
//
// Sales territory / dispatch route master data. Used to scope which
// customers a delivery serves, and (later, in Phase 1 cleanup) to
// drive cascading customer pickers on Challan/SO/Invoice forms.

export interface Route {
  id: string;
  tenant_id: string;
  code: string;                   // "MUM-N", "PUNE-S"
  name: string;                   // "Mumbai North"
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Challans ──────────────────────────────────────────────
//
// A Challan is a dispatch / delivery note. It moves stock OUT (just
// like a Sales Order) but carries no GST math — challans are NOT tax
// documents. The customer typically gets an Invoice within a month
// referencing one or more Challans (the "promote to invoice" flow).
//
// Billing toggle:
//   is_billed=false  →  customer hasn't been invoiced yet
//   is_billed=true   →  an Invoice has been raised; challan is linked
//
// Two print modes (matches the construction-trade workflow where
// drivers carry challans without amounts to avoid showing prices to
// the warehouse staff handling unloading):
//   "with_remarks" — amounts visible (default for billed challans)
//   "no_amount"    — amounts hidden, only product + qty (default for
//                    drivers' copies)

export type ChallanStatus = "draft" | "posted" | "cancelled";
export type ChallanPrintMode = "with_remarks" | "no_amount";

export interface Challan {
  id: string;
  tenant_id: string;
  challan_number: string;
  challan_date: string;            // YYYY-MM-DD
  party_id: string;                // customer
  route_id?: string;
  source_location_id?: string;     // where goods left from
  destination_address?: string;    // free text — where goods are going
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  status: ChallanStatus;

  /** Bill / No-Bill toggle — set when posting. False = "estimate /
   *  delivery without invoice". True = "tax invoice will follow". */
  is_billed: boolean;

  /** Default print mode for this challan. Overridable at print time. */
  print_mode: ChallanPrintMode;

  /** Linked invoice id once the challan has been promoted. Null
   *  until then. Set by the Invoice creation flow when the user
   *  picks this challan from the "Source challan" dropdown. */
  invoice_id?: string;

  /** No GST split here. Just gross totals — invoices add tax later. */
  subtotal: string;
  discount_total: string;
  grand_total: string;

  remarks?: string;

  posting_date?: string;
  cancelled_at?: string;
  cancellation_reason?: string;

  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ChallanLine {
  id: string;
  challan_id: string;
  line_number: number;
  item_id: string;
  description?: string;
  uom_id: string;
  quantity: string;
  unit_price: string;              // for "with_remarks" print only — challan is not a tax doc
  discount_pct: string;
  line_total: string;              // (unit_price × qty) − discount
  lot_id?: string;
  serial_id?: string;
  remarks?: string;
  /** Phase 13 — dimension snapshot. */
  thickness_mm?: number | null;
  size_code?: string | null;
}

// ── Phase 3 — Money: Accounts, Ledger, Payments, Employees ──
//
// Storage is double-entry: every business event (invoice post,
// payment, cheque deposit, opening balance import) writes paired
// debit/credit rows to `ledger_entries` against `financial_accounts`.
// The UI then presents this as separate "ledgers" by account type
// (Cash, Bank, Cheque-in-transit, GPay, per-Party, per-Employee).
//
// Per-account `current_balance` is denormalised at write time so the
// landing page tiles + parties list don't have to scan ledger_entries.

export type AccountType =
  | "cash_in_hand"          // Cash drawer
  | "bank"                  // Bank account
  | "cheque_in_transit"     // Cheques received but not yet deposited
  | "gpay"                  // UPI/GPay company collection account
  | "party_receivable"      // One per customer Party — they owe us
  | "party_payable"         // One per vendor Party — we owe them
  | "employee_float"        // One per Employee — money they hold for the company
  | "employee_payable"      // One per Employee — accrued salary we owe (Phase 3.5)
  | "sales_income"          // Income account credited on invoice post
  | "purchase_expense"      // Generic purchase expense (used for vendor bills with no item-level mapping)
  | "expense_category"      // One per ExpenseCategory — debited on Expense post (Phase 3.5)
  | "salary_expense"        // Salary expense account — debited on Salary post (Phase 3.5)
  | "gst_output"            // GST collected (liability) — credited on invoice post
  | "gst_input"             // GST paid (asset) — debited on vendor bill post (Phase 3.5)
  | "capital"               // Owner's capital
  | "manual";               // Tenant-defined custom account

export interface FinancialAccount {
  id: string;
  tenant_id: string;
  type: AccountType;
  /** Short code, unique per tenant. e.g. "CASH", "BANK-HDFC", "GPAY". */
  code: string;
  /** Human-readable label. e.g. "Cash in hand", "HDFC current account". */
  name: string;
  /** Set for party_receivable / party_payable accounts. */
  party_id?: string;
  /** Set for employee_float / employee_payable accounts. */
  employee_id?: string;
  /** Set for expense_category accounts. */
  expense_category_id?: string;
  /** Bank-account number (last 4 digits is fine), shown on receipts. */
  account_number?: string;
  /** IFSC for bank accounts. */
  ifsc?: string;
  /** Opening balance (signed: positive = debit nature; receivable opens
   *  positive when the customer owes us, payable opens negative). */
  opening_balance: string;
  /** Denormalised running balance after every entry. */
  current_balance: string;
  /** System accounts (auto-created per tenant or per party/employee)
   *  cannot be deleted; users can only rename them. */
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LedgerSourceType =
  | "invoice"
  | "challan"
  | "payment"
  | "cheque_deposit"
  | "vendor_bill"      // Phase 3.5
  | "expense"          // Phase 3.5
  | "salary"           // Phase 3.5
  | "opening"
  | "manual";

export interface LedgerEntry {
  id: string;
  tenant_id: string;
  account_id: string;
  entry_date: string;            // YYYY-MM-DD
  source_doc_type: LedgerSourceType;
  source_doc_id: string;
  /** Exactly one of debit/credit is non-zero per row. */
  debit: string;
  credit: string;
  /** Denormalised at write time, validated on read. */
  running_balance: string;
  /** Used to group paired entries belonging to one journal voucher.
   *  All rows of one payment / one invoice-post share the same group_id. */
  group_id: string;
  remarks?: string;
  created_at: string;
}

// ── Payments (Receipts + Payments share one entity, distinguished by direction)
export type PaymentDirection = "received" | "paid";
export type PaymentMode = "cash" | "bank" | "cheque" | "gpay";
export type PaymentStatus = "draft" | "posted" | "cancelled";

export interface CashDetails {
  mode: "cash";
}

export interface BankDetails {
  mode: "bank";
  /** Counterparty's bank reference / UTR / NEFT-IMPS ref. */
  reference: string;
  /** Counterparty bank name (free text). */
  counterparty_bank?: string;
}

export interface ChequeDetails {
  mode: "cheque";
  bank_name: string;
  cheque_number: string;
  cheque_date: string;            // YYYY-MM-DD
  /** Set when the cheque is deposited (cheque_in_transit → bank move). */
  deposit_date?: string;
  /** Bank account the cheque was deposited to. */
  deposited_to_account_id?: string;
  cleared: boolean;
}

export interface GPayDetails {
  mode: "gpay";
  /** Transaction reference / UTR. */
  transaction_ref: string;
  /** UPI ID of the payer (optional, for receipts). */
  payer_upi?: string;
}

export type PaymentModeDetails =
  | CashDetails
  | BankDetails
  | ChequeDetails
  | GPayDetails;

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  /** Sales invoice — for direction='received' allocations. */
  invoice_id?: string;
  /** Challan — reserved for Phase 3.5 challan-direct settlement. */
  challan_id?: string;
  /** Vendor bill — for direction='paid' allocations (Phase 3.5). */
  bill_id?: string;
  amount: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  /** Voucher number — RV/2026-04/0001 for receipts, PV/2026-04/0001 for payments. */
  payment_number: string;
  payment_date: string;
  direction: PaymentDirection;
  /** Customer (for receipts) or Vendor (for payments). */
  party_id: string;
  amount: string;
  mode: PaymentMode;
  details: PaymentModeDetails;
  /** Where the money landed (or came from):
   *  - mode=cash    → a cash_in_hand account
   *  - mode=bank    → a bank account
   *  - mode=cheque  → a cheque_in_transit account (until deposit)
   *  - mode=gpay    → a gpay account OR an employee_float account */
  account_id: string;
  /** Set when mode=gpay AND payee was an employee (not the company).
   *  Mirrors the account_id linkage but kept explicit for readability
   *  in the receipt list view. */
  payee_employee_id?: string;
  status: PaymentStatus;
  posting_date?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  remarks?: string;
  /** Total of allocations applied so far. amount − allocated_amount = "on account". */
  allocated_amount: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// ── Employee (minimal — full SalaryRule + cron deferred to Phase 3.5)
export interface Employee {
  id: string;
  tenant_id: string;
  /** Optional link to a User account if the employee also logs in. */
  user_id?: string;
  name: string;
  /** Free-text job title — NOT an RBAC role. */
  role: string;
  monthly_salary: string;
  phone?: string;
  email?: string;
  /** Default payout account when their salary is paid. */
  payment_account_id?: string;
  joined_at: string;
  is_active: boolean;
  /** Convenience: set to the matching employee_float account, so the
   *  list page can show "amount holding" without an extra lookup. */
  float_account_id: string;
  /** Phase 3.5 — auto-created on insert; tracks accrued salary owed. */
  payable_account_id?: string;
  created_at: string;
  updated_at: string;
}

// ── Phase 3.5 — AP completion: Vendor Bills, Expenses, Salary ──
//
// Vendor Bills are the AP-side mirror of Invoices: financial-only
// (no stock movement), three-line ledger entry on post (Dr expense,
// Dr GST input, Cr party_payable). Stock IN happens via the GRN/PO
// flow, NOT on bill post.
//
// Expenses are simpler — no party required, optional vendor link.
// Each tenant-customisable ExpenseCategory has its own
// expense_category financial_account auto-created on insert.
//
// SalaryEntry is a single-row voucher: gross − float held = net
// payable. Posts three entries (Dr salary_expense, Cr employee_float
// for held amount, Cr paid_from for net). Cron-driven monthly
// auto-debit is deferred to Phase 4.

export type VendorBillStatus = "draft" | "posted" | "cancelled";

export interface VendorBill {
  id: string;
  tenant_id: string;
  /** Internal voucher number — VB/2026-04/0001. */
  bill_number: string;
  /** The supplier's own invoice number from the paper they sent. */
  supplier_invoice_number?: string;
  bill_date: string;             // YYYY-MM-DD
  due_date?: string;
  /** Vendor party — must have party_type IN ('supplier','both'). */
  party_id: string;
  /** 2-digit state code of supply (drives GST input split). */
  place_of_supply: string;
  status: VendorBillStatus;
  /** Cached totals (recomputed on every line write). */
  subtotal: string;
  tax_total: string;
  grand_total: string;
  /** Sum of payment allocations applied so far. */
  allocated_amount: string;
  remarks?: string;
  posting_date?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface VendorBillLine {
  id: string;
  bill_id: string;
  line_number: number;
  /** Optional — bills can have free-text expense lines too. */
  item_id?: string;
  hsn_code?: string;
  description: string;
  uom_id?: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  /** Mirror of InvoiceLine — same GST math but the side is reversed
   *  (Dr GST input instead of Cr GST output). */
  rate_pct: string;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  line_total: string;
  /** Optional override of the default purchase_expense account.
   *  Useful for distinguishing "stock purchases" from "consumables". */
  expense_account_id?: string;
  remarks?: string;
}

export interface ExpenseCategory {
  id: string;
  tenant_id: string;
  code: string;            // e.g. "FOOD", "PETROL"
  name: string;            // e.g. "Food", "Petrol"
  /** Distinguishes capex from opex. Capital expenses go on the
   *  balance sheet, not the P&L; reporting cares about this. */
  is_capital: boolean;
  is_active: boolean;
  /** Auto-set to the matching expense_category account, like
   *  Employee.float_account_id. Lets the list page show running
   *  totals without an extra lookup. */
  expense_account_id: string;
  created_at: string;
  updated_at: string;
}

export type ExpenseStatus = "draft" | "posted" | "cancelled";

export interface Expense {
  id: string;
  tenant_id: string;
  /** Internal voucher number — XV/2026-04/0001. */
  expense_number: string;
  expense_date: string;
  category_id: string;
  amount: string;
  /** Where the money came from. cash/bank/gpay accounts only. */
  paid_from_account_id: string;
  /** Optional party — for "fuel bill paid to BPCL", "phone bill to Airtel", etc. */
  vendor_id?: string;
  description: string;
  /** Optional bill photo / receipt. */
  attachment_id?: string;
  status: ExpenseStatus;
  posting_date?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export type SalaryStatus = "draft" | "posted" | "cancelled";

export interface SalaryEntry {
  id: string;
  tenant_id: string;
  /** Internal voucher number — SAL/2026-04/0001. */
  salary_number: string;
  /** Always the 1st of the month, for grouping by period. */
  period_month: string;       // YYYY-MM-01
  employee_id: string;
  /** What the employee was supposed to earn that month. */
  gross_salary: string;
  /** Snapshot of employee_float at the moment of posting. Subtracted
   *  from gross to compute net. Frozen here for audit. */
  float_held: string;
  /** gross_salary − float_held — what actually pays out. */
  net_paid: string;
  /** cash/bank/gpay account the net comes from. */
  paid_from_account_id: string;
  status: SalaryStatus;
  posting_date?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  version: number;
  remarks?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// ═══════════════════════════════════════════════════════════
// Phase 4 — Reports & Statements (REQ-8)
//
// Read-only aggregations over existing transactional data. Every
// report is a server-side rollup; the FE never assembles totals
// from raw rows. Bucketed reports (aging) are computed against the
// `as_of` date supplied by the caller (defaults to today).
// ═══════════════════════════════════════════════════════════

/** One row in /reports/sales — flattened invoice with GST splits. */
export interface SalesRegisterRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;        // YYYY-MM-DD
  party_id: string;
  party_name: string;
  party_state_code?: string;   // 2-digit GST state code, for inter-state filter
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  grand_total: string;
  status: InvoiceStatus;
}

/** Totals footer for /reports/sales and /reports/purchases. */
export interface RegisterTotals {
  count: number;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  grand_total: string;
}

export interface SalesRegisterResponse {
  rows: SalesRegisterRow[];
  totals: RegisterTotals;
}

/** One row in /reports/purchases — flattened vendor-bill. */
export interface PurchaseRegisterRow {
  bill_id: string;
  bill_number: string;
  bill_date: string;           // YYYY-MM-DD
  party_id: string;
  party_name: string;
  party_state_code?: string;
  taxable_value: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  grand_total: string;
  status: VendorBillStatus;
}

export interface PurchaseRegisterResponse {
  rows: PurchaseRegisterRow[];
  totals: RegisterTotals;
}

/** Per-party row in the aging reports. Sums of outstanding
 *  amounts (grand_total − allocated_amount) on posted invoices
 *  / bills, bucketed by days past `as_of`. */
export interface AgingRow {
  party_id: string;
  party_name: string;
  bucket_0_30: string;         // ≤30 days old
  bucket_31_60: string;
  bucket_61_90: string;
  bucket_90_plus: string;      // >90 days old
  total: string;
  oldest_doc_date?: string;    // earliest unpaid doc date
}

export interface AgingTotals {
  count: number;
  bucket_0_30: string;
  bucket_31_60: string;
  bucket_61_90: string;
  bucket_90_plus: string;
  total: string;
}

export interface AgingResponse {
  as_of: string;               // YYYY-MM-DD; mirrored from request
  rows: AgingRow[];
  totals: AgingTotals;
}

/** /reports/profit-loss — date-range income statement. All amounts
 *  are signed positive; net is revenue − cogs − expenses − salary. */
export interface ProfitLossExpenseRow {
  category_id: string;
  category_name: string;
  amount: string;
}

export interface ProfitLossResponse {
  start_date: string;
  end_date: string;
  /** Sum of taxable_value on posted invoices in range (we exclude
   *  GST since it's a pass-through, not revenue). */
  revenue: string;
  /** COGS: stock-out valuation on posted invoice/challan moves. */
  cogs: string;
  gross_profit: string;        // revenue − cogs
  /** Expenses by category (posted in range). */
  expenses: ProfitLossExpenseRow[];
  expenses_total: string;
  /** Posted salary in range (gross_salary, not net). */
  salary_total: string;
  net_profit: string;          // gross_profit − expenses_total − salary_total
}

// ═══════════════════════════════════════════════════════════
// Phase 5 — Compliance close (REQ-9)
//
// GSTR-1 / GSTR-3B JSON exports + Period Close (ledger lock).
// Both build off the registers shipped in Phase 4 plus a new
// `tenant_config.period_close.lock_before_date` value.
// ═══════════════════════════════════════════════════════════

/** GSTR-1 §4 — B2B (Registered customer). One row per invoice. */
export interface Gstr1B2BRow {
  ctin: string;             // customer GSTIN
  inum: string;             // invoice_number
  idt:  string;             // invoice_date DD-MM-YYYY (GSTN format)
  val:  string;             // grand_total
  pos:  string;             // place_of_supply (state code)
  rchrg: "Y" | "N";         // reverse charge
  inv_typ: "R" | "SEWP" | "SEWOP" | "DE" | "CBW";  // R = Regular
  itms: Array<{
    num: number;            // line_number
    itm_det: {
      txval: string;        // taxable_value
      rt: string;           // rate %
      camt: string;         // cgst
      samt: string;         // sgst
      iamt: string;         // igst
      csamt: string;        // cess
    };
  }>;
}

/** GSTR-1 §5 — B2CL (Unregistered, inter-state, > ₹2.5L). */
export interface Gstr1B2CLRow {
  inum: string;
  idt:  string;
  val:  string;
  pos:  string;
  itms: Array<{
    num: number;
    itm_det: {
      txval: string;
      rt: string;
      iamt: string;         // always IGST (inter-state by definition)
      csamt: string;
    };
  }>;
}

/** GSTR-1 §7 — B2CS (Unregistered, intra-state OR ≤ ₹2.5L inter-state).
 *  Aggregated by rate × place-of-supply, not per-invoice. */
export interface Gstr1B2CSRow {
  sply_ty: "INTRA" | "INTER";
  pos: string;
  rt: string;
  txval: string;
  camt: string;
  samt: string;
  iamt: string;
  csamt: string;
}

/** Full GSTR-1 response. The `summary` block is what the FE
 *  preview renders; the rest matches the GSTN JSON spec exactly
 *  so the same payload can be uploaded to the GST portal. */
export interface Gstr1Response {
  gstin: string;
  fp: string;               // filing period MMYYYY (e.g. "042026")
  gross_turnover?: string;  // FY-to-date for first filing
  b2b: Gstr1B2BRow[];
  b2cl: Gstr1B2CLRow[];
  b2cs: Gstr1B2CSRow[];
  summary: {
    b2b_count: number;
    b2cl_count: number;
    b2cs_count: number;
    total_taxable: string;
    total_cgst: string;
    total_sgst: string;
    total_igst: string;
    total_cess: string;
    grand_total: string;
  };
}

/** GSTR-3B summary return — monthly. Section 3.1 outward + Section 4 ITC. */
export interface Gstr3BResponse {
  gstin: string;
  ret_period: string;       // MMYYYY
  /** §3.1 Outward & reverse-charge inward supplies. */
  sup_details: {
    /** 3.1(a) Outward taxable supplies (other than zero-rated, nil-rated, exempted). */
    osup_det: {
      txval: string;
      iamt: string;
      camt: string;
      samt: string;
      csamt: string;
    };
    /** 3.1(d) Inward supplies liable to reverse charge. */
    isup_rev: {
      txval: string;
      iamt: string;
      camt: string;
      samt: string;
      csamt: string;
    };
  };
  /** §4 Eligible Input Tax Credit. */
  itc_elg: {
    /** 4(A)(5) All other ITC — sum of input GST on posted vendor bills. */
    itc_avl: {
      iamt: string;
      camt: string;
      samt: string;
      csamt: string;
    };
    itc_net: {
      iamt: string;
      camt: string;
      samt: string;
      csamt: string;
    };
  };
}

/** Tenant-level period-close config. Stored in tenant_config under
 *  key="period_close". Acts as a hard floor — all
 *  posted/cancelled documents whose `posting_date` ≤ lock_before_date
 *  are immutable. */
export interface PeriodCloseConfig {
  /** YYYY-MM-DD; documents posted on or before this date are locked. */
  lock_before_date: string | null;
  /** Who/when last locked. Audit trail. */
  locked_at?: string;
  locked_by?: string;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════
// Phase 6 — Payroll automation (REQ-10)
//
// Batch generation: one click creates draft salary entries for
// all active employees for a month, with `float_held` snapshotted.
// Batch post: one click posts all drafts (with per-entry float-
// drift validation). Payslip: printable per-entry view.
// ═══════════════════════════════════════════════════════════

/** One row in the payroll batch grid — joins SalaryEntry to
 *  the parent Employee with the relevant pay-period info. */
export interface PayrollBatchEntry {
  /** Salary entry id; null when the draft hasn't been generated yet
   *  (employee is in the active list but no entry created — happens
   *  when an employee is hired mid-period). */
  salary_id: string | null;
  employee_id: string;
  employee_name: string;
  employee_role?: string;
  /** Snapshot at last generate. May drift if customer GPays the
   *  salesman after generate but before post — backend re-validates
   *  on post and emits SALARY_FLOAT_DRIFT if so. */
  current_float: string;
  /** Set when salary_id !== null. */
  gross_salary?: string;
  float_held?: string;
  net_paid?: string;
  status?: SalaryStatus;
}

/** Response shape for GET /salary/batch?period=YYYY-MM. */
export interface PayrollBatchSummary {
  period_month: string;       // YYYY-MM-01
  /** All active employees, even those without a draft yet. */
  entries: PayrollBatchEntry[];
  /** Aggregate counts for the header. */
  totals: {
    employee_count: number;
    drafts: number;
    posted: number;
    cancelled: number;
    total_gross: string;
    total_float: string;
    total_net: string;
  };
}

/** Bulk-post response. Posts every draft for the period in one
 *  transaction; the per-entry SALARY_FLOAT_DRIFT check still runs.
 *  If any drifts, the whole batch rolls back and we return the
 *  list of drifting entries so the user can refresh and retry. */
export interface PayrollBatchPostResponse {
  posted_count: number;
  drift_entries?: Array<{
    salary_id: string;
    employee_name: string;
    expected_float: string;
    actual_float: string;
  }>;
}

/** Hydrated payslip — what the printable view renders. Backend
 *  joins SalaryEntry → Employee → Tenant in one call so the FE
 *  doesn't need extra fetches for the print preview. */
export interface PayslipData {
  /** Source SalaryEntry id; matches /money/salary/[id]. */
  salary_id: string;
  salary_number: string;
  period_month: string;
  posting_date?: string;
  status: SalaryStatus;

  tenant_name: string;
  tenant_address?: string;
  tenant_gstin?: string;

  employee_id: string;
  employee_name: string;
  employee_role?: string;
  employee_id_code?: string;     // human-readable employee code (E001 etc.)

  gross_salary: string;
  float_held: string;
  net_paid: string;
  paid_from_account_name: string;
  /** "Forty-five thousand only" — server-rendered for legal compliance. */
  amount_in_words: string;
}

// ═══════════════════════════════════════════════════════════
// Phase 7 — Bulk CSV imports (REQ-11)
//
// Two-step flow: preview the parsed CSV (validation only — nothing
// persisted) → user reviews errors → commit. The split lets users
// fix bad rows before any state changes.
// ═══════════════════════════════════════════════════════════

/** Entity types currently importable. Extending: add a column-schema
 *  + validator on the backend, then add a card to the FE landing. */
export type ImportEntityType =
  | "items"            // SKU master with HSN/UoM/tax rate
  | "parties"          // Customers + Suppliers
  | "stock_balances"   // Initial qty_on_hand per item per location
  | "opening_balances"; // Per-party AR/AP opening (Phase 3 ledger seed)

/** One column definition in a CSV template. Drives the template
 *  download AND the row-level validation. */
export interface ImportColumn {
  key: string;
  label: string;
  required: boolean;
  /** Plain-language hint shown next to the column on the wizard. */
  help?: string;
  /** Optional fixed list — used to render select-style validation
   *  ("party_type must be one of customer / supplier / both"). */
  enum_values?: string[];
}

/** Per-row error from preview. `row_index` is 1-based to match what
 *  the user sees in the spreadsheet. */
export interface ImportRowError {
  row_index: number;
  field?: string;       // null when error is row-level (e.g. dup key)
  message: string;
}

export interface ImportPreviewResponse {
  entity: ImportEntityType;
  columns: ImportColumn[];
  /** All parsed rows, with `_valid: false` flagged on bad ones. */
  rows: Array<Record<string, unknown> & { _valid: boolean; _errors?: ImportRowError[] }>;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  /** Row-level errors collected — rendered in the error panel. */
  errors: ImportRowError[];
}

export interface ImportCommitResponse {
  entity: ImportEntityType;
  /** Echoed back so the FE can show "Imported 14 of 17 rows". */
  total_rows: number;
  created_count: number;
  /** Rows skipped because preview flagged them invalid. */
  skipped_count: number;
  /** Errors during the actual commit (e.g. DB unique violations
   *  that weren't caught at preview). */
  errors: ImportRowError[];
  /** Server-assigned import_id for audit retrieval. */
  import_id: string;
}

// ═══════════════════════════════════════════════════════════
// Phase 8 — Cash flow statement (REQ-12)
//
// Direct method: cash inflows/outflows grouped by activity. We do
// NOT do the indirect method (start with net profit, adjust for
// non-cash items) — most SMB users find direct more intuitive.
// ═══════════════════════════════════════════════════════════

export interface CashFlowLineItem {
  label: string;
  amount: string;          // signed; negative = outflow
}

export interface CashFlowResponse {
  start_date: string;
  end_date: string;
  /** Sum of cash + bank + gpay account balances at start_date. */
  opening_cash: string;
  /** ─── Operating activities ─── */
  operating: {
    receipts_from_customers: string;     // PAYMENTS direction=received in range
    payments_to_vendors: string;         // PAYMENTS direction=paid (vendor party)
    salary_paid: string;                 // posted SALARY in range, net_paid
    operating_expenses: string;          // posted non-capital expenses
    net: string;                         // net of the above
  };
  /** ─── Investing activities ─── */
  investing: {
    capital_expenditure: string;         // expenses in is_capital=true categories
    net: string;
  };
  /** Operating net + Investing net. */
  net_change_in_cash: string;
  /** Sum at end_date. */
  closing_cash: string;
  /** Pre-computed line items so the FE renders straight from response. */
  lines: CashFlowLineItem[];
}

// ═══════════════════════════════════════════════════════════
// Phase 9 — Audit log viewer (REQ-13)
//
// Read-only view over the audit_log table that backend writes
// on critical actions: post/cancel doc, period-close set/clear,
// permission grant/revoke, etc.
// ═══════════════════════════════════════════════════════════

/** Single audit entry. `before`/`after` are JSON snapshots for
 *  diff rendering — null when N/A (e.g. read events). */
export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  /** Who did it. user_email is denormalised for fast list rendering;
   *  user_id stays for joining to current user state. */
  user_id?: string;
  user_email?: string;
  /** What they did. Dotted action code: `invoice.post`, `period_close.set`,
   *  `salary.batch.post`, `import.commit`, etc. */
  action: string;
  /** Which entity. `entity_type` is the table-ish name; `entity_id` is
   *  the row id. NULL for tenant-level actions like `period_close.set`. */
  entity_type?: string;
  entity_id?: string;
  /** Optional snapshots for diff rendering. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Free-text reason captured at action time (e.g. cancellation reason). */
  remarks?: string;
  /** Server-recorded — used for filtering and ordering. */
  created_at: string;
  /** IP + UA for forensics. */
  ip_address?: string;
  user_agent?: string;
}

// ═══════════════════════════════════════════════════════════
// Phase 13 — Item Dimensions + Versioned Pricing Rules (REQ-17)
//
// For Nova Bond's ACP catalog, the sale price isn't a single number
// per item — it varies by thickness (mm) and panel size. Mr. Arpit
// sets a price that holds until he updates it; old invoices keep
// their original price (line stores the snapshot).
//
// Data shape:
//   ItemDimension     — fixed lookup of (thickness_mm, size_code)
//                       combinations available for ACP. Tenant-
//                       customisable but rarely changes.
//   ItemPricingRule   — versioned. One ACTIVE rule per (item,
//                       thickness, size). New rule auto-sets prior
//                       rule's valid_until to (new.valid_from − 1d).
//
// Lookup contract:
//   Given (item_id, thickness_mm, size_code, as_of_date), return the
//   rule where valid_from <= as_of_date AND
//   (valid_until IS NULL OR valid_until >= as_of_date).
//
// Lines on Invoice / Challan / GRN documents reference the dimension
// at line creation. The unit_price stored on the line is a SNAPSHOT —
// changing the pricing rule later does NOT mutate historical lines.
// ═══════════════════════════════════════════════════════════

export interface ItemDimension {
  id: string;
  tenant_id: string;
  /** Panel thickness in millimetres. ACP standard set: 2, 3, 4, 5. */
  thickness_mm: number;
  /** Panel size code (e.g. "1220x2440") — width × length in mm. */
  size_code: string;
  /** Display label (e.g. "1220 × 2440 mm  · 4 ft × 8 ft"). */
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemPricingRule {
  id: string;
  tenant_id: string;
  item_id: string;
  thickness_mm: number;
  size_code: string;
  /** Sale price per sheet at this dimension. */
  sale_price: string;
  /** First date this price is in effect (inclusive). */
  valid_from: string;          // YYYY-MM-DD
  /** Last date this price is in effect (inclusive). NULL = currently active. */
  valid_until: string | null;
  /** Optional reason / notes shown in the version history table. */
  notes?: string;
  created_at: string;
  created_by?: string;
}

/** Response shape for GET /pricing-rules/lookup. Returns the single
 *  active rule (or null) for the given (item, thickness, size, date). */
export interface ItemPricingLookupResponse {
  rule: ItemPricingRule | null;
  /** Server-rendered helper for FE — "Effective since 2026-04-15" etc. */
  effective_label?: string;
}

// ── Auth State ────────────────────────────────────────────
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenantId: string | null;
  tenantName: string | null;
  isSuperAdmin: boolean;
  permissions: Set<string>;       // module-prefixed codes
  modules: string[];              // subscribed module codes from JWT
  tz: string;                     // IANA timezone
}