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
import { FileJson, TriangleAlert } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/gstr-3b — Monthly summary return
//
// Two main sections we model:
//   §3.1(a) — Outward supplies (sum across posted invoices)
//   §4(A)(5) — Eligible ITC (sum across posted vendor bills)
//
// Reverse charge inward (§3.1(d)) is reported as zero — the
// demo doesn't model RC bills. Real backend will populate it.
// ═══════════════════════════════════════════════════════════

function defaultPeriod(): string {
  const d = new Date();
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Gstr3BPage() {
  const [period, setPeriod] = useState(defaultPeriod());

  const { data, isLoading } = useQuery({
    queryKey: ["gstr-3b", period],
    queryFn: () => gstrService.gstr3b({ period }),
  });

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR-3B_${data.ret_period}_${data.gstin}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-5xl mx-auto">
        <PageHeader
          title="GSTR-3B export"
          description="Monthly summary return — outward supplies + ITC. Pick a month, review the totals, then download the JSON for portal upload."
          actions={
            <Button kind="primary" onClick={downloadJson} disabled={!data}>
              <FileJson size={14} /> Download JSON
            </Button>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            type="month"
            label="Filing period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            help="GSTR-3B is filed monthly by the 20th of the following month."
          />
          {data && (
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div className="rounded border border-border bg-bg-base p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Filing period</p>
                <p className="mt-1 font-mono text-[15px] font-semibold">{data.ret_period}</p>
              </div>
              <div className="rounded border border-border bg-bg-base p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">GSTIN</p>
                <p className="mt-1 font-mono text-[12px] font-semibold truncate">{data.gstin || "—"}</p>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <>
            {/* §3.1 Outward */}
            <h2 className="text-[13px] font-semibold mt-4 mb-2 flex items-center gap-2">
              <span className="text-text-tertiary font-mono">§3.1</span>
              Outward supplies
            </h2>
            <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left  px-3 py-2 font-medium">Nature of supplies</th>
                    <th className="text-right px-3 py-2 font-medium">Taxable</th>
                    <th className="text-right px-3 py-2 font-medium">IGST</th>
                    <th className="text-right px-3 py-2 font-medium">CGST</th>
                    <th className="text-right px-3 py-2 font-medium">SGST</th>
                    <th className="text-right px-3 py-2 font-medium">Cess</th>
                  </tr>
                </thead>
                <tbody>
                  <SupRow label="(a) Outward taxable supplies (other than zero/nil/exempt)" v={data.sup_details.osup_det} />
                  <SupRow label="(d) Inward supplies liable to reverse charge" v={data.sup_details.isup_rev} muted />
                </tbody>
              </table>
            </div>

            {/* §4 ITC */}
            <h2 className="text-[13px] font-semibold mt-6 mb-2 flex items-center gap-2">
              <span className="text-text-tertiary font-mono">§4</span>
              Eligible Input Tax Credit
            </h2>
            <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left  px-3 py-2 font-medium">Detail</th>
                    <th className="text-right px-3 py-2 font-medium">IGST</th>
                    <th className="text-right px-3 py-2 font-medium">CGST</th>
                    <th className="text-right px-3 py-2 font-medium">SGST</th>
                    <th className="text-right px-3 py-2 font-medium">Cess</th>
                  </tr>
                </thead>
                <tbody>
                  <ItcRow label="(A)(5) All other ITC" v={data.itc_elg.itc_avl} />
                  <ItcRow label="Net ITC available" v={data.itc_elg.itc_net} bold />
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="mt-4 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
          <TriangleAlert size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            Always reconcile against GSTR-2B (auto-populated by GSTN) before claiming ITC. Mismatches between this report and 2B may signal a vendor that hasn't filed their GSTR-1.
          </span>
        </p>
      </div>
    </RequireRead>
  );
}

interface SupValue {
  txval: string; iamt: string; camt: string; samt: string; csamt: string;
}
function SupRow({ label, v, muted }: { label: string; v: SupValue; muted?: boolean }) {
  return (
    <tr className={`border-t border-border ${muted ? "text-text-tertiary" : ""}`}>
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.txval, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.iamt, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.camt, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.samt, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.csamt, "INR", "en-IN")}</td>
    </tr>
  );
}

interface ItcValue {
  iamt: string; camt: string; samt: string; csamt: string;
}
function ItcRow({ label, v, bold }: { label: string; v: ItcValue; bold?: boolean }) {
  return (
    <tr className={`border-t border-border ${bold ? "font-semibold bg-bg-subtle" : ""}`}>
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.iamt, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.camt, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.samt, "INR", "en-IN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.csamt, "INR", "en-IN")}</td>
    </tr>
  );
}
