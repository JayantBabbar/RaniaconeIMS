"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { invoiceService } from "@/services/invoices.service";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { stateName } from "@/lib/gst";
import type { Invoice, InvoiceStatus } from "@/types";
import { Plus, ReceiptText, Eye, Edit, Trash2, Lock, X as XIcon, Printer } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Invoices List
//
// RBAC: visible to anyone with `inventory.invoices.read`. Per-row
// actions cascade from the same model — Edit/Delete only for drafts
// AND only with `inventory.invoices.write`. Post requires
// `inventory.invoices.post`. Cancel requires `inventory.invoices.cancel`.
// Each gate is a separate <Can> so tenants can grant any subset.
// ═══════════════════════════════════════════════════════════════════

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

export default function InvoicesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [postTarget, setPostTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoiceService.list({ limit: 200 }),
  });

  const { data: partiesRaw } = useQuery({
    queryKey: ["partiesForInvoiceList"],
    queryFn: () => partyService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const parties = partiesRaw?.data || [];
  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  // ── Mutations: post + cancel + delete (each gated separately) ─
  const postMut = useMutation({
    mutationFn: (id: string) => invoiceService.post(id),
    onSuccess: () => {
      toast.success("Invoice posted", "Stock movements created. Invoice is now locked.");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setPostTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Could not post invoice");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (target: Invoice) => invoiceService.cancel(target.id, "Cancelled from invoice list"),
    onSuccess: () => {
      toast.success("Invoice cancelled", "Reversal movements posted. Original kept for audit.");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setCancelTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Could not cancel invoice");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoiceService.delete(id),
    onSuccess: () => {
      toast.success("Invoice deleted");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Could not delete invoice");
    },
  });

  // ── Table column config ───────────────────────────────────────
  const columns: ColumnDef<Invoice>[] = [
    { key: "invoice_number", label: "Number", sortable: true, filterType: "text" },
    { key: "invoice_date", label: "Date", sortable: true },
    {
      key: "party_id",
      label: "Customer",
      sortable: true,
      filterType: "text",
      getValue: (r) => partyMap.get(r.party_id)?.name || "",
    },
    {
      key: "place_of_supply",
      label: "Place of supply",
      filterType: "text",
      getValue: (r) => stateName(r.place_of_supply),
    },
    { key: "grand_total", label: "Total", sortable: true, getValue: (r) => parseFloat(r.grand_total) },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterType: "select",
      options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
    },
  ];

  const {
    rows,
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAll,
    activeFilterCount,
  } = useTableFilters({ data: invoices, columns });

  const totals = useMemo(() => {
    const draft = rows.filter((r) => r.status === "draft").length;
    const posted = rows.filter((r) => r.status === "posted").length;
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    return { draft, posted, cancelled };
  }, [rows]);

  return (
    <RequireRead perm="inventory.invoices.read" crumbs={["Billing", "Invoices"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Invoices"]}
        right={
          <Can perm="inventory.invoices.write">
            <Link href="/invoices/new">
              <Button kind="primary" icon={<Plus size={13} />}>New Invoice</Button>
            </Link>
          </Can>
        }
      />

      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Invoices"
          description="Tax invoices issued to customers. Drafts are editable; posting locks the invoice and creates the stock + ledger entries. Cancellation creates a reversal — the original always stays in the audit trail."
          learnMore="GST math is computed automatically per line: same-state place of supply splits the rate into CGST + SGST, inter-state applies the full rate as IGST. Override per line if the supply needs a non-standard rate."
          badge={
            <div className="flex items-center gap-1.5">
              <Badge tone="neutral">{rows.length}{rows.length !== invoices.length ? ` / ${invoices.length}` : ""}</Badge>
              <Badge tone="amber">{totals.draft} draft</Badge>
              <Badge tone="green">{totals.posted} posted</Badge>
              {totals.cancelled > 0 && <Badge tone="red">{totals.cancelled} cancelled</Badge>}
            </div>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by number, customer, place of supply…"
          />
          <div className="flex-1" />
          {activeFilterCount > 0 && (
            <span className="text-[11px] text-foreground-muted">
              {rows.length} match{rows.length === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <ActiveFilterBar
            columns={columns}
            search={search}
            setSearch={setSearch}
            columnFilters={columnFilters}
            clearColumnFilter={clearColumnFilter}
            clearAll={clearAll}
            activeFilterCount={activeFilterCount}
          />
        )}

        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ReceiptText size={22} />}
              title={activeFilterCount > 0 ? "No invoices match those filters" : "No invoices yet"}
              description={
                activeFilterCount > 0
                  ? "Loosen the filters or clear them to start over."
                  : can("inventory.invoices.write")
                    ? "Create your first tax invoice. Drafts are editable; posting creates the stock movements."
                    : "No invoices have been created yet. Once your colleagues issue some, they'll appear here."
              }
              action={
                activeFilterCount === 0 && can("inventory.invoices.write") ? (
                  <Link href="/invoices/new">
                    <Button kind="primary" icon={<Plus size={13} />}>New Invoice</Button>
                  </Link>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Number</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Date</SortHeader>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Customer</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">Place of supply</th>
                  <th className="text-right px-4 py-2.5">
                    <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="right">Total</SortHeader>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[5]} sort={sort} toggleSort={toggleSort} align="center">Status</SortHeader>
                      <ColumnFilter col={columns[5]} value={columnFilters[columns[5].key]} onChange={(v) => setColumnFilter(columns[5].key, v)} />
                    </div>
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const party = partyMap.get(inv.party_id);
                  return (
                    <tr key={inv.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/invoices/${inv.id}`} className="font-mono text-xs font-bold text-brand hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-2.5">
                        {party ? (
                          <>
                            <div className="font-medium">{party.name}</div>
                            <div className="text-xs text-foreground-muted font-mono">{party.code}</div>
                          </>
                        ) : <span className="text-foreground-muted">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-foreground-secondary">
                        {stateName(inv.place_of_supply)}
                        <span className="text-xs text-foreground-muted font-mono ml-1.5">{inv.place_of_supply}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        ₹ {parseFloat(inv.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <ActionMenu
                          items={buildRowActions(inv, {
                            canWrite: can("inventory.invoices.write"),
                            canPost: can("inventory.invoices.post"),
                            canCancel: can("inventory.invoices.cancel"),
                            onPost: () => setPostTarget(inv),
                            onCancel: () => setCancelTarget(inv),
                            onDelete: () => setDeleteTarget(inv),
                          })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!postTarget}
        onClose={() => setPostTarget(null)}
        onConfirm={() => postTarget && postMut.mutate(postTarget.id)}
        title={`Post ${postTarget?.invoice_number}?`}
        description="Posting locks the invoice and creates stock OUT movements + ledger entries. The invoice is no longer editable. To undo, cancel — which creates a reversal but keeps the original for audit."
        confirmLabel="Post invoice"
        confirmKind="primary"
        loading={postMut.isPending}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMut.mutate(cancelTarget)}
        title={`Cancel ${cancelTarget?.invoice_number}?`}
        description="Cancellation creates reversal movements and reverses the ledger entries. The original invoice stays in the audit trail with status=cancelled — nothing is silently rewritten."
        confirmLabel="Cancel invoice"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete ${deleteTarget?.invoice_number}?`}
        description="Drafts are deletable — they never created a stock movement. Posted invoices cannot be deleted; cancel them instead."
        confirmLabel="Delete draft"
        confirmKind="danger"
        loading={deleteMut.isPending}
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

interface RowActionDeps {
  canWrite: boolean;
  canPost: boolean;
  canCancel: boolean;
  onPost: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function buildRowActions(inv: Invoice, deps: RowActionDeps) {
  const items: Array<
    | { label: string; icon?: React.ReactNode; href?: string; onClick?: () => void; danger?: boolean }
    | { divider: true; label: "" }
  > = [
    { label: "View", icon: <Eye size={12} />, href: `/invoices/${inv.id}` },
    { label: "Print", icon: <Printer size={12} />, href: `/invoices/${inv.id}/print` },
  ];

  if (inv.status === "draft") {
    if (deps.canWrite) items.push({ label: "Edit", icon: <Edit size={12} />, href: `/invoices/${inv.id}` });
    if (deps.canPost) items.push({ label: "Post", icon: <Lock size={12} />, onClick: deps.onPost });
    if (deps.canWrite) {
      items.push({ divider: true, label: "" });
      items.push({ label: "Delete draft", icon: <Trash2 size={12} />, danger: true, onClick: deps.onDelete });
    }
  } else if (inv.status === "posted") {
    if (deps.canCancel) {
      items.push({ divider: true, label: "" });
      items.push({ label: "Cancel invoice", icon: <XIcon size={12} />, danger: true, onClick: deps.onCancel });
    }
  }
  // Cancelled invoices have no further actions

  return items;
}
