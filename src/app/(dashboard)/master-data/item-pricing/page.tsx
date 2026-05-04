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
  Plus, ChevronDown, ChevronRight, Tag, Clock, History, Settings, Trash2,
} from "lucide-react";
import type { ItemPricingRule } from "@/types";
import type { SizeOption } from "@/services/pricing.service";

// ═══════════════════════════════════════════════════════════
// /master-data/item-pricing — versioned pricing config (Admin)
//
// One row per (item, thickness, size). Click a row to expand its
// version history. "Update price" modal creates a new rule that
// auto-closes the prior one.
//
// This is Mr. Arpit's main control panel for sale prices. Operator
// + Salesman never see this page (gated on master_data.read).
//
// The thickness + size catalogues are tenant-editable: click
// "Manage dimensions" to add a new thickness (e.g. 6mm, 10mm) or a
// new size code. Removing one is blocked while pricing rules
// reference it.
// ═══════════════════════════════════════════════════════════

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
  const [showDimensionsModal, setShowDimensionsModal] = useState(false);

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

  const { data: thicknessOptions } = useQuery({
    queryKey: ["pricing-dimension-options", "thickness"],
    queryFn: () => pricingService.listThicknessOptions(),
  });
  const { data: sizeOptions } = useQuery({
    queryKey: ["pricing-dimension-options", "size"],
    queryFn: () => pricingService.listSizeOptions(),
  });
  const thicknesses = thicknessOptions ?? [];
  const sizes = sizeOptions ?? [];
  const sizeLabelMap = useMemo(
    () => Object.fromEntries(sizes.map((s) => [s.code, s.label])) as Record<string, string>,
    [sizes],
  );

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
            actions={
              <div className="flex items-center gap-2">
                <Button
                  kind="ghost"
                  onClick={() => setShowDimensionsModal(true)}
                  title="Add or remove thickness/size options"
                >
                  <Settings size={13} /> Manage dimensions
                </Button>
                <Button
                  kind="primary"
                  disabled={thicknesses.length === 0 || sizes.length === 0}
                  onClick={() => setEditTarget({
                    itemId: itemFilter || "",
                    thickness: thicknesses[0],
                    size: sizes[0]?.code ?? "",
                  })}
                >
                  <Plus size={14} /> Add price rule
                </Button>
              </div>
            }
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
              description="Add the first rule for any thickness × size combination. Once you set a price, it auto-fills on invoices/challans for that item, and you can update it later (with full version history)."
              action={
                <Button
                  kind="primary"
                  disabled={thicknesses.length === 0 || sizes.length === 0}
                  onClick={() => setEditTarget({
                    itemId: itemFilter || "",
                    thickness: thicknesses[0],
                    size: sizes[0]?.code ?? "",
                  })}
                >
                  <Plus size={14} /> Add price rule
                </Button>
              }
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
                          <td className="px-3 py-2 text-[12px] font-mono">{sizeLabelMap[active.size_code] ?? active.size_code}</td>
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

          {/* Helper hint — point at "Manage dimensions" if a needed
              thickness/size isn't on the list yet. */}
          <p className="text-[11px] text-text-tertiary">
            Need a thickness or size that isn&apos;t on the list?{" "}
            <button
              onClick={() => setShowDimensionsModal(true)}
              className="text-brand hover:underline"
            >
              Manage dimensions →
            </button>
          </p>

          <p className="text-[11px] text-text-tertiary">
            Pricing changes take effect from the date you choose. Historical invoices and challans keep their original price (snapshotted on the line); only NEW lines created after the effective date use the new price.
          </p>
        </div>

        {editTarget && (
          <UpdatePriceModal
            itemName={itemById.get(editTarget.itemId)?.name ?? ""}
            itemId={editTarget.itemId}
            thickness={editTarget.thickness}
            size={editTarget.size}
            currentPrice={editTarget.currentPrice}
            allItems={itemsList.filter((i) => i.is_active)}
            thicknessOptions={thicknesses}
            sizeOptions={sizes}
            onClose={() => setEditTarget(null)}
          />
        )}

        {showDimensionsModal && (
          <ManageDimensionsModal
            thicknesses={thicknesses}
            sizes={sizes}
            onClose={() => setShowDimensionsModal(false)}
          />
        )}
      </div>
    </RequireRead>
  );
}

function UpdatePriceModal({
  itemName, itemId, thickness, size, currentPrice, allItems,
  thicknessOptions, sizeOptions, onClose,
}: {
  itemName: string;
  /** Empty string when adding a fresh rule (item picker shown). */
  itemId: string;
  thickness: number;
  size: string;
  currentPrice?: string;
  allItems: Array<{ id: string; item_code: string; name: string }>;
  thicknessOptions: number[];
  sizeOptions: SizeOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [itemIdVal, setItemIdVal] = useState(itemId);
  const [thicknessVal, setThicknessVal] = useState(thickness);
  const [sizeVal, setSizeVal] = useState(size);
  const [salePrice, setSalePrice] = useState(currentPrice ?? "");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const isNew = !itemId; // when invoked without itemId, this is "add fresh"
  const isExistingCombo = !!currentPrice;
  const titleText = isExistingCombo
    ? `Update price — ${itemName}`
    : isNew
      ? "Add price rule"
      : `Add price for ${itemName}`;

  const create = useMutation({
    mutationFn: () => pricingService.create({
      item_id: itemIdVal,
      thickness_mm: thicknessVal,
      size_code: sizeVal,
      sale_price: salePrice,
      valid_from: validFrom,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success(
        isExistingCombo ? "New price recorded" : "Pricing rule created",
        isExistingCombo
          ? "Prior rule's effective period closed automatically."
          : "Will auto-fill on invoices/challans for this combination.",
      );
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      onClose();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not save"),
  });

  return (
    <Dialog open onClose={onClose} title={titleText} width="md">
      <div className="space-y-3">
        <p className="text-[12px] text-text-secondary">
          {isExistingCombo
            ? "The new price takes effect from the date below. The previous price for this combination will be marked as historical with its end date set to the day before."
            : "Set the first price for this combination. It will be the active rule from the effective date you choose, until you update it."}
        </p>

        {/* Item picker — shown when creating fresh from the top button.
            Locked to a fixed item when triggered from an existing row. */}
        {isNew && (
          <FormField label="Item" required help="Pick the item this price rule applies to.">
            <select
              value={itemIdVal}
              onChange={(e) => setItemIdVal(e.target.value)}
              className="w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5 h-9"
            >
              <option value="">— Select item —</option>
              {allItems
                .sort((a, b) => a.item_code.localeCompare(b.item_code))
                .map((i) => (
                  <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>
                ))}
            </select>
          </FormField>
        )}
        {!isNew && itemId && (
          <div className="text-[12px] text-text-tertiary p-2.5 rounded bg-bg-subtle border border-border">
            Item: <span className="font-medium text-text-primary">{itemName}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Thickness" required help="Panel thickness in millimetres.">
            <select
              value={thicknessVal}
              onChange={(e) => setThicknessVal(Number(e.target.value))}
              className="w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5 h-9"
            >
              {thicknessOptions.map((t) => <option key={t} value={t}>{t} mm</option>)}
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
              {sizeOptions.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </FormField>
        </div>

        {currentPrice && (
          <div className="text-[12px] text-text-tertiary p-2.5 rounded bg-bg-subtle border border-border">
            Currently <span className="font-mono">{formatCurrency(currentPrice, "INR", "en-IN")}</span>
            {" "}for {thickness}mm · {sizeOptions.find((s) => s.code === size)?.label ?? size}.
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
            disabled={!salePrice || Number(salePrice) <= 0 || !itemIdVal || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus size={13} /> Save new price
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// Manage thickness/size catalogues
// ═══════════════════════════════════════════════════════════

function ManageDimensionsModal({
  thicknesses, sizes, onClose,
}: {
  thicknesses: number[];
  sizes: SizeOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [newThickness, setNewThickness] = useState("");
  const [newSizeCode, setNewSizeCode] = useState("");
  const [newSizeLabel, setNewSizeLabel] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pricing-dimension-options"] });
  };

  const addThickness = useMutation({
    mutationFn: (v: number) => pricingService.addThicknessOption(v),
    onSuccess: () => {
      toast.success("Thickness added", "It is now selectable when creating pricing rules.");
      setNewThickness("");
      invalidate();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not add"),
  });
  const removeThickness = useMutation({
    mutationFn: (v: number) => pricingService.removeThicknessOption(v),
    onSuccess: () => { toast.success("Thickness removed"); invalidate(); },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not remove"),
  });
  const addSize = useMutation({
    mutationFn: (payload: SizeOption) => pricingService.addSizeOption(payload),
    onSuccess: () => {
      toast.success("Size added", "It is now selectable when creating pricing rules.");
      setNewSizeCode("");
      setNewSizeLabel("");
      invalidate();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not add"),
  });
  const removeSize = useMutation({
    mutationFn: (code: string) => pricingService.removeSizeOption(code),
    onSuccess: () => { toast.success("Size removed"); invalidate(); },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not remove"),
  });

  const submitThickness = () => {
    const v = Number(newThickness);
    if (!v || v <= 0) {
      toast.error("Enter a positive number, e.g. 6 or 10");
      return;
    }
    addThickness.mutate(v);
  };
  const submitSize = () => {
    const code = newSizeCode.trim();
    if (!code) {
      toast.error("Size code is required (e.g. 1220x4880)");
      return;
    }
    addSize.mutate({ code, label: newSizeLabel.trim() || code });
  };

  return (
    <Dialog open onClose={onClose} title="Manage thickness & size options" width="lg">
      <div className="space-y-5">
        <p className="text-[12px] text-text-secondary">
          These lists drive the thickness and size dropdowns on every pricing rule, invoice, and challan.
          Add a new option here to make it available everywhere it&apos;s needed.
          You cannot remove an option while pricing rules still reference it.
        </p>

        {/* Thicknesses */}
        <section>
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Thicknesses (mm)
          </h3>
          <div className="rounded-md border border-border bg-bg-base divide-y divide-border">
            {thicknesses.length === 0 ? (
              <div className="p-3 text-[12px] text-text-tertiary">No thicknesses configured yet.</div>
            ) : thicknesses.map((t) => (
              <div key={t} className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] tabular-nums">{t} mm</span>
                <Button
                  kind="ghost"
                  onClick={() => {
                    if (window.confirm(`Remove ${t}mm from the list?`)) removeThickness.mutate(t);
                  }}
                  disabled={removeThickness.isPending}
                  title="Remove"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <FormField label="Add a thickness" help="Enter the value in millimetres, e.g. 6, 10, 12.">
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder="e.g. 6"
                  value={newThickness}
                  onChange={(e) => setNewThickness(e.target.value)}
                />
              </FormField>
            </div>
            <Button
              kind="primary"
              onClick={submitThickness}
              disabled={!newThickness || addThickness.isPending}
            >
              <Plus size={13} /> Add
            </Button>
          </div>
        </section>

        {/* Sizes */}
        <section>
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Sizes
          </h3>
          <div className="rounded-md border border-border bg-bg-base divide-y divide-border">
            {sizes.length === 0 ? (
              <div className="p-3 text-[12px] text-text-tertiary">No sizes configured yet.</div>
            ) : sizes.map((s) => (
              <div key={s.code} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="text-[13px] font-mono">{s.code}</span>
                  <span className="ml-2 text-[12px] text-text-tertiary">{s.label}</span>
                </div>
                <Button
                  kind="ghost"
                  onClick={() => {
                    if (window.confirm(`Remove ${s.code} from the list?`)) removeSize.mutate(s.code);
                  }}
                  disabled={removeSize.isPending}
                  title="Remove"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <FormField label="Code" required help="Compact identifier, e.g. 1220x4880.">
              <Input
                placeholder="1220x4880"
                value={newSizeCode}
                onChange={(e) => setNewSizeCode(e.target.value)}
              />
            </FormField>
            <FormField label="Label" help="Friendly name shown in dropdowns.">
              <Input
                placeholder="1220 × 4880 mm (4×16 ft)"
                value={newSizeLabel}
                onChange={(e) => setNewSizeLabel(e.target.value)}
              />
            </FormField>
            <Button kind="primary" onClick={submitSize} disabled={!newSizeCode || addSize.isPending}>
              <Plus size={13} /> Add size
            </Button>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button kind="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}
