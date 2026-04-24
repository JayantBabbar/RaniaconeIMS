"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  itemService,
  brandService,
  categoryService,
} from "@/services/items.service";
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
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Item Detail Page — 10 tabs
// ═══════════════════════════════════════════════════════════

const TABS = [
  { id: "general", label: "General", icon: Box },
  { id: "identifiers", label: "Identifiers", icon: Barcode },
  { id: "variants", label: "Variants", icon: Layers },
  { id: "uoms", label: "UoMs", icon: Ruler },
  { id: "lots", label: "Lots", icon: Package },
  { id: "serials", label: "Serials", icon: Hash },
  { id: "stock", label: "Stock", icon: BarChart3 },
  { id: "reorder", label: "Reorder", icon: AlertTriangle },
  { id: "custom-fields", label: "Custom Fields", icon: FileText },
  { id: "attachments", label: "Attachments", icon: Paperclip },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("general");
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
        {activeTab === "identifiers" && <IdentifiersTab itemId={id} canWrite={canItemsWrite} />}
        {activeTab === "variants" && <VariantsTab itemId={id} canWrite={canItemsWrite} />}
        {activeTab === "uoms" && <UoMsTab itemId={id} canWrite={canItemsWrite} />}
        {activeTab === "lots" && <LotsTab itemId={id} canWrite={canLotsWrite} />}
        {activeTab === "serials" && <SerialsTab itemId={id} canWrite={canSerialsWrite} />}
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

function ReorderTab({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const { data: policies, isLoading } = useQuery({
    queryKey: ["itemReorderPolicies", itemId],
    queryFn: () => itemService.listReorderPolicies(itemId),
  });

  return (
    <SubResourceTable
      title="Reorder Policies"
      icon={<AlertTriangle size={20} />}
      emptyText="No reorder policies"
      emptyDesc="Set min/max stock levels per location"
      isLoading={isLoading}
      headers={["Location", "Min Qty", "Max Qty", "Reorder Point", "Reorder Qty"]}
      canWrite={canWrite}
      rows={(policies || []).map((p) => [
        <span key="l" className="font-mono text-xs">{p.location_id.slice(0, 8)}…</span>,
        <span key="mn" className="tabular-nums font-medium">{formatNumber(p.min_qty)}</span>,
        <span key="mx" className="tabular-nums">{p.max_qty ? formatNumber(p.max_qty) : "—"}</span>,
        <span key="rp" className="tabular-nums">{p.reorder_point ? formatNumber(p.reorder_point) : "—"}</span>,
        <span key="rq" className="tabular-nums">{p.reorder_qty ? formatNumber(p.reorder_qty) : "—"}</span>,
      ])}
    />
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
