import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { AUDIT_LOG } from "@/lib/api-constants";
import type { AuditLogEntry, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Audit log service — Phase 9 (REQ-13).
//
// Read-only view over backend's audit_log table. Backend writes one
// row per critical action; the FE just lists them with filters.
//
// Filter contract:
//   user_id     — single-user filter
//   action      — exact match or prefix (e.g. "invoice." catches all)
//   entity_type — narrow by table (e.g. "invoice", "salary_entry")
//   start_date  — inclusive YYYY-MM-DD
//   end_date    — inclusive YYYY-MM-DD
// ═══════════════════════════════════════════════════════════════════

type AuditLogFilters = {
  user_id?: string;
  action?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
} & Record<string, unknown>;

export const auditLogService = {
  list: async (params?: AuditLogFilters): Promise<AuditLogEntry[]> => {
    const res = await api.get<AuditLogEntry[] | PaginatedResponse<AuditLogEntry>>(
      AUDIT_LOG.LIST,
      params,
    );
    return unwrapList(res);
  },
};
