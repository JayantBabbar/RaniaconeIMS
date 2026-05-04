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
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useCan } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { billService } from "@/services/bills.service";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { stateName } from "@/lib/gst";
import { ArrowLeft, Lock, Ban } from "lucide-react";

export default function VendorBillDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRead perm="inventory.bills.read">
      <BillDetail id={id} />
    </RequireRead>
  );
}

function BillDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const [showCancel, setShowCancel] = useState(false);

  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill", id],
    queryFn: () => billService.getById(id),
  });
  const { data: lines } = useQuery({
    queryKey: ["bill-lines", id],
    queryFn: () => billService.listLines(id),
  });
  const { data: party } = useQuery({
    queryKey: ["party", bill?.party_id],
    queryFn: () => partyService.getById(bill!.party_id),
    enabled: !!bill?.party_id,
  });

  const post = useMutation({
    mutationFn: () => billService.post(id),
    onSuccess: () => {
      toast.success("Bill posted");
      qc.invalidateQueries({ queryKey: ["bill", id] });
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not post"),
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => billService.cancel(id, reason),
    onSuccess: () => {
      toast.success("Bill cancelled");
      setShowCancel(false);
      qc.invalidateQueries({ queryKey: ["bill", id] });
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not cancel"),
  });

  if (isLoading || !bill) return <><TopBar /><div className="flex justify-center py-16"><Spinner /></div></>;

  const outstanding = Number(bill.grand_total) - Number(bill.allocated_amount);

  return (
    <>
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title={bill.bill_number}
          description={`${formatDate(bill.bill_date)} · ${party?.name ?? bill.party_id} · POS ${stateName(bill.place_of_supply)}`}
          actions={
            <div className="flex gap-2">
              <Badge tone={bill.status === "posted" ? "green" : bill.status === "cancelled" ? "red" : "amber"}>{bill.status}</Badge>
              {bill.status === "draft" && can("inventory.bills.post") && (
                <Button kind="primary" onClick={() => post.mutate()} disabled={post.isPending}><Lock size={13} /> Post</Button>
              )}
              {bill.status === "posted" && can("inventory.bills.cancel") && (
                <Button kind="danger" onClick={() => setShowCancel(true)}><Ban size={13} /> Cancel</Button>
              )}
            </div>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto mt-4">
          <div className="px-4 py-2.5 border-b border-border"><h3 className="text-[13px] font-semibold">Lines</h3></div>
          <table className="w-full text-[13px]">
            <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-left px-3 py-2 font-medium">HSN</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <th className="text-right px-3 py-2 font-medium">Taxable</th>
                <th className="text-right px-3 py-2 font-medium">Tax</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-text-tertiary">{l.line_number}</td>
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-text-tertiary">{l.hsn_code ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.unit_price, "INR", "en-IN")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.taxable_value, "INR", "en-IN")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(l.cgst_amount) + Number(l.sgst_amount) + Number(l.igst_amount) + Number(l.cess_amount), "INR", "en-IN")}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(l.line_total, "INR", "en-IN")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-bg-subtle border-t-2 border-border text-[13px]">
                <td colSpan={5} />
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(bill.subtotal, "INR", "en-IN")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(bill.tax_total, "INR", "en-IN")}</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold">{formatCurrency(bill.grand_total, "INR", "en-IN")}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {bill.status === "posted" && (
          <div className="mt-3 rounded-lg border border-border bg-bg-elevated p-4 text-[13px]">
            <h3 className="text-[13px] font-semibold mb-2">Settlement</h3>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-tertiary">Total</span><span className="tabular-nums">{formatCurrency(bill.grand_total, "INR", "en-IN")}</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Paid</span><span className="tabular-nums">{formatCurrency(bill.allocated_amount, "INR", "en-IN")}</span></div>
              <div className={`flex justify-between font-semibold border-t border-border pt-2 ${outstanding > 0 ? "text-amber-700" : ""}`}>
                <span>Outstanding</span>
                <span className="tabular-nums">{formatCurrency(outstanding, "INR", "en-IN")}</span>
              </div>
            </div>
            {outstanding > 0 && (
              <p className="text-[11px] text-text-tertiary mt-3">
                To pay this bill, create a <Link href="/money/payments/new" className="text-brand hover:underline">Payment voucher</Link> and allocate it against this bill.
              </p>
            )}
          </div>
        )}
      </div>

      {showCancel && (
        <Dialog open onClose={() => setShowCancel(false)} title="Cancel bill?" description="Reverses the AP entry. Will fail if any payments are allocated to this bill — unallocate those first.">
          <CancelBillBody onCancel={(reason) => cancel.mutate(reason)} loading={cancel.isPending} onClose={() => setShowCancel(false)} />
        </Dialog>
      )}
    </>
  );
}

function CancelBillBody({ onCancel, loading, onClose }: { onCancel: (r: string) => void; loading: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <FormField label="Reason" required>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong amount entered" autoFocus />
      </FormField>
      <div className="flex justify-end gap-2 mt-4">
        <Button kind="ghost" onClick={onClose}>Keep it</Button>
        <Button kind="danger" onClick={() => reason.trim() && onCancel(reason)} disabled={!reason.trim() || loading}>
          {loading ? <Spinner size={14} /> : "Cancel bill"}
        </Button>
      </div>
    </>
  );
}
