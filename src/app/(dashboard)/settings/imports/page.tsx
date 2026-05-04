"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { importService } from "@/services/settings.service";
import { formatDate } from "@/lib/utils";
import { Box, Building2, Boxes, Wallet, ArrowRight, Upload } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// /settings/imports — Bulk import landing
//
// Two halves: tile grid (start a new import) + history table
// (audit trail). The wizard lives at /settings/imports/[type].
// ═══════════════════════════════════════════════════════════

interface ImportTypeCardProps {
  type: string;
  title: string;
  blurb: string;
  icon: React.ElementType;
  tone: "blue" | "green" | "amber" | "purple";
}

const TONES: Record<ImportTypeCardProps["tone"], string> = {
  blue:   "from-sky-50 to-sky-100/40 text-sky-800 dark:from-sky-950 dark:to-sky-900/30 dark:text-sky-300",
  green:  "from-emerald-50 to-emerald-100/40 text-emerald-800 dark:from-emerald-950 dark:to-emerald-900/30 dark:text-emerald-300",
  amber:  "from-amber-50 to-amber-100/40 text-amber-800 dark:from-amber-950 dark:to-amber-900/30 dark:text-amber-300",
  purple: "from-violet-50 to-violet-100/40 text-violet-800 dark:from-violet-950 dark:to-violet-900/30 dark:text-violet-300",
};

function ImportTypeCard({ type, title, blurb, icon: Icon, tone }: ImportTypeCardProps) {
  return (
    <Link
      href={`/settings/imports/${type}`}
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

const STATUS_TONES: Record<string, "gray" | "green" | "amber" | "blue" | "red"> = {
  pending: "amber",
  processing: "blue",
  completed: "green",
  completed_with_errors: "amber",
  failed: "red",
};

export default function ImportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["imports"],
    queryFn: () => importService.list({ limit: 200 }),
  });
  const rows = data ?? [];

  return (
    <RequireRead perm="inventory.imports.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-7xl mx-auto">
        <PageHeader
          title="Bulk imports"
          description="Upload a CSV to bulk-create items, parties, opening stock, or opening balances. Every upload runs a preview pass — you fix errors in your CSV and re-upload before anything is committed."
        />

        <h2 className="text-sm font-semibold text-text-secondary mt-2 mb-3">Start a new import</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <ImportTypeCard
            type="items"
            title="Items"
            blurb="SKU master — codes, names, HSN, GST rate, base UoM, brand and category."
            icon={Box}
            tone="blue"
          />
          <ImportTypeCard
            type="parties"
            title="Parties"
            blurb="Customers and suppliers — code, GSTIN, state code, contact and opening balance."
            icon={Building2}
            tone="purple"
          />
          <ImportTypeCard
            type="stock_balances"
            title="Stock balances"
            blurb="Opening on-hand quantities per item per location, with unit cost for valuation seed."
            icon={Boxes}
            tone="amber"
          />
          <ImportTypeCard
            type="opening_balances"
            title="Opening balances"
            blurb="Carry-forward AR / AP per party as of go-live. Writes one ledger entry per row."
            icon={Wallet}
            tone="green"
          />
        </div>

        <h2 className="text-sm font-semibold text-text-secondary mt-8 mb-3">
          Recent uploads <Badge tone="neutral">{rows.length}</Badge>
        </h2>
        <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Upload size={20} />}
              title="No imports yet"
              description="Pick an import type above to get started."
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left  px-3 py-2 font-medium">When</th>
                  <th className="text-left  px-3 py-2 font-medium">Entity</th>
                  <th className="text-left  px-3 py-2 font-medium">File</th>
                  <th className="text-left  px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-right px-3 py-2 font-medium text-emerald-700">Success</th>
                  <th className="text-right px-3 py-2 font-medium text-red-700">Errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-bg-hover">
                    <td className="px-3 py-2 text-text-tertiary text-[12px]">{formatDate(b.created_at)}</td>
                    <td className="px-3 py-2"><Badge tone="neutral">{b.entity}</Badge></td>
                    <td className="px-3 py-2 font-mono text-[12px] truncate max-w-xs">{b.file_name}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONES[b.status] ?? "gray"}>{b.status.replace(/_/g, " ")}</Badge></td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.total_rows}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{b.success_rows}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">{b.error_rows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </RequireRead>
  );
}
