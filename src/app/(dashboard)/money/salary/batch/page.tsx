"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form-elements";
import { Can } from "@/components/ui/can";
import { payrollService } from "@/services/payroll.service";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles, CheckCheck, Users, FileSearch, TriangleAlert, ArrowRight,
} from "lucide-react";
import { isApiError } from "@/lib/api-client";
import type { SalaryStatus } from "@/types";

// ═══════════════════════════════════════════════════════════
// /money/salary/batch — Payroll batch
//
// Pick a month → Generate drafts (idempotent) → review the
// per-employee table → Bulk post on payday. Float-drift on
// any single entry fails the whole batch and surfaces the
// drifting rows so the user can refresh and retry.
//
// Production wires the "Generate drafts" call to a cron at
// 02:00 IST on the 1st of each month, but the manual button
// stays for first-run / mid-month corrections.
// ═══════════════════════════════════════════════════════════

function defaultPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_TONES: Record<SalaryStatus, "gray" | "amber" | "green" | "red"> = {
  draft: "amber", posted: "green", cancelled: "red",
};

export default function PayrollBatchPage() {
  const [period, setPeriod] = useState(defaultPeriod());
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-batch", period],
    queryFn: () => payrollService.getBatch(period),
  });

  const generateMutation = useMutation({
    mutationFn: () => payrollService.generateBatch({ period }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["payroll-batch", period] });
      const created = (res as unknown as { created?: number }).created ?? 0;
      toast.success(created > 0
        ? `Generated ${created} draft salar${created === 1 ? "y" : "ies"}`
        : "All employees already have a draft for this period");
    },
    onError: (e: Error) => toast.error(isApiError(e) ? e.message : "Failed to generate"),
  });

  const postMutation = useMutation({
    mutationFn: () => payrollService.postBatch({ period }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["payroll-batch", period] });
      qc.invalidateQueries({ queryKey: ["salary"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
      toast.success(`Posted ${res.posted_count} salar${res.posted_count === 1 ? "y" : "ies"}`);
    },
    onError: (e: Error) => {
      if (isApiError(e) && e.code === "SALARY_BATCH_FLOAT_DRIFT") {
        toast.error(e.message);
        qc.invalidateQueries({ queryKey: ["payroll-batch", period] });
      } else {
        toast.error(isApiError(e) ? e.message : "Failed to post batch");
      }
    },
  });

  const totals = data?.totals;
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const draftCount = totals?.drafts ?? 0;
  const employeeCount = totals?.employee_count ?? 0;
  const missingCount = entries.filter((e) => e.salary_id === null).length;

  const periodLabel = useMemo(() => {
    if (!period) return "";
    const [y, m] = period.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, [period]);

  return (
    <RequireRead perm="inventory.salary.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Payroll batch"
          description="Generate draft salaries for everyone in one click, then post them all on payday. Float held by salesmen is auto-deducted from gross — net is what actually pays out."
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Input
            type="month"
            label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            help="The month you're paying for. Defaults to the current month."
          />
          <div className="md:col-span-3 flex flex-wrap gap-2 justify-end">
            <Can perm="inventory.salary.write">
              <Button
                kind="secondary"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || missingCount === 0}
                title={missingCount === 0 ? "All employees already have drafts" : `Generate drafts for ${missingCount} employee${missingCount === 1 ? "" : "s"}`}
              >
                <Sparkles size={14} /> Generate drafts
                {missingCount > 0 && <span className="ml-1 text-[11px] opacity-70">({missingCount})</span>}
              </Button>
            </Can>
            <Can perm="inventory.salary.post">
              <Button
                kind="primary"
                onClick={() => {
                  if (draftCount === 0) return;
                  if (confirm(`Post all ${draftCount} draft salar${draftCount === 1 ? "y" : "ies"} for ${periodLabel}? This is irreversible without a per-entry cancel.`)) {
                    postMutation.mutate();
                  }
                }}
                disabled={postMutation.isPending || draftCount === 0}
              >
                <CheckCheck size={14} /> Post all drafts
                {draftCount > 0 && <span className="ml-1 text-[11px] opacity-80">({draftCount})</span>}
              </Button>
            </Can>
          </div>
        </div>

        {/* Aggregate KPI strip */}
        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Employees" value={String(employeeCount)} icon={Users} tone="neutral" />
            <Kpi label="Drafts" value={String(totals.drafts)} icon={FileSearch} tone={totals.drafts > 0 ? "amber" : "neutral"} />
            <Kpi label="Total gross" value={formatCurrency(totals.total_gross, "INR", "en-IN")} tone="neutral" />
            <Kpi label="Net to pay" value={formatCurrency(totals.total_net, "INR", "en-IN")} tone="green" />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="No active employees"
            description="Add employees first — Money → Employees."
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium">Employee</th>
                  <th className="text-left  px-3 py-2 font-medium">Role</th>
                  <th className="text-right px-3 py-2 font-medium">Gross</th>
                  <th className="text-right px-3 py-2 font-medium">Float held</th>
                  <th className="text-right px-3 py-2 font-medium">Net</th>
                  <th className="text-left  px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const drift = e.salary_id !== null && e.float_held && Number(e.float_held) !== Number(e.current_float);
                  return (
                    <tr key={e.employee_id} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-medium">{e.employee_name}</td>
                      <td className="px-3 py-2 text-text-tertiary text-[12px]">{e.employee_role ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {e.gross_salary ? formatCurrency(e.gross_salary, "INR", "en-IN") : <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {e.float_held ? (
                          <span className={drift ? "text-amber-700 font-semibold" : ""} title={drift ? `Drift: snapshot ${e.float_held} vs current ${e.current_float}` : undefined}>
                            {formatCurrency(e.float_held, "INR", "en-IN")}
                            {drift && <TriangleAlert size={12} className="inline-block ml-1 -mt-0.5" />}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">{formatCurrency(e.current_float, "INR", "en-IN")}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {e.net_paid ? formatCurrency(e.net_paid, "INR", "en-IN") : <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {e.status ? (
                          <Badge tone={STATUS_TONES[e.status]}>{e.status}</Badge>
                        ) : (
                          <Badge tone="gray">no draft</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {e.salary_id ? (
                          <Link href={`/money/salary/${e.salary_id}`} className="text-brand text-[12px] hover:underline inline-flex items-center gap-1">
                            View <ArrowRight size={12} />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-text-tertiary flex items-start gap-1.5">
          <TriangleAlert size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            If the float a salesman is holding has changed since the draft was generated, this row shows an amber warning. The bulk-post call re-validates per entry and rolls back the whole batch if any drifts — refresh and re-generate the affected drafts.
          </span>
        </p>
      </div>
    </RequireRead>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon?: React.ElementType; tone: "green" | "amber" | "neutral" }) {
  const toneClass = tone === "green" ? "text-emerald-700 dark:text-emerald-400" :
                    tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-text-secondary";
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
        {Icon && <Icon size={14} className="text-text-tertiary" />}
      </div>
      <p className={`mt-1 tabular-nums text-[18px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
