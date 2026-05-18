"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Input, FormField, Textarea, Checkbox } from "@/components/ui/form-elements";
import { Spinner } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { estimateService, routeService } from "@/services/estimates.service";
import { partyService } from "@/services/parties.service";
import { itemService } from "@/services/items.service";
import { balanceService } from "@/services/stock.service";
import { locationService } from "@/services/locations.service";
import { partyPricingService } from "@/services/party-pricing.service";
import { THICKNESSES_MM } from "@/lib/constants";
import { isApiError } from "@/lib/api-client";
import type { EstimatePrintMode } from "@/types";
import { ArrowLeft, Plus, Trash2, Save, Lock } from "lucide-react";

interface DraftLine {
  key: string;
  item_id: string;
  description: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  thickness_mm: string;        // "" until user picks
}

const blankLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2, 9),
  item_id: "",
  description: "",
  uom_id: "uom-each",
  quantity: "1",
  unit_price: "0",
  discount_pct: "0",
  thickness_mm: "",
});

export default function NewEstimatePage() {
  const router = useRouter();
  const toast = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const [estimateDate, setEstimateDate] = useState(today);
  const [partyId, setPartyId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [isBilled, setIsBilled] = useState(false);
  const [printMode, setPrintMode] = useState<EstimatePrintMode>("no_amount");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  // Per-line auto-fill provenance:
  //   "loading"  — lookup in flight
  //   "<date>"   — customer-pricelist rule applied; the value is valid_from
  //   null       — no customer rule, item default used
  //   undefined  — no item picked / no customer picked
  const [priceFromList, setPriceFromList] = useState<Record<string, string | null | undefined>>({});

  const { data: partiesRaw } = useQuery({
    queryKey: ["partiesForEstimateForm"],
    queryFn: () => partyService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const parties = (partiesRaw?.data || []).filter(
    (p) => p.party_type === "customer" || p.party_type === "both",
  );

  const { data: itemsRaw } = useQuery({
    queryKey: ["itemsForEstimateForm"],
    queryFn: () => itemService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const items = (itemsRaw?.data || []).filter((i) => i.is_active);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: () => routeService.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: locsRaw } = useQuery({
    queryKey: ["locationsForEstimateForm"],
    queryFn: () => locationService.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const locations = locsRaw?.data || [];

  // Stock-on-hand totals per item — drives the inline availability hint
  const { data: balances = [] } = useQuery({
    queryKey: ["balancesForEstimateForm"],
    queryFn: () => balanceService.list({ only_nonzero: true, limit: 200 }),
    staleTime: 30 * 1000,
  });
  const availableByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of balances) {
      m.set(b.item_id, (m.get(b.item_id) ?? 0) + parseFloat(b.qty_available || "0"));
    }
    return m;
  }, [balances]);

  // When the customer is picked, default route to whatever route the
  // party already has (Phase 1 cleanup will give Party.route_id).
  useEffect(() => {
    if (!partyId) return;
    const p = parties.find((x) => x.id === partyId);
    if (p?.description) {
      // A small UX nicety — pre-fill destination address to the party's
      // description if it looks like an address. Pure heuristic; safe.
      if (!destinationAddress && /[0-9]/.test(p.description)) {
        setDestinationAddress(p.description);
      }
    }
  }, [partyId, parties, destinationAddress]);

  // Fetch the customer's per-(item, thickness) sale price and apply it
  // to the line. Falls back to item.default_sale_price when no rule
  // exists for this combo. Shared by the item-pick / thickness-pick /
  // customer-change paths so they stay consistent.
  const applyPriceForLine = React.useCallback(async (key: string, itemId: string, thicknessStr: string, currentPartyId: string) => {
    const thicknessMm = thicknessStr ? Number(thicknessStr) : NaN;
    if (!currentPartyId) {
      // No customer picked yet — clear the price and signal "need customer".
      setLines((prev) => prev.map((l) => (l.key === key ? { ...l, unit_price: "0" } : l)));
      setPriceFromList((m) => ({ ...m, [key]: "need-customer" }));
      return;
    }
    if (!Number.isFinite(thicknessMm)) {
      // Customer set but thickness still blank — clear the price and signal
      // "need thickness". Item.default_sale_price is intentionally NOT
      // used as a fallback because it's the 4mm baseline and would mislead
      // the user once they pick 2mm / 8mm / etc.
      setLines((prev) => prev.map((l) => (l.key === key ? { ...l, unit_price: "0" } : l)));
      setPriceFromList((m) => ({ ...m, [key]: "need-thickness" }));
      return;
    }
    setPriceFromList((m) => ({ ...m, [key]: "loading" }));
    try {
      const res = await partyPricingService.prices.lookup({
        party_id: currentPartyId, item_id: itemId, thickness_mm: thicknessMm,
      });
      if (res.rule) {
        setLines((prev) =>
          prev.map((l) => (l.key === key ? { ...l, unit_price: res.rule!.sale_price } : l)),
        );
        setPriceFromList((m) => ({ ...m, [key]: res.rule!.valid_from }));
      } else {
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, unit_price: "0" } : l)));
        setPriceFromList((m) => ({ ...m, [key]: null }));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("party-price lookup failed", { party_id: currentPartyId, item_id: itemId, thickness_mm: thicknessMm, err });
      setLines((prev) => prev.map((l) => (l.key === key ? { ...l, unit_price: "0" } : l)));
      setPriceFromList((m) => ({ ...m, [key]: "error" }));
    }
  }, []);

  const onLineItemChange = async (key: string, itemId: string) => {
    let nextThickness = "";
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        nextThickness = l.thickness_mm;
        const item = itemMap.get(itemId);
        if (!item) return { ...l, item_id: itemId };
        return {
          ...l,
          item_id: itemId,
          description: item.name,
          uom_id: item.base_uom_id || l.uom_id,
        };
      }),
    );
    if (itemId) {
      void applyPriceForLine(key, itemId, nextThickness, partyId);
    } else {
      setPriceFromList((m) => { const n = { ...m }; delete n[key]; return n; });
    }
  };

  // Called when the user picks a thickness — re-runs the lookup with the
  // new dimension so the price flips to whatever's on file for that mm.
  const onLineThicknessChange = (key: string, thicknessStr: string) => {
    let itemId = "";
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        itemId = l.item_id;
        return { ...l, thickness_mm: thicknessStr };
      }),
    );
    if (itemId) void applyPriceForLine(key, itemId, thicknessStr, partyId);
  };

  // Re-run the per-customer price lookup whenever the customer changes,
  // for every line that already has an item picked. Without this, picking
  // the customer AFTER picking items would leave the item-default prices
  // in place instead of switching to the customer's negotiated rate.
  useEffect(() => {
    for (const l of lines) {
      if (l.item_id) void applyPriceForLine(l.key, l.item_id, l.thickness_mm, partyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Depend ONLY on partyId — including `applyPriceForLine` would loop
    // (its `itemMap` dep changes reference on every line-state update).
  }, [partyId]);

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));

  // Live totals (no tax, just gross)
  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    for (const l of lines) {
      const qty = parseFloat(l.quantity || "0");
      const price = parseFloat(l.unit_price || "0");
      const dpct = parseFloat(l.discount_pct || "0");
      const gross = qty * price;
      const d = gross * (dpct / 100);
      subtotal += gross - d;
      discount += d;
    }
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      grand: subtotal.toFixed(2),
    };
  }, [lines]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!estimateDate) errs.estimateDate = "Estimate date is required";
    if (!partyId) errs.partyId = "Customer is required";
    if (!sourceLocationId) errs.sourceLocationId = "Source location is required";
    lines.forEach((l, i) => {
      if (!l.item_id) errs[`line-${i}-item`] = "Pick an item";
      if (parseFloat(l.quantity || "0") <= 0) errs[`line-${i}-qty`] = "Qty must be > 0";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createMut = useMutation({
    mutationFn: async (postAfter: boolean) => {
      const ch = await estimateService.create({
        estimate_date: estimateDate,
        party_id: partyId,
        route_id: routeId || undefined,
        source_location_id: sourceLocationId,
        destination_address: destinationAddress || undefined,
        vehicle_number: vehicleNumber || undefined,
        driver_name: driverName || undefined,
        driver_phone: driverPhone || undefined,
        is_billed: isBilled,
        print_mode: printMode,
        remarks: remarks || undefined,
      });
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await estimateService.createLine(ch.id, {
          item_id: l.item_id,
          description: l.description,
          uom_id: l.uom_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          thickness_mm: l.thickness_mm ? Number(l.thickness_mm) : undefined,
        });
      }
      if (postAfter) return estimateService.post(ch.id);
      return ch;
    },
    onSuccess: (ch) => {
      toast.success(
        ch.status === "posted" ? "Estimate posted" : "Estimate saved as draft",
        ch.estimate_number,
      );
      router.push(`/estimates/${ch.id}`);
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast.error(err.message);
        if (Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
      } else {
        toast.error("Could not save estimate");
      }
    },
  });

  const handleSave = (postAfter: boolean) => {
    if (!validate()) return;
    createMut.mutate(postAfter);
  };

  return (
    <RequireRead perm="inventory.estimates.write" crumbs={["Billing", "Estimates", "New"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Estimates", "New"]}
        right={
          <>
            <Button onClick={() => router.push("/estimates")} icon={<ArrowLeft size={13} />}>Cancel</Button>
            <Button
              onClick={() => handleSave(false)}
              icon={<Save size={13} />}
              loading={createMut.isPending && !createMut.variables}
            >
              Save draft
            </Button>
            <Button
              kind="primary"
              onClick={() => handleSave(true)}
              icon={<Lock size={13} />}
              loading={createMut.isPending && !!createMut.variables}
            >
              Save &amp; post
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-5 max-w-6xl space-y-5">
        <PageHeader
          title="New estimate"
          description="A estimate is a delivery note. Drafts are editable; posting locks it and creates the stock OUT movement. After posting, you can promote it to a tax Invoice — that's where GST is added."
          learnMore="Print mode 'with remarks' shows amounts (admin/billing copy). Print mode 'no amount' hides prices (driver/customer copy). Pick a default here; you can override at print time."
        />

        {/* ── Header ────────────────────────────────────── */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-4">Header</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Customer" required error={errors.partyId} help="Customer must already exist as a Party with type=customer or both.">
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">— Pick a customer —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </FormField>

            <FormField label="Route" help="Optional — sales territory; helps the dispatch team plan loadings.">
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">— No route —</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                ))}
              </select>
            </FormField>

            <Input
              label="Estimate date"
              type="date"
              required
              value={estimateDate}
              onChange={(e) => setEstimateDate(e.target.value)}
              error={errors.estimateDate}
            />

            <FormField label="Source location" required error={errors.sourceLocationId} help="Where the goods are leaving from. Stock OUT movements post here on dispatch.">
              <select
                value={sourceLocationId}
                onChange={(e) => setSourceLocationId(e.target.value)}
                className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">— Pick a location —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} · {l.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="mt-4">
            <Textarea
              label="Destination address"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              rows={2}
              placeholder="Where the goods are going. Printed on the estimate and used by the driver."
            />
          </div>
        </section>

        {/* ── Dispatch ──────────────────────────────────── */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-4">Dispatch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Vehicle number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="MH-12-AB-3491"
              hint="Required on the e-Way Bill once that ships (Phase 4)."
            />
            <Input
              label="Driver name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Sandeep Patil"
            />
            <Input
              label="Driver phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="+91 98220 11223"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Print mode" help="'with remarks' shows amounts (billing copy). 'no amount' hides prices (driver/customer copy). Both modes available at print time anyway.">
              <select
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value as EstimatePrintMode)}
                className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="no_amount">No amounts (driver / customer copy)</option>
                <option value="with_remarks">With amounts (billing copy)</option>
              </select>
            </FormField>

            <FormField label="Bill / No-Bill" help="Tick if a tax invoice will follow. Once you promote this estimate to an invoice, this auto-flips to billed.">
              <div className="flex items-center h-9 md:h-[30px]">
                <Checkbox
                  checked={isBilled}
                  onChange={setIsBilled}
                  label="An invoice will follow this estimate"
                />
              </div>
            </FormField>
          </div>
        </section>

        {/* ── Lines ─────────────────────────────────────── */}
        <section className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-hairline flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lines</h2>
            <Badge tone="neutral">{lines.length} {lines.length === 1 ? "line" : "lines"}</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3 py-2.5 w-8">#</th>
                  <th className="text-left px-3 py-2.5">Item</th>
                  <th className="text-left px-3 py-2.5 w-24">Thickness</th>
                  <th className="text-right px-3 py-2.5">Qty</th>
                  <th className="text-right px-3 py-2.5">Unit price</th>
                  <th className="text-right px-3 py-2.5">Disc %</th>
                  <th className="text-right px-3 py-2.5">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const qty = parseFloat(l.quantity || "0");
                  const price = parseFloat(l.unit_price || "0");
                  const dpct = parseFloat(l.discount_pct || "0");
                  const lineTotal = (qty * price * (1 - dpct / 100)).toFixed(2);

                  const available = l.item_id ? (availableByItem.get(l.item_id) ?? 0) : null;
                  const stockState: "ok" | "low" | "over" | "oos" | "none" =
                    available === null ? "none"
                      : available === 0 ? "oos"
                      : qty > available ? "over"
                      : qty > available * 0.5 ? "low"
                      : "ok";

                  return (
                    <tr key={l.key} className="border-t border-hairline-light">
                      <td className="px-3 py-2 text-foreground-muted text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={l.item_id}
                          onChange={(e) => onLineItemChange(l.key, e.target.value)}
                          className={`w-full h-9 px-2 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand ${
                            errors[`line-${i}-item`] ? "border-status-red" : "border-hairline"
                          }`}
                        >
                          <option value="">—</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>{it.item_code} · {it.name}</option>
                          ))}
                        </select>
                        {l.item_id && priceFromList[l.key] === "need-customer" && (
                          <div className="mt-1 text-[10px] text-foreground-muted bg-bg-subtle rounded px-1.5 py-0.5 inline-block">
                            Pick a customer to load the price
                          </div>
                        )}
                        {l.item_id && priceFromList[l.key] === "need-thickness" && (
                          <div className="mt-1 text-[10px] text-status-amber-text bg-status-amber-bg/40 rounded px-1.5 py-0.5 inline-block">
                            Pick a thickness to load the price
                          </div>
                        )}
                        {l.item_id && priceFromList[l.key] === "loading" && (
                          <div className="mt-1 text-[10px] text-foreground-muted bg-bg-subtle rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                            <Spinner size={10} /> looking up customer price…
                          </div>
                        )}
                        {l.item_id && priceFromList[l.key] && priceFromList[l.key] !== "loading" && priceFromList[l.key] !== "error" && priceFromList[l.key] !== "need-customer" && priceFromList[l.key] !== "need-thickness" && (
                          <div className="mt-1 text-[10px] text-status-green-text bg-status-green-bg/40 rounded px-1.5 py-0.5 inline-block">
                            From customer pricelist · eff. {priceFromList[l.key]}
                          </div>
                        )}
                        {l.item_id && partyId && priceFromList[l.key] === null && (
                          <Link
                            href={`/parties/${partyId}?tab=sale-prices`}
                            target="_blank"
                            className="mt-1 text-[10px] text-status-amber-text bg-status-amber-bg/40 hover:bg-status-amber-bg/70 rounded px-1.5 py-0.5 inline-block"
                          >
                            No price on file for this customer × thickness · manage prices →
                          </Link>
                        )}
                        {l.item_id && partyId && priceFromList[l.key] === "error" && (
                          <div className="mt-1 text-[10px] text-status-red-text bg-status-red-bg/40 rounded px-1.5 py-0.5 inline-block">
                            ⚠ Pricelist lookup failed — see DevTools console
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.thickness_mm}
                          onChange={(e) => onLineThicknessChange(l.key, e.target.value)}
                          className={`w-full h-9 px-2 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 ${
                            l.item_id && !l.thickness_mm ? "border-status-amber" : "border-hairline"
                          }`}
                        >
                          <option value="">—</option>
                          {THICKNESSES_MM.map((mm) => (
                            <option key={mm} value={mm}>{mm} mm</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                          className={`w-20 h-9 px-2 text-sm text-right tabular-nums bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 ${
                            errors[`line-${i}-qty`] || stockState === "over" || stockState === "oos"
                              ? "border-status-amber"
                              : "border-hairline"
                          }`}
                        />
                        {stockState !== "none" && (
                          <div
                            className={`text-[10px] mt-1 font-mono leading-none tabular-nums ${
                              stockState === "oos" || stockState === "over"
                                ? "text-status-red-text"
                                : stockState === "low"
                                  ? "text-status-amber-text"
                                  : "text-foreground-muted"
                            }`}
                            title="Across all locations · sum of qty_available"
                          >
                            {stockState === "oos" && "out of stock"}
                            {stockState === "over" && `only ${available} avail`}
                            {(stockState === "low" || stockState === "ok") && `avail ${available}`}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          value={l.unit_price}
                          onChange={(e) => updateLine(l.key, { unit_price: e.target.value })}
                          className="w-24 h-9 px-2 text-sm text-right tabular-nums bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          value={l.discount_pct}
                          onChange={(e) => updateLine(l.key, { discount_pct: e.target.value })}
                          className="w-16 h-9 px-2 text-sm text-right tabular-nums bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{lineTotal}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeLine(l.key)}
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                          className="p-1 rounded text-foreground-muted hover:text-status-red disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 md:px-5 py-3 border-t border-hairline flex items-center justify-between">
            <Button size="sm" icon={<Plus size={12} />} onClick={addLine}>
              Add line
            </Button>
            <Link href="/master-data/uoms" className="text-[11px] text-brand hover:underline">
              Manage UoMs →
            </Link>
          </div>
        </section>

        {/* ── Totals ────────────────────────────────────── */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5 max-w-md ml-auto">
          <h2 className="text-sm font-semibold mb-3">Totals</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Sub-total (after discount)" value={totals.subtotal} />
            {parseFloat(totals.discount) > 0 && (
              <Row label="Discount granted" value={`− ${totals.discount}`} muted />
            )}
            <div className="pt-2 mt-2 border-t border-hairline">
              <Row label="Grand total" value={`₹ ${totals.grand}`} bold />
            </div>
            <div className="pt-2 mt-2 text-[11px] text-foreground-muted italic leading-snug">
              No tax shown — estimates are not tax documents. GST is added when this estimate is promoted to an invoice.
            </div>
          </dl>
        </section>

        <section>
          <Textarea
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="Optional — special handling, delivery instructions, internal notes…"
          />
        </section>

        {createMut.isPending && (
          <div className="flex justify-center py-3 text-sm text-foreground-muted">
            <Spinner size={14} />
            <span className="ml-2">Saving…</span>
          </div>
        )}
      </div>
    </div>
    </RequireRead>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={`${bold ? "font-semibold text-foreground" : muted ? "text-foreground-muted" : "text-foreground-secondary"}`}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold text-foreground text-base" : muted ? "text-foreground-muted" : ""}`}>{value}</dd>
    </div>
  );
}
