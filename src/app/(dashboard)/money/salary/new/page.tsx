"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { employeeService } from "@/services/employees.service";
import { accountService } from "@/services/accounts.service";
import { salaryService } from "@/services/salary.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// New Salary Entry — the screen that closes the float-as-salary
// loop. Pick an employee → form auto-loads gross + their current
// float → net = gross − float. Post writes the three-row entry.
// ═══════════════════════════════════════════════════════════

const inputClass =
  "w-full px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function NewSalaryPage() {
  return (
    <RequireRead perm="inventory.salary.write">
      <NewSalaryForm />
    </RequireRead>
  );
}

function NewSalaryForm() {
  const router = useRouter();
  const toast = useToast();

  const [periodMonth, setPeriodMonth] = useState(firstOfMonth());
  const [employeeId, setEmployeeId] = useState("");
  const [grossSalary, setGrossSalary] = useState("");
  const [paidFromId, setPaidFromId] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: emps } = useQuery({
    queryKey: ["employees", { is_active: true }],
    queryFn: () => employeeService.list({ is_active: true, limit: 200 }),
  });
  const employees = (emps ?? []).filter((e) => e.is_active);

  const { data: accs } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list({ limit: 200 }),
  });
  const accountById = new Map((accs ?? []).map((a) => [a.id, a]));
  const eligibleAccounts = (accs ?? []).filter((a) => ["cash_in_hand", "bank", "gpay"].includes(a.type) && a.is_active);

  // Auto-pull gross + float when employee changes
  const selectedEmp = employees.find((e) => e.id === employeeId);
  const floatAccount = selectedEmp ? accountById.get(selectedEmp.float_account_id) : undefined;
  const floatHeld = floatAccount ? Number(floatAccount.current_balance).toFixed(2) : "0.00";
  const netPaid = (Number(grossSalary || 0) - Number(floatHeld || 0)).toFixed(2);

  useEffect(() => {
    if (selectedEmp) {
      setGrossSalary(selectedEmp.monthly_salary);
      if (selectedEmp.payment_account_id) setPaidFromId(selectedEmp.payment_account_id);
    }
  }, [selectedEmp]);

  const create = useMutation({
    mutationFn: () => salaryService.create({
      period_month: periodMonth,
      employee_id: employeeId,
      gross_salary: grossSalary,
      float_held: floatHeld,
      paid_from_account_id: paidFromId,
      remarks: remarks || undefined,
    }),
    onSuccess: (s) => {
      toast.success(`Salary ${s.salary_number ?? "drafted"}`);
      router.push("/money/salary");
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not create"),
  });

  const canSubmit = !!employeeId && Number(grossSalary) > 0 && Number(netPaid) >= 0 && !!paidFromId;

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title="New salary entry"
          description="Pay an employee's monthly salary. The form pre-fills their gross + the float they're holding; net pay = gross − float."
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Period (month)" required>
              <Input type="date" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            </FormField>
            <FormField label="Employee" required>
              <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">— select employee —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
              </select>
            </FormField>
          </div>

          {selectedEmp && (
            <>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <FormField label="Gross salary (₹)" required>
                  <Input type="number" step="0.01" min="0" value={grossSalary} onChange={(e) => setGrossSalary(e.target.value)} />
                </FormField>
                <FormField label="Float held" hint="From employee's float account — read-only">
                  <Input value={formatCurrency(floatHeld, "INR", "en-IN")} disabled />
                </FormField>
                <FormField label="Net pay (₹)" hint="gross − float">
                  <Input value={formatCurrency(netPaid, "INR", "en-IN")} disabled className="font-semibold" />
                </FormField>
              </div>

              {Number(floatHeld) > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60">
                  {selectedEmp.name} is holding {formatCurrency(floatHeld, "INR", "en-IN")} from customer GPays. Posting this voucher clears that float and pays them only the difference.
                </div>
              )}

              <FormField label="Paid from" required>
                <select className={inputClass} value={paidFromId} onChange={(e) => setPaidFromId(e.target.value)}>
                  <option value="">— select —</option>
                  {eligibleAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </FormField>
              <FormField label="Remarks">
                <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
              </FormField>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button kind="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button kind="primary" onClick={() => canSubmit && create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? <Spinner size={14} /> : "Save as draft"}
          </Button>
        </div>
      </div>
    </>
  );
}
