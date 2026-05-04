"use client";

import React, { useEffect, use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TopBar } from "@/components/layout/topbar";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { payrollService } from "@/services/payroll.service";
import { useBranding } from "@/providers/branding-provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Printer, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /money/salary/[id]/payslip — Printable payslip
//
// Server-rendered data joined to tenant + employee. Print
// stylesheet hides the toolbar and page chrome so a plain
// Ctrl+P (or the Print button) produces an A4-ready PDF.
// ═══════════════════════════════════════════════════════════

export default function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const branding = useBranding();

  const { data, isLoading } = useQuery({
    queryKey: ["payslip", id],
    queryFn: () => payrollService.getPayslip(id),
  });

  // Set document title for the print dialog filename suggestion.
  useEffect(() => {
    if (data) document.title = `Payslip — ${data.salary_number} — ${data.employee_name}`;
  }, [data]);

  return (
    <RequireRead perm="inventory.salary.read">
      <div className="print:hidden">
        <TopBar />
      </div>

      <div className="px-4 lg:px-6 py-4 max-w-3xl mx-auto">
        {/* Toolbar — hidden on print */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link href={`/money/salary/${id}`} className="text-[13px] text-brand hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to salary entry
          </Link>
          <Button kind="primary" onClick={() => window.print()} disabled={!data}>
            <Printer size={14} /> Print / Save as PDF
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <div className="rounded-lg border border-border bg-bg-elevated p-6 print:border-0 print:shadow-none print:rounded-none print:bg-white">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-text-tertiary">Payslip</p>
                <h1 className="mt-1 text-2xl font-bold">{data.tenant_name}</h1>
                {data.tenant_gstin && (
                  <p className="mt-1 text-[11px] text-text-tertiary font-mono">GSTIN: {data.tenant_gstin}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Voucher</p>
                <p className="mt-1 font-mono text-[13px] font-semibold">{data.salary_number}</p>
                <div className="mt-2"><Badge tone={data.status === "posted" ? "green" : data.status === "draft" ? "amber" : "red"}>{data.status}</Badge></div>
              </div>
            </div>

            {/* Period + employee */}
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Pay period</p>
                <p className="mt-1 font-semibold">{periodLabel(data.period_month)}</p>
                {data.posting_date && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary mt-3">Pay date</p>
                    <p className="mt-1">{formatDate(data.posting_date)}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Employee</p>
                <p className="mt-1 font-semibold">{data.employee_name}</p>
                {data.employee_role && (
                  <p className="text-[12px] text-text-secondary">{data.employee_role}</p>
                )}
                <p className="mt-3 text-[10px] uppercase tracking-wider text-text-tertiary">Paid via</p>
                <p className="mt-1 text-[13px]">{data.paid_from_account_name}</p>
              </div>
            </div>

            {/* Earnings table */}
            <div className="mt-6">
              <h2 className="text-[13px] font-semibold mb-2">Earnings & deductions</h2>
              <table className="w-full text-[13px] border border-border">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2.5">Gross salary</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(data.gross_salary, "INR", "en-IN")}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2.5 pl-6 text-text-secondary">
                      Less: Float held
                      <span className="ml-2 text-[11px] text-text-tertiary">(customer GPays you settled)</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      −{formatCurrency(data.float_held, "INR", "en-IN")}
                    </td>
                  </tr>
                  <tr className="bg-bg-subtle">
                    <td className="px-3 py-3 font-bold text-[14px]">Net pay</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-[14px]">
                      {formatCurrency(data.net_paid, "INR", "en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-[12px] italic text-text-secondary">
                {data.amount_in_words}
              </p>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-border grid grid-cols-2 gap-6 text-[11px] text-text-tertiary">
              <div>
                <p>This is a computer-generated payslip and does not require a signature.</p>
              </div>
              <div className="text-right">
                <p>Generated by {branding.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          aside, nav, .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
    </RequireRead>
  );
}

function periodLabel(periodMonth: string): string {
  // Input is YYYY-MM-01.
  const [y, m] = periodMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
