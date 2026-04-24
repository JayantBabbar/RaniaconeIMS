"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
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
import { isApiError } from "@/lib/api-client";
import type { Serial } from "@/services/items.service";
import type { Item } from "@/types";
import {
  Plus,
  Fingerprint,
  ExternalLink,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// S-49: Serial Management
// Tenant-wide list of serials, grouped by status and item.
// ═══════════════════════════════════════════════════════════

interface SerialRow extends Serial {
  _item?: Item;
}

export default function SerialsPage() {
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.serials.write");

  const [showCreate, setShowCreate] = useState(false);

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "serial-tracked"],
    queryFn: () => itemService.list({ limit: 200, is_active: true }),
  });
  const items = itemsData?.data || [];
  const serialItems = useMemo(
    () => items.filter((i) => i.is_serial_tracked),
    [items],
  );

  // Fan out: per-item serial list
  const serialsQuery = useQuery({
    queryKey: ["allSerials", serialItems.map((i) => i.id).join(",")],
    enabled: serialItems.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        serialItems.map(async (item) => {
          try {
            const serials = await itemService.listSerials(item.id);
            return serials.map<SerialRow>((s) => ({ ...s, _item: item }));
          } catch {
            return [] as SerialRow[];
          }
        }),
      );
      return results.flat();
    },
  });
  const serials = serialsQuery.data || [];

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: serials.length };
    for (const s of serials) map[s.status] = (map[s.status] || 0) + 1;
    return map;
  }, [serials]);

  const columns: ColumnDef<SerialRow>[] = [
    { key: "serial_number", label: "Serial #", sortable: true, filterType: "text" },
    {
      key: "_item",
      label: "Item",
      sortable: true,
      searchable: true,
      filterType: "text",
      getValue: (r) => r._item?.name || "",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterType: "select",
      options: [
        { value: "in_stock", label: "In stock" },
        { value: "reserved", label: "Reserved" },
        { value: "issued", label: "Issued" },
        { value: "returned", label: "Returned" },
        { value: "scrapped", label: "Scrapped" },
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
  } = useTableFilters({ data: serials, columns });

  return (
    <RequireRead perm="inventory.serials.read" crumbs={["Inventory", "Serials"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Inventory", "Serials"]}
        right={
          <Can perm="inventory.serials.write">
            <Button
              kind="primary"
              icon={<Plus size={13} />}
              onClick={() => setShowCreate(true)}
            >
              Add Serial
            </Button>
          </Can>
        }
      />

      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Serials"
          description="Unique serial records for every serial-tracked item. Each serial has a lifecycle: in stock → reserved → issued, with optional returned/scrapped."
          learnMore="Serials appear here only for items flagged as serial-tracked. A serial can be in exactly one state at a time. Moving it through the lifecycle happens via documents (Sales Order posting sets 'issued'; a return sets 'returned')."
          badge={<Badge tone="neutral">{serials.length} total</Badge>}
        />


        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KPICard
            label="In Stock"
            value={String(counts["in_stock"] || 0)}
            subtitle="Available"
            icon={<Fingerprint size={15} />}
          />
          <KPICard
            label="Reserved"
            value={String(counts["reserved"] || 0)}
            subtitle="Held for documents"
          />
          <KPICard
            label="Issued"
            value={String(counts["issued"] || 0)}
            subtitle="Out of stock"
          />
          <KPICard
            label="Retired"
            value={String((counts["returned"] || 0) + (counts["scrapped"] || 0))}
            subtitle="Returned or scrapped"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search serial # or item…"
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
        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {itemsLoading || serialsQuery.isLoading ? (
            <div className="py-20 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Fingerprint size={22} />}
              title={
                serialItems.length === 0
                  ? "No serial-tracked items yet"
                  : serials.length === 0
                    ? "No serials yet"
                    : "No serials match those filters"
              }
              description={
                serialItems.length === 0
                  ? "Flag an item as serial-tracked on its detail page, then come back here to register individual serials."
                  : serials.length === 0
                    ? "Register your first serial so it can move through the in-stock → reserved → issued lifecycle."
                    : "Try loosening the filters, or clear them all to start over."
              }
              action={
                canWrite && serialItems.length > 0 && serials.length === 0 ? (
                  <Button
                    kind="primary"
                    icon={<Plus size={13} />}
                    onClick={() => setShowCreate(true)}
                  >
                    Add your first serial
                  </Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Serial #</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Item</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">Lot</th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Status</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-3.5 py-2.5 font-mono text-xs font-medium">
                      {s.serial_number}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Link
                        href={`/items/${s.item_id}`}
                        className="hover:text-brand transition-colors"
                      >
                        <div className="font-medium">{s._item?.name || "—"}</div>
                        <div className="text-[10.5px] text-foreground-muted font-mono">
                          {s._item?.item_code}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs font-mono text-foreground-secondary">
                      {s.lot_id ? s.lot_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <Link
                        href={`/items/${s.item_id}`}
                        className="p-1 inline-flex rounded hover:bg-surface-secondary text-foreground-muted hover:text-foreground transition-colors"
                      >
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddSerialModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        items={serialItems}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["allSerials"] })
        }
      />
    </div>
    </RequireRead>
  );
}

const serialSchema = z.object({
  item_id: z.string().min(1, "Pick an item"),
  serial_number: z
    .string()
    .trim()
    .min(1, "Serial is required")
    .max(100, "Too long"),
  status: z.string().min(1),
});

type SerialFormValues = z.infer<typeof serialSchema>;

function AddSerialModal({
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
  } = useForm<SerialFormValues>({
    resolver: zodResolver(serialSchema),
    defaultValues: { item_id: "", serial_number: "", status: "in_stock" },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: SerialFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await itemService.addSerial(data.item_id, {
        serial_number: data.serial_number.trim(),
        status: data.status,
      });
      toast.success("Serial created");
      onCreated();
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT") {
          setError("serial_number", { message: "This serial already exists for this item." });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not create serial. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a serial"
      description="Register a unique serial for a serial-tracked item. Pick the starting lifecycle state — most begin as 'in stock'."
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
        <FormField label="Item" required error={errors.item_id?.message} help="Only items you've flagged as serial-tracked appear here.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary"
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
          label="Serial Number"
          placeholder="SN-0001"
          required
          help="The unique serial printed on this specific unit. Must be unique across the item."
          error={errors.serial_number?.message}
          disabled={submitting}
          {...register("serial_number")}
        />
        <FormField label="Initial Status" help="Usually 'in stock'. Use 'reserved' only if you're logging a serial already committed to an open order.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary"
            disabled={submitting}
            {...register("status")}
          >
            <option value="in_stock">In Stock</option>
            <option value="reserved">Reserved</option>
            <option value="issued">Issued</option>
            <option value="returned">Returned</option>
            <option value="scrapped">Scrapped</option>
          </select>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" kind="primary" loading={submitting}>
            Create Serial
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
