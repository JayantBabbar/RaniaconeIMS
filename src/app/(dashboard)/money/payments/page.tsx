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
import { paymentService } from "@/services/payments.service";
import { partyService } from "@/services/parties.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, CircleDollarSign } from "lucide-react";
import type { PaymentMode, PaymentStatus } from "@/types";

const MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash", bank: "Bank", cheque: "Cheque", gpay: "GPay/UPI",
};

const STATUS_TONES: Record<PaymentStatus, "gray" | "green" | "red" | "amber"> = {
  draft: "amber", posted: "green", cancelled: "red",
};

export default function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments", { direction: "paid" }],
    queryFn: () => paymentService.list({ direction: "paid", limit: 200 }),
  });
  const payments = data ?? [];

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const partyById = new Map((partiesRaw?.data ?? []).map((p) => [p.id, p]));

  return (
    <RequireRead perm="inventory.payments.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Payments"
          description="Money going out to vendors. Same four modes as receipts: Cash, Bank, Cheque, GPay/UPI."
          actions={
            <Can perm="inventory.payments.write">
              <Link href="/money/payments/new"><Button kind="primary"><Plus size={14} /> New payment</Button></Link>
            </Can>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<CircleDollarSign size={20} />}
            title="No payments yet"
            description="Record your first payment when you settle a vendor invoice."
            action={
              <Can perm="inventory.payments.write">
                <Link href="/money/payments/new"><Button kind="primary"><Plus size={14} /> New payment</Button></Link>
              </Can>
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Voucher #</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">To vendor</th>
                  <th className="text-left px-3 py-2 font-medium">Mode</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-bg-hover">
                    <td className="px-3 py-2 font-mono text-[12px]">
                      <Link href={`/money/payments/${r.id}`} className="text-brand hover:underline">
                        {r.payment_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-text-tertiary">{formatDate(r.payment_date)}</td>
                    <td className="px-3 py-2">{partyById.get(r.party_id)?.name ?? r.party_id}</td>
                    <td className="px-3 py-2">{MODE_LABELS[r.mode]}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatCurrency(r.amount, "INR", "en-IN")}
                    </td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONES[r.status]}>{r.status}</Badge></td>
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
