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
import { billService } from "@/services/bills.service";
import { partyService } from "@/services/parties.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";
import type { VendorBillStatus } from "@/types";

const STATUS_TONES: Record<VendorBillStatus, "gray" | "green" | "red" | "amber"> = {
  draft: "amber", posted: "green", cancelled: "red",
};

export default function VendorBillsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: () => billService.list({ limit: 200 }),
  });
  const bills = data ?? [];

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const partyById = new Map((partiesRaw?.data ?? []).map((p) => [p.id, p]));

  return (
    <RequireRead perm="inventory.bills.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Vendor Bills"
          description="Bills you've received from suppliers, entered into our books. Posting a bill writes the AP entry (Dr expense / Dr GST input / Cr Vendor); it does NOT move stock — that's what the GRN flow is for."
          actions={
            <Can perm="inventory.bills.write">
              <Link href="/bills/new"><Button kind="primary"><Plus size={14} /> New bill</Button></Link>
            </Can>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : bills.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title="No bills yet"
            description="Enter your first vendor bill when one of your suppliers sends an invoice."
            action={<Can perm="inventory.bills.write"><Link href="/bills/new"><Button kind="primary"><Plus size={14} /> New bill</Button></Link></Can>}
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Bill #</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Vendor</th>
                  <th className="text-left px-3 py-2 font-medium">Supplier ref</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-right px-3 py-2 font-medium">Outstanding</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const outstanding = Number(b.grand_total) - Number(b.allocated_amount);
                  return (
                    <tr key={b.id} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-mono text-[12px]">
                        <Link href={`/bills/${b.id}`} className="text-brand hover:underline">{b.bill_number}</Link>
                      </td>
                      <td className="px-3 py-2 text-text-tertiary">{formatDate(b.bill_date)}</td>
                      <td className="px-3 py-2">{partyById.get(b.party_id)?.name ?? b.party_id}</td>
                      <td className="px-3 py-2 font-mono text-[12px] text-text-tertiary">{b.supplier_invoice_number ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(b.grand_total, "INR", "en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {b.status === "posted" && outstanding > 0 ? (
                          <span className="text-amber-700 font-semibold">{formatCurrency(outstanding, "INR", "en-IN")}</span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2"><Badge tone={STATUS_TONES[b.status]}>{b.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireRead>
  );
}
