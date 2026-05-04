"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Input, Textarea, FormField } from "@/components/ui/form-elements";
import { Dialog } from "@/components/ui/dialog";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { pricingService } from "@/services/pricing.service";
import { itemService } from "@/services/items.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  Plus, ChevronDown, ChevronRight, Tag, Clock, History,
} from "lucide-react";
import type { ItemPricingRule } from "@/types";

// ═══════════════════════════════════════════════════════════
// /master-data/item-pricing — versioned pricing config (Admin)
//
// One row per (item, thickness, size). Click a row to expand its
// version history. "Update price" modal creates a new rule that
// auto-closes the prior one.
//
// This is Mr. Arpit's main control panel for sale prices. Operator
// + Salesman never see this page (gated on master_data.read).
// ═══════════════════════════════════════════════════════════

const THICKNESSES = [2, 3, 4, 5];
const SIZES = ["1220x2440", "1220x3050", "1220x3660"];
const SIZE_LABEL: Record<string, string> = {
  "1220x2440": "1220 × 2440 mm (4×8 ft)",
  "1220x3050": "1220 × 3050 mm (4×10 ft)",
  "1220x3660": "1220 × 3660 mm (4×12 ft)",
};

export default function ItemPricingPage() {
  const searchParams = useSearchParams();
  const initialItemId = searchParams?.get("item_id") ?? "";
  const [itemFilter, setItemFilter] = useState<string>(initialItemId);
  // Sync filter when navigating with ?item_id= changing.
  useEffect(() => {
    if (initialItemId && initialItemId !== itemFilter) setItemFilter(initialItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItemId]);
  const [editTarget, setEditTarget] = useState<{
    itemId: string; thickness: number; size: string; currentPrice?: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const itemsList = items?.data ?? [];
  const itemById = useMemo(() => new Map(itemsList.map((i) => [i.id, i])), [itemsList]);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["pricing-rules", itemFilter],
    queryFn: () => pricingService.list({ item_id: itemFilter || undefined, limit: 500 }),
  });

  // Group rules by (item, thickness, size); within each group sort by
  // valid_from desc so the active rule is on top. Skip groups whose
  // active rule belongs to a non-batch-tracked legacy item (already
  // filtered if user picked a specific item).
  type GroupKey = string;
  const groups = useMemo(() => {
    const map = new Map<GroupKey, ItemPricingRule[]>();
    for (const r of rules ?? []) {
      const key = `${r.item_id}|${r.thickness_mm}|${r.size_code}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    Array.from(map.values()).forEach((arr) => {
      arr.sort((a, b) => (a.valid_from < b.valid_from ? 1 : a.valid_from > b.valid_from ? -1 : 0));
    });
    return map;
  }, [rules]);

  const sortedGroupKeys = useMemo(() => {
    return Array.from(groups.keys()).sort((a, b) => {
      const [aItem, aT, aS] = a.split("|");
      const [bItem, bT, bS] = b.split("|");
      const aName = itemById.get(aItem)?.name ?? aItem;
      const bName = itemById.get(bItem)?.name ?? bItem;
      if (aName !== bName) return aName.localeCompare(bName);
      if (aT !== bT) return Number(aT) - Number(bT);
      return aS.localeCompare(bS);
    });
  }, [groups, itemById]);

  return (
    <RequireRead perm="inventory.master_data.read">
      <div className="flex-1 bg-surface flex flex-col overflow-auto">
        <TopBar crumbs={["Master Data", "Item Pricing"]} />
        <div className="p-4 md:p-5 space-y-4">
          <PageHeader
            title="Item pricing"
            description="Versioned sale prices per (item × thickness × size). When you update a price, the previous rule stays in history — old invoices keep their original price; new lines pick up the new rule."
            learnMore="ACP panels are sold by the sheet, but the sheet's price depends on its thickness and size. This page is the master price list. To update a price, click 'Update price' on any row — the system records the change with an effective date and closes the prior rule automatically."
          />

          {/* Filter */}
          <div className="rounded-lg border border-border bg-bg-elevated p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Item" help="Pick an item to filter, or leave blank to see all rules.">
              <select
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                className="w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5 h-9"
              >
                <option value="">All items</option>
                {itemsList
                  .filter((i) => i.is_active)
                  .sort((a, b) => a.item_code.localeCompare(b.item_code))
                  .map((i) => (
                    <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>
                  ))}
              </select>
            </FormField>
            <div className="md:col-span-2 flex items-end">
              <p className="text-[11px] text-text-tertiary">
                {groups.size} pricing combination{groups.size === 1 ? "" : "s"} configured
                {itemFilter ? "" : " across all items"}.
                {!itemFilter && (
                  <span className="block mt-1">
                    Tip: pick an item to focus on its 12 thickness×size combos (4 thicknesses × 3 sizes).
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : groups.size === 0 ? (
            <EmptyState
              icon={<Tag size={20} />}
              title="No pricing rules yet"
              description="Pick an item above and click 'Add price' to set the first rule for any thickness × size combination."
            />
          ) : (
            <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-8" />
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-left px-3 py-2 font-medium">Thickness</th>
                    <th className="text-left px-3 py-2 font-medium">Size</th>
                    <th className="text-right px-3 py-2 font-medium">Current price</th>
                    <th className="text-left px-3 py-2 font-medium">Effective</th>
                    <th className="text-right px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sortedGroupKeys.map((key) => {
                    const arr = groups.get(key)!;
                    const active = arr.find((r) => r.valid_until === null) ?? arr[0];
                    const history = arr.filter((r) => r.id !== active.id);
                    const item = itemById.get(active.item_id);
                    const isExpanded = expanded.has(key);
                    const hasHistory = history.length > 0;

                    return (
                      <React.Fragment key={key}>
                        <tr className="border-t border-border hover:bg-bg-hover">
                          <td className="px-3 py-2">
                            {hasHistory ? (
                              <button
                                onClick={() => {
                                  setExpanded((s) => {
                                    const n = new Set(s);
                                    if (n.has(key)) n.delete(key); else n.add(key);
                                    return n;
                                  });
                                }}
                                className="text-text-tertiary hover:text-text-primary"
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{item?.name ?? "(unknown)"}</div>
                            <div className="text-[11px] text-text-tertiary font-mono">{item?.item_code}</div>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{active.thickness_mm} mm</td>
                          <td className="px-3 py-2 text-[12px] font-mono">{SIZE_LABEL[active.size_code] ?? active.size_code}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {formatCurrency(active.sale_price, "INR", "en-IN")}
                          </td>
                          <td className="px-3 py-2 text-text-tertiary text-[12px]">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={11} />
                              since {formatDate(active.valid_from)}
                            </span>
                            {hasHistory && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                                <History size={10} /> {history.length} prior
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              kind="ghost"
                              onClick={() => setEditTarget({
                                itemId: active.item_id,
                                thickness: active.thickness_mm,
                                size: active.size_code,
                                currentPrice: active.sale_price,
                              })}
                            >
                              Update price
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && history.map((h) => (
                          <tr key={h.id} className="bg-bg-subtle/30 border-t border-border/50 text-text-tertiary">
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-[11px] italic" colSpan={3}>
                              ↳ Historical price · {h.notes ?? "No note"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(h.sale_price, "INR", "en-IN")}
                            </td>
                            <td className="px-3 py-2 text-[11px]">
                              {formatDate(h.valid_from)} → {h.valid_until ? formatDate(h.valid_until) : "ongoing"}
                            </td>
                            <td className="px-3 py-2" />
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add-rule modal — reuse for new combos when no rule exists */}
          {!itemFilter ? null : (
            <div className="rounded-lg border border-dashed border-border bg-bg-subtle/40 p-4">
              <p className="text-[12px] text-text-secondary">
                Want to add a price for a thickness×size combo not shown above?{" "}
                <button
                  onClick={() => setEditTarget({ itemId: itemFilter, thickness: THICKNESSES[0], size: SIZES[0] })}
                  className="text-brand hover:underline"
                >
                  Add new combo →
                </button>
              </p>
            </div>
          )}

          <p className="text-[11px] text-text-tertiary">
            Pricing changes take effect from the date you choose. Historical invoices and challans keep their original price (snapshotted on the line); only NEW lines created after the effective date use the new price.
          </p>
        </div>

        {editTarget && (
          <UpdatePriceModal
            itemName={itemById.get(editTarget.itemId)?.name ?? editTarget.itemId}
            itemId={editTarget.itemId}
            thickness={editTarget.thickness}
            size={editTarget.size}
            currentPrice={editTarget.currentPrice}
            onClose={() => setEditTarget(null)}
          />
        )}
      </div>
    </RequireRead>
  );
}

function UpdatePriceModal({
  itemName, itemId, thickness, size, currentPrice, onClose,
}: {
  itemName: string;
  itemId: string;
  thickness: number;
  size: string;
  currentPrice?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [thicknessVal, setThicknessVal] = useState(thickness);
  const [sizeVal, setSizeVal] = useState(size);
  const [salePrice, setSalePrice] = useState(currentPrice ?? "");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => pricingService.create({
      item_id: itemId,
      thickness_mm: thicknessVal,
      size_code: sizeVal,
      sale_price: salePrice,
      valid_from: validFrom,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success("New price recorded", "Prior rule's effective period closed automatically.");
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      onClose();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not save"),
  });

  return (
    <Dialog open onClose={onClose} title={`Update price — ${itemName}`} width="md">
      <div className="space-y-3">
        <p className="text-[12px] text-text-secondary">
          The new price takes effect from the date below. The previous price for this combination will be marked as historical with its end date set to the day before.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Thickness" required help="Panel thickness in millimetres.">
            <select
              value={thicknessVal}
              onChange={(e) => setThicknessVal(Number(e.target.value))}
              className="w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5 h-9"
            >
              {THICKNESSES.map((t) => <option key={t} value={t}>{t} mm</option>)}
            </select>
          </FormField>
          <FormField label="Size" required help="Panel dimensions (width × length).">
            <select
              value={sizeVal}
              onChange={(e) => setSizeVal(e.target.value)}
              className={cn(
                "w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5 h-9",
              )}
            >
              {SIZES.map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
            </select>
          </FormField>
        </div>

        {currentPrice && (
          <div className="text-[12px] text-text-tertiary p-2.5 rounded bg-bg-subtle border border-border">
            Currently <span className="font-mono">{formatCurrency(currentPrice, "INR", "en-IN")}</span>
            {" "}for {thickness}mm · {SIZE_LABEL[size] ?? size}.
          </div>
        )}

        <Input
          label="New sale price (₹ / sheet)"
          type="number"
          step="0.01"
          min={0}
          required
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          help="Per-sheet price. Excludes GST."
        />
        <Input
          label="Effective from"
          type="date"
          required
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          help="Date this new price takes effect. Defaults to today."
        />
        <Textarea
          label="Notes (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Q1 price revision; raw material price up 8%."
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button
            kind="primary"
            disabled={!salePrice || Number(salePrice) <= 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus size={13} /> Save new price
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
