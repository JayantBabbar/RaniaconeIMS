"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KPICard, Spinner } from "@/components/ui/shared";
import { healthService, tenantService } from "@/services/platform.service";
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// S-68: System Health — Tier 1 Service Provider Admin
// Live API / DB status + per-check details and latency trace
// ═══════════════════════════════════════════════════════════

interface HealthSample {
  at: string;
  latencyMs: number;
  ok: boolean;
}

export default function SystemHealthPage() {
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const { data: health, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const start = performance.now();
      try {
        const res = await healthService.check();
        const dur = Math.round(performance.now() - start);
        const sample: HealthSample = {
          at: new Date().toISOString(),
          latencyMs: dur,
          ok: res.status === "ok",
        };
        setSamples((s) => [...s.slice(-29), sample]);
        setLastCheckedAt(sample.at);
        return { ...res, latencyMs: dur };
      } catch {
        const dur = Math.round(performance.now() - start);
        const sample: HealthSample = {
          at: new Date().toISOString(),
          latencyMs: dur,
          ok: false,
        };
        setSamples((s) => [...s.slice(-29), sample]);
        setLastCheckedAt(sample.at);
        throw new Error("Health check failed");
      }
    },
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: tenantsRaw } = useQuery({
    queryKey: ["platformTenants"],
    queryFn: () => tenantService.list({ limit: 500 }),
  });
  const tenants = tenantsRaw ?? [];

  const apiOk = health?.status === "ok";
  const authOk = health?.auth?.status === "ok";
  const invOk = health?.inventory?.status === "ok";
  const dbValue =
    health?.auth?.database || health?.inventory?.database || "";
  const dbOk = dbValue.toLowerCase().includes("ok") || dbValue === "healthy";

  const avgLatency =
    samples.length > 0
      ? Math.round(samples.reduce((s, x) => s + x.latencyMs, 0) / samples.length)
      : null;

  const uptimePct =
    samples.length > 0
      ? Math.round((samples.filter((s) => s.ok).length / samples.length) * 100)
      : null;

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Platform", "System Health"]}
        right={
          <Button
            icon={<RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />}
            onClick={() => refetch()}
          >
            Recheck now
          </Button>
        }
      />

      <div className="p-4 md:p-5 space-y-5">
        {/* Header banner */}
        <div className="bg-white border border-hairline rounded-md p-5 flex items-center gap-4">
          <div
            className={
              apiOk && dbOk
                ? "w-12 h-12 rounded-full bg-status-green-bg flex items-center justify-center"
                : "w-12 h-12 rounded-full bg-status-red-bg flex items-center justify-center"
            }
          >
            {apiOk && dbOk ? (
              <CheckCircle2 size={24} className="text-status-green-text" />
            ) : (
              <XCircle size={24} className="text-status-red-text" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {apiOk && dbOk ? "All systems operational" : "Service degraded"}
            </h1>
            <p className="text-xs text-foreground-secondary mt-0.5">
              {lastCheckedAt
                ? `Last checked ${new Date(lastCheckedAt).toLocaleTimeString()} · auto-refresh every 15s`
                : "Checking…"}
            </p>
          </div>
          <Badge tone={apiOk && dbOk ? "green" : "red"} dot>
            {apiOk && dbOk ? "Healthy" : "Issue detected"}
          </Badge>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="API Status"
            value={apiOk ? "OK" : "Down"}
            subtitle={apiOk ? "Responding normally" : "Not reachable"}
            icon={<Server size={15} />}
          />
          <KPICard
            label="Database"
            value={dbOk ? "OK" : dbValue || "—"}
            subtitle="PostgreSQL"
            icon={<Database size={15} />}
          />
          <KPICard
            label="Avg Latency"
            value={avgLatency !== null ? `${avgLatency} ms` : "—"}
            subtitle={`Last ${samples.length || 0} checks`}
            icon={<Zap size={15} />}
          />
          <KPICard
            label="Uptime (session)"
            value={uptimePct !== null ? `${uptimePct}%` : "—"}
            subtitle={`${samples.filter((s) => s.ok).length}/${samples.length || 0} checks ok`}
            icon={<Activity size={15} />}
          />
        </div>

        {/* Per-check breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CheckCard
            title="Auth Service"
            status={authOk ? "ok" : "down"}
            endpoint=":8000/health"
            icon={<Server size={14} />}
          />
          <CheckCard
            title="Inventory Service"
            status={invOk ? "ok" : "down"}
            endpoint=":8001/health"
            icon={<Server size={14} />}
          />
          <CheckCard
            title="Database"
            status={dbOk ? "ok" : "down"}
            endpoint="PostgreSQL"
            detail={dbValue || "—"}
            icon={<Database size={14} />}
          />
        </div>

        {/* Latency history sparkline */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Latency (ms)</h2>
            <span className="text-xs text-foreground-muted">
              Last {samples.length} checks
            </span>
          </div>
          {samples.length === 0 ? (
            <div className="py-8 flex justify-center">
              <Spinner size={22} />
            </div>
          ) : (
            <LatencyChart samples={samples} />
          )}
        </div>

        {/* Recent checks table */}
        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
            <h2 className="text-sm font-semibold">Check log</h2>
            <span className="text-xs text-foreground-muted">Most recent first</span>
          </div>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-surface text-[10.5px] text-foreground-muted uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium">Result</th>
                <th className="text-right px-4 py-2 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {[...samples].reverse().slice(0, 15).map((s, i) => (
                <tr key={i} className="border-t border-hairline-light">
                  <td className="px-4 py-2 font-mono text-xs text-foreground-secondary tabular-nums">
                    {new Date(s.at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={s.ok ? "green" : "red"} dot>
                      {s.ok ? "OK" : "Failed"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs">
                    {s.latencyMs} ms
                  </td>
                </tr>
              ))}
              {samples.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-foreground-muted"
                  >
                    Waiting for first check…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Platform footprint */}
        <div className="bg-white border border-hairline rounded-md p-5 flex items-center gap-6">
          <div>
            <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
              Tenants provisioned
            </div>
            <div className="text-xl font-semibold tabular-nums mt-0.5">
              {tenants.length}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
              Active
            </div>
            <div className="text-xl font-semibold tabular-nums mt-0.5">
              {tenants.filter((t) => t.status === "active").length}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
              Suspended
            </div>
            <div className="text-xl font-semibold tabular-nums mt-0.5">
              {tenants.filter((t) => t.status === "suspended").length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Per-check card ─────────────────────────────────────────

function CheckCard({
  title,
  status,
  endpoint,
  latency,
  detail,
  icon,
}: {
  title: string;
  status: "ok" | "down";
  endpoint: string;
  latency?: number;
  detail?: string;
  icon: React.ReactNode;
}) {
  const ok = status === "ok";
  return (
    <div className="bg-white border border-hairline rounded-md p-4">
      <div className="flex items-start gap-3">
        <div
          className={
            ok
              ? "w-8 h-8 rounded bg-status-green-bg text-status-green-text flex items-center justify-center"
              : "w-8 h-8 rounded bg-status-red-bg text-status-red-text flex items-center justify-center"
          }
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Badge tone={ok ? "green" : "red"} dot>
              {ok ? "Operational" : "Down"}
            </Badge>
          </div>
          <div className="text-xs text-foreground-secondary mt-0.5 font-mono">
            {endpoint}
          </div>
          {detail && (
            <div className="text-xs text-foreground-muted mt-1">{detail}</div>
          )}
          {typeof latency === "number" && (
            <div className="flex items-center gap-1 text-xs text-foreground-muted mt-1.5">
              <Clock size={11} /> Latency: {latency} ms
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mini latency sparkline ────────────────────────────────

function LatencyChart({ samples }: { samples: HealthSample[] }) {
  const max = Math.max(...samples.map((s) => s.latencyMs), 100);
  return (
    <div className="flex items-end gap-1 h-20">
      {samples.map((s, i) => {
        const h = Math.max(3, (s.latencyMs / max) * 80);
        return (
          <div
            key={i}
            className={
              s.ok
                ? "flex-1 bg-status-green rounded-sm transition-all"
                : "flex-1 bg-status-red rounded-sm transition-all"
            }
            style={{ height: `${h}px` }}
            title={`${s.latencyMs} ms @ ${new Date(s.at).toLocaleTimeString()}`}
          />
        );
      })}
    </div>
  );
}
