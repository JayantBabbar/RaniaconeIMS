"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner, KPICard } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { itemService } from "@/services/items.service";
import type { Lot } from "@/services/items.service";
import type { Item } from "@/types";
import {
  Layers,
  CalendarClock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// S-48: Lot Management — VIEW-ONLY page.
//
// Lots are NOT manually created here. They're born from GRN line
// entries (per Phase 12 design — see /documents/goods-receipts):
// when an Operator types a batch number on a GRN line for a batch-
// tracked item, the system creates the Lot record automatically.
//
// This page exists to LIST and DRILL-INTO existing lots:
//   • Filter by item / lot number / expiry window
//   • Click a row to see remaining qty + source GRN
//   • Track expiring-soon batches
//
// If you need to manually create a Lot (rare — migration scenarios),
// use the bulk-import wizard at /settings/imports/stock_balances
// which can seed lot records alongside opening qty.
// ═══════════════════════════════════════════════════════════

interface LotRow extends Lot {
  _item?: Item;
}

const EXPIRY_WINDOW_DAYS = 60;

export default function LotsPage() {

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
      <TopBar crumbs={["Inventory", "Lots"]} />

      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Lots"
          description="Batch records for every batch-tracked item. Track manufacturing date, expiry date, and received quantity per lot."
          learnMore="Lots appear here only for items flagged as batch-tracked. Expiring-soon means within 60 days. Stock movements consume lots FIFO by expiry date when you post OUT."
          badge={<Badge tone="neutral">{counts.all} total</Badge>}
        />


        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
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
                  ? "Flag an item as batch-tracked on its detail page first. Once goods of that item arrive via a Goods Receipt, the lot will appear here."
                  : lots.length === 0
                    ? "Lots are created automatically when batch-tracked items are received via a Goods Receipt. Post a GRN with a lot/batch number to see it here."
                    : "Try loosening the filters, or clear them all to start over."
              }
              action={
                activeFilterCount > 0 ? (
                  <button onClick={clearAll} className="text-sm text-brand hover:underline">Clear all filters</button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
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

    </div>
    </RequireRead>
  );
}
