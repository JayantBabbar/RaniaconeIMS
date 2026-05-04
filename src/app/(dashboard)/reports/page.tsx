"use client";

import React from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  TrendingUp, TrendingDown, AlarmClock, Hourglass,
  PiggyBank, Boxes, ArrowRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /reports — landing tile grid
//
// Each tile is one report. Tile copy stays plain-language so
// users with no accounting background can pick the right report
// for the question they're trying to answer.
// ═══════════════════════════════════════════════════════════

interface ReportCardProps {
  title: string;
  blurb: string;
  href: string;
  icon: React.ElementType;
  tone: "green" | "amber" | "blue" | "purple" | "neutral";
}

const TONES: Record<ReportCardProps["tone"], string> = {
  green:   "from-emerald-50 to-emerald-100/40 text-emerald-800 dark:from-emerald-950 dark:to-emerald-900/30 dark:text-emerald-300",
  amber:   "from-amber-50 to-amber-100/40 text-amber-800 dark:from-amber-950 dark:to-amber-900/30 dark:text-amber-300",
  blue:    "from-sky-50 to-sky-100/40 text-sky-800 dark:from-sky-950 dark:to-sky-900/30 dark:text-sky-300",
  purple:  "from-violet-50 to-violet-100/40 text-violet-800 dark:from-violet-950 dark:to-violet-900/30 dark:text-violet-300",
  neutral: "from-slate-50 to-slate-100/40 text-slate-800 dark:from-slate-900 dark:to-slate-900/30 dark:text-slate-300",
};

function ReportCard({ title, blurb, href, icon: Icon, tone }: ReportCardProps) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border border-border bg-gradient-to-br ${TONES[tone]} p-4 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <Icon size={22} className="opacity-70 flex-shrink-0" />
        <ArrowRight size={14} className="opacity-50 flex-shrink-0" />
      </div>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-80">{blurb}</p>
    </Link>
  );
}

export default function ReportsLandingPage() {
  return (
    <RequireRead perm="inventory.reports.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-7xl mx-auto">
        <PageHeader
          title="Reports"
          description="Statements over your invoices, bills, payments, expenses and salary. Pick the question you're trying to answer; each report is a date-bounded view you can filter and (eventually) export."
        />

        <h2 className="text-sm font-semibold text-text-secondary mt-2 mb-3">Tax registers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ReportCard
            title="Sales register"
            blurb="Every invoice you raised in a date range, with taxable + GST split. Foundation for GSTR-1."
            href="/reports/sales"
            icon={TrendingUp}
            tone="green"
          />
          <ReportCard
            title="Purchase register"
            blurb="Every vendor bill you posted, with input GST. Foundation for GSTR-2."
            href="/reports/purchases"
            icon={TrendingDown}
            tone="blue"
          />
        </div>

        <h2 className="text-sm font-semibold text-text-secondary mt-6 mb-3">Outstanding (aging)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ReportCard
            title="Debtors aging"
            blurb="Who owes you, bucketed by how overdue. Use this on your weekly collections call."
            href="/reports/debtors-aging"
            icon={AlarmClock}
            tone="amber"
          />
          <ReportCard
            title="Creditors aging"
            blurb="Who you owe, bucketed by how overdue. Plan vendor payment runs from this list."
            href="/reports/creditors-aging"
            icon={Hourglass}
            tone="purple"
          />
        </div>

        <h2 className="text-sm font-semibold text-text-secondary mt-6 mb-3">Profit &amp; valuation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ReportCard
            title="Profit &amp; loss"
            blurb="Revenue minus COGS, expenses and salary. Pick a date range; net at the bottom is what you took home."
            href="/reports/profit-loss"
            icon={PiggyBank}
            tone="green"
          />
          <ReportCard
            title="Cash flow"
            blurb="Where cash actually moved — receipts in, payments out, grouped by activity. Closing = opening + net change."
            href="/reports/cash-flow"
            icon={Boxes}
            tone="blue"
          />
          <ReportCard
            title="Stock valuation"
            blurb="Current on-hand quantity × landed cost, per item / per location."
            href="/valuation"
            icon={Boxes}
            tone="neutral"
          />
        </div>

        <p className="mt-8 text-[11px] text-text-tertiary">
          Need GSTR JSON exports, cash-flow, or trial balance? On the Phase 5 roadmap.
        </p>
      </div>
    </RequireRead>
  );
}
