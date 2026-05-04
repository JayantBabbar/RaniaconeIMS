import { api } from "@/lib/api-client";
import { SALARY } from "@/lib/api-constants";
import type {
  PayrollBatchSummary,
  PayrollBatchPostResponse,
  PayslipData,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Payroll service — Phase 6 (REQ-10).
//
// Three operations beyond what `salary.service.ts` already covers:
//
//   getBatch(period)     — list all employees + their draft salary
//                          entry for the period (entries may be null
//                          for newly-hired employees).
//
//   generateBatch(period) — idempotent. Creates draft salary entries
//                          for any active employee that doesn't yet
//                          have one for that period. Pre-fills
//                          gross_salary from Employee.salary_amount
//                          and float_held from current employee_float.
//
//   postBatch(period)    — atomic bulk post. Per-entry float-drift
//                          re-validation runs; any drift fails the
//                          whole batch with the offending entries
//                          listed in `drift_entries`.
//
//   getPayslip(salaryId) — hydrated view for the printable layout.
//                          Joins SalaryEntry → Employee → Tenant.
//
// Production wires `generateBatch` to a cron at 02:00 IST on the 1st
// of each month. The FE button is the manual override / first-run
// path before the cron is on.
// ═══════════════════════════════════════════════════════════════════

interface BatchPayload {
  period: string;   // YYYY-MM
  [key: string]: unknown;
}

export const payrollService = {
  getBatch: (period: string) =>
    api.get<PayrollBatchSummary>(SALARY.BATCH, { period }),

  generateBatch: (payload: BatchPayload) =>
    api.post<PayrollBatchSummary>(SALARY.BATCH_GENERATE, payload),

  postBatch: (payload: BatchPayload) =>
    api.post<PayrollBatchPostResponse>(SALARY.BATCH_POST, payload),

  getPayslip: (salaryId: string) =>
    api.get<PayslipData>(SALARY.PAYSLIP(salaryId)),
};
