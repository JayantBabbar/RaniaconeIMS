"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { countService } from "@/services/counts.service";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import { isApiError } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import type { CountLine } from "@/types";
import {
  ArrowLeft, Plus, Trash2, CheckCircle, AlertTriangle, ClipboardList,
} from "lucide-react";

export default function CountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canRead = can("inventory.counts.read");
  const canWrite = can("inventory.counts.write");
  const canApply = can("inventory.counts.apply");
  const [showAddLine, setShowAddLine] = useState(false);
  const [deleteLineTarget, setDeleteLineTarget] = useState<CountLine | null>(null);
  const [applyConfirm, setApplyConfirm] = useState(false);

  const { data: count, isLoading } = useQuery({
    queryKey: ["count", id],
    queryFn: () => countService.getById(id),
    enabled: !!id && canRead,
  });
  const { data: linesRaw } = useQuery({
    queryKey: ["countLines", id],
    queryFn: () => countService.listLines(id),
    enabled: !!id,
  });
  const { data: itemsRaw } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });

  const lines = linesRaw?.data || [];
  const items = itemsRaw?.data || [];
  const locations = locsRaw?.data || [];
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const updateLineMut = useMutation({
    mutationFn: ({ lineId, counted_qty }: { lineId: string; counted_qty: string }) =>
      countService.updateLine(id, lineId, { counted_qty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["countLines", id] }),
    onError: (e) => toast.error(isApiError(e) ? e.message : "Update failed"),
  });

  const deleteLineMut = useMutation({
    mutationFn: (lineId: string) => countService.deleteLine(id, lineId),
    onSuccess: () => {
      toast.success("Line removed");
      qc.invalidateQueries({ queryKey: ["countLines", id] });
      setDeleteLineTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  const applyMut = useMutation({
    mutationFn: () => countService.apply(id),
    onSuccess: () => {
      toast.success("Count applied", "Adjustment movements created for variances");
      qc.invalidateQueries({ queryKey: ["count", id] });
      qc.invalidateQueries({ queryKey: ["countLines", id] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      setApplyConfirm(false);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Apply failed"),
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Operations", "Stock Counts"]} missingPerm="inventory.counts.read" />;
  }
  if (isLoading || !count) return <PageLoading />;

  const loc = locations.find((l) => l.id === count.location_id);
  const totalLines = lines.length;
  const completedLines = lines.filter((l) => l.counted_qty !== null && l.counted_qty !== undefined).length;
  const variances = lines.filter((l) => {
    const c = parseFloat(l.counted_qty || "0");
    const s = parseFloat(l.system_qty || "0");
    return l.counted_qty !== null && l.counted_qty !== undefined && c !== s;
  });

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Stock Counts", count.count_number]}
        right={
          canApply && (
            <Button kind="primary" icon={<CheckCircle size={13} />}
              disabled={totalLines === 0 || completedLines < totalLines}
              onClick={() => setApplyConfirm(true)}>
              Apply Count
            </Button>
          )
        }
      />
      <div className="p-5 space-y-4">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Summary */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <PageHeader
                title={count.count_number}
                description="Add the items you're counting, record actual quantities, review variances, then apply."
                learnMore="The 'Apply' button is irreversible in that it creates real stock movements. Review the variance tab before applying — any typo becomes an actual booking. Unapplied counts can be edited or discarded without side effects."
              />
              <div className="text-xs text-foreground-muted mt-1 font-mono">
                {formatDate(count.count_date)} · {loc?.code} {loc?.name}
              </div>
            </div>
            <div className="flex gap-3 text-sm flex-shrink-0">
              <Kpi label="Lines" value={totalLines.toString()} />
              <Kpi label="Completed" value={completedLines.toString()} />
              <Kpi label="Variances" value={variances.length.toString()}
                tone={variances.length > 0 ? "amber" : undefined} />
            </div>
          </div>
          {count.remarks && (
            <div className="mt-3 pt-3 border-t border-hairline-light text-sm text-foreground-secondary">
              {count.remarks}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-hairline-light">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Count lines</h2>
              <Badge tone="neutral">{totalLines}</Badge>
            </div>
            {canWrite && (
              <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAddLine(true)}>
                Add item
              </Button>
            )}
          </div>

          {lines.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="No items added to this count yet"
              description={
                canWrite
                  ? "Pick the items you'll be counting. The current system balance is snapshotted for each one — enter the counted number as you go."
                  : "No items have been added to this count session yet."
              }
              action={
                canWrite && <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAddLine(true)}>Add your first item</Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Item</th>
                  <th className="text-right px-4 py-2.5">System qty</th>
                  <th className="text-right px-4 py-2.5 w-32">Counted qty</th>
                  <th className="text-right px-4 py-2.5">Variance</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const item = itemMap.get(l.item_id);
                  const sys = parseFloat(l.system_qty || "0");
                  const counted = l.counted_qty ? parseFloat(l.counted_qty) : null;
                  const variance = counted !== null ? counted - sys : null;
                  return (
                    <tr key={l.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{item?.item_code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground-secondary">{l.system_qty}</td>
                      <td className="px-4 py-2.5 text-right">
                        <CountedInput
                          key={l.id + (l.counted_qty || "")}
                          initial={l.counted_qty || ""}
                          disabled={!canWrite || updateLineMut.isPending}
                          onBlur={(v) => {
                            if (canWrite && v !== (l.counted_qty || "")) {
                              updateLineMut.mutate({ lineId: l.id, counted_qty: v });
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {variance === null ? (
                          <span className="text-foreground-muted">—</span>
                        ) : variance === 0 ? (
                          <span className="text-foreground-muted">0</span>
                        ) : variance > 0 ? (
                          <span className="text-status-green-text">+{variance.toFixed(3)}</span>
                        ) : (
                          <span className="text-status-red-text">{variance.toFixed(3)}</span>
                        )}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => setDeleteLineTarget(l)}
                            className="text-foreground-muted hover:text-status-red-text">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {variances.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2 text-sm text-amber-900 max-w-3xl">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>{variances.length} line(s) have variances.</strong> Applying this count will
              create adjustment IN movements for positive variances and OUT movements for negatives
              (FIFO-costed).
            </div>
          </div>
        )}
      </div>

      {showAddLine && (
        <AddLineModal countId={id} items={items} onClose={() => setShowAddLine(false)} />
      )}
      <ConfirmDialog
        open={!!deleteLineTarget}
        onClose={() => setDeleteLineTarget(null)}
        onConfirm={() => deleteLineTarget && deleteLineMut.mutate(deleteLineTarget.id)}
        title="Remove this item from the count?"
        description="Drops this line before the count is applied — no stock movements are created. You can re-add it later if needed."
        confirmLabel="Remove"
        confirmKind="danger"
        loading={deleteLineMut.isPending}
      />
      <ConfirmDialog
        open={applyConfirm}
        onClose={() => setApplyConfirm(false)}
        onConfirm={() => applyMut.mutate()}
        title="Apply this count?"
        description={`Every line with a non-zero variance (${variances.length} in total) will book a stock adjustment movement. The count itself becomes read-only and appears in the audit trail. Do a final review of the variance column before confirming.`}
        confirmLabel="Apply"
        confirmKind="primary"
        loading={applyMut.isPending}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "amber" | "green" }) {
  return (
    <div className="text-right">
      <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">{label}</div>
      <div className={
        "text-lg font-semibold tabular-nums mt-0.5 " +
        (tone === "amber" ? "text-status-amber-text" : "")
      }>{value}</div>
    </div>
  );
}

function CountedInput({
  initial, disabled, onBlur,
}: { initial: string; disabled?: boolean; onBlur: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  return (
    <input
      type="number" step="0.001"
      value={val}
      disabled={disabled}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onBlur(val)}
      className="w-24 h-[28px] px-2 text-right text-sm font-medium tabular-nums bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
    />
  );
}

function AddLineModal({
  countId, items, onClose,
}: {
  countId: string;
  items: { id: string; item_code: string; name: string }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [itemId, setItemId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) {
      setErrors({ item_id: "Select an item" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await countService.createLine(countId, { item_id: itemId });
      qc.invalidateQueries({ queryKey: ["countLines", countId] });
      toast.success("Line added", "System qty snapshotted");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error("Add failed");
      }
    } finally { setLoading(false); }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add an item to the count"
      description="Pick an item to include in this count session. The system snapshots its current balance so you can record the physical count next to it."
      width="sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <FormField label="Item" required error={errors.item_id} help="The item you're about to count physically. You'll enter the counted quantity in the lines table.">
          <select value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              if (errors.item_id) setErrors({ ...errors, item_id: "" });
            }}
            className={cn(
              "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
              errors.item_id ? "border-status-red" : "border-hairline"
            )}>
            <option value="">— Select —</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </FormField>
        <p className="text-xs text-foreground-muted">
          System qty snapshots from the current inventory balance at this location the moment the line is added.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}
