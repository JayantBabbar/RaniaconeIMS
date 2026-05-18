// ═══════════════════════════════════════════════════════════════════
// Business-rule constants
// ═══════════════════════════════════════════════════════════════════

/**
 * Multiplier applied to per-line quantity when an Estimate is auto-promoted
 * to an Invoice. The line total stays the same; the qty doubles and the
 * per-unit price halves, with reverse-GST applied so the invoice shows
 * the GST split required for compliance.
 *
 * Tenant policy (Arpit / Nova Bond): "Estimate 5 × ₹200 = ₹1000 → Invoice
 * 10 × ₹100 (final GST-inclusive), total stays ₹1000 with GST shown
 * underneath the line."
 *
 * Stock impact: ONLY the Estimate's qty moves stock. The Invoice (with
 * `estimate_id` set) skips its stock OUT, so the doubled qty on the
 * invoice is a paper amplifier — no double-decrement of inventory.
 *
 * If you eventually onboard a tenant with a different rule, lift this to
 * a tenant-config field (`Tenant.estimate_invoice_multiplier`) and
 * default it to 1.
 */
export const ESTIMATE_TO_INVOICE_QTY_MULTIPLIER = 2;

/**
 * Sheet thicknesses (mm) the tenant trades in. Drives every per-thickness
 * price lookup and the Thickness picker on every Estimate / Invoice / Bill
 * line. Each item × thickness × party has its own active price row.
 */
export const THICKNESSES_MM = [2, 3, 4, 5, 8] as const;

/**
 * Per-thickness price multipliers applied to `Item.default_sale_price`
 * (which represents the 4 mm baseline price). Thicker boards use more
 * raw material so they cost and sell for more. Tweak to reshape the
 * pricing curve without touching individual rows.
 */
export const THICKNESS_PRICE_MULTIPLIER: Record<number, number> = {
  2: 0.5,
  3: 0.75,
  4: 1.0,
  5: 1.25,
  8: 1.8,
};
