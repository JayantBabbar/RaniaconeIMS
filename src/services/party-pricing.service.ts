import { api } from "@/lib/api-client";
import { PARTY_ITEM_COSTS, PARTY_ITEM_SALE_PRICES } from "@/lib/api-constants";
import type {
  PartyItemCost,
  PartyItemCostLookupResponse,
  PartyItemSalePrice,
  PartyItemSalePriceLookupResponse,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════
// Party Pricing Service
//
// Two sub-namespaces:
//   .costs   — supplier-side: what each supplier charges Arpit per (item, thickness)
//   .prices  — customer-side: what Arpit charges each customer per (item, thickness)
//
// Both use the same versioning pattern as ItemPricingRule (Phase 13):
// creating a new row auto-closes the prior active row by setting its
// valid_until to (newRow.valid_from − 1 day). Active row = the one
// where valid_until IS NULL.
//
// Lookup is keyed on (party_id, item_id, thickness_mm) — all three are
// required. Thicker boards cost more, so prices are stored per thickness.
// ═══════════════════════════════════════════════════════════

export const partyPricingService = {
  costs: {
    list: (params?: {
      party_id?: string;
      item_id?: string;
      thickness_mm?: number;
      active_only?: boolean;
      limit?: number;
      cursor?: string;
    }) =>
      api.get<PaginatedResponse<PartyItemCost>>(PARTY_ITEM_COSTS.LIST, params),

    create: (data: {
      party_id: string;
      item_id: string;
      thickness_mm: number;
      cost: string;
      valid_from?: string;
      notes?: string;
    }) => api.post<PartyItemCost>(PARTY_ITEM_COSTS.LIST, data),

    lookup: (params: { party_id: string; item_id: string; thickness_mm: number; as_of?: string }) =>
      api.get<PartyItemCostLookupResponse>(PARTY_ITEM_COSTS.LOOKUP, params),
  },

  prices: {
    list: (params?: {
      party_id?: string;
      item_id?: string;
      thickness_mm?: number;
      active_only?: boolean;
      limit?: number;
      cursor?: string;
    }) =>
      api.get<PaginatedResponse<PartyItemSalePrice>>(PARTY_ITEM_SALE_PRICES.LIST, params),

    create: (data: {
      party_id: string;
      item_id: string;
      thickness_mm: number;
      sale_price: string;
      valid_from?: string;
      notes?: string;
    }) => api.post<PartyItemSalePrice>(PARTY_ITEM_SALE_PRICES.LIST, data),

    lookup: (params: { party_id: string; item_id: string; thickness_mm: number; as_of?: string }) =>
      api.get<PartyItemSalePriceLookupResponse>(PARTY_ITEM_SALE_PRICES.LOOKUP, params),
  },
};
