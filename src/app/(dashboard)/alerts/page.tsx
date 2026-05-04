"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner, KPICard } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-elements";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { isApiError } from "@/lib/api-client";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { itemService } from "@/services/items.service";
import { balanceService } from "@/services/stock.service";
import { locationService } from "@/services/locations.service";
import {
  AlertTriangle,
  ShoppingCart,
  ExternalLink,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import type { Item, Balance } from "@/types";
import type { ReorderPolicy } from "@/services/items.service";

// ═══════════════════════════════════════════════════════════
// S-51: Low Stock Alerts
// Joins reorder policies × on-hand balances. Shows items at
// or below reorder point per location, with shortfall and a
// one-click link to create a PO.
// ═══════════════════════════════════════════════════════════

interface AlertRow {
  item: Item;
  policy: ReorderPolicy;
  locationName: string;
  onHand: number;
  available: number;
  shortfall: number;
  severity: "critical" | "low";
}

export default function LowStockAlertsPage() {
  const { can } = useCan();
  const canReorder = can("inventory.documents.write");
  const canEditThreshold = can("inventory.reorder_policies.write") || can("inventory.items.write");
  const [editTarget, setEditTarget] = useState<AlertRow | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  // Load all active items
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "all-active"],
    queryFn: () => itemService.list({ limit: 200, is_active: true }),
  });
  const items = itemsData?.data || [];

  // Load all locations for name resolution
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });
  const locations = locationsData?.data || [];
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  // Load reorder policies for each item (parallel). The API exposes them as
  // a sub-resource; there's no list-all-policies endpoint, so we fan out.
  const policyQueries = useQuery({
    queryKey: ["reorderPoliciesAll", items.map((i) => i.id).join(",")],
    enabled: items.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const policies = await itemService.listReorderPolicies(item.id);
            return policies.map((p) => ({ item, policy: p }));
          } catch {
            return [] as { item: Item; policy: ReorderPolicy }[];
          }
        }),
      );
      return results.flat();
    },
  });
  const policies = policyQueries.data || [];

  // Load all non-zero balances (single pull, filtered later)
  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ["balancesAll"],
    queryFn: () => balanceService.list({ limit: 200 }),
  });
  const balances = balancesData ?? [];

  // Join: for each policy, find the matching balance (by item + location)
  // and compute shortfall from reorder point (falling back to min_qty).
  const alerts: AlertRow[] = useMemo(() => {
    const out: AlertRow[] = [];
    const balanceIndex = new Map<string, Balance>();
    for (const b of balances) {
      balanceIndex.set(`${b.item_id}:${b.location_id}`, b);
    }

    for (const { item, policy } of policies) {
      const threshold = Number(policy.reorder_point ?? policy.min_qty ?? 0);
      if (!threshold && threshold !== 0) continue;

      const bal = balanceIndex.get(`${item.id}:${policy.location_id}`);
      const onHand = bal ? Number(bal.qty_on_hand) : 0;
      const available = bal ? Number(bal.qty_available) : 0;

      if (available > threshold) continue;

      const shortfall = Math.max(0, threshold - available);
      const severity: "critical" | "low" =
        available <= 0 ? "critical" : "low";

      out.push({
        item,
        policy,
        locationName:
          locationMap.get(policy.location_id)?.name ||
          "Location " + policy.location_id.slice(0, 8),
        onHand,
        available,
        shortfall,
        severity,
      });
    }

    // Sort: critical first, then largest shortfall
    out.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return b.shortfall - a.shortfall;
    });
    return out;
  }, [policies, balances, locationMap]);

  const columns: ColumnDef<AlertRow>[] = [
    {
      key: "item",
      label: "Item",
      sortable: true,
      searchable: true,
      filterType: "text",
      getValue: (r) => r.item.name,
    },
    {
      key: "locationName",
      label: "Location",
      sortable: true,
      filterType: "text",
    },
    { key: "onHand", label: "On Hand", sortable: true },
    { key: "available", label: "Available", sortable: true },
    { key: "shortfall", label: "Shortfall", sortable: true },
    {
      key: "severity",
      label: "Severity",
      sortable: true,
      filterType: "select",
      options: [
        { value: "critical", label: "Critical" },
        { value: "low", label: "Low" },
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
  } = useTableFilters({ data: alerts, columns });

  const counts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    low: alerts.filter((a) => a.severity === "low").length,
  };

  const loading = itemsLoading || balancesLoading || policyQueries.isLoading;

  return (
    <RequireRead perm="inventory.items.read" crumbs={["Alerts", "Low Stock"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Alerts", "Low Stock"]}
        right={
          <Can perm="inventory.documents.write">
            <Link href="/documents/purchase-orders/new">
              <Button kind="primary" icon={<ShoppingCart size={13} />}>
                New Purchase Order
              </Button>
            </Link>
          </Can>
        }
      />

      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Low Stock Alerts"
          description="Items at or below their reorder threshold, per location. Click 'Reorder' to open a pre-filled Purchase Order."
          learnMore="Alerts only fire when you've set a reorder policy on an item/location (Item detail → Reorder Policies). 'Critical' means zero or negative available; 'Low' means under the reorder point but still positive. Shortfall is the gap between current available and the reorder point."
          badge={
            <Badge tone={counts.all > 0 ? "red" : "green"} dot>
              {counts.all} item{counts.all === 1 ? "" : "s"} need attention
            </Badge>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <KPICard
            label="Total Alerts"
            value={String(counts.all)}
            subtitle="At or below reorder point"
            icon={<AlertTriangle size={15} />}
          />
          <KPICard
            label="Critical"
            value={String(counts.critical)}
            subtitle="Zero or negative stock"
            icon={<AlertTriangle size={15} />}
          />
          <KPICard
            label="Low"
            value={String(counts.low)}
            subtitle="Below reorder threshold"
            icon={<Package size={15} />}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search item or location…"
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
          {loading ? (
            <div className="py-20 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={22} />}
              title={
                alerts.length === 0
                  ? "All stock is above threshold"
                  : activeFilterCount > 0
                    ? "No alerts match those filters"
                    : "No alerts"
              }
              description={
                alerts.length === 0
                  ? "Nothing to reorder right now. Set reorder policies on an item's detail page to start getting alerts when stock runs low."
                  : "Try loosening the filters, or clear them all to start over."
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
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Item</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Location</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-right px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort} align="right">On Hand</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort} align="right">Available</SortHeader>
                    </div>
                  </th>
                  <th className="text-right px-3.5 py-2.5">Reorder Point</th>
                  <th className="text-right px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="right">Shortfall</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[5]} sort={sort} toggleSort={toggleSort}>Severity</SortHeader>
                      <ColumnFilter col={columns[5]} value={columnFilters[columns[5].key]} onChange={(v) => setColumnFilter(columns[5].key, v)} />
                    </div>
                  </th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr
                    key={`${a.item.id}-${a.policy.id}-${i}`}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-3.5 py-2.5">
                      <Link
                        href={`/items/${a.item.id}`}
                        className="block"
                      >
                        <div className="font-medium hover:text-brand transition-colors">
                          {a.item.name}
                        </div>
                        <div className="text-[10.5px] text-foreground-muted font-mono">
                          {a.item.item_code}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs">{a.locationName}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-xs">
                      {a.onHand.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-xs font-medium">
                      {a.available.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-xs text-foreground-secondary">
                      {Number(a.policy.reorder_point ?? a.policy.min_qty ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-xs font-semibold text-status-red-text">
                      {a.shortfall.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {a.severity === "critical" ? (
                        <Badge tone="red" dot>
                          Critical
                        </Badge>
                      ) : (
                        <Badge tone="amber" dot>
                          Low
                        </Badge>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="inline-flex gap-1 flex-wrap justify-end">
                        {canEditThreshold && (
                          <Button
                            size="sm"
                            icon={<SlidersHorizontal size={11} />}
                            onClick={() => setEditTarget(a)}
                            title="Edit threshold for this item × location"
                          >
                            Threshold
                          </Button>
                        )}
                        <Link href={`/items/${a.item.id}`}>
                          <Button size="sm" icon={<ExternalLink size={11} />}>
                            Item
                          </Button>
                        </Link>
                        {canReorder && (
                          <Link href="/documents/purchase-orders/new">
                            <Button
                              size="sm"
                              kind="primary"
                              icon={<ShoppingCart size={11} />}
                            >
                              Reorder
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editTarget && (
        <ThresholdQuickEditModal
          row={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["reorderPoliciesAll"] });
            toast.success("Threshold updated");
            setEditTarget(null);
          }}
        />
      )}
    </div>
    </RequireRead>
  );
}

// ── Inline threshold editor — opens from the Edit button on each
// alert row. Pre-fills with the existing policy values; PATCH on save.
function ThresholdQuickEditModal({
  row, onClose, onSaved,
}: {
  row: AlertRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();

  const [minQty, setMinQty]             = useState(row.policy.min_qty ?? "");
  const [reorderPoint, setReorderPoint] = useState(row.policy.reorder_point ?? "");
  const [reorderQty, setReorderQty]     = useState(row.policy.reorder_qty ?? "");
  const [maxQty, setMaxQty]             = useState(row.policy.max_qty ?? "");

  const save = useMutation({
    mutationFn: () => itemService.updateReorderPolicy(row.item.id, row.policy.id, {
      min_qty:       Number(minQty),
      ...(reorderPoint ? { reorder_point: Number(reorderPoint) } : {}),
      ...(reorderQty   ? { reorder_qty:   Number(reorderQty) }   : {}),
      ...(maxQty       ? { max_qty:       Number(maxQty) }       : {}),
    }),
    onSuccess: onSaved,
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not save"),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Threshold — ${row.item.name}`}
      description={`Editing reorder policy for ${row.item.item_code} at ${row.locationName}.`}
      width="md"
    >
      <div className="space-y-3">
        <div className="rounded bg-surface border border-hairline p-3 text-[12px] grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-foreground-muted">On hand</div>
            <div className="font-medium tabular-nums mt-0.5">{row.onHand.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Available</div>
            <div className="font-medium tabular-nums mt-0.5">{row.available.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Shortfall</div>
            <div className="font-medium tabular-nums text-status-red-text mt-0.5">{row.shortfall.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min qty"
            type="number"
            min={0}
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            help="Absolute floor — alerts as 'critical' when available falls below."
          />
          <Input
            label="Reorder point"
            type="number"
            min={0}
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
            help="Soft trigger — alerts as 'low' at or below."
          />
          <Input
            label="Reorder qty"
            type="number"
            min={0}
            value={reorderQty}
            onChange={(e) => setReorderQty(e.target.value)}
            help="How many to order when triggered."
          />
          <Input
            label="Max qty"
            type="number"
            min={0}
            value={maxQty}
            onChange={(e) => setMaxQty(e.target.value)}
            help="Cap — avoids overstock alerts."
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button
            kind="primary"
            loading={save.isPending}
            disabled={!minQty || Number(minQty) < 0}
            onClick={() => save.mutate()}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
