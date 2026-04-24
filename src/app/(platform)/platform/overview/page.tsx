"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KPICard, Spinner } from "@/components/ui/shared";
import { tenantService, currencyService, healthService } from "@/services/platform.service";
import Link from "next/link";
import {
  Building2,
  DollarSign,
  Activity,
  AlertTriangle,
  Plus,
  Download,
  ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Platform Overview — Tier 1 Service Provider Dashboard
// ═══════════════════════════════════════════════════════════

export default function PlatformOverviewPage() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => healthService.check(),
    refetchInterval: 30000,
  });

  const { data: tenantsRaw } = useQuery({
    queryKey: ["platformTenants"],
    queryFn: () => tenantService.list({ limit: 200 }),
  });

  const { data: currenciesRaw } = useQuery({
    queryKey: ["platformCurrencies"],
    queryFn: () => currencyService.list({ limit: 200 }),
  });

  const tenants = tenantsRaw ?? [];
  const currencies = currenciesRaw ?? [];

  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const trialingTenants = tenants.filter((t) => t.status === "trialing").length;

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Platform", "Overview"]}
        right={
          <>
            <Button icon={<Download size={13} />}>Export health report</Button>
            <Link href="/platform/tenants">
              <Button kind="primary" icon={<Plus size={13} />}>
                Provision Tenant
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Header */}
        <div className="flex items-baseline gap-3.5">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Platform overview
          </h1>
          <span className="text-xs text-foreground-muted">
            All regions · tz UTC
          </span>
          <div className="flex-1" />
          <Badge
            tone={health?.status === "ok" ? "green" : "red"}
            dot
          >
            {health?.status === "ok"
              ? "All systems operational"
              : "Checking…"}
          </Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Total Tenants"
            value={String(tenants.length)}
            subtitle={`${activeTenants} active · ${trialingTenants} trialing`}
            icon={<Building2 size={15} />}
          />
          <KPICard
            label="Currencies"
            value={String(currencies.length)}
            subtitle="Configured globally"
            icon={<DollarSign size={15} />}
          />
          <KPICard
            label="API Status"
            value={health?.status === "ok" ? "Healthy" : "—"}
            subtitle={`Auth ${health?.auth?.status ?? "?"} · Inventory ${health?.inventory?.status ?? "?"}`}
            icon={<Activity size={15} />}
          />
          <KPICard
            label="Suspended"
            value={String(tenants.filter((t) => t.status === "suspended").length)}
            subtitle="Tenants requiring attention"
            icon={<AlertTriangle size={15} />}
          />
        </div>

        {/* Recent tenants + currencies side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Recent tenants */}
          <div className="bg-white border border-hairline rounded-md overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <h2 className="text-sm font-semibold">Recent Tenants</h2>
              <Link
                href="/platform/tenants"
                className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
              >
                View all <ChevronRight size={11} />
              </Link>
            </div>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Tenant</th>
                  <th className="text-left px-4 py-2 font-medium">Plan</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.slice(0, 5).map((t) => (
                  <tr key={t.id} className="border-t border-hairline-light">
                    <td className="px-4 py-2">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-[10.5px] text-foreground-muted font-mono">
                        {t.code}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          t.plan === "Enterprise" || t.plan === "enterprise"
                            ? "blue"
                            : t.plan === "Trial" || t.plan === "trial"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {t.plan || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          t.status === "active"
                            ? "green"
                            : t.status === "trialing"
                              ? "blue"
                              : "red"
                        }
                        dot
                      >
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-foreground-muted">
                      No tenants yet. Provision your first tenant to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Currencies */}
          <div className="bg-white border border-hairline rounded-md overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <h2 className="text-sm font-semibold">Currencies</h2>
              <Link
                href="/platform/currencies"
                className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
              >
                Manage <ChevronRight size={11} />
              </Link>
            </div>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-center px-4 py-2 font-medium">Symbol</th>
                  <th className="text-center px-4 py-2 font-medium">Decimals</th>
                </tr>
              </thead>
              <tbody>
                {currencies.slice(0, 5).map((c) => (
                  <tr key={c.id} className="border-t border-hairline-light">
                    <td className="px-4 py-2 font-mono text-xs font-semibold">
                      {c.code}
                    </td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-center">{c.symbol || "—"}</td>
                    <td className="px-4 py-2 text-center tabular-nums">
                      {c.decimal_precision}
                    </td>
                  </tr>
                ))}
                {currencies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-foreground-muted">
                      No currencies configured. Add currencies before creating tenants.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
