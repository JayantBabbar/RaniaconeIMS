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
import { estimateService, routeService } from "@/services/estimates.service";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import type { EstimateStatus } from "@/types";
import { ArrowLeft, Lock, X as XIcon, Printer, ReceiptText } from "lucide-react";

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [showPost, setShowPost] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["estimate", id],
    queryFn: () => estimateService.getById(id),
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["estimateLines", id],
    queryFn: () => estimateService.listLines(id),
    enabled: !!id,
  });

  const { data: party } = useQuery({
    queryKey: ["party", estimate?.party_id],
    queryFn: () => (estimate?.party_id ? partyService.getById(estimate.party_id) : null),
    enabled: !!estimate?.party_id,
  });

  const { data: route } = useQuery({
    queryKey: ["route", estimate?.route_id],
    queryFn: () => (estimate?.route_id ? routeService.getById(estimate.route_id) : null),
    enabled: !!estimate?.route_id,
  });

  const postMut = useMutation({
    mutationFn: () => estimateService.post(id),
    onSuccess: () => {
      toast.success("Estimate posted", "Stock OUT movements created.");
      qc.invalidateQueries({ queryKey: ["estimate", id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      setShowPost(false);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not post estimate"),
  });

  // Phase 12: print-mode toggle directly from the detail page so the
  // user doesn't have to navigate to print preview just to change the
  // mode. Per spec §8 — estimates default to no_amount; flip to
  // with_remarks when the customer asked for a priced estimate.
  const printModeMut = useMutation({
    mutationFn: (mode: "no_amount" | "with_remarks") =>
      estimateService.update(id, { print_mode: mode }),
    onSuccess: () => {
      toast.success("Print mode updated");
      qc.invalidateQueries({ queryKey: ["estimate", id] });
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not update print mode"),
  });

  const cancelMut = useMutation({
    mutationFn: () => estimateService.cancel(id, "Cancelled from detail page"),
    onSuccess: () => {
      toast.success("Estimate cancelled");
      qc.invalidateQueries({ queryKey: ["estimate", id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      setShowCancel(false);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not cancel estimate"),
  });

  const promoteMut = useMutation({
    mutationFn: () => estimateService.promoteToInvoice(id),
    onSuccess: ({ invoice }) => {
      toast.success("Invoice created", `Draft ${invoice.invoice_number}.`);
      qc.invalidateQueries({ queryKey: ["estimate", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not promote estimate"),
  });

  if (isLoading || !estimate) return <PageLoading />;

  return (
    <RequireRead perm="inventory.estimates.read" crumbs={["Billing", "Estimates", estimate.estimate_number]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Estimates", estimate.estimate_number]}
        right={
          <>
            <Link href={`/estimates/${estimate.id}/print`}>
              <Button icon={<Printer size={13} />}>Print</Button>
            </Link>
            {estimate.status === "draft" && (
              <Can perm="inventory.estimates.post">
                <Button kind="primary" onClick={() => setShowPost(true)} icon={<Lock size={13} />}>
                  Post estimate
                </Button>
              </Can>
            )}
            {estimate.status === "posted" && !estimate.is_billed && (
              <Can perm="inventory.invoices.write">
                <Button kind="primary" onClick={() => setShowPromote(true)} icon={<ReceiptText size={13} />}>
                  Convert to invoice
                </Button>
              </Can>
            )}
            {estimate.status === "posted" && (
              <Can perm="inventory.estimates.cancel">
                <Button kind="danger" onClick={() => setShowCancel(true)} icon={<XIcon size={13} />}>
                  Cancel
                </Button>
              </Can>
            )}
          </>
        }
      />

      <div className="p-4 md:p-5 max-w-5xl space-y-5">
        <button
          onClick={() => router.push("/estimates")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to estimates
        </button>

        <PageHeader
          title={estimate.estimate_number}
          description={
            estimate.status === "draft"
              ? "Editable. Posting locks the estimate and creates the stock OUT movement."
              : estimate.status === "posted"
                ? estimate.is_billed
                  ? "Posted and billed. Tax invoice has been raised."
                  : "Posted. Goods are out for delivery. Promote to an invoice when you're ready to bill."
                : "Cancelled. Original kept for audit."
          }
          badge={
            <div className="flex items-center gap-1.5">
              <StatusBadge status={estimate.status} />
              {estimate.is_billed
                ? <Badge tone="green">Billed</Badge>
                : estimate.status === "posted" ? <Badge tone="blue">Pending invoice</Badge> : null}
            </div>
          }
        />

        {/* Linked invoice banner */}
        {estimate.invoice_id && (
          <div className="bg-status-blue-bg border border-status-blue/20 rounded-md p-3 text-[12.5px] text-status-blue-text flex items-center justify-between">
            <div>
              <div className="font-semibold mb-0.5">Linked invoice</div>
              <div>This estimate was promoted to a tax invoice.</div>
            </div>
            <Link href={`/invoices/${estimate.invoice_id}`} className="font-mono font-medium hover:underline">
              Open invoice →
            </Link>
          </div>
        )}

        {/* Cancellation banner */}
        {estimate.status === "cancelled" && estimate.cancellation_reason && (
          <div className="bg-status-red-bg border border-status-red/20 rounded-md p-3 text-[12.5px] text-status-red-text">
            <div className="font-semibold mb-1">Cancellation reason</div>
            <div>{estimate.cancellation_reason}</div>
            {estimate.cancelled_at && (
              <div className="font-mono text-[11px] mt-1.5 text-foreground-muted">
                Cancelled {formatDate(estimate.cancelled_at)}
              </div>
            )}
          </div>
        )}

        {/* Header card */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Customer" value={party ? `${party.name} (${party.code})` : "—"} />
            <Field label="Route" value={route ? `${route.code} · ${route.name}` : "—"} />
            {/* Print mode is editable inline so the user can flip between
                with/without amounts without navigating to print preview.
                Disabled while save is in flight. Operator + admin both
                can write estimates, so no extra perm gate beyond <Can>. */}
            <div className="min-w-0">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                Print mode
              </div>
              <Can perm="inventory.estimates.write" fallback={
                <div className="text-sm font-medium mt-0.5">
                  {estimate.print_mode === "with_remarks" ? "With amounts" : "No amounts"}
                </div>
              }>
                <div className="mt-1 inline-flex rounded border border-hairline overflow-hidden text-[12px]">
                  <button
                    type="button"
                    onClick={() => estimate.print_mode !== "no_amount" && printModeMut.mutate("no_amount")}
                    disabled={printModeMut.isPending}
                    className={`px-2.5 py-1 transition-colors ${
                      estimate.print_mode === "no_amount"
                        ? "bg-brand text-white font-medium"
                        : "bg-white text-foreground-secondary hover:bg-surface"
                    }`}
                  >
                    No amounts
                  </button>
                  <button
                    type="button"
                    onClick={() => estimate.print_mode !== "with_remarks" && printModeMut.mutate("with_remarks")}
                    disabled={printModeMut.isPending}
                    className={`px-2.5 py-1 transition-colors border-l border-hairline ${
                      estimate.print_mode === "with_remarks"
                        ? "bg-brand text-white font-medium"
                        : "bg-white text-foreground-secondary hover:bg-surface"
                    }`}
                  >
                    With amounts
                  </button>
                </div>
              </Can>
              <p className="text-[10.5px] text-foreground-muted mt-1 leading-relaxed">
                {estimate.print_mode === "no_amount"
                  ? "Driver / customer copy — products + qty only."
                  : "Billing copy — amounts shown in the remarks column."}
              </p>
            </div>
            <Field label="Estimate date" value={formatDate(estimate.estimate_date)} mono />
            <Field
              label={estimate.status === "posted" ? "Posted on" : "Created"}
              value={estimate.posting_date ? formatDate(estimate.posting_date) : formatDate(estimate.created_at)}
              mono
            />
            <Field
              label="Bill toggle"
              value={estimate.is_billed ? "An invoice will follow" : "No bill (cash / estimate)"}
            />
          </div>

          {(estimate.vehicle_number || estimate.driver_name) && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-2">
                Dispatch
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {estimate.vehicle_number && <Field label="Vehicle" value={estimate.vehicle_number} mono />}
                {estimate.driver_name && <Field label="Driver" value={estimate.driver_name} />}
                {estimate.driver_phone && <Field label="Phone" value={estimate.driver_phone} mono />}
              </div>
            </div>
          )}

          {estimate.destination_address && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-1">
                Destination
              </div>
              <div className="text-sm text-foreground-secondary whitespace-pre-line">
                {estimate.destination_address}
              </div>
            </div>
          )}

          {estimate.remarks && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-1">
                Remarks
              </div>
              <div className="text-sm text-foreground-secondary">{estimate.remarks}</div>
            </div>
          )}
        </section>

        {/* Lines */}
        <section className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-hairline">
            <h2 className="text-sm font-semibold">Lines</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">#</th>
                  <th className="text-left px-4 py-2.5">Item</th>
                  <th className="text-right px-4 py-2.5">Qty</th>
                  <th className="text-right px-4 py-2.5">Unit price</th>
                  <th className="text-right px-4 py-2.5">Disc %</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-hairline-light">
                    <td className="px-4 py-2.5 text-foreground-muted text-xs">{l.line_number}</td>
                    <td className="px-4 py-2.5"><div className="font-medium text-sm">{l.description}</div></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.unit_price}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.discount_pct}</td>
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
            <Row label="Sub-total" value={estimate.subtotal} />
            {parseFloat(estimate.discount_total) > 0 && (
              <Row label="Discount" value={`− ${estimate.discount_total}`} muted />
            )}
            <div className="pt-2 mt-2 border-t border-hairline">
              <Row label="Grand total" value={`₹ ${estimate.grand_total}`} bold />
            </div>
            <div className="pt-2 mt-2 text-[11px] text-foreground-muted italic leading-snug">
              Estimates are not tax documents — no GST shown. Promote to an invoice to add tax.
            </div>
          </dl>
        </section>
      </div>

      <ConfirmDialog
        open={showPost}
        onClose={() => setShowPost(false)}
        onConfirm={() => postMut.mutate()}
        title={`Post ${estimate.estimate_number}?`}
        description="Posting locks the estimate and creates stock OUT movements. Use Cancel to reverse if dispatch fails."
        confirmLabel="Post estimate"
        confirmKind="primary"
        loading={postMut.isPending}
      />

      <ConfirmDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMut.mutate()}
        title={`Cancel ${estimate.estimate_number}?`}
        description="Cancellation creates reversal movements. Original kept for audit. If a linked invoice exists, cancel that first."
        confirmLabel="Cancel estimate"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />

      <ConfirmDialog
        open={showPromote}
        onClose={() => setShowPromote(false)}
        onConfirm={() => promoteMut.mutate()}
        title={`Promote ${estimate.estimate_number} to invoice?`}
        description="Creates a draft tax invoice with these lines. GST is added based on each item's default rate and the customer's place of supply (CGST+SGST same-state, IGST inter-state). The estimate flips to 'billed'."
        confirmLabel="Create invoice"
        confirmKind="primary"
        loading={promoteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function StatusBadge({ status }: { status: EstimateStatus }) {
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

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={`${bold ? "font-semibold text-foreground" : muted ? "text-foreground-muted" : "text-foreground-secondary"}`}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold text-foreground text-base" : muted ? "text-foreground-muted" : ""}`}>{value}</dd>
    </div>
  );
}
