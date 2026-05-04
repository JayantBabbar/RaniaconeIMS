"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { accountService } from "@/services/accounts.service";
import type { AccountType, FinancialAccount } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, Landmark } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Chart of Accounts.
//
// Read-mostly page. The system seeds the standard ledgers; users
// can rename them but not delete (system flag prevents that). Custom
// accounts (type='manual') are full CRUD — UX for that comes later
// once Phase 3 has settled.
// ═══════════════════════════════════════════════════════════

const TYPE_GROUPS: Array<{ label: string; types: AccountType[] }> = [
  { label: "Cash & Bank",          types: ["cash_in_hand", "bank", "cheque_in_transit", "gpay"] },
  { label: "Customer receivables", types: ["party_receivable"] },
  { label: "Vendor payables",      types: ["party_payable"] },
  { label: "Employee — float / payable", types: ["employee_float", "employee_payable"] },
  { label: "Income & GST",         types: ["sales_income", "gst_output"] },
  { label: "Expenses",             types: ["purchase_expense", "expense_category", "salary_expense"] },
  { label: "Other",                types: ["gst_input", "capital", "manual"] },
];

const TYPE_LABELS: Record<AccountType, string> = {
  cash_in_hand:      "Cash",
  bank:              "Bank",
  cheque_in_transit: "Cheque pending",
  gpay:              "GPay/UPI",
  party_receivable:  "Receivable",
  party_payable:     "Payable",
  employee_float:    "Employee float",
  employee_payable:  "Salary payable",
  sales_income:      "Income",
  purchase_expense:  "Purchases",
  expense_category:  "Expense category",
  salary_expense:    "Salary expense",
  gst_output:        "GST output",
  gst_input:         "GST input",
  capital:           "Capital",
  manual:            "Custom",
};

export default function AccountsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list({ limit: 200 }),
  });
  const accounts = data ?? [];

  const grouped = useMemo(() => {
    const buckets = new Map<string, FinancialAccount[]>();
    TYPE_GROUPS.forEach((g) => buckets.set(g.label, []));
    accounts.forEach((a) => {
      const group = TYPE_GROUPS.find((g) => g.types.includes(a.type as AccountType));
      const key = group?.label ?? "Other";
      buckets.set(key, [...(buckets.get(key) ?? []), a]);
    });
    return Array.from(buckets.entries()).filter(([, rows]) => rows.length > 0);
  }, [accounts]);

  return (
    <RequireRead perm="inventory.accounts.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Chart of Accounts"
          description="Every ledger this tenant uses. System accounts (cash, bank, per-customer, per-vendor, per-employee) are auto-managed; you can only rename them. Custom accounts can be added for things like petty cash drawers or specific bank sub-accounts."
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Landmark size={20} />}
            title="No accounts yet"
            description="Accounts get auto-created when you add parties or employees. If you're seeing this, contact support."
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([groupLabel, rows]) => (
              <section key={groupLabel}>
                <h2 className="text-sm font-semibold text-text-secondary mb-2">{groupLabel}</h2>
                <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Code</th>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-right px-3 py-2 font-medium">Opening</th>
                        <th className="text-right px-3 py-2 font-medium">Balance</th>
                        <th className="px-3 py-2 font-medium">&nbsp;</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => {
                        const balanceNum = Number(a.current_balance);
                        const isLiability = a.type === "party_payable" || a.type === "sales_income" || a.type === "gst_output" || a.type === "capital";
                        const drCr = balanceNum === 0 ? "" : (balanceNum > 0 !== isLiability ? "Dr" : "Cr");
                        return (
                          <tr key={a.id} className="border-t border-border hover:bg-bg-hover">
                            <td className="px-3 py-2 font-mono text-[12px]">{a.code}</td>
                            <td className="px-3 py-2 font-medium">
                              {a.name}
                              {!a.is_active && <Badge tone="neutral" className="ml-2">inactive</Badge>}
                              {a.is_system && <Badge tone="blue" className="ml-2">system</Badge>}
                            </td>
                            <td className="px-3 py-2 text-text-tertiary">{TYPE_LABELS[a.type as AccountType] ?? a.type}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-tertiary">
                              {formatCurrency(a.opening_balance, "INR", "en-IN")}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">
                              {formatCurrency(Math.abs(balanceNum), "INR", "en-IN")}
                              {drCr && <span className="ml-1 text-[10px] text-text-tertiary">{drCr}</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Link
                                href={`/money/ledger/${a.id}`}
                                className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline"
                              >
                                Ledger <ArrowRight size={12} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </RequireRead>
  );
}
