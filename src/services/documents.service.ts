import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { DOCUMENTS } from "@/lib/api-constants";
import type {
  DocumentHeader,
  DocumentLine,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════
// Documents Service — headers, lines, post, cancel.
// Backend returns plain JSON arrays for /documents and
// /documents/{id}/lines (not the PaginatedResponse envelope).
// unwrapList() handles both shapes for forward compatibility.
// ═══════════════════════════════════════════════════════════

export const documentService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    document_type_id?: string;
    party_id?: string;
    posted?: boolean;
    start_date?: string;
    end_date?: string;
  }): Promise<DocumentHeader[]> => {
    const res = await api.get<DocumentHeader[] | PaginatedResponse<DocumentHeader>>(
      DOCUMENTS.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<DocumentHeader>(DOCUMENTS.DETAIL(id)),

  create: (data: {
    document_type_id: string;
    document_number?: string;
    document_date: string;
    party_id?: string;
    source_location_id?: string;
    destination_location_id?: string;
    currency_id?: string;
    exchange_rate?: string;
    status_id?: string;
    remarks?: string;
    /** Optional link to a parent document. On a GRN, this is the
     *  source PO (NULL for direct receipts). On an Invoice, this is
     *  the source SO/Challan. */
    source_doc_id?: string | null;
  }) => api.post<DocumentHeader>(DOCUMENTS.LIST, data),

  update: (
    id: string,
    data: Partial<{
      document_date: string;
      party_id: string;
      source_location_id: string;
      destination_location_id: string;
      remarks: string;
    }>
  ) => api.patch<DocumentHeader>(DOCUMENTS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(DOCUMENTS.DETAIL(id)),

  post: (id: string) => api.post<DocumentHeader>(DOCUMENTS.POST(id)),
  cancel: (id: string) => api.post<DocumentHeader>(DOCUMENTS.CANCEL(id)),

  /** Phase 10 — promote a posted Sales Order to a tax Invoice.
   *  Backend creates the Invoice with `source_doc_id = <SO>`, copies
   *  lines (adding GST math from item.default_tax_rate_pct), and
   *  flips the SO's `is_promoted=true`, `invoice_id=<new id>`. */
  promoteToInvoice: (id: string) =>
    api.post<{ invoice_id: string; invoice_number: string }>(
      DOCUMENTS.PROMOTE_TO_INVOICE(id),
    ),

  // Lines
  listLines: async (documentId: string): Promise<DocumentLine[]> => {
    const res = await api.get<DocumentLine[] | PaginatedResponse<DocumentLine>>(
      DOCUMENTS.LINES(documentId),
    );
    return unwrapList(res);
  },

  createLine: (
    documentId: string,
    data: {
      item_id: string;
      uom_id: string;
      quantity: string;
      unit_price: string;
      line_number?: number;
      discount_pct?: string;
      tax_amount?: string;
      lot_id?: string;
      /** Convenience for GRN — supplier's batch number or an internal
       *  lot ID. Backend resolves to a Lot row (creates one if new)
       *  and sets line.lot_id. Required when item.is_batch_tracked. */
      lot_number?: string;
      serial_id?: string;
      bin_id?: string;
      remarks?: string;
      /** Phase 13 — dimension snapshot. Backend uses these to
       *  resolve the active pricing rule and populate unit_price
       *  on lines that don't supply one. */
      thickness_mm?: number;
      size_code?: string;
    }
  ) => api.post<DocumentLine>(DOCUMENTS.LINES(documentId), data),

  updateLine: (
    documentId: string,
    lineId: string,
    data: Partial<{
      quantity: string;
      unit_price: string;
      discount_pct: string;
      tax_amount: string;
      remarks: string;
    }>
  ) => api.patch<DocumentLine>(DOCUMENTS.LINE(documentId, lineId), data),

  deleteLine: (documentId: string, lineId: string) =>
    api.delete<void>(DOCUMENTS.LINE(documentId, lineId)),
};
