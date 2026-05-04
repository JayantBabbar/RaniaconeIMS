import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { EXPENSES, EXPENSE_CATEGORIES } from "@/lib/api-constants";
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Expenses service.
//
// One-row vouchers — no lines. Each expense hits one
// expense_category account on debit and a cash/bank/gpay account
// on credit. Categories are tenant-customisable master data; each
// category has its own auto-created expense_category financial
// account so reporting can roll up cleanly.
// ═══════════════════════════════════════════════════════════════════

export interface ExpenseCreate {
  expense_number?: string;     // server-allocates if absent
  expense_date: string;        // YYYY-MM-DD
  category_id: string;
  amount: string;
  paid_from_account_id: string;  // cash / bank / gpay account
  vendor_id?: string;            // optional — for "petrol bill paid to BPCL"
  description: string;
  attachment_id?: string;        // optional bill photo
}

export interface ExpenseUpdate {
  expense_date?: string;
  category_id?: string;
  amount?: string;
  paid_from_account_id?: string;
  vendor_id?: string;
  description?: string;
  attachment_id?: string;
}

export const expenseService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    category_id?: string;
    status?: ExpenseStatus;
    start_date?: string;
    end_date?: string;
  }): Promise<Expense[]> => {
    const res = await api.get<Expense[] | PaginatedResponse<Expense>>(
      EXPENSES.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Expense>(EXPENSES.DETAIL(id)),

  create: (data: ExpenseCreate) =>
    api.post<Expense>(EXPENSES.LIST, data),

  update: (id: string, data: ExpenseUpdate) =>
    api.patch<Expense>(EXPENSES.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(EXPENSES.DETAIL(id)),

  /** Post: Dr. expense_category[category], Cr. paid_from_account. */
  post: (id: string) => api.post<Expense>(EXPENSES.POST(id)),

  /** Cancel: paired reversal entries with same group_id. */
  cancel: (id: string, reason?: string) =>
    api.post<Expense>(EXPENSES.CANCEL(id), { reason }),
};

// ── Expense Categories (master data) ─────────────────────────────

export interface ExpenseCategoryCreate {
  code: string;
  name: string;
  is_capital?: boolean;
}

export interface ExpenseCategoryUpdate {
  name?: string;
  is_capital?: boolean;
  is_active?: boolean;
}

export const expenseCategoryService = {
  list: async (params?: { limit?: number; cursor?: string; is_active?: boolean }): Promise<ExpenseCategory[]> => {
    const res = await api.get<ExpenseCategory[] | PaginatedResponse<ExpenseCategory>>(
      EXPENSE_CATEGORIES.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<ExpenseCategory>(EXPENSE_CATEGORIES.DETAIL(id)),

  /** On insert the server auto-creates an expense_category financial
   *  account and stores its id on category.expense_account_id. */
  create: (data: ExpenseCategoryCreate) =>
    api.post<ExpenseCategory>(EXPENSE_CATEGORIES.LIST, data),

  update: (id: string, data: ExpenseCategoryUpdate) =>
    api.patch<ExpenseCategory>(EXPENSE_CATEGORIES.DETAIL(id), data),

  /** Soft delete only when the category has no posted expenses. */
  delete: (id: string) => api.delete<void>(EXPENSE_CATEGORIES.DETAIL(id)),
};
