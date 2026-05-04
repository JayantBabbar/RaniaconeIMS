"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Can } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useCanSeeCost } from "@/components/ui/cost-mask";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { movementService } from "@/services/stock.service";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import type { Movement } from "@/types";
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Truck } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MovementsPage() {
  const canSeeCost = useCanSeeCost();
  const { data, isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: () =>
      movementService.list({
        limit: 200,
      }),
  });
  const { data: itemsRaw } = useQuery({
    queryKey: ["itemsForMap"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locationsForMap"],
    queryFn: () => locationService.list({ limit: 200 }),
  });

  const movements = data ?? [];
  const items = itemsRaw?.data || [];
  const locations = locsRaw?.data || [];
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // ── Column config drives search / sort / filter ─────────────
  const columns: ColumnDef<Movement>[] = [
    {
      key: "posting_date",
      label: "Posting date",
      sortable: true,
      filterType: "text",
    },
    {
      key: "direction",
      label: "Dir",
      sortable: true,
      filterType: "select",
      options: [
        { value: "in", label: "In" },
        { value: "out", label: "Out" },
      ],
    },
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
      searchable: true,
      filterType: "select",
      getValue: (r) => locMap.get(r.location_id)?.code || "",
      options: locations.map((l) => ({ value: l.code, label: `${l.code} — ${l.name}` })),
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      filterType: "text",
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
  } = useTableFilters({ data: movements, columns });

  return (
    <RequireRead perm="inventory.movements.read" crumbs={["Inventory", "Movements"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Inventory", "Movements"]}
        right={
          <Can perm="inventory.movements.write">
            <Link href="/movements/new">
              <Button>Post direct movement</Button>
            </Link>
            <Link href="/movements/transfer">
              <Button kind="primary" icon={<Truck size={13} />}>
                Transfer Stock
              </Button>
            </Link>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Stock Movements"
          description="Every time stock came in or out — the immutable, append-only ledger. Each row is one leg; transfers appear as paired OUT and IN."
          learnMore="Movements are created when you post a document (PO, SO, transfer) or run a stock count that produces variance. You can't edit or delete a movement — cancelling a posted document creates reversal movements instead, so the audit trail stays complete."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== movements.length ? ` / ${movements.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by item, location, or source…"
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
              icon={<ArrowLeftRight size={22} />}
              title={activeFilterCount > 0 ? "No movements match those filters" : "No stock movements yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : "The ledger fills up automatically as you post documents (POs, SOs, transfers) or stock counts. Nothing to record by hand."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>
                        {columns[0].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[0]}
                        value={columnFilters[columns[0].key]}
                        onChange={(v) => setColumnFilter(columns[0].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort} align="center">
                        {columns[1].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[1]}
                        value={columnFilters[columns[1].key]}
                        onChange={(v) => setColumnFilter(columns[1].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>
                        {columns[2].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[2]}
                        value={columnFilters[columns[2].key]}
                        onChange={(v) => setColumnFilter(columns[2].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>
                        {columns[3].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[3]}
                        value={columnFilters[columns[3].key]}
                        onChange={(v) => setColumnFilter(columns[3].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">Qty</th>
                  {canSeeCost && <th className="text-right px-4 py-2.5">Unit cost</th>}
                  {canSeeCost && <th className="text-right px-4 py-2.5">Total</th>}
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort}>
                        {columns[4].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[4]}
                        value={columnFilters[columns[4].key]}
                        onChange={(v) => setColumnFilter(columns[4].key, v)}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m: Movement) => {
                  const item = itemMap.get(m.item_id);
                  const loc = locMap.get(m.location_id);
                  return (
                    <tr key={m.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(m.posting_date)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {m.direction === "in" ? (
                          <ArrowDownToLine size={14} className="text-status-green-text mx-auto" />
                        ) : (
                          <ArrowUpFromLine size={14} className="text-status-red-text mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{item?.item_code}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs">{loc?.code || "—"}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{m.quantity}</td>
                      {canSeeCost && (
                        <td className="px-4 py-2.5 text-right tabular-nums">{parseFloat(m.unit_cost).toFixed(2)}</td>
                      )}
                      {canSeeCost && (
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{parseFloat(m.total_cost).toFixed(2)}</td>
                      )}
                      <td className="px-4 py-2.5">
                        {m.source && <Badge tone="neutral">{m.source}</Badge>}
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
