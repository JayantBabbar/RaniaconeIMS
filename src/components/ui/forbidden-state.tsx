"use client";

import React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { TopBar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/ui/shared";
import { Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// ForbiddenState — full-page "you don't have access" card.
//
// Use whenever a user lands somewhere their role doesn't allow.
// Pairs with <RequireRead> which checks a permission and renders this
// if the check fails.
//
//   <RequireRead perm="inventory.items.read" crumbs={["Inventory", "Items"]}>
//     {/* page body */}
//   </RequireRead>
//
// Or directly:
//   if (!can("inventory.items.read")) return <ForbiddenState crumbs={...} />;
// ═══════════════════════════════════════════════════════════════════

interface ForbiddenStateProps {
  crumbs?: string[];
  /** Permission code the user is missing (shown in fine print). Optional. */
  missingPerm?: string;
  /** Override the default title copy. */
  title?: string;
  /** Override the default description. */
  description?: string;
}

export function ForbiddenState({
  crumbs,
  missingPerm,
  title,
  description,
}: ForbiddenStateProps) {
  const brand = useBranding();
  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      {crumbs && crumbs.length > 0 && <TopBar crumbs={crumbs} />}
      <div className="p-5">
        <div className="bg-white border border-hairline rounded-md max-w-lg">
          <EmptyState
            icon={<Lock size={22} />}
            title={title || "You don't have access to this page"}
            description={
              description ||
              "Your role doesn't include the permission needed to view this. Contact your workspace administrator if you believe this is a mistake."
            }
          />
          {missingPerm && (
            <div className="px-6 pb-5 text-center">
              <div className="text-[11px] text-foreground-muted">
                Missing permission:{" "}
                <code className="font-mono font-medium">{missingPerm}</code>
              </div>
              <div className="text-[11px] text-foreground-muted mt-2">
                Need help? Contact{" "}
                <a
                  href={`mailto:${brand.supportEmail}`}
                  className="text-brand font-medium hover:underline"
                >
                  {brand.supportEmail}
                </a>
                .
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RequireRead wrapper ─────────────────────────────────────────

interface RequireReadProps {
  /** Read-permission code required to view this page. */
  perm: string;
  /** Breadcrumbs shown on the forbidden page. */
  crumbs?: string[];
  children: React.ReactNode;
}

/**
 * Gate page rendering on a single read permission. If the current user
 * (including super admins, who always pass) lacks `perm`, render a
 * ForbiddenState instead of `children`. Purely client-side — the backend
 * is still the authoritative enforcer.
 */
export function RequireRead({ perm, crumbs, children }: RequireReadProps) {
  const { hasPermission } = useAuth();
  if (!hasPermission(perm)) {
    return <ForbiddenState crumbs={crumbs} missingPerm={perm} />;
  }
  return <>{children}</>;
}
