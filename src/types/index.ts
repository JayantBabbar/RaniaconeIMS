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
export interface Party {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  party_type?: string;
  opening_balance?: string;
  currency_id?: string;
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