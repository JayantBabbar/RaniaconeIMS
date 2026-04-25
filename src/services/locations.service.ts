import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { LOCATIONS } from "@/lib/api-constants";
import type { InventoryLocation, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Locations Service — Inventory Locations (hierarchical) + Bins
// ═══════════════════════════════════════════════════════════

export interface WarehouseBin {
  id: string;
  tenant_id: string;
  location_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const locationService = {
  list: (params?: { limit?: number; cursor?: string; parent_id?: string }) =>
    api.get<PaginatedResponse<InventoryLocation>>(LOCATIONS.LIST, params),
  getById: (id: string) => api.get<InventoryLocation>(LOCATIONS.DETAIL(id)),
  create: (data: {
    code: string;
    name: string;
    location_type: string;
    parent_id?: string | null;
    is_active?: boolean;
  }) => api.post<InventoryLocation>(LOCATIONS.LIST, data),
  update: (
    id: string,
    data: Partial<{
      name: string;
      parent_id: string | null;
      is_active: boolean;
    }>
  ) => api.patch<InventoryLocation>(LOCATIONS.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(LOCATIONS.DETAIL(id)),

  // Bins endpoint returns a plain JSON array (not enveloped).
  listBins: async (locationId: string): Promise<WarehouseBin[]> => {
    const res = await api.get<WarehouseBin[] | PaginatedResponse<WarehouseBin>>(
      LOCATIONS.BINS(locationId),
    );
    return unwrapList(res);
  },
  createBin: (
    locationId: string,
    data: { code: string; name: string; is_active?: boolean }
  ) => api.post<WarehouseBin>(LOCATIONS.BINS(locationId), data),
};
