"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form-elements";
import { reportsService } from "@/services/reports.service";
import { partyService } from "@/services/parties.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingDown, FileText, Download } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/purchases — Purchase Register
//
// Mirror of Sales Register on the AP side. Same shape of
// response (rows + totals); same pattern of filters.
// ═══════════════════════════════════════════════════════════

function defaultStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PurchaseRegisterPage() {
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [partyFilter, setPartyFilter] = useState<string>("");

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const vendors = useMemo(
    () => (partiesRaw?.data ?? []).filter((p) => p.party_type === "supplier" || p.party_type === "vendor" || p.party_type === "both"),
    [partiesRaw],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["report-purchases", { startDate, endDate, partyFilter }],
    queryFn: () =>
      reportsService.purchaseRegister({
        start_date: startDate,
        end_date: endDate,
        party_id: partyFilter || undefined,
      }),
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ["Bill #", "Date", "Vendor", "State", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total", "Status"];
    const lines = [
      headers.join(","),
      ...rows.map((r) => [
        r.bill_number, r.bill_date,
        `"${r.party_name.replace(/"/g, '""')}"`,
        r.party_state_code ?? "",
        r.taxable_value, r.cgst_amount, r.sgst_amount, r.igst_amount, r.cess_amount,
        r.grand_total, r.status,
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-register_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-7xl mx-auto">
        <PageHeader
          title="Purchase register"
          description="Every vendor bill you posted in the date range, with the input GST split. Foundation for GSTR-2; export to CSV for your CA."
          actions={
            <Button kind="ghost" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={14} /> Export CSV
            </Button>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input type="date" label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" label="To"   value={endDate}   onChange={(e) => setEndDate(e.target.value)} />
          <div>
            <label className="block text-xs font-medium mb-1">Vendor</label>
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5"
            >
              <option value="">All vendors</option>
              {vendors.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <p className="text-[11px] text-text-tertiary">
              {totals ? `${totals.count} bill${totals.count === 1 ? "" : "s"}` : "—"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title="No bills in range"
            description="Try widening the date range or clearing the vendor filter."
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium">Bill #</th>
                  <th className="text-left  px-3 py-2 font-medium">Date</th>
                  <th className="text-left  px-3 py-2 font-medium">Vendor</th>
                  <th className="text-left  px-3 py-2 font-medium">State</th>
                  <th className="text-right px-3 py-2 font-medium">Taxable</th>
                  <th className="text-right px-3 py-2 font-medium">CGST</th>
                  <th className="text-right px-3 py-2 font-medium">SGST</th>
                  <th className="text-right px-3 py-2 font-medium">IGST</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-left  px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bill_id} className="border-t border-border hover:bg-bg-hover">
                    <td className="px-3 py-2 font-mono text-[12px]">
                      <Link href={`/bills/${r.bill_id}`} className="text-brand hover:underline">{r.bill_number}</Link>
                    </td>
                    <td className="px-3 py-2 text-text-tertiary">{formatDate(r.bill_date)}</td>
                    <td className="px-3 py-2">{r.party_name}</td>
                    <td className="px-3 py-2 text-text-tertiary font-mono text-[12px]">{r.party_state_code ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.taxable_value, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.cgst_amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.sgst_amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.igst_amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(r.grand_total, "INR", "en-IN")}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.status === "posted" ? "green" : r.status === "cancelled" ? "red" : "gray"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot className="bg-bg-subtle border-t-2 border-border">
                  <tr className="font-semibold">
                    <td colSpan={4} className="px-3 py-2.5 text-right text-text-tertiary uppercase text-[11px] tracking-wider">Totals</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.taxable_value, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.cgst_amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.sgst_amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.igst_amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totals.grand_total, "INR", "en-IN")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-text-tertiary flex items-center gap-1.5">
          <TrendingDown size={12} /> Only posted bills count toward your input-GST claim. Drafts and cancelled bills appear here for audit but should be excluded by your accountant.
        </p>
      </div>
    </RequireRead>
  );
}
