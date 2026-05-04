import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { ITEM_DIMENSIONS, PRICING_RULES, PRICING_DIMENSION_OPTIONS } from "@/lib/api-constants";
import type {
  ItemDimension,
  ItemPricingRule,
  ItemPricingLookupResponse,
  PaginatedResponse,
} from "@/types";

export interface SizeOption { code: string; label: string }

// ═══════════════════════════════════════════════════════════════════
// Pricing service — Phase 13 (REQ-17).
//
// Two resources:
//   ItemDimension     — fixed (thickness, size) lookup; rarely changes
//   ItemPricingRule   — versioned per (item, dimension) sale price
//
// `create()` is *atomic & version-aware*:
//   1. The new rule's valid_from defaults to today
//   2. The PRIOR active rule (same item × dim) gets its valid_until
//      auto-set to (new.valid_from − 1 day)
//   3. Old invoices keep their snapshotted unit_price; only NEW lines
//      pick up the new rule
//
// `lookup()` is what line forms call to auto-fill unit_price when the
// user picks an item + dimension. Returns the active rule for the
// given as_of date (today if omitted).
// ═══════════════════════════════════════════════════════════════════

interface PricingListFilters {
  item_id?: string;
  active_only?: boolean;        // when true, returns only valid_until=null rules
  limit?: number;
  [key: string]: unknown;
}

interface LookupParams {
  item_id: string;
  thickness_mm: number;
  size_code: string;
  as_of?: string;               // YYYY-MM-DD, defaults to today
  [key: string]: unknown;
}

interface CreateRulePayload {
  item_id: string;
  thickness_mm: number;
  size_code: string;
  sale_price: string;
  /** Optional. Defaults to today on the backend. */
  valid_from?: string;
  notes?: string;
}

export const pricingService = {
  // ── Dimensions (read-only for tenants except admin) ──
  listDimensions: async (): Promise<ItemDimension[]> => {
    const res = await api.get<ItemDimension[] | PaginatedResponse<ItemDimension>>(
      ITEM_DIMENSIONS.LIST,
    );
    return unwrapList(res);
  },

  // ── Pricing rules ──
  list: async (params?: PricingListFilters): Promise<ItemPricingRule[]> => {
    const res = await api.get<ItemPricingRule[] | PaginatedResponse<ItemPricingRule>>(
      PRICING_RULES.LIST,
      params,
    );
    return unwrapList(res);
  },

  /** Auto-fill helper for line forms. Returns the active rule (or null
   *  if no rule exists for that combination yet). */
  lookup: (params: LookupParams) =>
    api.get<ItemPricingLookupResponse>(PRICING_RULES.LOOKUP, params),

  /** Create a new rule. Backend closes the prior rule for this
   *  (item, thickness, size) by setting its valid_until. */
  create: (payload: CreateRulePayload) =>
    api.post<ItemPricingRule>(PRICING_RULES.LIST, payload),

  // ── Dimension option catalogues (thickness + size) ──
  // The lists of thickness values + size codes that pricing rules can
  // be created against. Editable from the Item Pricing master page.
  listThicknessOptions: async (): Promise<number[]> => {
    const res = await api.get<number[] | PaginatedResponse<number>>(
      PRICING_DIMENSION_OPTIONS.THICKNESS,
    );
    return unwrapList(res);
  },
  addThicknessOption: (thickness_mm: number) =>
    api.post<{ thickness_mm: number }>(PRICING_DIMENSION_OPTIONS.THICKNESS, { thickness_mm }),
  removeThicknessOption: (thickness_mm: number) =>
    api.delete<void>(`${PRICING_DIMENSION_OPTIONS.THICKNESS}/${thickness_mm}`),

  listSizeOptions: async (): Promise<SizeOption[]> => {
    const res = await api.get<SizeOption[] | PaginatedResponse<SizeOption>>(
      PRICING_DIMENSION_OPTIONS.SIZE,
    );
    return unwrapList(res);
  },
  addSizeOption: (payload: SizeOption) =>
    api.post<SizeOption>(PRICING_DIMENSION_OPTIONS.SIZE, payload),
  removeSizeOption: (code: string) =>
    api.delete<void>(`${PRICING_DIMENSION_OPTIONS.SIZE}/${encodeURIComponent(code)}`),
};
