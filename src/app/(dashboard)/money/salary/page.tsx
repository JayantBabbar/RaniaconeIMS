"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Can } from "@/components/ui/can";
import { salaryService } from "@/services/salary.service";
import { employeeService } from "@/services/employees.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, UserCircle } from "lucide-react";
import type { SalaryStatus } from "@/types";

const STATUS_TONES: Record<SalaryStatus, "gray" | "green" | "red" | "amber"> = {
  draft: "amber", posted: "green", cancelled: "red",
};

export default function SalaryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["salary"],
    queryFn: () => salaryService.list({ limit: 200 }),
  });
  const entries = data ?? [];

  const { data: emps } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeeService.list({ limit: 200 }),
  });
  const empById = new Map((emps ?? []).map((e) => [e.id, e]));

  return (
    <RequireRead perm="inventory.salary.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Salary"
          description="Monthly salary payouts. Net = gross − float held by the employee. The float (money the customer paid them personally) gets cleared automatically when you post."
          actions={
            <Can perm="inventory.salary.write">
              <Link href="/money/salary/new"><Button kind="primary"><Plus size={14} /> New salary entry</Button></Link>
            </Can>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<UserCircle size={20} />}
            title="No salary entries yet"
            description="Pay your first salary by creating a new entry — pick the employee, the period, and the form pre-fills gross and float."
            action={<Can perm="inventory.salary.write"><Link href="/money/salary/new"><Button kind="primary"><Plus size={14} /> New salary entry</Button></Link></Can>}
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Voucher #</th>
                  <th className="text-left px-3 py-2 font-medium">Period</th>
                  <th className="text-left px-3 py-2 font-medium">Employee</th>
                  <th className="text-right px-3 py-2 font-medium">Gross</th>
                  <th className="text-right px-3 py-2 font-medium">Float held</th>
                  <th className="text-right px-3 py-2 font-medium">Net paid</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-bg-hover">
                    <td className="px-3 py-2 font-mono text-[12px]">
                      <Link href={`/money/salary/${s.id}`} className="text-brand hover:underline">{s.salary_number}</Link>
                    </td>
                    <td className="px-3 py-2 text-text-tertiary">{formatDate(s.period_month).replace(/(\w+) (\d+),/, "$1")}</td>
                    <td className="px-3 py-2">{empById.get(s.employee_id)?.name ?? s.employee_id}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.gross_salary, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(s.float_held) > 0 ? <span className="text-amber-700">{formatCurrency(s.float_held, "INR", "en-IN")}</span> : <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(s.net_paid, "INR", "en-IN")}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONES[s.status]}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireRead>
  );
}
