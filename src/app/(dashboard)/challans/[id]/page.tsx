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
import { challanService, routeService } from "@/services/challans.service";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import type { ChallanStatus } from "@/types";
import { ArrowLeft, Lock, X as XIcon, Printer, ReceiptText } from "lucide-react";

export default function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [showPost, setShowPost] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  const { data: challan, isLoading } = useQuery({
    queryKey: ["challan", id],
    queryFn: () => challanService.getById(id),
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["challanLines", id],
    queryFn: () => challanService.listLines(id),
    enabled: !!id,
  });

  const { data: party } = useQuery({
    queryKey: ["party", challan?.party_id],
    queryFn: () => (challan?.party_id ? partyService.getById(challan.party_id) : null),
    enabled: !!challan?.party_id,
  });

  const { data: route } = useQuery({
    queryKey: ["route", challan?.route_id],
    queryFn: () => (challan?.route_id ? routeService.getById(challan.route_id) : null),
    enabled: !!challan?.route_id,
  });

  const postMut = useMutation({
    mutationFn: () => challanService.post(id),
    onSuccess: () => {
      toast.success("Challan posted", "Stock OUT movements created.");
      qc.invalidateQueries({ queryKey: ["challan", id] });
      qc.invalidateQueries({ queryKey: ["challans"] });
      setShowPost(false);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not post challan"),
  });

  // Phase 12: print-mode toggle directly from the detail page so the
  // user doesn't have to navigate to print preview just to change the
  // mode. Per spec §8 — challans default to no_amount; flip to
  // with_remarks when the customer asked for a priced challan.
  const printModeMut = useMutation({
    mutationFn: (mode: "no_amount" | "with_remarks") =>
      challanService.update(id, { print_mode: mode }),
    onSuccess: () => {
      toast.success("Print mode updated");
      qc.invalidateQueries({ queryKey: ["challan", id] });
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not update print mode"),
  });

  const cancelMut = useMutation({
    mutationFn: () => challanService.cancel(id, "Cancelled from detail page"),
    onSuccess: () => {
      toast.success("Challan cancelled");
      qc.invalidateQueries({ queryKey: ["challan", id] });
      qc.invalidateQueries({ queryKey: ["challans"] });
      setShowCancel(false);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not cancel challan"),
  });

  const promoteMut = useMutation({
    mutationFn: () => challanService.promoteToInvoice(id),
    onSuccess: ({ invoice }) => {
      toast.success("Invoice created", `Draft ${invoice.invoice_number}.`);
      qc.invalidateQueries({ queryKey: ["challan", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not promote challan"),
  });

  if (isLoading || !challan) return <PageLoading />;

  return (
    <RequireRead perm="inventory.challans.read" crumbs={["Billing", "Challans", challan.challan_number]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Challans", challan.challan_number]}
        right={
          <>
            <Link href={`/challans/${challan.id}/print`}>
              <Button icon={<Printer size={13} />}>Print</Button>
            </Link>
            {challan.status === "draft" && (
              <Can perm="inventory.challans.post">
                <Button kind="primary" onClick={() => setShowPost(true)} icon={<Lock size={13} />}>
                  Post challan
                </Button>
              </Can>
            )}
            {challan.status === "posted" && !challan.is_billed && (
              <Can perm="inventory.invoices.write">
                <Button kind="primary" onClick={() => setShowPromote(true)} icon={<ReceiptText size={13} />}>
                  Convert to invoice
                </Button>
              </Can>
            )}
            {challan.status === "posted" && (
              <Can perm="inventory.challans.cancel">
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
          onClick={() => router.push("/challans")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to challans
        </button>

        <PageHeader
          title={challan.challan_number}
          description={
            challan.status === "draft"
              ? "Editable. Posting locks the challan and creates the stock OUT movement."
              : challan.status === "posted"
                ? challan.is_billed
                  ? "Posted and billed. Tax invoice has been raised."
                  : "Posted. Goods are out for delivery. Promote to an invoice when you're ready to bill."
                : "Cancelled. Original kept for audit."
          }
          badge={
            <div className="flex items-center gap-1.5">
              <StatusBadge status={challan.status} />
              {challan.is_billed
                ? <Badge tone="green">Billed</Badge>
                : challan.status === "posted" ? <Badge tone="blue">Pending invoice</Badge> : null}
            </div>
          }
        />

        {/* Linked invoice banner */}
        {challan.invoice_id && (
          <div className="bg-status-blue-bg border border-status-blue/20 rounded-md p-3 text-[12.5px] text-status-blue-text flex items-center justify-between">
            <div>
              <div className="font-semibold mb-0.5">Linked invoice</div>
              <div>This challan was promoted to a tax invoice.</div>
            </div>
            <Link href={`/invoices/${challan.invoice_id}`} className="font-mono font-medium hover:underline">
              Open invoice →
            </Link>
          </div>
        )}

        {/* Cancellation banner */}
        {challan.status === "cancelled" && challan.cancellation_reason && (
          <div className="bg-status-red-bg border border-status-red/20 rounded-md p-3 text-[12.5px] text-status-red-text">
            <div className="font-semibold mb-1">Cancellation reason</div>
            <div>{challan.cancellation_reason}</div>
            {challan.cancelled_at && (
              <div className="font-mono text-[11px] mt-1.5 text-foreground-muted">
                Cancelled {formatDate(challan.cancelled_at)}
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
                can write challans, so no extra perm gate beyond <Can>. */}
            <div className="min-w-0">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                Print mode
              </div>
              <Can perm="inventory.challans.write" fallback={
                <div className="text-sm font-medium mt-0.5">
                  {challan.print_mode === "with_remarks" ? "With amounts" : "No amounts"}
                </div>
              }>
                <div className="mt-1 inline-flex rounded border border-hairline overflow-hidden text-[12px]">
                  <button
                    type="button"
                    onClick={() => challan.print_mode !== "no_amount" && printModeMut.mutate("no_amount")}
                    disabled={printModeMut.isPending}
                    className={`px-2.5 py-1 transition-colors ${
                      challan.print_mode === "no_amount"
                        ? "bg-brand text-white font-medium"
                        : "bg-white text-foreground-secondary hover:bg-surface"
                    }`}
                  >
                    No amounts
                  </button>
                  <button
                    type="button"
                    onClick={() => challan.print_mode !== "with_remarks" && printModeMut.mutate("with_remarks")}
                    disabled={printModeMut.isPending}
                    className={`px-2.5 py-1 transition-colors border-l border-hairline ${
                      challan.print_mode === "with_remarks"
                        ? "bg-brand text-white font-medium"
                        : "bg-white text-foreground-secondary hover:bg-surface"
                    }`}
                  >
                    With amounts
                  </button>
                </div>
              </Can>
              <p className="text-[10.5px] text-foreground-muted mt-1 leading-relaxed">
                {challan.print_mode === "no_amount"
                  ? "Driver / customer copy — products + qty only."
                  : "Billing copy — amounts shown in the remarks column."}
              </p>
            </div>
            <Field label="Challan date" value={formatDate(challan.challan_date)} mono />
            <Field
              label={challan.status === "posted" ? "Posted on" : "Created"}
              value={challan.posting_date ? formatDate(challan.posting_date) : formatDate(challan.created_at)}
              mono
            />
            <Field
              label="Bill toggle"
              value={challan.is_billed ? "An invoice will follow" : "No bill (cash / estimate)"}
            />
          </div>

          {(challan.vehicle_number || challan.driver_name) && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-2">
                Dispatch
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {challan.vehicle_number && <Field label="Vehicle" value={challan.vehicle_number} mono />}
                {challan.driver_name && <Field label="Driver" value={challan.driver_name} />}
                {challan.driver_phone && <Field label="Phone" value={challan.driver_phone} mono />}
              </div>
            </div>
          )}

          {challan.destination_address && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-1">
                Destination
              </div>
              <div className="text-sm text-foreground-secondary whitespace-pre-line">
                {challan.destination_address}
              </div>
            </div>
          )}

          {challan.remarks && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-1">
                Remarks
              </div>
              <div className="text-sm text-foreground-secondary">{challan.remarks}</div>
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
            <Row label="Sub-total" value={challan.subtotal} />
            {parseFloat(challan.discount_total) > 0 && (
              <Row label="Discount" value={`− ${challan.discount_total}`} muted />
            )}
            <div className="pt-2 mt-2 border-t border-hairline">
              <Row label="Grand total" value={`₹ ${challan.grand_total}`} bold />
            </div>
            <div className="pt-2 mt-2 text-[11px] text-foreground-muted italic leading-snug">
              Challans are not tax documents — no GST shown. Promote to an invoice to add tax.
            </div>
          </dl>
        </section>
      </div>

      <ConfirmDialog
        open={showPost}
        onClose={() => setShowPost(false)}
        onConfirm={() => postMut.mutate()}
        title={`Post ${challan.challan_number}?`}
        description="Posting locks the challan and creates stock OUT movements. Use Cancel to reverse if dispatch fails."
        confirmLabel="Post challan"
        confirmKind="primary"
        loading={postMut.isPending}
      />

      <ConfirmDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMut.mutate()}
        title={`Cancel ${challan.challan_number}?`}
        description="Cancellation creates reversal movements. Original kept for audit. If a linked invoice exists, cancel that first."
        confirmLabel="Cancel challan"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />

      <ConfirmDialog
        open={showPromote}
        onClose={() => setShowPromote(false)}
        onConfirm={() => promoteMut.mutate()}
        title={`Promote ${challan.challan_number} to invoice?`}
        description="Creates a draft tax invoice with these lines. GST is added based on each item's default rate and the customer's place of supply (CGST+SGST same-state, IGST inter-state). The challan flips to 'billed'."
        confirmLabel="Create invoice"
        confirmKind="primary"
        loading={promoteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function StatusBadge({ status }: { status: ChallanStatus }) {
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
