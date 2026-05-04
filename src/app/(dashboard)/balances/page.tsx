"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner, FilterChip } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { CostMask, useCanSeeCost } from "@/components/ui/cost-mask";
import { cn } from "@/lib/utils";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { balanceService } from "@/services/stock.service";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import type { Balance } from "@/types";
import { Package } from "lucide-react";

export default function StockBalancesPage() {
  const [onlyNonzero, setOnlyNonzero] = useState(true);
  const canSeeCost = useCanSeeCost();

  const { data, isLoading } = useQuery({
    queryKey: ["balances", onlyNonzero],
    queryFn: () =>
      balanceService.list({
        limit: 200,
        only_nonzero: onlyNonzero,
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

  const allRows = data ?? [];
  const items = itemsRaw?.data || [];
  const locations = locsRaw?.data || [];
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const columns: ColumnDef<Balance>[] = [
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
      key: "qty_on_hand",
      label: "On hand",
      sortable: true,
      getValue: (r) => Number(r.qty_on_hand),
    },
    {
      key: "qty_available",
      label: "Available",
      sortable: true,
      getValue: (r) => Number(r.qty_available),
    },
    {
      key: "qty_reserved",
      label: "Reserved",
      sortable: true,
      getValue: (r) => Number(r.qty_reserved),
    },
    {
      key: "value",
      label: "Value",
      sortable: true,
      getValue: (r) => parseFloat(r.value || "0"),
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
  } = useTableFilters({ data: allRows, columns });

  // Aggregate KPIs
  const totals = useMemo(() => {
    const itemsSet = new Set<string>();
    const locSet = new Set<string>();
    let totalValue = 0;
    allRows.forEach((b) => {
      itemsSet.add(b.item_id);
      locSet.add(b.location_id);
      totalValue += parseFloat(b.value || "0");
    });
    return { items: itemsSet.size, locations: locSet.size, totalValue };
  }, [allRows]);

  return (
    <RequireRead perm="inventory.balances.read" crumbs={["Inventory", "Stock Balances"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Inventory", "Stock Balances"]} />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Stock Balances"
          description="How much of each item is physically present in each location, right now. The ledger of truth for inventory on hand."
          learnMore="Balances update automatically when stock movements post. 'On hand' is the physical count; 'Reserved' is soft-held for open documents; 'Available' is on-hand minus reserved — the number to trust when deciding whether to commit more."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== allRows.length ? ` / ${allRows.length}` : ""}
            </Badge>
          }
        />

        {/* KPI row — inventory value tile gated by cost.read (Nova Bond req) */}
        <div className={cn("grid grid-cols-1 gap-3 max-w-3xl", canSeeCost ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
          <KpiCard label="Distinct items" value={totals.items.toLocaleString()} />
          <KpiCard label="Locations in use" value={totals.locations.toLocaleString()} />
          {canSeeCost && (
            <KpiCard label="Inventory value" value={totals.totalValue.toFixed(2)} />
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by item or location…"
          />
          <FilterChip>
            <label className="flex items-center gap-1 text-xs font-medium cursor-pointer">
              <input type="checkbox" checked={onlyNonzero}
                onChange={(e) => setOnlyNonzero(e.target.checked)} />
              Only non-zero
            </label>
          </FilterChip>
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
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title={activeFilterCount > 0 ? "No balances match those filters" : "No stock on hand yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : "Balances appear automatically once you post a receipt (purchase order or direct IN movement) against an item."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-hairline-light">
                {rows.map((b: Balance) => {
                  const item = itemMap.get(b.item_id);
                  const loc = locMap.get(b.location_id);
                  return (
                    <div key={b.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{item?.name || "—"}</div>
                          <div className="text-[11px] text-foreground-muted font-mono truncate">
                            {item?.item_code} · {loc?.code}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold tabular-nums">{b.qty_on_hand}</div>
                          <div className="text-[10px] text-foreground-muted uppercase tracking-wider">on hand</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-hairline-light/60">
                        <div>
                          <div className="text-foreground-muted">Reserved</div>
                          <div className="tabular-nums font-medium text-status-amber-text">{b.qty_reserved}</div>
                        </div>
                        <div>
                          <div className="text-foreground-muted">Available</div>
                          <div className="tabular-nums font-medium text-status-green-text">{b.qty_available}</div>
                        </div>
                        {canSeeCost && (
                          <div className="text-right">
                            <div className="text-foreground-muted">Value</div>
                            <div className="tabular-nums font-medium">{parseFloat(b.value).toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Item</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Location</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort} align="right">On hand</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="right">Reserved</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort} align="right">Available</SortHeader>
                    </div>
                  </th>
                  {canSeeCost && (
                    <th className="text-right px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <SortHeader col={columns[5]} sort={sort} toggleSort={toggleSort} align="right">Value</SortHeader>
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((b: Balance) => {
                  const item = itemMap.get(b.item_id);
                  const loc = locMap.get(b.location_id);
                  return (
                    <tr key={b.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{item?.item_code}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{loc?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{loc?.code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{b.qty_on_hand}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-status-amber-text">{b.qty_reserved}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-status-green-text">{b.qty_available}</td>
                      {canSeeCost && (
                        <td className="px-4 py-2.5 text-right tabular-nums">{parseFloat(b.value).toFixed(2)}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </>
          )}
        </div>
      </div>
    </div>
    </RequireRead>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-hairline rounded-md p-4">
      <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{value}</div>
    </div>
  );
}
