"use client";

import React, { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner } from "@/components/ui/shared";
import { Badge } from "@/components/ui/badge";
import { Input, FormField } from "@/components/ui/form-elements";
import { invoiceService } from "@/services/invoices.service";
import { billService } from "@/services/bills.service";
import { expenseService, expenseCategoryService } from "@/services/expenses.service";
import { salaryService } from "@/services/salary.service";
import { partyService } from "@/services/parties.service";
import { itemService } from "@/services/items.service";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Coins, ShoppingCart, Users, Package,
  ArrowDownRight, ArrowUpRight, BarChart3,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports/overview — Business overview report
//
// Aggregates earning vs spend over a date range, with item-wise
// revenue, top customers, and a spend breakdown. Built FE-side
// from invoice + bill + expense + salary lists so it works in
// demo mode and against the real backend with zero changes.
// ═══════════════════════════════════════════════════════════

function defaultStart(): string {
  // Last 90 days (calendar-local).
  const d = new Date();
  d.setDate(d.getDate() - 89);
  return d.toISOString().slice(0, 10);
}
function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

function inRange(date: string | undefined | null, start: string, end: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= start && d <= end;
}

export default function BusinessOverviewPage() {
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());

  // ── Data fetch ───────────────────────────────────────────
  const { data: invoicesAll, isLoading: invLoading } = useQuery({
    queryKey: ["overview-invoices", { startDate, endDate }],
    queryFn: () => invoiceService.list({ limit: 200, start_date: startDate, end_date: endDate }),
  });
  const invoicesPosted = useMemo(
    () => (invoicesAll ?? []).filter((i) => i.status === "posted"),
    [invoicesAll],
  );

  const { data: billsAll, isLoading: billLoading } = useQuery({
    queryKey: ["overview-bills"],
    queryFn: () => billService.list({ limit: 200 }),
  });
  const billsInRange = useMemo(
    () => (billsAll ?? []).filter(
      (b) => b.status === "posted" && inRange(b.bill_date, startDate, endDate),
    ),
    [billsAll, startDate, endDate],
  );

  const { data: expensesAll, isLoading: expLoading } = useQuery({
    queryKey: ["overview-expenses"],
    queryFn: () => expenseService.list({ limit: 200 }),
  });
  const expensesInRange = useMemo(
    () => (expensesAll ?? []).filter(
      (e) => e.status === "posted" && inRange(e.expense_date, startDate, endDate),
    ),
    [expensesAll, startDate, endDate],
  );

  const { data: salaryAll, isLoading: salLoading } = useQuery({
    queryKey: ["overview-salary"],
    queryFn: () => salaryService.list({ limit: 200 }),
  });
  const salaryInRange = useMemo(
    () => (salaryAll ?? []).filter(
      (s) => s.status === "posted" && inRange(s.period_month, startDate, endDate),
    ),
    [salaryAll, startDate, endDate],
  );

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const partyById = useMemo(
    () => new Map((partiesRaw?.data ?? []).map((p) => [p.id, p])),
    [partiesRaw],
  );

  const { data: itemsRaw } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const itemById = useMemo(
    () => new Map((itemsRaw?.data ?? []).map((i) => [i.id, i])),
    [itemsRaw],
  );

  const { data: categoriesAll } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseCategoryService.list({ limit: 200 }),
  });
  const categoryById = useMemo(
    () => new Map((categoriesAll ?? []).map((c) => [c.id, c])),
    [categoriesAll],
  );

  // Parallel fetch of all posted-invoice line arrays — this is the
  // input for the item-wise breakdown. React Query dedupes + caches.
  const linesQueries = useQueries({
    queries: invoicesPosted.map((inv) => ({
      queryKey: ["invoice-lines", inv.id],
      queryFn: () => invoiceService.listLines(inv.id),
      staleTime: 60 * 1000,
    })),
  });
  const linesLoading = linesQueries.some((q) => q.isLoading);

  // ── Aggregations ─────────────────────────────────────────
  const totals = useMemo(() => {
    const earning = invoicesPosted.reduce((s, i) => s + Number(i.grand_total ?? 0), 0);
    const earningTaxable = invoicesPosted.reduce((s, i) => s + Number(i.subtotal ?? 0), 0);
    const earningGst = invoicesPosted.reduce((s, i) => s + Number(i.tax_total ?? 0), 0);

    const billsSpend = billsInRange.reduce((s, b) => s + Number(b.grand_total ?? 0), 0);
    const expensesSpend = expensesInRange.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const salarySpend = salaryInRange.reduce((s, p) => s + Number(p.net_paid ?? p.gross_salary ?? 0), 0);
    const spend = billsSpend + expensesSpend + salarySpend;

    return {
      earning,
      earningTaxable,
      earningGst,
      spend,
      billsSpend,
      expensesSpend,
      salarySpend,
      net: earning - spend,
      invoiceCount: invoicesPosted.length,
      avgInvoice: invoicesPosted.length > 0 ? earning / invoicesPosted.length : 0,
      uniqueCustomers: new Set(invoicesPosted.map((i) => i.party_id)).size,
    };
  }, [invoicesPosted, billsInRange, expensesInRange, salaryInRange]);

  // Item-wise earning: aggregate qty + taxable + grand_total per item.
  const itemRows = useMemo(() => {
    const map = new Map<string, {
      itemId: string;
      qty: number;
      revenue: number;     // line_total inc. GST
      taxable: number;     // line.taxable_value
      lineCount: number;
    }>();
    linesQueries.forEach((q) => {
      const lines = q.data ?? [];
      for (const l of lines) {
        if (!l.item_id) continue;
        const row = map.get(l.item_id) ?? {
          itemId: l.item_id, qty: 0, revenue: 0, taxable: 0, lineCount: 0,
        };
        row.qty       += Number(l.quantity ?? 0);
        row.revenue   += Number(l.line_total ?? 0);
        row.taxable   += Number(l.taxable_value ?? 0);
        row.lineCount += 1;
        map.set(l.item_id, row);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue);
  }, [linesQueries]);
  const itemRevenueTotal = itemRows.reduce((s, r) => s + r.revenue, 0);

  // Top customers: sum invoice totals per party.
  const customerRows = useMemo(() => {
    const map = new Map<string, { partyId: string; invoiceCount: number; revenue: number }>();
    for (const inv of invoicesPosted) {
      const row = map.get(inv.party_id) ?? { partyId: inv.party_id, invoiceCount: 0, revenue: 0 };
      row.invoiceCount += 1;
      row.revenue      += Number(inv.grand_total ?? 0);
      map.set(inv.party_id, row);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [invoicesPosted]);

  // Spend by category: bills (lumped), each expense category, salary.
  const spendBreakdown = useMemo(() => {
    const expensesByCat = new Map<string, number>();
    for (const e of expensesInRange) {
      expensesByCat.set(e.category_id, (expensesByCat.get(e.category_id) ?? 0) + Number(e.amount ?? 0));
    }
    const out: Array<{ label: string; amount: number; tone: "blue" | "amber" | "purple" | "green" | "neutral" }> = [];
    if (totals.billsSpend > 0)  out.push({ label: "Vendor bills",  amount: totals.billsSpend, tone: "blue" });
    if (totals.salarySpend > 0) out.push({ label: "Salary paid",   amount: totals.salarySpend, tone: "purple" });
    expensesByCat.forEach((amt, catId) => {
      out.push({
        label: categoryById.get(catId)?.name ?? "Unknown category",
        amount: amt,
        tone: "amber",
      });
    });
    return out.sort((a, b) => b.amount - a.amount);
  }, [expensesInRange, totals.billsSpend, totals.salarySpend, categoryById]);

  // Monthly trend for the last 6 months (or the date range, whichever fits).
  const monthly = useMemo(() => {
    // Always show the last 6 months ending at endDate, regardless of start.
    const end = new Date(endDate);
    const buckets: Array<{ label: string; key: string; earning: number; spend: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      buckets.push({ label: `${label} ${String(d.getFullYear()).slice(2)}`, key, earning: 0, spend: 0 });
    }
    const monthKey = (s: string) => s.slice(0, 7);
    for (const inv of (invoicesAll ?? [])) {
      if (inv.status !== "posted") continue;
      const b = buckets.find((x) => x.key === monthKey(inv.invoice_date));
      if (b) b.earning += Number(inv.grand_total ?? 0);
    }
    for (const bill of (billsAll ?? [])) {
      if (bill.status !== "posted") continue;
      const b = buckets.find((x) => x.key === monthKey(bill.bill_date));
      if (b) b.spend += Number(bill.grand_total ?? 0);
    }
    for (const exp of (expensesAll ?? [])) {
      if (exp.status !== "posted") continue;
      const b = buckets.find((x) => x.key === monthKey(exp.expense_date));
      if (b) b.spend += Number(exp.amount ?? 0);
    }
    for (const sal of (salaryAll ?? [])) {
      if (sal.status !== "posted") continue;
      const b = buckets.find((x) => x.key === monthKey(sal.period_month));
      if (b) b.spend += Number(sal.net_paid ?? sal.gross_salary ?? 0);
    }
    return buckets;
  }, [invoicesAll, billsAll, expensesAll, salaryAll, endDate]);

  const monthlyMax = Math.max(1, ...monthly.flatMap((m) => [m.earning, m.spend]));

  const loading = invLoading || billLoading || expLoading || salLoading || linesLoading;

  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-5">
        <PageHeader
          title="Business overview"
          description="Earning, spending, and what's actually selling — over the date range you pick. Refreshes from posted invoices, vendor bills, expenses and salary in real time."
        />

        {/* Filters */}
        <div className="flex items-end gap-3 flex-wrap">
          <FormField label="From">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="To">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
          <div className="flex-1" />
          {loading && (
            <div className="text-[11px] text-text-tertiary flex items-center gap-1.5 pb-2">
              <Spinner size={12} /> aggregating…
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi
            label="Total earning"
            value={formatCurrency(totals.earning, "INR", "en-IN")}
            sub={`${totals.invoiceCount} invoice${totals.invoiceCount === 1 ? "" : "s"}`}
            icon={<TrendingUp size={14} className="text-status-green-text" />}
            tone="green"
          />
          <Kpi
            label="Total spend"
            value={formatCurrency(totals.spend, "INR", "en-IN")}
            sub={`bills ${formatCurrency(totals.billsSpend, "INR", "en-IN")}`}
            icon={<TrendingDown size={14} className="text-status-red-text" />}
            tone="red"
          />
          <Kpi
            label={totals.net >= 0 ? "Net profit" : "Net loss"}
            value={formatCurrency(Math.abs(totals.net), "INR", "en-IN")}
            sub={
              totals.earning > 0
                ? `${((totals.net / totals.earning) * 100).toFixed(1)}% margin`
                : "no revenue yet"
            }
            icon={
              totals.net >= 0
                ? <ArrowUpRight size={14} className="text-status-green-text" />
                : <ArrowDownRight size={14} className="text-status-red-text" />
            }
            tone={totals.net >= 0 ? "green" : "red"}
            emphasize
          />
          <Kpi
            label="Average invoice"
            value={formatCurrency(totals.avgInvoice, "INR", "en-IN")}
            sub="per posted invoice"
            icon={<ShoppingCart size={14} className="text-text-secondary" />}
            tone="neutral"
          />
          <Kpi
            label="Active customers"
            value={String(totals.uniqueCustomers)}
            sub="billed in range"
            icon={<Users size={14} className="text-text-secondary" />}
            tone="neutral"
          />
          <Kpi
            label="GST collected"
            value={formatCurrency(totals.earningGst, "INR", "en-IN")}
            sub="output tax on posted invoices"
            icon={<Coins size={14} className="text-text-secondary" />}
            tone="neutral"
          />
        </div>

        {/* Monthly trend strip */}
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 size={14} /> Last 6 months — earning vs spend
            </h3>
            <span className="text-[10.5px] text-text-tertiary">based on posting date</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {monthly.map((m) => {
              const earnPct = (m.earning / monthlyMax) * 100;
              const spendPct = (m.spend / monthlyMax) * 100;
              return (
                <div key={m.key} className="space-y-1">
                  <div className="h-24 flex items-end gap-1">
                    <div
                      title={`Earning ${formatCurrency(m.earning, "INR", "en-IN")}`}
                      className="flex-1 bg-status-green rounded-t transition-[height] duration-300"
                      style={{ height: `${Math.max(2, earnPct)}%` }}
                    />
                    <div
                      title={`Spend ${formatCurrency(m.spend, "INR", "en-IN")}`}
                      className="flex-1 bg-status-red rounded-t transition-[height] duration-300"
                      style={{ height: `${Math.max(2, spendPct)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-center text-text-tertiary tabular-nums">
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-status-green rounded-sm" /> Earning</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-status-red rounded-sm" /> Spend</span>
          </div>
        </div>

        {/* Two column: item-wise revenue + top customers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Item-wise earning */}
          <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Package size={14} /> Item-wise earning
              </h3>
              <span className="text-[10.5px] text-text-tertiary">{itemRows.length} item{itemRows.length === 1 ? "" : "s"}</span>
            </div>
            {itemRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                {loading ? <Spinner size={18} /> : "No invoice lines in this date range yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-bg-subtle text-text-tertiary text-[10.5px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Item</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">Revenue</th>
                      <th className="text-right px-3 py-2 font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows.slice(0, 12).map((r) => {
                      const it = itemById.get(r.itemId);
                      const share = itemRevenueTotal > 0 ? (r.revenue / itemRevenueTotal) * 100 : 0;
                      return (
                        <tr key={r.itemId} className="border-t border-border">
                          <td className="px-3 py-2">
                            <div className="font-medium truncate max-w-[220px]">{it?.name ?? r.itemId}</div>
                            <div className="text-[10.5px] text-text-tertiary font-mono">{it?.item_code}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {formatCurrency(r.revenue, "INR", "en-IN")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <div className="w-16 h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                                <div
                                  className="h-full bg-status-green"
                                  style={{ width: `${Math.min(100, share)}%` }}
                                />
                              </div>
                              <span className="tabular-nums text-[11px] text-text-tertiary w-8 text-right">{share.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {itemRows.length > 12 && (
                  <div className="px-3 py-2 border-t border-border text-[11px] text-text-tertiary">
                    Showing top 12 of {itemRows.length}.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top customers */}
          <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Users size={14} /> Top customers
              </h3>
              <span className="text-[10.5px] text-text-tertiary">{customerRows.length} party-{customerRows.length === 1 ? "" : "ies"}</span>
            </div>
            {customerRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                {loading ? <Spinner size={18} /> : "No customers billed in this date range."}
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-bg-subtle text-text-tertiary text-[10.5px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Customer</th>
                    <th className="text-right px-3 py-2 font-medium">Invoices</th>
                    <th className="text-right px-3 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.slice(0, 10).map((r) => {
                    const p = partyById.get(r.partyId);
                    return (
                      <tr key={r.partyId} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium">{p?.name ?? r.partyId}</div>
                          <div className="text-[10.5px] text-text-tertiary font-mono">{p?.code}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.invoiceCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {formatCurrency(r.revenue, "INR", "en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Spend breakdown */}
        <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingDown size={14} /> Where the money went
            </h3>
            <span className="text-[10.5px] text-text-tertiary">{spendBreakdown.length} bucket{spendBreakdown.length === 1 ? "" : "s"}</span>
          </div>
          {spendBreakdown.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              {loading ? <Spinner size={18} /> : "No spend recorded in this date range."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {spendBreakdown.map((row) => {
                const share = totals.spend > 0 ? (row.amount / totals.spend) * 100 : 0;
                return (
                  <div key={row.label} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-shrink-0 w-32 text-[12.5px] font-medium truncate" title={row.label}>{row.label}</div>
                    <div className="flex-1 h-2 rounded-full bg-bg-subtle overflow-hidden">
                      <div
                        className="h-full bg-status-red/70"
                        style={{ width: `${Math.min(100, share)}%` }}
                      />
                    </div>
                    <div className="w-24 text-right tabular-nums text-[12.5px] font-semibold">
                      {formatCurrency(row.amount, "INR", "en-IN")}
                    </div>
                    <div className="w-12 text-right tabular-nums text-[11px] text-text-tertiary">
                      {share.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-[11px] text-text-tertiary">
          Earning counts posted invoices only — drafts and cancelled docs don&apos;t move the numbers.
          Spend = posted vendor bills + posted expenses (incl. fuel) + posted salary payouts.
          Item revenue is GST-inclusive line totals; the &quot;Share&quot; column is each item&apos;s slice of the total invoice-line revenue in range.
        </p>
      </div>
    </RequireRead>
  );
}

function Kpi({
  label, value, sub, icon, tone, emphasize,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone: "green" | "red" | "neutral";
  emphasize?: boolean;
}) {
  const toneClass =
    tone === "green" ? "border-status-green/30 bg-status-green-bg/50"
    : tone === "red" ? "border-status-red/30 bg-status-red-bg/50"
    : "border-border bg-bg-elevated";
  return (
    <div className={`rounded-lg border ${toneClass} px-3 py-2.5 ${emphasize ? "ring-1 ring-brand/30" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-[10.5px] uppercase tracking-wider text-text-tertiary font-medium">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className={`mt-1 tabular-nums font-semibold ${emphasize ? "text-[18px]" : "text-[15px]"}`}>
        {value}
      </div>
      {sub && <div className="text-[10.5px] text-text-tertiary mt-0.5 truncate">{sub}</div>}
      {emphasize && <Badge tone={tone === "green" ? "green" : "red"} dot>{tone === "green" ? "in the black" : "in the red"}</Badge>}
    </div>
  );
}
