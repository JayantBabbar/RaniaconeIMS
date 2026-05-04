import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { LEDGER } from "@/lib/api-constants";
import type {
  LedgerEntry,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Ledger service (read-only views into the double-entry ledger).
//
// All writes go through the modules that create them: payments,
// invoices (post + cancel), cheque deposits, opening-balance imports,
// salary debits. There is intentionally no `createEntry` endpoint —
// users don't write raw journal entries from the UI.
// ═══════════════════════════════════════════════════════════════════

/** Aggregate balances for the /money landing-page tiles. */
export interface LedgerSummary {
  cash_in_hand: string;
  bank: string;
  cheque_in_transit: string;
  gpay: string;
  total_receivable: string;       // sum across all party_receivable
  total_payable: string;          // sum across all party_payable
  employee_float: string;         // sum across all employee_float
  /** Phase 3.5 — sum of outstanding (grand_total − allocated_amount)
   *  on posted vendor_bills, for the "Pending bills" tile. */
  vendor_bills_pending?: string;
  /** Most-recent entry timestamp in the tenant's ledger — useful
   *  for "as of" labels on tiles. */
  as_of: string;
}

/** Per-party ledger row. The backend joins ledger_entries to the
 *  party's receivable+payable accounts; rows are ordered ascending
 *  by entry_date with running balance. */
export interface PartyLedgerRow extends LedgerEntry {
  /** What kind of source doc this entry came from, in plain English
   *  (e.g. "Invoice INV/2026-04/0001", "Receipt RV/2026-04/0007"). */
  source_label: string;
}

export const ledgerService = {
  /** Per-account journal — every entry against this account. */
  listAccountEntries: async (
    accountId: string,
    params?: { limit?: number; cursor?: string; start_date?: string; end_date?: string },
  ): Promise<LedgerEntry[]> => {
    const res = await api.get<LedgerEntry[] | PaginatedResponse<LedgerEntry>>(
      LEDGER.ACCOUNT(accountId),
      params,
    );
    return unwrapList(res);
  },

  /** Per-party ledger — convenience aggregation across that party's
   *  receivable + payable accounts. Used on /parties/[id]?tab=ledger. */
  listPartyEntries: async (
    partyId: string,
    params?: { limit?: number; cursor?: string; start_date?: string; end_date?: string },
  ): Promise<PartyLedgerRow[]> => {
    const res = await api.get<PartyLedgerRow[] | PaginatedResponse<PartyLedgerRow>>(
      LEDGER.PARTY(partyId),
      params,
    );
    return unwrapList(res);
  },

  /** Money landing-page tiles. Cheap server-side rollup of
   *  FinancialAccount.current_balance by type. */
  getSummary: () => api.get<LedgerSummary>(LEDGER.SUMMARY),
};
