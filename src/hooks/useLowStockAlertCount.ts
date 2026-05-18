"use client";

import { useQuery } from "@tanstack/react-query";
import { itemService } from "@/services/items.service";
import { balanceService } from "@/services/stock.service";
import type { Balance, Item } from "@/types";
import type { ReorderPolicy } from "@/services/items.service";

// ═══════════════════════════════════════════════════════════
// useLowStockAlertCount
//
// Count of items currently at or below their reorder threshold,
// joined across reorder_policies × balances. Used by the sidebar
// to drive the blinking highlight on the "Low Stock Alerts" nav.
//
// Shares query keys with the /alerts page so the underlying data is
// fetched once and reused across the app.
// ═══════════════════════════════════════════════════════════

export function useLowStockAlertCount(): { count: number; isLoading: boolean } {
  // Items — only active ones can have alerts
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "all-active"],
    queryFn: () => itemService.list({ limit: 200, is_active: true }),
    staleTime: 60 * 1000,
  });
  const items: Item[] = itemsData?.data ?? [];

  // Reorder policies — same query key shape as /alerts page so cache is shared
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["reorderPoliciesAll", items.map((i) => i.id).join(",")],
    enabled: items.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const ps = await itemService.listReorderPolicies(item.id);
            return ps.map((p) => ({ item, policy: p }));
          } catch {
            return [] as { item: Item; policy: ReorderPolicy }[];
          }
        }),
      );
      return results.flat();
    },
    staleTime: 60 * 1000,
  });

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ["balancesAll"],
    queryFn: () => balanceService.list({ limit: 200 }),
    staleTime: 60 * 1000,
  });
  const balances: Balance[] = balancesData ?? [];

  if (itemsLoading || policiesLoading || balancesLoading) {
    return { count: 0, isLoading: true };
  }

  const balanceIndex = new Map<string, Balance>();
  for (const b of balances) {
    balanceIndex.set(`${b.item_id}:${b.location_id}`, b);
  }

  let count = 0;
  for (const { item, policy } of policies) {
    const threshold = Number(policy.reorder_point ?? policy.min_qty ?? 0);
    if (!threshold && threshold !== 0) continue;
    const bal = balanceIndex.get(`${item.id}:${policy.location_id}`);
    const available = bal ? Number(bal.qty_available) : 0;
    if (available <= threshold) count += 1;
  }

  return { count, isLoading: false };
}
