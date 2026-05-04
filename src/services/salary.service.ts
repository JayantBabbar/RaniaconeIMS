import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { SALARY } from "@/lib/api-constants";
import type {
  PaginatedResponse,
  SalaryEntry,
  SalaryStatus,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Salary service.
//
// Manual monthly salary voucher per employee. Closes the float-as-
// salary-deduction loop (Phase 3 §2): when the salesman has been
// receiving customer GPays personally, that float gets net-settled
// here.
//
//   net_paid = gross_salary − float_held
//
// On post:
//   Dr. salary_expense                gross_salary
//   Cr. employee_float[employee]      float_held       (clears the float)
//   Cr. paid_from_account_id          net_paid          (cash leaves)
//
// Cron-driven monthly auto-debit is deferred to Phase 4. For now,
// salary day = an accountant manually creating + posting one of
// these vouchers per active employee.
// ═══════════════════════════════════════════════════════════════════

export interface SalaryEntryCreate {
  salary_number?: string;          // server-allocates if absent
  /** Always 1st of the month for grouping; server normalises. */
  period_month: string;            // YYYY-MM-01
  employee_id: string;
  /** Gross salary the employee should earn. Defaults from
   *  Employee.monthly_salary; can be overridden for bonus / partial. */
  gross_salary: string;
  /** Float held — read from employee_float account at submit time
   *  by the form; server validates it equals current_balance. */
  float_held: string;
  /** Where the net comes from. */
  paid_from_account_id: string;
  remarks?: string;
}

export interface SalaryEntryUpdate {
  period_month?: string;
  gross_salary?: string;
  float_held?: string;
  paid_from_account_id?: string;
  remarks?: string;
}

export const salaryService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    employee_id?: string;
    status?: SalaryStatus;
    period_month?: string;        // YYYY-MM-01
  }): Promise<SalaryEntry[]> => {
    const res = await api.get<SalaryEntry[] | PaginatedResponse<SalaryEntry>>(
      SALARY.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<SalaryEntry>(SALARY.DETAIL(id)),

  create: (data: SalaryEntryCreate) =>
    api.post<SalaryEntry>(SALARY.LIST, data),

  update: (id: string, data: SalaryEntryUpdate) =>
    api.patch<SalaryEntry>(SALARY.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(SALARY.DETAIL(id)),

  /** Post — writes the three-row ledger entry. Server re-validates
   *  float_held matches the employee_float balance at post time and
   *  fails 422 SALARY_FLOAT_DRIFT if they disagree (something else
   *  posted between draft creation and post). */
  post: (id: string) => api.post<SalaryEntry>(SALARY.POST(id)),

  /** Cancel — reverses the three entries (employee gets the float back). */
  cancel: (id: string, reason?: string) =>
    api.post<SalaryEntry>(SALARY.CANCEL(id), { reason }),
};
