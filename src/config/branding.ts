// ═══════════════════════════════════════════════════════════════════
// Branding config — single source of truth for product identity.
//
// This is the DEFAULT branding. For white-label tenants:
//   1. Fork this file, or
//   2. Provide a tenantBranding prop to <BrandingProvider> at runtime
//      (e.g. loaded from the authenticated tenant's ui_branding config).
//
// Every user-facing string that mentions the product name, product
// tagline, support email, or logo MUST be read via useBranding() — no
// hard-coded "RaniacOne" in JSX.
// ═══════════════════════════════════════════════════════════════════

import React from "react";

export interface Branding {
  /** Product name, shown in titles, headers, emails, etc. */
  name: string;
  /** One-line tagline for marketing surfaces. */
  tagline: string;
  /** Longer description used on login splash / about pages. */
  description: string;
  /** Email users are pointed at when they need help (forgot password, etc). */
  supportEmail: string;
  /** Optional public support / documentation URL. */
  supportUrl?: string;
  /** Footer copyright line; year substituted at render time. */
  copyrightHolder: string;
  /** Marketing stats shown on the login splash (optional). */
  marketingStats?: Array<{ value: string; label: string }>;
  /** Compliance badges shown in the login footer (optional). */
  complianceBadges?: string[];
  /** Logo mark — an inline SVG component. Accepts sizing props. */
  LogoMark: React.FC<React.SVGProps<SVGSVGElement>>;
  /** Domain suffix used when rendering workspace URLs (e.g. `acme.raniacone.app`). */
  workspaceDomain: string;
}

// ── Default logo mark ───────────────────────────────────────────────

const DefaultLogoMark: React.FC<React.SVGProps<SVGSVGElement>> = (props) =>
  React.createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinejoin: "round",
      ...props,
    },
    React.createElement("path", { d: "M12 2L3 7v10l9 5 9-5V7l-9-5z" }),
    React.createElement("path", { d: "M3 7l9 5 9-5M12 12v10" }),
  );

// ── Default branding ────────────────────────────────────────────────

export const DEFAULT_BRANDING: Branding = {
  name: "RaniacOne",
  tagline: "Inventory OS",
  description:
    "FIFO-accurate valuation, multi-tenant RBAC, and a document engine that clerks trust more than their own spreadsheets.",
  supportEmail: "support@raniacone.com",
  copyrightHolder: "Raniac Systems",
  marketingStats: [
    { value: "206", label: "endpoints" },
    { value: "1.2M", label: "movements/day" },
    { value: "99.98%", label: "uptime SLA" },
  ],
  complianceBadges: ["SOC 2 Type II", "ISO 27001"],
  LogoMark: DefaultLogoMark,
  workspaceDomain: "raniacone.app",
};
