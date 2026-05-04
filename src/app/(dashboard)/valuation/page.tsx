"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner, FilterChip } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { valuationService } from "@/services/stock.service";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import { Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ValuationLayersPage() {
  const [onlyActive, setOnlyActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["valuation", onlyActive],
    queryFn: () => valuationService.list({ limit: 200, only_active: onlyActive }),
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

  type ValuationLayer = (typeof allRows)[number];

  const columns: ColumnDef<ValuationLayer>[] = [
    { key: "layer_date", label: "Layer date", sortable: true, filterType: "text" },
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
      key: "qty_remaining",
      label: "Remaining",
      sortable: true,
      getValue: (r) => Number(r.qty_remaining),
    },
    {
      key: "unit_cost",
      label: "Unit cost",
      sortable: true,
      getValue: (r) => parseFloat(r.unit_cost || "0"),
    },
    { key: "exhausted", label: "Exhausted", filterType: "boolean" },
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

  return (
    <RequireRead perm="inventory.cost.read" crumbs={["Inventory", "Valuation Layers"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Inventory", "Valuation Layers"]} />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Valuation Layers"
          description="Every time stock came in, at what cost. Posting OUT consumes the oldest unexhausted layer first (FIFO)."
          learnMore="Each IN movement creates a layer: qty received × unit cost. OUTs eat through layers from oldest to newest. 'Remaining' shows how much of each layer is left; when it hits zero the layer is 'exhausted'. This is how we compute accurate cost-of-goods-sold per transaction — not averaged."
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
          <FilterChip>
            <label className="flex items-center gap-1 text-xs font-medium cursor-pointer">
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
              Only active (unexhausted)
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

        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Layers size={22} />}
              title={activeFilterCount > 0 ? "No layers match those filters" : "No valuation layers yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : "Layers are created automatically when stock IN movements post — usually when you receive goods against a purchase order."
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
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Layer date</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
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
                  <th className="text-right px-4 py-2.5">Original</th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort} align="right">Remaining</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="right">Unit cost</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">Total value</th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <span>Status</span>
                      <ColumnFilter col={columns[5]} value={columnFilters[columns[5].key]} onChange={(v) => setColumnFilter(columns[5].key, v)} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const item = itemMap.get(l.item_id);
                  const loc = locMap.get(l.location_id);
                  return (
                    <tr key={l.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(l.layer_date)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{item?.name || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{item?.item_code}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{loc?.code || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground-muted">{l.qty_original}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{l.qty_remaining}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{parseFloat(l.unit_cost).toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{parseFloat(l.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {l.exhausted ? <Badge tone="neutral">Exhausted</Badge> : <Badge tone="green">Active</Badge>}
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
