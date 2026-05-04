"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-elements";
import { reportsService } from "@/services/reports.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Hourglass, Download, ThumbsUp } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/creditors-aging — open payables bucketed
//
// Mirror of debtors aging on the AP side. Use this to plan
// vendor payment runs.
// ═══════════════════════════════════════════════════════════

export default function CreditorsAgingPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["report-creditors-aging", { asOf }],
    queryFn: () => reportsService.creditorsAging({ as_of: asOf }),
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ["Vendor", "0-30", "31-60", "61-90", "90+", "Total", "Oldest doc"];
    const lines = [
      headers.join(","),
      ...rows.map((r) => [
        `"${r.party_name.replace(/"/g, '""')}"`,
        r.bucket_0_30, r.bucket_31_60, r.bucket_61_90, r.bucket_90_plus, r.total,
        r.oldest_doc_date ?? "",
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `creditors-aging_${asOf}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Creditors aging"
          description="Money you owe vendors, grouped by how overdue. Use this list to prioritise the next payment run."
          actions={
            <Button kind="ghost" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={14} /> Export CSV
            </Button>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 flex flex-wrap gap-3 items-end">
          <Input
            type="date"
            label="As of"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            help="Snapshot date — buckets are computed against this."
          />
          <p className="text-[11px] text-text-tertiary ml-auto">
            {totals ? `${totals.count} vendor${totals.count === 1 ? "" : "s"} with open balances` : "—"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ThumbsUp size={20} />}
            title="You owe nobody"
            description="No outstanding payables as of this date."
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium">Vendor</th>
                  <th className="text-right px-3 py-2 font-medium">0–30 days</th>
                  <th className="text-right px-3 py-2 font-medium">31–60</th>
                  <th className="text-right px-3 py-2 font-medium text-amber-700">61–90</th>
                  <th className="text-right px-3 py-2 font-medium text-red-700">90+</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-left  px-3 py-2 font-medium">Oldest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.party_id} className="border-t border-border hover:bg-bg-hover">
                    <td className="px-3 py-2">
                      <Link href={`/parties/${r.party_id}?tab=ledger`} className="text-brand hover:underline">{r.party_name}</Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.bucket_0_30, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.bucket_31_60, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatCurrency(r.bucket_61_90, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700 font-semibold">{formatCurrency(r.bucket_90_plus, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(r.total, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-text-tertiary text-[12px]">{r.oldest_doc_date ? formatDate(r.oldest_doc_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot className="bg-bg-subtle border-t-2 border-border">
                  <tr className="font-semibold">
                    <td className="px-3 py-2.5 text-text-tertiary uppercase text-[11px] tracking-wider">Totals</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.bucket_0_30, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.bucket_31_60, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{formatCurrency(totals.bucket_61_90, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-700">{formatCurrency(totals.bucket_90_plus, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.total, "INR", "en-IN")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <p className="text-[11px] text-text-tertiary flex items-center gap-1.5">
          <Hourglass size={12} /> Items in the 90+ bucket may be straining vendor relationships — settle these first if cash allows.
        </p>
      </div>
    </RequireRead>
  );
}
