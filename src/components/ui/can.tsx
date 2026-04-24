"use client";

import React from "react";
import { useAuth } from "@/providers/auth-provider";

// ═══════════════════════════════════════════════════════════════════
// <Can> — conditional render based on permissions.
//
// Usage:
//   <Can perm="inventory.items.write">
//     <Button>New Item</Button>
//   </Can>
//
//   <Can anyOf={["inventory.documents.post", "inventory.documents.cancel"]}>
//     <Button>Manage</Button>
//   </Can>
//
//   <Can perm="inventory.items.write" fallback={<ReadOnlyBadge />}>
//     <EditActions />
//   </Can>
//
// Super admins bypass all checks (handled by useAuth.hasPermission).
// Module-subscription gating is separate — handled at the sidebar level.
// ═══════════════════════════════════════════════════════════════════

interface CanProps {
  /** Required permission code. Either `perm` OR `anyOf` must be supplied. */
  perm?: string;
  /** Render if the user has at least one of these codes. */
  anyOf?: string[];
  /** Rendered instead when the check fails. Defaults to nothing. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Can({ perm, anyOf, fallback = null, children }: CanProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  const allowed =
    (perm && hasPermission(perm)) ||
    (anyOf && hasAnyPermission(...anyOf)) ||
    false;

  return <>{allowed ? children : fallback}</>;
}

/**
 * Hook variant for places where JSX wrapping is awkward (e.g. building an
 * ActionMenu items array conditionally).
 *
 *   const { can } = useCan();
 *   const items = [
 *     can("inventory.items.write") && { label: "Edit", ... },
 *     can("inventory.items.write") && { label: "Delete", danger: true, ... },
 *   ].filter(Boolean);
 */
export function useCan() {
  const { hasPermission, hasAnyPermission } = useAuth();
  return {
    can: hasPermission,
    canAny: (...codes: string[]) => hasAnyPermission(...codes),
  };
}
