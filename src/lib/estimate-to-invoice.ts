// ═══════════════════════════════════════════════════════════════════
// Estimate → Invoice line builder
//
// One function shared by the demo adapter's promote handler and the
// /invoices/new estimate-picker flow, so both produce identical lines.
//
// Business rule (per tenant policy — see constants.ts):
//   - Invoice line `quantity` = estimate qty × ESTIMATE_TO_INVOICE_QTY_MULTIPLIER
//   - Invoice line total (incl. GST) = estimate line total
//   - Per-unit GST-inclusive price on the invoice = estimate.unit_price ÷ multiplier
//   - Per-unit taxable base = reverseGst(that GST-inclusive price, rate)
//
// Worked example with multiplier=2 and 18% GST:
//   Estimate:  5 sheets × ₹200 = ₹1000   (no GST shown)
//   Invoice:   10 sheets × ₹100 final each
//              = 10 × ₹84.7458 base + 18% GST ₹152.54
//              = ₹847.46 taxable + ₹152.54 GST = ₹1000 final
//   Customer pays the same ₹1000; the invoice just splits the amount
//   into taxable base + GST for compliance.
//
// Resulting line is fed to computeGstLine() for the CGST/SGST/IGST split.
// ═══════════════════════════════════════════════════════════════════

import type { Estimate, EstimateLine, Item } from "@/types";
import { ESTIMATE_TO_INVOICE_QTY_MULTIPLIER } from "@/lib/constants";
import { reverseGst } from "@/lib/gst";

export interface InvoiceLineDraft {
  item_id: string;
  hsn_code: string;
  description: string;
  uom_id: string;
  quantity: string;
  unit_price: string;           // taxable base after reverse-GST
  discount_pct: string;
  rate_pct: string;
  cess_pct: string;
  thickness_mm?: number | null;
  size_code?: string | null;
}

/** Build invoice-line drafts from an Estimate + its lines + an item lookup. */
export function buildInvoiceLinesFromEstimate(
  _estimate: Estimate,
  estimateLines: EstimateLine[],
  itemById: Map<string, Item>,
): InvoiceLineDraft[] {
  return estimateLines.map((el) => {
    const item = itemById.get(el.item_id);
    const ratePct = item?.default_tax_rate_pct ?? "18";
    // Halve the estimate's per-unit price so the line total stays the
    // same once qty doubles. This halved price is GST-inclusive on the
    // invoice; we reverse-GST it to get the taxable base.
    const estimateUnitPrice = Number(el.unit_price);
    const invoiceUnitInclGst = estimateUnitPrice / ESTIMATE_TO_INVOICE_QTY_MULTIPLIER;
    const { baseAmount } = reverseGst(invoiceUnitInclGst, ratePct);
    const doubledQty = Number(el.quantity) * ESTIMATE_TO_INVOICE_QTY_MULTIPLIER;
    return {
      item_id: el.item_id,
      hsn_code: item?.hsn_code ?? "",
      description: el.description ?? item?.name ?? "",
      uom_id: el.uom_id,
      quantity: String(doubledQty),
      unit_price: baseAmount,
      discount_pct: el.discount_pct ?? "0",
      rate_pct: ratePct,
      cess_pct: "0",
      thickness_mm: el.thickness_mm ?? null,
      size_code: el.size_code ?? null,
    };
  });
}
