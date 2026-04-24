"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/shared";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { currencyService } from "@/services/platform.service";
import type { Currency } from "@/types";
import { DollarSign } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Currency Catalog — Read-only browser for ISO 4217 currencies
// ═══════════════════════════════════════════════════════════

export default function CurrencyCatalogPage() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ["platformCurrencies"],
    queryFn: () => currencyService.list({ limit: 200 }),
  });

  const currencies = useMemo<Currency[]>(() => {
    const list = raw ?? [];
    return [...list].sort((a, b) => a.code.localeCompare(b.code));
  }, [raw]);

  const columns: ColumnDef<Currency>[] = [
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "name", label: "Name", sortable: true, filterType: "text" },
    { key: "symbol", label: "Symbol" },
    { key: "decimal_precision", label: "Decimals", sortable: true },
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
  } = useTableFilters({ data: currencies, columns });

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Platform", "Currencies"]} />

      <div className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Currencies</h1>
          <Badge tone="neutral">
            {rows.length}
            {rows.length !== currencies.length ? ` / ${currencies.length}` : ""} available
          </Badge>
        </div>

        <p className="text-sm text-foreground-secondary max-w-2xl">
          All ISO 4217 currencies are pre-seeded and available for tenant assignment.
          Tenants select a base currency during provisioning — there&apos;s no need
          to add them manually.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by code or name…"
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
        <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-3xl">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<DollarSign size={22} />}
              title={activeFilterCount > 0 ? "No currencies match those filters" : "No currencies"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : "Something went wrong — run the migration to seed ISO 4217 currencies."
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
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Code</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Name</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">Symbol</th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort} align="center">Decimals</SortHeader>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">
                      {c.code}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-center text-lg">
                      {c.symbol || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums">
                      {c.decimal_precision}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
