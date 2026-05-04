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
import { challanService, routeService } from "@/services/challans.service";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import type { Challan, ChallanStatus } from "@/types";
import {
  Plus,
  ScrollText,
  Eye,
  Edit,
  Trash2,
  Lock,
  X as XIcon,
  Printer,
  ReceiptText,
} from "lucide-react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS: { value: ChallanStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ChallansPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const { can } = useCan();

  const [deleteTarget, setDeleteTarget] = useState<Challan | null>(null);
  const [postTarget, setPostTarget] = useState<Challan | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Challan | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Challan | null>(null);

  const { data: challans = [], isLoading } = useQuery({
    queryKey: ["challans"],
    queryFn: () => challanService.list({ limit: 200 }),
  });

  const { data: partiesRaw } = useQuery({
    queryKey: ["partiesForChallanList"],
    queryFn: () => partyService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const parties = partiesRaw?.data || [];
  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: () => routeService.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const routeMap = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  const postMut = useMutation({
    mutationFn: (id: string) => challanService.post(id),
    onSuccess: () => {
      toast.success("Challan posted", "Stock OUT movements created. Goods are out for delivery.");
      qc.invalidateQueries({ queryKey: ["challans"] });
      setPostTarget(null);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not post challan"),
  });

  const cancelMut = useMutation({
    mutationFn: (target: Challan) => challanService.cancel(target.id, "Cancelled from challan list"),
    onSuccess: () => {
      toast.success("Challan cancelled", "Reversal movements posted. Original kept for audit.");
      qc.invalidateQueries({ queryKey: ["challans"] });
      setCancelTarget(null);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not cancel challan"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => challanService.delete(id),
    onSuccess: () => {
      toast.success("Challan deleted");
      qc.invalidateQueries({ queryKey: ["challans"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not delete challan"),
  });

  const promoteMut = useMutation({
    mutationFn: (id: string) => challanService.promoteToInvoice(id),
    onSuccess: ({ invoice }) => {
      toast.success("Invoice created", `Draft ${invoice.invoice_number} ready for review.`);
      qc.invalidateQueries({ queryKey: ["challans"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not promote challan"),
  });

  const columns: ColumnDef<Challan>[] = [
    { key: "challan_number", label: "Number", sortable: true, filterType: "text" },
    { key: "challan_date", label: "Date", sortable: true },
    {
      key: "party_id",
      label: "Customer",
      sortable: true,
      filterType: "text",
      getValue: (r) => partyMap.get(r.party_id)?.name || "",
    },
    {
      key: "route_id",
      label: "Route",
      filterType: "text",
      getValue: (r) => (r.route_id ? routeMap.get(r.route_id)?.code || "" : ""),
    },
    { key: "vehicle_number", label: "Vehicle", filterType: "text" },
    { key: "grand_total", label: "Total", sortable: true, getValue: (r) => parseFloat(r.grand_total) },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterType: "select",
      options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
    },
    {
      key: "is_billed",
      label: "Billed",
      filterType: "boolean",
      getValue: (r) => r.is_billed,
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
  } = useTableFilters({ data: challans, columns });

  const counts = useMemo(() => ({
    draft: rows.filter((r) => r.status === "draft").length,
    posted: rows.filter((r) => r.status === "posted").length,
    pending: rows.filter((r) => r.status === "posted" && !r.is_billed).length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
  }), [rows]);

  return (
    <RequireRead perm="inventory.challans.read" crumbs={["Billing", "Challans"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Challans"]}
        right={
          <Can perm="inventory.challans.write">
            <Link href="/challans/new">
              <Button kind="primary" icon={<Plus size={13} />}>New Challan</Button>
            </Link>
          </Can>
        }
      />

      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Challans"
          description="Delivery notes for outbound goods. Posting locks the challan and creates stock OUT movements. A challan is later promoted to a tax Invoice — that's where GST is added on top."
          learnMore="Print mode toggles between two layouts: 'with remarks' shows amounts (admin / billing copy); 'no amount' hides prices (driver / customer copy). Pick a default per challan; override at print time."
          badge={
            <div className="flex items-center gap-1.5">
              <Badge tone="neutral">{rows.length}{rows.length !== challans.length ? ` / ${challans.length}` : ""}</Badge>
              <Badge tone="amber">{counts.draft} draft</Badge>
              <Badge tone="blue">{counts.pending} unbilled</Badge>
              <Badge tone="green">{counts.posted} posted</Badge>
              {counts.cancelled > 0 && <Badge tone="red">{counts.cancelled} cancelled</Badge>}
            </div>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by number, customer, vehicle…"
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
              icon={<ScrollText size={22} />}
              title={activeFilterCount > 0 ? "No challans match those filters" : "No challans yet"}
              description={
                activeFilterCount > 0
                  ? "Loosen the filters or clear them to start over."
                  : can("inventory.challans.write")
                    ? "Create your first challan. Drafts are editable; posting creates the stock OUT movement."
                    : "No challans have been issued yet."
              }
              action={
                activeFilterCount === 0 && can("inventory.challans.write") ? (
                  <Link href="/challans/new"><Button kind="primary" icon={<Plus size={13} />}>New Challan</Button></Link>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[920px]">
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
                  <th className="text-left px-4 py-2.5">Route</th>
                  <th className="text-left px-4 py-2.5">Vehicle</th>
                  <th className="text-right px-4 py-2.5">
                    <SortHeader col={columns[5]} sort={sort} toggleSort={toggleSort} align="right">Total</SortHeader>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[6]} sort={sort} toggleSort={toggleSort} align="center">Status</SortHeader>
                      <ColumnFilter col={columns[6]} value={columnFilters[columns[6].key]} onChange={(v) => setColumnFilter(columns[6].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">Billed</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const party = partyMap.get(c.party_id);
                  const route = c.route_id ? routeMap.get(c.route_id) : null;
                  return (
                    <tr key={c.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/challans/${c.id}`} className="font-mono text-xs font-bold text-brand hover:underline">
                          {c.challan_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(c.challan_date)}</td>
                      <td className="px-4 py-2.5">
                        {party ? (
                          <>
                            <div className="font-medium">{party.name}</div>
                            <div className="text-xs text-foreground-muted font-mono">{party.code}</div>
                          </>
                        ) : <span className="text-foreground-muted">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-foreground-secondary">
                        {route ? (
                          <span className="font-mono text-xs">{route.code}</span>
                        ) : <span className="text-foreground-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {c.vehicle_number || <span className="text-foreground-muted">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        ₹ {parseFloat(c.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {c.is_billed
                          ? <Badge tone="green">Billed</Badge>
                          : c.status === "posted" ? <Badge tone="blue">Pending</Badge>
                            : <span className="text-foreground-muted text-xs">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <ActionMenu
                          items={buildRowActions(c, {
                            canWrite: can("inventory.challans.write"),
                            canPost: can("inventory.challans.post"),
                            canCancel: can("inventory.challans.cancel"),
                            canPromote: can("inventory.invoices.write"),
                            onPost: () => setPostTarget(c),
                            onCancel: () => setCancelTarget(c),
                            onDelete: () => setDeleteTarget(c),
                            onPromote: () => setPromoteTarget(c),
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
        title={`Post ${postTarget?.challan_number}?`}
        description="Posting locks the challan and creates stock OUT movements at the source location. Use Cancel later to reverse if dispatch fails."
        confirmLabel="Post challan"
        confirmKind="primary"
        loading={postMut.isPending}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMut.mutate(cancelTarget)}
        title={`Cancel ${cancelTarget?.challan_number}?`}
        description="Cancellation creates reversal movements. Original stays in the audit trail. If this challan has been promoted to an invoice, cancel the invoice first."
        confirmLabel="Cancel challan"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete ${deleteTarget?.challan_number}?`}
        description="Drafts are deletable — they never created a stock movement. Posted challans cannot be deleted; cancel them instead."
        confirmLabel="Delete draft"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />

      <ConfirmDialog
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onConfirm={() => promoteTarget && promoteMut.mutate(promoteTarget.id)}
        title={`Promote ${promoteTarget?.challan_number} to invoice?`}
        description="Creates a draft tax invoice with these lines, adding GST math from each item's default rate + customer place-of-supply. The challan flips to 'billed' and links to the new invoice. You can review and post the invoice on the next screen."
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

interface RowActionDeps {
  canWrite: boolean;
  canPost: boolean;
  canCancel: boolean;
  canPromote: boolean;
  onPost: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onPromote: () => void;
}

function buildRowActions(c: Challan, deps: RowActionDeps) {
  const items: Array<
    | { label: string; icon?: React.ReactNode; href?: string; onClick?: () => void; danger?: boolean }
    | { divider: true; label: "" }
  > = [
    { label: "View", icon: <Eye size={12} />, href: `/challans/${c.id}` },
    { label: "Print", icon: <Printer size={12} />, href: `/challans/${c.id}/print` },
  ];

  if (c.status === "draft") {
    if (deps.canWrite) items.push({ label: "Edit", icon: <Edit size={12} />, href: `/challans/${c.id}` });
    if (deps.canPost)  items.push({ label: "Post", icon: <Lock size={12} />, onClick: deps.onPost });
    if (deps.canWrite) {
      items.push({ divider: true, label: "" });
      items.push({ label: "Delete draft", icon: <Trash2 size={12} />, danger: true, onClick: deps.onDelete });
    }
  } else if (c.status === "posted") {
    if (!c.is_billed && deps.canPromote) {
      items.push({ divider: true, label: "" });
      items.push({ label: "Convert to invoice", icon: <ReceiptText size={12} />, onClick: deps.onPromote });
    }
    if (deps.canCancel) {
      items.push({ divider: true, label: "" });
      items.push({ label: "Cancel challan", icon: <XIcon size={12} />, danger: true, onClick: deps.onCancel });
    }
  }

  return items;
}
