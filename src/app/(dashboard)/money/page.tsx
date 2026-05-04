"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { ledgerService } from "@/services/ledger.service";
import { paymentService } from "@/services/payments.service";
import {
  Wallet, Landmark, Banknote, CircleDollarSign,
  HandCoins, UserCircle, ArrowDownToLine, ArrowUpFromLine, ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Money — Overview landing
//
// Shows the multi-ledger UX from §11 of clientneeds.txt as a tiles
// grid: Cash / Bank / Cheque pending / GPay / Receivable / Payable /
// Employee Float. Plus a feed of recent receipts so users land
// on something live, not a static read.
// ═══════════════════════════════════════════════════════════

interface TileProps {
  label: string;
  value: string;
  hint?: string;
  href: string;
  icon: React.ElementType;
  tone: "green" | "blue" | "amber" | "purple" | "neutral";
}

function Tile({ label, value, hint, href, icon: Icon, tone }: TileProps) {
  const toneClasses: Record<typeof tone, string> = {
    green:   "from-emerald-50 to-emerald-100/50 text-emerald-700 dark:from-emerald-950 dark:to-emerald-900/40 dark:text-emerald-300",
    blue:    "from-sky-50 to-sky-100/50 text-sky-700 dark:from-sky-950 dark:to-sky-900/40 dark:text-sky-300",
    amber:   "from-amber-50 to-amber-100/50 text-amber-700 dark:from-amber-950 dark:to-amber-900/40 dark:text-amber-300",
    purple:  "from-violet-50 to-violet-100/50 text-violet-700 dark:from-violet-950 dark:to-violet-900/40 dark:text-violet-300",
    neutral: "from-slate-50 to-slate-100/50 text-slate-700 dark:from-slate-900 dark:to-slate-900/40 dark:text-slate-300",
  };
  return (
    <Link
      href={href}
      className={`block rounded-lg border border-border bg-gradient-to-br ${toneClasses[tone]} p-4 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums truncate">{formatCurrency(value, "INR", "en-IN")}</p>
          {hint && <p className="mt-0.5 text-xs opacity-70">{hint}</p>}
        </div>
        <Icon size={20} className="opacity-60 flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function MoneyOverviewPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["ledger-summary"],
    queryFn: () => ledgerService.getSummary(),
  });

  const { data: receiptsRaw } = useQuery({
    queryKey: ["payments", { direction: "received", limit: 5 }],
    queryFn: () => paymentService.list({ direction: "received", limit: 5 }),
  });
  const receipts = (receiptsRaw ?? []).slice(0, 5);

  const { data: paymentsRaw } = useQuery({
    queryKey: ["payments", { direction: "paid", limit: 5 }],
    queryFn: () => paymentService.list({ direction: "paid", limit: 5 }),
  });
  const payments = (paymentsRaw ?? []).slice(0, 5);

  return (
    <RequireRead perm="inventory.ledger.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Money"
          description="Multi-ledger overview: where the cash is, who owes us, who we owe. Drill into any tile to see the journal."
        />

        {summaryLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : summary ? (
          <>
            <h2 className="text-sm font-semibold text-text-secondary mb-3 mt-2">Where the money is</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Cash in hand"     value={summary.cash_in_hand}      icon={Wallet}            tone="green"  href="/money/ledger/acc-cash" />
              <Tile label="Bank"             value={summary.bank}              icon={Landmark}          tone="blue"   href="/money/ledger/acc-bank-hdfc" />
              <Tile label="Cheques pending"  value={summary.cheque_in_transit} icon={Banknote}          tone="amber"  href="/money/cheques" hint="Awaiting deposit" />
              <Tile label="Company GPay"     value={summary.gpay}              icon={CircleDollarSign}  tone="purple" href="/money/ledger/acc-gpay" />
            </div>

            <h2 className="text-sm font-semibold text-text-secondary mb-3 mt-6">Who owes who</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Customers owe us"  value={summary.total_receivable}      icon={ArrowDownToLine}  tone="green"   href="/money/debtors" hint="Outstanding receivables" />
              <Tile label="We owe vendors"    value={summary.total_payable}         icon={ArrowUpFromLine}  tone="amber"   href="/money/debtors?direction=payable" hint="Outstanding payables" />
              <Tile label="Bills pending"     value={summary.vendor_bills_pending ?? "0"} icon={FileSpreadsheet} tone="amber"   href="/bills" hint="Posted bills awaiting payment" />
              <Tile label="Employee float"    value={summary.employee_float}        icon={UserCircle}       tone="purple"  href="/money/employees" hint="Held by salesmen, deduct from salary" />
            </div>

            <p className="mt-2 text-[11px] text-text-tertiary">As of {formatDate(summary.as_of)}</p>
          </>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
          <RecentList title="Recent receipts" rows={receipts} hrefBase="/money/receipts" emptyHint="No receipts yet — record one when a customer pays." Icon={HandCoins} />
          <RecentList title="Recent payments" rows={payments} hrefBase="/money/payments" emptyHint="No payments yet — record one when you settle a vendor." Icon={CircleDollarSign} />
        </div>
      </div>
    </RequireRead>
  );
}

interface RecentListProps {
  title: string;
  rows: Array<{
    id: string;
    payment_number: string;
    payment_date: string;
    party_id: string;
    amount: string;
    mode: string;
    status: string;
  }>;
  hrefBase: string;
  emptyHint: string;
  Icon: React.ElementType;
}

function RecentList({ title, rows, hrefBase, emptyHint, Icon }: RecentListProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-text-tertiary" />
          <h3 className="text-[13px] font-semibold">{title}</h3>
        </div>
        <Link href={hrefBase} className="text-xs text-brand hover:underline flex items-center gap-1">
          View all <ArrowRight size={12} />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-tertiary">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`${hrefBase}/${p.id}`} className="flex items-center justify-between px-4 py-2 hover:bg-bg-hover transition-colors">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{p.payment_number}</p>
                  <p className="text-[11px] text-text-tertiary truncate">{formatDate(p.payment_date)} · {p.mode.toUpperCase()} · {p.status}</p>
                </div>
                <p className="text-[13px] tabular-nums font-semibold flex-shrink-0">{formatCurrency(p.amount, "INR", "en-IN")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
