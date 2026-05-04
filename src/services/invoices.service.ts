import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { INVOICES } from "@/lib/api-constants";
import type {
  Invoice,
  InvoiceLine,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Invoices service.
//
// Convention mirrors documents.service.ts: list returns plain T[]
// regardless of whether backend ships an envelope or array (unwrapList
// handles both). Lines are a sub-resource. Post + Cancel are explicit
// state-machine actions, not generic PATCH operations.
//
// All methods route to the inventory service (:8001).
// ═══════════════════════════════════════════════════════════════════

export interface InvoiceCreate {
  invoice_number?: string;       // server-generates from number_series if omitted
  invoice_date: string;          // YYYY-MM-DD
  due_date?: string;
  party_id: string;
  place_of_supply: string;       // 2-digit state code
  /** Optional source challan id. When set, the server should:
   *  1. Validate the challan is posted, unbilled, and belongs to
   *     the same party as `party_id`.
   *  2. Mark the challan `is_billed=true` and set `invoice_id` to
   *     this new invoice on success.
   *  3. Reject with 409 CHALLAN_ALREADY_BILLED if the challan is
   *     already linked to another invoice.
   */
  challan_id?: string;
  remarks?: string;
}

export interface InvoiceUpdate {
  invoice_date?: string;
  due_date?: string;
  party_id?: string;
  place_of_supply?: string;
  remarks?: string;
}

export interface InvoiceLineCreate {
  item_id: string;
  hsn_code: string;
  description?: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct?: string;
  rate_pct: string;              // GST rate, e.g. "18"
  cess_pct?: string;
  remarks?: string;
}

export interface InvoiceLineUpdate {
  hsn_code?: string;
  description?: string;
  quantity?: string;
  unit_price?: string;
  discount_pct?: string;
  rate_pct?: string;
  cess_pct?: string;
  remarks?: string;
}

export const invoiceService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    party_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Invoice[]> => {
    const res = await api.get<Invoice[] | PaginatedResponse<Invoice>>(
      INVOICES.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Invoice>(INVOICES.DETAIL(id)),

  create: (data: InvoiceCreate) =>
    api.post<Invoice>(INVOICES.LIST, data),

  update: (id: string, data: InvoiceUpdate) =>
    api.patch<Invoice>(INVOICES.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(INVOICES.DETAIL(id)),

  /** Post (lock) the invoice. Server creates OUT stock movements,
   *  writes ledger entries, and assigns the IRN if e-Invoice is
   *  configured. Idempotent: re-posting a posted invoice 4xxs. */
  post: (id: string) => api.post<Invoice>(INVOICES.POST(id)),

  /** Cancel a posted invoice. Server creates reversal movements
   *  and ledger reversals. Original invoice stays in the audit
   *  trail with status="cancelled". */
  cancel: (id: string, reason?: string) =>
    api.post<Invoice>(INVOICES.CANCEL(id), { reason }),

  // ── Lines ─────────────────────────────────────────────
  listLines: async (invoiceId: string): Promise<InvoiceLine[]> => {
    const res = await api.get<InvoiceLine[] | PaginatedResponse<InvoiceLine>>(
      INVOICES.LINES(invoiceId),
    );
    return unwrapList(res);
  },

  createLine: (invoiceId: string, data: InvoiceLineCreate) =>
    api.post<InvoiceLine>(INVOICES.LINES(invoiceId), data),

  updateLine: (invoiceId: string, lineId: string, data: InvoiceLineUpdate) =>
    api.patch<InvoiceLine>(INVOICES.LINE(invoiceId, lineId), data),

  deleteLine: (invoiceId: string, lineId: string) =>
    api.delete<void>(INVOICES.LINE(invoiceId, lineId)),
};
