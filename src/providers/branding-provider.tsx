"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { DEFAULT_BRANDING, type Branding } from "@/config/branding";

// ═══════════════════════════════════════════════════════════════════
// BrandingProvider — exposes the active product identity + (future)
// per-tenant CSS variable overrides.
//
// Usage:
//   const brand = useBranding();
//   <h1>{brand.name}</h1>
//
// Per-tenant theming (future wiring):
//   <BrandingProvider tenantBranding={{ name: "Acme Inventory" }}
//                     tenantThemeVars={{ "--color-brand": "#8B5CF6" }}>
// ═══════════════════════════════════════════════════════════════════

type BrandingContextValue = Branding;

const BrandingContext = createContext<BrandingContextValue>(DEFAULT_BRANDING);

interface BrandingProviderProps {
  children: React.ReactNode;
  /** Partial override of branding — any field omitted falls back to default. */
  tenantBranding?: Partial<Branding>;
  /**
   * Map of CSS variable names → values to inject on <html> for this tenant.
   * Example: { "--color-brand": "#8B5CF6", "--color-brand-light": "#F3E8FF" }
   */
  tenantThemeVars?: Record<string, string>;
}

export function BrandingProvider({
  children,
  tenantBranding,
  tenantThemeVars,
}: BrandingProviderProps) {
  const value = useMemo<Branding>(
    () => ({ ...DEFAULT_BRANDING, ...tenantBranding }),
    [tenantBranding],
  );

  useEffect(() => {
    if (!tenantThemeVars || typeof document === "undefined") return;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(tenantThemeVars)) {
      root.style.setProperty(key, val);
    }
    return () => {
      for (const key of Object.keys(tenantThemeVars)) {
        root.style.removeProperty(key);
      }
    };
  }, [tenantThemeVars]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
