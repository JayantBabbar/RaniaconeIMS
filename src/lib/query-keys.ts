// ═══════════════════════════════════════════════════════════
// Query Key Factory — Consistent cache keys across the app
// ═══════════════════════════════════════════════════════════

export const queryKeys = {
  // Auth
  auth: {
    me: ["auth", "me"] as const,
  },

  // Users
  users: {
    all: ["users"] as const,
    list: (params?: Record<string, unknown>) =>
      ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    roles: (userId: string) => ["userRoles", userId] as const,
  },

  // Roles
  roles: {
    all: ["roles"] as const,
    detail: (id: string) => ["role", id] as const,
    permissions: (roleId: string) => ["rolePermissions", roleId] as const,
  },

  // Permissions
  permissions: {
    all: ["permissions"] as const,
    byModule: (module: string) => ["permissions", module] as const,
  },

  // Items
  items: {
    all: ["items"] as const,
    list: (params?: Record<string, unknown>) =>
      ["items", "list", params] as const,
    detail: (id: string) => ["items", "detail", id] as const,
    identifiers: (itemId: string) =>
      ["items", itemId, "identifiers"] as const,
    variants: (itemId: string) => ["items", itemId, "variants"] as const,
    uoms: (itemId: string) => ["items", itemId, "uoms"] as const,
    lots: (itemId: string) => ["items", itemId, "lots"] as const,
    serials: (itemId: string) => ["items", itemId, "serials"] as const,
    reorderPolicies: (itemId: string) =>
      ["items", itemId, "reorderPolicies"] as const,
  },

  // Parties
  parties: {
    all: ["parties"] as const,
    list: (params?: Record<string, unknown>) =>
      ["parties", "list", params] as const,
    detail: (id: string) => ["parties", "detail", id] as const,
  },

  // Locations
  locations: {
    all: ["locations"] as const,
    detail: (id: string) => ["locations", "detail", id] as const,
    bins: (locId: string) => ["locations", locId, "bins"] as const,
  },

  // Stock
  balances: {
    all: ["balances"] as const,
    list: (params?: Record<string, unknown>) =>
      ["balances", "list", params] as const,
  },
  movements: {
    all: ["movements"] as const,
    list: (params?: Record<string, unknown>) =>
      ["movements", "list", params] as const,
  },
  valuationLayers: {
    all: ["valuationLayers"] as const,
  },
  reservations: {
    all: ["reservations"] as const,
  },

  // Documents
  documents: {
    all: ["documents"] as const,
    list: (params?: Record<string, unknown>) =>
      ["documents", "list", params] as const,
    detail: (id: string) => ["documents", "detail", id] as const,
    lines: (docId: string) => ["documents", docId, "lines"] as const,
  },
  documentTypes: {
    all: ["documentTypes"] as const,
  },

  // Stock Counts
  counts: {
    all: ["counts"] as const,
    detail: (id: string) => ["counts", "detail", id] as const,
    lines: (countId: string) => ["counts", countId, "lines"] as const,
  },

  // Master Data
  categories: { all: ["categories"] as const },
  brands: { all: ["brands"] as const },
  uomCategories: { all: ["uomCategories"] as const },
  uoms: { all: ["uoms"] as const },
  statusMaster: { all: ["statusMaster"] as const },
  numberSeries: { all: ["numberSeries"] as const },
  workflows: { all: ["workflows"] as const },
  customFields: { all: ["customFields"] as const },

  // Admin
  tenants: { all: ["tenants"] as const },
  currencies: { all: ["currencies"] as const },
} as const;
