"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-elements";
import { gstrService } from "@/services/gstr.service";
import { formatCurrency } from "@/lib/utils";
import { Download, FileJson, TriangleAlert } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/gstr-1 — Outward supplies return
//
// Pick a month → preview B2B / B2CL / B2CS counts and totals →
// download the GSTN-shaped JSON for portal upload. The CA's
// review pass is the same shape as what they get from any
// commercial accounting tool.
// ═══════════════════════════════════════════════════════════

function defaultPeriod(): string {
  // Previous month — by the time you file GSTR-1, the period is closed.
  const d = new Date();
  d.setDate(0);  // last day of previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Gstr1Page() {
  const [period, setPeriod] = useState(defaultPeriod());

  const { data, isLoading } = useQuery({
    queryKey: ["gstr-1", period],
    queryFn: () => gstrService.gstr1({ period }),
  });

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR-1_${data.fp}_${data.gstin}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="GSTR-1 export"
          description="Monthly outward-supply return. Pick a month, preview the row counts, then download the JSON to upload on the GST portal."
          actions={
            <Button kind="primary" onClick={downloadJson} disabled={!data}>
              <FileJson size={14} /> Download JSON
            </Button>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            type="month"
            label="Filing period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            help="GSTR-1 is filed monthly by the 11th of the following month."
          />
          {data && (
            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              <div className="rounded border border-border bg-bg-base p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Filing period</p>
                <p className="mt-1 font-mono text-[15px] font-semibold">{data.fp}</p>
              </div>
              <div className="rounded border border-border bg-bg-base p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">GSTIN</p>
                <p className="mt-1 font-mono text-[12px] font-semibold truncate">{data.gstin || "—"}</p>
              </div>
              <div className="rounded border border-border bg-bg-base p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Grand total</p>
                <p className="mt-1 tabular-nums text-[15px] font-semibold">{formatCurrency(data.summary.grand_total, "INR", "en-IN")}</p>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SectionCard
                code="§4 B2B"
                label="Registered customers"
                count={data.summary.b2b_count}
                blurb="Per-invoice rows with full GST split."
              />
              <SectionCard
                code="§5 B2CL"
                label="Unregistered, inter-state, > ₹2.5L"
                count={data.summary.b2cl_count}
                blurb="Per-invoice rows; IGST only."
              />
              <SectionCard
                code="§7 B2CS"
                label="Unregistered, small or intra-state"
                count={data.summary.b2cs_count}
                blurb="Aggregated by state × rate."
              />
            </div>

            <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left  px-3 py-2 font-medium">Section</th>
                    <th className="text-right px-3 py-2 font-medium">Taxable</th>
                    <th className="text-right px-3 py-2 font-medium">CGST</th>
                    <th className="text-right px-3 py-2 font-medium">SGST</th>
                    <th className="text-right px-3 py-2 font-medium">IGST</th>
                    <th className="text-right px-3 py-2 font-medium">Cess</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-bg-subtle font-semibold">
                    <td className="px-3 py-2.5">All sections</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(data.summary.total_taxable, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(data.summary.total_cgst, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(data.summary.total_sgst, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(data.summary.total_igst, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(data.summary.total_cess, "INR", "en-IN")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(data.summary.grand_total, "INR", "en-IN")}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {data.summary.b2b_count + data.summary.b2cl_count + data.summary.b2cs_count === 0 && (
              <p className="text-[12px] text-text-tertiary text-center py-6">
                No posted invoices in this period. Pick a different month or post some invoices first.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
            <TriangleAlert size={12} className="flex-shrink-0 mt-0.5" />
            <span>
              Always have your accountant review the JSON before uploading to the GST portal. Once filed, GSTR-1 amendments require a separate amendment return.
            </span>
          </p>
          <p className="text-[11px] text-text-tertiary flex items-center gap-1.5">
            <Download size={12} /> The downloaded file matches the GSTN portal JSON schema (`b2b`, `b2cl`, `b2cs` arrays under `gstin` + `fp`).
          </p>
        </div>
      </div>
    </RequireRead>
  );
}

function SectionCard({ code, label, count, blurb }: { code: string; label: string; count: number; blurb: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-mono">{code}</p>
      <p className="mt-1 text-[13px] font-semibold">{label}</p>
      <p className="mt-2 tabular-nums text-2xl font-bold text-brand">{count}</p>
      <p className="mt-1 text-[11px] text-text-tertiary">{blurb}</p>
    </div>
  );
}
