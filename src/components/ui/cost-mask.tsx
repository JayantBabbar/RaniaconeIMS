"use client";

import React from "react";
import { useAuth } from "@/providers/auth-provider";

// ═══════════════════════════════════════════════════════════════════
// Cost & Financials masks (Phase 12 — Nova Bond client req)
//
// Renders a value only if the current user has the relevant read
// permission. Otherwise renders a fallback ("***" by default).
//
//   <CostMask value={formatCurrency(item.cost)} />
//      → admin sees the cost; operator sees "***"
//
//   <FinancialsMask value={formatCurrency(invoice.grand_total)} />
//      → admin sees the total; operator sees "***"
//
// Companion hooks for non-JSX gating: useCanSeeCost(), useCanSeeFinancials().
//
// Why two perms not one — see fixtures.ts where the codes are defined.
// In short: cost.read covers purchase-cost surfaces (vendor bills,
// valuation, value column on stock); financials.read covers money/
// payments/ledger/reports/period-close. A "Cashier" role might get
// financials.read without cost.read, or vice versa for an "Inventory
// Manager" who needs to know cost but not see invoicing.
// ═══════════════════════════════════════════════════════════════════

const MASK_PLACEHOLDER = "•••";

interface MaskProps {
  /** The value to render when the user has permission. */
  value: React.ReactNode;
  /** What to render when user lacks permission. Defaults to "•••". */
  fallback?: React.ReactNode;
  /** Optional class on the wrapper span (use for tabular-nums alignment etc.) */
  className?: string;
}

export function useCanSeeCost(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission("inventory.cost.read");
}

export function useCanSeeFinancials(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission("inventory.financials.read");
}

/** Mask cost / unit_cost / total_cost / line_total / value etc. */
export function CostMask({ value, fallback = MASK_PLACEHOLDER, className }: MaskProps) {
  const canSee = useCanSeeCost();
  return (
    <span className={className}>
      {canSee ? value : <span className="text-text-tertiary opacity-70">{fallback}</span>}
    </span>
  );
}

/** Mask payment / ledger / report amounts — anything from the money side. */
export function FinancialsMask({ value, fallback = MASK_PLACEHOLDER, className }: MaskProps) {
  const canSee = useCanSeeFinancials();
  return (
    <span className={className}>
      {canSee ? value : <span className="text-text-tertiary opacity-70">{fallback}</span>}
    </span>
  );
}
