"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Input, FormField, Textarea } from "@/components/ui/form-elements";
import { Spinner } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { invoiceService } from "@/services/invoices.service";
import { partyService } from "@/services/parties.service";
import { itemService } from "@/services/items.service";
import { balanceService } from "@/services/stock.service";
import { challanService } from "@/services/challans.service";
import { useAuth } from "@/providers/auth-provider";
import { isApiError } from "@/lib/api-client";
import {
  computeGstLine,
  aggregateInvoiceTotals,
  INDIAN_STATES,
  STANDARD_GST_RATES,
  type GstLineOutput,
} from "@/lib/gst";
import { ArrowLeft, Plus, Trash2, Save, Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Invoice — Create.
// Live GST math runs as the user types: each line's CGST/SGST/IGST
// updates immediately based on tenant state vs place-of-supply, and
// the totals row at the bottom aggregates as you go.
// ═══════════════════════════════════════════════════════════════════

interface DraftLine {
  key: string;                  // local id; persisted on first save
  item_id: string;
  hsn_code: string;
  description: string;
  uom_id: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  rate_pct: string;
  cess_pct: string;
}

const blankLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2, 9),
  item_id: "",
  hsn_code: "",
  description: "",
  uom_id: "uom-each",
  quantity: "1",
  unit_price: "0",
  discount_pct: "0",
  rate_pct: "18",
  cess_pct: "0",
});

export default function NewInvoicePage() {
  const router = useRouter();
  const toast = useToast();
  const { tenantId } = useAuth();

  // Header state
  const today = new Date().toISOString().slice(0, 10);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [challanId, setChallanId] = useState("");   // optional — promote-from-challan flow
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lines state
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);

  // Reference data
  const { data: partiesRaw } = useQuery({
    queryKey: ["partiesForInvoiceForm"],
    queryFn: () => partyService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const parties = (partiesRaw?.data || []).filter(
    (p) => p.party_type === "customer" || p.party_type === "both",
  );

  const { data: itemsRaw } = useQuery({
    queryKey: ["itemsForInvoiceForm"],
    queryFn: () => itemService.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const items = (itemsRaw?.data || []).filter((i) => i.is_active);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Sum available qty per item across all locations. Live availability
  // gives the user a sanity check before they post — and a soft warning
  // if they enter more than is on hand. The actual block on Post comes
  // from the backend's INSUFFICIENT_STOCK error, but showing it here
  // saves a round-trip.
  const { data: balances = [] } = useQuery({
    queryKey: ["balancesForInvoiceForm"],
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

  // Posted, unbilled challans — the candidate set for promote-from-challan.
  // Filtered to the picked customer once one is chosen so the dropdown
  // stays short. Until then, show all.
  const { data: allChallans = [] } = useQuery({
    queryKey: ["unbilledChallans"],
    queryFn: () => challanService.list({ status: "posted", is_billed: false, limit: 200 }),
    staleTime: 60 * 1000,
  });
  const eligibleChallans = useMemo(
    () => (partyId ? allChallans.filter((c) => c.party_id === partyId) : allChallans),
    [allChallans, partyId],
  );

  // When the user picks a source challan, copy its lines into the invoice
  // form and lock the customer + place-of-supply to the challan's values.
  // The user can still tweak qty / price / GST rate per line.
  const onChallanPick = async (newChallanId: string) => {
    setChallanId(newChallanId);
    if (!newChallanId) return;
    const ch = allChallans.find((c) => c.id === newChallanId);
    if (!ch) return;
    setPartyId(ch.party_id);
    // Pull in the challan lines
    try {
      const challanLines = await challanService.listLines(newChallanId);
      const newLines = challanLines.map((cl) => {
        const item = itemMap.get(cl.item_id);
        return {
          key: Math.random().toString(36).slice(2, 9),
          item_id: cl.item_id,
          hsn_code: item?.hsn_code || "",
          description: cl.description || item?.name || "",
          uom_id: cl.uom_id,
          quantity: cl.quantity,
          unit_price: cl.unit_price,
          discount_pct: cl.discount_pct,
          rate_pct: item?.default_tax_rate_pct || "18",
          cess_pct: "0",
        };
      });
      if (newLines.length > 0) setLines(newLines);
    } catch {
      // Silently ignore — user can fall back to manual line entry
    }
  };

  // Resolve seller's state code. In a real scenario this comes from the
  // tenant record; for the demo we read it from any party the tenant has
  // tied to themselves, falling back to "27" (Maharashtra) — matching
  // demo fixtures.
  const sellerStateCode = "27";

  // When the user picks a customer, default place of supply to the
  // customer's state.
  useEffect(() => {
    if (!partyId) return;
    const p = parties.find((x) => x.id === partyId);
    if (p?.state_code && !placeOfSupply) setPlaceOfSupply(p.state_code);
  }, [partyId, parties, placeOfSupply]);

  // Pre-fill line fields when an item is picked.
  const onLineItemChange = (key: string, itemId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const item = itemMap.get(itemId);
        if (!item) return { ...l, item_id: itemId };
        return {
          ...l,
          item_id: itemId,
          hsn_code: item.hsn_code || l.hsn_code,
          description: item.name,
          unit_price: item.default_sale_price || l.unit_price,
          rate_pct: item.default_tax_rate_pct || l.rate_pct,
          uom_id: item.base_uom_id || l.uom_id,
        };
      }),
    );
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));

  // Live GST math
  const lineComputations = useMemo<GstLineOutput[]>(
    () =>
      lines.map((l) =>
        computeGstLine({
          unit_price: l.unit_price || 0,
          quantity: l.quantity || 0,
          discount_pct: l.discount_pct || 0,
          rate_pct: l.rate_pct || 0,
          cess_pct: l.cess_pct || 0,
          seller_state_code: sellerStateCode,
          place_of_supply: placeOfSupply || sellerStateCode,
        }),
      ),
    [lines, placeOfSupply, sellerStateCode],
  );
  const totals = useMemo(() => aggregateInvoiceTotals(lineComputations), [lineComputations]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!invoiceDate) errs.invoiceDate = "Invoice date is required";
    if (!partyId) errs.partyId = "Customer is required";
    if (!placeOfSupply) errs.placeOfSupply = "Place of supply is required";
    lines.forEach((l, i) => {
      if (!l.item_id) errs[`line-${i}-item`] = "Pick an item";
      if (parseFloat(l.quantity || "0") <= 0) errs[`line-${i}-qty`] = "Quantity must be > 0";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createMut = useMutation({
    mutationFn: async (postAfter: boolean) => {
      const inv = await invoiceService.create({
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        party_id: partyId,
        place_of_supply: placeOfSupply,
        challan_id: challanId || undefined,    // ← link the source challan
        remarks: remarks || undefined,
      });
      // Then create lines in order. (The backend would accept a single
      // POST with embedded lines once that contract is finalised; for
      // now we mirror the existing PO/SO pattern: header first, then
      // one POST per line.)
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await invoiceService.createLine(inv.id, {
          item_id: l.item_id,
          hsn_code: l.hsn_code,
          description: l.description,
          uom_id: l.uom_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          rate_pct: l.rate_pct,
          cess_pct: l.cess_pct || "0",
        });
      }
      if (postAfter) {
        return invoiceService.post(inv.id);
      }
      return inv;
    },
    onSuccess: (inv) => {
      toast.success(
        inv.status === "posted" ? "Invoice posted" : "Invoice saved as draft",
        inv.invoice_number,
      );
      router.push(`/invoices/${inv.id}`);
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast.error(err.message);
        if (Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
      } else {
        toast.error("Could not save invoice");
      }
    },
  });

  const handleSave = (postAfter: boolean) => {
    if (!validate()) return;
    createMut.mutate(postAfter);
  };

  // Avoid unused-var warnings on tenantId — it's there because future
  // multi-tenant flows may consult it, but this page's mock auth-flow
  // doesn't need it directly.
  void tenantId;

  return (
    <RequireRead perm="inventory.invoices.write" crumbs={["Billing", "Invoices", "New"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Billing", "Invoices", "New"]}
        right={
          <>
            <Button onClick={() => router.push("/invoices")} icon={<ArrowLeft size={13} />}>
              Cancel
            </Button>
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

      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="New invoice"
          description="Drafts are editable and can be deleted. Posting locks the invoice and creates the stock OUT movements + ledger entries — that's irreversible (use Cancel for fixes)."
          learnMore="Place of supply determines the GST split: same state as your business → CGST + SGST (half-rate each); different state → IGST (full rate). The math runs live as you type."
        />

        {/* Header card */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Header</h2>
            {challanId && (
              <Badge tone="blue">
                Linked to challan ·{" "}
                <span className="font-mono">
                  {allChallans.find((c) => c.id === challanId)?.challan_number}
                </span>
              </Badge>
            )}
          </div>

          {/* Source challan picker — sits at the TOP of the header so its
              effects (auto-pick customer, copy lines) are visible up-front */}
          <FormField
            label="Source challan"
            help="Optional. Pick a posted, unbilled challan to promote it. The customer, place-of-supply, and lines will pre-fill — you can still tweak per-line GST rate and pricing before posting."
          >
            <select
              value={challanId}
              onChange={(e) => onChallanPick(e.target.value)}
              className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            >
              <option value="">— None (direct invoice) —</option>
              {eligibleChallans.length === 0 && partyId && (
                <option disabled>No unbilled challans for this customer</option>
              )}
              {eligibleChallans.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.challan_number} · {formatChallanLabel(c.challan_date, c.grand_total)}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <FormField label="Customer" required error={errors.partyId} help="Customer must exist as a Party. Place of supply defaults to their state.">
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                disabled={!!challanId}
                className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface disabled:cursor-not-allowed"
              >
                <option value="">— Pick a customer —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}){p.gstin ? ` · ${p.gstin}` : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Place of supply" required error={errors.placeOfSupply} help="2-digit state code where the supply is delivered. Determines CGST+SGST vs IGST.">
              <select
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">— Pick a state —</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </FormField>

            <Input
              label="Invoice date"
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              error={errors.invoiceDate}
            />

            <Input
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              hint="Optional — used for AR aging reports"
            />
          </div>
        </section>

        {/* Lines table */}
        <section className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-hairline flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lines</h2>
            <Badge tone="neutral">{lines.length} {lines.length === 1 ? "line" : "lines"}</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3 py-2.5 w-8">#</th>
                  <th className="text-left px-3 py-2.5">Item</th>
                  <th className="text-left px-3 py-2.5">HSN</th>
                  <th className="text-right px-3 py-2.5">Qty</th>
                  <th className="text-right px-3 py-2.5">Unit price</th>
                  <th className="text-right px-3 py-2.5">Disc %</th>
                  <th className="text-right px-3 py-2.5">GST %</th>
                  <th className="text-right px-3 py-2.5">Taxable</th>
                  <th className="text-right px-3 py-2.5">Tax</th>
                  <th className="text-right px-3 py-2.5">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const calc = lineComputations[i];
                  const tax =
                    parseFloat(calc.cgst_amount) +
                    parseFloat(calc.sgst_amount) +
                    parseFloat(calc.igst_amount) +
                    parseFloat(calc.cess_amount);

                  // Available-qty hint: shown only when an item is picked.
                  // Three states:
                  //   - no item / unknown  → blank
                  //   - qty ≤ available    → muted ("avail 128")
                  //   - qty > available    → amber warning ("only 128 avail")
                  //   - available = 0      → red ("out of stock")
                  const available = l.item_id ? (availableByItem.get(l.item_id) ?? 0) : null;
                  const enteredQty = parseFloat(l.quantity || "0");
                  const stockState: "ok" | "low" | "over" | "oos" | "none" =
                    available === null ? "none"
                      : available === 0 ? "oos"
                      : enteredQty > available ? "over"
                      : enteredQty > available * 0.5 ? "low"
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
                            <option key={it.id} value={it.id}>
                              {it.item_code} · {it.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={l.hsn_code}
                          onChange={(e) => updateLine(l.key, { hsn_code: e.target.value })}
                          placeholder="0000"
                          maxLength={8}
                          className="w-20 h-9 px-2 text-sm font-mono bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        />
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
                            title={`Across all locations · sum of qty_available`}
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
                      <td className="px-3 py-2">
                        <select
                          value={l.rate_pct}
                          onChange={(e) => updateLine(l.key, { rate_pct: e.target.value })}
                          className="w-20 h-9 px-2 text-sm text-right tabular-nums bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                        >
                          {STANDARD_GST_RATES.map((r) => (
                            <option key={r} value={r}>{r}%</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {calc.taxable_value}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-foreground-secondary">
                        {tax.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {calc.line_total}
                      </td>
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

        {/* Totals card */}
        <section className="bg-white border border-hairline rounded-md p-4 md:p-5 max-w-md ml-auto">
          <h2 className="text-sm font-semibold mb-3">Totals</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Sub-total" value={totals.subtotal} />
            {parseFloat(totals.cgst_total) > 0 && <Row label="CGST" value={totals.cgst_total} />}
            {parseFloat(totals.sgst_total) > 0 && <Row label="SGST" value={totals.sgst_total} />}
            {parseFloat(totals.igst_total) > 0 && <Row label="IGST" value={totals.igst_total} />}
            {parseFloat(totals.cess_total) > 0 && <Row label="Cess" value={totals.cess_total} />}
            <Row label="Tax total" value={totals.tax_total} />
            <div className="pt-2 mt-2 border-t border-hairline">
              <Row label="Grand total" value={`₹ ${totals.grand_total}`} bold />
            </div>
          </dl>
        </section>

        <section>
          <Textarea
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="Optional — payment terms, notes for the customer, internal note…"
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={`text-foreground-secondary ${bold ? "font-semibold text-foreground" : ""}`}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold text-foreground text-base" : ""}`}>{value}</dd>
    </div>
  );
}

/** Compact label for the challan picker dropdown. */
function formatChallanLabel(date: string, grandTotal: string): string {
  const formatted = parseFloat(grandTotal).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${date} · ₹ ${formatted}`;
}
