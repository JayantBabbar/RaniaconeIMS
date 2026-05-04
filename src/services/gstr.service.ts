import { api } from "@/lib/api-client";
import { REPORTS } from "@/lib/api-constants";
import type { Gstr1Response, Gstr3BResponse } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// GSTR service — Phase 5 (REQ-9).
//
// Both endpoints take a YYYY-MM "period" param; backend resolves
// it to the relevant filing period. Response shape matches the
// GSTN JSON portal spec so the same payload is downloadable as a
// filing-ready file.
//
// Filing periods (Indian tax calendar):
//   GSTR-1: 11th of following month (or 13th for QRMP filers)
//   GSTR-3B: 20th of following month
// ═══════════════════════════════════════════════════════════════════

interface GstrFilters {
  period: string;   // YYYY-MM (e.g. "2026-04")
  [key: string]: unknown;
}

export const gstrService = {
  gstr1:  (params: GstrFilters) => api.get<Gstr1Response>(REPORTS.GSTR_1, params),
  gstr3b: (params: GstrFilters) => api.get<Gstr3BResponse>(REPORTS.GSTR_3B, params),
};
