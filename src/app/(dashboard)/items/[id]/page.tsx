"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading, Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea, Checkbox } from "@/components/ui/form-elements";
import { Can, useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import {
  itemService,
  brandService,
  categoryService,
} from "@/services/items.service";
import { partyPricingService } from "@/services/party-pricing.service";
import { partyService } from "@/services/parties.service";
import { THICKNESSES_MM } from "@/lib/constants";
import type {
  ItemIdentifier,
  ItemVariant,
  ItemUom,
  Lot,
  Serial,
  ReorderPolicy,
} from "@/services/items.service";
import { isApiError } from "@/lib/api-client";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { Item, Balance } from "@/types";
import {
  ArrowLeft,
  Copy,
  Edit,
  Plus,
  Trash2,
  Box,
  Barcode,
  Layers,
  Ruler,
  Package,
  Hash,
  BarChart3,
  AlertTriangle,
  FileText,
  Paperclip,
  Calendar,
  ArrowUp,
  ArrowDown,
  Check,
  ExternalLink,
  Truck,
  Users,
  DollarSign,
  Save,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Item Detail Page — 10 tabs
// ═══════════════════════════════════════════════════════════

const TABS = [
  { id: "general", label: "General", icon: Box },
  { id: "set-prices", label: "Set Prices", icon: DollarSign },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "customers", label: "Customers", icon: Users },
  { id: "identifiers", label: "Identifiers", icon: Barcode },
  { id: "variants", label: "Variants", icon: Layers },
  { id: "uoms", label: "UoMs", icon: Ruler },
  { id: "lots", label: "Lots", icon: Package },
  // Hidden for Nova Bond — items are batch-tracked (lots), not serial-tracked.
  // Re-add when items with per-unit IDs are introduced.
  // { id: "serials", label: "Serials", icon: Hash },
  { id: "stock", label: "Stock", icon: BarChart3 },
  { id: "reorder", label: "Reorder", icon: AlertTriangle },
  { id: "custom-fields", label: "Custom Fields", icon: FileText },
  { id: "attachments", label: "Attachments", icon: Paperclip },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  // Read `?tab=` so deep-links (e.g. from /items/new) land on the
  // requested tab without an extra click.
  const initialTab: TabId = useMemo(() => {
    const requested = sp.get("tab");
    return (TABS.some((t) => t.id === requested) ? requested : "general") as TabId;
  }, [sp]);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  const { can } = useCan();
  const canItemsRead = can("inventory.items.read");
  const canItemsWrite = can("inventory.items.write");
  const canLotsWrite = can("inventory.lots.write");
  const canSerialsWrite = can("inventory.serials.write");
  const canReorderWrite = can("inventory.reorder_policies.write");

  // Fetch item
  const { data, isLoading } = useQuery({
    queryKey: ["item", id],
    queryFn: () => itemService.getById(id),
    enabled: !!id && canItemsRead,
  });

  if (!canItemsRead) {
    return <ForbiddenState crumbs={["Inventory", "Items"]} missingPerm="inventory.items.read" />;
  }
  if (isLoading) return <PageLoading />;
  if (!data) return <PageLoading />;

  const { item, etag } = data;

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-hidden">
      <TopBar
        crumbs={["Inventory", "Items", item.item_code]}
        right={
          <>
            <Can perm="inventory.items.write">
              <Button icon={<Copy size={13} />}>Duplicate</Button>
              <Button icon={<Edit size={13} />}>Edit</Button>
            </Can>
            <Can perm="inventory.movements.write">
              <Button kind="primary" icon={<Plus size={13} />}>
                New Movement
              </Button>
            </Can>
          </>
        }
      />

      {/* Header */}
      <div className="bg-white border-b border-hairline">
        <div className="px-5 pt-4 pb-0">
          <button
            onClick={() => router.push("/items")}
            className="flex items-center gap-1.5 text-xs text-foreground-secondary hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft size={12} /> Back to items
          </button>

          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0">
              <Box size={22} className="text-foreground-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-sm text-brand-dark font-medium">
                  {item.item_code}
                </span>
                <StatusBadge status={item.is_active ? "active" : "inactive"} />
                {item.is_batch_tracked && <Badge tone="blue">Batch Tracked</Badge>}
                {item.is_serial_tracked && <Badge tone="blue">Serial Tracked</Badge>}
                <Badge tone="neutral">v{item.version}</Badge>
              </div>
              <PageHeader
                title={item.name}
                description="Everything about this item — identifiers, unit conversions, lots, serials, reorder policies, current stock, and custom fields. Changes to each tab save independently."
                learnMore="Each tab corresponds to a sub-resource. Edits here respect optimistic locking via If-Match — if two people edit at the same time, the second person gets a 'this was modified, reload' notice."
                className="mt-1"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? "border-brand text-foreground font-medium"
                      : "border-transparent text-foreground-secondary hover:text-foreground hover:border-hairline"
                  )}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-5">
        {activeTab === "general" && <GeneralTab item={item} />}
        {activeTab === "set-prices" && <SetPricesTab itemId={id} />}
        {activeTab === "suppliers" && <SuppliersTab itemId={id} />}
        {activeTab === "customers" && <CustomersTab itemId={id} />}
        {activeTab === "identifiers" && <IdentifiersTab itemId={id} canWrite={canItemsWrite} />}
        {activeTab === "variants" && <VariantsTab itemId={id} canWrite={canItemsWrite} />}
        {activeTab === "uoms" && <UoMsTab itemId={id} canWrite={canItemsWrite} />}
        {activeTab === "lots" && <LotsTab itemId={id} canWrite={canLotsWrite} />}
        {/* Serials tab hidden — see TABS const above. SerialsTab kept in code for re-enable. */}
        {/* {activeTab === "serials" && <SerialsTab itemId={id} canWrite={canSerialsWrite} />} */}
        {activeTab === "stock" && <StockTab itemId={id} />}
        {activeTab === "reorder" && <ReorderTab itemId={id} canWrite={canReorderWrite} />}
        {activeTab === "custom-fields" && <CustomFieldsTab itemId={id} />}
        {activeTab === "attachments" && <AttachmentsTab itemId={id} canWrite={canItemsWrite} />}
      </div>
    </div>
  );
}

// ── General Tab ───────────────────────────────────────────

function GeneralTab({ item }: { item: Item }) {
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => brandService.list(), staleTime: 5 * 60 * 1000 });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list(), staleTime: 5 * 60 * 1000 });

  const brandName = (brands?.data || []).find((b) => b.id === item.brand_id)?.name || "—";
  const catName = (categories?.data || []).find((c) => c.id === item.category_id)?.name || "—";

  return (
    <div className="bg-white border border-hairline rounded-md p-5 max-w-3xl">
      <h2 className="text-sm font-semibold mb-4">Item Information</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <FieldDisplay label="Item Code" value={item.item_code} mono />
        <FieldDisplay label="Name" value={item.name} />
        <FieldDisplay label="Item Type" value={item.item_type} />
        <FieldDisplay label="Category" value={catName} />
        <FieldDisplay label="Brand" value={brandName} />
        <FieldDisplay label="Base UoM ID" value={item.base_uom_id || "—"} mono />
      </div>

      <div className="border-t border-hairline mt-5 pt-5">
        <h3 className="text-sm font-semibold mb-3">Description</h3>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          {item.description || "No description provided."}
        </p>
      </div>

      <div className="border-t border-hairline mt-5 pt-5">
        <h3 className="text-sm font-semibold mb-3">Tracking</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center", item.is_batch_tracked ? "bg-brand border-brand" : "border-foreground-faint")}>
              {item.is_batch_tracked && <Check size={11} className="text-white" />}
            </div>
            <span className="text-sm">Batch / Lot Tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center", item.is_serial_tracked ? "bg-brand border-brand" : "border-foreground-faint")}>
              {item.is_serial_tracked && <Check size={11} className="text-white" />}
            </div>
            <span className="text-sm">Serial Number Tracking</span>
          </div>
        </div>
      </div>

      <div className="border-t border-hairline mt-5 pt-5 text-xs text-foreground-muted">
        Created {formatDate(item.created_at)} · Updated {formatDate(item.updated_at)} · Version {item.version}
      </div>
    </div>
  );
}

// ── Identifiers Tab ───────────────────────────────────────

function IdentifiersTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: identifiers, isLoading } = useQuery({
    queryKey: ["itemIdentifiers", itemId],
    queryFn: () => itemService.listIdentifiers(itemId),
  });

  return (
    <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-3xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <h2 className="text-sm font-semibold">Identifiers</h2>
        {canWrite && <Button size="sm" icon={<Plus size={12} />} onClick={() => setShowAdd(true)}>Add</Button>}
      </div>
      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : (
        !identifiers || identifiers.length === 0 ? (
          <EmptyState icon={<Barcode size={20} />} title="No identifiers" description="Add barcodes, SKUs, or GTINs" />
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Value</th>
              <th className="text-right px-4 py-2 font-medium">Added</th>
            </tr></thead>
            <tbody>{identifiers.map((ident) => (
              <tr key={ident.id} className="border-t border-hairline-light">
                <td className="px-4 py-2"><Badge tone="neutral">{ident.identifier_type}</Badge></td>
                <td className="px-4 py-2 font-mono text-xs font-medium">{ident.identifier_value}</td>
                <td className="px-4 py-2 text-right text-foreground-muted text-xs">{formatDate(ident.created_at, "short")}</td>
              </tr>
            ))}</tbody>
          </table>
        )
      )}
      <AddIdentifierDialog open={showAdd} onClose={() => setShowAdd(false)} itemId={itemId} />
    </div>
  );
}

function AddIdentifierDialog({ open, onClose, itemId }: { open: boolean; onClose: () => void; itemId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState("barcode");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await itemService.addIdentifier(itemId, { identifier_type: type, identifier_value: value });
      toast.success("Identifier added");
      queryClient.invalidateQueries({ queryKey: ["itemIdentifiers", itemId] });
      onClose();
      setType("barcode");
      setValue("");
    } catch (err) { toast.error(isApiError(err) ? err.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add an identifier"
      description="Barcodes, GTINs, supplier SKUs, or any other code someone scans or types when looking up this item."
      width="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Type"
          placeholder="barcode"
          required
          help="What kind of identifier it is — e.g. barcode, gtin, sku, mpn."
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Input
          label="Value"
          placeholder="1234567890123"
          required
          help="The actual code. Must be unique across all items in this workspace."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Set Prices Tab ────────────────────────────────────────
// One matrix per side (cost from suppliers, sale to customers). Each
// cell is a thickness × party slot. Pre-fills with the currently-active
// rule for that combo; saving fans out one POST per changed cell which
// inserts a new versioned row and auto-closes the prior. Empty / zero
// cells are skipped so admins can fill prices incrementally.
function SetPricesTab({ itemId }: { itemId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canCosts  = can("inventory.party_costs.write");
  const canPrices = can("inventory.party_prices.write");

  const { data: partiesRes } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });
  const parties = partiesRes?.data ?? [];
  const suppliers = parties.filter((p) => p.party_type === "supplier" || p.party_type === "vendor" || p.party_type === "both");
  const customers = parties.filter((p) => p.party_type === "customer" || p.party_type === "both");

  const { data: costRowsRes, isLoading: costsLoading } = useQuery({
    queryKey: ["partyItemCosts", { item_id: itemId, active_only: true }],
    queryFn: () => partyPricingService.costs.list({ item_id: itemId, active_only: true, limit: 200 }),
  });
  const { data: priceRowsRes, isLoading: pricesLoading } = useQuery({
    queryKey: ["partyItemSalePrices", { item_id: itemId, active_only: true }],
    queryFn: () => partyPricingService.prices.list({ item_id: itemId, active_only: true, limit: 200 }),
  });

  // Local edit state — keyed `${partyId}|${thickness_mm}` → string value.
  // Two matrices: one for costs (supplier side), one for sale prices.
  const [costGrid, setCostGrid] = useState<Record<string, string>>({});
  const [priceGrid, setPriceGrid] = useState<Record<string, string>>({});
  const [serverCost, setServerCost] = useState<Record<string, string>>({});
  const [serverPrice, setServerPrice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Seed editable grids from server on load (only once data arrives —
  // re-pulls would clobber unsaved edits).
  useEffect(() => {
    if (!costRowsRes || costsLoading) return;
    const next: Record<string, string> = {};
    for (const r of costRowsRes.data ?? []) {
      next[`${r.party_id}|${r.thickness_mm}`] = r.cost;
    }
    setCostGrid(next);
    setServerCost(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costRowsRes?.data]);
  useEffect(() => {
    if (!priceRowsRes || pricesLoading) return;
    const next: Record<string, string> = {};
    for (const r of priceRowsRes.data ?? []) {
      next[`${r.party_id}|${r.thickness_mm}`] = r.sale_price;
    }
    setPriceGrid(next);
    setServerPrice(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRowsRes?.data]);

  const cellKey = (partyId: string, mm: number) => `${partyId}|${mm}`;

  const onSave = async () => {
    setSaving(true);
    let created = 0;
    try {
      // Costs — POST each cell that's non-empty and changed from server.
      if (canCosts) {
        for (const supplier of suppliers) {
          for (const mm of THICKNESSES_MM) {
            const k = cellKey(supplier.id, mm);
            const v = (costGrid[k] ?? "").trim();
            if (!v || Number(v) <= 0) continue;
            if (v === (serverCost[k] ?? "")) continue;
            await partyPricingService.costs.create({
              party_id: supplier.id, item_id: itemId, thickness_mm: mm,
              cost: Number(v).toFixed(2),
            });
            created += 1;
          }
        }
      }
      // Sale prices — symmetric.
      if (canPrices) {
        for (const customer of customers) {
          for (const mm of THICKNESSES_MM) {
            const k = cellKey(customer.id, mm);
            const v = (priceGrid[k] ?? "").trim();
            if (!v || Number(v) <= 0) continue;
            if (v === (serverPrice[k] ?? "")) continue;
            await partyPricingService.prices.create({
              party_id: customer.id, item_id: itemId, thickness_mm: mm,
              sale_price: Number(v).toFixed(2),
            });
            created += 1;
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["partyItemCosts"] });
      qc.invalidateQueries({ queryKey: ["partyItemSalePrices"] });
      if (created === 0) {
        toast.success("No changes to save", "All cells matched the active server values.");
      } else {
        toast.success(`Saved ${created} price${created === 1 ? "" : "s"}`, "New versions written; prior rows auto-closed.");
      }
    } catch (e) {
      toast.error(isApiError(e) ? e.message : "Could not save prices");
    } finally {
      setSaving(false);
    }
  };

  const renderMatrix = (
    title: string,
    description: string,
    partyList: typeof parties,
    grid: Record<string, string>,
    setGrid: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    serverBaseline: Record<string, string>,
    disabled: boolean,
  ) => (
    <section className="rounded-md border border-hairline bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11.5px] text-foreground-muted mt-0.5">{description}</p>
      </div>
      {partyList.length === 0 ? (
        <div className="p-6 text-center text-sm text-foreground-muted">No matching parties yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-subtle text-text-tertiary text-[10.5px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium min-w-[180px]">Party</th>
                {THICKNESSES_MM.map((mm) => (
                  <th key={mm} className="text-right px-3 py-2 font-medium">{mm} mm</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partyList.map((p) => (
                <tr key={p.id} className="border-t border-hairline">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10.5px] text-foreground-muted font-mono">{p.code}</div>
                  </td>
                  {THICKNESSES_MM.map((mm) => {
                    const k = cellKey(p.id, mm);
                    const v = grid[k] ?? "";
                    const changed = v.trim() !== (serverBaseline[k] ?? "");
                    return (
                      <td key={mm} className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v}
                          disabled={disabled || saving}
                          onChange={(e) => setGrid((m) => ({ ...m, [k]: e.target.value }))}
                          placeholder="—"
                          className={cn(
                            "w-full h-8 px-2 text-sm text-right tabular-nums bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20",
                            changed ? "border-brand bg-brand/5" : "border-hairline",
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const totalChanged =
    Object.entries(costGrid).filter(([k, v]) => (v ?? "").trim() !== (serverCost[k] ?? "")).length +
    Object.entries(priceGrid).filter(([k, v]) => (v ?? "").trim() !== (serverPrice[k] ?? "")).length;

  if (costsLoading || pricesLoading) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md bg-bg-subtle border border-hairline px-4 py-3 text-[12.5px] text-foreground-secondary">
        Fill in the per-thickness prices for each party. Empty cells stay un-priced; filled cells become the new active price (the prior version gets auto-closed). One click of <span className="font-semibold">Save</span> commits every changed cell.
      </div>

      {renderMatrix(
        "Cost from suppliers",
        "What each supplier charges you per unit (₹, no GST shown). Drives the auto-fill on vendor bills.",
        suppliers,
        costGrid,
        setCostGrid,
        serverCost,
        !canCosts,
      )}

      {renderMatrix(
        "Sale price to customers (GST-inclusive)",
        "Customer-visible per-unit price, including GST. Drives the auto-fill on estimates and invoices; the invoice reverse-calculates the taxable base from this.",
        customers,
        priceGrid,
        setPriceGrid,
        serverPrice,
        !canPrices,
      )}

      <div className="flex items-center gap-2 sticky bottom-3">
        <Button
          kind="primary"
          icon={<Save size={13} />}
          onClick={onSave}
          loading={saving}
          disabled={saving || totalChanged === 0 || (!canCosts && !canPrices)}
        >
          Save {totalChanged > 0 ? `${totalChanged} change${totalChanged === 1 ? "" : "s"}` : "prices"}
        </Button>
        <span className="text-[11px] text-foreground-muted">
          {totalChanged === 0 ? "No edits yet" : "Highlighted cells are pending save"}
        </span>
      </div>
    </div>
  );
}

// ── Suppliers Tab ─────────────────────────────────────────
// Read-only view of which suppliers carry this item and at what cost.
// Edits happen on the supplier's party detail page.

function SuppliersTab({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { can } = useCan();
  const canReadCosts = can("inventory.party_costs.read");
  const { data: rowsRes, isLoading } = useQuery({
    queryKey: ["partyItemCosts", { item_id: itemId, active_only: true }],
    queryFn: () => partyPricingService.costs.list({ item_id: itemId, active_only: true, limit: 200 }),
    enabled: canReadCosts,
  });
  const { data: partiesRes } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: canReadCosts,
  });
  const partyById = new Map((partiesRes?.data ?? []).map((p) => [p.id, p]));

  if (!canReadCosts) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">Cost visibility is restricted</p>
        <p className="text-xs text-foreground-muted mt-1">
          Your role doesn&apos;t include access to supplier cost data. Ask your admin to grant <code className="font-mono text-[11px]">inventory.party_costs.read</code> if you need to see this.
        </p>
      </div>
    );
  }
  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  const rows = rowsRes?.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">No supplier costs recorded for this item</p>
        <p className="text-xs text-foreground-muted mt-1">
          Open a supplier&apos;s Party page and add an Item Cost to seed this list.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted">
        Suppliers who currently carry this item, sorted by cost. Click a row to manage that supplier&apos;s pricelist.
      </p>
      <div className="bg-white border border-hairline rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Supplier</th>
              <th className="text-right px-3 py-2 font-medium">Current cost</th>
              <th className="text-left px-3 py-2 font-medium">Effective since</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => Number(a.cost) - Number(b.cost)).map((r) => {
              const p = partyById.get(r.party_id);
              return (
                <tr
                  key={r.id}
                  className="border-t border-hairline hover:bg-bg-subtle cursor-pointer"
                  onClick={() => router.push(`/parties/${r.party_id}?tab=item-costs`)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{p?.name ?? r.party_id}</div>
                    <div className="text-[11px] text-foreground-muted font-mono">{p?.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(r.cost, "INR", "en-IN")}
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{formatDate(r.valid_from)}</td>
                  <td className="px-3 py-2 text-foreground-muted truncate max-w-[200px]">{r.notes ?? ""}</td>
                  <td className="px-3 py-2 text-foreground-muted"><ExternalLink size={12} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Customers Tab ─────────────────────────────────────────
// Read-only view of which customers have a negotiated per-unit price
// for this item. Edits happen on the customer's party detail page.

function CustomersTab({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { can } = useCan();
  const canReadPrices = can("inventory.party_prices.read");
  const { data: rowsRes, isLoading } = useQuery({
    queryKey: ["partyItemSalePrices", { item_id: itemId, active_only: true }],
    queryFn: () => partyPricingService.prices.list({ item_id: itemId, active_only: true, limit: 200 }),
    enabled: canReadPrices,
  });
  const { data: partiesRes } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: canReadPrices,
  });
  const partyById = new Map((partiesRes?.data ?? []).map((p) => [p.id, p]));

  if (!canReadPrices) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">Customer price visibility is restricted</p>
        <p className="text-xs text-foreground-muted mt-1">
          Your role doesn&apos;t include access to per-customer price data. Ask your admin to grant <code className="font-mono text-[11px]">inventory.party_prices.read</code>.
        </p>
      </div>
    );
  }
  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  const rows = rowsRes?.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">No customer-specific prices for this item</p>
        <p className="text-xs text-foreground-muted mt-1">
          Without per-customer rows, every customer&apos;s invoice line falls back to this item&apos;s default sale price.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted">
        Customers who currently have negotiated pricing for this item. Click a row to manage that customer&apos;s pricelist.
      </p>
      <div className="bg-white border border-hairline rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-right px-3 py-2 font-medium">Current price</th>
              <th className="text-left px-3 py-2 font-medium">Effective since</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => Number(b.sale_price) - Number(a.sale_price)).map((r) => {
              const p = partyById.get(r.party_id);
              return (
                <tr
                  key={r.id}
                  className="border-t border-hairline hover:bg-bg-subtle cursor-pointer"
                  onClick={() => router.push(`/parties/${r.party_id}?tab=sale-prices`)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{p?.name ?? r.party_id}</div>
                    <div className="text-[11px] text-foreground-muted font-mono">{p?.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(r.sale_price, "INR", "en-IN")}
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{formatDate(r.valid_from)}</td>
                  <td className="px-3 py-2 text-foreground-muted truncate max-w-[200px]">{r.notes ?? ""}</td>
                  <td className="px-3 py-2 text-foreground-muted"><ExternalLink size={12} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Variants Tab ──────────────────────────────────────────

function VariantsTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const { data: variants, isLoading } = useQuery({
    queryKey: ["itemVariants", itemId],
    queryFn: () => itemService.listVariants(itemId),
  });

  return (
    <SubResourceTable
      title="Variants"
      icon={<Layers size={20} />}
      emptyText="No variants defined"
      emptyDesc="Add size, color, or material variations"
      isLoading={isLoading}
      headers={["Code", "Name", "Created"]}
      canWrite={canWrite}
      rows={(variants || []).map((v) => [
        <span key="c" className="font-mono text-xs font-medium">{v.variant_code}</span>,
        v.name,
        formatDate(v.created_at, "short"),
      ])}
    />
  );
}

// ── UoMs Tab ──────────────────────────────────────────────

function UoMsTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const { data: uoms, isLoading } = useQuery({
    queryKey: ["itemUoms", itemId],
    queryFn: () => itemService.listUoms(itemId),
  });

  return (
    <SubResourceTable
      title="Alternative Units of Measure"
      icon={<Ruler size={20} />}
      emptyText="No alternative UoMs"
      emptyDesc="Add conversion units (e.g. 1 Box = 12 Each)"
      isLoading={isLoading}
      headers={["UoM ID", "Factor", "Purchase", "Sales"]}
      canWrite={canWrite}
      rows={(uoms || []).map((u) => [
        <span key="u" className="font-mono text-xs">{u.uom_id.slice(0, 8)}…</span>,
        <span key="f" className="tabular-nums font-medium">{u.conversion_factor}</span>,
        u.is_purchase ? <Badge key="p" tone="green">Yes</Badge> : <span key="p" className="text-foreground-muted">—</span>,
        u.is_sales ? <Badge key="s" tone="green">Yes</Badge> : <span key="s" className="text-foreground-muted">—</span>,
      ])}
    />
  );
}

// ── Lots Tab ──────────────────────────────────────────────

function LotsTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const { data: lots, isLoading } = useQuery({
    queryKey: ["itemLots", itemId],
    queryFn: () => itemService.listLots(itemId),
  });

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const d = new Date(date);
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    return d <= thirtyDays;
  };

  return (
    <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-4xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <h2 className="text-sm font-semibold">Lots / Batches</h2>
        {canWrite && <Button size="sm" icon={<Plus size={12} />}>Add Lot</Button>}
      </div>
      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : (
        !lots || lots.length === 0 ? (
          <EmptyState icon={<Package size={20} />} title="No lots" description="Create lots with manufacturing and expiry dates" />
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
              <th className="text-left px-4 py-2 font-medium">Lot Number</th>
              <th className="text-left px-4 py-2 font-medium">Mfg Date</th>
              <th className="text-left px-4 py-2 font-medium">Expiry Date</th>
              <th className="text-right px-4 py-2 font-medium">Received Qty</th>
            </tr></thead>
            <tbody>{lots.map((lot) => (
              <tr key={lot.id} className={cn("border-t border-hairline-light", isExpiringSoon(lot.expiry_date) && "bg-status-amber-bg/50")}>
                <td className="px-4 py-2 font-mono text-xs font-medium">{lot.lot_number}</td>
                <td className="px-4 py-2 text-foreground-secondary">{lot.mfg_date ? formatDate(lot.mfg_date, "short") : "—"}</td>
                <td className="px-4 py-2">
                  <span className={isExpiringSoon(lot.expiry_date) ? "text-status-amber-text font-medium" : "text-foreground-secondary"}>
                    {lot.expiry_date ? formatDate(lot.expiry_date, "short") : "—"}
                  </span>
                  {isExpiringSoon(lot.expiry_date) && <Badge tone="amber" className="ml-2">Expiring Soon</Badge>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatNumber(lot.received_qty)}</td>
              </tr>
            ))}</tbody>
          </table>
        )
      )}
    </div>
  );
}

// ── Serials Tab ───────────────────────────────────────────

function SerialsTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const { data: serials, isLoading } = useQuery({
    queryKey: ["itemSerials", itemId],
    queryFn: () => itemService.listSerials(itemId),
  });

  return (
    <SubResourceTable
      title="Serial Numbers"
      icon={<Hash size={20} />}
      emptyText="No serial numbers"
      emptyDesc="Add individual serial numbers for tracking"
      isLoading={isLoading}
      headers={["Serial Number", "Status", "Created"]}
      canWrite={canWrite}
      rows={(serials || []).map((s) => [
        <span key="sn" className="font-mono text-xs font-medium">{s.serial_number}</span>,
        <StatusBadge key="st" status={s.status} />,
        formatDate(s.created_at, "short"),
      ])}
    />
  );
}

// ── Stock Tab ─────────────────────────────────────────────

function StockTab({ itemId }: { itemId: string }) {
  const { data: balances, isLoading } = useQuery({
    queryKey: ["itemBalances", itemId],
    queryFn: () => itemService.getBalances(itemId),
  });

  return (
    <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-4xl">
      <div className="px-4 py-3 border-b border-hairline">
        <h2 className="text-sm font-semibold">Stock Balance by Location</h2>
      </div>
      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : (
        !balances || balances.length === 0 ? (
          <EmptyState icon={<BarChart3 size={20} />} title="No stock" description="This item has no inventory in any location" />
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
              <th className="text-left px-4 py-2 font-medium">Location</th>
              <th className="text-right px-4 py-2 font-medium">On Hand</th>
              <th className="text-right px-4 py-2 font-medium">Reserved</th>
              <th className="text-right px-4 py-2 font-medium">Available</th>
              <th className="text-right px-4 py-2 font-medium">Value</th>
            </tr></thead>
            <tbody>{balances.map((b) => {
              const available = parseFloat(b.qty_available);
              return (
                <tr key={b.id} className={cn("border-t border-hairline-light", available < 0 && "bg-status-red-bg/30", available === 0 && "text-foreground-muted")}>
                  <td className="px-4 py-2 font-mono text-xs">{b.location_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatNumber(b.qty_on_hand)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-foreground-secondary">{formatNumber(b.qty_reserved)}</td>
                  <td className={cn("px-4 py-2 text-right tabular-nums font-medium", available < 0 ? "text-status-red-text" : available === 0 ? "text-foreground-muted" : "")}>
                    {formatNumber(b.qty_available)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(b.value)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )
      )}
    </div>
  );
}

// ── Reorder Tab ───────────────────────────────────────────

// ── Reorder Policies — interactive CRUD per item × location ─
//
// Mr. Arpit needs to set the low-stock threshold per item per
// location and update it as stock-velocity changes. This tab
// provides the full create/edit/delete cycle.
//
// Fields per policy:
//   min_qty       — absolute minimum (alarm if available falls below)
//   reorder_point — soft trigger (alert when available <= this)
//   reorder_qty   — how much to reorder when triggered
//   max_qty       — cap (avoids overstock alerts)

function ReorderTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editTarget, setEditTarget] = useState<ReorderPolicy | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReorderPolicy | null>(null);

  const { data: policies, isLoading } = useQuery({
    queryKey: ["itemReorderPolicies", itemId],
    queryFn: () => itemService.listReorderPolicies(itemId),
  });

  const { data: locsRaw } = useQuery({
    queryKey: ["locations"],
    queryFn: () => itemService.getBalances("__noop").catch(() => [] as never[]).then(() => null),
    enabled: false,
  });
  void locsRaw;

  const deleteMut = useMutation({
    mutationFn: (policyId: string) => itemService.deleteReorderPolicy(itemId, policyId),
    onSuccess: () => {
      toast.success("Threshold deleted");
      qc.invalidateQueries({ queryKey: ["itemReorderPolicies", itemId] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not delete"),
  });

  return (
    <div className="bg-white border border-hairline rounded-md max-w-4xl">
      <div className="px-5 py-3 border-b border-hairline flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-status-amber-text" />
            Reorder thresholds
          </h2>
          <p className="text-[12px] text-foreground-secondary mt-0.5">
            One policy per location. The Low Stock Alerts page reads from here.
          </p>
        </div>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setEditTarget("new")}>
            Add threshold
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Spinner size={22} /></div>
      ) : !policies || policies.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="No reorder thresholds"
          description="Set a min/reorder/max per location so this item starts showing on the Low Stock Alerts page when it runs low."
          action={canWrite ? (
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setEditTarget("new")}>
              Add the first threshold
            </Button>
          ) : null}
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
              <th className="text-left px-4 py-2.5">Location</th>
              <th className="text-right px-4 py-2.5">Min</th>
              <th className="text-right px-4 py-2.5">Reorder point</th>
              <th className="text-right px-4 py-2.5">Reorder qty</th>
              <th className="text-right px-4 py-2.5">Max</th>
              {canWrite && <th className="w-20" />}
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} className="border-t border-hairline-light hover:bg-surface/50">
                <td className="px-4 py-2.5 font-mono text-xs">{p.location_id.slice(0, 12)}…</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatNumber(p.min_qty)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.reorder_point ? formatNumber(p.reorder_point) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.reorder_qty ? formatNumber(p.reorder_qty) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.max_qty ? formatNumber(p.max_qty) : "—"}</td>
                {canWrite && (
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setEditTarget(p)}
                      className="text-brand text-xs hover:underline mr-3"
                    >Edit</button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="text-status-red-text text-xs hover:underline"
                    >Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editTarget && (
        <ReorderPolicyModal
          itemId={itemId}
          policy={editTarget === "new" ? null : editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete this threshold?"
          width="sm"
        >
          <p className="text-[13px] text-foreground-secondary">
            This stops the Low Stock Alerts page from monitoring this item at this location. You can re-add it any time.
          </p>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-hairline">
            <Button kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              kind="danger"
              loading={deleteMut.isPending}
              onClick={() => deleteMut.mutate(deleteTarget.id)}
            >Delete</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ReorderPolicyModal({
  itemId, policy, onClose,
}: {
  itemId: string;
  policy: ReorderPolicy | null;       // null = create new
  onClose: () => void;
}) {
  const isEdit = !!policy;
  const qc = useQueryClient();
  const toast = useToast();

  const { data: locsRaw } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { locationService } = await import("@/services/locations.service");
      return locationService.list({ limit: 200 });
    },
  });
  const locations = locsRaw?.data ?? [];

  const [locationId, setLocationId] = useState(policy?.location_id ?? "");
  const [minQty, setMinQty] = useState(policy?.min_qty ?? "");
  const [reorderPoint, setReorderPoint] = useState(policy?.reorder_point ?? "");
  const [reorderQty, setReorderQty] = useState(policy?.reorder_qty ?? "");
  const [maxQty, setMaxQty] = useState(policy?.max_qty ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit && policy) {
        return itemService.updateReorderPolicy(itemId, policy.id, {
          min_qty:       Number(minQty),
          ...(reorderPoint ? { reorder_point: Number(reorderPoint) } : {}),
          ...(reorderQty   ? { reorder_qty:   Number(reorderQty) }   : {}),
          ...(maxQty       ? { max_qty:       Number(maxQty) }       : {}),
        });
      }
      return itemService.addReorderPolicy(itemId, {
        location_id: locationId,
        min_qty:       Number(minQty),
        ...(reorderPoint ? { reorder_point: Number(reorderPoint) } : {}),
        ...(reorderQty   ? { reorder_qty:   Number(reorderQty) }   : {}),
        ...(maxQty       ? { max_qty:       Number(maxQty) }       : {}),
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Threshold updated" : "Threshold added");
      qc.invalidateQueries({ queryKey: ["itemReorderPolicies", itemId] });
      qc.invalidateQueries({ queryKey: ["reorderPoliciesAll"] });
      onClose();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not save"),
  });

  const canSave = !!locationId && !!minQty && Number(minQty) >= 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit threshold" : "Add reorder threshold"}
      description="Set the levels at which this item triggers a low-stock alert at one location."
      width="md"
    >
      <div className="space-y-3">
        <FieldDisplay label="Tip" value="Set 'Reorder point' = the qty at which you want the system to alert. Set 'Reorder qty' = how many to order when alerted. 'Min' is your absolute floor; 'Max' caps overstock alerts." />

        {!isEdit && (
          <div>
            <label className="block text-[12px] font-medium mb-1">Location *</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full text-[13px] rounded border border-hairline bg-white px-2 py-1.5 h-9"
            >
              <option value="">— Select location —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
              ))}
            </select>
          </div>
        )}
        {isEdit && (
          <FieldDisplay label="Location" value={policy.location_id} mono />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min qty"
            type="number"
            min={0}
            required
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
          />
          <Input
            label="Reorder point"
            type="number"
            min={0}
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
          />
          <Input
            label="Reorder qty"
            type="number"
            min={0}
            value={reorderQty}
            onChange={(e) => setReorderQty(e.target.value)}
          />
          <Input
            label="Max qty"
            type="number"
            min={0}
            value={maxQty}
            onChange={(e) => setMaxQty(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button
            kind="primary"
            loading={save.isPending}
            disabled={!canSave}
            onClick={() => save.mutate()}
          >
            {isEdit ? "Save changes" : "Add threshold"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Custom Fields Tab ─────────────────────────────────────

function CustomFieldsTab({ itemId }: { itemId: string }) {
  return (
    <div className="bg-white border border-hairline rounded-md p-5 max-w-3xl">
      <h2 className="text-sm font-semibold mb-3">Custom Fields</h2>
      <p className="text-sm text-foreground-secondary">
        Custom field values for this item will appear here. Configure custom field definitions in Settings.
      </p>
    </div>
  );
}

// ── Attachments Tab ───────────────────────────────────────

function AttachmentsTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  return (
    <div className="bg-white border border-hairline rounded-md p-5 max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Attachments</h2>
        {canWrite && <Button size="sm" icon={<Plus size={12} />}>Add Attachment</Button>}
      </div>
      <EmptyState
        icon={<Paperclip size={20} />}
        title="No attachments"
        description="Upload files and link them to this item"
      />
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────

function FieldDisplay({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted mb-1">
        {label}
      </div>
      <div className={cn("text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </div>
    </div>
  );
}

function SubResourceTable({
  title, icon, emptyText, emptyDesc, isLoading, headers, rows, canWrite,
}: {
  title: string; icon: React.ReactNode; emptyText: string; emptyDesc: string;
  isLoading: boolean; headers: string[]; rows: React.ReactNode[][];
  canWrite?: boolean;
}) {
  return (
    <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-4xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <h2 className="text-sm font-semibold">{title}</h2>
        {canWrite && <Button size="sm" icon={<Plus size={12} />}>Add</Button>}
      </div>
      {isLoading ? <div className="py-8 flex justify-center"><Spinner /></div> : (
        rows.length === 0 ? (
          <EmptyState icon={icon} title={emptyText} description={emptyDesc} />
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
              {headers.map((h, i) => (
                <th key={i} className={cn("px-4 py-2 font-medium", i >= headers.length - 1 ? "text-right" : "text-left")}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{rows.map((cells, i) => (
              <tr key={i} className="border-t border-hairline-light">
                {cells.map((cell, j) => (
                  <td key={j} className={cn("px-4 py-2", j >= cells.length - 1 ? "text-right text-foreground-muted text-xs" : "")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        )
      )}
    </div>
  );
}
