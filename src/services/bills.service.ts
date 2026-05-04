import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { BILLS } from "@/lib/api-constants";
import type {
  PaginatedResponse,
  VendorBill,
  VendorBillLine,
  VendorBillStatus,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Vendor Bills service.
//
// AP-side mirror of invoices.service.ts. Same shape, same state
// machine. Critical difference: vendor bills are FINANCIAL ONLY —
// posting does NOT create stock IN movements. Stock-in flow goes
// through GRN/PO. A bill is the supplier's paper invoice entered
// into our books for the AR/AP-and-GST side of accounting.
// ═══════════════════════════════════════════════════════════════════

export interface VendorBillCreate {
  bill_number?: string;              // server-allocates if absent
  supplier_invoice_number?: string;  // the supplier's own number from their paper
  bill_date: string;                 // YYYY-MM-DD
  due_date?: string;
  party_id: string;                  // vendor — supplier or both
  place_of_supply: string;           // 2-digit state code
  remarks?: string;
}

export interface VendorBillUpdate {
  supplier_invoice_number?: string;
  bill_date?: string;
  due_date?: string;
  party_id?: string;
  place_of_supply?: string;
  remarks?: string;
}

export interface VendorBillLineCreate {
  item_id?: string;
  hsn_code?: string;
  description: string;
  uom_id?: string;
  quantity: string;
  unit_price: string;
  discount_pct?: string;
  rate_pct: string;
  cess_pct?: string;
  expense_account_id?: string;
  remarks?: string;
}

export interface VendorBillLineUpdate {
  hsn_code?: string;
  description?: string;
  quantity?: string;
  unit_price?: string;
  discount_pct?: string;
  rate_pct?: string;
  cess_pct?: string;
  expense_account_id?: string;
  remarks?: string;
}

export const billService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    party_id?: string;
    status?: VendorBillStatus;
    /** Convenience filter for "what's pending payment". Backend
     *  interpretation: status='posted' AND allocated_amount < grand_total. */
    unpaid?: boolean;
    start_date?: string;
    end_date?: string;
  }): Promise<VendorBill[]> => {
    const res = await api.get<VendorBill[] | PaginatedResponse<VendorBill>>(
      BILLS.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<VendorBill>(BILLS.DETAIL(id)),

  create: (data: VendorBillCreate) =>
    api.post<VendorBill>(BILLS.LIST, data),

  update: (id: string, data: VendorBillUpdate) =>
    api.patch<VendorBill>(BILLS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(BILLS.DETAIL(id)),

  /** Post (lock + write ledger). Server creates paired entries:
   *  Dr. expense (or per-line override), Dr. gst_input, Cr. party_payable.
   *  No stock movement — that's the GRN's job.
   *  Idempotent: re-posting → 409 BILL_NOT_DRAFT. */
  post: (id: string) => api.post<VendorBill>(BILLS.POST(id)),

  /** Cancel a posted bill. Reverses the ledger entries + drops any
   *  payment_allocations (the corresponding payments unallocate). */
  cancel: (id: string, reason?: string) =>
    api.post<VendorBill>(BILLS.CANCEL(id), { reason }),

  // ── Lines ─────────────────────────────────────────────
  listLines: async (billId: string): Promise<VendorBillLine[]> => {
    const res = await api.get<VendorBillLine[] | PaginatedResponse<VendorBillLine>>(
      BILLS.LINES(billId),
    );
    return unwrapList(res);
  },

  createLine: (billId: string, data: VendorBillLineCreate) =>
    api.post<VendorBillLine>(BILLS.LINES(billId), data),

  updateLine: (billId: string, lineId: string, data: VendorBillLineUpdate) =>
    api.patch<VendorBillLine>(BILLS.LINE(billId, lineId), data),

  deleteLine: (billId: string, lineId: string) =>
    api.delete<void>(BILLS.LINE(billId, lineId)),
};
