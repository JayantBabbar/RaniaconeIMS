import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { STOCK, LOTS, SERIALS } from "@/lib/api-constants";
import type { Balance, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Stock Service — Balances, Valuation, Reservations
// (Movements module removed 2026-05-14 — single-warehouse setup,
//  stock is tracked at the document/lot level only.)
// ═══════════════════════════════════════════════════════════

export interface ValuationLayer {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  lot_id?: string;
  movement_id: string;
  layer_date: string;
  qty_original: string;
  qty_remaining: string;
  unit_cost: string;
  total_cost: string;
  currency_id: string;
  exhausted: boolean;
  created_at: string;
}

export interface Reservation {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  lot_id?: string;
  quantity: string;
  status: "active" | "fulfilled" | "cancelled";
  reference_doc_id?: string;
  reference_doc_line_id?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  tenant_id: string;
  item_id: string;
  lot_number: string;
  mfg_date?: string;
  expiry_date?: string;
  supplier_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Serial {
  id: string;
  tenant_id: string;
  item_id: string;
  serial_number: string;
  status: string;
  location_id?: string;
  lot_id?: string;
  created_at: string;
  updated_at: string;
}

// ── Balances ───────────────────────────────────────────────
export const balanceService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    item_id?: string;
    location_id?: string;
    lot_id?: string;
    bin_id?: string;
    only_nonzero?: boolean;
  }): Promise<Balance[]> => {
    const res = await api.get<Balance[] | PaginatedResponse<Balance>>(
      STOCK.BALANCES,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Balance>(STOCK.BALANCE(id)),
};

// ── Valuation Layers ───────────────────────────────────────
export const valuationService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    item_id?: string;
    location_id?: string;
    only_active?: boolean;
  }): Promise<ValuationLayer[]> => {
    const res = await api.get<ValuationLayer[] | PaginatedResponse<ValuationLayer>>(
      STOCK.VALUATION_LAYERS,
      params,
    );
    return unwrapList(res);
  },
};

// ── Reservations ───────────────────────────────────────────
export const reservationService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    item_id?: string;
    location_id?: string;
    status?: string;
  }): Promise<Reservation[]> => {
    const res = await api.get<Reservation[] | PaginatedResponse<Reservation>>(
      STOCK.RESERVATIONS,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Reservation>(STOCK.RESERVATION(id)),

  create: (data: {
    item_id: string;
    location_id: string;
    quantity: string;
    lot_id?: string;
    reference_doc_id?: string;
    reference_doc_line_id?: string;
    remarks?: string;
  }) => api.post<Reservation>(STOCK.RESERVATIONS, data),

  update: (id: string, data: { status: "fulfilled" | "cancelled" }) =>
    api.patch<Reservation>(STOCK.RESERVATION(id), data),

  cancel: (id: string) => api.delete<void>(STOCK.RESERVATION(id)),
};

// ── Lots ───────────────────────────────────────────────────
export const lotService = {
  getById: (id: string) => api.get<Lot>(LOTS.DETAIL(id)),
};

// ── Serials ────────────────────────────────────────────────
export const serialService = {
  getById: (id: string) => api.get<Serial>(SERIALS.DETAIL(id)),
};
