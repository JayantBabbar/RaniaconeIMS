"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-elements";
import { reportsService } from "@/services/reports.service";
import { formatCurrency } from "@/lib/utils";
import { PiggyBank, Download, TriangleAlert } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/profit-loss — Income statement
//
//   Revenue                    (taxable_value of posted invoices)
//   − COGS                     (stock-out valuation in range)
//   ─────────────────
//   = Gross profit
//   − Expenses (by category)   (posted expenses in range)
//   − Salary                   (gross_salary on posted entries)
//   ─────────────────
//   = Net profit
//
// COGS in demo mode is a 60% stand-in. In production it sums
// valuation_layer consumption on stock-out moves caused by
// posted invoices in the date window.
// ═══════════════════════════════════════════════════════════

function defaultStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-04-01`;  // FY start (April 1)
}
function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProfitLossPage() {
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());

  const { data, isLoading } = useQuery({
    queryKey: ["report-profit-loss", { startDate, endDate }],
    queryFn: () =>
      reportsService.profitLoss({ start_date: startDate, end_date: endDate }),
  });

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      ["Section", "Item", "Amount"].join(","),
      ["Revenue", "Sales (taxable value)", data.revenue].join(","),
      ["", "COGS (cost of goods sold)", `-${data.cogs}`].join(","),
      ["", "Gross profit", data.gross_profit].join(","),
      ...data.expenses.map((e) => ["Expenses", `"${e.category_name.replace(/"/g, '""')}"`, `-${e.amount}`].join(",")),
      ["Expenses", "Total expenses", `-${data.expenses_total}`].join(","),
      ["", "Salary (gross)", `-${data.salary_total}`].join(","),
      ["", "Net profit", data.net_profit].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const netIsLoss = data && Number(data.net_profit) < 0;

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-4xl mx-auto">
        <PageHeader
          title="Profit & loss"
          description="Revenue minus the cost of running the business in a date range. Net at the bottom is what you actually took home."
          actions={
            <Button kind="ghost" onClick={exportCsv} disabled={!data}>
              <Download size={14} /> Export CSV
            </Button>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input type="date" label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" label="To"   value={endDate}   onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <tbody>
                {/* Revenue */}
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">Revenue</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(data.revenue, "INR", "en-IN")}</td>
                </tr>

                {/* COGS */}
                <tr className="border-b border-border">
                  <td className="px-4 py-3 pl-8 text-text-secondary">Cost of goods sold</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">−{formatCurrency(data.cogs, "INR", "en-IN")}</td>
                </tr>

                {/* Gross profit */}
                <tr className="border-b-2 border-border bg-bg-subtle">
                  <td className="px-4 py-3 font-semibold">Gross profit</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(data.gross_profit, "INR", "en-IN")}</td>
                </tr>

                {/* Expenses heading */}
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-semibold text-amber-700 dark:text-amber-400">Operating expenses</td>
                </tr>
                {data.expenses.length === 0 ? (
                  <tr className="border-b border-border">
                    <td className="px-4 py-2 pl-8 text-text-tertiary italic">No expenses posted in range</td>
                    <td className="px-4 py-2 text-right tabular-nums text-text-tertiary">—</td>
                  </tr>
                ) : (
                  data.expenses.map((e) => (
                    <tr key={e.category_id} className="border-b border-border">
                      <td className="px-4 py-2 pl-8 text-text-secondary">{e.category_name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-text-secondary">−{formatCurrency(e.amount, "INR", "en-IN")}</td>
                    </tr>
                  ))
                )}
                <tr className="border-b border-border">
                  <td className="px-4 py-2 pl-8 font-medium">Total expenses</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">−{formatCurrency(data.expenses_total, "INR", "en-IN")}</td>
                </tr>

                {/* Salary */}
                <tr className="border-b-2 border-border">
                  <td className="px-4 py-3 text-text-secondary">Salary (gross)</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">−{formatCurrency(data.salary_total, "INR", "en-IN")}</td>
                </tr>

                {/* Net */}
                <tr className={netIsLoss ? "bg-red-50 dark:bg-red-950/40" : "bg-emerald-50 dark:bg-emerald-950/40"}>
                  <td className="px-4 py-4 text-[15px] font-bold">Net {netIsLoss ? "loss" : "profit"}</td>
                  <td className={`px-4 py-4 text-right text-[15px] tabular-nums font-bold ${netIsLoss ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {formatCurrency(data.net_profit, "INR", "en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-text-tertiary flex items-center gap-1.5">
          <PiggyBank size={12} /> Revenue is taxable value (GST excluded — it's a pass-through). Salary uses gross, not net, since the employer's float settles internally.
        </p>
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <TriangleAlert size={12} /> COGS is a placeholder in demo mode (~60% of revenue). Production will compute it from posted stock-out valuation layers.
        </p>
      </div>
    </RequireRead>
  );
}
