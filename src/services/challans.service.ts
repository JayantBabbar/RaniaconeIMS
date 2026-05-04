import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { CHALLANS, ROUTES } from "@/lib/api-constants";
import type {
  Challan,
  ChallanLine,
  ChallanPrintMode,
  Invoice,
  PaginatedResponse,
  Route,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Challans service.
//
// Mirrors invoices.service.ts but for delivery notes (no GST math).
// Adds one extra action — promote-to-invoice — that returns both
// the updated challan and the newly-created invoice stub.
// ═══════════════════════════════════════════════════════════════════

export interface ChallanCreate {
  challan_number?: string;
  challan_date: string;            // YYYY-MM-DD
  party_id: string;
  route_id?: string;
  source_location_id?: string;
  destination_address?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  is_billed?: boolean;             // default false
  print_mode?: ChallanPrintMode;   // default "no_amount"
  remarks?: string;
}

export interface ChallanUpdate {
  challan_date?: string;
  party_id?: string;
  route_id?: string | null;
  source_location_id?: string;
  destination_address?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  is_billed?: boolean;
  print_mode?: ChallanPrintMode;
  remarks?: string;
}

export interface ChallanLineCreate {
  item_id: string;
  description?: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct?: string;
  remarks?: string;
}

export interface ChallanLineUpdate {
  description?: string;
  quantity?: string;
  unit_price?: string;
  discount_pct?: string;
  remarks?: string;
}

export const challanService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    party_id?: string;
    status?: string;
    is_billed?: boolean;
  }): Promise<Challan[]> => {
    const res = await api.get<Challan[] | PaginatedResponse<Challan>>(
      CHALLANS.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Challan>(CHALLANS.DETAIL(id)),

  create: (data: ChallanCreate) =>
    api.post<Challan>(CHALLANS.LIST, data),

  update: (id: string, data: ChallanUpdate) =>
    api.patch<Challan>(CHALLANS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(CHALLANS.DETAIL(id)),

  /** Post (dispatch) the challan. Server creates OUT stock movements
   *  at the source location (no ledger impact — challan is not a tax
   *  document; the linked invoice handles ledger when promoted). */
  post: (id: string) => api.post<Challan>(CHALLANS.POST(id)),

  /** Cancel a posted challan. Reverses the OUT movements. If a
   *  linked invoice exists, the server returns 409 — cancel the
   *  invoice first, which unlinks. */
  cancel: (id: string, reason?: string) =>
    api.post<Challan>(CHALLANS.CANCEL(id), { reason }),

  // ── Lines ─────────────────────────────────────────────
  listLines: async (challanId: string): Promise<ChallanLine[]> => {
    const res = await api.get<ChallanLine[] | PaginatedResponse<ChallanLine>>(
      CHALLANS.LINES(challanId),
    );
    return unwrapList(res);
  },

  createLine: (challanId: string, data: ChallanLineCreate) =>
    api.post<ChallanLine>(CHALLANS.LINES(challanId), data),

  updateLine: (challanId: string, lineId: string, data: ChallanLineUpdate) =>
    api.patch<ChallanLine>(CHALLANS.LINE(challanId, lineId), data),

  deleteLine: (challanId: string, lineId: string) =>
    api.delete<void>(CHALLANS.LINE(challanId, lineId)),

  /** Promote a posted, unbilled challan into a draft invoice.
   *  Server creates the Invoice with `challan_id` linked, copies the
   *  lines (adding GST math from item defaults + tenant/customer
   *  state), and flips the challan's `is_billed=true` + `invoice_id`.
   *  Returns both records so the FE can navigate to the new invoice. */
  promoteToInvoice: (id: string) =>
    api.post<{ challan: Challan; invoice: Invoice }>(CHALLANS.PROMOTE(id)),
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
