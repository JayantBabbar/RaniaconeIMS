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
} as const;

// ── Health ────────────────────────────────────────────────
export const HEALTH = "/health";
