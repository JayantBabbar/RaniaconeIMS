import { api } from "@/lib/api-client";
import { COUNTS } from "@/lib/api-constants";
import type { StockCount, CountLine, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Stock Counts Service
// ═══════════════════════════════════════════════════════════

export const countService = {
  list: (params?: {
    limit?: number;
    cursor?: string;
    location_id?: string;
    status?: string;
  }) => api.get<PaginatedResponse<StockCount>>(COUNTS.LIST, params),

  getById: (id: string) => api.get<StockCount>(COUNTS.DETAIL(id)),

  create: (data: {
    count_number?: string;
    count_date: string;
    location_id: string;
    remarks?: string;
  }) => api.post<StockCount>(COUNTS.LIST, data),

  update: (
    id: string,
    data: Partial<{ count_date: string; remarks: string }>
  ) => api.patch<StockCount>(COUNTS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(COUNTS.DETAIL(id)),

  apply: (id: string) => api.post<StockCount>(COUNTS.APPLY(id)),

  listLines: (countId: string) =>
    api.get<PaginatedResponse<CountLine>>(COUNTS.LINES(countId)),

  createLine: (
    countId: string,
    data: {
      item_id: string;
      lot_id?: string;
      bin_id?: string;
      counted_qty?: string;
      remarks?: string;
    }
  ) => api.post<CountLine>(COUNTS.LINES(countId), data),

  updateLine: (
    countId: string,
    lineId: string,
    data: Partial<{ counted_qty: string; remarks: string }>
  ) => api.patch<CountLine>(COUNTS.LINE(countId, lineId), data),

  deleteLine: (countId: string, lineId: string) =>
    api.delete<void>(COUNTS.LINE(countId, lineId)),
};
