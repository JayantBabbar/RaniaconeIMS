"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { Input, Textarea, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { partyService } from "@/services/parties.service";
import { accountService } from "@/services/accounts.service";
import { expenseService, expenseCategoryService } from "@/services/expenses.service";
import { isApiError } from "@/lib/api-client";
import { ArrowLeft } from "lucide-react";

const inputClass =
  "w-full px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

export default function NewExpensePage() {
  return (
    <RequireRead perm="inventory.expenses.write">
      <NewExpenseForm />
    </RequireRead>
  );
}

function NewExpenseForm() {
  const router = useRouter();
  const toast = useToast();

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidFromId, setPaidFromId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState("");

  const { data: cats } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expenseCategoryService.list({ is_active: true, limit: 200 }),
  });
  const categories = cats ?? [];

  const { data: accs } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list({ limit: 200 }),
  });
  // Cash, bank, gpay only — you don't pay an expense out of cheque-in-transit
  const eligibleAccounts = (accs ?? []).filter((a) => ["cash_in_hand", "bank", "gpay"].includes(a.type) && a.is_active);

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const vendors = (partiesRaw?.data ?? []).filter((p) => p.party_type === "supplier" || p.party_type === "vendor" || p.party_type === "both");

  const create = useMutation({
    mutationFn: () => expenseService.create({
      expense_date: expenseDate,
      category_id: categoryId,
      amount,
      paid_from_account_id: paidFromId,
      vendor_id: vendorId || undefined,
      description,
    }),
    onSuccess: (e) => {
      toast.success(`Expense ${e.expense_number ?? "created"}`);
      router.push("/money/expenses");
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not create expense"),
  });

  const canSubmit = !!categoryId && Number(amount) > 0 && !!paidFromId && description.trim().length > 0;

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title="New expense"
          description="Record a day-to-day expense. Hits the category's expense ledger on debit; decreases the cash / bank / GPay account on credit."
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </FormField>
            <FormField label="Category" required>
              <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— select category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_capital ? " (Capital)" : ""}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (₹)" required>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </FormField>
            <FormField label="Paid from" required hint="Cash, bank, or GPay account">
              <select className={inputClass} value={paidFromId} onChange={(e) => setPaidFromId(e.target.value)}>
                <option value="">— select —</option>
                {eligibleAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Paid to vendor" hint="Optional — useful for 'fuel bill paid to BPCL', 'phone bill to Airtel'">
            <select className={inputClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">— none —</option>
              {vendors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Description" required>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" rows={3} />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button kind="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button kind="primary" onClick={() => canSubmit && create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? <Spinner size={14} /> : "Save expense"}
          </Button>
        </div>
      </div>
    </>
  );
}
