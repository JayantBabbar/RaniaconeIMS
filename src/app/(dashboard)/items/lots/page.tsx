"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner, KPICard } from "@/components/ui/shared";
import { Input, FormField } from "@/components/ui/form-elements";
import { Dialog } from "@/components/ui/dialog";
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
import { itemService } from "@/services/items.service";
import type { Lot } from "@/services/items.service";
import type { Item } from "@/types";
import { isApiError } from "@/lib/api-client";
import {
  Plus,
  Layers,
  CalendarClock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// S-48: Lot Management
// Tenant-wide list of lots across items, with mfg/expiry dates
// and a "Add lot" modal scoped to a selected item.
// ═══════════════════════════════════════════════════════════

interface LotRow extends Lot {
  _item?: Item;
}

const EXPIRY_WINDOW_DAYS = 60;

export default function LotsPage() {
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.lots.write");

  const [showCreate, setShowCreate] = useState(false);

  // Load items (batch-tracked only would be ideal; we filter by is_batch_tracked)
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "batch-tracked"],
    queryFn: () => itemService.list({ limit: 200, is_active: true }),
  });
  const items = itemsData?.data || [];
  const batchItems = useMemo(
    () => items.filter((i) => i.is_batch_tracked),
    [items],
  );

  // Fan out: fetch lots for each batch-tracked item
  const lotsQuery = useQuery({
    queryKey: ["allLots", batchItems.map((i) => i.id).join(",")],
    enabled: batchItems.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        batchItems.map(async (item) => {
          try {
            const lots = await itemService.listLots(item.id);
            return lots.map<LotRow>((l) => ({ ...l, _item: item }));
          } catch {
            return [] as LotRow[];
          }
        }),
      );
      return results.flat();
    },
  });
  const lots = lotsQuery.data || [];

  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const counts = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    for (const l of lots) {
      if (!l.expiry_date) continue;
      const d = new Date(l.expiry_date);
      if (d < now) expired++;
      else if (d < soon) expiring++;
    }
    return { all: lots.length, expiring, expired };
  }, [lots]);

  const columns: ColumnDef<LotRow>[] = [
    { key: "lot_number", label: "Lot #", sortable: true, filterType: "text" },
    {
      key: "_item",
      label: "Item",
      sortable: true,
      searchable: true,
      filterType: "text",
      getValue: (r) => r._item?.name || "",
    },
    { key: "mfg_date", label: "Mfg Date", sortable: true },
    { key: "expiry_date", label: "Expiry", sortable: true },
    {
      key: "received_qty",
      label: "Received Qty",
      sortable: true,
      getValue: (r) => Number(r.received_qty),
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
    data: lots,
    columns,
    initialSort: { key: "expiry_date", direction: "asc" },
  });

  return (
    <RequireRead perm="inventory.lots.read" crumbs={["Inventory", "Lots"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Inventory", "Lots"]}
        right={
          <Can perm="inventory.lots.write">
            <Button
              kind="primary"
              icon={<Plus size={13} />}
              onClick={() => setShowCreate(true)}
            >
              Add Lot
            </Button>
          </Can>
        }
      />

      <div className="p-5 space-y-4">
        <PageHeader
          title="Lots"
          description="Batch records for every batch-tracked item. Track manufacturing date, expiry date, and received quantity per lot."
          learnMore="Lots appear here only for items flagged as batch-tracked. Expiring-soon means within 60 days. Stock movements consume lots FIFO by expiry date when you post OUT."
          badge={<Badge tone="neutral">{counts.all} total</Badge>}
        />


        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <KPICard
            label="Total Lots"
            value={String(counts.all)}
            subtitle="Across all items"
            icon={<Layers size={15} />}
          />
          <KPICard
            label="Expiring soon"
            value={String(counts.expiring)}
            subtitle={`Within ${EXPIRY_WINDOW_DAYS} days`}
            icon={<CalendarClock size={15} />}
          />
          <KPICard
            label="Expired"
            value={String(counts.expired)}
            subtitle="Past expiry date"
            icon={<AlertTriangle size={15} />}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search lot # or item…"
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

        {/* Table */}
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {itemsLoading || lotsQuery.isLoading ? (
            <div className="py-20 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Layers size={22} />}
              title={
                batchItems.length === 0
                  ? "No batch-tracked items yet"
                  : lots.length === 0
                    ? "No lots yet"
                    : "No lots match those filters"
              }
              description={
                batchItems.length === 0
                  ? "Flag an item as batch-tracked on its detail page, then come back here to record lots."
                  : lots.length === 0
                    ? "Record a lot number for a batch-tracked item so receipts can reference it."
                    : "Try loosening the filters, or clear them all to start over."
              }
              action={
                canWrite && batchItems.length > 0 && lots.length === 0 ? (
                  <Button
                    kind="primary"
                    icon={<Plus size={13} />}
                    onClick={() => setShowCreate(true)}
                  >
                    Add your first lot
                  </Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Lot #</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Item</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Mfg Date</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>Expiry</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="right">Received Qty</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">Status</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const expiry = l.expiry_date ? new Date(l.expiry_date) : null;
                  const expired = expiry ? expiry < now : false;
                  const expiring = expiry ? !expired && expiry < soon : false;
                  return (
                    <tr
                      key={l.id}
                      className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-mono text-xs font-medium">
                        {l.lot_number}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Link
                          href={`/items/${l.item_id}`}
                          className="hover:text-brand transition-colors"
                        >
                          <div className="font-medium">
                            {l._item?.name || "—"}
                          </div>
                          <div className="text-[10.5px] text-foreground-muted font-mono">
                            {l._item?.item_code}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs tabular-nums text-foreground-secondary">
                        {l.mfg_date || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs tabular-nums">
                        {l.expiry_date || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-xs">
                        {Number(l.received_qty).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {expired ? (
                          <Badge tone="red" dot>
                            Expired
                          </Badge>
                        ) : expiring ? (
                          <Badge tone="amber" dot>
                            Expiring
                          </Badge>
                        ) : (
                          <Badge tone="green" dot>
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <Link
                          href={`/items/${l.item_id}`}
                          className="p-1 inline-flex rounded hover:bg-surface-secondary text-foreground-muted hover:text-foreground transition-colors"
                        >
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddLotModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        items={batchItems}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["allLots"] });
        }}
      />
    </div>
    </RequireRead>
  );
}

const lotSchema = z
  .object({
    item_id: z.string().min(1, "Pick an item"),
    lot_number: z.string().trim().min(1, "Lot number is required").max(100, "Too long"),
    mfg_date: z.string().optional().or(z.literal("")),
    expiry_date: z.string().optional().or(z.literal("")),
    received_qty: z
      .string()
      .min(1, "Quantity is required")
      .refine((v) => Number(v) > 0, "Must be greater than zero"),
  })
  .refine(
    (v) =>
      !v.mfg_date ||
      !v.expiry_date ||
      new Date(v.expiry_date) >= new Date(v.mfg_date),
    { message: "Expiry must be on or after mfg date", path: ["expiry_date"] },
  );

type LotFormValues = z.infer<typeof lotSchema>;

function AddLotModal({
  open,
  onClose,
  items,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  items: Item[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LotFormValues>({
    resolver: zodResolver(lotSchema),
    defaultValues: {
      item_id: "",
      lot_number: "",
      mfg_date: "",
      expiry_date: "",
      received_qty: "",
    },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: LotFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await itemService.addLot(data.item_id, {
        lot_number: data.lot_number.trim(),
        mfg_date: data.mfg_date || undefined,
        expiry_date: data.expiry_date || undefined,
        received_qty: Number(data.received_qty),
      });
      toast.success("Lot created");
      onCreated();
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT") {
          setError("lot_number", { message: "A lot with this number already exists for this item." });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not create lot. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a lot"
      description="Record a batch of a batch-tracked item with its manufacturing/expiry dates and received quantity."
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
        <FormField label="Item" required error={errors.item_id?.message} help="Only items you've flagged as batch-tracked appear here.">
          <select
            className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary"
            disabled={submitting}
            {...register("item_id")}
          >
            <option value="">Select item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.item_code})
              </option>
            ))}
          </select>
        </FormField>
        <Input
          label="Lot Number"
          placeholder="LOT-2024-001"
          required
          help="The batch identifier printed on the goods. Must be unique per item."
          error={errors.lot_number?.message}
          disabled={submitting}
          {...register("lot_number")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label="Mfg Date"
            help="Date the batch was manufactured. Optional but useful for shelf-life tracking."
            error={errors.mfg_date?.message}
            disabled={submitting}
            {...register("mfg_date")}
          />
          <Input
            type="date"
            label="Expiry Date"
            help="Date the batch expires. Lots are consumed FIFO by expiry when stock moves OUT."
            error={errors.expiry_date?.message}
            disabled={submitting}
            {...register("expiry_date")}
          />
        </div>
        <Input
          type="number"
          label="Received Qty"
          placeholder="100"
          required
          min="0"
          step="any"
          help="Quantity received for this lot, in the item's base UoM."
          error={errors.received_qty?.message}
          disabled={submitting}
          {...register("received_qty")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" kind="primary" loading={submitting}>
            Create Lot
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
