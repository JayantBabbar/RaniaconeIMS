"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { useAuth } from "@/providers/auth-provider";
import { balanceService, movementService } from "@/services/stock.service";
import { documentService } from "@/services/documents.service";
import { countService } from "@/services/counts.service";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import {
  DollarSign, Box, FileText, ClipboardList,
  ArrowDownToLine, ArrowUpFromLine, ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user, tenantName } = useAuth();

  const { data: balancesRaw, isLoading: balancesLoading } = useQuery({
    queryKey: ["dashboard-balances"],
    queryFn: () => balanceService.list({ limit: 200, only_nonzero: true }),
  });
  const { data: movementsRaw } = useQuery({
    queryKey: ["dashboard-movements"],
    queryFn: () => movementService.list({ limit: 10 }),
  });
  const { data: docsRaw } = useQuery({
    queryKey: ["dashboard-docs"],
    queryFn: () => documentService.list({ limit: 50 }),
  });
  const { data: countsRaw } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: () => countService.list({ limit: 20 }),
  });
  const { data: itemsRaw } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });

  const balances = balancesRaw ?? [];
  const movements = movementsRaw ?? [];
  const docs = docsRaw?.data || [];
  const counts = countsRaw?.data || [];
  const items = itemsRaw?.data || [];
  const locations = locsRaw?.data || [];

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // KPIs
  const totalValue = useMemo(
    () => balances.reduce((s, b) => s + parseFloat(b.value || "0"), 0),
    [balances]
  );
  const distinctItems = useMemo(() => new Set(balances.map((b) => b.item_id)).size, [balances]);
  const draftDocs = docs.filter((d) => !d.posting_date).length;
  const postedDocsToday = docs.filter(
    (d) => d.posting_date && new Date(d.posting_date).toDateString() === new Date().toDateString()
  ).length;
  const openCounts = counts.length; // backend could filter by status=open if supported

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Dashboard"]} />
      <div className="p-5 space-y-5">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Good {greeting()}, {user?.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-sm text-foreground-secondary mt-0.5">
              Here&apos;s what&apos;s happening in <span className="font-medium">{tenantName}</span> today.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            icon={<DollarSign size={14} />}
            label="Inventory value"
            value={balancesLoading ? "—" : totalValue.toFixed(2)}
            hint={`${distinctItems} distinct items`}
            href="/balances"
          />
          <KpiCard
            icon={<Box size={14} />}
            label="Items in stock"
            value={distinctItems.toString()}
            hint={`across ${new Set(balances.map((b) => b.location_id)).size} locations`}
            href="/balances"
          />
          <KpiCard
            icon={<FileText size={14} />}
            label="Draft documents"
            value={draftDocs.toString()}
            hint={`${postedDocsToday} posted today`}
            href="/documents/all"
          />
          <KpiCard
            icon={<ClipboardList size={14} />}
            label="Stock counts"
            value={openCounts.toString()}
            hint="open sessions"
            href="/counts"
          />
        </div>

        {/* Two column: recent movements + recent documents */}
        <div className="grid grid-cols-2 gap-4">
          {/* Recent movements */}
          <div className="bg-white border border-hairline rounded-md overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline-light flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent movements</h2>
              <Link href="/movements" className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            {movements.length === 0 ? (
              <div className="py-10 text-center text-sm text-foreground-muted">
                {balancesLoading ? <Spinner size={18} /> : "No movements yet"}
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {movements.slice(0, 8).map((m) => {
                    const item = itemMap.get(m.item_id);
                    const loc = locMap.get(m.location_id);
                    return (
                      <tr key={m.id} className="border-t border-hairline-light">
                        <td className="px-4 py-2 w-6">
                          {m.direction === "in"
                            ? <ArrowDownToLine size={14} className="text-status-green-text" />
                            : <ArrowUpFromLine size={14} className="text-status-red-text" />}
                        </td>
                        <td className="px-2 py-2">
                          <div className="text-sm font-medium truncate">{item?.name || "—"}</div>
                          <div className="text-[11px] text-foreground-muted font-mono">{item?.item_code} · {loc?.code}</div>
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums font-medium">{m.quantity}</td>
                        <td className="px-4 py-2 text-right text-xs text-foreground-muted">{formatDate(m.posting_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent documents */}
          <div className="bg-white border border-hairline rounded-md overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline-light flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent documents</h2>
              <Link href="/documents/all" className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            {docs.length === 0 ? (
              <div className="py-10 text-center text-sm text-foreground-muted">No documents yet</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {docs.slice(0, 8).map((d) => (
                    <tr key={d.id} className="border-t border-hairline-light">
                      <td className="px-4 py-2">
                        <Link href={`/documents/detail/${d.id}`} className="text-xs font-mono font-bold text-brand hover:underline">
                          {d.document_number}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-xs text-foreground-secondary">
                        {formatDate(d.document_date)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {d.posting_date
                          ? <Badge tone="green">Posted</Badge>
                          : <Badge tone="amber">Draft</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <h2 className="text-sm font-semibold mb-3">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/documents/purchase-orders/new"><Button kind="primary">New purchase order</Button></Link>
            <Link href="/documents/sales-orders/new"><Button>New sales order</Button></Link>
            <Link href="/counts"><Button>Start stock count</Button></Link>
            <Link href="/items"><Button>Add item</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function KpiCard({
  icon, label, value, hint, href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const Wrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={href} className="block bg-white border border-hairline rounded-md p-4 hover:border-brand/40 transition-colors">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="bg-white border border-hairline rounded-md p-4">{children}</div>
      );

  return (
    <Wrapper>
      <div className="flex items-center gap-2 text-foreground-muted mb-2">
        {icon}
        <span className="text-[10.5px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-foreground-muted mt-1">{hint}</div>}
    </Wrapper>
  );
}
