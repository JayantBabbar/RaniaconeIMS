import { api } from "@/lib/api-client";
import { REPORTS } from "@/lib/api-constants";
import type {
  SalesRegisterResponse,
  PurchaseRegisterResponse,
  AgingResponse,
  ProfitLossResponse,
  CashFlowResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Reports service — Phase 4 (REQ-8).
//
// Every method returns a *server-aggregated* response. The FE never
// computes totals from raw rows. Pages render rows + totals straight
// out of the response so what the user sees on screen is exactly
// what would print on a PDF of the same report.
//
// Filter contract:
//   start_date / end_date — inclusive YYYY-MM-DD range (registers, P&L)
//   as_of                 — snapshot date for aging (defaults to today)
//   party_id              — single-party filter on either side
//   state_code            — 2-digit GST state code (registers only)
// ═══════════════════════════════════════════════════════════════════

type RegisterFilters = {
  start_date?: string;
  end_date?: string;
  party_id?: string;
  state_code?: string;
} & Record<string, unknown>;

type AgingFilters = {
  as_of?: string;
  party_id?: string;
} & Record<string, unknown>;

type ProfitLossFilters = {
  start_date: string;
  end_date: string;
} & Record<string, unknown>;

export const reportsService = {
  /** Sales register — per-invoice rows with GST split + totals footer. */
  salesRegister: (params?: RegisterFilters) =>
    api.get<SalesRegisterResponse>(REPORTS.SALES_REGISTER, params),

  /** Purchase register — per-vendor-bill rows; mirrors sales register. */
  purchaseRegister: (params?: RegisterFilters) =>
    api.get<PurchaseRegisterResponse>(REPORTS.PURCHASE_REGISTER, params),

  /** Receivables bucketed 0-30 / 31-60 / 61-90 / 90+ days past `as_of`. */
  debtorsAging: (params?: AgingFilters) =>
    api.get<AgingResponse>(REPORTS.DEBTORS_AGING, params),

  /** Payables bucketed; mirror of debtors aging. */
  creditorsAging: (params?: AgingFilters) =>
    api.get<AgingResponse>(REPORTS.CREDITORS_AGING, params),

  /** P&L summary — revenue − cogs − expenses (by cat) − salary. */
  profitLoss: (params: ProfitLossFilters) =>
    api.get<ProfitLossResponse>(REPORTS.PROFIT_LOSS, params),

  /** Direct-method cash flow over a date range. */
  cashFlow: (params: ProfitLossFilters) =>
    api.get<CashFlowResponse>(REPORTS.CASH_FLOW, params),
};
