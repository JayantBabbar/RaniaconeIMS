"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Can } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { expenseCategoryService } from "@/services/expenses.service";
import { accountService } from "@/services/accounts.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Plus, Tag } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Expense Categories — tenant-customisable master data.
// Each category has its own expense_category financial_account
// auto-created on insert; the running balance shown in the
// "Spent" column rolls up every Expense posted under that category.
// ═══════════════════════════════════════════════════════════

export default function ExpenseCategoriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseCategoryService.list({ limit: 200 }),
  });
  const categories = data ?? [];

  const { data: accs } = useQuery({
    queryKey: ["accounts", { type: "expense_category" }],
    queryFn: () => accountService.list({ type: "expense_category", limit: 200 }),
  });
  const balanceByCat = new Map((accs ?? []).filter((a) => a.expense_category_id).map((a) => [a.expense_category_id!, Number(a.current_balance)]));
  const balanceByAcc = new Map((accs ?? []).map((a) => [a.id, Number(a.current_balance)]));

  const create = useMutation({
    mutationFn: (data: { code: string; name: string; is_capital?: boolean }) => expenseCategoryService.create(data),
    onSuccess: () => {
      toast.success("Category added");
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setShowCreate(false);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Create failed"),
  });

  return (
    <RequireRead perm="inventory.expense_categories.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Expense Categories"
          description="The buckets you sort spending into. Edit the defaults to fit your business — add ones for 'Office rent', 'Internet', 'Tea & coffee', whatever. Each category gets its own ledger so reports can roll up cleanly."
          actions={
            <Can perm="inventory.expense_categories.write">
              <Button kind="primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New category</Button>
            </Can>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : categories.length === 0 ? (
          <EmptyState icon={<Tag size={20} />} title="No categories yet" description="Add a few — Petrol, Diesel, Food, Labour are common starts." />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto mt-3">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Spent</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  // Lookup balance by category id first; fallback through expense_account_id
                  const balance = balanceByCat.get(c.id) ?? balanceByAcc.get(c.expense_account_id) ?? 0;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-mono text-[12px]">{c.code}</td>
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-text-tertiary">
                        {c.is_capital ? <Badge tone="amber">capital</Badge> : <span>opex</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {balance > 0 ? formatCurrency(balance, "INR", "en-IN") : <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={c.is_active ? "green" : "neutral"}>{c.is_active ? "active" : "inactive"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateCategoryDialog onClose={() => setShowCreate(false)} onSubmit={(d) => create.mutate(d)} loading={create.isPending} />}
    </RequireRead>
  );
}

function CreateCategoryDialog({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (d: { code: string; name: string; is_capital?: boolean }) => void; loading: boolean }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isCapital, setIsCapital] = useState(false);
  const valid = code.trim().length > 0 && name.trim().length > 0;
  return (
    <Dialog open onClose={onClose} title="New expense category" width="sm">
      <div className="space-y-3">
        <FormField label="Code" required hint="Short identifier — typically uppercase">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="OFFICE-RENT" autoFocus />
        </FormField>
        <FormField label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office rent" />
        </FormField>
        <Checkbox checked={isCapital} onChange={setIsCapital} label="Capital expense (vs opex)" />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" disabled={!valid || loading} onClick={() => valid && onSubmit({ code, name, is_capital: isCapital })}>
          {loading ? <Spinner size={14} /> : "Create"}
        </Button>
      </div>
    </Dialog>
  );
}
