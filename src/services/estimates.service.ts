import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { ESTIMATES, ROUTES } from "@/lib/api-constants";
import type {
  Estimate,
  EstimateLine,
  EstimatePrintMode,
  Invoice,
  PaginatedResponse,
  Route,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Estimates service.
//
// Mirrors invoices.service.ts but for delivery notes (no GST math).
// Adds one extra action — promote-to-invoice — that returns both
// the updated estimate and the newly-created invoice stub.
// ═══════════════════════════════════════════════════════════════════

export interface EstimateCreate {
  estimate_number?: string;
  estimate_date: string;            // YYYY-MM-DD
  party_id: string;
  route_id?: string;
  source_location_id?: string;
  destination_address?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  is_billed?: boolean;             // default false
  print_mode?: EstimatePrintMode;   // default "no_amount"
  remarks?: string;
}

export interface EstimateUpdate {
  estimate_date?: string;
  party_id?: string;
  route_id?: string | null;
  source_location_id?: string;
  destination_address?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  is_billed?: boolean;
  print_mode?: EstimatePrintMode;
  remarks?: string;
}

export interface EstimateLineCreate {
  item_id: string;
  description?: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct?: string;
  remarks?: string;
  thickness_mm?: number;
}

export interface EstimateLineUpdate {
  description?: string;
  quantity?: string;
  unit_price?: string;
  discount_pct?: string;
  remarks?: string;
}

export const estimateService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    party_id?: string;
    status?: string;
    is_billed?: boolean;
  }): Promise<Estimate[]> => {
    const res = await api.get<Estimate[] | PaginatedResponse<Estimate>>(
      ESTIMATES.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Estimate>(ESTIMATES.DETAIL(id)),

  create: (data: EstimateCreate) =>
    api.post<Estimate>(ESTIMATES.LIST, data),

  update: (id: string, data: EstimateUpdate) =>
    api.patch<Estimate>(ESTIMATES.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(ESTIMATES.DETAIL(id)),

  /** Post (dispatch) the estimate. Server creates OUT stock movements
   *  at the source location (no ledger impact — estimate is not a tax
   *  document; the linked invoice handles ledger when promoted). */
  post: (id: string) => api.post<Estimate>(ESTIMATES.POST(id)),

  /** Cancel a posted estimate. Reverses the OUT movements. If a
   *  linked invoice exists, the server returns 409 — cancel the
   *  invoice first, which unlinks. */
  cancel: (id: string, reason?: string) =>
    api.post<Estimate>(ESTIMATES.CANCEL(id), { reason }),

  // ── Lines ─────────────────────────────────────────────
  listLines: async (estimateId: string): Promise<EstimateLine[]> => {
    const res = await api.get<EstimateLine[] | PaginatedResponse<EstimateLine>>(
      ESTIMATES.LINES(estimateId),
    );
    return unwrapList(res);
  },

  createLine: (estimateId: string, data: EstimateLineCreate) =>
    api.post<EstimateLine>(ESTIMATES.LINES(estimateId), data),

  updateLine: (estimateId: string, lineId: string, data: EstimateLineUpdate) =>
    api.patch<EstimateLine>(ESTIMATES.LINE(estimateId, lineId), data),

  deleteLine: (estimateId: string, lineId: string) =>
    api.delete<void>(ESTIMATES.LINE(estimateId, lineId)),

  /** Promote a posted, unbilled estimate into a draft invoice.
   *  Server creates the Invoice with `estimate_id` linked, copies the
   *  lines (adding GST math from item defaults + tenant/customer
   *  state), and flips the estimate's `is_billed=true` + `invoice_id`.
   *  Returns both records so the FE can navigate to the new invoice. */
  promoteToInvoice: (id: string) =>
    api.post<{ estimate: Estimate; invoice: Invoice }>(ESTIMATES.PROMOTE(id)),
};

// ── Routes (sales territories) ────────────────────────────
export const routeService = {
  list: async (params?: { limit?: number; cursor?: string }): Promise<Route[]> => {
    const res = await api.get<Route[] | PaginatedResponse<Route>>(ROUTES.LIST, params);
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Route>(ROUTES.DETAIL(id)),

  create: (data: { code: string; name: string; is_active?: boolean }) =>
    api.post<Route>(ROUTES.LIST, data),

  update: (id: string, data: Partial<{ name: string; is_active: boolean }>) =>
    api.patch<Route>(ROUTES.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(ROUTES.DETAIL(id)),
};
