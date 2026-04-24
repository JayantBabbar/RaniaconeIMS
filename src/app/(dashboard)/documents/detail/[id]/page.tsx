"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading, Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { documentService } from "@/services/documents.service";
import { documentTypeService } from "@/services/master-data.service";
import { partyService } from "@/services/parties.service";
import { locationService } from "@/services/locations.service";
import { itemService } from "@/services/items.service";
import { uomService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import type { DocumentLine } from "@/types";
import {
  ArrowLeft, CheckCircle, XCircle, Plus, Trash2, FileText, Printer,
} from "lucide-react";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canRead = can("inventory.documents.read");
  const canWrite = can("inventory.documents.write");
  const canPost = can("inventory.documents.post");
  const canCancel = can("inventory.documents.cancel");
  const [postConfirm, setPostConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [deleteLineTarget, setDeleteLineTarget] = useState<DocumentLine | null>(null);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentService.getById(id),
    enabled: !!id && canRead,
  });
  const { data: linesRaw } = useQuery({
    queryKey: ["documentLines", id],
    queryFn: () => documentService.listLines(id),
    enabled: !!id,
  });
  const { data: typesRaw } = useQuery({
    queryKey: ["documentTypes"],
    queryFn: () => documentTypeService.list({ limit: 200 }),
  });
  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });
  const { data: itemsRaw } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const { data: uomsRaw } = useQuery({
    queryKey: ["uoms"],
    queryFn: () => uomService.list({ limit: 200 }),
  });

  const lines = linesRaw?.data || [];
  const items = itemsRaw?.data || [];
  const uoms = uomsRaw?.data || [];
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const uomMap = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);

  const postMut = useMutation({
    mutationFn: () => documentService.post(id),
    onSuccess: () => {
      toast.success("Document posted", "Stock movements created");
      qc.invalidateQueries({ queryKey: ["document", id] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      setPostConfirm(false);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Post failed"),
  });

  const cancelMut = useMutation({
    mutationFn: () => documentService.cancel(id),
    onSuccess: () => {
      toast.success("Document cancelled", "Reversal movements created if it was posted");
      qc.invalidateQueries({ queryKey: ["document", id] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      setCancelConfirm(false);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Cancel failed"),
  });

  const deleteLineMut = useMutation({
    mutationFn: (lineId: string) => documentService.deleteLine(id, lineId),
    onSuccess: () => {
      toast.success("Line deleted");
      qc.invalidateQueries({ queryKey: ["documentLines", id] });
      setDeleteLineTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Documents"]} missingPerm="inventory.documents.read" />;
  }
  if (isLoading || !doc) return <PageLoading />;

  const docType = typesRaw?.data.find((t) => t.id === doc.document_type_id);
  const party = partiesRaw?.data.find((p) => p.id === doc.party_id);
  const sourceLoc = locsRaw?.data.find((l) => l.id === doc.source_location_id);
  const destLoc = locsRaw?.data.find((l) => l.id === doc.destination_location_id);
  const posted = !!doc.posting_date;

  const lineTotal = lines.reduce((sum, l) => sum + parseFloat(l.line_total || "0"), 0);

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Documents", doc.document_number]}
        right={
          <>
            <Link href={`/documents/detail/${doc.id}/print`}>
              <Button icon={<Printer size={13} />}>Print</Button>
            </Link>
            {!posted ? (
              <>
                {canCancel && (
                  <Button icon={<XCircle size={13} />} onClick={() => setCancelConfirm(true)}>Cancel</Button>
                )}
                {canPost && (
                  <Button kind="primary" icon={<CheckCircle size={13} />}
                    onClick={() => setPostConfirm(true)} disabled={lines.length === 0}>
                    Post
                  </Button>
                )}
              </>
            ) : (
              canCancel && (
                <Button icon={<XCircle size={13} />} onClick={() => setCancelConfirm(true)}>
                  Cancel (creates reversals)
                </Button>
              )
            )}
          </>
        }
      />

      <div className="p-5 space-y-4">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Header card */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-semibold tracking-tight font-mono">{doc.document_number}</h1>
                {docType && <Badge tone="blue">{docType.code}</Badge>}
                {posted
                  ? <Badge tone="green">Posted</Badge>
                  : <Badge tone="amber">Draft</Badge>}
              </div>
              <p className="text-sm text-foreground-secondary mt-1 leading-relaxed max-w-2xl">
                {posted
                  ? "This document is posted — it has moved stock. Cancel to reverse with paired adjustment movements."
                  : "This document is a draft — you can still add/remove lines and edit anything before posting."}
              </p>
              <div className="text-xs text-foreground-muted mt-1">
                {docType?.name} · {formatDate(doc.document_date)}
              </div>
            </div>
            <div className="text-right text-sm flex-shrink-0">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">Line total</div>
              <div className="text-xl font-semibold tabular-nums">{lineTotal.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-hairline-light text-sm">
            <Row label="Party" value={party ? `${party.code} — ${party.name}` : "—"} />
            <Row label="Source" value={sourceLoc ? `${sourceLoc.code}` : "—"} />
            <Row label="Destination" value={destLoc ? `${destLoc.code}` : "—"} />
            <Row label="Posted at" value={doc.posting_date ? formatDate(doc.posting_date) : "—"} />
            <Row label="Created" value={formatDate(doc.created_at)} />
            <Row label="Version" value={String(doc.version)} />
          </div>
          {doc.remarks && (
            <div className="mt-4 pt-4 border-t border-hairline-light">
              <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-1">Remarks</div>
              <div className="text-sm">{doc.remarks}</div>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-hairline-light">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Line items</h2>
              <Badge tone="neutral">{lines.length}</Badge>
            </div>
            {!posted && canWrite && (
              <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAddLine(true)}>
                Add line
              </Button>
            )}
          </div>

          {lines.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title="No lines on this document yet"
              description={posted ? "This document was posted without any lines." : canWrite ? "Add at least one line (item + qty + price) before you can post this document." : "This draft has no lines yet."}
              action={!posted && canWrite && <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAddLine(true)}>Add your first line</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-right px-3 py-2.5 w-12">#</th>
                  <th className="text-left px-3 py-2.5">Item</th>
                  <th className="text-right px-3 py-2.5">Qty</th>
                  <th className="text-left px-3 py-2.5">UoM</th>
                  <th className="text-right px-3 py-2.5">Unit price</th>
                  <th className="text-right px-3 py-2.5">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.sort((a, b) => a.line_number - b.line_number).map((l) => {
                  const item = itemMap.get(l.item_id);
                  const uom = uomMap.get(l.uom_id);
                  return (
                    <tr key={l.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground-muted">{l.line_number}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-sm">{item?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{item?.item_code}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{l.quantity}</td>
                      <td className="px-3 py-2 text-xs">{uom?.code || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{parseFloat(l.unit_price).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{parseFloat(l.line_total).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        {!posted && canWrite && (
                          <button onClick={() => setDeleteLineTarget(l)}
                            className="text-foreground-muted hover:text-status-red-text">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddLine && (
        <AddLineModal
          documentId={id}
          items={items}
          uoms={uoms}
          onClose={() => setShowAddLine(false)}
          nextLineNumber={lines.length + 1}
        />
      )}

      <ConfirmDialog
        open={postConfirm}
        onClose={() => setPostConfirm(false)}
        onConfirm={() => postMut.mutate()}
        title="Post this document?"
        description="Posting creates real stock movements for every line and updates balances. After posting, the only way to undo is to Cancel — which creates reversal movements rather than deleting anything."
        confirmLabel="Post"
        confirmKind="primary"
        loading={postMut.isPending}
      />
      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={() => cancelMut.mutate()}
        title={posted ? "Cancel this posted document?" : "Cancel this draft?"}
        description={posted
          ? "Cancelling this document creates reversal stock movements — the goods effectively move back. This is permanent and will show in the audit trail. Draft documents that haven't posted can be deleted outright instead."
          : "This draft will be marked cancelled. You won't be able to post it, but it remains visible for audit."}
        confirmLabel="Cancel document"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />
      <ConfirmDialog
        open={!!deleteLineTarget}
        onClose={() => setDeleteLineTarget(null)}
        onConfirm={() => deleteLineTarget && deleteLineMut.mutate(deleteLineTarget.id)}
        title="Delete this line?"
        description="The line is removed from the draft. Other lines and the document itself are not affected. Only possible while the document is a draft."
        confirmLabel="Delete line"
        confirmKind="danger"
        loading={deleteLineMut.isPending}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}

const lineSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  uom_id: z.string().min(1, "UoM required"),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((v) => Number(v) > 0, "Must be greater than zero"),
  unit_price: z
    .string()
    .refine((v) => !v || Number(v) >= 0, "Cannot be negative"),
  discount_pct: z
    .string()
    .refine(
      (v) => {
        if (!v) return true;
        const n = Number(v);
        return n >= 0 && n <= 100;
      },
      "Must be between 0 and 100",
    ),
});

type LineFormValues = z.infer<typeof lineSchema>;

function AddLineModal({
  documentId, items, uoms, onClose, nextLineNumber,
}: {
  documentId: string;
  items: { id: string; item_code: string; name: string }[];
  uoms: { id: string; code: string; name: string }[];
  onClose: () => void;
  nextLineNumber: number;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LineFormValues>({
    resolver: zodResolver(lineSchema),
    defaultValues: {
      item_id: "",
      uom_id: "",
      quantity: "",
      unit_price: "0",
      discount_pct: "0",
    },
  });

  const onSubmit = async (data: LineFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await documentService.createLine(documentId, {
        item_id: data.item_id,
        uom_id: data.uom_id,
        quantity: data.quantity,
        unit_price: data.unit_price,
        discount_pct: data.discount_pct,
        line_number: nextLineNumber,
      });
      toast.success("Line added");
      qc.invalidateQueries({ queryKey: ["documentLines", documentId] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not add line. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Add line #${nextLineNumber}`}
      description="Pick an item, quantity, and unit price. Totals are computed automatically."
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <FormField label="Item" required error={errors.item_id?.message} help="The item being ordered, transferred, or received on this line.">
          <select
            className={cn(
              "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
              errors.item_id ? "border-status-red" : "border-hairline"
            )}
            disabled={submitting}
            {...register("item_id")}
          >
            <option value="">— Select —</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Quantity"
            type="number"
            step="0.001"
            placeholder="1"
            required
            help="Amount being moved or ordered, in the chosen UoM."
            error={errors.quantity?.message}
            disabled={submitting}
            {...register("quantity")}
          />
          <FormField label="UoM" required error={errors.uom_id?.message} help="Unit for the quantity above. Must match one of the item's configured UoMs.">
            <select
              className={cn(
                "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                errors.uom_id ? "border-status-red" : "border-hairline"
              )}
              disabled={submitting}
              {...register("uom_id")}
            >
              <option value="">—</option>
              {uoms.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </FormField>
          <Input
            label="Unit price"
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            help="Price per unit. For purchase documents this is the cost; for sales it's the sell price."
            error={errors.unit_price?.message}
            disabled={submitting}
            {...register("unit_price")}
          />
        </div>
        <Input
          label="Discount %"
          type="number"
          step="0.01"
          min={0}
          max={100}
          placeholder="0"
          help="Optional line-level discount as a percentage between 0 and 100."
          error={errors.discount_pct?.message}
          disabled={submitting}
          {...register("discount_pct")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Add line</Button>
        </div>
      </form>
    </Dialog>
  );
}
