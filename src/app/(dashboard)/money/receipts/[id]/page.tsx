"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Can, useCan } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { paymentService } from "@/services/payments.service";
import { partyService } from "@/services/parties.service";
import { accountService } from "@/services/accounts.service";
import { invoiceService } from "@/services/invoices.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Lock, Ban } from "lucide-react";

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRead perm="inventory.payments.read">
      <ReceiptDetail id={id} />
    </RequireRead>
  );
}

function ReceiptDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const [showCancel, setShowCancel] = useState(false);

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payment", id],
    queryFn: () => paymentService.getById(id),
  });

  const { data: party } = useQuery({
    queryKey: ["party", payment?.party_id],
    queryFn: () => partyService.getById(payment!.party_id),
    enabled: !!payment?.party_id,
  });

  const { data: account } = useQuery({
    queryKey: ["account", payment?.account_id],
    queryFn: () => accountService.getById(payment!.account_id),
    enabled: !!payment?.account_id,
  });

  const { data: allocations } = useQuery({
    queryKey: ["payment-allocations", id],
    queryFn: () => paymentService.listAllocations(id),
  });

  const invoiceIds = (allocations ?? []).map((a) => a.invoice_id).filter((x): x is string => !!x);
  const { data: invoicesRaw } = useQuery({
    queryKey: ["invoices", { ids: invoiceIds.join(",") }],
    queryFn: async () => {
      const all = await invoiceService.list({ limit: 200 });
      return all.filter((i) => invoiceIds.includes(i.id));
    },
    enabled: invoiceIds.length > 0,
  });
  const invoiceById = new Map((invoicesRaw ?? []).map((i) => [i.id, i]));

  const post = useMutation({
    mutationFn: () => paymentService.post(id),
    onSuccess: () => {
      toast.success("Receipt posted");
      qc.invalidateQueries({ queryKey: ["payment", id] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not post"),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => paymentService.cancel(id, reason),
    onSuccess: () => {
      toast.success("Receipt cancelled");
      setShowCancel(false);
      qc.invalidateQueries({ queryKey: ["payment", id] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not cancel"),
  });

  if (isLoading || !payment) {
    return (
      <>
        <TopBar />
        <div className="flex justify-center py-16"><Spinner /></div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title={payment.payment_number}
          description={`${payment.direction === "received" ? "Receipt" : "Payment"} · ${formatDate(payment.payment_date)} · ${payment.mode.toUpperCase()}`}
          actions={
            <div className="flex gap-2">
              <Badge tone={payment.status === "posted" ? "green" : payment.status === "cancelled" ? "red" : "amber"}>
                {payment.status}
              </Badge>
              {payment.status === "draft" && can("inventory.payments.post") && (
                <Button kind="primary" onClick={() => post.mutate()} disabled={post.isPending}>
                  <Lock size={13} /> Post
                </Button>
              )}
              {payment.status === "posted" && can("inventory.payments.cancel") && (
                <Button kind="danger" onClick={() => setShowCancel(true)}>
                  <Ban size={13} /> Cancel
                </Button>
              )}
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
              <div className="px-4 py-2.5 border-b border-border"><h3 className="text-[13px] font-semibold">Details</h3></div>
              <dl className="px-4 py-3 grid grid-cols-2 gap-3 text-[13px]">
                <Row label="From"   value={party?.name ?? "—"} />
                <Row label="Mode"   value={payment.mode.toUpperCase()} />
                <Row label="Lands in" value={account?.name ?? "—"} />
                <Row label="Amount" value={formatCurrency(payment.amount, "INR", "en-IN")} bold />
                {payment.mode === "cheque" && (
                  <>
                    <Row label="Cheque #" value={(payment.details as { cheque_number?: string }).cheque_number ?? "—"} />
                    <Row label="Bank" value={(payment.details as { bank_name?: string }).bank_name ?? "—"} />
                    <Row label="Cheque date" value={formatDate((payment.details as { cheque_date?: string }).cheque_date ?? "")} />
                    <Row label="Cleared" value={(payment.details as { cleared?: boolean }).cleared ? "Yes" : "No"} />
                  </>
                )}
                {payment.mode === "bank" && (
                  <>
                    <Row label="Reference" value={(payment.details as { reference?: string }).reference ?? "—"} />
                    <Row label="Counterparty bank" value={(payment.details as { counterparty_bank?: string }).counterparty_bank ?? "—"} />
                  </>
                )}
                {payment.mode === "gpay" && (
                  <>
                    <Row label="Transaction ref" value={(payment.details as { transaction_ref?: string }).transaction_ref ?? "—"} />
                    <Row label="Payer UPI" value={(payment.details as { payer_upi?: string }).payer_upi ?? "—"} />
                  </>
                )}
                {payment.payee_employee_id && (
                  <Row label="Held by employee" value="See float ledger" />
                )}
                {payment.remarks && <Row label="Remarks" value={payment.remarks} />}
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
              <div className="px-4 py-2.5 border-b border-border"><h3 className="text-[13px] font-semibold">Applied to invoices</h3></div>
              {(allocations ?? []).length === 0 ? (
                <p className="px-4 py-6 text-xs text-text-tertiary text-center">Nothing applied yet — full amount sits as on-account credit.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                    <tr><th className="text-left px-3 py-2 font-medium">Invoice</th><th className="text-right px-3 py-2 font-medium">Amount</th></tr>
                  </thead>
                  <tbody>
                    {(allocations ?? []).map((a) => {
                      const inv = a.invoice_id ? invoiceById.get(a.invoice_id) : undefined;
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-3 py-2">{inv ? <Link href={`/invoices/${inv.id}`} className="text-brand hover:underline">{inv.invoice_number}</Link> : (a.invoice_id ?? a.challan_id)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(a.amount, "INR", "en-IN")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-2 text-[13px]">
              <h3 className="text-[13px] font-semibold mb-2">Reconciliation</h3>
              <div className="flex justify-between"><span className="text-text-tertiary">Total amount</span><span className="tabular-nums">{formatCurrency(payment.amount, "INR", "en-IN")}</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Allocated</span><span className="tabular-nums">{formatCurrency(payment.allocated_amount, "INR", "en-IN")}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-2"><span>On account</span><span className="tabular-nums">{formatCurrency((Number(payment.amount) - Number(payment.allocated_amount)).toFixed(2), "INR", "en-IN")}</span></div>
            </div>
          </div>
        </div>
      </div>

      {showCancel && (
        <CancelDialog
          onClose={() => setShowCancel(false)}
          onConfirm={(reason) => cancel.mutate(reason)}
          loading={cancel.isPending}
        />
      )}
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className={bold ? "font-semibold tabular-nums" : ""}>{value}</dd>
    </>
  );
}

function CancelDialog({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: (reason: string) => void; loading: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onClose={onClose} title="Cancel receipt?" description="Cancelling reverses the ledger entries and unallocates the receipt from any invoices.">
      <FormField label="Reason" required>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong amount entered" autoFocus />
      </FormField>
      <div className="flex justify-end gap-2 mt-4">
        <Button kind="ghost" onClick={onClose}>Keep it</Button>
        <Button kind="danger" onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim() || loading}>
          {loading ? <Spinner size={14} /> : "Cancel receipt"}
        </Button>
      </div>
    </Dialog>
  );
}
