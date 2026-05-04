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
import { employeeService } from "@/services/employees.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, HandCoins } from "lucide-react";
import type { PaymentMode, PaymentStatus } from "@/types";

// ═══════════════════════════════════════════════════════════
// Receipts — incoming money. Filters direction='received'.
// ═══════════════════════════════════════════════════════════

const MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash", bank: "Bank", cheque: "Cheque", gpay: "GPay/UPI",
};

const STATUS_TONES: Record<PaymentStatus, "gray" | "green" | "red" | "amber"> = {
  draft: "amber", posted: "green", cancelled: "red",
};

export default function ReceiptsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments", { direction: "received" }],
    queryFn: () => paymentService.list({ direction: "received", limit: 200 }),
  });
  const receipts = data ?? [];

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const partyById = new Map((partiesRaw?.data ?? []).map((p) => [p.id, p]));

  const { data: emps } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeeService.list({ limit: 200 }),
  });
  const empById = new Map((emps ?? []).map((e) => [e.id, e]));

  return (
    <RequireRead perm="inventory.payments.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Receipts"
          description="Money coming in from customers. Cash drops, bank transfers, cheques, GPay/UPI — including UPIs paid to a salesman personally (those land in the salesman's float)."
          actions={
            <Can perm="inventory.payments.write">
              <Link href="/money/receipts/new"><Button kind="primary"><Plus size={14} /> New receipt</Button></Link>
            </Can>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={<HandCoins size={20} />}
            title="No receipts yet"
            description="Record your first receipt when a customer pays — by cash, bank, cheque, or GPay."
            action={
              <Can perm="inventory.payments.write">
                <Link href="/money/receipts/new"><Button kind="primary"><Plus size={14} /> New receipt</Button></Link>
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
                  <th className="text-left px-3 py-2 font-medium">From</th>
                  <th className="text-left px-3 py-2 font-medium">Mode</th>
                  <th className="text-left px-3 py-2 font-medium">Landed in</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const party = partyById.get(r.party_id);
                  const emp = r.payee_employee_id ? empById.get(r.payee_employee_id) : undefined;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-mono text-[12px]">
                        <Link href={`/money/receipts/${r.id}`} className="text-brand hover:underline">
                          {r.payment_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-text-tertiary">{formatDate(r.payment_date)}</td>
                      <td className="px-3 py-2">{party?.name ?? r.party_id}</td>
                      <td className="px-3 py-2">{MODE_LABELS[r.mode]}</td>
                      <td className="px-3 py-2 text-text-tertiary">
                        {emp ? <span className="font-medium">{emp.name}</span> : "Company account"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(r.amount, "INR", "en-IN")}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS_TONES[r.status]}>{r.status}</Badge>
                      </td>
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
