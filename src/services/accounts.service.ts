import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { ACCOUNTS } from "@/lib/api-constants";
import type {
  AccountType,
  FinancialAccount,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Financial Accounts service (Chart of Accounts).
//
// System accounts (cash/bank/cheque/gpay/per-party/per-employee/
// sales_income/gst_output) are auto-created by the backend on tenant
// provisioning + on Party/Employee insert. Tenants can rename them
// but not delete them. Custom accounts (`type='manual'`) are full
// CRUD.
//
// `current_balance` is denormalised — every ledger write updates it
// in the same transaction. Don't sum from the FE.
// ═══════════════════════════════════════════════════════════════════

export interface AccountCreate {
  type: AccountType;
  code: string;
  name: string;
  party_id?: string;
  employee_id?: string;
  account_number?: string;
  ifsc?: string;
  opening_balance?: string;        // default "0"
}

export interface AccountUpdate {
  name?: string;
  account_number?: string;
  ifsc?: string;
  is_active?: boolean;
}

export const accountService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    type?: AccountType;
    party_id?: string;
    employee_id?: string;
    is_active?: boolean;
  }): Promise<FinancialAccount[]> => {
    const res = await api.get<FinancialAccount[] | PaginatedResponse<FinancialAccount>>(
      ACCOUNTS.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<FinancialAccount>(ACCOUNTS.DETAIL(id)),

  create: (data: AccountCreate) =>
    api.post<FinancialAccount>(ACCOUNTS.LIST, data),

  update: (id: string, data: AccountUpdate) =>
    api.patch<FinancialAccount>(ACCOUNTS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(ACCOUNTS.DETAIL(id)),
};
