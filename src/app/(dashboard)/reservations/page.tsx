"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
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
import { reservationService } from "@/services/stock.service";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import { isApiError } from "@/lib/api-client";
import { Plus, Lock, CheckCircle, XCircle } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

export default function ReservationsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.reservations.write");
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: () =>
      reservationService.list({
        limit: 200,
      }),
  });
  const { data: itemsRaw } = useQuery({
    queryKey: ["itemsForMap"], queryFn: () => itemService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locationsForMap"], queryFn: () => locationService.list({ limit: 200 }),
  });

  const allRows = data ?? [];
  const items = itemsRaw?.data || [];
  const locations = locsRaw?.data || [];
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  type Reservation = (typeof allRows)[number];

  const columns: ColumnDef<Reservation>[] = [
    { key: "created_at", label: "Created", sortable: true },
    {
      key: "item_id",
      label: "Item",
      sortable: true,
      searchable: true,
      filterType: "text",
      getValue: (r) => itemMap.get(r.item_id)?.name || "",
    },
    {
      key: "location_id",
      label: "Location",
      sortable: true,
      filterType: "select",
      getValue: (r) => locMap.get(r.location_id)?.code || "",
      options: locations.map((l) => ({ value: l.code, label: `${l.code} — ${l.name}` })),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      getValue: (r) => Number(r.quantity),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterType: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "fulfilled", label: "Fulfilled" },
        { value: "cancelled", label: "Cancelled" },
      ],
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
  } = useTableFilters({
    data: allRows,
    columns,
    initialSort: null,
  });

  const fulfillMut = useMutation({
    mutationFn: (id: string) => reservationService.update(id, { status: "fulfilled" }),
    onSuccess: () => {
      toast.success("Reservation fulfilled");
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Failed"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => reservationService.cancel(id),
    onSuccess: () => {
      toast.success("Reservation cancelled");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setCancelTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Cancel failed"),
  });

  const statusTone = (s: string): "green" | "blue" | "amber" | "red" | "neutral" => {
    if (s === "active") return "blue";
    if (s === "fulfilled") return "green";
    if (s === "cancelled") return "neutral";
    return "amber";
  };

  return (
    <RequireRead perm="inventory.reservations.read" crumbs={["Inventory", "Reservations"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Inventory", "Reservations"]}
        right={
          <Can perm="inventory.reservations.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Reserve Stock</Button>
          </Can>
        }
      />
      <div className="p-5 space-y-4">
        <PageHeader
          title="Reservations"
          description="Soft-hold stock for open orders without physically moving it. Prevents you from committing the same stock to two customers."
          learnMore="When you reserve 10 units, 'qty_reserved' goes up by 10 and 'qty_available' goes down by 10 — but 'qty_on_hand' stays the same (nothing has moved yet). Fulfilling a reservation doesn't automatically move the stock; you still need to post a real OUT movement from the Sales Order."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== allRows.length ? ` / ${allRows.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by item…"
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

        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Lock size={22} />}
              title={activeFilterCount > 0 ? "No reservations match those filters" : "No reservations right now"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Reserve stock to soft-hold it for an open order — it stops the same inventory getting committed twice."
                    : "There are no active stock reservations right now."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Reserve your first stock</Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Created</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Item</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Location</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort} align="right">Qty</SortHeader>
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="center">Status</SortHeader>
                      <ColumnFilter col={columns[4]} value={columnFilters[columns[4].key]} onChange={(v) => setColumnFilter(columns[4].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">Remarks</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const item = itemMap.get(r.item_id);
                  const loc = locMap.get(r.location_id);
                  return (
                    <tr key={r.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{item?.item_code}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{loc?.code || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.quantity}</td>
                      <td className="px-4 py-2.5 text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                      <td className="px-4 py-2.5 text-foreground-secondary text-xs">{r.remarks || "—"}</td>
                      {canWrite && (
                        <td className="px-4 py-2.5 text-center">
                          {r.status === "active" && (
                            <ActionMenu
                              items={[
                                {
                                  label: "Mark fulfilled",
                                  icon: <CheckCircle size={12} />,
                                  onClick: () => fulfillMut.mutate(r.id),
                                },
                                { divider: true, label: "" },
                                {
                                  label: "Cancel",
                                  icon: <XCircle size={12} />,
                                  danger: true,
                                  onClick: () => setCancelTarget(r.id),
                                },
                              ]}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <ReservationFormModal items={items} locations={locations} onClose={() => setShowCreate(false)} />
      )}
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMut.mutate(cancelTarget)}
        title="Release this reservation?"
        description="The held quantity goes back to 'available'. If this was tied to a Sales Order, that order will show insufficient stock on post until you reserve again or the physical stock increases."
        confirmLabel="Release reservation"
        confirmKind="danger"
        loading={cancelMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const reservationSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  location_id: z.string().min(1, "Select a location"),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((v) => Number(v) > 0, "Must be greater than zero"),
  remarks: z.string().max(500, "Too long").optional().or(z.literal("")),
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

function ReservationFormModal({
  items, locations, onClose,
}: {
  items: { id: string; item_code: string; name: string }[];
  locations: { id: string; code: string; name: string }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { item_id: "", location_id: "", quantity: "", remarks: "" },
  });

  const onSubmit = async (data: ReservationFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await reservationService.create({
        item_id: data.item_id,
        location_id: data.location_id,
        quantity: data.quantity,
        remarks: data.remarks || undefined,
      });
      toast.success("Stock reserved");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "INSUFFICIENT_STOCK") {
          setError("quantity", { message: "Not enough available stock at this location." });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Reservation failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reserve stock"
      description="Soft-hold a quantity of an item at a location for an upcoming order. Nothing physical moves — qty_available drops while qty_on_hand stays the same."
      width="sm"
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
        <FormField label="Item" required error={errors.item_id?.message} help="The item to hold stock of.">
          <select
            className={cn(
              "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
              errors.item_id ? "border-status-red" : "border-hairline"
            )}
            disabled={submitting}
            {...register("item_id")}
          >
            <option value="">— Select item —</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </FormField>
        <FormField label="Location" required error={errors.location_id?.message} help="Where the stock is physically held.">
          <select
            className={cn(
              "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
              errors.location_id ? "border-status-red" : "border-hairline"
            )}
            disabled={submitting}
            {...register("location_id")}
          >
            <option value="">— Select location —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </select>
        </FormField>
        <Input
          label="Quantity"
          type="number"
          step="0.001"
          placeholder="10"
          required
          help="How much to hold. Must not exceed the current available quantity at the chosen location."
          error={errors.quantity?.message}
          disabled={submitting}
          {...register("quantity")}
        />
        <Input
          label="Remarks"
          placeholder="Held for SO-1024, ACME"
          help="Optional note that appears in the reservations list so you know why this stock is held."
          error={errors.remarks?.message}
          disabled={submitting}
          {...register("remarks")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Reserve</Button>
        </div>
      </form>
    </Dialog>
  );
}
