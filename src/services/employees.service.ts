import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { EMPLOYEES } from "@/lib/api-constants";
import type { Employee, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Employees service.
//
// Minimal entity for Phase 3: name, role (free text), monthly salary,
// optional User link, payment account. The backend auto-creates an
// `employee_float` FinancialAccount on insert and stores its id on
// employee.float_account_id.
//
// Used heavily by GPay/UPI receipts where the customer paid the
// salesman personally rather than the company account — that money
// lands in the employee's float, and gets net-settled on salary day.
//
// Full SalaryRule + monthly auto-debit cron is deferred to Phase 3.5.
// ═══════════════════════════════════════════════════════════════════

export interface EmployeeCreate {
  name: string;
  role: string;
  monthly_salary: string;
  phone?: string;
  email?: string;
  user_id?: string;
  payment_account_id?: string;
  joined_at: string;            // YYYY-MM-DD
}

export interface EmployeeUpdate {
  name?: string;
  role?: string;
  monthly_salary?: string;
  phone?: string;
  email?: string;
  user_id?: string;
  payment_account_id?: string;
  is_active?: boolean;
}

export const employeeService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    is_active?: boolean;
  }): Promise<Employee[]> => {
    const res = await api.get<Employee[] | PaginatedResponse<Employee>>(
      EMPLOYEES.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Employee>(EMPLOYEES.DETAIL(id)),

  create: (data: EmployeeCreate) =>
    api.post<Employee>(EMPLOYEES.LIST, data),

  update: (id: string, data: EmployeeUpdate) =>
    api.patch<Employee>(EMPLOYEES.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(EMPLOYEES.DETAIL(id)),
};
