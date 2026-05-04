"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { partyService } from "@/services/parties.service";
import { itemService } from "@/services/items.service";
import { billService, type VendorBillCreate, type VendorBillLineCreate } from "@/services/bills.service";
import { isApiError } from "@/lib/api-client";
import { computeGstLine, INDIAN_STATES, STANDARD_GST_RATES } from "@/lib/gst";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// New Vendor Bill — AP-side mirror of /invoices/new.
//
// Same GST math (just reversed direction in the ledger). One header
// + N lines. Each line: HSN, qty, unit price, discount, GST rate.
// Place-of-supply on the header drives the GST split per line.
// Tenant state vs vendor place_of_supply: same → CGST+SGST, else IGST.
//
// No stock IN — bills are financial only. The GRN flow handles stock.
// ═══════════════════════════════════════════════════════════

const inputClass =
  "w-full px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

interface DraftLine {
  description: string;
  item_id?: string;
  hsn_code: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  rate_pct: string;
}

const blankLine = (): DraftLine => ({
  description: "", item_id: undefined, hsn_code: "",
  quantity: "1", unit_price: "0", discount_pct: "0", rate_pct: "18",
});

export default function NewBillPage() {
  return (
    <RequireRead perm="inventory.bills.write">
      <NewBillForm />
    </RequireRead>
  );
}

function NewBillForm() {
  const router = useRouter();
  const toast = useToast();

  const [billDate, setBillDate]       = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]         = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [partyId, setPartyId]         = useState<string>("");
  const [pos, setPos]                 = useState("27");
  const [remarks, setRemarks]         = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const vendors = (partiesRaw?.data ?? []).filter((p) => p.party_type === "supplier" || p.party_type === "vendor" || p.party_type === "both");

  const { data: itemsRaw } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const items = itemsRaw?.data ?? [];

  // For demo we assume tenant state = "27" (Maharashtra). Real BE will
  // fetch from /tenants/me — Phase 1 already exposes state_code on Tenant.
  const sellerState = "27";

  // Live totals (same engine as InvoiceLine — just used in AP context)
  const computed = useMemo(() => {
    return lines.map((l) => {
      const qty = Number(l.quantity || 0);
      const price = Number(l.unit_price || 0);
      if (qty <= 0 || price < 0) return { ok: false, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      try {
        const r = computeGstLine({
          unit_price: l.unit_price || "0",
          quantity: l.quantity || "0",
          discount_pct: l.discount_pct || "0",
          rate_pct: l.rate_pct || "0",
          seller_state_code: sellerState,
          place_of_supply: pos,
        });
        return {
          ok: true,
          taxable: Number(r.taxable_value),
          cgst: Number(r.cgst_amount),
          sgst: Number(r.sgst_amount),
          igst: Number(r.igst_amount),
          total: Number(r.line_total),
        };
      } catch {
        return { ok: false, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      }
    });
  }, [lines, pos]);

  const totals = computed.reduce(
    (s, c) => ({
      taxable: s.taxable + c.taxable,
      cgst: s.cgst + c.cgst,
      sgst: s.sgst + c.sgst,
      igst: s.igst + c.igst,
      grand: s.grand + c.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 },
  );

  const addLine = () => setLines((s) => [...s, blankLine()]);
  const removeLine = (i: number) => setLines((s) => s.length > 1 ? s.filter((_, idx) => idx !== i) : s);
  const updateLine = (i: number, key: keyof DraftLine, v: string) =>
    setLines((s) => s.map((l, idx) => idx === i ? { ...l, [key]: v } : l));

  const create = useMutation({
    mutationFn: async () => {
      const billPayload: VendorBillCreate = {
        bill_date: billDate,
        due_date: dueDate || undefined,
        supplier_invoice_number: supplierRef || undefined,
        party_id: partyId,
        place_of_supply: pos,
        remarks: remarks || undefined,
      };
      const created = await billService.create(billPayload);
      // Best-effort line creation in demo mode
      for (const l of lines) {
        const linePayload: VendorBillLineCreate = {
          item_id: l.item_id,
          hsn_code: l.hsn_code,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          rate_pct: l.rate_pct,
        };
        await billService.createLine(created.id, linePayload);
      }
      return created;
    },
    onSuccess: (b) => {
      toast.success(`Bill ${b.bill_number ?? "created"}`);
      router.push("/bills");
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not create bill"),
  });

  const canSubmit =
    !!partyId && !!pos && lines.length > 0 &&
    lines.every((l) => l.description.trim() && Number(l.quantity) > 0 && Number(l.unit_price) >= 0);

  return (
    <>
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title="New vendor bill"
          description="Record a bill received from your supplier. The numbers go into your AP ledger and GST input. No stock movement happens here — use the GRN flow if you also need to receive goods."
        />

        {/* Header card */}
        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FormField label="Bill date" required>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </FormField>
            <FormField label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
            <FormField label="Supplier's ref #" hint="The number printed on their paper invoice">
              <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="KZ-INV-..." />
            </FormField>
            <FormField label="Place of supply" required hint="State where the goods/services were supplied">
              <select className={inputClass} value={pos} onChange={(e) => setPos(e.target.value)}>
                {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <FormField label="Vendor" required>
              <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">— select vendor —</option>
                {vendors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Remarks">
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            </FormField>
          </div>
        </div>

        {/* Lines */}
        <div className="rounded-lg border border-border bg-bg-elevated mt-4 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Lines</h3>
            <Button kind="ghost" onClick={addLine}><Plus size={12} /> Add line</Button>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-bg-subtle text-text-tertiary text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-2 py-2 font-medium">#</th>
                <th className="text-left px-2 py-2 font-medium">Description / item</th>
                <th className="text-left px-2 py-2 font-medium">HSN</th>
                <th className="text-right px-2 py-2 font-medium">Qty</th>
                <th className="text-right px-2 py-2 font-medium">Unit price</th>
                <th className="text-right px-2 py-2 font-medium">Disc %</th>
                <th className="text-right px-2 py-2 font-medium">Rate %</th>
                <th className="text-right px-2 py-2 font-medium">Taxable</th>
                <th className="text-right px-2 py-2 font-medium">Tax</th>
                <th className="text-right px-2 py-2 font-medium">Total</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const c = computed[i];
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5 text-text-tertiary">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <select
                        className={inputClass}
                        value={l.item_id ?? ""}
                        onChange={(e) => {
                          const it = items.find((x) => x.id === e.target.value);
                          if (it) {
                            updateLine(i, "item_id", it.id);
                            updateLine(i, "description", it.name);
                            if (it.hsn_code) updateLine(i, "hsn_code", it.hsn_code);
                            if (it.default_tax_rate_pct) updateLine(i, "rate_pct", it.default_tax_rate_pct);
                          } else {
                            updateLine(i, "item_id", "");
                          }
                        }}
                      >
                        <option value="">— free-text or pick item —</option>
                        {items.map((it) => <option key={it.id} value={it.id}>{it.item_code} — {it.name}</option>)}
                      </select>
                      <Input className="mt-1" value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="Description" />
                    </td>
                    <td className="px-2 py-1.5"><Input value={l.hsn_code} onChange={(e) => updateLine(i, "hsn_code", e.target.value)} placeholder="8471" className="w-20" /></td>
                    <td className="px-2 py-1.5"><Input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="w-20 text-right" /></td>
                    <td className="px-2 py-1.5"><Input type="number" step="0.01" min="0" value={l.unit_price} onChange={(e) => updateLine(i, "unit_price", e.target.value)} className="w-24 text-right" /></td>
                    <td className="px-2 py-1.5"><Input type="number" step="0.01" min="0" max="100" value={l.discount_pct} onChange={(e) => updateLine(i, "discount_pct", e.target.value)} className="w-16 text-right" /></td>
                    <td className="px-2 py-1.5">
                      <select className={inputClass + " w-20 text-right"} value={l.rate_pct} onChange={(e) => updateLine(i, "rate_pct", e.target.value)}>
                        {STANDARD_GST_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{c.ok ? formatCurrency(c.taxable, "INR", "en-IN") : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{c.ok ? formatCurrency(c.cgst + c.sgst + c.igst, "INR", "en-IN") : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{c.ok ? formatCurrency(c.total, "INR", "en-IN") : "—"}</td>
                    <td className="px-2 py-1.5">
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)} className="text-status-red-text hover:text-red-700 p-1" aria-label="Remove line">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-bg-subtle border-t-2 border-border">
                <td colSpan={6} />
                <td className="px-2 py-2 text-right font-semibold text-text-tertiary text-[11px]">Totals</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatCurrency(totals.taxable, "INR", "en-IN")}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatCurrency(totals.cgst + totals.sgst + totals.igst, "INR", "en-IN")}</td>
                <td className="px-2 py-2 text-right tabular-nums font-bold">{formatCurrency(totals.grand, "INR", "en-IN")}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-end gap-2 mt-5 sticky bottom-0 bg-bg/95 backdrop-blur py-3 border-t border-border">
          <Button kind="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button kind="primary" onClick={() => canSubmit && create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? <Spinner size={14} /> : "Save bill"}
          </Button>
        </div>
      </div>
    </>
  );
}
