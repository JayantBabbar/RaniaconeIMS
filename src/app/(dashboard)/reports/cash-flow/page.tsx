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
import { Download, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/cash-flow — Direct-method cash flow statement
//
//   Opening cash
//   + Operating activities (receipts − vendor pay − salary − opex)
//   + Investing activities (capex)
//   = Net change in cash
//   = Closing cash
//
// "Direct" because we list actual inflows/outflows by category,
// not the indirect "start with net profit, adjust for non-cash"
// approach. Most SMB users find direct more intuitive.
// ═══════════════════════════════════════════════════════════

function defaultStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());

  const { data, isLoading } = useQuery({
    queryKey: ["report-cash-flow", { startDate, endDate }],
    queryFn: () =>
      reportsService.cashFlow({ start_date: startDate, end_date: endDate }),
  });

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      ["Section", "Item", "Amount"].join(","),
      ["Opening", "Opening cash", data.opening_cash].join(","),
      ["Operating", "Receipts from customers", data.operating.receipts_from_customers].join(","),
      ["Operating", "Payments to vendors", `-${data.operating.payments_to_vendors}`].join(","),
      ["Operating", "Salary paid (net)", `-${data.operating.salary_paid}`].join(","),
      ["Operating", "Operating expenses", `-${data.operating.operating_expenses}`].join(","),
      ["Operating", "Net operating", data.operating.net].join(","),
      ["Investing", "Capital expenditure", `-${data.investing.capital_expenditure}`].join(","),
      ["Investing", "Net investing", data.investing.net].join(","),
      ["Net", "Net change in cash", data.net_change_in_cash].join(","),
      ["Closing", "Closing cash", data.closing_cash].join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const netIsNegative = data && Number(data.net_change_in_cash) < 0;

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Cash flow statement"
          description="Where cash actually moved in the date range. Receipts in, payments out, grouped by activity. Closing = Opening + Net change."
          actions={
            <Button kind="ghost" onClick={exportCsv} disabled={!data}>
              <Download size={14} /> Export CSV
            </Button>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          <Input type="date" label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" label="To"   value={endDate}   onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto max-w-3xl">
            <table className="w-full text-[13px]">
              <tbody>
                {/* Opening */}
                <tr className="border-b-2 border-border bg-bg-subtle">
                  <td className="px-4 py-3 font-semibold">Opening cash</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(data.opening_cash, "INR", "en-IN")}</td>
                </tr>

                {/* Operating */}
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <ArrowDownToLine size={14} /> Operating activities
                  </td>
                </tr>
                <Row label="Receipts from customers"     amount={data.operating.receipts_from_customers}   sign="+" />
                <Row label="Payments to vendors"         amount={data.operating.payments_to_vendors}       sign="−" />
                <Row label="Salary paid (net)"           amount={data.operating.salary_paid}               sign="−" />
                <Row label="Operating expenses"          amount={data.operating.operating_expenses}        sign="−" />
                <SubtotalRow label="Net cash from operating" amount={data.operating.net} />

                {/* Investing */}
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <ArrowUpFromLine size={14} /> Investing activities
                  </td>
                </tr>
                <Row label="Capital expenditure" amount={data.investing.capital_expenditure} sign="−" />
                <SubtotalRow label="Net cash from investing" amount={data.investing.net} />

                {/* Net change */}
                <tr className="border-y-2 border-border">
                  <td className="px-4 py-3 font-semibold">Net change in cash</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${netIsNegative ? "text-red-700" : "text-emerald-700"}`}>
                    {formatCurrency(data.net_change_in_cash, "INR", "en-IN")}
                  </td>
                </tr>

                {/* Closing */}
                <tr className="bg-emerald-50 dark:bg-emerald-950/40">
                  <td className="px-4 py-4 text-[15px] font-bold">Closing cash</td>
                  <td className="px-4 py-4 text-right text-[15px] tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(data.closing_cash, "INR", "en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-text-tertiary max-w-3xl">
          Cash = Cash on hand + Bank + GPay account balances. Cheque-in-transit is excluded until cleared. Capital expenditure is taken from expense categories flagged is_capital=true.
        </p>
      </div>
    </RequireRead>
  );
}

function Row({ label, amount, sign }: { label: string; amount: string; sign: "+" | "−" }) {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-2 pl-8 text-text-secondary">{label}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${sign === "−" ? "text-red-700/80" : "text-emerald-700/80"}`}>
        {sign}{formatCurrency(amount, "INR", "en-IN")}
      </td>
    </tr>
  );
}

function SubtotalRow({ label, amount }: { label: string; amount: string }) {
  const negative = Number(amount) < 0;
  return (
    <tr className="border-b border-border bg-bg-subtle">
      <td className="px-4 py-2 pl-8 font-medium">{label}</td>
      <td className={`px-4 py-2 text-right tabular-nums font-medium ${negative ? "text-red-700" : "text-emerald-700"}`}>
        {formatCurrency(amount, "INR", "en-IN")}
      </td>
    </tr>
  );
}
