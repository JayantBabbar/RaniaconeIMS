"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageLoading } from "@/components/ui/shared";
import { Can } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { invoiceService } from "@/services/invoices.service";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { stateName } from "@/lib/gst";
import type { InvoiceStatus } from "@/types";
import { ArrowLeft, Lock, X as XIcon, Printer } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Invoice — Detail / View.
// Drafts in this iteration are read-only at /invoices/[id]; deeper
// inline-edit lives in the create flow at /invoices/new. Editing a
// draft after save lands here as a read-back; full edit-in-place is
// the next iteration.
// ═══════════════════════════════════════════════════════════════════

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [showPost, setShowPost] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceService.getById(id),
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["invoiceLines", id],
    queryFn: () => invoiceService.listLines(id),
    enabled: !!id,
  });

  const { data: party } = useQuery({
    queryKey: ["party", invoice?.party_id],
    queryFn: () => (invoice?.party_id ? partyService.getById(invoice.party_id) : null),
    enabled: !!invoice?.party_id,
  });

  const postMut = useMutation({
    mutationFn: () => invoiceService.post(id),
    onSuccess: () => {
      toast.success("Invoice posted", "Stock movements created. Invoice is now locked.");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowPost(false);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Could not post invoice");
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => invoiceService.cancel(id, cancelReason),
    onSuccess: () => {
      toast.success("Invoice cancelled", "Reversal movements posted.");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowCancel(false);
      setCancelReason("");
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Could not cancel invoice");
    },
  });

  if (isLoading || !invoice) return <PageLoading />;

  return (
    <RequireRead perm="inventory.invoices.read" crumbs={["Billing", "Invoices", invoice.invoice_number]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Invoices", invoice.invoice_number]}
        right={
          <>
            <Link href={`/invoices/${invoice.id}/print`}>
              <Button icon={<Printer size={13} />}>Print</Button>
            </Link>
            {invoice.status === "draft" && (
              <Can perm="inventory.invoices.post">
                <Button kind="primary" onClick={() => setShowPost(true)} icon={<Lock size={13} />}>
                  Post invoice
                </Button>
              </Can>
            )}
            {invoice.status === "posted" && (
              <Can perm="inventory.invoices.cancel">
                <Button kind="danger" onClick={() => setShowCancel(true)} icon={<XIcon size={13} />}>
                  Cancel invoice
                </Button>
              </Can>
            )}
          </>
        }
      />

      <div className="p-4 md:p-5 space-y-4">
        <button
          onClick={() => router.push("/invoices")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to invoices
        </button>

        <PageHeader
          title={invoice.invoice_number}
          description={
            invoice.status === "draft"
              ? "Editable. Posting locks the invoice and creates stock + ledger entries."
              : invoice.status === "posted"
                ? "Posted and locked. Stock + ledger are live. Cancel to create a reversal."
                : "Cancelled. Original kept for audit."
          }
          badge={<StatusBadge status={invoice.status} />}
        />

        {/* Cancellation banner */}
        {invoice.status === "cancelled" && invoice.cancellation_reason && (
          <div className="bg-status-red-bg border border-status-red/20 rounded-md p-3 text-[12.5px] text-status-red-text">
            <div className="font-semibold mb-1">Cancellation reason</div>
            <div>{invoice.cancellation_reason}</div>
            {invoice.cancelled_at && (
              <div className="font-mono text-[11px] mt-1.5 text-foreground-muted">
                Cancelled {formatDate(invoice.cancelled_at)}
              </div>
            )}
          </div>
        )}

        {/* Header card */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Customer" value={party ? `${party.name} (${party.code})` : "—"} />
            <Field label="GSTIN" value={party?.gstin || "Unregistered"} mono />
            <Field label="Place of supply" value={`${stateName(invoice.place_of_supply)} (${invoice.place_of_supply})`} />
            <Field label="Invoice date" value={formatDate(invoice.invoice_date)} mono />
            <Field label="Due date" value={invoice.due_date ? formatDate(invoice.due_date) : "—"} mono />
            <Field
              label={invoice.status === "posted" ? "Posted on" : "Created"}
              value={invoice.posting_date ? formatDate(invoice.posting_date) : formatDate(invoice.created_at)}
              mono
            />
          </div>
          {invoice.remarks && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-1">
                Remarks
              </div>
              <div className="text-sm text-foreground-secondary">{invoice.remarks}</div>
            </div>
          )}
        </section>

        {/* Lines */}
        <section className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-hairline">
            <h2 className="text-sm font-semibold">Lines</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">#</th>
                  <th className="text-left px-4 py-2.5">Item</th>
                  <th className="text-left px-4 py-2.5">HSN</th>
                  <th className="text-right px-4 py-2.5">Qty</th>
                  <th className="text-right px-4 py-2.5">Rate</th>
                  <th className="text-right px-4 py-2.5">Taxable</th>
                  <th className="text-right px-4 py-2.5">CGST</th>
                  <th className="text-right px-4 py-2.5">SGST</th>
                  <th className="text-right px-4 py-2.5">IGST</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-hairline-light">
                    <td className="px-4 py-2.5 text-foreground-muted text-xs">{l.line_number}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-sm">{l.description}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{l.hsn_code}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.unit_price}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.taxable_value}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground-secondary">{l.cgst_amount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground-secondary">{l.sgst_amount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground-secondary">{l.igst_amount}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{l.line_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Totals */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5 max-w-md ml-auto">
          <dl className="space-y-1.5 text-sm">
            <Row label="Sub-total" value={invoice.subtotal} />
            <Row label="Tax" value={invoice.tax_total} />
            <div className="pt-2 mt-2 border-t border-hairline">
              <Row label="Grand total" value={`₹ ${invoice.grand_total}`} bold />
            </div>
            {invoice.amount_in_words && (
              <div className="pt-2 mt-2 text-[11px] text-foreground-muted italic leading-snug">
                ({invoice.amount_in_words})
              </div>
            )}
          </dl>
        </section>
      </div>

      <ConfirmDialog
        open={showPost}
        onClose={() => setShowPost(false)}
        onConfirm={() => postMut.mutate()}
        title={`Post ${invoice.invoice_number}?`}
        description="Posting locks the invoice and creates stock OUT movements + ledger entries. The invoice is no longer editable. To undo, cancel — which creates a reversal but keeps the original for audit."
        confirmLabel="Post invoice"
        confirmKind="primary"
        loading={postMut.isPending}
      />

      <ConfirmDialog
        open={showCancel}
        onClose={() => { setShowCancel(false); setCancelReason(""); }}
        onConfirm={() => cancelMut.mutate()}
        title={`Cancel ${invoice.invoice_number}?`}
        description="Cancellation creates reversal movements and reverses the ledger entries. The original invoice stays in the audit trail with status=cancelled — nothing is silently rewritten."
        confirmLabel="Cancel invoice"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const tone = status === "posted" ? "green" : status === "cancelled" ? "red" : "amber";
  const label = status === "posted" ? "Posted" : status === "cancelled" ? "Cancelled" : "Draft";
  return <Badge tone={tone}>{label}</Badge>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={`text-foreground-secondary ${bold ? "font-semibold text-foreground" : ""}`}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold text-foreground text-base" : ""}`}>{value}</dd>
    </div>
  );
}
