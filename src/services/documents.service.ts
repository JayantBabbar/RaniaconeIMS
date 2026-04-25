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
      serial_id?: string;
      bin_id?: string;
      remarks?: string;
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
