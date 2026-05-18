"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading, Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { partyService } from "@/services/parties.service";
import { ledgerService } from "@/services/ledger.service";
import { accountService } from "@/services/accounts.service";
import { partyPricingService } from "@/services/party-pricing.service";
import { itemService } from "@/services/items.service";
import { THICKNESSES_MM } from "@/lib/constants";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Phone, Mail, Plus, Building2, User,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { PartyItemCost, PartyItemSalePrice, Item } from "@/types";

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useCan();
  const canRead = can("inventory.parties.read");
  const canWrite = can("inventory.parties.write");
  const sp = useSearchParams();
  type TabKey = "overview" | "addresses" | "contacts" | "ledger" | "item-costs" | "sale-prices";
  const ALL_TABS: TabKey[] = ["overview", "addresses", "contacts", "ledger", "item-costs", "sale-prices"];
  const initialTab = (sp.get("tab") as TabKey) || "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);
  // Keep state in sync if query param changes (e.g. arriving from Debtors page)
  useEffect(() => {
    const t = sp.get("tab");
    if (t && (ALL_TABS as string[]).includes(t)) setTab(t as TabKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const { data: party, isLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: () => partyService.getById(id),
    enabled: !!id && canRead,
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Parties"]} missingPerm="inventory.parties.read" />;
  }
  if (isLoading || !party) return <PageLoading />;

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Parties", party.name]} />
      <div className="p-4 md:p-5 space-y-4">
        <button
          onClick={() => router.push("/parties")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to parties
        </button>

        {/* Header card */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-light flex items-center justify-center text-base font-bold text-brand flex-shrink-0">
              {getInitials(party.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge tone={
                  party.party_type === "customer"       ? "blue"
                  : party.party_type === "supplier"     ? "green"
                  : party.party_type === "vendor"       ? "amber"
                  : party.party_type === "general_person" ? "gray"
                  : "amber"
                }>
                  {party.party_type === "general_person"
                    ? "General person"
                    : party.party_type === "both"
                      ? "Both (customer + supplier)"
                      : party.party_type
                        ? party.party_type.charAt(0).toUpperCase() + party.party_type.slice(1)
                        : "—"}
                </Badge>
                {!party.is_active && <Badge tone="red">inactive</Badge>}
              </div>
              <PageHeader
                title={party.name}
                description="Everything about this supplier/customer — addresses, contacts, tax ID, and custom fields. Used on every document tied to this party."
                learnMore="A party can have multiple addresses (billing, shipping, etc.) and multiple contacts. On a document, you pick one address and optionally one contact. If you disable a party here, they can't be selected on new documents but existing ones stay intact."
                className="mt-1"
              />
              <div className="text-xs text-foreground-muted mt-1">
                <code className="font-mono">{party.code}</code>
                {party.legal_name && <span> · {party.legal_name}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs — Item costs appears only for suppliers/vendors */}
        <div className="border-b border-hairline">
          <div className="flex gap-0">
            {(() => {
              const tabs: TabKey[] = ["overview", "addresses", "contacts", "ledger"];
              const isSupplier = party.party_type === "supplier" || party.party_type === "vendor" || party.party_type === "both";
              const isCustomer = party.party_type === "customer" || party.party_type === "both";
              if (isSupplier && can("inventory.party_costs.read")) tabs.push("item-costs");
              if (isCustomer && can("inventory.party_prices.read")) tabs.push("sale-prices");
              const labelFor = (t: TabKey) =>
                t === "item-costs" ? "Item costs"
                : t === "sale-prices" ? "Sale prices"
                : t.charAt(0).toUpperCase() + t.slice(1);
              return tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={
                    "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px " +
                    (tab === t
                      ? "text-brand border-brand"
                      : "text-foreground-secondary border-transparent hover:text-foreground")
                  }
                >
                  {labelFor(t)}
                </button>
              ));
            })()}
          </div>
        </div>

        {tab === "overview" && (
          <div className="bg-white border border-hairline rounded-md p-5 space-y-4 max-w-xl">
            <Row label="Code" value={party.code} mono />
            <Row label="Legal name" value={party.legal_name || "—"} />
            <Row label="Tax ID / GSTIN" value={party.tax_id || "—"} mono />
            <Row label="Opening balance" value={party.opening_balance ? formatCurrency(party.opening_balance, "INR", "en-IN") : "—"} />
            <Row label="Currency" value={party.currency_id || "—"} mono />
            <Row label="Created" value={formatDate(party.created_at)} />
            <Row label="Updated" value={formatDate(party.updated_at)} />
          </div>
        )}

        {tab === "addresses" && <AddressesTab partyId={party.id} canWrite={canWrite} />}
        {tab === "contacts" && <ContactsTab partyId={party.id} canWrite={canWrite} />}
        {tab === "ledger" && <LedgerTab partyId={party.id} />}
        {tab === "item-costs" && (
          <ItemCostsTab partyId={party.id} canWrite={can("inventory.party_costs.write")} />
        )}
        {tab === "sale-prices" && (
          <SalePricesTab partyId={party.id} canWrite={can("inventory.party_prices.write")} />
        )}
      </div>
    </div>
  );
}

// ── Item Costs Tab ─────────────────────────────────────────
// Visible only when the party is a supplier/vendor/both. Shows the
// per-item cost list with version history (collapsed by default,
// expand to see the audit trail of previous costs).
function ItemCostsTab({ partyId, canWrite }: { partyId: string; canWrite: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: rowsRes, isLoading } = useQuery({
    queryKey: ["partyItemCosts", { party_id: partyId }],
    queryFn: () => partyPricingService.costs.list({ party_id: partyId, limit: 200 }),
  });
  const rows = (rowsRes?.data ?? []) as PartyItemCost[];
  const { data: itemsRes } = useQuery({
    queryKey: ["items", { limit: 500 }],
    queryFn: () => itemService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const items = (itemsRes?.data ?? []) as Item[];
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Group rows by item_id; within each group sort by valid_from desc so
  // the active row (valid_until=null) is first.
  const grouped = new Map<string, PartyItemCost[]>();
  rows.forEach((r) => {
    const list = grouped.get(r.item_id) ?? [];
    list.push(r);
    grouped.set(r.item_id, list);
  });
  grouped.forEach((list) => list.sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1)));

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (grouped.size === 0) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">No item costs recorded yet</p>
        <p className="text-xs text-foreground-muted mt-1">
          Add the per-unit cost this supplier charges for each item they carry. Each cost change is stored as a new version, with the prior cost auto-closed.
        </p>
        {canWrite && (
          <div className="mt-4">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAdd(true)}>
              Add item cost
            </Button>
          </div>
        )}
        {showAdd && (
          <AddCostModal partyId={partyId} items={items} onClose={() => setShowAdd(false)}
            onSaved={() => { qc.invalidateQueries({ queryKey: ["partyItemCosts"] }); setShowAdd(false); toast.success("Item cost added"); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          Per-unit costs this supplier charges. Click a row to see the version history.
        </p>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAdd(true)}>
            Add / update cost
          </Button>
        )}
      </div>
      <div className="bg-white border border-hairline rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-8"></th>
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-right px-3 py-2 font-medium">Current cost</th>
              <th className="text-left px-3 py-2 font-medium">Effective since</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([itemId, list]) => {
              const active = list.find((r) => r.valid_until === null);
              const history = list.filter((r) => r.valid_until !== null);
              const item = itemById.get(itemId);
              const isOpen = expanded.has(itemId);
              return (
                <React.Fragment key={itemId}>
                  <tr
                    className="border-t border-hairline hover:bg-bg-subtle cursor-pointer"
                    onClick={() => {
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
                        return n;
                      });
                    }}
                  >
                    <td className="px-3 py-2">
                      {history.length > 0 ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item?.name ?? itemId}</div>
                      <div className="text-[11px] text-foreground-muted font-mono">{item?.item_code}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {active ? formatCurrency(active.cost, "INR", "en-IN") : "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {active ? formatDate(active.valid_from) : "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted truncate max-w-[200px]">
                      {active?.notes ?? ""}
                    </td>
                  </tr>
                  {isOpen && history.length > 0 && (
                    <tr>
                      <td colSpan={5} className="bg-bg-subtle/50 px-3 py-3 border-t border-hairline">
                        <div className="text-[11px] uppercase tracking-wider text-text-tertiary mb-2">History</div>
                        <table className="w-full text-[12.5px]">
                          <thead className="text-text-tertiary text-[10.5px]">
                            <tr>
                              <th className="text-right px-2 py-1 font-medium">Cost</th>
                              <th className="text-left px-2 py-1 font-medium">From</th>
                              <th className="text-left px-2 py-1 font-medium">Until</th>
                              <th className="text-left px-2 py-1 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h) => (
                              <tr key={h.id} className="border-t border-hairline-light">
                                <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(h.cost, "INR", "en-IN")}</td>
                                <td className="px-2 py-1">{formatDate(h.valid_from)}</td>
                                <td className="px-2 py-1">{h.valid_until ? formatDate(h.valid_until) : "—"}</td>
                                <td className="px-2 py-1 text-foreground-muted">{h.notes ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <AddCostModal
          partyId={partyId}
          items={items}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["partyItemCosts"] });
            setShowAdd(false);
            toast.success("Item cost recorded");
          }}
        />
      )}
    </div>
  );
}

function AddCostModal({ partyId, items, onClose, onSaved }: {
  partyId: string;
  items: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    item_id: "",
    thickness_mm: "",
    cost: "",
    valid_from: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ item_id?: string; thickness_mm?: string; cost?: string }>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.item_id) errs.item_id = "Pick an item";
    if (!form.thickness_mm) errs.thickness_mm = "Pick a thickness";
    if (!form.cost || Number(form.cost) <= 0) errs.cost = "Enter a positive cost";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await partyPricingService.costs.create({
        party_id: partyId,
        item_id: form.item_id,
        thickness_mm: Number(form.thickness_mm),
        cost: form.cost,
        valid_from: form.valid_from,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not save cost");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Add / update item cost" description="Setting a new cost auto-closes the previous one for the same (item, thickness). Both rows stay in history." width="sm">
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Item" required error={errors.item_id} help="The item this cost applies to.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={form.item_id}
            disabled={loading}
            onChange={(e) => setForm({ ...form, item_id: e.target.value })}
          >
            <option value="">— Select item —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.item_code} — {it.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Thickness (mm)" required error={errors.thickness_mm} help="Cost is stored per thickness — thicker boards cost more.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={form.thickness_mm}
            disabled={loading}
            onChange={(e) => setForm({ ...form, thickness_mm: e.target.value })}
          >
            <option value="">— Select thickness —</option>
            {THICKNESSES_MM.map((mm) => (
              <option key={mm} value={mm}>{mm} mm</option>
            ))}
          </select>
        </FormField>
        <Input
          label="Cost per unit (₹)"
          required
          type="number"
          step="0.01"
          help="Per-unit cost this supplier charges. The auto-fill on bills uses this."
          error={errors.cost}
          disabled={loading}
          value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value })}
        />
        <Input
          label="Effective from"
          type="date"
          help="When this cost takes effect. The prior active cost gets auto-closed the day before."
          disabled={loading}
          value={form.valid_from}
          onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
        />
        <Input
          label="Notes (optional)"
          placeholder="Q4 contract, monsoon surcharge, etc."
          disabled={loading}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Save cost</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Sale Prices Tab ────────────────────────────────────────
// Mirror of ItemCostsTab on the customer side. Visible only when the
// party is a customer/both. The sale_price is the GST-inclusive
// customer-visible price (consumed by /estimates/new and /invoices/new
// as the line unit_price).
function SalePricesTab({ partyId, canWrite }: { partyId: string; canWrite: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: rowsRes, isLoading } = useQuery({
    queryKey: ["partyItemSalePrices", { party_id: partyId }],
    queryFn: () => partyPricingService.prices.list({ party_id: partyId, limit: 200 }),
  });
  const rows = (rowsRes?.data ?? []) as PartyItemSalePrice[];
  const { data: itemsRes } = useQuery({
    queryKey: ["items", { limit: 500 }],
    queryFn: () => itemService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const items = (itemsRes?.data ?? []) as Item[];
  const itemById = new Map(items.map((i) => [i.id, i]));

  const grouped = new Map<string, PartyItemSalePrice[]>();
  rows.forEach((r) => {
    const list = grouped.get(r.item_id) ?? [];
    list.push(r);
    grouped.set(r.item_id, list);
  });
  grouped.forEach((list) => list.sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1)));

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (grouped.size === 0) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">No customer-specific prices set</p>
        <p className="text-xs text-foreground-muted mt-1">
          Without a price here, estimates and invoices fall back to the item&apos;s default sale price. Add a row to lock in a customer-specific rate.
        </p>
        {canWrite && (
          <div className="mt-4">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAdd(true)}>
              Add item price
            </Button>
          </div>
        )}
        {showAdd && (
          <AddSalePriceModal partyId={partyId} items={items} onClose={() => setShowAdd(false)}
            onSaved={() => { qc.invalidateQueries({ queryKey: ["partyItemSalePrices"] }); setShowAdd(false); toast.success("Item price added"); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          Per-unit prices for this customer (GST-inclusive). Click a row to see the version history.
        </p>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAdd(true)}>
            Add / update price
          </Button>
        )}
      </div>
      <div className="bg-white border border-hairline rounded-md overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-8"></th>
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-right px-3 py-2 font-medium">Current price</th>
              <th className="text-left px-3 py-2 font-medium">Effective since</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([itemId, list]) => {
              const active = list.find((r) => r.valid_until === null);
              const history = list.filter((r) => r.valid_until !== null);
              const item = itemById.get(itemId);
              const isOpen = expanded.has(itemId);
              return (
                <React.Fragment key={itemId}>
                  <tr
                    className="border-t border-hairline hover:bg-bg-subtle cursor-pointer"
                    onClick={() => {
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
                        return n;
                      });
                    }}
                  >
                    <td className="px-3 py-2">
                      {history.length > 0 ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item?.name ?? itemId}</div>
                      <div className="text-[11px] text-foreground-muted font-mono">{item?.item_code}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {active ? formatCurrency(active.sale_price, "INR", "en-IN") : "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {active ? formatDate(active.valid_from) : "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted truncate max-w-[200px]">
                      {active?.notes ?? ""}
                    </td>
                  </tr>
                  {isOpen && history.length > 0 && (
                    <tr>
                      <td colSpan={5} className="bg-bg-subtle/50 px-3 py-3 border-t border-hairline">
                        <div className="text-[11px] uppercase tracking-wider text-text-tertiary mb-2">History</div>
                        <table className="w-full text-[12.5px]">
                          <thead className="text-text-tertiary text-[10.5px]">
                            <tr>
                              <th className="text-right px-2 py-1 font-medium">Price</th>
                              <th className="text-left px-2 py-1 font-medium">From</th>
                              <th className="text-left px-2 py-1 font-medium">Until</th>
                              <th className="text-left px-2 py-1 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h) => (
                              <tr key={h.id} className="border-t border-hairline-light">
                                <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(h.sale_price, "INR", "en-IN")}</td>
                                <td className="px-2 py-1">{formatDate(h.valid_from)}</td>
                                <td className="px-2 py-1">{h.valid_until ? formatDate(h.valid_until) : "—"}</td>
                                <td className="px-2 py-1 text-foreground-muted">{h.notes ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <AddSalePriceModal
          partyId={partyId}
          items={items}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["partyItemSalePrices"] });
            setShowAdd(false);
            toast.success("Item price recorded");
          }}
        />
      )}
    </div>
  );
}

function AddSalePriceModal({ partyId, items, onClose, onSaved }: {
  partyId: string;
  items: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    item_id: "",
    thickness_mm: "",
    sale_price: "",
    valid_from: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ item_id?: string; thickness_mm?: string; sale_price?: string }>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.item_id) errs.item_id = "Pick an item";
    if (!form.thickness_mm) errs.thickness_mm = "Pick a thickness";
    if (!form.sale_price || Number(form.sale_price) <= 0) errs.sale_price = "Enter a positive price";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await partyPricingService.prices.create({
        party_id: partyId,
        item_id: form.item_id,
        thickness_mm: Number(form.thickness_mm),
        sale_price: form.sale_price,
        valid_from: form.valid_from,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not save price");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Add / update customer price" description="Setting a new price auto-closes the previous one for the same (item, thickness). Both rows stay in history." width="sm">
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Item" required error={errors.item_id} help="The item this price applies to.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={form.item_id}
            disabled={loading}
            onChange={(e) => setForm({ ...form, item_id: e.target.value })}
          >
            <option value="">— Select item —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.item_code} — {it.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Thickness (mm)" required error={errors.thickness_mm} help="Price is stored per thickness — thicker boards cost more.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={form.thickness_mm}
            disabled={loading}
            onChange={(e) => setForm({ ...form, thickness_mm: e.target.value })}
          >
            <option value="">— Select thickness —</option>
            {THICKNESSES_MM.map((mm) => (
              <option key={mm} value={mm}>{mm} mm</option>
            ))}
          </select>
        </FormField>
        <Input
          label="Sale price per unit (₹, GST-inclusive)"
          required
          type="number"
          step="0.01"
          help="This is the customer-visible per-unit price. Invoice promotion reverse-calculates the taxable base from this."
          error={errors.sale_price}
          disabled={loading}
          value={form.sale_price}
          onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
        />
        <Input
          label="Effective from"
          type="date"
          help="When this price takes effect. The prior active price gets auto-closed the day before."
          disabled={loading}
          value={form.valid_from}
          onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
        />
        <Input
          label="Notes (optional)"
          placeholder="Negotiated deal, bulk discount, etc."
          disabled={loading}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Save price</Button>
        </div>
      </form>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="w-32 text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider pt-0.5">
        {label}
      </div>
      <div className={"text-sm font-medium flex-1 " + (mono ? "font-mono text-xs" : "")}>{value}</div>
    </div>
  );
}

function LedgerTab({ partyId }: { partyId: string }) {
  // Personal ledger view from §11 of clientneeds.txt — every entry
  // against this party's receivable + payable accounts, in date order
  // with a running balance. Hands the user a complete settlement
  // history without having to sum receipts and invoices manually.
  const { data: entries, isLoading } = useQuery({
    queryKey: ["party-ledger", partyId],
    queryFn: () => ledgerService.listPartyEntries(partyId, { limit: 500 }),
  });
  const { data: accs } = useQuery({
    queryKey: ["accounts", { party_id: partyId }],
    queryFn: () => accountService.list({ party_id: partyId, limit: 10 }),
  });
  const arPay = (accs ?? []).find((a) => a.type === "party_receivable" || a.type === "party_payable");
  const balanceNum = arPay ? Number(arPay.current_balance) : 0;

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if ((entries ?? []).length === 0) {
    return (
      <div className="bg-white border border-hairline rounded-md p-8 text-center">
        <p className="text-sm font-medium">No ledger entries yet</p>
        <p className="text-xs text-foreground-muted mt-1">Entries appear here when invoices are posted to or receipts/payments recorded against this party.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-hairline rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Personal ledger</h3>
        <div className="text-sm tabular-nums">
          <span className="text-text-tertiary">Outstanding: </span>
          <span className="font-semibold">{formatCurrency(Math.abs(balanceNum), "INR", "en-IN")}</span>
          {balanceNum > 0 && <span className="ml-1 text-[10px] text-text-tertiary">they owe us</span>}
          {balanceNum < 0 && <span className="ml-1 text-[10px] text-text-tertiary">we owe them / on-account credit</span>}
        </div>
      </div>
      <table className="w-full text-[13px]">
        <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Date</th>
            <th className="text-left px-3 py-2 font-medium">Source</th>
            <th className="text-right px-3 py-2 font-medium">Debit</th>
            <th className="text-right px-3 py-2 font-medium">Credit</th>
            <th className="text-right px-3 py-2 font-medium">Running</th>
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((e) => {
            const debit = Number(e.debit);
            const credit = Number(e.credit);
            const running = Number(e.running_balance);
            return (
              <tr key={e.id} className="border-t border-hairline">
                <td className="px-3 py-2 text-text-tertiary whitespace-nowrap">{formatDate(e.entry_date)}</td>
                <td className="px-3 py-2">{e.source_label}<div className="text-[11px] text-text-tertiary">{e.remarks ?? ""}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{debit > 0 ? formatCurrency(debit, "INR", "en-IN") : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{credit > 0 ? formatCurrency(credit, "INR", "en-IN") : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {formatCurrency(Math.abs(running), "INR", "en-IN")}
                  <span className="ml-1 text-[10px] text-text-tertiary">{running >= 0 ? "Dr" : "Cr"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AddressesTab({ partyId, canWrite }: { partyId: string; canWrite: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["partyAddresses", partyId],
    queryFn: () => partyService.listAddresses(partyId),
  });
  const rows = data || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-foreground-secondary">Ship-to, bill-to, and office addresses.</p>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Address</Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Spinner size={20} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} />}
          title="No addresses on file for this party"
          description="Add at least one address so you can ship-to or bill-to this party on future documents."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((a) => (
            <div key={a.id} className="bg-white border border-hairline rounded-md p-4">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-brand mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.address_type}</span>
                    {a.is_primary && <Badge tone="blue">Primary</Badge>}
                  </div>
                  <div className="text-sm mt-1 text-foreground-secondary leading-snug">
                    {a.line1}
                    {a.line2 && <><br />{a.line2}</>}
                    <br />
                    {[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                    {a.country && <><br />{a.country}</>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <AddressFormModal partyId={partyId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

const addressSchema = z.object({
  address_type: z.string().min(1),
  line1: z.string().trim().min(1, "Address line 1 is required").max(255, "Too long"),
  line2: z.string().max(255, "Too long").optional().or(z.literal("")),
  city: z.string().max(100, "Too long").optional().or(z.literal("")),
  state: z.string().max(100, "Too long").optional().or(z.literal("")),
  postal_code: z.string().max(30, "Too long").optional().or(z.literal("")),
  country: z.string().max(100, "Too long").optional().or(z.literal("")),
  is_primary: z.boolean(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

function AddressFormModal({ partyId, onClose }: { partyId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address_type: "billing",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "India",
      is_primary: false,
    },
  });

  const onSubmit = async (data: AddressFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await partyService.createAddress(partyId, data);
      qc.invalidateQueries({ queryKey: ["partyAddresses", partyId] });
      toast.success("Address added");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save address. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add an address"
      description="Billing, shipping, office, or warehouse — one address per record. A party can have many."
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <FormField label="Type" help="What this address is for — helps filter addresses when picking one on a document.">
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            disabled={submitting}
            {...register("address_type")}
          >
            <option value="billing">Billing</option>
            <option value="shipping">Shipping</option>
            <option value="office">Office</option>
            <option value="warehouse">Warehouse</option>
          </select>
        </FormField>
        <Input
          label="Line 1"
          placeholder="Street address, P.O. box"
          required
          help="The first line of the postal address — usually street and number."
          error={errors.line1?.message}
          disabled={submitting}
          {...register("line1")}
        />
        <Input
          label="Line 2"
          placeholder="Apartment, suite, building"
          help="Optional — extra address detail if it doesn't fit on line 1."
          error={errors.line2?.message}
          disabled={submitting}
          {...register("line2")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input label="City" placeholder="Bengaluru" error={errors.city?.message} disabled={submitting} {...register("city")} />
          <Input label="State" placeholder="Karnataka" error={errors.state?.message} disabled={submitting} {...register("state")} />
          <Input label="Postal code" placeholder="560001" error={errors.postal_code?.message} disabled={submitting} {...register("postal_code")} />
        </div>
        <Input label="Country" placeholder="India" error={errors.country?.message} disabled={submitting} {...register("country")} />
        <Checkbox
          label="Set as primary for this type"
          checked={watch("is_primary")}
          onChange={(v) => setValue("is_primary", v)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ContactsTab({ partyId, canWrite }: { partyId: string; canWrite: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["partyContacts", partyId],
    queryFn: () => partyService.listContacts(partyId),
  });
  const rows = data || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-foreground-secondary">People at this party — for approvals, notifications, or deliveries.</p>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Contact</Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Spinner size={20} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<User size={22} />}
          title="No contacts saved yet"
          description="Add a contact person so documents tied to this party have someone to name for approvals, notifications, or deliveries."
        />
      ) : (
        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-center px-4 py-2.5">Primary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-hairline-light hover:bg-surface/50">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-foreground-secondary">{c.role || "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.email ? (
                      <a href={"mailto:" + c.email} className="text-brand hover:underline">
                        <Mail size={12} className="inline mr-1" />{c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {c.phone ? <><Phone size={12} className="inline mr-1" />{c.phone}</> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">{c.is_primary ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <ContactFormModal partyId={partyId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255, "Too long"),
  role: z.string().max(100, "Too long").optional().or(z.literal("")),
  email: z
    .string()
    .max(255, "Too long")
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(50, "Too long").optional().or(z.literal("")),
  is_primary: z.boolean(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

function ContactFormModal({ partyId, onClose }: { partyId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", role: "", is_primary: false },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await partyService.createContact(partyId, data);
      qc.invalidateQueries({ queryKey: ["partyContacts", partyId] });
      toast.success("Contact added");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save contact. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a contact"
      description="A person at this party — buyer, accounts, delivery coordinator. Referenced on documents for approvals and notifications."
      width="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <Input
          label="Full name"
          placeholder="Priya Sharma"
          required
          help="The contact's full name, as it should appear in documents and notifications."
          error={errors.name?.message}
          disabled={submitting}
          {...register("name")}
        />
        <Input
          label="Role"
          placeholder="Purchasing Manager"
          help="Their job title or role. Optional, but useful for knowing who to reach for what."
          error={errors.role?.message}
          disabled={submitting}
          {...register("role")}
        />
        <Input
          label="Email"
          type="email"
          placeholder="priya@example.com"
          help="Used for document-related notifications if email sending is configured."
          error={errors.email?.message}
          disabled={submitting}
          {...register("email")}
        />
        <Input
          label="Phone"
          placeholder="+91 98765 43210"
          error={errors.phone?.message}
          disabled={submitting}
          {...register("phone")}
        />
        <Checkbox
          label="Set as primary contact"
          checked={watch("is_primary")}
          onChange={(v) => setValue("is_primary", v)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}
