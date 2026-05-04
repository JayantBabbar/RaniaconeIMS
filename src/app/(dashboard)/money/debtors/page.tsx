"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { accountService } from "@/services/accounts.service";
import { partyService } from "@/services/parties.service";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownToLine, ArrowUpFromLine, ArrowRight, Building2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Debtors / Creditors view (§5 of clientneeds.txt).
//
// Pulls every party_receivable + party_payable account, joins
// against parties, and shows a sortable list. ?direction=payable
// flips the title + sort order. The personal-ledger drilldown
// lives at /parties/[id]?tab=ledger (added in slice 8).
// ═══════════════════════════════════════════════════════════

type Direction = "receivable" | "payable";

export default function DebtorsPage() {
  const params = useSearchParams();
  const direction: Direction = (params.get("direction") as Direction) === "payable" ? "payable" : "receivable";
  const [search, setSearch] = useState("");

  const { data: accountsRaw, isLoading } = useQuery({
    queryKey: ["accounts", { type: direction === "receivable" ? "party_receivable" : "party_payable" }],
    queryFn: () => accountService.list({
      type: direction === "receivable" ? "party_receivable" : "party_payable",
      limit: 500,
    }),
  });

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 500 }),
  });
  const partyById = new Map((partiesRaw?.data ?? []).map((p) => [p.id, p]));

  const rows = useMemo(() => {
    const list = (accountsRaw ?? [])
      .map((a) => ({
        accountId: a.id,
        partyId: a.party_id ?? "",
        party: a.party_id ? partyById.get(a.party_id) : undefined,
        balance: Number(a.current_balance),
        opening: Number(a.opening_balance),
      }))
      .filter((r) => Math.abs(r.balance) > 0.005);
    if (search.trim()) {
      const q = search.toLowerCase();
      return list.filter((r) => r.party?.name.toLowerCase().includes(q) || r.party?.code.toLowerCase().includes(q));
    }
    return list.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [accountsRaw, partyById, search]);

  const total = rows.reduce((s, r) => s + Math.abs(r.balance), 0);

  return (
    <RequireRead perm="inventory.ledger.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title={direction === "receivable" ? "Debtors" : "Creditors"}
          description={direction === "receivable"
            ? "Customers who owe you money — sorted by largest outstanding first."
            : "Vendors you owe — sorted by largest outstanding first."}
          actions={
            <div className="flex gap-2 items-center">
              <Link
                href={direction === "receivable" ? "/money/debtors?direction=payable" : "/money/debtors"}
                className="text-xs text-brand hover:underline"
              >
                Switch to {direction === "receivable" ? "Creditors" : "Debtors"}
              </Link>
            </div>
          }
        />

        <div className="flex items-center gap-3 mt-3 mb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${direction === "receivable" ? "customers" : "vendors"}…`}
            className="flex-1 max-w-xs px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <span className="text-xs text-text-tertiary tabular-nums">
            {direction === "receivable" ? <><ArrowDownToLine size={11} className="inline" /> {formatCurrency(total, "INR", "en-IN")} owed to you</>
              : <><ArrowUpFromLine size={11} className="inline" /> {formatCurrency(total, "INR", "en-IN")} owed by you</>}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Building2 size={20} />}
            title={direction === "receivable" ? "Everyone's settled up" : "Nothing owed"}
            description={direction === "receivable"
              ? "No customer has an outstanding balance. Receipts you've recorded have fully settled their invoices."
              : "No vendor has an outstanding balance with you."}
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{direction === "receivable" ? "Customer" : "Vendor"}</th>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-right px-3 py-2 font-medium">Opening</th>
                  <th className="text-right px-3 py-2 font-medium">Outstanding</th>
                  <th className="px-3 py-2 font-medium">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isCredit = direction === "receivable" ? r.balance < 0 : r.balance > 0;
                  return (
                    <tr key={r.accountId} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-medium">
                        {r.party ? (
                          <Link href={`/parties/${r.partyId}?tab=ledger`} className="hover:underline">
                            {r.party.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-text-tertiary">{r.party?.code ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-tertiary">{formatCurrency(Math.abs(r.opening), "INR", "en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(Math.abs(r.balance), "INR", "en-IN")}
                        {isCredit && <Badge tone="blue" className="ml-2">credit</Badge>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.party && (
                          <Link href={`/parties/${r.partyId}?tab=ledger`} className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline">
                            Ledger <ArrowRight size={12} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireRead>
  );
}
