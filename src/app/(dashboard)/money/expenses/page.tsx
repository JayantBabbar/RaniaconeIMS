"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Can } from "@/components/ui/can";
import { expenseService, expenseCategoryService } from "@/services/expenses.service";
import { partyService } from "@/services/parties.service";
import { accountService } from "@/services/accounts.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Receipt, Tag } from "lucide-react";
import type { ExpenseStatus } from "@/types";

const STATUS_TONES: Record<ExpenseStatus, "gray" | "green" | "red" | "amber"> = {
  draft: "amber", posted: "green", cancelled: "red",
};

export default function ExpensesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => expenseService.list({ limit: 200 }),
  });
  const expenses = data ?? [];

  const { data: cats } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseCategoryService.list({ is_active: true }),
  });
  const catById = new Map((cats ?? []).map((c) => [c.id, c]));

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const partyById = new Map((partiesRaw?.data ?? []).map((p) => [p.id, p]));

  const { data: accs } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list({ limit: 200 }),
  });
  const accById = new Map((accs ?? []).map((a) => [a.id, a]));

  return (
    <RequireRead perm="inventory.expenses.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Expenses"
          description="Day-to-day spending — fuel, food, daily wages, etc. Each expense hits its category's ledger and decreases your cash/bank balance."
          actions={
            <div className="flex gap-2">
              <Can perm="inventory.expense_categories.read">
                <Link href="/money/expenses/categories"><Button kind="ghost"><Tag size={14} /> Categories</Button></Link>
              </Can>
              <Can perm="inventory.expenses.write">
                <Link href="/money/expenses/new"><Button kind="primary"><Plus size={14} /> New expense</Button></Link>
              </Can>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt size={20} />}
            title="No expenses yet"
            description="Record your first expense — petrol, food, or daily wages — to track day-to-day spend."
            action={<Can perm="inventory.expenses.write"><Link href="/money/expenses/new"><Button kind="primary"><Plus size={14} /> New expense</Button></Link></Can>}
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Voucher #</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-left px-3 py-2 font-medium">Paid from</th>
                  <th className="text-left px-3 py-2 font-medium">Vendor</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-bg-hover">
                    <td className="px-3 py-2 font-mono text-[12px]">{e.expense_number}</td>
                    <td className="px-3 py-2 text-text-tertiary">{formatDate(e.expense_date)}</td>
                    <td className="px-3 py-2">{catById.get(e.category_id)?.name ?? e.category_id}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{e.description}</td>
                    <td className="px-3 py-2 text-text-tertiary">{accById.get(e.paid_from_account_id)?.name ?? e.paid_from_account_id}</td>
                    <td className="px-3 py-2 text-text-tertiary">{e.vendor_id ? partyById.get(e.vendor_id)?.name ?? "—" : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(e.amount, "INR", "en-IN")}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONES[e.status]}>{e.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireRead>
  );
}
