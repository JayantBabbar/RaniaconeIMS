"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Badge } from "@/components/ui/badge";
import { RequireRead } from "@/components/ui/forbidden-state";
import { ledgerService } from "@/services/ledger.service";
import { accountService } from "@/services/accounts.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ScrollText, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Per-account ledger — every entry against this one account, in
// chronological order, with running balance. The "personal view"
// from §11 of clientneeds.txt for cash/bank/cheque/gpay accounts;
// for party_receivable accounts the per-party view at
// /parties/[id]?tab=ledger is the more useful entry point.
// ═══════════════════════════════════════════════════════════

export default function AccountLedgerPage() {
  const { accountId } = useParams<{ accountId: string }>();
  return (
    <RequireRead perm="inventory.ledger.read">
      <AccountLedger id={accountId} />
    </RequireRead>
  );
}

function AccountLedger({ id }: { id: string }) {
  const { data: account, isLoading: aLoading } = useQuery({
    queryKey: ["account", id],
    queryFn: () => accountService.getById(id),
  });

  const { data: entries, isLoading: eLoading } = useQuery({
    queryKey: ["ledger-account", id],
    queryFn: () => ledgerService.listAccountEntries(id, { limit: 500 }),
  });

  if (aLoading || eLoading) {
    return (
      <>
        <TopBar />
        <div className="flex justify-center py-16"><Spinner /></div>
      </>
    );
  }
  if (!account) {
    return (
      <>
        <TopBar />
        <EmptyState icon={<ScrollText size={20} />} title="Account not found" description="The account may have been deleted." />
      </>
    );
  }

  const balanceNum = Number(account.current_balance);
  const isLiability = account.type === "party_payable" || account.type === "sales_income" || account.type === "gst_output" || account.type === "capital";
  const drCr = balanceNum === 0 ? "" : ((balanceNum > 0) !== isLiability ? "Dr" : "Cr");

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-5xl mx-auto">
        <Link href="/money/accounts" className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> All accounts
        </Link>
        <PageHeader
          title={account.name}
          description={`${account.code} · ${account.type.replace(/_/g, " ")}`}
          actions={
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {formatCurrency(Math.abs(balanceNum), "INR", "en-IN")}
              </span>
              {drCr && <Badge tone={drCr === "Dr" ? "blue" : "amber"}>{drCr}</Badge>}
            </div>
          }
        />

        {(entries ?? []).length === 0 ? (
          <EmptyState icon={<ScrollText size={20} />} title="No entries yet" description="This account has no transactions in the selected range." />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto mt-3">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Note</th>
                  <th className="text-right px-3 py-2 font-medium">Debit</th>
                  <th className="text-right px-3 py-2 font-medium">Credit</th>
                  <th className="text-right px-3 py-2 font-medium">Running</th>
                </tr>
              </thead>
              <tbody>
                {(entries ?? []).map((e) => {
                  const debit = Number(e.debit);
                  const credit = Number(e.credit);
                  const running = Number(e.running_balance);
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2 text-text-tertiary whitespace-nowrap">{formatDate(e.entry_date)}</td>
                      <td className="px-3 py-2 text-text-tertiary capitalize">{e.source_doc_type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2">{e.remarks ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{debit > 0 ? formatCurrency(debit, "INR", "en-IN") : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{credit > 0 ? formatCurrency(credit, "INR", "en-IN") : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(Math.abs(running), "INR", "en-IN")}
                        <span className="ml-1 text-[10px] text-text-tertiary">{(running > 0) !== isLiability ? "Dr" : "Cr"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
